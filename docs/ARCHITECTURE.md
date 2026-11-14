# 系统架构与技术实现说明 (`ARCHITECTURE.md`)

## 1. 总体分层架构

《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）采用**高精度矢量地理数据驱动 + WebGL 三维硬件加速 + 容器化就绪**的前后端解耦架构：

- **展现与交互层 (`src/components/`)**：
  - `header/TopAtlasBar.tsx`：全局时代定位、战役推演直达栏、3D 山川开关、古今地名切换（古称/双显/今名）、宣纸/玄墨双主题切换与要素图层控制。
  - `map/MingMapCanvas.tsx`：全屏三维历史舆图画布；所有 DOM 标记均挂载于零尺寸（`0x0`）无过渡锚点根容器并通过常驻字典原地刷新（杜绝缩放/飞行/悬停抖动），同时内置统一 60fps「战役自动运镜与渐进行军导演引擎」。
  - `drawer/EventDetailDrawer.tsx`：古典卷轴式「五维历史叙事」抽屉，集成时空定位、关联战役入口、「为啥会这样？」地理与制度双因子因果拆解（含前后向事件链跨时空跳转）、《明朝那些事儿》原著章节锚点与史实考据双栏对照。
  - `campaign/CampaignPlayer.tsx`：分幕战役行军推演控制台，驱动实时进度光带、倍速切换（`1x / 1.5x`）、多阶段兵力对比、3D 自动运镜巡航与各幕胜负手解读。
  - `timeline/TimelineBar.tsx` & `modals/BookTocModal.tsx`：编年滑块刻度尺与全书 7 部 157 章目录索引导航。
- **状态管理层 (`src/store/useAtlasStore.ts`)**：
  - 基于 `Zustand` 管理纯可序列化状态；`maplibregl.Map` 实例严格通过 `useRef` 隔离在画布组件内部，避免响应式代理损耗帧率。
- **WebGL 地图与推演引擎层 (`src/engine/` & `src/lib/curve.ts`)**：
  - `mapStyle.ts`：免商业 Token 多级高清开源矢量底图样式生成器（基于 OpenFreeMap `z0–z14` OpenMapTiles 矢量海岸线、岛屿、鄱阳湖/洞庭湖/太湖等真实湖泊与自然支流水系，配合淡墨水墨风 AWS Open Data Terrarium 3D 地形起伏，100% 剔除现代公路、铁路、建筑与现代国界）及离屏 Canvas 动态注册 SDF 战术矛头精灵。
  - `MingMapLayers.ts`：管理真实州府/山川拓扑归并的政权动态版图层（置于高清矢量水体层之下以确保江海湖岸无像素溢出）、明代真实历史水系层（Natural Earth 10m 实测水系 + 1194–1855 夺淮入海故黄河、京杭大运河、九边外墙与内三关明长城及沿河弯曲注记）、Catmull-Rom 样条渐进生长行军箭头与 60fps 动态先锋矛头。
- **开放结构化数据与契约层 (`data/` & `scripts/`)**：
  - 所有历史时空数据遵循 `src/lib/schemas.ts`（Zod）与 `scripts/validate-data.mjs` 自动化引用完整性、真实 GIS 顶点密度及版权合规检查。

## 2. 双阶段部署设计

1. **云原生静态/Serverless 预览（Vercel / CI）**：零环境变量依赖，推送 `main` 分支即可校验并更新在线生产环境。
2. **独立云服务器容器化生产部署（`deploy/`）**：`next.config.ts` 启用 `output: 'standalone'`，配合多阶段 `Dockerfile`、`docker-compose.yml` 与 `Caddyfile` 自动签发 HTTPS 证书并开启静态地理 JSON Zstd/Gzip 高压缩缓存。
