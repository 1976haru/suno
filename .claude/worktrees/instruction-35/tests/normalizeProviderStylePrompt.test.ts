import { describe, expect, it } from 'vitest';
import { normalizeProviderStylePrompt, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import type { PreassignedSongSlot, SongIdea } from '../src/types';

/**
 * 지시문 10 (TASK D) — normalizeProviderStylePrompt was extracted, unchanged,
 * from an inline sequence inside reconcileWithPreassignedSlot (see that
 * function's own doc comment for the full "why a named function" reasoning).
 * These tests lock in that it still enforces the same locked fields
 * (tempo/vocal/instrument set) on provider-written prose, and that
 * reconcileWithPreassignedSlot now preserves the untouched incoming text as
 * rawProviderStylePrompt debug metadata whenever normalization actually
 * changed something.
 */
function slotFor(overrides: Partial<PreassignedSongSlot>): PreassignedSongSlot {
  return {
    trackNo: 1,
    title: 'Title',
    hookPhrase: 'Hook',
    songRole: 'core',
    tempo: 90,
    emotionArc: 'steady',
    moneyChordText: '',
    ...overrides
  };
}

function songFor(overrides: Partial<SongIdea>): SongIdea {
  return {
    trackNo: 1,
    title: 'Title',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: 'steady',
    hookPhrase: 'Hook',
    stylePrompt: '',
    lyrics: '[Verse]\nline one\n[Chorus]\nline two',
    youtube: { title: '', description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('지시문 10 TASK D — normalizeProviderStylePrompt', () => {
  it('wrong BPM in provider prose gets replaced with the slot\'s locked tempo', () => {
    const slot = slotFor({ tempo: 96 });
    const result = normalizeProviderStylePrompt('warm acoustic pop, 80 BPM', slot);
    expect(result).toContain('96 BPM');
    expect(result).not.toContain('80 BPM');
  });

  it('missing tempo gets appended', () => {
    const slot = slotFor({ tempo: 96 });
    const result = normalizeProviderStylePrompt('warm acoustic pop', slot);
    expect(result).toContain('96 BPM');
  });

  it('a missing locked instrument gets appended', () => {
    const slot = slotFor({ tempo: 90, instrumentSet: ['nylon guitar', 'soft brushed drums'] });
    const result = normalizeProviderStylePrompt('warm acoustic pop, 90 BPM', slot);
    expect(result.toLowerCase()).toContain('nylon guitar');
    expect(result.toLowerCase()).toContain('soft brushed drums');
  });

  it('an already-complete prompt is returned with no spurious changes to its locked fields', () => {
    const slot = slotFor({ tempo: 90 });
    const input = 'warm acoustic pop, 90 BPM';
    const result = normalizeProviderStylePrompt(input, slot);
    expect(result).toContain('90 BPM');
    expect((result.match(/\d+\s*BPM/gi) ?? []).length).toBe(1);
  });
});

describe('지시문 10 TASK D — reconcileWithPreassignedSlot rawProviderStylePrompt', () => {
  it('preserves the untouched provider text when normalization changes the BPM', () => {
    const slot = slotFor({ tempo: 96, vocalText: '', instrumentSet: [] });
    const song = songFor({ stylePrompt: 'warm acoustic pop, 80 BPM', vocalType: undefined });
    const result = reconcileWithPreassignedSlot(song, slot);
    expect(result.rawProviderStylePrompt).toBe('warm acoustic pop, 80 BPM');
    expect(result.stylePrompt).not.toBe(result.rawProviderStylePrompt);
    expect(result.stylePrompt).toContain('96 BPM');
  });

  it('omits rawProviderStylePrompt when normalization made no change (nothing to debug)', () => {
    const slot = slotFor({ tempo: 90, vocalText: '', instrumentSet: [] });
    const song = songFor({ stylePrompt: 'warm acoustic pop, 90 BPM' });
    const result = reconcileWithPreassignedSlot(song, slot);
    expect(result.stylePrompt).toBe(result.rawProviderStylePrompt ?? result.stylePrompt);
    expect(result.rawProviderStylePrompt).toBeUndefined();
  });
});

describe('지시문 10 TASK C — reconcileWithPreassignedSlot excludePrompt genre differentiation', () => {
  it('appends this track\'s own genre avoidTraits when missing from the provider excludePrompt', () => {
    // oldpop-warm-morning-glow's real avoidTraits: ['busy percussion', 'bright harsh top end']
    const slot = slotFor({ genreId: 'oldpop-warm-morning-glow' });
    const song = songFor({ excludePrompt: 'famous artist imitation, copied melodies' });
    const result = reconcileWithPreassignedSlot(song, slot);
    expect(result.excludePrompt?.toLowerCase()).toContain('busy percussion');
    expect(result.excludePrompt?.toLowerCase()).toContain('bright harsh top end');
    expect(result.excludePrompt?.toLowerCase()).toContain('famous artist imitation');
  });

  it('two tracks with different genres get different excludePrompt text', () => {
    const songA = songFor({ excludePrompt: 'famous artist imitation, copied melodies' });
    const songB = songFor({ trackNo: 2, excludePrompt: 'famous artist imitation, copied melodies' });
    const resultA = reconcileWithPreassignedSlot(songA, slotFor({ trackNo: 1, genreId: 'oldpop-warm-morning-glow' }));
    const resultB = reconcileWithPreassignedSlot(songB, slotFor({ trackNo: 2, genreId: 'oldpop-piano-ballad-70s' }));
    expect(resultA.excludePrompt).not.toBe(resultB.excludePrompt);
  });

  it('never drops what the provider already wrote (purely additive)', () => {
    const slot = slotFor({ genreId: 'oldpop-warm-morning-glow' });
    const song = songFor({ excludePrompt: 'a very specific provider-written term' });
    const result = reconcileWithPreassignedSlot(song, slot);
    expect(result.excludePrompt?.toLowerCase()).toContain('a very specific provider-written term');
  });

  it('a slot with no genreId leaves excludePrompt untouched by this step', () => {
    const slot = slotFor({ genreId: undefined });
    const song = songFor({ excludePrompt: 'famous artist imitation' });
    const result = reconcileWithPreassignedSlot(song, slot);
    expect(result.excludePrompt).toBe('famous artist imitation');
  });
});
