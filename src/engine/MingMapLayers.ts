import type maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { MING_WATERWAYS_GEOJSON } from '@/lib/atlasData';
import {
  buildCurvedRouteCoords,
  sampleAlongPath,
  sliceCurveByProgress,
} from '@/lib/curve';
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
  startPoint: LngLat;
  endPoint: LngLat;
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
  const beforeWaterId = map.getLayer('vector-water-fill')
    ? 'vector-water-fill'
    : undefined;

  // 1. Territories Source & Layers
  if (!map.getSource('ming-territories')) {
    map.addSource('ming-territories', {
      type: 'geojson',
      data: initialTerritories,
    });
  }

  // Place territory fill UNDER crisp vector oceans & lakes so coastlines, islands,
  // Poyang Lake, Dongting Lake, and Taihu Lake stay 100% razor-sharp z14 vector shapes!
  if (!map.getLayer('ming-territories-fill')) {
    map.addLayer(
      {
        id: 'ming-territories-fill',
        type: 'fill',
        source: 'ming-territories',
        paint: {
          'fill-antialias': true,
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'match',
            ['get', 'controlType'],
            'tributary-garrison',
            isDark ? 0.17 : 0.16,
            isDark ? 0.28 : 0.24,
          ],
        },
      },
      beforeWaterId
    );
  }

  if (!map.getLayer('ming-territories-glow')) {
    map.addLayer({
      id: 'ming-territories-glow',
      type: 'line',
      source: 'ming-territories',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.8, 7, 5.5, 10, 8],
        'line-opacity': isDark ? 0.28 : 0.20,
        'line-blur': 2.5,
      },
    });

    map.addLayer({
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
          ['match', ['get', 'controlType'], 'tributary-garrison', 1.0, 1.4],
          7,
          ['match', ['get', 'controlType'], 'tributary-garrison', 1.5, 2.2],
          10,
          ['match', ['get', 'controlType'], 'tributary-garrison', 2.0, 3.0],
        ],
        'line-dasharray': [
          'match',
          ['get', 'controlType'],
          'tributary-garrison',
          ['literal', [3, 2]],
          ['literal', [1, 0]],
        ],
        'line-opacity': isDark ? 0.88 : 0.84,
      },
    });
  }

  // 2. Ming Historical Waterways (Natural Earth 10m + 1194-1855 Duohuai Yellow River + Grand Canal + Ming Great Wall)
  if (!map.getSource('ming-waterways')) {
    map.addSource('ming-waterways', {
      type: 'geojson',
      data: MING_WATERWAYS_GEOJSON,
    });
  }

  if (!map.getLayer('ming-rivers-line')) {
    // Subtle river bank casing for crisp cartographic legibility over territory fills
    map.addLayer({
      id: 'ming-rivers-casing',
      type: 'line',
      source: 'ming-waterways',
      filter: [
        'in',
        ['get', 'kind'],
        ['literal', ['major-river', 'secondary-river']],
      ],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#0B1928' : '#EBF4F8',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          ['match', ['get', 'kind'], 'major-river', 2.2, 1.2],
          7,
          ['match', ['get', 'kind'], 'major-river', 4.2, 2.4],
          10,
          ['match', ['get', 'kind'], 'major-river', 6.2, 3.6],
        ],
        'line-opacity': isDark ? 0.55 : 0.65,
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
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#3882BA' : '#3B7EA1',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          ['match', ['get', 'kind'], 'major-river', 1.3, 0.7],
          7,
          ['match', ['get', 'kind'], 'major-river', 2.6, 1.45],
          10,
          ['match', ['get', 'kind'], 'major-river', 4.0, 2.2],
        ],
        'line-opacity': 0.9,
      },
    });

    // Historical Ming Yellow River (1194-1855 Duohuai Course!) with warm casing + Ochre-Gold core
    map.addLayer({
      id: 'ming-yellow-river-casing',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'yellow-river-ming'],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#1A1408' : '#FBF4E2',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.6, 7, 4.6, 10, 6.8],
        'line-opacity': 0.72,
      },
    });

    map.addLayer({
      id: 'ming-yellow-river-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'yellow-river-ming'],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#E0A838' : '#BE7B1E',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 1.5, 7, 2.8, 10, 4.2],
        'line-opacity': 0.94,
      },
    });

    // Grand Canal (Ming Grain Lifeline)
    map.addLayer({
      id: 'ming-grand-canal-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'canal'],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#38B2AC' : '#0E8A7E',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 7, 2.2, 10, 3.2],
        'line-dasharray': [2.2, 1.4],
        'line-opacity': 0.92,
      },
    });

    // Curved Vector Waterway Labels along real river bends!
    map.addLayer({
      id: 'ming-waterways-label',
      type: 'symbol',
      source: 'ming-waterways',
      minzoom: 4.6,
      filter: [
        'in',
        ['get', 'kind'],
        ['literal', ['yellow-river-ming', 'major-river', 'canal', 'secondary-river']],
      ],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 420,
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4.6, 10, 8, 12],
        'text-letter-spacing': 0.15,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'kind'],
          'yellow-river-ming',
          isDark ? '#F6CA65' : '#8C530D',
          'canal',
          isDark ? '#6EE7B7' : '#0B6B61',
          isDark ? '#7CC1E8' : '#265E7D',
        ],
        'text-halo-color': isDark ? 'rgba(15, 20, 28, 0.88)' : 'rgba(250, 246, 236, 0.92)',
        'text-halo-width': 1.5,
      },
    });

    // Ming Great Wall (Double-layered crenellated wall line)
    map.addLayer({
      id: 'ming-great-wall-casing',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'great-wall'],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': isDark ? '#2D3748' : '#8C7A6B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 2.4, 7, 4.0, 10, 5.5],
        'line-opacity': 0.55,
      },
    });

    map.addLayer({
      id: 'ming-great-wall-line',
      type: 'line',
      source: 'ming-waterways',
      filter: ['==', ['get', 'kind'], 'great-wall'],
      layout: {
        'line-cap': 'butt',
        'line-join': 'miter',
      },
      paint: {
        'line-color': isDark ? '#CBD5E0' : '#4E3D34',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 1.5, 7, 2.5, 10, 3.6],
        'line-dasharray': [1.6, 1.0],
        'line-opacity': 0.88,
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
        'line-width': 11,
        'line-opacity': 0.30,
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
        'line-width': ['match', ['get', 'tactic'], 'naval', 4.6, 4.2],
        'line-opacity': 0.94,
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
        'line-width': ['match', ['get', 'tactic'], 'ambush', 3.8, 3.0],
        'line-dasharray': [2.2, 1.5],
        'line-opacity': ['match', ['get', 'tactic'], 'retreat', 0.76, 0.95],
      },
    });

    // Repeating directional chevrons along marching lines
    map.addLayer({
      id: 'campaign-routes-chevrons',
      type: 'symbol',
      source: 'campaign-routes',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 64,
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
        'icon-size': 0.84,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-halo-color': '#FFFDF7',
        'icon-halo-width': 2.4,
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

  setVis('vector-natural-waterways', layers.waterways);
  setVis('ming-rivers-casing', layers.waterways);
  setVis('ming-rivers-line', layers.waterways);
  setVis('ming-yellow-river-casing', layers.waterways);
  setVis('ming-yellow-river-line', layers.waterways);
  setVis('ming-grand-canal-line', layers.waterways);
  setVis('ming-waterways-label', layers.waterways);

  setVis('ming-great-wall-casing', layers.greatWall);
  setVis('ming-great-wall-line', layers.greatWall);
}

/**
 * Builds curved GeoJSON features for a campaign phase and returns prepared curve metadata
 * for the progressive route growth + vanguard spearhead animator & callout badges.
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
    const curved = buildCurvedRouteCoords(route.coordinates, route.type, 22);
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
      startPoint: curved[0],
      endPoint: curved[curved.length - 1],
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

/**
 * Updates both progressive route extension (`growProgress` 0..1) and leading/pulsing
 * vanguard spearhead symbols (`pulseProgress` 0..1) at 60fps.
 */
export function updateCampaignAnimationFrame(
  map: maplibregl.Map,
  curves: PreparedRouteCurve[],
  growProgress: number,
  pulseProgress: number
): void {
  const routeSrc = map.getSource('campaign-routes') as GeoJSONSource | undefined;
  const vanguardSrc = map.getSource('campaign-vanguards') as
    | GeoJSONSource
    | undefined;
  if (!routeSrc || !vanguardSrc) return;

  if (curves.length === 0) {
    routeSrc.setData(EMPTY_FC);
    vanguardSrc.setData(EMPTY_FC);
    return;
  }

  const isGrowing = growProgress < 0.999;
  const maxStagger = Math.min(0.32, Math.max(0, (curves.length - 1) * 0.08));
  const routeFeatures: GeoJSON.Feature[] = [];
  const vanguardFeatures: GeoJSON.Feature[] = [];

  curves.forEach((curve, idx) => {
    const delay = curves.length > 1 ? (idx / (curves.length - 1)) * maxStagger : 0;
    const localGrow = isGrowing
      ? Math.max(0.02, Math.min(1, (growProgress - delay) / (1 - maxStagger)))
      : 1;

    const { sliced, headCoord, headBearing } = sliceCurveByProgress(
      curve.coords,
      localGrow
    );

    routeFeatures.push({
      type: 'Feature',
      properties: {
        id: curve.id,
        color: curve.color,
        tactic: curve.tactic,
        label: curve.label,
      },
      geometry: {
        type: 'LineString',
        coordinates: sliced,
      },
    });

    // While route is still marching toward its objective, keep spearhead pinned to the advancing tip!
    // Once full route has arrived, stream tactical pulse spearheads continuously along the line.
    if (localGrow < 0.999) {
      vanguardFeatures.push({
        type: 'Feature',
        properties: {
          id: curve.id,
          color: curve.color,
          bearing: headBearing,
        },
        geometry: {
          type: 'Point',
          coordinates: headCoord,
        },
      });
    } else {
      const staggeredPulse = (pulseProgress + idx * 0.19) % 1;
      const { coordinates, bearing } = sampleAlongPath(
        curve.coords,
        staggeredPulse
      );
      vanguardFeatures.push({
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
      });
    }
  });

  routeSrc.setData({
    type: 'FeatureCollection',
    features: routeFeatures,
  });
  vanguardSrc.setData({
    type: 'FeatureCollection',
    features: vanguardFeatures,
  });
}
