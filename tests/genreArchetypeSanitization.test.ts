import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  genreSanitizationWarningKo,
  sanitizeGenreIdsForArchetype
} from '../src/core/genreSelection';
import { getDefaultGenreIdsForArchetype, getGenreById, KR_KIDS_CORE_GENRE_IDS } from '../src/data/genreLibrary';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { deleteAllPacks, listPacks, savePack } from '../src/core/library';
import { applyImport, DEFAULT_EXPORT_INCLUDE, exportWorkspace, type WorkspaceExportFile } from '../src/core/workspaceTransfer';
import { setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';
import { channelPresets, makeOptions, testMoods, testSeason } from './fixtures';
import type { ChannelArchetype, SongIdea } from '../src/types';

// TASK (genre-archetype sanitization) — a real senior/oldpop genre id, never
// valid for any kr-kids-song channel's own core genre list (KR_KIDS_CORE_GENRE_IDS
// below), used throughout as the "contaminating" foreign id.
const FOREIGN_ID_FOR_KIDS = 'oldpop-doowop-harmony';
const FOREIGN_ID_2_FOR_KIDS = 'oldpop-brill-building';

const krKidsChannel = channelPresets.find(c => c.archetype === 'kr-kids-song')!;

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Title',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'test hook',
    stylePrompt: 'test style prompt',
    lyrics: '[verse]\ntest lyrics',
    youtube: { title: 'yt title', description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('sanitizeGenreIdsForArchetype', () => {
  it('strips a foreign-archetype genre id and keeps the valid ones', () => {
    const result = sanitizeGenreIdsForArchetype(
      [...KR_KIDS_CORE_GENRE_IDS.slice(0, 2), FOREIGN_ID_FOR_KIDS],
      'kr-kids-song'
    );
    expect(result.removed).toEqual([FOREIGN_ID_FOR_KIDS]);
    expect(result.valid).toEqual(KR_KIDS_CORE_GENRE_IDS.slice(0, 2));
    expect(result.recovered).toBe(false);
  });

  it('recovers to the archetype\'s core defaults when every id is foreign', () => {
    const result = sanitizeGenreIdsForArchetype([FOREIGN_ID_FOR_KIDS, FOREIGN_ID_2_FOR_KIDS], 'kr-kids-song');
    expect(result.removed).toEqual([FOREIGN_ID_FOR_KIDS, FOREIGN_ID_2_FOR_KIDS]);
    expect(result.recovered).toBe(true);
    expect(result.valid).toEqual(getDefaultGenreIdsForArchetype('kr-kids-song'));
    expect(result.valid.length).toBeGreaterThan(0);
    // Every recovered id must itself be a real, resolvable genre.
    for (const id of result.valid) expect(getGenreById(id)).toBeDefined();
  });

  it('leaves a genuinely empty selection alone (nothing to recover from)', () => {
    const result = sanitizeGenreIdsForArchetype([], 'kr-kids-song');
    expect(result).toEqual({ valid: [], removed: [], recovered: false });
  });

  it('drops an unrecognized id (not in genreLibrary at all) the same as a foreign one', () => {
    const result = sanitizeGenreIdsForArchetype(['not-a-real-genre-id'], 'kr-kids-song');
    expect(result.removed).toEqual(['not-a-real-genre-id']);
    expect(result.recovered).toBe(true);
  });

  it('produces the task brief\'s own Korean warning format', () => {
    const warning = genreSanitizationWarningKo([FOREIGN_ID_FOR_KIDS, FOREIGN_ID_2_FOR_KIDS], 'kr-kids-song');
    expect(warning).toBe(
      `⚠ 이 채널에서 쓸 수 없는 장르 2개를 제외했습니다 · ${FOREIGN_ID_FOR_KIDS} · ${FOREIGN_ID_2_FOR_KIDS} (한국 동요 채널)`
    );
  });

  it('returns an empty string (not a stray "0개" message) when nothing was removed', () => {
    expect(genreSanitizationWarningKo([], 'kr-kids-song')).toBe('');
  });
});

describe('no false-positive stripping — every real channel across every workspace', () => {
  // TASK (genre-archetype sanitization) — channelPresets spans all 7 real
  // workspaces (senior/showa/oldpop-lounge, kr-2030, jp-2030, kr-kids,
  // jp-kids, kr-idol-male, kr-idol-female — see data/presets.ts). A
  // channel's own preferredGenres must never be flagged as foreign for its
  // own archetype; that would be exactly the false-positive this task's own
  // constraints call out as "matters as much as the stripping itself".
  for (const channel of channelPresets) {
    it(`"${channel.name}" (${channel.archetype}) — preferredGenres all pass through unchanged`, () => {
      const archetype = channel.archetype || 'senior-morning';
      const result = sanitizeGenreIdsForArchetype(channel.preferredGenres, archetype);
      expect(result.removed).toEqual([]);
      expect(result.recovered).toBe(false);
      expect(result.valid).toEqual(channel.preferredGenres);
    });
  }

  it('covers at least one real channel for every one of the 7 target archetypes', () => {
    const archetypesSeen = new Set(channelPresets.map(c => c.archetype));
    const required: ChannelArchetype[] = [
      'senior-morning',
      'kr-2030-pop',
      'jp-2030-pop',
      'kr-kids-song',
      'jp-kids-song',
      'kr-idol-male',
      'kr-idol-female'
    ];
    for (const archetype of required) expect(archetypesSeen.has(archetype)).toBe(true);
  });
});

describe('generateLocalBlueprint — local generation entry point', () => {
  it('strips an injected foreign genre id and warns on the first song', () => {
    const opts = makeOptions({
      channel: krKidsChannel,
      songCount: 4,
      genreIds: [...KR_KIDS_CORE_GENRE_IDS.slice(0, 2), FOREIGN_ID_FOR_KIDS]
    });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);

    expect(blueprint.songs[0].warnings.some(w => w.includes(FOREIGN_ID_FOR_KIDS))).toBe(true);
    // No track anywhere in the pack was assigned the foreign genre.
    for (const song of blueprint.songs) {
      if (song.genreId) expect(KR_KIDS_CORE_GENRE_IDS as readonly string[]).toContain(song.genreId);
    }
  });

  it('recovers and still produces a full pack when every genre id is foreign', () => {
    const opts = makeOptions({
      channel: krKidsChannel,
      songCount: 3,
      genreIds: [FOREIGN_ID_FOR_KIDS, FOREIGN_ID_2_FOR_KIDS]
    });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);

    expect(blueprint.songs).toHaveLength(3);
    for (const song of blueprint.songs) {
      if (song.genreId) expect(KR_KIDS_CORE_GENRE_IDS as readonly string[]).toContain(song.genreId);
    }
  });

  it('a legitimate kr-kids selection passes through with no warning at all', () => {
    const opts = makeOptions({ channel: krKidsChannel, songCount: 3, genreIds: [...KR_KIDS_CORE_GENRE_IDS] });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    for (const song of blueprint.songs) {
      expect(song.warnings.some(w => w.includes('쓸 수 없는 장르'))).toBe(false);
    }
  });
});

describe('preallocateSongSlots — batch/bridge slot-planning entry point', () => {
  it('strips an injected foreign genre id and attaches genreWarning to slot 1', () => {
    const opts = makeOptions({
      channel: krKidsChannel,
      songCount: 4,
      genreIds: [...KR_KIDS_CORE_GENRE_IDS.slice(0, 2), FOREIGN_ID_FOR_KIDS]
    });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const slots = preallocateSongSlots(opts, genres);

    expect(slots[0].genreWarning).toBeDefined();
    expect(slots[0].genreWarning).toContain(FOREIGN_ID_FOR_KIDS);
    for (const slot of slots) {
      if (slot.genreId) expect(KR_KIDS_CORE_GENRE_IDS as readonly string[]).toContain(slot.genreId);
    }
  });

  it('a legitimate kr-kids selection produces no genreWarning on any slot', () => {
    const opts = makeOptions({ channel: krKidsChannel, songCount: 4, genreIds: [...KR_KIDS_CORE_GENRE_IDS] });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const slots = preallocateSongSlots(opts, genres);
    for (const slot of slots) expect(slot.genreWarning).toBeUndefined();
  });
});

describe('reconcileWithPreassignedSlot — genreWarning folds into song.warnings', () => {
  it('folds slot.genreWarning (from preallocateSongSlots) into the reconciled song\'s warnings', () => {
    const opts = makeOptions({
      channel: krKidsChannel,
      songCount: 2,
      genreIds: [...KR_KIDS_CORE_GENRE_IDS.slice(0, 1), FOREIGN_ID_FOR_KIDS]
    });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const slots = preallocateSongSlots(opts, genres);
    const reconciled = reconcileWithPreassignedSlot(baseSong({ trackNo: 1 }), slots[0]);
    expect(reconciled.warnings.some(w => w.includes(FOREIGN_ID_FOR_KIDS))).toBe(true);
    // The song's own genreId is always slot-owned once a slot exists — never
    // the raw (here foreign-free, but untrusted in general) song input.
    expect(reconciled.genreId).toBe(slots[0].genreId);
  });

  it('the no-slot branch (individual regeneration / out-of-range trackNo) strips a raw untrusted genreId too', () => {
    const raw = baseSong({ trackNo: 99, genreId: FOREIGN_ID_FOR_KIDS, genreText: 'some doo-wop text' });
    const reconciled = reconcileWithPreassignedSlot(raw, undefined, 'ai-creative', { archetype: 'kr-kids-song' });
    expect(reconciled.genreId).toBeUndefined();
    expect(reconciled.genreText).toBeUndefined();
    expect(reconciled.warnings.some(w => w.includes(FOREIGN_ID_FOR_KIDS))).toBe(true);
  });

  it('the no-slot branch leaves a valid genreId (or no archetype context) untouched', () => {
    const validRaw = baseSong({ trackNo: 99, genreId: KR_KIDS_CORE_GENRE_IDS[0] });
    const reconciledValid = reconcileWithPreassignedSlot(validRaw, undefined, 'ai-creative', { archetype: 'kr-kids-song' });
    expect(reconciledValid.genreId).toBe(KR_KIDS_CORE_GENRE_IDS[0]);
    expect(reconciledValid.warnings).toEqual([]);

    const noArchetypeRaw = baseSong({ trackNo: 99, genreId: FOREIGN_ID_FOR_KIDS });
    const reconciledNoArchetype = reconcileWithPreassignedSlot(noArchetypeRaw, undefined);
    expect(reconciledNoArchetype.genreId).toBe(FOREIGN_ID_FOR_KIDS);
  });
});

describe('workspaceTransfer.applyImport — cross-workspace pack/channel import', () => {
  const PACKS_AND_CHANNELS_ONLY = { ...DEFAULT_EXPORT_INCLUDE, hooks: false, ratings: false, takes: false, videos: false, settings: false };

  function fileFrom(json: WorkspaceExportFile): File {
    return new File([JSON.stringify(json)], 'test.json', { type: 'application/json' });
  }

  beforeEach(async () => {
    setCurrentWorkspace('kr-kids');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('strips a foreign genreId from an imported pack and reports it in result.warnings', async () => {
    const opts = makeOptions({ channel: krKidsChannel, songCount: 2, genreIds: [...KR_KIDS_CORE_GENRE_IDS.slice(0, 2)] });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Import Contamination Test' });

    const exported = await exportWorkspace({ workspaceId: 'kr-kids', include: PACKS_AND_CHANNELS_ONLY });
    // Simulate contamination: a cross-workspace export/import (or stale
    // pre-fix data) carrying a senior-oldpop genre id on a kr-kids pack.
    exported.data.packs![0].options.genreIds = [...KR_KIDS_CORE_GENRE_IDS.slice(0, 1), FOREIGN_ID_FOR_KIDS];

    await deleteAllPacks();
    const result = await applyImport(fileFrom(exported), 'merge');

    expect(result.packs.added).toBe(1);
    expect(result.warnings.some(w => w.includes(FOREIGN_ID_FOR_KIDS))).toBe(true);

    const packs = await listPacks();
    expect(packs).toHaveLength(1);
  });

  it('a clean import produces no genre warnings', async () => {
    const opts = makeOptions({ channel: krKidsChannel, songCount: 2, genreIds: [...KR_KIDS_CORE_GENRE_IDS.slice(0, 2)] });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Clean Import Test' });

    const exported = await exportWorkspace({ workspaceId: 'kr-kids', include: PACKS_AND_CHANNELS_ONLY });
    await deleteAllPacks();
    const result = await applyImport(fileFrom(exported), 'merge');
    expect(result.warnings).toEqual([]);
  });
});
