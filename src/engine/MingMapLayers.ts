import type maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { MING_WATERWAYS_GEOJSON } from '@/lib/atlasData';
import { buildCurvedRouteCoords, sampleAlongPath } from '@/lib/curve';
import type { Campaign, CampaignPhase, LngLat, MapVisualTheme } from '@/types/ming';
import type { LayerVisibility } from '@/store/useAtlasStore';

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export interface PreparedRouteCurve {
  id: string;
  color: string;
  tactic: string;
  label: string;
  commander?: string;
  coords: LngLat[];
  midPoint: LngLat;
}

/**
 * Installs all historical GIS & Campaign Route WebGL sources and layers onto the MapLibre instance.
 */
export function mountHistoricalLayers(
  map: maplibregl.Map,
  initialTerritories: GeoJSON.FeatureCollection,
  theme: MapVisualTheme
): void {
  const isDark = theme === 'xuanmo';

  // 1. Territories Source & Layers
  if (!map.getSource('ming-territories')) {
    map.addSource('ming-territories', {
      type: 'geojson',
      data: initialTerritories,
    });
  }

  if (!map.getLayer('ming-territories-fill')) {
    map.addLayer({
      id: 'ming-territories-fill',
      type: 'fill',
      source: 'ming-territories',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'match',
          ['get', 'controlType'],
          'tributary-garrison',
          isDark ? 0.18 : 0.16,
          isDark ? 0.30 : 0.26,
        ],
      },
    });

    map.addLayer({
      id: 'ming-territories-glow',
      type: 'line',
      source: 'ming-territories',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-opacity': isDark ? 0.30 : 0.22,
        'line-blur': 3,
      },
    });

    map.addLayer({
      id: 'ming-territories-outline',
      type: 'line',
      source: 'ming-territories',
      paint: {
        'line-color': ['coalesce', ['get', 'borderColor'], ['get', 'color']],
        'line-width': [
          'match',
          ['get', 'controlType'],
          'tributary-garrison',
          1.4,
          2.2,
        ],
        'line-dasharray': [
          'match',
          ['get', 'controlType'],
          'tributary-garrison',
          ['literal', [3, 2]],
          ['literal', [1, 0]],
        ],
        'line-opacity': 0.88,
      },
    });
  }

  // 2. Ming Historical Waterways & Ming Great Wall
  if (!map.getSource('ming-waterways')) {
    map.addSource('ming-waterways', {
      type: 'geojson',
      data: MING_WATERWAYS_GEOJSON,
    });
  }

  if (!map.getLayer('ming-lakes-fill')) {
    map.addLayer({
      id: 'ming-lakes-fill',
      type: 'fill',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'lake'],
      paint: {
        'fill-color': isDark ? '#18364A' : '#9CC4D4',
        'fill-opacity': 0.82,
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
      paint: {
        'line-color': isDark ? '#2B6CB0' : '#4A89AA',
        'line-width': [
          'match',
          ['get', 'kind'],
          'major-river',
          2.6,
          1.5,
        ],
        'line-opacity': 0.85,
      },
    });

    // Historical Ming Yellow River (1194-1855 Duohuai Course!) highlighted in distinct Ochre-Gold
    map.addLayer({
      id: 'ming-yellow-river-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'yellow-river-ming'],
      paint: {
        'line-color': isDark ? '#D69E2E' : '#B7791F',
        'line-width': 2.8,
        'line-opacity': 0.92,
      },
    });

    // Grand Canal (Ming Grain Lifeline)
    map.addLayer({
      id: 'ming-grand-canal-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'canal'],
      paint: {
        'line-color': isDark ? '#38B2AC' : '#0D9488',
        'line-width': 2.1,
        'line-dasharray': [2, 1.5],
        'line-opacity': 0.9,
      },
    });

    // Ming Great Wall
    map.addLayer({
      id: 'ming-great-wall-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'great-wall'],
      paint: {
        'line-color': isDark ? '#A0AEC0' : '#5A4A42',
        'line-width': 2.4,
        'line-dasharray': [1.5, 1],
        'line-opacity': 0.82,
      },
    });
  }

  // 3. Campaign Dynamic Marching Routes & Vanguard Spearheads
  if (!map.getSource('campaign-routes')) {
    map.addSource('campaign-routes', {
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

  if (!map.getLayer('campaign-routes-glow')) {
    map.addLayer({
      id: 'campaign-routes-glow',
      type: 'line',
      source: 'campaign-routes',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 10,
        'line-opacity': 0.28,
        'line-blur': 4,
      },
    });

    // Solid base routes (assault & naval)
    map.addLayer({
      id: 'campaign-routes-solid',
      type: 'line',
      source: 'campaign-routes',
      filter: ['in', ['get', 'tactic'], ['literal', ['assault', 'naval']]],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['match', ['get', 'tactic'], 'naval', 4.5, 4.0],
        'line-opacity': 0.92,
      },
    });

    // Dashed tactical routes (ambush, retreat, supply)
    map.addLayer({
      id: 'campaign-routes-dashed',
      type: 'line',
      source: 'campaign-routes',
      filter: [
        'in',
        ['get', 'tactic'],
        ['literal', ['ambush', 'retreat', 'supply']],
      ],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['match', ['get', 'tactic'], 'ambush', 3.8, 2.8],
        'line-dasharray': [2.2, 1.6],
        'line-opacity': ['match', ['get', 'tactic'], 'retreat', 0.72, 0.95],
      },
    });

    // Repeating directional chevrons along all marching lines
    map.addLayer({
      id: 'campaign-routes-chevrons',
      type: 'symbol',
      source: 'campaign-routes',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 68,
        'icon-image': 'tactical-spearhead',
        'icon-size': 0.42,
        'icon-rotate': 90,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': '#FFFFFF',
        'icon-halo-color': ['get', 'color'],
        'icon-halo-width': 1.5,
        'icon-opacity': 0.92,
      },
    });

    // Animated leading vanguard spearhead gliding along each active route
    map.addLayer({
      id: 'campaign-vanguard-heads',
      type: 'symbol',
      source: 'campaign-vanguards',
      layout: {
        'icon-image': 'tactical-spearhead',
        'icon-size': 0.76,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-halo-color': '#FFFDF7',
        'icon-halo-width': 2.2,
      },
    });
  }
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
  setVis('ming-territories-glow', layers.territories);
  setVis('ming-territories-outline', layers.territories);

  setVis('ming-lakes-fill', layers.waterways);
  setVis('ming-rivers-line', layers.waterways);
  setVis('ming-yellow-river-line', layers.waterways);
  setVis('ming-grand-canal-line', layers.waterways);

  setVis('ming-great-wall-line', layers.greatWall);
}

/**
 * Builds curved GeoJSON features for a campaign phase and returns prepared curve metadata
 * for the requestAnimationFrame vanguard spearhead animator & callout badges.
 */
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

  const features: GeoJSON.Feature[] = [];
  const preparedCurves: PreparedRouteCurve[] = [];

  for (const route of phase.routes) {
    const color =
      route.type === 'supply'
        ? '#D69E2E'
        : factionColorMap[route.factionId] ?? '#B83B2A';
    const curved = buildCurvedRouteCoords(route.coordinates, route.type, 18);
    const midSample = sampleAlongPath(curved, 0.52);

    features.push({
      type: 'Feature',
      properties: {
        id: route.id,
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
      color,
      tactic: route.type,
      label: route.label,
      commander: route.commander,
      coords: curved,
      midPoint: midSample.coordinates,
    });
  }

  return {
    featureCollection: {
      type: 'FeatureCollection',
      features,
    },
    preparedCurves,
  };
}

export function updateVanguardAnimationFrame(
  map: maplibregl.Map,
  curves: PreparedRouteCurve[],
  progress: number
): void {
  const src = map.getSource('campaign-vanguards') as GeoJSONSource | undefined;
  if (!src) return;

  if (curves.length === 0) {
    src.setData(EMPTY_FC);
    return;
  }

  const features: GeoJSON.Feature[] = curves.map((curve, idx) => {
    // Slightly stagger multiple routes so parallel columns feel organic
    const staggered = (progress + idx * 0.17) % 1;
    const { coordinates, bearing } = sampleAlongPath(curve.coords, staggered);
    return {
      type: 'Feature',
      properties: {
        id: curve.id,
        color: curve.color,
        bearing,
      },
      geometry: {
        type: 'Point',
        coordinates,
      },
    };
  });

  src.setData({
    type: 'FeatureCollection',
    features,
  });
}
