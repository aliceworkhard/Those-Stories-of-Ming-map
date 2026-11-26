import { SITE_CONFIG } from '@/config/site';
import { CAMPAIGN_MAP, CHARACTER_MAP, EVENT_MAP } from '@/lib/atlasData';
import type { MapVisualTheme } from '@/types/ming';

export interface ParsedAtlasUrlState {
  year?: number;
  eventId?: string;
  campaignId?: string;
  phaseIndex?: number;
  arrowMode?: 'dynamic' | 'static';
  characterId?: string;
  stopIndex?: number;
  theme?: MapVisualTheme;
  is3D?: boolean;
}

export function parseAtlasUrlParams(search: string): ParsedAtlasUrlState {
  if (!search) return {};
  const params = new URLSearchParams(search);
  const out: ParsedAtlasUrlState = {};

  const rawYear = params.get('year');
  if (rawYear !== null) {
    const yr = Number(rawYear);
    if (
      Number.isFinite(yr) &&
      yr >= SITE_CONFIG.timeline.minYear &&
      yr <= SITE_CONFIG.timeline.extendedMaxYear
    ) {
      out.year = Math.round(yr);
    }
  }

  const evtId = params.get('event');
  if (evtId && EVENT_MAP[evtId]) {
    out.eventId = evtId;
  }

  const cmpId = params.get('campaign');
  if (cmpId && CAMPAIGN_MAP[cmpId]) {
    out.campaignId = cmpId;
    const cmp = CAMPAIGN_MAP[cmpId];
    const rawPhase = params.get('phase');
    if (rawPhase !== null) {
      const p = Number(rawPhase);
      if (Number.isFinite(p)) {
        // Accept 1-based (`phase=2` -> idx 1) or 0-based gracefully (`phase=1` -> idx 0)
        const idx = Math.max(0, Math.min(cmp.phases.length - 1, Math.round(p) - 1));
        out.phaseIndex = idx;
      }
    }
    const rawArrow = params.get('arrow');
    if (rawArrow === 'static' || rawArrow === 'dynamic') {
      out.arrowMode = rawArrow;
    }
  }

  const charId = params.get('character');
  if (charId && CHARACTER_MAP[charId]) {
    out.characterId = charId;
    const ch = CHARACTER_MAP[charId];
    const rawStop = params.get('stop');
    if (rawStop !== null) {
      const s = Number(rawStop);
      if (Number.isFinite(s)) {
        const idx = Math.max(0, Math.min(ch.stops.length - 1, Math.round(s) - 1));
        out.stopIndex = idx;
      }
    }
  }

  const rawTheme = params.get('theme');
  if (rawTheme === 'xuanmo' || rawTheme === 'xuanzhi') {
    out.theme = rawTheme;
  }

  const raw3D = params.get('3d');
  if (raw3D === '1' || raw3D === 'true') {
    out.is3D = true;
  }

  return out;
}

export interface ShareableAtlasStateInput {
  currentYear: number;
  selectedEventId: string | null;
  activeCampaignId: string | null;
  activePhaseIndex: number;
  campaignArrowMode: 'dynamic' | 'static';
  activeCharacterId: string | null;
  activeCharacterStopIndex: number;
  theme: MapVisualTheme;
  is3D: boolean;
}

export function buildAtlasQueryString(state: ShareableAtlasStateInput): string {
  const params = new URLSearchParams();

  if (state.activeCampaignId) {
    params.set('campaign', state.activeCampaignId);
    params.set('phase', String(state.activePhaseIndex + 1));
    if (state.campaignArrowMode === 'static') {
      params.set('arrow', 'static');
    }
  } else if (state.activeCharacterId) {
    params.set('character', state.activeCharacterId);
    params.set('stop', String(state.activeCharacterStopIndex + 1));
  } else {
    params.set('year', String(state.currentYear));
    if (state.selectedEventId) {
      params.set('event', state.selectedEventId);
    }
  }

  if (state.theme === 'xuanmo') {
    params.set('theme', 'xuanmo');
  }
  if (state.is3D) {
    params.set('3d', '1');
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function buildAtlasShareUrl(state: ShareableAtlasStateInput): string {
  const qs = buildAtlasQueryString(state);
  if (typeof window === 'undefined') {
    return `https://those-stories-of-ming-map.vercel.app/${qs}`;
  }
  return `${window.location.origin}${window.location.pathname}${qs}`;
}
