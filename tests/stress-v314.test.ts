import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint, rebuildStylePromptsForPersonaMode } from '../src/core/localGenerator';
import { compactMoneyChord } from '../src/core/soundSignature';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import { vocalPresets } from '../src/data/vocalPresets';
import { moneyChordPresets } from '../src/data/moneyChords';
import { getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';
import { PERSONA_STYLE_LIMIT } from '../src/core/soundSignature';
import { SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import type { GenerationOptions } from '../src/types';

const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const season = seasonPacks[0];
const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id)).slice(0, 2);

describe('v3.14 stress — DV1 preset cross-product', () => {
  it('moneyChord (8) x vocal (5) x core genre (all senior-morning core-tier) produces 0 exact stylePrompt duplicates', () => {
    const moneyChordModes = Object.keys(moneyChordPresets) as GenerationOptions['moneyChordMode'][];
    const genreIds = getCoreGenreIdsForArchetype('senior-morning');
    const prompts = new Map<string, string[]>();

    for (const moneyChordMode of moneyChordModes) {
      for (const vocal of vocalPresets) {
        for (const genreId of genreIds) {
          const genre = genrePacks.find(g => g.id === genreId);
          if (!genre) continue;
          const opts = makeOptions({
            channel,
            songCount: 1,
            genreIds: [genreId],
            moodIds: moods.map(m => m.id),
            seasonId: season.id,
            vocalTone: vocal.prompt,
            moneyChordMode,
            customMoneyChord: moneyChordMode === 'custom' ? 'I-vi-IV-V custom test' : ''
          });
          const bp = generateLocalBlueprint(opts, [genre], moods, season);
          const key = `${moneyChordMode}|${vocal.id}|${genreId}`;
          const style = bp.songs[0].stylePrompt;
          const group = prompts.get(style) ?? [];
          group.push(key);
          prompts.set(style, group);
        }
      }
    }

    const duplicateGroups = [...prompts.values()].filter(group => group.length > 1);
    expect(duplicateGroups, `duplicate stylePrompt groups: ${JSON.stringify(duplicateGroups).slice(0, 2000)}`).toEqual([]);
  }, 60000);
});

describe('v3.14 stress — DV2 extreme customMoneyChord inputs', () => {
  it('numeric-only, special-character, and empty custom input never crash compactMoneyChord', () => {
    const extremeInputs = ['12345', '!@#$%^&*()', '', '   ', 'I-V -vi', 'vii-i-IV(add9)', 'a'.repeat(500)];
    for (const input of extremeInputs) {
      const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: input });
      expect(() => compactMoneyChord(opts), `crashed on input: ${JSON.stringify(input)}`).not.toThrow();
    }
  });

  it('empty custom input falls back to the custom preset\'s own compactProgression, not a crash or the old generic fallback', () => {
    const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: '' });
    expect(compactMoneyChord(opts)).toBe(moneyChordPresets.custom.compactProgression);
  });
});

describe('v3.14 stress — DV3 regression checks', () => {
  it('v3.13 instruments/mood guaranteed-minimum floor still holds (never dropped to zero)', () => {
    const genre = genrePacks.find(g => g.id === 'jazz-pop')!;
    const opts = makeOptions({ channel, genreIds: [genre.id], moodIds: moods.map(m => m.id), seasonId: season.id });
    const bp = generateLocalBlueprint(opts, [genre], moods, season);
    const hasInstrumentWord = genre.instruments.some(instrument =>
      bp.songs[0].stylePrompt.toLowerCase().includes(instrument.toLowerCase().replace(/^(the |light |soft |warm )/, ''))
    );
    expect(hasInstrumentWord).toBe(true);
  });

  it('v3.11 opening roles (cold-open track 1, flagship tracks 2-3, normal after) are unaffected by v3.14 changes', () => {
    const genre = genrePacks.find(g => g.id === 'adult-contemporary')!;
    const opts = makeOptions({ channel, songCount: 5, genreIds: [genre.id], moodIds: moods.map(m => m.id), seasonId: season.id });
    const bp = generateLocalBlueprint(opts, [genre], moods, season);
    expect(bp.songs[0].songRole).toBe('cold-open');
    expect(bp.songs[1].songRole).toBe('flagship');
    expect(bp.songs[2].songRole).toBe('flagship');
    expect(bp.songs[3].songRole).not.toBe('cold-open');
    expect(bp.songs[3].songRole).not.toBe('flagship');
  });

  it('personaMode style prompts stay within both the 200-char legacy and 1000-char standard limits after the moneyChord/genre changes', () => {
    const genre = genrePacks.find(g => g.id === 'showa-modern')!;
    const showaChannel = { ...channel, archetype: 'showa-cafe' as const };
    const opts = makeOptions({
      channel: showaChannel,
      songCount: 3,
      genreIds: [genre.id],
      moodIds: moods.map(m => m.id),
      seasonId: season.id,
      moneyChordMode: 'showaModern',
      personaMode: false
    });
    const bp = generateLocalBlueprint(opts, [genre], moods, season);
    const persona200 = rebuildStylePromptsForPersonaMode(bp, { ...opts, personaMode: true }, [genre], moods, season, PERSONA_STYLE_LIMIT);
    const persona1000 = rebuildStylePromptsForPersonaMode(bp, { ...opts, personaMode: true }, [genre], moods, season, SUNO_COPY_LIMIT);
    for (const song of persona200.songs) expect(song.stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
    for (const song of persona1000.songs) expect(song.stylePrompt.length).toBeLessThanOrEqual(SUNO_COPY_LIMIT);
  });
});
