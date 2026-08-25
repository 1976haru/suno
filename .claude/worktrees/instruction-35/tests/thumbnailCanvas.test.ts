import { describe, expect, it } from 'vitest';
import {
  BASE_STYLE_PRESETS, FONT_OPTIONS, SHADOW_COLORS, TEXT_COLORS, TEXT_POSITIONS,
  anchorPoint, fontFamilyById, wrapAlign
} from '../src/core/thumbnailCanvas';

/**
 * TASK v3.37 — this repo deliberately has no jsdom/canvas polyfill (see
 * providerSettingsPersistence.ts's comment), so only the DOM-free pure
 * functions and data pools from thumbnailCanvas.ts are tested here.
 * composeImage/drawTextBlock/drawBrandBadge/etc. only run in a real browser.
 */

describe('[v3.37] thumbnailCanvas — font/color/preset pools', () => {
  it('every font option id is unique and resolvable via fontFamilyById', () => {
    const ids = FONT_OPTIONS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const font of FONT_OPTIONS) {
      expect(fontFamilyById(font.id)).toEqual(font);
    }
  });

  it('has exactly 6 fonts, matching the ported creator-studio font bank', () => {
    expect(FONT_OPTIONS).toHaveLength(6);
    expect(FONT_OPTIONS.map(f => f.family)).toEqual([
      'Black Han Sans', 'Do Hyeon', 'Jua', 'Gowun Dodum', 'Yeon Sung', 'Nanum Pen Script'
    ]);
  });

  it('text and shadow color pools are valid uppercase hex codes', () => {
    for (const color of [...TEXT_COLORS, ...SHADOW_COLORS]) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('every base style preset references a real font id and a color from the pools', () => {
    for (const preset of BASE_STYLE_PRESETS) {
      expect(FONT_OPTIONS.some(f => f.id === preset.fontId)).toBe(true);
      expect(TEXT_COLORS).toContain(preset.textColor);
      expect(SHADOW_COLORS).toContain(preset.shadowColor);
      expect(preset.shadowWidth).toBeGreaterThanOrEqual(1);
      expect(preset.shadowWidth).toBeLessThanOrEqual(4);
    }
  });

  it('text position ids are all unique', () => {
    const ids = TEXT_POSITIONS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('[v3.37] thumbnailCanvas — pure geometry (wrapAlign / anchorPoint)', () => {
  it('wrapAlign maps left/right/center positions correctly', () => {
    expect(wrapAlign('top-left')).toBe('left');
    expect(wrapAlign('bottom-left')).toBe('left');
    expect(wrapAlign('top-right')).toBe('right');
    expect(wrapAlign('bottom-right')).toBe('right');
    expect(wrapAlign('top-center')).toBe('center');
    expect(wrapAlign('center')).toBe('center');
    expect(wrapAlign('bottom-center')).toBe('center');
  });

  it('anchorPoint places top positions at the padding offset from the top edge', () => {
    const anchor = anchorPoint('top-center', 1920, 1080, 50);
    expect(anchor.y).toBe(50);
    expect(anchor.x).toBe(960);
    expect(anchor.align).toBe('center');
  });

  it('anchorPoint places bottom positions at the padding offset from the bottom edge', () => {
    const anchor = anchorPoint('bottom-right', 1920, 1080, 50);
    expect(anchor.y).toBe(1030);
    expect(anchor.x).toBe(1870);
    expect(anchor.align).toBe('right');
  });

  it('anchorPoint centers vertically and horizontally for "center"', () => {
    const anchor = anchorPoint('center', 3000, 3000, 100);
    expect(anchor.x).toBe(1500);
    expect(anchor.y).toBe(1500);
    expect(anchor.align).toBe('center');
  });

  it('anchorPoint pins left-aligned x to the padding regardless of canvas width', () => {
    const anchor = anchorPoint('bottom-left', 3000, 3000, 40);
    expect(anchor.x).toBe(40);
    expect(anchor.align).toBe('left');
  });
});
