import type { StyleSpecification } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import type { MapVisualTheme } from '@/types/ming';

export const TERRAIN_EXAGGERATION = 1.35;

/**
 * Clean-room Oriental Vector Historical Atlas Style Specification (Zero API keys!)
 * - Uses OpenFreeMap multi-zoom OpenMapTiles vector tiles (z0-z14) for razor-sharp
 *   coastlines, archipelagos, estuaries, lakes (Poyang, Dongting, Taihu, Hongze),
 *   forests, and natural river networks.
 * - Uses subtle ink-wash hillshading underneath crisp vector water so there is
 *   zero blurry raster texture over oceans, lakes, or shorelines.
 * - Excludes 100% of modern roads, railways, buildings, airports, and modern borders.
 */
export function createHistoricalBaseStyle(
  theme: MapVisualTheme,
  enable3D: boolean
): StyleSpecification {
  const isDark = theme === 'xuanmo';

  const landColor = isDark ? '#141923' : '#F4EFE4';
  const woodColor = isDark ? '#1A2421' : '#E5E3D3';
  const waterColor = isDark ? '#0B1928' : '#BDD9E5';
  const waterRimGlow = isDark ? '#15314B' : '#9DC4D6';
  const shorelineColor = isDark ? '#274C70' : '#739CB0';
  const naturalStreamColor = isDark ? '#1F4468' : '#89B4C8';
  const hillShadow = isDark ? '#05080D' : '#7D6F5B';
  const hillHighlight = isDark ? '#2E3748' : '#FDFBF5';

  return {
    version: 8,
    name: isDark ? 'Ming-Xuanmo-Vector-Dark' : 'Ming-Xuanzhi-Vector-Light',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
      'terrain-dem': {
        type: 'raster-dem',
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 13,
        encoding: 'terrarium',
      },
    },
    ...(enable3D
      ? {
          terrain: {
            source: 'terrain-dem',
            exaggeration: TERRAIN_EXAGGERATION,
          },
        }
      : {}),
    layers: [
      {
        id: 'land-background',
        type: 'background',
        paint: {
          'background-color': landColor,
        },
      },
      {
        id: 'landcover-organic',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: [
          'all',
          ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
          ['in', ['get', 'class'], ['literal', ['wood', 'grass']]],
        ],
        paint: {
          'fill-color': woodColor,
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            isDark ? 0.22 : 0.28,
            9,
            isDark ? 0.32 : 0.38,
          ],
        },
      },
      {
        id: 'mountain-hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
          'hillshade-exaggeration': isDark ? 0.22 : 0.16,
          'hillshade-shadow-color': hillShadow,
          'hillshade-highlight-color': hillHighlight,
          'hillshade-accent-color': isDark ? '#1E2736' : '#B2A38C',
        },
      },
      {
        id: 'vector-water-fill',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: [
          'all',
          ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
          ['!=', ['get', 'brunnel'], 'tunnel'],
        ],
        paint: {
          'fill-antialias': true,
          'fill-color': waterColor,
        },
      },
      {
        id: 'vector-water-inner-glow',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': waterRimGlow,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.8, 9, 3.6],
          'line-opacity': isDark ? 0.45 : 0.55,
          'line-blur': 1.5,
        },
      },
      {
        id: 'vector-water-shoreline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': shorelineColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.65, 7, 1.0, 11, 1.4],
          'line-opacity': isDark ? 0.85 : 0.88,
        },
      },
      {
        id: 'vector-natural-waterways',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        minzoom: 4,
        filter: [
          'all',
          ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
          ['!=', ['get', 'brunnel'], 'tunnel'],
          ['in', ['get', 'class'], ['literal', ['river', 'stream']]],
          // Hide modern post-1855 Shandong Yellow River course so Ming 1194-1855 Duohuai Yellow River stands authoritative
          ['!=', ['get', 'name'], '黄河'],
          ['!=', ['get', 'name:zh'], '黄河'],
        ],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': naturalStreamColor,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            ['match', ['get', 'class'], 'river', 0.55, 0.25],
            7,
            ['match', ['get', 'class'], 'river', 1.15, 0.55],
            11,
            ['match', ['get', 'class'], 'river', 2.2, 1.0],
          ],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.48, 8, 0.72],
        },
      },
    ],
  };
}

/**
 * Programmatically draws crisp SDF tactical spearhead sprite onto an offscreen canvas
 * and registers it into MapLibre so WebGL symbol layers can tint it to any faction color
 * with ZERO external sprite PNG dependencies.
 */
export function registerTacticalSprites(map: maplibregl.Map): void {
  if (!map.hasImage('tactical-spearhead')) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#FFFFFF';
      // Pointing UP (North = 0 deg bearing for point symbols; +90 deg rotate aligns along line)
      ctx.beginPath();
      ctx.moveTo(size / 2, 6);
      ctx.lineTo(size - 10, size - 10);
      ctx.lineTo(size / 2, size - 22);
      ctx.lineTo(10, size - 10);
      ctx.closePath();
      ctx.fill();

      const imgData = ctx.getImageData(0, 0, size, size);
      map.addImage(
        'tactical-spearhead',
        { width: size, height: size, data: imgData.data },
        { sdf: true, pixelRatio: 2 }
      );
    }
  }
}
