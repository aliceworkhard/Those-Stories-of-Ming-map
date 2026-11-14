/**
 * Core Domain Types for 《明途 · 舆图纪》(Those Stories of Ming Map)
 * Strictly aligned with data/schemas/README.md
 * Coordinate convention: WGS-84 [lng, lat]
 */

export type LngLat = [number, number];

export interface CameraPose {
  center: LngLat;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

// ==========================================
// 1. Book TOC Chapter Anchor
// ==========================================
export interface ChapterAnchor {
  id: string;
  globalOrder: number;
  volumeNo: number;
  volumeTitle: string;
  emperorSection: string;
  chapterNo: number;
  chapterTitle: string;
}

export interface BookTocIndex {
  meta: {
    bookTitle: string;
    author: string;
    spanYears: [number, number];
    totalVolumes: number;
    totalEmperorSections: number;
    totalChapters: number;
    copyrightNotice: string;
  };
  volumes: {
    volumeNo: number;
    volumeTitle: string;
    emperorSections: string[];
  }[];
  chapters: ChapterAnchor[];
}

// ==========================================
// 2. Historical Places & Ancient-Modern Lookup
// ==========================================
export type PlaceKind =
  | 'capital'
  | 'prefecture'
  | 'garrison-nine'
  | 'pass'
  | 'battlefield'
  | 'port';

export interface HistoricalPlace {
  id: string;
  ancientName: string;
  aliases?: string[];
  modernName: string;
  type: PlaceKind;
  coordinates: LngLat;
  strategicNote?: string;
}

// ==========================================
// 3. 5D Historical Event (Macro & Micro)
// ==========================================
export type EventTier = 'macro' | 'micro';

export type EventCategory =
  | 'war'
  | 'politics'
  | 'institution'
  | 'voyage'
  | 'culture'
  | 'anecdote';

export interface EventWhyAnalysis {
  /** Geographic, terrain, waterway, or strategic pass explanation */
  geoFactor: string;
  /** Institutional, fiscal, political, or climatic structural cause */
  systemFactor: string;
  /** Optional 3D terrain inspection camera angle */
  terrainCamera?: CameraPose;
  /** Upstream causal event IDs */
  prevEventIds: string[];
  /** Downstream consequence event IDs */
  nextEventIds: string[];
}

export interface EventBookLens {
  /** Linked chapter anchor IDs in data/chapters/toc.json */
  chapterIds: string[];
  /** Original editorial summary of Dangnian Mingyue's narrative angle & insight */
  mingyuePerspective: string;
  /** Positive-history verification & supplement from Ming Shi / Ming Shilu */
  historicalNote: string;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  tier: EventTier;
  category: EventCategory;
  time: {
    year: number;
    month?: number;
    display: string;
    reignTitle: string;
  };
  location: {
    placeId: string;
    ancientName: string;
    modernName: string;
    coordinates: LngLat;
  };
  camera: CameraPose;
  summary: string;
  actors: string[];
  why: EventWhyAnalysis;
  bookLens: EventBookLens;
  /** Linked multi-phase campaign ID if battle replay is available */
  campaignId?: string;
}

// ==========================================
// 4. Multi-Phase Campaign & Dynamic Marching Routes
// ==========================================
export type RouteTacticType =
  | 'assault'
  | 'ambush'
  | 'retreat'
  | 'naval'
  | 'supply';

export type BattlefieldMarkerKind = 'siege' | 'clash' | 'pass' | 'cutoff' | 'camp';

export interface CampaignFaction {
  id: string;
  name: string;
  leader: string;
  color: string;
  badgeText: string;
}

export interface CampaignRoute {
  id: string;
  factionId: string;
  type: RouteTacticType;
  label: string;
  commander?: string;
  coordinates: LngLat[];
}

export interface BattlefieldMarker {
  id: string;
  kind: BattlefieldMarkerKind;
  label: string;
  subLabel?: string;
  coordinates: LngLat;
  color?: string;
}

export interface CampaignPhase {
  phaseNo: number;
  title: string;
  dateLabel: string;
  year: number;
  narrative: string;
  whyKeyPoint: string;
  camera: CameraPose;
  strengthComparison?: {
    leftFactionId: string;
    leftLabel: string;
    leftPower: number;
    rightFactionId: string;
    rightLabel: string;
    rightPower: number;
  };
  routes: CampaignRoute[];
  markers: BattlefieldMarker[];
}

export interface Campaign {
  id: string;
  title: string;
  subtitle: string;
  yearRange: [number, number];
  chapterIds: string[];
  summary: string;
  strategicOutcome: string;
  factions: CampaignFaction[];
  phases: CampaignPhase[];
}

// ==========================================
// 5. Territory Snapshot Metadata & Polity Feature
// ==========================================
export type PolityControlType = 'direct' | 'tributary-garrison';

export interface TerritoryPolityProps {
  polityId: string;
  polityName: string;
  shortLabel: string;
  ruler: string;
  controlType: PolityControlType;
  color: string;
  borderColor?: string;
  labelCoord: LngLat;
  capitalName: string;
  changeReason: string;
}

export interface TerritorySnapshotMeta {
  snapshotId: string;
  year: number;
  title: string;
  eraNote: string;
  effectiveRange: [number, number];
  file: string;
}

export type PlaceNameMode = 'ancient' | 'modern' | 'both';
export type MapVisualTheme = 'xuanzhi' | 'xuanmo';
