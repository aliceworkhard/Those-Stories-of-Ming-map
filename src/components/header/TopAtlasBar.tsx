'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Layers,
  Moon,
  Mountain,
  Pause,
  Swords,
  Sun,
  Video,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ALL_CAMPAIGNS, getSnapshotForYear } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';
import type { PlaceNameMode } from '@/types/ming';

export default function TopAtlasBar() {
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  const currentYear = useAtlasStore((s) => s.currentYear);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const startStoryTour = useAtlasStore((s) => s.startStoryTour);
  const stopStoryTour = useAtlasStore((s) => s.stopStoryTour);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const setTocModalOpen = useAtlasStore((s) => s.setTocModalOpen);
  const theme = useAtlasStore((s) => s.theme);
  const setTheme = useAtlasStore((s) => s.setTheme);
  const is3D = useAtlasStore((s) => s.is3D);
  const toggle3D = useAtlasStore((s) => s.toggle3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const setPlaceNameMode = useAtlasStore((s) => s.setPlaceNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const toggleLayer = useAtlasStore((s) => s.toggleLayer);

  const snapshot = getSnapshotForYear(currentYear);
  const isDark = theme === 'xuanmo';

  const panelClass = isDark
    ? 'bg-slate-950/90 border-amber-500/25 text-amber-50'
    : 'bg-[#FAF5E8]/94 border-amber-900/20 text-stone-900';

  return (
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-30 px-3 pt-2.5 flex flex-col gap-1.5">
      {/* Row 1: Brand + Auto-Camera Tour CTA (Left) | Map Controls + Layer Popover (Right) */}
      <div className="flex items-center justify-between gap-2 w-full">
        <div
          className={`pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-xl border shadow-lg backdrop-blur-md min-w-0 ${panelClass}`}
        >
          {/* Classical Vermilion Seal */}
          <div className="w-8 h-8 rounded-lg bg-[#A92B1E] border border-amber-300/80 shadow-inner flex items-center justify-center shrink-0">
            <span className="font-serif font-bold text-amber-100 text-xs leading-none tracking-tighter">
              明舆
            </span>
          </div>

          <div className="min-w-0 mr-0.5">
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-sm sm:text-base tracking-wider truncate">
                {SITE_CONFIG.title}
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-red-800/15 text-red-800 dark:text-amber-300 dark:bg-amber-400/15 border border-current/20 text-[11px] font-bold tabular-nums shrink-0">
                公元 {currentYear} 年
              </span>
            </div>
            <p className="text-[10px] opacity-80 truncate hidden sm:block">
              {snapshot.meta.title}
            </p>
          </div>

          {/* Primary Prominent CTA: 3D Auto-Camera Chronological Tour ("运镜推演") */}
          <button
            type="button"
            onClick={() =>
              isStoryTourPlaying ? stopStoryTour() : startStoryTour()
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition cursor-pointer ${
              isStoryTourPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-300'
                : 'bg-gradient-to-r from-[#A92B1E] to-[#C85A24] hover:brightness-110 text-amber-50 border border-amber-300/60'
            }`}
            title="按历史时间顺序自动开启 3D 镜头巡航与山川环绕推演"
          >
            {isStoryTourPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 animate-pulse" />
                <span>停止运镜推演</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>全史运镜推演</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTocModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 shrink-0 transition cursor-pointer ${
              isDark
                ? 'border-amber-400/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
                : 'border-amber-900/25 bg-amber-900/8 hover:bg-amber-900/15 text-amber-950'
            }`}
            title="打开《明朝那些事儿》7部157章原著全目录索引"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">原著章节目录</span>
            <span className="xl:hidden">原著目录</span>
          </button>
        </div>

        {/* Right Controls Pill */}
        <div className="pointer-events-auto relative shrink-0">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shadow-lg backdrop-blur-md ${panelClass}`}
          >
            <button
              type="button"
              onClick={toggle3D}
              className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                is3D
                  ? 'bg-[#B83B2A] text-amber-50 font-semibold shadow-xs'
                  : 'opacity-75 hover:opacity-100'
              }`}
              title="切换三维山川高程起伏视角"
            >
              <Mountain className="w-3.5 h-3.5" />
              <span className="hidden md:inline">3D山川</span>
            </button>

            <div
              className={`hidden sm:flex items-center rounded-lg p-0.5 border ${
                isDark
                  ? 'border-slate-700 bg-slate-900/80'
                  : 'border-amber-900/20 bg-amber-950/6'
              }`}
              role="group"
              aria-label="古今地名显示模式"
            >
              {(
                [
                  { id: 'ancient', label: '古称' },
                  { id: 'both', label: '古今双显' },
                  { id: 'modern', label: '今名' },
                ] as { id: PlaceNameMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlaceNameMode(opt.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    placeNameMode === opt.id
                      ? isDark
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-stone-800 text-amber-50 font-bold'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setTheme(isDark ? 'xuanzhi' : 'xuanmo')}
              className="p-1 rounded-lg hover:bg-current/10 transition cursor-pointer"
              title={
                isDark
                  ? '切换为丹青宣纸（浅色）主题'
                  : '切换为玄墨鎏金（深色）主题'
              }
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-stone-700" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setLayerMenuOpen((v) => !v)}
              className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition cursor-pointer ${
                layerMenuOpen
                  ? 'border-amber-500 bg-amber-500/15'
                  : 'border-transparent hover:bg-current/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>图层</span>
            </button>
          </div>

          {layerMenuOpen && (
            <div
              className={`absolute right-0 top-full mt-1.5 z-50 w-64 p-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs flex flex-col gap-2 ${panelClass}`}
            >
              <div className="font-serif font-bold text-sm border-b border-current/15 pb-1.5 flex items-center justify-between">
                <span>舆图要素图层开关</span>
                <Compass className="w-4 h-4 opacity-60" />
              </div>

              {(
                [
                  { key: 'territories', label: '政权动态疆域与国号印章' },
                  { key: 'waterways', label: '明代夺淮黄河 · 大运河 · 湖泊' },
                  { key: 'greatWall', label: '明长城与九边防线' },
                  { key: 'places', label: '战略都城与险要关隘地名' },
                  { key: 'macroEvents', label: '定鼎国运 · 历史大事件标' },
                  {
                    key: 'showAllMicroEvents',
                    label: '全局强制浮现所有小事件（轶事）',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 py-0.5 cursor-pointer select-none"
                >
                  <span className="opacity-90">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={layers[item.key]}
                    onChange={() => toggleLayer(item.key)}
                    className="accent-[#B83B2A] w-4 h-4 rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Campaign Battle Replay Bar (Left) | Waterway Legend (Right on xl+) */}
      <div className="flex items-center justify-between gap-2 w-full">
        <div
          className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl border shadow-md backdrop-blur-md overflow-x-auto max-w-full ${panelClass}`}
        >
          <span className="text-[11px] font-serif font-bold flex items-center gap-1 opacity-90 shrink-0 pr-1">
            <Swords className="w-3.5 h-3.5 text-red-700 dark:text-amber-400" />
            战役运镜推演：
          </span>
          {ALL_CAMPAIGNS.map((cmp) => {
            const active = activeCampaignId === cmp.id;
            return (
              <button
                key={cmp.id}
                type="button"
                onClick={() =>
                  active ? exitCampaign() : startCampaign(cmp.id, 0)
                }
                className={`px-2.5 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-[#B83B2A] text-amber-50 shadow font-bold ring-1 ring-amber-300'
                    : isDark
                    ? 'bg-slate-800/80 hover:bg-slate-700 text-stone-200'
                    : 'bg-amber-950/8 hover:bg-amber-950/15 text-stone-800'
                }`}
              >
                {cmp.title}
              </button>
            );
          })}
        </div>

        <div
          className={`pointer-events-auto hidden xl:flex items-center gap-3 px-3 py-1 rounded-lg border text-[11px] shadow-xs backdrop-blur-xs shrink-0 ${panelClass}`}
        >
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#B7791F] inline-block"></span>
            黄河（明代夺淮入海故道）
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#0D9488] border-b border-dashed inline-block"></span>
            京杭大运河
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#5A4A42] inline-block"></span>
            明长城九边
          </span>
        </div>
      </div>
    </header>
  );
}
