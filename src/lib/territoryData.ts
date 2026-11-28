import territoriesIndexJson from '@data/territories/index.json';
import ter1356 from '@data/territories/ter-1356.json';
import type { TerritorySnapshotMeta } from '@/types/ming';

export const TERRITORY_INDEX =
  territoriesIndexJson as unknown as TerritorySnapshotMeta[];

const FALLBACK_1356_GEOJSON = ter1356 as unknown as GeoJSON.FeatureCollection;

const loadedGeoJsonByFile: Record<string, GeoJSON.FeatureCollection> = {
  'ter-1356.json': FALLBACK_1356_GEOJSON,
};

const inFlightByFile: Partial<Record<string, Promise<GeoJSON.FeatureCollection>>> =
  {};

const TERRITORY_CHUNK_LOADERS: Record<
  string,
  () => Promise<{ default: unknown }>
> = {
  'ter-1356.json': () => Promise.resolve({ default: ter1356 }),
  'ter-1363.json': () => import('@data/territories/ter-1363.json'),
  'ter-1368.json': () => import('@data/territories/ter-1368.json'),
  'ter-1388.json': () => import('@data/territories/ter-1388.json'),
  'ter-1399.json': () => import('@data/territories/ter-1399.json'),
  'ter-1402.json': () => import('@data/territories/ter-1402.json'),
  'ter-1415.json': () => import('@data/territories/ter-1415.json'),
  'ter-1435.json': () => import('@data/territories/ter-1435.json'),
  'ter-1449.json': () => import('@data/territories/ter-1449.json'),
  'ter-1479.json': () => import('@data/territories/ter-1479.json'),
  'ter-1582.json': () => import('@data/territories/ter-1582.json'),
  'ter-1621.json': () => import('@data/territories/ter-1621.json'),
  'ter-1642.json': () => import('@data/territories/ter-1642.json'),
  'ter-1644.json': () => import('@data/territories/ter-1644.json'),
  'ter-1652.json': () => import('@data/territories/ter-1652.json'),
};

export const TERRITORY_SNAPSHOT_BY_ID: Record<
  string,
  { meta: TerritorySnapshotMeta; geojson: GeoJSON.FeatureCollection }
> = Object.fromEntries(
  TERRITORY_INDEX.map((meta) => [
    meta.snapshotId,
    {
      meta,
      geojson: loadedGeoJsonByFile[meta.file] ?? FALLBACK_1356_GEOJSON,
    },
  ])
);

const loadedSnapshotIdSet = new Set<string>(['ter-1356']);
type TerritoryChunkListener = (loadedSnapshotIds: string[]) => void;
const listeners = new Set<TerritoryChunkListener>();

function notifyTerritoryListeners(loadedSnapshotIds: string[]): void {
  for (const fn of listeners) {
    fn(loadedSnapshotIds);
  }
}

export function subscribeTerritoryChunks(
  listener: TerritoryChunkListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isSnapshotChunkLoaded(snapshotId: string): boolean {
  return loadedSnapshotIdSet.has(snapshotId);
}

export async function ensureTerritoryFileLoaded(
  fileName: string
): Promise<GeoJSON.FeatureCollection> {
  if (loadedGeoJsonByFile[fileName]) {
    return loadedGeoJsonByFile[fileName];
  }
  const existing = inFlightByFile[fileName];
  if (existing) return existing;

  const loader = TERRITORY_CHUNK_LOADERS[fileName];
  if (!loader) return FALLBACK_1356_GEOJSON;

  const promise = loader()
    .then((mod) => {
      const fc = (mod.default ?? mod) as GeoJSON.FeatureCollection;
      loadedGeoJsonByFile[fileName] = fc;
      const updatedIds: string[] = [];
      for (const meta of TERRITORY_INDEX) {
        if (meta.file === fileName) {
          TERRITORY_SNAPSHOT_BY_ID[meta.snapshotId] = { meta, geojson: fc };
          loadedSnapshotIdSet.add(meta.snapshotId);
          updatedIds.push(meta.snapshotId);
        }
      }
      if (updatedIds.length > 0) {
        notifyTerritoryListeners(updatedIds);
      }
      return fc;
    })
    .catch(() => FALLBACK_1356_GEOJSON);

  inFlightByFile[fileName] = promise;
  return promise;
}

export async function ensureSnapshotIdLoaded(snapshotId: string): Promise<void> {
  const entry = TERRITORY_INDEX.find((m) => m.snapshotId === snapshotId);
  if (!entry) return;
  await ensureTerritoryFileLoaded(entry.file);
}

let warmStarted = false;

/**
 * Gently pre-warms remaining historical GIS territory chunks ONE BY ONE during browser
 * idle periods AFTER initial map tiles have settled — avoiding the 14x parallel parse &
 * GC spike during first interaction while keeping later timeline scrubbing instant!
 */
export function scheduleWarmAllTerritoryChunks(): void {
  if (typeof window === 'undefined' || warmStarted) return;
  warmStarted = true;

  const queue = Object.keys(TERRITORY_CHUNK_LOADERS).filter(
    (file) => !loadedGeoJsonByFile[file]
  );
  if (queue.length === 0) return;

  const ric = (
    window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
    }
  ).requestIdleCallback;

  let idx = 0;
  const loadNext = () => {
    while (idx < queue.length && loadedGeoJsonByFile[queue[idx]]) {
      idx++;
    }
    if (idx >= queue.length) return;
    const nextFile = queue[idx++];
    void ensureTerritoryFileLoaded(nextFile).finally(() => {
      if (idx >= queue.length) return;
      if (typeof ric === 'function') {
        window.setTimeout(() => ric(loadNext, { timeout: 2500 }), 180);
      } else {
        window.setTimeout(loadNext, 280);
      }
    });
  };

  // Defer warming until initial WebGL map render & vector tiles settle
  window.setTimeout(() => {
    if (typeof ric === 'function') {
      ric(loadNext, { timeout: 3000 });
    } else {
      loadNext();
    }
  }, 2200);
}

export function getSnapshotForYear(year: number): {
  meta: TerritorySnapshotMeta;
  geojson: GeoJSON.FeatureCollection;
} {
  const matched =
    TERRITORY_INDEX.find(
      (item) => year >= item.effectiveRange[0] && year <= item.effectiveRange[1]
    ) ??
    (year < TERRITORY_INDEX[0].effectiveRange[0]
      ? TERRITORY_INDEX[0]
      : TERRITORY_INDEX[TERRITORY_INDEX.length - 1]);

  if (!loadedGeoJsonByFile[matched.file] && typeof window !== 'undefined') {
    void ensureTerritoryFileLoaded(matched.file);
  }

  return (
    TERRITORY_SNAPSHOT_BY_ID[matched.snapshotId] ?? {
      meta: matched,
      geojson: loadedGeoJsonByFile[matched.file] ?? FALLBACK_1356_GEOJSON,
    }
  );
}
