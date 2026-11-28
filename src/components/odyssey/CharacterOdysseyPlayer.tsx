'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { CHARACTER_MAP } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

function CharacterOdysseyPlayerInner() {
  const [autoPlay, setAutoPlay] = useState(false);

  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const activeCharacterStopIndex = useAtlasStore(
    (s) => s.activeCharacterStopIndex
  );
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const setCharacterStop = useAtlasStore((s) => s.setCharacterStop);
  const exitCharacterOdyssey = useAtlasStore((s) => s.exitCharacterOdyssey);
  const theme = useAtlasStore((s) => s.theme);

  const character = activeCharacterId
    ? CHARACTER_MAP[activeCharacterId] ?? null
    : null;

  useEffect(() => {
    setAutoPlay(false);
  }, [activeCharacterId]);

  useEffect(() => {
    if (!autoPlay || !character) return;
    const timer = window.setTimeout(() => {
      if (activeCharacterStopIndex < character.stops.length - 1) {
        setCharacterStop(activeCharacterStopIndex + 1);
      } else {
        setAutoPlay(false);
      }
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [autoPlay, activeCharacterStopIndex, character, setCharacterStop]);

  if (!character || activeCampaignId) return null;

  const stop =
    character.stops[activeCharacterStopIndex] ?? character.stops[0];
  const isDark = theme === 'xuanmo';

  return (
    <section
      aria-label="风云人物一生足迹巡礼面板"
      className={`fixed bottom-2.5 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-20px)] max-w-2xl rounded-2xl border shadow-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 ${
        isDark
          ? 'bg-[#0D131D]/98 border-amber-500/40 text-amber-50'
          : 'bg-[#FAF5E8]/98 border-amber-900/30 text-stone-900'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-current/12 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="px-2 py-0.5 rounded-md text-amber-50 text-[11px] font-serif font-bold flex items-center gap-1 shrink-0"
            style={{ backgroundColor: character.color }}
          >
            <Footprints className="w-3 h-3" />
            <span>人物足迹</span>
          </span>
          <h3 className="font-serif font-bold text-sm sm:text-base truncate">
            {character.name}
          </h3>
          <span className="text-xs opacity-75 hidden sm:inline truncate">
            {character.courtesyOrTitle}（{character.lifespan} · {character.volumeSpan}）
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (
                !autoPlay &&
                activeCharacterStopIndex >= character.stops.length - 1
              ) {
                setCharacterStop(0);
              }
              setAutoPlay((v) => !v);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#9E2318] hover:bg-[#821B12] text-amber-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            {autoPlay ? (
              <>
                <Pause className="w-3 h-3" />
                <span>暂停巡礼</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>自动巡礼</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={exitCharacterOdyssey}
            className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"
            title="退出人物足迹模式"
          >
            <X className="w-4 h-4 opacity-75" />
          </button>
        </div>
      </div>

      {/* Quote */}
      <p className="mt-1.5 text-[11px] italic opacity-80 line-clamp-1">
        “{character.quote}”
      </p>

      {/* Numbered Life Stops Pill Strip */}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {character.stops.map((st, idx) => {
          const isCurrent = idx === activeCharacterStopIndex;
          return (
            <button
              key={st.step}
              type="button"
              onClick={() => {
                setAutoPlay(false);
                setCharacterStop(idx);
              }}
              className={`px-2 py-1 rounded-lg border text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                isCurrent
                  ? 'bg-[#B83B2A] text-amber-50 border-amber-300 font-bold shadow-xs'
                  : 'border-current/15 bg-current/5 hover:bg-current/12 opacity-85'
              }`}
            >
              <span>{CIRCLED_NUMS[idx] ?? idx + 1}</span>
              <span className="tabular-nums">{st.year}年</span>
              <span className="font-serif">{st.placeName.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Active Stop Narrative */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-serif font-bold text-xs sm:text-sm text-[#B83B2A] dark:text-amber-300">
            第 {stop.step} / {character.stops.length} 站 · {stop.year}年 ·{' '}
            {stop.placeName} — {stop.title}
          </div>
          <p className="text-xs opacity-85 leading-relaxed mt-0.5 line-clamp-2">
            {stop.caption}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={activeCharacterStopIndex <= 0}
            onClick={() => {
              setAutoPlay(false);
              setCharacterStop(activeCharacterStopIndex - 1);
            }}
            className="p-1.5 rounded-lg border border-current/20 hover:bg-current/10 disabled:opacity-35 cursor-pointer"
            title="上一站人生足迹"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={activeCharacterStopIndex >= character.stops.length - 1}
            onClick={() => {
              setAutoPlay(false);
              setCharacterStop(activeCharacterStopIndex + 1);
            }}
            className="p-1.5 rounded-lg border border-current/20 hover:bg-current/10 disabled:opacity-35 cursor-pointer"
            title="下一站人生足迹"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

const CharacterOdysseyPlayer = React.memo(CharacterOdysseyPlayerInner);
export default CharacterOdysseyPlayer;
