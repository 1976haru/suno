/**
 * v5.11 (TASK L) — SongIdea.effectiveMoneyChordId/effectiveVocalPresetId/
 * effectiveGenreIds/effectiveArchetype/workspaceId: always-populated "what
 * actually went into this song" fields, closing a real, verified gap —
 * `moneyChordId` only ever got set during the per-song quota/rotation plan
 * (core/moneyChordPlan.ts's usesMoneyChordQuota/usesUserChosenProgressionPlan);
 * a song generated under a FIXED single money-chord preset (an explicit
 * moneyChordMode with no rotation — moneyChordModeIsExplicitChoice left
 * false/unset, the pre-v5.7 "older/API caller that hasn't migrated" shape
 * that file's own doc comment describes) still had a real progression
 * applied via core/soundSignature.ts's compactMoneyChord, but nothing ever
 * surfaced which id that was on the song itself.
 *
 * See types.ts's SongIdea doc comments on each field, and
 * core/soundSignature.ts's resolveEffectiveMoneyChordId (the function both
 * real generation paths now call to populate effectiveMoneyChordId).
 */
import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { usesMoneyChordQuota, usesUserChosenProgressionPlan } from '../src/core/moneyChordPlan';
import { sanitizeGenreIdsForArchetype } from '../src/core/genreSelection';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

function genresFor(opts: GenerationOptions) {
  return genrePacks.filter(g => opts.genreIds.includes(g.id));
}
function moodsFor(opts: GenerationOptions) {
  return moodPacks.filter(m => opts.moodIds.includes(m.id));
}

/** Same minimal "well-formed synthetic model response" shape tests/workspaceContractMatrix.test.ts's own syntheticModelSong uses, kept local here (that file is owned by another task and is explicitly not to be imported from/modified). */
function syntheticModelSong(slot: PreassignedSongSlot): SongIdea {
  return {
    trackNo: slot.trackNo,
    title: slot.title,
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: slot.emotionArc,
    hookPhrase: slot.hookPhrase,
    stylePrompt: [slot.genreText, slot.vocalText, slot.moneyChordText, `${slot.tempo} BPM`].filter(Boolean).join(', '),
    lyrics: '[verse 1]\na placeholder verse line\n\n[chorus]\n' + slot.hookPhrase,
    youtube: { title: slot.title, description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    // Deliberately NOT set here — reconcileWithPreassignedSlot is the thing
    // under test; it must populate these from `slot`, not trust the model's
    // raw (never-provided) output.
    effectiveMoneyChordId: '',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop'
  };
}

// ---------------------------------------------------------------------------
// (a) the exact gap being closed: a FIXED single money-chord preset (no
// per-song rotation) — before this task, moneyChordId stayed undefined on
// every song for this exact scenario, even though a real progression was
// genuinely applied. This test would have failed before the fix (asserting
// a truthy, correct effectiveMoneyChordId where the old code path had
// nothing to read).
// ---------------------------------------------------------------------------

describe('[v5.11 TASK L] effectiveMoneyChordId — FIXED single money-chord preset (no rotation)', () => {
  const opts = makeOptions({
    songCount: 6,
    moneyChordMode: 'jazzColor',
    // Explicitly NOT set to true — this is the "older/API caller that
    // hasn't migrated" shape moneyChordPlan.ts's usesMoneyChordQuota doc
    // comment names: a real explicit pick with no per-song rotation.
    moneyChordModeIsExplicitChoice: false
  });

  it('sanity check: this scenario genuinely has no per-song rotation plan active', () => {
    expect(usesMoneyChordQuota(opts)).toBe(false);
    expect(usesUserChosenProgressionPlan(opts)).toBe(false);
  });

  it('generateLocalBlueprint: moneyChordId stays unset (the pre-existing, still-true fact for this scenario) but effectiveMoneyChordId is always the real applied id', () => {
    const blueprint = generateLocalBlueprint(opts, genresFor(opts), moodsFor(opts), testSeason);
    expect(blueprint.songs).toHaveLength(6);
    for (const song of blueprint.songs) {
      expect(song.moneyChordId).toBeUndefined();
      expect(song.effectiveMoneyChordId).toBe('jazzColor');
    }
  });

  it('batch path (preallocateSongSlots + reconcileWithPreassignedSlot) agrees exactly with the local path', () => {
    const slots = preallocateSongSlots(opts, genresFor(opts));
    expect(slots).toHaveLength(6);
    for (const slot of slots) {
      expect(slot.moneyChordId).toBeUndefined();
      expect(slot.effectiveMoneyChordId).toBe('jazzColor');
    }
    const songs = slots.map(slot => reconcileWithPreassignedSlot(syntheticModelSong(slot), slot, 'ai-creative', { archetype: opts.channel.archetype, keepHook: true, keepEmotionArc: true }));
    for (const song of songs) {
      expect(song.effectiveMoneyChordId).toBe('jazzColor');
    }
  });
});

// ---------------------------------------------------------------------------
// (b) all 5 fields populated for both a kids channel and a senior/adult
// channel, via real generation (generateLocalBlueprint).
// ---------------------------------------------------------------------------

describe('[v5.11 TASK L] all 5 "effective" fields populated via real generation', () => {
  const KIDS_CHANNEL_ID = 'follow-along-action-song'; // kr-kids-song archetype (kr-kids workspace)
  const SENIOR_CHANNEL_ID = 'good-morning-memory-radio'; // senior-morning archetype (senior-oldpop workspace)

  function assertAllFieldsPopulated(label: string, songs: SongIdea[], expectedArchetype: string, expectedWorkspaceId: string) {
    expect(songs.length, `${label}: no songs generated`).toBeGreaterThan(0);
    for (const song of songs) {
      expect(typeof song.effectiveMoneyChordId, `${label} T${song.trackNo}: effectiveMoneyChordId`).toBe('string');
      expect(song.effectiveMoneyChordId.length, `${label} T${song.trackNo}: effectiveMoneyChordId non-empty`).toBeGreaterThan(0);

      expect(Array.isArray(song.effectiveGenreIds), `${label} T${song.trackNo}: effectiveGenreIds is an array`).toBe(true);
      expect(song.effectiveGenreIds.length, `${label} T${song.trackNo}: effectiveGenreIds non-empty`).toBeGreaterThan(0);
      // Every id must actually be valid for this archetype — reuses the same
      // sanitizer the field itself is built from, so this is a genuine
      // re-check, not a tautology against the same call.
      const { removed } = sanitizeGenreIdsForArchetype(song.effectiveGenreIds, expectedArchetype as GenerationOptions['channel']['archetype']);
      expect(removed, `${label} T${song.trackNo}: every effectiveGenreIds entry is valid for ${expectedArchetype}`).toEqual([]);

      expect(song.effectiveArchetype, `${label} T${song.trackNo}: effectiveArchetype`).toBe(expectedArchetype);
      expect(song.workspaceId, `${label} T${song.trackNo}: workspaceId`).toBe(expectedWorkspaceId);

      // effectiveVocalPresetId is genuinely optional (undefined is correct
      // whenever no discrete preset applies — see its own SongIdea doc
      // comment) — only assert it's a string WHEN present, never require it.
      if (song.effectiveVocalPresetId !== undefined) {
        expect(typeof song.effectiveVocalPresetId, `${label} T${song.trackNo}: effectiveVocalPresetId, when present, is a string`).toBe('string');
      }
    }
  }

  it('kr-kids channel: all 5 fields populated (4 required + effectiveVocalPresetId attempted)', () => {
    const channel = channelPresets.find(c => c.id === KIDS_CHANNEL_ID);
    expect(channel, `fixture channel ${KIDS_CHANNEL_ID} must exist`).toBeTruthy();
    const opts = makeOptions({ channel, songCount: 8, genreIds: channel!.preferredGenres, moodIds: channel!.preferredMoods, vocalTone: channel!.defaultVocal, lyricLanguage: 'korean' });
    const blueprint = generateLocalBlueprint(opts, genresFor(opts), moodsFor(opts), testSeason);
    assertAllFieldsPopulated('kr-kids', blueprint.songs, channel!.archetype!, 'kr-kids');
  });

  it('senior/adult channel: all 5 fields populated (4 required + effectiveVocalPresetId attempted)', () => {
    const channel = channelPresets.find(c => c.id === SENIOR_CHANNEL_ID);
    expect(channel, `fixture channel ${SENIOR_CHANNEL_ID} must exist`).toBeTruthy();
    const opts = makeOptions({ channel, songCount: 8, genreIds: channel!.preferredGenres, moodIds: channel!.preferredMoods, vocalTone: channel!.defaultVocal });
    const blueprint = generateLocalBlueprint(opts, genresFor(opts), moodsFor(opts), testSeason);
    assertAllFieldsPopulated('senior-oldpop', blueprint.songs, channel!.archetype!, 'senior-oldpop');
  });

  it('senior/adult channel with an explicit single vocal preset pick: effectiveVocalPresetId resolves to a real id', () => {
    const channel = channelPresets.find(c => c.id === SENIOR_CHANNEL_ID)!;
    const opts = makeOptions({
      channel,
      songCount: 4,
      genreIds: channel.preferredGenres,
      moodIds: channel.preferredMoods,
      // A real vocalPresets.ts prompt string, verbatim — see
      // data/vocalPresets.ts's matchVocalPreset (exact-match lookup).
      vocalTone: 'low calm male baritone, restrained emotional delivery, warm late-night tone'
    });
    const blueprint = generateLocalBlueprint(opts, genresFor(opts), moodsFor(opts), testSeason);
    for (const song of blueprint.songs) {
      expect(song.effectiveVocalPresetId, `T${song.trackNo}: effectiveVocalPresetId`).toBe('low-calm-male');
    }
  });

  it('batch path (preallocateSongSlots + reconcileWithPreassignedSlot) also populates all 5 fields for both channels', () => {
    for (const [channelId, workspaceId] of [[KIDS_CHANNEL_ID, 'kr-kids'], [SENIOR_CHANNEL_ID, 'senior-oldpop']] as const) {
      const channel = channelPresets.find(c => c.id === channelId)!;
      const opts = makeOptions({ channel, songCount: 6, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods, vocalTone: channel.defaultVocal });
      const slots = preallocateSongSlots(opts, genresFor(opts));
      const songs = slots.map(slot => reconcileWithPreassignedSlot(syntheticModelSong(slot), slot, 'ai-creative', { archetype: opts.channel.archetype, keepHook: true, keepEmotionArc: true }));
      assertAllFieldsPopulated(`batch/${channelId}`, songs, channel.archetype!, workspaceId);
    }
  });
});
