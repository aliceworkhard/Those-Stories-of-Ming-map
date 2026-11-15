export const SITE_CONFIG = {
  title: '明途 · 舆图纪',
  englishTitle: 'Ming Story Atlas',
  subtitle: '《明朝那些事儿》三维历史事件、疆域变迁与战役因果推演舆图',
  repoUrl: 'https://github.com/aliceworkhard/Those-Stories-of-Ming-map',
  repoSlug: 'aliceworkhard/Those-Stories-of-Ming-map',
  license: 'MIT',
  timeline: {
    minYear: 1344,
    maxYear: 1644,
    extendedMaxYear: 1662,
    defaultYear: 1344,
    featuredEras: [
      {
        id: 'era-founding',
        label: '元末群雄与开国',
        subLabel: '壹 · 洪武大帝',
        yearRange: [1344, 1368] as [number, number],
        defaultYear: 1344,
        camera: {
          center: [117.15, 33.15] as [number, number],
          zoom: 6.1,
          pitch: 36,
          bearing: 0,
        },
      },
      {
        id: 'era-jingnan',
        label: '削藩与靖难之役',
        subLabel: '壹~贰 · 建文永乐',
        yearRange: [1398, 1402] as [number, number],
        defaultYear: 1399,
        camera: {
          center: [117.2, 36.2] as [number, number],
          zoom: 5.6,
          pitch: 38,
          bearing: 0,
        },
      },
    ],
  },
  defaultCamera: {
    center: [117.15, 33.15] as [number, number],
    zoom: 6.1,
    pitch: 36,
    bearing: 0,
  },
} as const;
