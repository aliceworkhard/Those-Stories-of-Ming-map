import { z } from 'zod';

export const LngLatSchema = z.tuple([
  z.number().min(20).max(160),
  z.number().min(-20).max(65),
]);

export const CameraPoseSchema = z.object({
  center: LngLatSchema,
  zoom: z.number().min(2).max(16),
  pitch: z.number().min(0).max(85).optional(),
  bearing: z.number().min(-180).max(180).optional(),
});

export const ChapterAnchorSchema = z.object({
  id: z.string().min(3),
  globalOrder: z.number().int().positive(),
  volumeNo: z.number().int().min(1).max(7),
  volumeTitle: z.string().min(2),
  emperorSection: z.string().min(2),
  chapterNo: z.number().int().min(0),
  chapterTitle: z.string().min(1),
});

export const BookTocIndexSchema = z.object({
  meta: z.object({
    bookTitle: z.string(),
    author: z.string(),
    spanYears: z.tuple([z.number().int(), z.number().int()]),
    totalVolumes: z.literal(7),
    totalEmperorSections: z.number().int().positive(),
    totalChapters: z.number().int().min(100),
    copyrightNotice: z.string().min(10),
  }),
  volumes: z.array(
    z.object({
      volumeNo: z.number().int().min(1).max(7),
      volumeTitle: z.string(),
      emperorSections: z.array(z.string()).min(1),
    })
  ),
  chapters: z.array(ChapterAnchorSchema).min(100),
});

export const HistoricalPlaceSchema = z.object({
  id: z.string().startsWith('place-'),
  ancientName: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  modernName: z.string().min(1),
  type: z.enum([
    'capital',
    'prefecture',
    'garrison-nine',
    'pass',
    'battlefield',
    'port',
  ]),
  coordinates: LngLatSchema,
  strategicNote: z.string().optional(),
});

export const HistoricalEventSchema = z.object({
  id: z.string().startsWith('evt-'),
  title: z.string().min(2),
  tier: z.enum(['macro', 'micro']),
  category: z.enum([
    'war',
    'politics',
    'institution',
    'voyage',
    'culture',
    'anecdote',
  ]),
  time: z.object({
    year: z.number().int().min(1340).max(1680),
    month: z.number().int().min(1).max(12).optional(),
    display: z.string().min(2),
    reignTitle: z.string().min(2),
  }),
  location: z.object({
    placeId: z.string().startsWith('place-'),
    ancientName: z.string().min(1),
    modernName: z.string().min(1),
    coordinates: LngLatSchema,
  }),
  camera: CameraPoseSchema,
  summary: z.string().min(20).max(600),
  actors: z.array(z.string()).min(1),
  why: z.object({
    geoFactor: z.string().min(15).max(800),
    systemFactor: z.string().min(15).max(800),
    terrainCamera: CameraPoseSchema.optional(),
    prevEventIds: z.array(z.string()),
    nextEventIds: z.array(z.string()),
  }),
  bookLens: z.object({
    chapterIds: z.array(z.string()).min(1),
    mingyuePerspective: z.string().min(20).max(800),
    historicalNote: z.string().min(15).max(800),
  }),
  campaignId: z.string().startsWith('cmp-').optional(),
});

export const CampaignSchema = z.object({
  id: z.string().startsWith('cmp-'),
  title: z.string().min(3),
  subtitle: z.string().min(3),
  yearRange: z.tuple([z.number().int(), z.number().int()]),
  chapterIds: z.array(z.string()).min(1),
  summary: z.string().min(20).max(600),
  strategicOutcome: z.string().min(10).max(500),
  factions: z
    .array(
      z.object({
        id: z.string().min(2),
        name: z.string().min(1),
        leader: z.string().min(1),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        badgeText: z.string().min(1).max(4),
      })
    )
    .min(2),
  phases: z
    .array(
      z.object({
        phaseNo: z.number().int().positive(),
        title: z.string().min(3),
        dateLabel: z.string().min(2),
        year: z.number().int().min(1340).max(1680),
        narrative: z.string().min(20).max(700),
        whyKeyPoint: z.string().min(15).max(600),
        camera: CameraPoseSchema,
        strengthComparison: z
          .object({
            leftFactionId: z.string(),
            leftLabel: z.string(),
            leftPower: z.number().min(5).max(95),
            rightFactionId: z.string(),
            rightLabel: z.string(),
            rightPower: z.number().min(5).max(95),
          })
          .optional(),
        routes: z.array(
          z.object({
            id: z.string().min(2),
            factionId: z.string().min(2),
            type: z.enum(['assault', 'ambush', 'retreat', 'naval', 'supply']),
            label: z.string().min(2),
            commander: z.string().optional(),
            coordinates: z.array(LngLatSchema).min(2),
          })
        ),
        markers: z.array(
          z.object({
            id: z.string().min(2),
            kind: z.enum(['siege', 'clash', 'pass', 'cutoff', 'camp']),
            label: z.string().min(1),
            subLabel: z.string().optional(),
            coordinates: LngLatSchema,
            color: z.string().optional(),
          })
        ),
      })
    )
    .min(2),
});

export const TerritorySnapshotMetaSchema = z.object({
  snapshotId: z.string().startsWith('ter-'),
  year: z.number().int().min(1340).max(1680),
  title: z.string().min(2),
  eraNote: z.string().min(5),
  effectiveRange: z.tuple([z.number().int(), z.number().int()]),
  file: z.string().endsWith('.json'),
});
