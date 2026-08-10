import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { hookStyleDirectives } from '../src/core/promptComposer';
import { composeStylePrompt, SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { MAX_SELECTED_GENRES, normalizeGenreSelection, toggleGenreSelection } from '../src/core/genreSelection';
import {
  genreLibrary,
  getCoreGenresForArchetype,
  getGenreById,
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
  'synthwave-mellow',
  // TASK v3.56 Part 3 — senior/cafe channel additions. Originally registered
  // only in presets.ts's rawGenrePacks (not genreLibrary's own array); TASK
  // v3.61 additionally registered them into genreLibrary's legacyGenreProfiles
  // too, since conceptAgent.ts's getCoreGenresForArchetype reads genreLibrary,
  // not presets.ts, so the split silently broke Korean-keyword genre routing.
  'chanson',
  'smooth-jazz-lounge'
];

const MODERN_IDS = [
  'alt-rnb',
  'neo-soul',
  'trap-soul',
  'rnb-ballad-2020s',
  'chill-rap',
  'lofi-hiphop-study',
  'boom-bap-mellow',
  'jazz-rap',
  'city-pop-modern',
  'future-funk',
  'bedroom-pop',
  'disco-pop-2020s',
  // TASK v3.56 Part 3 — 2030-channel additions, registered in genreLibrary's
  // modernGenrePacks (so both genreLibrary and presets.ts's genrePacks see them).
  'contemporary-rnb',
  'city-pop-night',
  'lofi-soul'
];

const forbiddenStyleTerms = /\b(visualIdentity|typography|thumbnail|font|logo|cover art|image prompt)\b/i;
const forbiddenImitationTerms = /\b(in the style of|sounds like|as sung by|voice like|clone of|copy of|cover of|rewrite of|melody from|lyrics from)\b/i;
const famousArtistNames = /\b(adele|beatles|beyonce|bts|bruno mars|celine dion|ed sheeran|iu|queen|taylor swift|the weeknd|yoasobi|utada)\b/i;

function promptAtoms(prompt: string) {
  return prompt.split(',').map(atom => atom.trim().toLowerCase()).filter(Boolean);
}

describe('structured genre library', () => {
  it('adds 249 Notion-derived genres and keeps legacy genre ids available', () => {
    // TASK v3.56 Part 3 — was 250; 'lofi-soul' was promoted out of this
    // auto-generated seed pool into a fully authored modernGenrePacks entry
    // (real signatureSound/short/minimal forms instead of the generic
    // tag-formula text), so the seed pool is -1 while modernGenrePacks
    // (counted separately below) is +3 (contemporary-rnb, city-pop-night,
    // and the promoted lofi-soul).
    expect(importedGenreCount).toBe(249);
    expect(totalGenreCount).toBe(genreLibrary.length);
    // TASK v3.38 Part B1/B0 — +4 for kids-bright-pop/kids-acoustic-singalong/
    // kids-upbeat-pop/kids-march, added directly to presets.ts's
    // rawGenrePacks (not to genreLibrary's own array — see that file's
    // TASK H2 comment on the pre-existing split), so genrePacks (presets.ts)
    // is a strict superset of genreLibrary from here on.
    // TASK v3.56 Part 3 — fixed count grew 24 -> 27 (modernGenrePacks grew
    // 12 -> 15 with contemporary-rnb/city-pop-night/lofi-soul; kids(4) and
    // eraGenrePacks(8) are unchanged), and LEGACY_IDS grew by 2
    // (chanson/smooth-jazz-lounge).
    // TASK v3.61 — +28 for oldpopGenrePacks (registered in both genreLibrary
    // and presets.ts's rawGenrePacks, so this fixed count grows by the same
    // 28 the LEGACY_IDS-based total already accounts for on the other side).
    // TASK B1 — +6 for kr2030GenrePacks, same registered-in-both pattern as
    // oldpopGenrePacks just above (see presets.ts's own rawGenrePacks spread
    // and genreLibrary/index.ts's kr2030GenrePacks doc comment).
    // TASK C1 — +7 for jp2030GenrePacks, same registered-in-both pattern.
    // TASK E1 — +7 for krkidsGenrePacks, same registered-in-both pattern.
    // TASK F1 — +7 for jpkidsGenrePacks, same registered-in-both pattern.
    // TASK K2 — +7 for kridolMaleGenrePacks, same registered-in-both pattern.
    // 지시문 21 (TASK B) — oldpopGenrePacks grew 28 -> 32 (doowop-ballad/
    // doowop-uptempo/night-chanson/rainy-ballad-blues, all registered in both
    // genreLibrary and presets.ts's rawGenrePacks, same pattern as v3.61).
    // 지시문 21 (TASK A) — oldpopGenrePacks grew 32 -> 34 (six-eight-slow-ballad/
    // italian-canzone), kr2030GenrePacks grew 6 -> 8 (lofi-swing-hiphop/noir-deep-house).
    expect(genrePacks.length).toBe(LEGACY_IDS.length + importedGenreCount + 27 + 34 + 8 + 7 + 7 + 7 + 7);

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

  it('uses the compressed hook instruction, with no literal hook lyric text', () => {
    // TASK v3.39 Part F — compactHook no longer embeds the literal hook
    // lyric in quotes (a real production Suno artist-name filter false
    // positive traced to a hook fragment landing in the style prompt); the
    // style prompt only needs to say the chorus hook repeats, not which
    // words it is.
    // TASK v4.8 (TASK A) — further compressed to a single no-comma atom
    // ("hook repeats 4x") — see promptComposer.ts's hookStyleDirectives.
    expect(hookStyleDirectives('Hold On', 'commercial')).toBe('hook repeats 4x');
    expect(hookStyleDirectives('Hold On', 'poetic')).toBe('hook repeats 3x');
    expect(hookStyleDirectives('Hold On', 'commercial')).not.toContain('Hold On');
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

  it('limits concept-screen genre selection to one primary plus four secondary genres', () => {
    // TASK v3.58 — raised 3 -> 5 total: a concept recommendation's
    // genreAllocation needs a pool of >= ceil(songCount / floor(songCount *
    // 0.28)) genres to keep any one genre under its 28% cap (4 for an
    // 18-song pack); the old cap of 3 made that mathematically impossible
    // and silently truncated the 4th+ genre right back off. See
    // core/genreSelection.ts and tests/conceptGenreAllocation.test.ts.
    expect(normalizeGenreSelection(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(toggleGenreSelection(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(toggleGenreSelection(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleGenreSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(MAX_SELECTED_GENRES).toBe(5);
  });

  it('keeps showa-cafe core genre count at or below 12 and falls back for empty archetypes', () => {
    expect(getCoreGenresForArchetype('showa-cafe').length).toBeLessThanOrEqual(12);
    expect(getCoreGenresForArchetype('christmas').map(genre => genre.id)).toEqual(getCoreGenresForArchetype('senior-morning').map(genre => genre.id));
  });

  // TASK v3.61 — senior-morning's own core pool was deliberately expanded
  // past the old 10/12 cap: a real 18-song pack kept landing on the same
  // 3-4 genres because the pre-v3.61 pool only had 10 genres that actually
  // resolve via getCoreGenresForArchetype (chanson/smooth-jazz-lounge are
  // registered only in presets.ts's rawGenrePacks, a pre-existing gap this
  // task didn't touch — see LEGACY_IDS's own comment above), none of them
  // in a genuinely different warmth/era bracket from adult-contemporary.
  // The 28 new oldpop-* ids (oldpopGenrePacks) are registered directly in
  // genreLibrary's own array, so they DO resolve here.
  it('adds the 34 oldpop-* genres to senior-morning\'s core pool without touching showa-cafe', () => {
    const seniorIds = getCoreGenresForArchetype('senior-morning').map(genre => genre.id);
    const oldpopIds = seniorIds.filter(id => id.startsWith('oldpop-'));
    // 지시문 21 (TASK B) — 28 -> 32: doowop-ballad/doowop-uptempo/
    // night-chanson/rainy-ballad-blues all carry archetypes:
    // ['senior-morning', 'oldpop-lounge'], tier: 'core'.
    // 지시문 21 (TASK A) — 32 -> 34: six-eight-slow-ballad/italian-canzone.
    expect(oldpopIds).toHaveLength(34);
    // 10 ids that already resolved before v3.61 + 34 oldpop-* + 2
    // (chanson/smooth-jazz-lounge) whose own pre-existing genreLibrary/
    // presets.ts split this task closed (see legacyGenreProfiles's own
    // comment) so conceptAgent.ts's keyword routing can reach them too.
    expect(seniorIds).toHaveLength(46);
    // The ids that resolved before this task must still be present, unchanged.
    for (const id of ['adult-contemporary', 'acoustic-pop', 'jazz-pop', 'healing-ballad', 'piano-ballad', 'lofi-cafe', 'retro-soul-pop', 'bossa-cafe', 'christmas-soft-pop', 'folk-pop', 'chanson', 'smooth-jazz-lounge']) {
      expect(seniorIds, id).toContain(id);
    }
    expect(getCoreGenresForArchetype('showa-cafe').length).toBeLessThanOrEqual(12);
    expect(getVisibleGenresForArchetype('senior-morning').length).toBe(46);
  });

  it('[v3.63] keeps senior-morning genre access broad and all oldpop core genres era-tagged', () => {
    const seniorGenres = getVisibleGenresForArchetype('senior-morning');
    expect(seniorGenres.length).toBeGreaterThanOrEqual(30);
    const oldpopGenres = seniorGenres.filter(genre => genre.id.startsWith('oldpop-'));
    // 지시문 21 (TASK A/B) — 28 -> 32 -> 34, see the 'adds the 34 oldpop-* genres...' test above.
    expect(oldpopGenres).toHaveLength(34);
    expect(oldpopGenres.every(genre => Boolean(genre.eraTag))).toBe(true);
    for (const id of ['adult-contemporary', 'acoustic-pop', 'folk-pop', 'retro-soul-pop', 'chanson', 'smooth-jazz-lounge']) {
      expect(getGenreById(id)?.eraTag, id).toBeTruthy();
    }
  });

  it('[v3.63 TASK A] oldpop-lounge archetype exposes 60+ genres spanning old-pop, chanson, senior R&B, and vocal jazz', () => {
    const loungeGenres = getVisibleGenresForArchetype('oldpop-lounge');
    expect(loungeGenres.length).toBeGreaterThanOrEqual(60);
    const ids = new Set(loungeGenres.map(genre => genre.id));
    // 지시문 21 (TASK A/B) — 28 -> 32 -> 34, all new oldpop-* genres also carry oldpop-lounge.
    expect([...ids].filter(id => id.startsWith('oldpop-'))).toHaveLength(34);
    for (const id of ['chanson', 'smooth-jazz-lounge', 'bossa-cafe', 'jazz-pop', 'retro-soul-pop', 'soft-rock', 'adult-contemporary', 'acoustic-pop', 'folk-pop', 'piano-ballad', 'neo-soul', 'alt-rnb', 'contemporary-rnb']) {
      expect(ids.has(id), id).toBe(true);
    }
    // Deliberately excluded — modern-production-flavored, not this channel's identity.
    for (const excluded of ['trap-soul', 'bedroom-pop', 'city-pop-modern', 'jazz-bebop-sax-drive', 'jazz-electric-fusion', 'jazz-acid-jazz-groove']) {
      expect(ids.has(excluded), excluded).toBe(false);
    }
  });

  it('[v3.63 TASK A] senior-morning\'s own 46-genre exposure is unaffected by adding oldpop-lounge', () => {
    // 지시문 21 (TASK A/B) — 40 -> 44 -> 46, see the 'adds the 34 oldpop-* genres...' test above.
    expect(getVisibleGenresForArchetype('senior-morning').length).toBe(46);
  });

  it('[v3.63] exposes the extended catalog through direct search, independent of archetype chips', () => {
    const extendedResults = searchExtendedGenres('');
    expect(extendedResults.length).toBeGreaterThanOrEqual(250);
    expect(extendedResults.some(result => result.genre.id === 'jazz-bebop-sax-drive')).toBe(true);
    expect(searchExtendedGenres('Bebop').map(result => result.genre.id)).toContain('jazz-bebop-sax-drive');
  });

  it('[Fable5-1단계 TASK C] flags genres the given archetype cannot actually use, without hiding them', () => {
    // oldpop-night-chanson is an extended genre explicitly scoped to
    // senior-morning/oldpop-lounge (archetypes field above) — a real case
    // of an extended search result that's off-limits for other channels.
    const forOldpopLounge = searchExtendedGenres('Night Chanson', 'all', 'oldpop-lounge');
    expect(forOldpopLounge.length).toBeGreaterThan(0);
    expect(forOldpopLounge.every(result => result.eligibleForArchetype === true)).toBe(true);

    const forKrIdol = searchExtendedGenres('Night Chanson', 'all', 'kr-idol-male');
    expect(forKrIdol.length).toBeGreaterThan(0);
    expect(forKrIdol.every(result => result.eligibleForArchetype === false)).toBe(true);
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
    expect(searchExtendedGenres('Bebop').map(result => result.genre.id)).toContain('jazz-bebop-sax-drive');
  });

  it('preserves all genre ids and keeps preset ids backward compatible', () => {
    const libraryIds = new Set(genreLibrary.map(genre => genre.id));
    const presetIds = new Set(genrePacks.map(genre => genre.id));
    // TASK v3.39 — the 4 kids-* ids are now registered directly into
    // genreLibrary too (previously only in presets.ts's rawGenrePacks), so
    // getGenreById/getVisibleGenresForArchetype('kids') can resolve them.
    // TASK v3.56 Part 3 — was 288/288 (libraryIds === presetIds exactly);
    // chanson/smooth-jazz-lounge were registered only in presets.ts's
    // rawGenrePacks (same split as the kids-* ids used to be), making
    // presetIds a strict superset of libraryIds by exactly those 2 ids.
    // TASK v3.61 — +28 oldpop-* ids added to BOTH genreLibrary's own array
    // and presets.ts's rawGenrePacks (290->318, 292->320), AND
    // chanson/smooth-jazz-lounge were additionally registered into
    // genreLibrary's own legacyGenreProfiles (closing the v3.56 gap above —
    // it turned out to silently break conceptAgent.ts's keyword routing,
    // not just the UI chip picker), so libraryIds gains those same 2 ids
    // and the two counts converge back to equal: 318+2=320, 320 unchanged.
    // TASK B1 — +6 kr2030-* ids, registered in both genreLibrary's own array
    // and presets.ts's rawGenrePacks (same registered-in-both pattern as
    // v3.61's oldpop-* addition above), so both counts move together: 326.
    // TASK C1 — +7 jp2030-* ids, same registered-in-both pattern: 333.
    // TASK E1 — +7 krkids-* ids, same registered-in-both pattern: 340.
    // TASK F1 — +7 jpkids-* ids, same registered-in-both pattern: 347.
    // TASK K2 — +7 kridol-* ids, same registered-in-both pattern: 354.
    // 지시문 21 (TASK B) — +4 oldpop-* ids (doowop-ballad/doowop-uptempo/
    // night-chanson/rainy-ballad-blues), same registered-in-both pattern: 358.
    // 지시문 21 (TASK A) — +2 oldpop-* ids (six-eight-slow-ballad/
    // italian-canzone) +2 kr2030-* ids (lofi-swing-hiphop/noir-deep-house),
    // same registered-in-both pattern: 362.
    expect(libraryIds.size).toBe(362);
    expect(presetIds.size).toBe(362);
    for (const id of libraryIds) expect(presetIds.has(id), id).toBe(true);
    for (const id of LEGACY_IDS) expect(presetIds.has(id), id).toBe(true);
    for (const id of ['kids-bright-pop', 'kids-acoustic-singalong', 'kids-upbeat-pop', 'kids-march']) expect(presetIds.has(id), id).toBe(true);
    for (const id of ['kayokyoku-70s', 'japanese-folk-70s', 'new-music-70s', 'showa-groove-70s', 'jpop-2000s-ballad', 'jpop-2000s-rnb', 'jpop-2000s-band', 'jpop-2000s-dance']) expect(presetIds.has(id), id).toBe(true);
    for (const id of MODERN_IDS) expect(presetIds.has(id), id).toBe(true);
  });
});
