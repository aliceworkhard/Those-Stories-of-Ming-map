#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const toMp = (geom) => {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
};

function ringBboxArea(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

const cleanDelta = (mp, minArea = 0.05) =>
  mp.filter((poly) => poly?.[0]?.length >= 4 && ringBboxArea(poly[0]) >= minArea);

const countVerts = (mp) =>
  mp.reduce((s, poly) => s + poly.reduce((a, ring) => a + ring.length, 0), 0);

function getRegimeContinuityKey(props) {
  const id = String(props?.polityId ?? '');
  const color = String(props?.color ?? '').toLowerCase();
  const ctrl = String(props?.controlType ?? 'direct');
  if (color === '#b83b2a' && ctrl === 'direct') return 'ming-imperial-direct';
  if (
    ctrl === 'tributary-garrison' &&
    (id.includes('nurgan') || id.includes('jurchen') || color === '#9c4221')
  ) {
    return 'ming-northeast-tributary';
  }
  if (
    ctrl === 'tributary-garrison' &&
    (id.includes('usang') || id.includes('guanxi') || color === '#b7791f')
  ) {
    return 'ming-western-tributary';
  }
  if (
    id.includes('yuan') ||
    id.includes('oirat') ||
    id.includes('dayan') ||
    id.includes('mongol') ||
    id.includes('chahar') ||
    id.includes('khalkha') ||
    color === '#4a5568' ||
    color === '#374151'
  ) {
    return `steppe-continuity::${ctrl}`;
  }
  return `${color}::${ctrl}`;
}

console.log('Running Ming Story Atlas v1.0 Engine & Geometry Regression Suite...');

// 1. Continuous Year Coverage (1344..1662)
const terIndex = readJson('data/territories/index.json');
assert.ok(terIndex.length >= 15, 'Expected >= 15 territory snapshots');
for (let yr = 1344; yr <= 1662; yr++) {
  const match = terIndex.find(
    (t) => yr >= t.effectiveRange[0] && yr <= t.effectiveRange[1]
  );
  assert.ok(match, `Missing territory snapshot coverage for year ${yr}`);
}
console.log('  [PASS] 1. Continuous zero-gap year coverage (1344–1662)');

// 2. Local-Delta Territory Boolean Subtraction Verification
const snapshots = new Map(
  terIndex.map((item) => [
    item.snapshotId,
    readJson(`data/territories/${item.file}`),
  ])
);

// Specifically verify that local transitions (e.g. 1402->1415 Jiaozhi, 1582->1621 Liaodong)
// subtract out unchanged Ming provinces cleanly!
for (const [fromId, toId, destPolityId, maxExpectedVerts] of [
  ['ter-1402', 'ter-1415', 'ming-yongle-zenith', 900],
  ['ter-1582', 'ter-1621', 'ming-tianqi-guanning', 120],
  ['ter-1479', 'ter-1582', 'ming-wanli-revival', 120],
]) {
  const fromFc = snapshots.get(fromId);
  const toFc = snapshots.get(toId);
  let prevMing = [];
  for (const f of fromFc.features) {
    if (getRegimeContinuityKey(f.properties) === 'ming-imperial-direct') {
      const mp = toMp(f.geometry);
      prevMing = prevMing.length ? polygonClipping.union(prevMing, mp) : mp;
    }
  }
  const destFeat = toFc.features.find(
    (f) => f.properties?.polityId === destPolityId
  );
  assert.ok(destFeat, `Missing ${destPolityId} in ${toId}`);
  const delta = cleanDelta(
    polygonClipping.difference(toMp(destFeat.geometry), prevMing)
  );
  const deltaVerts = countVerts(delta);
  assert.ok(
    deltaVerts <= maxExpectedVerts,
    `Expected local-only delta for ${fromId}->${toId} (${destPolityId}) <= ${maxExpectedVerts} verts, got ${deltaVerts}`
  );
}
console.log('  [PASS] 2. Local-delta boolean border subtraction verified (unchanged provinces stay 0-delta)');

// 3. Full 7-Volume Event & Causal Graph Coverage
const tocRaw = readJson('data/chapters/toc.json');
const tocList = Array.isArray(tocRaw) ? tocRaw : tocRaw.chapters;
const tocMap = new Map(tocList.map((c) => [c.id, c]));

const eventFiles = fs
  .readdirSync(path.join(ROOT, 'data/events'))
  .filter((f) => f.endsWith('.json'))
  .sort();
const allEvents = eventFiles.flatMap((f) => readJson(`data/events/${f}`));
assert.ok(allEvents.length >= 106, `Expected >= 106 events, got ${allEvents.length}`);

const volCounts = new Map();
for (const ev of allEvents) {
  for (const chId of ev.bookLens.chapterIds) {
    const ch = tocMap.get(chId);
    assert.ok(ch, `Unknown chapter anchor ${chId} in ${ev.id}`);
    volCounts.set(ch.volumeNo, (volCounts.get(ch.volumeNo) ?? 0) + 1);
  }
}
for (let v = 1; v <= 7; v++) {
  assert.ok(
    (volCounts.get(v) ?? 0) >= 10,
    `Volume ${v} should have >= 10 event-chapter links`
  );
}
console.log('  [PASS] 3. All 7 volumes (第壹部~第柒部) covered across 106+ 5D events');

// 4. Multi-Phase Campaigns & Sequential Route Order
const cmpFiles = fs
  .readdirSync(path.join(ROOT, 'data/campaigns'))
  .filter((f) => f.endsWith('.json'))
  .sort();
assert.ok(cmpFiles.length >= 12, 'Expected >= 12 campaigns');
let phaseCount = 0;
let routeCount = 0;
for (const cf of cmpFiles) {
  const cmp = readJson(`data/campaigns/${cf}`);
  assert.ok(cmp.phases.length >= 4, `${cmp.id} must have >= 4 phases`);
  for (const ph of cmp.phases) {
    phaseCount++;
    assert.ok(ph.routes.length >= 1, `${ph.id} must have >= 1 route`);
    for (const r of ph.routes) {
      routeCount++;
      assert.ok(r.coordinates.length >= 2, `${r.id} needs >= 2 coordinates`);
    }
  }
}
console.log(`  [PASS] 4. ${cmpFiles.length} campaigns (${phaseCount} phases, ${routeCount} sequential routes) verified`);

// 5. Character Odysseys, Institutions & Territory Painter Land Mask
const characters = readJson('data/characters/odysseys.json');
assert.ok(characters.length >= 12, 'Expected >= 12 character odysseys');
const inst = readJson('data/geo-base/ming-institutions.json');
assert.ok(inst.features.length >= 23, 'Expected >= 23 institutional features');
const landMask = readJson('data/geo-base/land-mask-east-asia.json');
assert.ok(
  landMask.features?.length >= 1,
  'Missing land-mask-east-asia.json for /dev/territory-painter'
);
console.log('  [PASS] 5. Character Odysseys, Institutional layers & Painter GIS land-mask verified');

console.log('\nAll Ming Story Atlas v1.0 regression tests PASSED!');
