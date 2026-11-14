# 系统架构与技术实现说明 (`ARCHITECTURE.md`)

## 1. 总体分层架构

《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）采用**静态数据驱动 + WebGL 三维硬件加速 + 容器化就绪**的轻量前后端解耦架构：

- **展现与交互层 (`src/components/`)**：
  - `header/TopAtlasBar.tsx`：全局时代定位、战役推演直达栏、3D 山川开关、古今地名切换（古称/双显/今名）、宣纸/玄墨双主题切换与要素图层控制。
  - `drawer/EventDetailDrawer.tsx`：古典卷轴式「五维历史叙事」抽屉，集成时空定位、关联战役入口、「为啥会这样？」地理与制度双因子因果拆解（含前后向事件链跨时空跳转）、《明朝那些事儿》原著章节锚点与史实考据双栏对照。
  - `campaign/CampaignPlayer.tsx`：分幕战役行军推演控制器，驱动多阶段兵力对比、自动镜头巡航（`flyTo`）与各幕胜负手解读。
  - `timeline/TimelineBar.tsx` & `modals/BookTocModal.tsx`：编年滑块刻度尺与全书 7 部 157 章目录索引导航。
- **状态管理层 (`src/store/useAtlasStore.ts`)**：
  - 基于 `Zustand` 管理纯可序列化状态；`maplibregl.Map` 实例严格通过 `useRef` 隔离在画布组件内部，避免响应式代理损耗帧率。
- **WebGL 地图与推演引擎层 (`src/engine/` & `src/lib/curve.ts`)**：
  - `mapStyle.ts`：免商业 Token 开源底图样式生成器（统一渲染全球自然陆地轮廓以消除现代国界/公路杂音 + AWS Open Data Terrarium 高程瓦片驱动 3D 山脉地形与山体阴影）及离屏 Canvas 动态注册 SDF 战术矛头精灵。
  - `MingMapLayers.ts`：管理政权动态版图层（区分直辖实控与羁縻卫所）、明代历史水系层（1194–1855 夺淮入海古黄河、京杭大运河、大江、古湖泊、九边长城）、Catmull-Rom 平滑样条行军曲线与 60fps 动态先锋流光箭头。
- **开放结构化数据与契约层 (`data/` & `scripts/`)**：
  - 所有历史时空数据遵循 `src/lib/schemas.ts`（Zod）与 `scripts/validate-data.mjs` 自动化引用完整性及版权合规检查。

## 2. 双阶段部署设计

1. **云原生静态/Serverless 预览（Vercel / CI）**：零环境变量依赖，推送 `main` 分支自动触发校验与在线预览更新。
2. **独立云服务器容器化生产部署（`deploy/`）**：`next.config.ts` 启用 `output: 'standalone'`，配合多阶段 `Dockerfile`、`docker-compose.yml` 与 `Caddyfile` 自动签发 HTTPS 证书并开启静态地理 JSON Zstd/Gzip 高压缩缓存。
