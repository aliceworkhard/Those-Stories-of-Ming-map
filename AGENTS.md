# Repository Agent & Contributor Guide (`Those-Stories-of-Ming-map`)

欢迎来到 **《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）** 开源仓库！本仓库 100% 完整开源（MIT License），包含全部三维 WebGL 制图引擎、内置 `/dev/territory-painter` 画笔擦写工坊、全七部历史时空数据集与 Docker 独立部署套件。

## 1. 核心架构与贡献文档导航

1. **[系统架构说明 (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)**：纯 WebGL 零 DOM Marker 符号层、纯局部布尔差分疆域涂抹引擎、静止路线 + 动态/静态箭矢切换与性能优化架构。
2. **[数据契约规范 (`data/schemas/README.md`)](./data/schemas/README.md)**：章节锚点、历史疆域、五维事件、分幕战役、人物一生足迹与制度图层的完整 Schema 定义。
3. **[社区贡献指南 (`docs/CONTRIBUTING.md`)](./docs/CONTRIBUTING.md)**：零代码补充历史事件 JSON 模板、使用 `/dev/territory-painter` 擦写疆域与本地校验流程。
4. **[独立服务器部署手册 (`deploy/README.md`)](./deploy/README.md)**：Docker Standalone + Caddy 自动免费 HTTPS 生产部署指南。

## 2. 开发与提交铁律

1. **版权合规红线**：严禁向仓库提交任何受著作权保护的原书电子书文件（`.txt / .epub / .mobi / .pdf`）或整段照抄原书正文；导读与历史因果解析须保持原创总结。
2. **100% 纯净 MIT 协议**：严禁复制任何 `GPL` / `AGPL` 项目的源码或带有商业/分发限制的地理数据。
3. **Node.js 工具链**：`scripts/` 下所有校验与回归测试脚本均采用 Node.js ESM (`.mjs`) 编写，无需安装 Python。
4. **标准地理坐标系**：所有 GeoJSON / TopoJSON 统一使用 **`WGS-84 (EPSG:4326)` `[lng, lat]`（经度在前，纬度在后）**。
5. **提交前必跑检查**：运行 `npm run check`（全量数据校验 + TypeScript 类型检查 + 引擎回归测试）与 `npm run build` 确保零报错。
