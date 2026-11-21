## 变更简述 (Summary)

<!-- 请简明说明本次 PR 新增或改进了什么（如：新增正德朝 3 条历史轶事 / 修正萨尔浒之战西路军路线 / 优化移动端布局） -->

## 变更类型 (Type of Change)

- [ ] 📜 历史事件 / 人物足迹数据扩充与考据修正 (`data/events/`, `data/characters/`, `data/geo-base/`)
- [ ] ⚔️ 战役分幕推演或历史疆域切片更新 (`data/campaigns/`, `data/territories/`)
- [ ] 🎨 地图渲染引擎 / 交互界面 / 性能优化 (`src/`)
- [ ] 📖 文档、测试或部署工具链改进 (`docs/`, `scripts/`, `deploy/`)

## 提交前自检清单 (Checklist)

- [ ] 我已阅读并遵守 [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) 中的坐标规范（WGS-84 `[lng, lat]`）与版权红线
- [ ] **版权合规确认**：本次提交的所有导读与解析文案均为原创总结，未整段摘抄《明朝那些事儿》原书受著作权保护的正文，也未包含任何受限/传染性协议数据
- [ ] 本地运行 `npm run check`（10 项数据与合规校验 + TypeScript 类型检查）全部通过
- [ ] 本地运行 `npm test` 与 `npm run build` 零报错通过
