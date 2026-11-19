'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  Brush,
  Check,
  Copy,
  Download,
  Eraser,
  Hand,
  Image as ImageIcon,
  Lock,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';

import {
  MING_LANDFORMS_GEOJSON,
  MING_WATERWAYS_GEOJSON,
  PLACES_GEOJSON,
  TERRITORY_INDEX,
  TERRITORY_SNAPSHOT_BY_ID,
} from '@/lib/atlasData';
import { createHistoricalBaseStyle } from '@/engine/mapStyle';
import { buildPolityLabelGeoJSON } from '@/engine/MingMapLayers';
import {
  applyBrushStrokeToPolities,
  buildBrushCirclePolygon,
  buildBrushStrokeMultiPoly,
  convertFeatureCollectionToTopoJSON,
  countPolitiesVertices,
  featureCollectionToPolities,
  politiesToFeatureCollection,
  type EditablePolity,
} from '@/engine/painterOps';
import type { LngLat } from '@/types/ming';

type StudioTool = 'paint' | 'erase' | 'pan';

interface OnionSkinState {
  url: string | null;
  fileName: string;
  opacity: number;
  west: number;
  south: number;
  east: number;
  north: number;
  visible: boolean;
}

const PRESET_COLORS = [
  '#B83B2A',
  '#1E5F74',
  '#5B7A3E',
  '#C68B2C',
  '#805AD5',
  '#9C4221',
  '#2F855A',
  '#4A5568',
];

function formatCompactGeoJSONString(fc: GeoJSON.FeatureCollection): string {
  return JSON.stringify(fc, null, 2).replace(
    /\[\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+\]/g,
    '[$1,$2]'
  );
}

function downloadJsonBlob(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TerritoryPainterStudio() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onionInputRef = useRef<HTMLInputElement | null>(null);

  const initialSnap = TERRITORY_SNAPSHOT_BY_ID['ter-1363'];
  const [baseSnapshotId, setBaseSnapshotId] = useState<string>('ter-1363');
  const [targetYear, setTargetYear] = useState<number>(1365);
  const [snapshotTitle, setSnapshotTitle] = useState<string>(
    '至正二十五年（1365）· 自定义疆域擦写切片'
  );
  const [polities, setPolities] = useState<EditablePolity[]>(() =>
    featureCollectionToPolities(initialSnap.geojson)
  );
  const [activePolityId, setActivePolityId] = useState<string>(
    initialSnap.geojson.features[0]?.properties?.polityId ?? 'zhu-wu'
  );

  const [undoStack, setUndoStack] = useState<EditablePolity[][]>([]);
  const [redoStack, setRedoStack] = useState<EditablePolity[][]>([]);

  const [tool, setTool] = useState<StudioTool>('paint');
  const [radiusKm, setRadiusKm] = useState<number>(75);
  const [lockCoastline, setLockCoastline] = useState<boolean>(true);
  const [mutualExclusive, setMutualExclusive] = useState<boolean>(true);
  const [simplifyTol, setSimplifyTol] = useState<number>(0.008);
  const [copiedMeta, setCopiedMeta] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string>(
    '就绪：按住鼠标左键在地图上拖拽即可布尔涂抹扩张（Union）或擦除（Difference），海岸线已自动锁边。'
  );

  const [onion, setOnion] = useState<OnionSkinState>({
    url: null,
    fileName: '',
    opacity: 0.52,
    west: 97.0,
    south: 18.0,
    east: 132.0,
    north: 49.0,
    visible: true,
  });

  // Refs for zero-stale-closure fast pointer handlers on MapLibre canvas
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const radiusKmRef = useRef(radiusKm);
  radiusKmRef.current = radiusKm;
  const activePolityIdRef = useRef(activePolityId);
  activePolityIdRef.current = activePolityId;
  const lockCoastlineRef = useRef(lockCoastline);
  lockCoastlineRef.current = lockCoastline;
  const mutualExclusiveRef = useRef(mutualExclusive);
  mutualExclusiveRef.current = mutualExclusive;
  const politiesRef = useRef(polities);
  politiesRef.current = polities;
  const strokePointsRef = useRef<LngLat[]>([]);
  const isDrawingRef = useRef(false);

  const activePolity = useMemo(
    () =>
      polities.find((p) => p.polityId === activePolityId) ?? polities[0] ?? null,
    [polities, activePolityId]
  );

  const totalVertices = useMemo(
    () => countPolitiesVertices(polities),
    [polities]
  );

  const pushHistoryAndSet = (next: EditablePolity[]) => {
    setUndoStack((prev) => [...prev.slice(-24), politiesRef.current]);
    setRedoStack([]);
    setPolities(next);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, polities]);
    setUndoStack((u) => u.slice(0, -1));
    setPolities(prev);
    setStatusNote('已撤销上一笔擦写操作');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, polities]);
    setRedoStack((r) => r.slice(0, -1));
    setPolities(next);
    setStatusNote('已重做擦写操作');
  };

  const handleLoadSnapshot = (snapId: string) => {
    setBaseSnapshotId(snapId);
    if (snapId === '__blank__') {
      const fresh: EditablePolity = {
        polityId: 'ming-custom',
        polityName: '大明帝国（自定义擦写）',
        shortLabel: '大明',
        ruler: '朱元璋 / 朱棣',
        controlType: 'direct',
        color: '#B83B2A',
        borderColor: '#B83B2A',
        labelCoord: [118.8, 32.06],
        capitalName: '应天府',
        changeReason: '使用舆图画笔擦写工坊绘制',
        coordinates: [],
      };
      pushHistoryAndSet([fresh]);
      setActivePolityId(fresh.polityId);
      setStatusNote('已切换至空白舆图画布，可直接落笔涂抹政权版图');
      return;
    }

    const snap = TERRITORY_SNAPSHOT_BY_ID[snapId];
    if (!snap) return;
    const loaded = featureCollectionToPolities(snap.geojson);
    pushHistoryAndSet(loaded);
    setTargetYear(snap.meta.year);
    setSnapshotTitle(snap.meta.title);
    if (loaded[0]) setActivePolityId(loaded[0].polityId);
    setStatusNote(`已继承基准切片「${snap.meta.title}」（共 ${loaded.length} 个政权）`);
  };

  // Sync current polities GeoJSON onto MapLibre GPU sources
  const syncMapPolities = (list: EditablePolity[]) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const fc = politiesToFeatureCollection(list, 0);
    const terSrc = map.getSource('studio-territories') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (terSrc) terSrc.setData(fc);
    const lblSrc = map.getSource('studio-polity-labels') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (lblSrc) lblSrc.setData(buildPolityLabelGeoJSON(fc));
  };

  useEffect(() => {
    syncMapPolities(polities);
  }, [polities]);

  // Sync tool mode with MapLibre dragPan
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tool === 'pan') {
      map.dragPan.enable();
      map.getCanvas().style.cursor = 'grab';
    } else {
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
    }
  }, [tool]);

  // Sync Onion-Skin historical reference image overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const coords: [
      [number, number],
      [number, number],
      [number, number],
      [number, number]
    ] = [
      [onion.west, onion.north],
      [onion.east, onion.north],
      [onion.east, onion.south],
      [onion.west, onion.south],
    ];

    const existing = map.getSource('studio-onion-image') as
      | maplibregl.ImageSource
      | undefined;

    if (!onion.url) {
      if (map.getLayer('studio-onion-layer')) {
        map.removeLayer('studio-onion-layer');
      }
      if (existing) {
        map.removeSource('studio-onion-image');
      }
      return;
    }

    if (existing) {
      existing.updateImage({ url: onion.url, coordinates: coords });
    } else {
      map.addSource('studio-onion-image', {
        type: 'image',
        url: onion.url,
        coordinates: coords,
      });
      const beforeLayer = map.getLayer('studio-territories-fill')
        ? 'studio-territories-fill'
        : undefined;
      map.addLayer(
        {
          id: 'studio-onion-layer',
          type: 'raster',
          source: 'studio-onion-image',
          paint: {
            'raster-opacity': onion.visible ? onion.opacity : 0,
            'raster-fade-duration': 0,
          },
        },
        beforeLayer
      );
    }

    if (map.getLayer('studio-onion-layer')) {
      map.setPaintProperty(
        'studio-onion-layer',
        'raster-opacity',
        onion.visible ? onion.opacity : 0
      );
    }
  }, [onion]);

  // Initialize MapLibre GL Studio Canvas
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createHistoricalBaseStyle('xuanzhi', false, 'balanced'),
      center: [115.8, 33.4],
      zoom: 4.8,
      pitch: 0,
      bearing: 0,
      minZoom: 2.6,
      maxZoom: 12,
      attributionControl: false,
      localIdeographFontFamily:
        "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'Microsoft YaHei', serif",
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      'bottom-right'
    );

    map.dragPan.disable();
    map.getCanvas().style.cursor = 'crosshair';

    const updateBrushCursorPreview = (lngLat: LngLat | null) => {
      if (!styleReadyRef.current) return;
      const src = map.getSource('studio-brush-preview') as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!src) return;

      const features: GeoJSON.Feature[] = [];
      if (lngLat && toolRef.current !== 'pan') {
        const circleMp = buildBrushCirclePolygon(
          lngLat,
          radiusKmRef.current,
          32
        );
        const activeCol =
          politiesRef.current.find(
            (p) => p.polityId === activePolityIdRef.current
          )?.color ?? '#B83B2A';
        features.push({
          type: 'Feature',
          properties: {
            kind: 'cursor',
            color: toolRef.current === 'erase' ? '#EF4444' : activeCol,
          },
          geometry: {
            type: 'MultiPolygon',
            coordinates: circleMp as unknown as number[][][][],
          },
        });
      }

      if (isDrawingRef.current && strokePointsRef.current.length > 0) {
        const ribbonMp = buildBrushStrokeMultiPoly(
          strokePointsRef.current,
          radiusKmRef.current
        );
        const activeCol =
          politiesRef.current.find(
            (p) => p.polityId === activePolityIdRef.current
          )?.color ?? '#B83B2A';
        features.push({
          type: 'Feature',
          properties: {
            kind: 'stroke',
            color: toolRef.current === 'erase' ? '#EF4444' : activeCol,
          },
          geometry: {
            type: 'MultiPolygon',
            coordinates: ribbonMp as unknown as number[][][][],
          },
        });
      }

      src.setData({ type: 'FeatureCollection', features });
    };

    map.on('load', () => {
      styleReadyRef.current = true;
      const initFc = politiesToFeatureCollection(politiesRef.current, 0);
      const belowWater = map.getLayer('mountain-hillshade')
        ? 'mountain-hillshade'
        : map.getLayer('vector-water-fill')
        ? 'vector-water-fill'
        : undefined;

      map.addSource('studio-territories', { type: 'geojson', data: initFc });
      map.addLayer(
        {
          id: 'studio-territories-fill',
          type: 'fill',
          source: 'studio-territories',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'match',
              ['get', 'controlType'],
              'tributary-garrison',
              0.24,
              0.42,
            ],
          },
        },
        belowWater
      );
      map.addLayer(
        {
          id: 'studio-territories-outline',
          type: 'line',
          source: 'studio-territories',
          paint: {
            'line-color': ['coalesce', ['get', 'borderColor'], ['get', 'color']],
            'line-width': 2.2,
            'line-opacity': 0.92,
          },
        },
        belowWater
      );

      // Historical Ming rivers, Grand Canal, Great Wall & Places reference layers
      map.addSource('studio-waterways', {
        type: 'geojson',
        data: MING_WATERWAYS_GEOJSON,
      });
      map.addLayer({
        id: 'studio-waterways-line',
        type: 'line',
        source: 'studio-waterways',
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            'yellow-river-ming',
            '#B7791F',
            'grand-canal',
            '#0F766E',
            'great-wall',
            '#5C4938',
            '#3E7691',
          ],
          'line-width': ['match', ['get', 'kind'], 'great-wall', 2.2, 1.8],
          'line-opacity': 0.82,
        },
      });

      map.addSource('studio-landforms', {
        type: 'geojson',
        data: MING_LANDFORMS_GEOJSON,
      });

      map.addSource('studio-places', {
        type: 'geojson',
        data: PLACES_GEOJSON,
      });
      map.addLayer({
        id: 'studio-places-dot',
        type: 'circle',
        source: 'studio-places',
        paint: {
          'circle-radius': 3,
          'circle-color': '#9E2318',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFFDF9',
        },
      });
      map.addLayer({
        id: 'studio-places-label',
        type: 'symbol',
        source: 'studio-places',
        layout: {
          'text-field': ['get', 'label_both'],
          'text-size': 11,
          'text-offset': [0, 0.85],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': '#2B2118',
          'text-halo-color': 'rgba(252, 248, 238, 0.92)',
          'text-halo-width': 1.4,
        },
      });

      map.addSource('studio-polity-labels', {
        type: 'geojson',
        data: buildPolityLabelGeoJSON(initFc),
      });
      map.addLayer({
        id: 'studio-polity-labels-text',
        type: 'symbol',
        source: 'studio-polity-labels',
        layout: {
          'text-field': ['get', 'shortLabel'],
          'text-size': 15,
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': '#2B2118',
          'text-halo-color': 'rgba(252, 248, 238, 0.95)',
          'text-halo-width': 2,
        },
      });

      // Live Brush Cursor & Active Stroke Ribbon Preview Layer
      map.addSource('studio-brush-preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'studio-brush-preview-fill',
        type: 'fill',
        source: 'studio-brush-preview',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['match', ['get', 'kind'], 'stroke', 0.36, 0.16],
        },
      });
      map.addLayer({
        id: 'studio-brush-preview-line',
        type: 'line',
        source: 'studio-brush-preview',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    });

    const commitCurrentStroke = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const pts = strokePointsRef.current;
      strokePointsRef.current = [];
      if (pts.length === 0 || !activePolityIdRef.current) {
        updateBrushCursorPreview(null);
        return;
      }

      const t0 = performance.now();
      const prevPolities = politiesRef.current;
      const nextPolities = applyBrushStrokeToPolities({
        polities: prevPolities,
        activePolityId: activePolityIdRef.current,
        mode: toolRef.current === 'erase' ? 'erase' : 'paint',
        points: pts,
        radiusKm: radiusKmRef.current,
        lockCoastline: lockCoastlineRef.current,
        mutualExclusive: mutualExclusiveRef.current,
      });
      const dtMs = (performance.now() - t0).toFixed(1);

      setUndoStack((u) => [...u.slice(-24), prevPolities]);
      setRedoStack([]);
      setPolities(nextPolities);
      setStatusNote(
        `${
          toolRef.current === 'erase' ? '橡皮擦除' : '画笔涂抹扩张'
        }已完成（耗时 ${dtMs}ms${
          lockCoastlineRef.current ? ' · 海岸线自动锁边生效' : ''
        }${mutualExclusiveRef.current ? ' · 邻国互斥裁剪生效' : ''}）`
      );
      updateBrushCursorPreview(pts[pts.length - 1]);
    };

    map.on('mousedown', (e) => {
      if (toolRef.current === 'pan' || e.originalEvent.button !== 0) return;
      isDrawingRef.current = true;
      const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
      strokePointsRef.current = [pt];
      updateBrushCursorPreview(pt);
    });

    map.on('mousemove', (e) => {
      const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (isDrawingRef.current && toolRef.current !== 'pan') {
        const last = strokePointsRef.current[strokePointsRef.current.length - 1];
        if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 0.04) {
          strokePointsRef.current.push(pt);
        }
      }
      updateBrushCursorPreview(pt);
    });

    map.on('mouseup', () => {
      commitCurrentStroke();
    });

    const onWindowMouseUp = () => {
      if (isDrawingRef.current) commitCurrentStroke();
    };
    window.addEventListener('mouseup', onWindowMouseUp);

    mapRef.current = map;
    return () => {
      window.removeEventListener('mouseup', onWindowMouseUp);
      styleReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const updateActivePolityField = <K extends keyof EditablePolity>(
    key: K,
    val: EditablePolity[K]
  ) => {
    if (!activePolity) return;
    setPolities((prev) =>
      prev.map((p) =>
        p.polityId === activePolity.polityId ? { ...p, [key]: val } : p
      )
    );
  };

  const handleAddPolity = () => {
    const idx = polities.length + 1;
    const newId = `polity-custom-${Date.now().toString().slice(-4)}`;
    const color = PRESET_COLORS[idx % PRESET_COLORS.length];
    const center = mapRef.current?.getCenter();
    const created: EditablePolity = {
      polityId: newId,
      polityName: `新割据势力 ${idx}`,
      shortLabel: `新势力 ${idx}`,
      ruler: '统帅名',
      controlType: 'direct',
      color,
      borderColor: color,
      labelCoord: center
        ? [Number(center.lng.toFixed(4)), Number(center.lat.toFixed(4))]
        : [116.5, 34.0],
      capitalName: '治所',
      changeReason: '画笔新建擦写势力',
      coordinates: [],
    };
    pushHistoryAndSet([created, ...polities]);
    setActivePolityId(newId);
    setTool('paint');
    setStatusNote(`已新建政权「${created.shortLabel}」，直接在地图上涂抹即可生成疆域`);
  };

  const handleDeleteActivePolity = () => {
    if (!activePolity || polities.length <= 1) return;
    const next = polities.filter((p) => p.polityId !== activePolity.polityId);
    pushHistoryAndSet(next);
    setActivePolityId(next[0].polityId);
    setStatusNote(`已移除政权「${activePolity.shortLabel}」`);
  };

  const handleSimplifyNow = () => {
    const simplifiedFc = politiesToFeatureCollection(polities, simplifyTol);
    const next = featureCollectionToPolities(simplifiedFc);
    const beforeV = countPolitiesVertices(polities);
    const afterV = countPolitiesVertices(next);
    pushHistoryAndSet(next);
    setStatusNote(
      `拓扑简化完成（容差 ${simplifyTol}°）：顶点数由 ${beforeV} 精简至 ${afterV}`
    );
  };

  const handleExportGeoJSON = () => {
    const fc = politiesToFeatureCollection(polities, simplifyTol);
    const text = formatCompactGeoJSONString(fc) + '\n';
    downloadJsonBlob(`ter-${targetYear}.json`, text);
    setStatusNote(`已导出标准高精度 GeoJSON：ter-${targetYear}.json`);
  };

  const handleExportTopoJSON = () => {
    const fc = politiesToFeatureCollection(polities, simplifyTol);
    const topo = convertFeatureCollectionToTopoJSON(fc);
    const text = JSON.stringify(topo);
    downloadJsonBlob(`ter-${targetYear}.topo.json`, text);
    setStatusNote(
      `已导出高压缩弧段量化 TopoJSON：ter-${targetYear}.topo.json（${(
        text.length / 1024
      ).toFixed(1)} KB）`
    );
  };

  const handleCopyIndexMeta = async () => {
    const snippet = JSON.stringify(
      {
        snapshotId: `ter-${targetYear}`,
        year: targetYear,
        title: snapshotTitle,
        eraNote: activePolity?.changeReason || '由舆图画笔擦写工坊生成之历史疆域切片',
        effectiveRange: [targetYear, targetYear + 5],
        file: `ter-${targetYear}.json`,
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedMeta(true);
      setTimeout(() => setCopiedMeta(false), 2000);
      setStatusNote('已复制 data/territories/index.json 元数据条目至剪贴板');
    } catch {
      setStatusNote('剪贴板写入受限，请直接导出 GeoJSON / TopoJSON 文件');
    }
  };

  const handleImportGeoJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as GeoJSON.FeatureCollection;
        const imported = featureCollectionToPolities(parsed);
        if (imported.length > 0) {
          pushHistoryAndSet(imported);
          setActivePolityId(imported[0].polityId);
          setStatusNote(`已成功导入本地版图文件 ${file.name}（${imported.length} 个政权）`);
        }
      } catch {
        setStatusNote(`导入失败：${file.name} 不是合法的 GeoJSON FeatureCollection`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUploadOnionImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    setOnion((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { ...prev, url: objUrl, fileName: file.name, visible: true };
    });
    setStatusNote(
      `已叠印本地考据参考图「${file.name}」（纯浏览器内存处理，绝不上传外网）`
    );
    e.target.value = '';
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#EFE6D4] text-stone-900 select-none flex flex-col">
      {/* Top Studio Header Bar */}
      <header className="z-30 px-3 py-2 bg-[#FAF5E8] border-b border-amber-900/25 shadow-md flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="px-2.5 py-1.5 rounded-lg border border-amber-900/25 bg-white hover:bg-amber-50 text-xs font-serif font-bold flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#9E2318]" />
            <span>返回主舆图</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-[#9E2318] text-amber-50 font-serif font-bold text-xs flex items-center justify-center shadow-xs">
              制图
            </span>
            <div>
              <h1 className="font-serif font-bold text-sm leading-tight">
                舆图画笔擦写工坊 · Territory Painter
              </h1>
              <p className="text-[10px] opacity-70">
                海岸线自动锁边 · 多政权互斥布尔涂抹 · 考据底图半透明叠印 · TopoJSON 导出
              </p>
            </div>
          </div>
        </div>

        {/* Center Brush & Boolean Mode Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center rounded-xl border border-amber-900/25 bg-[#F3ECE0] p-0.5 text-xs"
            role="group"
            aria-label="画笔工具模式"
          >
            <button
              type="button"
              onClick={() => setTool('paint')}
              className={`px-2.5 py-1 rounded-lg font-serif font-bold flex items-center gap-1 cursor-pointer transition ${
                tool === 'paint'
                  ? 'bg-[#9E2318] text-amber-50 shadow-xs'
                  : 'hover:bg-amber-900/10'
              }`}
            >
              <Brush className="w-3.5 h-3.5" />
              <span>涂抹扩张</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('erase')}
              className={`px-2.5 py-1 rounded-lg font-serif font-bold flex items-center gap-1 cursor-pointer transition ${
                tool === 'erase'
                  ? 'bg-stone-800 text-amber-50 shadow-xs'
                  : 'hover:bg-amber-900/10'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>橡皮擦除</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('pan')}
              className={`px-2.5 py-1 rounded-lg font-serif font-bold flex items-center gap-1 cursor-pointer transition ${
                tool === 'pan'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'hover:bg-amber-900/10'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>漫游平移</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1 rounded-lg border border-amber-900/20">
            <span className="font-medium opacity-80">笔触半径</span>
            <input
              type="range"
              min={15}
              max={320}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-24 accent-[#9E2318] cursor-pointer"
            />
            <span className="font-bold tabular-nums w-12 text-right text-[#9E2318]">
              {radiusKm}km
            </span>
          </label>

          <label
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-amber-900/20 bg-white cursor-pointer"
            title="开启后，画笔涂入黄海、东海、南海时自动沿真实自然海岸线裁剪锁边"
          >
            <input
              type="checkbox"
              checked={lockCoastline}
              onChange={(e) => setLockCoastline(e.target.checked)}
              className="accent-[#9E2318] cursor-pointer"
            />
            <Lock className="w-3 h-3 text-teal-700" />
            <span className="font-medium">海岸线锁边</span>
          </label>

          <label
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-amber-900/20 bg-white cursor-pointer"
            title="开启后，涂抹扩张当前政权时自动从相邻政权裁剪重叠区，确保零重叠裂缝"
          >
            <input
              type="checkbox"
              checked={mutualExclusive}
              onChange={(e) => setMutualExclusive(e.target.checked)}
              className="accent-[#9E2318] cursor-pointer"
            />
            <span className="font-medium">邻国互斥裁剪</span>
          </label>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              className="p-1.5 rounded-lg border border-amber-900/20 bg-white hover:bg-amber-50 disabled:opacity-35 cursor-pointer"
              title="撤销上一笔"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              className="p-1.5 rounded-lg border border-amber-900/20 bg-white hover:bg-amber-50 disabled:opacity-35 cursor-pointer"
              title="重做"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Export & Import Toolbar */}
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.geojson"
            onChange={handleImportGeoJSONFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg border border-amber-900/25 bg-white hover:bg-amber-50 text-xs font-medium flex items-center gap-1 cursor-pointer"
            title="导入本地已有 GeoJSON 切片继续编辑"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">导入</span>
          </button>

          <button
            type="button"
            onClick={handleExportGeoJSON}
            className="px-2.5 py-1.5 rounded-lg border border-amber-900/30 bg-amber-950/8 hover:bg-amber-950/15 text-xs font-serif font-bold flex items-center gap-1 cursor-pointer"
            title="导出可直接放入 data/territories/ 的高精度 GeoJSON 文件"
          >
            <Download className="w-3.5 h-3.5 text-[#9E2318]" />
            <span>导出 GeoJSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportTopoJSON}
            className="px-2.5 py-1.5 rounded-lg bg-[#9E2318] hover:bg-[#821B12] text-amber-50 text-xs font-serif font-bold flex items-center gap-1 shadow-xs cursor-pointer"
            title="导出共享边界弧段量化的高压缩 TopoJSON 文件"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 TopoJSON</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Left Polity Inspector + Center MapLibre Canvas + Right Onion-Skin & Export Panel */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          aria-label="舆图画笔布尔擦写主画布"
        />

        {/* Left Floating Panel: Base Snapshot & Polity Layer Editor */}
        <aside className="fixed top-[62px] bottom-10 left-3 z-20 w-[300px] rounded-2xl border border-amber-900/25 bg-[#FAF5E8]/97 shadow-xl flex flex-col overflow-hidden text-xs">
          {/* Base Snapshot Selector */}
          <div className="p-3 border-b border-amber-900/15 space-y-2 shrink-0">
            <div className="font-serif font-bold text-xs flex items-center justify-between">
              <span>1. 继承基准年份版图切片</span>
              <span className="text-[10px] font-sans font-normal opacity-70 tabular-nums">
                {totalVertices} 顶点
              </span>
            </div>
            <select
              value={baseSnapshotId}
              onChange={(e) => handleLoadSnapshot(e.target.value)}
              aria-label="选择继承的基准历史切片"
              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-900/25 bg-white text-xs font-medium cursor-pointer"
            >
              {TERRITORY_INDEX.map((item) => (
                <option key={item.snapshotId} value={item.snapshotId}>
                  {item.year}年 · {item.title.split('·')[1]?.trim() ?? item.title}
                </option>
              ))}
              <option value="__blank__">✦ 新建全空白舆图画布</option>
            </select>

            <div className="grid grid-cols-3 gap-1.5">
              <label className="col-span-1">
                <span className="text-[10px] opacity-70 block">目标年份</span>
                <input
                  type="number"
                  value={targetYear}
                  onChange={(e) => setTargetYear(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white font-bold tabular-nums"
                />
              </label>
              <label className="col-span-2">
                <span className="text-[10px] opacity-70 block">切片标题</span>
                <input
                  type="text"
                  value={snapshotTitle}
                  onChange={(e) => setSnapshotTitle(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
                />
              </label>
            </div>
          </div>

          {/* Polity List */}
          <div className="p-3 border-b border-amber-900/15 space-y-1.5 shrink-0 max-h-[210px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold">
                2. 选择执笔涂抹政权 ({polities.length})
              </span>
              <button
                type="button"
                onClick={handleAddPolity}
                className="px-2 py-0.5 rounded-md bg-[#9E2318] text-amber-50 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>新增势力</span>
              </button>
            </div>

            <div className="space-y-1">
              {polities.map((pol) => {
                const isSelected = pol.polityId === activePolity?.polityId;
                return (
                  <button
                    key={pol.polityId}
                    type="button"
                    onClick={() => setActivePolityId(pol.polityId)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#9E2318]/12 border-[#9E2318] font-bold'
                        : 'border-transparent hover:bg-amber-900/6'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-xs border shrink-0"
                        style={{
                          backgroundColor: pol.color,
                          borderColor: pol.color,
                        }}
                      />
                      <span className="font-serif truncate">{pol.shortLabel}</span>
                    </span>
                    <span className="text-[10px] opacity-65 shrink-0">
                      {pol.controlType === 'tributary-garrison' ? '羁縻' : '直辖'} ·{' '}
                      {pol.coordinates.length} 块
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Polity Metadata Inspector */}
          {activePolity && (
            <div className="p-3 flex-1 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-[#9E2318]">
                  3. 当前选中政权属性与考据
                </span>
                {polities.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteActivePolity}
                    className="text-red-700 hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>删除</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <label className="col-span-2">
                  <span className="text-[10px] opacity-70 block">舆图简称</span>
                  <input
                    type="text"
                    value={activePolity.shortLabel}
                    onChange={(e) =>
                      updateActivePolityField('shortLabel', e.target.value)
                    }
                    className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white font-serif font-bold"
                  />
                </label>
                <label className="col-span-1">
                  <span className="text-[10px] opacity-70 block">版图色值</span>
                  <input
                    type="color"
                    value={activePolity.color}
                    onChange={(e) => {
                      updateActivePolityField('color', e.target.value);
                      updateActivePolityField('borderColor', e.target.value);
                    }}
                    className="w-full h-7 rounded border border-amber-900/20 bg-white cursor-pointer"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <label>
                  <span className="text-[10px] opacity-70 block">君主/统帅</span>
                  <input
                    type="text"
                    value={activePolity.ruler}
                    onChange={(e) =>
                      updateActivePolityField('ruler', e.target.value)
                    }
                    className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
                  />
                </label>
                <label>
                  <span className="text-[10px] opacity-70 block">都城/治所</span>
                  <input
                    type="text"
                    value={activePolity.capitalName}
                    onChange={(e) =>
                      updateActivePolityField('capitalName', e.target.value)
                    }
                    className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] opacity-70 block">统治形态</span>
                <select
                  value={activePolity.controlType}
                  onChange={(e) =>
                    updateActivePolityField(
                      'controlType',
                      e.target.value === 'tributary-garrison'
                        ? 'tributary-garrison'
                        : 'direct'
                    )
                  }
                  className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white"
                >
                  <option value="direct">直辖实控（深色实线边疆）</option>
                  <option value="tributary-garrison">
                    羁縻都司/藩属卫所（浅色虚线边疆）
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] opacity-70 block">
                  疆域伸缩“为啥”考据说明
                </span>
                <textarea
                  rows={3}
                  value={activePolity.changeReason}
                  onChange={(e) =>
                    updateActivePolityField('changeReason', e.target.value)
                  }
                  className="w-full px-2 py-1 rounded border border-amber-900/20 bg-white text-[11px] leading-relaxed"
                />
              </label>
            </div>
          )}
        </aside>

        {/* Right Floating Panel: Onion-Skin Reference Overlay & Topology Simplifier */}
        <aside className="fixed top-[62px] right-3 z-20 w-[290px] rounded-2xl border border-amber-900/25 bg-[#FAF5E8]/97 shadow-xl p-3 space-y-3 text-xs">
          {/* Onion-Skin Historical Reference Overlay */}
          <div className="space-y-2">
            <div className="font-serif font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#9E2318]" />
                <span>考据参考图半透明叠印描摹</span>
              </span>
              {onion.url && (
                <button
                  type="button"
                  onClick={() =>
                    setOnion((prev) => ({ ...prev, visible: !prev.visible }))
                  }
                  className="text-[11px] text-[#9E2318] font-bold hover:underline cursor-pointer"
                >
                  {onion.visible ? '隐藏叠图' : '显示叠图'}
                </button>
              )}
            </div>

            <input
              ref={onionInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadOnionImage}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => onionInputRef.current?.click()}
              className="w-full py-1.5 px-2.5 rounded-lg border border-dashed border-amber-900/35 bg-white hover:bg-amber-50 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#9E2318]" />
              <span className="truncate">
                {onion.fileName
                  ? `已载入：${onion.fileName}`
                  : '载入本地历史地图图片叠印描摹'}
              </span>
            </button>

            {onion.url && (
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[11px] opacity-75">叠印透明度</span>
                  <input
                    type="range"
                    min={0.05}
                    max={0.9}
                    step={0.05}
                    value={onion.opacity}
                    onChange={(e) =>
                      setOnion((p) => ({ ...p, opacity: Number(e.target.value) }))
                    }
                    className="w-32 accent-[#9E2318]"
                  />
                  <span className="tabular-nums font-bold">
                    {Math.round(onion.opacity * 100)}%
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <label>
                    <span className="opacity-70">西界经度 (W)</span>
                    <input
                      type="number"
                      step={0.5}
                      value={onion.west}
                      onChange={(e) =>
                        setOnion((p) => ({ ...p, west: Number(e.target.value) }))
                      }
                      className="w-full px-1.5 py-0.5 rounded border bg-white tabular-nums"
                    />
                  </label>
                  <label>
                    <span className="opacity-70">东界经度 (E)</span>
                    <input
                      type="number"
                      step={0.5}
                      value={onion.east}
                      onChange={(e) =>
                        setOnion((p) => ({ ...p, east: Number(e.target.value) }))
                      }
                      className="w-full px-1.5 py-0.5 rounded border bg-white tabular-nums"
                    />
                  </label>
                  <label>
                    <span className="opacity-70">南界纬度 (S)</span>
                    <input
                      type="number"
                      step={0.5}
                      value={onion.south}
                      onChange={(e) =>
                        setOnion((p) => ({ ...p, south: Number(e.target.value) }))
                      }
                      className="w-full px-1.5 py-0.5 rounded border bg-white tabular-nums"
                    />
                  </label>
                  <label>
                    <span className="opacity-70">北界纬度 (N)</span>
                    <input
                      type="number"
                      step={0.5}
                      value={onion.north}
                      onChange={(e) =>
                        setOnion((p) => ({ ...p, north: Number(e.target.value) }))
                      }
                      className="w-full px-1.5 py-0.5 rounded border bg-white tabular-nums"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Topology Simplification & Metadata Copy */}
          <div className="pt-2.5 border-t border-amber-900/15 space-y-2">
            <div className="font-serif font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>拓扑简化压缩与入库配置</span>
            </div>

            <label className="flex items-center justify-between gap-2 text-[11px]">
              <span className="opacity-80">RDP 简化容差</span>
              <select
                value={simplifyTol}
                onChange={(e) => setSimplifyTol(Number(e.target.value))}
                className="px-2 py-1 rounded border border-amber-900/20 bg-white"
              >
                <option value={0}>0°（保留原始全精度）</option>
                <option value={0.008}>0.008°（精细州府级 ~850m）</option>
                <option value={0.015}>0.015°（标准轻量化 ~1.5km）</option>
                <option value={0.025}>0.025°（极速全览级 ~2.7km）</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleSimplifyNow}
                className="py-1.5 px-2 rounded-lg border border-amber-900/25 bg-white hover:bg-amber-50 font-medium cursor-pointer"
              >
                立即简化顶点
              </button>
              <button
                type="button"
                onClick={handleCopyIndexMeta}
                className="py-1.5 px-2 rounded-lg border border-amber-900/25 bg-white hover:bg-amber-50 font-medium flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedMeta ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制索引JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Live Status Bar */}
      <footer className="z-30 h-8 px-4 bg-[#FAF5E8] border-t border-amber-900/20 flex items-center justify-between text-[11px]">
        <span className="font-medium text-stone-800 truncate">{statusNote}</span>
        <span className="opacity-65 shrink-0 hidden sm:inline">
          坐标系：WGS-84 [lng, lat] · 陆地掩膜：Natural Earth 10m CC0
        </span>
      </footer>
    </main>
  );
}
