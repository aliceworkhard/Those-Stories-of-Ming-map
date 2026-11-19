import polygonClipping from 'polygon-clipping';
import { topology } from 'topojson-server';
import { EAST_ASIA_LAND_MASK_GEOJSON } from '@/lib/atlasData';
import type { LngLat, PolityControlType } from '@/types/ming';

export type PcMultiPolygon = polygonClipping.MultiPolygon;

export interface EditablePolity {
  polityId: string;
  polityName: string;
  shortLabel: string;
  ruler: string;
  controlType: PolityControlType;
  color: string;
  borderColor?: string;
  labelCoord: LngLat;
  capitalName: string;
  changeReason: string;
  coordinates: PcMultiPolygon;
}

let cachedLandMaskMp: PcMultiPolygon | null = null;

export function getLandMaskMultiPoly(): PcMultiPolygon {
  if (cachedLandMaskMp) return cachedLandMaskMp;
  const feat = EAST_ASIA_LAND_MASK_GEOJSON.features[0];
  if (!feat || !feat.geometry) {
    cachedLandMaskMp = [];
    return cachedLandMaskMp;
  }
  if (feat.geometry.type === 'MultiPolygon') {
    cachedLandMaskMp = feat.geometry.coordinates as unknown as PcMultiPolygon;
  } else if (feat.geometry.type === 'Polygon') {
    cachedLandMaskMp = [
      feat.geometry.coordinates as unknown as polygonClipping.Polygon,
    ];
  } else {
    cachedLandMaskMp = [];
  }
  return cachedLandMaskMp;
}

function ringAreaSqDeg(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum) * 0.5;
}

function roundRing(ring: number[][]): [number, number][] {
  const out: [number, number][] = ring.map(([x, y]) => [
    Number(x.toFixed(4)),
    Number(y.toFixed(4)),
  ]);
  if (out.length >= 3) {
    const f = out[0];
    const l = out[out.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1]) {
      out.push([f[0], f[1]]);
    }
  }
  return out;
}

function cleanMultiPoly(
  mp: PcMultiPolygon,
  minOuterArea = 0.004,
  minHoleArea = 0.06
): PcMultiPolygon {
  const cleaned: PcMultiPolygon = [];
  for (const poly of mp) {
    if (!poly[0] || poly[0].length < 4) continue;
    const outer = roundRing(poly[0]);
    if (outer.length < 4 || ringAreaSqDeg(outer) < minOuterArea) continue;
    const holes = poly
      .slice(1)
      .map((h) => roundRing(h))
      .filter((h) => h.length >= 4 && ringAreaSqDeg(h) >= minHoleArea);
    cleaned.push([outer, ...holes]);
  }
  return cleaned;
}

export function buildBrushCirclePolygon(
  center: LngLat,
  radiusKm: number,
  segments = 28
): PcMultiPolygon {
  const latRad = (Math.max(-75, Math.min(75, center[1])) * Math.PI) / 180;
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.25, Math.cos(latRad)));
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    ring.push([
      Number((center[0] + Math.cos(theta) * dLng).toFixed(4)),
      Number((center[1] + Math.sin(theta) * dLat).toFixed(4)),
    ]);
  }
  ring[ring.length - 1] = [ring[0][0], ring[0][1]];
  return [[ring]];
}

export function buildBrushStrokeMultiPoly(
  points: LngLat[],
  radiusKm: number
): PcMultiPolygon {
  if (points.length === 0) return [];
  // Interpolate intermediate points if drag jump is larger than 45% of radius
  const dense: LngLat[] = [points[0]];
  const stepDeg = Math.max(0.06, (radiusKm / 111.32) * 0.45);

  for (let i = 1; i < points.length; i++) {
    const prev = dense[dense.length - 1];
    const curr = points[i];
    const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    if (dist > stepDeg) {
      const count = Math.min(24, Math.ceil(dist / stepDeg));
      for (let k = 1; k <= count; k++) {
        const t = k / count;
        dense.push([
          prev[0] + (curr[0] - prev[0]) * t,
          prev[1] + (curr[1] - prev[1]) * t,
        ]);
      }
    } else if (dist > 0.015) {
      dense.push(curr);
    }
  }

  const circles = dense.map((pt) => buildBrushCirclePolygon(pt, radiusKm, 24));
  if (circles.length === 1) return circles[0];
  try {
    return polygonClipping.union(circles[0], ...circles.slice(1));
  } catch {
    let acc = circles[0];
    for (let i = 1; i < circles.length; i++) {
      try {
        acc = polygonClipping.union(acc, circles[i]);
      } catch {
        // skip degenerate stamp
      }
    }
    return acc;
  }
}

function computeApproxCentroid(mp: PcMultiPolygon, fallback: LngLat): LngLat {
  if (!mp.length || !mp[0]?.[0]?.length) return fallback;
  let bestRing = mp[0][0];
  let bestArea = 0;
  for (const poly of mp) {
    const a = ringAreaSqDeg(poly[0]);
    if (a > bestArea) {
      bestArea = a;
      bestRing = poly[0];
    }
  }
  let sx = 0;
  let sy = 0;
  const n = Math.max(1, bestRing.length - 1);
  for (let i = 0; i < n; i++) {
    sx += bestRing[i][0];
    sy += bestRing[i][1];
  }
  return [Number((sx / n).toFixed(4)), Number((sy / n).toFixed(4))];
}

export function applyBrushStrokeToPolities(params: {
  polities: EditablePolity[];
  activePolityId: string;
  mode: 'paint' | 'erase';
  points: LngLat[];
  radiusKm: number;
  lockCoastline: boolean;
  mutualExclusive: boolean;
}): EditablePolity[] {
  const {
    polities,
    activePolityId,
    mode,
    points,
    radiusKm,
    lockCoastline,
    mutualExclusive,
  } = params;

  let strokeMp = buildBrushStrokeMultiPoly(points, radiusKm);
  if (strokeMp.length === 0) return polities;

  if (mode === 'paint' && lockCoastline) {
    const landMask = getLandMaskMultiPoly();
    if (landMask.length > 0) {
      strokeMp = polygonClipping.intersection(strokeMp, landMask);
      if (strokeMp.length === 0) return polities;
    }
  }

  return polities.map((pol) => {
    if (pol.polityId === activePolityId) {
      const nextRaw =
        mode === 'paint'
          ? pol.coordinates.length > 0
            ? polygonClipping.union(pol.coordinates, strokeMp)
            : strokeMp
          : pol.coordinates.length > 0
          ? polygonClipping.difference(pol.coordinates, strokeMp)
          : [];
      const cleaned = cleanMultiPoly(nextRaw);
      return {
        ...pol,
        coordinates: cleaned,
        labelCoord: computeApproxCentroid(cleaned, pol.labelCoord),
      };
    }

    if (mode === 'paint' && mutualExclusive && pol.coordinates.length > 0) {
      const diff = polygonClipping.difference(pol.coordinates, strokeMp);
      const cleaned = cleanMultiPoly(diff);
      return {
        ...pol,
        coordinates: cleaned,
        labelCoord: computeApproxCentroid(cleaned, pol.labelCoord),
      };
    }

    return pol;
  });
}

// Fast Ramer-Douglas-Peucker simplification for clean export without heavy runtime dependencies
function perpendicularDist(
  pt: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy));
}

function rdpSimplifyOpen(
  pts: [number, number][],
  epsilon: number
): [number, number][] {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let idx = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDist(pts[i], pts[0], pts[end]);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplifyOpen(pts.slice(0, idx + 1), epsilon);
    const right = rdpSimplifyOpen(pts.slice(idx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[end]];
}

function simplifyClosedRing(
  ring: [number, number][],
  tolerance: number
): [number, number][] {
  if (tolerance <= 0 || ring.length <= 6) return roundRing(ring);
  const mid = Math.floor(ring.length / 2);
  const h1 = rdpSimplifyOpen(ring.slice(0, mid + 1), tolerance);
  const h2 = rdpSimplifyOpen(ring.slice(mid), tolerance);
  const combined = [...h1.slice(0, -1), ...h2];
  return roundRing(combined);
}

export function politiesToFeatureCollection(
  polities: EditablePolity[],
  simplifyTolerance = 0
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const pol of polities) {
    if (!pol.coordinates || pol.coordinates.length === 0) continue;
    const coords =
      simplifyTolerance > 0
        ? pol.coordinates
            .map((poly) =>
              poly
                .map((r) =>
                  simplifyClosedRing(r as [number, number][], simplifyTolerance)
                )
                .filter((r) => r.length >= 4)
            )
            .filter((poly) => poly.length > 0 && ringAreaSqDeg(poly[0]) >= 0.004)
        : pol.coordinates;

    if (coords.length === 0) continue;
    features.push({
      type: 'Feature',
      properties: {
        polityId: pol.polityId,
        polityName: pol.polityName,
        shortLabel: pol.shortLabel,
        ruler: pol.ruler,
        controlType: pol.controlType,
        color: pol.color,
        borderColor: pol.borderColor || pol.color,
        labelCoord: pol.labelCoord,
        capitalName: pol.capitalName,
        changeReason: pol.changeReason,
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: coords as unknown as number[][][][],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function featureCollectionToPolities(
  fc: GeoJSON.FeatureCollection
): EditablePolity[] {
  const out: EditablePolity[] = [];
  for (const f of fc.features ?? []) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const geom = f.geometry;
    let mp: PcMultiPolygon = [];
    if (geom?.type === 'MultiPolygon') {
      mp = geom.coordinates as unknown as PcMultiPolygon;
    } else if (geom?.type === 'Polygon') {
      mp = [geom.coordinates as unknown as polygonClipping.Polygon];
    }
    const cleaned = cleanMultiPoly(mp, 0.001, 0.02);
    const fallbackCoord = Array.isArray(p.labelCoord)
      ? ([Number(p.labelCoord[0]), Number(p.labelCoord[1])] as LngLat)
      : computeApproxCentroid(cleaned, [116.4, 34.5]);
    out.push({
      polityId: String(p.polityId || `polity-${out.length + 1}`),
      polityName: String(p.polityName || p.shortLabel || '新建政权'),
      shortLabel: String(p.shortLabel || p.polityName || '新政权'),
      ruler: String(p.ruler || ''),
      controlType:
        p.controlType === 'tributary-garrison'
          ? 'tributary-garrison'
          : 'direct',
      color: String(p.color || '#B83B2A'),
      borderColor: String(p.borderColor || p.color || '#B83B2A'),
      labelCoord: fallbackCoord,
      capitalName: String(p.capitalName || ''),
      changeReason: String(p.changeReason || ''),
      coordinates: cleaned,
    });
  }
  return out;
}

export function countPolitiesVertices(polities: EditablePolity[]): number {
  return polities.reduce(
    (sum, p) =>
      sum +
      p.coordinates.reduce(
        (ps, poly) => ps + poly.reduce((rs, ring) => rs + ring.length, 0),
        0
      ),
    0
  );
}

export function convertFeatureCollectionToTopoJSON(
  fc: GeoJSON.FeatureCollection
): unknown {
  return topology(
    { territories: fc as unknown as GeoJSON.GeoJsonObject },
    1e4
  );
}
