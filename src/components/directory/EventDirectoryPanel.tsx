'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ListOrdered,
  MapPin,
  PanelLeftClose,
  Search,
  Swords,
  X,
} from 'lucide-react';
import { ALL_EVENTS } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

type DirectoryFilter = 'all' | 'macro' | 'micro' | 'campaign';

export default function EventDirectoryPanel() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const storyTourProgress = useAtlasStore((s) => s.storyTourProgress);
  const isDirectoryOpen = useAtlasStore((s) => s.isDirectoryOpen);
  const setDirectoryOpen = useAtlasStore((s) => s.setDirectoryOpen);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const theme = useAtlasStore((s) => s.theme);

  const isDark = theme === 'xuanmo';
  const isTourHudOpen =
    !activeCampaignId && (isStoryTourPlaying || storyTourProgress > 0);

  const counts = useMemo(
    () => ({
      all: ALL_EVENTS.length,
      macro: ALL_EVENTS.filter((e) => e.tier === 'macro').length,
      micro: ALL_EVENTS.filter((e) => e.tier === 'micro').length,
      campaign: ALL_EVENTS.filter((e) => Boolean(e.campaignId)).length,
    }),
    []
  );

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_EVENTS.filter((evt) => {
      if (filter === 'macro' && evt.tier !== 'macro') return false;
      if (filter === 'micro' && evt.tier !== 'micro') return false;
      if (filter === 'campaign' && !evt.campaignId) return false;
      if (!q) return true;
      const haystack = [
        evt.title,
        String(evt.time.year),
        evt.time.reignTitle,
        evt.location.ancientName,
        evt.location.modernName,
        ...evt.actors,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query]);

  // Keep selected event scrolled smoothly into view inside the directory
  useEffect(() => {
    if (isDirectoryOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedEventId, isDirectoryOpen]);

  // Hide directory panel during full-screen battle campaign replay to keep war-room open
  if (activeCampaignId) return null;

  if (!isDirectoryOpen) {
    return (
      <button
        type="button"
        onClick={() => setDirectoryOpen(true)}
        className={`fixed left-3 top-[98px] z-25 px-3 py-2.5 rounded-xl border shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-serif font-bold cursor-pointer transition hover:scale-105 ${
          isDark
            ? 'bg-slate-950/90 border-amber-500/30 text-amber-100'
            : 'bg-[#FAF5E8]/95 border-amber-900/25 text-stone-900'
        }`}
        title="展开编年事件目录面板"
      >
        <ListOrdered className="w-4 h-4 text-[#B83B2A] dark:text-amber-400" />
        <span>事件目录 ({ALL_EVENTS.length})</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="编年历史事件目录面板"
      className={`fixed top-[98px] ${
        isTourHudOpen ? 'bottom-[168px] 2xl:bottom-20' : 'bottom-20'
      } left-3 z-25 w-[calc(100vw-24px)] sm:w-[292px] xl:w-[308px] rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col overflow-hidden transition-all ${
        isDark
          ? 'bg-slate-950/92 border-amber-500/30 text-amber-50'
          : 'bg-[#FAF5E8]/95 border-amber-900/25 text-stone-900'
      }`}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-current/12 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ListOrdered className="w-4 h-4 text-[#B83B2A] dark:text-amber-400 shrink-0" />
          <h2 className="font-serif font-bold text-sm tracking-wide truncate">
            事件目录
          </h2>
          <span className="px-1.5 py-0.2 rounded bg-current/10 text-[11px] tabular-nums opacity-80">
            {filteredEvents.length}/{ALL_EVENTS.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setDirectoryOpen(false)}
          className="p-1 rounded-lg hover:bg-current/10 transition cursor-pointer"
          title="收起事件目录"
        >
          <PanelLeftClose className="w-4 h-4 opacity-75" />
        </button>
      </div>

      {/* Search + Category Filter Strip */}
      <div className="px-3 py-2 border-b border-current/10 space-y-2 shrink-0">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
            isDark
              ? 'bg-slate-900/90 border-slate-700 text-amber-50'
              : 'bg-[#FFFDF8] border-amber-900/20 text-stone-900'
          }`}
        >
          <Search className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜事件 / 人物 / 古今地名 / 年份…"
            className="w-full bg-transparent focus:outline-none text-xs placeholder:opacity-55"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="opacity-60 hover:opacity-100 cursor-pointer"
              aria-label="清空搜索"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1 text-[11px]">
          {(
            [
              { id: 'all', label: `全部 ${counts.all}` },
              { id: 'macro', label: `大事 ${counts.macro}` },
              { id: 'micro', label: `轶事 ${counts.micro}` },
              { id: 'campaign', label: `战役 ${counts.campaign}` },
            ] as { id: DirectoryFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`py-1 rounded-md font-medium transition cursor-pointer text-center ${
                filter === tab.id
                  ? 'bg-[#B83B2A] text-amber-50 font-bold shadow-xs'
                  : 'bg-current/7 hover:bg-current/14 opacity-80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Chronological Event List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredEvents.length === 0 ? (
          <div className="py-10 text-center text-xs opacity-65">
            未找到匹配的历史事件，请尝试其他关键词
          </div>
        ) : (
          filteredEvents.map((item) => {
            const active = item.id === selectedEventId;
            const isMacro = item.tier === 'macro';
            const badgeText = item.campaignId ? '战' : isMacro ? '史' : '轶';

            return (
              <button
                key={item.id}
                ref={active ? activeItemRef : null}
                type="button"
                onClick={() => {
                  exitCampaign();
                  selectEvent(item.id, true);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setDirectoryOpen(false);
                  }
                }}
                className={`w-full text-left p-2 rounded-xl border transition cursor-pointer flex items-start gap-2 ${
                  active
                    ? 'bg-[#B83B2A] text-amber-50 border-amber-300/80 shadow-md'
                    : isDark
                    ? 'border-transparent hover:bg-slate-900/90 hover:border-slate-700'
                    : 'border-transparent hover:bg-amber-950/6 hover:border-amber-900/15'
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center text-[10px] font-serif font-bold shrink-0 ${
                    active
                      ? 'bg-amber-100 text-[#9B1C1C]'
                      : item.campaignId
                      ? 'bg-red-800 text-amber-50'
                      : isMacro
                      ? 'bg-[#B83B2A]/90 text-amber-50'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {badgeText}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        active ? 'text-amber-200' : 'text-[#B83B2A] dark:text-amber-400'
                      }`}
                    >
                      {item.time.year}年 · {item.time.reignTitle}
                    </span>
                    {item.campaignId && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full flex items-center gap-0.5 ${
                          active
                            ? 'bg-amber-200/25 text-amber-100'
                            : 'bg-red-800/12 text-red-800 dark:bg-amber-400/15 dark:text-amber-300'
                        }`}
                      >
                        <Swords className="w-2.5 h-2.5" />
                        含推演
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-serif font-semibold leading-snug line-clamp-2 mt-0.5">
                    {item.title}
                  </div>

                  <div
                    className={`mt-1 text-[10px] flex items-center gap-1 truncate ${
                      active ? 'text-amber-100/85' : 'opacity-65'
                    }`}
                  >
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {item.location.ancientName}（今{item.location.modernName}）
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
