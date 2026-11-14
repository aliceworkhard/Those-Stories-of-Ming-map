# 系统架构与技术实现说明 (`ARCHITECTURE.md`)

## 1. 总体分层与硬件效能架构

《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）采用**全 GPU 矢量制图管线 + 按需零闲置导演引擎 + 容器化就绪**的高效能架构：

### A. 硬件渲染减负五大机制
1. **按需零闲置帧调度（On-Demand Zero-Idle RAF）**：`MingMapCanvas.tsx` 仅在「全史自动运镜推演」或「战役行军动画」实际播放期间挂载 `requestAnimationFrame`，静止阅读与后台标签页（`visibilitychange`）下帧循环 **100% 休眠（0 FPS / 0% 闲置 CPU·GPU 占用）**。
2. **双源分离高程缓存（`hillshade-dem` vs `terrain-dem`）**：严格遵循 MapLibre 官方最佳实践，将 2.5D 青绿矿物山体阴影源（`maxzoom: 8`，全东亚仅需数张瓦片）与 3D 地形网格源（`maxzoom: 9/11`）独立分离，彻底消除高程纹理反复解码抖动，并限制 `maxPitch: 54°` 与瓦片池上限（`maxTileCacheSize`）。
3. **三档硬件性能模式（`均衡 / 省电 / 极致`）**：动态调节 WebGL `pixelRatio`（`1.0 / 1.5 / 2.0`）、三维地形夸张度及动态流光采样频率（行军路线生长完毕后立即冻结线要素顶点缓冲区，仅做低开销先锋点采样）。
4. **零高斯模糊合成（Zero `backdrop-blur` over WebGL）与零全局脉冲重绘**：移除覆盖在 WebGL 画布之上的多层面板 `backdrop-filter` 与多节点无限 `animate-ping`，改用高质感不透明宣纸/玄漆面板与静态双环印记，大幅降低 2K/4K 高刷屏下的浏览器 Skia 合成器负载。
5. **静态地理注记全量下沉 GPU（C++/WebWorker 符号碰撞）**：40 处战略城池关隘（支持 `古称 / 双显 / 今名` 毫秒级 GPU 表达式切换）、22 处名山大川湖海脊线注记与政权国号大印全部由 MapLibre 原生 WebGL `symbol` 图层渲染，DOM 节点数量精简 65% 以上。

### B. 东方青绿山水 × 玄墨数字沙盘可视化层 (`src/engine/` & `src/components/`)
- **三层政权疆界带（内晕外实）与悬停题跋**：由底层宣纸设色洗染 + 内侧政权色晕疆界带 + 外侧双线实/虚国界构成，配合 `TerritoryLegendCard.tsx` 实现悬停政权高亮与版图伸缩考据题跋展示。
- **地图级跨时空历史因果飞弧（`causal-arcs`）**：选中任意历史事件时，自动在地图上绘制连接前因事件（琥珀金虚线飞弧）与深远后果事件（朱砂红流光飞弧）的平滑曲线，直观呈现空间地缘与时间因果的交织。
- **四层军略行军箭矢**：战役模式下由高对比外廓衬线、阵营流光主干、等距战术箭羽与动态先锋矛头组成。
- **单行轻量化顶栏与一键「沉浸观图」**：`TopAtlasBar.tsx` 聚合全史运镜推演、战役推演下拉面板、沉浸观图开关、3D 山川、古今地名与硬件性能档位；左右分立瘦身版 `EventDirectoryPanel.tsx` 与 `EventDetailDrawer.tsx`。

## 2. 双阶段部署设计

1. **云原生 Git 自动持续部署（GitHub -> Vercel Production）**：仓库内置 `vercel.json`，每次推送 `main` 分支自动校验并更新在线生产环境 `https://those-stories-of-ming-map.vercel.app`。
2. **独立云服务器容器化生产部署（`deploy/`）**：`Dockerfile` 自动构建 Next.js Standalone 镜像，配合 `docker-compose.yml` 与 `Caddyfile` 自动签发免费 HTTPS 证书。
