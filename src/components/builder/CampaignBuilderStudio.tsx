'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Navigation,
  Play,
  Plus,
  Square,
  Swords,
  Trash2,
  Undo2,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { ALL_CAMPAIGNS, BOOK_TOC } from '@/lib/atlasData';
import {
  getSnapshotForYear,
  scheduleWarmAllTerritoryChunks,
  subscribeTerritoryChunks,
} from '@/lib/territoryData';
import {
  createHistoricalBaseStyle,
  registerTacticalSprites,
} from '@/engine/mapStyle';
import {
  buildPhaseRouteFeatures,
  buildPolityLabelGeoJSON,
  mountHistoricalLayers,
  setCampaignStaticRoutesOnMap,
  updateCampaignAnnotationsOnMap,
  updateCampaignArrowheadsOnMap,
} from '@/engine/MingMapLayers';
import type {
  Campaign,
  CampaignPhase,
  CampaignRoute,
  LngLat,
} from '@/types/ming';

type CampaignBattleMarker = CampaignPhase['markers'][number];
type DrawMode = 'pan' | 'route' | 'marker';

function roundCoord(pt: LngLat): LngLat {
  return [Number(pt[0].toFixed(4)), Number(pt[1].toFixed(4))];
}

function createStarterCampaign(): Campaign {
  return {
    id: 'cmp-1592-ningxia-putai',
    title: '万历宁夏平叛之役（示例草稿）',
    subtitle: '哱拜据镇城叛乱 · 李如松水攻决堤破城（1592）',
    yearRange: [1592, 1592],
    chapterIds: [BOOK_TOC.chapters[0]?.id ?? 'v1-zhu-yuanzhang-ch01'],
    summary:
      '点击左侧或地图工具栏切换为「绘制行军线」或「放置交战印章」，即可在明代历史舆图上零代码点选生成分幕战役数据包！',
    strategicOutcome: '平定西北边镇兵变，巩固万历三大征首战胜局。',
    factions: [
      {
        id: 'faction-ming',
        name: '明军平叛主力',
        leader: '李如松 · 叶梦熊',
        color: '#B83B2A',
        badgeText: '明',
      },
      {
        id: 'faction-opp',
        name: '敌对/割据势力',
        leader: '敌方统帅',
        color: '#1E3A8A',
        badgeText: '敌',
      },
    ],
    phases: [
      {
        phaseNo: 1,
        title: '第一幕：大军集结与主力进击',
        dateLabel: '万历二十年（1592）夏',
        year: 1592,
        narrative: '在此填写本幕战役演进叙事（要求纯原创撰写，言简意赅还原战术过程）。',
        whyKeyPoint: '在此填写本幕胜负手解析（从山川水文锁钥与军政后勤角度回答“为啥会这样”）。',
        camera: {
          center: [106.28, 38.48],
          zoom: 6.4,
          pitch: 36,
          bearing: 0,
        },
        strengthComparison: {
          leftFactionId: 'faction-ming',
          leftLabel: '明军进剿主力',
          leftPower: 60,
          rightFactionId: 'faction-opp',
          rightLabel: '据城守敌',
          rightPower: 40,
        },
        routes: [],
        markers: [],
      },
    ],
  };
}

export default function CampaignBuilderStudio() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);

  const [campaign, setCampaign] = useState<Campaign>(createStarterCampaign);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [drawMode, setDrawMode] = useState<DrawMode>('route');
  const [draftPoints, setDraftPoints] = useState<LngLat[]>([]);

  // Draft Route Settings
  const [draftFactionId, setDraftFactionId] = useState('faction-ming');
  const [draftRouteType, setDraftRouteType] =
    useState<CampaignRoute['type']>('assault');
  const [draftCommander, setDraftCommander] = useState('李如松');
  const [draftRouteLabel, setDraftRouteLabel] = useState(
    '主力奉命星夜驰援合围要塞'
  );

  // Draft Marker Settings
  const [draftMarkerKind, setDraftMarkerKind] =
    useState<CampaignBattleMarker['kind']>('clash');
  const [draftMarkerLabel, setDraftMarkerLabel] = useState('决战合围点');
  const [draftMarkerSubLabel, setDraftMarkerSubLabel] = useState('水陆夹击破城');

  const [arrowPreviewMode, setArrowPreviewMode] = useState<'dynamic' | 'static'>(
    'dynamic'
  );
  const [copiedJson, setCopiedJson] = useState(false);
  const [chunkTick, setChunkTick] = useState(0);

  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;
  const markerMetaRef = useRef({
    kind: draftMarkerKind,
    label: draftMarkerLabel,
    subLabel: draftMarkerSubLabel,
  });
  markerMetaRef.current = {
    kind: draftMarkerKind,
    label: draftMarkerLabel,
    subLabel: draftMarkerSubLabel,
  };

  const activePhase: CampaignPhase =
    campaign.phases[phaseIdx] ?? campaign.phases[0];

  useEffect(() => {
    scheduleWarmAllTerritoryChunks();
    return subscribeTerritoryChunks(() => setChunkTick((t) => t + 1));
  }, []);

  // Sync preview campaign with temporary in-progress draft route so user sees curve as they click!
  const previewCampaignAndPhase = useMemo(() => {
    const tempRoutes = [...activePhase.routes];
    if (draftPoints.length >= 2) {
      tempRoutes.push({
        id: 'route-draft-preview',
        order: tempRoutes.length + 1,
        factionId: draftFactionId,
        type: draftRouteType,
        commander: draftCommander || undefined,
        label: `${draftRouteLabel}（绘制预览中…）`,
        coordinates: draftPoints,
      });
    }
    const ph: CampaignPhase = {
      ...activePhase,
      routes: tempRoutes,
    };
    return { cmp: campaign, ph };
  }, [
    activePhase,
    campaign,
    draftCommander,
    draftFactionId,
    draftPoints,
    draftRouteLabel,
    draftRouteType,
  ]);

  // 1. Mount MapLibre Studio Canvas
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createHistoricalBaseStyle('xuanzhi', false, 'balanced'),
      center: activePhase.camera.center,
      zoom: activePhase.camera.zoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      localIdeographFontFamily:
        "'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif",
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      'bottom-right'
    );

    map.on('load', () => {
      styleReadyRef.current = true;
      registerTacticalSprites(map);
      const snap = getSnapshotForYear(activePhase.year);
      mountHistoricalLayers(map, snap.geojson, 'xuanzhi', 'both');

      // Draft Waypoint Vertices Layer
      if (!map.getSource('builder-draft-pts')) {
        map.addSource('builder-draft-pts', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'builder-draft-pts-circle',
          type: 'circle',
          source: 'builder-draft-pts',
          paint: {
            'circle-radius': 6,
            'circle-color': '#F59E0B',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#9E2318',
          },
        });
      }
    });

    map.on('click', (e) => {
      const coord = roundCoord([e.lngLat.lng, e.lngLat.lat]);
      if (drawModeRef.current === 'route') {
        setDraftPoints((prev) => [...prev, coord]);
      } else if (drawModeRef.current === 'marker') {
        const meta = markerMetaRef.current;
        const newMarker: CampaignBattleMarker = {
          id: `m-custom-${Date.now().toString(36)}`,
          kind: meta.kind,
          label: meta.label || '关键交战点',
          subLabel: meta.subLabel || undefined,
          coordinates: coord,
          color: '#B83B2A',
        };
        setCampaign((prev) => {
          const nextPhases = prev.phases.map((p, i) =>
            i === phaseIdx ? { ...p, markers: [...p.markers, newMarker] } : p
          );
          return { ...prev, phases: nextPhases };
        });
      }
    });

    mapRef.current = map;
    return () => {
      styleReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  // 2. Sync Territory Year Snapshot + Routes + Annotations + Draft Vertices onto GPU
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const snap = getSnapshotForYear(activePhase.year);
    const terSrc = map.getSource('ming-territories') as
      | maplibregl.GeoJSONSource
      | undefined;
    const polSrc = map.getSource('ming-polity-points') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (terSrc) terSrc.setData(snap.geojson);
    if (polSrc) polSrc.setData(buildPolityLabelGeoJSON(snap.geojson));

    const { featureCollection, preparedCurves } = buildPhaseRouteFeatures(
      previewCampaignAndPhase.cmp,
      previewCampaignAndPhase.ph
    );
    setCampaignStaticRoutesOnMap(map, featureCollection, preparedCurves);
    updateCampaignAnnotationsOnMap(
      map,
      preparedCurves,
      previewCampaignAndPhase.ph,
      preparedCurves.length,
      'xuanzhi'
    );

    if (arrowPreviewMode === 'static') {
      updateCampaignArrowheadsOnMap(map, preparedCurves, 'static', 1);
    }

    const draftSrc = map.getSource('builder-draft-pts') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (draftSrc) {
      draftSrc.setData({
        type: 'FeatureCollection',
        features: draftPoints.map((pt, idx) => ({
          type: 'Feature',
          properties: { idx: idx + 1 },
          geometry: { type: 'Point', coordinates: pt },
        })),
      });
    }
  }, [
    activePhase.year,
    arrowPreviewMode,
    chunkTick,
    draftPoints,
    previewCampaignAndPhase,
  ]);

  // 3. Smooth Animated Marching Preview Loop when `arrowPreviewMode === 'dynamic'`
  useEffect(() => {
    if (arrowPreviewMode !== 'dynamic') return;
    let rafId: number | null = null;

    const animate = (now: number) => {
      const map = mapRef.current;
      if (map && styleReadyRef.current) {
        const { preparedCurves } = buildPhaseRouteFeatures(
          previewCampaignAndPhase.cmp,
          previewCampaignAndPhase.ph
        );
        if (preparedCurves.length > 0) {
          const cycle = (now % 4800) / 3600;
          const pulse = (now % 2600) / 2600;
          updateCampaignArrowheadsOnMap(
            map,
            preparedCurves,
            'dynamic',
            Math.min(1, cycle),
            pulse
          );
        }
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [arrowPreviewMode, previewCampaignAndPhase]);

  const commitDraftRoute = () => {
    if (draftPoints.length < 2) return;
    const newRoute: CampaignRoute = {
      id: `r-p${activePhase.phaseNo}-${Date.now().toString(36)}`,
      order: activePhase.routes.length + 1,
      factionId: draftFactionId,
      type: draftRouteType,
      commander: draftCommander.trim() || undefined,
      label: draftRouteLabel.trim() || '主力推进路线',
      coordinates: draftPoints,
    };

    setCampaign((prev) => ({
      ...prev,
      phases: prev.phases.map((p, idx) =>
        idx === phaseIdx ? { ...p, routes: [...p.routes, newRoute] } : p
      ),
    }));
    setDraftPoints([]);
  };

  const captureCurrentCameraToPhase = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setCampaign((prev) => ({
      ...prev,
      phases: prev.phases.map((p, idx) =>
        idx === phaseIdx
          ? {
              ...p,
              camera: {
                center: roundCoord([c.lng, c.lat]),
                zoom: Number(map.getZoom().toFixed(2)),
                pitch: 38,
                bearing: 0,
              },
            }
          : p
      ),
    }));
  };

  const addNewPhase = () => {
    setCampaign((prev) => {
      const nextNo = prev.phases.length + 1;
      const baseYear = activePhase.year;
      const nextPh: CampaignPhase = {
        phaseNo: nextNo,
        title: `第${nextNo}幕：决战合围`,
        dateLabel: `${baseYear}年`,
        year: baseYear,
        narrative: '在此补充本幕原创历史叙事。',
        whyKeyPoint: '在此补充本幕地理与制度胜负手。',
        camera: { ...activePhase.camera },
        strengthComparison: activePhase.strengthComparison
          ? { ...activePhase.strengthComparison }
          : undefined,
        routes: [],
        markers: [],
      };
      return { ...prev, phases: [...prev.phases, nextPh] };
    });
    setPhaseIdx(campaign.phases.length);
    setDraftPoints([]);
  };

  const exportedJson = useMemo(
    () => JSON.stringify(campaign, null, 2),
    [campaign]
  );

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(exportedJson);
    setCopiedJson(true);
    window.setTimeout(() => setCopiedJson(false), 2200);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.id || 'cmp-custom'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-[#EFE6D4] text-stone-900 select-none">
      {/* Full-Screen Interactive MapLibre Authoring Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full ${
          drawMode !== 'pan' ? 'cursor-crosshair' : ''
        }`}
      />

      {/* Top Studio Bar */}
      <header className="fixed top-2.5 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-900/25 bg-[#FAF5E8]/97 shadow-lg">
          <Link
            href="/"
            className="px-2 py-1 rounded-lg bg-stone-800/8 hover:bg-stone-800/15 text-xs font-bold flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回主舆图</span>
          </Link>
          <span className="px-2 py-0.5 rounded bg-[#9E2318] text-amber-50 text-xs font-serif font-bold flex items-center gap-1">
            <Swords className="w-3.5 h-3.5" />
            可视化战役投稿工坊
          </span>

          {/* Load Existing Campaign as Template */}
          <select
            aria-label="加载内置战役作为编辑模板"
            value=""
            onChange={(e) => {
              const found = ALL_CAMPAIGNS.find((c) => c.id === e.target.value);
              if (found) {
                const cloned = JSON.parse(JSON.stringify(found)) as Campaign;
                setCampaign(cloned);
                setPhaseIdx(0);
                setDraftFactionId(cloned.factions[0]?.id ?? 'faction-ming');
                setDraftPoints([]);
                mapRef.current?.flyTo({
                  center: cloned.phases[0].camera.center,
                  zoom: cloned.phases[0].camera.zoom,
                  duration: 700,
                });
              }
            }}
            className="px-2 py-1 rounded-lg border border-amber-900/20 bg-[#FFFDF8] text-xs font-medium cursor-pointer"
          >
            <option value="">载入现有战役作参考模板…</option>
            {ALL_CAMPAIGNS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.yearRange[0]} · {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Drawing Mode Switcher + Export CTA */}
        <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-900/25 bg-[#FAF5E8]/97 shadow-lg text-xs">
          {(
            [
              { id: 'route', label: '① 点选绘行军线', icon: Navigation },
              { id: 'marker', label: '② 点选放交战印', icon: Flag },
              { id: 'pan', label: '漫游视角', icon: Play },
            ] as const
          ).map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setDrawMode(tool.id)}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition ${
                  drawMode === tool.id
                    ? 'bg-[#B83B2A] text-amber-50 shadow-xs'
                    : 'hover:bg-stone-800/8'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tool.label}</span>
              </button>
            );
          })}

          <span className="h-4 w-px bg-stone-900/15 mx-0.5" />

          <button
            type="button"
            onClick={() =>
              setArrowPreviewMode((m) => (m === 'dynamic' ? 'static' : 'dynamic'))
            }
            className="px-2.5 py-1 rounded-lg border border-amber-900/20 bg-amber-500/15 font-bold cursor-pointer"
          >
            {arrowPreviewMode === 'dynamic' ? '预览：动态箭矢' : '预览：静态箭矢'}
          </button>

          <button
            type="button"
            onClick={handleCopyJson}
            className="px-2.5 py-1 rounded-lg bg-stone-800 text-amber-50 font-bold flex items-center gap-1 cursor-pointer"
          >
            {copiedJson ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>已复制 JSON</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>复制 JSON</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="px-2.5 py-1 rounded-lg bg-[#9E2318] hover:bg-[#831B11] text-amber-50 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出包</span>
          </button>
        </div>
      </header>

      {/* Left Authoring Inspector Drawer */}
      <aside className="fixed top-[58px] bottom-3 left-3 z-25 w-[330px] max-w-[calc(100vw-24px)] rounded-2xl border border-amber-900/25 bg-[#FAF5E8]/97 shadow-2xl flex flex-col overflow-hidden text-xs">
        <div className="px-3.5 py-2.5 border-b border-amber-900/15 flex items-center justify-between">
          <span className="font-serif font-bold text-sm">
            战役元数据与分幕路线编辑
          </span>
          <a
            href={`${SITE_CONFIG.repoUrl}/issues/new?template=new_event.yml`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#9E2318] font-bold flex items-center gap-0.5 hover:underline"
          >
            <span>去 GitHub 投稿</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* Campaign ID & Title */}
          <div className="space-y-1.5">
            <label className="block font-bold opacity-80">
              战役 ID（`cmp-年份-代号`）与标题
            </label>
            <input
              type="text"
              value={campaign.id}
              onChange={(e) => setCampaign({ ...campaign, id: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-900/20 bg-white font-mono text-xs"
            />
            <input
              type="text"
              value={campaign.title}
              onChange={(e) =>
                setCampaign({ ...campaign, title: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-900/20 bg-white font-serif font-bold text-xs"
            />
          </div>

          {/* Phase Tabs + Add Phase */}
          <div className="space-y-1.5 pt-2 border-t border-amber-900/12">
            <div className="flex items-center justify-between">
              <span className="font-bold opacity-80">
                分幕管理（正式合入需 ≥ 4 幕）
              </span>
              <button
                type="button"
                onClick={addNewPhase}
                className="px-2 py-0.5 rounded bg-[#B83B2A] text-amber-50 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>新增一幕</span>
              </button>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {campaign.phases.map((p, idx) => (
                <button
                  key={p.phaseNo}
                  type="button"
                  onClick={() => {
                    setPhaseIdx(idx);
                    setDraftPoints([]);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    idx === phaseIdx
                      ? 'bg-[#9E2318] text-amber-50'
                      : 'bg-stone-800/8 hover:bg-stone-800/15'
                  }`}
                >
                  第{p.phaseNo}幕
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                min={1344}
                max={1662}
                value={activePhase.year}
                onChange={(e) => {
                  const yr = Number(e.target.value) || 1368;
                  setCampaign((prev) => ({
                    ...prev,
                    phases: prev.phases.map((p, i) =>
                      i === phaseIdx ? { ...p, year: yr } : p
                    ),
                  }));
                }}
                className="px-2 py-1 rounded-lg border border-amber-900/20 bg-white tabular-nums"
                title="本幕底图历史年份"
              />
              <input
                type="text"
                value={activePhase.title}
                onChange={(e) =>
                  setCampaign((prev) => ({
                    ...prev,
                    phases: prev.phases.map((p, i) =>
                      i === phaseIdx ? { ...p, title: e.target.value } : p
                    ),
                  }))
                }
                className="col-span-2 px-2 py-1 rounded-lg border border-amber-900/20 bg-white font-serif font-bold"
              />
            </div>

            <textarea
              rows={2}
              value={activePhase.narrative}
              onChange={(e) =>
                setCampaign((prev) => ({
                  ...prev,
                  phases: prev.phases.map((p, i) =>
                    i === phaseIdx ? { ...p, narrative: e.target.value } : p
                  ),
                }))
              }
              placeholder="本幕战役叙事…"
              className="w-full px-2 py-1.5 rounded-lg border border-amber-900/20 bg-white"
            />

            <button
              type="button"
              onClick={captureCurrentCameraToPhase}
              className="w-full py-1 rounded-lg border border-amber-900/25 bg-amber-900/8 hover:bg-amber-900/15 font-bold cursor-pointer"
            >
              将当前地图视角保存为本幕默认镜头
            </button>
          </div>

          {/* Active Drawing Tool Configuration */}
          {drawMode === 'route' && (
            <div className="p-2.5 rounded-xl border border-[#B83B2A]/35 bg-[#B83B2A]/6 space-y-2">
              <div className="font-serif font-bold text-[#9E2318]">
                当前工具：点击地图依次添加行军拐点（已选 {draftPoints.length} 点）
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={draftFactionId}
                  onChange={(e) => setDraftFactionId(e.target.value)}
                  className="px-2 py-1 rounded border border-amber-900/20 bg-white"
                >
                  {campaign.factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      阵营：{f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draftRouteType}
                  onChange={(e) =>
                    setDraftRouteType(e.target.value as CampaignRoute['type'])
                  }
                  className="px-2 py-1 rounded border border-amber-900/20 bg-white"
                >
                  <option value="assault">主力进击（实线）</option>
                  <option value="naval">水师航线（实线）</option>
                  <option value="ambush">奇袭设伏（虚线）</option>
                  <option value="supply">粮道驰援（金虚线）</option>
                  <option value="retreat">败退突围（虚线）</option>
                </select>
              </div>
              <input
                type="text"
                value={draftCommander}
                onChange={(e) => setDraftCommander(e.target.value)}
                placeholder="统帅姓名（如：徐达 · 常遇春）"
                className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
              />
              <input
                type="text"
                value={draftRouteLabel}
                onChange={(e) => setDraftRouteLabel(e.target.value)}
                placeholder="本路战术说明（如：乘夜奇袭夹击敌营）"
                className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={draftPoints.length < 2}
                  onClick={commitDraftRoute}
                  className="flex-1 py-1.5 rounded-lg bg-[#B83B2A] disabled:opacity-40 text-amber-50 font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  <span>完成此条路线</span>
                </button>
                <button
                  type="button"
                  disabled={draftPoints.length === 0}
                  onClick={() => setDraftPoints((pts) => pts.slice(0, -1))}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-900/25 disabled:opacity-40 cursor-pointer"
                  title="撤销最后一个点"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {drawMode === 'marker' && (
            <div className="p-2.5 rounded-xl border border-amber-700/35 bg-amber-500/10 space-y-2">
              <div className="font-serif font-bold text-amber-950">
                当前工具：点击地图直接落印交战地标
              </div>
              <select
                value={draftMarkerKind}
                onChange={(e) =>
                  setDraftMarkerKind(
                    e.target.value as CampaignBattleMarker['kind']
                  )
                }
                className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
              >
                <option value="clash">「决」主力决战印</option>
                <option value="siege">「围」孤城合围印</option>
                <option value="camp">「伏」设伏/大营印</option>
                <option value="pass">「守」关隘死守印</option>
                <option value="cutoff">「断」断粮锁道印</option>
              </select>
              <input
                type="text"
                value={draftMarkerLabel}
                onChange={(e) => setDraftMarkerLabel(e.target.value)}
                placeholder="印章主标题（如：康郎山火攻）"
                className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
              />
              <input
                type="text"
                value={draftMarkerSubLabel}
                onChange={(e) => setDraftMarkerSubLabel(e.target.value)}
                placeholder="副标题（如：焚毁陈汉赤龙巨舰）"
                className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
              />
            </div>
          )}

          {/* Existing Routes & Markers in Current Phase */}
          <div className="space-y-1.5 pt-2 border-t border-amber-900/12">
            <div className="font-bold opacity-80">
              本幕已绘路线（{activePhase.routes.length}）与印章（
              {activePhase.markers.length}）
            </div>
            {activePhase.routes.map((rt, idx) => (
              <div
                key={rt.id}
                className="px-2.5 py-1.5 rounded-lg border border-amber-900/15 bg-white flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  <strong>#{idx + 1}</strong> {rt.commander ? `${rt.commander} · ` : ''}
                  {rt.label}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCampaign((prev) => ({
                      ...prev,
                      phases: prev.phases.map((p, i) =>
                        i === phaseIdx
                          ? {
                              ...p,
                              routes: p.routes
                                .filter((r) => r.id !== rt.id)
                                .map((r, k) => ({ ...r, order: k + 1 })),
                            }
                          : p
                      ),
                    }))
                  }
                  className="text-red-700 hover:text-red-900 shrink-0 cursor-pointer"
                  aria-label="删除此路线"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {activePhase.markers.map((mk) => (
              <div
                key={mk.id}
                className="px-2.5 py-1.5 rounded-lg border border-amber-900/15 bg-amber-50/70 flex items-center justify-between gap-2"
              >
                <span className="truncate">📍 {mk.label}</span>
                <button
                  type="button"
                  onClick={() =>
                    setCampaign((prev) => ({
                      ...prev,
                      phases: prev.phases.map((p, i) =>
                        i === phaseIdx
                          ? {
                              ...p,
                              markers: p.markers.filter((m) => m.id !== mk.id),
                            }
                          : p
                      ),
                    }))
                  }
                  className="text-red-700 hover:text-red-900 shrink-0 cursor-pointer"
                  aria-label="删除此印章"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
