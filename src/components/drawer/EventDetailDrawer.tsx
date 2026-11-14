'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Compass,
  HelpCircle,
  MapPin,
  Mountain,
  PanelRightClose,
  PanelRightOpen,
  ScrollText,
  Sparkles,
  Swords,
  Users,
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
  const [tierFilter, setTierFilter] = useState<'all' | 'macro' | 'micro'>('all');

  const selectedEventId = useAtlasStore((s) => s.selectedEventId);
  const isDrawerOpen = useAtlasStore((s) => s.isDrawerOpen);
  const setDrawerOpen = useAtlasStore((s) => s.setDrawerOpen);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const flyToCamera = useAtlasStore((s) => s.flyToCamera);
  const theme = useAtlasStore((s) => s.theme);

  const isDark = theme === 'xuanmo';
  const event = selectedEventId ? EVENT_MAP[selectedEventId] ?? ALL_EVENTS[0] : ALL_EVENTS[0];
  const linkedCampaign = event?.campaignId
    ? CAMPAIGN_MAP[event.campaignId] ?? null
    : null;

  const filteredEvents = ALL_EVENTS.filter((e) =>
    tierFilter === 'all' ? true : e.tier === tierFilter
  );

  if (!isDrawerOpen) {
    return (
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={`fixed right-3 top-28 z-30 px-3 py-2.5 rounded-xl border shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-serif font-bold cursor-pointer transition hover:scale-105 ${
          isDark
            ? 'bg-slate-950/90 border-amber-500/30 text-amber-100'
            : 'bg-[#FAF5E8]/95 border-amber-900/25 text-stone-900'
        }`}
        title="展开五维历史事件卷轴面板"
      >
        <PanelRightOpen className="w-4 h-4 text-[#B83B2A] dark:text-amber-400" />
        <span>五维史卷</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="五维历史事件与原著视角面板"
      className={`fixed top-28 bottom-20 right-3 z-30 w-[calc(100vw-24px)] sm:w-[388px] rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col overflow-hidden transition-all ${
        isDark
          ? 'bg-slate-950/92 border-amber-500/30 text-amber-50'
          : 'bg-[#FAF5E8]/95 border-amber-900/25 text-stone-900'
      }`}
    >
      {/* Drawer Header */}
      <div className="px-4 py-3 border-b border-current/12 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
              event.tier === 'macro'
                ? 'bg-[#B83B2A] text-amber-50'
                : 'bg-amber-600 text-white'
            }`}
          >
            {event.tier === 'macro' ? '历史大事件' : '烟火小事件'}
          </span>
          <span className="text-xs opacity-75 truncate tabular-nums">
            {event.time.display}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="p-1 rounded-lg hover:bg-current/10 transition cursor-pointer"
          title="收起侧边卷轴"
        >
          <PanelRightClose className="w-4 h-4 opacity-75" />
        </button>
      </div>

      {/* Scrollable Body */}
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
              onClick={() =>
                activeCampaignId === linkedCampaign.id
                  ? exitCampaign()
                  : startCampaign(linkedCampaign.id, 0)
              }
              className="w-full mt-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#A92B1E] to-[#C66A27] hover:brightness-110 text-amber-50 font-serif font-bold text-xs sm:text-sm shadow-md flex items-center justify-between cursor-pointer transition"
            >
              <span className="flex items-center gap-2">
                <Swords className="w-4 h-4 shrink-0" />
                <span>
                  {activeCampaignId === linkedCampaign.id
                    ? `正在推演：${linkedCampaign.title}（点击退出）`
                    : `进入分幕行军推演：${linkedCampaign.title}`}
                </span>
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
                onClick={() =>
                  flyToCamera(event.why.terrainCamera ?? event.camera)
                }
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

        {/* 4. Chronological Macro / Micro Event Switcher */}
        <section className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-xs opacity-85">
              编年大小事件速览（{filteredEvents.length}）
            </h3>
            <div className="flex gap-1 text-[11px]">
              {(
                [
                  { id: 'all', label: '全部' },
                  { id: 'macro', label: '大事件' },
                  { id: 'micro', label: '小事件' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTierFilter(tab.id)}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tierFilter === tab.id
                      ? 'bg-current/15 font-bold'
                      : 'opacity-65 hover:opacity-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {filteredEvents.map((item) => {
              const active = item.id === event.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    exitCampaign();
                    selectEvent(item.id, true);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                    active
                      ? 'bg-[#B83B2A] text-amber-50 font-semibold shadow-xs'
                      : 'hover:bg-current/8'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        active
                          ? 'bg-amber-200'
                          : item.tier === 'macro'
                          ? 'bg-[#B83B2A]'
                          : 'bg-amber-500'
                      }`}
                    />
                    <span className="tabular-nums opacity-75">
                      {item.time.year}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </span>
                  {item.campaignId && (
                    <Swords className="w-3 h-3 shrink-0 opacity-80" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
