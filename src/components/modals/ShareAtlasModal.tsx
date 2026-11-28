'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import {
  ALL_EVENTS,
  CAMPAIGN_MAP,
  CHARACTER_MAP,
  EVENT_MAP,
} from '@/lib/atlasData';
import {
  captureMapSnapshotDataUrl,
  renderXuanPaperShareCard,
  type SharePosterPayload,
} from '@/lib/mapCapture';
import { buildAtlasShareUrl } from '@/lib/urlState';
import { useAtlasStore } from '@/store/useAtlasStore';

/**
 * Outer guard subscribes ONLY to `isShareModalOpen` so when closed (99% of the time),
 * changing years / clicking events / switching phases triggers ZERO re-renders!
 */
function ShareAtlasModalInner() {
  const setShareModalOpen = useAtlasStore((s) => s.setShareModalOpen);

  const currentYear = useAtlasStore((s) => s.currentYear);
  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const campaignArrowMode = useAtlasStore((s) => s.campaignArrowMode);
  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const activeCharacterStopIndex = useAtlasStore(
    (s) => s.activeCharacterStopIndex
  );
  const theme = useAtlasStore((s) => s.theme);
  const is3D = useAtlasStore((s) => s.is3D);

  const [posterDataUrl, setPosterDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(
    () =>
      buildAtlasShareUrl({
        currentYear,
        selectedEventId,
        activeCampaignId,
        activePhaseIndex,
        campaignArrowMode,
        activeCharacterId,
        activeCharacterStopIndex,
        theme,
        is3D,
      }),
    [
      currentYear,
      selectedEventId,
      activeCampaignId,
      activePhaseIndex,
      campaignArrowMode,
      activeCharacterId,
      activeCharacterStopIndex,
      theme,
      is3D,
    ]
  );

  const posterPayload = useMemo<SharePosterPayload>(() => {
    if (activeCampaignId && CAMPAIGN_MAP[activeCampaignId]) {
      const cmp = CAMPAIGN_MAP[activeCampaignId];
      const phase = cmp.phases[activePhaseIndex] ?? cmp.phases[0];
      return {
        sealText: '战报',
        eraBadge: `${phase.dateLabel} · 第${phase.phaseNo}/${cmp.phases.length}幕`,
        title: `${cmp.title} · ${phase.title}`,
        locationLine: cmp.subtitle,
        summary: phase.narrative,
        whyInsight: phase.whyKeyPoint,
        shareUrl,
        theme,
      };
    }

    if (activeCharacterId && CHARACTER_MAP[activeCharacterId]) {
      const ch = CHARACTER_MAP[activeCharacterId];
      const stop = ch.stops[activeCharacterStopIndex] ?? ch.stops[0];
      return {
        sealText: '行迹',
        eraBadge: `${stop.year}年 · ${ch.name}足迹 第${stop.step}/${ch.stops.length}站`,
        title: `${ch.name} · ${stop.title}`,
        locationLine: `${stop.placeName}（${ch.lifespan}）`,
        summary: stop.caption,
        whyInsight: `“${ch.quote}”`,
        shareUrl,
        theme,
      };
    }

    const evt =
      (selectedEventId ? EVENT_MAP[selectedEventId] : null) ?? ALL_EVENTS[0];
    return {
      sealText: evt.campaignId ? '战史' : '史鉴',
      eraBadge: `${evt.time.year}年 · ${evt.time.reignTitle}`,
      title: evt.title,
      locationLine: `${evt.location.ancientName}（今${evt.location.modernName}）`,
      summary: evt.summary,
      whyInsight: evt.why.geoFactor,
      shareUrl,
      theme,
    };
  }, [
    activeCampaignId,
    activePhaseIndex,
    activeCharacterId,
    activeCharacterStopIndex,
    selectedEventId,
    shareUrl,
    theme,
  ]);

  useEffect(() => {
    let cancelled = false;
    setGenerating(true);
    setCopied(false);

    (async () => {
      const mapSnap = await captureMapSnapshotDataUrl(650);
      const cardPng = await renderXuanPaperShareCard(posterPayload, mapSnap);
      if (!cancelled) {
        setPosterDataUrl(cardPng);
        setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [posterPayload]);

  const isDark = theme === 'xuanmo';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback selection copy
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleDownloadPoster = () => {
    if (!posterDataUrl) return;
    const a = document.createElement('a');
    a.href = posterDataUrl;
    a.download = `ming-atlas-${currentYear}.png`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4"
      onClick={() => setShareModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90dvh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-[#0D131D] border-amber-500/35 text-amber-50'
            : 'bg-[#FAF5E8] border-amber-900/25 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-current/12 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#B83B2A] dark:text-amber-400" />
            <h2 className="font-serif font-bold text-sm sm:text-base">
              分享当前战局直链与宣纸朱印战报卡
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShareModalOpen(false)}
            className="px-2 py-1 rounded-lg hover:bg-current/10 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>关闭</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* 1. Deep-Link URL Box */}
          <div className="space-y-1.5">
            <div className="text-xs font-serif font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
              <span>精准现场直达链接（对方点开直接进入当前年份 / 战役幕次 / 人物站次）</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="当前历史现场直达链接"
                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono truncate focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-amber-100'
                    : 'bg-[#FFFDF8] border-amber-900/20 text-stone-800'
                }`}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow cursor-pointer transition ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>已复制直链</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制直链</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Poster Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-serif font-bold opacity-85">
                宣纸朱印高清分享海报预览（1200 × 720 PNG）
              </span>
              <button
                type="button"
                disabled={!posterDataUrl || generating}
                onClick={handleDownloadPoster}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载高清海报 PNG</span>
              </button>
            </div>

            <div className="rounded-xl border border-current/15 overflow-hidden bg-black/10 aspect-[1200/720] flex items-center justify-center">
              {generating || !posterDataUrl ? (
                <span className="text-xs font-serif opacity-75">
                  正在拓印当前三维舆图与朱砂印鉴……
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={posterDataUrl}
                  alt="明途舆图纪宣纸战报海报预览"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>

          {/* 3. Subtle Open-Source Star & Community Support Footer */}
          <div className="pt-2.5 border-t border-current/12 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="opacity-80">
              喜欢《{SITE_CONFIG.title}》？欢迎点亮 Star 或推荐给《明朝那些事儿》同好书友
            </span>
            <a
              href={SITE_CONFIG.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                isDark
                  ? 'border-amber-400/45 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
                  : 'border-amber-900/25 bg-amber-500/12 hover:bg-amber-500/22 text-amber-950'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>点亮 GitHub Star</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const ShareAtlasModal = React.memo(function ShareAtlasModal() {
  const isOpen = useAtlasStore((s) => s.isShareModalOpen);
  if (!isOpen) return null;
  return <ShareAtlasModalInner />;
});

export default ShareAtlasModal;
