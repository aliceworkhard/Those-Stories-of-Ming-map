import type maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import {
  ALL_EVENTS,
  CHARACTER_MAP,
  EVENT_MAP,
  MING_INSTITUTIONS_GEOJSON,
  MING_LANDFORMS_GEOJSON,
  MING_MACRO_HISTORY_GEOJSON,
  MING_TACTICAL_MICRO_GEOJSON,
  MING_WATERWAYS_GEOJSON,
  PLACES_GEOJSON,
} from '@/lib/atlasData';
import {
  buildCurvedRouteCoords,
  sampleAlongPath,
} from '@/lib/curve';
import type {
  Campaign,
  CampaignPhase,
  HistoricalEvent,
  LngLat,
  MapVisualTheme,
  PlaceNameMode,
} from '@/types/ming';
import type {
  CampaignArrowMode,
  LayerVisibility,
} from '@/store/useAtlasStore';

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

export interface PreparedRouteCurve {
  id: string;
  stepNo: number;
  startAt: number;
  endAt: number;
  color: string;
  tactic: string;
  label: string;
  commander?: string;
  coords: LngLat[];
  startPoint: LngLat;
  endPoint: LngLat;
  midPoint: LngLat;
}

export function computeSequentialRouteWindows(
  count: number
): Array<{ startAt: number; endAt: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ startAt: 0, endAt: 1 }];
  const gap = 0.06;
  const span = (1 - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, idx) => {
    const startAt = idx * (span + gap);
    return {
      startAt,
      endAt: Math.min(1, startAt + span),
    };
  });
}

export function buildPolityLabelGeoJSON(
  territories: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const feat of territories.features) {
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const coord = props.labelCoord as LngLat | undefined;
    if (!coord) continue;
    const shortLabel = String(props.shortLabel || props.polityName || '');
    const ruler = String(props.ruler || '');
    const isTributary = props.controlType === 'tributary-garrison';
    const sealTitle = isTributary ? `${shortLabel}（羁縻）` : shortLabel;
    const subCaption = ruler ? `${ruler}` : '';

    features.push({
      type: 'Feature',
      properties: {
        polityId: String(props.polityId || ''),
        sealTitle,
        subCaption,
        color: String(props.color || '#B83B2A'),
        isTributary: isTributary ? 1 : 0,
      },
      geometry: {
        type: 'Point',
        coordinates: coord,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildCausalArcGeoJSON(
  selectedEvent: HistoricalEvent | null | undefined
): GeoJSON.FeatureCollection {
  if (!selectedEvent) return EMPTY_FC;
  const features: GeoJSON.Feature[] = [];

  for (const prevId of selectedEvent.why.prevEventIds ?? []) {
    const prevEvt = EVENT_MAP[prevId];
    if (!prevEvt) continue;
    const d = Math.hypot(
      prevEvt.location.coordinates[0] - selectedEvent.location.coordinates[0],
      prevEvt.location.coordinates[1] - selectedEvent.location.coordinates[1]
    );
    if (d < 0.03) continue;

    const arcCoords = buildCurvedRouteCoords(
      [prevEvt.location.coordinates, selectedEvent.location.coordinates],
      'ambush',
      20
    );
    features.push({
      type: 'Feature',
      properties: {
        arcKind: 'prev',
        label: `前因：${prevEvt.time.year} ${prevEvt.title.slice(0, 8)}`,
      },
      geometry: {
        type: 'LineString',
        coordinates: arcCoords,
      },
    });
  }

  for (const nextId of selectedEvent.why.nextEventIds ?? []) {
    const nextEvt = EVENT_MAP[nextId];
    if (!nextEvt) continue;
    const d = Math.hypot(
      nextEvt.location.coordinates[0] - selectedEvent.location.coordinates[0],
      nextEvt.location.coordinates[1] - selectedEvent.location.coordinates[1]
    );
    if (d < 0.03) continue;

    const arcCoords = buildCurvedRouteCoords(
      [selectedEvent.location.coordinates, nextEvt.location.coordinates],
      'assault',
      20
    );
    features.push({
      type: 'Feature',
      properties: {
        arcKind: 'next',
        label: `后果 → ${nextEvt.time.year} ${nextEvt.title.slice(0, 8)}`,
      },
      geometry: {
        type: 'LineString',
        coordinates: arcCoords,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Installs all historical GIS, Landforms, Places, Events, Causal Arcs & Campaign WebGL layers.
 * 100% GPU-accelerated — ZERO HTML DOM `maplibregl.Marker` nodes!
 */
export function mountHistoricalLayers(
  map: maplibregl.Map,
  initialTerritories: GeoJSON.FeatureCollection,
  theme: MapVisualTheme,
  placeNameMode: PlaceNameMode = 'both'
): void {
  const isDark = theme === 'xuanmo';
  const beforeWaterId = map.getLayer('vector-water-fill')
    ? 'vector-water-fill'
    : undefined;
  const beforeTerrainShadeId = map.getLayer('mountain-hillshade')
    ? 'mountain-hillshade'
    : beforeWaterId;

  // =========================================================================
  // 1. Sovereign Territories + Victory Brush Paint-Over Layer Stack
  // =========================================================================
  if (!map.getSource('ming-territories')) {
    map.addSource('ming-territories', {
      type: 'geojson',
      data: initialTerritories,
    });
  }

  if (!map.getSource('ming-territory-wipe')) {
    map.addSource('ming-territory-wipe', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getSource('ming-polity-points')) {
    map.addSource('ming-polity-points', {
      type: 'geojson',
      data: buildPolityLabelGeoJSON(initialTerritories),
    });
  }

  if (!map.getLayer('ming-territories-fill')) {
    map.addLayer(
      {
        id: 'ming-territories-fill',
        type: 'fill',
        source: 'ming-territories',
        paint: {
          'fill-antialias': false,
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'match',
            ['get', 'controlType'],
            'tributary-garrison',
            isDark ? 0.14 : 0.12,
            isDark ? 0.24 : 0.19,
          ],
        },
      },
      beforeTerrainShadeId
    );

    map.addLayer(
      {
        id: 'ming-territories-frontier-band',
        type: 'line',
        source: 'ming-territories',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3.5,
            ['match', ['get', 'controlType'], 'tributary-garrison', 2.4, 4.5],
            7,
            ['match', ['get', 'controlType'], 'tributary-garrison', 4.0, 8.0],
            10,
            ['match', ['get', 'controlType'], 'tributary-garrison', 6.0, 11.0],
          ],
          'line-opacity': [
            'match',
            ['get', 'controlType'],
            'tributary-garrison',
            isDark ? 0.18 : 0.15,
            isDark ? 0.32 : 0.25,
          ],
          'line-blur': 2.0,
        },
      },
      beforeTerrainShadeId
    );

    map.addLayer(
      {
        id: 'ming-territories-outline-casing',
        type: 'line',
        source: 'ming-territories',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': isDark
            ? 'rgba(6, 10, 16, 0.72)'
            : 'rgba(253, 249, 240, 0.72)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3.5,
            2.4,
            7,
            3.6,
            10,
            4.8,
          ],
          'line-opacity': 0.72,
        },
      },
      beforeTerrainShadeId
    );

    map.addLayer(
      {
        id: 'ming-territories-outline',
        type: 'line',
        source: 'ming-territories',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['coalesce', ['get', 'borderColor'], ['get', 'color']],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3.5,
            ['match', ['get', 'controlType'], 'tributary-garrison', 1.1, 1.8],
            7,
            ['match', ['get', 'controlType'], 'tributary-garrison', 1.6, 2.6],
            10,
            ['match', ['get', 'controlType'], 'tributary-garrison', 2.1, 3.4],
          ],
          'line-dasharray': [
            'match',
            ['get', 'controlType'],
            'tributary-garrison',
            ['literal', [3, 2]],
            ['literal', [1, 0]],
          ],
          'line-opacity': isDark ? 0.94 : 0.9,
        },
      },
      beforeTerrainShadeId
    );

    // --- VICTORY BRUSH PAINT-OVER ("胜利方版图涂抹覆盖层" — Ultra-Light 3-Layer Stack) ---
    map.addLayer(
      {
        id: 'ming-territory-wipe-eraser',
        type: 'fill',
        source: 'ming-territory-wipe',
        paint: {
          'fill-antialias': false,
          'fill-color': isDark ? '#0F141D' : '#EFE6D4',
          'fill-opacity': 1.0,
        },
      },
      beforeTerrainShadeId
    );

    map.addLayer(
      {
        id: 'ming-territory-wipe-fill',
        type: 'fill',
        source: 'ming-territory-wipe',
        filter: ['!=', ['get', 'isEraserOnly'], 1],
        paint: {
          'fill-antialias': false,
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'match',
            ['get', 'controlType'],
            'tributary-garrison',
            isDark ? 0.16 : 0.14,
            isDark ? 0.28 : 0.23,
          ],
        },
      },
      beforeTerrainShadeId
    );

    map.addLayer(
      {
        id: 'ming-territory-wipe-outline',
        type: 'line',
        source: 'ming-territory-wipe',
        filter: ['!=', ['get', 'isEraserOnly'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.0, 8, 3.2],
          'line-opacity': 0.94,
        },
      },
      beforeTerrainShadeId
    );
  }

  if (!map.getLayer('ming-territories-hover')) {
    map.addLayer({
      id: 'ming-territory-wipe-front',
      type: 'line',
      source: 'ming-territory-wipe',
      filter: ['==', ['get', 'isActivelyWiping'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'frontColor'], '#F59E0B'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 3.0, 8, 5.0],
        'line-opacity': 0.9,
      },
    });

    map.addLayer({
      id: 'ming-territories-hover',
      type: 'line',
      source: 'ming-territories',
      filter: ['==', ['get', 'polityId'], '__none__'],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#FCD34D' : '#9B1C1C',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.5, 8, 4.2],
        'line-opacity': 0.95,
      },
    });
  }

  // =========================================================================
  // 2. Ming Historical Waterways & Great Wall
  // =========================================================================
  if (!map.getSource('ming-waterways')) {
    map.addSource('ming-waterways', {
      type: 'geojson',
      data: MING_WATERWAYS_GEOJSON,
    });
  }

  if (!map.getLayer('ming-rivers-line')) {
    map.addLayer({
      id: 'ming-rivers-casing',
      type: 'line',
      source: 'ming-waterways',
      filter: [
        'in',
        ['get', 'kind'],
        ['literal', ['major-river', 'secondary-river']],
      ],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#071320' : '#E8F3F8',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          ['match', ['get', 'kind'], 'major-river', 2.4, 1.3],
          7,
          ['match', ['get', 'kind'], 'major-river', 4.4, 2.4],
          10,
          ['match', ['get', 'kind'], 'major-river', 6.4, 3.6],
        ],
        'line-opacity': isDark ? 0.58 : 0.7,
      },
    });

    map.addLayer({
      id: 'ming-rivers-line',
      type: 'line',
      source: 'ming-waterways',
      filter: [
        'in',
        ['get', 'kind'],
        ['literal', ['major-river', 'secondary-river']],
      ],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#3B89C4' : '#2E7296',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          ['match', ['get', 'kind'], 'major-river', 1.4, 0.75],
          7,
          ['match', ['get', 'kind'], 'major-river', 2.8, 1.5],
          10,
          ['match', ['get', 'kind'], 'major-river', 4.2, 2.3],
        ],
        'line-opacity': 0.92,
      },
    });

    map.addLayer({
      id: 'ming-yellow-river-casing',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'yellow-river-ming'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#1C1406' : '#FDF6E4',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.8, 7, 4.8, 10, 7.0],
        'line-opacity': 0.78,
      },
    });

    map.addLayer({
      id: 'ming-yellow-river-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'yellow-river-ming'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#EAB338' : '#B97316',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 1.6, 7, 3.0, 10, 4.4],
        'line-opacity': 0.96,
      },
    });

    map.addLayer({
      id: 'ming-grand-canal-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'canal'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#38C6BD' : '#0B7D72',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 7, 2.4, 10, 3.4],
        'line-dasharray': [2.2, 1.4],
        'line-opacity': 0.94,
      },
    });

    map.addLayer({
      id: 'ming-great-wall-casing',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'great-wall'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#0B0F17' : '#EFE5D4',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 3.0, 7, 5.0, 10, 6.8],
        'line-opacity': 0.72,
      },
    });

    map.addLayer({
      id: 'ming-great-wall-base',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'great-wall'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#94A3B8' : '#6B5344',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 1.3, 7, 2.2, 10, 3.0],
        'line-opacity': 0.85,
      },
    });

    map.addLayer({
      id: 'ming-great-wall-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'great-wall'],
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': isDark ? '#E2E8F0' : '#3E2E24',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.2, 7, 3.6, 10, 5.0],
        'line-dasharray': [1.2, 1.4],
        'line-opacity': 0.92,
      },
    });
  }

  // =========================================================================
  // 3. Classical Landforms & Waterway Labels — 100% GPU!
  // =========================================================================
  if (!map.getSource('ming-landforms')) {
    map.addSource('ming-landforms', {
      type: 'geojson',
      data: MING_LANDFORMS_GEOJSON,
    });
  }

  if (!map.getLayer('ming-mountains-label')) {
    map.addLayer({
      id: 'ming-mountains-label',
      type: 'symbol',
      source: 'ming-landforms',
      minzoom: 4.0,
      filter: [
        'in',
        ['get', 'kind'],
        ['literal', ['mountain-major', 'mountain-minor']],
      ],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 600,
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          ['match', ['get', 'kind'], 'mountain-major', 11, 9.5],
          7.5,
          ['match', ['get', 'kind'], 'mountain-major', 14.5, 12],
        ],
        'text-letter-spacing': 0.35,
        'text-max-angle': 35,
      },
      paint: {
        'text-color': isDark ? '#A89474' : '#6A5337',
        'text-halo-color': isDark
          ? 'rgba(12, 16, 23, 0.9)'
          : 'rgba(244, 237, 222, 0.94)',
        'text-halo-width': 1.45,
        'text-halo-blur': 0.2,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4.0,
          ['match', ['get', 'kind'], 'mountain-major', 0.82, 0.0],
          5.3,
          0.88,
        ],
      },
    });

    map.addLayer({
      id: 'ming-waters-regions-label',
      type: 'symbol',
      source: 'ming-landforms',
      minzoom: 3.8,
      filter: ['in', ['get', 'kind'], ['literal', ['lake', 'sea', 'region']]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          ['match', ['get', 'kind'], 'sea', 12.5, 'region', 12, 10],
          8,
          ['match', ['get', 'kind'], 'sea', 16, 'region', 15, 12.5],
        ],
        'text-letter-spacing': ['match', ['get', 'kind'], 'lake', 0.15, 0.45],
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'kind'],
          'region',
          isDark ? '#94A3B8' : '#786852',
          isDark ? '#63A3C9' : '#2D6B8A',
        ],
        'text-halo-color': isDark
          ? 'rgba(8, 19, 32, 0.88)'
          : 'rgba(225, 240, 246, 0.9)',
        'text-halo-width': 1.6,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.8,
          ['match', ['get', 'kind'], 'lake', 0.0, 0.8],
          5.2,
          0.86,
        ],
      },
    });
  }

  if (!map.getLayer('ming-waterways-label')) {
    map.addLayer({
      id: 'ming-waterways-label',
      type: 'symbol',
      source: 'ming-waterways',
      minzoom: 4.6,
      filter: [
        'in',
        ['get', 'kind'],
        [
          'literal',
          ['yellow-river-ming', 'major-river', 'canal', 'secondary-river'],
        ],
      ],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 440,
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4.6, 10, 8, 12],
        'text-letter-spacing': 0.16,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'kind'],
          'yellow-river-ming',
          isDark ? '#F6CA65' : '#8A500B',
          'canal',
          isDark ? '#6EE7B7' : '#09655B',
          isDark ? '#7CC1E8' : '#225A78',
        ],
        'text-halo-color': isDark
          ? 'rgba(12, 18, 26, 0.9)'
          : 'rgba(250, 246, 236, 0.94)',
        'text-halo-width': 1.6,
      },
    });
  }

  // =========================================================================
  // 4. Polity Dynasty Seals & 106 Strategic Places — 100% GPU Symbol!
  // =========================================================================
  if (!map.getLayer('ming-polity-labels')) {
    map.addLayer({
      id: 'ming-polity-labels',
      type: 'symbol',
      source: 'ming-polity-points',
      maxzoom: 8.5,
      layout: {
        'text-field': [
          'format',
          ['get', 'sealTitle'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subCaption'],
          { 'font-scale': 0.68 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          ['case', ['==', ['get', 'isTributary'], 1], 11.5, 14.5],
          6.5,
          ['case', ['==', ['get', 'isTributary'], 1], 13.5, 17.5],
        ],
        'text-letter-spacing': 0.28,
        'text-line-height': 1.25,
        'symbol-sort-key': ['get', 'isTributary'],
        'text-padding': 8,
      },
      paint: {
        'text-color': isDark ? '#F6EAD2' : '#2A1D15',
        'text-halo-color': isDark
          ? 'rgba(12, 16, 24, 0.94)'
          : 'rgba(250, 245, 233, 0.96)',
        'text-halo-width': 1.65,
        'text-halo-blur': 0.2,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          0.92,
          7.5,
          0.75,
          8.5,
          0.0,
        ],
      },
    });
  }

  if (!map.getSource('ming-places')) {
    map.addSource('ming-places', {
      type: 'geojson',
      data: PLACES_GEOJSON,
    });
  }

  if (!map.getLayer('ming-places-symbol')) {
    map.addLayer({
      id: 'ming-places-symbol',
      type: 'symbol',
      source: 'ming-places',
      filter: [
        'all',
        ['!=', ['get', 'placeType'], 'battlefield'],
        [
          'any',
          ['in', ['get', 'placeType'], ['literal', ['capital', 'garrison-nine']]],
          ['all', ['>=', ['zoom'], 5.3], ['==', ['get', 'placeType'], 'pass']],
          ['>=', ['zoom'], 6.1],
        ],
      ],
      layout: {
        'symbol-sort-key': ['get', 'sortKey'],
        'icon-image': [
          'match',
          ['get', 'placeType'],
          'capital',
          'place-capital-seal',
          ['garrison-nine', 'pass'],
          'place-pass-fort',
          'place-city-dot',
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          ['match', ['get', 'placeType'], 'capital', 0.85, 0.72],
          8,
          ['match', ['get', 'placeType'], 'capital', 1.05, 0.9],
        ],
        'icon-allow-overlap': false,
        'text-field': ['get', `label_${placeNameMode}`],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          ['match', ['get', 'placeType'], 'capital', 12.2, 10.8],
          8,
          ['match', ['get', 'placeType'], 'capital', 14.2, 12.2],
        ],
        'text-variable-anchor': ['top', 'right', 'left', 'bottom'],
        'text-radial-offset': [
          'match',
          ['get', 'placeType'],
          'capital',
          0.85,
          0.7,
        ],
        'text-padding': 4,
        'text-optional': true,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'placeType'],
          'capital',
          isDark ? '#FDE68A' : '#7C1D13',
          ['garrison-nine', 'pass'],
          isDark ? '#E2C792' : '#5C3D1E',
          isDark ? '#CBD5E1' : '#332922',
        ],
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.95)'
          : 'rgba(252, 248, 238, 0.97)',
        'text-halo-width': 1.45,
        'text-halo-blur': 0.2,
      },
    });
  }

  // =========================================================================
  // 5. On-Map Historical Causal Arcs (`← 前因` & `深远后果 →`)
  // =========================================================================
  if (!map.getSource('causal-arcs')) {
    map.addSource('causal-arcs', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getLayer('causal-arcs-glow')) {
    map.addLayer({
      id: 'causal-arcs-glow',
      type: 'line',
      source: 'causal-arcs',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'arcKind'],
          'prev',
          '#D97706',
          '#C53030',
        ],
        'line-width': 6,
        'line-opacity': isDark ? 0.3 : 0.22,
        'line-blur': 2.5,
      },
    });

    map.addLayer({
      id: 'causal-arcs-line',
      type: 'line',
      source: 'causal-arcs',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'arcKind'],
          'prev',
          isDark ? '#FBBF24' : '#B45309',
          isDark ? '#F87171' : '#B83B2A',
        ],
        'line-width': 2.4,
        'line-dasharray': [2.2, 1.5],
        'line-opacity': 0.92,
      },
    });

    map.addLayer({
      id: 'causal-arcs-arrows',
      type: 'symbol',
      source: 'causal-arcs',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 110,
        'icon-image': 'tactical-spearhead',
        'icon-size': 0.38,
        'icon-rotate': 90,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': [
          'match',
          ['get', 'arcKind'],
          'prev',
          isDark ? '#FDE68A' : '#B45309',
          isDark ? '#FCA5A5' : '#9B1C1C',
        ],
        'icon-halo-color': isDark ? '#0F172A' : '#FFFDF7',
        'icon-halo-width': 1.2,
      },
    });

    map.addLayer({
      id: 'causal-arcs-label',
      type: 'symbol',
      source: 'causal-arcs',
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, -0.85],
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'arcKind'],
          'prev',
          isDark ? '#FDE68A' : '#92400E',
          isDark ? '#FECACA' : '#991B1B',
        ],
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.95)'
          : 'rgba(255, 251, 240, 0.96)',
        'text-halo-width': 2.0,
      },
    });
  }

  // =========================================================================
  // 6. Campaign War-Room Dynamic Marching Routes & 100% GPU Annotations
  // =========================================================================
  if (!map.getSource('campaign-routes')) {
    map.addSource('campaign-routes', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getSource('campaign-endpoints')) {
    map.addSource('campaign-endpoints', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getSource('campaign-vanguards')) {
    map.addSource('campaign-vanguards', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getSource('campaign-annotations')) {
    map.addSource('campaign-annotations', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getLayer('campaign-routes-glow')) {
    // Spotlight Halo when hovering/selecting a specific route `① / ② / ③`
    map.addLayer({
      id: 'campaign-routes-spotlight',
      type: 'line',
      source: 'campaign-routes',
      filter: ['==', ['get', 'id'], '__none__'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FBBF24',
        'line-width': 14,
        'line-opacity': 0.65,
        'line-blur': 3,
      },
    });

    map.addLayer({
      id: 'campaign-routes-glow',
      type: 'line',
      source: 'campaign-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 11,
        'line-opacity': isDark ? 0.32 : 0.24,
        'line-blur': 2.8,
      },
    });

    // High-contrast casing on ALL tactical lines (both solid & dashed!) so routes pop cleanly off terrain
    map.addLayer({
      id: 'campaign-routes-casing',
      type: 'line',
      source: 'campaign-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDark ? '#070B12' : '#FFFDF7',
        'line-width': [
          'match',
          ['get', 'tactic'],
          'naval',
          8.2,
          'assault',
          7.6,
          6.4,
        ],
        'line-opacity': 0.92,
      },
    });

    map.addLayer({
      id: 'campaign-routes-solid',
      type: 'line',
      source: 'campaign-routes',
      filter: ['in', ['get', 'tactic'], ['literal', ['assault', 'naval']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['match', ['get', 'tactic'], 'naval', 5.2, 4.8],
        'line-opacity': 0.98,
      },
    });

    map.addLayer({
      id: 'campaign-routes-dashed',
      type: 'line',
      source: 'campaign-routes',
      filter: [
        'in',
        ['get', 'tactic'],
        ['literal', ['ambush', 'retreat', 'supply']],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['match', ['get', 'tactic'], 'ambush', 4.2, 3.6],
        'line-dasharray': [2.2, 1.4],
        'line-opacity': ['match', ['get', 'tactic'], 'retreat', 0.85, 0.98],
      },
    });

    // Stationary Departure Garrison Ring (`○` at startPoint)
    map.addLayer({
      id: 'campaign-origin-rings',
      type: 'circle',
      source: 'campaign-endpoints',
      filter: ['==', ['get', 'endKind'], 'origin'],
      paint: {
        'circle-radius': 5.8,
        'circle-color': isDark ? '#0F172A' : '#FFFDF7',
        'circle-stroke-width': 2.8,
        'circle-stroke-color': ['get', 'color'],
      },
    });

    // Stationary Authoritative Destination Spearhead (`▶` pinned at endPoint)
    map.addLayer({
      id: 'campaign-dest-arrowheads',
      type: 'symbol',
      source: 'campaign-endpoints',
      filter: ['==', ['get', 'endKind'], 'dest'],
      layout: {
        'icon-image': 'tactical-spearhead',
        'icon-size': 1.04,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-halo-color': isDark ? '#090D14' : '#FFFDF7',
        'icon-halo-width': 2.6,
      },
    });

    // Dynamic Marching Chevrons (`❯` gliding along stationary lines in `dynamic` mode!)
    map.addLayer({
      id: 'campaign-vanguard-heads',
      type: 'symbol',
      source: 'campaign-vanguards',
      layout: {
        'icon-image': 'marching-chevron',
        'icon-size': ['get', 'scale'],
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': '#FFFBEB',
        'icon-halo-color': ['get', 'color'],
        'icon-halo-width': 2.4,
        'icon-opacity': 0.96,
      },
    });

    // Concise Cartouche Route Step Pills (`① 杜松 · 主力`)
    map.addLayer({
      id: 'campaign-callouts-pill',
      type: 'symbol',
      source: 'campaign-annotations',
      filter: ['==', ['get', 'annoKind'], 'callout'],
      layout: {
        'symbol-sort-key': ['get', 'sortKey'],
        'icon-image': isDark ? 'callout-pill-dark' : 'callout-pill-light',
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [3, 8, 3, 8],
        'icon-allow-overlap': false,
        'text-field': ['get', 'labelText'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
        'text-radial-offset': 0.45,
        'text-padding': 4,
      },
      paint: {
        'text-color': isDark ? '#FEF3C7' : '#291D18',
      },
    });

    // Rich Two-Line Battlefield Clash / Siege Seals (`决` / `围` / `伏` / `守` / `断`)
    map.addLayer({
      id: 'campaign-annotations-symbol',
      type: 'symbol',
      source: 'campaign-annotations',
      filter: ['==', ['get', 'annoKind'], 'marker'],
      layout: {
        'symbol-sort-key': 1,
        'icon-image': ['get', 'iconName'],
        'icon-size': 0.98,
        'icon-allow-overlap': true,
        'text-field': [
          'case',
          ['!=', ['get', 'subLabel'], ''],
          [
            'format',
            ['get', 'labelText'],
            { 'font-scale': 1.0 },
            '\n',
            {},
            ['get', 'subLabel'],
            { 'font-scale': 0.84 },
          ],
          ['get', 'labelText'],
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12.6,
        'text-line-height': 1.25,
        'text-variable-anchor': ['bottom', 'top', 'right', 'left'],
        'text-radial-offset': 1.25,
        'text-padding': 4,
      },
      paint: {
        'text-color': ['get', 'textColor'],
        'text-halo-color': isDark
          ? 'rgba(9, 13, 22, 0.97)'
          : 'rgba(255, 253, 247, 0.98)',
        'text-halo-width': 1.65,
        'text-halo-blur': 0.2,
      },
    });
  }

  // =========================================================================
  // 7. Ming Institutional Thematic Layers (Princely Fiefs + Nine Garrisons)
  // =========================================================================
  if (!map.getSource('ming-institutions')) {
    map.addSource('ming-institutions', {
      type: 'geojson',
      data: MING_INSTITUTIONS_GEOJSON,
    });
  }

  if (!map.getLayer('ming-princely-fiefs-circle')) {
    map.addLayer({
      id: 'ming-princely-fiefs-circle',
      type: 'circle',
      source: 'ming-institutions',
      filter: ['==', ['get', 'layerGroup'], 'princely-fief'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['match', ['get', 'isBorderPrince'], 1, 7.5, 6.0],
        'circle-color': [
          'match',
          ['get', 'isBorderPrince'],
          1,
          '#C68B2C',
          '#7C3AED',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFDF7',
        'circle-opacity': 0.92,
      },
    });

    map.addLayer({
      id: 'ming-princely-fiefs-label',
      type: 'symbol',
      source: 'ming-institutions',
      filter: ['==', ['get', 'layerGroup'], 'princely-fief'],
      layout: {
        visibility: 'none',
        'text-field': [
          'format',
          ['get', 'shortTitle'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subNote'],
          { 'font-scale': 0.78 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-offset': [0, 0.95],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? '#FDE68A' : '#5B21B6',
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.96)'
          : 'rgba(255, 252, 245, 0.96)',
        'text-halo-width': 1.8,
      },
    });

    map.addLayer({
      id: 'ming-nine-garrisons-circle',
      type: 'circle',
      source: 'ming-institutions',
      filter: ['==', ['get', 'layerGroup'], 'nine-garrison'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 7.5,
        'circle-color': '#9E2318',
        'circle-stroke-width': 2.2,
        'circle-stroke-color': '#FDE68A',
        'circle-opacity': 0.94,
      },
    });

    map.addLayer({
      id: 'ming-nine-garrisons-label',
      type: 'symbol',
      source: 'ming-institutions',
      filter: ['==', ['get', 'layerGroup'], 'nine-garrison'],
      layout: {
        visibility: 'none',
        'text-field': [
          'format',
          ['get', 'shortTitle'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subNote'],
          { 'font-scale': 0.76 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-offset': [0, 1.0],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? '#FCA5A5' : '#7F1D1D',
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.96)'
          : 'rgba(255, 252, 245, 0.96)',
        'text-halo-width': 1.8,
      },
    });
  }

  // =========================================================================
  // 7b. Macro-History Thematic Layers: Little Ice Age Famine, Grand Canal Hubs & Global Silver Routes
  // =========================================================================
  if (!map.getSource('ming-macro-history')) {
    map.addSource('ming-macro-history', {
      type: 'geojson',
      data: MING_MACRO_HISTORY_GEOJSON,
    });
  }

  if (!map.getLayer('ming-famine-aura')) {
    // 1) Little Ice Age Drought / Locust / Plague Heat Aura (`famine-zone`)
    map.addLayer({
      id: 'ming-famine-aura',
      type: 'circle',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'famine-zone'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          ['*', 28, ['get', 'severity']],
          7,
          ['*', 68, ['get', 'severity']],
        ],
        'circle-color': isDark ? '#DC2626' : '#B91C1C',
        'circle-opacity': isDark ? 0.28 : 0.22,
        'circle-blur': 0.85,
      },
    });

    map.addLayer({
      id: 'ming-famine-core',
      type: 'circle',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'famine-zone'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 6.5,
        'circle-color': '#991B1B',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FEF08A',
      },
    });

    map.addLayer({
      id: 'ming-famine-label',
      type: 'symbol',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'famine-zone'],
      layout: {
        visibility: 'none',
        'text-field': [
          'format',
          ['get', 'shortTitle'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subNote'],
          { 'font-scale': 0.78 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-offset': [0, 0.95],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? '#FECACA' : '#7F1D1D',
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.96)'
          : 'rgba(255, 252, 245, 0.97)',
        'text-halo-width': 1.55,
        'text-halo-blur': 0.2,
      },
    });

    // 2) Grand Canal 4M-Dan Grain Hubs & Customs (`canal-hub`)
    map.addLayer({
      id: 'ming-canal-hubs-circle',
      type: 'circle',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'canal-hub'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 7.0,
        'circle-color': '#0D9488',
        'circle-stroke-width': 2.2,
        'circle-stroke-color': '#FEF3C7',
      },
    });

    map.addLayer({
      id: 'ming-canal-hubs-label',
      type: 'symbol',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'canal-hub'],
      layout: {
        visibility: 'none',
        'text-field': [
          'format',
          ['get', 'shortTitle'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subNote'],
          { 'font-scale': 0.78 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-offset': [0, 0.95],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? '#5EEAD4' : '#0F766E',
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.96)'
          : 'rgba(255, 252, 245, 0.97)',
        'text-halo-width': 1.55,
        'text-halo-blur': 0.2,
      },
    });

    // 3) Longqing Maritime Silver Routes & Ports (`silver-route` / `silver-port`)
    map.addLayer({
      id: 'ming-silver-routes-glow',
      type: 'line',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'silver-route'],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDark ? '#FBBF24' : '#D97706',
        'line-width': 8,
        'line-opacity': 0.28,
        'line-blur': 2.5,
      },
    });

    map.addLayer({
      id: 'ming-silver-routes-line',
      type: 'line',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'silver-route'],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDark ? '#FDE68A' : '#B45309',
        'line-width': 3.2,
        'line-dasharray': [2.2, 1.4],
        'line-opacity': 0.95,
      },
    });

    map.addLayer({
      id: 'ming-silver-routes-arrows',
      type: 'symbol',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'silver-route'],
      layout: {
        visibility: 'none',
        'symbol-placement': 'line',
        'symbol-spacing': 90,
        'icon-image': 'tactical-spearhead',
        'icon-size': 0.42,
        'icon-rotate': 90,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': isDark ? '#FEF08A' : '#B45309',
        'icon-halo-color': isDark ? '#0F172A' : '#FFFDF7',
        'icon-halo-width': 1.4,
      },
    });

    map.addLayer({
      id: 'ming-silver-ports-circle',
      type: 'circle',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'silver-port'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 6.8,
        'circle-color': '#D97706',
        'circle-stroke-width': 2.2,
        'circle-stroke-color': '#FFFBEB',
      },
    });

    map.addLayer({
      id: 'ming-silver-ports-label',
      type: 'symbol',
      source: 'ming-macro-history',
      filter: ['==', ['get', 'layerGroup'], 'silver-port'],
      layout: {
        visibility: 'none',
        'text-field': [
          'format',
          ['get', 'shortTitle'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subNote'],
          { 'font-scale': 0.78 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-offset': [0, 0.95],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': isDark ? '#FDE68A' : '#92400E',
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.96)'
          : 'rgba(255, 252, 245, 0.97)',
        'text-halo-width': 1.55,
        'text-halo-blur': 0.2,
      },
    });
  }

  // =========================================================================
  // 7c. Decisive Battlefield Micro-Tactical Sub-Sandtable (`minzoom: 7.4`)
  // =========================================================================
  if (!map.getSource('ming-tactical-micro')) {
    map.addSource('ming-tactical-micro', {
      type: 'geojson',
      data: MING_TACTICAL_MICRO_GEOJSON,
    });
  }

  if (!map.getLayer('ming-tactical-micro-lines')) {
    map.addLayer({
      id: 'ming-tactical-micro-lines',
      type: 'line',
      source: 'ming-tactical-micro',
      minzoom: 7.4,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': [
          'match',
          ['get', 'tacKind'],
          'wall-line',
          3.4,
          'trench-line',
          3.2,
          2.8,
        ],
        'line-dasharray': [1.8, 1.2],
        'line-opacity': 0.95,
      },
    });

    map.addLayer({
      id: 'ming-tactical-micro-line-labels',
      type: 'symbol',
      source: 'ming-tactical-micro',
      minzoom: 7.8,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.5,
        'text-offset': [0, -0.8],
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.97)'
          : 'rgba(255, 253, 247, 0.98)',
        'text-halo-width': 1.6,
        'text-halo-blur': 0.2,
      },
    });

    map.addLayer({
      id: 'ming-tactical-micro-points',
      type: 'circle',
      source: 'ming-tactical-micro',
      minzoom: 7.4,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7.4,
          5.5,
          10.5,
          8.5,
        ],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2.2,
        'circle-stroke-color': '#FEF08A',
      },
    });

    map.addLayer({
      id: 'ming-tactical-micro-labels',
      type: 'symbol',
      source: 'ming-tactical-micro',
      minzoom: 7.6,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': [
          'format',
          ['get', 'label'],
          { 'font-scale': 1.0 },
          '\n',
          {},
          ['get', 'subNote'],
          { 'font-scale': 0.8 },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11.8,
        'text-offset': [0, 1.0],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': isDark ? '#FEF3C7' : '#7F1D1D',
        'text-halo-color': isDark
          ? 'rgba(9, 13, 22, 0.97)'
          : 'rgba(255, 253, 247, 0.98)',
        'text-halo-width': 1.6,
        'text-halo-blur': 0.2,
      },
    });
  }

  // =========================================================================
  // 8. Character Odyssey Trajectory & Numbered Life Stops — 100% WebGL!
  // =========================================================================
  if (!map.getSource('character-odyssey')) {
    map.addSource('character-odyssey', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getLayer('character-odyssey-line')) {
    map.addLayer({
      id: 'character-odyssey-glow',
      type: 'line',
      source: 'character-odyssey',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 8,
        'line-opacity': isDark ? 0.3 : 0.22,
        'line-blur': 2.5,
      },
    });

    map.addLayer({
      id: 'character-odyssey-line',
      type: 'line',
      source: 'character-odyssey',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3.6,
        'line-dasharray': [2.2, 1.3],
        'line-opacity': 0.95,
      },
    });

    map.addLayer({
      id: 'character-odyssey-arrows',
      type: 'symbol',
      source: 'character-odyssey',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 68,
        'icon-image': 'tactical-spearhead',
        'icon-size': 0.38,
        'icon-rotate': 90,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': '#FFFDF7',
        'icon-halo-color': ['get', 'color'],
        'icon-halo-width': 1.3,
      },
    });

    map.addLayer({
      id: 'character-odyssey-stops',
      type: 'circle',
      source: 'character-odyssey',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': ['match', ['get', 'isActive'], 1, 11, 7.5],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': ['match', ['get', 'isActive'], 1, 3, 2],
        'circle-stroke-color': [
          'match',
          ['get', 'isActive'],
          1,
          '#FDE68A',
          '#FFFDF7',
        ],
      },
    });

    map.addLayer({
      id: 'character-odyssey-labels',
      type: 'symbol',
      source: 'character-odyssey',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'badgeLabel'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'isActive'], 1, 12.5, 11.5],
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': isDark ? '#FEF3C7' : '#231815',
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.96)'
          : 'rgba(255, 252, 244, 0.96)',
        'text-halo-width': 2.0,
      },
    });
  }

  // =========================================================================
  // 9. Historical Event Medallions (`战` / `史` / `轶`) — 100% Native WebGL!
  //    Replaces 106 HTML DOM `Marker`s -> 0ms `move` cost & silky 120+ FPS!
  // =========================================================================
  if (!map.getSource('ming-events')) {
    map.addSource('ming-events', {
      type: 'geojson',
      data: EMPTY_FC,
    });
  }

  if (!map.getLayer('ming-events-symbol')) {
    map.addLayer({
      id: 'ming-events-tethers',
      type: 'line',
      source: 'ming-events',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': isDark ? '#F59E0B' : '#9B2C1D',
        'line-width': 1.3,
        'line-dasharray': [2, 2],
        'line-opacity': 0.72,
      },
    });

    map.addLayer({
      id: 'ming-events-symbol',
      type: 'symbol',
      source: 'ming-events',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'symbol-sort-key': ['get', 'sortKey'],
        'icon-image': ['get', 'iconName'],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.8,
          ['match', ['get', 'isEmphasized'], 1, 0.92, 0.8],
          7.5,
          ['match', ['get', 'isEmphasized'], 1, 1.04, 0.92],
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'text-field': ['get', 'labelText'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'isSelected'], 1, 12.8, 11.6],
        'text-variable-anchor': ['bottom', 'right', 'left', 'top'],
        'text-radial-offset': 1.05,
        'text-padding': 4,
        'text-optional': true,
      },
      paint: {
        'icon-opacity': ['get', 'iconOpacity'],
        'text-color': [
          'case',
          ['==', ['get', 'isSelected'], 1],
          isDark ? '#FEF08A' : '#8E1912',
          ['==', ['get', 'isCausal'], 1],
          isDark ? '#FDE68A' : '#92400E',
          isDark ? '#F8FAFC' : '#1E1B18',
        ],
        'text-halo-color': isDark
          ? 'rgba(11, 15, 23, 0.97)'
          : 'rgba(252, 248, 238, 0.98)',
        'text-halo-width': 1.55,
        'text-halo-blur': 0.2,
      },
    });
  }
}

export function setPlaceNameModeOnGpu(
  map: maplibregl.Map,
  mode: PlaceNameMode
): void {
  if (map.getLayer('ming-places-symbol')) {
    map.setLayoutProperty('ming-places-symbol', 'text-field', [
      'get',
      `label_${mode}`,
    ]);
  }
}

export function updateCausalArcsOnMap(
  map: maplibregl.Map,
  selectedEvent: HistoricalEvent | null | undefined,
  visible: boolean
): void {
  const src = map.getSource('causal-arcs') as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(visible ? buildCausalArcGeoJSON(selectedEvent) : EMPTY_FC);
}

export function updateTerritoryWipeOnMap(
  map: maplibregl.Map,
  wipeGeoJSON: GeoJSON.FeatureCollection | null
): void {
  const src = map.getSource('ming-territory-wipe') as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(wipeGeoJSON ?? EMPTY_FC);
}

export function updateCharacterOdysseyOnMap(
  map: maplibregl.Map,
  characterId: string | null,
  activeStopIndex: number
): void {
  const src = map.getSource('character-odyssey') as GeoJSONSource | undefined;
  if (!src) return;
  if (!characterId || !CHARACTER_MAP[characterId]) {
    src.setData(EMPTY_FC);
    return;
  }

  const ch = CHARACTER_MAP[characterId];
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < ch.stops.length - 1; i++) {
    const a = ch.stops[i].coordinates;
    const b = ch.stops[i + 1].coordinates;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.02) {
      const seg = buildCurvedRouteCoords([a, b], 'assault', 18);
      features.push({
        type: 'Feature',
        properties: {
          color: ch.color,
          segIdx: i,
        },
        geometry: {
          type: 'LineString',
          coordinates: seg,
        },
      });
    }
  }

  ch.stops.forEach((st, idx) => {
    const numGlyph = CIRCLED_NUMS[idx] ?? `(${idx + 1})`;
    features.push({
      type: 'Feature',
      properties: {
        step: st.step,
        color: ch.color,
        isActive: idx === activeStopIndex ? 1 : 0,
        badgeLabel: `${numGlyph} ${st.year}年 · ${st.title.slice(0, 12)}`,
      },
      geometry: {
        type: 'Point',
        coordinates: st.coordinates,
      },
    });
  });

  src.setData({ type: 'FeatureCollection', features });
}

/**
 * Updates the 100% WebGL Event Medallions (`战` / `史` / `轶`) & Radial Co-Located Tethers!
 * Runs ONLY when state (`currentYear` window, `selectedEventId`, `zoomBucket`, `layers`) changes —
 * NEVER during pan/zoom/flyTo!
 */
export function updateEventsOnMap(
  map: maplibregl.Map,
  options: {
    selectedEventId: string | null;
    currentYear: number;
    zoomBucket: 'far' | 'mid' | 'close';
    macroVis: boolean;
    allMicroVis: boolean;
    inCampaign: boolean;
    inOdyssey: boolean;
    causalIds: Set<string>;
  }
): void {
  const src = map.getSource('ming-events') as GeoJSONSource | undefined;
  if (!src) return;

  if (options.inCampaign) {
    src.setData(EMPTY_FC);
    return;
  }

  const showMicro = options.allMicroVis || options.zoomBucket !== 'far';

  const visibleEvents = ALL_EVENTS.filter((evt) => {
    const isSelected = evt.id === options.selectedEventId;
    if (options.inOdyssey) return isSelected;
    const isCausal = options.causalIds.has(evt.id);
    if (isSelected || isCausal) return true;

    const inEraWindow =
      options.allMicroVis || Math.abs(evt.time.year - options.currentYear) <= 38;
    if (!inEraWindow) return false;

    return evt.tier === 'macro' ? options.macroVis : showMicro;
  });

  // Group co-located visible events (within 0.05 deg, e.g. Nanjing or Beijing) and spread onto a micro-ring
  // scaled cleanly to current zoom Bucket so same-city seals never stack!
  const spreadRadiusDeg =
    options.zoomBucket === 'close'
      ? 0.075
      : options.zoomBucket === 'mid'
      ? 0.14
      : 0.24;

  const assigned = new Uint8Array(visibleEvents.length);
  const displayCoords: LngLat[] = visibleEvents.map(
    (e) => e.location.coordinates
  );
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < visibleEvents.length; i++) {
    if (assigned[i]) continue;
    const cluster = [i];
    assigned[i] = 1;
    const [bx, by] = visibleEvents[i].location.coordinates;

    for (let j = i + 1; j < visibleEvents.length; j++) {
      if (assigned[j]) continue;
      const [qx, qy] = visibleEvents[j].location.coordinates;
      if (Math.hypot(bx - qx, by - qy) < 0.06) {
        cluster.push(j);
        assigned[j] = 1;
      }
    }

    if (cluster.length > 1) {
      const r =
        cluster.length === 2
          ? spreadRadiusDeg * 0.72
          : cluster.length <= 4
          ? spreadRadiusDeg
          : spreadRadiusDeg * 1.25;
      const cosLat = Math.max(0.55, Math.cos((by * Math.PI) / 180));

      cluster.forEach((memberIdx, k) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * k) / cluster.length;
        const ox = (r * Math.cos(angle)) / cosLat;
        const oy = r * Math.sin(angle);
        const orig = visibleEvents[memberIdx].location.coordinates;
        const shifted: LngLat = [orig[0] + ox, orig[1] + oy];
        displayCoords[memberIdx] = shifted;

        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [orig, shifted],
          },
        });
      });
    }
  }

  visibleEvents.forEach((evt, idx) => {
    const isSelected = evt.id === options.selectedEventId;
    const isCausal = options.causalIds.has(evt.id);
    const isMacro = evt.tier === 'macro';
    const isBattle = Boolean(evt.campaignId);
    const yearGap = Math.abs(evt.time.year - options.currentYear);
    const isInEraFocus = yearGap <= 10;
    const isEmphasized = isSelected || isCausal;

    const iconName = isBattle
      ? isEmphasized
        ? 'event-seal-battle-active'
        : 'event-seal-battle'
      : isMacro
      ? isEmphasized
        ? 'event-seal-macro-active'
        : 'event-seal-macro'
      : isEmphasized
      ? 'event-seal-micro-active'
      : 'event-seal-micro';

    const shouldShowText =
      isSelected ||
      isCausal ||
      options.zoomBucket === 'close' ||
      (options.zoomBucket === 'mid' && (isMacro || options.allMicroVis)) ||
      (options.zoomBucket === 'far' && isMacro && isInEraFocus);

    const shortTitle = `${evt.title.slice(0, 9)}${
      evt.title.length > 9 ? '…' : ''
    }`;

    const sortKey = isSelected
      ? 1
      : isCausal
      ? 2
      : isMacro && isInEraFocus
      ? 3
      : isMacro
      ? 4
      : 5;

    features.push({
      type: 'Feature',
      properties: {
        eventId: evt.id,
        iconName,
        isSelected: isSelected ? 1 : 0,
        isCausal: isCausal ? 1 : 0,
        isEmphasized: isEmphasized ? 1 : 0,
        iconOpacity: isSelected || isCausal || isInEraFocus ? 1.0 : 0.82,
        labelText: shouldShowText ? `${evt.time.year} ${shortTitle}` : '',
        sortKey,
      },
      geometry: {
        type: 'Point',
        coordinates: displayCoords[idx],
      },
    });
  });

  src.setData({ type: 'FeatureCollection', features });
}

/**
 * Updates 100% GPU Campaign Step Callouts (`① 主力 · ...`) & Battlefield Markers (`决` / `围` / `伏`).
 * Called ONLY when unlocked step count changes (`0 -> 1 -> 2 -> 3`), never on every frame!
 */
export function updateCampaignAnnotationsOnMap(
  map: maplibregl.Map,
  curves: PreparedRouteCurve[],
  phase: CampaignPhase | null,
  unlockedStepCount: number,
  theme: MapVisualTheme
): void {
  const src = map.getSource('campaign-annotations') as GeoJSONSource | undefined;
  if (!src) return;

  if (!phase || curves.length === 0) {
    src.setData(EMPTY_FC);
    return;
  }

  const isDark = theme === 'xuanmo';
  const features: GeoJSON.Feature[] = [];

  for (const bm of phase.markers) {
    const iconName =
      bm.kind === 'siege'
        ? 'battle-marker-siege'
        : bm.kind === 'cutoff'
        ? 'battle-marker-cutoff'
        : bm.kind === 'camp'
        ? 'battle-marker-ambush'
        : bm.kind === 'pass'
        ? 'battle-marker-defense'
        : 'battle-marker-decisive';

    features.push({
      type: 'Feature',
      properties: {
        annoKind: 'marker',
        iconName,
        labelText: bm.label,
        subLabel: bm.subLabel ?? '',
        textColor: isDark ? '#FEF08A' : '#7F1D1D',
        sortKey: 1,
      },
      geometry: {
        type: 'Point',
        coordinates: bm.coordinates,
      },
    });
  }

  for (const curve of curves) {
    if (curve.stepNo > unlockedStepCount) continue;
    const stepSymbol = CIRCLED_NUMS[curve.stepNo - 1] ?? `(${curve.stepNo})`;
    const tacticTag =
      curve.tactic === 'ambush'
        ? '奇袭'
        : curve.tactic === 'naval'
        ? '水师'
        : curve.tactic === 'retreat'
        ? '败退'
        : curve.tactic === 'supply'
        ? '粮道'
        : '主力';

    // Concise, non-cluttering map badge (`① 杜松 · 主力`); full narrative lives in War-Room Drawer!
    const leadCommander = curve.commander
      ? curve.commander.split(/[·/、\s]+/)[0].slice(0, 4)
      : '';
    const conciseMapBadge = leadCommander
      ? `${stepSymbol} ${leadCommander} · ${tacticTag}`
      : `${stepSymbol} ${tacticTag} · ${curve.label.slice(0, 7)}${
          curve.label.length > 7 ? '…' : ''
        }`;

    features.push({
      type: 'Feature',
      properties: {
        annoKind: 'callout',
        routeId: curve.id,
        iconName: isDark ? 'callout-pill-dark' : 'callout-pill-light',
        labelText: conciseMapBadge,
        subLabel: '',
        textColor: isDark ? '#FEF3C7' : '#291D18',
        sortKey: 2 + curve.stepNo,
      },
      geometry: {
        type: 'Point',
        coordinates: curve.midPoint,
      },
    });
  }

  src.setData({ type: 'FeatureCollection', features });
}

export function syncLayerVisibility(
  map: maplibregl.Map,
  layers: LayerVisibility
): void {
  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  };

  setVis('ming-territories-fill', layers.territories);
  setVis('ming-territories-frontier-band', layers.territories);
  setVis('ming-territories-outline-casing', layers.territories);
  setVis('ming-territories-outline', layers.territories);
  setVis('ming-territory-wipe-eraser', layers.territories);
  setVis('ming-territory-wipe-fill', layers.territories);
  setVis('ming-territory-wipe-outline', layers.territories);
  setVis('ming-territory-wipe-front', layers.territories);
  setVis('ming-territories-hover', layers.territories);
  setVis('ming-polity-labels', layers.territories);

  setVis('vector-natural-waterways', layers.waterways);
  setVis('ming-rivers-casing', layers.waterways);
  setVis('ming-rivers-line', layers.waterways);
  setVis('ming-yellow-river-casing', layers.waterways);
  setVis('ming-yellow-river-line', layers.waterways);
  setVis('ming-grand-canal-line', layers.waterways);
  setVis('ming-waterways-label', layers.waterways);

  setVis('ming-great-wall-casing', layers.greatWall);
  setVis('ming-great-wall-base', layers.greatWall);
  setVis('ming-great-wall-line', layers.greatWall);

  setVis('ming-mountains-label', layers.landforms);
  setVis('ming-waters-regions-label', layers.landforms);

  setVis('ming-places-symbol', layers.places);

  setVis('causal-arcs-glow', layers.causalArcs);
  setVis('causal-arcs-line', layers.causalArcs);
  setVis('causal-arcs-arrows', layers.causalArcs);
  setVis('causal-arcs-label', layers.causalArcs);

  setVis('ming-princely-fiefs-circle', layers.princelyFiefs);
  setVis('ming-princely-fiefs-label', layers.princelyFiefs);
  setVis('ming-nine-garrisons-circle', layers.nineGarrisons);
  setVis('ming-nine-garrisons-label', layers.nineGarrisons);

  setVis('ming-famine-aura', layers.famineZones);
  setVis('ming-famine-core', layers.famineZones);
  setVis('ming-famine-label', layers.famineZones);

  setVis('ming-canal-hubs-circle', layers.grandCanalHubs);
  setVis('ming-canal-hubs-label', layers.grandCanalHubs);

  setVis('ming-silver-routes-glow', layers.silverRoutes);
  setVis('ming-silver-routes-line', layers.silverRoutes);
  setVis('ming-silver-routes-arrows', layers.silverRoutes);
  setVis('ming-silver-ports-circle', layers.silverRoutes);
  setVis('ming-silver-ports-label', layers.silverRoutes);

  setVis('ming-tactical-micro-lines', layers.tacticalMicro);
  setVis('ming-tactical-micro-line-labels', layers.tacticalMicro);
  setVis('ming-tactical-micro-points', layers.tacticalMicro);
  setVis('ming-tactical-micro-labels', layers.tacticalMicro);
}

export function buildPhaseRouteFeatures(
  campaign: Campaign | null,
  phase: CampaignPhase | null
): {
  featureCollection: GeoJSON.FeatureCollection;
  preparedCurves: PreparedRouteCurve[];
} {
  if (!campaign || !phase) {
    return { featureCollection: EMPTY_FC, preparedCurves: [] };
  }

  const factionColorMap: Record<string, string> = Object.fromEntries(
    campaign.factions.map((f) => [f.id, f.color])
  );

  const sortedRoutes = [...phase.routes]
    .map((r, idx) => ({ r, sortOrder: r.order ?? idx + 1 }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const windows = computeSequentialRouteWindows(sortedRoutes.length);
  const features: GeoJSON.Feature[] = [];
  const preparedCurves: PreparedRouteCurve[] = [];

  sortedRoutes.forEach(({ r: route }, idx) => {
    const stepNo = idx + 1;
    const win = windows[idx] ?? { startAt: 0, endAt: 1 };
    const color =
      route.type === 'supply'
        ? '#D69E2E'
        : factionColorMap[route.factionId] ?? '#B83B2A';
    const curved = buildCurvedRouteCoords(route.coordinates, route.type, 22);
    const midSample = sampleAlongPath(curved, 0.52);

    features.push({
      type: 'Feature',
      properties: {
        id: route.id,
        stepNo,
        color,
        tactic: route.type,
        label: route.label,
      },
      geometry: {
        type: 'LineString',
        coordinates: curved,
      },
    });

    preparedCurves.push({
      id: route.id,
      stepNo,
      startAt: win.startAt,
      endAt: win.endAt,
      color,
      tactic: route.type,
      label: route.label,
      commander: route.commander,
      coords: curved,
      startPoint: curved[0],
      endPoint: curved[curved.length - 1],
      midPoint: midSample.coordinates,
    });
  });

  return {
    featureCollection: {
      type: 'FeatureCollection',
      features,
    },
    preparedCurves,
  };
}

/**
 * Strictly Sequential Step-by-Step Route & Spearhead Updater (`① -> ② -> ③`).
 * Once `growProgress >= 1` (`skipRouteGeometryUpdate`), stops ALL `setData()` calls (`0%` idle GPU/CPU!).
 */
export function setCampaignStaticRoutesOnMap(
  map: maplibregl.Map,
  routeFeatureCollection: GeoJSON.FeatureCollection,
  curves: PreparedRouteCurve[] = []
): void {
  const routeSrc = map.getSource('campaign-routes') as GeoJSONSource | undefined;
  if (routeSrc) {
    routeSrc.setData(routeFeatureCollection);
  }

  const endSrc = map.getSource('campaign-endpoints') as
    | GeoJSONSource
    | undefined;
  if (endSrc) {
    if (curves.length === 0) {
      endSrc.setData(EMPTY_FC);
    } else {
      const endFeatures: GeoJSON.Feature[] = [];
      for (const curve of curves) {
        endFeatures.push({
          type: 'Feature',
          properties: {
            id: curve.id,
            endKind: 'origin',
            color: curve.color,
          },
          geometry: {
            type: 'Point',
            coordinates: curve.startPoint,
          },
        });

        const { coordinates: tipCoord, bearing: tipBearing } = sampleAlongPath(
          curve.coords,
          0.996
        );
        endFeatures.push({
          type: 'Feature',
          properties: {
            id: curve.id,
            endKind: 'dest',
            color: curve.color,
            bearing: tipBearing,
          },
          geometry: {
            type: 'Point',
            coordinates: tipCoord,
          },
        });
      }
      endSrc.setData({
        type: 'FeatureCollection',
        features: endFeatures,
      });
    }
  }
}

export function setCampaignSpotlightRoute(
  map: maplibregl.Map,
  routeId: string | null,
  inCampaign: boolean
): void {
  if (map.getLayer('campaign-routes-spotlight')) {
    map.setFilter('campaign-routes-spotlight', [
      '==',
      ['get', 'id'],
      routeId ?? '__none__',
    ]);
  }
  if (map.getLayer('ming-polity-labels')) {
    map.setPaintProperty(
      'ming-polity-labels',
      'text-opacity',
      inCampaign
        ? 0.22
        : [
            'interpolate',
            ['linear'],
            ['zoom'],
            3.5,
            0.92,
            7.5,
            0.75,
            8.5,
            0.0,
          ]
    );
  }
}

export function updateCampaignArrowheadsOnMap(
  map: maplibregl.Map,
  curves: PreparedRouteCurve[],
  arrowMode: CampaignArrowMode,
  cycleProgress: number,
  continuousPulse = 0
): void {
  const vanguardSrc = map.getSource('campaign-vanguards') as
    | GeoJSONSource
    | undefined;
  if (!vanguardSrc) return;

  // In `static` mode (or when no campaign is open), Origin Ring + Stationary Line +
  // Stationary Destination Spearhead (`campaign-endpoints`) provide the complete static arrow!
  if (curves.length === 0 || arrowMode === 'static') {
    vanguardSrc.setData(EMPTY_FC);
    return;
  }

  const vanguardFeatures: GeoJSON.Feature[] = [];

  // Phase 1 (`cycleProgress < 0.999`): Strict sequential `① -> ② -> ③` marching launch!
  if (cycleProgress < 0.999) {
    for (const curve of curves) {
      if (cycleProgress < curve.startAt) continue;

      const span = Math.max(0.01, curve.endAt - curve.startAt);
      const rawStep = Math.max(
        0,
        Math.min(1, (cycleProgress - curve.startAt) / span)
      );

      if (rawStep < 0.998) {
        // Active step: primary + trailing marching chevron gliding along stationary shaft!
        const leadT =
          0.04 +
          0.88 *
            (rawStep < 0.5
              ? 2 * rawStep * rawStep
              : 1 - Math.pow(-2 * rawStep + 2, 2) / 2);
        const lead = sampleAlongPath(curve.coords, leadT);
        vanguardFeatures.push({
          type: 'Feature',
          properties: {
            id: curve.id,
            color: curve.color,
            bearing: lead.bearing,
            scale: 0.78,
          },
          geometry: { type: 'Point', coordinates: lead.coordinates },
        });

        if (leadT > 0.24) {
          const trail = sampleAlongPath(curve.coords, leadT - 0.2);
          vanguardFeatures.push({
            type: 'Feature',
            properties: {
              id: curve.id,
              color: curve.color,
              bearing: trail.bearing,
              scale: 0.62,
            },
            geometry: { type: 'Point', coordinates: trail.coordinates },
          });
        }
      } else {
        // Earlier completed step: gentle marching chevron flow along its stationary shaft
        const flowT = 0.08 + ((continuousPulse + curve.stepNo * 0.31) % 1) * 0.82;
        const sample = sampleAlongPath(curve.coords, flowT);
        vanguardFeatures.push({
          type: 'Feature',
          properties: {
            id: curve.id,
            color: curve.color,
            bearing: sample.bearing,
            scale: 0.66,
          },
          geometry: { type: 'Point', coordinates: sample.coordinates },
        });
      }
    }
  } else {
    // All steps unlocked (`①..N`): keep two crisp marching chevrons gliding steadily along every stationary line!
    curves.forEach((curve, idx) => {
      for (const offset of [0, 0.48]) {
        const t = 0.06 + ((continuousPulse + idx * 0.23 + offset) % 1) * 0.84;
        const sample = sampleAlongPath(curve.coords, t);
        vanguardFeatures.push({
          type: 'Feature',
          properties: {
            id: curve.id,
            color: curve.color,
            bearing: sample.bearing,
            scale: 0.68,
          },
          geometry: { type: 'Point', coordinates: sample.coordinates },
        });
      }
    });
  }

  vanguardSrc.setData({
    type: 'FeatureCollection',
    features: vanguardFeatures,
  });
}
