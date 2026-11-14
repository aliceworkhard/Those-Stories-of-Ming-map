import type { LngLat, RouteTacticType } from '@/types/ming';

/**
 * Generates a natural curved marching trajectory from control points using
 * Catmull-Rom spline interpolation (or lateral arc offset for 2-point flanking maneuvers).
 */
export function buildCurvedRouteCoords(
  rawCoords: LngLat[],
  tactic: RouteTacticType,
  segmentsPerSpan = 18
): LngLat[] {
  if (rawCoords.length < 2) return rawCoords;

  let pts = rawCoords;

  // Add subtle natural tactical curve if only 2 control points exist
  if (rawCoords.length === 2) {
    const [p0, p1] = rawCoords;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const curvature = tactic === 'ambush' ? 0.18 : 0.08;
    const mid: LngLat = [
      (p0[0] + p1[0]) / 2 - dy * curvature,
      (p0[1] + p1[1]) / 2 + dx * curvature,
    ];
    pts = [p0, mid, p1];
  }

  const result: LngLat[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;

      const lng =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

      const lat =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      result.push([lng, lat]);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

/**
 * Samples a position and geographic bearing (degrees clockwise from North)
 * at normalized progress `t` in [0, 1] along a polyline.
 */
export function sampleAlongPath(
  coords: LngLat[],
  progress: number
): { coordinates: LngLat; bearing: number } {
  if (coords.length === 0) return { coordinates: [116.4, 32.0], bearing: 0 };
  if (coords.length === 1) return { coordinates: coords[0], bearing: 0 };

  const clamped = Math.max(0, Math.min(0.999, progress));
  const scaled = clamped * (coords.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  const a = coords[idx];
  const b = coords[Math.min(coords.length - 1, idx + 1)];

  const lng = a[0] + (b[0] - a[0]) * frac;
  const lat = a[1] + (b[1] - a[1]) * frac;

  // Approximate geographic bearing (degrees clockwise from North, 0 = North, 90 = East)
  const dLng = (b[0] - a[0]) * Math.cos(((lat * Math.PI) / 180));
  const dLat = b[1] - a[1];
  const rad = Math.atan2(dLng, dLat);
  const bearing = ((rad * 180) / Math.PI + 360) % 360;

  return { coordinates: [lng, lat], bearing };
}
