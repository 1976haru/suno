import type { ThumbnailBadgePosition, ThumbnailBrandBadge, ThumbnailFontId, ThumbnailTextPosition } from '../types';

/**
 * TASK v3.37 (spec item B) — canvas compositing ported from creator-studio's
 * tools/thumbnail/canvas.js. Pure geometry (wrapAlign/anchorPoint) is kept
 * free of DOM APIs and exported separately so it can be unit tested in this
 * repo's vitest setup, which deliberately has no jsdom/canvas polyfill (see
 * providerSettingsPersistence.ts) — everything else here only runs in a real
 * browser.
 */

export interface ThumbnailFontOption {
  id: ThumbnailFontId;
  family: string;
  weight: string;
}

export const FONT_OPTIONS: ThumbnailFontOption[] = [
  { id: 'blackHanSans', family: 'Black Han Sans', weight: '400' },
  { id: 'doHyeon', family: 'Do Hyeon', weight: '400' },
  { id: 'jua', family: 'Jua', weight: '400' },
  { id: 'gowunDodum', family: 'Gowun Dodum', weight: '400' },
  { id: 'yeonSung', family: 'Yeon Sung', weight: '400' },
  { id: 'nanumPenScript', family: 'Nanum Pen Script', weight: '400' }
];

export const TEXT_COLORS = ['#FFFFFF', '#FFFF00', '#00FFFF', '#FF69B4', '#7CFC00', '#FFA500'];
export const SHADOW_COLORS = ['#000000', '#FFFFFF', '#D30000', '#0000FF'];

export interface ThumbnailStylePreset {
  id: string;
  label: string;
  fontId: ThumbnailFontId;
  textColor: string;
  shadowColor: string;
  shadowWidth: number;
  strokeOn: boolean;
}

export const BASE_STYLE_PRESETS: ThumbnailStylePreset[] = [
  { id: 'preset1', label: 'Black Han Sans · 흰색 · 검은그림자', fontId: 'blackHanSans', textColor: '#FFFFFF', shadowColor: '#000000', shadowWidth: 2, strokeOn: true },
  { id: 'preset2', label: 'Do Hyeon · 노랑 · 검은그림자', fontId: 'doHyeon', textColor: '#FFFF00', shadowColor: '#000000', shadowWidth: 2, strokeOn: true },
  { id: 'preset3', label: 'Jua · 흰색 · 빨강그림자', fontId: 'jua', textColor: '#FFFFFF', shadowColor: '#D30000', shadowWidth: 2, strokeOn: true },
  { id: 'preset4', label: 'Gowun Dodum · 노랑 · 파랑그림자', fontId: 'gowunDodum', textColor: '#FFFF00', shadowColor: '#0000FF', shadowWidth: 2, strokeOn: true }
];

export const TEXT_POSITIONS: { id: ThumbnailTextPosition; label: string }[] = [
  { id: 'top-center', label: '상단 중앙' },
  { id: 'center', label: '중앙' },
  { id: 'bottom-center', label: '하단 중앙' },
  { id: 'top-left', label: '좌상단' },
  { id: 'bottom-left', label: '좌하단' },
  { id: 'top-right', label: '우상단' },
  { id: 'bottom-right', label: '우하단' }
];

export function fontFamilyById(id: ThumbnailFontId): ThumbnailFontOption {
  return FONT_OPTIONS.find(f => f.id === id) ?? FONT_OPTIONS[0];
}

export interface ThumbnailTextStyle {
  fontId: ThumbnailFontId;
  textColor: string;
  shadowColor: string;
  shadowWidth: number;
  strokeOn: boolean;
  position: ThumbnailTextPosition;
}

export async function ensureFontsLoaded(fontIds: ThumbnailFontId[] = FONT_OPTIONS.map(f => f.id)): Promise<void> {
  const jobs = fontIds.map(id => {
    const font = fontFamilyById(id);
    return document.fonts.load(`48px "${font.family}"`).catch(() => undefined);
  });
  await Promise.all(jobs);
  await document.fonts.ready;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

export function drawBackgroundCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, width: number, height: number, fillColor = '#111622'): void {
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, width, height);
  if (!image) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

export type TextAlign = 'left' | 'right' | 'center';

/** Pure — no DOM dependency, safe to unit test directly. */
export function wrapAlign(position: ThumbnailTextPosition | ThumbnailBadgePosition): TextAlign {
  if (position.includes('left')) return 'left';
  if (position.includes('right')) return 'right';
  return 'center';
}

export interface AnchorPoint {
  x: number;
  y: number;
  align: TextAlign;
}

/** Pure — no DOM dependency, safe to unit test directly. */
export function anchorPoint(position: ThumbnailTextPosition, width: number, height: number, padding: number): AnchorPoint {
  const align = wrapAlign(position);
  const x = align === 'left' ? padding : align === 'right' ? width - padding : width / 2;
  let y: number;
  if (position.startsWith('top')) y = padding;
  else if (position.startsWith('bottom')) y = height - padding;
  else y = height / 2;
  return { x, y, align };
}

function drawStyledLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: ThumbnailTextStyle & { align: TextAlign }, fontSize: number): void {
  const font = fontFamilyById(style.fontId);
  ctx.font = `${font.weight} ${fontSize}px "${font.family}", sans-serif`;
  ctx.textAlign = style.align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (style.shadowWidth > 0) {
    ctx.fillStyle = style.shadowColor;
    ctx.fillText(text, x + style.shadowWidth, y + style.shadowWidth);
  }
  if (style.strokeOn) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.09));
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = style.textColor;
  ctx.fillText(text, x, y);
}

export function drawTextBlock(ctx: CanvasRenderingContext2D, text: string, canvasWidth: number, canvasHeight: number, style: ThumbnailTextStyle): void {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2);
  if (!lines.length) return;
  const fontSize = Math.round(canvasHeight * (lines.length > 1 ? 0.11 : 0.13));
  const lineHeight = fontSize * 1.28;
  const padding = Math.round(canvasHeight * 0.07);
  const anchor = anchorPoint(style.position, canvasWidth, canvasHeight, padding);
  const lineStyle = { ...style, align: anchor.align };

  const totalHeight = lineHeight * lines.length;
  let startY: number;
  if (style.position.startsWith('top')) startY = anchor.y + fontSize / 2;
  else if (style.position.startsWith('bottom')) startY = anchor.y - totalHeight + lineHeight / 2;
  else startY = anchor.y - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    drawStyledLine(ctx, line, anchor.x, startY + i * lineHeight, lineStyle, fontSize);
  });
}

export function drawBrandBadge(ctx: CanvasRenderingContext2D, badge: ThumbnailBrandBadge | undefined, canvasWidth: number, canvasHeight: number): void {
  if (!badge || (!badge.icon && !badge.tag)) return;
  const position = badge.position || 'bottom-right';
  const padding = Math.round(canvasHeight * 0.035);
  const fontSize = Math.round(canvasHeight * 0.045);
  const label = `${badge.icon || ''} ${badge.tag || ''}`.trim();
  ctx.font = `700 ${fontSize}px "Pretendard", "Malgun Gothic", sans-serif`;
  const textWidth = ctx.measureText(label).width;
  const boxWidth = textWidth + fontSize * 1.6;
  const boxHeight = fontSize * 1.9;
  const align = wrapAlign(position);
  const x = align === 'left' ? padding : align === 'right' ? canvasWidth - padding - boxWidth : (canvasWidth - boxWidth) / 2;
  const y = position.startsWith('top') ? padding : canvasHeight - padding - boxHeight;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const radius = boxHeight / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
  ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
  ctx.arcTo(x, y + boxHeight, x, y, radius);
  ctx.arcTo(x, y, x + boxWidth, y, radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + boxWidth / 2, y + boxHeight / 2 + 1);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('이미지 변환에 실패했습니다.'));
    }, type);
  });
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ComposeImageOptions {
  width: number;
  height: number;
  backgroundImage: HTMLImageElement | null;
  copyText: string;
  textStyle: ThumbnailTextStyle;
  badge?: ThumbnailBrandBadge;
  showBadge?: boolean;
}

export async function composeImage(opts: ComposeImageOptions): Promise<HTMLCanvasElement> {
  const { width, height, backgroundImage, copyText, textStyle, badge, showBadge = true } = opts;
  await ensureFontsLoaded([textStyle.fontId]);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 초기화하지 못했습니다.');
  drawBackgroundCover(ctx, backgroundImage, width, height);
  if (copyText) drawTextBlock(ctx, copyText, width, height, textStyle);
  if (showBadge && badge) drawBrandBadge(ctx, badge, width, height);
  return canvas;
}
