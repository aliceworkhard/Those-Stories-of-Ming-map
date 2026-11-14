import tocJson from '@data/chapters/toc.json';
import placesJson from '@data/geo-base/ming-places.json';
import waterwaysGeoJson from '@data/geo-base/ming-waterways.json';
import territoriesIndexJson from '@data/territories/index.json';
import ter1356 from '@data/territories/ter-1356.json';
import ter1363 from '@data/territories/ter-1363.json';
import ter1368 from '@data/territories/ter-1368.json';
import ter1399 from '@data/territories/ter-1399.json';
import ter1402 from '@data/territories/ter-1402.json';
import eventsFoundingJson from '@data/events/era-founding.json';
import eventsJingnanJson from '@data/events/era-jingnan.json';
import cmpPoyangJson from '@data/campaigns/cmp-1363-poyang.json';
import cmpNorthJson from '@data/campaigns/cmp-1367-northern-expedition.json';
import cmpJingnanJson from '@data/campaigns/cmp-1399-jingnan.json';

import type {
  BookTocIndex,
  Campaign,
  ChapterAnchor,
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

export const MING_WATERWAYS_GEOJSON = waterwaysGeoJson as unknown as GeoJSON.FeatureCollection;

export const TERRITORY_INDEX = territoriesIndexJson as unknown as TerritorySnapshotMeta[];

const TERRITORY_DATA_BY_FILE: Record<string, GeoJSON.FeatureCollection> = {
  'ter-1356.json': ter1356 as unknown as GeoJSON.FeatureCollection,
  'ter-1363.json': ter1363 as unknown as GeoJSON.FeatureCollection,
  'ter-1368.json': ter1368 as unknown as GeoJSON.FeatureCollection,
  'ter-1399.json': ter1399 as unknown as GeoJSON.FeatureCollection,
  'ter-1402.json': ter1402 as unknown as GeoJSON.FeatureCollection,
};

export const ALL_EVENTS: HistoricalEvent[] = [
  ...(eventsFoundingJson as unknown as HistoricalEvent[]),
  ...(eventsJingnanJson as unknown as HistoricalEvent[]),
].sort((a, b) => a.time.year - b.time.year || (a.time.month ?? 1) - (b.time.month ?? 1));

export const EVENT_MAP: Record<string, HistoricalEvent> = Object.fromEntries(
  ALL_EVENTS.map((e) => [e.id, e])
);

export const ALL_CAMPAIGNS: Campaign[] = [
  cmpPoyangJson as unknown as Campaign,
  cmpNorthJson as unknown as Campaign,
  cmpJingnanJson as unknown as Campaign,
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
    geojson: TERRITORY_DATA_BY_FILE[matched.file] ?? TERRITORY_DATA_BY_FILE['ter-1363.json'],
  };
}

export function formatPlaceDisplay(
  ancientName: string,
  modernName: string,
  mode: PlaceNameMode
): string {
  const shortAncient = ancientName.replace(/（.+?）/g, '');
  const shortModern = modernName.replace(/^(江苏|安徽|江西|湖北|浙江|山东|河南|河北|陕西|四川|内蒙古)/, '');
  if (mode === 'ancient') return ancientName;
  if (mode === 'modern') return modernName;
  if (shortAncient === shortModern) return ancientName;
  return `${shortAncient}（今${shortModern}）`;
}
