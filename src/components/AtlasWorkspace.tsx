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
  const theme = useAtlasStore((s) => s.theme);
  const isDrawerOpen = useAtlasStore((s) => s.isDrawerOpen);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const isCampaignPanelOpen = useAtlasStore((s) => s.isCampaignPanelOpen);
  const hydrateFromStorage = useAtlasStore((s) => s.hydrateFromStorage);
  const isDark = theme === 'xuanmo';
  const drawerTakesRight = activeCampaignId ? isCampaignPanelOpen : isDrawerOpen;

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <main
      data-drawer-open={drawerTakesRight ? 'true' : 'false'}
      className={`${
        isDark ? 'dark bg-[#0F141D] text-amber-50' : 'bg-[#EFE6D4] text-stone-900'
      } relative w-screen h-screen overflow-hidden select-none`}
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
    </main>
  );
}
