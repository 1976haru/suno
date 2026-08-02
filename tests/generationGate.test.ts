import { describe, expect, it } from 'vitest';
import { evaluateGenerationGate } from '../src/core/generationGate';
import type { SongIdea } from '../src/types';

/**
 * v3.78 (TASK B) — reproduction tests for core/generationGate.ts, same
 * pattern as tests/designGate.test.ts and tests/compositionScorer.test.ts's
 * own v3.77 describe block: hand-built inputs that reproduce exactly one
 * failure at a time, proving the check fires — and a healthy pack proving
 * it does NOT false-positive.
 */

// Real trait phrases (data/vocalTraits.ts) — using invented phrases here
// would under-count against generationGate.ts's own registerPool lookup and
// falsely fail the "healthy pack" test on a fixture bug, not a real gate bug.
const MALE_REGISTERS = ['low warm baritone', 'mid baritone-tenor lead', 'bright tenor lead', 'light high tenor', 'deep chest-register lead', 'relaxed mid-range lead', 'narrow crooner tone'];
const FEMALE_REGISTERS = ['low warm contralto', 'mid clear alto', 'clear mezzo lead', 'bright soprano lead', 'soft head-voice lead', 'full chest alto', 'narrow intimate lead'];
const ALL_REGISTERS = [...MALE_REGISTERS, ...FEMALE_REGISTERS];

// A pool of BASE_WORDS x NUMBERS = 240 distinct tokens, sliced 12-per-track
// with a non-overlapping offset per track, so no single word's PACK-WIDE
// count can cross WORD_BLOCKING_THRESHOLD (30) — a shared filler pool (this
// fixture's first draft) inflated a handful of words into the hundreds
// pack-wide, which is exactly what vocab-repeat-hard exists to catch (and
// correctly did catch — the fixture was wrong, not the gate).
// core/lyricVocabularyRepetition.ts's own WORD_PATTERN is /[a-z']+/gi — digits
// are NOT word characters and get silently dropped from a match, so a naive
// "harbor1".."harbor20" numbering scheme collapses to the single token
// "harbor" once counted (a fixture bug this test suite hit and fixed, not a
// gate bug) — letter suffixes instead, which stay distinct under that regex.
const SUFFIX_LETTERS = 'abcdefghijklmnopqrst'.split('');
const BASE_WORDS = ['harbor', 'meadow', 'orchard', 'kettle', 'ribbon', 'ferry', 'attic', 'engine', 'garden', 'bakery', 'library', 'chapel'];
const WORD_POOL = BASE_WORDS.flatMap(base => SUFFIX_LETTERS.map(letter => `${base}${letter}`));

function wordSliceFor(trackNo: number, count = 12): string[] {
  const start = ((trackNo - 1) * count) % WORD_POOL.length;
  return Array.from({ length: count }, (_, i) => WORD_POOL[(start + i) % WORD_POOL.length]);
}

const TITLES = [
  // single-word (4)
  'Harbor', 'Meadow', 'Vineyard', 'Orchard',
  // noun-noun (4)
  'Kitchen Light', 'Garden Bench', 'Library Corner', 'Chapel Window',
  // short-phrase, non-verb-led, 3-4 words (4)
  'Attic Hours Tonight', 'Bakery Row Morning', 'Workshop Evening Light', 'Schoolyard Bell Sound',
  // verb-phrase, leading word in TITLE_VERB_LEAD_WORDS (3)
  'Wait By The Window', 'Turn Toward The Sun', 'Watch The Tide Come In',
  // long-phrase, non-verb-led, 5+ words (3)
  'The Ribbon And The Ferry Line', 'The Ticket For A Long Journey', 'A Quiet Corner By The Sea'
];

function fillerLyrics(wordTarget: number, sectionCount: number, wordSlice: string[]): string {
  const sections = ['verse 1', 'pre-chorus', 'chorus', 'verse 2', 'bridge', 'final chorus', 'outro', 'coda'].slice(0, sectionCount);
  const wordsPerSection = Math.ceil(wordTarget / sectionCount);
  return sections.map((tag, sIdx) => {
    const lines: string[] = [`[${tag}]`];
    let words = 0;
    let lineWords: string[] = [];
    let wordIdx = 0;
    while (words < wordsPerSection) {
      lineWords.push(wordSlice[(wordIdx + sIdx) % wordSlice.length]);
      words += 1;
      wordIdx += 1;
      if (lineWords.length >= 6) { lines.push(lineWords.join(' ')); lineWords = []; }
    }
    if (lineWords.length) lines.push(lineWords.join(' '));
    return lines.join('\n');
  }).join('\n\n');
}

let situationCounter = 0;
let emotionCounter = 0;
const EMOTIONS = ['warm nostalgia', 'quiet hope', 'gentle longing', 'soft joy', 'bittersweet memory', 'calm gratitude', 'tender relief', 'wistful comfort', 'steady peace', 'mellow wonder'];

function healthySong(overrides: Partial<SongIdea> = {}): SongIdea {
  situationCounter += 1;
  emotionCounter += 1;
  const trackNo = overrides.trackNo ?? situationCounter;
  const register = ALL_REGISTERS[(trackNo - 1) % ALL_REGISTERS.length];
  const gender = MALE_REGISTERS.includes(register) ? 'male' : 'female';
  const tokens = wordSliceFor(trackNo, 12);
  return {
    trackNo,
    title: TITLES[(trackNo - 1) % TITLES.length],
    seasonMoment: 'x',
    listenerSituation: `unique situation number ${situationCounter} near the ${tokens[0]} — a specific scene never repeated elsewhere in this pack`,
    emotionArc: EMOTIONS[(emotionCounter - 1) % EMOTIONS.length],
    hookPhrase: `Hold On To The ${tokens[0]}`,
    // 8 of this track's own 12 tokens go into stylePrompt too (never shared
    // with another track's slice — see wordSliceFor's own doc comment) so
    // in-pack style-similarity (diversityLinter.ts's own <=28% blocking
    // bound, reused via scoreComposition) stays low even though the base
    // production-technique atoms below are necessarily shared vocabulary.
    stylePrompt: [
      'oldpop-warm-morning-glow', '12-string acoustic guitar', 'walking bass', 'brushed drums',
      'I-IV-V progression', `${gender} ${register}`, 'clear forward diction', `${78 + (trackNo % 12) * 2} BPM`, 'warm studio mix',
      'gentle backing harmony', 'singalong hook', 'no instrumental intro', '3:10-3:35',
      ...tokens.slice(0, 8)
    ].join(', '),
    lyrics: fillerLyrics(220, 7, tokens),
    warnings: [],
    qualityScore: 90,
    youtube: { title: `Track ${trackNo}`, description: 'desc', tags: [] },
    vocalType: gender === 'male' ? 'male' : (trackNo % 4 === 0 ? 'mixed' : 'female'),
    genreId: 'oldpop-warm-morning-glow',
    ...overrides
  };
}

function healthyPack(count = 18): SongIdea[] {
  situationCounter = 0;
  emotionCounter = 0;
  return Array.from({ length: count }, (_, i) => healthySong({ trackNo: i + 1 }));
}

describe('evaluateGenerationGate — healthy pack produces no false positives', () => {
  it('passes an 18-song pack with real word count/section/situation/emotion variety', () => {
    const songs = healthyPack(18);
    const result = evaluateGenerationGate(songs, { conceptLabel: '' });
    if (!result.passed) {
      // Print for debugging if this ever regresses — cheaper than guessing which check fired.
      console.log(result.tracks.filter(t => !t.passed).map(t => `T${t.trackNo}: ${t.blocking.join(' | ')}`).join('\n'));
    }
    expect(result.passed).toBe(true);
  });
});

describe('evaluateGenerationGate — per-track checks', () => {
  it('blocks lyric-word-count when a lyric is far outside 200~240 words', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: fillerLyrics(120, 7, wordSliceFor(1, 12)) })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('가사 단어수'))).toBe(true);
  });

  it('blocks lyric-section-count when a lyric has too few/many sections', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: fillerLyrics(220, 3, wordSliceFor(1, 12)) })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('섹션 수'))).toBe(true);
  });

  it('blocks placeholder-leak', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: `[verse 1]\n[PLACEHOLDER]\n${fillerLyrics(210, 6, wordSliceFor(1, 12))}` })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('자리표시자'))).toBe(true);
  });

  it('blocks title-line-leak', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: `Title: Something\n${fillerLyrics(210, 6, wordSliceFor(1, 12))}` })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('Title:'))).toBe(true);
  });

  it('blocks label-residue', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: `Money chords: I-IV-V\n${fillerLyrics(210, 6, wordSliceFor(1, 12))}` })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('라벨'))).toBe(true);
  });

  it('blocks article-error on "like a <plural>"', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: `[verse 1]\nfaded like a memories in the rain\n${fillerLyrics(210, 6, wordSliceFor(1, 12))}` })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('관사'))).toBe(true);
  });

  it('does NOT flag a common word ending in -s as an article error (exception list)', () => {
    const songs = [healthySong({ trackNo: 1, lyrics: `[verse 1]\nfaded like a promise in the rain\n${fillerLyrics(210, 6, wordSliceFor(1, 12))}` })];
    const result = evaluateGenerationGate(songs);
    expect(result.tracks[0].blocking.some(b => b.includes('관사'))).toBe(false);
  });
});

describe('evaluateGenerationGate — pack-level checks (§3-2)', () => {
  it('blocks lyric-situation-unique when two tracks share the exact same situation (v4.1 TASK C: pair-scope, targets only the later track, not the whole pack)', () => {
    const songs = healthyPack(6);
    songs[1] = { ...songs[1], listenerSituation: songs[0].listenerSituation };
    const result = evaluateGenerationGate(songs);
    const issue = result.packBlocking.find(item => item.id === 'lyric-situation-duplicate');
    expect(issue?.scope).toBe('pair');
    expect(issue?.affectedTracks).toEqual([songs[1].trackNo]);
    // The pack isn't "passed" while this is open, but neither individual
    // track's OWN text is at fault, so neither carries it in `.blocking`.
    expect(result.passed).toBe(false);
    expect(result.tracks.every(t => t.passed)).toBe(true);
  });

  it('blocks lyric-emotion-variety when fewer than 8 distinct emotion arcs appear (v4.1 TASK C: rebalance-scope, real minimum affectedTracks)', () => {
    const songs = healthyPack(18).map(song => ({ ...song, emotionArc: 'warm nostalgia' }));
    const result = evaluateGenerationGate(songs);
    const issue = result.packBlocking.find(item => item.id === 'emotion-arc-variety');
    expect(issue?.scope).toBe('rebalance');
    expect(issue?.labelKo).toContain('감정 아크');
    expect(issue!.affectedTracks.length).toBeGreaterThan(0);
    expect(issue!.affectedTracks.length).toBeLessThan(18);
  });

  it('blocks vocal-descriptor-variety when every song shares the same register phrase (v4.1 TASK C: design-scope, every track affected)', () => {
    const songs = healthyPack(18).map(song => ({ ...song, stylePrompt: song.stylePrompt.replace(/male [a-z -]+ lead|warm alto|clear soprano|smoky contralto|bright mezzo|gentle falsetto|rich full chest voice|airy head voice|husky low tenor/, 'male deep chest-register lead') }));
    const result = evaluateGenerationGate(songs);
    const issue = result.packBlocking.find(item => item.id === 'vocal-descriptor-variety');
    expect(issue?.scope).toBe('design');
    expect(issue?.labelKo).toContain('보컬 서술 종류');
  });

  it('blocks title-pattern-variety/max when titles collapse to one shape (v4.1 TASK C: rebalance-scope, real minimum affectedTracks — verification scenario D)', () => {
    const songs = healthyPack(18).map((song, i) => ({ ...song, title: `Word${i}` }));
    const result = evaluateGenerationGate(songs);
    const issue = result.packBlocking.find(item => item.id === 'title-pattern-variety');
    expect(issue?.scope).toBe('rebalance');
    expect(issue?.labelKo).toContain('제목 패턴');
    // The actual point of TASK C: a handful of titles need rewriting, not all 18.
    expect(issue!.affectedTracks.length).toBeGreaterThan(0);
    expect(issue!.affectedTracks.length).toBeLessThan(18);
    // The regen button must be disabled (design/full/rebalance semantics —
    // see GenerationGatePanel), and the pack must not read as "passed".
    expect(result.passed).toBe(false);
  });
});

describe('evaluateGenerationGate — 재작곡 범위 판정 (§3-3)', () => {
  it('sets needsFullRegeneration only when 12 or more tracks fail', () => {
    const healthy = healthyPack(18);
    // Each shortened track keeps its OWN word slice (not a shared one) — a
    // shared slice would pollute pack-wide vocab counts and fail every
    // track via the pack-level vocab-repeat-hard check, not just the
    // intentionally-shortened ones (a fixture bug, not a gate bug).
    const elevenBroken = healthy.map((song, i) => (i < 11 ? { ...song, lyrics: fillerLyrics(120, 7, wordSliceFor(song.trackNo, 12)) } : song));
    const resultEleven = evaluateGenerationGate(elevenBroken);
    expect(resultEleven.failingTrackNos.length).toBe(11);
    expect(resultEleven.needsFullRegeneration).toBe(false);

    const twelveBroken = healthy.map((song, i) => (i < 12 ? { ...song, lyrics: fillerLyrics(120, 7, wordSliceFor(song.trackNo, 12)) } : song));
    const resultTwelve = evaluateGenerationGate(twelveBroken);
    expect(resultTwelve.failingTrackNos.length).toBe(12);
    expect(resultTwelve.needsFullRegeneration).toBe(true);
  });
});
