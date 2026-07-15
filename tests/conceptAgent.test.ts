import { describe, expect, it, vi } from 'vitest';
import {
  buildConceptWhitelist,
  recommendConceptLocal,
  recommendConceptViaApi,
  recommendThumbnailCopyLocal,
  validateRecommendation,
  type ConceptRecommendation
} from '../src/core/conceptAgent';
import { getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';
import type { ProviderSettings } from '../src/types';

describe('concept agent (local, no API)', () => {
  it('matches winter-related input to a winter season', () => {
    const result = recommendConceptLocal('그 겨울이 생각나는 노래', 'senior-morning');
    expect(['early-winter', 'first-snow', 'late-winter']).toContain(result.recommendations[0].seasonId);
  });

  it('matches cafe-related input to a cafe genre', () => {
    const result = recommendConceptLocal('카페에서 듣던 노래', 'senior-morning');
    expect(['lofi-cafe', 'bossa-cafe']).toContain(result.recommendations[0].genreId);
  });

  it('matches longing/nostalgia input to the nostalgic mood', () => {
    const result = recommendConceptLocal('그 노래 어디선가 들어본 적 있다', 'senior-morning');
    expect(result.recommendations[0].moodIds).toContain('nostalgic');
  });

  it('always returns a default recommendation even when nothing matches', () => {
    const result = recommendConceptLocal('asdkfjaslkdfj', 'senior-morning');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].genreId).toBeTruthy();
  });

  it('only ever recommends genres inside the archetype\'s core tier', () => {
    const coreIds = new Set(getCoreGenreIdsForArchetype('senior-morning'));
    const phrases = ['그 겨울이 생각나는 노래', '카페에서 듣던 노래', '힘들 때 위로가 되는', '쓸쓸한 가을 저녁', '설레는 봄날'];
    for (const phrase of phrases) {
      const result = recommendConceptLocal(phrase, 'senior-morning');
      for (const rec of result.recommendations) {
        expect(coreIds.has(rec.genreId), `${rec.genreId} for "${phrase}"`).toBe(true);
      }
    }
  });

  it('returns 1-2 recommendations, never 0 or 3+', () => {
    const phrases = ['그 겨울이 생각나는 노래', '아무말이나 입력했을 때', '카페에서 듣던 노래'];
    for (const phrase of phrases) {
      const result = recommendConceptLocal(phrase, 'senior-morning');
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(result.recommendations.length).toBeLessThanOrEqual(2);
    }
  });

  it('every recommendation has a non-empty Korean reason', () => {
    const result = recommendConceptLocal('힘들 때 위로가 되는', 'senior-morning');
    for (const rec of result.recommendations) {
      expect(rec.reasonKo.length).toBeGreaterThan(0);
    }
  });

  it('matches English and Japanese synonyms the same way as Korean', () => {
    const ko = recommendConceptLocal('카페에서 듣던 노래', 'senior-morning');
    const en = recommendConceptLocal('a song I heard at a cafe', 'senior-morning');
    const ja = recommendConceptLocal('カフェで聴いた歌', 'senior-morning');
    expect(['lofi-cafe', 'bossa-cafe']).toContain(ko.recommendations[0].genreId);
    expect(['lofi-cafe', 'bossa-cafe']).toContain(en.recommendations[0].genreId);
    expect(['lofi-cafe', 'bossa-cafe']).toContain(ja.recommendations[0].genreId);
  });

  it('never recommends the same genre twice within one result', () => {
    const result = recommendConceptLocal('그 노래 어디선가 들어본 적 있다', 'senior-morning');
    const ids = result.recommendations.map(rec => rec.genreId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('concept agent whitelist validation', () => {
  it('rejects a hallucinated genre id not in the core tier', () => {
    const whitelist = buildConceptWhitelist('senior-morning');
    const bad: ConceptRecommendation = {
      id: 'x',
      genreId: 'bebop-nonexistent',
      moodIds: ['nostalgic'],
      seasonId: 'early-autumn',
      vocalPresetId: 'warm-mature-male',
      reasonKo: 'test',
      previewLine: 'Test',
      confidence: 'high'
    };
    expect(validateRecommendation(bad, whitelist)).toBe(false);
  });

  it('accepts a recommendation fully inside the whitelist', () => {
    const whitelist = buildConceptWhitelist('senior-morning');
    const good: ConceptRecommendation = {
      id: 'x',
      genreId: whitelist.genreIds[0],
      moodIds: [whitelist.moodIds[0]],
      seasonId: whitelist.seasonIds[0],
      vocalPresetId: whitelist.vocalPresetIds[0],
      reasonKo: 'test',
      previewLine: 'Test',
      confidence: 'high'
    };
    expect(validateRecommendation(good, whitelist)).toBe(true);
  });

  it('falls back to the local matcher when the API response has a hallucinated id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      blueprint: {
        recommendations: [{ genreId: 'totally-made-up-genre', moodIds: ['nostalgic'], seasonId: 'early-autumn', reasonKo: 'x', previewLine: 'x', confidence: 'high' }]
      }
    }), { status: 200 })));

    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const result = await recommendConceptViaApi('그 겨울이 생각나는 노래', 'senior-morning', settings);
    expect(result.method).toBe('local');
    const coreIds = new Set(getCoreGenreIdsForArchetype('senior-morning'));
    expect(coreIds.has(result.recommendations[0].genreId)).toBe(true);
    vi.unstubAllGlobals();
  });

  it('does not call the API again for the same channel + input (cache hit)', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount += 1;
      return new Response(JSON.stringify({
        blueprint: {
          recommendations: [{ genreId: 'adult-contemporary', moodIds: ['nostalgic'], seasonId: 'early-autumn', reasonKo: 'x', previewLine: 'x', confidence: 'high' }]
        }
      }), { status: 200 });
    }));

    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    await recommendConceptViaApi('caching test phrase unique 12345', 'senior-morning', settings);
    await recommendConceptViaApi('caching test phrase unique 12345', 'senior-morning', settings);
    expect(callCount).toBe(1);
    vi.unstubAllGlobals();
  });
});

describe('thumbnail copy recommendation (local)', () => {
  it('returns 3 variants for a matched theme', () => {
    const variants = recommendThumbnailCopyLocal('그 노래 어디선가 들어본 적 있다', 'korean');
    expect(variants).toHaveLength(3);
    for (const variant of variants) expect(variant.headline.length).toBeGreaterThan(0);
  });

  it('always returns something even for an unmatched phrase', () => {
    const variants = recommendThumbnailCopyLocal('zzz random text', 'korean');
    expect(variants.length).toBeGreaterThan(0);
  });

  it('supports korean, english, and japanese packaging language', () => {
    const ko = recommendThumbnailCopyLocal('카페에서 듣던 노래', 'korean');
    const en = recommendThumbnailCopyLocal('카페에서 듣던 노래', 'english');
    const ja = recommendThumbnailCopyLocal('카페에서 듣던 노래', 'japanese');
    expect(ko[0].headline).not.toBe(en[0].headline);
    expect(en[0].headline).not.toBe(ja[0].headline);
  });
});
