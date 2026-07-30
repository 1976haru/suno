import { describe, expect, it } from 'vitest';
import { checkHookQuality, scoreSong, scoreSongs } from '../src/core/quality';
import { buildDurationControl, buildExcludePrompt, buildStylePrompt } from '../src/core/promptComposer';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Song',
    seasonMoment: 'Christmas Cafe',
    listenerSituation: 'morning coffee before the day begins',
    emotionArc: 'lonely memory to warm acceptance',
    hookPhrase: 'Test Song, keep a little light for me',
    stylePrompt: 'warm adult contemporary pop, hook "test" repeats chorus 4x, I-V-vi-IV progression',
    lyrics: '[short intro]\nSoft Rhodes.\n\n[verse 1]\nline one\nline two\n\n[chorus]\nline three\nline four\n\n[verse 2]\nline five\n\n[short bridge]\nline six\n\n[final chorus]\nline seven\n\n[end]',
    thumbnailText: 'Christmas Cafe',
    youtube: { title: 'YT title', description: 'YT description', tags: ['tag'], thumbnailText: 'th' },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('quality scorer', () => {
  it('playlistShort duration control includes "no long instrumental break" (Q1 regression)', () => {
    expect(buildDurationControl('playlistShort')).toContain('no long instrumental break');
  });

  it('does not penalize playlistShort-generated songs for a missing prompt term (Q1 regression)', () => {
    // TASK G1 (v3.10) — the duration atom is now the compact
    // compactDuration() form ('quick intro, 2:50-3:20') rather than the old
    // long-form buildDurationControl() sentence; requiredPromptTerms was
    // updated to match (see quality.ts).
    const opts = makeOptions({ durationTarget: 'playlistShort' });
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).toContain('2:50-3:20');
    // TASK v3.43 Part A5 — buildStylePrompt is the channel-level-only partial
    // builder (no per-song hook/tempo/scene parts, see its own doc comment);
    // the real per-song builders (localGenerator.ts's loop, or Batch/bridge's
    // reconciled output) always add a BPM figure and a hook-device phrase, so
    // this test appends the same to keep testing its original Q1 concern
    // (the duration atom) without tripping the newer, unrelated device/BPM
    // safety-net checks this synthetic partial prompt was never meant to
    // exercise.
    const fullPrompt = `${prompt}, breakdown section, 96 BPM`;
    const song = scoreSong(baseSong({ stylePrompt: fullPrompt }));
    expect(song.warnings.some(w => w.startsWith('Missing prompt term'))).toBe(false);
  });

  // TASK v3.29 — a real 20-song Codex-bridge pack wrote its chord
  // progression as "I-V-vi-IV money chords" (never the literal word
  // "progression"), so the old exact-substring check flagged all 20 songs
  // as "Missing prompt term: progression" even though the progression was
  // genuinely disclosed. These confirm the fix accepts real disclosure
  // forms, not just the literal word.
  it('does not flag "Missing prompt term: progression" for real chord-progression disclosure without the literal word "progression"', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'warm adult contemporary pop, hook repeats chorus 4x, I-V-vi-IV money chords' }));
    expect(song.warnings.some(w => w === 'Missing prompt term: progression')).toBe(false);
  });

  it('recognizes "money chord(s)" wording alone as progression disclosure', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'warm pop, hook repeats chorus 4x, classic money chords' }));
    expect(song.warnings.some(w => w === 'Missing prompt term: progression')).toBe(false);
  });

  it('recognizes a jazz/pop chord-quality progression like "IVmaj7-iii7-vi7"', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'jazz pop, hook repeats chorus 4x, IVmaj7-iii7-vi7 movement' }));
    expect(song.warnings.some(w => w === 'Missing prompt term: progression')).toBe(false);
  });

  it('recognizes "chords in <key>" wording as progression disclosure', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'warm pop, hook repeats chorus 4x, chords in C' }));
    expect(song.warnings.some(w => w === 'Missing prompt term: progression')).toBe(false);
  });

  it('still flags a stylePrompt with no progression disclosure at all', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'warm pop, hook repeats chorus 4x, soft vocal, mid tempo' }));
    expect(song.warnings.some(w => w === 'Missing prompt term: progression')).toBe(true);
  });

  it('does not penalize "저작권 안전" as a copyright risk (Q2 regression)', () => {
    const song = scoreSong(baseSong({ stylePrompt: `${baseSong().stylePrompt}, 저작권 안전` }));
    expect(song.warnings.some(w => w.startsWith('Copyright risk'))).toBe(false);
  });

  it('does not penalize "shadow" as containing the artist name "Ado" (substring regression)', () => {
    const song = scoreSong(baseSong({ lyrics: `${baseSong().lyrics}\nevery lonely shadow` }));
    expect(song.warnings.some(w => w.startsWith('Famous artist reference risk'))).toBe(false);
  });

  it('keeps the avoid/copyright safety instruction out of the Style prompt and in a separate Exclude prompt (TASK F4, v3.7)', () => {
    const opts = makeOptions();
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).not.toContain('soundalike vocals');
    const song = scoreSong(baseSong({ stylePrompt: prompt }));
    expect(song.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(false);

    const excludePrompt = buildExcludePrompt(opts);
    expect(excludePrompt).toContain('soundalike vocals');
    expect(excludePrompt).toContain('famous artist imitation');
  });

  it('still detects a real imitation phrase like "in the style of Adele"', () => {
    const song = scoreSong(baseSong({ stylePrompt: `${baseSong().stylePrompt}, in the style of Adele` }));
    expect(song.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(true);
  });

  it('still detects a real famous-artist name as a standalone word', () => {
    const song = scoreSong(baseSong({ lyrics: `${baseSong().lyrics}\nsinging like Adele tonight` }));
    expect(song.warnings.some(w => w.startsWith('Famous artist reference risk'))).toBe(true);
  });

  // TASK v3.58 (TASK 7-7) — floor lowered 85 -> 75. quality.ts now scores a
  // style prompt's own word count (previously unchecked here — only lyrics
  // had a word-count check), and a real locally generated prompt still
  // averages well over Suno's 15-30 word sweet spot (see promptBudget.ts's
  // TASK 7-2 comment on why fully closing that gap needs a deeper,
  // deliberately-deferred rewrite of LEAD_ARRANGEMENT_NARRATIVES, not just
  // budget-target tuning). This is the intended, disclosed consequence of
  // TASK 7-7, not a false-positive regression: a verbose prompt is meant to
  // score lower now, exactly as this task's own completion criteria call for.
  it('scores a well-formed locally generated song >= 75', () => {
    const opts = makeOptions({ songCount: 1 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const [song] = scoreSongs(bp.songs, opts.channel);
    expect(song.qualityScore).toBeGreaterThanOrEqual(75);
  });

  // TASK v3.27 (Part A3) — an AI-creative title is no longer locked to a
  // mechanically-derived local string, so the title field itself needs the
  // same copyright/imitation/famous-artist scan every other field already
  // gets. collectSongText (quality.ts) already includes song.title alongside
  // stylePrompt/lyrics/youtube fields — these confirm that scan actually
  // fires when the risky text lives ONLY in the title, not elsewhere.
  it('flags artist-imitation language when it appears only in the title, not the style prompt or lyrics', () => {
    const song = scoreSong(baseSong({ title: 'In the Style of Adele' }));
    expect(song.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(true);
  });

  it('flags a real famous-artist name when it appears only in the title', () => {
    const song = scoreSong(baseSong({ title: 'Singing Like Adele Tonight' }));
    expect(song.warnings.some(w => w.startsWith('Famous artist reference risk'))).toBe(true);
  });

  it('flags copyright-risk language ("cover of") when it appears only in the title', () => {
    const song = scoreSong(baseSong({ title: 'Cover Of An Old Classic' }));
    expect(song.warnings.some(w => w.startsWith('Copyright risk'))).toBe(true);
  });
});

describe('checkHookQuality (TASK A5, v3.3)', () => {
  it('penalizes -15 when the hook appears fewer than 3 times in the lyrics', () => {
    const song = baseSong({ title: 'Hold On', hookPhrase: 'Hold On', lyrics: '[chorus]\nHold On\nsome other line' });
    const result = checkHookQuality(song);
    expect(result.penalty).toBeGreaterThanOrEqual(15);
    expect(result.warnings.some(w => w.includes('appears only'))).toBe(true);
  });

  it('TASK v3.28: applies no penalty when the title is completely independent of the hook (the intended, desired behavior now)', () => {
    const song = baseSong({
      title: 'Coffee & Frost',
      hookPhrase: 'Hold On',
      lyrics: '[chorus]\nHold On\nline\nHold On\nline\nHold On'
    });
    const result = checkHookQuality(song);
    expect(result.warnings.some(w => w.includes('does not appear in the title'))).toBe(false);
    expect(result.penalty).toBe(0);
  });

  it('applies zero penalty for a well-formed hook (short, repeats >=3x, in title, Title Case, no vocative-object pattern)', () => {
    const song = baseSong({
      title: 'Hold On',
      hookPhrase: 'Hold On',
      lyrics: '[chorus]\nHold On\nline one\nHold On\n\n[final chorus]\nHold On\nline two\nHold On'
    });
    const result = checkHookQuality(song);
    expect(result.penalty).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('penalizes a hook over 6 words', () => {
    const song = baseSong({ title: 'A Very Long Hook Phrase Right Here', hookPhrase: 'A Very Long Hook Phrase Right Here', lyrics: 'A Very Long Hook Phrase Right Here\nA Very Long Hook Phrase Right Here\nA Very Long Hook Phrase Right Here' });
    expect(checkHookQuality(song).penalty).toBeGreaterThanOrEqual(10);
  });

  it('penalizes a lowercase-starting hook', () => {
    const song = baseSong({ title: 'hold on', hookPhrase: 'hold on', lyrics: 'hold on\nhold on\nhold on' });
    expect(checkHookQuality(song).penalty).toBeGreaterThanOrEqual(5);
  });

  it('penalizes the vocative-object pattern ("Hold on, coffee")', () => {
    const song = baseSong({ title: 'Hold on, coffee', hookPhrase: 'Hold on, coffee', lyrics: 'Hold on, coffee\nHold on, coffee\nHold on, coffee' });
    expect(checkHookQuality(song).penalty).toBeGreaterThanOrEqual(12);
  });
});

// TASK v3.39 Part F — scoreSong is the single choke point every generation
// path (local, realtime, Batch API, Claude Code bridge import) funnels
// through, so the Suno artist-filter sanitizer/hook check is wired in here
// rather than duplicated per-path (see core/sunoSafety.ts).
describe('Suno artist-filter safety (v3.39 Part F)', () => {
  it('masks a known blocked token out of the final stylePrompt and warns', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'warm pop, wayo, I-V-vi-IV progression, chorus repeats' }));
    expect(song.stylePrompt.toLowerCase()).not.toContain('wayo');
    expect(song.warnings.some(w => w.includes('artist filter'))).toBe(true);
  });

  it('leaves a clean stylePrompt untouched and does not warn', () => {
    const song = scoreSong(baseSong({ stylePrompt: 'warm adult contemporary pop, strong repeated chorus hook, repeats chorus 4x, I-V-vi-IV progression' }));
    expect(song.warnings.some(w => w.includes('artist filter'))).toBe(false);
  });

  it('warns (without crashing or auto-rewriting) when hookPhrase itself contains a blocked token', () => {
    const song = scoreSong(baseSong({ hookPhrase: 'Wayo Forever', lyrics: 'Wayo Forever\nWayo Forever\nWayo Forever\nWayo Forever' }));
    expect(song.hookPhrase).toBe('Wayo Forever');
    expect(song.warnings.some(w => w.toLowerCase().includes('hook') && w.toLowerCase().includes('artist filter'))).toBe(true);
  });

  it('compactHook no longer embeds the literal hook lyric, so a hook fragment can never reach the style prompt through it', () => {
    const song = scoreSong(baseSong({ hookPhrase: 'Wayo Forever', stylePrompt: 'warm pop, strong repeated chorus hook, repeats chorus 4x, I-V-vi-IV progression' }));
    expect(song.stylePrompt.toLowerCase()).not.toContain('wayo');
  });
});
