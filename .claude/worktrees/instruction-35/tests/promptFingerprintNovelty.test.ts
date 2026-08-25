import { describe, expect, it } from 'vitest';
import { buildArrangementRecipe, buildPromptFingerprint, hasModulationSignal, tempoBandLabel } from '../src/core/promptFingerprint';
import { isDuplicateArrangementRecipe, isDuplicateFingerprint } from '../src/core/promptFingerprintLedger';
import { reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testGenres } from './fixtures';
import type { PreassignedSongSlot, SongIdea } from '../src/types';

/**
 * codex 지시문 02 (TASK K) — real, confirmed gap this closes: nothing
 * tracked whether a song's overall STRUCTURAL recipe (genre + tempo band +
 * vocal type + intro mode + progression + hook device + modulation +
 * density) had already been used recently — two tracks with completely
 * different titles/hooks/scenes could still be functionally the same song
 * and no existing ledger (hookLedger/situationLedger/lyricLineLedger) would
 * ever catch it. See src/core/promptFingerprint.ts's own doc comment for
 * the full design (why "modulation" is derived from real moneyChord prose
 * rather than fabricated as a structured field, why arrangement recipe is a
 * narrower/looser 3-axis subset with its own shorter window).
 */
function slot(overrides: Partial<PreassignedSongSlot> = {}): PreassignedSongSlot {
  return {
    trackNo: 1,
    title: 'T',
    hookPhrase: 'H',
    songRole: 'standard',
    tempo: 92,
    emotionArc: 'x',
    moneyChordText: 'I-V-vi-IV progression',
    genreId: 'oldpop-soft-rock-am',
    vocalType: 'male',
    introMode: 'vocal-immediate',
    moneyChordId: 'money-1',
    hookDeviceId: 'hook-device-1',
    arrangementDensity: 'medium',
    instrumentSet: ['acoustic guitar', 'piano'],
    ...overrides
  };
}

describe('[codex 지시문 02 TASK K] hasModulationSignal', () => {
  it('detects the word "modulation" in real moneyChord prose', () => {
    expect(hasModulationSignal('gentle key-up half-step modulation on the final chorus only')).toBe(true);
  });

  it('detects a key-up/half-step phrase without the literal word "modulation"', () => {
    expect(hasModulationSignal('half-step lift into the final chorus')).toBe(true);
  });

  it('is false for ordinary chord-progression text with no modulation signal', () => {
    expect(hasModulationSignal('I-V-vi-IV verse progression, gentle build')).toBe(false);
  });

  it('is false when there is no text at all', () => {
    expect(hasModulationSignal(undefined)).toBe(false);
  });
});

describe('[codex 지시문 02 TASK K] tempoBandLabel', () => {
  it('buckets into a fixed 10-BPM decade band', () => {
    expect(tempoBandLabel(92)).toBe('90s');
    expect(tempoBandLabel(99)).toBe('90s');
    expect(tempoBandLabel(100)).toBe('100s');
  });

  it('is a stable "?" placeholder for a missing/non-finite tempo', () => {
    expect(tempoBandLabel(undefined)).toBe('?');
    expect(tempoBandLabel(NaN)).toBe('?');
  });
});

describe('[codex 지시문 02 TASK K] buildPromptFingerprint / buildArrangementRecipe', () => {
  it('two slots with identical structural axes produce the identical fingerprint', () => {
    const a = slot({ trackNo: 1 });
    const b = slot({ trackNo: 2 });
    expect(buildPromptFingerprint(a)).toBe(buildPromptFingerprint(b));
  });

  it('changing just one axis (genre) changes the fingerprint', () => {
    const a = slot();
    const b = slot({ genreId: 'oldpop-motown-pop-soul' });
    expect(buildPromptFingerprint(a)).not.toBe(buildPromptFingerprint(b));
  });

  it('changing only the lyric scene/hook/title never changes the fingerprint (those are not structural axes)', () => {
    const a = slot({ title: 'Song A', hookPhrase: 'Hook A', lyricThemeText: 'scene A' });
    const b = slot({ title: 'Song B', hookPhrase: 'Hook B', lyricThemeText: 'scene B' });
    expect(buildPromptFingerprint(a)).toBe(buildPromptFingerprint(b));
  });

  it('arrangement recipe ignores order of instrumentSet (sorted before joining)', () => {
    const a = slot({ instrumentSet: ['piano', 'acoustic guitar'] });
    const b = slot({ instrumentSet: ['acoustic guitar', 'piano'] });
    expect(buildArrangementRecipe(a)).toBe(buildArrangementRecipe(b));
  });

  it('arrangement recipe is a narrower key than the full fingerprint — two slots differing only in genre/vocal still recipe-match', () => {
    const a = slot({ genreId: 'oldpop-soft-rock-am', vocalType: 'male' });
    const b = slot({ genreId: 'oldpop-motown-pop-soul', vocalType: 'female' });
    expect(buildPromptFingerprint(a)).not.toBe(buildPromptFingerprint(b));
    expect(buildArrangementRecipe(a)).toBe(buildArrangementRecipe(b));
  });
});

describe('[codex 지시문 02 TASK K] isDuplicateFingerprint / isDuplicateArrangementRecipe', () => {
  it('flags a fingerprint present in the recent list', () => {
    expect(isDuplicateFingerprint('a|b|c', ['x', 'a|b|c', 'y'])).toBe(true);
  });

  it('does not flag a fingerprint absent from the recent list', () => {
    expect(isDuplicateFingerprint('a|b|c', ['x', 'y'])).toBe(false);
  });

  it('is a no-op for an undefined fingerprint', () => {
    expect(isDuplicateFingerprint(undefined, ['a|b|c'])).toBe(false);
  });

  it('same behavior for arrangement recipes', () => {
    expect(isDuplicateArrangementRecipe('r1', ['r1'])).toBe(true);
    expect(isDuplicateArrangementRecipe('r1', ['r2'])).toBe(false);
  });
});

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song 1',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hook',
    stylePrompt: 'warm acoustic pop, mid tempo, 92 BPM',
    lyrics: '[verse 1]\nline a\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 02 TASK K] reconcileWithPreassignedSlot attaches promptFingerprint/arrangementRecipe', () => {
  it('a real generation-path slot produces a non-empty fingerprint on the final SongIdea', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const song = songWith({ trackNo: slots[0].trackNo });
    const fixed = reconcileWithPreassignedSlot(song, slots[0], 'ai-creative');
    expect(fixed.promptFingerprint).toBeDefined();
    expect(fixed.promptFingerprint).toBe(buildPromptFingerprint(slots[0]));
    expect(fixed.arrangementRecipe).toBeDefined();
    expect(fixed.arrangementRecipe).toBe(buildArrangementRecipe(slots[0]));
  });

  it('is undefined for a song reconciled with no matching slot (agent-invented extra track)', () => {
    const fixed = reconcileWithPreassignedSlot(songWith({ trackNo: 99 }), undefined, 'ai-creative');
    expect(fixed.promptFingerprint).toBeUndefined();
    expect(fixed.arrangementRecipe).toBeUndefined();
  });
});
