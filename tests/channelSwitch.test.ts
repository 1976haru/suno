import { describe, expect, it } from 'vitest';
import { reconcileOptionsForChannelSwitch } from '../src/core/channelSwitch';
import { makeOptions, channelPresets } from './fixtures';
import { getGenreById, isGenreEligibleForArchetype } from '../src/data/genreLibrary';
import { replaceAxisAllocation } from '../src/core/diversityAllocation';
import type { GenerationChoiceProvenance } from '../src/types';

const seniorChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const oldpopChannel = channelPresets.find(c => c.id === 'oldpop-lounge-main')!;
const kridolChannel = channelPresets.find(c => c.archetype === 'kr-idol-male')!;

// Guaranteed-eligible/ineligible ids for the assertions below, computed from
// the real predicate rather than hardcoded — self-consistent even if the
// preset data changes.
const seniorOnlyGenreId = seniorChannel.preferredGenres.find(id => {
  const g = getGenreById(id);
  return g && isGenreEligibleForArchetype(g, 'senior-morning') && !isGenreEligibleForArchetype(g, 'kr-idol-male');
})!;
const kridolOnlyGenreId = kridolChannel.preferredGenres.find(id => {
  const g = getGenreById(id);
  return g && isGenreEligibleForArchetype(g, 'kr-idol-male') && !isGenreEligibleForArchetype(g, 'senior-morning');
})!;
const sharedSeniorOldpopGenreId = seniorChannel.preferredGenres.find(id => {
  const g = getGenreById(id);
  return g && isGenreEligibleForArchetype(g, 'senior-morning') && isGenreEligibleForArchetype(g, 'oldpop-lounge');
})!;

const defaultProvenance: GenerationChoiceProvenance = {
  moneyChordMode: 'default', vocalTone: 'default', genreIds: 'default', lyricLanguage: 'default',
  packagingLanguage: 'default', perspective: 'default', perspectiveMode: 'default', genreBlendMode: 'default',
  seasonId: 'default', songCount: 'default', breadth: 'default', paletteFamilyId: 'default', kidsAgeTierId: 'default',
  moodIds: 'default', durationTarget: 'default', lyricDepth: 'default', hookMode: 'default', referenceMood: 'default',
  negativeStyle: 'default'
} as GenerationChoiceProvenance;

describe('reconcileOptionsForChannelSwitch (Fable5 1단계 TASK E)', () => {
  it('resets channel-owned fields (market/audience/vocalTone/kidsAgeTierId/moodIds/packagingLanguage) to the new channel\'s own defaults', () => {
    const prev = makeOptions({ channel: seniorChannel, vocalTone: 'some old vocal tone', moodIds: ['nostalgic'] });
    const { opts } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.channel).toBe(oldpopChannel);
    expect(opts.market).toBe(oldpopChannel.market);
    expect(opts.audience).toBe(oldpopChannel.audience);
    expect(opts.vocalTone).toBe(oldpopChannel.defaultVocal);
    expect(opts.moodIds).toEqual(oldpopChannel.preferredMoods);
    expect(opts.choiceProvenance?.vocalTone).toBe('channel');
    expect(opts.choiceProvenance?.moodIds).toBe('channel');
  });

  it('keeps a user-picked genre selection verbatim when every id is still valid on the new channel (E-2 "유지")', () => {
    const prev = makeOptions({
      channel: seniorChannel,
      genreIds: [sharedSeniorOldpopGenreId],
      choiceProvenance: { ...defaultProvenance, genreIds: 'user' }
    });
    const { opts, changesKo } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.genreIds).toEqual([sharedSeniorOldpopGenreId]);
    expect(opts.choiceProvenance?.genreIds).toBe('user');
    expect(changesKo.some(c => c.includes('장르'))).toBe(false);
  });

  it('keeps only the still-valid subset and reports the drop when a user pick is partially invalid on the new channel (E-2 "제거+알림")', () => {
    const prev = makeOptions({
      channel: seniorChannel,
      genreIds: [seniorOnlyGenreId, kridolOnlyGenreId],
      choiceProvenance: { ...defaultProvenance, genreIds: 'user' }
    });
    const { opts, changesKo } = reconcileOptionsForChannelSwitch(prev, seniorChannel, false);
    expect(opts.genreIds).toContain(seniorOnlyGenreId);
    expect(opts.genreIds).not.toContain(kridolOnlyGenreId);
    expect(opts.choiceProvenance?.genreIds).toBe('user');
    expect(changesKo.some(c => c.includes(kridolOnlyGenreId))).toBe(true);
  });

  it('falls back to the new channel\'s own defaults and resets provenance when every user-picked genre is invalid there (E-2 "초기화")', () => {
    const prev = makeOptions({
      channel: kridolChannel,
      genreIds: [kridolOnlyGenreId],
      choiceProvenance: { ...defaultProvenance, genreIds: 'user' }
    });
    const { opts } = reconcileOptionsForChannelSwitch(prev, seniorChannel, false);
    expect(opts.genreIds.length).toBeGreaterThan(0);
    expect(opts.genreIds).not.toContain(kridolOnlyGenreId);
    expect(opts.choiceProvenance?.genreIds).toBe('channel');
  });

  it('always resets genreIds to the new channel default when the previous pick was not provenance \'user\' (초기화, unchanged from prior behavior)', () => {
    const prev = makeOptions({
      channel: seniorChannel,
      genreIds: [kridolOnlyGenreId],
      choiceProvenance: { ...defaultProvenance, genreIds: 'channel' }
    });
    const { opts } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.choiceProvenance?.genreIds).toBe('channel');
    // resolves from the new channel's own preferredGenres, not the previous pick
    expect(opts.genreIds).not.toContain(kridolOnlyGenreId);
    expect(opts.genreIds.length).toBeGreaterThan(0);
  });

  it('drops diversityAllocations\' manual genre-axis counts for ids no longer valid, keeps the rest, and notifies', () => {
    const prev = makeOptions({
      channel: seniorChannel,
      genreIds: [seniorOnlyGenreId],
      choiceProvenance: { ...defaultProvenance, genreIds: 'user' },
      diversityAllocations: replaceAxisAllocation(undefined, {
        axis: 'genre',
        mode: 'manual',
        counts: { [seniorOnlyGenreId]: 10, [kridolOnlyGenreId]: 8 }
      })
    });
    const { opts, changesKo } = reconcileOptionsForChannelSwitch(prev, seniorChannel, false);
    const genreAxis = opts.diversityAllocations?.find(a => a.axis === 'genre');
    expect(genreAxis?.counts[seniorOnlyGenreId]).toBe(10);
    expect(genreAxis?.counts[kridolOnlyGenreId]).toBeUndefined();
    expect(changesKo.some(c => c.includes('곡수 배분'))).toBe(true);
  });

  it('leaves non-genre diversityAllocations axes untouched', () => {
    const vocalTypeAlloc = replaceAxisAllocation(undefined, { axis: 'vocalType', mode: 'manual', counts: { male: 6, female: 6 } });
    const prev = makeOptions({ channel: seniorChannel, diversityAllocations: vocalTypeAlloc });
    const { opts } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.diversityAllocations?.find(a => a.axis === 'vocalType')?.counts).toEqual({ male: 6, female: 6 });
  });

  it('drops a selectedGenreFamilyIds entry with zero eligible members on the new channel, notifying once', () => {
    const prev = makeOptions({ channel: seniorChannel, selectedGenreFamilyIds: ['chanson-continental'] });
    const { opts, changesKo } = reconcileOptionsForChannelSwitch(prev, kridolChannel, false);
    expect(opts.selectedGenreFamilyIds).toEqual([]);
    expect(changesKo.some(c => c.includes('장르 계열'))).toBe(true);
  });

  it('keeps a selectedGenreFamilyIds entry that still has an eligible member', () => {
    const prev = makeOptions({ channel: seniorChannel, selectedGenreFamilyIds: ['chanson-continental'] });
    const { opts } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.selectedGenreFamilyIds).toEqual(['chanson-continental']);
  });

  it('drops genreBlendWeights entries for genre ids no longer selected', () => {
    const prev = makeOptions({
      channel: seniorChannel,
      genreIds: [seniorOnlyGenreId],
      choiceProvenance: { ...defaultProvenance, genreIds: 'user' },
      genreBlendWeights: { [seniorOnlyGenreId]: 70, [kridolOnlyGenreId]: 30 }
    });
    const { opts } = reconcileOptionsForChannelSwitch(prev, seniorChannel, false);
    expect(opts.genreBlendWeights).toEqual({ [seniorOnlyGenreId]: 70 });
  });

  it('never silently clears listeningIntent — keeps the value and surfaces a recompute notice', () => {
    const prev = makeOptions({ channel: seniorChannel, listeningIntent: 'reflective-long-play' as never });
    const { opts, changesKo } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.listeningIntent).toBe('reflective-long-play');
    expect(changesKo.some(c => c.includes('청취 목적'))).toBe(true);
  });

  it('says nothing about listeningIntent when it was never set', () => {
    const prev = makeOptions({ channel: seniorChannel });
    const { changesKo } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(changesKo.some(c => c.includes('청취 목적'))).toBe(false);
  });

  it('keeps the user\'s lyricLanguage and records it in changesKo when the caller resolves keepUserLanguage=true', () => {
    const prev = makeOptions({ channel: seniorChannel, lyricLanguage: 'english', choiceProvenance: { ...defaultProvenance, lyricLanguage: 'user' } });
    const { opts, changesKo } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, true);
    expect(opts.lyricLanguage).toBe('english');
    expect(opts.choiceProvenance?.lyricLanguage).toBe('user');
    expect(changesKo.some(c => c.includes('언어 설정'))).toBe(true);
  });

  it('resets lyricLanguage to the new channel default when keepUserLanguage=false', () => {
    const prev = makeOptions({ channel: seniorChannel, lyricLanguage: 'english', choiceProvenance: { ...defaultProvenance, lyricLanguage: 'user' } });
    const { opts } = reconcileOptionsForChannelSwitch(prev, oldpopChannel, false);
    expect(opts.lyricLanguage).toBe(oldpopChannel.primaryLanguage);
    expect(opts.choiceProvenance?.lyricLanguage).toBe('channel');
  });
});
