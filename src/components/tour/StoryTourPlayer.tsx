'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Swords,
  Video,
  X,
} from 'lucide-react';
import { ALL_EVENTS, CAMPAIGN_MAP, EVENT_MAP } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function StoryTourPlayer() {
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const storyTourProgress = useAtlasStore((s) => s.storyTourProgress);
  const storyTourSpeed = useAtlasStore((s) => s.storyTourSpeed);
  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const setStoryTourPlaying = useAtlasStore((s) => s.setStoryTourPlaying);
  const setStoryTourSpeed = useAtlasStore((s) => s.setStoryTourSpeed);
  const stopStoryTour = useAtlasStore((s) => s.stopStoryTour);
  const stepStoryEvent = useAtlasStore((s) => s.stepStoryEvent);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const theme = useAtlasStore((s) => s.theme);

  if (activeCampaignId || (!isStoryTourPlaying && storyTourProgress === 0)) {
    return null;
  }

  const evt = selectedEventId
    ? EVENT_MAP[selectedEventId] ?? ALL_EVENTS[0]
    : ALL_EVENTS[0];
  const idx = Math.max(0, ALL_EVENTS.findIndex((e) => e.id === evt.id));
  const linkedCampaign = evt.campaignId ? CAMPAIGN_MAP[evt.campaignId] : null;
  const isDark = theme === 'xuanmo';

  return (
    <section
      aria-label="全史自动运镜推演控制台"
      className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-24px)] max-w-lg rounded-2xl border shadow-2xl px-4 py-2.5 overflow-hidden ${
        isDark
          ? 'bg-[#0D131D]/98 border-amber-500/40 text-amber-50'
          : 'bg-[#FAF5E8]/98 border-amber-900/30 text-stone-900'
      }`}
    >
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-current/12">
        <div
          style={{ width: `${storyTourProgress}%` }}
          className="h-full bg-gradient-to-r from-[#9E2318] via-amber-500 to-amber-300"
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-[#9E2318] text-amber-50 text-[11px] font-bold flex items-center gap-1">
            <Video className="w-3 h-3" />
            全史编年自动推演
          </span>
          <span className="text-xs font-bold tabular-nums opacity-80">
            第 {idx + 1} / {ALL_EVENTS.length} 站
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {linkedCampaign && (
            <button
              type="button"
              onClick={() => startCampaign(linkedCampaign.id, 0)}
              className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Swords className="w-3 h-3" />
              切入本战行军推演
            </button>
          )}
          <button
            type="button"
            onClick={stopStoryTour}
            className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"
            title="退出全史自动运镜推演"
          >
            <X className="w-4 h-4 opacity-75" />
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="font-serif font-bold text-sm truncate">
            {evt.time.year}年 · {evt.title}
          </div>
          <div className="text-[11px] opacity-75 truncate">
            {evt.location.ancientName}（今{evt.location.modernName}） · 平稳飞跃巡览 · 跨期自动演示胜方版图涂抹
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setStoryTourSpeed(storyTourSpeed === 1 ? 1.5 : 1)}
            className="px-2 py-1 rounded-lg border border-current/20 text-xs font-bold tabular-nums hover:bg-current/10 cursor-pointer"
          >
            {storyTourSpeed}x
          </button>

          <button
            type="button"
            disabled={idx <= 0}
            onClick={() => stepStoryEvent(-1)}
            className="p-1.5 rounded-lg border border-current/20 hover:bg-current/10 disabled:opacity-35 cursor-pointer"
            title="上一站"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setStoryTourPlaying(!isStoryTourPlaying)}
            className="px-3 py-1 rounded-lg bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            {isStoryTourPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                暂停
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                继续运镜
              </>
            )}
          </button>

          <button
            type="button"
            disabled={idx >= ALL_EVENTS.length - 1}
            onClick={() => stepStoryEvent(1)}
            className="p-1.5 rounded-lg border border-current/20 hover:bg-current/10 disabled:opacity-35 cursor-pointer"
            title="下一站"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
