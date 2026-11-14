export const SITE_CONFIG = {
  title: '明途 · 舆图纪',
  englishTitle: 'Ming Story Atlas',
  subtitle: '《明朝那些事儿》三维历史事件、疆域变迁与战役因果推演舆图',
  repoUrl: 'https://github.com/aliceworkhard/Those-Stories-of-Ming-map',
  license: 'MIT',
  timeline: {
    minYear: 1344,
    maxYear: 1644,
    extendedMaxYear: 1662,
    defaultYear: 1363,
    featuredEras: [
      {
        id: 'era-founding',
        label: '元末群雄与开国',
        subLabel: '壹 · 洪武大帝',
        yearRange: [1352, 1368] as [number, number],
        defaultYear: 1363,
        camera: { center: [116.35, 30.85] as [number, number], zoom: 5.8, pitch: 42, bearing: -8 },
      },
      {
        id: 'era-jingnan',
        label: '削藩与靖难之役',
        subLabel: '壹~贰 · 建文永乐',
        yearRange: [1398, 1402] as [number, number],
        defaultYear: 1399,
        camera: { center: [117.2, 36.2] as [number, number], zoom: 5.6, pitch: 45, bearing: -12 },
      },
    ],
  },
  defaultCamera: {
    center: [116.2, 31.8] as [number, number],
    zoom: 5.4,
    pitch: 40,
    bearing: 0,
  },
} as const;
