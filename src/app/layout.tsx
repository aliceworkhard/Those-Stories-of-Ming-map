import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://those-stories-of-ming-map.vercel.app'),
  title: `《明朝那些事儿》三维历史地图与战役推演系统 · ${SITE_CONFIG.title} | ${SITE_CONFIG.englishTitle}`,
  description:
    '以当年明月《明朝那些事儿》三百年叙事为脉络的开源三维交互式明朝历史地图、大明动态疆域演变、战役行军路线运镜推演与历史因果图谱系统（1344–1662）。',
  keywords: [
    '明朝那些事儿',
    '明朝那些事儿地图',
    '明朝历史地图',
    '当年明月',
    '大明疆域变化',
    '明朝战役推演',
    '鄱阳湖大战',
    '靖难之役',
    '洪武北伐',
    '三维历史地图',
    'Those Stories of Ming',
    'Ming Dynasty Map',
  ],
  openGraph: {
    title: `《明朝那些事儿》三维历史地图与战役推演 · ${SITE_CONFIG.title}`,
    description:
      '跟随《明朝那些事儿》读懂明朝三百年：三维山川地形、真实历史州府疆域擦写、动态行军路线箭头、3D 自动运镜推演与历史因果图谱。',
    url: 'https://those-stories-of-ming-map.vercel.app',
    siteName: SITE_CONFIG.title,
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: '/docs/atlas-preview.png',
        width: 1440,
        height: 900,
        alt: '《明朝那些事儿》三维历史地图与战役推演系统预览',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
