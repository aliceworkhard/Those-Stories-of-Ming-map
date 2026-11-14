'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ALL_EVENTS } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function TimelineBar() {
  const currentYear = useAtlasStore((s) => s.currentYear);
  const setCurrentYear = useAtlasStore((s) => s.setCurrentYear);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const flyToCamera = useAtlasStore((s) => s.flyToCamera);
  const theme = useAtlasStore((s) => s.theme);

  const isDark = theme === 'xuanmo';
  const minYear = SITE_CONFIG.timeline.minYear;
  const maxYear = 1455; // Phase 1 interactive focus span (1344 - 1455, expandable to 1662 in Phase 3)

  const clampedSliderYear = Math.max(minYear, Math.min(maxYear, currentYear));

  return (
    <footer
      aria-label="历史年份时间轴控制器"
      className={`fixed bottom-2.5 left-3 right-3 z-30 rounded-2xl border shadow-xl backdrop-blur-md px-3.5 py-2 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 ${
        isDark
          ? 'bg-slate-950/90 border-amber-500/25 text-amber-50'
          : 'bg-[#FAF5E8]/94 border-amber-900/20 text-stone-900'
      }`}
    >
      {/* Era Quick Jump Capsules */}
      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto max-w-full">
        {SITE_CONFIG.timeline.featuredEras.map((era) => {
          const inEra =
            currentYear >= era.yearRange[0] && currentYear <= era.yearRange[1];
          return (
            <button
              key={era.id}
              type="button"
              onClick={() => {
                exitCampaign();
                setCurrentYear(era.defaultYear);
                flyToCamera(era.camera);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-serif font-bold whitespace-nowrap transition cursor-pointer ${
                inEra
                  ? 'bg-[#B83B2A] text-amber-50 shadow-xs'
                  : 'bg-current/8 hover:bg-current/15 opacity-85'
              }`}
            >
              {era.label}
              <span className="ml-1 font-sans font-normal opacity-80 tabular-nums text-[10px]">
                ({era.yearRange[0]}–{era.yearRange[1]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Year Step Controls + Range Scrubber with Event Ticks */}
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
            min={minYear}
            max={maxYear}
            value={clampedSliderYear}
            onChange={(e) => {
              const nextYr = Number(e.target.value);
              setCurrentYear(nextYr);
              const exactEvt = ALL_EVENTS.find(
                (ev) => ev.time.year === nextYr && ev.tier === 'macro'
              );
              if (exactEvt) {
                selectEvent(exactEvt.id, false);
              }
            }}
            aria-label="拖动年份滑块观察疆域与事件演变"
            className="w-full accent-[#B83B2A] cursor-pointer h-1.5 rounded-lg"
          />

          {/* Tick Marks for Mapped Events */}
          <div className="relative w-full h-2 mt-0.5 pointer-events-none hidden sm:block">
            {ALL_EVENTS.filter((e) => e.time.year <= maxYear).map((ev) => {
              const pct = ((ev.time.year - minYear) / (maxYear - minYear)) * 100;
              return (
                <span
                  key={ev.id}
                  style={{ left: `${pct}%` }}
                  className={`absolute top-0 w-1 rounded-full ${
                    ev.tier === 'macro'
                      ? 'h-2 bg-[#B83B2A]'
                      : 'h-1.5 bg-amber-500/80'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCurrentYear(currentYear + 1)}
          className="p-1 rounded-lg border border-current/20 hover:bg-current/10 cursor-pointer"
          title="后推一年"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="min-w-[82px] text-right font-serif font-bold text-sm sm:text-base tabular-nums text-[#B83B2A] dark:text-amber-300 shrink-0">
          {currentYear} 年
        </div>
      </div>
    </footer>
  );
}
