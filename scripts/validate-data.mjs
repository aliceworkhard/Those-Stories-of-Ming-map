/**
 * Open-Source Dataset Integrity, Cross-Reference & Copyright Compliance Validator
 * Run via: npm run validate:data
 * 100% Node.js ESM (Zero Python dependency)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

let errors = 0;
let checks = 0;

function fail(msg) {
  console.error(`  [FAIL] ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`  [OK]   ${msg}`);
  checks++;
}

function checkCoord(coord, ctx) {
  if (
    !Array.isArray(coord) ||
    coord.length !== 2 ||
    typeof coord[0] !== 'number' ||
    typeof coord[1] !== 'number' ||
    coord[0] < 20 ||
    coord[0] > 160 ||
    coord[1] < -20 ||
    coord[1] > 65
  ) {
    fail(`${ctx}: Invalid WGS-84 [lng, lat] coordinate ${JSON.stringify(coord)}`);
  }
}

// 1. Check repository root & data/ for forbidden copyright book files
console.log('1. Checking copyright & file isolation boundaries...');
function scanForbiddenFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForbiddenFiles(full);
    } else if (/\.(epub|mobi|azw3)$/i.test(entry.name) || /lunarora/i.test(entry.name)) {
      fail(`Forbidden copyright file detected inside open-source repo: ${full}`);
    }
  }
}
scanForbiddenFiles(ROOT);
ok('Zero copyrighted raw e-book files inside repository');

// 2. Validate TOC Index
console.log('2. Validating data/chapters/toc.json...');
const tocPath = path.join(DATA_DIR, 'chapters', 'toc.json');
if (!fs.existsSync(tocPath)) {
  fail('Missing data/chapters/toc.json');
  process.exit(1);
}
const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
const chapterIdSet = new Set();
if (toc.meta?.totalVolumes !== 7 || !Array.isArray(toc.chapters) || toc.chapters.length < 150) {
  fail(`Unexpected TOC counts: volumes=${toc.meta?.totalVolumes}, chapters=${toc.chapters?.length}`);
} else {
  for (const ch of toc.chapters) {
    if (chapterIdSet.has(ch.id)) fail(`Duplicate chapter ID: ${ch.id}`);
    chapterIdSet.add(ch.id);
    if (ch.chapterTitle.length > 60) {
      fail(`Chapter title suspiciously long (check no prose leaked): ${ch.id}`);
    }
  }
  ok(`TOC index verified (${toc.chapters.length} unique chapter anchors across 7 volumes)`);
}

// 3. Validate Places
console.log('3. Validating data/geo-base/ming-places.json...');
const placesPath = path.join(DATA_DIR, 'geo-base', 'ming-places.json');
const placeIdSet = new Set();
if (fs.existsSync(placesPath)) {
  const places = JSON.parse(fs.readFileSync(placesPath, 'utf8'));
  for (const p of places) {
    if (!p.id?.startsWith('place-')) fail(`Invalid place id: ${p.id}`);
    if (placeIdSet.has(p.id)) fail(`Duplicate place id: ${p.id}`);
    placeIdSet.add(p.id);
    checkCoord(p.coordinates, `Place ${p.id}`);
  }
  ok(`Places dictionary verified (${places.length} historical places)`);
}

// 4. Validate Campaigns
console.log('4. Validating data/campaigns/*.json...');
const campaignsDir = path.join(DATA_DIR, 'campaigns');
const campaignIdSet = new Set();
if (fs.existsSync(campaignsDir)) {
  const cmpFiles = fs.readdirSync(campaignsDir).filter((f) => f.endsWith('.json'));
  for (const file of cmpFiles) {
    const cmp = JSON.parse(fs.readFileSync(path.join(campaignsDir, file), 'utf8'));
    if (!cmp.id?.startsWith('cmp-')) fail(`Invalid campaign id in ${file}`);
    campaignIdSet.add(cmp.id);
    const factionIds = new Set((cmp.factions || []).map((f) => f.id));
    for (const chId of cmp.chapterIds || []) {
      if (!chapterIdSet.has(chId)) fail(`Campaign ${cmp.id} references unknown chapterId ${chId}`);
    }
    for (const phase of cmp.phases || []) {
      checkCoord(phase.camera?.center, `${cmp.id} phase ${phase.phaseNo} camera`);
      for (const route of phase.routes || []) {
        if (!factionIds.has(route.factionId)) {
          fail(`${cmp.id} route ${route.id} references unknown factionId ${route.factionId}`);
        }
        if (!Array.isArray(route.coordinates) || route.coordinates.length < 2) {
          fail(`${cmp.id} route ${route.id} must have >= 2 coordinates`);
        }
        route.coordinates.forEach((c, idx) =>
          checkCoord(c, `${cmp.id} route ${route.id}[${idx}]`)
        );
      }
      for (const marker of phase.markers || []) {
        checkCoord(marker.coordinates, `${cmp.id} marker ${marker.id}`);
      }
    }
  }
  if (cmpFiles.length > 0) {
    ok(`Campaigns verified (${cmpFiles.length} multi-phase campaign packages)`);
  }
}

// 5. Validate Events & Causal Cross-References
console.log('5. Validating data/events/*.json...');
const eventsDir = path.join(DATA_DIR, 'events');
const allEvents = [];
const eventIdSet = new Set();
if (fs.existsSync(eventsDir)) {
  const evtFiles = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.json'));
  for (const file of evtFiles) {
    const list = JSON.parse(fs.readFileSync(path.join(eventsDir, file), 'utf8'));
    for (const evt of list) {
      if (!evt.id?.startsWith('evt-')) fail(`Invalid event id in ${file}: ${evt.id}`);
      if (eventIdSet.has(evt.id)) fail(`Duplicate event id: ${evt.id}`);
      eventIdSet.add(evt.id);
      allEvents.push(evt);
      checkCoord(evt.location?.coordinates, `Event ${evt.id} location`);
      checkCoord(evt.camera?.center, `Event ${evt.id} camera`);
      if (placeIdSet.size > 0 && !placeIdSet.has(evt.location?.placeId)) {
        fail(`Event ${evt.id} references unknown placeId ${evt.location?.placeId}`);
      }
      if (!evt.why?.geoFactor || !evt.why?.systemFactor) {
        fail(`Event ${evt.id} missing required 'why' geoFactor/systemFactor`);
      }
      if (!evt.bookLens?.mingyuePerspective || !evt.bookLens?.historicalNote) {
        fail(`Event ${evt.id} missing required 'bookLens' dual perspective`);
      }
      if (evt.bookLens?.mingyuePerspective?.length > 900) {
        fail(`Event ${evt.id} mingyuePerspective exceeds 900 chars (keep concise & original)`);
      }
      for (const chId of evt.bookLens?.chapterIds || []) {
        if (!chapterIdSet.has(chId)) fail(`Event ${evt.id} references unknown chapterId ${chId}`);
      }
      if (evt.campaignId && !campaignIdSet.has(evt.campaignId)) {
        fail(`Event ${evt.id} references unknown campaignId ${evt.campaignId}`);
      }
    }
  }
  for (const evt of allEvents) {
    for (const prevId of evt.why.prevEventIds || []) {
      if (!eventIdSet.has(prevId)) fail(`Event ${evt.id} prevEventId not found: ${prevId}`);
    }
    for (const nextId of evt.why.nextEventIds || []) {
      if (!eventIdSet.has(nextId)) fail(`Event ${evt.id} nextEventId not found: ${nextId}`);
    }
  }
  if (allEvents.length > 0) {
    const macroCount = allEvents.filter((e) => e.tier === 'macro').length;
    const microCount = allEvents.filter((e) => e.tier === 'micro').length;
    ok(
      `Events & causal graph verified (${allEvents.length} total: ${macroCount} macro, ${microCount} micro)`
    );
  }
}

// 6. Validate High-Resolution GIS Territories & Waterways
console.log('6. Validating data/territories/ & data/geo-base/ming-waterways.json...');
const terIndexPath = path.join(DATA_DIR, 'territories', 'index.json');
if (fs.existsSync(terIndexPath)) {
  const terIndex = JSON.parse(fs.readFileSync(terIndexPath, 'utf8'));
  for (const item of terIndex) {
    const fPath = path.join(DATA_DIR, 'territories', item.file);
    if (!fs.existsSync(fPath)) {
      fail(`Territory snapshot file missing: ${item.file}`);
      continue;
    }
    const fc = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    const totalPts = (fc.features || []).reduce(
      (sum, f) =>
        sum +
        (f.geometry?.coordinates || []).reduce(
          (ps, poly) => ps + poly.reduce((rs, ring) => rs + ring.length, 0),
          0
        ),
      0
    );
    if (totalPts < 1500) {
      fail(`Territory snapshot ${item.file} has too few GIS vertices (${totalPts} < 1500)`);
    }
  }
  ok(`Territories index & high-res GIS geometry verified (${terIndex.length} historical snapshots)`);
}

const waterwaysPath = path.join(DATA_DIR, 'geo-base', 'ming-waterways.json');
if (fs.existsSync(waterwaysPath)) {
  const wfc = JSON.parse(fs.readFileSync(waterwaysPath, 'utf8'));
  if (!Array.isArray(wfc.features) || wfc.features.length < 10) {
    fail(`ming-waterways.json expected >= 10 GIS features, got ${wfc.features?.length}`);
  } else {
    ok(`Historical GIS waterways & Ming Great Wall verified (${wfc.features.length} features)`);
  }
}

const landformsPath = path.join(DATA_DIR, 'geo-base', 'ming-landforms.json');
if (fs.existsSync(landformsPath)) {
  const lfc = JSON.parse(fs.readFileSync(landformsPath, 'utf8'));
  if (!Array.isArray(lfc.features) || lfc.features.length < 15) {
    fail(`ming-landforms.json expected >= 15 landform features, got ${lfc.features?.length}`);
  } else {
    ok(`Historical mountain ridges, lakes & seas verified (${lfc.features.length} features)`);
  }
}

// 7. Validate Character Odysseys & Institutional Thematic Layers
console.log('7. Validating data/characters/odysseys.json & data/geo-base/ming-institutions.json...');
const odysseysPath = path.join(DATA_DIR, 'characters', 'odysseys.json');
if (fs.existsSync(odysseysPath)) {
  const chars = JSON.parse(fs.readFileSync(odysseysPath, 'utf8'));
  const charIds = new Set();
  for (const ch of chars) {
    if (!ch.id?.startsWith('char-')) fail(`Invalid character id: ${ch.id}`);
    if (charIds.has(ch.id)) fail(`Duplicate character id: ${ch.id}`);
    charIds.add(ch.id);
    if (!Array.isArray(ch.stops) || ch.stops.length < 3) {
      fail(`Character ${ch.id} must have >= 3 stops`);
    }
    for (const st of ch.stops || []) {
      checkCoord(st.coordinates, `${ch.id} stop ${st.step}`);
      if (st.eventId && !eventIdSet.has(st.eventId)) {
        fail(`Character ${ch.id} stop ${st.step} references unknown eventId ${st.eventId}`);
      }
    }
  }
  ok(`Character Odysseys verified (${chars.length} historical figures)`);
}

const instPath = path.join(DATA_DIR, 'geo-base', 'ming-institutions.json');
if (fs.existsSync(instPath)) {
  const ifc = JSON.parse(fs.readFileSync(instPath, 'utf8'));
  if (!Array.isArray(ifc.features) || ifc.features.length < 20) {
    fail(`ming-institutions.json expected >= 20 features, got ${ifc.features?.length}`);
  } else {
    for (const f of ifc.features) {
      checkCoord(f.geometry?.coordinates, `Institution ${f.properties?.id}`);
    }
    ok(`Ming princely fiefs & Nine-Garrison institutional layers verified (${ifc.features.length} features)`);
  }
}

if (errors > 0) {
  console.error(`\nValidation FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\nAll ${checks} dataset & compliance validation suites PASSED!`);
}
