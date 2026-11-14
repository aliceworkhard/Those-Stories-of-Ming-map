import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site';
import './globals.css';

export const metadata: Metadata = {
  title: `${SITE_CONFIG.title} | ${SITE_CONFIG.englishTitle}`,
  description: SITE_CONFIG.subtitle,
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
