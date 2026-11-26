import polygonClipping from 'polygon-clipping';
import {
  TERRITORY_SNAPSHOT_BY_ID,
  ensureSnapshotIdLoaded,
  isSnapshotChunkLoaded,
  subscribeTerritoryChunks,
} from '@/lib/territoryData';
import type { LngLat } from '@/types/ming';

type PcMultiPolygon = polygonClipping.MultiPolygon;
type PcRing = [number, number][];

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

// ============================================================================
// High-Speed Local-Delta Geometry Engine ("仅让发生变化的边境或势力区域变化")
// ============================================================================
// Instead of wiping or repainting whole empires globally, we compute & cache ONLY
// the exact boolean difference (`deltaMp = destMp - unchangedSameRegimeMp`) for
// both Era-to-Era transitions and all 12 Campaign phases! Unchanged provinces
// never blink, never erase, and never repaint.

const simplifiedSnapshotPolityCache = new Map<
  string,
  { mp: PcMultiPolygon; props: Record<string, unknown> }
>();
const computedEraDeltaCache = new Map<string, EraWipePlan>();
const customCampaignSliceCache = new Map<string, PcMultiPolygon>();
const customCampaignBaseCache = new Map<string, GeoJSON.FeatureCollection>();

// Evict geometry caches whenever a lazy-loaded historical snapshot chunk arrives
subscribeTerritoryChunks(() => {
  simplifiedSnapshotPolityCache.clear();
  computedEraDeltaCache.clear();
  customCampaignSliceCache.clear();
  customCampaignBaseCache.clear();
});

function requireSnapshotReady(id: string): boolean {
  if (!isSnapshotChunkLoaded(id) && typeof window !== 'undefined') {
    void ensureSnapshotIdLoaded(id);
  }
  return isSnapshotChunkLoaded(id);
}

function sqSegDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  let x = x1;
  let y = y1;
  let dx = x2 - x1;
  let dy = y2 - y1;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = x2;
      y = y2;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

function simplifyDpRing(ring: PcRing, sqTol: number): PcRing {
  const len = ring.length;
  if (len <= 6) return ring;

  const markers = new Uint8Array(len);
  markers[0] = 1;
  markers[len - 1] = 1;
  const stack: Array<[number, number]> = [[0, len - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxSqDist = 0;
    let index = 0;
    const [fx, fy] = ring[first];
    const [lx, ly] = ring[last];

    for (let i = first + 1; i < last; i++) {
      const sqDist = sqSegDist(ring[i][0], ring[i][1], fx, fy, lx, ly);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTol) {
      markers[index] = 1;
      if (index - first > 1) stack.push([first, index]);
      if (last - index > 1) stack.push([index, last]);
    }
  }

  const out: PcRing = [];
  for (let i = 0; i < len; i++) {
    if (markers[i]) out.push(ring[i]);
  }
  if (out.length > 0) {
    const lastPt = out[out.length - 1];
    if (lastPt[0] !== out[0][0] || lastPt[1] !== out[0][1]) {
      out.push([out[0][0], out[0][1]]);
    }
  }
  return out.length >= 4 ? out : ring;
}

function ringBbox(ring: PcRing): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function ringBboxArea(ring: PcRing): number {
  const [minX, minY, maxX, maxY] = ringBbox(ring);
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

function multiPolyBbox(
  mp: PcMultiPolygon
): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of mp) {
    if (!poly?.[0]?.length) continue;
    const [x1, y1, x2, y2] = ringBbox(poly[0] as unknown as PcRing);
    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  }
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

function cleanDeltaMultiPolygon(
  mp: PcMultiPolygon,
  minAreaSqDeg = 0.045
): PcMultiPolygon {
  return mp.filter((poly) => {
    const outer = poly?.[0] as unknown as PcRing | undefined;
    if (!outer || outer.length < 4) return false;
    return ringBboxArea(outer) >= minAreaSqDeg;
  });
}

function simplifyMultiPolygonForSweep(
  mp: PcMultiPolygon,
  toleranceDeg = 0.075
): PcMultiPolygon {
  const sqTol = toleranceDeg * toleranceDeg;
  const result: PcMultiPolygon = [];

  for (const poly of mp) {
    if (!poly || poly.length === 0) continue;
    const outer = poly[0] as unknown as PcRing;
    if (mp.length > 1 && ringBboxArea(outer) < 0.05) continue;

    const simplifiedPoly: polygonClipping.Polygon = [];
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r] as unknown as PcRing;
      if (r > 0 && ringBboxArea(ring) < 0.04) continue;
      simplifiedPoly.push(simplifyDpRing(ring, sqTol));
    }
    if (simplifiedPoly.length > 0) {
      result.push(simplifiedPoly);
    }
  }

  return result.length > 0 ? result : mp;
}

function toPcMultiPolygon(geom: GeoJSON.Geometry | null | undefined): PcMultiPolygon {
  if (!geom) return [];
  if (geom.type === 'Polygon') {
    return [geom.coordinates as unknown as polygonClipping.Polygon];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates as unknown as PcMultiPolygon;
  }
  return [];
}

function findFeatureMultiPoly(
  snapshotId: string,
  polityId: string,
  forSweep = false
): { mp: PcMultiPolygon; props: Record<string, unknown> } {
  requireSnapshotReady(snapshotId);
  const cacheKey = `${snapshotId}::${polityId}::${forSweep ? 'sweep' : 'full'}`;
  const hit = simplifiedSnapshotPolityCache.get(cacheKey);
  if (hit) return hit;

  const snap = TERRITORY_SNAPSHOT_BY_ID[snapshotId];
  if (!snap) return { mp: [], props: {} };
  const feat = snap.geojson.features.find(
    (f) => String(f.properties?.polityId) === polityId
  );
  if (!feat) return { mp: [], props: {} };

  const rawMp = toPcMultiPolygon(feat.geometry);
  const entry = {
    mp: forSweep ? simplifyMultiPolygonForSweep(rawMp) : rawMp,
    props: (feat.properties ?? {}) as Record<string, unknown>,
  };
  simplifiedSnapshotPolityCache.set(cacheKey, entry);
  return entry;
}

function boxMultiPolygon(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): PcMultiPolygon {
  return [
    [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  ];
}

function getCachedBoxSlice(
  sliceKey: string,
  snapshotId: string,
  polityId: string,
  bbox: [number, number, number, number]
): PcMultiPolygon {
  const cached = customCampaignSliceCache.get(sliceKey);
  if (cached) return cached;

  const { mp } = findFeatureMultiPoly(snapshotId, polityId, true);
  const sliced =
    mp.length > 0
      ? polygonClipping.intersection(
          mp,
          boxMultiPolygon(bbox[0], bbox[1], bbox[2], bbox[3])
        )
      : [];
  customCampaignSliceCache.set(sliceKey, sliced);
  return sliced;
}

/**
 * Generates a modified base FeatureCollection where a local contested slice `zoneMp`
 * is carved out of existing regimes and colored as the pre-battle opposing force,
 * so ONLY `zoneMp` changes color when conquered!
 */
function getCarvedContestedBase(
  cacheKey: string,
  baseFc: GeoJSON.FeatureCollection,
  zoneMp: PcMultiPolygon,
  contestedProps: Record<string, unknown>
): GeoJSON.FeatureCollection {
  const hit = customCampaignBaseCache.get(cacheKey);
  if (hit) return hit;

  const nextFeatures: GeoJSON.Feature[] = [];
  for (const f of baseFc.features) {
    const mp = toPcMultiPolygon(f.geometry);
    if (mp.length === 0) continue;
    const rem = polygonClipping.difference(mp, zoneMp);
    const remFeat = mpToFeature(rem, (f.properties ?? {}) as Record<string, unknown>);
    if (remFeat) nextFeatures.push(remFeat);
  }
  const zoneFeat = mpToFeature(zoneMp, contestedProps);
  if (zoneFeat) nextFeatures.push(zoneFeat);

  const built: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: nextFeatures,
  };
  customCampaignBaseCache.set(cacheKey, built);
  return built;
}

function buildOrganicBrushMask(
  origin: LngLat,
  rx: number,
  ry: number,
  seedAngle = 0
): PcMultiPolygon {
  if (rx <= 0.02 || ry <= 0.02) return [];
  const steps = 20;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const ripple =
      1 +
      0.08 * Math.sin(theta * 5 + seedAngle) +
      0.05 * Math.cos(theta * 3 - seedAngle * 0.7);
    ring.push([
      origin[0] + Math.cos(theta) * rx * ripple,
      origin[1] + Math.sin(theta) * ry * ripple,
    ]);
  }
  ring[ring.length - 1] = [ring[0][0], ring[0][1]];
  return [[ring]];
}

function mpToFeature(
  mp: PcMultiPolygon,
  props: Record<string, unknown>
): GeoJSON.Feature | null {
  if (!mp || mp.length === 0) return null;
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'MultiPolygon',
      coordinates: mp as unknown as number[][][][],
    },
  };
}

function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// ============================================================================
// PART 1: Strictly Local-Delta Era-to-Era Snapshot Paint-Over
//         (Unchanged provinces & frontiers NEVER blink or repaint!)
// ============================================================================

interface EraDeltaTarget {
  deltaMp: PcMultiPolygon;
  props: Record<string, unknown>;
  origin: LngLat;
  maxRx: number;
  maxRy: number;
  frontColor: string;
  isEraserOnly?: boolean;
}

export interface EraWipePlan {
  caption: string;
  targets: EraDeltaTarget[];
}

/**
 * Maps polities that represent the SAME continuous sovereignty & color family
 * across snapshots so unchanged core provinces subtract out to ZERO!
 */
function getRegimeContinuityKey(props: Record<string, unknown>): string {
  const id = String(props.polityId ?? '');
  const color = String(props.color ?? '').toLowerCase();
  const ctrl = String(props.controlType ?? 'direct');

  // Direct Ming imperial court / Zhu Yuanzhang's Wu / Southern Ming continuity
  if (color === '#b83b2a' && ctrl === 'direct') {
    return 'ming-imperial-direct';
  }
  // Northeast Jurchen / Nurgan tributary garrisons
  if (
    ctrl === 'tributary-garrison' &&
    (id.includes('nurgan') || id.includes('jurchen') || color === '#9c4221')
  ) {
    return 'ming-northeast-tributary';
  }
  // Western Usang / Guanxi / Tibet tributary garrisons
  if (
    ctrl === 'tributary-garrison' &&
    (id.includes('usang') || id.includes('guanxi') || color === '#b7791f')
  ) {
    return 'ming-western-tributary';
  }
  // Outer Mongolian Steppe continuity (Northern Yuan / Oirat / Dayan / Chahar / Khalkha)
  if (
    id.includes('yuan') ||
    id.includes('oirat') ||
    id.includes('dayan') ||
    id.includes('mongol') ||
    id.includes('chahar') ||
    id.includes('khalkha') ||
    color === '#4a5568' ||
    color === '#374151'
  ) {
    return `steppe-continuity::${ctrl}`;
  }

  return `${color}::${ctrl}`;
}

const ERA_TRANSITION_CAPTIONS: Record<string, string> = {
  'ter-1356->ter-1363':
    '局部边境演变：陈友谅据湖广称汉、朱元璋拓江南、明玉珍据蜀',
  'ter-1363->ter-1368':
    '局部疆域推进：平陈汉灭张吴，徐达北伐收复中原与元大都（原江南腹地保持静止）',
  'ter-1368->ter-1388':
    '局部边疆拓展：平蜀明夏、克云南梁王、纳辽东与设乌思藏（中原江南保持静止）',
  'ter-1388->ter-1399':
    '局部裂变：仅北平与大宁变为燕王靖难军防区，其余各省保持静止',
  'ter-1399->ter-1402':
    '局部归并：燕藩防区重归大明一统，并拓展奴儿干都司（南方各省保持静止）',
  'ter-1402->ter-1415':
    '局部拓疆：仅安南新设交趾布政使司与奴儿干外兴安岭扩张（两京十三省保持静止）',
  'ter-1415->ter-1435':
    '局部收缩：仅交趾罢布政使司改封藩属（大明两京十三省保持静止）',
  'ter-1435->ter-1449':
    '局部边患：仅漠南宣大外围受瓦剌也先南侵推进（关内各省保持静止）',
  'ter-1449->ter-1479':
    '局部边防变化：仅河套地区入驻达延汗、延绥筑墙锁边（大明内地保持静止）',
  'ter-1479->ter-1582':
    '局部封贡互市：仅归化城河套设为俺答顺义王封贡区（大明全境保持静止）',
  'ter-1582->ter-1621':
    '局部失地：仅辽东沈辽地区变为努尔哈赤后金控制（山海关内全境保持静止）',
  'ter-1621->ter-1642':
    '局部战局演变：仅锦州塞外归清、河南入李自成、湖广入张献忠（其余省域保持静止）',
  'ter-1642->ter-1644':
    '局部巨变：仅华北入清、秦陇入大顺、巴蜀入大西（江南腹地保持静止）',
  'ter-1644->ter-1652':
    '局部推进：清军南下江南，郑成功收复台湾与李定国守西南（华北保持静止）',
};

export function getEraWipePlan(
  fromSnapshotId: string,
  toSnapshotId: string
): EraWipePlan {
  const key = `${fromSnapshotId}->${toSnapshotId}`;
  const cached = computedEraDeltaCache.get(key);
  if (cached) return cached;

  const fromSnap = TERRITORY_SNAPSHOT_BY_ID[fromSnapshotId];
  const destSnap = TERRITORY_SNAPSHOT_BY_ID[toSnapshotId];
  if (!fromSnap || !destSnap || fromSnapshotId === toSnapshotId) {
    return { caption: '', targets: [] };
  }

  // 1. Group simplified polygons of `fromSnapshot` by continuity key
  const prevByGroup = new Map<string, PcMultiPolygon>();
  let prevAllLand: PcMultiPolygon = [];

  for (const f of fromSnap.geojson.features) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const pid = String(props.polityId ?? '');
    const { mp } = findFeatureMultiPoly(fromSnapshotId, pid, true);
    if (mp.length === 0) continue;

    const gKey = getRegimeContinuityKey(props);
    const existing = prevByGroup.get(gKey);
    prevByGroup.set(
      gKey,
      existing && existing.length > 0 ? polygonClipping.union(existing, mp) : mp
    );
    prevAllLand =
      prevAllLand.length > 0 ? polygonClipping.union(prevAllLand, mp) : mp;
  }

  // 2. For each destination polity, subtract unchanged territory -> ONLY local delta!
  const targets: EraDeltaTarget[] = [];
  let destAllLand: PcMultiPolygon = [];

  for (const df of destSnap.geojson.features) {
    const props = (df.properties ?? {}) as Record<string, unknown>;
    const pid = String(props.polityId ?? '');
    const { mp: destMp } = findFeatureMultiPoly(toSnapshotId, pid, true);
    if (destMp.length === 0) continue;

    destAllLand =
      destAllLand.length > 0 ? polygonClipping.union(destAllLand, destMp) : destMp;

    const gKey = getRegimeContinuityKey(props);
    const samePrev = prevByGroup.get(gKey);
    const rawDiff =
      samePrev && samePrev.length > 0
        ? polygonClipping.difference(destMp, samePrev)
        : destMp;

    const deltaMp = cleanDeltaMultiPolygon(rawDiff, 0.05);
    const bbox = multiPolyBbox(deltaMp);
    if (!bbox) continue;

    const [minX, minY, maxX, maxY] = bbox;
    const center: LngLat = [(minX + maxX) / 2, (minY + maxY) / 2];
    const maxRx = Math.max(0.8, (maxX - minX) * 0.68);
    const maxRy = Math.max(0.8, (maxY - minY) * 0.68);

    targets.push({
      deltaMp,
      props,
      origin: center,
      maxRx,
      maxRy,
      frontColor: String(props.color ?? '#D97706'),
    });
  }

  // 3. Also check if any frontier strip retreated to unclaimed neutral land
  if (prevAllLand.length > 0 && destAllLand.length > 0) {
    const retreatedRaw = polygonClipping.difference(prevAllLand, destAllLand);
    const retreatedMp = cleanDeltaMultiPolygon(retreatedRaw, 0.08);
    const bbox = multiPolyBbox(retreatedMp);
    if (bbox) {
      const [minX, minY, maxX, maxY] = bbox;
      targets.push({
        deltaMp: retreatedMp,
        props: { polityId: '__retreat_eraser__', color: '#EFE6D4' },
        origin: [(minX + maxX) / 2, (minY + maxY) / 2],
        maxRx: Math.max(0.8, (maxX - minX) * 0.68),
        maxRy: Math.max(0.8, (maxY - minY) * 0.68),
        frontColor: '#94A3B8',
        isEraserOnly: true,
      });
    }
  }

  const plan: EraWipePlan = {
    caption:
      ERA_TRANSITION_CAPTIONS[key] ??
      `局部边境涂抹演进：${destSnap.meta.title}`,
    targets,
  };
  computedEraDeltaCache.set(key, plan);
  return plan;
}

export function buildEraWipeOverlayGeoJSON(
  _toSnapshotId: string,
  plan: EraWipePlan,
  rawProgress: number
): GeoJSON.FeatureCollection {
  if (plan.targets.length === 0 || rawProgress <= 0.005) return EMPTY_FC;

  const eased = easeInOutCubic(rawProgress);
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < plan.targets.length; i++) {
    const tgt = plan.targets[i];
    if (tgt.deltaMp.length === 0) continue;

    const brush = buildOrganicBrushMask(
      tgt.origin,
      Math.max(0.25, tgt.maxRx * eased * 1.25),
      Math.max(0.25, tgt.maxRy * eased * 1.25),
      i * 1.3 + eased * 1.4
    );

    const clipped =
      eased >= 0.995
        ? tgt.deltaMp
        : polygonClipping.intersection(tgt.deltaMp, brush);
    const feat = mpToFeature(clipped, {
      ...tgt.props,
      frontColor: tgt.frontColor,
      isEraserOnly: tgt.isEraserOnly ? 1 : 0,
      isActivelyWiping: eased < 0.99 ? 1 : 0,
    });
    if (feat) features.push(feat);
  }

  return { type: 'FeatureCollection', features };
}

// ============================================================================
// PART 2: Strictly Local-Delta Battlefield Campaign Conquest Paint-Over
// ============================================================================

interface CachedNorthernSlices {
  basePostPoyang: GeoJSON.FeatureCollection;
  jiangnanMp: PcMultiPolygon;
  shandongMp: PcMultiPolygon;
  henanMp: PcMultiPolygon;
  hebeiShanxiMp: PcMultiPolygon;
  chenHanMp: PcMultiPolygon;
  daningMp: PcMultiPolygon;
  baseJingnanPhase1: GeoJSON.FeatureCollection;
  jingnanCorridorMp: PcMultiPolygon;
}

let cachedSlices: CachedNorthernSlices | null = null;

function getCampaignGeoCache(): CachedNorthernSlices {
  if (cachedSlices) return cachedSlices;

  const ter1363 = TERRITORY_SNAPSHOT_BY_ID['ter-1363'].geojson;
  const ter1399 = TERRITORY_SNAPSHOT_BY_ID['ter-1399'].geojson;

  const { mp: zhuWuMp } = findFeatureMultiPoly('ter-1363', 'zhu-wu', true);
  const { mp: chenHanMp } = findFeatureMultiPoly('ter-1363', 'chen-han', true);
  const { mp: zhangMp } = findFeatureMultiPoly('ter-1363', 'zhang-zhou', true);
  const { mp: fangMp } = findFeatureMultiPoly('ter-1363', 'fang-zhedong', true);
  const { mp: ming1368Mp } = findFeatureMultiPoly(
    'ter-1368',
    'ming-empire',
    true
  );
  const { mp: yan1399FullMp, props: yanProps } = findFeatureMultiPoly(
    'ter-1399',
    'yan-rebels',
    false
  );
  const { mp: jianwenMp, props: jianwenProps } = findFeatureMultiPoly(
    'ter-1399',
    'ming-jianwen',
    true
  );

  const jiangnanMp = polygonClipping.union(zhangMp, fangMp);
  const shandongMp = polygonClipping.intersection(
    ming1368Mp,
    boxMultiPolygon(114.85, 34.15, 123.0, 38.35)
  );
  const henanMp = polygonClipping.intersection(
    ming1368Mp,
    boxMultiPolygon(109.7, 31.8, 116.75, 36.35)
  );

  // ONLY the newly conquered North China (Hebei Dadu & Shanxi) for Phase 4 — South China stays 100% still!
  const alreadyMingBeforePhase4 = polygonClipping.union(
    zhuWuMp,
    chenHanMp,
    jiangnanMp,
    shandongMp,
    henanMp
  );
  const hebeiShanxiMp = cleanDeltaMultiPolygon(
    polygonClipping.difference(
      polygonClipping.intersection(
        ming1368Mp,
        boxMultiPolygon(110.0, 34.5, 121.0, 42.5)
      ),
      alreadyMingBeforePhase4
    ),
    0.04
  );

  const basePostPoyang: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: ter1363.features.map((f) => {
      if (String(f.properties?.polityId) === 'chen-han') {
        return {
          ...f,
          properties: {
            ...f.properties,
            polityId: 'zhu-wu',
            polityName: '朱元璋（吴国 · 尽收江西湖广）',
            shortLabel: '吴 · 朱元璋',
            ruler: '吴王朱元璋',
            color: '#B83B2A',
            labelCoord: [114.31, 30.55],
          },
        };
      }
      return f;
    }),
  };

  const daningBox = boxMultiPolygon(117.15, 40.52, 123.5, 44.0);
  const daningFullMp = polygonClipping.intersection(yan1399FullMp, daningBox);
  const daningMp = simplifyMultiPolygonForSweep(daningFullMp);
  const beipingOnlyMp = polygonClipping.difference(yan1399FullMp, daningBox);

  // Local Jianghuai–Nanjing decisive campaign corridor for Jingnan Phase 5 (never repaints Yunnan/Sichuan!)
  const jingnanCorridorMp = polygonClipping.intersection(
    jianwenMp,
    boxMultiPolygon(115.6, 30.4, 121.6, 36.6)
  );

  const baseJingnanPhase1: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...(beipingOnlyMp.length
        ? [
            {
              type: 'Feature' as const,
              properties: {
                ...yanProps,
                shortLabel: '燕 · 朱棣（北平孤隅）',
                labelCoord: [116.41, 39.55],
              },
              geometry: {
                type: 'MultiPolygon' as const,
                coordinates: beipingOnlyMp as unknown as number[][][][],
              },
            },
          ]
        : []),
      ...(daningFullMp.length
        ? [
            {
              type: 'Feature' as const,
              properties: {
                ...jianwenProps,
                polityId: 'daning-ning',
                polityName: '大宁都司（宁王朱权 · 朵颜三卫驻地）',
                shortLabel: '大宁都司（朝廷/宁王）',
                color: '#9C4221',
                labelCoord: [119.23, 41.59],
              },
              geometry: {
                type: 'MultiPolygon' as const,
                coordinates: daningFullMp as unknown as number[][][][],
              },
            },
          ]
        : []),
      ...ter1399.features.filter(
        (f) => String(f.properties?.polityId) !== 'yan-rebels'
      ),
    ],
  };

  cachedSlices = {
    basePostPoyang,
    jiangnanMp,
    shandongMp,
    henanMp,
    hebeiShanxiMp,
    chenHanMp,
    daningMp,
    baseJingnanPhase1,
    jingnanCorridorMp,
  };
  return cachedSlices;
}

export interface CampaignTerritoryFrame {
  baseGeoJSON: GeoJSON.FeatureCollection;
  wipeOverlayGeoJSON: GeoJSON.FeatureCollection;
  caption: string | null;
  hasWipeInPhase: boolean;
}

function buildSweepResponse(
  baseGeoJSON: GeoJSON.FeatureCollection,
  targetMp: PcMultiPolygon,
  eased: number,
  origin: LngLat,
  maxRx: number,
  maxRy: number,
  seed: number,
  props: Record<string, unknown>,
  caption: string
): CampaignTerritoryFrame {
  if (eased <= 0.01) {
    return {
      baseGeoJSON,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: true,
    };
  }

  const clipped =
    eased >= 0.995
      ? targetMp
      : polygonClipping.intersection(
          targetMp,
          buildOrganicBrushMask(
            origin,
            Math.max(0.25, maxRx * eased),
            Math.max(0.25, maxRy * eased),
            seed
          )
        );

  const feat = mpToFeature(clipped, {
    ...props,
    isEraserOnly: 0,
    isActivelyWiping: eased < 0.99 ? 1 : 0,
  });

  return {
    baseGeoJSON,
    wipeOverlayGeoJSON: feat
      ? { type: 'FeatureCollection', features: [feat] }
      : EMPTY_FC,
    caption,
    hasWipeInPhase: true,
  };
}

export function buildCampaignTerritoryFrame(
  campaignId: string,
  phaseIndex: number,
  wipeProgress: number
): CampaignTerritoryFrame {
  const cache = getCampaignGeoCache();
  const eased = easeInOutCubic(wipeProgress);

  // 1. 1363 Poyang Lake Campaign (ONLY Chen Han's Huguang/Jiangxi changes!)
  if (campaignId === 'cmp-1363-poyang') {
    const base = TERRITORY_SNAPSHOT_BY_ID['ter-1363'].geojson;
    if (phaseIndex < 4) {
      return {
        baseGeoJSON: base,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    return buildSweepResponse(
      base,
      cache.chenHanMp,
      eased,
      [116.22, 29.74],
      8.2,
      6.8,
      eased * 1.5,
      {
        polityId: 'zhu-wu',
        polityName: '朱元璋（平定陈汉 · 尽收江西湖广）',
        shortLabel: '吴 · 朱元璋',
        controlType: 'direct',
        color: '#B83B2A',
        frontColor: '#F59E0B',
      },
      eased < 0.99
        ? '局部疆域涂抹：陈友谅毙命泾江口，仅陈汉故地并入朱元璋版图！'
        : '版图已更新：朱元璋收并陈汉故地'
    );
  }

  // 2. 1366-1368 Northern Expedition (Each phase paints ONLY that phase's conquered province!)
  if (campaignId === 'cmp-1367-northern-expedition') {
    const base = cache.basePostPoyang;
    const mingProps = {
      polityId: 'ming-empire',
      polityName: '大明北伐新克疆域',
      shortLabel: '大明帝国',
      controlType: 'direct',
      color: '#B83B2A',
      frontColor: '#F59E0B',
      isEraserOnly: 0,
    };

    const features: GeoJSON.Feature[] = [];
    const addStatic = (mp: PcMultiPolygon) => {
      const f = mpToFeature(mp, { ...mingProps, isActivelyWiping: 0 });
      if (f) features.push(f);
    };
    const addSweeping = (
      targetMp: PcMultiPolygon,
      origin: LngLat,
      maxRx: number,
      maxRy: number
    ) => {
      if (eased <= 0.01) return;
      const brush = buildOrganicBrushMask(
        origin,
        Math.max(0.3, maxRx * eased),
        Math.max(0.3, maxRy * eased),
        phaseIndex + eased * 1.4
      );
      const clipped =
        eased >= 0.995
          ? targetMp
          : polygonClipping.intersection(targetMp, brush);
      const f = mpToFeature(clipped, {
        ...mingProps,
        isActivelyWiping: eased < 0.99 ? 1 : 0,
      });
      if (f) features.push(f);
    };

    let caption = '';
    if (phaseIndex === 0) {
      addSweeping(cache.jiangnanMp, [119.55, 31.2], 4.8, 4.8);
      caption = '局部疆域涂抹：徐达破平江灭张士诚，仅平江浙东并入大明！';
    } else if (phaseIndex === 1) {
      addStatic(cache.jiangnanMp);
      addSweeping(cache.shandongMp, [117.18, 34.26], 6.8, 4.6);
      caption = '局部疆域涂抹：北伐大军攻克济南，仅山东全境变更为大明！';
    } else if (phaseIndex === 2) {
      addStatic(cache.jiangnanMp);
      addStatic(cache.shandongMp);
      addSweeping(cache.henanMp, [116.59, 35.41], 7.5, 4.5);
      caption = '局部疆域涂抹：旋师西进克复汴梁洛阳，仅河南潼关变更为大明！';
    } else {
      addStatic(cache.jiangnanMp);
      addStatic(cache.shandongMp);
      addStatic(cache.henanMp);
      addSweeping(cache.hebeiShanxiMp, [116.39, 38.2], 6.8, 6.2);
      caption = '局部疆域涂抹：徐达攻克元大都改北平府，仅河北山西燕云之地变更为大明！';
    }

    return {
      baseGeoJSON: base,
      wipeOverlayGeoJSON: { type: 'FeatureCollection', features },
      caption: eased > 0.01 ? caption : null,
      hasWipeInPhase: true,
    };
  }

  // 3. 1399-1402 Jingnan Campaign (ONLY Daning in Phase 2 & Jianghuai-Nanjing Corridor in Phase 5!)
  if (campaignId === 'cmp-1399-jingnan') {
    if (phaseIndex === 0) {
      return {
        baseGeoJSON: cache.baseJingnanPhase1,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    if (phaseIndex === 1) {
      return buildSweepResponse(
        cache.baseJingnanPhase1,
        cache.daningMp,
        eased,
        [116.41, 39.9],
        6.2,
        4.5,
        eased,
        {
          polityId: 'yan-rebels',
          polityName: '燕王靖难军（并吞大宁都司）',
          shortLabel: '燕 · 朱棣',
          controlType: 'direct',
          color: '#C68B2C',
          frontColor: '#FDE68A',
        },
        '局部疆域涂抹：朱棣奇袭塞外大宁，仅大宁防区并入燕军！'
      );
    }

    const base1399 = TERRITORY_SNAPSHOT_BY_ID['ter-1399'].geojson;
    if (phaseIndex === 2 || phaseIndex === 3) {
      return {
        baseGeoJSON: base1399,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    return buildSweepResponse(
      base1399,
      cache.jingnanCorridorMp,
      eased,
      [117.2, 34.3],
      5.2,
      4.8,
      eased * 1.4,
      {
        polityId: 'yan-victory',
        polityName: '燕军南渡长江直取南京京畿走廊',
        shortLabel: '燕军克复江淮应天',
        controlType: 'direct',
        color: '#C68B2C',
        frontColor: '#FEF08A',
      },
      eased < 0.99
        ? '局部疆域涂抹：燕军破灵璧渡江入主金川门，仅江淮至应天决战走廊变更！'
        : '版图已更新：朱棣攻占南京京畿，奉天靖难功成'
    );
  }

  // 4. 1387-1388 Nagachu Surrender & Buyur Lake
  if (campaignId === 'cmp-1387-buyur-lake') {
    const base1368 = TERRITORY_SNAPSHOT_BY_ID['ter-1368'].geojson;
    const base1388 = TERRITORY_SNAPSHOT_BY_ID['ter-1388'].geojson;

    if (phaseIndex === 0) {
      const liaodongSlice = getCachedBoxSlice(
        'buyur-liaodong',
        'ter-1388',
        'ming-hongwu-unified',
        [118.2, 38.6, 126.2, 43.9]
      );
      return buildSweepResponse(
        base1368,
        liaodongSlice,
        eased,
        [119.23, 41.59],
        6.8,
        4.8,
        eased * 1.4,
        {
          polityId: 'ming-hongwu-unified',
          polityName: '大明辽东都司（纳哈出降明）',
          shortLabel: '大明 · 辽东',
          controlType: 'direct',
          color: '#B83B2A',
          frontColor: '#F59E0B',
        },
        '局部疆域涂抹：迫降金山纳哈出二十万众，仅辽东地区并入大明！'
      );
    }

    if (phaseIndex === 2) {
      const buyurFrontier = getCachedBoxSlice(
        'buyur-yuan-court',
        'ter-1388',
        'shattered-northern-yuan',
        [115.0, 45.2, 120.8, 49.8]
      );
      return buildSweepResponse(
        base1388,
        buyurFrontier,
        eased,
        [117.72, 47.83],
        3.5,
        2.8,
        eased * 1.5,
        {
          polityId: 'ming-buyur-sweep',
          polityName: '蓝玉捕鱼儿海犁庭锋区',
          shortLabel: '捕鱼儿海扫穴区',
          controlType: 'tributary-garrison',
          color: '#B83B2A',
          frontColor: '#F59E0B',
        },
        '局部战区涂抹：蓝玉奇袭捕鱼儿海，仅漠北汗廷驻地瓦解！'
      );
    }

    return {
      baseGeoJSON: base1388,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 5. 1405-1433 Zheng He's Seven Voyages
  if (campaignId === 'cmp-1405-zhenghe-voyages') {
    const base =
      phaseIndex <= 3
        ? TERRITORY_SNAPSHOT_BY_ID['ter-1415'].geojson
        : TERRITORY_SNAPSHOT_BY_ID['ter-1435'].geojson;
    return {
      baseGeoJSON: base,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 6. 1449 Tumu Crisis & Yu Qian's Defense of Beijing
  if (campaignId === 'cmp-1449-tumu-beijing') {
    const base1435 = TERRITORY_SNAPSHOT_BY_ID['ter-1435'].geojson;
    const base1449 = TERRITORY_SNAPSHOT_BY_ID['ter-1449'].geojson;

    const xuanDaBorderSlice = getCachedBoxSlice(
      'tumu-xuanda-border',
      'ter-1449',
      'oirat-esen',
      [111.5, 39.6, 118.5, 43.2]
    );

    if (phaseIndex === 2) {
      return buildSweepResponse(
        base1435,
        xuanDaBorderSlice,
        eased,
        [115.2, 41.2],
        4.2,
        2.6,
        eased,
        {
          polityId: 'oirat-esen',
          polityName: '瓦剌南侵宣大边塞区',
          shortLabel: '瓦剌逼近宣大',
          controlType: 'direct',
          color: '#374151',
          frontColor: '#EF4444',
        },
        '局部边境涂抹：土木堡兵败后，仅宣大塞外防区被瓦剌推进控制！'
      );
    }

    if (phaseIndex === 4) {
      const contestedJuyongSlice = getCachedBoxSlice(
        'tumu-juyong-contested',
        'ter-1449',
        'ming-jingtai-defense',
        [113.2, 39.1, 117.4, 41.1]
      );
      const baseWithOiratIncursion = getCarvedContestedBase(
        'tumu-phase5-base',
        base1449,
        contestedJuyongSlice,
        {
          polityId: 'oirat-incursion-gate',
          polityName: '瓦剌进逼紫荆关京西前线',
          shortLabel: '瓦剌叩关前线',
          ruler: '也先',
          controlType: 'direct',
          color: '#374151',
          labelCoord: [115.1, 40.1],
        }
      );

      return buildSweepResponse(
        baseWithOiratIncursion,
        contestedJuyongSlice,
        eased,
        [116.38, 39.95],
        3.6,
        2.0,
        eased * 1.4,
        {
          polityId: 'ming-jingtai-defense',
          polityName: '于谦收复紫荆居庸京畿防线',
          shortLabel: '大明收复京畿关隘',
          controlType: 'direct',
          color: '#B83B2A',
          frontColor: '#F59E0B',
        },
        '局部边境涂抹：于谦北京九门大破也先，仅京西紫荆居庸前线复归大明！'
      );
    }

    return {
      baseGeoJSON: phaseIndex < 2 ? base1435 : base1449,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 7. 1519 Wang Yangming vs Prince Ning (ONLY Nanchang-Poyang Rebel Zone changes!)
  if (campaignId === 'cmp-1519-ning-rebellion') {
    const base1479 = TERRITORY_SNAPSHOT_BY_ID['ter-1479'].geojson;
    const ningRebelZone = getCachedBoxSlice(
      'ning-rebel-zone',
      'ter-1479',
      'ming-chenghua-hongzhi',
      [115.1, 28.1, 117.2, 30.3]
    );
    const baseWithRebel = getCarvedContestedBase(
      'ning-rebel-base',
      base1479,
      ningRebelZone,
      {
        polityId: 'prince-ning-rebels',
        polityName: '宁王朱宸濠叛军控制区（南昌 · 九江）',
        shortLabel: '宁王叛军',
        ruler: '朱宸濠',
        controlType: 'direct',
        color: '#7C3AED',
        labelCoord: [115.9, 29.0],
      }
    );

    if (phaseIndex <= 1) {
      return {
        baseGeoJSON: baseWithRebel,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    if (phaseIndex === 2) {
      return buildSweepResponse(
        baseWithRebel,
        ningRebelZone,
        eased,
        [115.89, 28.68],
        2.2,
        2.0,
        eased * 1.4,
        {
          polityId: 'ming-chenghua-hongzhi',
          polityName: '王阳明平定南昌鄱阳湖叛区',
          shortLabel: '大明平定宁藩',
          controlType: 'direct',
          color: '#B83B2A',
          frontColor: '#F59E0B',
        },
        '局部平叛涂抹：王阳明火攻生擒朱宸濠，仅南昌九江叛区复归大明！'
      );
    }

    return {
      baseGeoJSON: base1479,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 8. 1559-1563 Qi Jiguang Anti-Wokou (ONLY Zhejiang-Fujian raided coastal strip changes!)
  if (campaignId === 'cmp-1561-qijiguang-wokou') {
    const base1582 = TERRITORY_SNAPSHOT_BY_ID['ter-1582'].geojson;
    const wokouCoastZone = getCachedBoxSlice(
      'wokou-raided-coast',
      'ter-1582',
      'ming-wanli-revival',
      [118.6, 24.7, 122.2, 29.4]
    );
    const baseWithWokou = getCarvedContestedBase(
      'wokou-coast-base',
      base1582,
      wokouCoastZone,
      {
        polityId: 'wokou-raided-zone',
        polityName: '倭寇侵扰浙闽沿海卫所区',
        shortLabel: '倭患侵扰海疆',
        ruler: '倭寇集团',
        controlType: 'direct',
        color: '#6B46C1',
        labelCoord: [120.8, 27.2],
      }
    );

    if (phaseIndex < 3) {
      return {
        baseGeoJSON: baseWithWokou,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    return buildSweepResponse(
      baseWithWokou,
      wokouCoastZone,
      eased,
      [119.17, 25.24],
      3.8,
      4.8,
      eased * 1.4,
      {
        polityId: 'ming-wanli-revival',
        polityName: '戚继光俞大猷肃清浙闽沿海倭患',
        shortLabel: '大明肃清海疆',
        controlType: 'direct',
        color: '#B83B2A',
        frontColor: '#F59E0B',
      },
      '局部海防涂抹：平海卫大捷荡平倭巢，仅浙闽受侵沿海恢复海晏河清！'
    );
  }

  // 9. 1592-1598 Wanli Imjin War in Korea
  if (campaignId === 'cmp-1592-imjin-korea') {
    return {
      baseGeoJSON: TERRITORY_SNAPSHOT_BY_ID['ter-1582'].geojson,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 10. 1619-1621 Battle of Sarhu (ONLY Shenyang-Liaoyang changes to Later Jin!)
  if (campaignId === 'cmp-1619-sarhu') {
    const base1582 = TERRITORY_SNAPSHOT_BY_ID['ter-1582'].geojson;
    if (phaseIndex === 3) {
      const liaodongCore = getCachedBoxSlice(
        'sarhu-liaodong',
        'ter-1621',
        'later-jin-nurhaci',
        [121.2, 39.5, 126.8, 43.8]
      );
      return buildSweepResponse(
        base1582,
        liaodongCore,
        eased,
        [124.83, 41.68],
        4.6,
        3.6,
        eased * 1.4,
        {
          polityId: 'later-jin-nurhaci',
          polityName: '后金攻占沈阳辽阳地区',
          shortLabel: '后金 · 努尔哈赤',
          controlType: 'direct',
          color: '#9A3412',
          frontColor: '#F59E0B',
        },
        '局部失地涂抹：努尔哈赤连克沈阳辽阳，仅辽河以东变更为后金控制！'
      );
    }
    return {
      baseGeoJSON: base1582,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 11. 1622-1627 Ningyuan & Guan-Ning Line (ONLY 400-li Liaoxi Corridor changes!)
  if (campaignId === 'cmp-1626-ningyuan-guangning') {
    const base1621 = TERRITORY_SNAPSHOT_BY_ID['ter-1621'].geojson;
    const corridor = getCachedBoxSlice(
      'guanning-corridor',
      'ter-1621',
      'ming-tianqi-guanning',
      [119.8, 40.0, 121.9, 41.6]
    );
    const baseContestedLiaoxi = getCarvedContestedBase(
      'guanning-contested-base',
      base1621,
      corridor,
      {
        polityId: 'liaoxi-abandoned',
        polityName: '广宁兵败后辽西动荡弃守走廊',
        shortLabel: '辽西弃守前沿',
        ruler: '后金游骑逼境',
        controlType: 'direct',
        color: '#9A3412',
        labelCoord: [120.73, 40.62],
      }
    );

    if (phaseIndex === 0) {
      return {
        baseGeoJSON: baseContestedLiaoxi,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    if (phaseIndex === 1) {
      return buildSweepResponse(
        baseContestedLiaoxi,
        corridor,
        eased,
        [119.78, 40.01],
        2.5,
        1.9,
        eased,
        {
          polityId: 'ming-tianqi-guanning',
          polityName: '孙承宗袁崇焕收复筑城辽西四百里',
          shortLabel: '关宁锦防线',
          controlType: 'direct',
          color: '#B83B2A',
          frontColor: '#F59E0B',
        },
        '局部收复涂抹：孙承宗督师山海关，仅辽西关宁走廊四百里复归大明！'
      );
    }

    return {
      baseGeoJSON: base1621,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 12. 1642-1662 Jiashen Fall, Shanhaiguan & Koxinga Recovering Taiwan
  if (campaignId === 'cmp-1644-jiashen-fall') {
    const base1642 = TERRITORY_SNAPSHOT_BY_ID['ter-1642'].geojson;
    if (phaseIndex === 0) {
      return {
        baseGeoJSON: base1642,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: false,
      };
    }

    const northChinaSlice = getCachedBoxSlice(
      'jiashen-shun-beijing',
      'ter-1644',
      'qing-dorgon-1644',
      [110.2, 35.0, 118.0, 41.0]
    );

    if (phaseIndex === 1) {
      return buildSweepResponse(
        base1642,
        northChinaSlice,
        eased,
        [108.94, 34.34],
        9.6,
        7.2,
        eased,
        {
          polityId: 'great-shun-sweep',
          polityName: '李自成大顺东征攻占山西京师',
          shortLabel: '大顺 · 李自成',
          controlType: 'direct',
          color: '#D97706',
          frontColor: '#FEF08A',
        },
        '局部疆域涂抹：李自成渡河破太原入北京，仅山西京畿变更为大顺！'
      );
    }

    if (phaseIndex === 2) {
      const baseShunInBeijing = getCarvedContestedBase(
        'jiashen-shun-beijing-base',
        TERRITORY_SNAPSHOT_BY_ID['ter-1644'].geojson,
        northChinaSlice,
        {
          polityId: 'great-shun-beijing',
          polityName: '大顺李自成占领京畿华北区',
          shortLabel: '大顺京畿防区',
          ruler: '李自成',
          controlType: 'direct',
          color: '#D97706',
          labelCoord: [115.5, 38.8],
        }
      );

      return buildSweepResponse(
        baseShunInBeijing,
        northChinaSlice,
        eased,
        [119.78, 40.01],
        9.8,
        7.0,
        eased * 1.4,
        {
          polityId: 'qing-dorgon-1644',
          polityName: '多尔衮清军入山海关接管华北',
          shortLabel: '大清入主京畿',
          controlType: 'direct',
          color: '#1E3A8A',
          frontColor: '#60A5FA',
        },
        '局部疆域涂抹：山海关击败李自成，仅京畿华北战区变更为清廷控制！'
      );
    }

    if (phaseIndex === 3) {
      const base1652 = TERRITORY_SNAPSHOT_BY_ID['ter-1652'].geojson;
      const taiwanIslandMp = getCachedBoxSlice(
        'jiashen-taiwan-island-only',
        'ter-1652',
        'southern-ming-yongli-koxinga',
        [119.8, 21.7, 122.3, 25.5]
      );
      const baseWithDutchTaiwan = getCarvedContestedBase(
        'jiashen-dutch-taiwan-base',
        base1652,
        taiwanIslandMp,
        {
          polityId: 'dutch-voc-taiwan',
          polityName: '荷属东印度殖民据点（热兰遮城）',
          shortLabel: '荷夷据台殖民点',
          ruler: '揆一',
          controlType: 'direct',
          color: '#EA580C',
          labelCoord: [120.95, 23.6],
        }
      );

      return buildSweepResponse(
        baseWithDutchTaiwan,
        taiwanIslandMp,
        eased,
        [120.14, 23.0],
        2.4,
        3.2,
        eased * 1.5,
        {
          polityId: 'southern-ming-yongli-koxinga',
          polityName: '国姓爷郑成功驱逐荷夷收复宝岛台湾',
          shortLabel: '明郑收复台湾',
          controlType: 'direct',
          color: '#B83B2A',
          frontColor: '#F59E0B',
        },
        '局部疆域涂抹：郑成功横渡鹿耳门受降揆一，仅宝岛台湾重归华夏版图！'
      );
    }
  }

  return {
    baseGeoJSON: TERRITORY_SNAPSHOT_BY_ID['ter-1363'].geojson,
    wipeOverlayGeoJSON: EMPTY_FC,
    caption: null,
    hasWipeInPhase: false,
  };
}
