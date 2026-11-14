# 核心领域数据契约规范 (`data/schemas`)

本目录存放《明途 · 舆图纪》所有开放历史与地理数据的 JSON Schema / Zod 契约说明。所有 `data/` 下的数据文件均须通过 `scripts/validate-data.mjs` 自动化校验。

## 通用约定

- **坐标系**：统一采用 `WGS-84 (EPSG:4326)`，点位格式为 `[lng, lat]`（经度在前，纬度在后，保留 4–5 位小数）。
- **时间表示**：`year` 使用公元纪年整数（如 `1363`），可选 `month` (`1-12`)、`reignTitle`（年号，如 `"至正二十三年"` / `"建文元年"`）。
- **版权红线**：严禁在任何字段中粘贴《明朝那些事儿》原书大段正文；`mingyuePerspective` 必须为原创提炼的叙事视角导读总结。

## 五大核心实体定义

### 1. `ChapterAnchor` (`data/chapters/toc.json`)
全书目录锚点字典，供事件精准关联章节：
- `id`: 字符串唯一标识（如 `"v1-zhu-yuanzhang-ch12"`）
- `volumeNo`: `1..7`（对应 壹~柒 部）
- `volumeTitle`: 如 `"壹 洪武大帝"`
- `emperorSection`: 如 `"朱元璋篇"`
- `chapterNo`: 章节序号整数
- `chapterTitle`: 如 `"第十二章 鄱阳湖！决死战！"`
- `yearRange`: `[startYear, endYear]`（预估覆盖年份区间）

### 2. `HistoricalEvent` (`data/events/*.json`)
五维历史大小事件核心结构：
- `id`: 唯一标识（如 `"evt-1363-poyang-lake"`）
- `title`: 事件标题
- `tier`: `"macro"`（决定国运之历史大事件） | `"micro"`（人物微光/市井/宫廷小事件，随地图放大 LOD 浮现）
- `category`: `"war" | "politics" | "institution" | "voyage" | "culture" | "anecdote"`
- `time`: `{ year: number, month?: number, display: string, reignTitle?: string }`
- `location`: `{ placeId: string, ancientName: string, modernName: string, coordinates: [number, number] }`
- `camera`: `{ center: [number, number], zoom: number, pitch?: number, bearing?: number }`（点击事件后 3D 镜头最佳观赏机位）
- `summary`: 客观简明事件梗概（100–200字）
- `why`: **「为啥？」因果解析对象**
  - `geoFactor`: 地理/地形/水系/粮道锁钥原因（配合 3D 地形解读）
  - `systemFactor`: 政治/军事制度/财政/气候灾荒深层动因
  - `prevEventIds`: 前因事件 ID 数组（支持点击跳转）
  - `nextEventIds`: 后果事件 ID 数组（支持点击跳转）
- `bookLens`: **「小说怎么说的 vs 正史考据」双视角对象**
  - `chapterIds`: 关联的 `ChapterAnchor.id` 数组
  - `mingyuePerspective`: 原创提炼的当年明月叙事切入点、幽默评价与人物心理剖析
  - `historicalNote`: 对照《明史》《明实录》的正史细节补充或演义辨析
- `campaignId`: 可选，若为大型战役可关联 `Campaign.id` 一键进入分幕行军推演

### 3. `Campaign` (`data/campaigns/*.json`)
战役多阶段行军路线与态势推演包：
- `id`: 唯一标识（如 `"cmp-1363-hongdu-poyang"` / `"cmp-1399-jingnan"`）
- `title`: 战役名称
- `yearRange`: `[number, number]`
- `factions`: 参战阵营列表 `[{ id, name, leader, color, badgeText }]`
- `phases`: **分幕推演数组** `Phase[]`
  - `phaseNo`: 幕序号（`1..N`）
  - `title`: 本幕标题（如 `"第一幕：陈友谅六十万巨舰围困洪都"`）
  - `dateLabel`: 时间标签
  - `narrative`: 本幕战局解说与战术看点
  - `whyKeyPoint`: 本幕胜负手“为啥”提示
  - `camera`: `{ center: [number, number], zoom: number, pitch: number, bearing: number }`
  - `strengthComparison`: 可选双方兵力/士气态势值
  - `routes`: 本幕动态行军路线数组
    - `id`: 路线 ID
    - `factionId`: 所属阵营
    - `type`: `"assault"`（主攻流光实线箭头） | `"ambush"`（奇袭高曲率脉冲虚线箭头） | `"retreat"`（败退断续线） | `"naval"`（水师/宝船航线） | `"supply"`（粮道补给线）
    - `label`: 地图沿线注记（如 `"朱棣奇袭沧州-灵璧线"`）
    - `coordinates`: `[number, number][]` 折线/平滑样条控制点
  - `markers`: 本幕特殊战场符号（如围城光圈 `siege`、决战震波 `clash`、锁钥关隘 `pass`、断粮点 `cutoff`）

### 4. `TerritorySnapshot` (`data/territories/*.topo.json` + `index.json`)
各历史关键年份的政权版图快照：
- `snapshotId`: 如 `"ter-1363"`、`"ter-1368"`、`"ter-1409"`
- `year`: 基准年份
- `effectiveRange`: `[validFromYear, validToYear]`
- `features`: 各政权多边形集合，属性含：
  - `polityId`: 如 `"ming"`、`"chen-han"`、`"zhang-zhou"`、`"northern-yuan"`、`"later-jin"`
  - `polityName`: 显示国号/势力名
  - `controlType`: `"direct"`（实控直辖两京十三省） | `"tributary-garrison"`（羁縻都司/卫所/土司，前端以半透明斜纹区分）
  - `color`: 阵营主题色
  - `changeReason`: 相比上一期版图伸缩的简要“为啥”说明

### 5. `HistoricalPlace` (`data/geo-base/places.json`)
古今地名穿透与战略要地字典：
- `id`: 如 `"place-yingtian"`、`"place-hongdu"`、`"place-tumu"`
- `ancientName`: 明代主要称谓（如 `"应天府"`、`"洪都"`、`"北平府 / 顺天府"`）
- `aliases`: 历史曾用名/别名数组（如 `["集庆", "南京"]`）
- `modernName`: 今地名（如 `"江苏南京"`、`"江西南昌"`）
- `type`: `"capital" | "prefecture" | "garrison-nine" | "pass" | "battlefield" | "port"`
- `coordinates`: `[number, number]`
