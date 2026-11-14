# 明途 · 舆图纪 | Those Stories of Ming Map

> 以《明朝那些事儿》三百年叙事为脉络的**开源三维交互式历史地图、战役行军推演与历史因果图谱系统**  
> *An open-source 3D interactive historical atlas, campaign route replay engine, and causal graph inspired by "Those Stories of Ming" (1344–1662).*

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](./LICENSE)

## 项目简介 (Overview)

**《明途 · 舆图纪》（Those Stories of Ming Map）** 致力于解决阅读明史与《明朝那些事儿》时的“空间断裂感”与“因果迷茫感”。不同于仅展示静态疆域轮廓的传统历史地图，本项目通过**“五维一体”模型**深度还原元末群雄、大明十六帝至南明三百余年的风云变幻：

1. **动态疆域与割据格局**：基于史料考据与内置「舆图画笔擦写工坊」构建高压缩 TopoJSON 时序版图，区分实控省府与羁縻都司卫所。
2. **“为啥？”历史因果引擎**：结合 **WebGL 三维山川地形、明代夺淮入海古黄河、京杭大运河与九边关隘**，直观拆解每一场大战与国策背后的地缘锁钥与制度财政动因。
3. **动态行军路线与分幕推演**：支持多阵营主攻、迂回奇袭、撤退溃散、宝船海航动态箭头与分阶段战役播放器。
4. **大小事件双轨分级（LOD）**：宏观视野纵览定鼎国运之大事件，微观缩放探索市井奇闻与人物微光之小事件。
5. **原著章节映射与史实对照**：精准对接全书 7 部 · 16 帝篇 · 156+ 章目录锚点，提供原创「明月视角导读」与「正史考据补充」。

## 目录结构 (Repository Layout)

```text
Those-Stories-of-Ming-map/
├── data/               # 标准化历史地理与五维事件开放数据集 (JSON / TopoJSON)
├── src/                # Next.js + TypeScript + MapLibre GL 核心源码与擦写工坊
├── public/             # 静态地图样式、图标与公开资源
├── scripts/            # Node.js 数据 Schema 校验与地图拓扑构建脚本
├── deploy/             # Docker Compose + Caddy 独立服务器生产部署配置
└── docs/               # 架构设计与社区数据贡献指南
```

## 版权与开源合规声明 (Copyright & Compliance)

- **代码许可**：本项目全部源代码采用 [MIT License](./LICENSE) 100% 独立自研开源。
- **文本合规**：本仓库**不包含、不分发**《明朝那些事儿》原书任何受版权保护的正文全文；仓库内仅包含客观历史时空坐标、章节目录编号锚点及项目团队独立撰写的历史解析与导读文案。
- **地理数据致谢**：基础自然地理掩膜源自公共领域 Natural Earth 数据；历史政区考据参考《中国历史地图集》及哈佛-复旦 CHGIS 学术规范。
