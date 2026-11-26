'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  HelpCircle,
  ListOrdered,
  MapPin,
  Maximize2,
  Minimize2,
  Mountain,
  PanelRightOpen,
  Pause,
  ScrollText,
  Share2,
  Sparkles,
  Swords,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  ALL_EVENTS,
  CAMPAIGN_MAP,
  CHAPTER_MAP,
  EVENT_MAP,
} from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function EventDetailDrawer() {
  const [lensTab, setLensTab] = useState<'mingyue' | 'history'>('mingyue');
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const isDrawerOpen = useAtlasStore((s) => s.isDrawerOpen);
  const isDirectoryOpen = useAtlasStore((s) => s.isDirectoryOpen);
  const setDrawerOpen = useAtlasStore((s) => s.setDrawerOpen);
  const setDirectoryOpen = useAtlasStore((s) => s.setDirectoryOpen);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const stepStoryEvent = useAtlasStore((s) => s.stepStoryEvent);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const hasTourSession = useAtlasStore((s) => s.storyTourProgress > 0);
  const startStoryTour = useAtlasStore((s) => s.startStoryTour);
  const setStoryTourPlaying = useAtlasStore((s) => s.setStoryTourPlaying);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const is3D = useAtlasStore((s) => s.is3D);
  const perfMode = useAtlasStore((s) => s.perfMode);
  const toggle3D = useAtlasStore((s) => s.toggle3D);
  const flyToCamera = useAtlasStore((s) => s.flyToCamera);
  const setShareModalOpen = useAtlasStore((s) => s.setShareModalOpen);
  const theme = useAtlasStore((s) => s.theme);

  // Keep war-room unobstructed while battle campaign player is open
  if (activeCampaignId) return null;

  const isDark = theme === 'xuanmo';
  const isTourHudOpen = isStoryTourPlaying || hasTourSession;
  const event = selectedEventId
    ? EVENT_MAP[selectedEventId] ?? ALL_EVENTS[0]
    : ALL_EVENTS[0];
  const eventIndex = ALL_EVENTS.findIndex((e) => e.id === event.id);
  const linkedCampaign = event?.campaignId
    ? CAMPAIGN_MAP[event.campaignId] ?? null
    : null;

  if (!isDrawerOpen) {
    return (
      <>
        {/* Desktop Top-Right Floating Reopen Pill */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`hidden sm:flex fixed right-3 top-[58px] z-25 px-3 py-2 rounded-xl border shadow-lg items-center gap-1.5 text-xs font-serif font-bold cursor-pointer transition hover:scale-105 ${
            isDark
              ? 'bg-[#0D131D]/97 border-amber-500/30 text-amber-100'
              : 'bg-[#FAF5E8]/97 border-amber-900/25 text-stone-900'
          }`}
          title="展开当前选中事件的五维详情面板"
        >
          <PanelRightOpen className="w-4 h-4 text-[#9E2318] dark:text-amber-400" />
          <span>事件详情</span>
        </button>

        {/* Mobile Compact 1-Line Selected Event Capsule (keeps 90% of phone screen open map!) */}
        {!isDirectoryOpen && !isTourHudOpen && !activeCharacterId && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`sm:hidden fixed bottom-[84px] left-2.5 right-14 z-24 px-3 py-2 rounded-xl border shadow-lg flex items-center justify-between gap-2 text-left cursor-pointer ${
              isDark
                ? 'bg-[#0D131D]/96 border-amber-500/35 text-amber-50'
                : 'bg-[#FAF5E8]/96 border-amber-900/25 text-stone-900'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-[#B83B2A] text-amber-50 text-[10px] font-serif font-bold shrink-0">
                {event.time.year}年
              </span>
              <span className="text-xs font-serif font-bold truncate">
                {event.title}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-current/10 text-[11px] font-semibold flex items-center gap-0.5 shrink-0">
              <span>详情</span>
              <ChevronUp className="w-3 h-3" />
            </span>
          </button>
        )}
      </>
    );
  }

  return (
    <aside
      aria-label="事件五维详情与原著对照面板"
      className={`fixed left-2.5 right-2.5 ${
        isTourHudOpen || activeCharacterId ? 'bottom-[150px]' : 'bottom-[82px]'
      } ${
        mobileExpanded ? 'max-h-[78dvh]' : 'max-h-[50dvh]'
      } sm:max-h-none sm:left-auto sm:top-[58px] ${
        isTourHudOpen ? 'sm:bottom-[164px] 2xl:bottom-16' : 'sm:bottom-16'
      } sm:right-3 z-25 sm:w-[336px] xl:w-[356px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-[max-height] duration-200 ${
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
        aria-label={mobileExpanded ? '切换为半屏看图高度' : '展开更高阅读区域'}
      >
        <span className="w-10 h-1 rounded-full bg-current/25" />
      </button>

      {/* Drawer Header with Unmistakable Close Button */}
      <div className="px-3.5 sm:px-4 py-2 border-b border-current/12 flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
              event.tier === 'macro'
                ? 'bg-[#B83B2A] text-amber-50'
                : 'bg-amber-600 text-white'
            }`}
          >
            {event.tier === 'macro' ? '大事件' : '小事件'}
          </span>
          <span className="text-xs opacity-80 truncate tabular-nums">
            {event.time.display}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Share Current Event Card / Deep-Link */}
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="px-2 py-1 rounded-lg bg-current/8 hover:bg-current/15 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            title="分享当前历史事件直链与宣纸海报"
          >
            <Share2 className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
            <span className="hidden sm:inline">分享</span>
          </button>

          {/* Mobile Quick Switch to Event Directory */}
          <button
            type="button"
            onClick={() => setDirectoryOpen(true)}
            className="sm:hidden px-2 py-1 rounded-lg bg-current/8 hover:bg-current/15 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            title="打开编年事件目录切换其他事件"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>目录</span>
          </button>

          {/* Mobile Half / Full Sheet Height Toggle */}
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="sm:hidden p-1.5 rounded-lg bg-current/8 hover:bg-current/15 cursor-pointer"
            title={mobileExpanded ? '半屏看图' : '展开详情'}
            aria-label={mobileExpanded ? '半屏看图' : '展开详情'}
          >
            {mobileExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Unmistakable High-Contrast Close / Collapse Button (`✕ 收起`) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              isDark
                ? 'border-amber-400/40 bg-amber-400/15 hover:bg-amber-400/25 text-amber-100'
                : 'border-amber-900/25 bg-amber-950/10 hover:bg-amber-950/20 text-stone-900'
            }`}
            title="收起事件详情面板查看地图"
          >
            <X className="w-3.5 h-3.5" />
            <span>收起</span>
          </button>
        </div>
      </div>

      {/* Scrollable Pure Event Detail Body (Separated from Event Directory!) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 1. Event Title, Ancient-Modern Place & Summary */}
        <section className="space-y-2">
          <h2 className="font-serif font-bold text-lg leading-snug">
            {event.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => flyToCamera(event.camera)}
              className={`px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition ${
                isDark
                  ? 'border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200'
                  : 'border-amber-900/20 bg-amber-900/8 hover:bg-amber-900/15 text-amber-950'
              }`}
              title="飞跃定位至该历史地点"
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span>
                {event.location.ancientName} · 今{event.location.modernName}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px] opacity-85">
            <Users className="w-3.5 h-3.5 shrink-0 opacity-70" />
            {event.actors.map((actor) => (
              <span
                key={actor}
                className="px-1.5 py-0.5 rounded bg-current/8 font-medium"
              >
                {actor}
              </span>
            ))}
          </div>

          <p className="text-xs sm:text-[13px] leading-relaxed opacity-92">
            {event.summary}
          </p>

          {/* Linked Multi-Phase Campaign CTA */}
          {linkedCampaign && (
            <button
              type="button"
              onClick={() => startCampaign(linkedCampaign.id, 0)}
              className="w-full mt-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#A92B1E] to-[#C66A27] hover:brightness-110 text-amber-50 font-serif font-bold text-xs sm:text-sm shadow-md flex items-center justify-between cursor-pointer transition"
            >
              <span className="flex items-center gap-2">
                <Swords className="w-4 h-4 shrink-0" />
                <span>启动战役运镜推演：{linkedCampaign.title}</span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </section>

        {/* 2. THE "WHY" ENGINE (为啥会这样？地理地形 + 制度动因 + 前因后果链) */}
        <section
          className={`p-3 rounded-xl border space-y-2.5 ${
            isDark
              ? 'bg-slate-900/80 border-amber-500/25'
              : 'bg-[#F3EBDD]/90 border-amber-900/20'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif font-bold text-sm flex items-center gap-1.5 text-[#B83B2A] dark:text-amber-300">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>历史追问：为啥会这样？</span>
            </h3>

            {(event.why.terrainCamera || event.camera) && (
              <button
                type="button"
                onClick={() => {
                  if (!is3D && perfMode !== 'eco') toggle3D();
                  flyToCamera(event.why.terrainCamera ?? event.camera);
                }}
                className="px-2 py-0.5 rounded-md bg-[#B83B2A]/15 hover:bg-[#B83B2A]/25 text-[#B83B2A] dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
              >
                <Mountain className="w-3 h-3" />
                俯瞰三维险要
              </button>
            )}
          </div>

          <div className="space-y-2 text-xs leading-relaxed">
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">
                【山川地缘锁钥】
              </span>
              <span className="opacity-92">{event.why.geoFactor}</span>
            </div>
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">
                【制度与局势动因】
              </span>
              <span className="opacity-92">{event.why.systemFactor}</span>
            </div>
          </div>

          {/* Causal Upstream / Downstream Links */}
          {(event.why.prevEventIds.length > 0 ||
            event.why.nextEventIds.length > 0) && (
            <div className="pt-2 border-t border-current/12 space-y-1.5">
              <div className="text-[11px] font-semibold opacity-75 flex items-center gap-1">
                <Compass className="w-3 h-3" />
                <span>时空因果链追踪（点击飞跃跳转）：</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {event.why.prevEventIds.map((pid) => {
                  const pe = EVENT_MAP[pid];
                  if (!pe) return null;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => {
                        exitCampaign();
                        selectEvent(pe.id, true);
                      }}
                      className="px-2 py-1 rounded-lg border border-current/20 bg-current/5 hover:bg-current/15 text-[11px] flex items-center gap-1 cursor-pointer transition text-left"
                    >
                      <ArrowLeft className="w-3 h-3 shrink-0 opacity-70" />
                      <span>
                        前因：{pe.time.year} {pe.title.slice(0, 11)}…
                      </span>
                    </button>
                  );
                })}

                {event.why.nextEventIds.map((nid) => {
                  const ne = EVENT_MAP[nid];
                  if (!ne) return null;
                  return (
                    <button
                      key={nid}
                      type="button"
                      onClick={() => {
                        exitCampaign();
                        selectEvent(ne.id, true);
                      }}
                      className="px-2 py-1 rounded-lg border border-[#B83B2A]/40 bg-[#B83B2A]/10 hover:bg-[#B83B2A]/20 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition text-left"
                    >
                      <span>
                        后果：{ne.time.year} {ne.title.slice(0, 11)}…
                      </span>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 3. BOOK NARRATIVE vs POSITIVE HISTORY ("小说是怎么说的 vs 正史考据") */}
        <section
          className={`p-3 rounded-xl border space-y-2.5 ${
            isDark
              ? 'bg-slate-900/75 border-slate-700/80'
              : 'bg-[#FFFDF8]/90 border-amber-900/20'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#B83B2A] dark:text-amber-400" />
              <span>原著视角与史实对照</span>
            </h3>

            <div className="flex rounded-lg p-0.5 bg-current/8 text-[11px]">
              <button
                type="button"
                onClick={() => setLensTab('mingyue')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  lensTab === 'mingyue'
                    ? 'bg-[#B83B2A] text-amber-50 font-bold'
                    : 'opacity-75'
                }`}
              >
                小说怎么说
              </button>
              <button
                type="button"
                onClick={() => setLensTab('history')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  lensTab === 'history'
                    ? 'bg-stone-700 text-amber-50 font-bold'
                    : 'opacity-75'
                }`}
              >
                正史考据
              </button>
            </div>
          </div>

          {/* Chapter Anchor Tags */}
          <div className="flex flex-wrap gap-1">
            {event.bookLens.chapterIds.map((cid) => {
              const ch = CHAPTER_MAP[cid];
              if (!ch) return null;
              return (
                <span
                  key={cid}
                  className="px-2 py-0.5 rounded bg-amber-600/15 text-amber-900 dark:text-amber-200 text-[10px] font-medium"
                >
                  {ch.volumeTitle} · {ch.emperorSection} · {ch.chapterTitle}
                </span>
              );
            })}
          </div>

          {lensTab === 'mingyue' ? (
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-semibold text-[#B83B2A] dark:text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>当年明月叙事解读（原创导读）：</span>
              </div>
              <p className="opacity-92">{event.bookLens.mingyuePerspective}</p>
            </div>
          ) : (
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <ScrollText className="w-3.5 h-3.5" />
                <span>《明史》《明实录》考据补遗：</span>
              </div>
              <p className="opacity-92">{event.bookLens.historicalNote}</p>
            </div>
          )}
        </section>
      </div>

      {/* Dedicated Bottom Stepper + Start Auto-Camera Tour from Here */}
      <div className="px-3.5 py-2.5 border-t border-current/12 flex items-center justify-between gap-1.5 shrink-0 text-xs">
        <button
          type="button"
          disabled={eventIndex <= 0}
          onClick={() => stepStoryEvent(-1)}
          className="px-2 py-1.5 rounded-lg border border-current/20 hover:bg-current/10 disabled:opacity-35 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>上一站</span>
        </button>

        <button
          type="button"
          onClick={() =>
            isStoryTourPlaying
              ? setStoryTourPlaying(false)
              : startStoryTour(event.id)
          }
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition ${
            isStoryTourPlaying
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50'
          }`}
          title="从当前事件开启 3D 全史自动运镜巡礼推演"
        >
          {isStoryTourPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>暂停运镜推演</span>
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5" />
              <span>从此开启运镜推演</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={eventIndex >= ALL_EVENTS.length - 1}
          onClick={() => stepStoryEvent(1)}
          className="px-2 py-1.5 rounded-lg border border-current/20 hover:bg-current/10 disabled:opacity-35 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
        >
          <span>下一站</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
