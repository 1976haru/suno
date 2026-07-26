import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeImage, drawDivider, drawTextBlock } from '../src/core/thumbnailCanvas';
import { normalizeBrandTemplate } from '../src/core/thumbnailBrandStore';
import { buildThumbnailTextLayersFromSpec, normalizeThumbnailTextLayer } from '../src/core/thumbnailTextLayers';
import type { ThumbnailBrandTemplate, ThumbnailDividerPreset, ThumbnailSpec, ThumbnailTextLayer, ThumbnailTextStyle } from '../src/types';

type CanvasOp = {
  type: string;
  text?: string;
  x?: number;
  y?: number;
  font?: string;
  alpha?: number;
};

type MockContext = CanvasRenderingContext2D & { ops: CanvasOp[] };

function createMockContext(): MockContext {
  const stateStack: Array<Partial<MockContext>> = [];
  const ctx = {
    ops: [] as CanvasOp[],
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low' as ImageSmoothingQuality,
    fillRect(x: number, y: number) {
      this.ops.push({ type: 'fillRect', x, y, alpha: this.globalAlpha });
    },
    drawImage() {
      this.ops.push({ type: 'drawImage' });
    },
    fillText(text: string, x: number, y: number) {
      this.ops.push({ type: 'fillText', text, x, y, font: this.font, alpha: this.globalAlpha });
    },
    strokeText(text: string, x: number, y: number) {
      this.ops.push({ type: 'strokeText', text, x, y, font: this.font, alpha: this.globalAlpha });
    },
    measureText(text: string) {
      return { width: Array.from(text).length * 10 } as TextMetrics;
    },
    beginPath() {
      this.ops.push({ type: 'beginPath' });
    },
    moveTo(x: number, y: number) {
      this.ops.push({ type: 'moveTo', x, y });
    },
    lineTo(x: number, y: number) {
      this.ops.push({ type: 'lineTo', x, y });
    },
    stroke() {
      this.ops.push({ type: 'stroke', alpha: this.globalAlpha });
    },
    fill() {
      this.ops.push({ type: 'fill', alpha: this.globalAlpha });
    },
    closePath() {
      this.ops.push({ type: 'closePath' });
    },
    arc(x: number, y: number) {
      this.ops.push({ type: 'arc', x, y });
    },
    arcTo(x: number, y: number) {
      this.ops.push({ type: 'arcTo', x, y });
    },
    save() {
      stateStack.push({ globalAlpha: this.globalAlpha, textAlign: this.textAlign });
      this.ops.push({ type: 'save' });
    },
    restore() {
      const previous = stateStack.pop();
      if (previous?.globalAlpha !== undefined) this.globalAlpha = previous.globalAlpha;
      if (previous?.textAlign !== undefined) this.textAlign = previous.textAlign;
      this.ops.push({ type: 'restore' });
    }
  };
  return ctx as unknown as MockContext;
}

function installMockDocument() {
  const canvases: Array<{ ctx: MockContext; width: number; height: number }> = [];
  vi.stubGlobal('document', {
    fonts: {
      load: vi.fn(async () => undefined),
      ready: Promise.resolve()
    },
    createElement: vi.fn((tag: string) => {
      if (tag !== 'canvas') return { click: vi.fn() };
      const canvas = {
        width: 0,
        height: 0,
        ctx: createMockContext(),
        getContext(type: string) {
          return type === '2d' ? this.ctx : null;
        },
        toDataURL() {
          return 'data:image/png;base64,mock';
        },
        toBlob(callback: (blob: Blob | null) => void) {
          callback(new Blob());
        }
      };
      canvases.push(canvas);
      return canvas;
    })
  });
  return canvases;
}

function baseStyle(): ThumbnailTextStyle {
  return {
    fontId: 'blackHanSans',
    textColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowWidth: 2,
    strokeOn: true,
    position: 'bottom-center'
  };
}

function titleLayer(overrides: Partial<ThumbnailTextLayer> = {}): ThumbnailTextLayer {
  return normalizeThumbnailTextLayer({
    id: 'title',
    role: 'title',
    text: 'Hello',
    enabled: true,
    ...baseStyle(),
    ...overrides
  });
}

function dividerLayer(preset: ThumbnailDividerPreset): ThumbnailTextLayer {
  return normalizeThumbnailTextLayer({
    id: `divider-${preset}`,
    role: 'divider',
    text: preset === 'text' ? '***' : '',
    enabled: true,
    ...baseStyle(),
    position: 'center',
    dividerPreset: preset
  });
}

function mockSpec(): ThumbnailSpec {
  return {
    variants: [
      { id: 'A', headline: 'Main Title', subline: 'Sub', angle: 'A' },
      { id: 'B', headline: 'Other Title', subline: 'Sub', angle: 'B' },
      { id: 'C', headline: 'Third Title', subline: 'Sub', angle: 'C' }
    ],
    selected: 'A',
    colorScheme: { background: '#111111', accent: '#CCCCCC', text: '#FFFFFF' },
    objects: [],
    composition: '',
    forbidden: [],
    imagePrompt: '',
    imagePromptVariants: { generic: '', midjourney: '', qwenImage: '', stableDiffusion: '' },
    compositionGuide: {
      topSubcaption: 'Top Line',
      mainPhrase: 'Main Title',
      subtitle: 'Subtitle Line',
      bottomBrandLine: 'BRAND PLAYLIST',
      textColor: '#FFFFFF',
      shadowColor: 'rgba(0,0,0,0.45)',
      playerOverlay: false
    },
    typography: {
      font: 'serif',
      color: '#FFFFFF',
      outline: 'none',
      shadow: 'soft',
      divider: true,
      subtitle: true
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('[v3.46] thumbnail text layers', () => {
  it('keeps the legacy copyText/textStyle path identical when layers are not passed', async () => {
    const canvases = installMockDocument();
    await composeImage({ width: 1920, height: 1080, backgroundImage: null, copyText: 'Hello', textStyle: baseStyle(), showBadge: false });
    const legacyOps = canvases[0].ctx.ops;

    await composeImage({ width: 1920, height: 1080, backgroundImage: null, layers: [titleLayer()], textStyle: baseStyle(), copyText: 'Ignored', showBadge: false });
    const layerOps = canvases[1].ctx.ops;

    expect(layerOps).toEqual(legacyOps);
  });

  it('applies sizeRatio and offsetYRatio to the rendered text coordinates', () => {
    const ctx = createMockContext();
    drawTextBlock(ctx, 'Hello', 1000, 500, titleLayer({
      position: 'center',
      strokeOn: false,
      shadowWidth: 0,
      sizeRatio: 0.1,
      offsetYRatio: 0.2
    }));

    const fill = ctx.ops.find(op => op.type === 'fillText');
    expect(fill?.font).toContain('50px');
    expect(fill?.y).toBe(350);
  });

  it.each(['line', 'line-ornament', 'text'] as const)('draws the %s divider preset', preset => {
    const ctx = createMockContext();
    drawDivider(ctx, dividerLayer(preset), 1000, 500);
    if (preset === 'text') {
      expect(ctx.ops.some(op => op.type === 'fillText' && op.text === '***')).toBe(true);
    } else {
      expect(ctx.ops.some(op => op.type === 'stroke')).toBe(true);
      expect(ctx.ops.some(op => op.type === 'lineTo')).toBe(true);
      if (preset === 'line-ornament') expect(ctx.ops.some(op => op.type === 'arc' || op.type === 'fill')).toBe(true);
    }
  });

  it('injects spec composition fields and disables divider/subtitle for archetypes without divider typography', () => {
    const cityLayers = buildThumbnailTextLayersFromSpec(mockSpec(), 'city-roma');
    expect(cityLayers.find(layer => layer.role === 'topSubcaption')?.text).toBe('Top Line');
    expect(cityLayers.find(layer => layer.role === 'title')?.text).toBe('Main Title');
    expect(cityLayers.find(layer => layer.role === 'subtitle')?.text).toBe('Subtitle Line');
    expect(cityLayers.find(layer => layer.role === 'brandLine')?.text).toBe('BRAND PLAYLIST');
    expect(cityLayers.find(layer => layer.role === 'divider')?.enabled).toBe(true);

    const kidsLayers = buildThumbnailTextLayersFromSpec(mockSpec(), 'kids-animal-meadow');
    expect(kidsLayers.find(layer => layer.role === 'divider')?.enabled).toBe(false);
    expect(kidsLayers.find(layer => layer.role === 'subtitle')?.enabled).toBe(false);
  });

  it('preserves layers through brand template normalization and accepts legacy templates without layers', () => {
    const layer = titleLayer({ text: 'Saved title', offsetYRatio: 0.12 });
    const saved: ThumbnailBrandTemplate = {
      channelName: 'Test Channel',
      fontId: 'blackHanSans',
      textColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowWidth: 2,
      strokeOn: true,
      position: 'bottom-center',
      badge: { icon: 'SW', tag: 'TEST', position: 'bottom-right' },
      layers: [layer],
      locked: true,
      updatedAt: '2026-07-26T00:00:00.000Z'
    };

    const normalized = normalizeBrandTemplate(saved)!;
    expect(normalized.layers?.[0].text).toBe('Saved title');
    expect(normalized.layers?.[0].offsetYRatio).toBe(0.12);

    const legacy = normalizeBrandTemplate({ ...saved, layers: undefined })!;
    expect(legacy.layers).toBeUndefined();
    expect(legacy.fontId).toBe('blackHanSans');
  });
});
