import { create } from 'zustand';
import { SITE_CONFIG } from '@/config/site';
import { ALL_EVENTS, CAMPAIGN_MAP, EVENT_MAP } from '@/lib/atlasData';
import type {
  CameraPose,
  MapVisualTheme,
  PerformanceMode,
  PlaceNameMode,
  TerritoryPolityProps,
} from '@/types/ming';

export interface LayerVisibility {
  territories: boolean;
  waterways: boolean;
  greatWall: boolean;
  landforms: boolean;
  places: boolean;
  causalArcs: boolean;
  macroEvents: boolean;
  showAllMicroEvents: boolean;
}

export type CampaignCameraMode = 'follow' | 'orbit' | 'free';

interface AtlasState {
  currentYear: number;
  yearFilterMode: 'era-window' | 'all';
  selectedEventId: string | null;
  hoveredPolity: TerritoryPolityProps | null;

  // Separated Left Directory vs Right Detail Panels + Pure Map Immersion Mode
  isDirectoryOpen: boolean;
  isDrawerOpen: boolean;
  isImmersionMode: boolean;

  // Chronological Full-History Auto-Camera Tour ("全史运镜推演")
  isStoryTourPlaying: boolean;
  storyTourSpeed: 1 | 1.5;
  storyTourProgress: number;
  storyTourNonce: number;

  // Multi-Phase Battlefield Campaign Replay ("战役行军运镜推演")
  activeCampaignId: string | null;
  activePhaseIndex: number;
  isCampaignPlaying: boolean;
  campaignSpeed: 1 | 1.5;
  campaignCameraMode: CampaignCameraMode;
  campaignPhaseProgress: number;
  campaignReplayNonce: number;

  isTocModalOpen: boolean;
  theme: MapVisualTheme;
  perfMode: PerformanceMode;
  is3D: boolean;
  placeNameMode: PlaceNameMode;
  layers: LayerVisibility;
  cameraCommand: { pose: CameraPose; seq: number } | null;

  // Actions
  setCurrentYear: (year: number) => void;
  setYearFilterMode: (mode: 'era-window' | 'all') => void;
  selectEvent: (eventId: string | null, fly?: boolean) => void;
  setHoveredPolity: (polity: TerritoryPolityProps | null) => void;
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
  setCampaignSpeed: (speed: 1 | 1.5) => void;
  setCampaignCameraMode: (mode: CampaignCameraMode) => void;
  setCampaignPhaseProgress: (progress: number) => void;
  replayCurrentPhase: () => void;

  setTocModalOpen: (open: boolean) => void;
  setTheme: (theme: MapVisualTheme) => void;
  setPerfMode: (mode: PerformanceMode) => void;
  toggle3D: () => void;
  setPlaceNameMode: (mode: PlaceNameMode) => void;
  toggleLayer: (key: keyof LayerVisibility) => void;
  flyToCamera: (pose: CameraPose) => void;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  currentYear: SITE_CONFIG.timeline.defaultYear,
  yearFilterMode: 'all',
  selectedEventId: 'evt-1363-poyang-decisive',
  hoveredPolity: null,

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
  campaignSpeed: 1,
  campaignCameraMode: 'follow',
  campaignPhaseProgress: 0,
  campaignReplayNonce: 0,

  isTocModalOpen: false,
  theme: 'xuanzhi',
  perfMode: 'balanced',
  is3D: true,
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
  },
  cameraCommand: null,

  setCurrentYear: (year) =>
    set({
      currentYear: Math.max(
        SITE_CONFIG.timeline.minYear,
        Math.min(SITE_CONFIG.timeline.extendedMaxYear, Math.round(year))
      ),
    }),

  setYearFilterMode: (mode) => set({ yearFilterMode: mode }),

  selectEvent: (eventId, fly = true) => {
    if (!eventId) {
      set({ selectedEventId: null });
      return;
    }
    const evt = EVENT_MAP[eventId];
    if (!evt) return;
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      selectedEventId: eventId,
      isDrawerOpen: state.isImmersionMode ? state.isDrawerOpen : true,
      currentYear: evt.time.year,
      storyTourProgress: 0,
      storyTourNonce: state.storyTourNonce + 1,
      cameraCommand: fly
        ? { pose: evt.camera, seq: prevSeq + 1 }
        : state.cameraCommand,
    }));
  },

  setHoveredPolity: (polity) => set({ hoveredPolity: polity }),

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
    const use3D = state.perfMode !== 'eco';

    set({
      activeCampaignId: null,
      isCampaignPlaying: false,
      isStoryTourPlaying: true,
      is3D: use3D,
      isDrawerOpen: !state.isImmersionMode,
      selectedEventId: evt.id,
      currentYear: evt.time.year,
      storyTourProgress: 0,
      storyTourNonce: state.storyTourNonce + 1,
      cameraCommand: {
        pose: {
          center: evt.camera.center,
          zoom: Math.max(6.2, evt.camera.zoom),
          pitch: use3D ? Math.min(46, evt.camera.pitch ?? 44) : 0,
          bearing: use3D ? (evt.camera.bearing ?? -12) : 0,
        },
        seq: prevSeq + 1,
      },
    });
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
      activeCampaignId: campaignId,
      activePhaseIndex: safeIdx,
      isCampaignPlaying: true,
      is3D: state.perfMode !== 'eco',
      campaignCameraMode:
        state.campaignCameraMode === 'free' ? 'follow' : state.campaignCameraMode,
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
      campaignPhaseProgress: 0,
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
  setCampaignSpeed: (speed) => set({ campaignSpeed: speed }),
  setCampaignCameraMode: (mode) =>
    set((state) => ({
      campaignCameraMode: mode,
      campaignReplayNonce:
        mode !== 'free' ? state.campaignReplayNonce + 1 : state.campaignReplayNonce,
    })),
  setCampaignPhaseProgress: (progress) => set({ campaignPhaseProgress: progress }),

  replayCurrentPhase: () =>
    set((state) => ({
      isCampaignPlaying: true,
      campaignCameraMode:
        state.campaignCameraMode === 'free' ? 'follow' : state.campaignCameraMode,
      campaignPhaseProgress: 0,
      campaignReplayNonce: state.campaignReplayNonce + 1,
    })),

  setTocModalOpen: (open) => set({ isTocModalOpen: open }),
  setTheme: (theme) => set({ theme }),

  setPerfMode: (mode) => {
    const next3D = mode !== 'eco';
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set((state) => ({
      perfMode: mode,
      is3D: next3D,
      cameraCommand: {
        pose: {
          center:
            state.cameraCommand?.pose.center ?? SITE_CONFIG.defaultCamera.center,
          zoom: state.cameraCommand?.pose.zoom ?? SITE_CONFIG.defaultCamera.zoom,
          pitch: next3D ? 38 : 0,
          bearing: next3D ? -8 : 0,
        },
        seq: prevSeq + 1,
      },
    }));
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
          pitch: next3D ? 42 : 0,
          bearing: next3D ? -8 : 0,
        },
        seq: prevSeq + 1,
      },
    }));
  },

  setPlaceNameMode: (mode) => set({ placeNameMode: mode }),

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
        pose,
        seq: (state.cameraCommand?.seq ?? 0) + 1,
      },
    })),
}));
