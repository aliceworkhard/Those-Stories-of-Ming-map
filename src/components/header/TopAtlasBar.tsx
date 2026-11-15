'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Compass,
  Eye,
  EyeOff,
  Gauge,
  Layers,
  Moon,
  Mountain,
  Pause,
  Star,
  Swords,
  Sun,
  Video,
  X,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ALL_CAMPAIGNS, getSnapshotForYear } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';
import type { PerformanceMode, PlaceNameMode } from '@/types/ming';

const STAR_CACHE_KEY = 'ming_atlas_gh_stars_v1';

export default function TopAtlasBar() {
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);

  const currentYear = useAtlasStore((s) => s.currentYear);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const isImmersionMode = useAtlasStore((s) => s.isImmersionMode);
  const toggleImmersionMode = useAtlasStore((s) => s.toggleImmersionMode);
  const startStoryTour = useAtlasStore((s) => s.startStoryTour);
  const stopStoryTour = useAtlasStore((s) => s.stopStoryTour);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const setTocModalOpen = useAtlasStore((s) => s.setTocModalOpen);
  const theme = useAtlasStore((s) => s.theme);
  const setTheme = useAtlasStore((s) => s.setTheme);
  const perfMode = useAtlasStore((s) => s.perfMode);
  const setPerfMode = useAtlasStore((s) => s.setPerfMode);
  const is3D = useAtlasStore((s) => s.is3D);
  const toggle3D = useAtlasStore((s) => s.toggle3D);
  const placeNameMode = useAtlasStore((s) => s.placeNameMode);
  const setPlaceNameMode = useAtlasStore((s) => s.setPlaceNameMode);
  const layers = useAtlasStore((s) => s.layers);
  const toggleLayer = useAtlasStore((s) => s.toggleLayer);

  // Fetch GitHub repo star count once per browser session (graceful silent fallback)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = window.sessionStorage.getItem(STAR_CACHE_KEY);
      if (cached !== null) {
        const num = Number(cached);
        if (!Number.isNaN(num)) setStarCount(num);
        return;
      }
    } catch {
      // ignore
    }

    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${SITE_CONFIG.repoSlug}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { stargazers_count?: unknown } | null) => {
        if (data && typeof data.stargazers_count === 'number') {
          setStarCount(data.stargazers_count);
          try {
            window.sessionStorage.setItem(
              STAR_CACHE_KEY,
              String(data.stargazers_count)
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Offline / rate-limited -> keep clean "★ Star" badge with zero console noise
      });

    return () => controller.abort();
  }, []);

  const snapshot = getSnapshotForYear(currentYear);
  const activeCampaign = ALL_CAMPAIGNS.find((c) => c.id === activeCampaignId);
  const isDark = theme === 'xuanmo';

  // Opaque classical Xuan-paper / Obsidian surface (0 GPU-heavy backdrop-blur!)
  const panelClass = isDark
    ? 'bg-[#0D131D]/97 border-amber-500/30 text-amber-50'
    : 'bg-[#FAF5E8]/97 border-amber-900/25 text-stone-900';

  const cyclePerfMode = () => {
    const order: PerformanceMode[] = ['balanced', 'eco', 'ultra'];
    const next = order[(order.indexOf(perfMode) + 1) % order.length];
    setPerfMode(next);
  };

  const perfLabel =
    perfMode === 'eco' ? '省电' : perfMode === 'ultra' ? '极致' : '均衡';

  return (
    <header className="pointer-events-none fixed top-2.5 left-3 right-3 z-30 flex items-center justify-between gap-2">
      {/* Left Unified Command Pill */}
      <div
        className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-lg min-w-0 ${panelClass}`}
      >
        {/* Classical Vermilion Seal */}
        <div className="w-7 h-7 rounded-md bg-[#9E2318] border border-amber-300/80 shadow-inner flex items-center justify-center shrink-0">
          <span className="font-serif font-bold text-amber-100 text-xs leading-none">
            明舆
          </span>
        </div>

        <div className="min-w-0 mr-0.5">
          <div className="flex items-center gap-1.5">
            <h1 className="font-serif font-bold text-sm sm:text-base tracking-wider truncate">
              {SITE_CONFIG.title}
            </h1>
            <span className="px-1.5 py-0.5 rounded bg-[#9E2318]/12 text-[#9E2318] dark:text-amber-300 dark:bg-amber-400/15 border border-current/20 text-[11px] font-bold tabular-nums shrink-0">
              {currentYear}年
            </span>
          </div>
          <p className="text-[10px] opacity-75 truncate hidden 2xl:block max-w-[220px]">
            {snapshot.meta.title}
          </p>
        </div>

        {/* 1. Full-History Auto-Camera Tour CTA (Steady Flight + Victory Paint-Over) */}
        <button
          type="button"
          onClick={() => {
            setCampaignMenuOpen(false);
            if (isStoryTourPlaying) stopStoryTour();
            else startStoryTour();
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition cursor-pointer ${
            isStoryTourPlaying
              ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-300'
              : 'bg-[#A92B1E] hover:bg-[#8E2015] text-amber-50 border border-amber-300/50'
          }`}
          title="按《明朝那些事儿》编年自动巡览各站事件，并演示胜利方版图涂抹演变"
        >
          {isStoryTourPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>停止推演</span>
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5" />
              <span>全史推演</span>
            </>
          )}
        </button>

        {/* 2. Consolidated Campaign Battle Replay Selector */}
        <div className="relative shrink-0">
          {activeCampaign ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCampaignMenuOpen((v) => !v)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-700 text-amber-50 text-xs font-serif font-bold flex items-center gap-1 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">
                  {activeCampaign.title}
                </span>
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>
              <button
                type="button"
                onClick={exitCampaign}
                className="p-1.5 rounded-lg bg-current/10 hover:bg-current/20 cursor-pointer"
                title="退出当前战役推演"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLayerMenuOpen(false);
                setCampaignMenuOpen((v) => !v);
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-serif font-bold flex items-center gap-1 transition cursor-pointer ${
                campaignMenuOpen
                  ? 'border-[#B83B2A] bg-[#B83B2A]/15 text-[#B83B2A] dark:text-amber-300'
                  : isDark
                  ? 'border-amber-400/30 bg-slate-900 hover:bg-slate-800 text-amber-200'
                  : 'border-amber-900/25 bg-amber-950/6 hover:bg-amber-950/12 text-stone-800'
              }`}
              title="选择经典大战开启分步先后行军箭头与胜方版图涂抹推演"
            >
              <Swords className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
              <span>战役推演</span>
              <ChevronDown className="w-3 h-3 opacity-75" />
            </button>
          )}

          {campaignMenuOpen && (
            <div
              className={`absolute left-0 top-full mt-1.5 z-50 w-80 p-2.5 rounded-xl border shadow-2xl text-xs flex flex-col gap-1.5 ${panelClass}`}
            >
              <div className="px-1.5 py-1 font-serif font-bold border-b border-current/12 flex items-center justify-between">
                <span>选择经典战役 · 分步箭头与版图涂抹</span>
                <span className="text-[10px] opacity-65">共 {ALL_CAMPAIGNS.length} 役</span>
              </div>
              {ALL_CAMPAIGNS.map((cmp) => {
                const active = activeCampaignId === cmp.id;
                return (
                  <button
                    key={cmp.id}
                    type="button"
                    onClick={() => {
                      setCampaignMenuOpen(false);
                      if (active) exitCampaign();
                      else startCampaign(cmp.id, 0);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border transition cursor-pointer ${
                      active
                        ? 'bg-[#9E2318] text-amber-50 border-amber-300'
                        : 'border-transparent hover:bg-current/8'
                    }`}
                  >
                    <div className="font-serif font-bold text-xs flex items-center justify-between gap-2">
                      <span>{cmp.title}</span>
                      <span className="text-[10px] tabular-nums opacity-75 shrink-0">
                        {cmp.yearRange[0]}–{cmp.yearRange[1]}
                      </span>
                    </div>
                    <div className="text-[11px] opacity-75 truncate mt-0.5">
                      {cmp.subtitle}（共 {cmp.phases.length} 幕）
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Book 157-Chapter TOC */}
        <button
          type="button"
          onClick={() => setTocModalOpen(true)}
          className={`hidden md:flex px-2.5 py-1.5 rounded-lg border text-xs font-medium items-center gap-1 shrink-0 transition cursor-pointer ${
            isDark
              ? 'border-slate-700 hover:bg-slate-800 text-stone-200'
              : 'border-amber-900/20 hover:bg-amber-950/10 text-stone-800'
          }`}
          title="打开《明朝那些事儿》7部157章原著全目录索引"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">原著目录</span>
        </button>

        {/* 4. GitHub Repo Jump & ★ Star CTA Badge */}
        <a
          href={SITE_CONFIG.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="前往 GitHub 开源仓库并点亮 Star"
          title="前往 GitHub 仓库 aliceworkhard/Those-Stories-of-Ming-map 点亮 ★ Star 支持本项目！"
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
            isDark
              ? 'border-amber-400/45 bg-slate-900 hover:bg-slate-800 text-amber-100'
              : 'border-amber-900/30 bg-[#FFFDF7] hover:bg-amber-50 text-stone-900 shadow-2xs'
          }`}
        >
          {/* GitHub Octocat Mark SVG */}
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="currentColor"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          <span className="hidden sm:inline font-sans">GitHub</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 flex items-center gap-0.5 text-[11px] font-bold">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span>Star</span>
            {starCount !== null && starCount > 0 && (
              <span className="ml-0.5 tabular-nums">{starCount}</span>
            )}
          </span>
        </a>
      </div>

      {/* Right Map Visual & Hardware Controls Pill */}
      <div className="pointer-events-auto relative shrink-0">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shadow-lg ${panelClass}`}
        >
          {/* Pure Map Immersion Mode Toggle */}
          <button
            type="button"
            onClick={toggleImmersionMode}
            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
              isImmersionMode
                ? 'bg-amber-600 text-white font-bold'
                : 'hover:bg-current/10 opacity-85 hover:opacity-100'
            }`}
            title="一键收起/展开左右侧栏，进入纯享全屏观图模式"
          >
            {isImmersionMode ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span className="hidden xl:inline">
              {isImmersionMode ? '退出沉浸' : '沉浸观图'}
            </span>
          </button>

          {/* 3D Mountain Relief Toggle */}
          <button
            type="button"
            onClick={toggle3D}
            disabled={perfMode === 'eco'}
            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-40 ${
              is3D && perfMode !== 'eco'
                ? 'bg-[#9E2318] text-amber-50 font-semibold'
                : 'opacity-75 hover:opacity-100 hover:bg-current/10'
            }`}
            title="切换三维山川地形起伏视角"
          >
            <Mountain className="w-3.5 h-3.5" />
            <span className="hidden md:inline">3D山川</span>
          </button>

          {/* Ancient / Modern Place Name Segmented Switch */}
          <div
            className={`hidden lg:flex items-center rounded-lg p-0.5 border ${
              isDark
                ? 'border-slate-700 bg-slate-900'
                : 'border-amber-900/20 bg-amber-950/6'
            }`}
            role="group"
            aria-label="古今地名显示模式"
          >
            {(
              [
                { id: 'ancient', label: '古称' },
                { id: 'both', label: '双显' },
                { id: 'modern', label: '今名' },
              ] as { id: PlaceNameMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPlaceNameMode(opt.id)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
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

          {/* Hardware Performance Tier Button ("省电 / 均衡 / 极致") */}
          <button
            type="button"
            onClick={cyclePerfMode}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition cursor-pointer ${
              perfMode === 'eco'
                ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-bold'
                : perfMode === 'ultra'
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-900 dark:text-amber-300 font-bold'
                : 'border-current/15 hover:bg-current/10 opacity-85'
            }`}
            title="点击切换硬件渲染负载档位：均衡（推荐）→ 省电轻享（核显/低功耗）→ 极致画质（独显高刷）"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{perfLabel}</span>
          </button>

          {/* Xuanzhi / Xuanmo Theme Switch */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'xuanzhi' : 'xuanmo')}
            className="p-1 rounded-lg hover:bg-current/10 transition cursor-pointer"
            title={
              isDark
                ? '切换为千里江山·宣纸青绿（浅色）主题'
                : '切换为玄墨鎏金·数字沙盘（深色）主题'
            }
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-stone-700" />
            )}
          </button>

          {/* Layer Visibility Popover Button */}
          <button
            type="button"
            onClick={() => {
              setCampaignMenuOpen(false);
              setLayerMenuOpen((v) => !v);
            }}
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
            className={`absolute right-0 top-full mt-1.5 z-50 w-64 p-3 rounded-xl border shadow-2xl text-xs flex flex-col gap-2 ${panelClass}`}
          >
            <div className="font-serif font-bold text-sm border-b border-current/15 pb-1.5 flex items-center justify-between">
              <span>舆图要素图层开关</span>
              <Compass className="w-4 h-4 opacity-60" />
            </div>

            {(
              [
                { key: 'territories', label: '政权疆域与胜方涂抹图层' },
                { key: 'waterways', label: '明代夺淮故黄河 · 大运河 · 水系' },
                { key: 'greatWall', label: '明长城与九边重镇防线' },
                { key: 'landforms', label: '名山脊线 · 湖泊 · 四海古注记' },
                { key: 'places', label: '两京州府与战略关隘地名' },
                { key: 'causalArcs', label: '历史事件跨时空因果飞弧' },
                { key: 'macroEvents', label: '定鼎国运 · 历史大事件印记' },
                {
                  key: 'showAllMicroEvents',
                  label: '全局常显所有历史轶事小标',
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
                  className="accent-[#9E2318] w-4 h-4 rounded cursor-pointer"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
