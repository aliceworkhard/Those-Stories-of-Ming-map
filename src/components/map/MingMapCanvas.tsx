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
  createTerrainDemSourceSpec,
  getTerrainExaggeration,
  registerTacticalSprites,
} from '@/engine/mapStyle';
import {
  buildPhaseRouteFeatures,
  buildPolityLabelGeoJSON,
  mountHistoricalLayers,
  resetLayerSyncGuards,
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
  CAMPAIGN_REQUIRED_SNAPSHOTS,
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
const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

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
 * Computes the WebGL framebuffer pixelRatio prioritizing 1:1 native sharpness:
 * - `balanced` (default): Uses EXACT 1:1 native `window.devicePixelRatio` (up to 2x on desktop,
 *   3x on mobile/tablet) so WebGL map text & lines match native HTML UI sharpness with ZERO
 *   bilinear upscaling blur! (Only guards extreme 5K/6K viewports > 9.5M physical pixels.)
 * - `eco`: Intentionally downscales to 1.0x on desktop (1.5x max on phones) for older iGPUs.
 * - `ultra`: Full native Retina up to 3x + 3D terrain mesh.
 */
function getTargetPixelRatio(perfMode: PerformanceMode): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const cssPixels = Math.max(1, window.innerWidth * window.innerHeight);
  const isSmallScreen = window.innerWidth < 1024;

  if (perfMode === 'eco') {
    return isSmallScreen ? Math.min(dpr, 1.5) : 1;
  }
  if (perfMode === 'ultra') {
    return Math.min(dpr, 3);
  }

  // `balanced`: exact 1:1 native DPR (up to 2x desktop / 3x mobile) — zero upscaling blur!
  const target = isSmallScreen ? Math.min(dpr, 3) : Math.min(dpr, 2);
  const physicalPixels = cssPixels * target * target;
  if (physicalPixels > 9_500_000) {
    return Math.max(1, Math.min(target, Math.sqrt(9_500_000 / cssPixels)));
  }
  return target;
}

function ensureTerrainDemSource(
  map: maplibregl.Map,
  perfMode: PerformanceMode
): boolean {
  if (map.getSource('terrain-dem')) return true;
  try {
    map.addSource('terrain-dem', createTerrainDemSourceSpec(perfMode));
    return true;
  } catch {
    return false;
  }
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

function MingMapCanvasInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const activeCurvesRef = useRef<PreparedRouteCurve[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startDirectorLoopRef = useRef<() => void>(() => {});

  // Granular WebGL upload-deduplication refs (prevents redundant setData worker stalls!)
  const lastBaseGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const lastCausalKeyRef = useRef<string | null>(null);
  const lastOdysseyKeyRef = useRef<string | null>(null);
  const campaignLayersPopulatedRef = useRef(false);
  const lastAppliedPixelRatioRef = useRef(1);

  // Zero-worker GPU feature-state hover tracking
  const hoveredPolityIdRef = useRef<string | null>(null);
  const hoveredFeatureIdRef = useRef<string | number | null>(null);
  const hoveredRouteIdRef = useRef<string | null>(null);
  const lastCursorRef = useRef<string>('');

  // On-Demand Animation Clocks & Throttles (0% CPU/GPU when idle!)
  const phaseElapsedMsRef = useRef(0);
  const routeGrowElapsedMsRef = useRef(0);
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

  // Track which snapshot IDs the currently rendered map actually cares about,
  // so background pre-warming of the other 14 chunks triggers 0 re-renders!
  const neededSnapshotIdsRef = useRef<Set<string>>(new Set(['ter-1356']));
  {
    const needed = new Set<string>([currentSnapshot.meta.snapshotId]);
    if (activeCampaignId) {
      for (const reqId of CAMPAIGN_REQUIRED_SNAPSHOTS[activeCampaignId] ?? []) {
        needed.add(reqId);
      }
    }
    neededSnapshotIdsRef.current = needed;
  }

  useEffect(() => {
    scheduleWarmAllTerritoryChunks();
    return subscribeTerritoryChunks((loadedIds) => {
      if (loadedIds.some((id) => neededSnapshotIdsRef.current.has(id))) {
        setTerritoryChunkRev((v) => v + 1);
      }
    });
  }, []);

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

  const clearTerritoryHoverState = (map: maplibregl.Map) => {
    if (hoveredFeatureIdRef.current !== null && map.getSource('ming-territories')) {
      try {
        map.setFeatureState(
          { source: 'ming-territories', id: hoveredFeatureIdRef.current },
          { hover: false }
        );
      } catch {
        // ignore if style swapped
      }
    }
    hoveredFeatureIdRef.current = null;
    if (hoveredPolityIdRef.current !== null) {
      hoveredPolityIdRef.current = null;
      useAtlasStore.getState().setHoveredPolity(null);
    }
  };

  /**
   * Uploads base territory polygons ONLY when the actual GeoJSON object reference changed!
   * Prevents redundant 5,000-7,300 vertex GeoJSON worker re-triangulations on event clicks,
   * zoom changes, layer toggles, and same-era timeline scrubbing.
   */
  const uploadBaseTerritoriesIfChanged = (
    map: maplibregl.Map,
    nextGeo: GeoJSON.FeatureCollection
  ) => {
    if (lastBaseGeoRef.current === nextGeo) return;
    lastBaseGeoRef.current = nextGeo;
    hoveredFeatureIdRef.current = null;
    if (map.getSource('ming-territories')) {
      try {
        map.removeFeatureState({ source: 'ming-territories' });
      } catch {
        // ignore
      }
    }
    const terSource = map.getSource('ming-territories') as
      | maplibregl.GeoJSONSource
      | undefined;
    const polPtSource = map.getSource('ming-polity-points') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (terSource) terSource.setData(nextGeo);
    if (polPtSource) polPtSource.setData(buildPolityLabelGeoJSON(nextGeo));
  };

  /**
   * Temporarily suspends MapLibre's 3D Terrain Drape RTT FBO pipeline ONLY while
   * GeoJSON polygon wipes (`ming-territory-wipe`) are actively mutating!
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
      if (ensureTerrainDemSource(map, st.perfMode)) {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: getTerrainExaggeration(st.perfMode),
        });
      }
    }
  };

  // --- Granular Sync Helpers (each updates ONLY its own slice of WebGL state!) ---

  const syncTerritoriesLayer = (map: maplibregl.Map) => {
    const st = useAtlasStore.getState();
    const snap = getSnapshotForYear(st.currentYear);

    if (st.activeCampaignId) {
      eraWipeRef.current = null;
      const cmpFrame = buildCampaignTerritoryFrame(
        st.activeCampaignId,
        st.activePhaseIndex,
        0
      );
      campaignHasWipeRef.current = cmpFrame.hasWipeInPhase;
      uploadBaseTerritoriesIfChanged(map, cmpFrame.baseGeoJSON);
      updateTerritoryWipeOnMap(map, cmpFrame.wipeOverlayGeoJSON);
      if (st.activeWipeCaption !== cmpFrame.caption) {
        st.setActiveWipeCaption(cmpFrame.caption);
      }
      displayedSnapshotIdRef.current = null;
      return;
    }

    campaignHasWipeRef.current = false;
    const nextSnapId = snap.meta.snapshotId;
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
      const plan = getEraWipePlan(prevSnapId, nextSnapId);
      if (plan.targets.length > 0) {
        const prevGeo = TERRITORY_SNAPSHOT_BY_ID[prevSnapId].geojson;
        eraWipeRef.current = {
          fromId: prevSnapId,
          toId: nextSnapId,
          plan,
          elapsedMs: 0,
        };
        uploadBaseTerritoriesIfChanged(map, prevGeo);
        const polPtSource = map.getSource('ming-polity-points') as
          | maplibregl.GeoJSONSource
          | undefined;
        if (polPtSource) {
          polPtSource.setData(buildPolityLabelGeoJSON(snap.geojson));
        }
        updateTerritoryWipeOnMap(map, null);
        st.setActiveWipeCaption(plan.caption);
        startDirectorLoopRef.current();
        return;
      }
    }

    if (!eraWipeRef.current || eraWipeRef.current.toId !== nextSnapId) {
      eraWipeRef.current = null;
      displayedSnapshotIdRef.current = nextSnapId;
      uploadBaseTerritoriesIfChanged(map, snap.geojson);
      updateTerritoryWipeOnMap(map, null);
      if (st.activeWipeCaption !== null) {
        st.setActiveWipeCaption(null);
      }
    }
  };

  const syncEventsLayer = (map: maplibregl.Map) => {
    const st = useAtlasStore.getState();
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
  };

  const syncCausalArcsLayer = (map: maplibregl.Map) => {
    const st = useAtlasStore.getState();
    const visible =
      st.layers.causalArcs && !st.activeCampaignId && !st.activeCharacterId;
    const nextKey = visible && st.selectedEventId ? st.selectedEventId : '__off__';
    if (lastCausalKeyRef.current === nextKey) return;
    lastCausalKeyRef.current = nextKey;
    const activeEvt = st.selectedEventId ? EVENT_MAP[st.selectedEventId] : null;
    updateCausalArcsOnMap(map, activeEvt, visible);
  };

  const syncOdysseyLayer = (map: maplibregl.Map) => {
    const st = useAtlasStore.getState();
    const charId = st.activeCampaignId ? null : st.activeCharacterId;
    const nextKey = charId ? `${charId}:${st.activeCharacterStopIndex}` : '__off__';
    if (lastOdysseyKeyRef.current === nextKey) return;
    lastOdysseyKeyRef.current = nextKey;
    updateCharacterOdysseyOnMap(map, charId, st.activeCharacterStopIndex);
  };

  const syncCampaignStaticLayers = (map: maplibregl.Map) => {
    const st = useAtlasStore.getState();
    const cmp = st.activeCampaignId ? CAMPAIGN_MAP[st.activeCampaignId] ?? null : null;
    const ph = cmp ? cmp.phases[st.activePhaseIndex] ?? cmp.phases[0] : null;

    if (!cmp || !ph) {
      activeCurvesRef.current = [];
      if (campaignLayersPopulatedRef.current) {
        campaignLayersPopulatedRef.current = false;
        setCampaignStaticRoutesOnMap(map, EMPTY_FC, []);
        setCampaignSpotlightRoute(map, null, false);
        updateCampaignArrowheadsOnMap(map, [], 'static', 1);
        updateCampaignAnnotationsOnMap(map, [], null, 0, st.theme);
      }
      return;
    }

    campaignLayersPopulatedRef.current = true;
    const { featureCollection, preparedCurves } = buildPhaseRouteFeatures(cmp, ph);
    activeCurvesRef.current = preparedCurves;
    setCampaignStaticRoutesOnMap(map, featureCollection, preparedCurves);
    setCampaignSpotlightRoute(map, st.spotlightRouteId, true);
    updateCampaignAnnotationsOnMap(
      map,
      preparedCurves,
      ph,
      preparedCurves.length,
      st.theme
    );
    if (st.campaignArrowMode === 'static') {
      updateCampaignArrowheadsOnMap(map, preparedCurves, 'static', 1);
    } else {
      updateCampaignArrowheadsOnMap(map, preparedCurves, 'dynamic', 0, 0);
    }
  };

  /**
   * Full mount called ONLY on initial `map.on('load')` and after `map.setStyle(...)`
   * (theme / perfMode change). Resets all dedup guards and mounts all sources once.
   */
  const mountAndSyncFullStyle = (map: maplibregl.Map) => {
    const st = useAtlasStore.getState();
    const snap = getSnapshotForYear(st.currentYear);

    lastBaseGeoRef.current = null;
    lastCausalKeyRef.current = null;
    lastOdysseyKeyRef.current = null;
    hoveredFeatureIdRef.current = null;
    campaignLayersPopulatedRef.current = true;

    registerTacticalSprites(map);
    mountHistoricalLayers(
      map,
      snap.geojson,
      st.theme,
      st.placeNameMode,
      st.perfMode
    );
    resetLayerSyncGuards(map);
    // Record initial uploaded base so syncTerritoriesLayer avoids immediate duplicate setData
    lastBaseGeoRef.current = snap.geojson;
    if (!st.activeCampaignId) {
      displayedSnapshotIdRef.current = snap.meta.snapshotId;
    }

    syncLayerVisibility(map, st.layers, st.perfMode);
    syncTerritoriesLayer(map);
    syncCausalArcsLayer(map);
    syncOdysseyLayer(map);
    syncEventsLayer(map);
    syncCampaignStaticLayers(map);
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

    const initialPixelRatio = getTargetPixelRatio(initState.perfMode);
    lastAppliedPixelRatioRef.current = initialPixelRatio;

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
      pixelRatio: initialPixelRatio,
      maxTileCacheSize: initState.perfMode === 'eco' ? 48 : 96,
      maxPitch: 52,
      minZoom: 2.5,
      maxZoom: 13.0,
      fadeDuration: 0,
      renderWorldCopies: false,
      refreshExpiredTiles: false,
      validateStyle: false,
      attributionControl: false,
      canvasContextAttributes: {
        antialias: initState.perfMode !== 'eco',
        powerPreference: 'high-performance',
      },
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

    const setCanvasCursor = (next: string) => {
      if (lastCursorRef.current !== next) {
        lastCursorRef.current = next;
        map.getCanvas().style.cursor = next;
      }
    };

    const onManualInput = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      if (useAtlasStore.getState().activeCampaignId) {
        userInteractedInPhaseRef.current = true;
      }
    };
    map.on('mousedown', onManualInput);
    map.on('touchstart', onManualInput);
    map.on('wheel', onManualInput);

    // Unified Single Click Handler (replaces 4 delegated layer listeners -> 0 raw mousemove overhead!)
    map.on('click', (e) => {
      if (!styleReadyRef.current) return;
      const st = useAtlasStore.getState();

      if (st.activeCampaignId) {
        const cmpLayers = [
          'campaign-callouts-pill',
          'campaign-routes-solid',
          'campaign-routes-dashed',
        ].filter((id) => Boolean(map.getLayer(id)));
        if (cmpLayers.length > 0) {
          const hits = map.queryRenderedFeatures(e.point, { layers: cmpLayers });
          const rId = String(
            hits[0]?.properties?.routeId ?? hits[0]?.properties?.id ?? ''
          );
          if (rId) {
            st.focusCampaignRoute(rId);
            return;
          }
        }
        if (
          typeof window !== 'undefined' &&
          window.innerWidth < 640 &&
          st.isCampaignPanelOpen
        ) {
          st.setCampaignPanelOpen(false);
        }
        return;
      }

      if (map.getLayer('ming-events-symbol')) {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['ming-events-symbol'],
        });
        const eventId = hits[0]?.properties?.eventId;
        if (typeof eventId === 'string' && eventId) {
          st.selectEvent(eventId, true);
          return;
        }
      }

      // Mobile (<640px): Tap empty map canvas to dismiss open bottom sheets
      if (
        typeof window !== 'undefined' &&
        window.innerWidth < 640 &&
        (st.isDrawerOpen || st.isDirectoryOpen)
      ) {
        if (st.isDrawerOpen) st.setDrawerOpen(false);
        if (st.isDirectoryOpen) st.setDirectoryOpen(false);
      }
    });

    // Unified Throttled Mousemove Hit-Testing (0ms while dragging, zooming, or animating!)
    // Replaces 4 MapLibre delegated mouseenter listeners that queried on every raw 120Hz mouse pixel!
    let lastHoverMs = 0;
    map.on('mousemove', (e) => {
      if (!styleReadyRef.current || map.isMoving()) return;
      if (e.originalEvent && e.originalEvent.buttons !== 0) return;
      const now = performance.now();
      if (now - lastHoverMs < 90) return;
      lastHoverMs = now;

      const st = useAtlasStore.getState();

      // Campaign Mode: hit-test ONLY route lines & callout pills
      if (st.activeCampaignId) {
        if (hoveredPolityIdRef.current !== null || hoveredFeatureIdRef.current !== null) {
          clearTerritoryHoverState(map);
        }
        const cmpLayers = [
          'campaign-callouts-pill',
          'campaign-routes-solid',
          'campaign-routes-dashed',
        ].filter((id) => Boolean(map.getLayer(id)));
        if (cmpLayers.length === 0) {
          setCanvasCursor('');
          return;
        }
        const hits = map.queryRenderedFeatures(e.point, { layers: cmpLayers });
        const nextRouteId = hits[0]
          ? String(hits[0].properties?.routeId ?? hits[0].properties?.id ?? '') || null
          : null;
        setCanvasCursor(nextRouteId ? 'pointer' : '');
        if (nextRouteId !== hoveredRouteIdRef.current) {
          hoveredRouteIdRef.current = nextRouteId;
          st.setSpotlightRouteId(nextRouteId);
        }
        return;
      }

      if (hoveredRouteIdRef.current !== null) {
        hoveredRouteIdRef.current = null;
      }

      // Normal Mode: batch event medallion & territory hover in ONE queryRenderedFeatures call!
      const queryLayers: string[] = [];
      if (map.getLayer('ming-events-symbol')) {
        queryLayers.push('ming-events-symbol');
      }
      const checkTerritoryHover =
        st.layers.territories &&
        animFrameRef.current === null &&
        Boolean(map.getLayer('ming-territories-fill'));
      if (checkTerritoryHover) {
        queryLayers.push('ming-territories-fill');
      }
      if (queryLayers.length === 0) {
        setCanvasCursor('');
        return;
      }

      const hits = map.queryRenderedFeatures(e.point, { layers: queryLayers });
      let hitEvent = false;
      let topTerritory: maplibregl.MapGeoJSONFeature | undefined;
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (!hitEvent && h.layer.id === 'ming-events-symbol') {
          hitEvent = true;
        } else if (!topTerritory && h.layer.id === 'ming-territories-fill') {
          topTerritory = h;
        }
      }

      setCanvasCursor(hitEvent ? 'pointer' : '');

      if (!checkTerritoryHover) return;

      const nextFeatureId = topTerritory?.id ?? null;
      const nextPolityId = topTerritory
        ? String(topTerritory.properties?.polityId ?? '') || null
        : null;

      if (nextFeatureId !== hoveredFeatureIdRef.current) {
        if (hoveredFeatureIdRef.current !== null) {
          try {
            map.setFeatureState(
              { source: 'ming-territories', id: hoveredFeatureIdRef.current },
              { hover: false }
            );
          } catch {
            // ignore
          }
        }
        hoveredFeatureIdRef.current = nextFeatureId;
        if (nextFeatureId !== null) {
          try {
            map.setFeatureState(
              { source: 'ming-territories', id: nextFeatureId },
              { hover: true }
            );
          } catch {
            // ignore
          }
        }
      }

      if (nextPolityId !== hoveredPolityIdRef.current) {
        hoveredPolityIdRef.current = nextPolityId;
        if (topTerritory?.properties) {
          const p = topTerritory.properties;
          st.setHoveredPolity({
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
          st.setHoveredPolity(null);
        }
      }
    });

    const onCanvasLeave = () => {
      setCanvasCursor('');
      if (hoveredRouteIdRef.current !== null) {
        hoveredRouteIdRef.current = null;
        if (useAtlasStore.getState().activeCampaignId) {
          useAtlasStore.getState().setSpotlightRouteId(null);
        }
      }
      if (styleReadyRef.current) {
        clearTerritoryHoverState(map);
      }
    };
    map.getCanvas().addEventListener('mouseleave', onCanvasLeave);

    const updateZoomBucket = () => {
      const z = map.getZoom();
      const next = z >= 6.6 ? 'close' : z >= 5.6 ? 'mid' : 'far';
      setZoomBucket((prev) => (prev === next ? prev : next));
    };
    map.on('zoomend', updateZoomBucket);

    map.on('load', () => {
      styleReadyRef.current = true;
      mountAndSyncFullStyle(map);
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
      const minArrowInterval =
        store.perfMode === 'eco'
          ? 52
          : !store.isCampaignPlaying
          ? 48
          : store.perfMode === 'ultra'
          ? 20
          : 33;

      const hasMutatingGeoJSON =
        eraWipeRef.current !== null ||
        (Boolean(store.activeCampaignId) &&
          campaignHasWipeRef.current &&
          campaignWipeElapsedMsRef.current > 0 &&
          campaignWipeElapsedMsRef.current < CAMPAIGN_WIPE_DURATION_MS);

      if (currentMap && styleReadyRef.current) {
        syncTerrainDrapeSuspension(currentMap, hasMutatingGeoJSON);
      }

      // --- MODE C: Local-Delta Era-to-Era Brush Paint-Over (30fps push!) ---
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
          if (destSnap) {
            uploadBaseTerritoriesIfChanged(currentMap, destSnap.geojson);
          }
          updateTerritoryWipeOnMap(currentMap, null);
          displayedSnapshotIdRef.current = wipe.toId;
          eraWipeRef.current = null;
          store.setActiveWipeCaption(null);
        } else if (now - lastEraWipePushMsRef.current >= 34) {
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

        // Give 100% WebGL & Worker priority while the user is actively dragging/zooming!
        const userManuallyNavigating =
          currentMap.isMoving() &&
          (userInteractedInPhaseRef.current || !store.isCampaignPlaying);

        if (store.campaignArrowMode === 'dynamic') {
          routeGrowElapsedMsRef.current += dt;
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
          if (
            nextUnlocked !== unlockedStepsRef.current &&
            !store.isCampaignPlaying
          ) {
            emitPlaybackTick({
              mode: 'campaign',
              percent: 0,
              unlockedSteps: nextUnlocked,
            });
          }
          unlockedStepsRef.current = nextUnlocked;

          if (
            !userManuallyNavigating &&
            now - lastWebglFrameMsRef.current >= minArrowInterval
          ) {
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
          routeGrowElapsedMsRef.current = Math.min(
            growTotalMs,
            routeGrowElapsedMsRef.current + dt
          );
          unlockedStepsRef.current = curves.length;
        }

        const rawGrow = Math.min(1, routeGrowElapsedMsRef.current / growTotalMs);

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
            now - lastCampaignWipePushMsRef.current >= 34 ||
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

    let resizeTimer: number | null = null;
    const onWindowResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        const st = useAtlasStore.getState();
        const nextRatio = getTargetPixelRatio(st.perfMode);
        if (Math.abs(nextRatio - lastAppliedPixelRatioRef.current) > 0.04) {
          lastAppliedPixelRatioRef.current = nextRatio;
          map.setPixelRatio(nextRatio);
        }
      }, 160);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onWindowResize);

    mapRef.current = map;
    registerMapInstanceForCapture(map);

    return () => {
      registerMapInstanceForCapture(null);
      map.getCanvas().removeEventListener('mouseleave', onCanvasLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onWindowResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
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
      const nextRatio = getTargetPixelRatio(perfMode);
      lastAppliedPixelRatioRef.current = nextRatio;
      map.setPixelRatio(nextRatio);
    }

    if (prevThemeRef.current !== theme || prevPerfRef.current !== perfMode) {
      prevThemeRef.current = theme;
      prevPerfRef.current = perfMode;
      prev3DRef.current = is3D;
      terrainSuspendedRef.current = false;
      styleReadyRef.current = false;
      // Detach active 3D terrain mesh BEFORE replacing style to avoid MapLibre v5
      // `shaderPreludeCode` TypeError when transitioning out of 3D (`极致` -> `均衡`/`省电`)!
      if (map.getTerrain()) {
        map.setTerrain(null);
      }
      map.setStyle(createHistoricalBaseStyle(theme, is3D, perfMode), {
        diff: false,
      });
      map.once('styledata', () => {
        styleReadyRef.current = true;
        mountAndSyncFullStyle(map);
        startDirectorLoopRef.current();
      });
      return;
    }

    if (prev3DRef.current !== is3D) {
      prev3DRef.current = is3D;
      terrainSuspendedRef.current = false;
      if (styleReadyRef.current) {
        if (is3D && perfMode !== 'eco') {
          if (ensureTerrainDemSource(map, perfMode)) {
            map.setTerrain({
              source: 'terrain-dem',
              exaggeration: getTerrainExaggeration(perfMode),
            });
          }
        } else {
          map.setTerrain(null);
        }
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

  // 4a. Layer Visibility ONLY (0 GeoJSON uploads!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncLayerVisibility(map, layers, perfMode);
  }, [layers, perfMode]);

  // 4b. Territory Polygons ONLY (0 uploads on event click, zoom, or same-era scrub!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncTerritoriesLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, activeCampaignId, activePhaseIndex, territoryChunkRev]);

  // 4c. Event Medallions ONLY (signature-deduplicated!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncEventsLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedEventId,
    currentYear,
    zoomBucket,
    layers.macroEvents,
    layers.showAllMicroEvents,
    activeCampaignId,
    activeCharacterId,
    causalLinkedSet,
  ]);

  // 4d. Causal Arcs ONLY
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncCausalArcsLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, layers.causalArcs, activeCampaignId, activeCharacterId]);

  // 4e. Character Odyssey ONLY
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncOdysseyLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacterId, activeCharacterStopIndex, activeCampaignId]);

  // 5. Reset Story Tour Clock on Event Change
  useEffect(() => {
    storyElapsedMsRef.current = 0;
    emitPlaybackTick({ mode: 'tour', percent: 0, unlockedSteps: 1 });
    startDirectorLoopRef.current();
  }, [selectedEventId, storyTourNonce, isStoryTourPlaying]);

  // 6. Campaign Phase Stationary Routes, Annotations & Opening Camera (Single Source of Truth!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!activeCampaign || !activePhase) {
      if (styleReadyRef.current) {
        syncCampaignStaticLayers(map);
      }
      return;
    }

    phaseElapsedMsRef.current = 0;
    routeGrowElapsedMsRef.current = 0;
    unlockedStepsRef.current = 1;
    campaignWipeElapsedMsRef.current = 0;
    userInteractedInPhaseRef.current = false;

    const { featureCollection, preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;

    if (styleReadyRef.current) {
      campaignLayersPopulatedRef.current = true;
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

const MingMapCanvas = React.memo(MingMapCanvasInner);
export default MingMapCanvas;
