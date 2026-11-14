/**
 * Boolean Coastline-Clipped & Zero-Overlap Territory Snapshot Generator
 * Uses polygon-clipping (the same mathematical core that powers Phase 2's
 * visual Brush & Eraser Studio) to ensure:
 *   1. All coastal polities snap cleanly to East Asia's natural coastline (0 ocean bleed).
 *   2. Adjacent polities share exact topological boundaries (0 overlap, 0 sliver gaps).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../data/territories');

// Accurate East Asian Mainland Coastline Mask (Korea border -> Liaodong -> Bohai -> Shandong ->
// Jiangsu -> Yangtze Mouth -> Hangzhou Bay -> Zhejiang/Fujian/Guangdong -> Beibu Gulf -> Inland West/North)
const MAINLAND_MASK = [
  [
    [124.35, 39.95],
    [123.1, 39.65],
    [121.25, 38.75], // Lushun tip
    [122.15, 40.65], // Yingkou
    [120.85, 40.75], // Jinzhou / Ningyuan
    [119.78, 40.01], // Shanhaiguan
    [119.25, 39.35],
    [117.75, 39.02], // Tianjin Bohai
    [117.65, 38.25],
    [118.95, 37.95], // Yellow River modern delta lobe (trimmed to historical coast)
    [119.12, 37.22], // Laizhou Bay
    [120.35, 37.68], // Penglai
    [121.45, 37.55], // Yantai
    [122.68, 37.38], // Chengshantou (Shandong tip)
    [121.35, 36.68],
    [120.38, 36.06], // Qingdao / Jiaozhou
    [119.48, 35.12], // Haizhou / Lianyungang
    [119.95, 34.05], // Ming Yellow River mouth (Yuntiguan)
    [120.65, 33.15],
    [121.65, 32.08], // Qidong north of Yangtze
    [121.02, 31.82], // Yangtze mouth indent
    [121.88, 31.15], // Songjiang / Shanghai cape
    [121.25, 30.58], // North Hangzhou Bay
    [120.52, 30.32], // Hangzhou Bay apex
    [121.58, 30.08], // Ningbo / Zhenhai
    [122.05, 29.55],
    [121.55, 28.65], // Taizhou
    [120.85, 27.85], // Wenzhou
    [120.22, 26.85],
    [119.68, 25.95], // Fuzhou
    [119.05, 25.12], // Quanzhou
    [118.12, 24.45], // Xiamen / Zhangzhou
    [116.85, 23.42], // Chaozhou
    [115.25, 22.75],
    [114.15, 22.45],
    [113.55, 22.78], // Pearl River mouth
    [113.15, 22.05],
    [111.25, 21.45], // Yangjiang / Dianbai
    [110.42, 20.95],
    [109.85, 20.25], // Leizhou Peninsula tip
    [109.68, 21.48], // Hepu / Beihai
    [108.15, 21.55], // Qinzhou / Jiaozhi border
    [106.75, 22.15],
    [104.2, 22.85],
    [101.2, 21.95],
    [98.2, 24.5],
    [97.5, 28.5],
    [96.0, 33.0],
    [94.5, 39.5],
    [97.0, 44.5],
    [105.0, 48.5],
    [116.5, 49.0],
    [124.5, 48.0],
    [131.0, 45.0],
    [130.5, 42.5],
    [128.0, 41.5],
    [126.5, 40.9],
    [124.35, 39.95],
  ],
];

const HAINAN_MASK = [
  [
    [109.6, 20.02],
    [110.95, 19.98],
    [110.52, 18.85],
    [109.52, 18.22],
    [108.65, 19.08],
    [109.6, 20.02],
  ],
];

const LAND_MASK = [MAINLAND_MASK[0], HAINAN_MASK[0]].map((ring) => [ring]);

function roundCoords(multiPoly) {
  return multiPoly.map((poly) =>
    poly.map((ring) =>
      ring.map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))])
    )
  );
}

/**
 * Given ordered polity definitions (higher priority first), clips each to LAND_MASK
 * and subtracts all previously claimed territory so boundaries are 100% flush & non-overlapping!
 */
function buildSnapshotFeatures(polityDefs) {
  let claimed = [];
  const features = [];

  for (const def of polityDefs) {
    const rawMultiPoly = def.rings.map((r) => [r]);
    let clipped = polygonClipping.intersection(rawMultiPoly, LAND_MASK);
    if (claimed.length > 0 && clipped.length > 0) {
      clipped = polygonClipping.difference(clipped, claimed);
    }
    if (clipped.length === 0) continue;
    claimed = claimed.length === 0 ? clipped : polygonClipping.union(claimed, clipped);

    features.push({
      type: 'Feature',
      properties: {
        polityId: def.polityId,
        polityName: def.polityName,
        shortLabel: def.shortLabel,
        ruler: def.ruler,
        controlType: def.controlType || 'direct',
        color: def.color,
        borderColor: def.borderColor || def.color,
        labelCoord: def.labelCoord,
        capitalName: def.capitalName,
        changeReason: def.changeReason,
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: roundCoords(clipped),
      },
    });
  }
  return {
    type: 'FeatureCollection',
    features,
  };
}

// ==========================================================
// Snapshot 1: 1356 — 朱元璋渡江取集庆（元末红巾并起）
// ==========================================================
const snap1356 = buildSnapshotFeatures([
  {
    polityId: 'zhu-wu',
    polityName: '朱元璋（江南行省）',
    shortLabel: '朱元璋',
    ruler: '朱元璋',
    color: '#B83B2A',
    labelCoord: [118.75, 31.85],
    capitalName: '应天（集庆）',
    changeReason: '1355年渡江拔采石、太平，1356年攻克集庆路改应天府，首次拥有稳固江南根据地。',
    rings: [
      [
        [117.75, 32.55],
        [119.35, 32.35],
        [119.65, 31.55],
        [119.15, 30.95],
        [118.05, 31.12],
        [117.65, 31.85],
        [117.75, 32.55],
      ],
    ],
  },
  {
    polityId: 'zhang-zhou',
    polityName: '张士诚（周）',
    shortLabel: '张士诚',
    ruler: '张士诚',
    color: '#5B7A3E',
    labelCoord: [120.45, 31.65],
    capitalName: '平江（苏州）',
    changeReason: '高邮起兵后南渡占领平江（苏州）、松江、常州与苏北富庶盐场。',
    rings: [
      [
        [119.15, 33.65],
        [122.2, 33.65],
        [122.2, 30.45],
        [119.75, 30.55],
        [119.45, 32.35],
        [119.15, 33.65],
      ],
    ],
  },
  {
    polityId: 'xu-tianwan',
    polityName: '徐寿辉 / 陈友谅（天完）',
    shortLabel: '天完·红巾',
    ruler: '徐寿辉 · 陈友谅',
    color: '#1E5F74',
    labelCoord: [114.65, 29.85],
    capitalName: '汉阳 / 江州',
    changeReason: '南方红巾军天完政权席卷湖广与江西大部，水师实力冠绝长江中游。',
    rings: [
      [
        [111.6, 31.4],
        [116.8, 31.1],
        [117.2, 28.2],
        [113.8, 27.2],
        [111.2, 28.5],
        [111.6, 31.4],
      ],
    ],
  },
  {
    polityId: 'han-song',
    polityName: '韩林儿 / 刘福通（韩宋红巾）',
    shortLabel: '韩宋红巾',
    ruler: '韩林儿 · 刘福通',
    color: '#A85532',
    labelCoord: [115.65, 33.85],
    capitalName: '亳州 / 安丰',
    changeReason: '北方红巾主力在河南、皖北正面抗击元廷察罕帖木儿主力，客观上为朱元璋挡住北方压力！',
    rings: [
      [
        [113.4, 35.1],
        [118.2, 34.6],
        [118.5, 32.6],
        [115.2, 32.2],
        [113.2, 33.5],
        [113.4, 35.1],
      ],
    ],
  },
  {
    polityId: 'fang-zhedong',
    polityName: '方国珍（浙东海疆）',
    shortLabel: '方国珍',
    ruler: '方国珍',
    color: '#2F855A',
    labelCoord: [121.15, 29.15],
    capitalName: '台州 / 庆元',
    changeReason: '据庆元（宁波）、台州、温州三郡，拥海船千艘，首鼠两端于元廷与群雄之间。',
    rings: [
      [
        [120.2, 30.25],
        [122.5, 30.25],
        [122.5, 27.4],
        [119.9, 27.6],
        [120.2, 30.25],
      ],
    ],
  },
  {
    polityId: 'yuan-empire',
    polityName: '大元帝国（及地方军阀）',
    shortLabel: '大元',
    ruler: '元顺帝妥懽贴睦尔',
    color: '#4A5568',
    labelCoord: [115.2, 39.2],
    capitalName: '元大都',
    changeReason: '虽保有华北、关中、辽东、巴蜀、岭南名义统治，但察罕帖木儿与孛罗帖木儿内斗不休，中央失控。',
    rings: [
      [
        [98.0, 46.5],
        [129.0, 46.5],
        [125.0, 20.0],
        [100.0, 20.0],
        [98.0, 46.5],
      ],
    ],
  },
]);

// ==========================================================
// Snapshot 2: 1363 — 鄱阳湖决战前夕（群雄争霸最白热化格局！）
// ==========================================================
const snap1363 = buildSnapshotFeatures([
  {
    polityId: 'zhu-wu',
    polityName: '朱元璋（西吴）',
    shortLabel: '吴 · 朱元璋',
    ruler: '朱元璋',
    color: '#B83B2A',
    labelCoord: [118.25, 31.05],
    capitalName: '应天府（南京）',
    changeReason: '东防张士诚、西抗陈友谅、北救安丰，夺取安庆、徽州、浙西与洪都，处于三面受敌却机动灵活的枢纽位。',
    rings: [
      [
        [115.45, 28.35], // Hongdu / Nanchang salient!
        [116.85, 28.45],
        [117.45, 29.45],
        [119.55, 29.15], // Jinhua / Quzhou
        [119.75, 30.35],
        [119.52, 32.15],
        [118.85, 33.15],
        [116.55, 32.85], // Anfeng / Luzhou border
        [116.65, 30.35], // Anqing
        [115.65, 29.25], // West of Poyang / Hongdu
        [115.45, 28.35],
      ],
    ],
  },
  {
    polityId: 'chen-han',
    polityName: '陈友谅（大汉）',
    shortLabel: '汉 · 陈友谅',
    ruler: '陈友谅',
    color: '#1E5F74',
    labelCoord: [113.35, 29.35],
    capitalName: '武昌',
    changeReason: '弑徐寿辉自立为大汉皇帝，坐拥湖广全境与江西大部，兵精粮足、巨舰蔽江，顺流东下直扑洪都！',
    rings: [
      [
        [109.2, 31.8],
        [116.55, 31.25],
        [116.45, 29.65],
        [117.05, 27.65],
        [114.8, 25.4],
        [110.5, 26.2],
        [109.2, 31.8],
      ],
    ],
  },
  {
    polityId: 'zhang-zhou',
    polityName: '张士诚（东吴 / 周）',
    shortLabel: '周 · 张士诚',
    ruler: '张士诚',
    color: '#5B7A3E',
    labelCoord: [120.35, 32.15],
    capitalName: '平江（苏州）',
    changeReason: '北据徐宿淮扬、南括苏松常嘉湖杭，坐拥天下最富庶粮赋盐利，却在鄱阳湖决战时按兵观望错失天机。',
    rings: [
      [
        [118.65, 34.45],
        [122.4, 34.45],
        [122.4, 29.95],
        [119.65, 30.05],
        [119.35, 32.25],
        [118.65, 34.45],
      ],
    ],
  },
  {
    polityId: 'ming-xia',
    polityName: '明玉珍（大夏）',
    shortLabel: '夏 · 明玉珍',
    ruler: '明玉珍',
    color: '#805AD5',
    labelCoord: [105.45, 30.45],
    capitalName: '重庆 / 成都',
    changeReason: '入蜀称帝建国“大夏”，闭关自守巴蜀盆地，与朱元璋通好互市以牵制陈友谅上游。',
    rings: [
      [
        [102.5, 32.6],
        [109.1, 32.2],
        [108.8, 27.8],
        [103.2, 28.1],
        [102.5, 32.6],
      ],
    ],
  },
  {
    polityId: 'fang-zhedong',
    polityName: '方国珍（浙东）',
    shortLabel: '方国珍',
    ruler: '方国珍',
    color: '#2F855A',
    labelCoord: [121.05, 28.85],
    capitalName: '庆元（宁波）',
    changeReason: '继续割据浙东沿海三郡，以水师漕粮周旋于元廷与朱元璋之间。',
    rings: [
      [
        [119.8, 30.05],
        [122.5, 30.05],
        [122.5, 27.35],
        [119.6, 27.55],
        [119.8, 30.05],
      ],
    ],
  },
  {
    polityId: 'yuan-empire',
    polityName: '大元（扩廓帖木儿 / 李思齐等军阀）',
    shortLabel: '大元（军阀混战）',
    ruler: '元顺帝 · 王保保',
    color: '#4A5568',
    labelCoord: [114.6, 38.2],
    capitalName: '元大都',
    changeReason: '王保保（扩廓帖木儿）与关中李思齐、张良弼及元廷太子党互相攻杀，无力南顾，给朱元璋留出统一江南的黄金窗口。',
    rings: [
      [
        [98.0, 46.5],
        [129.0, 46.5],
        [125.0, 18.0],
        [100.0, 18.0],
        [98.0, 46.5],
      ],
    ],
  },
]);

// ==========================================================
// Snapshot 3: 1368 — 洪武建国与北伐克大都
// ==========================================================
const snap1368 = buildSnapshotFeatures([
  {
    polityId: 'ming-empire',
    polityName: '大明帝国（洪武开国）',
    shortLabel: '大明',
    ruler: '明太祖朱元璋（洪武元年）',
    color: '#B83B2A',
    labelCoord: [116.85, 33.65],
    capitalName: '应天府（南京）· 开封北京',
    changeReason: '先后平陈友谅、灭张士诚、降方国珍、下福建两广；徐达常遇春二十五万大军北伐连克山东、河南、潼关与元大都，汉家衣冠重光中原！',
    rings: [
      [
        [109.6, 40.9],
        [120.2, 40.4],
        [123.0, 36.5],
        [123.0, 18.0],
        [107.5, 21.0],
        [109.5, 28.0],
        [109.2, 32.5],
        [109.8, 35.5],
        [109.6, 40.9],
      ],
    ],
  },
  {
    polityId: 'ming-xia',
    polityName: '明升（大夏 · 巴蜀割据）',
    shortLabel: '大夏',
    ruler: '明升（明玉珍之子）',
    color: '#805AD5',
    labelCoord: [105.45, 30.45],
    capitalName: '重庆',
    changeReason: '明玉珍病逝后幼主明升继位，凭夔门剑阁天险暂守四川（将于洪武四年1371被汤和、傅友德平定）。',
    rings: [
      [
        [102.2, 32.8],
        [109.5, 32.3],
        [109.2, 27.6],
        [102.8, 28.0],
        [102.2, 32.8],
      ],
    ],
  },
  {
    polityId: 'northern-yuan',
    polityName: '北元（退守漠北与关陇辽东残部）',
    shortLabel: '北元',
    ruler: '元顺帝 · 扩廓帖木儿 · 纳哈出',
    color: '#4A5568',
    labelCoord: [114.5, 43.8],
    capitalName: '上都 / 应昌',
    changeReason: '元顺帝夜出健德门北奔上都，史称北元；王保保据山西甘肃、纳哈出据辽东、把匝剌瓦尔密据云南，尚待明军逐一犁庭扫穴。',
    rings: [
      [
        [96.0, 48.0],
        [130.0, 48.0],
        [130.0, 39.0],
        [109.0, 35.0],
        [98.0, 24.0],
        [96.0, 48.0],
      ],
    ],
  },
]);

// ==========================================================
// Snapshot 4: 1399 — 建文削藩与燕王北平靖难起兵
// ==========================================================
const snap1399 = buildSnapshotFeatures([
  {
    polityId: 'yan-rebels',
    polityName: '燕王靖难军（北平起兵）',
    shortLabel: '燕 · 朱棣',
    ruler: '燕王朱棣',
    color: '#C68B2C',
    borderColor: '#975A16',
    labelCoord: [116.85, 40.35],
    capitalName: '北平府',
    changeReason: '建文帝与齐泰、黄子澄强行削废周、齐、湘、代、岷五王，朱棣于1399年七月以“清君侧、靖国难”起兵夺北平九门并奇袭大宁！',
    rings: [
      [
        [114.85, 42.15],
        [120.15, 42.15],
        [119.85, 39.55],
        [117.65, 38.85],
        [115.25, 39.05],
        [114.85, 42.15],
      ],
    ],
  },
  {
    polityId: 'ming-jianwen',
    polityName: '大明朝廷（建文帝）',
    shortLabel: '大明 · 建文',
    ruler: '建文帝朱允炆',
    color: '#B83B2A',
    labelCoord: [114.85, 32.45],
    capitalName: '应天府（南京）',
    changeReason: '坐拥两京十三省、辽东与云南全国绝大部分人力物力，却因洪武杀戮功臣导致名将凋零、皇帝优柔寡断而屡失战机。',
    rings: [
      [
        [98.5, 42.5],
        [125.5, 43.2],
        [125.0, 18.0],
        [98.0, 21.5],
        [98.5, 42.5],
      ],
    ],
  },
  {
    polityId: 'tartar-oirat',
    polityName: '鞑靼与瓦剌（漠北蒙古）',
    shortLabel: '鞑靼 · 瓦剌',
    ruler: '鬼力赤 · 猛哥帖木儿',
    controlType: 'tributary-garrison',
    color: '#4A5568',
    labelCoord: [111.5, 45.2],
    capitalName: '漠北草原',
    changeReason: '1388年蓝玉捕鱼儿海大捷后北元分裂为鞑靼、瓦剌与兀良哈三部；但朱棣靖难抽空大宁防线，使蒙古骑兵得以南窥燕山。',
    rings: [
      [
        [96.0, 48.5],
        [128.0, 48.5],
        [128.0, 42.2],
        [96.0, 42.2],
        [96.0, 48.5],
      ],
    ],
  },
]);

// ==========================================================
// Snapshot 5: 1402 — 靖难功成与永乐盛世揭幕
// ==========================================================
const snap1402 = buildSnapshotFeatures([
  {
    polityId: 'ming-yongle',
    polityName: '大明帝国（永乐肇始）',
    shortLabel: '大明（永乐）',
    ruler: '明成祖朱棣',
    color: '#B83B2A',
    labelCoord: [114.85, 34.25],
    capitalName: '应天府 -> 筹备北京顺天府',
    changeReason: '1402年灵璧决战后渡江入南京即位，结束四年内战；随即开启营建北京“天子守国门”、编纂《永乐大典》、郑和下西洋与五征漠北之盛世宏图！',
    rings: [
      [
        [98.2, 42.8],
        [126.0, 43.5],
        [125.0, 18.0],
        [98.0, 21.5],
        [98.2, 42.8],
      ],
    ],
  },
  {
    polityId: 'ming-garrisons-north',
    polityName: '兀良哈三卫与塞北羁縻区',
    shortLabel: '兀良哈羁縻卫所',
    ruler: '朵颜 · 泰宁 · 福余三卫',
    controlType: 'tributary-garrison',
    color: '#9C4221',
    labelCoord: [120.5, 44.2],
    capitalName: '大宁故地（羁縻）',
    changeReason: '朱棣为酬谢朵颜三卫助战之功，将宁王内迁南昌，大宁都司故地渐归三卫游牧，成为日后九边防御体系的重要变数。',
    rings: [
      [
        [117.0, 46.5],
        [127.5, 46.5],
        [126.0, 42.0],
        [117.0, 42.0],
        [117.0, 46.5],
      ],
    ],
  },
  {
    polityId: 'tartar-oirat',
    polityName: '鞑靼与瓦剌（漠北）',
    shortLabel: '鞑靼 · 瓦剌',
    ruler: '本雅失里 · 阿鲁台 · 马哈木',
    color: '#4A5568',
    labelCoord: [108.5, 45.6],
    capitalName: '胪朐河 / 和林',
    changeReason: '漠北东蒙古（鞑靼）与西蒙古（瓦剌）并立，即将迎来永乐皇帝亲率五十万大军五出塞外的雷霆远征。',
    rings: [
      [
        [96.0, 48.5],
        [117.0, 48.5],
        [117.0, 42.5],
        [96.0, 42.5],
        [96.0, 48.5],
      ],
    ],
  },
]);

const snapshots = [
  {
    snapshotId: 'ter-1356',
    year: 1356,
    title: '至正十六年（1356）· 渡江定集庆与群雄并起',
    eraNote: '朱元璋克集庆改应天府，北有韩宋刘福通挡元军，西有徐寿辉陈友谅，东有张士诚。',
    effectiveRange: [1344, 1359],
    file: 'ter-1356.json',
    data: snap1356,
  },
  {
    snapshotId: 'ter-1363',
    year: 1363,
    title: '至正二十三年（1363）· 鄱阳湖决死战前夕',
    eraNote: '陈友谅大汉政权挟六十万巨舰围洪都，朱元璋西吴东防张士诚、西赴鄱阳湖迎战生死存亡之局。',
    effectiveRange: [1360, 1367],
    file: 'ter-1363.json',
    data: snap1363,
  },
  {
    snapshotId: 'ter-1368',
    year: 1368,
    title: '洪武元年（1368）· 大明建国与北伐克复大都',
    eraNote: '平汉灭吴统一江南，徐达常遇春挥师北伐收复山东、河南、潼关与元大都，终结蒙元中原百年统治。',
    effectiveRange: [1368, 1397],
    file: 'ter-1368.json',
    data: snap1368,
  },
  {
    snapshotId: 'ter-1399',
    year: 1399,
    title: '建文元年（1399）· 削藩风暴与燕王靖难起兵',
    eraNote: '建文帝削废五王逼反燕藩，朱棣夺北平九门并奇袭大宁收编朵颜三卫骑兵，南北大战全面爆发。',
    effectiveRange: [1398, 1401],
    file: 'ter-1399.json',
    data: snap1399,
  },
  {
    snapshotId: 'ter-1402',
    year: 1402,
    title: '建文四年 / 永乐元年（1402）· 靖难功成与永乐宏图',
    eraNote: '朱棣灵璧决胜渡江入京，大明开启迁都北京“天子守国门”、郑和下西洋与五征漠北之极盛时代。',
    effectiveRange: [1402, 1662],
    file: 'ter-1402.json',
    data: snap1402,
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const s of snapshots) {
  fs.writeFileSync(
    path.join(OUT_DIR, s.file),
    JSON.stringify(s.data, null, 2) + '\n',
    'utf8'
  );
}
fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  JSON.stringify(
    snapshots.map(({ data: _d, ...meta }) => meta),
    null,
    2
  ) + '\n',
  'utf8'
);
console.log(`Built ${snapshots.length} coastline-clipped, zero-overlap territory snapshots in ${OUT_DIR}`);
