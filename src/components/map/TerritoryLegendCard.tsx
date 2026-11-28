'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brush, ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';
import { CAMPAIGN_MAP } from '@/lib/atlasData';
import {
  getSnapshotForYear,
  subscribeTerritoryChunks,
} from '@/lib/territoryData';
import {
  CAMPAIGN_REQUIRED_SNAPSHOTS,
  buildCampaignTerritoryFrame,
} from '@/engine/territoryWipe';
import { useAtlasStore } from '@/store/useAtlasStore';
import type { TerritoryPolityProps } from '@/types/ming';

function TerritoryLegendCardInner() {
  const [collapsed, setCollapsed] = useState(false);
  const [chunkRev, setChunkRev] = useState(0);
  const [pinnedPolity, setPinnedPolity] = useState<TerritoryPolityProps | null>(
    null
  );

  const currentYear = useAtlasStore((s) => s.currentYear);
  const hoveredPolity = useAtlasStore((s) => s.hoveredPolity);
  const activeWipeCaption = useAtlasStore((s) => s.activeWipeCaption);
  const activeCampaignId = useAtlasStore((s) => s.activeCampaignId);
  const activePhaseIndex = useAtlasStore((s) => s.activePhaseIndex);
  const isCampaignPanelOpen = useAtlasStore((s) => s.isCampaignPanelOpen);
  const activeCharacterId = useAtlasStore((s) => s.activeCharacterId);
  const layers = useAtlasStore((s) => s.layers);
  const isDirectoryOpen = useAtlasStore((s) => s.isDirectoryOpen);
  const isDrawerOpen = useAtlasStore((s) => s.isDrawerOpen);
  const isStoryTourPlaying = useAtlasStore((s) => s.isStoryTourPlaying);
  const hasTourSession = useAtlasStore((s) => s.storyTourProgress > 0);
  const isImmersionMode = useAtlasStore((s) => s.isImmersionMode);
  const theme = useAtlasStore((s) => s.theme);

  const isDark = theme === 'xuanmo';
  const snapshot = getSnapshotForYear(currentYear);

  const neededSnapshotIdsRef = useRef<Set<string>>(new Set(['ter-1356']));
  {
    const needed = new Set<string>([snapshot.meta.snapshotId]);
    if (activeCampaignId) {
      for (const reqId of CAMPAIGN_REQUIRED_SNAPSHOTS[activeCampaignId] ?? []) {
        needed.add(reqId);
      }
    }
    neededSnapshotIdsRef.current = needed;
  }

  // Default collapsed on mobile (<640px) & only react when an actually displayed chunk arrives!
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setCollapsed(true);
    }
    return subscribeTerritoryChunks((loadedIds) => {
      if (loadedIds.some((id) => neededSnapshotIdsRef.current.has(id))) {
        setChunkRev((v) => v + 1);
      }
    });
  }, []);

  const polities = useMemo(() => {
    const sourceGeoJSON = activeCampaignId
      ? buildCampaignTerritoryFrame(activeCampaignId, activePhaseIndex, 0)
          .baseGeoJSON
      : snapshot.geojson;

    const activeCampaign = activeCampaignId
      ? CAMPAIGN_MAP[activeCampaignId] ?? null
      : null;

    const seen = new Set<string>();
    const list: TerritoryPolityProps[] = [];

    for (const f of sourceGeoJSON.features) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const id = String(p.polityId ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      list.push({
        polityId: id,
        polityName: String(p.polityName || p.shortLabel || id),
        shortLabel: String(p.shortLabel || p.polityName || id),
        ruler: String(p.ruler || ''),
        controlType:
          p.controlType === 'tributary-garrison'
            ? 'tributary-garrison'
            : 'direct',
        color: String(p.color || '#B83B2A'),
        labelCoord: [0, 0],
        capitalName: String(p.capitalName || ''),
        changeReason: String(p.changeReason || ''),
      });
    }

    if (activeCampaign) {
      for (const fac of activeCampaign.factions) {
        const alreadyHasColor = list.some(
          (p) => p.color.toLowerCase() === fac.color.toLowerCase()
        );
        if (!alreadyHasColor) {
          list.unshift({
            polityId: fac.id,
            polityName: fac.name,
            shortLabel: fac.name,
            ruler: fac.leader,
            controlType: 'direct',
            color: fac.color,
            labelCoord: [0, 0],
            capitalName: '战役参战主力',
            changeReason: activeCampaign.summary,
          });
        }
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, activePhaseIndex, chunkRev, snapshot.geojson]);

  const inspectedPolity = hoveredPolity ?? pinnedPolity;

  const cardSurface = isDark
    ? 'bg-[#0D131D]/96 border-amber-500/30 text-amber-50'
    : 'bg-[#FAF5E8]/96 border-amber-900/25 text-stone-900';

  const isTourHudOpen =
    !activeCampaignId &&
    (isStoryTourPlaying || hasTourSession || Boolean(activeCharacterId));

  const mobileSheetOpen = activeCampaignId
    ? isCampaignPanelOpen
    : isDirectoryOpen || isDrawerOpen;

  // Position smartly: top-left on mobile (<640px) & campaign mode; bottom-left on desktop normal mode!
  const positionClass = activeCampaignId
    ? 'top-[94px] sm:top-[58px] left-2.5 sm:left-3 max-w-[270px] sm:max-w-[308px]'
    : `top-[94px] sm:top-auto ${
        isTourHudOpen ? 'sm:bottom-[152px] xl:bottom-[62px]' : 'sm:bottom-[62px]'
      } ${
        isDirectoryOpen && !isImmersionMode
          ? 'left-2.5 sm:left-[286px] xl:left-[300px]'
          : 'left-2.5 sm:left-3'
      } max-w-[270px] sm:max-w-[330px] xl:max-w-[365px]`;

  return (
    <aside
      aria-label="舆图势力与地理军事图例"
      className={`pointer-events-auto fixed z-22 ${
        mobileSheetOpen && !activeWipeCaption ? 'hidden sm:flex' : 'flex'
      } flex-col gap-1.5 transition-[left,bottom] duration-150 ${positionClass}`}
    >
      {/* 1. Live Victory Paint-Over Banner (when territory is actively being painted by victor) */}
      {activeWipeCaption && (
        <div className="px-3 py-1.5 rounded-xl border border-amber-400/70 bg-[#9E2318] text-amber-50 shadow-lg text-[11px] font-serif font-bold flex items-center gap-1.5">
          <Brush className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="leading-snug">{activeWipeCaption}</span>
        </div>
      )}

      {/* 2. Hovered or Clicked Polity Historical Detail Cartouche */}
      {inspectedPolity && !collapsed && (
        <div
          className={`px-3 py-2 rounded-xl border shadow-xl text-xs ${cardSurface}`}
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className="font-serif font-bold text-xs sm:text-sm flex items-center gap-1.5"
              style={{ color: inspectedPolity.color }}
            >
              <span
                className="w-2.5 h-2.5 rounded-[2px] inline-block shrink-0"
                style={{ backgroundColor: inspectedPolity.color }}
              />
              <span className="truncate">{inspectedPolity.polityName}</span>
            </span>
            {inspectedPolity.controlType === 'tributary-garrison' && (
              <span className="text-[10px] px-1.5 py-0.2 rounded border border-current/35 opacity-80 shrink-0">
                羁縻卫所
              </span>
            )}
          </div>
          {(inspectedPolity.ruler || inspectedPolity.capitalName) && (
            <div className="text-[11px] opacity-75 mb-0.5">
              {inspectedPolity.ruler && `主帅/君主：${inspectedPolity.ruler}`}
              {inspectedPolity.capitalName &&
                ` · 治所：${inspectedPolity.capitalName}`}
            </div>
          )}
          {inspectedPolity.changeReason && (
            <p className="text-[11px] leading-relaxed opacity-90 line-clamp-2">
              <span className="font-semibold">考据：</span>
              {inspectedPolity.changeReason}
            </p>
          )}
        </div>
      )}

      {/* 3. Main Classical Cartographic Legend Box (《舆图图例》) */}
      <div className={`rounded-xl border shadow-lg overflow-hidden ${cardSurface}`}>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-serif font-bold border-b border-current/10 hover:bg-current/5 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <MapIcon className="w-3.5 h-3.5 text-[#B83B2A] dark:text-amber-400" />
            <span>舆图图例 · 势力与山河防线</span>
            <span className="text-[10px] font-sans font-normal opacity-70 tabular-nums">
              ({currentYear}年)
            </span>
          </span>
          {collapsed ? (
            <ChevronUp className="w-3.5 h-3.5 opacity-70" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          )}
        </button>

        {!collapsed && (
          <div className="px-3 py-2 space-y-2 text-[11px]">
            {/* Part A: Faction / Polity Territory Color Swatches */}
            <div>
              <div className="text-[10px] font-semibold opacity-65 mb-1 flex items-center justify-between">
                <span>割据/王朝势力色块（悬停查看考据）</span>
                <span>实控 / 虚线羁縻</span>
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                {polities.map((pol) => {
                  const isTributary = pol.controlType === 'tributary-garrison';
                  return (
                    <button
                      key={pol.polityId}
                      type="button"
                      onMouseEnter={() => setPinnedPolity(pol)}
                      onMouseLeave={() => setPinnedPolity(null)}
                      onClick={() =>
                        setPinnedPolity((prev) =>
                          prev?.polityId === pol.polityId ? null : pol
                        )
                      }
                      className="flex items-center gap-1.5 py-0.5 hover:opacity-100 opacity-92 cursor-pointer text-left"
                    >
                      <span
                        className={`w-3.5 h-2.5 inline-block rounded-[2px] shrink-0 ${
                          isTributary ? 'border border-dashed' : 'border'
                        }`}
                        style={{
                          backgroundColor: `${pol.color}${
                            isTributary ? '40' : 'BF'
                          }`,
                          borderColor: pol.color,
                        }}
                      />
                      <span className="font-serif font-semibold whitespace-nowrap">
                        {pol.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Part B: Great Wall, Grand Canal, Yellow River & Military Arrows Legend */}
            <div className="pt-1.5 border-t border-current/12">
              <div className="text-[10px] font-semibold opacity-65 mb-1">
                边防城垣 · 水道 · 战役箭矢图例
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2.5 gap-y-1">
                {/* 1. Ming Great Wall (Crenellated Battlement Sample) */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg
                    width="22"
                    height="8"
                    viewBox="0 0 22 8"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="6"
                      x2="22"
                      y2="6"
                      stroke={isDark ? '#94A3B8' : '#6B5344'}
                      strokeWidth="2"
                    />
                    <line
                      x1="1"
                      y1="3.5"
                      x2="21"
                      y2="3.5"
                      stroke={isDark ? '#E2E8F0' : '#3E2E24'}
                      strokeWidth="3"
                      strokeDasharray="3 3"
                    />
                  </svg>
                  <span>明长城九边</span>
                </span>

                {/* 2. 1194-1855 Duohuai Yellow River */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg
                    width="22"
                    height="8"
                    viewBox="0 0 22 8"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 4 Q 6 1.5, 11 4 T 22 4"
                      fill="none"
                      stroke={isDark ? '#EAB338' : '#B97316'}
                      strokeWidth="2.4"
                    />
                  </svg>
                  <span>夺淮故黄河</span>
                </span>

                {/* 3. Beijing-Hangzhou Grand Canal */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg
                    width="22"
                    height="8"
                    viewBox="0 0 22 8"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="4"
                      x2="22"
                      y2="4"
                      stroke={isDark ? '#38C6BD' : '#0B7D72'}
                      strokeWidth="2.2"
                      strokeDasharray="4 2.5"
                    />
                  </svg>
                  <span>京杭大运河</span>
                </span>

                {/* 4. Main Assault / Naval Solid Arrow */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg
                    width="22"
                    height="10"
                    viewBox="0 0 22 10"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="5"
                      x2="16"
                      y2="5"
                      stroke="#B83B2A"
                      strokeWidth="2.6"
                    />
                    <polygon points="15,1.5 22,5 15,8.5" fill="#B83B2A" />
                  </svg>
                  <span>主力/水师箭</span>
                </span>

                {/* 5. Ambush / Raid / Supply Dashed Arrow */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg
                    width="22"
                    height="10"
                    viewBox="0 0 22 10"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="5"
                      x2="16"
                      y2="5"
                      stroke="#D97706"
                      strokeWidth="2.2"
                      strokeDasharray="3.5 2"
                    />
                    <polygon points="15,1.5 22,5 15,8.5" fill="#D97706" />
                  </svg>
                  <span>奇袭/粮道箭</span>
                </span>

                {/* 6. Victory Territory Paint-Over */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-4 h-2.5 rounded-[2px] bg-gradient-to-r from-[#B83B2A] to-amber-400 border border-amber-500 inline-block shrink-0" />
                  <span>胜方版图涂抹</span>
                </span>

                {/* 7. Optional Institutional & Character Odyssey Indicators */}
                {layers.princelyFiefs && (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-3 h-3 rounded-full bg-[#7C3AED]/85 border border-amber-200 inline-block shrink-0" />
                    <span>藩王/九边塞王</span>
                  </span>
                )}
                {layers.nineGarrisons && (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-3.5 h-2.5 rounded-[2px] bg-[#9E2318]/25 border border-dashed border-[#9E2318] inline-block shrink-0" />
                    <span>九边重镇防区</span>
                  </span>
                )}
                {layers.famineZones && (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-600/35 border border-red-700 inline-block shrink-0" />
                    <span>小冰期旱蝗疫区</span>
                  </span>
                )}
                {layers.grandCanalHubs && (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-3 h-3 rounded-full bg-[#0D9488] border border-amber-200 inline-block shrink-0" />
                    <span>漕运钞关仓枢</span>
                  </span>
                )}
                {layers.silverRoutes && (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500 inline-block shrink-0" />
                    <span>全球白银航线</span>
                  </span>
                )}
                {activeCharacterId && (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-[#B83B2A] inline-block shrink-0" />
                    <span>人物一生足迹</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

const TerritoryLegendCard = React.memo(TerritoryLegendCardInner);
export default TerritoryLegendCard;
