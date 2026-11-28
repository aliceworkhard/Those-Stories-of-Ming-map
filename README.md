# 《明朝那些事儿》三维历史地图与战役推演系统 · 明途舆图纪 (Those Stories of Ming 3D Historical Atlas)

> **《明朝那些事儿》配套开源三维交互式历史地图（1344–1662）**：读当年明月《明朝那些事儿》，在三维山川地形上直观纵览大明三百年政权疆域擦写演变、14 场史诗战役行军路线动态箭矢、决战微观战术子沙盘、古今地名穿透对照、「明月说书」语音导览与「为啥会这样？」深层历史因果图谱。  
> *An open-source 3D WebGL interactive historical atlas, multi-phase battle replay engine, micro-tactical battlefield sandtable, and polygon-clipping GIS studio inspired by Dangnian Mingyue's **Those Stories of Ming (《明朝那些事儿》)**.*

[![GitHub Stars](https://img.shields.io/github/stars/aliceworkhard/Those-Stories-of-Ming-map?style=social)](https://github.com/aliceworkhard/Those-Stories-of-Ming-map/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-B83B2A.svg)](./LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/aliceworkhard/Those-Stories-of-Ming-map?color=9E2318&label=Release)](https://github.com/aliceworkhard/Those-Stories-of-Ming-map/releases)
[![Live Online](https://img.shields.io/badge/在线体验-those--stories--of--ming--map.vercel.app-1D4ED8)](https://those-stories-of-ming-map.vercel.app)
[![LINUX DO Discussion](https://img.shields.io/badge/LINUX_DO-社区交流专帖-D97706?logo=discourse&logoColor=white)](https://linux.do/t/topic/3236921)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![MapLibre GL 3D](https://img.shields.io/badge/MapLibre_GL-3D_Vector_WebGL-2962FF)](https://maplibre.org/)

🌐 **在线交互体验（免安装、免注册、零 API Key 即开即用）**：[<kbd>🚀 打开三维历史地图</kbd>](https://those-stories-of-ming-map.vercel.app) · **[https://those-stories-of-ming-map.vercel.app](https://those-stories-of-ming-map.vercel.app)**

💬 **社区交流 & 反馈**：[<kbd>🔥 LINUX DO 讨论专帖</kbd>](https://linux.do/t/topic/3236921) · [<kbd>⭐ GitHub 点亮 Star</kbd>](https://github.com/aliceworkhard/Those-Stories-of-Ming-map) · [<kbd>🛠️ 战役投稿工坊</kbd>](https://those-stories-of-ming-map.vercel.app/dev/campaign-builder) · [<kbd>🖌️ 疆域擦写工坊</kbd>](https://those-stories-of-ming-map.vercel.app/dev/territory-painter)

<!-- S5 Demo Video Slot: Upload a 15–25s muted MP4 screen recording directly in GitHub README editor to auto-play inline -->
![《明朝那些事儿》三维历史地图与战役运镜推演系统预览](./public/docs/atlas-preview.png)

---

## 🎯 3 秒直达经典名场面（URL 深度直链 · 点击即开战局）

不用从头翻找，点击下面任意链接即可在浏览器中直达对应年份、分幕战役、人物足迹或开源创作工坊：

| 场景类别 | 经典名场面 / 功能入口 | 一键直达体验 |
| :--- | :--- | :--- |
| ⚔️ **水战逆转** | **1363 · 鄱阳湖决死水战**（康郎山火攻连环船 + 湖口锁江微观阵势） | [<kbd>▶ 直达第 4 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1363-poyang&phase=4) |
| ⚔️ **万里北伐** | **1367 · 徐达常遇春大北伐**（先山东、再河南、后大都为何百战百胜？） | [<kbd>▶ 直达第 2 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1367-northern-expedition&phase=2) |
| ⚔️ **孤注奇袭** | **1399 · 靖难之役奇袭大宁**（裹挟朵颜三卫，埋下 47 年后土木堡伏笔） | [<kbd>▶ 直达第 2 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1399-jingnan&phase=2) |
| ⛵ **远洋壮举** | **1405 · 郑和七下西洋**（远抵波斯湾忽鲁谟斯、红海天方与东非麻林） | [<kbd>▶ 直达第 4 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1405-zhenghe-voyages&phase=4) |
| ⚔️ **社稷死守** | **1449 · 于谦北京九门保卫战**（德胜门神机营伏击 + 局部收复涂抹） | [<kbd>▶ 直达第 5 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1449-tumu-beijing&phase=5) |
| ⚔️ **文臣神算** | **1519 · 王阳明三十五日平宁王**（攻心围魏救赵 + 鄱阳湖火攻生擒） | [<kbd>▶ 直达第 3 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1519-ning-rebellion&phase=3) |
| ⚔️ **命运拐点** | **1619 · 萨尔浒四路分兵惨败**（杜松冒进吉林崖 + 努尔哈赤集中破敌） | [<kbd>▶ 直达第 2 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1619-sarhu&phase=2) |
| ⚔️ **精锐落幕** | **1640 · 松锦大战松山断粮**（皇太极夺笔架山粮栈 + 三重断路深壕） | [<kbd>▶ 直达第 2 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1640-songjin&phase=2) |
| ⚔️ **驱荷复台** | **1661 · 郑成功飞渡鹿耳门收复台湾**（四月初一大潮奇袭 + 乌特勒支受降） | [<kbd>▶ 直达第 2 幕</kbd>](https://those-stories-of-ming-map.vercel.app/?campaign=cmp-1661-koxinga-taiwan&phase=2) |
| 👣 **人物足迹** | **王守仁（王阳明）一生行迹巡礼**（余姚 → 龙场悟道 → 赣南平叛 → 归途） | [<kbd>▶ 开启人物足迹</kbd>](https://those-stories-of-ming-map.vercel.app/?character=char-wang-yangming&stop=1) |
| 🛠️ **开源工坊** | **疆域布尔画笔擦写工坊** & **零代码战役投稿工坊**（可视化导出 PR 数据） | [<kbd>🖌️ 擦写</kbd>](https://those-stories-of-ming-map.vercel.app/dev/territory-painter) · [<kbd>⚔️ 投稿</kbd>](https://those-stories-of-ming-map.vercel.app/dev/campaign-builder) |

---

## 为什么做这个《明朝那些事儿》历史地图项目？

很多读者在阅读当年明月所著的 **《明朝那些事儿》**（全七部，从朱元璋一只破碗走淮西到崇祯煤山落幕、郑成功收复台湾与徐霞客终章）时，常常会在脑海中浮现这些空间与因果疑问：

- **版图是怎么一步步擦写出来的？** 元末韩宋、陈友谅大汉、张士诚东吴、明玉珍大夏与朱元璋吴国各自盘踞何处？洪武北伐与永乐北征后，大明实控两京十三省与奴儿干都司、朵颜三卫、乌思藏都司的虚实边界究竟长什么样？
- **行军路线怎么走、仗为什么这么打？** 为什么陈友谅六十万水师会被困死在洪都孤城下？朱棣靖难之役为什么要千里奇袭大宁裹挟朵颜三卫骑兵？徐达北伐为何严禁直扑元大都，而要先取山东、再定河南、最后水陆并进克通州？
- **“为啥会这样？”背后的山川与制度锁钥是什么？** 为什么 1399 年朱棣把宁王与大宁都司内迁保定，会在整整 47 年后埋下 1449 年明英宗「土木堡之变」京师门户洞开的伏笔？为什么明代黄河“夺淮入海”决定了徐州、淮安与京杭大运河的兴衰？

**《明途 · 舆图纪》（`Those-Stories-of-Ming-map`）** 正是为《明朝那些事儿》读者、明史爱好者与 Web GIS 开发者打造的**开源三维时空伴读舆图**。

---

## 九大核心能力 (Key Features · `v1.4.1`)

### 1. 十四大史诗战役分幕推演（61 幕 · 123 条有序箭矢）与「微观战术子沙盘」
- **⚔️ 完整 14 套多幕动态战役推演包**：路线与终点矛头稳固静止，支持 **「动态箭矢（`① → ② → ③` 顺序沿线推进） / 静态箭矢」** 一键切换、路线悬停聚光、单路点击聚焦及决胜幕**纯局部差分胜利方版图涂抹**：
  1. **《洪都奇迹与鄱阳湖决死水战 (1363)》**（5 幕 · 11 路）
  2. **《平吴灭张与洪武万里大北伐 (1366–1368)》**（4 幕 · 9 路）
  3. **《纳哈出降明与捕鱼儿海犁庭决战 (1387–1388)》**（4 幕 · 9 路）
  4. **《奉天靖难 · 燕王朱棣四载夺天下 (1399–1402)》**（5 幕 · 11 路）
  5. **《郑和七下西洋远洋宝船海航推演 (1405–1433)》**（5 幕 · 12 路，远抵忽鲁谟斯、天方与东非麻林）
  6. **《土木堡大溃败与于谦北京九门保卫战 (1449)》**（5 幕 · 11 路）
  7. **《王阳明三十五日平定宁王朱宸濠之乱 (1519)》**（4 幕 · 8 路）
  8. **《戚继光台州九战九捷与东南荡平倭寇 (1559–1563)》**（4 幕 · 7 路）
  9. **《万历抗倭援朝 · 平壤大捷与露梁海全胜 (1592–1598)》**（4 幕 · 8 路）
  10. **《萨尔浒四路分兵惨败与辽沈沦陷 (1619–1621)》**（4 幕 · 8 路）
  11. **《孙承宗拓地四百里与袁崇焕宁远大捷 (1622–1627)》**（4 幕 · 8 路）
  12. **《松锦大战：松山断粮与大明九边精锐总崩盘 (1640–1642)》**（4 幕 · 6 路）
  13. **《甲申国变、山海关大战与南明收复台湾 (1642–1662)》**（5 幕 · 9 路）
  14. **《郑成功东征驱荷收复台湾之战 (1661–1662)》**（4 幕 · 6 路）
- **🔍 决战现场「微观战术级子沙盘」（`Zoom ≥ 7.4`）**：推近或点击战役内 **「微观阵势」** 按钮，自动浮现康郎山火攻风向与湖口锁江、北京九门与德胜门神机营伏击、萨尔浒吉林崖、宁远红夷火网、松山笔架山断粮深壕及鹿耳门大潮秘道。

### 2. 十五期高精度州府拓扑疆域（1344–1662）与明代古水系还原
- **州府级局部差分擦写版图**：完整覆盖 **1356 / 1363 / 1368 / 1388 / 1399 / 1402 / 1415 / 1435 / 1449 / 1479 / 1582 / 1621 / 1642 / 1644 / 1652** 十五期切片；跨时期演进采用纯局部布尔求差引擎，仅对真实易手的州府与边塞做水墨涂抹，未变省域零闪烁。
- **明代古水系与九边长城**：忠实还原 **1194–1855 明代“夺淮入海”古黄河故道**、京杭大运河（含戴村坝南旺分水脊）、长江水系与明长城九边防线，配套常驻可折叠 **《舆图图例》**。

### 3. 开源 Web GIS 双创作工坊（零代码参与历史地图共建）
- **🖌️ 疆域画笔擦写工坊 (`/dev/territory-painter`)**：继承任意历史切片，使用可调半径布尔画笔涂抹扩张（Union）或橡皮擦除（Difference），绑定 Natural Earth 10m 陆地掩膜实现**海岸线自动锁边**与**多政权互斥零重叠**，支持考据底图半透明叠印描摹与 `GeoJSON / TopoJSON` 导出。
- **⚔️ 可视化战役投稿工坊 (`/dev/campaign-builder`)**：无需手写经纬度，点选地图即可绘制有序行军箭矢、落印 `决 / 围 / 伏 / 守 / 断` 交战印章、实时预览动态推演并一键导出合规 `cmp-*.json` 提交 PR。

### 4. 明代兴衰五大宏观制度专题图层
支持在顶栏「图层」菜单一键叠加多维历史大势：
- **🔥 崇祯小冰期旱蝗鼠疫奇荒热力层**（揭示 1627–1643 灾疫带与流寇蜂起的地理重合）
- **⛵ 京杭漕运四百万石总督钞关枢纽层**（清江浦、扬州、南旺分水脊、临清钞关、通州仓）
- **🪙 隆庆开关（1567）全球白银流入航线层**（漳州月港↔马尼拉大帆船、澳门↔长崎倭银与一条鞭法北输银路）
- **🏛️ 洪武分封藩王与九边塞王封藩印** + **明代九边重镇防区与军饷制度层**

### 5. 风云人物一生足迹巡礼（12 位传奇人物 · 50 站轨迹）
内置 **朱元璋、朱棣、郑和、于谦、王守仁（王阳明）、杨慎、戚继光、海瑞、张居正、袁崇焕、孙传庭、徐霞客** 12 位核心人物的一生行迹弧线与自动巡礼播放器。

### 6. 五维历史事件双栏工作台（112 起互联事件 · 157 章目录锚点）
- **左侧《事件目录》**：收录全七部 **112 起五维大小事件**与 **106 处古今地标**，支持事件/人物/古今地名/年份瞬时检索与分类筛选。
- **右侧《事件详情》**：呈现时空古今定位、**「为啥会这样？」（山川地理锁钥 + 制度局势动因 + 地图原位因果飞弧跳转）**，以及**《明朝那些事儿》原著章节锚点 vs《明史》《明实录》正史考据**双视角对照。

### 7. 「明月说书」语音旁白 · URL 深度直链 · 宣纸朱印战报海报
- **🔊 明月说书语音旁白**：全史推演、战役沙盘与事件抽屉均支持零依赖中文 Web Speech 语音播报。
- **🔗 URL 全状态深度直链 + 🖼️ 宣纸朱印战报卡**：实时同步地址栏（复制链接直达当前战局幕次），支持无损截取当前 WebGL 舆图并一键合成 `1200×720` 古典双栏朱砂印鉴高清 PNG 战报海报。

### 8. 古今地名一键穿透 & 移动端视网膜超清适配
- **古今地名穿透（`[古称 | 古今双显 | 今名]`）**：一键在 `应天府 / 北平府 / 平江府 / 洪都府 / 濠州 / 宁远卫 / 萨尔浒` 与现代地名间实时切换，配合 29 处名山大湖海域古风注记与一键「沉浸观图」。
- 移动端采用半屏抽屉互斥展开、点击地图空白自动收起与 `@3x` 超清印章精灵，手机横竖屏皆清晰可读。

### 9. `v1.4.1` 极致流畅架构（全 WebGL 零 DOM Marker · 三档硬件自适应）
- **首屏极速瘦身（-63.7%）**：14 期非首屏疆域切片按需异步分包并延后逐个空闲预热，首页主包仅 `314 kB`。
- **零冗余上传 & 零级联重渲染**：全图 100% WebGL 原生符号层，6 条独立差分更新管道确保点选事件、缩放与同年代拖轴零疆域重传；零 Worker 的 GPU `feature-state` 悬停高亮、拖拽自动让出 Worker 算力；桌面端严格控制 2.8M 物理像素预算并内置 **`⚡ 省电 / 均衡 / 极致`** 三档硬件模式，集显轻薄本与 4K 高刷屏均丝滑顺手。

---

## 《明朝那些事儿》全七部 · 时空舆图与战役覆盖全景表（全七部 100% 已上线）

| 原著分卷 | 涵盖时期与朝代 | 核心人物关键词 | 已上线重点历史事件与战役推演 | 当前状态 |
| :--- | :--- | :--- | :--- | :--- |
| **第壹部 · 洪武大帝** | 1344–1402（元末～洪武～建文） | 朱元璋、陈友谅、张士诚、徐达、常遇春、刘伯温、傅友德、蓝玉、沐英、朱允炆、铁铉、方孝孺 | 1344 黄河决堤开篇、皇觉寺出家、采石矶渡江、**洪都保卫战与鄱阳湖决战**、**平吴灭张与洪武大北伐**、水陆平蜀、白石江平云南、**纳哈出受降与捕鱼儿海决战**、胡惟庸废相、锦衣卫与《大诰》、蓝玉案、**奉天靖难之役全五幕** | ✅ **全卷已上线** |
| **第贰部 · 万国来朝** | 1402–1457（永乐～仁宣～正统～景泰） | 朱棣、解缙、姚广孝、郑和、张辅、宋礼、白英、亦失哈、况钟、三杨、王振、朱祁镇、于谦、杨善 | 解缙姚广孝修《永乐大典》、**郑和七下西洋远达波斯湾与东非**、设交趾布政使司、重开会通河、奴儿干永宁寺立碑、五征漠北、仁宣之治与况青天减苏州重赋、平汉王、罢交趾、三征麓川、**土木堡之变与于谦北京九门保卫战**、夺门之变与于谦殉国 | ✅ **全卷已上线** |
| **第叁部 · 妖孽宫廷** | 1457–1521（天顺～成化～弘治～正德） | 曹吉祥、李贤、项忠、王越、余子俊、朱祐樘、唐伯虎、朱厚照、刘瑾、王守仁（王阳明） | 曹石之变、项忠平荆襄流民、余子俊筑延绥长城锁河套、威宁海与成化犁庭、弘治中兴与唐伯虎科场奇案、刘瑾乱政与豹房、王阳明龙场悟道、应州大捷、**王阳明三十五日神速平定宁王之乱** | ✅ **全卷已上线** |
| **第肆部 · 粉饰太平** | 1521–1566（嘉靖朝） | 朱厚熜、杨廷和、杨慎、夏言、严嵩、杨继盛、徐阶、胡宗宪、戚继光、俞大猷、海瑞 | 大礼议左顺门血案与杨慎谪戍云南、庚戌之变俺答兵临北京、杨继盛弹劾严嵩、徐阶斗倒严嵩、**戚家军台州九捷与平海卫抗倭推演**、海瑞备棺上《治安疏》 | ✅ **全卷已上线** |
| **第伍部 · 帝国飘摇** | 1566–1618（隆庆～万历） | 高拱、张居正、谭纶、王崇古、李成梁、潘季驯、李如松、麻贵、邓子龙、徐光启、利玛窦、努尔哈赤 | 隆庆开关月港通商、俺答封贡、张居正考成法与一条鞭法、潘季驯束水攻沙治黄淮、徐光启利玛窦合译《几何原本》、努尔哈赤十三副遗甲起兵、宁夏之役、**抗倭援朝平壤大捷与露梁海战推演**、播州海龙屯、矿税之祸与七大恨 | ✅ **全卷已上线** |
| **第陆部 · 日暮西山** | 1619–1627（泰昌～天启） | 杨镐、刘綎、熊廷弼、孙承宗、袁崇焕、魏忠贤、杨涟、左光斗、王恭厂 | **萨尔浒之战四路兵败与辽沈失陷推演**、红丸移宫案、东林六君子死难、孙承宗督师辽东筑关宁锦防线、王恭厂大爆炸、**袁崇焕宁远大捷与宁锦大捷推演** | ✅ **全卷已上线** |
| **第柒部 · 大结局** | 1627–1662（崇祯～南明终章） | 朱由检（崇祯）、卢象升、洪承畴、孙传庭、李自成、张献忠、吴三桂、史可法、阎应元、李定国、郑成功、徐霞客 | 崇祯铲除魏忠贤、己巳之变与袁崇焕之死、卢象升巨鹿死战、**松锦大战十三万精锐覆没推演**、孙传庭潼关战死、**甲申煤山自缢与山海关大战推演**、扬州十日与江阴八十一日、李定国两蹶名王、**郑成功东征驱荷收复台湾推演**、**全书终章：徐霞客万里遐征** | ✅ **全卷已上线** |

---

## 零配置快速启动 (Quickstart · 100% 完整开源)

本项目 **100% 完整开源，无任何未开源后端、无私有数据库、无付费商业地图 API Key 依赖**（包含全部三维 WebGL 渲染引擎、内置双创作工坊及全七部结构化历史时空数据集），安装 Node.js（`>= 20`）后四行命令即可在本地完整运行：

```bash
git clone https://github.com/aliceworkhard/Those-Stories-of-Ming-map.git
cd Those-Stories-of-Ming-map
npm install
npm run dev
```

浏览器打开 `http://localhost:3000` 即可体验完整三维历史地图与战役运镜推演。

### 常用工程命令

| 命令 | 用途说明 |
| :--- | :--- |
| `npm run dev` | 启动本地热更新开发服务器（含 `/dev/territory-painter` 与 `/dev/campaign-builder` 双工坊） |
| `npm run validate:data` | 校验全量事件、战役、古今地名、157 章目录交叉引用与版权隔离红线（12 项套件） |
| `npm test` | 运行全史年份连续性、纯局部布尔差分疆域与十四大战役/人物足迹回归测试套件 |
| `npm run check` | 一键运行全量数据校验 + TypeScript 严格类型检查 + 回归测试 |
| `npm run build` | 构建生产级静态/SSR 优化产物 |

### 独立服务器 + 自定义域名 Docker 一键部署 (`deploy/`)

内置面向云服务器（2C2G 即可流畅承载）与自定义域名的容器化方案，由 Caddy 自动签发并续期免费 HTTPS 证书（完整三分钟上线教程详见 [`deploy/README.md`](./deploy/README.md)）：

```bash
cd deploy
cp .env.example .env      # 修改 DOMAIN=你的域名（纯 IP 测试保持 DOMAIN=:80）
sh ./deploy.sh
```

---

## 参与共建与文档导航 (Contributing & Docs)

非常欢迎明史书友、历史地理考据党与前端/GIS 开发者一起把这张明代时空舆图做得更考究、更鲜活！

- 📌 **提名想看的战役 / 事件 / 人物，或指正地名疆域考据** → [提交 GitHub Issue](https://github.com/aliceworkhard/Those-Stories-of-Ming-map/issues/new/choose)
- 🛠️ **零代码绘制新战役 / 擦写疆域并提交 PR** → 直接打开 [战役投稿工坊](https://those-stories-of-ming-map.vercel.app/dev/campaign-builder) / [疆域擦写工坊](https://those-stories-of-ming-map.vercel.app/dev/territory-painter) 导出 JSON，按 [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) 提交即可
- 📐 [系统架构与纯 WebGL 局部差分渲染引擎说明 (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
- 📊 [开放历史地理与五维事件数据契约 (`data/schemas/README.md`)](./data/schemas/README.md)
- 📜 [版本发布历史与更新日志 (`CHANGELOG.md`)](./CHANGELOG.md)

---

## Star 支持与社区致谢 (Star History & Acknowledgements)

如果这个开源伴读舆图帮你在重读《明朝那些事儿》时看清了山川形势与历史因果，欢迎点亮右上角 **⭐ Star** 支持项目持续打磨，也欢迎分享给同好书友！

[![Star History Chart](https://api.star-history.com/svg?repos=aliceworkhard/Those-Stories-of-Ming-map&type=Date)](https://star-history.com/#aliceworkhard/Those-Stories-of-Ming-map&Date)

- [<kbd>🔥 本项目 LINUX DO 讨论专帖</kbd>](https://linux.do/t/topic/3236921) — **[欢迎前往 LINUX DO 专帖留言交流与反馈 (https://linux.do/t/topic/3236921)](https://linux.do/t/topic/3236921)**
- [<kbd>💛 LINUX DO 社区</kbd>](https://linux.do/) — **[LINUX DO (https://linux.do/)](https://linux.do/)**：真诚、友善、团结、专业的开源与技术交流社区（*Where possible begins*）。感谢 LINUX DO 社区佬友们的交流、建议与支持！
- 底层开源生态致谢：[MapLibre GL JS](https://maplibre.org/) · [OpenFreeMap](https://openfreemap.org/) · [Natural Earth](https://www.naturalearthdata.com/) · [Next.js](https://nextjs.org/)

---

## 版权合规与致敬声明 (License & Copyright Notice)

1. **开源代码协议**：本仓库全部前后端代码、三维渲染与防重叠算法采用 **[MIT License](./LICENSE)** 100% 独立自研开源，欢迎 Star、Fork 与共建。
2. **尊重原著图书著作权**：本项目灵感源自当年明月先生所著经典历史读物 **《明朝那些事儿》**。为严格遵守著作权法规，**本仓库不包含、不存储、不分发《明朝那些事儿》原书任何受版权保护的正文全文或电子书文件**；仓库内仅收录客观历史时空坐标、章节编号索引锚点，以及由项目独立撰写总结的历史因果解析与导读文案。强烈推荐购买并阅读当年明月《明朝那些事儿》正版实体书或正版电子书！

---

**检索关键词 / Search Tags**：`明朝那些事儿` · `明朝那些事儿地图` · `明朝历史地图` · `当年明月` · `大明疆域变化` · `明朝战役推演` · `三维历史地图` · `朱元璋` · `朱棣靖难之役` · `鄱阳湖大战` · `松锦大战` · `郑成功收复台湾` · `Those Stories of Ming` · `Ming Dynasty Historical Atlas` · `MapLibre GL 3D`
