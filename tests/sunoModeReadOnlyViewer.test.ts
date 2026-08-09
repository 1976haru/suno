import { describe, expect, it } from 'vitest';
import { parseSongsJsonForViewer, normalizeVocalTagForDisplay } from '../src/core/bridgeImport';
import { inspectImportReport } from '../src/core/importInspection';
import { importSongsJson } from '../src/core/claudeCodeBridge';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

function songJson(count: number, overrides: (i: number) => Partial<Record<string, unknown>> = () => ({})) {
  return JSON.stringify({
    songs: Array.from({ length: count }, (_, i) => ({
      trackNo: i + 1,
      title: `Song ${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      stylePrompt: `warm acoustic pop, mood ${i}, instrument ${i}, vocal ${i}, hook device ${i}, ${90 + i} BPM`,
      lyrics: `[verse 1]\nthis is a genuinely long qualifying line a ${i}\nthis is a genuinely long qualifying line b ${i}\n\n[chorus]\nHook ${i + 1}\nHook ${i + 1}\nHook ${i + 1}`,
      seasonMoment: 'x',
      listenerSituation: `situation ${i}`,
      emotionArc: 'x',
      excludePrompt: `avoid ${i}`,
      distinctChoice: `choice ${i}`,
      youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
      ...overrides(i)
    }))
  });
}

// 지시문 13 (TASK A) — parseSongsJsonForViewer is the read-only counterpart to
// importSongsJson/importSongsForSrtOnly: it must open files the normal save
// path correctly refuses to persist (duplicate scene/title, 3+ overlapping
// lyric lines against recent history), because those are reasons NOT TO SAVE
// (they'd pollute cross-set history/ledgers), not reasons a human can't read
// text that's already sitting in a file on their own disk.
describe('[수노모드 읽기전용] parseSongsJsonForViewer structural blocking', () => {
  it('blocks on unparseable JSON', () => {
    const result = parseSongsJsonForViewer('not json {{{', { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
    expect(result.songs).toEqual([]);
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it('blocks when there is no "songs" array', () => {
    const result = parseSongsJsonForViewer(JSON.stringify({ notSongs: [] }), { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
  });

  it('blocks when "songs" is an empty array', () => {
    const result = parseSongsJsonForViewer(JSON.stringify({ songs: [] }), { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
  });

  it('blocks on a duplicate trackNo', () => {
    const raw = songJson(3, i => (i === 2 ? { trackNo: 1 } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
    expect(result.blockedReasons.join(' ')).toContain('trackNo');
  });

  it('blocks on an out-of-range trackNo', () => {
    const raw = songJson(3, i => (i === 0 ? { trackNo: 999 } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
  });

  it('blocks on a non-integer trackNo', () => {
    const raw = songJson(2, i => (i === 0 ? { trackNo: 1.5 } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
  });

  it('blocks the WHOLE file when even one song is missing lyrics', () => {
    const raw = songJson(3, i => (i === 1 ? { lyrics: '' } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
    expect(result.songs).toEqual([]);
    expect(result.blockedReasons.join(' ')).toContain('lyrics');
  });

  it('blocks the WHOLE file when even one song is missing stylePrompt', () => {
    const raw = songJson(3, i => (i === 0 ? { stylePrompt: '' } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
  });

  it('blocks the WHOLE file when even one song is missing title', () => {
    const raw = songJson(3, i => (i === 2 ? { title: '' } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('blocked');
  });

  it('does NOT block a song merely missing hookPhrase — narrower than the normal REQUIRED_SONG_FIELDS set', () => {
    const raw = songJson(3, i => (i === 0 ? { hookPhrase: '' } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('ok');
    expect(result.songs).toHaveLength(3);
    expect(result.songs[0].hookPhrase).toBe('');
  });
});

describe('[수노모드 읽기전용] the whole point: duplication/quality never blocks read-only entry', () => {
  it('reproduces a real blocked-by-duplication scenario via the normal save path, then proves the read-only path still opens it', () => {
    const opts = makeOptions({ songCount: 18 });
    const raw = songJson(18);

    // Build a duplication history that guarantees BOTH gate 1 (scene/title)
    // and gate 2 (3+ exact lyric-line matches) fire — the exact shape of the
    // real blocked logs quoted in this task's own background section.
    const recentSituations = Array.from({ length: 18 }, (_, i) => `situation ${i}`);
    const recentLyricLines = Array.from({ length: 18 }, (_, i) => [
      `this is a genuinely long qualifying line a ${i}`,
      `this is a genuinely long qualifying line b ${i}`
    ]).flat();
    const duplicationHistory = { recentSituations, recentLyricLines, historicalTitles: new Set<string>() };

    // 1. Prove the NORMAL save path really does hard-block this exact input.
    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    const rawSongs = JSON.parse(raw).songs;
    const inspection = inspectImportReport(report, rawSongs, opts.lyricLanguage, undefined, undefined, duplicationHistory);
    expect(inspection.status, 'sanity check: the normal save path really is blocked by this duplication history').toBe('blocked');
    expect(inspection.blockedReasons.join(' ')).toContain('가사 문장');

    // 2. Prove the READ-ONLY viewer path opens the SAME file successfully,
    //    with the SAME duplication history, surfacing it only as a warning.
    const viewerResult = parseSongsJsonForViewer(raw, { lyricLanguage: opts.lyricLanguage, duplicationHistory });
    expect(viewerResult.status).toBe('ok');
    expect(viewerResult.songs).toHaveLength(18);
    const duplicationCheck = viewerResult.checks.find(c => c.id === 'lyricLineOverlap');
    expect(duplicationCheck?.status).toBe('warn');
    expect(duplicationCheck?.detail).toContain('가사 문장');
    const sceneCheck = viewerResult.checks.find(c => c.id === 'duplication');
    expect(sceneCheck?.status).toBe('warn');
  });

  it('opens successfully with no duplicationHistory supplied at all (skips those 2 advisory checks, never blocks)', () => {
    const raw = songJson(5);
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('ok');
    expect(result.songs).toHaveLength(5);
    expect(result.checks.some(c => c.id === 'duplication')).toBe(false);
    expect(result.checks.some(c => c.id === 'lyricLineOverlap')).toBe(false);
  });

  it('surfaces missing distinctChoice/excludePrompt as advisory warnings, never blocking', () => {
    const raw = songJson(3, i => (i === 0 ? { distinctChoice: undefined, excludePrompt: undefined } : {}));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('ok');
    const distinctCheck = result.checks.find(c => c.id === 'distinctChoice');
    expect(distinctCheck?.status).toBe('warn');
    expect(distinctCheck?.detail).toContain('T1');
    const excludeCheck = result.checks.find(c => c.id === 'excludePrompt');
    expect(excludeCheck?.status).toBe('warn');
  });
});

describe('[수노모드 읽기전용] display-only vocal tag normalization never touches the underlying content', () => {
  it('normalizes casing/spacing of a recognized top-of-lyrics vocal tag', () => {
    expect(normalizeVocalTagForDisplay('[Female Vocal]\n[verse 1]\nline')).toBe('[female vocal]\n[verse 1]\nline');
    expect(normalizeVocalTagForDisplay('[  MALE VOCAL  ]\nline')).toBe('[male vocal]\nline');
  });

  it('leaves lyrics with no recognizable vocal tag completely unchanged', () => {
    const lyrics = '[verse 1]\nline one\nline two';
    expect(normalizeVocalTagForDisplay(lyrics)).toBe(lyrics);
  });

  it('is a no-op when the tag is already canonical', () => {
    const lyrics = '[female vocal]\n[verse 1]\nline';
    expect(normalizeVocalTagForDisplay(lyrics)).toBe(lyrics);
  });
});

describe('[수노모드 읽기전용] parses into real, displayable SongIdea-shaped objects', () => {
  it('parses titleDisplay from title + titleLocalized when present', () => {
    const raw = songJson(1, () => ({ titleLocalized: '한글제목' }));
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('ok');
    expect(result.songs[0].titleDisplay).toBe('Song 1 (한글제목)');
  });

  it('sorts by each song\'s own claimed trackNo (not raw array position) before assigning the display order, keeping originalTrackNo', () => {
    const raw = JSON.stringify({
      songs: [
        { trackNo: 2, title: 'B', hookPhrase: 'Hook B', stylePrompt: 'x', lyrics: '[chorus]\nHook B' },
        { trackNo: 1, title: 'A', hookPhrase: 'Hook A', stylePrompt: 'x', lyrics: '[chorus]\nHook A' }
      ]
    });
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('ok');
    expect(result.songs.map(s => s.trackNo)).toEqual([1, 2]);
    expect(result.songs.map(s => s.title)).toEqual(['A', 'B']);
    expect(result.songs.map(s => s.originalTrackNo)).toEqual([1, 2]);
  });

  it('carries meta through when present', () => {
    const raw = JSON.stringify({
      meta: { setName: 'test-set', channelLabel: 'Test Channel', conceptLabel: 'Test Concept', songCount: 1, lyricLanguage: 'english' },
      songs: JSON.parse(songJson(1)).songs
    });
    const result = parseSongsJsonForViewer(raw, { lyricLanguage: 'english' });
    expect(result.status).toBe('ok');
    expect(result.meta?.setName).toBe('test-set');
  });
});
