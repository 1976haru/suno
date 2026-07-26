import type {
  ThumbnailBadgePosition,
  ThumbnailBrandBadge,
  ThumbnailDividerPreset,
  ThumbnailFontId,
  ThumbnailTextLayer,
  ThumbnailTextPosition,
  ThumbnailTextStyle
} from '../types';

export type { ThumbnailDividerPreset, ThumbnailLayerRole, ThumbnailTextLayer, ThumbnailTextStyle } from '../types';

export interface ThumbnailFontOption {
  id: ThumbnailFontId;
  family: string;
  weight: string;
  hangulCapable: boolean;
}

export const FONT_OPTIONS: ThumbnailFontOption[] = [
  { id: 'blackHanSans', family: 'Black Han Sans', weight: '400', hangulCapable: true },
  { id: 'doHyeon', family: 'Do Hyeon', weight: '400', hangulCapable: true },
  { id: 'jua', family: 'Jua', weight: '400', hangulCapable: true },
  { id: 'gowunDodum', family: 'Gowun Dodum', weight: '400', hangulCapable: true },
  { id: 'yeonSung', family: 'Yeon Sung', weight: '400', hangulCapable: true },
  { id: 'nanumPenScript', family: 'Nanum Pen Script', weight: '400', hangulCapable: true }
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
  { id: 'preset1', label: 'Black Han Sans / white / black shadow', fontId: 'blackHanSans', textColor: '#FFFFFF', shadowColor: '#000000', shadowWidth: 2, strokeOn: true },
  { id: 'preset2', label: 'Do Hyeon / yellow / black shadow', fontId: 'doHyeon', textColor: '#FFFF00', shadowColor: '#000000', shadowWidth: 2, strokeOn: true },
  { id: 'preset3', label: 'Jua / white / red shadow', fontId: 'jua', textColor: '#FFFFFF', shadowColor: '#D30000', shadowWidth: 2, strokeOn: true },
  { id: 'preset4', label: 'Gowun Dodum / yellow / blue shadow', fontId: 'gowunDodum', textColor: '#FFFF00', shadowColor: '#0000FF', shadowWidth: 2, strokeOn: true }
];

export const TEXT_POSITIONS: { id: ThumbnailTextPosition; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-center', label: 'Top center' },
  { id: 'top-right', label: 'Top right' },
  { id: 'center-left', label: 'Center left' },
  { id: 'center', label: 'Center' },
  { id: 'center-right', label: 'Center right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-center', label: 'Bottom center' },
  { id: 'bottom-right', label: 'Bottom right' }
];

export const DEFAULT_TEXT_PADDING_RATIO = 0.07;
export const DEFAULT_TEXT_LINE_HEIGHT_RATIO = 1.28;
export const DEFAULT_TEXT_MAX_LINES = 2;
export const DEFAULT_DIVIDER_PRESET: ThumbnailDividerPreset = 'line-ornament';
export const DEFAULT_DIVIDER_WIDTH_RATIO = 0.24;
export const DEFAULT_DIVIDER_THICKNESS_RATIO = 0.0025;

export function fontFamilyById(id: ThumbnailFontId): ThumbnailFontOption {
  return FONT_OPTIONS.find(f => f.id === id) ?? FONT_OPTIONS[0];
}

export function isHangulText(text: string): boolean {
  return /[\uac00-\ud7af]/u.test(text);
}

export function hangulFontOptions(): ThumbnailFontOption[] {
  return FONT_OPTIONS.filter(font => font.hangulCapable);
}

export async function ensureFontsLoaded(fontIds: ThumbnailFontId[] = FONT_OPTIONS.map(f => f.id)): Promise<void> {
  if (!('fonts' in document)) return;
  const jobs = [...new Set(fontIds)].map(id => {
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
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

const MAX_UPLOAD_LONG_EDGE = 4000;

function downscaleImageToDataUrl(image: HTMLImageElement, maxLongEdge: number, mimeType: string, quality: number): string {
  const scale = maxLongEdge / Math.max(image.width, image.height);
  const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return image.src;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mimeType, quality);
}

export async function loadUserBackgroundDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded (PNG/JPEG/WEBP).');
  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);
  if (Math.max(image.width, image.height) <= MAX_UPLOAD_LONG_EDGE) return rawDataUrl;
  return downscaleImageToDataUrl(image, MAX_UPLOAD_LONG_EDGE, file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
}

const EDIT_INPUT_MAX_LONG_EDGE = 1536;

export async function resizeDataUrlForEdit(dataUrl: string, maxLongEdge = EDIT_INPUT_MAX_LONG_EDGE): Promise<string> {
  const image = await loadImage(dataUrl);
  if (Math.max(image.width, image.height) <= maxLongEdge) return dataUrl;
  return downscaleImageToDataUrl(image, maxLongEdge, 'image/jpeg', 0.9);
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

export function anchorPoint(position: ThumbnailTextPosition, width: number, height: number, padding: number): AnchorPoint {
  const align = wrapAlign(position);
  const x = align === 'left' ? padding : align === 'right' ? width - padding : width / 2;
  let y: number;
  if (position.startsWith('top')) y = padding;
  else if (position.startsWith('bottom')) y = height - padding;
  else y = height / 2;
  return { x, y, align };
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function textLines(text: string, maxLines: number): string[] {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, maxLines);
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, lines: string[], maxLines: number, maxWidth: number): string[] {
  const wrapped: string[] = [];
  for (const line of lines) {
    if (ctx.measureText(line).width <= maxWidth) {
      wrapped.push(line);
      continue;
    }
    const words = line.includes(' ') ? line.split(/\s+/u) : Array.from(line);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current}${line.includes(' ') ? ' ' : ''}${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
      if (wrapped.length >= maxLines) break;
    }
    if (wrapped.length < maxLines && current) wrapped.push(current);
    if (wrapped.length >= maxLines) break;
  }
  return wrapped.slice(0, maxLines);
}

function legacyTitleSizeRatio(lineCount: number): number {
  return lineCount > 1 ? 0.11 : 0.13;
}

type RuntimeTextStyle = ThumbnailTextStyle & Partial<ThumbnailTextLayer>;

function resolveRuntimeTextStyle(style: ThumbnailTextStyle): RuntimeTextStyle {
  return style as RuntimeTextStyle;
}

type LetterSpacingContext = CanvasRenderingContext2D & { letterSpacing: string };

function hasNativeLetterSpacing(ctx: CanvasRenderingContext2D): ctx is LetterSpacingContext {
  return 'letterSpacing' in ctx;
}

function drawUnspacedText(ctx: CanvasRenderingContext2D, stroke: boolean, text: string, x: number, y: number): void {
  if (stroke) ctx.strokeText(text, x, y);
  else ctx.fillText(text, x, y);
}

function drawManualLetterSpacing(ctx: CanvasRenderingContext2D, stroke: boolean, text: string, x: number, y: number, letterSpacing: number): void {
  const chars = Array.from(text);
  if (chars.length <= 1 || letterSpacing === 0) {
    drawUnspacedText(ctx, stroke, text, x, y);
    return;
  }

  const widths = chars.map(char => ctx.measureText(char).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + letterSpacing * (chars.length - 1);
  const originalAlign = ctx.textAlign;
  let cursor = x;
  if (originalAlign === 'center') cursor -= totalWidth / 2;
  else if (originalAlign === 'right' || originalAlign === 'end') cursor -= totalWidth;

  ctx.textAlign = 'left';
  chars.forEach((char, index) => {
    drawUnspacedText(ctx, stroke, char, cursor, y);
    cursor += widths[index] + letterSpacing;
  });
  ctx.textAlign = originalAlign;
}

function drawTextWithLetterSpacing(ctx: CanvasRenderingContext2D, stroke: boolean, text: string, x: number, y: number, letterSpacing: number): void {
  if (letterSpacing === 0) {
    drawUnspacedText(ctx, stroke, text, x, y);
    return;
  }

  if (hasNativeLetterSpacing(ctx)) {
    const previous = ctx.letterSpacing;
    ctx.letterSpacing = `${letterSpacing}px`;
    try {
      drawUnspacedText(ctx, stroke, text, x, y);
    } finally {
      ctx.letterSpacing = previous;
    }
    return;
  }

  drawManualLetterSpacing(ctx, stroke, text, x, y, letterSpacing);
}

function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: ThumbnailTextStyle & { align: TextAlign },
  fontSize: number,
  letterSpacing = 0
): void {
  const font = fontFamilyById(style.fontId);
  ctx.font = `${font.weight} ${fontSize}px "${font.family}", sans-serif`;
  ctx.textAlign = style.align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (style.shadowWidth > 0) {
    ctx.fillStyle = style.shadowColor;
    drawTextWithLetterSpacing(ctx, false, text, x + style.shadowWidth, y + style.shadowWidth, letterSpacing);
  }
  if (style.strokeOn) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.09));
    drawTextWithLetterSpacing(ctx, true, text, x, y, letterSpacing);
  }
  ctx.fillStyle = style.textColor;
  drawTextWithLetterSpacing(ctx, false, text, x, y, letterSpacing);
}

export function drawTextBlock(ctx: CanvasRenderingContext2D, text: string, canvasWidth: number, canvasHeight: number, style: ThumbnailTextStyle): void {
  const runtimeStyle = resolveRuntimeTextStyle(style);
  const maxLines = clampInt(runtimeStyle.maxLines, DEFAULT_TEXT_MAX_LINES, 1, 4);
  const lines = textLines(text, maxLines);
  if (!lines.length) return;

  const fontSize = Math.round(canvasHeight * clampNumber(runtimeStyle.sizeRatio, legacyTitleSizeRatio(lines.length), 0.02, 0.22));
  const font = fontFamilyById(style.fontId);
  ctx.font = `${font.weight} ${fontSize}px "${font.family}", sans-serif`;
  const fittedLines = wrapCanvasLines(ctx, lines, maxLines, canvasWidth * 0.9);
  const lineHeight = fontSize * clampNumber(runtimeStyle.lineHeightRatio, DEFAULT_TEXT_LINE_HEIGHT_RATIO, 0.75, 2.4);
  const padding = Math.round(canvasHeight * clampNumber(runtimeStyle.paddingRatio, DEFAULT_TEXT_PADDING_RATIO, 0, 0.3));
  const offsetX = canvasWidth * clampNumber(runtimeStyle.offsetXRatio, 0, -0.5, 0.5);
  const offsetY = canvasHeight * clampNumber(runtimeStyle.offsetYRatio, 0, -0.5, 0.5);
  const letterSpacing = canvasHeight * clampNumber(runtimeStyle.letterSpacingRatio, 0, -0.05, 0.12);
  const opacity = clampNumber(runtimeStyle.opacity, 1, 0, 1);

  const anchor = anchorPoint(style.position, canvasWidth, canvasHeight, padding);
  const lineStyle = { ...style, align: anchor.align };
  const totalHeight = lineHeight * fittedLines.length;
  let startY: number;
  if (style.position.startsWith('top')) startY = anchor.y + fontSize / 2;
  else if (style.position.startsWith('bottom')) startY = anchor.y - totalHeight + lineHeight / 2;
  else startY = anchor.y - totalHeight / 2 + lineHeight / 2;

  if (opacity < 1) {
    ctx.save();
    ctx.globalAlpha *= opacity;
  }

  fittedLines.forEach((line, i) => {
    drawStyledLine(ctx, line, anchor.x + offsetX, startY + i * lineHeight + offsetY, lineStyle, fontSize, letterSpacing);
  });

  if (opacity < 1) ctx.restore();
}

function dividerGeometry(layer: ThumbnailTextLayer, canvasWidth: number, canvasHeight: number) {
  const padding = Math.round(canvasHeight * clampNumber(layer.paddingRatio, DEFAULT_TEXT_PADDING_RATIO, 0, 0.3));
  const anchor = anchorPoint(layer.position, canvasWidth, canvasHeight, padding);
  const offsetX = canvasWidth * clampNumber(layer.offsetXRatio, 0, -0.5, 0.5);
  const offsetY = canvasHeight * clampNumber(layer.offsetYRatio, 0, -0.5, 0.5);
  const width = canvasWidth * clampNumber(layer.dividerWidthRatio, DEFAULT_DIVIDER_WIDTH_RATIO, 0.02, 0.95);
  const y = anchor.y + offsetY;
  let startX: number;
  if (anchor.align === 'left') startX = anchor.x + offsetX;
  else if (anchor.align === 'right') startX = anchor.x + offsetX - width;
  else startX = anchor.x + offsetX - width / 2;
  return { anchor, startX, endX: startX + width, centerX: startX + width / 2, y, width };
}

export function drawDivider(ctx: CanvasRenderingContext2D, layer: ThumbnailTextLayer, canvasWidth: number, canvasHeight: number): void {
  if (!layer.enabled) return;
  const preset = layer.dividerPreset ?? DEFAULT_DIVIDER_PRESET;
  const opacity = clampNumber(layer.opacity, 1, 0, 1);
  const geometry = dividerGeometry(layer, canvasWidth, canvasHeight);

  ctx.save();
  ctx.globalAlpha *= opacity;

  if (preset === 'text') {
    const fontSize = Math.round(canvasHeight * clampNumber(layer.sizeRatio, 0.045, 0.02, 0.22));
    const letterSpacing = canvasHeight * clampNumber(layer.letterSpacingRatio, 0, -0.05, 0.12);
    drawStyledLine(ctx, layer.text, geometry.anchor.x + canvasWidth * clampNumber(layer.offsetXRatio, 0, -0.5, 0.5), geometry.y, { ...layer, align: geometry.anchor.align }, fontSize, letterSpacing);
    ctx.restore();
    return;
  }

  const thickness = Math.max(1, Math.round(canvasHeight * clampNumber(layer.dividerThicknessRatio, DEFAULT_DIVIDER_THICKNESS_RATIO, 0.0005, 0.03)));
  ctx.strokeStyle = layer.textColor;
  ctx.fillStyle = layer.textColor;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';

  if (preset === 'line') {
    ctx.beginPath();
    ctx.moveTo(geometry.startX, geometry.y);
    ctx.lineTo(geometry.endX, geometry.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const ornamentGap = Math.max(thickness * 8, canvasWidth * 0.018);
  ctx.beginPath();
  ctx.moveTo(geometry.startX, geometry.y);
  ctx.lineTo(geometry.centerX - ornamentGap, geometry.y);
  ctx.moveTo(geometry.centerX + ornamentGap, geometry.y);
  ctx.lineTo(geometry.endX, geometry.y);
  ctx.stroke();

  const diamond = Math.max(thickness * 2.5, canvasHeight * 0.006);
  ctx.beginPath();
  ctx.moveTo(geometry.centerX, geometry.y - diamond);
  ctx.lineTo(geometry.centerX + diamond, geometry.y);
  ctx.lineTo(geometry.centerX, geometry.y + diamond);
  ctx.lineTo(geometry.centerX - diamond, geometry.y);
  ctx.closePath();
  ctx.fill();

  const dotRadius = Math.max(1, diamond * 0.35);
  for (const x of [geometry.centerX - ornamentGap * 0.55, geometry.centerX + ornamentGap * 0.55]) {
    ctx.beginPath();
    ctx.arc(x, geometry.y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawThumbnailLayer(ctx: CanvasRenderingContext2D, layer: ThumbnailTextLayer, canvasWidth: number, canvasHeight: number): void {
  if (!layer.enabled) return;
  if (layer.role === 'divider') {
    drawDivider(ctx, layer, canvasWidth, canvasHeight);
    return;
  }
  drawTextBlock(ctx, layer.text, canvasWidth, canvasHeight, layer);
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

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode image.'));
    }, type, quality);
  });
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string, options: { type?: string; quality?: number } = {}): Promise<void> {
  const blob = await canvasToBlob(canvas, options.type ?? 'image/png', options.quality);
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
  layers?: ThumbnailTextLayer[];
  copyText?: string;
  textStyle?: ThumbnailTextStyle;
  badge?: ThumbnailBrandBadge;
  showBadge?: boolean;
}

export async function composeImage(opts: ComposeImageOptions): Promise<HTMLCanvasElement> {
  const { width, height, backgroundImage, copyText, textStyle, layers, badge, showBadge = true } = opts;
  const layerMode = Array.isArray(layers);
  const fontIds = layerMode
    ? layers.filter(layer => layer.enabled && (layer.role !== 'divider' || (layer.dividerPreset ?? DEFAULT_DIVIDER_PRESET) === 'text')).map(layer => layer.fontId)
    : copyText && textStyle
      ? [textStyle.fontId]
      : [];
  if (fontIds.length > 0) await ensureFontsLoaded(fontIds);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to initialize canvas.');

  drawBackgroundCover(ctx, backgroundImage, width, height);
  if (layerMode) {
    layers.forEach(layer => drawThumbnailLayer(ctx, layer, width, height));
  } else if (copyText && textStyle) {
    drawTextBlock(ctx, copyText, width, height, textStyle);
  }
  if (showBadge && badge) drawBrandBadge(ctx, badge, width, height);
  return canvas;
}
