import polygonClipping from 'polygon-clipping';
import { TERRITORY_SNAPSHOT_BY_ID } from '@/lib/atlasData';
import type { LngLat } from '@/types/ming';

type PcMultiPolygon = polygonClipping.MultiPolygon;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

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
  polityId: string
): { mp: PcMultiPolygon; props: Record<string, unknown> } {
  const snap = TERRITORY_SNAPSHOT_BY_ID[snapshotId];
  if (!snap) return { mp: [], props: {} };
  const feat = snap.geojson.features.find(
    (f) => String(f.properties?.polityId) === polityId
  );
  if (!feat) return { mp: [], props: {} };
  return {
    mp: toPcMultiPolygon(feat.geometry),
    props: (feat.properties ?? {}) as Record<string, unknown>,
  };
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

/**
 * Generates an organic ink-brush wavefront polygon expanding from `origin` (`[lng, lat]`)
 * so victorious territories sweep & paint over defeated lands like a calligrapher's brush!
 */
function buildOrganicBrushMask(
  origin: LngLat,
  rx: number,
  ry: number,
  seedAngle = 0
): PcMultiPolygon {
  if (rx <= 0.02 || ry <= 0.02) return [];
  const steps = 36;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const ripple =
      1 +
      0.085 * Math.sin(theta * 5 + seedAngle) +
      0.055 * Math.cos(theta * 3 - seedAngle * 0.7);
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
// PART 1: Era-to-Era Snapshot Victory Paint-Over (`全史运镜` & 时间轴跨朝代涂抹)
// ============================================================================

interface EraBrushTarget {
  polityId: string;
  origin: LngLat;
  maxRx: number;
  maxRy: number;
  frontColor?: string;
}

export interface EraWipePlan {
  caption: string;
  targets: EraBrushTarget[];
}

export function getEraWipePlan(
  fromSnapshotId: string,
  toSnapshotId: string
): EraWipePlan {
  const key = `${fromSnapshotId}->${toSnapshotId}`;

  if (key === 'ter-1356->ter-1363') {
    return {
      caption: '版图涂抹演进：陈友谅尽据湖广称汉 · 朱元璋拓地江南与陈汉隔江对峙',
      targets: [
        {
          polityId: 'chen-han',
          origin: [114.31, 30.55],
          maxRx: 9.5,
          maxRy: 7.5,
          frontColor: '#1E5F74',
        },
        {
          polityId: 'zhu-wu',
          origin: [118.8, 32.06],
          maxRx: 6.5,
          maxRy: 5.5,
          frontColor: '#B83B2A',
        },
        {
          polityId: 'ming-xia',
          origin: [106.55, 29.56],
          maxRx: 7.5,
          maxRy: 6.5,
          frontColor: '#805AD5',
        },
        {
          polityId: 'zhang-zhou',
          origin: [120.62, 31.3],
          maxRx: 4.5,
          maxRy: 4.5,
          frontColor: '#5B7A3E',
        },
      ],
    };
  }

  if (key === 'ter-1363->ter-1368') {
    return {
      caption: '胜利方版图涂抹：朱元璋平汉灭吴，徐达北伐席卷中原克复元大都！',
      targets: [
        {
          polityId: 'ming-empire',
          origin: [118.8, 32.06],
          maxRx: 17.5,
          maxRy: 14.5,
          frontColor: '#D97706',
        },
        {
          polityId: 'northern-yuan',
          origin: [112.5, 44.5],
          maxRx: 22.0,
          maxRy: 12.0,
          frontColor: '#4A5568',
        },
        {
          polityId: 'yunnan-liang',
          origin: [102.7, 25.05],
          maxRx: 7.0,
          maxRy: 6.0,
          frontColor: '#6B46C1',
        },
      ],
    };
  }

  if (key === 'ter-1368->ter-1388' || key === 'ter-1363->ter-1388') {
    return {
      caption:
        '胜利方版图涂抹：平定巴蜀明夏、征南灭元梁王、迫降辽东纳哈出，蓝玉奇袭捕鱼儿海一统洪武疆域！',
      targets: [
        {
          polityId: 'ming-hongwu-unified',
          origin: [115.2, 31.8],
          maxRx: 21.0,
          maxRy: 17.5,
          frontColor: '#F59E0B',
        },
        {
          polityId: 'liaodong-jurchen-tributary',
          origin: [122.5, 42.2],
          maxRx: 14.5,
          maxRy: 12.0,
          frontColor: '#9C4221',
        },
        {
          polityId: 'usang-hami-hongwu',
          origin: [102.5, 30.5],
          maxRx: 20.0,
          maxRy: 14.0,
          frontColor: '#B7791F',
        },
      ],
    };
  }

  if (key === 'ter-1368->ter-1399' || key === 'ter-1388->ter-1399') {
    return {
      caption: '版图涂抹演进：建文强行削藩激变 · 燕王朱棣北平誓师靖难并奇袭大宁！',
      targets: [
        {
          polityId: 'ming-jianwen',
          origin: [114.2, 31.5],
          maxRx: 20.0,
          maxRy: 16.0,
          frontColor: '#B83B2A',
        },
        {
          polityId: 'yan-rebels',
          origin: [116.41, 39.9],
          maxRx: 7.5,
          maxRy: 5.5,
          frontColor: '#F59E0B',
        },
      ],
    };
  }

  if (key === 'ter-1399->ter-1402') {
    return {
      caption: '胜利方版图涂抹：朱棣靖难南下入主南京，永乐盛世拓开奴儿干与关西羁縻宏图！',
      targets: [
        {
          polityId: 'ming-yongle',
          origin: [116.41, 39.9],
          maxRx: 22.0,
          maxRy: 22.0,
          frontColor: '#D97706',
        },
        {
          polityId: 'nurgan-urankhai',
          origin: [123.5, 42.2],
          maxRx: 19.0,
          maxRy: 15.0,
          frontColor: '#9C4221',
        },
        {
          polityId: 'guanxi-usang',
          origin: [101.8, 36.6],
          maxRx: 20.0,
          maxRy: 14.0,
          frontColor: '#B7791F',
        },
      ],
    };
  }

  if (key === 'ter-1402->ter-1415' || key === 'ter-1399->ter-1415') {
    return {
      caption:
        '胜利方版图涂抹：张辅平定安南设交趾布政使司（第十四省），亦失哈立碑特林达永乐极盛疆域！',
      targets: [
        {
          polityId: 'ming-yongle-zenith',
          origin: [108.5, 23.5],
          maxRx: 18.0,
          maxRy: 19.0,
          frontColor: '#F59E0B',
        },
        {
          polityId: 'nurgan-zenith',
          origin: [126.5, 44.5],
          maxRx: 22.0,
          maxRy: 16.0,
          frontColor: '#9C4221',
        },
      ],
    };
  }

  if (key === 'ter-1415->ter-1435') {
    return {
      caption:
        '版图演进涂抹：宣德罢交趾布政使司改封藩属、开平卫内迁独石；漠北瓦剌脱欢兼并鞑靼崛起！',
      targets: [
        {
          polityId: 'dai-viet-le',
          origin: [105.84, 21.03],
          maxRx: 6.5,
          maxRy: 6.5,
          frontColor: '#2F855A',
        },
        {
          polityId: 'oirat-toghon',
          origin: [102.8, 47.2],
          maxRx: 22.0,
          maxRy: 12.0,
          frontColor: '#4A5568',
        },
        {
          polityId: 'ming-renxuan',
          origin: [116.41, 39.9],
          maxRx: 21.0,
          maxRy: 19.0,
          frontColor: '#B83B2A',
        },
      ],
    };
  }

  if (key === 'ter-1435->ter-1449' || key === 'ter-1415->ter-1449') {
    return {
      caption:
        '版图演进涂抹：瓦剌太师也先西破哈密东胁三卫南逼宣大；于谦拥立景泰帝死守北京九门！',
      targets: [
        {
          polityId: 'oirat-esen',
          origin: [106.5, 46.5],
          maxRx: 25.0,
          maxRy: 14.0,
          frontColor: '#374151',
        },
        {
          polityId: 'ming-jingtai-defense',
          origin: [116.41, 39.9],
          maxRx: 21.0,
          maxRy: 19.0,
          frontColor: '#B83B2A',
        },
      ],
    };
  }

  // Universal fallback for multi-era jumps or reverse jumps (e.g. Reset to 1344 Opening)
  const destSnap = TERRITORY_SNAPSHOT_BY_ID[toSnapshotId];
  const fallbackTargets: EraBrushTarget[] = (destSnap?.geojson.features ?? []).map(
    (f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const coord = (p.labelCoord as LngLat | undefined) ?? [116.5, 33.5];
      return {
        polityId: String(p.polityId ?? ''),
        origin: coord,
        maxRx: 26,
        maxRy: 22,
        frontColor: String(p.color ?? '#B83B2A'),
      };
    }
  );

  return {
    caption: `版图涂抹切换：${destSnap?.meta.title ?? toSnapshotId}`,
    targets: fallbackTargets,
  };
}

export function buildEraWipeOverlayGeoJSON(
  toSnapshotId: string,
  plan: EraWipePlan,
  rawProgress: number
): GeoJSON.FeatureCollection {
  const destSnap = TERRITORY_SNAPSHOT_BY_ID[toSnapshotId];
  if (!destSnap || rawProgress <= 0.005) return EMPTY_FC;

  const eased = easeInOutCubic(rawProgress);
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < plan.targets.length; i++) {
    const tgt = plan.targets[i];
    const destFeat = destSnap.geojson.features.find(
      (f) => String(f.properties?.polityId) === tgt.polityId
    );
    if (!destFeat) continue;

    const targetMp = toPcMultiPolygon(destFeat.geometry);
    if (targetMp.length === 0) continue;

    const brush = buildOrganicBrushMask(
      tgt.origin,
      Math.max(0.35, tgt.maxRx * eased * 1.18),
      Math.max(0.35, tgt.maxRy * eased * 1.18),
      i * 1.3 + eased * 1.6
    );

    const clipped =
      eased >= 0.995 ? targetMp : polygonClipping.intersection(targetMp, brush);
    const feat = mpToFeature(clipped, {
      ...(destFeat.properties ?? {}),
      frontColor: tgt.frontColor ?? destFeat.properties?.color ?? '#D97706',
      isActivelyWiping: eased < 0.99 ? 1 : 0,
    });
    if (feat) features.push(feat);
  }

  return { type: 'FeatureCollection', features };
}

// ============================================================================
// PART 2: Live Battlefield Campaign Conquest Paint-Over (`战役分幕胜利涂抹`)
// ============================================================================

interface CachedNorthernSlices {
  basePostPoyang: GeoJSON.FeatureCollection;
  jiangnanMp: PcMultiPolygon;
  shandongMp: PcMultiPolygon;
  henanMp: PcMultiPolygon;
  ming1368Mp: PcMultiPolygon;
  chenHanMp: PcMultiPolygon;
  daningMp: PcMultiPolygon;
  baseJingnanPhase1: GeoJSON.FeatureCollection;
  jianwenMp: PcMultiPolygon;
}

let cachedSlices: CachedNorthernSlices | null = null;

function getCampaignGeoCache(): CachedNorthernSlices {
  if (cachedSlices) return cachedSlices;

  const ter1363 = TERRITORY_SNAPSHOT_BY_ID['ter-1363'].geojson;
  const ter1399 = TERRITORY_SNAPSHOT_BY_ID['ter-1399'].geojson;

  const { mp: chenHanMp } = findFeatureMultiPoly('ter-1363', 'chen-han');
  const { mp: zhangMp } = findFeatureMultiPoly('ter-1363', 'zhang-zhou');
  const { mp: fangMp } = findFeatureMultiPoly('ter-1363', 'fang-zhedong');
  const { mp: ming1368Mp } = findFeatureMultiPoly('ter-1368', 'ming-empire');
  const { mp: yan1399Mp, props: yanProps } = findFeatureMultiPoly(
    'ter-1399',
    'yan-rebels'
  );
  const { mp: jianwenMp, props: jianwenProps } = findFeatureMultiPoly(
    'ter-1399',
    'ming-jianwen'
  );

  // Jiangnan conquest in 1367 Phase 1 = Zhang Shicheng + Fang Guozhen
  const jiangnanMp = polygonClipping.union(zhangMp, fangMp);

  // Shandong conquest in 1368 Phase 2
  const shandongMp = polygonClipping.intersection(
    ming1368Mp,
    boxMultiPolygon(114.85, 34.15, 123.0, 38.35)
  );

  // Henan & Tongguan conquest in 1368 Phase 3
  const henanMp = polygonClipping.intersection(
    ming1368Mp,
    boxMultiPolygon(109.7, 31.8, 116.75, 36.35)
  );

  // Base map for 1367 Northern Expedition: Chen Youliang's Han already absorbed into Zhu's Wu!
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

  // For Jingnan Phase 1: split Daning (north of Yanshan lat 40.55, lng 117.1..123) as Ning Prince garrison
  const daningBox = boxMultiPolygon(117.15, 40.52, 123.5, 44.0);
  const daningMp = polygonClipping.intersection(yan1399Mp, daningBox);
  const beipingOnlyMp = polygonClipping.difference(yan1399Mp, daningBox);

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
      ...(daningMp.length
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
                coordinates: daningMp as unknown as number[][][][],
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
    ming1368Mp,
    chenHanMp,
    daningMp,
    baseJingnanPhase1,
    jianwenMp,
  };
  return cachedSlices;
}

export interface CampaignTerritoryFrame {
  baseGeoJSON: GeoJSON.FeatureCollection;
  wipeOverlayGeoJSON: GeoJSON.FeatureCollection;
  caption: string | null;
  hasWipeInPhase: boolean;
}

/**
 * Computes the base territory & progressive victory paint-over overlay for any Campaign Phase!
 * `wipeProgress` (`0..1`) sweeps smoothly after the phase's attacking arrows strike home.
 */
export function buildCampaignTerritoryFrame(
  campaignId: string,
  phaseIndex: number,
  wipeProgress: number
): CampaignTerritoryFrame {
  const cache = getCampaignGeoCache();
  const eased = easeInOutCubic(wipeProgress);

  // 1. 1363 Poyang Lake Campaign
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

    // Phase 5: Chen Youliang killed at Jingjiangkou -> Zhu Yuanzhang paints over Han territory!
    if (eased <= 0.01) {
      return {
        baseGeoJSON: base,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: true,
      };
    }

    const brush = buildOrganicBrushMask(
      [116.22, 29.74],
      Math.max(0.3, 8.2 * eased),
      Math.max(0.3, 6.8 * eased),
      eased * 1.5
    );
    const painted =
      eased >= 0.995
        ? cache.chenHanMp
        : polygonClipping.intersection(cache.chenHanMp, brush);
    const feat = mpToFeature(painted, {
      polityId: 'zhu-wu',
      polityName: '朱元璋（平定陈汉 · 尽收江西湖广）',
      shortLabel: '吴 · 朱元璋',
      controlType: 'direct',
      color: '#B83B2A',
      frontColor: '#F59E0B',
      isActivelyWiping: eased < 0.99 ? 1 : 0,
    });

    return {
      baseGeoJSON: base,
      wipeOverlayGeoJSON: feat
        ? { type: 'FeatureCollection', features: [feat] }
        : EMPTY_FC,
      caption:
        eased < 0.99
          ? '胜利方版图涂抹：陈友谅毙命泾江口，朱元璋乘胜席卷江西与武昌湖广！'
          : '版图已更新：朱元璋尽并陈汉故地，雄踞江南中上游',
      hasWipeInPhase: true,
    };
  }

  // 2. 1366-1368 Flat Wu & Hongwu Northern Expedition (All 4 Phases progressively paint Ming red!)
  if (campaignId === 'cmp-1367-northern-expedition') {
    const base = cache.basePostPoyang;
    const mingProps = {
      polityId: 'ming-empire',
      polityName: '大明北伐克复疆域',
      shortLabel: '大明帝国',
      controlType: 'direct',
      color: '#B83B2A',
      frontColor: '#F59E0B',
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
      addSweeping(cache.jiangnanMp, [119.55, 31.2], 5.2, 5.2);
      caption = '胜利方版图涂抹：徐达攻破平江灭张士诚，大明一统吴越江南！';
    } else if (phaseIndex === 1) {
      addStatic(cache.jiangnanMp);
      addSweeping(cache.shandongMp, [117.18, 34.26], 7.2, 5.2);
      caption = '胜利方版图涂抹：北伐大军攻克济南，平定山东全境！';
    } else if (phaseIndex === 2) {
      addStatic(cache.jiangnanMp);
      addStatic(cache.shandongMp);
      addSweeping(cache.henanMp, [116.59, 35.41], 8.2, 5.0);
      caption = '胜利方版图涂抹：旋师西进克复汴梁、洛阳，夺占潼关天险！';
    } else {
      addStatic(cache.jiangnanMp);
      addStatic(cache.shandongMp);
      addStatic(cache.henanMp);
      addSweeping(cache.ming1368Mp, [115.71, 36.84], 12.5, 10.5);
      caption = '胜利方版图涂抹：徐达攻克元大都改北平府，燕云十六州重归汉家版图！';
    }

    return {
      baseGeoJSON: base,
      wipeOverlayGeoJSON: { type: 'FeatureCollection', features },
      caption: eased > 0.01 ? caption : null,
      hasWipeInPhase: true,
    };
  }

  // 3. 1399-1402 Jingnan Campaign
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
      // Phase 2: Zhu Di raids Daning and paints Yan gold over Daning!
      const brush =
        eased > 0.01
          ? buildOrganicBrushMask(
              [116.41, 39.9],
              Math.max(0.25, 6.8 * eased),
              Math.max(0.25, 4.8 * eased),
              eased
            )
          : [];
      const clipped =
        eased <= 0.01
          ? []
          : eased >= 0.995
          ? cache.daningMp
          : polygonClipping.intersection(cache.daningMp, brush);
      const feat = mpToFeature(clipped, {
        polityId: 'yan-rebels',
        polityName: '燕王靖难军（并吞大宁都司）',
        shortLabel: '燕 · 朱棣',
        controlType: 'direct',
        color: '#C68B2C',
        frontColor: '#FDE68A',
        isActivelyWiping: eased < 0.99 ? 1 : 0,
      });

      return {
        baseGeoJSON: cache.baseJingnanPhase1,
        wipeOverlayGeoJSON: feat
          ? { type: 'FeatureCollection', features: [feat] }
          : EMPTY_FC,
        caption:
          eased > 0.01
            ? '胜利方版图涂抹：朱棣奇袭塞外大宁，收编宁王防区与朵颜三卫铁骑！'
            : null,
        hasWipeInPhase: true,
      };
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

    // Phase 5: Zhu Di blitzes Lingbi & crosses Yangtze into Nanjing -> sweeps southward across Jianwen Ming!
    if (eased <= 0.01) {
      return {
        baseGeoJSON: base1399,
        wipeOverlayGeoJSON: EMPTY_FC,
        caption: null,
        hasWipeInPhase: true,
      };
    }

    const brush = buildOrganicBrushMask(
      [116.41, 39.9],
      Math.max(0.35, 21.0 * eased),
      Math.max(0.35, 22.0 * eased),
      eased * 1.5
    );
    const clipped =
      eased >= 0.995
        ? cache.jianwenMp
        : polygonClipping.intersection(cache.jianwenMp, brush);
    const feat = mpToFeature(clipped, {
      polityId: 'yan-victory',
      polityName: '朱棣奉天靖难入主南京（永乐改元）',
      shortLabel: '大明 · 永乐大帝朱棣',
      controlType: 'direct',
      color: '#C68B2C',
      frontColor: '#FEF08A',
      isActivelyWiping: eased < 0.99 ? 1 : 0,
    });

    return {
      baseGeoJSON: base1399,
      wipeOverlayGeoJSON: feat
        ? { type: 'FeatureCollection', features: [feat] }
        : EMPTY_FC,
      caption:
        eased < 0.99
          ? '胜利方版图涂抹：燕军破灵璧渡长江入主金川门，自北向南席卷建文疆域！'
          : '版图已更新：朱棣奉天靖难功成登基，开启永乐盛世',
      hasWipeInPhase: true,
    };
  }

  // 4. 1387-1388 Nagachu Surrender & Buyur Lake Decisive Campaign
  if (campaignId === 'cmp-1387-buyur-lake') {
    const base1368 = TERRITORY_SNAPSHOT_BY_ID['ter-1368'].geojson;
    const base1388 = TERRITORY_SNAPSHOT_BY_ID['ter-1388'].geojson;

    if (phaseIndex === 0) {
      // Phase 1: Feng Sheng & Lan Yu force Nagachu's 200k army in Liaodong to surrender!
      const { mp: ming1388Mp } = findFeatureMultiPoly(
        'ter-1388',
        'ming-hongwu-unified'
      );
      const liaodongSlice = polygonClipping.intersection(
        ming1388Mp,
        boxMultiPolygon(118.2, 38.6, 126.2, 43.9)
      );
      const clipped =
        eased <= 0.01
          ? []
          : eased >= 0.995
          ? liaodongSlice
          : polygonClipping.intersection(
              liaodongSlice,
              buildOrganicBrushMask(
                [119.23, 41.59],
                Math.max(0.3, 7.2 * eased),
                Math.max(0.3, 5.2 * eased),
                eased * 1.4
              )
            );
      const feat = mpToFeature(clipped, {
        polityId: 'ming-hongwu-unified',
        polityName: '大明辽东都司与大宁防区（纳哈出二十万众降明）',
        shortLabel: '大明 · 辽东大宁',
        controlType: 'direct',
        color: '#B83B2A',
        frontColor: '#F59E0B',
        isActivelyWiping: eased < 0.99 ? 1 : 0,
      });

      return {
        baseGeoJSON: base1368,
        wipeOverlayGeoJSON: feat
          ? { type: 'FeatureCollection', features: [feat] }
          : EMPTY_FC,
        caption:
          eased > 0.01
            ? '胜利方版图涂抹：冯胜蓝玉迫降金山纳哈出二十万众，辽东全境归入大明！'
            : null,
        hasWipeInPhase: true,
      };
    }

    if (phaseIndex === 2) {
      // Phase 3: Lan Yu smashes Northern Yuan royal court at Buyur Lake!
      const { mp: yuanMp } = findFeatureMultiPoly(
        'ter-1388',
        'shattered-northern-yuan'
      );
      const buyurFrontier = polygonClipping.intersection(
        yuanMp,
        boxMultiPolygon(114.2, 44.5, 121.5, 50.2)
      );
      const clipped =
        eased <= 0.01
          ? []
          : eased >= 0.995
          ? buyurFrontier
          : polygonClipping.intersection(
              buyurFrontier,
              buildOrganicBrushMask(
                [117.72, 47.83],
                Math.max(0.25, 4.5 * eased),
                Math.max(0.25, 3.8 * eased),
                eased * 1.5
              )
            );
      const feat = mpToFeature(clipped, {
        polityId: 'ming-buyur-sweep',
        polityName: '蓝玉捕鱼儿海犁庭扫穴锋区',
        shortLabel: '明军犁庭锋区',
        controlType: 'tributary-garrison',
        color: '#B83B2A',
        frontColor: '#F59E0B',
        isActivelyWiping: eased < 0.99 ? 1 : 0,
      });
      return {
        baseGeoJSON: base1388,
        wipeOverlayGeoJSON: feat
          ? { type: 'FeatureCollection', features: [feat] }
          : EMPTY_FC,
        caption:
          eased > 0.01
            ? '胜利方版图涂抹：蓝玉奇袭捕鱼儿海端掉北元汗廷，漠北王庭彻底瓦解！'
            : null,
        hasWipeInPhase: true,
      };
    }

    return {
      baseGeoJSON: base1388,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  // 5. 1405-1433 Zheng He's Seven Voyages to the Western Ocean
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

    if (phaseIndex === 2) {
      // Phase 3: Tumu catastrophe -> Esen's Oirat cavalry sweeps across Xuan-Da frontier!
      const { mp: esenMp } = findFeatureMultiPoly('ter-1449', 'oirat-esen');
      const southPush = polygonClipping.intersection(
        esenMp,
        boxMultiPolygon(108.0, 39.2, 121.0, 44.8)
      );
      const clipped =
        eased <= 0.01
          ? []
          : eased >= 0.995
          ? southPush
          : polygonClipping.intersection(
              southPush,
              buildOrganicBrushMask(
                [114.2, 41.5],
                Math.max(0.3, 7.5 * eased),
                Math.max(0.3, 4.5 * eased),
                eased
              )
            );
      const feat = mpToFeature(clipped, {
        polityId: 'oirat-esen',
        polityName: '瓦剌太师也先南侵控制区',
        shortLabel: '瓦剌铁骑逼境',
        controlType: 'direct',
        color: '#374151',
        frontColor: '#EF4444',
        isActivelyWiping: eased < 0.99 ? 1 : 0,
      });
      return {
        baseGeoJSON: base1435,
        wipeOverlayGeoJSON: feat
          ? { type: 'FeatureCollection', features: [feat] }
          : EMPTY_FC,
        caption:
          eased > 0.01
            ? '战局突变涂抹：土木堡二十万明军覆没，瓦剌铁骑席卷漠南直逼紫荆关与北京！'
            : null,
        hasWipeInPhase: true,
      };
    }

    if (phaseIndex === 4) {
      // Phase 5: Yu Qian defeats Esen at Beijing's Nine Gates -> sweeps Ming crimson back over Juyong-Xuan-Da!
      const { mp: mingMp } = findFeatureMultiPoly(
        'ter-1449',
        'ming-jingtai-defense'
      );
      const northShield = polygonClipping.intersection(
        mingMp,
        boxMultiPolygon(111.8, 38.2, 119.8, 41.3)
      );
      const clipped =
        eased <= 0.01
          ? []
          : eased >= 0.995
          ? northShield
          : polygonClipping.intersection(
              northShield,
              buildOrganicBrushMask(
                [116.38, 39.95],
                Math.max(0.25, 5.5 * eased),
                Math.max(0.25, 3.2 * eased),
                eased * 1.4
              )
            );
      const feat = mpToFeature(clipped, {
        polityId: 'ming-jingtai-defense',
        polityName: '于谦收复巩固京畿宣大紫荆防线',
        shortLabel: '大明收复京畿九边',
        controlType: 'direct',
        color: '#B83B2A',
        frontColor: '#F59E0B',
        isActivelyWiping: eased < 0.99 ? 1 : 0,
      });
      return {
        baseGeoJSON: base1449,
        wipeOverlayGeoJSON: feat
          ? { type: 'FeatureCollection', features: [feat] }
          : EMPTY_FC,
        caption:
          eased > 0.01
            ? '胜利方版图涂抹：于谦德胜门背城大破瓦剌，收复紫荆关稳固京畿九边防线！'
            : null,
        hasWipeInPhase: true,
      };
    }

    return {
      baseGeoJSON: phaseIndex < 2 ? base1435 : base1449,
      wipeOverlayGeoJSON: EMPTY_FC,
      caption: null,
      hasWipeInPhase: false,
    };
  }

  return {
    baseGeoJSON: TERRITORY_SNAPSHOT_BY_ID['ter-1363'].geojson,
    wipeOverlayGeoJSON: EMPTY_FC,
    caption: null,
    hasWipeInPhase: false,
  };
}
