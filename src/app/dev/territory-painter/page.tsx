import type { Metadata } from 'next';
import PainterWorkspace from '@/components/painter/PainterWorkspace';

export const metadata: Metadata = {
  title: '舆图画笔擦写工坊 · 明途 · 舆图纪',
  description:
    '《明途 · 舆图纪》内置开源历史疆域 Web GIS 擦写制图工坊：支持海岸线自动锁边、多政权互斥布尔涂抹扩张与橡皮擦除、考据底图叠印描摹及 TopoJSON 导出。',
};

export default function TerritoryPainterPage() {
  return <PainterWorkspace />;
}
