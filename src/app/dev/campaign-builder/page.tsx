import type { Metadata } from 'next';
import CampaignBuilderWorkspace from '@/components/builder/CampaignBuilderWorkspace';

export const metadata: Metadata = {
  title: '可视化战役投稿工坊 · 明途 · 舆图纪',
  description:
    '《明途 · 舆图纪》零代码可视化战役与行军路线创作工坊：点击地图绘制多路有序行军箭矢、放置交战印章、实时预览动态推演并一键导出合规 JSON 提交社区 PR。',
};

export default function CampaignBuilderPage() {
  return <CampaignBuilderWorkspace />;
}
