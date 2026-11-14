# Repository Agent Instructions (`Those-Stories-of-Ming-map`)

欢迎接手《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）开源仓库！

## 必读上下文（零提问启动）

如果你在顶层工作空间 `G:\王朝` 下运行，请**第一时间阅读以下三份核心文档**（无需向用户重复询问背景或规划）：

1. **无缝交接手册（最高优先级）**：`../docs-workspace/03-Agent无缝交接手册.md`
2. **第一阶段详细实施细则（WBS 与验收标准）**：`../docs-workspace/02-第一阶段详细实施细则.md`
3. **项目总体规划与最终交付定义**：`../docs-workspace/01-项目总体规划与最终交付定义.md`

## 仓库级铁律速览

1. **严禁版权与私有文件入库**：原书电子书与私有参考文件位于本仓库外部的 `../local-private/`，**严禁**复制到本仓库或通过 `git add` 提交。
2. **100% 原创自研（MIT License）**：严禁从任何 `GPL` 协议项目（如 `jiangshan-map`）复制代码、样式或受限图层文件。
3. **全 Node.js 脚本工具链**：当前开发机已安装 `Node.js v24` 与 `npm 11`，**未安装 Python**。`scripts/` 下所有脚本必须使用 Node.js (`.mjs` / `.ts`) 编写。
4. **地理坐标铁律**：所有 GeoJSON / TopoJSON 坐标统一采用标准 **`WGS-84 (EPSG:4326)` `[lng, lat]`（经度在前，纬度在后）**，严禁混入 GCJ-02 或 BD-09 偏移坐标。
5. **双阶段部署兼容**：架构须保持静态优先与标准容器化兼容（`deploy/` Docker 方案），禁止强依赖某单一云厂商的闭源私有存储，确保 12 月可零重构迁移至独立云服务器与自定义域名。
