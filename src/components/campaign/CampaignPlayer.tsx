'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  HelpCircle,
  Maximize2,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Share2,
  Swords,
  Video,
  X,
} from 'lucide-react';
import { ALL_CAMPAIGNS, CAMPAIGN_MAP } from '@/lib/atlasData';
import { subscribePlaybackTick } from '@/lib/playbackBus';
import {
  useAtlasStore,
  type CampaignArrowMode,
  type CampaignCameraMode,
} from '@/store/useAtlasStore';
import type { CampaignRoute } from '@/types/ming';

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

function getTacticLabel(type: CampaignRoute['type']): string {
  switch (type) {
    case 'naval':
      return '水师进击';
    case 'ambush':
      return '奇袭设伏';
    case 'retreat':
      return '败退突围';
    case 'supply':
      return '粮道驰援';
    default:
      return '主力进击';
  }
}

export default function CampaignPlayer() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [unlockedSteps, setUnlockedSteps] = useState(1);

  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const campaignReplayNonce = useAtlasStore((s) => s.campaignReplayNonce);
  const isCampaignPlaying = useAtlasStore((s) => s.isCampaignPlaying);
  const isCampaignPanelOpen = useAtlasStore((s) => s.isCampaignPanelOpen);
  const spotlightRouteId = useAtlasStore((s) => s.spotlightRouteId);
  const campaignSpeed = useAtlasStore((s) => s.campaignSpeed);
  const campaignCameraMode = useAtlasStore((s) => s.campaignCameraMode);
  const campaignArrowMode = useAtlasStore((s) => s.campaignArrowMode);

  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const setCampaignPhase = useAtlasStore((s) => s.setCampaignPhase);
  const nextCampaignPhase = useAtlasStore((s) => s.nextCampaignPhase);
  const prevCampaignPhase = useAtlasStore((s) => s.prevCampaignPhase);
  const setCampaignPlaying = useAtlasStore((s) => s.setCampaignPlaying);
  const setCampaignPanelOpen = useAtlasStore((s) => s.setCampaignPanelOpen);
  const setSpotlightRouteId = useAtlasStore((s) => s.setSpotlightRouteId);
  const focusCampaignRoute = useAtlasStore((s) => s.focusCampaignRoute);
  const setCampaignSpeed = useAtlasStore((s) => s.setCampaignSpeed);
  const setCampaignCameraMode = useAtlasStore((s) => s.setCampaignCameraMode);
  const setCampaignArrowMode = useAtlasStore((s) => s.setCampaignArrowMode);
  const replayCurrentPhase = useAtlasStore((s) => s.replayCurrentPhase);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const setShareModalOpen = useAtlasStore((s) => s.setShareModalOpen);
  const theme = useAtlasStore((s) => s.theme);

  useEffect(() => {
    setUnlockedSteps(campaignArrowMode === 'static' ? 99 : 1);
    if (barRef.current) {
      barRef.current.style.transform = 'scaleX(0)';
    }
  }, [activeCampaignId, activePhaseIndex, campaignReplayNonce, campaignArrowMode]);

  // Direct 60fps GPU `scaleX` progress bar + step unlock (ZERO per-frame React re-renders!)
  useEffect(() => {
    return subscribePlaybackTick((payload) => {
      if (payload.mode !== 'campaign') return;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.max(
          0,
          Math.min(1, payload.percent / 100)
        )})`;
      }
      setUnlockedSteps((prev) =>
        prev === payload.unlockedSteps ? prev : payload.unlockedSteps
      );
    });
  }, []);

  const campaign = activeCampaignId
    ? CAMPAIGN_MAP[activeCampaignId] ?? null
    : null;

  if (!campaign) return null;

  const phase = campaign.phases[activePhaseIndex] ?? campaign.phases[0];
  const isLastPhase = activePhaseIndex >= campaign.phases.length - 1;
  const isDark = theme === 'xuanmo';
  const strength = phase.strengthComparison;

  const leftFaction =
    campaign.factions.find((f) => f.id === strength?.leftFactionId) ??
    campaign.factions[0];
  const rightFaction =
    campaign.factions.find((f) => f.id === strength?.rightFactionId) ??
    campaign.factions[1];

  const factionMap = Object.fromEntries(campaign.factions.map((f) => [f.id, f]));

  const orderedRoutes = [...phase.routes]
    .map((r, idx) => ({ r, sortOrder: r.order ?? idx + 1 }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((x) => x.r);

  const surfaceClass = isDark
    ? 'bg-[#0D131D]/97 border-amber-500/35 text-amber-50'
    : 'bg-[#FAF5E8]/97 border-amber-900/25 text-stone-900';

  return (
    <>
      {/* ===================================================================== */}
      {/* PART A: Right-Side Collapsible War-Room Tactical Drawer (`军情沙盘`)  */}
      {/* ===================================================================== */}
      {!isCampaignPanelOpen ? (
        <div className="hidden sm:flex fixed top-[58px] right-3 z-30 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCampaignPanelOpen(true)}
            className={`px-3 py-2 rounded-xl border shadow-xl flex items-center gap-1.5 text-xs font-serif font-bold cursor-pointer transition hover:scale-105 ${surfaceClass}`}
            title="展开右侧战役军情详笺与分路行军单"
          >
            <PanelRightOpen className="w-4 h-4 text-[#B83B2A] dark:text-amber-400" />
            <span>展开战况详笺</span>
            <span className="px-1.5 py-0.5 rounded bg-[#B83B2A] text-amber-50 text-[10px] tabular-nums">
              {activePhaseIndex + 1}/{campaign.phases.length}幕
            </span>
          </button>
          <button
            type="button"
            onClick={exitCampaign}
            className={`p-2 rounded-xl border shadow-xl hover:opacity-100 opacity-85 cursor-pointer ${surfaceClass}`}
            title="退出战役推演返回全局地图"
            aria-label="退出战役推演"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <aside
          aria-label="战役军情沙盘详笺"
          className={`fixed left-2.5 right-2.5 bottom-[98px] max-h-[46dvh] sm:max-h-none sm:left-auto sm:top-[58px] sm:bottom-[62px] sm:right-3 z-30 sm:w-[336px] xl:w-[356px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${surfaceClass}`}
        >
          {/* Mobile Sheet Handle */}
          <button
            type="button"
            onClick={() => setCampaignPanelOpen(false)}
            className="sm:hidden w-full pt-2 pb-0.5 flex justify-center cursor-pointer shrink-0"
            aria-label="收起战况详笺查看全屏战场地图"
          >
            <span className="w-10 h-1 rounded-full bg-current/25" />
          </button>

          {/* 1. War-Room Drawer Header & 12-Campaign Quick Switcher */}
          <div className="px-3.5 py-2 border-b border-current/12 shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="px-2 py-0.5 rounded bg-[#B83B2A] text-amber-50 text-[11px] font-bold flex items-center gap-1 shrink-0">
                <Swords className="w-3 h-3" />
                战役沙盘
              </span>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-current/8 hover:bg-current/15 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  title="分享当前战役幕次直链与宣纸战报卡"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
                  <span>分享战报</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignPanelOpen(false)}
                  className="px-2.5 py-1 rounded-lg border border-current/20 bg-current/8 hover:bg-current/15 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  title="收起面板以全屏检视战场舆图"
                >
                  <PanelRightClose className="w-3.5 h-3.5 hidden sm:inline" />
                  <X className="w-3.5 h-3.5 sm:hidden" />
                  <span>收起看图</span>
                </button>
                <button
                  type="button"
                  onClick={exitCampaign}
                  className="px-2 py-1 rounded-lg bg-current/10 hover:bg-[#B83B2A] hover:text-amber-50 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                  title="退出战役推演返回全局历史地图"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>退出</span>
                </button>
              </div>
            </div>

            {/* Quick Campaign Selector across all 12 Ming Campaigns */}
            <div>
              <select
                aria-label="切换明代十二大战役"
                value={campaign.id}
                onChange={(e) => startCampaign(e.target.value, 0)}
                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs sm:text-[13px] font-serif font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B83B2A] ${
                  isDark
                    ? 'bg-[#151E2E] border-amber-500/30 text-amber-50'
                    : 'bg-[#F3EBDD] border-amber-900/20 text-stone-900'
                }`}
              >
                {ALL_CAMPAIGNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.yearRange[0]}年 · {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Phase Stepper Strip (`第1幕 .. 第N幕`) */}
            <div
              className="flex items-center gap-1 overflow-x-auto pb-0.5"
              role="tablist"
              aria-label="战役分幕切换"
            >
              {campaign.phases.map((p, idx) => {
                const active = idx === activePhaseIndex;
                return (
                  <button
                    key={p.phaseNo}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCampaignPhase(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      active
                        ? 'bg-[#B83B2A] text-amber-50 shadow ring-1 ring-amber-400/70'
                        : 'bg-current/8 hover:bg-current/16 opacity-75 hover:opacity-100'
                    }`}
                    title={p.title}
                  >
                    第{p.phaseNo}幕
                  </button>
                );
              })}
              <span className="ml-auto text-[11px] opacity-65 whitespace-nowrap pl-1">
                {phase.dateLabel}
              </span>
            </div>
          </div>

          {/* 2. Scrollable War-Room Content Body */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">
            {/* Opposing Factions Seal & Tug-of-War Power Bar */}
            {leftFaction && rightFaction && (
              <div
                className={`p-2.5 rounded-xl border ${
                  isDark
                    ? 'bg-white/[0.03] border-white/10'
                    : 'bg-amber-950/[0.035] border-amber-900/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-md text-white font-serif font-bold text-xs flex items-center justify-center shadow-sm shrink-0"
                      style={{ backgroundColor: leftFaction.color }}
                    >
                      {leftFaction.badgeText}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-xs font-serif font-bold truncate"
                        style={{ color: leftFaction.color }}
                      >
                        {strength?.leftLabel ?? leftFaction.name}
                      </div>
                      <div className="text-[10px] opacity-70 truncate">
                        统帅：{leftFaction.leader}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-serif font-bold px-1.5 py-0.5 rounded bg-current/10 opacity-75 shrink-0">
                    对决
                  </span>

                  <div className="flex items-center gap-1.5 min-w-0 text-right">
                    <div className="min-w-0">
                      <div
                        className="text-xs font-serif font-bold truncate"
                        style={{ color: rightFaction.color }}
                      >
                        {strength?.rightLabel ?? rightFaction.name}
                      </div>
                      <div className="text-[10px] opacity-70 truncate">
                        统帅：{rightFaction.leader}
                      </div>
                    </div>
                    <span
                      className="w-6 h-6 rounded-md text-white font-serif font-bold text-xs flex items-center justify-center shadow-sm shrink-0"
                      style={{ backgroundColor: rightFaction.color }}
                    >
                      {rightFaction.badgeText}
                    </span>
                  </div>
                </div>

                {strength && (
                  <div className="w-full h-2 rounded-full overflow-hidden flex bg-current/15">
                    <div
                      style={{
                        width: `${strength.leftPower}%`,
                        backgroundColor: leftFaction.color,
                      }}
                      className="h-full transition-all duration-500"
                    />
                    <div
                      style={{
                        width: `${strength.rightPower}%`,
                        backgroundColor: rightFaction.color,
                      }}
                      className="h-full transition-all duration-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Phase Title & Detailed Historical Narrative */}
            <div className="space-y-1.5">
              <h2 className="font-serif font-bold text-sm sm:text-[15px] leading-snug text-[#B83B2A] dark:text-amber-300">
                {phase.title}
              </h2>
              <p className="text-xs leading-relaxed opacity-92">
                {phase.narrative}
              </p>
            </div>

            {/* Interactive Sequential Route Cards (`① -> ② -> ③` Hover Spotlight / Click Focus) */}
            {orderedRoutes.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-serif font-bold opacity-80">
                    本幕行军次序（悬停高亮 · 点击定位）
                  </span>
                  {spotlightRouteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSpotlightRouteId(null);
                        setCampaignCameraMode('overview');
                      }}
                      className="text-[10px] text-[#B83B2A] dark:text-amber-400 underline cursor-pointer"
                    >
                      恢复全景
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {orderedRoutes.map((rt, idx) => {
                    const stepNo = idx + 1;
                    const started =
                      campaignArrowMode === 'static' || stepNo <= unlockedSteps;
                    const activeNow =
                      campaignArrowMode === 'dynamic' &&
                      isCampaignPlaying &&
                      stepNo === unlockedSteps;
                    const isSpotlighted = spotlightRouteId === rt.id;
                    const fac = factionMap[rt.factionId];
                    const routeColor =
                      rt.type === 'supply'
                        ? '#D69E2E'
                        : fac?.color ?? '#B83B2A';

                    return (
                      <button
                        key={rt.id}
                        type="button"
                        onMouseEnter={() => setSpotlightRouteId(rt.id)}
                        onMouseLeave={() => setSpotlightRouteId(null)}
                        onClick={() => focusCampaignRoute(rt.id)}
                        className={`w-full text-left p-2 rounded-xl border transition cursor-pointer ${
                          isSpotlighted || activeNow
                            ? isDark
                              ? 'bg-amber-400/15 border-amber-400 shadow-sm'
                              : 'bg-amber-500/12 border-[#B83B2A] shadow-sm'
                            : started
                            ? 'bg-current/[0.03] border-current/15 hover:border-current/35 opacity-95'
                            : 'bg-current/[0.02] border-current/10 opacity-55 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: routeColor }}
                            >
                              {CIRCLED_NUMS[idx] ?? stepNo}{' '}
                              {getTacticLabel(rt.type)}
                            </span>
                            {rt.commander && (
                              <span className="text-[11px] font-serif font-bold truncate">
                                {rt.commander}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] opacity-65 flex items-center gap-0.5 shrink-0">
                            <Crosshair className="w-3 h-3" />
                            定位
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug opacity-90">
                          {rt.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Geo-Strategic "Why" Analysis Card */}
            <div
              className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                isDark
                  ? 'bg-amber-500/10 border-amber-400/30 text-amber-100'
                  : 'bg-amber-900/7 border-amber-900/20 text-stone-800'
              }`}
            >
              <div className="font-serif font-bold flex items-center gap-1 mb-1 text-[#9E2318] dark:text-amber-300">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>本幕胜负手 · 为啥？</span>
              </div>
              <p className="text-[11px] sm:text-xs leading-relaxed">
                {phase.whyKeyPoint}
              </p>
            </div>

            {/* Final Strategic Outcome on Closing Phase (or Full Campaign Summary) */}
            {isLastPhase && campaign.strategicOutcome && (
              <div
                className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                  isDark
                    ? 'bg-[#9E2318]/20 border-red-400/35 text-amber-50'
                    : 'bg-[#9E2318]/8 border-[#9E2318]/25 text-stone-900'
                }`}
              >
                <div className="font-serif font-bold flex items-center gap-1 mb-1 text-[#9E2318] dark:text-amber-300">
                  <ScrollText className="w-3.5 h-3.5 shrink-0" />
                  <span>战役历史结局与天下大势</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-92">
                  {campaign.strategicOutcome}
                </p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ===================================================================== */}
      {/* PART B: Compact Floating Bottom-Center Sand-Table Playback Dock       */}
      {/* ===================================================================== */}
      <section
        aria-label="战役推演播控与箭矢模式控制台"
        className={`fixed bottom-2.5 sm:bottom-[62px] left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-20px)] sm:w-auto max-w-[96vw] rounded-2xl border shadow-2xl px-2.5 sm:px-3.5 py-2 overflow-hidden ${surfaceClass}`}
      >
        {/* Live GPU-Composited Phase Progress Ribbon (`scaleX` -> 0 layout reflow!) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-current/10 overflow-hidden">
          <div
            ref={barRef}
            style={{ transform: 'scaleX(0)' }}
            className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-[#9E2318] via-amber-500 to-amber-300"
          />
        </div>

        {/* Mobile (<640px) Phase Caption + War-Room Sheet Toggle + Exit */}
        <div className="sm:hidden flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-current/12 pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-[#B83B2A] text-amber-50 text-[10px] font-bold tabular-nums shrink-0">
              {activePhaseIndex + 1}/{campaign.phases.length}幕
            </span>
            <span className="text-xs font-serif font-bold truncate">
              {phase.title}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCampaignPanelOpen(!isCampaignPanelOpen)}
              className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                isCampaignPanelOpen
                  ? 'bg-[#9E2318] text-amber-50 border-amber-300'
                  : 'border-current/25 bg-current/8'
              }`}
            >
              <ScrollText className="w-3 h-3" />
              <span>{isCampaignPanelOpen ? '收起详笺' : '战况详笺'}</span>
            </button>
            <button
              type="button"
              onClick={exitCampaign}
              className="p-1 rounded-lg bg-current/10 hover:bg-current/20 cursor-pointer"
              aria-label="退出战役推演"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-between gap-1.5 sm:gap-2 flex-wrap pt-0.5">
          {/* Group 1: Phase Step & Play/Pause Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              disabled={activePhaseIndex === 0}
              onClick={() => {
                setCampaignPlaying(false);
                prevCampaignPhase();
              }}
              className="px-2 py-1.5 rounded-lg border border-current/20 text-xs font-medium flex items-center gap-0.5 disabled:opacity-35 hover:bg-current/10 cursor-pointer disabled:cursor-not-allowed"
              title="上一幕"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">上一幕</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isCampaignPlaying && isLastPhase) {
                  setCampaignPhase(0);
                }
                setCampaignPlaying(!isCampaignPlaying);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              {isCampaignPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>暂停</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>推演</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLastPhase}
              onClick={() => {
                setCampaignPlaying(false);
                nextCampaignPhase();
              }}
              className="px-2 py-1.5 rounded-lg border border-current/20 text-xs font-medium flex items-center gap-0.5 disabled:opacity-35 hover:bg-current/10 cursor-pointer disabled:cursor-not-allowed"
              title="下一幕"
            >
              <span className="hidden md:inline">下一幕</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={replayCurrentPhase}
              className="px-2 py-1.5 rounded-lg border border-current/20 text-xs font-medium flex items-center gap-1 hover:bg-current/10 cursor-pointer"
              title="重播本幕分步进军与局部版图变迁"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">重播</span>
            </button>

            <button
              type="button"
              onClick={() => setCampaignSpeed(campaignSpeed === 1 ? 1.5 : 1)}
              className="px-2 py-1.5 rounded-lg border border-current/20 text-xs font-bold tabular-nums hover:bg-current/10 cursor-pointer"
              title="切换战役推演倍速"
            >
              {campaignSpeed}x
            </button>
          </div>

          <span className="hidden sm:inline-block h-4 w-px bg-current/15" />

          {/* Group 2: Static vs Dynamic Arrowhead Toggle ("线不用动，仅箭头沿线移动" vs "静态定格") */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-lg bg-current/8 border border-current/15 text-[11px]"
            role="group"
            aria-label="行军箭矢动态或静态模式"
            title="动态箭矢：路线与终点矛头静止，行军箭徽沿线顺序推进；静态箭矢：路线与箭头全部静态定格"
          >
            <Navigation className="w-3 h-3 ml-1.5 mr-0.5 text-[#B83B2A] dark:text-amber-400 shrink-0" />
            {(
              [
                { id: 'dynamic', label: '动态箭矢' },
                { id: 'static', label: '静态箭矢' },
              ] as { id: CampaignArrowMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCampaignArrowMode(m.id)}
                className={`px-2 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
                  campaignArrowMode === m.id
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Group 3: Sand-Table Camera Framing Mode (`全景沙盘` vs `跟随先锋`) */}
          <div
            className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-current/8 border border-current/15 text-[11px]"
            role="group"
            aria-label="战役沙盘镜头模式"
            title="全景沙盘：自动框选本幕全部战线且镜头保持静止；跟随先锋：镜头平缓跟随当前进军箭头"
          >
            <Video className="w-3 h-3 ml-1.5 mr-0.5 text-[#B83B2A] dark:text-amber-400 shrink-0" />
            {(
              [
                { id: 'overview', label: '全景沙盘' },
                { id: 'follow', label: '跟随先锋' },
              ] as { id: CampaignCameraMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSpotlightRouteId(null);
                  setCampaignCameraMode(m.id);
                }}
                className={`px-2 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
                  campaignCameraMode === m.id
                    ? 'bg-[#B83B2A] text-amber-50 font-bold shadow-xs'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Mobile Re-Fit Full Battlefield Button */}
          <button
            type="button"
            onClick={() => {
              setSpotlightRouteId(null);
              setCampaignCameraMode('overview');
            }}
            className="sm:hidden p-1.5 rounded-lg border border-current/20 hover:bg-current/10 cursor-pointer"
            title="回到本幕全景沙盘视角"
            aria-label="全景沙盘视角"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </>
  );
}
