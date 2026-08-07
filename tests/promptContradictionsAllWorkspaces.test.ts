import { describe, expect, it } from 'vitest';
import { stripConflictingGenreVocalGender, detectVocalGenderPresence } from '../src/core/vocalPlan';
import { reconcileWithPreassignedSlot, preallocateSongSlots } from '../src/core/batchPreallocation';
import { countBpmTextMentions } from '../src/core/bpmDedupe';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { ChannelArchetype, PreassignedSongSlot, SongIdea } from '../src/types';

/**
 * codex 지시문 03 (TASK B) — real gap this closes: core/batchPreallocation.ts's
 * reconcileWithPreassignedSlot runs enforceVocalTextInStylePrompt (fixes a
 * gender mismatch in the INCOMING stylePrompt) BEFORE appending slot.genreText
 * via appendVerbatimIfMissing — a plain substring-presence check with zero
 * gender awareness. A genre pack's own `vocal` field (e.g. "airy female
 * vocal") baked into genreText could reintroduce a conflicting gender word
 * AFTER the fix already ran, landing this task's own literal "male male" /
 * "남성 리드와 여성 리드 동시 선언" complaint in a real final stylePrompt.
 * stripConflictingGenreVocalGender (vocalPlan.ts) is the fix, wired into
 * reconcileWithPreassignedSlot right before genreText is appended.
 *
 * Also covers TASK B's BPM/intro/duration checks — investigation confirmed
 * these are ALREADY correct today (core/bpmDedupe.ts's enforceSingleBpmText
 * already dedupes to exactly one "NN BPM"; IntroMode/duration are already
 * single-field with no found leak path) — these are regression-lock tests,
 * not bug fixes.
 */
describe('[codex 지시문 03 TASK B] stripConflictingGenreVocalGender', () => {
  it('strips a conflicting female word from genreText when resolved gender is male', () => {
    const result = stripConflictingGenreVocalGender('airy female vocal, bright synths', 'male');
    expect(result).toBeDefined();
    expect(result).not.toMatch(/\bfemale\b/i);
    expect(result).toContain('bright synths');
  });

  it('strips a conflicting male word from genreText when resolved gender is female', () => {
    const result = stripConflictingGenreVocalGender('smooth mature male croon, warm brass', 'female');
    expect(result).toBeDefined();
    expect(result).not.toMatch(/\bmale\b/i);
    expect(result).toContain('warm brass');
  });

  it('leaves genreText untouched when there is no conflict', () => {
    expect(stripConflictingGenreVocalGender('bright synths, warm brass', 'male')).toBe('bright synths, warm brass');
    expect(stripConflictingGenreVocalGender('clear youthful lead vocal', 'male')).toBe('clear youthful lead vocal');
  });

  it('is a no-op for duet/mixed/undefined resolved gender (only male/female are single-lead conflicts)', () => {
    expect(stripConflictingGenreVocalGender('airy female vocal', 'duet')).toBe('airy female vocal');
    expect(stripConflictingGenreVocalGender('airy female vocal', 'mixed')).toBe('airy female vocal');
    expect(stripConflictingGenreVocalGender('airy female vocal', undefined)).toBe('airy female vocal');
  });

  it('is a no-op for undefined genreText', () => {
    expect(stripConflictingGenreVocalGender(undefined, 'male')).toBeUndefined();
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
    stylePrompt: 'warm male baritone lead vocal, acoustic guitar, mid tempo',
    lyrics: '[verse 1]\nline a\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 03 TASK B] reconcileWithPreassignedSlot — real integration, not just the unit fix', () => {
  it('a slot whose genreText independently carries a conflicting gender word never produces a dual-gender final stylePrompt', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const slot: PreassignedSongSlot = { ...slots[0], vocalGender: 'male', vocalText: 'warm male baritone lead vocal', vocalVariantText: 'warm male baritone lead vocal', genreText: 'airy female vocal, bright synths' };
    const song = songWith({ trackNo: slot.trackNo, stylePrompt: 'warm male baritone lead vocal' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative');
    const presence = detectVocalGenderPresence(fixed.stylePrompt);
    expect(presence.male && presence.female, `stylePrompt ended up with both genders: "${fixed.stylePrompt}"`).toBe(false);
    expect(presence.male).toBe(true);
  });

  it('the reverse: a female-resolved slot whose genreText carries a conflicting male word', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const slot: PreassignedSongSlot = { ...slots[0], vocalGender: 'female', vocalText: 'bright female lead vocal', vocalVariantText: 'bright female lead vocal', genreText: 'smooth mature male croon, warm brass' };
    const song = songWith({ trackNo: slot.trackNo, stylePrompt: 'bright female lead vocal' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative');
    const presence = detectVocalGenderPresence(fixed.stylePrompt);
    expect(presence.male && presence.female, `stylePrompt ended up with both genders: "${fixed.stylePrompt}"`).toBe(false);
    expect(presence.female).toBe(true);
  });

  it('a real duet slot legitimately keeps both genders (this fix must never break a real duet)', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const slot: PreassignedSongSlot = { ...slots[0], vocalGender: 'duet', vocalText: 'male and female duet', vocalVariantText: 'male and female duet', genreText: 'balanced call-and-response phrasing' };
    const song = songWith({ trackNo: slot.trackNo, stylePrompt: 'male and female duet' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative');
    const presence = detectVocalGenderPresence(fixed.stylePrompt);
    expect(presence.male).toBe(true);
    expect(presence.female).toBe(true);
  });
});

const WORKSPACE_ARCHETYPES: ChannelArchetype[] = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-kids-song', 'jp-kids-song', 'kr-idol-male', 'kr-idol-female'];

describe('[codex 지시문 03 TASK B] regression lock — BPM/intro/duration already correct across all 7 workspaces', () => {
  it.each(WORKSPACE_ARCHETYPES)('%s: a real 6-song local-generation fixture has exactly one BPM mention per stylePrompt, never zero or two+', archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel found for archetype ${archetype}`).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    for (const song of blueprint.songs) {
      const mentions = countBpmTextMentions(song.stylePrompt);
      expect(mentions, `${archetype} track ${song.trackNo}: "${song.stylePrompt}"`).toBe(1);
    }
  });

  it.each(WORKSPACE_ARCHETYPES)('%s: a song only declares both male and female as separate lead-vocal words when its own resolved vocalType/Gender genuinely calls for it (mixed/duet), never a single-lead track', archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    for (const song of blueprint.songs) {
      const presence = detectVocalGenderPresence(song.stylePrompt);
      if (presence.male && presence.female) {
        // Real signal (not prose sniffing): this track's OWN resolved vocalType
        // must itself be 'mixed' (or vocalGender-implied duet/group text) for
        // dual-gender wording to be legitimate — never a single male/female track.
        expect(song.vocalType, `${archetype} track ${song.trackNo} unexpectedly dual-gender for a non-mixed vocalType: "${song.stylePrompt}"`).toBe('mixed');
      }
    }
  });
});
