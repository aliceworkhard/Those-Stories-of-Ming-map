import tocJson from '@data/chapters/toc.json';
import placesJson from '@data/geo-base/ming-places.json';
import waterwaysGeoJson from '@data/geo-base/ming-waterways.json';
import landformsGeoJson from '@data/geo-base/ming-landforms.json';
import institutionsGeoJson from '@data/geo-base/ming-institutions.json';
import landMaskGeoJson from '@data/geo-base/land-mask-east-asia.json';
import odysseysJson from '@data/characters/odysseys.json';
import territoriesIndexJson from '@data/territories/index.json';

import ter1356 from '@data/territories/ter-1356.json';
import ter1363 from '@data/territories/ter-1363.json';
import ter1368 from '@data/territories/ter-1368.json';
import ter1388 from '@data/territories/ter-1388.json';
import ter1399 from '@data/territories/ter-1399.json';
import ter1402 from '@data/territories/ter-1402.json';
import ter1415 from '@data/territories/ter-1415.json';
import ter1435 from '@data/territories/ter-1435.json';
import ter1449 from '@data/territories/ter-1449.json';
import ter1479 from '@data/territories/ter-1479.json';
import ter1582 from '@data/territories/ter-1582.json';
import ter1621 from '@data/territories/ter-1621.json';
import ter1642 from '@data/territories/ter-1642.json';
import ter1644 from '@data/territories/ter-1644.json';
import ter1652 from '@data/territories/ter-1652.json';

import eventsFoundingJson from '@data/events/era-founding.json';
import eventsJingnanJson from '@data/events/era-jingnan.json';
import eventsYongleRenxuanJson from '@data/events/era-yongle-renxuan.json';
import eventsTumuJingtaiJson from '@data/events/era-tumu-jingtai.json';
import eventsMidMingJson from '@data/events/era-mid-ming.json';
import eventsWanliReformJson from '@data/events/era-wanli-reform.json';
import eventsCollapseNanmingJson from '@data/events/era-collapse-nanming.json';

import cmpPoyangJson from '@data/campaigns/cmp-1363-poyang.json';
import cmpNorthJson from '@data/campaigns/cmp-1367-northern-expedition.json';
import cmpBuyurJson from '@data/campaigns/cmp-1387-buyur-lake.json';
import cmpJingnanJson from '@data/campaigns/cmp-1399-jingnan.json';
import cmpZhengheJson from '@data/campaigns/cmp-1405-zhenghe-voyages.json';
import cmpTumuJson from '@data/campaigns/cmp-1449-tumu-beijing.json';
import cmpNingJson from '@data/campaigns/cmp-1519-ning-rebellion.json';
import cmpQiJson from '@data/campaigns/cmp-1561-qijiguang-wokou.json';
import cmpImjinJson from '@data/campaigns/cmp-1592-imjin-korea.json';
import cmpSarhuJson from '@data/campaigns/cmp-1619-sarhu.json';
import cmpNingyuanJson from '@data/campaigns/cmp-1626-ningyuan-guangning.json';
import cmpJiashenJson from '@data/campaigns/cmp-1644-jiashen-fall.json';

import type {
  BookTocIndex,
  Campaign,
  ChapterAnchor,
  CharacterOdyssey,
  HistoricalEvent,
  HistoricalPlace,
  PlaceNameMode,
  TerritorySnapshotMeta,
} from '@/types/ming';

export const BOOK_TOC = tocJson as unknown as BookTocIndex;

export const CHAPTER_MAP: Record<string, ChapterAnchor> = Object.fromEntries(
  BOOK_TOC.chapters.map((ch) => [ch.id, ch])
);

export const PLACES = placesJson as unknown as HistoricalPlace[];
export const PLACE_MAP: Record<string, HistoricalPlace> = Object.fromEntries(
  PLACES.map((p) => [p.id, p])
);

export const MING_WATERWAYS_GEOJSON =
  waterwaysGeoJson as unknown as GeoJSON.FeatureCollection;

export const MING_LANDFORMS_GEOJSON =
  landformsGeoJson as unknown as GeoJSON.FeatureCollection;

export const MING_INSTITUTIONS_GEOJSON =
  institutionsGeoJson as unknown as GeoJSON.FeatureCollection;

export const EAST_ASIA_LAND_MASK_GEOJSON =
  landMaskGeoJson as unknown as GeoJSON.FeatureCollection;

export const ALL_CHARACTERS = odysseysJson as unknown as CharacterOdyssey[];
export const CHARACTER_MAP: Record<string, CharacterOdyssey> =
  Object.fromEntries(ALL_CHARACTERS.map((c) => [c.id, c]));

export const TERRITORY_INDEX =
  territoriesIndexJson as unknown as TerritorySnapshotMeta[];

const TERRITORY_DATA_BY_FILE: Record<string, GeoJSON.FeatureCollection> = {
  'ter-1356.json': ter1356 as unknown as GeoJSON.FeatureCollection,
  'ter-1363.json': ter1363 as unknown as GeoJSON.FeatureCollection,
  'ter-1368.json': ter1368 as unknown as GeoJSON.FeatureCollection,
  'ter-1388.json': ter1388 as unknown as GeoJSON.FeatureCollection,
  'ter-1399.json': ter1399 as unknown as GeoJSON.FeatureCollection,
  'ter-1402.json': ter1402 as unknown as GeoJSON.FeatureCollection,
  'ter-1415.json': ter1415 as unknown as GeoJSON.FeatureCollection,
  'ter-1435.json': ter1435 as unknown as GeoJSON.FeatureCollection,
  'ter-1449.json': ter1449 as unknown as GeoJSON.FeatureCollection,
  'ter-1479.json': ter1479 as unknown as GeoJSON.FeatureCollection,
  'ter-1582.json': ter1582 as unknown as GeoJSON.FeatureCollection,
  'ter-1621.json': ter1621 as unknown as GeoJSON.FeatureCollection,
  'ter-1642.json': ter1642 as unknown as GeoJSON.FeatureCollection,
  'ter-1644.json': ter1644 as unknown as GeoJSON.FeatureCollection,
  'ter-1652.json': ter1652 as unknown as GeoJSON.FeatureCollection,
};

export const TERRITORY_SNAPSHOT_BY_ID: Record<
  string,
  { meta: TerritorySnapshotMeta; geojson: GeoJSON.FeatureCollection }
> = Object.fromEntries(
  TERRITORY_INDEX.map((meta) => [
    meta.snapshotId,
    {
      meta,
      geojson:
        TERRITORY_DATA_BY_FILE[meta.file] ??
        TERRITORY_DATA_BY_FILE['ter-1356.json'],
    },
  ])
);

export const ALL_EVENTS: HistoricalEvent[] = [
  ...(eventsFoundingJson as unknown as HistoricalEvent[]),
  ...(eventsJingnanJson as unknown as HistoricalEvent[]),
  ...(eventsYongleRenxuanJson as unknown as HistoricalEvent[]),
  ...(eventsTumuJingtaiJson as unknown as HistoricalEvent[]),
  ...(eventsMidMingJson as unknown as HistoricalEvent[]),
  ...(eventsWanliReformJson as unknown as HistoricalEvent[]),
  ...(eventsCollapseNanmingJson as unknown as HistoricalEvent[]),
].sort(
  (a, b) =>
    a.time.year - b.time.year || (a.time.month ?? 1) - (b.time.month ?? 1)
);

export const EVENT_MAP: Record<string, HistoricalEvent> = Object.fromEntries(
  ALL_EVENTS.map((e) => [e.id, e])
);

export const ALL_CAMPAIGNS: Campaign[] = [
  cmpPoyangJson as unknown as Campaign,
  cmpNorthJson as unknown as Campaign,
  cmpBuyurJson as unknown as Campaign,
  cmpJingnanJson as unknown as Campaign,
  cmpZhengheJson as unknown as Campaign,
  cmpTumuJson as unknown as Campaign,
  cmpNingJson as unknown as Campaign,
  cmpQiJson as unknown as Campaign,
  cmpImjinJson as unknown as Campaign,
  cmpSarhuJson as unknown as Campaign,
  cmpNingyuanJson as unknown as Campaign,
  cmpJiashenJson as unknown as Campaign,
];

export const CAMPAIGN_MAP: Record<string, Campaign> = Object.fromEntries(
  ALL_CAMPAIGNS.map((c) => [c.id, c])
);

export function getSnapshotForYear(year: number): {
  meta: TerritorySnapshotMeta;
  geojson: GeoJSON.FeatureCollection;
} {
  const matched =
    TERRITORY_INDEX.find(
      (item) => year >= item.effectiveRange[0] && year <= item.effectiveRange[1]
    ) ??
    (year < TERRITORY_INDEX[0].effectiveRange[0]
      ? TERRITORY_INDEX[0]
      : TERRITORY_INDEX[TERRITORY_INDEX.length - 1]);

  return {
    meta: matched,
    geojson:
      TERRITORY_DATA_BY_FILE[matched.file] ??
      TERRITORY_DATA_BY_FILE['ter-1363.json'],
  };
}

export function formatPlaceDisplay(
  ancientName: string,
  modernName: string,
  mode: PlaceNameMode
): string {
  const shortAncient = ancientName.replace(/（.+?）/g, '');
  const shortModern = modernName.replace(
    /^(江苏|安徽|江西|湖北|湖南|浙江|山东|河南|河北|山西|陕西|四川|福建|广东|广西|云南|贵州|辽宁|吉林|黑龙江|新疆|宁夏|内蒙古|台湾)/,
    ''
  );
  if (mode === 'ancient') return shortAncient;
  if (mode === 'modern') return shortModern;
  if (shortAncient === shortModern) return shortAncient;
  return `${shortAncient} · ${shortModern}`;
}

export const PLACES_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: PLACES.map((p) => ({
    type: 'Feature',
    properties: {
      id: p.id,
      placeType: p.type,
      sortKey:
        p.type === 'capital'
          ? 1
          : p.type === 'garrison-nine'
          ? 2
          : p.type === 'pass'
          ? 3
          : 4,
      label_ancient: formatPlaceDisplay(p.ancientName, p.modernName, 'ancient'),
      label_both: formatPlaceDisplay(p.ancientName, p.modernName, 'both'),
      label_modern: formatPlaceDisplay(p.ancientName, p.modernName, 'modern'),
      strategicNote: p.strategicNote ?? '',
    },
    geometry: {
      type: 'Point',
      coordinates: p.coordinates,
    },
  })),
};
