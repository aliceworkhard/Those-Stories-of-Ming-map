'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Swords,
  Video,
  X,
} from 'lucide-react';
import { CAMPAIGN_MAP } from '@/lib/atlasData';
import { subscribePlaybackTick } from '@/lib/playbackBus';
import {
  useAtlasStore,
  type CampaignCameraMode,
} from '@/store/useAtlasStore';

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

export default function CampaignPlayer() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [unlockedSteps, setUnlockedSteps] = useState(1);

  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const campaignReplayNonce = useAtlasStore((s) => s.campaignReplayNonce);
  const isCampaignPlaying = useAtlasStore((s) => s.isCampaignPlaying);
  const campaignSpeed = useAtlasStore((s) => s.campaignSpeed);
  const campaignCameraMode = useAtlasStore((s) => s.campaignCameraMode);
  const setCampaignPhase = useAtlasStore((s) => s.setCampaignPhase);
  const nextCampaignPhase = useAtlasStore((s) => s.nextCampaignPhase);
  const prevCampaignPhase = useAtlasStore((s) => s.prevCampaignPhase);
  const setCampaignPlaying = useAtlasStore((s) => s.setCampaignPlaying);
  const setCampaignSpeed = useAtlasStore((s) => s.setCampaignSpeed);
  const setCampaignCameraMode = useAtlasStore((s) => s.setCampaignCameraMode);
  const replayCurrentPhase = useAtlasStore((s) => s.replayCurrentPhase);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const theme = useAtlasStore((s) => s.theme);

  useEffect(() => {
    setUnlockedSteps(1);
    if (barRef.current) {
      barRef.current.style.transform = 'scaleX(0)';
    }
  }, [activeCampaignId, activePhaseIndex, campaignReplayNonce]);

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
  const isDark = theme === 'xuanmo';
  const strength = phase.strengthComparison;

  const leftFaction = campaign.factions.find(
    (f) => f.id === strength?.leftFactionId
  );
  const rightFaction = campaign.factions.find(
    (f) => f.id === strength?.rightFactionId
  );

  const factionColorMap: Record<string, string> = Object.fromEntries(
    campaign.factions.map((f) => [f.id, f.color])
  );

  const orderedRoutes = [...phase.routes]
    .map((r, idx) => ({ r, sortOrder: r.order ?? idx + 1 }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((x) => x.r);

  return (
    <section
      aria-label="战役分幕行军推演控制台"
      className={`fixed bottom-16 left-3 right-3 lg:left-6 lg:right-16 z-30 max-w-5xl rounded-2xl border shadow-2xl p-3.5 sm:p-4 overflow-hidden ${
        isDark
          ? 'bg-[#0D131D]/98 border-amber-500/35 text-amber-50'
          : 'bg-[#FAF5E8]/98 border-amber-900/25 text-stone-900'
      }`}
    >
      {/* Live GPU-Composited Phase Progress Ribbon (`scaleX` -> 0 layout reflow!) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-current/10 overflow-hidden">
        <div
          ref={barRef}
          style={{ transform: 'scaleX(0)' }}
          className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-[#9E2318] via-amber-500 to-amber-300"
        />
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-current/12 pb-2.5 pt-0.5">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-[#B83B2A] text-amber-50 text-[11px] font-bold flex items-center gap-1 shrink-0">
            <Swords className="w-3 h-3" />
            分幕推演
          </span>
          <h2 className="font-serif font-bold text-sm sm:text-base truncate">
            {campaign.title}
          </h2>
          <span className="text-xs opacity-70 hidden sm:inline">
            （{phase.dateLabel}）
          </span>

          <div
            className="flex items-center gap-0.5 p-0.5 rounded-lg bg-current/8 border border-current/12 text-[11px]"
            role="group"
            aria-label="战役镜头视角模式"
          >
            <Video className="w-3 h-3 ml-1.5 mr-0.5 text-[#B83B2A] dark:text-amber-400 shrink-0" />
            {(
              [
                { id: 'follow', label: '跟随进军' },
                { id: 'free', label: '自由视角' },
              ] as { id: CampaignCameraMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCampaignCameraMode(m.id)}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  campaignCameraMode === m.id
                    ? 'bg-[#B83B2A] text-amber-50 font-bold'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {campaign.phases.map((p, idx) => (
            <button
              key={p.phaseNo}
              type="button"
              onClick={() => setCampaignPhase(idx)}
              className={`w-6 h-6 rounded-full text-xs font-bold tabular-nums transition cursor-pointer ${
                idx === activePhaseIndex
                  ? 'bg-[#B83B2A] text-amber-50 ring-2 ring-amber-400 scale-105'
                  : 'bg-current/10 hover:bg-current/20 opacity-75'
              }`}
              title={p.title}
            >
              {p.phaseNo}
            </button>
          ))}

          <button
            type="button"
            onClick={exitCampaign}
            className="ml-2 px-2 py-1 rounded-lg bg-current/10 hover:bg-current/20 text-xs flex items-center gap-1 cursor-pointer"
            title="退出战役推演返回全局地图"
          >
            <X className="w-3.5 h-3.5" />
            <span>退出</span>
          </button>
        </div>
      </div>

      {/* Middle: Phase Title, Narrative, Sequential Arrow Step Bar (`① -> ② -> ③`) & "WHY Key Point" */}
      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        <div className="md:col-span-7 space-y-2">
          <div className="font-serif font-bold text-sm sm:text-base text-[#B83B2A] dark:text-amber-300">
            {phase.title}
          </div>
          <p className="text-xs leading-relaxed opacity-90">{phase.narrative}</p>

          {orderedRoutes.length > 0 && (
            <div className="pt-1 flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="font-serif font-bold opacity-70 shrink-0">
                箭矢先后次序：
              </span>
              {orderedRoutes.map((rt, idx) => {
                const stepNo = idx + 1;
                const started = stepNo <= unlockedSteps;
                const activeNow = isCampaignPlaying && stepNo === unlockedSteps;
                const c =
                  rt.type === 'supply'
                    ? '#D69E2E'
                    : factionColorMap[rt.factionId] ?? '#B83B2A';

                return (
                  <React.Fragment key={rt.id}>
                    {idx > 0 && (
                      <ArrowRight className="w-3 h-3 opacity-45 shrink-0" />
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full border flex items-center gap-1 transition-opacity ${
                        activeNow
                          ? 'ring-2 ring-amber-400 font-bold opacity-100'
                          : started
                          ? 'opacity-95 font-medium'
                          : 'opacity-45'
                      }`}
                      style={{ borderColor: c }}
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: c }}
                      />
                      <span>
                        {CIRCLED_NUMS[idx] ?? stepNo} {rt.label}
                      </span>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={`md:col-span-5 p-2.5 rounded-xl border text-xs leading-relaxed ${
            isDark
              ? 'bg-amber-500/10 border-amber-400/30 text-amber-100'
              : 'bg-amber-900/7 border-amber-900/20 text-stone-800'
          }`}
        >
          <div className="font-serif font-bold flex items-center gap-1 mb-1 text-amber-800 dark:text-amber-300">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>本幕胜负手 · 为啥？</span>
          </div>
          <p className="text-[11px] sm:text-xs leading-relaxed">
            {phase.whyKeyPoint}
          </p>
        </div>
      </div>

      {/* Bottom: Faction Strength Bar + Playback & Speed Controls */}
      <div className="mt-3 pt-2 border-t border-current/10 flex flex-wrap items-center justify-between gap-3">
        {strength && (
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-[11px] font-medium mb-1">
              <span style={{ color: leftFaction?.color }}>
                ● {strength.leftLabel}
              </span>
              <span style={{ color: rightFaction?.color }}>
                {strength.rightLabel} ●
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-current/15">
              <div
                style={{
                  width: `${strength.leftPower}%`,
                  backgroundColor: leftFaction?.color ?? '#B83B2A',
                }}
                className="h-full transition-all duration-500"
              />
              <div
                style={{
                  width: `${strength.rightPower}%`,
                  backgroundColor: rightFaction?.color ?? '#1E5F74',
                }}
                className="h-full transition-all duration-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => setCampaignSpeed(campaignSpeed === 1 ? 1.5 : 1)}
            className="px-2 py-1.5 rounded-lg border border-current/20 text-xs font-bold tabular-nums hover:bg-current/10 cursor-pointer"
            title="切换推演倍速"
          >
            {campaignSpeed}x
          </button>

          <button
            type="button"
            onClick={replayCurrentPhase}
            className="px-2 py-1.5 rounded-lg border border-current/20 text-xs font-medium flex items-center gap-1 hover:bg-current/10 cursor-pointer"
            title="重播本幕分步进军与版图涂抹"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">重播本幕</span>
          </button>

          <button
            type="button"
            disabled={activePhaseIndex === 0}
            onClick={() => {
              setCampaignPlaying(false);
              prevCampaignPhase();
            }}
            className="px-2.5 py-1.5 rounded-lg border border-current/20 text-xs font-medium flex items-center gap-1 disabled:opacity-35 hover:bg-current/10 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            上一幕
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                !isCampaignPlaying &&
                activePhaseIndex >= campaign.phases.length - 1
              ) {
                setCampaignPhase(0);
              }
              setCampaignPlaying(!isCampaignPlaying);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
          >
            {isCampaignPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                暂停推演
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                继续推演
              </>
            )}
          </button>

          <button
            type="button"
            disabled={activePhaseIndex >= campaign.phases.length - 1}
            onClick={() => {
              setCampaignPlaying(false);
              nextCampaignPhase();
            }}
            className="px-2.5 py-1.5 rounded-lg border border-current/20 text-xs font-medium flex items-center gap-1 disabled:opacity-35 hover:bg-current/10 cursor-pointer disabled:cursor-not-allowed"
          >
            下一幕
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
