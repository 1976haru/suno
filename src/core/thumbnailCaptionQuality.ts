import type { ThumbnailTextLayer } from '../types';
import { fontFamilyById, isHangulText } from './thumbnailCanvas';

export interface ThumbnailCaptionIssue {
  layerId: string;
  role: ThumbnailTextLayer['role'];
  kind: 'clipping' | 'contrast' | 'minimum-size' | 'font-fallback';
  message: string;
}

export interface ThumbnailCaptionQualityReport {
  issues: ThumbnailCaptionIssue[];
  readable: boolean;
}

function hexRgb(value: string): [number, number, number] | undefined {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return undefined;
  return [0, 1, 2].map(index => parseInt(match[1].slice(index * 2, index * 2 + 2), 16)) as [number, number, number];
}

function luminance(value: string): number | undefined {
  const rgb = hexRgb(value);
  if (!rgb) return undefined;
  return rgb.map(channel => channel / 255).map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(backgroundColor: string, textColor: string): number | undefined {
  const background = luminance(backgroundColor);
  const text = luminance(textColor);
  if (background === undefined || text === undefined) return undefined;
  const [light, dark] = background > text ? [background, text] : [text, background];
  return (light + 0.05) / (dark + 0.05);
}

export function recommendedCaptionPreset(backgroundColor: string): 'light-background' | 'dark-background' {
  const background = luminance(backgroundColor);
  return background !== undefined && background >= 0.5 ? 'light-background' : 'dark-background';
}

export function analyzeThumbnailCaptions(
  ctx: CanvasRenderingContext2D,
  layers: ThumbnailTextLayer[],
  canvasWidth: number,
  canvasHeight: number,
  backgroundColor = '#111622'
): ThumbnailCaptionQualityReport {
  const issues: ThumbnailCaptionIssue[] = [];
  const safeWidth = canvasWidth * 0.9;
  for (const layer of layers) {
    if (!layer.enabled || layer.role === 'divider' || !layer.text.trim()) continue;
    const font = fontFamilyById(layer.fontId);
    const fontSize = Math.round(canvasHeight * layer.sizeRatio);
    ctx.font = `${font.weight} ${fontSize}px "${font.family}", sans-serif`;
    const width = Math.max(...layer.text.split('\n').map(line => ctx.measureText(line).width), 0);
    if (width > safeWidth) issues.push({ layerId: layer.id, role: layer.role, kind: 'clipping', message: '텍스트가 좌우 5% 안전영역을 넘습니다.' });
    if (fontSize < canvasHeight * 0.04) issues.push({ layerId: layer.id, role: layer.role, kind: 'minimum-size', message: '모바일에서 읽기 어려울 수 있습니다. 캔버스 높이의 4% 이상을 권장합니다.' });
    if (isHangulText(layer.text) && !font.hangulCapable) issues.push({ layerId: layer.id, role: layer.role, kind: 'font-fallback', message: '한글 글리프가 확인된 폰트로 자동 폴백하세요.' });
    const ratio = contrastRatio(backgroundColor, layer.textColor);
    if (ratio !== undefined && ratio < 3) issues.push({ layerId: layer.id, role: layer.role, kind: 'contrast', message: '배경과 대비가 낮습니다. 외곽선 또는 그림자를 추가하세요.' });
  }
  return { issues, readable: issues.length === 0 };
}
