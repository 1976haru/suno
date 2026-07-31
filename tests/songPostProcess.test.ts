import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeSongOutput } from '../src/core/songPostProcess';
import { importSongsJson } from '../src/core/claudeCodeBridge';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song 1',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hook 1',
    stylePrompt: 'warm acoustic pop, 92 BPM, target 3:10-3:35.',
    lyrics: '[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook 1\nHook 1\nHook 1',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

/**
 * TASK v3.60 (TASK B-1/B-2) — a real bridge-path pack echoed template-header
 * labels into stylePrompt ("Money chords: ...", "Instruments: ...") even
 * though nothing told the agent to write them, and once carried a duplicate
 * duration mention. Mechanical-only removal: no other content changes.
 */
describe('[v3.60 TASK B-1/B-2] normalizeSongOutput strips leaked labels and duplicate durations from stylePrompt', () => {
  it('removes Money chords:/Instruments:/Signature:/Arrangement detail:/concept cue: labels', () => {
    const song = songWith({
      stylePrompt: 'soft retro soul pop, 97 BPM, target 3:10-3:35. Money chords: I-vi-IV-V doo-wop progression - gentle rocking sway. Instruments: Wurlitzer, muted guitar; fuller arrangement. Arrangement detail: final repeat of the hook sung almost a cappella. Signature: warm tape glow. concept cue: a private memory.'
    });
    const result = normalizeSongOutput(song);
    expect(result.stylePrompt).not.toMatch(/Money chords:/i);
    expect(result.stylePrompt).not.toMatch(/Instruments:/i);
    expect(result.stylePrompt).not.toMatch(/Signature:/i);
    expect(result.stylePrompt).not.toMatch(/Arrangement detail:/i);
    expect(result.stylePrompt).not.toMatch(/concept cue:/i);
    expect(result.stylePrompt).toContain('I-vi-IV-V doo-wop progression');
    expect(result.stylePrompt).toContain('Wurlitzer, muted guitar');
    expect(result.warnings.some(w => w.includes('template-header labels'))).toBe(true);
  });

  it('removes the bare "target" label immediately before a duration range, leaving the duration itself', () => {
    const song = songWith({ stylePrompt: 'warm acoustic pop, 92 BPM, target 3:10-3:35.' });
    const result = normalizeSongOutput(song);
    expect(result.stylePrompt).not.toMatch(/\btarget\s+3:10/i);
    expect(result.stylePrompt).toContain('3:10-3:35');
  });

  it('does not touch "target" when it is not immediately followed by a duration (e.g. "target audience")', () => {
    const song = songWith({ stylePrompt: 'warm acoustic pop for a target audience, 92 BPM.' });
    const result = normalizeSongOutput(song);
    expect(result.stylePrompt).toContain('target audience');
  });

  it('removes a duplicate duration mention, keeping the first occurrence', () => {
    const song = songWith({ stylePrompt: 'warm acoustic pop, full 3:10-3:35 arrangement, 92 BPM, aim for 3:10-3:35 overall.' });
    const result = normalizeSongOutput(song);
    const matches = result.stylePrompt.match(/\d{1,2}:\d{2}-\d{1,2}:\d{2}/g) || [];
    expect(matches).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('duplicate duration'))).toBe(true);
  });

  it('leaves an already-clean stylePrompt untouched and adds no label/duration warning', () => {
    const song = songWith({ stylePrompt: 'warm acoustic pop, 92 BPM, full 3:10-3:35 arrangement, soft vocal.' });
    const result = normalizeSongOutput(song);
    expect(result.stylePrompt).toBe(song.stylePrompt);
    expect(result.warnings.some(w => w.includes('template-header labels'))).toBe(false);
    expect(result.warnings.some(w => w.includes('duplicate duration'))).toBe(false);
  });
});

/**
 * TASK v3.60 (TASK B-3), corrected by TASK v3.62 (TASK 2-4), corrected again
 * by TASK v3.64 (TASK B) — 8/17 real songs originally sang a leaked
 * arrangement description as the first lyric line under a bare
 * [intro]-family tag. The v3.62 fix keyed the strip decision off stylePrompt
 * declaring "(INTRO ONLY)" verbatim — but v3.62 TASK 1 (same release) removed
 * the verbatim requirement that used to write that exact declaration, so the
 * condition stopped ever being true and a real 18-song pack measured 12/18
 * songs still singing a leaked line under [intro]. The signal is now
 * introMode (an app-planned value from PreassignedSongSlot, passed in
 * directly — never inferred from stylePrompt text): 'instrumental' strips
 * every line under the tag (unconditionally — an instrumental intro cannot
 * have any sung line under it) and relabels it `[Instrumental Intro]`;
 * anything else (or no introMode at all) leaves the line untouched
 * regardless of its wording.
 */
describe('[v3.64 TASK B] normalizeSongOutput strips intro-tag lines only when introMode is \'instrumental\'', () => {
  it('strips a line under a bare [intro] tag when introMode is \'instrumental\'', () => {
    const song = songWith({
      lyrics: '[intro]\nSpiccato strings flicker over quiet water\n\n[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook 1\nHook 1\nHook 1'
    });
    const result = normalizeSongOutput(song, 'instrumental');
    expect(result.lyrics).not.toContain('Spiccato strings flicker');
    expect(result.lyrics).toContain('[Instrumental Intro]');
    expect(result.lyrics).toContain('I hold my father\'s guitar');
    expect(result.warnings.some(w => w.includes('instrumental intro'))).toBe(true);
  });

  it('strips a real, non-arrangement-vocabulary line too, once introMode is \'instrumental\' — this is the actual bug fix', () => {
    const song = songWith({
      lyrics: '[intro]\nMorning opens on the table\n\n[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook 1\nHook 1\nHook 1'
    });
    const result = normalizeSongOutput(song, 'instrumental');
    expect(result.lyrics).not.toContain('Morning opens on the table');
    expect(result.lyrics).toContain('[Instrumental Intro]');
  });

  it('strips under other intro-family tags ([cold hook intro], [a cappella hook intro]) when introMode is \'instrumental\'', () => {
    for (const tag of ['[cold hook intro]', '[a cappella hook intro]']) {
      const song = songWith({
        lyrics: `${tag}\nThe straight-pop drums move softly\n\n[chorus]\nHook 1\nHook 1\nHook 1`
      });
      const result = normalizeSongOutput(song, 'instrumental');
      expect(result.lyrics, tag).not.toContain('drums move softly');
    }
  });

  it('does NOT strip an intro-tag line when introMode is \'vocal-after-texture\' — even if the line matches the old arrangement-vocab criterion', () => {
    const song = songWith({
      lyrics: '[intro]\nSpiccato strings flicker over quiet water\n\n[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook 1\nHook 1\nHook 1'
    });
    const result = normalizeSongOutput(song, 'vocal-after-texture');
    expect(result.lyrics).toContain('Spiccato strings flicker over quiet water');
    expect(result.warnings.some(w => w.includes('instrumental intro'))).toBe(false);
  });

  it('does NOT strip when introMode is omitted entirely (no slot match) — same as \'vocal-after-texture\', a safe no-op default', () => {
    const song = songWith({
      lyrics: '[intro]\nSpiccato strings flicker over quiet water\n\n[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook 1\nHook 1\nHook 1'
    });
    const result = normalizeSongOutput(song);
    expect(result.lyrics).toContain('Spiccato strings flicker over quiet water');
  });

  it('does not touch a line elsewhere in the lyrics that isn\'t under an intro tag, even with introMode \'instrumental\'', () => {
    const song = songWith({
      lyrics: '[verse 1]\nThe straight-pop drums move softly\n\n[chorus]\nHook 1\nHook 1\nHook 1'
    });
    const result = normalizeSongOutput(song, 'instrumental');
    expect(result.lyrics).toContain('The straight-pop drums move softly');
  });

  it('leaves an [instrumental hook intro] tag followed immediately by a section tag untouched', () => {
    const song = songWith({
      lyrics: '[instrumental hook intro]\n[verse 1]\nI hold my father\'s guitar\n\n[chorus]\nHook 1\nHook 1\nHook 1'
    });
    const result = normalizeSongOutput(song, 'instrumental');
    expect(result.lyrics).toBe(song.lyrics);
  });
});

/** TASK v3.60 (TASK B-4) — diagnostic only, mirrors TASK C-8's own long-atom warning but for a bridge song's raw, unstructured stylePrompt. */
describe('[v3.60 TASK B-4] normalizeSongOutput flags long style-prompt clauses as warnings only (never rewrites)', () => {
  it('adds a warning for a clause over 8 words, without changing the stylePrompt text', () => {
    const song = songWith({ stylePrompt: 'warm acoustic pop, verse stays in a straight four four pop feel with sustained piano pads and clean strummed acoustic, 92 BPM.' });
    const result = normalizeSongOutput(song);
    expect(result.stylePrompt).toBe(song.stylePrompt);
    expect(result.warnings.some(w => w.includes('is') && w.includes('words long'))).toBe(true);
  });

  it('adds no long-clause warning when every clause stays at or under 8 words', () => {
    const song = songWith({ stylePrompt: 'warm acoustic pop, soft vocal, 92 BPM, full 3:10-3:35 arrangement.' });
    const result = normalizeSongOutput(song);
    expect(result.warnings.some(w => w.includes('words long'))).toBe(false);
  });
});

/**
 * TASK v3.60 (TASK B) — verifies against a real bridge-path pack. Frozen as
 * tests/fixtures/realBridgePack.json (see compositionScorer.test.ts's own
 * comment on why) rather than the live root songs-output.json, which is now
 * a git-tracked file the user overwrites every time they commit a new real
 * generation (commit 9267e7e).
 */
const realPackPath = path.resolve(__dirname, 'fixtures', 'realBridgePack.json');
const describeRealPack = existsSync(realPackPath) ? describe : describe.skip;

describe('[v3.60 TASK B] importSongsJson (the actual bridge import path) runs every song through normalizeSongOutput', () => {
  it('strips a leaked "Money chords:" label from an imported song\'s stylePrompt', () => {
    const opts = makeOptions({ songCount: 1, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const raw = JSON.stringify({
      songs: [{
        trackNo: 1,
        title: 'Song One',
        hookPhrase: 'Hook One',
        stylePrompt: 'warm acoustic pop, 92 BPM, target 3:10-3:35. Money chords: I-V-vi-IV progression - gentle lift.',
        lyrics: '[verse 1]\nline a\nline b\n\n[chorus]\nHook One\nHook One\nHook One',
        seasonMoment: 'x',
        listenerSituation: 'x',
        emotionArc: 'x',
        youtube: { title: 'yt', description: 'desc', tags: ['tag'] }
      }]
    });
    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    const song = report.blueprint!.songs[0];
    expect(song.stylePrompt).not.toMatch(/Money chords:/i);
    expect(song.stylePrompt).not.toMatch(/\btarget\s+3:10/i);
    expect(song.stylePrompt).toContain('I-V-vi-IV progression');
  });
});

describeRealPack('[v3.60 TASK B] normalizeSongOutput against the real bridge-path pack', () => {
  const data = existsSync(realPackPath) ? JSON.parse(readFileSync(realPackPath, 'utf-8')) : { songs: [] };

  it('removes every template-header label from every song\'s stylePrompt', () => {
    for (const raw of data.songs) {
      const result = normalizeSongOutput(raw as SongIdea);
      expect(result.stylePrompt, `track ${raw.trackNo}`).not.toMatch(/Money chords:|Instruments:|Arrangement detail:/i);
    }
  });

  it('TASK v3.64 (TASK B) — this real pack has real leaked lines under [intro] that the old (INTRO ONLY)-declaration signal never caught, since none of its style prompts declare that marker', () => {
    // This is real, LLM-composed (post-v3.62 TASK 1) content — the agent was
    // never asked to write "(INTRO ONLY)" verbatim (that's exactly what
    // TASK 1 removed). Without introMode, the old rule stays permanently
    // dark — exactly the real 12/18 bug this task fixes, reproduced here
    // with no arguments (the pre-v3.64 call shape).
    const leaked = data.songs.filter((raw: SongIdea) => normalizeSongOutput(raw).lyrics !== raw.lyrics);
    expect(leaked.length).toBe(0); // stylePrompt-based signal: always 0, that's the bug
    const linesUnderIntro = data.songs.filter((raw: SongIdea) => /^\[[^\]]*intro[^\]]*\]\s*\n[^[(\s]/im.test(raw.lyrics));
    expect(linesUnderIntro.length).toBeGreaterThan(0); // real leaked content is still there, unstripped
  });

  it('TASK v3.64 (TASK B) — the same real leaked lines are correctly stripped once introMode is passed as \'instrumental\'', () => {
    // Simulates what the fix actually does in production: the app plans
    // introMode from PreassignedSongSlot and passes it in directly (see
    // claudeCodeBridge.ts's importSongsJson), instead of relying on
    // anything the agent wrote in stylePrompt.
    const tracksWithLeakedIntroLine = data.songs.filter((raw: SongIdea) => /^\[[^\]]*intro[^\]]*\]\s*\n[^[(\s]/im.test(raw.lyrics));
    expect(tracksWithLeakedIntroLine.length).toBeGreaterThan(0);
    for (const raw of tracksWithLeakedIntroLine) {
      const result = normalizeSongOutput(raw as SongIdea, 'instrumental');
      expect(result.lyrics, `track ${raw.trackNo}`).toContain('[Instrumental Intro]');
      expect(result.lyrics, `track ${raw.trackNo}`).not.toMatch(/^\[[^\]]*intro[^\]]*\]\s*\n[^[(\s]/im);
    }
  });
});
