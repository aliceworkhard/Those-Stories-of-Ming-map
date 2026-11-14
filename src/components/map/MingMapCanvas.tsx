'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { SITE_CONFIG } from '@/config/site';
import {
  ALL_EVENTS,
  CAMPAIGN_MAP,
  PLACES,
  formatPlaceDisplay,
  getSnapshotForYear,
} from '@/lib/atlasData';
import {
  TERRAIN_EXAGGERATION,
  createHistoricalBaseStyle,
  registerTacticalSprites,
} from '@/engine/mapStyle';
import {
  buildPhaseRouteFeatures,
  mountHistoricalLayers,
  syncLayerVisibility,
  updateCampaignAnimationFrame,
  type PreparedRouteCurve,
} from '@/engine/MingMapLayers';
import type { CampaignPhase, HistoricalEvent, LngLat, MapVisualTheme } from '@/types/ming';
import { useAtlasStore } from '@/store/useAtlasStore';

const BASE_PHASE_DURATION_MS = 7600;
const ROUTE_GROW_DURATION_MS = 3600;
const OPENING_FLY_DURATION_MS = 1400;

/**
 * Creates a strictly 0x0, zero-transition anchor container for MapLibre Markers.
 * Why: MapLibre writes `root.style.transform = "translate(Xpx, Ypx)..."` every frame.
 * Keeping `root` 0x0 with ZERO CSS transitions or hover-scale classes guarantees
 * markers NEVER jump, lag, or oscillate on click, hover, or flyTo!
 */
function createImmutableMarkerRoot(zIndex = '15'): HTMLDivElement {
  const root = document.createElement('div');
  root.style.width = '0px';
  root.style.height = '0px';
  root.style.position = 'relative';
  root.style.overflow = 'visible';
  root.style.zIndex = zIndex;
  return root;
}

interface EventMarkerRecord {
  evt: HistoricalEvent;
  marker: maplibregl.Marker;
  root: HTMLDivElement;
  pingEl: HTMLSpanElement;
  badgeEl: HTMLDivElement;
  labelEl: HTMLDivElement;
}

function computeCinematicTrackingPose(
  phase: CampaignPhase,
  curves: PreparedRouteCurve[],
  is3D: boolean
): { center: LngLat; zoom: number; pitch: number; bearing: number } {
  const baseCenter = phase.camera.center;
  const baseZoom = phase.camera.zoom;
  const basePitch = phase.camera.pitch ?? 48;
  const baseBearing = phase.camera.bearing ?? -10;

  // Determine the dramatic focal destination of this phase (primary clash marker or primary route target)
  const primaryTarget: LngLat =
    phase.markers[0]?.coordinates ??
    curves[0]?.endPoint ??
    baseCenter;

  // Blend 58% base framing + 42% focal objective so all routes remain framed while gliding forward
  const focusCenter: LngLat = [
    baseCenter[0] * 0.58 + primaryTarget[0] * 0.42,
    baseCenter[1] * 0.58 + primaryTarget[1] * 0.42,
  ];

  return {
    center: focusCenter,
    zoom: Math.min(9.2, baseZoom + 0.34),
    pitch: is3D ? Math.min(62, basePitch + 7) : 0,
    bearing: is3D ? baseBearing + 16 : 0,
  };
}

export default function MingMapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const activeCurvesRef = useRef<PreparedRouteCurve[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Unified Campaign Auto-Camera & Route Growth Director Refs
  const phaseElapsedMsRef = useRef(0);
  const routeGrowElapsedMsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastProgressReportMsRef = useRef(0);
  const trackingShotActiveRef = useRef(false);
  const userInteractedInPhaseRef = useRef(false);
  const activePhaseRef = useRef<CampaignPhase | null>(null);
  const is3DRef = useRef(true);

  // Marker registries (kept outside React state for rock-solid 60fps performance)
  const polityMarkersRef = useRef<maplibregl.Marker[]>([]);
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const eventMarkerMapRef = useRef<Map<string, EventMarkerRecord>>(new Map());
  const campaignMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [zoomBucket, setZoomBucket] = useState<'far' | 'mid' | 'close'>('far');

  const currentYear = useAtlasStore((s) => s.currentYear);
  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const isCampaignPlaying = useAtlasStore((s) => s.isCampaignPlaying);
  const campaignSpeed = useAtlasStore((s) => s.campaignSpeed);
  const campaignReplayNonce = useAtlasStore((s) => s.campaignReplayNonce);
  const theme = useAtlasStore((s) => s.theme);
  const is3D = useAtlasStore((s) => s.is3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const cameraCommand = useAtlasStore((s) => s.cameraCommand);
  const selectEvent = useAtlasStore((s) => s.selectEvent);

  is3DRef.current = is3D;

  const currentSnapshot = useMemo(
    () => getSnapshotForYear(currentYear),
    [currentYear]
  );

  const activeCampaign = activeCampaignId
    ? CAMPAIGN_MAP[activeCampaignId] ?? null
    : null;
  const activePhase = activeCampaign
    ? activeCampaign.phases[activePhaseIndex] ?? activeCampaign.phases[0]
    : null;
  activePhaseRef.current = activePhase;

  // Helper to Sync All WebGL Data into Current Style
  const syncAllMapSourcesAndLayers = () => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    registerTacticalSprites(map);
    mountHistoricalLayers(map, currentSnapshot.geojson, theme);
    syncLayerVisibility(map, layers);

    const terSource = map.getSource('ming-territories') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (terSource) {
      terSource.setData(currentSnapshot.geojson);
    }

    const { preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;

    if (!activeCampaign) {
      updateCampaignAnimationFrame(map, [], 0, 0);
    }
  };

  // Build Persistent Event Markers Once on Map Init (Never torn down on click!)
  const mountPersistentEventMarkers = (map: maplibregl.Map) => {
    eventMarkerMapRef.current.forEach((rec) => rec.marker.remove());
    eventMarkerMapRef.current.clear();

    for (const evt of ALL_EVENTS) {
      const isMacro = evt.tier === 'macro';
      const root = createImmutableMarkerRoot(isMacro ? '22' : '18');

      // Fixed 32x32 hitbox centered at (0, 0) — NEVER scales or shifts!
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', `${evt.time.year}年 ${evt.title}`);
      btn.className = 'group cursor-pointer focus:outline-none';
      btn.style.position = 'absolute';
      btn.style.left = '0px';
      btn.style.top = '0px';
      btn.style.width = '32px';
      btn.style.height = '32px';
      btn.style.transform = 'translate(-50%, -50%)';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.padding = '0';

      const pingEl = document.createElement('span');
      pingEl.className = 'animate-ping rounded-full border-2 opacity-60 pointer-events-none';
      pingEl.style.position = 'absolute';
      pingEl.style.width = isMacro ? '28px' : '22px';
      pingEl.style.height = isMacro ? '28px' : '22px';

      const badgeEl = document.createElement('div');
      badgeEl.className = `${
        isMacro
          ? 'w-7 h-7 rounded-md rotate-45 border-2 border-amber-200/90 shadow-md group-hover:scale-110'
          : 'w-5 h-5 rounded-full border border-amber-100 shadow group-hover:scale-110'
      } flex items-center justify-center transition-transform duration-150 pointer-events-none`;

      const charSpan = document.createElement('span');
      charSpan.className = `${
        isMacro ? '-rotate-45 text-[11px] font-serif font-bold' : 'text-[10px]'
      } text-amber-50 select-none`;
      charSpan.textContent = evt.campaignId ? '战' : isMacro ? '史' : '轶';
      badgeEl.appendChild(charSpan);

      btn.appendChild(pingEl);
      btn.appendChild(badgeEl);

      // Decoupled absolute text pill below the stationary hitbox
      const labelEl = document.createElement('div');
      labelEl.style.position = 'absolute';
      labelEl.style.left = '0px';
      labelEl.style.top = isMacro ? '18px' : '15px';
      labelEl.style.transform = 'translateX(-50%)';
      labelEl.style.pointerEvents = 'none';
      labelEl.innerHTML = `<span class="opacity-75 mr-1 tabular-nums">${evt.time.year}</span>${evt.title.slice(
        0,
        10
      )}${evt.title.length > 10 ? '…' : ''}`;

      btn.addEventListener('mouseenter', () => {
        if (labelEl.dataset.hoverReveal === '1') {
          labelEl.style.display = 'block';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (labelEl.dataset.hoverReveal === '1') {
          labelEl.style.display = 'none';
        }
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        useAtlasStore.getState().selectEvent(evt.id, true);
      });

      root.appendChild(btn);
      root.appendChild(labelEl);

      const marker = new maplibregl.Marker({
        element: root,
        anchor: 'top-left',
      })
        .setLngLat(evt.location.coordinates)
        .addTo(map);

      eventMarkerMapRef.current.set(evt.id, {
        evt,
        marker,
        root,
        pingEl,
        badgeEl,
        labelEl,
      });
    }
  };

  // Sync Persistent Event Markers In-Place (Zero remove/add churn!)
  const syncEventMarkersAppearance = (
    currentTheme: MapVisualTheme,
    selectedId: string | null,
    year: number,
    bucket: 'far' | 'mid' | 'close',
    macroVis: boolean,
    allMicroVis: boolean,
    inCampaign: boolean
  ) => {
    const showMicro = allMicroVis || bucket !== 'far';

    eventMarkerMapRef.current.forEach((rec) => {
      const { evt, root, pingEl, badgeEl, labelEl } = rec;
      const isMacro = evt.tier === 'macro';

      const visible =
        !inCampaign && ((isMacro && macroVis) || (!isMacro && showMicro));
      root.style.display = visible ? 'block' : 'none';
      if (!visible) return;

      const isSelected = evt.id === selectedId;
      const isNearYear = Math.abs(evt.time.year - year) <= 5;
      root.style.zIndex = isSelected ? '38' : isMacro ? '22' : '18';

      const badgeBg = isMacro
        ? isSelected
          ? '#9B1C1C'
          : '#B83B2A'
        : isSelected
        ? '#B45309'
        : '#D97706';

      badgeEl.style.background = badgeBg;
      badgeEl.style.opacity = isSelected || isNearYear ? '1' : '0.88';
      pingEl.style.borderColor = badgeBg;
      pingEl.style.display = isSelected || isNearYear ? 'block' : 'none';

      const alwaysShowLabel =
        isMacro || isSelected || bucket === 'close' || allMicroVis;
      labelEl.dataset.hoverReveal = alwaysShowLabel ? '0' : '1';
      labelEl.style.display = alwaysShowLabel ? 'block' : 'none';
      labelEl.className = `px-2 py-0.5 rounded shadow-sm border text-[11px] whitespace-nowrap font-medium select-none ${
        isSelected
          ? 'bg-red-900 text-amber-50 border-amber-300 font-bold'
          : currentTheme === 'xuanmo'
          ? 'bg-slate-900/92 text-amber-50/95 border-slate-700'
          : 'bg-[#FFFDF7]/95 text-stone-900 border-amber-900/20'
      }`;
    });
  };

  // 1. Initialize MapLibre GL Instance & Unified 60fps Director Loop Once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createHistoricalBaseStyle(theme, is3D),
      center: SITE_CONFIG.defaultCamera.center,
      zoom: SITE_CONFIG.defaultCamera.zoom,
      pitch: is3D ? SITE_CONFIG.defaultCamera.pitch : 0,
      bearing: SITE_CONFIG.defaultCamera.bearing,
      maxPitch: 72,
      minZoom: 3.2,
      maxZoom: 13.5,
      attributionControl: false,
      localIdeographFontFamily:
        "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'Microsoft YaHei', serif",
    });

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    // Yield auto-camera gracefully if user manually drags/zooms/rotates the map
    const onManualInput = (e: { originalEvent?: Event }) => {
      if (e.originalEvent && useAtlasStore.getState().activeCampaignId) {
        userInteractedInPhaseRef.current = true;
      }
    };
    map.on('mousedown', onManualInput);
    map.on('touchstart', onManualInput);
    map.on('wheel', onManualInput);

    const updateZoomBucket = () => {
      const z = map.getZoom();
      const next = z >= 6.8 ? 'close' : z >= 5.7 ? 'mid' : 'far';
      setZoomBucket((prev) => (prev === next ? prev : next));
    };

    map.on('load', () => {
      styleReadyRef.current = true;
      syncAllMapSourcesAndLayers();
      mountPersistentEventMarkers(map);
      const st = useAtlasStore.getState();
      syncEventMarkersAppearance(
        st.theme,
        st.selectedEventId,
        st.currentYear,
        map.getZoom() >= 6.8 ? 'close' : map.getZoom() >= 5.7 ? 'mid' : 'far',
        st.layers.macroEvents,
        st.layers.showAllMicroEvents,
        Boolean(st.activeCampaignId)
      );
      updateZoomBucket();
    });

    map.on('zoomend', updateZoomBucket);

    // Unified 60fps Campaign Route Growth, Vanguard Pulse & Auto-Camera Director Loop
    const tick = (now: number) => {
      const prevNow = lastFrameTimeRef.current ?? now;
      const dt = Math.min(80, Math.max(0, now - prevNow));
      lastFrameTimeRef.current = now;

      const store = useAtlasStore.getState();
      const currentMap = mapRef.current;

      if (
        currentMap &&
        styleReadyRef.current &&
        store.activeCampaignId &&
        activeCurvesRef.current.length > 0
      ) {
        const speed = store.campaignSpeed;
        const phaseTotalMs = BASE_PHASE_DURATION_MS / speed;
        const growTotalMs = ROUTE_GROW_DURATION_MS / speed;

        // Route arrows always extend smoothly when a phase opens (even if paused for inspection)
        routeGrowElapsedMsRef.current = Math.min(
          growTotalMs,
          routeGrowElapsedMsRef.current + dt
        );
        const rawGrow = Math.min(1, routeGrowElapsedMsRef.current / growTotalMs);
        // Smooth cubic ease-out for dramatic marching extension
        const easedGrow = 1 - Math.pow(1 - rawGrow, 2.4);
        const pulseProgress = (now % 3200) / 3200;

        updateCampaignAnimationFrame(
          currentMap,
          activeCurvesRef.current,
          easedGrow,
          pulseProgress
        );

        if (store.isCampaignPlaying) {
          phaseElapsedMsRef.current += dt;
          const pct = Math.min(
            100,
            (phaseElapsedMsRef.current / phaseTotalMs) * 100
          );

          // Update UI progress bar at ~15fps to avoid unnecessary React renders
          if (now - lastProgressReportMsRef.current > 65) {
            lastProgressReportMsRef.current = now;
            store.setCampaignPhaseProgress(pct);
          }

          // Stage B: Continuous 3D Cinematic Tracking & Orbit after opening fly-in completes!
          if (
            phaseElapsedMsRef.current >= OPENING_FLY_DURATION_MS &&
            !trackingShotActiveRef.current &&
            !userInteractedInPhaseRef.current &&
            activePhaseRef.current
          ) {
            trackingShotActiveRef.current = true;
            const remainingMs = Math.max(
              1200,
              phaseTotalMs - phaseElapsedMsRef.current
            );
            const targetPose = computeCinematicTrackingPose(
              activePhaseRef.current,
              activeCurvesRef.current,
              is3DRef.current
            );
            currentMap.easeTo({
              center: targetPose.center,
              zoom: targetPose.zoom,
              pitch: targetPose.pitch,
              bearing: targetPose.bearing,
              duration: remainingMs,
              easing: (t) => t * (2 - t),
              essential: true,
            });
          }

          // Stage C: Automatic Phase Progression when act completes!
          if (phaseElapsedMsRef.current >= phaseTotalMs) {
            phaseElapsedMsRef.current = 0;
            store.nextCampaignPhase();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    mapRef.current = map;

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      styleReadyRef.current = false;
      eventMarkerMapRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. React to Theme or 3D Terrain Mode Changes
  const prevThemeRef = useRef(theme);
  const prev3DRef = useRef(is3D);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (prevThemeRef.current !== theme) {
      prevThemeRef.current = theme;
      prev3DRef.current = is3D;
      styleReadyRef.current = false;
      map.setStyle(createHistoricalBaseStyle(theme, is3D));
      map.once('styledata', () => {
        styleReadyRef.current = true;
        syncAllMapSourcesAndLayers();
      });
      return;
    }

    if (prev3DRef.current !== is3D) {
      prev3DRef.current = is3D;
      if (styleReadyRef.current && map.getSource('terrain-dem')) {
        map.setTerrain(
          is3D ? { source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION } : null
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, is3D]);

  // 3. Sync WebGL Territory Polygons, Visibility & Campaign Curve Definitions
  useEffect(() => {
    syncAllMapSourcesAndLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, layers, activeCampaignId, activePhaseIndex]);

  // 4. Campaign Phase Opening Camera & Clock Reset (Stage A of Auto-Camera Director!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCampaign || !activePhase) return;

    phaseElapsedMsRef.current = 0;
    routeGrowElapsedMsRef.current = 0;
    trackingShotActiveRef.current = false;
    userInteractedInPhaseRef.current = false;

    map.flyTo({
      center: activePhase.camera.center,
      zoom: activePhase.camera.zoom,
      pitch: is3D ? (activePhase.camera.pitch ?? 50) : 0,
      bearing: is3D ? (activePhase.camera.bearing ?? -12) : 0,
      duration: OPENING_FLY_DURATION_MS,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, activePhaseIndex, campaignReplayNonce]);

  // Pause / Resume Camera Glide cleanly when `isCampaignPlaying` toggles mid-phase
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCampaign) return;
    if (!isCampaignPlaying) {
      if (trackingShotActiveRef.current) {
        map.stop();
        trackingShotActiveRef.current = false;
      }
    } else {
      userInteractedInPhaseRef.current = false;
    }
  }, [isCampaignPlaying, activeCampaign]);

  // 5. Execute Non-Campaign Declarative Camera FlyTo Commands (Event Click, TOC, Terrain Inspect)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) return;
    const { pose } = cameraCommand;
    map.flyTo({
      center: pose.center,
      zoom: pose.zoom,
      pitch: is3D ? (pose.pitch ?? 44) : 0,
      bearing: is3D ? (pose.bearing ?? 0) : 0,
      duration: 1300,
      essential: true,
    });
  }, [cameraCommand, is3D]);

  // 6. Sync Persistent Event Markers In-Place (Rock-Solid Zero Jumping!)
  useEffect(() => {
    syncEventMarkersAppearance(
      theme,
      selectedEventId,
      currentYear,
      zoomBucket,
      layers.macroEvents,
      layers.showAllMicroEvents,
      Boolean(activeCampaign)
    );
  }, [
    activeCampaign,
    currentYear,
    layers.macroEvents,
    layers.showAllMicroEvents,
    selectedEventId,
    theme,
    zoomBucket,
  ]);

  // 7. Render Polity Dynasty Seal Banners (Immutable 0x0 Root + WHY Tooltip)
  useEffect(() => {
    const map = mapRef.current;
    polityMarkersRef.current.forEach((m) => m.remove());
    polityMarkersRef.current = [];
    if (!map || !layers.territories) return;

    for (const feat of currentSnapshot.geojson.features) {
      const props = feat.properties as Record<string, unknown>;
      const coord = props.labelCoord as [number, number] | undefined;
      if (!coord) continue;

      const root = createImmutableMarkerRoot('12');
      const color = String(props.color || '#B83B2A');
      const shortLabel = String(props.shortLabel || props.polityName || '');
      const ruler = String(props.ruler || '');
      const changeReason = String(props.changeReason || '');
      const isTributary = props.controlType === 'tributary-garrison';

      root.innerHTML = `
        <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%)" class="group pointer-events-auto select-none cursor-help">
          <div style="border-color:${color}88; background:${
            theme === 'xuanmo'
              ? 'rgba(18, 22, 29, 0.84)'
              : 'rgba(250, 246, 236, 0.88)'
          }" class="px-2.5 py-1 rounded border shadow-sm backdrop-blur-xs transition-transform duration-150 group-hover:scale-105 flex items-center gap-1.5 whitespace-nowrap">
            <span style="background:${color}" class="w-2 h-2 rounded-full shrink-0"></span>
            <span style="color:${
              theme === 'xuanmo' ? '#F5EFE2' : '#261E18'
            }" class="font-serif font-bold tracking-widest text-xs">${shortLabel}</span>
            ${
              isTributary
                ? '<span class="text-[10px] opacity-70 px-1 border border-current rounded">羁縻</span>'
                : ''
            }
          </div>
          <div class="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2.5 rounded-lg shadow-xl border text-xs z-50 pointer-events-none ${
            theme === 'xuanmo'
              ? 'bg-slate-900/95 border-amber-500/30 text-amber-50'
              : 'bg-[#FAF6EC]/98 border-amber-900/25 text-stone-800'
          }">
            <div class="font-serif font-bold text-sm mb-0.5" style="color:${color}">${String(
              props.polityName
            )}</div>
            <div class="opacity-75 text-[11px] mb-1">主帅/君主：${ruler} · 治所：${String(
              props.capitalName
            )}</div>
            <div class="leading-relaxed border-t border-current/10 pt-1 text-[11px]">
              <span class="font-semibold">版图成因：</span>${changeReason}
            </div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: root, anchor: 'top-left' })
        .setLngLat(coord)
        .addTo(map);
      polityMarkersRef.current.push(marker);
    }
  }, [currentSnapshot, layers.territories, theme]);

  // 8. Render Strategic Ancient-Modern Place Labels (Immutable 0x0 Root)
  useEffect(() => {
    const map = mapRef.current;
    placeMarkersRef.current.forEach((m) => m.remove());
    placeMarkersRef.current = [];
    if (!map || !layers.places) return;

    const visiblePlaces = PLACES.filter((p) => {
      if (p.type === 'capital' || p.type === 'garrison-nine') return true;
      if (zoomBucket === 'mid') return p.type === 'pass';
      if (zoomBucket === 'close') return true;
      return false;
    });

    for (const place of visiblePlaces) {
      const root = createImmutableMarkerRoot('14');
      root.style.pointerEvents = 'none';

      const labelText = formatPlaceDisplay(
        place.ancientName,
        place.modernName,
        placeNameMode
      );
      const isCap = place.type === 'capital';
      const isPass = place.type === 'pass' || place.type === 'garrison-nine';

      root.innerHTML = `
        <div style="position:absolute;left:0;top:6px;transform:translateX(-50%)" class="flex items-center gap-1 px-1.5 py-0.5 rounded select-none ${
          theme === 'xuanmo'
            ? 'bg-slate-950/68 text-stone-200'
            : 'bg-[#F8F3E6]/82 text-stone-800'
        } backdrop-blur-[1px]">
          <span class="${
            isCap
              ? 'w-2 h-2 rotate-45 bg-red-700 border border-amber-300'
              : isPass
              ? 'w-1.5 h-1.5 bg-amber-700'
              : 'w-1.5 h-1.5 rounded-full bg-stone-500'
          } inline-block shrink-0"></span>
          <span class="${
            isCap ? 'font-serif font-bold text-[11px]' : 'text-[10px] font-medium'
          } whitespace-nowrap tracking-wide">${labelText}</span>
        </div>
      `;

      const marker = new maplibregl.Marker({
        element: root,
        anchor: 'top-left',
      })
        .setLngLat(place.coordinates)
        .addTo(map);
      placeMarkersRef.current.push(marker);
    }
  }, [layers.places, placeNameMode, zoomBucket, theme]);

  // 9. Render Active Campaign Battlefield Shockwaves & Route Callout Tags (Immutable 0x0 Root)
  useEffect(() => {
    const map = mapRef.current;
    campaignMarkersRef.current.forEach((m) => m.remove());
    campaignMarkersRef.current = [];
    if (!map || !activeCampaign || !activePhase) return;

    const { preparedCurves } = buildPhaseRouteFeatures(activeCampaign, activePhase);
    for (const curve of preparedCurves) {
      const root = createImmutableMarkerRoot('28');
      root.style.pointerEvents = 'none';
      const tacticBadge =
        curve.tactic === 'ambush'
          ? '奇袭'
          : curve.tactic === 'naval'
          ? '水师'
          : curve.tactic === 'retreat'
          ? '败退'
          : curve.tactic === 'supply'
          ? '粮道'
          : '主力';
      root.innerHTML = `
        <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);border-color:${curve.color}" class="px-2 py-0.5 rounded-full border shadow-md text-[11px] font-medium flex items-center gap-1 whitespace-nowrap select-none ${
          theme === 'xuanmo'
            ? 'bg-slate-950/92 text-amber-50'
            : 'bg-[#FFFDF8]/96 text-stone-900'
        }">
          <span style="background:${curve.color}" class="px-1.5 py-0.2 rounded-full text-[10px] text-white font-bold">${tacticBadge}</span>
          <span>${curve.label}</span>
        </div>
      `;
      const m = new maplibregl.Marker({ element: root, anchor: 'top-left' })
        .setLngLat(curve.midPoint)
        .addTo(map);
      campaignMarkersRef.current.push(m);
    }

    for (const bm of activePhase.markers) {
      const root = createImmutableMarkerRoot('32');
      root.style.pointerEvents = 'none';
      const accent = bm.color || '#B83B2A';
      const iconChar =
        bm.kind === 'siege'
          ? '围'
          : bm.kind === 'cutoff'
          ? '锁'
          : bm.kind === 'pass'
          ? '关'
          : '战';

      root.innerHTML = `
        <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%)" class="flex items-center justify-center select-none">
          <span style="background:${accent}" class="animate-ping absolute inline-flex h-10 w-10 rounded-full opacity-45"></span>
          <div style="background:${accent}" class="relative w-8 h-8 rounded-full border-2 border-amber-200 shadow-lg flex items-center justify-center text-white font-serif font-bold text-xs">
            ${iconChar}
          </div>
        </div>
        <div style="position:absolute;left:0;top:20px;transform:translateX(-50%);border-color:${accent}" class="px-2.5 py-1 rounded-md shadow-lg border-l-4 text-xs select-none ${
          theme === 'xuanmo'
            ? 'bg-slate-900/95 text-amber-50'
            : 'bg-[#FAF5E8]/98 text-stone-900'
        }">
          <div class="font-serif font-bold whitespace-nowrap">${bm.label}</div>
          ${
            bm.subLabel
              ? `<div class="text-[10px] opacity-80 whitespace-nowrap">${bm.subLabel}</div>`
              : ''
          }
        </div>
      `;
      const m = new maplibregl.Marker({ element: root, anchor: 'top-left' })
        .setLngLat(bm.coordinates)
        .addTo(map);
      campaignMarkersRef.current.push(m);
    }
  }, [activeCampaign, activePhase, theme]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="明途舆图纪三维交互历史地图画布"
      />
    </div>
  );
}
