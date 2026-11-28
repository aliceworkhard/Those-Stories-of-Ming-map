import type { StyleSpecification } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import type { MapVisualTheme, PerformanceMode } from '@/types/ming';

export function getTerrainExaggeration(perfMode: PerformanceMode): number {
  if (perfMode === 'eco') return 0;
  if (perfMode === 'ultra') return 1.28;
  return 1.12;
}

export const TERRAIN_DEM_TILES = [
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
];

export function createTerrainDemSourceSpec(perfMode: PerformanceMode) {
  return {
    type: 'raster-dem' as const,
    tiles: TERRAIN_DEM_TILES,
    tileSize: 256,
    maxzoom: perfMode === 'ultra' ? 10 : 8,
    encoding: 'terrarium' as const,
  };
}

/**
 * Clean-room Oriental Historical Atlas Style Specification (Zero API keys!)
 * - Engineered for whisper-quiet GPU & CPU performance:
 *   1. Default 2.5D mineral hillshading (`hillshade-dem`, maxzoom 7 in balanced / 8 in ultra,
 *      omitted in eco) cuts AWS DEM PNG decodes & hillshade FBO work by 75% with ZERO 3D Drape FBO!
 *   2. Optional 3D Terrain Mesh (`terrain-dem`) is only registered when 3D is toggled ON.
 *   3. Bevel/butt line joins and zoom-gated base layers minimize WebGL line-fan triangle counts
 *      and fragment overdraw across all East Asian coastlines.
 */
export function createHistoricalBaseStyle(
  theme: MapVisualTheme,
  enable3D: boolean,
  perfMode: PerformanceMode = 'balanced'
): StyleSpecification {
  const isDark = theme === 'xuanmo';
  const isEco = perfMode === 'eco';
  const useTerrainMesh = enable3D && !isEco;
  const hillshadeMaxZoom = perfMode === 'ultra' ? 9 : 8;

  // Song/Ming Blue-and-Green Scroll (Light) vs Obsidian-Bronze Sand-Table (Dark)
  const landColor = isDark ? '#0F141D' : '#EFE6D4';
  const woodColor = isDark ? '#152223' : '#DAE2CA';
  const waterColor = isDark ? '#081320' : '#A9C9D8';
  const shorelineColor = isDark ? '#2A557D' : '#53839C';
  const naturalStreamColor = isDark ? '#1E4568' : '#7BA8BE';
  const hillShadow = isDark ? '#020408' : '#6A5840';
  const hillHighlight = isDark ? '#3A475C' : '#FFFDF8';
  const hillAccent = isDark ? '#253142' : '#9B8362';

  const sources: StyleSpecification['sources'] = {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  };

  if (!isEco) {
    sources['hillshade-dem'] = {
      type: 'raster-dem',
      tiles: TERRAIN_DEM_TILES,
      tileSize: 256,
      maxzoom: hillshadeMaxZoom,
      encoding: 'terrarium',
    };
  }

  if (useTerrainMesh) {
    sources['terrain-dem'] = createTerrainDemSourceSpec(perfMode);
  }

  const layers: StyleSpecification['layers'] = [
    {
      id: 'land-background',
      type: 'background',
      paint: {
        'background-color': landColor,
      },
    },
  ];

  if (!isEco) {
    layers.push(
      {
        id: 'landcover-organic',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        minzoom: perfMode === 'ultra' ? 3.5 : 4.8,
        filter: [
          'all',
          ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false],
          ['in', ['get', 'class'], ['literal', ['wood', 'grass']]],
        ],
        paint: {
          'fill-antialias': false,
          'fill-color': woodColor,
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.8,
            isDark ? 0.22 : 0.28,
            9,
            isDark ? 0.32 : 0.38,
          ],
        },
      },
      {
        id: 'mountain-hillshade',
        type: 'hillshade',
        source: 'hillshade-dem',
        paint: {
          'hillshade-illumination-direction': 315,
          'hillshade-exaggeration': isDark ? 0.38 : 0.34,
          'hillshade-shadow-color': hillShadow,
          'hillshade-highlight-color': hillHighlight,
          'hillshade-accent-color': hillAccent,
        },
      }
    );
  }

  layers.push({
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
      'fill-antialias': !isEco,
      'fill-color': waterColor,
    },
  });

  if (!isEco) {
    layers.push({
      id: 'vector-water-shoreline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'water',
      minzoom: 3.5,
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      layout: {
        'line-join': 'bevel',
        'line-cap': 'butt',
      },
      paint: {
        'line-color': shorelineColor,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3.5,
          0.7,
          7,
          1.1,
          11,
          1.55,
        ],
        'line-opacity': isDark ? 0.84 : 0.86,
      },
    });
  }

  layers.push({
    id: 'vector-natural-waterways',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    minzoom: isEco ? 6.0 : 4.8,
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
      'line-join': 'bevel',
      'line-cap': 'butt',
    },
    paint: {
      'line-color': naturalStreamColor,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4.8,
        ['match', ['get', 'class'], 'river', 0.55, 0.22],
        7,
        ['match', ['get', 'class'], 'river', 1.15, 0.5],
        11,
        ['match', ['get', 'class'], 'river', 2.0, 0.9],
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.8, 0.42, 8, 0.68],
    },
  });

  return {
    version: 8,
    name: isDark ? 'Ming-Xuanmo-Sandtable' : 'Ming-Qinglv-Scroll',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources,
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
    layers,
  };
}

function addDiamondSealSprite(
  map: maplibregl.Map,
  name: string,
  char: string,
  bgColor: string,
  borderColor: string,
  activeHalo: boolean,
  logicalSize = 44
): void {
  if (map.hasImage(name)) return;
  const scale = 3;
  const pxSize = Math.round(logicalSize * scale);
  const c = document.createElement('canvas');
  c.width = pxSize;
  c.height = pxSize;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  const m = logicalSize / 2;
  ctx.clearRect(0, 0, logicalSize, logicalSize);

  if (activeHalo) {
    ctx.beginPath();
    ctx.arc(m, m, m - 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.24)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#F59E0B';
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(m, m);
  ctx.rotate(Math.PI / 4);
  const box = activeHalo ? 22 : 19;
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = activeHalo ? 2.4 : 2.0;
  ctx.beginPath();
  ctx.roundRect(-box / 2, -box / 2, box, box, 3.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#FFFBEB';
  ctx.font = `700 ${activeHalo ? 14.5 : 13}px "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, m, m + 0.5);

  const img = ctx.getImageData(0, 0, pxSize, pxSize);
  map.addImage(name, { width: pxSize, height: pxSize, data: img.data }, { pixelRatio: scale });
}

function addCircleSealSprite(
  map: maplibregl.Map,
  name: string,
  char: string,
  bgColor: string,
  borderColor: string,
  activeHalo: boolean,
  logicalSize = 38
): void {
  if (map.hasImage(name)) return;
  const scale = 3;
  const pxSize = Math.round(logicalSize * scale);
  const c = document.createElement('canvas');
  c.width = pxSize;
  c.height = pxSize;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  const m = logicalSize / 2;
  ctx.clearRect(0, 0, logicalSize, logicalSize);

  if (activeHalo) {
    ctx.beginPath();
    ctx.arc(m, m, m - 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.24)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#F59E0B';
    ctx.stroke();
  }

  const radius = activeHalo ? Math.min(14.5, m - 5.2) : Math.min(11.5, m - 4.5);
  ctx.beginPath();
  ctx.arc(m, m, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = activeHalo ? 2.2 : 1.8;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = '#FFFBEB';
  ctx.font = `700 ${activeHalo ? 14 : 12.5}px "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, m, m + 0.5);

  const img = ctx.getImageData(0, 0, pxSize, pxSize);
  map.addImage(name, { width: pxSize, height: pxSize, data: img.data }, { pixelRatio: scale });
}

/**
 * Registers zero-dependency crisp cartographic sprites onto the WebGL atlas
 * so Places, Events (`战` / `史` / `轶`) & Tactical Markers render 100% on GPU
 * with ZERO HTML DOM `maplibregl.Marker` nodes!
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

  // 2. Capital Imperial Diamond Seal (True @3x Retina: 24px logical -> 72px canvas)
  if (!map.hasImage('place-capital-seal')) {
    const s = 24;
    const scale = 3;
    const px = s * scale;
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      const m = s / 2;
      ctx.save();
      ctx.translate(m, m);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#9E2318';
      ctx.strokeStyle = '#F6D379';
      ctx.lineWidth = 2.0;
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.strokeRect(-5.5, -5.5, 11, 11);
      ctx.fillStyle = '#FFF7E0';
      ctx.fillRect(-2.1, -2.1, 4.2, 4.2);
      ctx.restore();
      const img = ctx.getImageData(0, 0, px, px);
      map.addImage(
        'place-capital-seal',
        { width: px, height: px, data: img.data },
        { pixelRatio: scale }
      );
    }
  }

  // 3. Garrison / Pass Fortress Emblem (True @3x Retina: 20px logical -> 60px canvas)
  if (!map.hasImage('place-pass-fort')) {
    const s = 20;
    const scale = 3;
    const px = s * scale;
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.fillStyle = '#8C5218';
      ctx.strokeStyle = '#FBE6B2';
      ctx.lineWidth = 1.8;
      ctx.fillRect(5, 5, 10, 10);
      ctx.strokeRect(5, 5, 10, 10);
      ctx.fillStyle = '#FBE6B2';
      ctx.fillRect(8, 8, 4, 4);
      const img = ctx.getImageData(0, 0, px, px);
      map.addImage(
        'place-pass-fort',
        { width: px, height: px, data: img.data },
        { pixelRatio: scale }
      );
    }
  }

  // 4. Prefecture / Port Classical Ringed Dot (True @3x Retina: 18px logical -> 54px canvas)
  if (!map.hasImage('place-city-dot')) {
    const s = 18;
    const scale = 3;
    const px = s * scale;
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      const m = s / 2;
      ctx.beginPath();
      ctx.arc(m, m, 4.6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFDF7';
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#5C4938';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m, m, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = '#B83B2A';
      ctx.fill();
      const img = ctx.getImageData(0, 0, px, px);
      map.addImage(
        'place-city-dot',
        { width: px, height: px, data: img.data },
        { pixelRatio: scale }
      );
    }
  }

  // 5. GPU Event Medallions (`战` / `史` / `轶` — True @3x Retina, crisp 24–32px CSS size!)
  addDiamondSealSprite(
    map,
    'event-seal-battle',
    '战',
    '#B83B2A',
    '#FDE68A',
    false,
    40
  );
  addDiamondSealSprite(
    map,
    'event-seal-battle-active',
    '战',
    '#8E1912',
    '#FEF08A',
    true,
    44
  );
  addDiamondSealSprite(
    map,
    'event-seal-macro',
    '史',
    '#9F3526',
    '#FDE68A',
    false,
    38
  );
  addDiamondSealSprite(
    map,
    'event-seal-macro-active',
    '史',
    '#8E1912',
    '#FEF08A',
    true,
    44
  );
  addCircleSealSprite(
    map,
    'event-seal-micro',
    '轶',
    '#B76E1D',
    '#FDE68A',
    false,
    34
  );
  addCircleSealSprite(
    map,
    'event-seal-micro-active',
    '轶',
    '#9A3412',
    '#FEF08A',
    true,
    40
  );

  // 5b. SDF Marching Flow Chevron & 9-Slice Callout Banners for Campaign War-Room
  if (!map.hasImage('marching-chevron')) {
    const s = 48;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(s / 2, 7);
      ctx.lineTo(s - 7, s - 11);
      ctx.lineTo(s / 2, s - 21);
      ctx.lineTo(7, s - 11);
      ctx.closePath();
      ctx.fill();
      const img = ctx.getImageData(0, 0, s, s);
      map.addImage(
        'marching-chevron',
        { width: s, height: s, data: img.data },
        { sdf: true, pixelRatio: 2 }
      );
    }
  }

  for (const [id, fill, stroke] of [
    ['callout-pill-light', 'rgba(253, 250, 242, 0.97)', '#9E2318'],
    ['callout-pill-dark', 'rgba(13, 19, 29, 0.96)', '#F59E0B'],
  ] as const) {
    if (!map.hasImage(id)) {
      const w = 96;
      const h = 54;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.roundRect(3, 3, w - 6, h - 6, 15);
        ctx.fill();
        ctx.stroke();
        const img = ctx.getImageData(0, 0, w, h);
        map.addImage(
          id,
          { width: w, height: h, data: img.data },
          {
            pixelRatio: 3,
            stretchX: [[21, 75]],
            stretchY: [[18, 36]],
            content: [18, 10, 78, 44],
          }
        );
      }
    }
  }

  // 6. GPU Battlefield Tactical Shockwave Seals (`围` / `决` / `伏` / `守` / `断` — True @3x Retina!)
  addCircleSealSprite(
    map,
    'battle-marker-siege',
    '围',
    '#9E2318',
    '#FDE68A',
    true,
    40
  );
  addCircleSealSprite(
    map,
    'battle-marker-decisive',
    '决',
    '#B83B2A',
    '#FEF08A',
    true,
    44
  );
  addCircleSealSprite(
    map,
    'battle-marker-ambush',
    '伏',
    '#B45309',
    '#FDE68A',
    true,
    40
  );
  addCircleSealSprite(
    map,
    'battle-marker-defense',
    '守',
    '#1E40AF',
    '#BFDBFE',
    true,
    40
  );
  addCircleSealSprite(
    map,
    'battle-marker-cutoff',
    '断',
    '#6D28D9',
    '#DDD6FE',
    true,
    40
  );
}
