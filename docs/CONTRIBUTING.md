# 开源社区贡献指南 (`docs/CONTRIBUTING.md`)

欢迎各位《明朝那些事儿》书友、明史考据爱好者、历史地图发烧友与前端 / GIS 开发者参与共建 **《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）**！

**即使你完全不熟悉 WebGL 或 React 代码**，只要会编辑 JSON 文本或使用我们内置的可视化画笔工具，就可以轻松提交新的**大明历史事件、人物轶事、战役行军路线、人物一生足迹或更精细的年份疆域切片**！

---

## 一、四步本地运行与校验

确保已安装 **Node.js >= 20**（推荐 v22 / v24 LTS）与 **npm**（无需申请任何商业地图 API Key，无需安装 Python）：

```bash
git clone https://github.com/aliceworkhard/Those-Stories-of-Ming-map.git
cd Those-Stories-of-Ming-map
npm install
npm run dev
```

- 主站舆图预览：`http://localhost:3000`
- 舆图画笔擦写工坊：`http://localhost:3000/dev/territory-painter`

在提交 Pull Request 前，请务必运行以下全量检查命令并确保 100% 通过：

```bash
npm run check      # 运行 10 项数据集契约/版权红线校验 + TypeScript 严格类型检查
npm test           # 运行全史年份连续性、局部差分几何与战役/人物引擎回归测试
npm run build      # 验证生产环境构建零报错
```

---

## 二、常见贡献场景与标准 JSON 模板

完整字段规范请同时参阅 [`data/schemas/README.md`](../data/schemas/README.md)。所有地理坐标一律使用 **`WGS-84 (EPSG:4326)`** 标准经纬度，数组顺序永远为 **`[经度 lng, 纬度 lat]`**（保留 4 位小数即可，切勿使用高德/百度偏移坐标）。

### 场景 A：补充一条新的《明朝那些事儿》大小事件 (`data/events/*.json`)

1. 在 `data/chapters/toc.json` 中查出对应原著章节的锚点 `id`（例如 `"v4-zhu-houcong-ch08"`）。
2. 在 `data/geo-base/ming-places.json` 中查找已有地点 `id`（若为新地点，先在 `ming-places.json` 补充一条古今地名对照记录）。
3. 按对应时代文件（如 `era-mid-ming.json`、`era-wanli-reform.json` 等）添加五维事件对象：

```json
{
  "id": "evt-1550-gengxu-example",
  "title": "事件简明标题（建议 8~16 字）",
  "tier": "micro",
  "category": "anecdote",
  "time": {
    "year": 1550,
    "month": 8,
    "display": "嘉靖二十九年八月（1550年）",
    "reignTitle": "嘉靖"
  },
  "location": {
    "placeId": "beiping",
    "ancientName": "京师顺天府",
    "modernName": "北京市",
    "coordinates": [116.4074, 39.9042]
  },
  "camera": {
    "center": [116.41, 39.95],
    "zoom": 6.5,
    "pitch": 38,
    "bearing": 0
  },
  "summary": "用两三句话概括该事件的来龙去脉与关键转折。",
  "actors": ["核心人物A", "核心人物B"],
  "why": {
    "geoFactor": "【山川地缘锁钥】从地形、水系、关隘、气候或粮道距离解释为什么发生在这里。",
    "systemFactor": "【制度与局势动因】从财政、军制、朝局博弈解释为什么会演变成这样。",
    "prevEventIds": ["上游前因事件ID"],
    "nextEventIds": ["下游后果事件ID"]
  },
  "bookLens": {
    "chapterIds": ["v4-zhu-houcong-ch08"],
    "mingyuePerspective": "用风趣犀利的原创语言提炼当年明月在该章的叙事切入点与人物洞察（严禁整段照抄原书正文！）。",
    "historicalNote": "对照《明史》《明实录》等史料补充准确的年月日、兵力数字或学界考据。"
  }
}
```

### 场景 B：用「舆图画笔擦写工坊」绘制或精修历史疆域切片

1. 启动本地开发服后访问 `http://localhost:3000/dev/territory-painter`。
2. 在左侧选择要继承的基准年份切片（如 `1582`），加载本地考据参考图开启半透明叠印（Onion-Skin Overlay）。
3. 使用「涂抹扩张画笔」或「橡皮擦」修改边界——工坊会自动贴合真实海岸线锁边并裁剪相邻政权零重叠边界。
4. 点击导出 `GeoJSON` 放入 `data/territories/ter-XXXX.json`，并在 `data/territories/index.json` 注册 `effectiveRange`（注意保持 `1344–1662` 年份区间连续无空洞）。

### 场景 C：新增分幕战役推演 (`data/campaigns/*.json`) 或人物足迹 (`data/characters/odysseys.json`)

- **战役推演**：每幕（`phase`）下的 `routes` 数组请显式填写 `"order": 1, 2, 3...` 标明战术先后次序，并在 `src/lib/atlasData.ts` 导入注册。
- **人物足迹**：在 `data/characters/odysseys.json` 中按时间先后顺序列出至少 3 个关键人生驿站（`stops`），可关联已有 `eventId` 实现点击驿站同步联动右侧五维事件抽屉。

---

## 三、版权与开源协议铁律（提交 PR 必守红线）

1. **严禁提交任何受版权保护的原书内容**：
   - 严禁向仓库提交任何 `.txt / .epub / .mobi / .pdf` 电子书文件（`npm run validate:data` 会自动扫描拦截）；
   - `mingyuePerspective` 与 `summary` 必须由贡献者**独立总结撰写**，单处引用原书标志性短句不得超过 30 字并须加引号，严禁整段粘贴原书原文。
2. **保持 MIT 纯净合规**：
   - 严禁复制 `GPL` / `AGPL` 协议项目的代码或附带商业限制条款的第三方底图数据。
3. **代码风格**：
   - 本仓库脚本统一使用 **Node.js ESM (`.mjs`)** 与 **TypeScript (`strict: true`)**，不引入 Python 依赖，确保跨平台零门槛运行。
