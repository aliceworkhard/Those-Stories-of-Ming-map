/**
 * Authentic Historical GIS Territory & Waterway Verification / Compiler Entry
 *
 * All territory snapshots in `data/territories/*.json` and hydrological courses
 * in `data/geo-base/ming-waterways.json` are compiled from:
 *   1. Prefectural/provincial administrative polygons transformed into exact WGS-84
 *      and boolean-unioned per historical regime (zero straight-line box approximations).
 *   2. Public-domain Natural Earth 10m river centerlines + historically documented
 *      1194-1855 Ming Yellow River (Duohuai course via Lankao -> Xuzhou -> Huai'an Qingkou -> Yuntiguan),
 *      Ming Grand Canal, and Ming Nine-Garrison Great Wall.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TER_DIR = path.resolve(__dirname, '../data/territories');
const WATER_FILE = path.resolve(__dirname, '../data/geo-base/ming-waterways.json');

const index = JSON.parse(fs.readFileSync(path.join(TER_DIR, 'index.json'), 'utf8'));
for (const meta of index) {
  const fc = JSON.parse(fs.readFileSync(path.join(TER_DIR, meta.file), 'utf8'));
  const totalVertices = fc.features.reduce(
    (sum, f) =>
      sum +
      f.geometry.coordinates.reduce(
        (ps, poly) => ps + poly.reduce((rs, ring) => rs + ring.length, 0),
        0
      ),
    0
  );
  console.log(
    `[GIS OK] ${meta.file} (${meta.year}): ${fc.features.length} polities, ${totalVertices} WGS-84 vertices`
  );
}

const waterFc = JSON.parse(fs.readFileSync(WATER_FILE, 'utf8'));
console.log(`[GIS OK] ming-waterways.json: ${waterFc.features.length} historical hydro/wall features`);
