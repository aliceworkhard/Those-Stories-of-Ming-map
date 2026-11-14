'use client';

import React from 'react';
import { getSnapshotForYear } from '@/lib/atlasData';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function TerritoryLegendCard() {
  const currentYear = useAtlasStore((s) => s.currentYear);
  const hoveredPolity = useAtlasStore((s) => s.hoveredPolity);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const storyTourProgress = useAtlasStore((s) => s.storyTourProgress);
  const showTerritories = useAtlasStore((s) => s.layers.territories);
  const theme = useAtlasStore((s) => s.theme);

  if (
    !showTerritories ||
    activeCampaignId ||
    isStoryTourPlaying ||
    storyTourProgress > 0
  ) {
    return null;
  }

  const snapshot = getSnapshotForYear(currentYear);
  const isDark = theme === 'xuanmo';

  // Deduplicate polities by polityId ( keeping direct before tributary )
  const seen = new Set<string>();
  const polities: Array<{
    id: string;
    label: string;
    color: string;
    isTributary: boolean;
  }> = [];

  for (const f of snapshot.geojson.features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const id = String(p.polityId ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    polities.push({
      id,
      label: String(p.shortLabel || p.polityName || ''),
      color: String(p.color || '#B83B2A'),
      isTributary: p.controlType === 'tributary-garrison',
    });
  }

  const cardSurface = isDark
    ? 'bg-[#0D131D]/96 border-amber-500/30 text-amber-50'
    : 'bg-[#FAF5E8]/96 border-amber-900/25 text-stone-900';

  return (
    <div className="pointer-events-none fixed bottom-[66px] left-1/2 -translate-x-1/2 z-20 hidden lg:flex flex-col items-center gap-1.5 max-w-[440px] xl:max-w-[560px]">
      {/* Hovered Polity Classical Cartouche (Only appears when cursor hovers a regime on map!) */}
      {hoveredPolity && (
        <div
          className={`w-full px-3.5 py-2 rounded-xl border shadow-xl text-xs transition-opacity ${cardSurface}`}
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className="font-serif font-bold text-sm flex items-center gap-1.5"
              style={{ color: hoveredPolity.color }}
            >
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: hoveredPolity.color }}
              />
              {hoveredPolity.polityName}
              {hoveredPolity.controlType === 'tributary-garrison' && (
                <span className="text-[10px] px-1 py-0.2 rounded border border-current/40 opacity-80">
                  羁縻都司卫所
                </span>
              )}
            </span>
            <span className="text-[11px] opacity-75 shrink-0">
              主帅/君主：{hoveredPolity.ruler} · 治所：{hoveredPolity.capitalName}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            <span className="font-semibold">版图考据：</span>
            {hoveredPolity.changeReason}
          </p>
        </div>
      )}

      {/* Compact Cartographic Swatch Strip */}
      <div
        className={`px-3 py-1 rounded-full border shadow-md flex items-center gap-2.5 flex-wrap justify-center text-[11px] ${cardSurface}`}
      >
        {polities.slice(0, 5).map((pol) => (
          <span key={pol.id} className="flex items-center gap-1 whitespace-nowrap">
            <span
              className={`w-2.5 h-2.5 inline-block rounded-[2px] ${
                pol.isTributary ? 'border border-dashed' : ''
              }`}
              style={{
                backgroundColor: `${pol.color}${pol.isTributary ? '55' : 'CC'}`,
                borderColor: pol.color,
              }}
            />
            <span className="font-serif font-semibold">{pol.label}</span>
          </span>
        ))}
        <span className="opacity-30">|</span>
        <span className="flex items-center gap-1 whitespace-nowrap opacity-85">
          <span className="w-3 h-0.5 bg-[#B97316] inline-block" />
          夺淮故黄河
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap opacity-85">
          <span className="w-3 h-0.5 bg-[#0B7D72] inline-block" />
          大运河
        </span>
      </div>
    </div>
  );
}
