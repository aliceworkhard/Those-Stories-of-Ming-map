'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const CampaignBuilderStudio = dynamic(
  () => import('@/components/builder/CampaignBuilderStudio'),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-dvh flex flex-col items-center justify-center bg-[#EFE6D4] text-stone-800 gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#9E2318] border-2 border-amber-300 flex items-center justify-center shadow-lg">
          <span className="font-serif font-bold text-amber-100 text-base">
            兵略
          </span>
        </div>
        <p className="font-serif text-sm tracking-widest opacity-80">
          正在展卷《可视化战役投稿工坊》战术绘线沙盘……
        </p>
      </div>
    ),
  }
);

export default function CampaignBuilderWorkspace() {
  return <CampaignBuilderStudio />;
}
