'use client';

import React, { useEffect, useRef } from 'react';
import { Minus, Pause, Play, Plus } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ALL_EVENTS } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

const MIN_YEAR = SITE_CONFIG.timeline.minYear;
const MAX_YEAR = SITE_CONFIG.timeline.extendedMaxYear;
const YEAR_SPAN = MAX_YEAR - MIN_YEAR;

// Pre-indexed O(1) lookup for macro events by year & static tick descriptors
const MACRO_EVENT_ID_BY_YEAR = new Map<number, string>();
for (const ev of ALL_EVENTS) {
  if (ev.tier === 'macro' && !MACRO_EVENT_ID_BY_YEAR.has(ev.time.year)) {
    MACRO_EVENT_ID_BY_YEAR.set(ev.time.year, ev.id);
  }
}

const STATIC_TIMELINE_TICKS = ALL_EVENTS.filter(
  (e) => e.time.year <= MAX_YEAR
).map((ev) => ({
  id: ev.id,
  leftPct: `${((ev.time.year - MIN_YEAR) / YEAR_SPAN) * 100}%`,
  isMacro: ev.tier === 'macro',
}));

const TimelineEventTicks = React.memo(function TimelineEventTicks() {
  return (
    <div className="relative w-full h-2 mt-0.5 pointer-events-none hidden sm:block">
      {STATIC_TIMELINE_TICKS.map((tick) => (
        <span
          key={tick.id}
          style={{ left: tick.leftPct }}
          className={`absolute top-0 w-1 rounded-full ${
            tick.isMacro ? 'h-2 bg-[#B83B2A]' : 'h-1.5 bg-amber-500/80'
          }`}
        />
      ))}
    </div>
  );
});

function TimelineBarInner() {
  const currentYear = useAtlasStore((s) => s.currentYear);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const hasTourSession = useAtlasStore((s) => s.storyTourProgress > 0);
  const startStoryTour = useAtlasStore((s) => s.startStoryTour);
  const stopStoryTour = useAtlasStore((s) => s.stopStoryTour);
  const setCurrentYear = useAtlasStore((s) => s.setCurrentYear);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const exitCharacterOdyssey = useAtlasStore((s) => s.exitCharacterOdyssey);
  const flyToCamera = useAtlasStore((s) => s.flyToCamera);
  const theme = useAtlasStore((s) => s.theme);

  // RAF-coalesced year scrubbing + debounced macro-event drawer sync so slider drag is 120fps!
  const scrubRafRef = useRef<number | null>(null);
  const pendingYearRef = useRef<number | null>(null);
  const selectDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrubRafRef.current !== null) cancelAnimationFrame(scrubRafRef.current);
      if (selectDebounceRef.current !== null) {
        window.clearTimeout(selectDebounceRef.current);
      }
    };
  }, []);

  const isDark = theme === 'xuanmo';
  const hasDedicatedPlayer =
    Boolean(activeCampaignId) ||
    Boolean(activeCharacterId) ||
    isStoryTourPlaying ||
    hasTourSession;

  const clampedSliderYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, currentYear));

  return (
    <footer
      aria-label="历史年份时间轴控制器"
      className={`fixed bottom-2 left-2.5 right-2.5 sm:left-3 sm:right-3 z-30 rounded-2xl border shadow-xl px-2.5 sm:px-3 py-1.5 ${
        hasDedicatedPlayer ? 'hidden sm:flex' : 'flex'
      } flex-col sm:flex-row items-center gap-1.5 sm:gap-3 ${
        isDark
          ? 'bg-[#0D131D]/97 border-amber-500/30 text-amber-50'
          : 'bg-[#FAF5E8]/97 border-amber-900/25 text-stone-900'
      }`}
    >
      {/* Era Quick Jump Capsules + Direct Auto-Camera Replay Button */}
      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar max-w-full">
        <button
          type="button"
          onClick={() =>
            isStoryTourPlaying ? stopStoryTour() : startStoryTour()
          }
          className={`px-2.5 py-1 rounded-lg text-xs font-serif font-bold whitespace-nowrap flex items-center gap-1 shadow-xs transition cursor-pointer ${
            isStoryTourPlaying
              ? 'bg-amber-600 text-white'
              : 'bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50'
          }`}
          title="启动/暂停全史编年自动运镜推演"
        >
          {isStoryTourPlaying ? (
            <>
              <Pause className="w-3 h-3" />
              <span>暂停推演</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              <span>运镜推演</span>
            </>
          )}
        </button>

        {SITE_CONFIG.timeline.featuredEras.map((era) => {
          const inEra =
            currentYear >= era.yearRange[0] && currentYear <= era.yearRange[1];
          return (
            <button
              key={era.id}
              type="button"
              onClick={() => {
                exitCampaign();
                exitCharacterOdyssey();
                stopStoryTour();
                setCurrentYear(era.defaultYear);
                flyToCamera(era.camera);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-serif font-bold whitespace-nowrap transition cursor-pointer ${
                inEra
                  ? 'bg-stone-800 text-amber-50 dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                  : 'bg-current/8 hover:bg-current/15 opacity-85'
              }`}
              title={`${era.label} (${era.yearRange[0]}–${era.yearRange[1]})`}
            >
              {era.label}
              <span className="ml-1 font-sans font-normal opacity-80 tabular-nums text-[10px] hidden 2xl:inline">
                ({era.yearRange[0]}–{era.yearRange[1]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Year Step Controls + Range Scrubber with Static Event Ticks */}
      <div className="flex items-center gap-2 flex-1 w-full">
        <button
          type="button"
          onClick={() => setCurrentYear(currentYear - 1)}
          className="p-1 rounded-lg border border-current/20 hover:bg-current/10 cursor-pointer"
          title="前推一年"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="relative flex-1 flex flex-col justify-center">
          <input
            type="range"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={clampedSliderYear}
            onChange={(e) => {
              const nextYr = Number(e.target.value);
              pendingYearRef.current = nextYr;
              if (scrubRafRef.current === null) {
                scrubRafRef.current = requestAnimationFrame(() => {
                  scrubRafRef.current = null;
                  const yr = pendingYearRef.current;
                  if (yr === null) return;
                  setCurrentYear(yr, true);
                });
              }
              const exactEvtId = MACRO_EVENT_ID_BY_YEAR.get(nextYr);
              if (selectDebounceRef.current !== null) {
                window.clearTimeout(selectDebounceRef.current);
              }
              if (exactEvtId) {
                selectDebounceRef.current = window.setTimeout(() => {
                  selectDebounceRef.current = null;
                  selectEvent(exactEvtId, false);
                }, 65);
              }
            }}
            aria-label="拖动年份滑块观察疆域与事件演变"
            className="w-full accent-[#B83B2A] cursor-pointer h-1.5 rounded-lg"
          />

          <TimelineEventTicks />
        </div>

        <button
          type="button"
          onClick={() => setCurrentYear(currentYear + 1)}
          className="p-1 rounded-lg border border-current/20 hover:bg-current/10 cursor-pointer"
          title="后推一年"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="min-w-[56px] sm:min-w-[82px] text-right font-serif font-bold text-xs sm:text-base tabular-nums text-[#B83B2A] dark:text-amber-300 shrink-0">
          {currentYear} 年
        </div>
      </div>
    </footer>
  );
}

const TimelineBar = React.memo(TimelineBarInner);
export default TimelineBar;
