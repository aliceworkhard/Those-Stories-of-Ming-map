'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { SITE_CONFIG } from '@/config/site';
import { CAMPAIGN_MAP, EVENT_MAP } from '@/lib/atlasData';
import {
  TERRITORY_SNAPSHOT_BY_ID,
  getSnapshotForYear,
  scheduleWarmAllTerritoryChunks,
  subscribeTerritoryChunks,
} from '@/lib/territoryData';
import {
  createHistoricalBaseStyle,
  getTerrainExaggeration,
  registerTacticalSprites,
} from '@/engine/mapStyle';
import {
  buildPhaseRouteFeatures,
  buildPolityLabelGeoJSON,
  mountHistoricalLayers,
  setCampaignSpotlightRoute,
  setCampaignStaticRoutesOnMap,
  setPlaceNameModeOnGpu,
  syncLayerVisibility,
  updateCampaignAnnotationsOnMap,
  updateCampaignArrowheadsOnMap,
  updateCausalArcsOnMap,
  updateCharacterOdysseyOnMap,
  updateEventsOnMap,
  updateTerritoryWipeOnMap,
  type PreparedRouteCurve,
} from '@/engine/MingMapLayers';
import {
  buildCampaignTerritoryFrame,
  buildEraWipeOverlayGeoJSON,
  getEraWipePlan,
  type EraWipePlan,
} from '@/engine/territoryWipe';
import { sampleAlongPath } from '@/lib/curve';
import { registerMapInstanceForCapture } from '@/lib/mapCapture';
import { emitPlaybackTick } from '@/lib/playbackBus';
import { useAtlasStore } from '@/store/useAtlasStore';
import type {
  CampaignPhase,
  LngLat,
  PerformanceMode,
  TerritoryPolityProps,
} from '@/types/ming';

const OPENING_FLY_DURATION_MS = 1050;
const STORY_STOP_DURATION_MS = 5600;
const ERA_WIPE_DURATION_MS = 1650;
const CAMPAIGN_WIPE_DURATION_MS = 1850;

function getRouteGrowDurationMs(routeCount: number): number {
  if (routeCount <= 1) return 2200;
  if (routeCount === 2) return 3900;
  return 5400;
}

function getPhaseTotalDurationMs(
  routeCount: number,
  hasWipeInPhase: boolean
): number {
  return getRouteGrowDurationMs(routeCount) + (hasWipeInPhase ? 3200 : 2300);
}

/**
 * Computes an adaptive Retina WebGL pixelRatio using a physical-framebuffer pixel budget:
 * - Smartphones & tablets (`390x844` @ 3x = 2.96M px) get FULL native `devicePixelRatio` (up to `3x`)
 *   with ZERO non-integer `1.25x` bilinear upscaling blur!
 * - Standard 1080p/1440p laptops also get native 1:1 `devicePixelRatio`.
 * - Massive 4K/5K desktop monitors stay protected within a 4.5M physical-pixel budget in `balanced` mode
 *   (or full native DPR in `ultra` mode).
 */
function getTargetPixelRatio(perfMode: PerformanceMode): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const cssPixels = Math.max(1, window.innerWidth * window.innerHeight);
  const isSmallScreen = window.innerWidth < 1024;

  if (perfMode === 'eco') {
    // Even in eco mode on phones, keep >= 1.75x-2x so small CJK text stays legible
    return isSmallScreen ? Math.min(dpr, 2) : 1;
  }
  if (perfMode === 'ultra') {
    return Math.min(dpr, 3);
  }

  // `balanced` mode: full native Retina DPR (up to 3x) within a 4.5M physical-pixel budget!
  const budgetMaxRatio = Math.sqrt(4_500_000 / cssPixels);
  return Math.min(dpr, 3, Math.max(1.5, budgetMaxRatio));
}

/**
 * Automatically frames 100% of a battle phase's marching routes and clash markers
 * inside the unobstructed map viewport (accounting for TopBar, Right War-Room Drawer,
 * and Bottom Playback Bar so routes are NEVER clipped or hidden behind UI panels).
 */
function fitPhaseTheaterOnMap(
  map: maplibregl.Map,
  curves: PreparedRouteCurve[],
  phase: CampaignPhase,
  panelOpen: boolean,
  use3D: boolean,
  duration = 950
): void {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const c of curves) {
    for (const [lng, lat] of c.coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  for (const m of phase.markers) {
    const [lng, lat] = m.coordinates;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const targetPitch = use3D ? Math.min(40, phase.camera.pitch ?? 36) : 0;

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) {
    map.flyTo({
      center: phase.camera.center,
      zoom: phase.camera.zoom,
      pitch: targetPitch,
      bearing: 0,
      duration,
      essential: true,
    });
    return;
  }

  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;
  const padLng = Math.max(0.16, lngSpan * 0.14);
  const padLat = Math.max(0.14, latSpan * 0.14);

  const width = map.getCanvas().clientWidth || 1280;
  const height = map.getCanvas().clientHeight || 800;
  const isDesktop = width >= 1280;
  const isTablet = width >= 640;

  const padding = isTablet
    ? {
        top: 86,
        bottom: 136,
        left: isDesktop ? 96 : 48,
        right: panelOpen ? (isDesktop ? 392 : 368) : 48,
      }
    : {
        top: 104,
        bottom: panelOpen ? Math.round(Math.min(height * 0.52, 380)) : 124,
        left: 24,
        right: 24,
      };

  map.fitBounds(
    [
      [minLng - padLng, minLat - padLat],
      [maxLng + padLng, maxLat + padLat],
    ],
    {
      padding,
      maxZoom: Math.max(7.5, Math.min(8.5, phase.camera.zoom + 0.55)),
      pitch: targetPitch,
      bearing: 0,
      duration,
      essential: true,
    }
  );
}

export default function MingMapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const activeCurvesRef = useRef<PreparedRouteCurve[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startDirectorLoopRef = useRef<() => void>(() => {});

  // On-Demand Animation Clocks & Throttles (0% CPU/GPU when idle!)
  const phaseElapsedMsRef = useRef(0);
  const routeGrowElapsedMsRef = useRef(0);
  const routeGrowFinishedRef = useRef(false);
  const unlockedStepsRef = useRef(1);
  const campaignWipeElapsedMsRef = useRef(0);
  const campaignHasWipeRef = useRef(false);
  const lastCampaignWipePushMsRef = useRef(0);
  const lastWebglFrameMsRef = useRef(0);
  const storyElapsedMsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const userInteractedInPhaseRef = useRef(false);
  const activePhaseRef = useRef<CampaignPhase | null>(null);
  const is3DRef = useRef(false);
  const terrainSuspendedRef = useRef(false);
  const hoveredPolityIdRef = useRef<string | null>(null);

  // Era-to-Era Victory Brush Paint-Over State
  const displayedSnapshotIdRef = useRef<string | null>(null);
  const lastEraWipePushMsRef = useRef(0);
  const eraWipeRef = useRef<{
    fromId: string;
    toId: string;
    plan: EraWipePlan;
    elapsedMs: number;
  } | null>(null);

  const [zoomBucket, setZoomBucket] = useState<'far' | 'mid' | 'close'>('far');
  const [territoryChunkRev, setTerritoryChunkRev] = useState(0);

  useEffect(() => {
    scheduleWarmAllTerritoryChunks();
    return subscribeTerritoryChunks(() => {
      setTerritoryChunkRev((v) => v + 1);
    });
  }, []);

  const currentYear = useAtlasStore((s) => s.currentYear);
  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const storyTourNonce = useAtlasStore((s) => s.storyTourNonce);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const isCampaignPlaying = useAtlasStore((s) => s.isCampaignPlaying);
  const isCampaignPanelOpen = useAtlasStore((s) => s.isCampaignPanelOpen);
  const spotlightRouteId = useAtlasStore((s) => s.spotlightRouteId);
  const focusedRouteRequest = useAtlasStore((s) => s.focusedRouteRequest);
  const campaignCameraMode = useAtlasStore((s) => s.campaignCameraMode);
  const campaignArrowMode = useAtlasStore((s) => s.campaignArrowMode);
  const campaignReplayNonce = useAtlasStore((s) => s.campaignReplayNonce);
  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const activeCharacterStopIndex = useAtlasStore(
    (s) => s.activeCharacterStopIndex
  );
  const theme = useAtlasStore((s) => s.theme);
  const perfMode = useAtlasStore((s) => s.perfMode);
  const is3D = useAtlasStore((s) => s.is3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const cameraCommand = useAtlasStore((s) => s.cameraCommand);

  is3DRef.current = is3D && perfMode !== 'eco';

  const currentSnapshot = useMemo(
    () => getSnapshotForYear(currentYear),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentYear, territoryChunkRev]
  );

  const activeCampaign = activeCampaignId
    ? CAMPAIGN_MAP[activeCampaignId] ?? null
    : null;
  const activePhase = activeCampaign
    ? activeCampaign.phases[activePhaseIndex] ?? activeCampaign.phases[0]
    : null;
  activePhaseRef.current = activePhase;

  const selectedEventObj = selectedEventId ? EVENT_MAP[selectedEventId] : null;

  const causalLinkedSet = useMemo(() => {
    const s = new Set<string>();
    if (selectedEventObj) {
      for (const id of selectedEventObj.why.prevEventIds ?? []) s.add(id);
      for (const id of selectedEventObj.why.nextEventIds ?? []) s.add(id);
    }
    return s;
  }, [selectedEventObj]);
  const causalLinkedSetRef = useRef(causalLinkedSet);
  causalLinkedSetRef.current = causalLinkedSet;

  /**
   * Temporarily suspends MapLibre's 3D Terrain Drape RTT FBO pipeline ONLY while
   * GeoJSON line/polygon animations (`campaign-routes` / `ming-territory-wipe`) are
   * actively mutating so frames render directly to screen at 120+ FPS with zero FBO thrash!
   */
  const syncTerrainDrapeSuspension = (
    map: maplibregl.Map,
    shouldSuspend: boolean
  ) => {
    const st = useAtlasStore.getState();
    const wants3D = st.is3D && st.perfMode !== 'eco';
    if (!wants3D) {
      terrainSuspendedRef.current = false;
      return;
    }
    if (shouldSuspend && !terrainSuspendedRef.current) {
      terrainSuspendedRef.current = true;
      if (map.getTerrain()) {
        map.setTerrain(null);
      }
    } else if (!shouldSuspend && terrainSuspendedRef.current) {
      terrainSuspendedRef.current = false;
      if (map.getSource('terrain-dem')) {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: getTerrainExaggeration(st.perfMode),
        });
      }
    }
  };

  const syncAllMapSourcesAndLayers = () => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const st = useAtlasStore.getState();

    registerTacticalSprites(map);
    mountHistoricalLayers(map, currentSnapshot.geojson, st.theme, st.placeNameMode);
    syncLayerVisibility(map, st.layers);

    const terSource = map.getSource('ming-territories') as
      | maplibregl.GeoJSONSource
      | undefined;
    const polPtSource = map.getSource('ming-polity-points') as
      | maplibregl.GeoJSONSource
      | undefined;

    if (st.activeCampaignId) {
      eraWipeRef.current = null;
      const cmpFrame = buildCampaignTerritoryFrame(
        st.activeCampaignId,
        st.activePhaseIndex,
        0
      );
      campaignHasWipeRef.current = cmpFrame.hasWipeInPhase;
      if (terSource) terSource.setData(cmpFrame.baseGeoJSON);
      if (polPtSource) {
        polPtSource.setData(buildPolityLabelGeoJSON(cmpFrame.baseGeoJSON));
      }
      updateTerritoryWipeOnMap(map, cmpFrame.wipeOverlayGeoJSON);
      st.setActiveWipeCaption(cmpFrame.caption);
      displayedSnapshotIdRef.current = null;
    } else {
      campaignHasWipeRef.current = false;
      const nextSnapId = currentSnapshot.meta.snapshotId;
      const prevSnapId = displayedSnapshotIdRef.current;
      const skipWipe = st.skipNextEraWipe;
      if (skipWipe) st.clearSkipNextEraWipe();

      if (
        !skipWipe &&
        prevSnapId &&
        prevSnapId !== nextSnapId &&
        TERRITORY_SNAPSHOT_BY_ID[prevSnapId] &&
        st.layers.territories &&
        st.perfMode !== 'eco'
      ) {
        const prevGeo = TERRITORY_SNAPSHOT_BY_ID[prevSnapId].geojson;
        const plan = getEraWipePlan(prevSnapId, nextSnapId);
        eraWipeRef.current = {
          fromId: prevSnapId,
          toId: nextSnapId,
          plan,
          elapsedMs: 0,
        };
        if (terSource) terSource.setData(prevGeo);
        if (polPtSource) {
          polPtSource.setData(buildPolityLabelGeoJSON(currentSnapshot.geojson));
        }
        updateTerritoryWipeOnMap(map, null);
        st.setActiveWipeCaption(plan.caption);
        startDirectorLoopRef.current();
      } else if (!eraWipeRef.current || eraWipeRef.current.toId !== nextSnapId) {
        eraWipeRef.current = null;
        displayedSnapshotIdRef.current = nextSnapId;
        if (terSource) terSource.setData(currentSnapshot.geojson);
        if (polPtSource) {
          polPtSource.setData(buildPolityLabelGeoJSON(currentSnapshot.geojson));
        }
        updateTerritoryWipeOnMap(map, null);
        st.setActiveWipeCaption(null);
      }
    }

    const activeEvt = st.selectedEventId ? EVENT_MAP[st.selectedEventId] : null;
    updateCausalArcsOnMap(
      map,
      activeEvt,
      st.layers.causalArcs && !st.activeCampaignId && !st.activeCharacterId
    );

    updateCharacterOdysseyOnMap(
      map,
      st.activeCampaignId ? null : st.activeCharacterId,
      st.activeCharacterStopIndex
    );

    const z = map.getZoom();
    const curBucket: 'far' | 'mid' | 'close' =
      z >= 6.6 ? 'close' : z >= 5.6 ? 'mid' : 'far';

    updateEventsOnMap(map, {
      selectedEventId: st.selectedEventId,
      currentYear: st.currentYear,
      zoomBucket: curBucket,
      macroVis: st.layers.macroEvents,
      allMicroVis: st.layers.showAllMicroEvents,
      inCampaign: Boolean(st.activeCampaignId),
      inOdyssey: Boolean(st.activeCharacterId),
      causalIds: causalLinkedSetRef.current,
    });

    const { featureCollection, preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;

    // Route lines + origin rings + destination spearheads are ALWAYS 100% stationary ("线不用动")!
    setCampaignStaticRoutesOnMap(map, featureCollection, preparedCurves);
    setCampaignSpotlightRoute(
      map,
      st.activeCampaignId ? st.spotlightRouteId : null,
      Boolean(st.activeCampaignId)
    );

    if (!activeCampaign) {
      updateCampaignArrowheadsOnMap(map, [], 'static', 1);
      updateCampaignAnnotationsOnMap(map, [], null, 0, st.theme);
    } else {
      updateCampaignAnnotationsOnMap(
        map,
        preparedCurves,
        activePhase,
        preparedCurves.length,
        st.theme
      );
      if (st.campaignArrowMode === 'static') {
        updateCampaignArrowheadsOnMap(map, preparedCurves, 'static', 1);
      }
    }
  };

  // 1. Initialize MapLibre GL & On-Demand Hardware-Friendly Director Loop
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    useAtlasStore.getState().hydrateFromStorage();
    const initState = useAtlasStore.getState();
    const initialPose =
      initState.cameraCommand?.pose ??
      (initState.selectedEventId
        ? EVENT_MAP[initState.selectedEventId]?.camera
        : null) ??
      SITE_CONFIG.defaultCamera;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createHistoricalBaseStyle(
        initState.theme,
        initState.is3D,
        initState.perfMode
      ),
      center: initialPose.center,
      zoom: initialPose.zoom,
      pitch:
        initState.is3D && initState.perfMode !== 'eco'
          ? Math.min(44, initialPose.pitch ?? 38)
          : 0,
      bearing: 0,
      pixelRatio: getTargetPixelRatio(initState.perfMode),
      maxTileCacheSize: initState.perfMode === 'eco' ? 48 : 96,
      maxPitch: 52,
      minZoom: 2.5,
      maxZoom: 13.0,
      fadeDuration: 80,
      attributionControl: false,
      // Uniform-stroke CJK Sans-Serif prevents hairline horizontal stroke loss in MapLibre's 24px TinySDF atlas!
      localIdeographFontFamily:
        "'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif",
    });

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    const onManualInput = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      if (useAtlasStore.getState().activeCampaignId) {
        userInteractedInPhaseRef.current = true;
      }
    };
    map.on('mousedown', onManualInput);
    map.on('touchstart', onManualInput);
    map.on('wheel', onManualInput);

    // Native GPU Click & Pointer Hit-Testing for WebGL Event Medallions (`战` / `史` / `轶`)
    map.on('click', 'ming-events-symbol', (e) => {
      const feat = e.features?.[0];
      const eventId = feat?.properties?.eventId;
      if (typeof eventId === 'string' && eventId) {
        useAtlasStore.getState().selectEvent(eventId, true);
      }
    });

    map.on('mouseenter', 'ming-events-symbol', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'ming-events-symbol', () => {
      map.getCanvas().style.cursor = '';
    });

    // Mobile Natural Gesture: Tap empty map canvas (<640px) to dismiss open bottom sheets!
    map.on('click', (e) => {
      if (typeof window === 'undefined' || window.innerWidth >= 640) return;
      const st = useAtlasStore.getState();
      if (!st.isDrawerOpen && !st.isDirectoryOpen && !st.isCampaignPanelOpen) {
        return;
      }
      const interactiveLayers = [
        'ming-events-symbol',
        'campaign-callouts-pill',
        'campaign-routes-solid',
        'campaign-routes-dashed',
      ].filter((id) => Boolean(map.getLayer(id)));

      if (interactiveLayers.length > 0) {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: interactiveLayers,
        });
        if (hits.length > 0) return;
      }

      if (st.isDrawerOpen) st.setDrawerOpen(false);
      if (st.isDirectoryOpen) st.setDirectoryOpen(false);
      if (st.isCampaignPanelOpen) st.setCampaignPanelOpen(false);
    });

    // Interactive Tactical Route & Pill Hit-Testing (`① / ② / ③`)
    const campaignHitLayers = [
      'campaign-callouts-pill',
      'campaign-routes-solid',
      'campaign-routes-dashed',
    ] as const;

    for (const layerId of campaignHitLayers) {
      map.on('mouseenter', layerId, (e) => {
        const feat = e.features?.[0];
        const rId = String(
          feat?.properties?.routeId ?? feat?.properties?.id ?? ''
        );
        map.getCanvas().style.cursor = 'pointer';
        if (rId && useAtlasStore.getState().activeCampaignId) {
          useAtlasStore.getState().setSpotlightRouteId(rId);
        }
      });

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        if (useAtlasStore.getState().activeCampaignId) {
          useAtlasStore.getState().setSpotlightRouteId(null);
        }
      });

      map.on('click', layerId, (e) => {
        const feat = e.features?.[0];
        const rId = String(
          feat?.properties?.routeId ?? feat?.properties?.id ?? ''
        );
        if (rId && useAtlasStore.getState().activeCampaignId) {
          useAtlasStore.getState().focusCampaignRoute(rId);
        }
      });
    }

    // Zero-Interference Territory Hover Highlight:
    // Completely skipped while camera is moving or any animation loop is active!
    let lastHoverMs = 0;
    map.on('mousemove', (e) => {
      if (map.isMoving() || animFrameRef.current !== null) return;
      const now = performance.now();
      if (now - lastHoverMs < 85 || !styleReadyRef.current) return;
      lastHoverMs = now;
      if (!map.getLayer('ming-territories-fill')) return;

      const hits = map.queryRenderedFeatures(e.point, {
        layers: ['ming-territories-fill'],
      });
      const topFeat = hits[0];
      const nextId = topFeat
        ? String(topFeat.properties?.polityId ?? '')
        : null;

      if (nextId !== hoveredPolityIdRef.current) {
        hoveredPolityIdRef.current = nextId;
        if (map.getLayer('ming-territories-hover')) {
          map.setFilter('ming-territories-hover', [
            '==',
            ['get', 'polityId'],
            nextId ?? '__none__',
          ]);
        }
        if (topFeat?.properties) {
          const p = topFeat.properties;
          useAtlasStore.getState().setHoveredPolity({
            polityId: String(p.polityId ?? ''),
            polityName: String(p.polityName ?? ''),
            shortLabel: String(p.shortLabel ?? ''),
            ruler: String(p.ruler ?? ''),
            controlType:
              p.controlType === 'tributary-garrison'
                ? 'tributary-garrison'
                : 'direct',
            color: String(p.color ?? '#B83B2A'),
            labelCoord: [0, 0],
            capitalName: String(p.capitalName ?? ''),
            changeReason: String(p.changeReason ?? ''),
          } satisfies TerritoryPolityProps);
        } else {
          useAtlasStore.getState().setHoveredPolity(null);
        }
      }
    });

    map.getCanvas().addEventListener('mouseleave', () => {
      if (hoveredPolityIdRef.current !== null) {
        hoveredPolityIdRef.current = null;
        if (styleReadyRef.current && map.getLayer('ming-territories-hover')) {
          map.setFilter('ming-territories-hover', [
            '==',
            ['get', 'polityId'],
            '__none__',
          ]);
        }
        useAtlasStore.getState().setHoveredPolity(null);
      }
    });

    const updateZoomBucket = () => {
      const z = map.getZoom();
      const next = z >= 6.6 ? 'close' : z >= 5.6 ? 'mid' : 'far';
      setZoomBucket((prev) => (prev === next ? prev : next));
    };
    map.on('zoomend', updateZoomBucket);

    map.on('load', () => {
      styleReadyRef.current = true;
      syncAllMapSourcesAndLayers();
      updateZoomBucket();
      startDirectorLoopRef.current();
    });

    // ON-DEMAND Director Loop: Automatically sleeps (0% CPU/GPU) whenever idle!
    const shouldKeepRunning = (): boolean => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      const st = useAtlasStore.getState();
      const routeCount = activeCurvesRef.current.length;
      const campaignWipePending =
        campaignHasWipeRef.current &&
        campaignWipeElapsedMsRef.current < CAMPAIGN_WIPE_DURATION_MS;
      const dynamicArrowsActive =
        st.campaignArrowMode === 'dynamic' && routeCount > 0;
      const campaignNeedsFrames =
        Boolean(st.activeCampaignId) &&
        routeCount > 0 &&
        (st.isCampaignPlaying || dynamicArrowsActive || campaignWipePending);
      const tourNeedsFrames = !st.activeCampaignId && st.isStoryTourPlaying;
      const eraWipeNeedsFrames = eraWipeRef.current !== null;
      return campaignNeedsFrames || tourNeedsFrames || eraWipeNeedsFrames;
    };

    const tick = (now: number) => {
      const currentMap = mapRef.current;
      if (!shouldKeepRunning()) {
        if (currentMap && styleReadyRef.current) {
          syncTerrainDrapeSuspension(currentMap, false);
        }
        animFrameRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }

      const prevNow = lastFrameTimeRef.current ?? now;
      const dt = Math.min(64, Math.max(0, now - prevNow));
      lastFrameTimeRef.current = now;

      const store = useAtlasStore.getState();
      const minArrowInterval = store.perfMode === 'eco' ? 30 : 16;

      // Only territory polygon wipes mutate draped fill/line geometry!
      const hasMutatingGeoJSON =
        eraWipeRef.current !== null ||
        (Boolean(store.activeCampaignId) &&
          campaignHasWipeRef.current &&
          campaignWipeElapsedMsRef.current > 0 &&
          campaignWipeElapsedMsRef.current < CAMPAIGN_WIPE_DURATION_MS);

      if (currentMap && styleReadyRef.current) {
        syncTerrainDrapeSuspension(currentMap, hasMutatingGeoJSON);
      }

      // --- MODE C: Local-Delta Era-to-Era Brush Paint-Over (ONLY changed border region!) ---
      if (
        currentMap &&
        styleReadyRef.current &&
        !store.activeCampaignId &&
        eraWipeRef.current
      ) {
        const wipe = eraWipeRef.current;
        wipe.elapsedMs += dt;
        const rawWipe = Math.min(1, wipe.elapsedMs / ERA_WIPE_DURATION_MS);

        if (rawWipe >= 1) {
          const destSnap = TERRITORY_SNAPSHOT_BY_ID[wipe.toId];
          const terSrc = currentMap.getSource('ming-territories') as
            | maplibregl.GeoJSONSource
            | undefined;
          if (terSrc && destSnap) terSrc.setData(destSnap.geojson);
          updateTerritoryWipeOnMap(currentMap, null);
          displayedSnapshotIdRef.current = wipe.toId;
          eraWipeRef.current = null;
          store.setActiveWipeCaption(null);
        } else if (now - lastEraWipePushMsRef.current >= 24) {
          lastEraWipePushMsRef.current = now;
          const overlay = buildEraWipeOverlayGeoJSON(
            wipe.toId,
            wipe.plan,
            rawWipe
          );
          updateTerritoryWipeOnMap(currentMap, overlay);
        }
      }

      // --- MODE A: Battlefield Campaign ("线不用动，仅动态箭头在线上顺序移动" + Local Delta Wipe!) ---
      if (
        currentMap &&
        styleReadyRef.current &&
        store.activeCampaignId &&
        activeCurvesRef.current.length > 0
      ) {
        const speed = store.campaignSpeed;
        const curves = activeCurvesRef.current;
        const growTotalMs = getRouteGrowDurationMs(curves.length) / speed;
        const cycleWithHoldMs = growTotalMs + 1600;
        const phaseTotalMs =
          getPhaseTotalDurationMs(curves.length, campaignHasWipeRef.current) /
          speed;

        if (store.campaignArrowMode === 'dynamic') {
          routeGrowElapsedMsRef.current += dt;
          // If phase auto-play is paused (`!isCampaignPlaying`), loop sequential `①->②->③` + continuous glide!
          const effectiveElapsed = store.isCampaignPlaying
            ? Math.min(growTotalMs, routeGrowElapsedMsRef.current)
            : routeGrowElapsedMsRef.current % cycleWithHoldMs;
          const cycleProgress = Math.min(1, effectiveElapsed / growTotalMs);
          const continuousPulse = (now % 2600) / 2600;

          let nextUnlocked = 1;
          for (const c of curves) {
            if (cycleProgress >= c.startAt) {
              nextUnlocked = Math.max(nextUnlocked, c.stepNo);
            }
          }
          if (nextUnlocked !== unlockedStepsRef.current && !store.isCampaignPlaying) {
            emitPlaybackTick({
              mode: 'campaign',
              percent: 0,
              unlockedSteps: nextUnlocked,
            });
          }
          unlockedStepsRef.current = nextUnlocked;

          if (now - lastWebglFrameMsRef.current >= minArrowInterval) {
            lastWebglFrameMsRef.current = now;
            updateCampaignArrowheadsOnMap(
              currentMap,
              curves,
              'dynamic',
              cycleProgress,
              continuousPulse
            );
          }
        } else {
          // `static` mode: advance timer silently for wipe/camera if playing, keep arrowheads 100% still!
          routeGrowElapsedMsRef.current = Math.min(
            growTotalMs,
            routeGrowElapsedMsRef.current + dt
          );
          unlockedStepsRef.current = curves.length;
        }

        const rawGrow = Math.min(
          1,
          routeGrowElapsedMsRef.current / growTotalMs
        );

        // Progressive Local-Delta Territory Paint-Over once attacking sequence reaches >= 62%
        if (campaignHasWipeRef.current && rawGrow >= 0.62) {
          campaignWipeElapsedMsRef.current = Math.min(
            CAMPAIGN_WIPE_DURATION_MS,
            campaignWipeElapsedMsRef.current + dt * speed
          );
          const wipeRatio = Math.min(
            1,
            campaignWipeElapsedMsRef.current / CAMPAIGN_WIPE_DURATION_MS
          );
          if (
            now - lastCampaignWipePushMsRef.current >= 26 ||
            wipeRatio >= 0.999
          ) {
            lastCampaignWipePushMsRef.current = now;
            const cmpFrame = buildCampaignTerritoryFrame(
              store.activeCampaignId,
              store.activePhaseIndex,
              wipeRatio
            );
            updateTerritoryWipeOnMap(currentMap, cmpFrame.wipeOverlayGeoJSON);
            if (store.activeWipeCaption !== cmpFrame.caption) {
              store.setActiveWipeCaption(cmpFrame.caption);
            }
          }
        }

        if (store.isCampaignPlaying) {
          phaseElapsedMsRef.current += dt;
          const pct = Math.min(
            100,
            (phaseElapsedMsRef.current / phaseTotalMs) * 100
          );

          emitPlaybackTick({
            mode: 'campaign',
            percent: pct,
            unlockedSteps: unlockedStepsRef.current,
          });

          if (
            store.perfMode !== 'eco' &&
            phaseElapsedMsRef.current >= OPENING_FLY_DURATION_MS &&
            !userInteractedInPhaseRef.current &&
            store.campaignCameraMode === 'follow' &&
            activePhaseRef.current
          ) {
            const phase = activePhaseRef.current;
            const activeCurve =
              curves.find(
                (c) => rawGrow >= c.startAt && rawGrow <= c.endAt + 0.02
              ) ?? curves[curves.length - 1];

            if (activeCurve) {
              const span = Math.max(0.01, activeCurve.endAt - activeCurve.startAt);
              const localT = Math.max(
                0,
                Math.min(1, (rawGrow - activeCurve.startAt) / span)
              );
              const { coordinates: vanguardPt } = sampleAlongPath(
                activeCurve.coords,
                Math.min(0.95, 0.12 + localT * 0.83)
              );
              const targetLng =
                vanguardPt[0] * 0.4 + phase.camera.center[0] * 0.6;
              const targetLat =
                vanguardPt[1] * 0.4 + phase.camera.center[1] * 0.6;

              const curCenter = currentMap.getCenter();
              const damp = 1 - Math.exp(-dt / 240);
              const nextLng = curCenter.lng + (targetLng - curCenter.lng) * damp;
              const nextLat = curCenter.lat + (targetLat - curCenter.lat) * damp;
              const basePitch = Math.min(42, phase.camera.pitch ?? 38);

              currentMap.jumpTo({
                center: [nextLng, nextLat],
                zoom: phase.camera.zoom,
                bearing: 0,
                pitch: is3DRef.current ? basePitch : 0,
              });
            }
          }

          if (phaseElapsedMsRef.current >= phaseTotalMs) {
            phaseElapsedMsRef.current = 0;
            store.nextCampaignPhase();
          }
        }
      }

      // --- MODE B: Chronological Full-History Story Tour (0 React Re-Renders!) ---
      if (
        currentMap &&
        styleReadyRef.current &&
        !store.activeCampaignId &&
        store.isStoryTourPlaying
      ) {
        const speed = store.storyTourSpeed;
        const stopTotalMs = STORY_STOP_DURATION_MS / speed;
        storyElapsedMsRef.current += dt;

        const pct = Math.min(
          100,
          (storyElapsedMsRef.current / stopTotalMs) * 100
        );
        emitPlaybackTick({
          mode: 'tour',
          percent: pct,
          unlockedSteps: 1,
        });

        if (storyElapsedMsRef.current >= stopTotalMs) {
          storyElapsedMsRef.current = 0;
          store.stepStoryEvent(1);
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    const startDirectorLoop = () => {
      if (animFrameRef.current !== null) return;
      if (!shouldKeepRunning()) return;
      lastFrameTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(tick);
    };
    startDirectorLoopRef.current = startDirectorLoop;

    const onVisibilityChange = () => {
      if (!document.hidden) {
        startDirectorLoop();
      }
    };
    const onWindowResize = () => {
      const st = useAtlasStore.getState();
      map.setPixelRatio(getTargetPixelRatio(st.perfMode));
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onWindowResize);

    mapRef.current = map;
    registerMapInstanceForCapture(map);

    return () => {
      registerMapInstanceForCapture(null);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onWindowResize);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      styleReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startDirectorLoopRef.current();
  }, [
    isStoryTourPlaying,
    activeCampaignId,
    activePhaseIndex,
    isCampaignPlaying,
    campaignReplayNonce,
    storyTourNonce,
  ]);

  // 2. React to Theme, Performance Tier, or 3D Terrain Mode Changes
  const prevThemeRef = useRef(theme);
  const prevPerfRef = useRef(perfMode);
  const prev3DRef = useRef(is3D);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (prevPerfRef.current !== perfMode) {
      map.setPixelRatio(getTargetPixelRatio(perfMode));
    }

    if (prevThemeRef.current !== theme || prevPerfRef.current !== perfMode) {
      prevThemeRef.current = theme;
      prevPerfRef.current = perfMode;
      prev3DRef.current = is3D;
      terrainSuspendedRef.current = false;
      styleReadyRef.current = false;
      map.setStyle(createHistoricalBaseStyle(theme, is3D, perfMode));
      map.once('styledata', () => {
        styleReadyRef.current = true;
        syncAllMapSourcesAndLayers();
        startDirectorLoopRef.current();
      });
      return;
    }

    if (prev3DRef.current !== is3D) {
      prev3DRef.current = is3D;
      terrainSuspendedRef.current = false;
      if (styleReadyRef.current && map.getSource('terrain-dem')) {
        map.setTerrain(
          is3D && perfMode !== 'eco'
            ? {
                source: 'terrain-dem',
                exaggeration: getTerrainExaggeration(perfMode),
              }
            : null
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, is3D, perfMode]);

  // 3. Instant GPU Switch for Ancient/Modern Place Name Mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    setPlaceNameModeOnGpu(map, placeNameMode);
  }, [placeNameMode]);

  // 4. Sync WebGL Territory Polygons, Events, Causal Arcs, Odyssey & Visibility
  useEffect(() => {
    syncAllMapSourcesAndLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSnapshot,
    layers,
    activeCampaignId,
    activePhaseIndex,
    activeCharacterId,
    activeCharacterStopIndex,
    selectedEventId,
    zoomBucket,
  ]);

  // 5. Reset Story Tour Clock on Event Change
  useEffect(() => {
    storyElapsedMsRef.current = 0;
    emitPlaybackTick({ mode: 'tour', percent: 0, unlockedSteps: 1 });
    startDirectorLoopRef.current();
  }, [selectedEventId, storyTourNonce, isStoryTourPlaying]);

  // 6. Campaign Phase Opening Camera & Stationary Route Setup
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCampaign || !activePhase) return;

    phaseElapsedMsRef.current = 0;
    routeGrowElapsedMsRef.current = 0;
    routeGrowFinishedRef.current = false;
    unlockedStepsRef.current = 1;
    campaignWipeElapsedMsRef.current = 0;
    userInteractedInPhaseRef.current = false;

    const { featureCollection, preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;

    if (styleReadyRef.current) {
      setCampaignStaticRoutesOnMap(map, featureCollection, preparedCurves);
      setCampaignSpotlightRoute(map, null, true);
      updateCampaignAnnotationsOnMap(
        map,
        preparedCurves,
        activePhase,
        preparedCurves.length,
        theme
      );
      if (campaignArrowMode === 'static') {
        updateCampaignArrowheadsOnMap(map, preparedCurves, 'static', 1);
      } else {
        updateCampaignArrowheadsOnMap(map, preparedCurves, 'dynamic', 0, 0);
      }
    }
    emitPlaybackTick({
      mode: 'campaign',
      percent: 0,
      unlockedSteps: campaignArrowMode === 'static' ? preparedCurves.length : 1,
    });

    const use3D = is3D && perfMode !== 'eco';
    if (campaignCameraMode === 'follow' && preparedCurves[0]) {
      const firstCurve = preparedCurves[0];
      const startCenter: LngLat = [
        firstCurve.startPoint[0] * 0.4 + activePhase.camera.center[0] * 0.6,
        firstCurve.startPoint[1] * 0.4 + activePhase.camera.center[1] * 0.6,
      ];
      map.flyTo({
        center: startCenter,
        zoom: activePhase.camera.zoom,
        pitch: use3D ? Math.min(42, activePhase.camera.pitch ?? 38) : 0,
        bearing: 0,
        duration: OPENING_FLY_DURATION_MS,
        essential: true,
      });
    } else if (campaignCameraMode !== 'free') {
      fitPhaseTheaterOnMap(
        map,
        preparedCurves,
        activePhase,
        isCampaignPanelOpen,
        use3D,
        OPENING_FLY_DURATION_MS
      );
    }

    startDirectorLoopRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, activePhaseIndex, campaignReplayNonce]);

  // 6b. React Instantly When Toggling `[动态箭矢 | 静态箭矢]`
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !activeCampaignId) return;
    const curves = activeCurvesRef.current;
    if (campaignArrowMode === 'static') {
      updateCampaignArrowheadsOnMap(map, curves, 'static', 1);
      emitPlaybackTick({
        mode: 'campaign',
        percent: 0,
        unlockedSteps: curves.length,
      });
    } else {
      routeGrowElapsedMsRef.current = 0;
      startDirectorLoopRef.current();
    }
  }, [campaignArrowMode, activeCampaignId]);

  // 6c. Spotlight Specific Route (`① / ② / ③`) on Hover or Selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    setCampaignSpotlightRoute(
      map,
      activeCampaignId ? spotlightRouteId : null,
      Boolean(activeCampaignId)
    );
  }, [spotlightRouteId, activeCampaignId]);

  // 6d. Re-frame Open Battlefield Smoothly When Expanding / Collapsing War-Room Drawer
  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !styleReadyRef.current ||
      !activeCampaignId ||
      !activePhase ||
      campaignCameraMode !== 'overview' ||
      userInteractedInPhaseRef.current
    ) {
      return;
    }
    const use3D = is3D && perfMode !== 'eco';
    fitPhaseTheaterOnMap(
      map,
      activeCurvesRef.current,
      activePhase,
      isCampaignPanelOpen,
      use3D,
      540
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCampaignPanelOpen]);

  // 6e. Focus & Zoom onto Individual Route Corridor When Clicked in War-Room Drawer
  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !styleReadyRef.current ||
      !activeCampaignId ||
      !focusedRouteRequest
    ) {
      return;
    }
    const curve = activeCurvesRef.current.find(
      (c) => c.id === focusedRouteRequest.routeId
    );
    if (!curve || curve.coords.length === 0) return;

    userInteractedInPhaseRef.current = true;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of curve.coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    const padLng = Math.max(0.14, (maxLng - minLng) * 0.18);
    const padLat = Math.max(0.12, (maxLat - minLat) * 0.18);
    const width = map.getCanvas().clientWidth || 1280;
    const height = map.getCanvas().clientHeight || 800;
    const isDesktop = width >= 1280;
    const isTablet = width >= 640;
    const use3D = is3D && perfMode !== 'eco';

    map.fitBounds(
      [
        [minLng - padLng, minLat - padLat],
        [maxLng + padLng, maxLat + padLat],
      ],
      {
        padding: isTablet
          ? {
              top: 96,
              bottom: 144,
              left: isDesktop ? 104 : 56,
              right: isCampaignPanelOpen ? (isDesktop ? 400 : 376) : 56,
            }
          : {
              top: 72,
              bottom: isCampaignPanelOpen
                ? Math.round(Math.min(height * 0.48, 360))
                : 132,
              left: 32,
              right: 32,
            },
        maxZoom: 8.4,
        pitch: use3D ? 36 : 0,
        bearing: 0,
        duration: 720,
        essential: true,
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedRouteRequest]);

  useEffect(() => {
    if (isCampaignPlaying) {
      userInteractedInPhaseRef.current = false;
      startDirectorLoopRef.current();
    }
  }, [isCampaignPlaying]);

  // 7. Execute Declarative Camera FlyTo Commands (with Mobile Upper-Viewport Sheet Padding!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) return;
    const { pose } = cameraCommand;
    const use3D = is3D && perfMode !== 'eco';
    const canvas = map.getCanvas();
    const width = canvas.clientWidth || 1280;
    const height = canvas.clientHeight || 800;
    const isMobile = width < 640;
    const drawerOpenNow = useAtlasStore.getState().isDrawerOpen;

    map.flyTo({
      center: pose.center,
      zoom: pose.zoom,
      pitch: use3D ? Math.min(42, pose.pitch ?? 38) : 0,
      bearing: pose.bearing ?? 0,
      padding:
        isMobile && drawerOpenNow
          ? {
              top: 96,
              bottom: Math.round(Math.min(height * 0.48, 370)),
              left: 16,
              right: 16,
            }
          : { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 950,
      essential: true,
    });
  }, [cameraCommand, is3D, perfMode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      aria-label="明朝历史三维交互舆图画布"
    />
  );
}
