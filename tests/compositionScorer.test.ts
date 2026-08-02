import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { scoreComposition } from '../src/core/compositionScorer';
import type { SongIdea } from '../src/types';

// v3.75 (TASK A) — compositionScorer now blocks lyrics under
// LYRIC_WORD_COUNT_BLOCKING_FLOOR (130 words) and warns under 190; this
// filler block pads the default fixture lyrics comfortably past both so
// tests unrelated to word count don't spuriously trip the new check.
function wordCountFillerLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `soft quiet morning light drifts gently through the old familiar window number ${i + 1}`).join('\n');
}

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
    lyrics: `[verse 1]\nline a\nline b\n\n[chorus]\nSong One Hook\nline c\nSong One Hook\nline d\nline e\nline f\nSong One Hook\n\n[verse 2]\n${wordCountFillerLines(15)}\n\n[end]`,
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
    const [score] = scoreComposition([song]).tracks;
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('편곡/악기 어휘'))).toBe(true);
  });

  it('blocks a song with an artist-name leak in stylePrompt, lyrics, or youtube metadata (TASK v3.58 TASK 3, reused)', () => {
    const styleLeak = songWith({ stylePrompt: 'in the style of the Beatles, jangly guitars, 100 BPM' });
    expect(scoreComposition([styleLeak]).tracks[0].blocking.some(b => b.includes('아티스트/밴드명 누출'))).toBe(true);

    const youtubeLeak = songWith({ youtube: { title: 'Beatles-style song', description: 'desc', tags: [] } });
    expect(scoreComposition([youtubeLeak]).tracks[0].blocking.some(b => b.includes('youtube'))).toBe(true);
  });

  it('blocks the pair of songs whose style prompts are too similar (TASK v3.58 TASK 1 threshold, reused)', () => {
    const identical = 'oldpop-british-beat, 12-string electric guitar, melodic walking bass, tambourine backbeat, mature male tenor lead, 100 BPM, bright studio mix';
    const songs = [songWith({ trackNo: 1, stylePrompt: identical }), songWith({ trackNo: 2, stylePrompt: identical, hookPhrase: 'Other Hook' })];
    const scores = scoreComposition(songs).tracks;
    expect(scores.every(s => !s.passed)).toBe(true);
    expect(scores[0].blocking.some(b => b.includes('유사도'))).toBe(true);
  });

  it('does not block two songs with genuinely different style prompts', () => {
    const songs = [
      songWith({ trackNo: 1, stylePrompt: 'oldpop-british-beat, 12-string electric guitar, melodic walking bass, tambourine backbeat, mature male tenor lead, 100 BPM' }),
      songWith({ trackNo: 2, stylePrompt: 'folk-pop, fingerpicked acoustic guitar, soft piano, upright bass, plainspoken lead vocal, 92 BPM', hookPhrase: 'Other Hook' })
    ];
    const scores = scoreComposition(songs).tracks;
    expect(scores.every(s => !s.blocking.some(b => b.includes('유사도')))).toBe(true);
  });
});

/** TASK v3.62 (TASK 2-2, NEW) — Suno reads a descriptor list, not prose; a real pack measured 106 comma-separated descriptors in one stylePrompt because the old dictation approach had to fill every protected atom regardless of need. */
describe('[v3.62 TASK 2-2] scoreComposition — descriptor-count check (NEW)', () => {
  it('blocks a style prompt with fewer than 20 descriptors', () => {
    const song = songWith({ stylePrompt: 'warm pop, acoustic guitar, 92 BPM' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(true);
  });

  it('blocks a style prompt with more than 40 descriptors', () => {
    const manyDescriptors = Array.from({ length: 45 }, (_, i) => `descriptor ${i}`).join(', ');
    const song = songWith({ stylePrompt: manyDescriptors });
    const score = scoreComposition([song]).tracks[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(true);
  });

  it('adds only an advisory (never blocks) for 20-24 or 36-40 descriptors', () => {
    const twentyTwo = Array.from({ length: 22 }, (_, i) => `descriptor ${i}`).join(', ');
    const score = scoreComposition([songWith({ stylePrompt: twentyTwo })]).tracks[0];
    expect(score.blocking.some(b => b.includes('서술어'))).toBe(false);
    expect(score.advisory.some(a => a.includes('서술어'))).toBe(true);
  });

  it('adds no descriptor-count warning at all for 25-35 descriptors', () => {
    const thirty = Array.from({ length: 30 }, (_, i) => `descriptor ${i}`).join(', ');
    const score = scoreComposition([songWith({ stylePrompt: thirty })]).tracks[0];
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
    const score = scoreComposition([song]).tracks[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('1950s-60s') && b.includes('string pad'))).toBe(true);
  });

  it('does not block an era-appropriate 1962 British-beat stylePrompt with no anachronistic terms', () => {
    const song = songWith({
      genreId: 'oldpop-british-beat',
      stylePrompt: 'early-1960s British beat pop, 12-string electric guitar, melodic walking bass, tambourine backbeat, bright mono-leaning studio mix, 100 BPM'
    });
    const score = scoreComposition([song]).tracks[0];
    expect(score.blocking.some(b => b.includes('1950s-60s'))).toBe(false);
  });

  it('does not apply any era restriction to a genre with no era bucket (e.g. adult-contemporary)', () => {
    const song = songWith({ genreId: 'adult-contemporary', stylePrompt: 'warm adult contemporary pop, string pad, synth pad, gated reverb, 96 BPM' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.blocking.some(b => b.includes('시대'))).toBe(false);
  });

  it('blocks a 1980s oldpop track using a too-early "mono-leaning mix"', () => {
    const song = songWith({ genreId: 'oldpop-adult-contemporary-80s', stylePrompt: '1980s warm adult contemporary pop, warm electric piano, sustained synth pad, mono-leaning mix, 92 BPM' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.blocking.some(b => b.includes('1980s') && b.includes('mono-leaning mix'))).toBe(true);
  });
});

describe('[v3.62 TASK 2] scoreComposition — advisory (never-blocking) checks reused from earlier tasks', () => {
  it('adds an advisory for a hook/scene time-of-day mismatch (TASK v3.60 TASK E, reused)', () => {
    const song = songWith({ listenerSituation: 'sitting with morning coffee before the day begins', hookPhrase: 'Stay with Me Tonight' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.passed).toBe(true);
    expect(score.advisory.some(a => a.includes('time-of-day'))).toBe(true);
  });

  it('adds an advisory for a title/hook zero-overlap (v3.58 TASK 5-6, reused)', () => {
    const song = songWith({ title: 'Tableglow', hookPhrase: 'Stay with Me Tonight' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.advisory.some(a => a.includes('shares no word'))).toBe(true);
  });

  it('a fully clean song passes with no blocking and no advisory', () => {
    const song = songWith({ title: 'Guitar Morning', hookPhrase: 'Guitar Morning Song' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.passed).toBe(true);
    expect(score.blocking).toEqual([]);
  });

  it('TASK v3.64 (TASK D) — blocks a hook that exactly duplicates a hook from this channel\'s history', () => {
    const song = songWith({ hookPhrase: 'I Won\'t Forget' });
    const score = scoreComposition([song], { historicalHooks: ['I Won\'t Forget', 'Some Other Hook'] }).tracks[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('이전 세트에서 이미 사용됐습니다'))).toBe(true);
  });

  it('TASK v3.64 (TASK D) — blocks a near-duplicate hook (the spec\'s own real example: "I Won\'t Forget" vs "I Can\'t Forget")', () => {
    const song = songWith({ hookPhrase: "I Won't Forget" });
    const score = scoreComposition([song], { historicalHooks: ["I Can't Forget"] }).tracks[0];
    expect(score.passed).toBe(false);
    expect(score.blocking.some(b => b.includes('사실상 같은 훅'))).toBe(true);
  });

  it('TASK v3.64 (TASK D) — does not block a genuinely new hook against real channel history', () => {
    const song = songWith({ hookPhrase: 'Wait by the Window' });
    const score = scoreComposition([song], { historicalHooks: ['Catch the Morning Train', 'Hold the Photo Close'] }).tracks[0];
    expect(score.passed).toBe(true);
  });

  it('TASK v3.64 (TASK D) — omitting historicalHooks entirely is a safe no-op (does not block anything)', () => {
    const song = songWith({ hookPhrase: 'I Won\'t Forget' });
    const score = scoreComposition([song]).tracks[0];
    expect(score.passed).toBe(true);
  });

  it('TASK v3.64 (TASK A-4) — adds a pack-level advisory (never blocking) when a word repeats past its cap across the pack (v4.1 TASK C: lives in packAdvisory, not copied into every track)', () => {
    // v3.75 (TASK A) — each line adds enough unique-per-line filler tokens
    // to clear the new lyric word-count blocking floor while keeping every
    // word OTHER than "window" unique (so nothing besides "window" crosses
    // its own repetition cap).
    const repeatedLyrics = Array.from({ length: 13 }, (_, i) =>
      `window unique filler token alpha${i} beta${i} gamma${i} delta${i} epsilon${i} zeta${i} eta${i} theta${i} iota${i} kappa${i} lambda${i} mu${i}`
    ).join('\n');
    const song1 = songWith({ trackNo: 1, lyrics: repeatedLyrics });
    const song2 = songWith({ trackNo: 2, stylePrompt: song1.stylePrompt.replace('oldpop-british-beat', 'oldpop-british-beat, distinctly different second track') });
    const result = scoreComposition([song1, song2]);
    expect(result.tracks.every(s => s.passed)).toBe(true);
    expect(result.packAdvisory.some(issue => issue.labelKo.includes('window'))).toBe(true);
  });

  it('TASK v3.64 (TASK E) — adds a pack-level advisory (never blocking) when title shapes are too monotonous (v4.1 TASK C: lives in packAdvisory, not copied into every track)', () => {
    const song1 = songWith({ trackNo: 1, title: 'Firstlight Cup' });
    const song2 = songWith({
      trackNo: 2,
      title: 'Folded Frost',
      stylePrompt: song1.stylePrompt.replace('oldpop-british-beat', 'oldpop-british-beat, distinctly different second track')
    });
    const result = scoreComposition([song1, song2]);
    expect(result.tracks.every(s => s.passed)).toBe(true);
    expect(result.packAdvisory.some(issue => issue.labelKo.includes('제목 형태가'))).toBe(true);
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
    const result = scoreComposition([song1, song2, song3]);
    expect(result.packAdvisory.some(issue => issue.labelKo.includes('제목 형태가'))).toBe(false);
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
    const scores = scoreComposition(data.songs).tracks;
    const track2 = scores.find(s => s.trackNo === 2)!;
    expect(track2.blocking.some(b => b.includes('9') && b.includes('유사도'))).toBe(true);
  });

  it('flags a real artist-reference false positive: "bread" as an ordinary word matches the band Bread\'s alias pattern', () => {
    // A genuine, disclosed limitation (see v3.62's completion report) — the reused
    // v3.58 findArtistReferenceLeaks matches on `\bbread\b` regardless of context,
    // so an ordinary lyric using the word "bread" (not a real leak) still blocks.
    const scores = scoreComposition(data.songs).tracks;
    const flaggedForBread = scores.filter(s => s.blocking.some(b => /bread/i.test(b)));
    expect(flaggedForBread.length).toBeGreaterThan(0);
    for (const score of flaggedForBread) {
      const song = data.songs.find((s: SongIdea) => s.trackNo === score.trackNo)!;
      expect(song.lyrics.toLowerCase()).toContain('bread');
    }
  });

  it('most non-duet songs in this real, post-v3.62 pack pass cleanly (unlike the pre-fix pack, where every song failed)', () => {
    // TASK v3.70 (TASK A) — this same frozen pack also has 5 real
    // duet-prompted tracks (stylePrompt says "duet") with zero per-section
    // [verse 1: male vocal]/[verse 2: female vocal] lyric tags — exactly the
    // real listening-feedback bug ("듣기엔 한 명이 부름") TASK A's new blocking
    // check exists to catch. That correctly lowers this pack's overall pass
    // rate below the original v3.62-era "most songs pass" bar; excluding
    // those 5 tracks (covered by their own test below) keeps this test's own
    // original intent — v3.62's fixes hold for everything else — meaningful.
    const scores = scoreComposition(data.songs).tracks;
    const nonDuetScores = scores.filter(s => {
      const song = data.songs.find((item: SongIdea) => item.trackNo === s.trackNo)!;
      return !/\bduet\b/i.test(song.stylePrompt);
    });
    const passedCount = nonDuetScores.filter(s => s.passed).length;
    expect(passedCount).toBeGreaterThan(nonDuetScores.length / 2);
  });

  it('TASK v3.70 (TASK A): correctly blocks this frozen pack\'s real duet tracks for missing per-section vocal-assignment tags', () => {
    const scores = scoreComposition(data.songs).tracks;
    const duetTrackNos = data.songs.filter((s: SongIdea) => /\bduet\b/i.test(s.stylePrompt)).map((s: SongIdea) => s.trackNo);
    expect(duetTrackNos.length).toBeGreaterThan(0);
    for (const trackNo of duetTrackNos) {
      const score = scores.find(s => s.trackNo === trackNo)!;
      expect(score.blocking.some(b => b.includes('듀엣'))).toBe(true);
    }
  });
});

/**
 * v3.77 (TASK A-5 / TASK B-4 / TASK D-2) — proves the new regression-
 * prevention blocking checks actually FIRE when the exact failure they exist
 * to catch is deliberately reproduced (this task's own §8 item 5, called out
 * as "이 문서의 핵심"): each test below builds a pack that reproduces one of
 * the two historical silent-collapse bugs (a single vocal descriptor/type
 * repeated across the whole pack, a BPM value repeated/narrow across the
 * whole pack) or the new vocabulary ceiling, and checks that scoreComposition
 * now blocks it — not just that a healthy pack passes.
 */
describe('[v3.77 TASK A-5/B-4/D-2] new blocking checks fire on the exact failures they exist to catch', () => {
  function packOf(count: number, overridesFor: (i: number) => Partial<SongIdea>): SongIdea[] {
    return Array.from({ length: count }, (_, i) => songWith({ trackNo: i + 1, ...overridesFor(i) }));
  }

  it('blocks when the whole pack collapses to one vocal descriptor (register) repeated on every track (v4.1 TASK C: design-scope packBlocking, not copied into every track)', () => {
    const songs = packOf(6, () => ({
      stylePrompt: songWith().stylePrompt.replace('mature male tenor lead', 'male deep chest-register lead')
    }));
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.scope === 'design' && issue.labelKo.includes('보컬 서술') && issue.labelKo.includes('종뿐'))).toBe(true);
  });

  it('blocks when one vocal descriptor appears in more than 3 songs (even if a couple of others vary)', () => {
    const registers = ['deep chest-register lead', 'deep chest-register lead', 'deep chest-register lead', 'deep chest-register lead', 'bright tenor lead', 'light high tenor'];
    const songs = packOf(6, i => ({
      stylePrompt: songWith().stylePrompt.replace('mature male tenor lead', `male ${registers[i]}`)
    }));
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.labelKo.includes('deep chest-register lead') && issue.labelKo.includes('4곡'))).toBe(true);
  });

  it('blocks when vocalType never varies across the whole pack (every track the same string)', () => {
    const songs = packOf(6, () => ({ vocalType: 'male' as const }));
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.labelKo.includes('보컬 타입') && issue.labelKo.includes('한 종류'))).toBe(true);
  });

  it('blocks when BPM barely varies across the pack (stddev collapse — tempoBandsForProfile silently returning one narrow band)', () => {
    const bpms = [95, 96, 95, 96, 95, 96];
    const songs = packOf(6, i => ({ bpm: bpms[i] }));
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.labelKo.includes('BPM 표준편차'))).toBe(true);
  });

  it('blocks when the BPM range is too narrow even if stddev alone might look acceptable', () => {
    const bpms = [90, 92, 94, 96, 98, 100];
    const songs = packOf(6, i => ({ bpm: bpms[i] }));
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.labelKo.includes('BPM 범위'))).toBe(true);
  });

  it('does NOT block a healthy pack with real BPM spread and vocal variety on either new check', () => {
    const bpms = [78, 84, 90, 96, 102, 108];
    const registers = ['deep chest-register lead', 'bright tenor lead', 'light high tenor', 'mid baritone-tenor lead', 'narrow crooner tone', 'low warm baritone'];
    const songs = packOf(6, i => ({
      bpm: bpms[i],
      stylePrompt: songWith().stylePrompt.replace('mature male tenor lead', `male ${registers[i]}`).replace('100 BPM', `${bpms[i]} BPM`)
    }));
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.labelKo.includes('BPM 표준편차') || issue.labelKo.includes('BPM 범위') || issue.labelKo.includes('보컬 서술') || issue.labelKo.includes('보컬 타입'))).toBe(false);
  });

  it('blocks when a word appears more than 30 times pack-wide (WORD_BLOCKING_THRESHOLD) (v4.1 TASK C: rebalance-scope packBlocking, not copied into every track)', () => {
    const overusedLyrics = `[verse 1]\n${Array.from({ length: 31 }, (_, i) => `light light light number ${i}`).join('\n')}\n\n[end]`;
    const songs = [songWith({ trackNo: 1, lyrics: overusedLyrics })];
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.scope === 'rebalance' && issue.labelKo.includes('30회를 초과'))).toBe(true);
  });

  it('does NOT block (advisory only) a word repeated between the 12/20 advisory cap and the 30 blocking threshold', () => {
    const moderatelyRepeated = `[verse 1]\n${Array.from({ length: 25 }, (_, i) => `light quiet moment number ${i}`).join('\n')}\n\n[end]`;
    const songs = [songWith({ trackNo: 1, lyrics: moderatelyRepeated })];
    const result = scoreComposition(songs);
    expect(result.packBlocking.some(issue => issue.labelKo.includes('30회를 초과'))).toBe(false);
    expect(result.packAdvisory.some(issue => issue.labelKo.includes('상한을 넘겨'))).toBe(true);
  });
});
