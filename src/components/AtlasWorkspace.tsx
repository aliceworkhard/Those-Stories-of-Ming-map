'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import TopAtlasBar from '@/components/header/TopAtlasBar';
import EventDetailDrawer from '@/components/drawer/EventDetailDrawer';
import CampaignPlayer from '@/components/campaign/CampaignPlayer';
import TimelineBar from '@/components/timeline/TimelineBar';
import BookTocModal from '@/components/modals/BookTocModal';
import { useAtlasStore } from '@/store/useAtlasStore';

const MingMapCanvas = dynamic(
  () => import('@/components/map/MingMapCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#EFE8D8] text-stone-800 gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#A92B1E] border-2 border-amber-300 flex items-center justify-center shadow-lg animate-pulse">
          <span className="font-serif font-bold text-amber-100 text-lg">
            明舆
          </span>
        </div>
        <p className="font-serif text-sm tracking-widest opacity-80">
          正在展卷《明途 · 舆图纪》三维山河舆图……
        </p>
      </div>
    ),
  }
);

export default function AtlasWorkspace() {
  const theme = useAtlasStore((s) => s.theme);
  const isDark = theme === 'xuanmo';

  return (
    <main
      className={`${
        isDark ? 'dark bg-slate-950 text-amber-50' : 'bg-[#EFE8D8] text-stone-900'
      } relative w-screen h-screen overflow-hidden select-none`}
    >
      <MingMapCanvas />
      <TopAtlasBar />
      <EventDetailDrawer />
      <CampaignPlayer />
      <TimelineBar />
      <BookTocModal />
    </main>
  );
}
