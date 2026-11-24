'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, ExternalLink, MapPin, Swords, X } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ALL_CAMPAIGNS, ALL_EVENTS, BOOK_TOC } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function BookTocModal() {
  const [selectedVolume, setSelectedVolume] = useState<number>(1);

  const isOpen = useAtlasStore((s) => s.isTocModalOpen);
  const setTocModalOpen = useAtlasStore((s) => s.setTocModalOpen);
  const selectEvent = useAtlasStore((s) => s.selectEvent);
  const startCampaign = useAtlasStore((s) => s.startCampaign);
  const exitCampaign = useAtlasStore((s) => s.exitCampaign);
  const theme = useAtlasStore((s) => s.theme);

  const eventsByChapter = useMemo(() => {
    const map: Record<string, typeof ALL_EVENTS> = {};
    for (const ev of ALL_EVENTS) {
      for (const cid of ev.bookLens.chapterIds) {
        if (!map[cid]) map[cid] = [];
        map[cid].push(ev);
      }
    }
    return map;
  }, []);

  const campaignsByChapter = useMemo(() => {
    const map: Record<string, typeof ALL_CAMPAIGNS> = {};
    for (const cmp of ALL_CAMPAIGNS) {
      for (const cid of cmp.chapterIds) {
        if (!map[cid]) map[cid] = [];
        map[cid].push(cmp);
      }
    }
    return map;
  }, []);

  if (!isOpen) return null;

  const isDark = theme === 'xuanmo';
  const chaptersInVol = BOOK_TOC.chapters.filter(
    (c) => c.volumeNo === selectedVolume
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => setTocModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[82vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-slate-950 border-amber-500/35 text-amber-50'
            : 'bg-[#FAF5E8] border-amber-900/25 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-current/15 flex items-center justify-between">
          <div>
            <h2 className="font-serif font-bold text-base sm:text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#B83B2A] dark:text-amber-400" />
              <span>
                《{BOOK_TOC.meta.bookTitle}》全书七部 · {BOOK_TOC.meta.totalChapters}{' '}
                章时空锚点索引
              </span>
            </h2>
            <p className="text-[11px] opacity-75 mt-0.5">
              {BOOK_TOC.meta.copyrightNotice}（高亮章节支持一键飞跃至三维地图现场）
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTocModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7 Volumes Tab Strip */}
        <div className="px-4 py-2 border-b border-current/10 flex gap-1.5 overflow-x-auto shrink-0">
          {BOOK_TOC.volumes.map((v) => (
            <button
              key={v.volumeNo}
              type="button"
              onClick={() => setSelectedVolume(v.volumeNo)}
              className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold whitespace-nowrap transition cursor-pointer ${
                selectedVolume === v.volumeNo
                  ? 'bg-[#B83B2A] text-amber-50 shadow-xs'
                  : 'bg-current/8 hover:bg-current/15 opacity-80'
              }`}
            >
              {v.volumeTitle}
            </button>
          ))}
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chaptersInVol.map((ch) => {
            const evs = eventsByChapter[ch.id] ?? [];
            const cmps = campaignsByChapter[ch.id] ?? [];
            const hasContent = evs.length > 0 || cmps.length > 0;

            return (
              <div
                key={ch.id}
                className={`p-2.5 rounded-xl border transition ${
                  hasContent
                    ? isDark
                      ? 'border-amber-500/35 bg-slate-900/90'
                      : 'border-amber-900/25 bg-[#FFFDF8]'
                    : 'border-current/10 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm font-serif font-semibold">
                    <span className="opacity-65 mr-2">{ch.emperorSection}</span>
                    <span>{ch.chapterTitle}</span>
                  </div>

                  {!hasContent && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-current/8">
                      欢迎共建补充事件
                    </span>
                  )}
                </div>

                {hasContent && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evs.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          exitCampaign();
                          selectEvent(ev.id, true);
                          setTocModalOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#B83B2A]/12 hover:bg-[#B83B2A]/22 text-[#B83B2A] dark:text-amber-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>
                          {ev.time.year} · {ev.title}
                        </span>
                      </button>
                    ))}

                    {cmps.map((cmp) => (
                      <button
                        key={cmp.id}
                        type="button"
                        onClick={() => {
                          startCampaign(cmp.id, 0);
                          setTocModalOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Swords className="w-3 h-3" />
                        <span>推演：{cmp.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Community & Open-Source Links Footer */}
        <div className="px-5 py-2.5 border-t border-current/12 text-xs flex flex-wrap items-center justify-between gap-2 opacity-90">
          <span>开源共建 · 欢迎补充考据或反馈建议：</span>
          <div className="flex flex-wrap items-center gap-3 font-medium">
            <a
              href={SITE_CONFIG.linuxDoTopicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B83B2A] dark:text-amber-300 hover:underline flex items-center gap-1"
            >
              <span>LINUX DO 交流专帖</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={SITE_CONFIG.linuxDoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-center gap-1"
            >
              <span>LINUX DO 社区</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={SITE_CONFIG.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-center gap-1"
            >
              <span>GitHub 开源仓库</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
