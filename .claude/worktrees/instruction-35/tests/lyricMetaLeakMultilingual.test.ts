import { describe, expect, it } from 'vitest';
import { findLyricMetaLeaks, lyricMetaLeakWarning } from '../src/core/lyricMetaLeak';
import { reconcileWithPreassignedSlot, preallocateSongSlots } from '../src/core/batchPreallocation';
import { genrePacks, makeOptions } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 03 (TASK G) — real, reusable precedent this extends:
 * core/lyricVocabularyGuard.ts's subject-verb-adjacency architecture (see
 * src/core/lyricMetaLeak.ts's own doc comment). Covers this task's own
 * literal examples across all 3 languages, and the narrative-vs-meta
 * disambiguation the spec explicitly requires.
 */
describe('[codex 지시문 03 TASK G] findLyricMetaLeaks — English', () => {
  it('flags "the hook comes home" (noun-as-subject + verb)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\nThe hook comes home again tonight' }], 'english');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "the melody rises" (noun-as-subject + verb)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\nThe melody rises higher than before' }], 'english');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "the arrangement opens" (noun-as-subject + verb)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[intro]\nThe arrangement opens wide tonight' }], 'english');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags a directive phrase: "hold that note"', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[bridge]\nHold that note and let it breathe' }], 'english');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags a directive phrase: "sing higher"', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\nSing higher now, don\'t hold back' }], 'english');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags a literal key change / modulation / BPM mention', () => {
    expect(findLyricMetaLeaks([{ trackNo: 1, lyrics: 'Key change on the final chorus tonight' }], 'english').length).toBeGreaterThan(0);
    expect(findLyricMetaLeaks([{ trackNo: 1, lyrics: 'A little modulation before the end' }], 'english').length).toBeGreaterThan(0);
    expect(findLyricMetaLeaks([{ trackNo: 1, lyrics: 'We move at 92 BPM tonight' }], 'english').length).toBeGreaterThan(0);
  });

  it('does NOT flag "a note in your letter" (narrative context, not a meta-instruction)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\nI found a note in your letter today' }], 'english');
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag "our song on the radio" (narrative context)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\nOur song on the radio, driving through the night' }], 'english');
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag "hook" or "melody" used as an object, not a subject', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\nI still remember the melody you hummed' }], 'english');
    expect(findings).toHaveLength(0);
  });

  it('never flags a section tag or a self-declared "no lyrics" instrumental cue', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\n(instrumental hook, band plays the melody, no lyrics, 2 bars)' }], 'english');
    expect(findings).toHaveLength(0);
  });
});

describe('[codex 지시문 03 TASK G] findLyricMetaLeaks — Korean', () => {
  it('flags "후렴이 올라가" (the chorus rises — this task\'s own literal example)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\n후렴이 올라가면서 마음도 벅차올라' }], 'korean');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "키를 올려" (raise the key)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[bridge]\n이제 키를 올려서 다시 한번' }], 'korean');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "멜로디를" with an adjacent directive verb', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\n멜로디를 올려 다시 시작해봐' }], 'korean');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "음정을" with an adjacent directive verb', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\n음정을 맞춰서 함께 불러요' }], 'korean');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag "멜로디를 기억해" (I remember the melody — narrative, no directive verb adjacent)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\n그대 목소리의 멜로디를 기억해' }], 'korean');
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag ordinary Korean lyrics with none of the target vocabulary', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\n오늘도 좋은 하루였어요 사랑해요 내 마음을' }], 'korean');
    expect(findings).toHaveLength(0);
  });
});

describe('[codex 지시문 03 TASK G] findLyricMetaLeaks — Japanese', () => {
  it('flags "サビを上げて" (raise the chorus — this task\'s own literal example)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[chorus]\nさあサビを上げていこう' }], 'japanese');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "キーを上げて" (raise the key)', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[bridge]\n今キーを上げてもう一度' }], 'japanese');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('flags "メロディーが" with an adjacent directive verb', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\nメロディーが上がっていく' }], 'japanese');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag ordinary Japanese lyrics with none of the target vocabulary', () => {
    const findings = findLyricMetaLeaks([{ trackNo: 1, lyrics: '[verse 1]\nこんにちは 今日もいい天気ですね' }], 'japanese');
    expect(findings).toHaveLength(0);
  });
});

describe('[codex 지시문 03 TASK G] lyricMetaLeakWarning — single-track convenience wrapper', () => {
  it('returns a warning string naming the track and the leaked line', () => {
    const warning = lyricMetaLeakWarning('[chorus]\nThe hook comes home again', 3, 'english');
    expect(warning).toBeDefined();
    expect(warning).toContain('Track 3');
    expect(warning).toContain('The hook comes home again');
  });

  it('returns undefined for clean lyrics', () => {
    expect(lyricMetaLeakWarning('[verse 1]\nAn ordinary line about summer', 1, 'english')).toBeUndefined();
  });
});

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'Song 1', seasonMoment: 'x', listenerSituation: 'x', emotionArc: 'x', hookPhrase: 'Hook',
    stylePrompt: 'warm acoustic pop, mid tempo, 92 BPM', lyrics: '[verse 1]\nline a\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [], qualityScore: 90, youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 03 TASK G] reconcileWithPreassignedSlot wiring — real integration, not just the unit-level detector', () => {
  it('surfaces a metaLeak warning for a real generation-path song whose lyrics leak a composition instruction', () => {
    const opts = makeOptions({ songCount: 3, lyricLanguage: 'english' });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const song = songWith({ trackNo: slots[0].trackNo, lyrics: '[chorus]\nThe hook comes home again tonight\nHook 1\nHook 1' });
    const fixed = reconcileWithPreassignedSlot(song, slots[0], 'ai-creative', { lyricLanguage: 'english' });
    expect(fixed.warnings.some(w => w.includes('composition/performance instruction'))).toBe(true);
  });

  it('stays clean for real, ordinary lyrics with no meta-leak', () => {
    const opts = makeOptions({ songCount: 3, lyricLanguage: 'english' });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const song = songWith({ trackNo: slots[0].trackNo });
    const fixed = reconcileWithPreassignedSlot(song, slots[0], 'ai-creative', { lyricLanguage: 'english' });
    expect(fixed.warnings.some(w => w.includes('composition/performance instruction'))).toBe(false);
  });
});
