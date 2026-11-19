'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const TerritoryPainterStudio = dynamic(
  () => import('@/components/painter/TerritoryPainterStudio'),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#EFE6D4] text-stone-800 gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#9E2318] border-2 border-amber-300 flex items-center justify-center shadow-lg">
          <span className="font-serif font-bold text-amber-100 text-base">
            制图
          </span>
        </div>
        <p className="font-serif text-sm tracking-widest opacity-80">
          正在加载《舆图画笔擦写工坊》布尔 GIS 引擎与海岸线掩膜……
        </p>
      </div>
    ),
  }
);

export default function PainterWorkspace() {
  return <TerritoryPainterStudio />;
}
