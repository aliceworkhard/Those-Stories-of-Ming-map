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
    const prevSeq = get().cameraCommand?.seq ?? 0;
    set({
      activeCampaignId: campaignId,
      activePhaseIndex: safeIdx,
      isCampaignPlaying: false,
      isDrawerOpen: false,
      currentYear: phase.year,
      cameraCommand: { pose: phase.camera, seq: prevSeq + 1 },
    });
  },

  exitCampaign: () =>
    set({
      activeCampaignId: null,
      activePhaseIndex: 0,
      isCampaignPlaying: false,
      isDrawerOpen: true,
    }),

  setCampaignPhase: (phaseIndex) => {
    const { activeCampaignId, cameraCommand } = get();
    if (!activeCampaignId) return;
    const cmp = CAMPAIGN_MAP[activeCampaignId];
    if (!cmp) return;
    const safeIdx = Math.max(0, Math.min(cmp.phases.length - 1, phaseIndex));
    const phase = cmp.phases[safeIdx];
    set({
      activePhaseIndex: safeIdx,
      currentYear: phase.year,
      cameraCommand: { pose: phase.camera, seq: (cameraCommand?.seq ?? 0) + 1 },
    });
  },

  nextCampaignPhase: () => {
    const { activeCampaignId, activePhaseIndex } = get();
    if (!activeCampaignId) return;
    const cmp = CAMPAIGN_MAP[activeCampaignId];
    if (!cmp) return;
    if (activePhaseIndex < cmp.phases.length - 1) {
      get().setCampaignPhase(activePhaseIndex + 1);
    } else {
      set({ isCampaignPlaying: false });
    }
  },

  prevCampaignPhase: () => {
    const { activePhaseIndex } = get();
    if (activePhaseIndex > 0) {
      get().setCampaignPhase(activePhaseIndex - 1);
    }
  },

  setCampaignPlaying: (playing) => set({ isCampaignPlaying: playing }),

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
