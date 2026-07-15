import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { hookStyleDirectives } from '../src/core/promptComposer';
import { composeStylePrompt, SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { MAX_SELECTED_GENRES, normalizeGenreSelection, toggleGenreSelection } from '../src/core/genreSelection';
import {
  genreLibrary,
  getCoreGenresForArchetype,
  getVisibleGenresForArchetype,
  importedGenreCount,
  searchExtendedGenres,
  searchHiddenGenresForArchetype,
  totalGenreCount
} from '../src/data/genreLibrary';
import { genrePacks } from '../src/data/presets';
import { makeOptions, testMoods, testSeason } from './fixtures';

const LEGACY_IDS = [
  'adult-contemporary',
  'acoustic-pop',
  'jazz-pop',
  'showa-modern',
  'city-pop-soft',
  'lofi-cafe',
  'christmas-soft-pop',
  'healing-ballad',
  'folk-pop',
  'bossa-cafe',
  'soft-rock',
  'piano-ballad',
  'retro-soul-pop',
  'synthwave-mellow'
];

const forbiddenStyleTerms = /\b(visualIdentity|typography|thumbnail|font|logo|cover art|image prompt)\b/i;
const forbiddenImitationTerms = /\b(in the style of|sounds like|as sung by|voice like|clone of|copy of|cover of|rewrite of|melody from|lyrics from)\b/i;
const famousArtistNames = /\b(adele|beatles|beyonce|bts|bruno mars|celine dion|ed sheeran|iu|queen|taylor swift|the weeknd|yoasobi|utada)\b/i;

function promptAtoms(prompt: string) {
  return prompt.split(',').map(atom => atom.trim().toLowerCase()).filter(Boolean);
}

describe('structured genre library', () => {
  it('adds 250 Notion-derived genres and keeps legacy genre ids available', () => {
    expect(importedGenreCount).toBe(250);
    expect(totalGenreCount).toBe(genreLibrary.length);
    expect(genrePacks.length).toBe(LEGACY_IDS.length + importedGenreCount);

    const presetIds = new Set(genrePacks.map(genre => genre.id));
    for (const id of LEGACY_IDS) expect(presetIds.has(id), id).toBe(true);
  });

  it('every structured genre has the supported v3 fields', () => {
    for (const genre of genreLibrary) {
      expect(genre.categoryId, genre.id).toBeTruthy();
      expect(Array.isArray(genre.archetypes), genre.id).toBe(true);
      expect(['core', 'extended'], genre.id).toContain(genre.tier);
      expect(genre.rhythm.length, genre.id).toBeGreaterThan(0);
      expect(genre.instruments.length, genre.id).toBeGreaterThan(0);
      expect(genre.vocal.length, genre.id).toBeGreaterThan(0);
      expect(genre.production.length, genre.id).toBeGreaterThan(0);
      expect(genre.harmony.length, genre.id).toBeGreaterThan(0);
      expect(genre.tempo).toHaveLength(2);
      expect(genre.tempo[0], genre.id).toBeGreaterThan(0);
      expect(genre.tempo[1], genre.id).toBeGreaterThanOrEqual(genre.tempo[0]);
      expect(genre.moods.length, genre.id).toBeGreaterThan(0);
      expect(genre.audiences.length, genre.id).toBeGreaterThan(0);
      expect(genre.avoidTraits.length, genre.id).toBeGreaterThan(0);
      expect(genre.shortPrompt.length, genre.id).toBeGreaterThan(20);
      expect(genre.productionGuidance.length, genre.id).toBeGreaterThan(20);
    }
  });

  it('keeps Suno-facing genre text free of visual, imitation, and famous-artist terms', () => {
    for (const genre of genreLibrary) {
      const sunoText = [genre.shortPrompt, genre.styleCore].join('\n');
      expect(sunoText, genre.id).not.toMatch(forbiddenStyleTerms);
      expect(sunoText, genre.id).not.toMatch(forbiddenImitationTerms);
      expect(sunoText, genre.id).not.toMatch(famousArtistNames);
    }
  });

  it('generates a <=900 character style prompt for every preset genre without exact duplicate clauses', () => {
    for (const genre of genrePacks) {
      const opts = makeOptions({ genreIds: [genre.id], songCount: 1 });
      const blueprint = generateLocalBlueprint(opts, [genre], testMoods, testSeason);
      const song = blueprint.songs[0];
      expect(song.stylePrompt.length, genre.id).toBeLessThanOrEqual(SUNO_COPY_LIMIT);
      expect(song.stylePrompt, genre.id).not.toMatch(forbiddenStyleTerms);
      expect(song.stylePrompt, genre.id).not.toContain('undefined');

      const atoms = promptAtoms(song.stylePrompt);
      expect(new Set(atoms).size, genre.id).toBe(atoms.length);
    }
  });

  it('uses the compressed hook instruction', () => {
    // TASK G1 (v3.10) — further compressed to reuse Persona mode's terse
    // compactHook ('hook "X" repeats chorus 4x') in place of the old
    // 4-clause sentence.
    expect(hookStyleDirectives('Hold On', 'commercial')).toBe('hook "Hold On" repeats chorus 4x');
    expect(hookStyleDirectives('Hold On', 'poetic')).toBe('hook "Hold On" repeats chorus 3x');
  });

  it('compresses by individual clauses in priority order', () => {
    // TASK F5 (v3.7) — genre/vocal/hook/moneyChord/duration are essential and
    // must never be hard-dropped (see enforceHardLimit); only non-essential
    // atoms like mixNotes are candidates once the limit is tight. 180 is
    // sized to fit every essential atom plus the mood atoms while still
    // being too tight for the 55-char mixNotes clause, so the test still
    // exercises "lowest priority gets dropped first" without asserting a
    // ceiling essential content could legitimately exceed.
    const result = composeStylePrompt([
      { id: 'genre', text: 'adult pop' },
      { id: 'vocal', text: 'clear vocal' },
      { id: 'hook', text: 'short repeated chorus hook' },
      { id: 'moneyChord', text: 'money chord foundation: I-V-vi-IV' },
      { id: 'duration', text: 'no long instrumental break' },
      { id: 'tempo', text: '96 BPM' },
      { id: 'mood', text: 'warm, nostalgic, hopeful, elegant, reflective' },
      { id: 'mixNotes', text: 'same channel mix balance across the full playlist set' }
    ], 180, 180);

    expect(result.prompt).toContain('warm');
    expect(result.prompt).not.toContain('same channel mix balance');
    expect(result.droppedTerms).toContain('mix notes');
    expect(result.length).toBeLessThanOrEqual(180);
  });

  it('limits concept-screen genre selection to one primary plus two secondary genres', () => {
    expect(normalizeGenreSelection(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(toggleGenreSelection(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c']);
    expect(toggleGenreSelection(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleGenreSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(MAX_SELECTED_GENRES).toBe(3);
  });

  it('keeps channel core genre counts at or below 12 and falls back for empty archetypes', () => {
    expect(getCoreGenresForArchetype('senior-morning').map(genre => genre.id)).toEqual([
      'adult-contemporary',
      'acoustic-pop',
      'jazz-pop',
      'healing-ballad',
      'piano-ballad',
      'lofi-cafe',
      'retro-soul-pop',
      'bossa-cafe',
      'christmas-soft-pop',
      'folk-pop'
    ]);
    expect(getCoreGenresForArchetype('senior-morning').length).toBeLessThanOrEqual(12);
    expect(getCoreGenresForArchetype('showa-cafe').length).toBeLessThanOrEqual(12);
    expect(getCoreGenresForArchetype('christmas').map(genre => genre.id)).toEqual(getCoreGenresForArchetype('senior-morning').map(genre => genre.id));
    expect(getVisibleGenresForArchetype('senior-morning').length).toBeLessThanOrEqual(12);
  });

  it('does not promote Bebop, Big Band, Club Disco, or Jazz Rap variants into any core set', () => {
    const coreIds = new Set([
      ...getCoreGenresForArchetype('senior-morning').map(genre => genre.id),
      ...getCoreGenresForArchetype('showa-cafe').map(genre => genre.id)
    ]);
    for (const forbidden of ['jazz-bebop-sax-drive', 'jazz-big-band-swing', 'city-pop-club-disco-pop', 'jazz-jazz-rap-late-night']) {
      expect(coreIds.has(forbidden), forbidden).toBe(false);
    }
  });

  it('keeps extended genres out of default visibility but searchable', () => {
    const visibleIds = new Set(getVisibleGenresForArchetype('senior-morning').map(genre => genre.id));
    expect(visibleIds.has('jazz-classic-vocal-lounge')).toBe(false);
    expect(searchHiddenGenresForArchetype('senior-morning', 'Classic Vocal Jazz Lounge').map(genre => genre.id)).toContain('jazz-classic-vocal-lounge');
    expect(searchExtendedGenres('Bebop').map(genre => genre.id)).toContain('jazz-bebop-sax-drive');
  });

  it('preserves all 264 genre ids and keeps preset ids backward compatible', () => {
    const libraryIds = new Set(genreLibrary.map(genre => genre.id));
    const presetIds = new Set(genrePacks.map(genre => genre.id));
    expect(libraryIds.size).toBe(264);
    expect(presetIds.size).toBe(264);
    for (const id of libraryIds) expect(presetIds.has(id), id).toBe(true);
    for (const id of LEGACY_IDS) expect(presetIds.has(id), id).toBe(true);
  });
});
