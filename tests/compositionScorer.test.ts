import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { scoreComposition } from '../src/core/compositionScorer';
import type { SongIdea } from '../src/types';

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  // Deliberately 28 comma-separated descriptors (within the 25-35 range) so
  // tests that aren't specifically about the descriptor-count check don't
  // spuriously trip it.
  const stylePrompt = overrides.stylePrompt ?? [
    'oldpop-british-beat', '12-string electric guitar', 'melodic walking bass', 'tambourine backbeat',
    'I-vi-IV-V progression', 'mature male tenor lead', 'clear forward diction', '100 BPM', 'bright studio mix',
    'clean group harmony', 'singalong hook', 'no instrumental intro', 'hook heard immediately', '3:10-3:35',
    'narrow warm mono mix', 'tape compression on the drums', 'natural room reverb', 'bright backing vocals',
    'gentle rocking sway', 'nostalgic feel', 'simple diatonic hook', 'clean group vocal blend',
    'straightforward song structure', 'warm midrange tone', 'unhurried tempo feel', 'steady rhythm section',
    'plain chorus lift', 'radio-friendly mix'
  ].join(', ');
  return {
    trackNo: 1,
    title: 'Song One',
    seasonMoment: 'x',
    listenerSituation: 'walking through a quiet garden in the morning',
    emotionArc: 'x',
    hookPhrase: 'Song One Hook',
    stylePrompt,
    lyrics: '[verse 1]\nline a\nline b\n\n[chorus]\nSong One Hook\nline c\nSong One Hook\nline d\nline e\nline f\nSong One Hook\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song One', description: 'desc', tags: [] },
    ...overrides
  };
}

/**
 * TASK v3.62 (TASK 2) — C안's whole premise: the app plans, the LLM
 * composes, and the existing 28-odd checks this session already built
 * (v3.58-v3.61) finally do their intended job by BLOCKING a bad composition
 * instead of only reporting it after the fact. Almost every check here is
 * pure reuse (see compositionScorer.ts's own module comment); only the
 * descriptor-count and era-anachronism checks are new.
 */
describe('[v3.62 TASK 2] scoreComposition — reused blocking checks', () => {
  it('blocks a song whose lyrics sing an arrangement/instrument as the grammatical subject (TASK v3.60 TASK A, reused)', () => {
    const song = songWith({ lyrics: '[verse 1]\nThe straight-pop drums move softly\n\n[chorus]\nSong One Hook\nline\nSong One Hook\nline\nline\nline\nSong One Hook\n\n[end]' });
    const [score] = scoreComposition([song]);
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('편곡/악기 어휘'))).toBe(true);
  });

  it('blocks a song with an artist-name leak in stylePrompt, lyrics, or youtube metadata (TASK v3.58 TASK 3, reused)', () => {
    const styleLeak = songWith({ stylePrompt: 'in the style of the Beatles, jangly guitars, 100 BPM' });
    expect(scoreComposition([styleLeak])[0].blocking.some(b => b.includes('아티스트/밴드명 누출'))).toBe(true);

    const youtubeLeak = songWith({ youtube: { title: 'Beatles-style song', description: 'desc', tags: [] } });
    expect(scoreComposition([youtubeLeak])[0].blocking.some(b => b.includes('youtube'))).toBe(true);
  });

  it('blocks the pair of songs whose style prompts are too similar (TASK v3.58 TASK 1 threshold, reused)', () => {
    const identical = 'oldpop-british-beat, 12-string electric guitar, melodic walking bass, tambourine backbeat, mature male tenor lead, 100 BPM, bright studio mix';
    const songs = [songWith({ trackNo: 1, stylePrompt: identical }), songWith({ trackNo: 2, stylePrompt: identical, hookPhrase: 'Other Hook' })];
    const scores = scoreComposition(songs);
    expect(scores.every(s => !s.passed)).toBe(true);
    expect(scores[0].blocking.some(b => b.includes('유사도'))).toBe(true);
  });

  it('does not block two songs with genuinely different style prompts', () => {
    const songs = [
      songWith({ trackNo: 1, stylePrompt: 'oldpop-british-beat, 12-string electric guitar, melodic walking bass, tambourine backbeat, mature male tenor lead, 100 BPM' }),
      songWith({ trackNo: 2, stylePrompt: 'folk-pop, fingerpicked acoustic guitar, soft piano, upright bass, plainspoken lead vocal, 92 BPM', hookPhrase: 'Other Hook' })
    ];
    const scores = scoreComposition(songs);
    expect(scores.every(s => !s.blocking.some(b => b.includes('유사도')))).toBe(true);
  });
});

/** TASK v3.62 (TASK 2-2, NEW) — Suno reads a descriptor list, not prose; a real pack measured 106 comma-separated descriptors in one stylePrompt because the old dictation approach had to fill every protected atom regardless of need. */
describe('[v3.62 TASK 2-2] scoreComposition — descriptor-count check (NEW)', () => {
  it('blocks a style prompt with fewer than 20 descriptors', () => {
    const song = songWith({ stylePrompt: 'warm pop, acoustic guitar, 92 BPM' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(true);
  });

  it('blocks a style prompt with more than 40 descriptors', () => {
    const manyDescriptors = Array.from({ length: 45 }, (_, i) => `descriptor ${i}`).join(', ');
    const song = songWith({ stylePrompt: manyDescriptors });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(true);
  });

  it('adds only an advisory (never blocks) for 20-24 or 36-40 descriptors', () => {
    const twentyTwo = Array.from({ length: 22 }, (_, i) => `descriptor ${i}`).join(', ');
    const score = scoreComposition([songWith({ stylePrompt: twentyTwo })])[0];
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(false);
    expect(score.advisory.some(a => a.includes('서술어'))).toBe(true);
  });

  it('adds no descriptor-count warning at all for 25-35 descriptors', () => {
    const thirty = Array.from({ length: 30 }, (_, i) => `descriptor ${i}`).join(', ');
    const score = scoreComposition([songWith({ stylePrompt: thirty })])[0];
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(false);
    expect(score.advisory.some(a => a.includes('서술어'))).toBe(false);
  });
});

/** TASK v3.62 (TASK 2-2, NEW) — era-anachronism check, reading from the same src/data/eraExclusions.ts table the bridge instruction's prevention bullet reads from. */
describe('[v3.62 TASK 2-2] scoreComposition — era-anachronism check (NEW)', () => {
  it('blocks a real 1962-flavored British-beat stylePrompt containing "string pad" (the real reported bug)', () => {
    const song = songWith({
      genreId: 'oldpop-british-beat',
      stylePrompt: 'early-1960s British beat pop, 12-string electric guitar, melodic walking bass, warm string pad swell intro texture (INTRO ONLY), 100 BPM'
    });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('1950s-60s') && b.includes('string pad'))).toBe(true);
  });

  it('does not block an era-appropriate 1962 British-beat stylePrompt with no anachronistic terms', () => {
    const song = songWith({
      genreId: 'oldpop-british-beat',
      stylePrompt: 'early-1960s British beat pop, 12-string electric guitar, melodic walking bass, tambourine backbeat, bright mono-leaning studio mix, 100 BPM'
    });
    const score = scoreComposition([song])[0];
    expect(score.blocking.some(b => b.includes('1950s-60s'))).toBe(false);
  });

  it('does not apply any era restriction to a genre with no era bucket (e.g. adult-contemporary)', () => {
    const song = songWith({ genreId: 'adult-contemporary', stylePrompt: 'warm adult contemporary pop, string pad, synth pad, gated reverb, 96 BPM' });
    const score = scoreComposition([song])[0];
    expect(score.blocking.some(b => b.includes('시대'))).toBe(false);
  });

  it('blocks a 1980s oldpop track using a too-early "mono-leaning mix"', () => {
    const song = songWith({ genreId: 'oldpop-adult-contemporary-80s', stylePrompt: '1980s warm adult contemporary pop, warm electric piano, sustained synth pad, mono-leaning mix, 92 BPM' });
    const score = scoreComposition([song])[0];
    expect(score.blocking.some(b => b.includes('1980s') && b.includes('mono-leaning mix'))).toBe(true);
  });
});

describe('[v3.62 TASK 2] scoreComposition — advisory (never-blocking) checks reused from earlier tasks', () => {
  it('adds an advisory for a hook/scene time-of-day mismatch (TASK v3.60 TASK E, reused)', () => {
    const song = songWith({ listenerSituation: 'sitting with morning coffee before the day begins', hookPhrase: 'Stay with Me Tonight' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(true);
    expect(score.advisory.some(a => a.includes('time-of-day'))).toBe(true);
  });

  it('adds an advisory for a title/hook zero-overlap (v3.58 TASK 5-6, reused)', () => {
    const song = songWith({ title: 'Tableglow', hookPhrase: 'Stay with Me Tonight' });
    const score = scoreComposition([song])[0];
    expect(score.advisory.some(a => a.includes('shares no word'))).toBe(true);
  });

  it('a fully clean song passes with no blocking and no advisory', () => {
    const song = songWith({ title: 'Guitar Morning', hookPhrase: 'Guitar Morning Song' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(true);
    expect(score.blocking).toEqual([]);
  });

  it('TASK v3.64 (TASK D) — blocks a hook that exactly duplicates a hook from this channel\'s history', () => {
    const song = songWith({ hookPhrase: 'I Won\'t Forget' });
    const score = scoreComposition([song], { historicalHooks: ['I Won\'t Forget', 'Some Other Hook'] })[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('이전 세트에서 이미 사용됐습니다'))).toBe(true);
  });

  it('TASK v3.64 (TASK D) — blocks a near-duplicate hook (the spec\'s own real example: "I Won\'t Forget" vs "I Can\'t Forget")', () => {
    const song = songWith({ hookPhrase: "I Won't Forget" });
    const score = scoreComposition([song], { historicalHooks: ["I Can't Forget"] })[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('사실상 같은 훅'))).toBe(true);
  });

  it('TASK v3.64 (TASK D) — does not block a genuinely new hook against real channel history', () => {
    const song = songWith({ hookPhrase: 'Wait by the Window' });
    const score = scoreComposition([song], { historicalHooks: ['Catch the Morning Train', 'Hold the Photo Close'] })[0];
    expect(score.passed).toBe(true);
  });

  it('TASK v3.64 (TASK D) — omitting historicalHooks entirely is a safe no-op (does not block anything)', () => {
    const song = songWith({ hookPhrase: 'I Won\'t Forget' });
    const score = scoreComposition([song])[0];
    expect(score.passed).toBe(true);
  });

  it('TASK v3.64 (TASK A-4) — adds a pack-wide advisory (never blocking) when a word repeats past its cap across the pack', () => {
    const repeatedLyrics = Array.from({ length: 13 }, () => 'window').join('\n');
    const song1 = songWith({ trackNo: 1, lyrics: repeatedLyrics });
    const song2 = songWith({ trackNo: 2, stylePrompt: song1.stylePrompt.replace('oldpop-british-beat', 'oldpop-british-beat, distinctly different second track') });
    const scores = scoreComposition([song1, song2]);
    expect(scores.every(s => s.passed)).toBe(true);
    expect(scores[0].advisory.some(a => a.includes('window'))).toBe(true);
    expect(scores[1].advisory.some(a => a.includes('window'))).toBe(true);
  });

  it('TASK v3.64 (TASK E) — adds a pack-wide advisory (never blocking) when title shapes are too monotonous', () => {
    const song1 = songWith({ trackNo: 1, title: 'Firstlight Cup' });
    const song2 = songWith({
      trackNo: 2,
      title: 'Folded Frost',
      stylePrompt: song1.stylePrompt.replace('oldpop-british-beat', 'oldpop-british-beat, distinctly different second track')
    });
    const scores = scoreComposition([song1, song2]);
    expect(scores.every(s => s.passed)).toBe(true);
    expect(scores[0].advisory.some(a => a.includes('제목 형태가'))).toBe(true);
    expect(scores[1].advisory.some(a => a.includes('제목 형태가'))).toBe(true);
  });

  it('TASK v3.64 (TASK E) — no title-shape advisory once titles span 3+ shapes', () => {
    const song1 = songWith({ trackNo: 1, title: 'Ember' });
    const song2 = songWith({
      trackNo: 2,
      title: 'Wait by the Window',
      stylePrompt: song1.stylePrompt.replace('oldpop-british-beat', 'oldpop-british-beat, distinctly different second track')
    });
    const song3 = songWith({
      trackNo: 3,
      title: 'Steam Radio',
      stylePrompt: song1.stylePrompt.replace('oldpop-british-beat', 'oldpop-british-beat, distinctly different third track')
    });
    const scores = scoreComposition([song1, song2, song3]);
    expect(scores.every(s => !s.advisory.some(a => a.includes('제목 형태가')))).toBe(true);
  });
});

/**
 * TASK v3.63 — root songs-output.json is now a real, git-tracked file that
 * changes every time the user commits a new real generation (see commit
 * 9267e7e, "Add Autumn to Christmas playlist output" — a NEW 18-song pack
 * that replaced the 16-song pre-v3.62 dictation-style pack these tests
 * originally documented, including the specific track-1 "string pad"
 * anachronism bug that pack demonstrated). Reading the live file made these
 * tests break every time the user generates something new, for a reason
 * that has nothing to do with a regression — the fix (v3.62 TASK 1) is
 * exactly why new real packs no longer reproduce the old bug. Frozen here
 * as tests/fixtures/realBridgePack.json so the assertions stay meaningful
 * without chasing the user's live output forever; re-freeze deliberately
 * (not as a side effect of a failing test) if a newer real pack is worth
 * testing against instead.
 */
const realPackPath = path.resolve(__dirname, 'fixtures', 'realBridgePack.json');
const describeRealPack = existsSync(realPackPath) ? describe : describe.skip;

describeRealPack('[v3.62 TASK 2] scoreComposition against a frozen real bridge-path pack', () => {
  const data = existsSync(realPackPath) ? JSON.parse(readFileSync(realPackPath, 'utf-8')) : { songs: [] };

  it('flags a real cross-track style-similarity violation (tracks 2 and 9, both oldpop-british-beat)', () => {
    const scores = scoreComposition(data.songs);
    const track2 = scores.find(s => s.trackNo === 2)!;
    expect(track2.blocking.some(b => b.includes('9') && b.includes('유사도'))).toBe(true);
  });

  it('flags a real artist-reference false positive: "bread" as an ordinary word matches the band Bread\'s alias pattern', () => {
    // A genuine, disclosed limitation (see v3.62's completion report) — the reused
    // v3.58 findArtistReferenceLeaks matches on `\bbread\b` regardless of context,
    // so an ordinary lyric using the word "bread" (not a real leak) still blocks.
    const scores = scoreComposition(data.songs);
    const flaggedForBread = scores.filter(s => s.blocking.some(b => /bread/i.test(b)));
    expect(flaggedForBread.length).toBeGreaterThan(0);
    for (const score of flaggedForBread) {
      const song = data.songs.find((s: SongIdea) => s.trackNo === score.trackNo)!;
      expect(song.lyrics.toLowerCase()).toContain('bread');
    }
  });

  it('most songs in this real, post-v3.62 pack pass cleanly (unlike the pre-fix pack, where every song failed)', () => {
    const scores = scoreComposition(data.songs);
    const passedCount = scores.filter(s => s.passed).length;
    expect(passedCount).toBeGreaterThan(scores.length / 2);
  });
});
