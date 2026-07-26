import { describe, expect, it } from 'vitest';
import { analyzeThumbnailCaptions, contrastRatio } from '../src/core/thumbnailCaptionQuality';
import { koreanThumbnailPromptIssues, translateKoreanThumbnailDescription } from '../src/core/thumbnailKoreanPrompt';
import { composeThumbnailPromptSet } from '../src/core/thumbnailPromptComposer';
import { thumbnailArtistReferenceIssues } from '../src/core/thumbnailSafety';
import { normalizeThumbnailTextLayer } from '../src/core/thumbnailTextLayers';
import type { ThumbnailTextLayer } from '../src/types';

function layer(overrides: Partial<ThumbnailTextLayer> = {}): ThumbnailTextLayer {
  return normalizeThumbnailTextLayer({
    id: 'title', role: 'title', text: '한글 자막 테스트', enabled: true,
    fontId: 'blackHanSans', textColor: '#FFFFFF', shadowColor: '#000000', shadowWidth: 2,
    strokeOn: true, position: 'center', ...overrides
  });
}

function mockContext() {
  return {
    font: '',
    measureText: (text: string) => ({ width: text.length * 20 })
  } as unknown as CanvasRenderingContext2D;
}

describe('[v3.49b] unified thumbnail input and caption quality', () => {
  it('translates Korean scene descriptions into editable English clauses with textless safety', () => {
    const prompt = translateKoreanThumbnailDescription('비 오는 도쿄 밤거리, 네온 반사, 우산 든 뒷모습');
    expect(prompt).toContain('rainy atmosphere');
    expect(prompt).toContain('textless background only');
    expect(prompt).toContain('face never shown');
  });

  it('blocks artist and real-person references before image generation', () => {
    expect(koreanThumbnailPromptIssues('아이유처럼 노래하는 인물')).not.toHaveLength(0);
    expect(thumbnailArtistReferenceIssues('a scene in the style of Taylor Swift')).not.toHaveLength(0);
    expect(translateKoreanThumbnailDescription('아이유 스타일의 도쿄 밤')).toBe('');
    const prompt = composeThumbnailPromptSet({ archetypeId: 'autumn-window-golden', concept: 'in the style of Taylor Swift' });
    expect(prompt.variants[0].prompt).not.toContain('Taylor Swift');
  });

  it('reports clipping, low contrast, and mobile minimum-size captions', () => {
    const report = analyzeThumbnailCaptions(mockContext(), [layer({ sizeRatio: 0.02, textColor: '#777777' })], 100, 100, '#888888');
    expect(report.issues.map(issue => issue.kind)).toEqual(expect.arrayContaining(['clipping', 'contrast', 'minimum-size']));
    expect(contrastRatio('#000000', '#FFFFFF')).toBeGreaterThan(20);
  });
});
