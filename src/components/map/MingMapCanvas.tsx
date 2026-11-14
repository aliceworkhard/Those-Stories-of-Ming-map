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
  createHistoricalBaseStyle,
  registerTacticalSprites,
} from '@/engine/mapStyle';
import {
  buildPhaseRouteFeatures,
  mountHistoricalLayers,
  syncLayerVisibility,
  updateVanguardAnimationFrame,
  type PreparedRouteCurve,
} from '@/engine/MingMapLayers';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function MingMapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const activeCurvesRef = useRef<PreparedRouteCurve[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Marker registries (kept outside React state for 60fps pan/tilt performance)
  const polityMarkersRef = useRef<maplibregl.Marker[]>([]);
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const eventMarkersRef = useRef<maplibregl.Marker[]>([]);
  const campaignMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [zoomBucket, setZoomBucket] = useState<'far' | 'mid' | 'close'>('far');

  const currentYear = useAtlasStore((s) => s.currentYear);
  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const theme = useAtlasStore((s) => s.theme);
  const is3D = useAtlasStore((s) => s.is3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const cameraCommand = useAtlasStore((s) => s.cameraCommand);
  const selectEvent = useAtlasStore((s) => s.selectEvent);

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

    const { featureCollection, preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;

    const routeSource = map.getSource('campaign-routes') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (routeSource) {
      routeSource.setData(featureCollection);
    }
  };

  // 1. Initialize MapLibre GL Instance Once
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
      maxZoom: 12.5,
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

    const updateZoomBucket = () => {
      const z = map.getZoom();
      const next = z >= 6.8 ? 'close' : z >= 5.7 ? 'mid' : 'far';
      setZoomBucket((prev) => (prev === next ? prev : next));
    };

    map.on('load', () => {
      styleReadyRef.current = true;
      syncAllMapSourcesAndLayers();
      updateZoomBucket();
    });

    map.on('zoomend', updateZoomBucket);

    // 60fps Vanguard Spearhead Animation Loop (active only when campaign routes exist)
    const startTime = performance.now();
    const tick = (now: number) => {
      if (mapRef.current && styleReadyRef.current && activeCurvesRef.current.length > 0) {
        const progress = ((now - startTime) % 3600) / 3600;
        updateVanguardAnimationFrame(
          mapRef.current,
          activeCurvesRef.current,
          progress
        );
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
          is3D ? { source: 'terrain-dem', exaggeration: 1.85 } : null
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, is3D]);

  // 3. Sync WebGL Territory Polygons, Visibility & Campaign Routes
  useEffect(() => {
    syncAllMapSourcesAndLayers();
    if (!activeCampaign && mapRef.current && styleReadyRef.current) {
      updateVanguardAnimationFrame(mapRef.current, [], 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, layers, activeCampaignId, activePhaseIndex]);

  // 4. Execute Declarative Camera FlyTo Commands
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) return;
    const { pose } = cameraCommand;
    map.flyTo({
      center: pose.center,
      zoom: pose.zoom,
      pitch: is3D ? (pose.pitch ?? 44) : 0,
      bearing: is3D ? (pose.bearing ?? 0) : 0,
      duration: 1350,
      essential: true,
    });
  }, [cameraCommand, is3D]);

  // 5. Render Polity Dynasty Seal Banners (with WHY tooltip on hover)
  useEffect(() => {
    const map = mapRef.current;
    polityMarkersRef.current.forEach((m) => m.remove());
    polityMarkersRef.current = [];
    if (!map || !layers.territories) return;

    for (const feat of currentSnapshot.geojson.features) {
      const props = feat.properties as Record<string, unknown>;
      const coord = props.labelCoord as [number, number] | undefined;
      if (!coord) continue;

      const el = document.createElement('div');
      el.className = 'group pointer-events-auto relative select-none cursor-help';

      const color = String(props.color || '#B83B2A');
      const shortLabel = String(props.shortLabel || props.polityName || '');
      const ruler = String(props.ruler || '');
      const changeReason = String(props.changeReason || '');
      const isTributary = props.controlType === 'tributary-garrison';

      el.innerHTML = `
        <div style="border-color:${color}88; background:${
          theme === 'xuanmo'
            ? 'rgba(18, 22, 29, 0.82)'
            : 'rgba(250, 246, 236, 0.86)'
        }" class="px-2.5 py-1 rounded border shadow-sm backdrop-blur-xs transition-transform duration-200 group-hover:scale-105 flex items-center gap-1.5">
          <span style="background:${color}" class="w-2 h-2 rounded-full shrink-0"></span>
          <span style="color:${
            theme === 'xuanmo' ? '#F5EFE2' : '#261E18'
          }" class="font-serif font-bold tracking-widest text-xs whitespace-nowrap">${shortLabel}</span>
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
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coord)
        .addTo(map);
      polityMarkersRef.current.push(marker);
    }
  }, [currentSnapshot, layers.territories, theme]);

  // 6. Render Strategic Ancient-Modern Place Labels (Zoom LOD aware)
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
      const el = document.createElement('div');
      el.className = 'pointer-events-none select-none flex flex-col items-center';

      const labelText = formatPlaceDisplay(
        place.ancientName,
        place.modernName,
        placeNameMode
      );
      const isCap = place.type === 'capital';
      const isPass = place.type === 'pass' || place.type === 'garrison-nine';

      el.innerHTML = `
        <div class="flex items-center gap-1 px-1.5 py-0.5 rounded ${
          theme === 'xuanmo'
            ? 'bg-slate-950/65 text-stone-200'
            : 'bg-[#F8F3E6]/78 text-stone-800'
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
        element: el,
        anchor: 'top',
        offset: [0, 6],
      })
        .setLngLat(place.coordinates)
        .addTo(map);
      placeMarkersRef.current.push(marker);
    }
  }, [layers.places, placeNameMode, zoomBucket, theme]);

  // 7. Render Macro & Micro Event Markers (LOD Filtered!)
  useEffect(() => {
    const map = mapRef.current;
    eventMarkersRef.current.forEach((m) => m.remove());
    eventMarkersRef.current = [];
    if (!map) return;

    // Hide standard event markers during active battle phase replay to keep war-room crystal clear,
    // or keep only selected event subtly visible
    if (activeCampaign) return;

    const showMicro = layers.showAllMicroEvents || zoomBucket !== 'far';

    for (const evt of ALL_EVENTS) {
      if (evt.tier === 'macro' && !layers.macroEvents) continue;
      if (evt.tier === 'micro' && !showMicro) continue;

      const isSelected = evt.id === selectedEventId;
      const isNearYear = Math.abs(evt.time.year - currentYear) <= 5;
      const isMacro = evt.tier === 'macro';

      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', `${evt.time.year}年 ${evt.title}`);
      el.className =
        'group cursor-pointer focus:outline-none flex flex-col items-center transition-transform duration-200 hover:scale-110 z-20';

      const badgeBg = isMacro
        ? isSelected
          ? '#9B1C1C'
          : '#B83B2A'
        : isSelected
        ? '#B45309'
        : '#D97706';

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          ${
            isSelected || isNearYear
              ? `<span style="border-color:${badgeBg}" class="animate-ping absolute inline-flex h-full w-full rounded-full border-2 opacity-60"></span>`
              : ''
          }
          <div style="background:${badgeBg}; opacity:${
            isSelected || isNearYear ? '1' : '0.84'
          }" class="${
            isMacro
              ? 'w-7 h-7 rounded-md rotate-45 border-2 border-amber-200/90 shadow-md'
              : 'w-5 h-5 rounded-full border border-amber-100 shadow'
          } flex items-center justify-center">
            <span class="${
              isMacro ? '-rotate-45 text-[11px] font-serif font-bold' : 'text-[10px]'
            } text-amber-50">${
              evt.campaignId ? '战' : isMacro ? '史' : '轶'
            }</span>
          </div>
        </div>
        <div class="mt-1 px-2 py-0.5 rounded shadow-sm border text-[11px] whitespace-nowrap font-medium transition-all ${
          isSelected
            ? 'bg-red-900 text-amber-50 border-amber-300 font-bold scale-105'
            : theme === 'xuanmo'
            ? 'bg-slate-900/90 text-amber-50/95 border-slate-700'
            : 'bg-[#FFFDF7]/95 text-stone-900 border-amber-900/20'
        } ${
          !isMacro && !isSelected && zoomBucket !== 'close' && !layers.showAllMicroEvents
            ? 'hidden group-hover:block'
            : 'block'
        }">
          <span class="opacity-75 mr-1 tabular-nums">${evt.time.year}</span>${evt.title.slice(0, 10)}${
            evt.title.length > 10 ? '…' : ''
          }
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEvent(evt.id, true);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat(evt.location.coordinates)
        .addTo(map);
      eventMarkersRef.current.push(marker);
    }
  }, [
    activeCampaign,
    currentYear,
    layers.macroEvents,
    layers.showAllMicroEvents,
    selectEvent,
    selectedEventId,
    theme,
    zoomBucket,
  ]);

  // 8. Render Active Campaign Battlefield Shockwaves & Route Callout Tags
  useEffect(() => {
    const map = mapRef.current;
    campaignMarkersRef.current.forEach((m) => m.remove());
    campaignMarkersRef.current = [];
    if (!map || !activeCampaign || !activePhase) return;

    // 8a. Route midpoint tactical labels
    const { preparedCurves } = buildPhaseRouteFeatures(activeCampaign, activePhase);
    for (const curve of preparedCurves) {
      const tagEl = document.createElement('div');
      tagEl.className = 'pointer-events-none select-none';
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
      tagEl.innerHTML = `
        <div style="border-color:${curve.color}" class="px-2 py-0.5 rounded-full border shadow-md text-[11px] font-medium flex items-center gap-1 whitespace-nowrap ${
          theme === 'xuanmo'
            ? 'bg-slate-950/90 text-amber-50'
            : 'bg-[#FFFDF8]/95 text-stone-900'
        }">
          <span style="background:${curve.color}" class="px-1.5 py-0.2 rounded-full text-[10px] text-white font-bold">${tacticBadge}</span>
          <span>${curve.label}</span>
        </div>
      `;
      const m = new maplibregl.Marker({ element: tagEl, anchor: 'center' })
        .setLngLat(curve.midPoint)
        .addTo(map);
      campaignMarkersRef.current.push(m);
    }

    // 8b. Siege / Clash / Cutoff shockwave markers
    for (const bm of activePhase.markers) {
      const bmEl = document.createElement('div');
      bmEl.className = 'pointer-events-none select-none flex flex-col items-center z-30';
      const accent = bm.color || '#B83B2A';
      const iconChar =
        bm.kind === 'siege'
          ? '围'
          : bm.kind === 'cutoff'
          ? '锁'
          : bm.kind === 'pass'
          ? '关'
          : '战';

      bmEl.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span style="background:${accent}" class="animate-ping absolute inline-flex h-10 w-10 rounded-full opacity-45"></span>
          <div style="background:${accent}" class="relative w-8 h-8 rounded-full border-2 border-amber-200 shadow-lg flex items-center justify-center text-white font-serif font-bold text-xs">
            ${iconChar}
          </div>
        </div>
        <div style="border-color:${accent}" class="mt-1 px-2.5 py-1 rounded-md shadow-lg border-l-4 text-xs ${
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
      const m = new maplibregl.Marker({ element: bmEl, anchor: 'center' })
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
