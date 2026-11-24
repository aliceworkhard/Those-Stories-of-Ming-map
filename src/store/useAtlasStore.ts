import { create } from 'zustand';
import { SITE_CONFIG } from '@/config/site';
import {
  ALL_EVENTS,
  CAMPAIGN_MAP,
  CHARACTER_MAP,
  EVENT_MAP,
} from '@/lib/atlasData';
import type {
  CameraPose,
  MapVisualTheme,
  PerformanceMode,
  PlaceNameMode,
  TerritoryPolityProps,
} from '@/types/ming';

export const ATLAS_PROGRESS_CACHE_KEY = 'ming_story_atlas_progress_v2';
const LEGACY_CACHE_KEY = 'ming_story_atlas_progress_v1';

interface PersistedAtlasProgress {
  currentYear: number;
  selectedEventId: string | null;
  theme: MapVisualTheme;
  perfMode: PerformanceMode;
  is3D: boolean;
  placeNameMode: PlaceNameMode;
}

function saveProgressToCache(partial: PersistedAtlasProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      ATLAS_PROGRESS_CACHE_KEY,
      JSON.stringify(partial)
    );
  } catch {
    // Ignore storage quota / private mode restrictions gracefully
  }
}

export interface LayerVisibility {
  territories: boolean;
  waterways: boolean;
  greatWall: boolean;
  landforms: boolean;
  places: boolean;
  causalArcs: boolean;
  macroEvents: boolean;
  showAllMicroEvents: boolean;
  princelyFiefs: boolean;
  nineGarrisons: boolean;
}

export type CampaignCameraMode = 'overview' | 'follow' | 'free';
export type CampaignArrowMode = 'dynamic' | 'static';

const STORY_OPENING_EVENT = ALL_EVENTS[0];

interface AtlasState {
  hasHydratedCache: boolean;
  currentYear: number;
  skipNextEraWipe: boolean;
  yearFilterMode: 'era-window' | 'all';
  selectedEventId: string | null;
  hoveredPolity: TerritoryPolityProps | null;
  activeWipeCaption: string | null;

  // Separated Left Directory vs Right Detail Panels + Pure Map Immersion Mode
  isDirectoryOpen: boolean;
  isDrawerOpen: boolean;
  isImmersionMode: boolean;

  // Chronological Full-History Auto-Camera Tour ("全史运镜推演" — steady fly, NO spinning!)
  isStoryTourPlaying: boolean;
  storyTourSpeed: 1 | 1.5;
  storyTourProgress: number;
  storyTourNonce: number;

  // Multi-Phase Battlefield Campaign Replay ("战役行军运镜推演")
  activeCampaignId: string | null;
  activePhaseIndex: number;
  isCampaignPlaying: boolean;
  isCampaignPanelOpen: boolean;
  spotlightRouteId: string | null;
  focusedRouteRequest: { routeId: string; seq: number } | null;
  campaignSpeed: 1 | 1.5;
  campaignCameraMode: CampaignCameraMode;
  campaignArrowMode: CampaignArrowMode;
  campaignPhaseProgress: number;
  campaignReplayNonce: number;

  // Character Odyssey ("风云人物一生足迹模式")
  activeCharacterId: string | null;
  activeCharacterStopIndex: number;

  isTocModalOpen: boolean;
  theme: MapVisualTheme;
  perfMode: PerformanceMode;
  is3D: boolean;
  placeNameMode: PlaceNameMode;
  layers: LayerVisibility;
  cameraCommand: { pose: CameraPose; seq: number } | null;

  // Cache & Story Start Actions
  hydrateFromStorage: () => void;
  resetToStoryBeginning: () => void;

  // Core Actions
  setCurrentYear: (year: number, skipEraWipe?: boolean) => void;
  clearSkipNextEraWipe: () => void;
  setYearFilterMode: (mode: 'era-window' | 'all') => void;
  selectEvent: (eventId: string | null, fly?: boolean) => void;
  setHoveredPolity: (polity: TerritoryPolityProps | null) => void;
  setActiveWipeCaption: (caption: string | null) => void;
  stepStoryEvent: (delta: 1 | -1) => void;
  setDirectoryOpen: (open: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  toggleImmersionMode: () => void;

  // Story Tour Actions
  startStoryTour: (fromEventId?: string) => void;
  stopStoryTour: () => void;
  setStoryTourPlaying: (playing: boolean) => void;
  setStoryTourSpeed: (speed: 1 | 1.5) => void;
  setStoryTourProgress: (progress: number) => void;

  // Campaign Actions
  startCampaign: (campaignId: string, phaseIndex?: number) => void;
  exitCampaign: () => void;
  setCampaignPhase: (phaseIndex: number) => void;
  nextCampaignPhase: () => void;
  prevCampaignPhase: () => void;
  setCampaignPlaying: (playing: boolean) => void;
  setCampaignPanelOpen: (open: boolean) => void;
  setSpotlightRouteId: (routeId: string | null) => void;
  focusCampaignRoute: (routeId: string) => void;
  setCampaignSpeed: (speed: 1 | 1.5) => void;
  setCampaignCameraMode: (mode: CampaignCameraMode) => void;
  setCampaignArrowMode: (mode: CampaignArrowMode) => void;
  setCampaignPhaseProgress: (progress: number) => void;
  replayCurrentPhase: () => void;

  // Character Odyssey Actions
  startCharacterOdyssey: (characterId: string, stopIndex?: number) => void;
  setCharacterStop: (stopIndex: number) => void;
  exitCharacterOdyssey: () => void;

  setTocModalOpen: (open: boolean) => void;
  setTheme: (theme: MapVisualTheme) => void;
  setPerfMode: (mode: PerformanceMode) => void;
  toggle3D: () => void;
  setPlaceNameMode: (mode: PlaceNameMode) => void;
  toggleLayer: (key: keyof LayerVisibility) => void;
  flyToCamera: (pose: CameraPose) => void;
}

const persistSnapshot = (s: AtlasState) => {
  saveProgressToCache({
    currentYear: s.currentYear,
    selectedEventId: s.selectedEventId,
    theme: s.theme,
    perfMode: s.perfMode,
    is3D: s.is3D,
    placeNameMode: s.placeNameMode,
  });
};

export const useAtlasStore = create<AtlasState>((set, get) => ({
  hasHydratedCache: false,
  // Uncached default: ALWAYS start at the very beginning of 《明朝那些事儿》 (1344 Chapter 1)!
  currentYear: STORY_OPENING_EVENT?.time.year ?? SITE_CONFIG.timeline.minYear,
  skipNextEraWipe: false,
  yearFilterMode: 'all',
  selectedEventId: STORY_OPENING_EVENT?.id ?? null,
  hoveredPolity: null,
  activeWipeCaption: null,

  isDirectoryOpen: true,
  isDrawerOpen: true,
  isImmersionMode: false,

  isStoryTourPlaying: false,
  storyTourSpeed: 1,
  storyTourProgress: 0,
  storyTourNonce: 0,

  activeCampaignId: null,
  activePhaseIndex: 0,
  isCampaignPlaying: false,
  isCampaignPanelOpen: true,
  spotlightRouteId: null,
  focusedRouteRequest: null,
  campaignSpeed: 1,
  campaignCameraMode: 'overview',
  campaignArrowMode: 'dynamic',
  campaignPhaseProgress: 0,
  campaignReplayNonce: 0,

  activeCharacterId: null,
  activeCharacterStopIndex: 0,

  isTocModalOpen: false,
  theme: 'xuanzhi',
  perfMode: 'balanced',
  // Default 2.5D stereo hillshade ON with 3D DEM Mesh OFF -> 0 Terrain Drape FBO overhead & silky 120fps!
  is3D: false,
  placeNameMode: 'both',
  layers: {
    territories: true,
    waterways: true,
    greatWall: true,
    landforms: true,
    places: true,
    causalArcs: true,
    macroEvents: true,
    showAllMicroEvents: false,
    princelyFiefs: false,
    nineGarrisons: false,
  },
  cameraCommand: null,

  hydrateFromStorage: () => {
    if (typeof window === 'undefined' || get().hasHydratedCache) return;
    const prevSeq = get().cameraCommand?.seq ?? 0;

    try {
      const rawV2 = window.localStorage.getItem(ATLAS_PROGRESS_CACHE_KEY);
      const rawLegacy = rawV2
        ? null
        : window.localStorage.getItem(LEGACY_CACHE_KEY);
      const raw = rawV2 ?? rawLegacy;
      if (!raw) {
        const startEvt = STORY_OPENING_EVENT;
        set({
          hasHydratedCache: true,
          currentYear: startEvt.time.year,
          selectedEventId: startEvt.id,
          cameraCommand: {
            pose: {
              ...startEvt.camera,
              pitch: 0,
              bearing: 0,
            },
            seq: prevSeq + 1,
          },
        });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedAtlasProgress>;
      const validEvt =
        parsed.selectedEventId && EVENT_MAP[parsed.selectedEventId]
          ? EVENT_MAP[parsed.selectedEventId]
          : null;
      const validYear =
        typeof parsed.currentYear === 'number' &&
        parsed.currentYear >= SITE_CONFIG.timeline.minYear &&
        parsed.currentYear <= SITE_CONFIG.timeline.extendedMaxYear
          ? parsed.currentYear
          : validEvt?.time.year ?? STORY_OPENING_EVENT.time.year;

      const nextTheme: MapVisualTheme =
        parsed.theme === 'xuanmo' ? 'xuanmo' : 'xuanzhi';
      const nextPerf: PerformanceMode =
        parsed.perfMode === 'eco' || parsed.perfMode === 'ultra'
          ? parsed.perfMode
          : 'balanced';
      const next3D =
        nextPerf === 'eco'
          ? false
          : rawV2 && typeof parsed.is3D === 'boolean'
          ? parsed.is3D
          : false;
      const nextPlaceMode: PlaceNameMode =
        parsed.placeNameMode === 'ancient' || parsed.placeNameMode === 'modern'
          ? parsed.placeNameMode
          : 'both';

      const targetEvt = validEvt ?? STORY_OPENING_EVENT;
      set({
        hasHydratedCache: true,
        currentYear: validYear,
        selectedEventId: targetEvt.id,
        theme: nextTheme,
        perfMode: nextPerf,
        is3D: next3D,
        placeNameMode: nextPlaceMode,
        cameraCommand: {
          pose: {
            ...targetEvt.camera,
            pitch: next3D ? targetEvt.camera.pitch ?? 38 : 0,
            bearing: 0,
          },
          seq: prevSeq + 1,
        },
      });
    } catch {
      const startEvt = STORY_OPENING_EVENT;
      set({
        hasHydratedCache: true,
        currentYear: startEvt.time.year,
        selectedEventId: startEvt.id,
        cameraCommand: {
          pose: { ...startEvt.camera, pitch: 0, bearing: 0 },
          seq: prevSeq + 1,
        },
      });
    }
  },

  resetToStoryBeginning: () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(ATLAS_PROGRESS_CACHE_KEY);
      } catch {
        // ignore
      }
    }
    const startEvt = STORY_OPENING_EVENT;
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set({
      activeCampaignId: null,
      activeCharacterId: null,
      isCampaignPlaying: false,
      isStoryTourPlaying: false,
      storyTourProgress: 0,
      isImmersionMode: false,
      isDirectoryOpen: true,
      isDrawerOpen: true,
      currentYear: startEvt.time.year,
      selectedEventId: startEvt.id,
      cameraCommand: {
        pose: { ...startEvt.camera, bearing: 0 },
        seq: prevSeq + 1,
      },
    });
  },

  setCurrentYear: (year, skipEraWipe = false) => {
    const clamped = Math.max(
      SITE_CONFIG.timeline.minYear,
      Math.min(SITE_CONFIG.timeline.extendedMaxYear, Math.round(year))
    );
    set({ currentYear: clamped, skipNextEraWipe: skipEraWipe });
    persistSnapshot(get());
  },

  clearSkipNextEraWipe: () => set({ skipNextEraWipe: false }),

  setYearFilterMode: (mode) => set({ yearFilterMode: mode }),

  selectEvent: (eventId, fly = true) => {
    if (!eventId) {
      set({ selectedEventId: null });
      persistSnapshot(get());
      return;
    }
    const evt = EVENT_MAP[eventId];
    if (!evt) return;
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      selectedEventId: eventId,
      isDrawerOpen: state.isImmersionMode ? state.isDrawerOpen : true,
      currentYear: evt.time.year,
      storyTourProgress:
        state.isStoryTourPlaying || state.storyTourProgress > 0 ? 1 : 0,
      storyTourNonce: state.storyTourNonce + 1,
      cameraCommand: fly
        ? {
            pose: {
              ...evt.camera,
              pitch: state.is3D && state.perfMode !== 'eco' ? evt.camera.pitch ?? 38 : 0,
              bearing: 0,
            },
            seq: prevSeq + 1,
          }
        : state.cameraCommand,
    }));
    persistSnapshot(get());
  },

  setHoveredPolity: (polity) => set({ hoveredPolity: polity }),
  setActiveWipeCaption: (caption) => set({ activeWipeCaption: caption }),

  stepStoryEvent: (delta) => {
    const { selectedEventId, isStoryTourPlaying } = get();
    const curIdx = ALL_EVENTS.findIndex((e) => e.id === selectedEventId);
    const baseIdx = curIdx >= 0 ? curIdx : 0;
    const nextIdx = baseIdx + delta;

    if (nextIdx < 0) {
      get().selectEvent(ALL_EVENTS[0].id, true);
      return;
    }
    if (nextIdx >= ALL_EVENTS.length) {
      if (isStoryTourPlaying) {
        set({ isStoryTourPlaying: false, storyTourProgress: 100 });
      }
      return;
    }
    get().selectEvent(ALL_EVENTS[nextIdx].id, true);
  },

  setDirectoryOpen: (open) =>
    set((state) => ({
      isDirectoryOpen: open,
      isImmersionMode: open ? false : state.isImmersionMode,
    })),

  setDrawerOpen: (open) =>
    set((state) => ({
      isDrawerOpen: open,
      isImmersionMode: open ? false : state.isImmersionMode,
    })),

  toggleImmersionMode: () =>
    set((state) => {
      const next = !state.isImmersionMode;
      return {
        isImmersionMode: next,
        isDirectoryOpen: !next,
        isDrawerOpen: !next,
      };
    }),

  startStoryTour: (fromEventId) => {
    const state = get();
    let targetId = fromEventId ?? state.selectedEventId ?? ALL_EVENTS[0].id;
    const idx = ALL_EVENTS.findIndex((e) => e.id === targetId);
    if (!fromEventId && idx >= ALL_EVENTS.length - 1) {
      targetId = ALL_EVENTS[0].id;
    }
    const evt = EVENT_MAP[targetId] ?? ALL_EVENTS[0];
    const prevSeq = state.cameraCommand?.seq ?? 0;
    const use3D = state.is3D && state.perfMode !== 'eco';

    set({
      activeCampaignId: null,
      activeCharacterId: null,
      isCampaignPlaying: false,
      isStoryTourPlaying: true,
      isDrawerOpen: !state.isImmersionMode,
      selectedEventId: evt.id,
      currentYear: evt.time.year,
      storyTourProgress: 1,
      storyTourNonce: state.storyTourNonce + 1,
      cameraCommand: {
        pose: {
          center: evt.camera.center,
          zoom: Math.max(6.0, evt.camera.zoom),
          pitch: use3D ? Math.min(42, evt.camera.pitch ?? 38) : 0,
          bearing: 0,
        },
        seq: prevSeq + 1,
      },
    });
    persistSnapshot(get());
  },

  stopStoryTour: () =>
    set({
      isStoryTourPlaying: false,
      storyTourProgress: 0,
    }),

  setStoryTourPlaying: (playing) =>
    set((state) => ({
      isStoryTourPlaying: playing,
      storyTourNonce: playing ? state.storyTourNonce + 1 : state.storyTourNonce,
    })),

  setStoryTourSpeed: (speed) => set({ storyTourSpeed: speed }),
  setStoryTourProgress: (progress) => set({ storyTourProgress: progress }),

  startCampaign: (campaignId, phaseIndex = 0) => {
    const cmp = CAMPAIGN_MAP[campaignId];
    if (!cmp) return;
    const safeIdx = Math.max(0, Math.min(cmp.phases.length - 1, phaseIndex));
    const phase = cmp.phases[safeIdx];
    set((state) => ({
      isStoryTourPlaying: false,
      storyTourProgress: 0,
      activeCharacterId: null,
      activeCampaignId: campaignId,
      activePhaseIndex: safeIdx,
      isCampaignPlaying: true,
      isCampaignPanelOpen: true,
      spotlightRouteId: null,
      focusedRouteRequest: null,
      campaignCameraMode:
        state.campaignCameraMode === 'free' ? 'overview' : state.campaignCameraMode,
      campaignPhaseProgress: 0,
      campaignReplayNonce: state.campaignReplayNonce + 1,
      isDirectoryOpen: false,
      isDrawerOpen: false,
      currentYear: phase.year,
    }));
  },

  exitCampaign: () =>
    set((state) => ({
      activeCampaignId: null,
      activePhaseIndex: 0,
      isCampaignPlaying: false,
      spotlightRouteId: null,
      focusedRouteRequest: null,
      campaignPhaseProgress: 0,
      activeWipeCaption: null,
      isDirectoryOpen: !state.isImmersionMode,
      isDrawerOpen: !state.isImmersionMode,
    })),

  setCampaignPhase: (phaseIndex) => {
    const { activeCampaignId } = get();
    if (!activeCampaignId) return;
    const cmp = CAMPAIGN_MAP[activeCampaignId];
    if (!cmp) return;
    const safeIdx = Math.max(0, Math.min(cmp.phases.length - 1, phaseIndex));
    const phase = cmp.phases[safeIdx];
    set((state) => ({
      activePhaseIndex: safeIdx,
      spotlightRouteId: null,
      campaignPhaseProgress: 0,
      campaignReplayNonce: state.campaignReplayNonce + 1,
      currentYear: phase.year,
    }));
  },

  nextCampaignPhase: () => {
    const { activeCampaignId, activePhaseIndex } = get();
    if (!activeCampaignId) return;
    const cmp = CAMPAIGN_MAP[activeCampaignId];
    if (!cmp) return;
    if (activePhaseIndex < cmp.phases.length - 1) {
      get().setCampaignPhase(activePhaseIndex + 1);
    } else {
      set({ isCampaignPlaying: false, campaignPhaseProgress: 100 });
    }
  },

  prevCampaignPhase: () => {
    const { activePhaseIndex } = get();
    if (activePhaseIndex > 0) {
      get().setCampaignPhase(activePhaseIndex - 1);
    }
  },

  setCampaignPlaying: (playing) => set({ isCampaignPlaying: playing }),
  setCampaignPanelOpen: (open) => set({ isCampaignPanelOpen: open }),
  setSpotlightRouteId: (routeId) => set({ spotlightRouteId: routeId }),
  focusCampaignRoute: (routeId) =>
    set((state) => ({
      spotlightRouteId: routeId,
      focusedRouteRequest: {
        routeId,
        seq: (state.focusedRouteRequest?.seq ?? 0) + 1,
      },
    })),
  setCampaignSpeed: (speed) => set({ campaignSpeed: speed }),
  setCampaignCameraMode: (mode) =>
    set((state) => ({
      campaignCameraMode: mode,
      campaignReplayNonce:
        mode !== 'free' ? state.campaignReplayNonce + 1 : state.campaignReplayNonce,
    })),
  setCampaignArrowMode: (mode) => set({ campaignArrowMode: mode }),
  setCampaignPhaseProgress: (progress) => set({ campaignPhaseProgress: progress }),

  replayCurrentPhase: () =>
    set((state) => ({
      isCampaignPlaying: true,
      spotlightRouteId: null,
      campaignCameraMode:
        state.campaignCameraMode === 'free' ? 'overview' : state.campaignCameraMode,
      campaignPhaseProgress: 0,
      campaignReplayNonce: state.campaignReplayNonce + 1,
    })),

  startCharacterOdyssey: (characterId, stopIndex = 0) => {
    const ch = CHARACTER_MAP[characterId];
    if (!ch || ch.stops.length === 0) return;
    const safeIdx = Math.max(0, Math.min(ch.stops.length - 1, stopIndex));
    const stop = ch.stops[safeIdx];
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      activeCampaignId: null,
      isCampaignPlaying: false,
      isStoryTourPlaying: false,
      storyTourProgress: 0,
      activeCharacterId: characterId,
      activeCharacterStopIndex: safeIdx,
      currentYear: stop.year,
      selectedEventId: stop.eventId ?? state.selectedEventId,
      cameraCommand: {
        pose: {
          center: stop.coordinates,
          zoom: 5.8,
          pitch: state.is3D && state.perfMode !== 'eco' ? 38 : 0,
          bearing: 0,
        },
        seq: prevSeq + 1,
      },
    }));
  },

  setCharacterStop: (stopIndex) => {
    const { activeCharacterId } = get();
    if (!activeCharacterId) return;
    const ch = CHARACTER_MAP[activeCharacterId];
    if (!ch) return;
    const safeIdx = Math.max(0, Math.min(ch.stops.length - 1, stopIndex));
    const stop = ch.stops[safeIdx];
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      activeCharacterStopIndex: safeIdx,
      currentYear: stop.year,
      selectedEventId: stop.eventId ?? state.selectedEventId,
      isDrawerOpen: stop.eventId && !state.isImmersionMode ? true : state.isDrawerOpen,
      cameraCommand: {
        pose: {
          center: stop.coordinates,
          zoom: 6.1,
          pitch: state.is3D && state.perfMode !== 'eco' ? 38 : 0,
          bearing: 0,
        },
        seq: prevSeq + 1,
      },
    }));
  },

  exitCharacterOdyssey: () =>
    set({
      activeCharacterId: null,
      activeCharacterStopIndex: 0,
    }),

  setTocModalOpen: (open) => set({ isTocModalOpen: open }),
  setTheme: (theme) => {
    set({ theme });
    persistSnapshot(get());
  },

  setPerfMode: (mode) => {
    const next3D = mode === 'ultra';
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      perfMode: mode,
      is3D: next3D,
      cameraCommand: {
        pose: {
          center:
            state.cameraCommand?.pose.center ?? SITE_CONFIG.defaultCamera.center,
          zoom: state.cameraCommand?.pose.zoom ?? SITE_CONFIG.defaultCamera.zoom,
          pitch: next3D ? 36 : 0,
          bearing: 0,
        },
        seq: prevSeq + 1,
      },
    }));
    persistSnapshot(get());
  },

  toggle3D: () => {
    const next3D = !get().is3D;
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      is3D: next3D,
      cameraCommand: {
        pose: {
          center:
            state.cameraCommand?.pose.center ?? SITE_CONFIG.defaultCamera.center,
          zoom: state.cameraCommand?.pose.zoom ?? SITE_CONFIG.defaultCamera.zoom,
          pitch: next3D ? 38 : 0,
          bearing: 0,
        },
        seq: prevSeq + 1,
      },
    }));
    persistSnapshot(get());
  },

  setPlaceNameMode: (mode) => {
    set({ placeNameMode: mode });
    persistSnapshot(get());
  },

  toggleLayer: (key) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [key]: !state.layers[key],
      },
    })),

  flyToCamera: (pose) =>
    set((state) => ({
      cameraCommand: {
        pose: { ...pose, bearing: 0 },
        seq: (state.cameraCommand?.seq ?? 0) + 1,
      },
    })),
}));
