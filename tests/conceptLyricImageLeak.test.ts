import { describe, expect, it } from 'vitest';
import { resolveConceptInfluence } from '../src/core/conceptDiversity';
import { findArtistReferenceLeaks } from '../src/core/artistReferenceDecomposer';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { auditAlbum } from '../src/core/albumAudit';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.58 — real end-to-end run of the exact "비틀즈 스타일로, 아침에
 * 커피와 함께 듣고 싶은 올드팝" scenario surfaced a severe, previously
 * undetected bug: conceptDiversity.ts's fallbackConcept() used the user's
 * raw customConcept free text (an instruction to this app, not vetted
 * lyric content) directly as a lyricImage. A real generated pack sang the
 * literal Korean sentence — "비틀즈" (the artist name itself) included — as
 * an actual chorus/verse line, entirely outside the style prompt TASK 3's
 * artistReferenceStyleAtoms guard covers. Also fixed the same commit: a
 * bare-noun fallback phrase ("a small meaningful detail") that already
 * carried its own article produced a visible "an a small meaningful
 * detail" double-article bug once lyricEngine.ts's aMotif() added its own.
 */
describe('[v3.58] raw customConcept text never becomes a sung lyric image when it carries an artist reference', () => {
  it('resolveConceptInfluence never returns the raw artist-carrying sentence as a lyricImage', () => {
    const influence = resolveConceptInfluence('비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝');
    expect(influence).not.toBeNull();
    for (const image of influence!.lyricImages) {
      expect(findArtistReferenceLeaks(image)).toEqual([]);
      expect(image).not.toContain('비틀즈');
    }
  });

  it('an English "in the style of X" concept also never becomes a raw lyricImage', () => {
    const influence = resolveConceptInfluence('give me something in the style of the Beatles for a rainy afternoon');
    expect(influence).not.toBeNull();
    for (const image of influence!.lyricImages) {
      expect(image.toLowerCase()).not.toContain('beatles');
      expect(image.toLowerCase()).not.toContain('style of');
    }
  });

  it('a benign, name-free customConcept still gets its own text as a lyricImage (no over-broad stripping)', () => {
    const influence = resolveConceptInfluence('a quiet train ride home after the rain');
    expect(influence).not.toBeNull();
    expect(influence!.lyricImages[0]).toContain('quiet train ride home');
  });

  it('none of the fallback bare-noun images carry their own leading article (avoids aMotif() double-articling)', () => {
    // Deliberately avoids any of the 11 hardcoded CONCEPT_PRESETS aliases
    // (morning cafe, city lights, etc.) so this isolates fallbackConcept's
    // own bare-noun fix rather than the preset table (covered separately
    // below).
    const influence = resolveConceptInfluence('비틀즈 스타일로 부르는 노래');
    for (const image of influence!.lyricImages) {
      expect(image.toLowerCase()).not.toMatch(/^(a|an|the)\s/);
    }
  });

  it('every hardcoded CONCEPT_PRESETS lyricImage is also a bare noun (same aMotif()/likeMotif() double-article bug, found across ~half the table)', () => {
    for (const alias of ['아침 카페', '비 오는 밤', '도시의 불빛', '청춘과 꿈', '추억의 라디오', '계절의 변화', '오래된 우정', '바다의 추억', '정원 산책', '긴 드라이브', '크리스마스 카페', '첫눈']) {
      const influence = resolveConceptInfluence(alias);
      expect(influence, alias).not.toBeNull();
      for (const image of influence!.lyricImages) {
        expect(image.toLowerCase(), `${alias} -> "${image}"`).not.toMatch(/^(a|an|the)\s/);
      }
    }
  });

  it('a real 18-song local pack built from this exact concept has zero lyric artist-name leaks and passes the album audit', () => {
    const opts = makeOptions({ songCount: 18, customConcept: '비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(findArtistReferenceLeaks(song.lyrics), song.lyrics).toEqual([]);
      expect(song.lyrics).not.toContain('비틀즈');
    }
    const audit = auditAlbum(bp.songs, opts);
    expect(audit.errors, JSON.stringify(audit.errors)).toEqual([]);
  });
});

describe('[v3.58 TASK 6] auditAlbum also scans lyrics for artist-name leaks, not just the style prompt', () => {
  it('fails when a song\'s lyrics (not its style prompt) contain a leaked artist name', () => {
    const song = {
      trackNo: 1,
      title: 'Test',
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      hookPhrase: 'Test',
      stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo, 92 BPM',
      lyrics: '[verse 1]\nlike a 비틀즈 stayed with me\n\n[chorus]\nTest\nTest\nTest\n\n[end]',
      warnings: [],
      qualityScore: 90,
      youtube: { title: 'Test', description: 'desc', tags: [] }
    };
    const report = auditAlbum([song]);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('lyrics contain an artist-name leak'))).toBe(true);
  });
});
