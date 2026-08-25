import { describe, expect, it } from 'vitest';
import { resolveSceneSignatureSource } from '../src/core/situationLedger';

/**
 * 지시문 10 (TASK B-4-4) — "provider signature가 없거나 비면 순서대로
 * 추출한다: 1 listenerSituation, 2 lyricThemeText, 3 first verse." Locks in
 * that exact priority order and the legacy-missing fallback.
 */
describe('지시문 10 TASK B-4-4 — resolveSceneSignatureSource', () => {
  it('listenerSituation present -> source provider', () => {
    const result = resolveSceneSignatureSource({ listenerSituation: 'a quiet kitchen morning', lyricThemeText: 'unused', lyrics: '' });
    expect(result).toEqual({ situation: 'a quiet kitchen morning', source: 'provider' });
  });

  it('listenerSituation missing, lyricThemeText present -> source local-parser', () => {
    const result = resolveSceneSignatureSource({ listenerSituation: '', lyricThemeText: 'a fallback scene', lyrics: '[Verse]\nsome line here' });
    expect(result).toEqual({ situation: 'a fallback scene', source: 'local-parser' });
  });

  it('listenerSituation and lyricThemeText both missing, first verse line used -> source local-parser', () => {
    const result = resolveSceneSignatureSource({ listenerSituation: '', lyricThemeText: '', lyrics: '[Verse]\nthe cup is warm between my hands\n[Chorus]\nhook line' });
    expect(result).toEqual({ situation: 'the cup is warm between my hands', source: 'local-parser' });
  });

  it('nothing at all -> source legacy-missing', () => {
    const result = resolveSceneSignatureSource({ listenerSituation: '', lyricThemeText: '', lyrics: '' });
    expect(result).toEqual({ situation: '', source: 'legacy-missing' });
  });

  it('lyrics with only a chorus (no verse section) still falls through to legacy-missing', () => {
    const result = resolveSceneSignatureSource({ listenerSituation: '', lyricThemeText: '', lyrics: '[Chorus]\nhook line only' });
    expect(result.source).toBe('legacy-missing');
  });
});
