import type { StyleSpecification } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import type { MapVisualTheme } from '@/types/ming';

/**
 * Clean-room Oriental Historical Map Style Specification (Zero commercial API keys!)
 * - Uses MapLibre open country landmass polygons filled uniformly so 0 modern national borders appear
 * - Uses public-domain AWS Open Data Terrarium elevation tiles for 3D terrain & mountain relief
 * - Eliminates 100% of modern roads, railways, modern provincial borders, and modern commercial POIs
 */
export function createHistoricalBaseStyle(
  theme: MapVisualTheme,
  enable3D: boolean
): StyleSpecification {
  const isDark = theme === 'xuanmo';

  const oceanColor = isDark ? '#0D1520' : '#CFE0E5';
  const landColor = isDark ? '#1A1E24' : '#F2ECE0';
  const hillShadow = isDark ? '#05070A' : '#8A7B65';
  const hillHighlight = isDark ? '#3B4252' : '#FCF9F2';

  return {
    version: 8,
    name: isDark ? 'Ming-Xuanmo-Dark' : 'Ming-Xuanzhi-Light',
    sources: {
      'natural-land': {
        type: 'vector',
        url: 'https://demotiles.maplibre.org/tiles/tiles.json',
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
            exaggeration: 1.85,
          },
        }
      : {}),
    layers: [
      {
        id: 'ocean-background',
        type: 'background',
        paint: {
          'background-color': oceanColor,
        },
      },
      {
        id: 'natural-landmass-fill',
        type: 'fill',
        source: 'natural-land',
        'source-layer': 'countries',
        paint: {
          'fill-color': landColor,
          'fill-outline-color': landColor,
        },
      },
      {
        id: 'mountain-hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
          'hillshade-exaggeration': isDark ? 0.55 : 0.45,
          'hillshade-shadow-color': hillShadow,
          'hillshade-highlight-color': hillHighlight,
          'hillshade-accent-color': isDark ? '#252B36' : '#A99980',
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
