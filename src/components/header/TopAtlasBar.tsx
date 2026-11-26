'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Brush,
  ChevronDown,
  Compass,
  Eye,
  EyeOff,
  Footprints,
  Gauge,
  Layers,
  ListOrdered,
  MessageSquare,
  Moon,
  Mountain,
  Pause,
  ScrollText,
  Share2,
  Star,
  Swords,
  Sun,
  Tag,
  Video,
  X,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { CURRENT_ATLAS_VERSION } from '@/data/releases';
import {
  ALL_CAMPAIGNS,
  ALL_CHARACTERS,
  ALL_EVENTS,
  getSnapshotForYear,
} from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';
import type { PerformanceMode, PlaceNameMode } from '@/types/ming';

const STAR_CACHE_KEY = 'ming_atlas_gh_stars_v1';

export default function TopAtlasBar() {
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false);
  const [characterMenuOpen, setCharacterMenuOpen] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);

  const currentYear = useAtlasStore((s) => s.currentYear);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const isDirectoryOpen = useAtlasStore((s) => s.isDirectoryOpen);
  const isDrawerOpen = useAtlasStore((s) => s.isDrawerOpen);
  const setDirectoryOpen = useAtlasStore((s) => s.setDirectoryOpen);
  const setDrawerOpen = useAtlasStore((s) => s.setDrawerOpen);
  const isImmersionMode = useAtlasStore((s) => s.isImmersionMode);
  const toggleImmersionMode = useAtlasStore((s) => s.toggleImmersionMode);
  const startStoryTour = useAtlasStore((s) => s.startStoryTour);
  const stopStoryTour = useAtlasStore((s) => s.stopStoryTour);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const startCharacterOdyssey = useAtlasStore((s) => s.startCharacterOdyssey);
  const exitCharacterOdyssey = useAtlasStore((s) => s.exitCharacterOdyssey);
  const setTocModalOpen = useAtlasStore((s) => s.setTocModalOpen);
  const setShareModalOpen = useAtlasStore((s) => s.setShareModalOpen);
  const setReleaseModalOpen = useAtlasStore((s) => s.setReleaseModalOpen);
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

  const closeAllMenus = () => {
    setLayerMenuOpen(false);
    setCampaignMenuOpen(false);
    setCharacterMenuOpen(false);
  };

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
  const activeCharacter = ALL_CHARACTERS.find((c) => c.id === activeCharacterId);
  const isDark = theme === 'xuanmo';
  const anyMenuOpen = layerMenuOpen || campaignMenuOpen || characterMenuOpen;

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
    <>
      {/* Transparent Touch Backdrop to Dismiss Open Popovers Cleanly on Mobile & Desktop */}
      {anyMenuOpen && (
        <div
          className="fixed inset-0 z-35"
          onClick={closeAllMenus}
          aria-hidden="true"
        />
      )}

      <header className="pointer-events-none fixed top-2 left-2.5 right-2.5 sm:top-2.5 sm:left-3 sm:right-3 z-40 flex flex-col gap-1.5">
        {/* ================================================================= */}
        {/* ROW 1: Desktop Full Command Bar / Mobile Brand + Quick Map Tools  */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left Pill: Brand + (Desktop lg+: Mode Selectors & Community Links) */}
          <div
            className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border shadow-lg min-w-0 ${panelClass}`}
          >
            {/* Classical Vermilion Seal */}
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-[#9E2318] border border-amber-300/80 shadow-inner flex items-center justify-center shrink-0">
              <span className="font-serif font-bold text-amber-100 text-[11px] sm:text-xs leading-none">
                明舆
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <h1 className="font-serif font-bold text-xs sm:text-base tracking-wide truncate">
                  {SITE_CONFIG.title}
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-[#9E2318]/12 text-[#9E2318] dark:text-amber-300 dark:bg-amber-400/15 border border-current/20 text-[10px] sm:text-[11px] font-bold tabular-nums shrink-0">
                  {currentYear}年
                </span>
                <button
                  type="button"
                  onClick={() => {
                    closeAllMenus();
                    setReleaseModalOpen(true);
                  }}
                  className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/35 text-[10px] font-mono font-bold shrink-0 cursor-pointer transition"
                  title="查看《明途 · 舆图纪》各版本发布日志与 GitHub Releases"
                >
                  {CURRENT_ATLAS_VERSION}
                </button>
              </div>
              <p className="text-[10px] opacity-75 truncate hidden 2xl:block max-w-[220px]">
                {snapshot.meta.title}
              </p>
            </div>

            {/* Desktop (lg+) Primary Mode Buttons (on <lg, these live unclipped in Row 2!) */}
            <div className="hidden lg:flex items-center gap-2 ml-0.5">
              {/* 1. Full-History Auto-Camera Tour */}
              <button
                type="button"
                onClick={() => {
                  closeAllMenus();
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

              {/* 2. Campaign Battle Replay Selector */}
              <div className="relative shrink-0">
                {activeCampaign ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCharacterMenuOpen(false);
                        setLayerMenuOpen(false);
                        setCampaignMenuOpen((v) => !v);
                      }}
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
                      setCharacterMenuOpen(false);
                      setCampaignMenuOpen((v) => !v);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-serif font-bold flex items-center gap-1 transition cursor-pointer ${
                      campaignMenuOpen
                        ? 'border-[#B83B2A] bg-[#B83B2A]/15 text-[#B83B2A] dark:text-amber-300'
                        : isDark
                        ? 'border-amber-400/30 bg-slate-900 hover:bg-slate-800 text-amber-200'
                        : 'border-amber-900/25 bg-amber-950/6 hover:bg-amber-950/12 text-stone-800'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
                    <span>战役推演</span>
                    <ChevronDown className="w-3 h-3 opacity-75" />
                  </button>
                )}
              </div>

              {/* 2b. Historical Figure Life Odyssey Selector */}
              <div className="relative shrink-0">
                {activeCharacter ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCampaignMenuOpen(false);
                        setLayerMenuOpen(false);
                        setCharacterMenuOpen((v) => !v);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-amber-50 text-xs font-serif font-bold flex items-center gap-1 cursor-pointer"
                      style={{ backgroundColor: activeCharacter.color }}
                    >
                      <Footprints className="w-3.5 h-3.5" />
                      <span>{activeCharacter.name}足迹</span>
                      <ChevronDown className="w-3 h-3 opacity-80" />
                    </button>
                    <button
                      type="button"
                      onClick={exitCharacterOdyssey}
                      className="p-1.5 rounded-lg bg-current/10 hover:bg-current/20 cursor-pointer"
                      title="退出人物一生足迹模式"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCampaignMenuOpen(false);
                      setLayerMenuOpen(false);
                      setCharacterMenuOpen((v) => !v);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-serif font-bold flex items-center gap-1 transition cursor-pointer ${
                      characterMenuOpen
                        ? 'border-[#B83B2A] bg-[#B83B2A]/15 text-[#B83B2A] dark:text-amber-300'
                        : isDark
                        ? 'border-amber-400/30 bg-slate-900 hover:bg-slate-800 text-amber-200'
                        : 'border-amber-900/25 bg-amber-950/6 hover:bg-amber-950/12 text-stone-800'
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
                    <span>人物足迹</span>
                    <ChevronDown className="w-3 h-3 opacity-75" />
                  </button>
                )}
              </div>

              {/* 3. Book 157-Chapter TOC */}
              <button
                type="button"
                onClick={() => {
                  closeAllMenus();
                  setTocModalOpen(true);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 shrink-0 transition cursor-pointer ${
                  isDark
                    ? 'border-slate-700 hover:bg-slate-800 text-stone-200'
                    : 'border-amber-900/20 hover:bg-amber-950/10 text-stone-800'
                }`}
                title="打开《明朝那些事儿》7部157章原著全目录索引"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>原著目录</span>
              </button>

              {/* 3b. Open-Source Territory Painter Studio Entry */}
              <Link
                href="/dev/territory-painter"
                className={`hidden xl:flex px-2.5 py-1.5 rounded-lg border text-xs font-medium items-center gap-1 shrink-0 transition cursor-pointer ${
                  isDark
                    ? 'border-amber-500/35 hover:bg-amber-500/15 text-amber-200'
                    : 'border-amber-900/25 hover:bg-amber-950/10 text-[#9E2318]'
                }`}
                title="打开内置开源制图工具「舆图画笔擦写工坊」"
              >
                <Brush className="w-3.5 h-3.5" />
                <span>擦写工坊</span>
              </Link>

              {/* 3c. Share Current Scene & Xuan-Paper Poster */}
              <button
                type="button"
                onClick={() => {
                  closeAllMenus();
                  setShareModalOpen(true);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer ${
                  isDark
                    ? 'border-amber-400/40 bg-amber-500/12 hover:bg-amber-500/22 text-amber-200'
                    : 'border-[#9E2318]/30 bg-[#9E2318]/8 hover:bg-[#9E2318]/15 text-[#9E2318]'
                }`}
                title="生成当前战局/事件直达链接与宣纸朱印海报"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>分享</span>
              </button>

              {/* 4. GitHub Repo Jump & ★ Star CTA Badge */}
              <a
                href={SITE_CONFIG.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="前往 GitHub 开源仓库并点亮 Star"
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                  isDark
                    ? 'border-amber-400/45 bg-slate-900 hover:bg-slate-800 text-amber-100'
                    : 'border-amber-900/30 bg-[#FFFDF7] hover:bg-amber-50 text-stone-900 shadow-2xs'
                }`}
              >
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
                <span className="font-sans">GitHub</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 flex items-center gap-0.5 text-[11px] font-bold">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>Star</span>
                  {starCount !== null && starCount > 0 && (
                    <span className="ml-0.5 tabular-nums">{starCount}</span>
                  )}
                </span>
              </a>

              {/* 5. LINUX DO Promotion & Discussion Thread Jump Button */}
              <a
                href={SITE_CONFIG.linuxDoTopicUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="前往 LINUX DO 社区专帖参与讨论与反馈"
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                  isDark
                    ? 'border-amber-400/45 bg-slate-900 hover:bg-slate-800 text-amber-200'
                    : 'border-amber-900/30 bg-[#FFFDF7] hover:bg-amber-50 text-stone-900 shadow-2xs'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-sans tracking-tight">LINUX DO</span>
              </a>
            </div>
          </div>

          {/* Right Map Visual & Hardware Controls Pill */}
          <div className="pointer-events-auto relative shrink-0">
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border shadow-lg ${panelClass}`}
            >
              {/* Pure Map Immersion Mode Toggle (Desktop/Tablet) */}
              <button
                type="button"
                onClick={toggleImmersionMode}
                className={`hidden sm:flex px-2 py-1 rounded-lg text-xs font-medium items-center gap-1 transition cursor-pointer ${
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
                className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-40 ${
                  is3D && perfMode !== 'eco'
                    ? 'bg-[#9E2318] text-amber-50 font-semibold'
                    : 'opacity-80 hover:opacity-100 hover:bg-current/10'
                }`}
                title="切换三维山川地形起伏视角"
              >
                <Mountain className="w-3.5 h-3.5" />
                <span className="hidden md:inline">3D山川</span>
              </button>

              {/* Ancient / Modern Place Name Segmented Switch (Desktop) */}
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
                className={`px-1.5 sm:px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition cursor-pointer ${
                  perfMode === 'eco'
                    ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-bold'
                    : perfMode === 'ultra'
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-900 dark:text-amber-300 font-bold'
                    : 'border-current/15 hover:bg-current/10 opacity-85'
                }`}
                title="点击切换硬件渲染负载档位：均衡 → 省电 → 极致"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span className="hidden min-[380px]:inline">{perfLabel}</span>
              </button>

              {/* Xuanzhi / Xuanmo Theme Switch */}
              <button
                type="button"
                onClick={() => setTheme(isDark ? 'xuanzhi' : 'xuanmo')}
                className="p-1 rounded-lg hover:bg-current/10 transition cursor-pointer"
                title={isDark ? '切换为浅色宣纸主题' : '切换为深色玄墨主题'}
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
                  setCharacterMenuOpen(false);
                  setLayerMenuOpen((v) => !v);
                }}
                className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition cursor-pointer ${
                  layerMenuOpen
                    ? 'border-amber-500 bg-amber-500/15'
                    : 'border-transparent hover:bg-current/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>图层</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* ROW 2 (Mobile & Tablet < 1024px): Unclipped Touch Navigation Strip*/}
        {/* ================================================================= */}
        <div className="pointer-events-auto lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* 1. Directory Toggle Pill (Mobile `<640px`) */}
          {!activeCampaign && (
            <button
              type="button"
              onClick={() => {
                closeAllMenus();
                setDirectoryOpen(!isDirectoryOpen);
              }}
              className={`sm:hidden px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${
                isDirectoryOpen
                  ? 'bg-[#9E2318] text-amber-50 border-amber-300'
                  : panelClass
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>{isDirectoryOpen ? '收起目录' : `目录 ${ALL_EVENTS.length}`}</span>
            </button>
          )}

          {/* 2. Event Detail Toggle Pill (Mobile `<640px` — gives an extra 1-tap way to open/close Event Detail!) */}
          {!activeCampaign && (
            <button
              type="button"
              onClick={() => {
                closeAllMenus();
                setDrawerOpen(!isDrawerOpen);
              }}
              className={`sm:hidden px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${
                isDrawerOpen
                  ? 'bg-[#9E2318] text-amber-50 border-amber-300'
                  : panelClass
              }`}
            >
              {isDrawerOpen ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>收起详情</span>
                </>
              ) : (
                <>
                  <ScrollText className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
                  <span>事件详情</span>
                </>
              )}
            </button>
          )}

          {/* 3. Full-History Auto-Camera Tour */}
          <button
            type="button"
            onClick={() => {
              closeAllMenus();
              if (isStoryTourPlaying) stopStoryTour();
              else startStoryTour();
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${
              isStoryTourPlaying
                ? 'bg-amber-600 text-white border-amber-300'
                : 'bg-[#A92B1E] text-amber-50 border-amber-300/60'
            }`}
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

          {/* 4. Campaign Battle Replay Selector */}
          {activeCampaign ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCharacterMenuOpen(false);
                  setLayerMenuOpen(false);
                  setCampaignMenuOpen((v) => !v);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-700 text-amber-50 border border-amber-300 text-xs font-serif font-bold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5" />
                <span className="max-w-[108px] truncate">
                  {activeCampaign.title}
                </span>
                <ChevronDown className="w-3 h-3 opacity-85" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLayerMenuOpen(false);
                setCharacterMenuOpen(false);
                setCampaignMenuOpen((v) => !v);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${
                campaignMenuOpen
                  ? 'bg-[#B83B2A] text-amber-50 border-amber-300'
                  : panelClass
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
              <span>战役推演</span>
              <ChevronDown className="w-3 h-3 opacity-75" />
            </button>
          )}

          {/* 5. Character Life Odyssey Selector */}
          <button
            type="button"
            onClick={() => {
              setCampaignMenuOpen(false);
              setLayerMenuOpen(false);
              setCharacterMenuOpen((v) => !v);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${
              activeCharacter || characterMenuOpen
                ? 'bg-[#9E2318] text-amber-50 border-amber-300'
                : panelClass
            }`}
          >
            <Footprints className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
            <span>
              {activeCharacter ? `${activeCharacter.name}足迹` : '人物足迹'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-75" />
          </button>

          {/* 6. Book 157-Chapter TOC */}
          <button
            type="button"
            onClick={() => {
              closeAllMenus();
              setTocModalOpen(true);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${panelClass}`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
            <span>原著目录</span>
          </button>

          {/* 6b. Share Current Scene & Poster (Mobile/Tablet) */}
          <button
            type="button"
            onClick={() => {
              closeAllMenus();
              setShareModalOpen(true);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${panelClass}`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
            <span>分享海报</span>
          </button>

          {/* 6c. Version Release Notes (Mobile/Tablet) */}
          <button
            type="button"
            onClick={() => {
              closeAllMenus();
              setReleaseModalOpen(true);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-serif font-bold flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer ${panelClass}`}
          >
            <Tag className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
            <span>版本日志</span>
          </button>

          {/* 7. GitHub ★ Star Link */}
          <a
            href={SITE_CONFIG.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 shrink-0 shadow-sm cursor-pointer ${panelClass}`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Star</span>
            {starCount !== null && starCount > 0 && (
              <span className="tabular-nums text-[11px]">{starCount}</span>
            )}
          </a>

          {/* 8. LINUX DO Discussion Thread */}
          <a
            href={SITE_CONFIG.linuxDoTopicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 shrink-0 shadow-sm cursor-pointer ${panelClass}`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>社区讨论</span>
          </a>
        </div>

        {/* ================================================================= */}
        {/* POPOVER MENUS (Viewport-Safe on Mobile + Anchored on Desktop!)    */}
        {/* ================================================================= */}
        {campaignMenuOpen && (
          <div
            className={`pointer-events-auto fixed left-2.5 right-2.5 top-[92px] lg:left-[260px] lg:right-auto lg:top-[52px] lg:w-88 z-50 max-h-[68dvh] overflow-y-auto p-3 rounded-2xl border shadow-2xl text-xs flex flex-col gap-1.5 ${panelClass}`}
          >
            <div className="px-1.5 py-1 font-serif font-bold border-b border-current/12 flex items-center justify-between">
              <span>选择经典战役 · 分步箭头与局部版图推演</span>
              <button
                type="button"
                onClick={() => setCampaignMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"
                aria-label="关闭战役列表"
              >
                <X className="w-4 h-4" />
              </button>
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
                  className={`w-full text-left px-2.5 py-2 rounded-xl border transition cursor-pointer ${
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

        {characterMenuOpen && (
          <div
            className={`pointer-events-auto fixed left-2.5 right-2.5 top-[92px] lg:left-[360px] lg:right-auto lg:top-[52px] lg:w-84 z-50 max-h-[68dvh] overflow-y-auto p-3 rounded-2xl border shadow-2xl text-xs flex flex-col gap-1.5 ${panelClass}`}
          >
            <div className="px-1.5 py-1 font-serif font-bold border-b border-current/12 flex items-center justify-between">
              <span>风云人物一生足迹巡礼（共 {ALL_CHARACTERS.length} 位）</span>
              <button
                type="button"
                onClick={() => setCharacterMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"
                aria-label="关闭人物列表"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {ALL_CHARACTERS.map((ch) => {
              const active = activeCharacterId === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setCharacterMenuOpen(false);
                    if (active) exitCharacterOdyssey();
                    else startCharacterOdyssey(ch.id, 0);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl border transition cursor-pointer ${
                    active
                      ? 'bg-[#9E2318] text-amber-50 border-amber-300'
                      : 'border-transparent hover:bg-current/8'
                  }`}
                >
                  <div className="font-serif font-bold text-xs flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: ch.color }}
                      />
                      <span>{ch.name}</span>
                      <span className="text-[10px] font-sans font-normal opacity-75">
                        ({ch.volumeSpan})
                      </span>
                    </span>
                    <span className="text-[10px] tabular-nums opacity-75 shrink-0">
                      {ch.lifespan}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75 truncate mt-0.5">
                    {ch.courtesyOrTitle} · 共 {ch.stops.length} 站足迹
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {layerMenuOpen && (
          <div
            className={`pointer-events-auto fixed left-2.5 right-2.5 top-[92px] sm:left-auto sm:right-3 sm:top-[52px] sm:w-76 z-50 max-h-[72dvh] overflow-y-auto p-3 rounded-2xl border shadow-2xl text-xs flex flex-col gap-2 ${panelClass}`}
          >
            <div className="font-serif font-bold text-sm border-b border-current/15 pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-[#B83B2A] dark:text-amber-400" />
                <span>舆图要素与地名设置</span>
              </span>
              <button
                type="button"
                onClick={() => setLayerMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"
                aria-label="关闭图层面板"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile / Tablet Place Name Mode Selector inside Layer Menu */}
            <div className="lg:hidden flex items-center justify-between gap-2 pb-2 border-b border-current/12">
              <span className="opacity-90 font-medium">古今地名显示</span>
              <div className="flex items-center rounded-lg p-0.5 border border-current/20 bg-current/5">
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
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      placeNameMode === opt.id
                        ? 'bg-[#B83B2A] text-amber-50 font-bold'
                        : 'opacity-75'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {(
              [
                { key: 'territories', label: '政权疆域与胜方涂抹图层' },
                { key: 'waterways', label: '明代夺淮故黄河 · 大运河 · 水系' },
                { key: 'greatWall', label: '明长城与九边重镇防线' },
                { key: 'princelyFiefs', label: '洪武分封藩王与九边塞王封藩印' },
                { key: 'nineGarrisons', label: '明代九边重镇防区与军饷制度层' },
                { key: 'landforms', label: '名山脊线 · 湖泊 · 四海古注记' },
                { key: 'places', label: '两京州府与战略关隘地名' },
                { key: 'causalArcs', label: '历史事件跨时空因果飞弧' },
                { key: 'macroEvents', label: '定鼎国运 · 历史大事件印记' },
                {
                  key: 'showAllMicroEvents',
                  label: '全局常显全史所有大小事件印记',
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
      </header>
    </>
  );
}
