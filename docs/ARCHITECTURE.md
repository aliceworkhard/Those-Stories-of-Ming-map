# 系统架构与技术实现说明 (`ARCHITECTURE.md`)

## 1. 总体分层架构

《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）采用**高精度矢量地理数据驱动 + WebGL 三维硬件加速 + 容器化就绪**的前后端解耦架构：

- **展现与交互层 (`src/components/`)**：
  - `header/TopAtlasBar.tsx`：全局时代定位、**「🎬 全史运镜推演」主入口**、战役运镜推演直达栏、3D 山川开关、古今地名切换（古称/双显/今名）、宣纸/玄墨双主题切换与要素图层控制。
  - `directory/EventDirectoryPanel.tsx`：**左侧独立《事件目录》检索面板**，支持关键词全文检索（事件、人物、古今地名、年份）、分类标签筛选（全部 / 大事 / 轶事 / 战役）与编年聚焦定位，与右侧详情抽屉物理分离、互不遮挡。
  - `drawer/EventDetailDrawer.tsx`：**右侧独立《事件详情》五维叙事抽屉**，专注呈现单一事件的时空定位、关联战役入口、「为啥会这样？」地理与制度双因子因果拆解（含前后向事件链跨时空跳转）、《明朝那些事儿》原著章节锚点与史实考据双栏对照及上一站/下一站/从此开启运镜推演控制条。
  - `tour/StoryTourPlayer.tsx`：**全史自动运镜推演悬浮导演台**，实时展示全书编年巡礼站点进度、倍速切换（`1x / 1.5x`）、前后跳站与一键切入战役行军推演。
  - `campaign/CampaignPlayer.tsx`：**分幕战役行军运镜推演控制台**，驱动实时进度光带、**三档运镜模式切换（`跟随行军运镜 | 全景环绕运镜 | 自由视角`）**、倍速切换（`1x / 1.5x`）、多阶段兵力对比与各幕胜负手解读。
  - `map/MingMapCanvas.tsx`：全屏三维历史舆图画布，内置三大核心引擎：
    1. **零抖动常驻锚点系统**：所有 DOM 标记均挂载于零尺寸（`0x0`）无 CSS 过渡锚点容器并通过常驻字典原地刷新，彻底杜绝缩放/飞行/悬停跳动。
    2. **屏幕空间蛛网散开（Spiderfy）+ 四象限 2D AABB 碰撞避让求解器（`runScreenSpaceLayout`）**：对同城共址事件（如应天府、北平府多起事件）自动按像素环散开并绘制虚线牵引丝，再按优先级对政权大印、战役震波、战术路标、事件标签与城池古今地名执行四象限包围盒避让，确保任意缩放层级下文字零重叠。
    3. **统一 60fps 双模三维自动运镜导演引擎**：战役模式下支持沿 Catmull-Rom 行军曲线实时追踪先锋箭头或战区全景环绕；全史巡礼模式下飞抵事件地标后自动执行平滑三维山川环绕运镜并推进编年。
  - `timeline/TimelineBar.tsx` & `modals/BookTocModal.tsx`：带「▶ 运镜推演」快捷开关的编年滑块刻度尺与全书 7 部 157 章目录索引导航。
- **状态管理层 (`src/store/useAtlasStore.ts`)**：
  - 基于 `Zustand` 管理纯可序列化状态（含独立左右面板开关、全史运镜推演状态、战役运镜模式等）；`maplibregl.Map` 实例严格通过 `useRef` 隔离在画布组件内部，避免响应式代理损耗帧率。
- **WebGL 地图与推演引擎层 (`src/engine/` & `src/lib/curve.ts`)**：
  - `mapStyle.ts`：免商业 Token 多级高清开源矢量底图样式生成器（基于 OpenFreeMap `z0–z14` OpenMapTiles 矢量海岸线、岛屿、鄱阳湖/洞庭湖/太湖等真实湖泊与自然支流水系，配合淡墨水墨风 AWS Open Data Terrarium 3D 地形起伏，100% 剔除现代公路、铁路、建筑与现代国界）及离屏 Canvas 动态注册 SDF 战术矛头精灵。
  - `MingMapLayers.ts`：管理真实州府/山川拓扑归并的政权动态版图层（置于高清矢量水体层之下以确保江海湖岸无像素溢出）、明代真实历史水系层（Natural Earth 10m 实测水系 + 1194–1855 夺淮入海故黄河、京杭大运河、九边外墙与内三关明长城及沿河弯曲注记）、Catmull-Rom 样条渐进生长行军箭头与 60fps 动态先锋矛头。
- **开放结构化数据与契约层 (`data/` & `scripts/`)**：
  - 所有历史时空数据遵循 `src/lib/schemas.ts`（Zod）与 `scripts/validate-data.mjs` 自动化引用完整性、真实 GIS 顶点密度及版权合规检查。

## 2. 双阶段部署设计

1. **云原生 Git 自动持续部署（GitHub -> Vercel Production）**：仓库内置 `vercel.json`，零环境变量依赖，每次向 `main` 分支推送代码自动运行 `npm run check && npm run build` 并更新在线生产环境 `https://those-stories-of-ming-map.vercel.app`。
2. **独立云服务器容器化生产部署（`deploy/`）**：`Dockerfile` 自动注入 `DOCKER_STANDALONE=1` 构建 Next.js Standalone 镜像，配合 `docker-compose.yml` 与 `Caddyfile` 自动签发免费 HTTPS 证书并开启静态地理 JSON Zstd/Gzip 高压缩缓存。
