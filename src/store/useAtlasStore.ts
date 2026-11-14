import { create } from 'zustand';
import { SITE_CONFIG } from '@/config/site';
import { CAMPAIGN_MAP, EVENT_MAP } from '@/lib/atlasData';
import type { CameraPose, MapVisualTheme, PlaceNameMode } from '@/types/ming';

export interface LayerVisibility {
  territories: boolean;
  waterways: boolean;
  greatWall: boolean;
  places: boolean;
  macroEvents: boolean;
  showAllMicroEvents: boolean;
}

interface AtlasState {
  currentYear: number;
  yearFilterMode: 'era-window' | 'all';
  selectedEventId: string | null;
  isDrawerOpen: boolean;
  activeCampaignId: string | null;
  activePhaseIndex: number;
  isCampaignPlaying: boolean;
  campaignSpeed: 1 | 1.5;
  campaignPhaseProgress: number;
  campaignReplayNonce: number;
  isTocModalOpen: boolean;
  theme: MapVisualTheme;
  is3D: boolean;
  placeNameMode: PlaceNameMode;
  layers: LayerVisibility;
  cameraCommand: { pose: CameraPose; seq: number } | null;

  // Actions
  setCurrentYear: (year: number) => void;
  setYearFilterMode: (mode: 'era-window' | 'all') => void;
  selectEvent: (eventId: string | null, fly?: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  startCampaign: (campaignId: string, phaseIndex?: number) => void;
  exitCampaign: () => void;
  setCampaignPhase: (phaseIndex: number) => void;
  nextCampaignPhase: () => void;
  prevCampaignPhase: () => void;
  setCampaignPlaying: (playing: boolean) => void;
  setCampaignSpeed: (speed: 1 | 1.5) => void;
  setCampaignPhaseProgress: (progress: number) => void;
  replayCurrentPhase: () => void;
  setTocModalOpen: (open: boolean) => void;
  setTheme: (theme: MapVisualTheme) => void;
  toggle3D: () => void;
  setPlaceNameMode: (mode: PlaceNameMode) => void;
  toggleLayer: (key: keyof LayerVisibility) => void;
  flyToCamera: (pose: CameraPose) => void;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  currentYear: SITE_CONFIG.timeline.defaultYear,
  yearFilterMode: 'all',
  selectedEventId: 'evt-1363-poyang-decisive',
  isDrawerOpen: true,
  activeCampaignId: null,
  activePhaseIndex: 0,
  isCampaignPlaying: false,
  campaignSpeed: 1,
  campaignPhaseProgress: 0,
  campaignReplayNonce: 0,
  isTocModalOpen: false,
  theme: 'xuanzhi',
  is3D: true,
  placeNameMode: 'both',
  layers: {
    territories: true,
    waterways: true,
    greatWall: true,
    places: true,
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
    set({
      selectedEventId: eventId,
      isDrawerOpen: true,
      currentYear: evt.time.year,
      cameraCommand: fly ? { pose: evt.camera, seq: prevSeq + 1 } : get().cameraCommand,
    });
  },

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),

  startCampaign: (campaignId, phaseIndex = 0) => {
    const cmp = CAMPAIGN_MAP[campaignId];
    if (!cmp) return;
    const safeIdx = Math.max(0, Math.min(cmp.phases.length - 1, phaseIndex));
    const phase = cmp.phases[safeIdx];
    set((state) => ({
      activeCampaignId: campaignId,
      activePhaseIndex: safeIdx,
      // Auto-start 3D camera choreography & progressive route replay immediately!
      isCampaignPlaying: true,
      campaignPhaseProgress: 0,
      campaignReplayNonce: state.campaignReplayNonce + 1,
      isDrawerOpen: false,
      currentYear: phase.year,
    }));
  },

  exitCampaign: () =>
    set({
      activeCampaignId: null,
      activePhaseIndex: 0,
      isCampaignPlaying: false,
      campaignPhaseProgress: 0,
      isDrawerOpen: true,
    }),

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

  setCampaignPhaseProgress: (progress) => set({ campaignPhaseProgress: progress }),

  replayCurrentPhase: () =>
    set((state) => ({
      isCampaignPlaying: true,
      campaignPhaseProgress: 0,
      campaignReplayNonce: state.campaignReplayNonce + 1,
    })),

  setTocModalOpen: (open) => set({ isTocModalOpen: open }),

  setTheme: (theme) => set({ theme }),

  toggle3D: () => {
    const next3D = !get().is3D;
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set({
      is3D: next3D,
      cameraCommand: {
        pose: {
          center: get().cameraCommand?.pose.center ?? SITE_CONFIG.defaultCamera.center,
          zoom: get().cameraCommand?.pose.zoom ?? SITE_CONFIG.defaultCamera.zoom,
          pitch: next3D ? 44 : 0,
          bearing: next3D ? -8 : 0,
        },
        seq: prevSeq + 1,
      },
    });
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
