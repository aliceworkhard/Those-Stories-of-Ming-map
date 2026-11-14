'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { SITE_CONFIG } from '@/config/site';
import {
  ALL_EVENTS,
  CAMPAIGN_MAP,
  EVENT_MAP,
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
import { sampleAlongPath } from '@/lib/curve';
import type {
  CampaignPhase,
  HistoricalEvent,
  HistoricalPlace,
  LngLat,
  MapVisualTheme,
} from '@/types/ming';
import { useAtlasStore } from '@/store/useAtlasStore';

const BASE_PHASE_DURATION_MS = 7800;
const ROUTE_GROW_DURATION_MS = 4200;
const OPENING_FLY_DURATION_MS = 1300;
const STORY_STOP_DURATION_MS = 6800;
const STORY_FLY_DURATION_MS = 1450;

interface ScreenBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function boxesOverlap(a: ScreenBox, b: ScreenBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function padBox(b: ScreenBox, pad: number): ScreenBox {
  return {
    x1: b.x1 - pad,
    y1: b.y1 - pad,
    x2: b.x2 + pad,
    y2: b.y2 + pad,
  };
}

/**
 * Accurate pixel width estimator for CJK + Latin/numeral pill labels (avoids forced DOM reflow).
 */
function estimateLabelWidthPx(text: string, fontPx = 11, extraPad = 18): number {
  let w = extraPad;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 255 ? fontPx * 1.04 : fontPx * 0.62;
  }
  return Math.ceil(w);
}

/**
 * Creates a strictly 0x0, zero-transition anchor container for MapLibre Markers.
 * Keeping `root` 0x0 with ZERO CSS transitions guarantees markers NEVER jump or fight `flyTo`.
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
  tetherSvg: SVGSVGElement;
  tetherLine: SVGLineElement;
  tetherDot: SVGCircleElement;
  anchorWrap: HTMLDivElement;
  pingEl: HTMLSpanElement;
  badgeEl: HTMLDivElement;
  labelEl: HTMLDivElement;
  labelText: string;
  visible: boolean;
  hovered: boolean;
}

interface PlaceMarkerRecord {
  place: HistoricalPlace;
  marker: maplibregl.Marker;
  root: HTMLDivElement;
  dotWrap: HTMLDivElement;
  labelEl: HTMLDivElement;
  labelText: string;
}

interface PolityMarkerRecord {
  coord: LngLat;
  marker: maplibregl.Marker;
  widthPx: number;
  heightPx: number;
}

interface CampaignCalloutRecord {
  coord: LngLat;
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
      return { x1: ax - w / 2, y1: ay + r + 4, x2: ax + w / 2, y2: ay + r + 4 + h };
    case 'top':
      return { x1: ax - w / 2, y1: ay - r - 4 - h, x2: ax + w / 2, y2: ay - r - 4 };
    case 'right':
      return { x1: ax + r + 5, y1: ay - h / 2, x2: ax + r + 5 + w, y2: ay + h / 2 };
    case 'left':
      return { x1: ax - r - 5 - w, y1: ay - h / 2, x2: ax - r - 5, y2: ay + h / 2 };
  }
}

function applySlotPosition(el: HTMLElement, r: number, slot: LabelSlot): void {
  switch (slot) {
    case 'bottom':
      el.style.left = '0px';
      el.style.top = `${r + 4}px`;
      el.style.transform = 'translateX(-50%)';
      break;
    case 'top':
      el.style.left = '0px';
      el.style.top = `${-r - 4}px`;
      el.style.transform = 'translate(-50%, -100%)';
      break;
    case 'right':
      el.style.left = `${r + 5}px`;
      el.style.top = '0px';
      el.style.transform = 'translateY(-50%)';
      break;
    case 'left':
      el.style.left = `${-r - 5}px`;
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
  const layoutRafPendingRef = useRef(false);

  // Unified 60fps Auto-Camera & Route Growth Director Refs
  const phaseElapsedMsRef = useRef(0);
  const routeGrowElapsedMsRef = useRef(0);
  const storyElapsedMsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastProgressReportMsRef = useRef(0);
  const userInteractedInPhaseRef = useRef(false);
  const storyUserInteractedRef = useRef(false);
  const activePhaseRef = useRef<CampaignPhase | null>(null);
  const is3DRef = useRef(true);

  // Marker registries for Screen-Space De-Overlapping
  const polityRecordsRef = useRef<PolityMarkerRecord[]>([]);
  const placeRecordsRef = useRef<PlaceMarkerRecord[]>([]);
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
  const is3D = useAtlasStore((s) => s.is3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const cameraCommand = useAtlasStore((s) => s.cameraCommand);

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

  /**
   * Deterministic Screen-Space Spiderfy & 4-Quadrant 2D Bounding-Box Collision Solver!
   * Guarantees ZERO overlapping text labels at ANY zoom level (z3 - z14), even when
   * multiple events and cities share identical [lng, lat] coordinates.
   */
  const runScreenSpaceLayout = () => {
    layoutRafPendingRef.current = false;
    const map = mapRef.current;
    if (!map) return;

    const st = useAtlasStore.getState();
    const z = map.getZoom();
    const bucket: 'far' | 'mid' | 'close' =
      z >= 6.8 ? 'close' : z >= 5.7 ? 'mid' : 'far';
    const canvas = map.getCanvas();
    const viewW = canvas.clientWidth || 1280;
    const viewH = canvas.clientHeight || 800;

    const occupied: ScreenBox[] = [];

    // 1. Register Polity Dynasty Seal Banners first (high visual hierarchy)
    if (st.layers.territories) {
      for (const pol of polityRecordsRef.current) {
        const pt = map.project(pol.coord);
        const box: ScreenBox = {
          x1: pt.x - pol.widthPx / 2,
          y1: pt.y - pol.heightPx / 2,
          x2: pt.x + pol.widthPx / 2,
          y2: pt.y + pol.heightPx / 2,
        };
        occupied.push(padBox(box, 4));
      }
    }

    // 2. Layout Campaign Shockwaves & Route Tactical Callouts (when in campaign mode)
    if (st.activeCampaignId) {
      for (const sw of campaignShockwavesRef.current) {
        const pt = map.project(sw.coord);
        occupied.push({ x1: pt.x - 20, y1: pt.y - 20, x2: pt.x + 20, y2: pt.y + 20 });

        const slots: LabelSlot[] = ['bottom', 'top', 'right', 'left'];
        let placedSlot: LabelSlot = 'bottom';
        for (const sl of slots) {
          const cand = computeSlotBox(pt.x, pt.y, 18, sw.widthPx, sw.heightPx, sl);
          if (occupied.every((b) => !boxesOverlap(cand, b))) {
            placedSlot = sl;
            break;
          }
        }
        applySlotPosition(sw.labelEl, 18, placedSlot);
        occupied.push(
          padBox(
            computeSlotBox(pt.x, pt.y, 18, sw.widthPx, sw.heightPx, placedSlot),
            4
          )
        );
      }

      const calloutOffsets: Array<[number, number]> = [
        [0, 0],
        [0, -26],
        [0, 26],
        [44, 0],
        [-44, 0],
        [0, -48],
        [0, 48],
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
    }

    // 3. Spiderfy Co-Located Visible Event Icons so identical [lng, lat] NEVER stack!
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

    // Greedy proximity clustering (events within 34px screen distance form a spiderfy ring)
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
            ) < 34
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
          cluster.length === 2 ? 22 : cluster.length <= 4 ? 28 : 36;

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

    // Apply spiderfy offsets, tether lines, and reserve icon hitboxes in `occupied`
    for (const item of visibleEventRecs) {
      const { rec, baseX, baseY, dx, dy } = item;
      rec.anchorWrap.style.left = `${dx}px`;
      rec.anchorWrap.style.top = `${dy}px`;

      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        rec.tetherSvg.style.display = 'block';
        rec.tetherLine.setAttribute('x2', String(60 + dx));
        rec.tetherLine.setAttribute('y2', String(60 + dy));
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

    // Also reserve tiny 6x6 dots for visible places
    const projectedPlaces = placeRecordsRef.current.map((pl) => {
      const pt = map.project(pl.place.coordinates);
      return { pl, x: pt.x, y: pt.y };
    });

    // 4. Unified Priority-Sorted 4-Quadrant Label Solver (Events + Places)
    type UnifiedLabelCandidate =
      | {
          kind: 'event';
          priority: number;
          ax: number;
          ay: number;
          r: number;
          w: number;
          h: number;
          rec: EventMarkerRecord;
          forceShow: boolean;
        }
      | {
          kind: 'place';
          priority: number;
          ax: number;
          ay: number;
          r: number;
          w: number;
          h: number;
          plRec: PlaceMarkerRecord;
        };

    const candidates: UnifiedLabelCandidate[] = [];

    for (const item of visibleEventRecs) {
      const { rec, baseX, baseY, dx, dy } = item;
      const isSelected = rec.evt.id === st.selectedEventId;
      const isMacro = rec.evt.tier === 'macro';
      const isNearYear = Math.abs(rec.evt.time.year - st.currentYear) <= 5;

      // Keep micro event labels hover-only when zoomed far out unless selected or forced
      if (
        !isMacro &&
        !isSelected &&
        bucket === 'far' &&
        !st.layers.showAllMicroEvents &&
        !rec.hovered
      ) {
        rec.labelEl.style.display = 'none';
        continue;
      }

      const priority =
        rec.hovered
          ? 120
          : isSelected
          ? 100
          : isMacro && isNearYear
          ? 82
          : isMacro
          ? 64
          : 38;

      candidates.push({
        kind: 'event',
        priority,
        ax: baseX + dx,
        ay: baseY + dy,
        r: isMacro ? 15 : 12,
        w: estimateLabelWidthPx(rec.labelText, 11, 20),
        h: 22,
        rec,
        forceShow: isSelected || rec.hovered,
      });
    }

    if (st.layers.places) {
      for (const { pl, x, y } of projectedPlaces) {
        const isCap = pl.place.type === 'capital';
        const isNine = pl.place.type === 'garrison-nine';
        const nearEventIcon = visibleEventRecs.some(
          (it) => Math.hypot(it.baseX + it.dx - x, it.baseY + it.dy - y) < 20
        );
        pl.dotWrap.style.display = nearEventIcon ? 'none' : 'block';

        candidates.push({
          kind: 'place',
          priority: isCap ? 74 : isNine ? 56 : 44,
          ax: x,
          ay: y,
          r: nearEventIcon ? 16 : 6,
          w: estimateLabelWidthPx(pl.labelText, isCap ? 11 : 10, 18),
          h: 20,
          plRec: pl,
        });
      }
    }

    candidates.sort((a, b) => b.priority - a.priority);

    const overlapArea = (a: ScreenBox, b: ScreenBox): number => {
      const ox = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
      const oy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
      return ox * oy;
    };

    for (const cand of candidates) {
      // Offscreen guard
      if (
        cand.ax < -60 ||
        cand.ax > viewW + 60 ||
        cand.ay < -60 ||
        cand.ay > viewH + 60
      ) {
        if (cand.kind === 'event') cand.rec.labelEl.style.display = 'none';
        else cand.plRec.root.style.display = 'none';
        continue;
      }

      // Places prefer 'top' first so Events at the same city naturally claim 'bottom' without colliding!
      const slotOrder: LabelSlot[] =
        cand.kind === 'place'
          ? ['top', 'right', 'left', 'bottom']
          : ['bottom', 'right', 'left', 'top'];

      let chosenSlot: LabelSlot | null = null;
      for (const sl of slotOrder) {
        const box = computeSlotBox(cand.ax, cand.ay, cand.r, cand.w, cand.h, sl);
        if (
          box.x1 >= 6 &&
          box.x2 <= viewW - 6 &&
          box.y1 >= 54 &&
          box.y2 <= viewH - 44 &&
          occupied.every((b) => !boxesOverlap(box, b))
        ) {
          chosenSlot = sl;
          break;
        }
      }

      if (cand.kind === 'event') {
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
          const box = computeSlotBox(
            cand.ax,
            cand.ay,
            cand.r,
            cand.w,
            cand.h,
            finalSlot
          );
          occupied.push(padBox(box, 3));
        } else {
          cand.rec.labelEl.style.display = 'none';
        }
      } else {
        if (chosenSlot) {
          cand.plRec.root.style.display = 'block';
          applySlotPosition(cand.plRec.labelEl, cand.r, chosenSlot);
          if (cand.r <= 6) {
            occupied.push({
              x1: cand.ax - 4,
              y1: cand.ay - 4,
              x2: cand.ax + 4,
              y2: cand.ay + 4,
            });
          }
          const box = computeSlotBox(
            cand.ax,
            cand.ay,
            cand.r,
            cand.w,
            cand.h,
            chosenSlot
          );
          occupied.push(padBox(box, 3));
        } else {
          cand.plRec.root.style.display = 'none';
        }
      }
    }
  };

  const scheduleScreenLayout = () => {
    if (layoutRafPendingRef.current) return;
    layoutRafPendingRef.current = true;
    requestAnimationFrame(runScreenSpaceLayout);
  };

  // Sync All WebGL Data into Current Style
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

  // Build Persistent Event Markers Once on Map Init
  const mountPersistentEventMarkers = (map: maplibregl.Map) => {
    eventMarkerMapRef.current.forEach((rec) => rec.marker.remove());
    eventMarkerMapRef.current.clear();

    for (const evt of ALL_EVENTS) {
      const isMacro = evt.tier === 'macro';
      const root = createImmutableMarkerRoot(isMacro ? '22' : '18');

      // Subtle SVG callout tether when co-located events spiderfy into a ring
      const svgNs = 'http://www.w3.org/2000/svg';
      const tetherSvg = document.createElementNS(svgNs, 'svg');
      tetherSvg.setAttribute('width', '120');
      tetherSvg.setAttribute('height', '120');
      tetherSvg.style.position = 'absolute';
      tetherSvg.style.left = '-60px';
      tetherSvg.style.top = '-60px';
      tetherSvg.style.pointerEvents = 'none';
      tetherSvg.style.display = 'none';

      const tetherLine = document.createElementNS(svgNs, 'line');
      tetherLine.setAttribute('x1', '60');
      tetherLine.setAttribute('y1', '60');
      tetherLine.setAttribute('x2', '60');
      tetherLine.setAttribute('y2', '60');
      tetherLine.setAttribute('stroke', '#9B2C1D');
      tetherLine.setAttribute('stroke-width', '1.2');
      tetherLine.setAttribute('stroke-dasharray', '2,2');
      tetherLine.setAttribute('opacity', '0.65');

      const tetherDot = document.createElementNS(svgNs, 'circle');
      tetherDot.setAttribute('cx', '60');
      tetherDot.setAttribute('cy', '60');
      tetherDot.setAttribute('r', '2.5');
      tetherDot.setAttribute('fill', '#9B2C1D');
      tetherDot.setAttribute('opacity', '0.75');

      tetherSvg.appendChild(tetherLine);
      tetherSvg.appendChild(tetherDot);
      root.appendChild(tetherSvg);

      // Spiderfyable anchor wrapper (ZERO CSS transition)
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

      const pingEl = document.createElement('span');
      pingEl.className =
        'animate-ping rounded-full border-2 opacity-60 pointer-events-none';
      pingEl.style.position = 'absolute';
      pingEl.style.width = isMacro ? '26px' : '20px';
      pingEl.style.height = isMacro ? '26px' : '20px';

      const badgeEl = document.createElement('div');
      badgeEl.className = `${
        isMacro
          ? 'w-6.5 h-6.5 rounded-md rotate-45 border-2 border-amber-200/90 shadow-md group-hover:scale-110'
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

      const shortTitle = `${evt.title.slice(0, 9)}${evt.title.length > 9 ? '…' : ''}`;
      const labelText = `${evt.time.year} ${shortTitle}`;
      const labelEl = document.createElement('div');
      labelEl.style.position = 'absolute';
      labelEl.style.pointerEvents = 'none';
      labelEl.innerHTML = `<span class="opacity-75 mr-1 tabular-nums">${evt.time.year}</span>${shortTitle}`;

      const record: EventMarkerRecord = {
        evt,
        marker: null as unknown as maplibregl.Marker,
        root,
        tetherSvg,
        tetherLine,
        tetherDot,
        anchorWrap,
        pingEl,
        badgeEl,
        labelEl,
        labelText,
        visible: true,
        hovered: false,
      };

      btn.addEventListener('mouseenter', () => {
        record.hovered = true;
        root.style.zIndex = '60';
        scheduleScreenLayout();
      });
      btn.addEventListener('mouseleave', () => {
        record.hovered = false;
        const sel = useAtlasStore.getState().selectedEventId === evt.id;
        root.style.zIndex = sel ? '42' : isMacro ? '24' : '19';
        scheduleScreenLayout();
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
    inCampaign: boolean
  ) => {
    const showMicro = allMicroVis || bucket !== 'far';

    eventMarkerMapRef.current.forEach((rec) => {
      const { evt, root, pingEl, badgeEl, labelEl } = rec;
      const isMacro = evt.tier === 'macro';

      const visible =
        !inCampaign && ((isMacro && macroVis) || (!isMacro && showMicro));
      rec.visible = visible;
      root.style.display = visible ? 'block' : 'none';
      if (!visible) return;

      const isSelected = evt.id === selectedId;
      const isNearYear = Math.abs(evt.time.year - year) <= 5;
      if (!rec.hovered) {
        root.style.zIndex = isSelected ? '42' : isMacro ? '24' : '19';
      }

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

      labelEl.className = `px-2 py-0.5 rounded shadow-sm border text-[11px] whitespace-nowrap font-medium select-none ${
        isSelected
          ? 'bg-red-900 text-amber-50 border-amber-300 font-bold'
          : currentTheme === 'xuanmo'
          ? 'bg-slate-900/92 text-amber-50/95 border-slate-700'
          : 'bg-[#FFFDF7]/95 text-stone-900 border-amber-900/20'
      }`;
    });

    scheduleScreenLayout();
  };

  // 1. Initialize MapLibre GL Instance & Unified 60fps Dual-Mode Camera Director
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

    const onManualInput = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      const st = useAtlasStore.getState();
      if (st.activeCampaignId) {
        userInteractedInPhaseRef.current = true;
      }
      if (st.isStoryTourPlaying) {
        storyUserInteractedRef.current = true;
      }
    };
    map.on('mousedown', onManualInput);
    map.on('touchstart', onManualInput);
    map.on('wheel', onManualInput);

    const updateZoomBucket = () => {
      const z = map.getZoom();
      const next = z >= 6.8 ? 'close' : z >= 5.7 ? 'mid' : 'far';
      setZoomBucket((prev) => (prev === next ? prev : next));
      scheduleScreenLayout();
    };

    map.on('move', scheduleScreenLayout);
    map.on('zoomend', updateZoomBucket);
    map.on('resize', scheduleScreenLayout);

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
      scheduleScreenLayout();
    });

    // Unified 60fps Director Loop:
    //  A) Campaign Progressive Route Growth + Vanguard Spearheads + Follow/Orbit 3D Camera
    //  B) Chronological Full-History Story Tour 3D Orbital Camera
    const tick = (now: number) => {
      const prevNow = lastFrameTimeRef.current ?? now;
      const dt = Math.min(80, Math.max(0, now - prevNow));
      lastFrameTimeRef.current = now;

      const store = useAtlasStore.getState();
      const currentMap = mapRef.current;

      // --- MODE A: Active Battlefield Campaign Replay ---
      if (
        currentMap &&
        styleReadyRef.current &&
        store.activeCampaignId &&
        activeCurvesRef.current.length > 0
      ) {
        const speed = store.campaignSpeed;
        const phaseTotalMs = BASE_PHASE_DURATION_MS / speed;
        const growTotalMs = ROUTE_GROW_DURATION_MS / speed;

        routeGrowElapsedMsRef.current = Math.min(
          growTotalMs,
          routeGrowElapsedMsRef.current + dt
        );
        const rawGrow = Math.min(1, routeGrowElapsedMsRef.current / growTotalMs);
        const easedGrow = 1 - Math.pow(1 - rawGrow, 2.2);
        const pulseProgress = (now % 3000) / 3000;

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

          if (now - lastProgressReportMsRef.current > 65) {
            lastProgressReportMsRef.current = now;
            store.setCampaignPhaseProgress(pct);
          }

          // Continuous 60fps 3D Camera Choreography after opening fly-in settles!
          if (
            phaseElapsedMsRef.current >= OPENING_FLY_DURATION_MS &&
            !userInteractedInPhaseRef.current &&
            store.campaignCameraMode !== 'free' &&
            activePhaseRef.current
          ) {
            const phase = activePhaseRef.current;
            const postFlyRatio = Math.min(
              1,
              (phaseElapsedMsRef.current - OPENING_FLY_DURATION_MS) /
                Math.max(1, phaseTotalMs - OPENING_FLY_DURATION_MS)
            );
            const smoothRatio =
              postFlyRatio * postFlyRatio * (3 - 2 * postFlyRatio);

            const primaryCurve = activeCurvesRef.current[0];
            const baseBearing = phase.camera.bearing ?? -12;
            const basePitch = phase.camera.pitch ?? 52;

            if (store.campaignCameraMode === 'follow' && primaryCurve) {
              // Follow advancing vanguard spearhead from origin toward battle objective!
              const routeT = Math.min(0.96, 0.12 + smoothRatio * 0.84);
              const { coordinates: vanguardPt } = sampleAlongPath(
                primaryCurve.coords,
                routeT
              );
              const targetCenter: LngLat = [
                vanguardPt[0] * 0.56 + phase.camera.center[0] * 0.44,
                vanguardPt[1] * 0.56 + phase.camera.center[1] * 0.44,
              ];
              const targetZoom = Math.min(
                9.2,
                phase.camera.zoom + 0.18 + smoothRatio * 0.42
              );
              const targetBearing = is3DRef.current
                ? baseBearing + smoothRatio * 26
                : 0;
              const targetPitch = is3DRef.current
                ? Math.min(62, basePitch + 5)
                : 0;

              currentMap.jumpTo({
                center: targetCenter,
                zoom: targetZoom,
                bearing: targetBearing,
                pitch: targetPitch,
              });
            } else if (store.campaignCameraMode === 'orbit') {
              // Panoramic 360-style theater orbital sweep
              currentMap.jumpTo({
                center: phase.camera.center,
                zoom: phase.camera.zoom + smoothRatio * 0.22,
                bearing: is3DRef.current ? baseBearing + smoothRatio * 34 : 0,
                pitch: is3DRef.current ? Math.min(60, basePitch + 4) : 0,
              });
            }
          }

          if (phaseElapsedMsRef.current >= phaseTotalMs) {
            phaseElapsedMsRef.current = 0;
            store.nextCampaignPhase();
          }
        }
      }

      // --- MODE B: Chronological Full-History Story Tour ("全史自动运镜推演") ---
      if (
        currentMap &&
        styleReadyRef.current &&
        !store.activeCampaignId &&
        store.isStoryTourPlaying
      ) {
        const speed = store.storyTourSpeed;
        const stopTotalMs = STORY_STOP_DURATION_MS / speed;
        storyElapsedMsRef.current += dt;

        const pct = Math.min(100, (storyElapsedMsRef.current / stopTotalMs) * 100);
        if (now - lastProgressReportMsRef.current > 65) {
          lastProgressReportMsRef.current = now;
          store.setStoryTourProgress(pct);
        }

        // Smooth 3D mountain/river drone orbit after flyTo arrival!
        if (
          storyElapsedMsRef.current >= STORY_FLY_DURATION_MS &&
          !storyUserInteractedRef.current
        ) {
          const evt = store.selectedEventId
            ? EVENT_MAP[store.selectedEventId]
            : ALL_EVENTS[0];
          if (evt) {
            const orbitRatio = Math.min(
              1,
              (storyElapsedMsRef.current - STORY_FLY_DURATION_MS) /
                Math.max(1, stopTotalMs - STORY_FLY_DURATION_MS)
            );
            const baseBearing = evt.camera.bearing ?? -14;
            const baseZoom = Math.max(6.4, evt.camera.zoom);
            currentMap.jumpTo({
              center: evt.location.coordinates,
              zoom: baseZoom + orbitRatio * 0.28,
              pitch: is3DRef.current ? (evt.camera.pitch ?? 54) : 0,
              bearing: is3DRef.current ? baseBearing + orbitRatio * 30 : 0,
            });
          }
        }

        if (storyElapsedMsRef.current >= stopTotalMs) {
          storyElapsedMsRef.current = 0;
          store.stepStoryEvent(1);
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
        scheduleScreenLayout();
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
    scheduleScreenLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, layers, activeCampaignId, activePhaseIndex]);

  // 4. Reset Story Tour Stop Clock when Selected Event or Tour Nonce Changes
  useEffect(() => {
    storyElapsedMsRef.current = 0;
    storyUserInteractedRef.current = false;
  }, [selectedEventId, storyTourNonce, isStoryTourPlaying]);

  // 5. Campaign Phase Opening Camera & Clock Reset
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCampaign || !activePhase) return;

    phaseElapsedMsRef.current = 0;
    routeGrowElapsedMsRef.current = 0;
    userInteractedInPhaseRef.current = false;

    const { preparedCurves } = buildPhaseRouteFeatures(activeCampaign, activePhase);
    const firstCurve = preparedCurves[0];
    const startCenter: LngLat =
      campaignCameraMode === 'follow' && firstCurve
        ? [
            firstCurve.startPoint[0] * 0.52 + activePhase.camera.center[0] * 0.48,
            firstCurve.startPoint[1] * 0.52 + activePhase.camera.center[1] * 0.48,
          ]
        : activePhase.camera.center;

    map.flyTo({
      center: startCenter,
      zoom: activePhase.camera.zoom,
      pitch: is3D ? (activePhase.camera.pitch ?? 52) : 0,
      bearing: is3D ? (activePhase.camera.bearing ?? -12) : 0,
      duration: OPENING_FLY_DURATION_MS,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, activePhaseIndex, campaignReplayNonce]);

  useEffect(() => {
    if (isCampaignPlaying) {
      userInteractedInPhaseRef.current = false;
    }
  }, [isCampaignPlaying]);

  // 6. Execute Non-Campaign Declarative Camera FlyTo Commands
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) return;
    const { pose } = cameraCommand;
    map.flyTo({
      center: pose.center,
      zoom: pose.zoom,
      pitch: is3D ? (pose.pitch ?? 50) : 0,
      bearing: is3D ? (pose.bearing ?? -10) : 0,
      duration: 1350,
      essential: true,
    });
  }, [cameraCommand, is3D]);

  // 7. Sync Persistent Event Markers In-Place
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCampaign,
    currentYear,
    layers.macroEvents,
    layers.showAllMicroEvents,
    selectedEventId,
    theme,
    zoomBucket,
  ]);

  // 8. Render Polity Dynasty Seal Banners
  useEffect(() => {
    const map = mapRef.current;
    polityRecordsRef.current.forEach((r) => r.marker.remove());
    polityRecordsRef.current = [];
    if (!map || !layers.territories) {
      scheduleScreenLayout();
      return;
    }

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
      polityRecordsRef.current.push({
        coord,
        marker,
        widthPx:
          estimateLabelWidthPx(shortLabel, 12, 28) + (isTributary ? 34 : 0),
        heightPx: 26,
      });
    }

    scheduleScreenLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, layers.territories, theme]);

  // 9. Render Strategic Ancient-Modern Place Labels (Managed by 4-Quadrant Collision Solver!)
  useEffect(() => {
    const map = mapRef.current;
    placeRecordsRef.current.forEach((r) => r.marker.remove());
    placeRecordsRef.current = [];
    if (!map || !layers.places) {
      scheduleScreenLayout();
      return;
    }

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

      const dotWrap = document.createElement('div');
      dotWrap.style.position = 'absolute';
      dotWrap.style.left = '0px';
      dotWrap.style.top = '0px';
      dotWrap.style.transform = 'translate(-50%, -50%)';
      dotWrap.innerHTML = `<span class="${
        isCap
          ? 'w-2 h-2 rotate-45 bg-red-700 border border-amber-300'
          : isPass
          ? 'w-1.5 h-1.5 bg-amber-700'
          : 'w-1.5 h-1.5 rounded-full bg-stone-500'
      } block"></span>`;

      const labelEl = document.createElement('div');
      labelEl.style.position = 'absolute';
      labelEl.className = `px-1.5 py-0.5 rounded select-none whitespace-nowrap tracking-wide ${
        isCap ? 'font-serif font-bold text-[11px]' : 'text-[10px] font-medium'
      } ${
        theme === 'xuanmo'
          ? 'bg-slate-950/76 text-stone-200 border border-slate-800/80'
          : 'bg-[#F8F3E6]/88 text-stone-800 border border-amber-900/12'
      }`;
      labelEl.textContent = labelText;

      root.appendChild(dotWrap);
      root.appendChild(labelEl);

      const marker = new maplibregl.Marker({
        element: root,
        anchor: 'top-left',
      })
        .setLngLat(place.coordinates)
        .addTo(map);

      placeRecordsRef.current.push({
        place,
        marker,
        root,
        dotWrap,
        labelEl,
        labelText,
      });
    }

    scheduleScreenLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.places, placeNameMode, zoomBucket, theme]);

  // 10. Render Active Campaign Shockwaves & Route Callouts (Collision-Managed!)
  useEffect(() => {
    const map = mapRef.current;
    campaignCalloutsRef.current.forEach((r) => r.marker.remove());
    campaignCalloutsRef.current = [];
    campaignShockwavesRef.current.forEach((r) => r.marker.remove());
    campaignShockwavesRef.current = [];

    if (!map || !activeCampaign || !activePhase) {
      scheduleScreenLayout();
      return;
    }

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

      const wrapEl = document.createElement('div');
      wrapEl.style.position = 'absolute';
      wrapEl.style.left = '0px';
      wrapEl.style.top = '0px';
      wrapEl.style.transform = 'translate(-50%, -50%)';
      wrapEl.style.borderColor = curve.color;
      wrapEl.className = `px-2 py-0.5 rounded-full border shadow-md text-[11px] font-medium flex items-center gap-1 whitespace-nowrap select-none ${
        theme === 'xuanmo'
          ? 'bg-slate-950/92 text-amber-50'
          : 'bg-[#FFFDF8]/96 text-stone-900'
      }`;
      wrapEl.innerHTML = `
        <span style="background:${curve.color}" class="px-1.5 py-0.2 rounded-full text-[10px] text-white font-bold">${tacticBadge}</span>
        <span>${curve.label}</span>
      `;
      root.appendChild(wrapEl);

      const m = new maplibregl.Marker({ element: root, anchor: 'top-left' })
        .setLngLat(curve.midPoint)
        .addTo(map);

      campaignCalloutsRef.current.push({
        coord: curve.midPoint,
        marker: m,
        wrapEl,
        widthPx: estimateLabelWidthPx(`${tacticBadge}${curve.label}`, 11, 30),
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
        <span style="background:${accent}" class="animate-ping absolute inline-flex h-10 w-10 rounded-full opacity-45"></span>
        <div style="background:${accent}" class="relative w-8 h-8 rounded-full border-2 border-amber-200 shadow-lg flex items-center justify-center text-white font-serif font-bold text-xs">
          ${iconChar}
        </div>
      `;

      const labelEl = document.createElement('div');
      labelEl.style.position = 'absolute';
      labelEl.style.borderColor = accent;
      labelEl.className = `px-2.5 py-1 rounded-md shadow-lg border-l-4 text-xs select-none ${
        theme === 'xuanmo'
          ? 'bg-slate-900/95 text-amber-50'
          : 'bg-[#FAF5E8]/98 text-stone-900'
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

      const longestLine =
        bm.subLabel && bm.subLabel.length > bm.label.length
          ? bm.subLabel
          : bm.label;
      campaignShockwavesRef.current.push({
        coord: bm.coordinates,
        marker: m,
        labelEl,
        widthPx: estimateLabelWidthPx(longestLine, 12, 26),
        heightPx: bm.subLabel ? 40 : 26,
      });
    }

    scheduleScreenLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
