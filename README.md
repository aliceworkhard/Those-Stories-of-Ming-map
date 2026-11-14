# 明途 · 舆图纪 | Those Stories of Ming Map

> 以《明朝那些事儿》三百年叙事为脉络的**开源三维交互式历史地图、战役行军推演与历史因果图谱系统**  
> *An open-source 3D interactive historical atlas, dynamic campaign route replay engine, and causal graph inspired by "Those Stories of Ming" (1344–1662).*

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-3D_WebGL-2962FF)](https://maplibre.org/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel_Online-B83B2A)](https://those-stories-of-ming-map.vercel.app)

🌐 **在线体验地址（Live Preview）**：**https://those-stories-of-ming-map.vercel.app**

---

## 核心特性 (Key Features)

1. **动态政权疆域与虚实分层**：基于海岸线锁边裁剪与拓扑互斥构建多时期历史版图，区分直辖实控州府与塞外羁縻都司卫所，悬停即看当期版图伸缩成因。
2. **「为啥会这样？」历史因果与地缘引擎**：打破只记流水账的传统地图，每个事件均从 **三维山川水系锁钥** 与 **财政军事制度动因** 双维度拆解深层逻辑，并支持 `[<- 前因事件]` 与 `[深远后果 ->]` 跨时空飞跃追踪（如从 1399 大宁内迁一键追踪至 47 年后的 1449 土木堡之变）。
3. **多阵营动态行军箭头与分幕战役播放器**：支持主力进军、迂回奇袭脉冲虚线、败退溃散线、水师战船航线、粮道补给线及围城/决战震波标记，配合 3D 镜头自动运镜逐幕推演 **《洪都与鄱阳湖决战》《平吴与洪武大北伐》《奉天靖难四载夺天下》** 等经典战役。
4. **明代真实历史地理还原**：准确呈现 **明代“夺淮入海”古黄河故道（1194–1855）**、京杭大运河漕运命脉、明长城九边防线，支持 **`[古称 | 古今双显 | 今名]`** 一键穿透对照，剔除一切现代公路与商业地标干扰。
5. **大小事件 LOD 分级与原著双视角对照**：宏观视野看定鼎国运之大事件，放大地图或开启开关浮现鲜活有趣的历史小事件；精准锚定全书 **7 部 · 157 章**目录索引，同步呈现原创「当年明月叙事导读」与「《明史》《明实录》考据补遗」。

---

## 零配置快速启动 (Quickstart)

本项目无需申请任何商业地图付费 API Key，克隆后即可直接运行：

```bash
git clone https://github.com/aliceworkhard/Those-Stories-of-Ming-map.git
cd Those-Stories-of-Ming-map
npm install
npm run dev
```

打开 `http://localhost:3000` 即可开始体验。

### 常用工程脚本

- `npm run dev`：启动本地开发服务器
- `npm run validate:data`：校验全部历史事件、战役路线、古今地名、章节锚点交叉引用及版权合规红线
- `npm run check`：执行数据校验 + TypeScript 严格类型检查
- `npm run build`：生成生产环境优化构建包

### 独立服务器 Docker 部署 (`deploy/`)

仓库内置面向独立云服务器与自定义域名的开箱即用容器化方案（含 Caddy 自动申请免费 HTTPS 证书）：

```bash
cd deploy
DOMAIN=mingmap.example.com docker compose up -d --build
```

---

## 文档导航 (Documentation)

- [系统架构说明 (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
- [核心数据契约规范 (`data/schemas/README.md`)](./data/schemas/README.md)
- [社区贡献指南 (`docs/CONTRIBUTING.md`)](./docs/CONTRIBUTING.md)

---

## 版权与开源声明 (License & Compliance)

- **源代码**：采用 [MIT License](./LICENSE) 100% 独立自研开源。
- **书籍版权尊重**：本仓库**不包含、不分发**《明朝那些事儿》原书任何受著作权保护的正文全文；仓库内仅收录客观历史时空坐标、章节目录编号锚点及项目独立撰写的历史解析与导读文案。
