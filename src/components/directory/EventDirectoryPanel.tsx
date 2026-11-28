'use client';

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListOrdered,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Swords,
  X,
} from 'lucide-react';
import { ALL_EVENTS } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

type DirectoryFilter = 'all' | 'macro' | 'micro' | 'campaign';

// Pre-computed once at module load for instant 0-allocation keyword filtering
const STATIC_COUNTS = {
  all: ALL_EVENTS.length,
  macro: ALL_EVENTS.filter((e) => e.tier === 'macro').length,
  micro: ALL_EVENTS.filter((e) => e.tier === 'micro').length,
  campaign: ALL_EVENTS.filter((e) => Boolean(e.campaignId)).length,
};

const EVENT_SEARCH_HAYSTACK = new Map<string, string>(
  ALL_EVENTS.map((evt) => [
    evt.id,
    [
      evt.title,
      String(evt.time.year),
      evt.time.reignTitle,
      evt.location.ancientName,
      evt.location.modernName,
      ...evt.actors,
    ]
      .join(' ')
      .toLowerCase(),
  ])
);

const ROW_CONTENT_VISIBILITY_STYLE: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 74px',
};

function EventDirectoryPanelInner() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const hasTourSession = useAtlasStore((s) => s.storyTourProgress > 0);
  const isDirectoryOpen = useAtlasStore((s) => s.isDirectoryOpen);
  const setDirectoryOpen = useAtlasStore((s) => s.setDirectoryOpen);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const resetToStoryBeginning = useAtlasStore((s) => s.resetToStoryBeginning);
  const theme = useAtlasStore((s) => s.theme);

  const isDark = theme === 'xuanmo';
  const isTourHudOpen =
    !activeCampaignId && (isStoryTourPlaying || hasTourSession);

  const counts = STATIC_COUNTS;

  const filteredEvents = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return ALL_EVENTS.filter((evt) => {
      if (filter === 'macro' && evt.tier !== 'macro') return false;
      if (filter === 'micro' && evt.tier !== 'micro') return false;
      if (filter === 'campaign' && !evt.campaignId) return false;
      if (!q) return true;
      return (EVENT_SEARCH_HAYSTACK.get(evt.id) ?? '').includes(q);
    });
  }, [filter, deferredQuery]);

  // Keep selected event scrolled cleanly into view without smooth-scroll layout contention during flyTo
  useEffect(() => {
    if (isDirectoryOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'auto',
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
        className={`hidden sm:flex fixed left-3 top-[58px] z-25 px-3 py-2 rounded-xl border shadow-lg items-center gap-1.5 text-xs font-serif font-bold cursor-pointer transition hover:scale-105 ${
          isDark
            ? 'bg-[#0D131D]/97 border-amber-500/30 text-amber-100'
            : 'bg-[#FAF5E8]/97 border-amber-900/25 text-stone-900'
        }`}
        title="展开编年事件目录面板"
      >
        <ListOrdered className="w-4 h-4 text-[#9E2318] dark:text-amber-400" />
        <span>事件目录 ({ALL_EVENTS.length})</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="编年历史事件目录面板"
      className={`fixed left-2.5 right-2.5 ${
        isTourHudOpen ? 'bottom-[150px]' : 'bottom-[82px]'
      } ${
        mobileExpanded ? 'max-h-[78dvh]' : 'max-h-[56dvh]'
      } sm:max-h-none sm:right-auto sm:top-[58px] ${
        isTourHudOpen ? 'sm:bottom-[164px] 2xl:bottom-16' : 'sm:bottom-16'
      } sm:left-3 z-25 sm:w-[266px] xl:w-[280px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-[max-height] duration-200 ${
        isDark
          ? 'bg-[#0D131D]/98 border-amber-500/35 text-amber-50'
          : 'bg-[#FAF5E8]/98 border-amber-900/25 text-stone-900'
      }`}
    >
      {/* Mobile Bottom-Sheet Tactile Handle Bar */}
      <button
        type="button"
        onClick={() => setMobileExpanded((v) => !v)}
        className="sm:hidden w-full pt-2 pb-1 flex flex-col items-center justify-center cursor-pointer shrink-0"
        aria-label={mobileExpanded ? '切换为半屏看图高度' : '展开更高目录列表'}
      >
        <span className="w-10 h-1 rounded-full bg-current/25" />
      </button>

      {/* Header */}
      <div className="px-3.5 py-2 border-b border-current/12 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ListOrdered className="w-4 h-4 text-[#B83B2A] dark:text-amber-400 shrink-0" />
          <h2 className="font-serif font-bold text-sm tracking-wide truncate">
            事件目录
          </h2>
          <span className="px-1.5 py-0.2 rounded bg-current/10 text-[11px] tabular-nums opacity-80">
            {filteredEvents.length}/{ALL_EVENTS.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
              resetToStoryBeginning();
            }}
            className={`px-1.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
              isDark
                ? 'border-amber-500/30 hover:bg-amber-500/15 text-amber-200'
                : 'border-amber-900/20 hover:bg-amber-900/8 text-[#9E2318]'
            }`}
            title="回到故事最开始的地方（1344年 · 濠州钟离黄河决堤开篇）并重置进度缓存"
          >
            <RotateCcw className="w-3 h-3" />
            <span>开篇</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="sm:hidden p-1.5 rounded-lg bg-current/8 hover:bg-current/15 cursor-pointer"
            title={mobileExpanded ? '半屏看图' : '展开目录'}
            aria-label={mobileExpanded ? '半屏看图' : '展开目录'}
          >
            {mobileExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setDirectoryOpen(false)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              isDark
                ? 'border-amber-400/40 bg-amber-400/15 hover:bg-amber-400/25 text-amber-100'
                : 'border-amber-900/25 bg-amber-950/10 hover:bg-amber-950/20 text-stone-900'
            }`}
            title="收起事件目录查看地图"
          >
            <X className="w-3.5 h-3.5" />
            <span>收起</span>
          </button>
        </div>
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
                style={ROW_CONTENT_VISIBILITY_STYLE}
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

const EventDirectoryPanel = React.memo(EventDirectoryPanelInner);
export default EventDirectoryPanel;
