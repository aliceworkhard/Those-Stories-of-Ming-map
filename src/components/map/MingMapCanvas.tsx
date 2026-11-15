'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { SITE_CONFIG } from '@/config/site';
import {
  ALL_EVENTS,
  CAMPAIGN_MAP,
  EVENT_MAP,
  TERRITORY_SNAPSHOT_BY_ID,
  getSnapshotForYear,
} from '@/lib/atlasData';
import {
  createHistoricalBaseStyle,
  getTerrainExaggeration,
  registerTacticalSprites,
} from '@/engine/mapStyle';
import {
  buildPhaseRouteFeatures,
  buildPolityLabelGeoJSON,
  mountHistoricalLayers,
  setPlaceNameModeOnGpu,
  syncLayerVisibility,
  updateCampaignAnimationFrame,
  updateCausalArcsOnMap,
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
import { useAtlasStore } from '@/store/useAtlasStore';
import type {
  CampaignPhase,
  HistoricalEvent,
  LngLat,
  MapVisualTheme,
  PerformanceMode,
  TerritoryPolityProps,
} from '@/types/ming';

const OPENING_FLY_DURATION_MS = 1200;
const STORY_STOP_DURATION_MS = 5800;
const ERA_WIPE_DURATION_MS = 2050;
const CAMPAIGN_WIPE_DURATION_MS = 2100;
const CIRCLED_STEPS = ['①', '②', '③', '④', '⑤', '⑥'];

function getRouteGrowDurationMs(routeCount: number): number {
  if (routeCount <= 1) return 2300;
  if (routeCount === 2) return 4100;
  return 5800;
}

function getPhaseTotalDurationMs(
  routeCount: number,
  hasWipeInPhase: boolean
): number {
  return (
    getRouteGrowDurationMs(routeCount) + (hasWipeInPhase ? 3500 : 2500)
  );
}

interface ScreenBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function boxesOverlap(a: ScreenBox, b: ScreenBox): boolean {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

function padBox(b: ScreenBox, pad: number): ScreenBox {
  return { x1: b.x1 - pad, y1: b.y1 - pad, x2: b.x2 + pad, y2: b.y2 + pad };
}

function estimateLabelWidthPx(text: string, fontPx = 11, padX = 18): number {
  let w = padX;
  for (let i = 0; i < text.length; i++) {
    w += text.charCodeAt(i) > 255 ? fontPx * 1.04 : fontPx * 0.62;
  }
  return Math.ceil(w);
}

function getTargetPixelRatio(perfMode: PerformanceMode): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  if (perfMode === 'eco') return 1;
  if (perfMode === 'ultra') return Math.min(dpr, 2);
  return Math.min(dpr, 1.5);
}

function createImmutableMarkerRoot(zIndex = '18'): HTMLDivElement {
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
  tetherSvg: SVGSVGElement;
  tetherLine: SVGLineElement;
  anchorWrap: HTMLDivElement;
  haloEl: HTMLSpanElement;
  badgeEl: HTMLDivElement;
  labelEl: HTMLDivElement;
  labelText: string;
  visible: boolean;
  hovered: boolean;
}

interface CampaignCalloutRecord {
  coord: LngLat;
  stepNo: number;
  startAt: number;
  root: HTMLDivElement;
  marker: maplibregl.Marker;
  wrapEl: HTMLDivElement;
  widthPx: number;
  heightPx: number;
}

interface CampaignShockwaveRecord {
  coord: LngLat;
  marker: maplibregl.Marker;
  labelEl: HTMLDivElement;
  widthPx: number;
  heightPx: number;
}

type LabelSlot = 'bottom' | 'top' | 'right' | 'left';

function computeSlotBox(
  ax: number,
  ay: number,
  r: number,
  w: number,
  h: number,
  slot: LabelSlot
): ScreenBox {
  switch (slot) {
    case 'bottom':
      return {
        x1: ax - w / 2,
        y1: ay + r + 5,
        x2: ax + w / 2,
        y2: ay + r + 5 + h,
      };
    case 'top':
      return {
        x1: ax - w / 2,
        y1: ay - r - 5 - h,
        x2: ax + w / 2,
        y2: ay - r - 5,
      };
    case 'right':
      return {
        x1: ax + r + 6,
        y1: ay - h / 2,
        x2: ax + r + 6 + w,
        y2: ay + h / 2,
      };
    case 'left':
      return {
        x1: ax - r - 6 - w,
        y1: ay - h / 2,
        x2: ax - r - 6,
        y2: ay + h / 2,
      };
  }
}

function applySlotPosition(el: HTMLElement, r: number, slot: LabelSlot): void {
  switch (slot) {
    case 'bottom':
      el.style.left = '0px';
      el.style.top = `${r + 5}px`;
      el.style.transform = 'translateX(-50%)';
      break;
    case 'top':
      el.style.left = '0px';
      el.style.top = `${-r - 5}px`;
      el.style.transform = 'translate(-50%, -100%)';
      break;
    case 'right':
      el.style.left = `${r + 6}px`;
      el.style.top = '0px';
      el.style.transform = 'translateY(-50%)';
      break;
    case 'left':
      el.style.left = `${-r - 6}px`;
      el.style.top = '0px';
      el.style.transform = 'translate(-100%, -50%)';
      break;
  }
}

export default function MingMapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const activeCurvesRef = useRef<PreparedRouteCurve[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startDirectorLoopRef = useRef<() => void>(() => {});
  const layoutRafPendingRef = useRef(false);
  const lastMoveLayoutMsRef = useRef(0);

  // On-Demand Animation Clocks & Throttles (0% CPU/GPU when idle!)
  const phaseElapsedMsRef = useRef(0);
  const routeGrowElapsedMsRef = useRef(0);
  const routeGrowFinishedRef = useRef(false);
  const campaignWipeElapsedMsRef = useRef(0);
  const campaignHasWipeRef = useRef(false);
  const lastCampaignWipePushMsRef = useRef(0);
  const lastWebglFrameMsRef = useRef(0);
  const storyElapsedMsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastProgressReportMsRef = useRef(0);
  const userInteractedInPhaseRef = useRef(false);
  const activePhaseRef = useRef<CampaignPhase | null>(null);
  const is3DRef = useRef(true);
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

  // Lightweight Marker Registries (Places & Polity Seals now live 100% on GPU!)
  const eventMarkerMapRef = useRef<Map<string, EventMarkerRecord>>(new Map());
  const campaignCalloutsRef = useRef<CampaignCalloutRecord[]>([]);
  const campaignShockwavesRef = useRef<CampaignShockwaveRecord[]>([]);

  const [zoomBucket, setZoomBucket] = useState<'far' | 'mid' | 'close'>('far');

  const currentYear = useAtlasStore((s) => s.currentYear);
  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const storyTourNonce = useAtlasStore((s) => s.storyTourNonce);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const isCampaignPlaying = useAtlasStore((s) => s.isCampaignPlaying);
  const campaignSpeed = useAtlasStore((s) => s.campaignSpeed);
  const campaignCameraMode = useAtlasStore((s) => s.campaignCameraMode);
  const campaignReplayNonce = useAtlasStore((s) => s.campaignReplayNonce);
  const theme = useAtlasStore((s) => s.theme);
  const perfMode = useAtlasStore((s) => s.perfMode);
  const is3D = useAtlasStore((s) => s.is3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const cameraCommand = useAtlasStore((s) => s.cameraCommand);

  is3DRef.current = is3D && perfMode !== 'eco';

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

  const selectedEventObj = selectedEventId ? EVENT_MAP[selectedEventId] : null;

  // Set of causal neighbor IDs (`prevEventIds` + `nextEventIds`) for the selected event
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
   * Fast Screen-Space Spiderfy & 4-Quadrant AABB Collision Solver for Event Medallions
   * & Campaign Tactical Callouts. (Static Places & Polity Seals are handled natively by GPU!)
   */
  const runScreenSpaceLayout = () => {
    layoutRafPendingRef.current = false;
    const map = mapRef.current;
    if (!map) return;

    const st = useAtlasStore.getState();
    const z = map.getZoom();
    const bucket: 'far' | 'mid' | 'close' =
      z >= 6.6 ? 'close' : z >= 5.6 ? 'mid' : 'far';
    const canvas = map.getCanvas();
    const viewW = canvas.clientWidth || 1280;
    const viewH = canvas.clientHeight || 800;

    const occupied: ScreenBox[] = [];

    // 1. Layout Campaign Shockwaves & Tactical Route Callouts (only during Campaign mode)
    if (st.activeCampaignId) {
      for (const sw of campaignShockwavesRef.current) {
        const pt = map.project(sw.coord);
        occupied.push({
          x1: pt.x - 18,
          y1: pt.y - 18,
          x2: pt.x + 18,
          y2: pt.y + 18,
        });

        const slots: LabelSlot[] = ['bottom', 'top', 'right', 'left'];
        let placedSlot: LabelSlot = 'bottom';
        for (const sl of slots) {
          const cand = computeSlotBox(pt.x, pt.y, 17, sw.widthPx, sw.heightPx, sl);
          if (occupied.every((b) => !boxesOverlap(cand, b))) {
            placedSlot = sl;
            break;
          }
        }
        applySlotPosition(sw.labelEl, 17, placedSlot);
        occupied.push(
          padBox(
            computeSlotBox(pt.x, pt.y, 17, sw.widthPx, sw.heightPx, placedSlot),
            4
          )
        );
      }

      const calloutOffsets: Array<[number, number]> = [
        [0, 0],
        [0, -24],
        [0, 24],
        [42, 0],
        [-42, 0],
        [0, -46],
        [0, 46],
      ];
      for (const co of campaignCalloutsRef.current) {
        const pt = map.project(co.coord);
        let chosen: [number, number] = [0, 0];
        let found = false;
        for (const [ox, oy] of calloutOffsets) {
          const cx = pt.x + ox;
          const cy = pt.y + oy;
          const cand: ScreenBox = {
            x1: cx - co.widthPx / 2,
            y1: cy - co.heightPx / 2,
            x2: cx + co.widthPx / 2,
            y2: cy + co.heightPx / 2,
          };
          if (occupied.every((b) => !boxesOverlap(cand, b))) {
            chosen = [ox, oy];
            occupied.push(padBox(cand, 4));
            found = true;
            break;
          }
        }
        co.wrapEl.style.left = `${chosen[0]}px`;
        co.wrapEl.style.top = `${chosen[1]}px`;
        co.wrapEl.style.opacity = found ? '1' : '0';
      }
      return;
    }

    // 2. Spiderfy Co-Located Event Medallions so identical [lng, lat] never stack!
    const visibleEventRecs: Array<{
      rec: EventMarkerRecord;
      baseX: number;
      baseY: number;
      dx: number;
      dy: number;
    }> = [];

    eventMarkerMapRef.current.forEach((rec) => {
      if (!rec.visible) return;
      const pt = map.project(rec.evt.location.coordinates);
      visibleEventRecs.push({ rec, baseX: pt.x, baseY: pt.y, dx: 0, dy: 0 });
    });

    const assigned = new Set<number>();
    for (let i = 0; i < visibleEventRecs.length; i++) {
      if (assigned.has(i)) continue;
      const cluster = [i];
      assigned.add(i);
      for (let j = i + 1; j < visibleEventRecs.length; j++) {
        if (assigned.has(j)) continue;
        const nearAny = cluster.some(
          (idx) =>
            Math.hypot(
              visibleEventRecs[idx].baseX - visibleEventRecs[j].baseX,
              visibleEventRecs[idx].baseY - visibleEventRecs[j].baseY
            ) < 32
        );
        if (nearAny) {
          cluster.push(j);
          assigned.add(j);
        }
      }

      if (cluster.length > 1) {
        const cx =
          cluster.reduce((s, idx) => s + visibleEventRecs[idx].baseX, 0) /
          cluster.length;
        const cy =
          cluster.reduce((s, idx) => s + visibleEventRecs[idx].baseY, 0) /
          cluster.length;
        const ringRadius =
          cluster.length === 2 ? 21 : cluster.length <= 4 ? 27 : 34;

        cluster.forEach((memberIdx, k) => {
          const item = visibleEventRecs[memberIdx];
          const angle = -Math.PI / 2 + (2 * Math.PI * k) / cluster.length;
          const tx = cx + ringRadius * Math.cos(angle);
          const ty = cy + ringRadius * Math.sin(angle);
          item.dx = Math.round(tx - item.baseX);
          item.dy = Math.round(ty - item.baseY);
        });
      }
    }

    for (const item of visibleEventRecs) {
      const { rec, baseX, baseY, dx, dy } = item;
      rec.anchorWrap.style.left = `${dx}px`;
      rec.anchorWrap.style.top = `${dy}px`;

      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        rec.tetherSvg.style.display = 'block';
        rec.tetherLine.setAttribute('x2', String(56 + dx));
        rec.tetherLine.setAttribute('y2', String(56 + dy));
      } else {
        rec.tetherSvg.style.display = 'none';
      }

      const r = rec.evt.tier === 'macro' ? 14 : 11;
      occupied.push({
        x1: baseX + dx - r,
        y1: baseY + dy - r,
        x2: baseX + dx + r,
        y2: baseY + dy + r,
      });
    }

    // 3. Priority-Sorted 4-Quadrant Event Label Solver with Temporal Decluttering
    const linkedIds = causalLinkedSetRef.current;
    const candidates = visibleEventRecs
      .map((item) => {
        const { rec, baseX, baseY, dx, dy } = item;
        const isSelected = rec.evt.id === st.selectedEventId;
        const isCausal = linkedIds.has(rec.evt.id);
        const isMacro = rec.evt.tier === 'macro';
        const yearGap = Math.abs(rec.evt.time.year - st.currentYear);
        const isInEraFocus = yearGap <= 8;

        // Smart Temporal Decluttering: when zoomed out at China overview (`far`),
        // show labels only on Selected, Hovered, Causal-Linked, or Current-Era events!
        const shouldDisplayLabel =
          rec.hovered ||
          isSelected ||
          isCausal ||
          bucket === 'close' ||
          (bucket === 'mid' && (isMacro || st.layers.showAllMicroEvents)) ||
          (bucket === 'far' && isMacro && isInEraFocus);

        if (!shouldDisplayLabel) {
          rec.labelEl.style.display = 'none';
          return null;
        }

        const priority = rec.hovered
          ? 130
          : isSelected
          ? 110
          : isCausal
          ? 92
          : isMacro && isInEraFocus
          ? 78
          : isMacro
          ? 60
          : 40;

        return {
          rec,
          priority,
          ax: baseX + dx,
          ay: baseY + dy,
          r: isMacro ? 15 : 12,
          w: estimateLabelWidthPx(rec.labelText, 11, 18),
          h: 22,
          forceShow: isSelected || rec.hovered,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.priority - a.priority);

    const overlapArea = (a: ScreenBox, b: ScreenBox): number => {
      const ox = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
      const oy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
      return ox * oy;
    };

    const slotOrder: LabelSlot[] = ['bottom', 'right', 'left', 'top'];
    const safeLeft =
      viewW >= 640 && st.isDirectoryOpen && !st.activeCampaignId ? 290 : 8;
    const safeRight =
      viewW >= 640 && st.isDrawerOpen && !st.activeCampaignId
        ? viewW - 360
        : viewW - 8;

    for (const cand of candidates) {
      if (
        cand.ax < -50 ||
        cand.ax > viewW + 50 ||
        cand.ay < -50 ||
        cand.ay > viewH + 50
      ) {
        cand.rec.labelEl.style.display = 'none';
        continue;
      }

      let chosenSlot: LabelSlot | null = null;
      for (const sl of slotOrder) {
        const box = computeSlotBox(cand.ax, cand.ay, cand.r, cand.w, cand.h, sl);
        if (
          box.x1 >= safeLeft &&
          box.x2 <= safeRight &&
          box.y1 >= 56 &&
          box.y2 <= viewH - 56 &&
          occupied.every((b) => !boxesOverlap(box, b))
        ) {
          chosenSlot = sl;
          break;
        }
      }

      if (chosenSlot || cand.forceShow) {
        let finalSlot = chosenSlot;
        if (!finalSlot) {
          let bestCost = Number.POSITIVE_INFINITY;
          finalSlot = 'bottom';
          for (const sl of slotOrder) {
            const box = computeSlotBox(
              cand.ax,
              cand.ay,
              cand.r,
              cand.w,
              cand.h,
              sl
            );
            const cost = occupied.reduce(
              (sum, b) => sum + overlapArea(box, b),
              0
            );
            if (cost < bestCost) {
              bestCost = cost;
              finalSlot = sl;
            }
          }
        }
        applySlotPosition(cand.rec.labelEl, cand.r, finalSlot);
        cand.rec.labelEl.style.display = 'block';
        occupied.push(
          padBox(
            computeSlotBox(cand.ax, cand.ay, cand.r, cand.w, cand.h, finalSlot),
            3
          )
        );
      } else {
        cand.rec.labelEl.style.display = 'none';
      }
    }
  };

  const scheduleScreenLayout = (throttleMove = false) => {
    if (throttleMove) {
      const now = performance.now();
      if (now - lastMoveLayoutMsRef.current < 42) return;
      lastMoveLayoutMsRef.current = now;
    }
    if (layoutRafPendingRef.current) return;
    layoutRafPendingRef.current = true;
    requestAnimationFrame(runScreenSpaceLayout);
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
      // In Campaign mode: territory starts at pre-battle state and progressively paints victory!
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

      if (
        prevSnapId &&
        prevSnapId !== nextSnapId &&
        TERRITORY_SNAPSHOT_BY_ID[prevSnapId] &&
        st.layers.territories
      ) {
        // Trigger smooth Victory Brush Paint-Over from previous era snapshot to next era snapshot!
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
      st.layers.causalArcs && !st.activeCampaignId
    );

    const { preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;

    if (!activeCampaign) {
      updateCampaignAnimationFrame(map, [], 0, 0, false);
    }
  };

  // Mount Lightweight Bespoke Oriental Seal Medallions for Events (0 infinite CSS animations!)
  const mountPersistentEventMarkers = (map: maplibregl.Map) => {
    eventMarkerMapRef.current.forEach((rec) => rec.marker.remove());
    eventMarkerMapRef.current.clear();

    for (const evt of ALL_EVENTS) {
      const isMacro = evt.tier === 'macro';
      const isBattle = Boolean(evt.campaignId);
      const root = createImmutableMarkerRoot(isMacro ? '24' : '19');

      const svgNs = 'http://www.w3.org/2000/svg';
      const tetherSvg = document.createElementNS(svgNs, 'svg');
      tetherSvg.setAttribute('width', '112');
      tetherSvg.setAttribute('height', '112');
      tetherSvg.style.position = 'absolute';
      tetherSvg.style.left = '-56px';
      tetherSvg.style.top = '-56px';
      tetherSvg.style.pointerEvents = 'none';
      tetherSvg.style.display = 'none';

      const tetherDot = document.createElementNS(svgNs, 'circle');
      tetherDot.setAttribute('cx', '56');
      tetherDot.setAttribute('cy', '56');
      tetherDot.setAttribute('r', '2.5');
      tetherDot.setAttribute('fill', '#9B2C1D');
      tetherDot.setAttribute('opacity', '0.75');

      const tetherLine = document.createElementNS(svgNs, 'line');
      tetherLine.setAttribute('x1', '56');
      tetherLine.setAttribute('y1', '56');
      tetherLine.setAttribute('x2', '56');
      tetherLine.setAttribute('y2', '56');
      tetherLine.setAttribute('stroke', '#9B2C1D');
      tetherLine.setAttribute('stroke-width', '1.2');
      tetherLine.setAttribute('stroke-dasharray', '2.5 2');
      tetherLine.setAttribute('opacity', '0.7');

      tetherSvg.appendChild(tetherLine);
      tetherSvg.appendChild(tetherDot);
      root.appendChild(tetherSvg);

      const anchorWrap = document.createElement('div');
      anchorWrap.style.position = 'absolute';
      anchorWrap.style.left = '0px';
      anchorWrap.style.top = '0px';
      anchorWrap.style.width = '0px';
      anchorWrap.style.height = '0px';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', `${evt.time.year}年 ${evt.title}`);
      btn.className = 'group cursor-pointer focus:outline-none';
      btn.style.position = 'absolute';
      btn.style.left = '0px';
      btn.style.top = '0px';
      btn.style.width = '30px';
      btn.style.height = '30px';
      btn.style.transform = 'translate(-50%, -50%)';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.padding = '0';

      // Static double-ring halo (ZERO GPU-draining `animate-ping`!)
      const haloEl = document.createElement('span');
      haloEl.className = 'rounded-full border pointer-events-none';
      haloEl.style.position = 'absolute';
      haloEl.style.width = isMacro ? '28px' : '22px';
      haloEl.style.height = isMacro ? '28px' : '22px';
      haloEl.style.display = 'none';

      const badgeEl = document.createElement('div');
      badgeEl.className = `${
        isBattle
          ? 'w-7 h-7 rounded-lg rotate-45 border-2 shadow-md group-hover:scale-110'
          : isMacro
          ? 'w-6 h-6 rounded-[5px] rotate-45 border-[1.5px] shadow-md group-hover:scale-110'
          : 'w-5 h-5 rounded-full border shadow-sm group-hover:scale-110'
      } flex items-center justify-center transition-transform duration-150 pointer-events-none`;

      const charSpan = document.createElement('span');
      charSpan.className = `${
        isBattle || isMacro
          ? '-rotate-45 text-[11px] font-serif font-bold'
          : 'text-[10px] font-serif font-semibold'
      } text-amber-50 select-none leading-none`;
      charSpan.textContent = isBattle ? '战' : isMacro ? '史' : '轶';
      badgeEl.appendChild(charSpan);

      btn.appendChild(haloEl);
      btn.appendChild(badgeEl);

      const shortTitle = `${evt.title.slice(0, 9)}${
        evt.title.length > 9 ? '…' : ''
      }`;
      const labelText = `${evt.time.year} ${shortTitle}`;
      const labelEl = document.createElement('div');
      labelEl.style.position = 'absolute';
      labelEl.style.pointerEvents = 'none';
      labelEl.innerHTML = `<span class="opacity-75 mr-1 tabular-nums font-semibold">${evt.time.year}</span><span>${shortTitle}</span>`;

      const record: EventMarkerRecord = {
        evt,
        marker: null as unknown as maplibregl.Marker,
        root,
        tetherSvg,
        tetherLine,
        anchorWrap,
        haloEl,
        badgeEl,
        labelEl,
        labelText,
        visible: true,
        hovered: false,
      };

      btn.addEventListener('mouseenter', () => {
        record.hovered = true;
        root.style.zIndex = '60';
        scheduleScreenLayout(false);
      });
      btn.addEventListener('mouseleave', () => {
        record.hovered = false;
        const sel = useAtlasStore.getState().selectedEventId === evt.id;
        root.style.zIndex = sel ? '44' : isMacro ? '24' : '19';
        scheduleScreenLayout(false);
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        useAtlasStore.getState().selectEvent(evt.id, true);
      });

      anchorWrap.appendChild(btn);
      anchorWrap.appendChild(labelEl);
      root.appendChild(anchorWrap);

      const marker = new maplibregl.Marker({
        element: root,
        anchor: 'top-left',
      })
        .setLngLat(evt.location.coordinates)
        .addTo(map);

      record.marker = marker;
      eventMarkerMapRef.current.set(evt.id, record);
    }
  };

  const syncEventMarkersAppearance = (
    currentTheme: MapVisualTheme,
    selectedId: string | null,
    year: number,
    bucket: 'far' | 'mid' | 'close',
    macroVis: boolean,
    allMicroVis: boolean,
    inCampaign: boolean,
    causalIds: Set<string>
  ) => {
    const showMicro = allMicroVis || bucket !== 'far';

    eventMarkerMapRef.current.forEach((rec) => {
      const { evt, root, haloEl, badgeEl, labelEl } = rec;
      const isMacro = evt.tier === 'macro';
      const isBattle = Boolean(evt.campaignId);
      const isCausal = causalIds.has(evt.id);

      const visible =
        !inCampaign &&
        ((isMacro && macroVis) || (!isMacro && (showMicro || isCausal)));
      rec.visible = visible;
      root.style.display = visible ? 'block' : 'none';
      if (!visible) return;

      const isSelected = evt.id === selectedId;
      const isNearYear = Math.abs(evt.time.year - year) <= 8;
      if (!rec.hovered) {
        root.style.zIndex = isSelected
          ? '44'
          : isCausal
          ? '32'
          : isMacro
          ? '24'
          : '19';
      }

      const badgeBg = isSelected
        ? '#8E1912'
        : isBattle
        ? '#B83B2A'
        : isMacro
        ? '#9F3526'
        : '#B76E1D';

      badgeEl.style.background = badgeBg;
      badgeEl.style.borderColor = isSelected
        ? '#FDE68A'
        : isCausal
        ? '#FBBF24'
        : 'rgba(253, 230, 138, 0.78)';
      badgeEl.style.opacity =
        isSelected || isCausal || isNearYear ? '1' : '0.68';

      if (isSelected || isCausal) {
        haloEl.style.display = 'block';
        haloEl.style.borderColor = isSelected ? '#F59E0B' : '#D97706';
        haloEl.style.boxShadow = isSelected
          ? '0 0 12px rgba(217, 119, 6, 0.55)'
          : 'none';
      } else {
        haloEl.style.display = 'none';
      }

      labelEl.className = `px-2 py-0.5 rounded-md shadow-sm border text-[11px] font-serif whitespace-nowrap select-none ${
        isSelected
          ? 'bg-[#8E1912] text-amber-50 border-amber-300 font-bold shadow-md'
          : isCausal
          ? currentTheme === 'xuanmo'
            ? 'bg-amber-950/95 text-amber-200 border-amber-500/60 font-semibold'
            : 'bg-[#FFF8E7] text-amber-950 border-amber-600/50 font-semibold'
          : currentTheme === 'xuanmo'
          ? 'bg-slate-900/95 text-amber-50/95 border-slate-700'
          : 'bg-[#FCF8EE]/96 text-stone-900 border-amber-900/25'
      }`;
    });

    scheduleScreenLayout(false);
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
          ? Math.min(44, initialPose.pitch ?? SITE_CONFIG.defaultCamera.pitch)
          : 0,
      bearing: 0,
      pixelRatio: getTargetPixelRatio(initState.perfMode),
      maxTileCacheSize: initState.perfMode === 'eco' ? 48 : 96,
      maxPitch: 54,
      minZoom: 3.2,
      maxZoom: 13.0,
      fadeDuration: 160,
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

    const onManualInput = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      const st = useAtlasStore.getState();
      if (st.activeCampaignId) userInteractedInPhaseRef.current = true;
    };
    map.on('mousedown', onManualInput);
    map.on('touchstart', onManualInput);
    map.on('wheel', onManualInput);

    // Interactive Territory Hover Highlight (Throttled to 50ms -> near-zero CPU!)
    let lastHoverMs = 0;
    map.on('mousemove', (e) => {
      const now = performance.now();
      if (now - lastHoverMs < 55 || !styleReadyRef.current) return;
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
      scheduleScreenLayout(false);
    };

    map.on('move', () => scheduleScreenLayout(true));
    map.on('moveend', () => scheduleScreenLayout(false));
    map.on('zoomend', updateZoomBucket);
    map.on('resize', () => scheduleScreenLayout(false));

    map.on('load', () => {
      styleReadyRef.current = true;
      syncAllMapSourcesAndLayers();
      mountPersistentEventMarkers(map);
      const st = useAtlasStore.getState();
      syncEventMarkersAppearance(
        st.theme,
        st.selectedEventId,
        st.currentYear,
        map.getZoom() >= 6.6 ? 'close' : map.getZoom() >= 5.6 ? 'mid' : 'far',
        st.layers.macroEvents,
        st.layers.showAllMicroEvents,
        Boolean(st.activeCampaignId),
        causalLinkedSetRef.current
      );
      updateZoomBucket();
      scheduleScreenLayout(false);
      startDirectorLoopRef.current();
    });

    // ON-DEMAND Director Loop: Automatically sleeps (0% CPU/GPU) whenever idle!
    const shouldKeepRunning = (): boolean => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      const st = useAtlasStore.getState();
      const routeCount = activeCurvesRef.current.length;
      const growTotalMs = getRouteGrowDurationMs(routeCount) / st.campaignSpeed;
      const campaignWipePending =
        campaignHasWipeRef.current &&
        campaignWipeElapsedMsRef.current < CAMPAIGN_WIPE_DURATION_MS;
      const campaignNeedsFrames =
        Boolean(st.activeCampaignId) &&
        routeCount > 0 &&
        (st.isCampaignPlaying ||
          routeGrowElapsedMsRef.current < growTotalMs ||
          campaignWipePending);
      const tourNeedsFrames = !st.activeCampaignId && st.isStoryTourPlaying;
      const eraWipeNeedsFrames = eraWipeRef.current !== null;
      return campaignNeedsFrames || tourNeedsFrames || eraWipeNeedsFrames;
    };

    const tick = (now: number) => {
      if (!shouldKeepRunning()) {
        animFrameRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }

      const prevNow = lastFrameTimeRef.current ?? now;
      const dt = Math.min(80, Math.max(0, now - prevNow));
      lastFrameTimeRef.current = now;

      const store = useAtlasStore.getState();
      const currentMap = mapRef.current;
      const minWebglInterval = store.perfMode === 'ultra' ? 24 : 34;

      // --- MODE C: Era-to-Era Victory Brush Paint-Over (2.05s smooth sweep, then sleeps!) ---
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
        } else if (now - lastEraWipePushMsRef.current >= 42) {
          lastEraWipePushMsRef.current = now;
          const overlay = buildEraWipeOverlayGeoJSON(
            wipe.toId,
            wipe.plan,
            rawWipe
          );
          updateTerritoryWipeOnMap(currentMap, overlay);
        }
      }

      // --- MODE A: Active Battlefield Campaign Replay (Strict ①->②->③ Order + Victory Wipe!) ---
      if (
        currentMap &&
        styleReadyRef.current &&
        store.activeCampaignId &&
        activeCurvesRef.current.length > 0
      ) {
        const speed = store.campaignSpeed;
        const curves = activeCurvesRef.current;
        const growTotalMs = getRouteGrowDurationMs(curves.length) / speed;
        const phaseTotalMs =
          getPhaseTotalDurationMs(curves.length, campaignHasWipeRef.current) /
          speed;

        routeGrowElapsedMsRef.current = Math.min(
          growTotalMs,
          routeGrowElapsedMsRef.current + dt
        );
        const rawGrow = Math.min(
          1,
          routeGrowElapsedMsRef.current / growTotalMs
        );
        const pulseProgress = (now % 3400) / 3400;

        // Reveal numbered route callout pills (`①`, `②`, `③`) strictly as each arrow starts!
        let calloutVisibilityChanged = false;
        for (const co of campaignCalloutsRef.current) {
          const shouldShow = rawGrow >= co.startAt - 0.005;
          const curHidden = co.root.style.display === 'none';
          if (shouldShow && curHidden) {
            co.root.style.display = 'block';
            calloutVisibilityChanged = true;
          }
        }
        if (calloutVisibilityChanged) {
          scheduleScreenLayout(false);
        }

        // Progressive Victory Territory Paint-Over once attacking arrows strike (>= 62% of route progression)
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
            now - lastCampaignWipePushMsRef.current >= 44 ||
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

        // Throttle GeoJSONSource updates to ~30fps, and freeze line geometry once grown!
        if (now - lastWebglFrameMsRef.current >= minWebglInterval) {
          lastWebglFrameMsRef.current = now;
          const justFinished = rawGrow >= 0.999 && !routeGrowFinishedRef.current;
          const skipLineUpdate = routeGrowFinishedRef.current && !justFinished;
          if (justFinished) routeGrowFinishedRef.current = true;

          if (!(store.perfMode === 'eco' && skipLineUpdate)) {
            updateCampaignAnimationFrame(
              currentMap,
              curves,
              rawGrow,
              pulseProgress,
              skipLineUpdate
            );
          }
        }

        if (store.isCampaignPlaying) {
          phaseElapsedMsRef.current += dt;
          const pct = Math.min(
            100,
            (phaseElapsedMsRef.current / phaseTotalMs) * 100
          );

          if (now - lastProgressReportMsRef.current > 85) {
            lastProgressReportMsRef.current = now;
            store.setCampaignPhaseProgress(pct);
          }

          // Steady North-Up Follow Camera (ZERO circular spinning / "转圈圈"!)
          if (
            store.perfMode !== 'eco' &&
            phaseElapsedMsRef.current >= OPENING_FLY_DURATION_MS &&
            !userInteractedInPhaseRef.current &&
            store.campaignCameraMode === 'follow' &&
            activePhaseRef.current
          ) {
            const phase = activePhaseRef.current;
            // Find the currently advancing sequential arrow `k`
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
              const basePitch = Math.min(44, phase.camera.pitch ?? 40);
              currentMap.jumpTo({
                center: [
                  vanguardPt[0] * 0.42 + phase.camera.center[0] * 0.58,
                  vanguardPt[1] * 0.42 + phase.camera.center[1] * 0.58,
                ],
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

      // --- MODE B: Chronological Full-History Story Tour (Rock-Steady View, ZERO Spinning!) ---
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
        if (now - lastProgressReportMsRef.current > 85) {
          lastProgressReportMsRef.current = now;
          store.setStoryTourProgress(pct);
        }

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
    document.addEventListener('visibilitychange', onVisibilityChange);

    mapRef.current = map;

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
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

  // Wake up on-demand RAF loop whenever tour or campaign state activates!
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
      styleReadyRef.current = false;
      map.setStyle(createHistoricalBaseStyle(theme, is3D, perfMode));
      map.once('styledata', () => {
        styleReadyRef.current = true;
        syncAllMapSourcesAndLayers();
        scheduleScreenLayout(false);
        startDirectorLoopRef.current();
      });
      return;
    }

    if (prev3DRef.current !== is3D) {
      prev3DRef.current = is3D;
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

  // 3. Instant GPU Switch for Ancient/Modern Place Name Mode (0 DOM churn!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    setPlaceNameModeOnGpu(map, placeNameMode);
  }, [placeNameMode]);

  // 4. Sync WebGL Territory Polygons, Causal Arcs, Visibility & Campaign Curves
  useEffect(() => {
    syncAllMapSourcesAndLayers();
    scheduleScreenLayout(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSnapshot,
    layers,
    activeCampaignId,
    activePhaseIndex,
    selectedEventId,
  ]);

  // 5. Reset Story Tour Clock on Event Change
  useEffect(() => {
    storyElapsedMsRef.current = 0;
    startDirectorLoopRef.current();
  }, [selectedEventId, storyTourNonce, isStoryTourPlaying]);

  // 6. Campaign Phase Opening Camera & Route Growth Reset
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCampaign || !activePhase) return;

    phaseElapsedMsRef.current = 0;
    routeGrowElapsedMsRef.current = 0;
    routeGrowFinishedRef.current = false;
    campaignWipeElapsedMsRef.current = 0;
    userInteractedInPhaseRef.current = false;

    const { preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    activeCurvesRef.current = preparedCurves;
    const firstCurve = preparedCurves[0];
    const startCenter: LngLat =
      campaignCameraMode === 'follow' && firstCurve
        ? [
            firstCurve.startPoint[0] * 0.42 + activePhase.camera.center[0] * 0.58,
            firstCurve.startPoint[1] * 0.42 + activePhase.camera.center[1] * 0.58,
          ]
        : activePhase.camera.center;

    const use3D = is3D && perfMode !== 'eco';
    map.flyTo({
      center: startCenter,
      zoom: activePhase.camera.zoom,
      pitch: use3D ? Math.min(44, activePhase.camera.pitch ?? 40) : 0,
      bearing: 0,
      duration: OPENING_FLY_DURATION_MS,
      essential: true,
    });

    startDirectorLoopRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, activePhaseIndex, campaignReplayNonce]);

  useEffect(() => {
    if (isCampaignPlaying) {
      userInteractedInPhaseRef.current = false;
      startDirectorLoopRef.current();
    }
  }, [isCampaignPlaying]);

  // 7. Execute Declarative Camera FlyTo Commands (Steady North-Up `bearing: 0`)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) return;
    const { pose } = cameraCommand;
    const use3D = is3D && perfMode !== 'eco';
    map.flyTo({
      center: pose.center,
      zoom: pose.zoom,
      pitch: use3D ? Math.min(44, pose.pitch ?? 38) : 0,
      bearing: pose.bearing ?? 0,
      duration: 1150,
      essential: true,
    });
  }, [cameraCommand, is3D, perfMode]);

  // 8. Sync Event Medallions Appearance In-Place
  useEffect(() => {
    syncEventMarkersAppearance(
      theme,
      selectedEventId,
      currentYear,
      zoomBucket,
      layers.macroEvents,
      layers.showAllMicroEvents,
      Boolean(activeCampaign),
      causalLinkedSet
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCampaign,
    causalLinkedSet,
    currentYear,
    layers.macroEvents,
    layers.showAllMicroEvents,
    selectedEventId,
    theme,
    zoomBucket,
  ]);

  // 9. Render Active Campaign Shockwaves & Tactical Callouts (Zero `animate-ping`!)
  useEffect(() => {
    const map = mapRef.current;
    campaignCalloutsRef.current.forEach((r) => r.marker.remove());
    campaignCalloutsRef.current = [];
    campaignShockwavesRef.current.forEach((r) => r.marker.remove());
    campaignShockwavesRef.current = [];

    if (!map || !activeCampaign || !activePhase) {
      scheduleScreenLayout(false);
      return;
    }

    const { preparedCurves } = buildPhaseRouteFeatures(
      activeCampaign,
      activePhase
    );
    for (const curve of preparedCurves) {
      const root = createImmutableMarkerRoot('28');
      root.style.pointerEvents = 'none';
      // Hide callouts for Step ②, ③ until their sequential arrow turn arrives!
      root.style.display = curve.stepNo === 1 ? 'block' : 'none';
      const stepSymbol =
        CIRCLED_STEPS[curve.stepNo - 1] ?? `(${curve.stepNo})`;
      const tacticBadge =
        curve.tactic === 'ambush'
          ? `${stepSymbol} 奇袭`
          : curve.tactic === 'naval'
          ? `${stepSymbol} 水师`
          : curve.tactic === 'retreat'
          ? `${stepSymbol} 败退`
          : curve.tactic === 'supply'
          ? `${stepSymbol} 粮道`
          : `${stepSymbol} 主力`;

      const wrapEl = document.createElement('div');
      wrapEl.style.position = 'absolute';
      wrapEl.style.left = '0px';
      wrapEl.style.top = '0px';
      wrapEl.style.transform = 'translate(-50%, -50%)';
      wrapEl.style.borderColor = curve.color;
      wrapEl.className = `px-2 py-0.5 rounded-full border shadow-md text-[11px] font-serif font-medium flex items-center gap-1 whitespace-nowrap select-none ${
        theme === 'xuanmo'
          ? 'bg-slate-950/95 text-amber-50'
          : 'bg-[#FFFDF8]/97 text-stone-900'
      }`;
      wrapEl.innerHTML = `
        <span style="background:${curve.color}" class="px-1.5 py-0.2 rounded-full text-[10px] text-white font-sans font-bold">${tacticBadge}</span>
        <span>${curve.label}</span>
      `;
      root.appendChild(wrapEl);

      const m = new maplibregl.Marker({ element: root, anchor: 'top-left' })
        .setLngLat(curve.midPoint)
        .addTo(map);

      campaignCalloutsRef.current.push({
        coord: curve.midPoint,
        stepNo: curve.stepNo,
        startAt: curve.startAt,
        root,
        marker: m,
        wrapEl,
        widthPx: estimateLabelWidthPx(`${tacticBadge}${curve.label}`, 11, 32),
        heightPx: 24,
      });
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

      const iconWrap = document.createElement('div');
      iconWrap.style.position = 'absolute';
      iconWrap.style.left = '0px';
      iconWrap.style.top = '0px';
      iconWrap.style.transform = 'translate(-50%, -50%)';
      iconWrap.className = 'flex items-center justify-center select-none';
      iconWrap.innerHTML = `
        <span style="border-color:${accent}" class="absolute inline-flex h-9 w-9 rounded-full border-2 opacity-60"></span>
        <div style="background:${accent}" class="relative w-7 h-7 rounded-full border-2 border-amber-200 shadow-lg flex items-center justify-center text-white font-serif font-bold text-xs">
          ${iconChar}
        </div>
      `;

      const labelEl = document.createElement('div');
      labelEl.style.position = 'absolute';
      labelEl.style.borderColor = accent;
      labelEl.className = `px-2.5 py-1 rounded-md shadow-lg border-l-4 text-xs select-none ${
        theme === 'xuanmo'
          ? 'bg-slate-900/96 text-amber-50'
          : 'bg-[#FCF8EE]/98 text-stone-900'
      }`;
      labelEl.innerHTML = `
        <div class="font-serif font-bold whitespace-nowrap">${bm.label}</div>
        ${
          bm.subLabel
            ? `<div class="text-[10px] opacity-80 whitespace-nowrap">${bm.subLabel}</div>`
            : ''
        }
      `;

      root.appendChild(iconWrap);
      root.appendChild(labelEl);

      const m = new maplibregl.Marker({ element: root, anchor: 'top-left' })
        .setLngLat(bm.coordinates)
        .addTo(map);

      const maxChars = Math.max(bm.label.length, (bm.subLabel ?? '').length);
      campaignShockwavesRef.current.push({
        coord: bm.coordinates,
        marker: m,
        labelEl,
        widthPx: maxChars * 12 + 24,
        heightPx: bm.subLabel ? 36 : 24,
      });
    }

    scheduleScreenLayout(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, activePhaseIndex, theme]);

  // Re-run label safe-zone layout when side panels open/close
  const isDirectoryOpen = useAtlasStore((s) => s.isDirectoryOpen);
  const isDrawerOpen = useAtlasStore((s) => s.isDrawerOpen);
  useEffect(() => {
    scheduleScreenLayout(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirectoryOpen, isDrawerOpen]);

  return (
    <div className="relative z-0 w-full h-full overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="《明途 · 舆图纪》三维交互式历史地图主画布"
      />
      {/* Subtle Classical Scroll Vignette Frame (Pure CSS linear/radial gradient, 0 GPU blur cost!) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          boxShadow:
            theme === 'xuanmo'
              ? 'inset 0 0 70px rgba(3, 6, 12, 0.55)'
              : 'inset 0 0 65px rgba(92, 70, 40, 0.16)',
        }}
      />
    </div>
  );
}
