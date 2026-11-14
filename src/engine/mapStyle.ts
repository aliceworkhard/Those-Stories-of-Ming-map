import type { StyleSpecification } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import type { MapVisualTheme, PerformanceMode } from '@/types/ming';

export function getTerrainExaggeration(perfMode: PerformanceMode): number {
  if (perfMode === 'eco') return 0;
  if (perfMode === 'ultra') return 1.32;
  return 1.15;
}

/**
 * Clean-room Oriental Historical Atlas Style Specification (Zero API keys!)
 * - Engineered for BOTH museum-grade Song/Ming Blue-and-Green ("千里江山·宣纸青绿") /
 *   Obsidian-Gold ("玄墨鎏金") aesthetics AND whisper-quiet GPU efficiency:
 *   1. Strictly separates `hillshade-dem` (maxzoom 8 = ~4 tiles for East Asia) from
 *      `terrain-dem` (maxzoom 9 in balanced, 11 in ultra) to eliminate MapLibre
 *      DEM texture cache thrashing!
 *   2. Uses OpenFreeMap multi-zoom vector tiles (z0-z14) for razor-sharp coastlines,
 *      islands, lakes, and natural river networks, with 0% modern road/border clutter.
 */
export function createHistoricalBaseStyle(
  theme: MapVisualTheme,
  enable3D: boolean,
  perfMode: PerformanceMode = 'balanced'
): StyleSpecification {
  const isDark = theme === 'xuanmo';
  const useTerrainMesh = enable3D && perfMode !== 'eco';
  const terrainMaxZoom = perfMode === 'ultra' ? 11 : 9;

  // Song/Ming Blue-and-Green Scroll (Light) vs Obsidian-Bronze Sand-Table (Dark)
  const landColor = isDark ? '#0F141D' : '#EFE6D4';
  const woodColor = isDark ? '#152223' : '#DAE2CA';
  const waterColor = isDark ? '#081320' : '#A9C9D8';
  const waterInnerRipple = isDark ? '#142E49' : '#86B1C6';
  const shorelineColor = isDark ? '#2A557D' : '#53839C';
  const naturalStreamColor = isDark ? '#1E4568' : '#7BA8BE';
  const hillShadow = isDark ? '#020408' : '#6A5840';
  const hillHighlight = isDark ? '#3A475C' : '#FFFDF8';
  const hillAccent = isDark ? '#253142' : '#9B8362';

  const demTiles = [
    'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  ];

  return {
    version: 8,
    name: isDark ? 'Ming-Xuanmo-Sandtable' : 'Ming-Qinglv-Scroll',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
      // Dedicated low-zoom DEM exclusively for 2.5D mineral hillshading (tiny memory footprint!)
      'hillshade-dem': {
        type: 'raster-dem',
        tiles: demTiles,
        tileSize: 256,
        maxzoom: 8,
        encoding: 'terrarium',
      },
      // Dedicated DEM source for 3D mesh elevation (never shared with hillshade!)
      'terrain-dem': {
        type: 'raster-dem',
        tiles: demTiles,
        tileSize: 256,
        maxzoom: terrainMaxZoom,
        encoding: 'terrarium',
      },
    },
    ...(useTerrainMesh
      ? {
          terrain: {
            source: 'terrain-dem',
            exaggeration: getTerrainExaggeration(perfMode),
          },
          sky: {
            'sky-color': isDark ? '#070B12' : '#DFECEF',
            'horizon-color': isDark ? '#162233' : '#F3EDE0',
            'fog-color': isDark ? '#0F141D' : '#EFE6D4',
            'fog-ground-blend': 0.65,
            'horizon-fog-blend': 0.75,
            'sky-horizon-blend': 0.5,
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
            isDark ? 0.25 : 0.34,
            9,
            isDark ? 0.35 : 0.44,
          ],
        },
      },
      {
        id: 'mountain-hillshade',
        type: 'hillshade',
        source: 'hillshade-dem',
        paint: {
          'hillshade-illumination-direction': 315,
          'hillshade-exaggeration': isDark ? 0.38 : 0.33,
          'hillshade-shadow-color': hillShadow,
          'hillshade-highlight-color': hillHighlight,
          'hillshade-accent-color': hillAccent,
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
          'line-color': waterInnerRipple,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.8, 9, 3.8],
          'line-opacity': isDark ? 0.5 : 0.62,
          'line-blur': 1.2,
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
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.7,
            7,
            1.1,
            11,
            1.5,
          ],
          'line-opacity': isDark ? 0.88 : 0.9,
        },
      },
      {
        id: 'vector-natural-waterways',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        minzoom: 4.2,
        filter: [
          'all',
          [
            'match',
            ['geometry-type'],
            ['LineString', 'MultiLineString'],
            true,
            false,
          ],
          ['!=', ['get', 'brunnel'], 'tunnel'],
          ['in', ['get', 'class'], ['literal', ['river', 'stream']]],
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
            4.2,
            ['match', ['get', 'class'], 'river', 0.55, 0.22],
            7,
            ['match', ['get', 'class'], 'river', 1.15, 0.5],
            11,
            ['match', ['get', 'class'], 'river', 2.1, 0.95],
          ],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.2, 0.45, 8, 0.7],
        },
      },
    ],
  };
}

/**
 * Registers zero-dependency crisp cartographic sprites onto the WebGL atlas:
 * 1. `tactical-spearhead` (SDF): tintable directional spearhead for routes & causal arcs
 * 2. `place-capital-seal`: imperial vermilion-gold double-diamond emblem for Capitals
 * 3. `place-pass-fort`: fortress battlement square for Nine Garrisons & Strategic Passes
 * 4. `place-city-dot`: classical ringed ink/jade dot for Prefectures & Ports
 */
export function registerTacticalSprites(map: maplibregl.Map): void {
  // 1. SDF Spearhead
  if (!map.hasImage('tactical-spearhead')) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(size / 2, 5);
      ctx.lineTo(size - 9, size - 9);
      ctx.lineTo(size / 2, size - 21);
      ctx.lineTo(9, size - 9);
      ctx.closePath();
      ctx.fill();
      const img = ctx.getImageData(0, 0, size, size);
      map.addImage(
        'tactical-spearhead',
        { width: size, height: size, data: img.data },
        { sdf: true, pixelRatio: 2 }
      );
    }
  }

  // 2. Capital Imperial Diamond Seal
  if (!map.hasImage('place-capital-seal')) {
    const s = 36;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const ctx = c.getContext('2d');
    if (ctx) {
      const m = s / 2;
      ctx.save();
      ctx.translate(m, m);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#9E2318';
      ctx.strokeStyle = '#F6D379';
      ctx.lineWidth = 3;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.fillStyle = '#FFF7E0';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
      const img = ctx.getImageData(0, 0, s, s);
      map.addImage(
        'place-capital-seal',
        { width: s, height: s, data: img.data },
        { pixelRatio: 2 }
      );
    }
  }

  // 3. Garrison / Pass Fortress Emblem
  if (!map.hasImage('place-pass-fort')) {
    const s = 28;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#8C5218';
      ctx.strokeStyle = '#FBE6B2';
      ctx.lineWidth = 2.4;
      ctx.fillRect(6, 6, 16, 16);
      ctx.strokeRect(6, 6, 16, 16);
      ctx.fillStyle = '#FBE6B2';
      ctx.fillRect(11, 11, 6, 6);
      const img = ctx.getImageData(0, 0, s, s);
      map.addImage(
        'place-pass-fort',
        { width: s, height: s, data: img.data },
        { pixelRatio: 2 }
      );
    }
  }

  // 4. Prefecture / Port Classical Ringed Dot
  if (!map.hasImage('place-city-dot')) {
    const s = 24;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const ctx = c.getContext('2d');
    if (ctx) {
      const m = s / 2;
      ctx.beginPath();
      ctx.arc(m, m, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFDF7';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#5C4938';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m, m, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#B83B2A';
      ctx.fill();
      const img = ctx.getImageData(0, 0, s, s);
      map.addImage(
        'place-city-dot',
        { width: s, height: s, data: img.data },
        { pixelRatio: 2 }
      );
    }
  }
}
