'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import TopAtlasBar from '@/components/header/TopAtlasBar';
import EventDirectoryPanel from '@/components/directory/EventDirectoryPanel';
import EventDetailDrawer from '@/components/drawer/EventDetailDrawer';
import TerritoryLegendCard from '@/components/map/TerritoryLegendCard';
import StoryTourPlayer from '@/components/tour/StoryTourPlayer';
import CampaignPlayer from '@/components/campaign/CampaignPlayer';
import CharacterOdysseyPlayer from '@/components/odyssey/CharacterOdysseyPlayer';
import TimelineBar from '@/components/timeline/TimelineBar';
import BookTocModal from '@/components/modals/BookTocModal';
import ShareAtlasModal from '@/components/modals/ShareAtlasModal';
import ReleaseNotesModal from '@/components/modals/ReleaseNotesModal';
import { buildAtlasQueryString } from '@/lib/urlState';
import { useAtlasStore } from '@/store/useAtlasStore';

const MingMapCanvas = dynamic(
  () => import('@/components/map/MingMapCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#EFE6D4] text-stone-800 gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#9E2318] border-2 border-amber-300 flex items-center justify-center shadow-lg">
          <span className="font-serif font-bold text-amber-100 text-base">
            明舆
          </span>
        </div>
        <p className="font-serif text-sm tracking-widest opacity-80">
          正在展卷《明途 · 舆图纪》青绿山水舆图……
        </p>
      </div>
    ),
  }
);

export default function AtlasWorkspace() {
  // Subscribe ONLY to root-container visual booleans so scrubbing years / clicking events /
  // switching phases NEVER re-renders AtlasWorkspace or its 12 sibling children!
  const isDark = useAtlasStore((s) => s.theme === 'xuanmo');
  const drawerTakesRight = useAtlasStore((s) =>
    s.activeCampaignId ? s.isCampaignPanelOpen : s.isDrawerOpen
  );

  useEffect(() => {
    useAtlasStore.getState().hydrateFromStorage();

    // Imperative zero-re-render URL query sync via Zustand subscribe (debounced 280ms)
    let timer: number | null = null;
    let lastSig = '';
    const scheduleUrlSync = () => {
      const s = useAtlasStore.getState();
      if (!s.hasHydratedCache || typeof window === 'undefined') return;
      const sig = `${s.currentYear}|${s.selectedEventId ?? ''}|${
        s.activeCampaignId ?? ''
      }|${s.activePhaseIndex}|${s.campaignArrowMode}|${
        s.activeCharacterId ?? ''
      }|${s.activeCharacterStopIndex}|${s.theme}|${s.is3D ? 1 : 0}`;
      if (sig === lastSig) return;
      lastSig = sig;

      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        const cur = useAtlasStore.getState();
        const qs = buildAtlasQueryString({
          currentYear: cur.currentYear,
          selectedEventId: cur.selectedEventId,
          activeCampaignId: cur.activeCampaignId,
          activePhaseIndex: cur.activePhaseIndex,
          campaignArrowMode: cur.campaignArrowMode,
          activeCharacterId: cur.activeCharacterId,
          activeCharacterStopIndex: cur.activeCharacterStopIndex,
          theme: cur.theme,
          is3D: cur.is3D,
        });
        const nextUrl = `${window.location.pathname}${qs}`;
        if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
          window.history.replaceState(null, '', nextUrl);
        }
      }, 280);
    };

    scheduleUrlSync();
    const unsub = useAtlasStore.subscribe(scheduleUrlSync);
    return () => {
      unsub();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return (
    <main
      data-drawer-open={drawerTakesRight ? 'true' : 'false'}
      className={`${
        isDark ? 'dark bg-[#0F141D] text-amber-50' : 'bg-[#EFE6D4] text-stone-900'
      } relative w-screen h-dvh overflow-hidden select-none`}
    >
      <MingMapCanvas />
      <TopAtlasBar />
      <EventDirectoryPanel />
      <EventDetailDrawer />
      <TerritoryLegendCard />
      <StoryTourPlayer />
      <CampaignPlayer />
      <CharacterOdysseyPlayer />
      <TimelineBar />
      <BookTocModal />
      <ShareAtlasModal />
      <ReleaseNotesModal />
    </main>
  );
}
