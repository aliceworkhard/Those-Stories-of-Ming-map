'use client';

import React from 'react';
import { ExternalLink, Sparkles, Tag, X } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ATLAS_RELEASES, CURRENT_ATLAS_VERSION } from '@/data/releases';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function ReleaseNotesModal() {
  const isOpen = useAtlasStore((s) => s.isReleaseModalOpen);
  const setReleaseModalOpen = useAtlasStore((s) => s.setReleaseModalOpen);
  const theme = useAtlasStore((s) => s.theme);

  if (!isOpen) return null;

  const isDark = theme === 'xuanmo';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4"
      onClick={() => setReleaseModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[85dvh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-[#0D131D] border-amber-500/35 text-amber-50'
            : 'bg-[#FAF5E8] border-amber-900/25 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-current/15 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-4 h-4 text-[#B83B2A] dark:text-amber-400 shrink-0" />
            <h2 className="font-serif font-bold text-sm sm:text-base truncate">
              《明途 · 舆图纪》版本发布日志（当前 {CURRENT_ATLAS_VERSION}）
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`${SITE_CONFIG.repoUrl}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-[#B83B2A] hover:bg-[#9B2C1D] text-amber-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>GitHub Releases</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => setReleaseModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              aria-label="关闭版本日志"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Releases Timeline */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {ATLAS_RELEASES.map((rel, idx) => (
            <article
              key={rel.version}
              className={`p-3.5 rounded-xl border space-y-2 ${
                idx === 0
                  ? isDark
                    ? 'border-amber-400/45 bg-amber-500/8'
                    : 'border-[#B83B2A]/35 bg-[#FFFDF8]'
                  : 'border-current/15 bg-current/[0.02]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#9E2318] text-amber-50 text-xs font-mono font-bold">
                    {rel.version}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] font-bold">
                    {rel.badge}
                  </span>
                </div>
                <span className="text-xs opacity-70 tabular-nums">{rel.date}</span>
              </div>

              <h3 className="font-serif font-bold text-sm sm:text-base">
                {rel.title}
              </h3>

              <ul className="space-y-1.5 text-xs leading-relaxed opacity-92">
                {rel.highlights.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 text-[#B83B2A] dark:text-amber-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
