import type maplibregl from 'maplibre-gl';
import type { MapVisualTheme } from '@/types/ming';

let activeMapInstance: maplibregl.Map | null = null;

export function registerMapInstanceForCapture(map: maplibregl.Map | null): void {
  activeMapInstance = map;
}

/**
 * Captures the live WebGL MapLibre framebuffer inside the `'render'` callback
 * so `preserveDrawingBuffer: false` stays fast during normal 120fps browsing!
 */
export function captureMapSnapshotDataUrl(timeoutMs = 700): Promise<string | null> {
  const map = activeMapInstance;
  if (!map) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    map.once('render', () => {
      window.clearTimeout(timer);
      try {
        const dataUrl = map.getCanvas().toDataURL('image/png');
        finish(dataUrl && dataUrl.length > 256 ? dataUrl : null);
      } catch {
        finish(null);
      }
    });

    try {
      map.triggerRepaint();
    } catch {
      window.clearTimeout(timer);
      finish(null);
    }
  });
}

export interface SharePosterPayload {
  sealText: string;
  eraBadge: string;
  title: string;
  locationLine: string;
  summary: string;
  whyInsight: string;
  shareUrl: string;
  theme: MapVisualTheme;
}

function wrapChineseLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const lines: string[] = [];
  let cur = '';

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
      lines.push(cur);
      if (lines.length >= maxLines) {
        const last = lines[maxLines - 1];
        lines[maxLines - 1] = `${last.slice(0, Math.max(1, last.length - 1))}…`;
        return lines;
      }
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) {
    lines.push(cur);
  }
  return lines;
}

/**
 * Renders a `1200 x 720` classical Song/Ming Xuan-paper (or Obsidian-Gold) Share Card PNG
 * combining the live 3D/2.5D map snapshot with vermilion seals, causal insight, and deep-link!
 */
export async function renderXuanPaperShareCard(
  payload: SharePosterPayload,
  mapDataUrl: string | null
): Promise<string> {
  const W = 1200;
  const H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const isDark = payload.theme === 'xuanmo';
  const bg = isDark ? '#0D131D' : '#FAF4E6';
  const outerBorder = isDark ? '#D97706' : '#9E2318';
  const innerBorder = isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(158, 35, 24, 0.28)';
  const primaryText = isDark ? '#FEF3C7' : '#231815';
  const secondaryText = isDark ? '#CBD5E1' : '#57493F';
  const accentColor = isDark ? '#FBBF24' : '#9E2318';

  // 1. Xuan-Paper / Obsidian Background + Subtle Fiber Gradient
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, isDark ? 'rgba(30, 41, 59, 0.32)' : 'rgba(235, 222, 198, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Classical Double-Line Scroll Frame
  ctx.strokeStyle = outerBorder;
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = innerBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  // 3. Left Frame: Live Map Snapshot (`640 x 596` at x=48, y=52)
  const mapX = 48;
  const mapY = 52;
  const mapW = 636;
  const mapH = 590;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapW, mapH, 14);
  ctx.clip();

  let drewMap = false;
  if (mapDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = mapDataUrl;
      });
      const scale = Math.max(mapW / img.width, mapH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(
        img,
        mapX + (mapW - dw) / 2,
        mapY + (mapH - dh) / 2,
        dw,
        dh
      );
      drewMap = true;
    } catch {
      drewMap = false;
    }
  }

  if (!drewMap) {
    const fallbackGrad = ctx.createLinearGradient(mapX, mapY, mapX + mapW, mapY + mapH);
    fallbackGrad.addColorStop(0, isDark ? '#101E2E' : '#DCE8D6');
    fallbackGrad.addColorStop(0.55, isDark ? '#17283B' : '#EFE6D4');
    fallbackGrad.addColorStop(1, isDark ? '#0B1522' : '#B9D4DF');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(mapX, mapY, mapW, mapH);
  }
  ctx.restore();

  ctx.strokeStyle = outerBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapW, mapH, 14);
  ctx.stroke();

  // Era Pill Overlay on Top-Left of Map Frame
  ctx.font = '700 18px "PingFang SC", "Microsoft YaHei", sans-serif';
  const badgeW = Math.min(mapW - 32, ctx.measureText(payload.eraBadge).width + 28);
  ctx.fillStyle = '#9E2318';
  ctx.beginPath();
  ctx.roundRect(mapX + 16, mapY + 16, badgeW, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#FEF3C7';
  ctx.textBaseline = 'middle';
  ctx.fillText(payload.eraBadge, mapX + 30, mapY + 33);

  // 4. Right Column: Vermilion Seal, Title, Narrative & "Why" Key Point (`x = 712..1148`)
  const rx = 712;
  const rw = 436;

  // Vermilion Imperial Square Seal
  ctx.fillStyle = '#9E2318';
  ctx.beginPath();
  ctx.roundRect(rx, 54, 48, 48, 8);
  ctx.fill();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + 4, 58, 40, 40);
  ctx.fillStyle = '#FEF3C7';
  ctx.font = '700 20px "Noto Serif SC", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText(payload.sealText.slice(0, 2), rx + 24, 79);
  ctx.textAlign = 'left';

  ctx.fillStyle = accentColor;
  ctx.font = '700 24px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.fillText('明途 · 舆图纪', rx + 62, 70);
  ctx.fillStyle = secondaryText;
  ctx.font = '500 13px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('《明朝那些事儿》三维历史舆图与战役推演', rx + 62, 94);

  // Divider
  ctx.strokeStyle = innerBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx, 118);
  ctx.lineTo(rx + rw, 118);
  ctx.stroke();

  // Main Title
  ctx.fillStyle = primaryText;
  ctx.font = '700 26px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  const titleLines = wrapChineseLines(ctx, payload.title, rw, 2);
  let cursorY = 152;
  for (const line of titleLines) {
    ctx.fillText(line, rx, cursorY);
    cursorY += 36;
  }

  // Location Line
  if (payload.locationLine) {
    ctx.fillStyle = accentColor;
    ctx.font = '600 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    const locLines = wrapChineseLines(ctx, `📍 ${payload.locationLine}`, rw, 1);
    if (locLines[0]) {
      ctx.fillText(locLines[0], rx, cursorY + 4);
      cursorY += 32;
    }
  }

  // Summary Paragraph
  ctx.fillStyle = primaryText;
  ctx.font = '400 16px "PingFang SC", "Microsoft YaHei", sans-serif';
  const sumLines = wrapChineseLines(ctx, payload.summary, rw, 5);
  cursorY += 8;
  for (const line of sumLines) {
    ctx.fillText(line, rx, cursorY);
    cursorY += 26;
  }

  // "Why It Happened" Box
  if (payload.whyInsight) {
    const boxY = Math.max(cursorY + 12, 392);
    const boxH = 188;
    ctx.fillStyle = isDark
      ? 'rgba(245, 158, 11, 0.10)'
      : 'rgba(158, 35, 24, 0.06)';
    ctx.strokeStyle = isDark
      ? 'rgba(245, 158, 11, 0.35)'
      : 'rgba(158, 35, 24, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx, boxY, rw, boxH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.font = '700 16px "Noto Serif SC", "Microsoft YaHei", serif';
    ctx.fillText('◆ 历史追问 · 胜负锁钥', rx + 16, boxY + 26);

    ctx.fillStyle = secondaryText;
    ctx.font = '400 14.5px "PingFang SC", "Microsoft YaHei", sans-serif';
    const whyLines = wrapChineseLines(ctx, payload.whyInsight, rw - 32, 5);
    let wy = boxY + 56;
    for (const line of whyLines) {
      ctx.fillText(line, rx + 16, wy);
      wy += 24;
    }
  }

  // Footer Deep-Link & GitHub Repo Bar (`y = 672`)
  ctx.fillStyle = secondaryText;
  ctx.font = '500 12.5px "PingFang SC", "Microsoft YaHei", sans-serif';
  const cleanUrl =
    payload.shareUrl.length > 64
      ? `${payload.shareUrl.slice(0, 63)}…`
      : payload.shareUrl;
  ctx.fillText(`🔗 现场直链：${cleanUrl}`, 48, 672);

  ctx.textAlign = 'right';
  ctx.fillStyle = accentColor;
  ctx.font = '700 12.5px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(
    '★ GitHub 开源：aliceworkhard/Those-Stories-of-Ming-map · MIT',
    W - 48,
    672
  );

  return canvas.toDataURL('image/png');
}
