# 开源社区贡献指南 (`CONTRIBUTING.md`)

欢迎各位明史爱好者、GIS 开发者与《明朝那些事儿》读者共同完善《明途 · 舆图纪》！无需精通复杂 WebGL 代码，只需按规范编辑 JSON 数据即可提交新的历史大小事件或战役路线。

## 1. 本地零配置启动

确保本机已安装 **Node.js >= 20** 与 **npm**：

```bash
git clone https://github.com/aliceworkhard/Those-Stories-of-Ming-map.git
cd Those-Stories-of-Ming-map
npm install
npm run dev
```

浏览器打开 `http://localhost:3000` 即可预览完整三维地图。

## 2. 贡献新历史事件或战役路线流程

1. 阅读数据契约说明：[`data/schemas/README.md`](../data/schemas/README.md)。
2. 查阅全书章节锚点 ID：在 `data/chapters/toc.json` 中找到事件对应的章节 `id`（例如 `"v1-zhu-yuanzhang-ch12"`）。
3. 确认地点坐标：优先复用 `data/geo-base/ming-places.json` 中的 `placeId`，或按 **WGS-84 `[经度 lng, 纬度 lat]`** 新增历史地点（切勿使用 GCJ-02/BD-09 偏移坐标）。
4. 编写五维事件条目：补充 `summary`、`why.geoFactor`（地理原因）、`why.systemFactor`（制度局势原因）以及原创撰写的 `bookLens.mingyuePerspective` 与 `bookLens.historicalNote`。
5. 提交前运行本地校验：

```bash
npm run check
npm run build
```

## 3. 版权与开源红线（必读）

- **严禁粘贴原书正文**：请使用您自己独立总结的语言撰写导读与事件解析，严禁大段摘抄《明朝那些事儿》原书受著作权保护的正文，更不可提交任何电子书文件。
- **严禁引入受传染代码/受限图层**：本仓库采用 `MIT License`，请勿复制任何 `GPL` 协议项目的源码或禁止二次分发的商业/受限地理数据。
