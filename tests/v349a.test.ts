import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { countBpmTextMentions } from '../src/core/bpmDedupe';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildReferenceMoodStyleClause, referenceMoodSafetyIssues } from '../src/core/referenceMood';
import { SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { getGenreById, getVisibleGenresForArchetype, modernGenrePacks } from '../src/data/genreLibrary';
import { createInitialOptions } from '../src/utils/generation';
import { channelPresets, genrePacks, moodPacks, makeOptions, seasonPacks } from './fixtures';
import type { ChannelProfile, GenrePack } from '../src/types';

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
  'disco-pop-2020s'
];

const MODERN_NARRATIVE_IDS = [
  'alt-rnb',
  'neo-soul',
  'trap-soul',
  'chill-rap',
  'city-pop-modern',
  'disco-pop-2020s'
];

const famousArtistTerms = /\b(in the style of|sounds like|as sung by|voice like|clone of|copy of|cover of|rewrite of|melody from|lyrics from|adele|beyonce|bts|bruno mars|ed sheeran|iu|newjeans|queen|taylor swift|the weeknd|yoasobi|utada|ado)\b/i;

function channelById(id: string): ChannelProfile {
  const channel = channelPresets.find(item => item.id === id);
  if (!channel) throw new Error(`Missing channel ${id}`);
  return channel;
}

function genresByIds(ids: readonly string[]): GenrePack[] {
  return ids.map(id => {
    const genre = genrePacks.find(item => item.id === id);
    if (!genre) throw new Error(`Missing genre ${id}`);
    return genre;
  });
}

function channelMoods(channel: ChannelProfile) {
  return moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
}

function adjacentRepeatCount(values: Array<string | undefined>): number {
  let count = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] && values[i] === values[i - 1]) count += 1;
  }
  return count;
}

describe('[v3.49A] modern genre library coverage', () => {
  it('exposes all twelve modern genre packs through chips and getGenreById', () => {
    const visibleIds = new Set([
      ...getVisibleGenresForArchetype('modern-chill').map(genre => genre.id),
      ...getVisibleGenresForArchetype('city-night').map(genre => genre.id)
    ]);

    for (const id of MODERN_IDS) {
      const genre = getGenreById(id);
      expect(genre, id).toBeDefined();
      expect(visibleIds.has(id), id).toBe(true);
      expect(genre!.tempoRange[0], id).toBeGreaterThanOrEqual(60);
      expect(genre!.tempoRange[1], id).toBeLessThanOrEqual(130);
      expect(genre!.styleCore, id).not.toMatch(famousArtistTerms);
      expect(genre!.avoidTraits?.length, id).toBeGreaterThan(0);
    }
  });

  it('adds arrangement narratives only to the six lead modern packs', () => {
    const narrativeIds = modernGenrePacks
      .filter(genre => Boolean(genre.arrangementNarrative))
      .map(genre => genre.id);

    expect(narrativeIds).toEqual(MODERN_NARRATIVE_IDS);
    for (const id of narrativeIds) {
      const narrative = getGenreById(id)!.arrangementNarrative!;
      expect(narrative).toMatch(/\bverse\b/i);
      expect(narrative).toMatch(/\bpre-chorus\b/i);
      expect(narrative).toMatch(/\bchorus\b/i);
      expect(narrative).toMatch(/hook entry|dropout|filter sweep|drum mute|riser/i);
      expect(narrative).toMatch(/mix is|mix feels/i);
      expect(narrative).not.toMatch(famousArtistTerms);
    }
  });

  it('adds the two modern channels with modern defaults', () => {
    const chill = channelById('chill-hours');
    const city = channelById('city-night-drive');

    expect(chill.archetype).toBe('modern-chill');
    expect(chill.primaryLanguage).toBe('english');
    expect(chill.preferredGenres).toEqual(['alt-rnb', 'chill-rap', 'lofi-hiphop-study']);
    expect(createInitialOptions(chill).lyricLanguage).toBe('english');

    expect(city.archetype).toBe('city-night');
    expect(city.primaryLanguage).toBe('english');
    expect(city.preferredGenres).toEqual(['city-pop-modern', 'future-funk', 'disco-pop-2020s']);
    expect(createInitialOptions(city).genreIds).toEqual(city.preferredGenres);
  });
});

describe('[v3.49A] genre rotation, negatives, bridge repair, and reference mood', () => {
  it('assigns per-song genres by stride and lets manual genre counts override the plan', () => {
    const channel = channelById('chill-hours');
    const opts = makeOptions({
      channel,
      genreIds: channel.preferredGenres,
      moodIds: channel.preferredMoods,
      songCount: 18
    });
    const slots = preallocateSongSlots(opts, genresByIds(channel.preferredGenres));

    expect(new Set(slots.map(slot => slot.genreId)).size).toBeGreaterThanOrEqual(3);
    expect(adjacentRepeatCount(slots.map(slot => slot.genreId))).toBe(0);
    expect(slots.every(slot => slot.genreText)).toBe(true);
    expect(slots.every(slot => slot.negativeStyleText?.includes('bright EDM supersaw'))).toBe(true);
    expect(slots.some(slot => slot.negativeStyleText?.includes('busy acoustic cafe strumming'))).toBe(true);

    const manual = preallocateSongSlots({
      ...opts,
      songCount: 5,
      diversityAllocations: [
        { axis: 'genre', mode: 'manual', counts: { 'alt-rnb': 2, 'chill-rap': 1 } }
      ]
    }, genresByIds(channel.preferredGenres));
    expect(manual.slice(0, 3).map(slot => slot.genreId)).toEqual(['alt-rnb', 'alt-rnb', 'chill-rap']);
  });

  it('exposes genreText through the bridge and repairs imports that omit it', () => {
    const channel = channelById('city-night-drive');
    const opts = makeOptions({
      channel,
      genreIds: channel.preferredGenres,
      moodIds: channel.preferredMoods,
      songCount: 1
    });
    const genres = genresByIds(channel.preferredGenres);
    const [slot] = preallocateSongSlots(opts, genres);
    const instruction = buildClaudeCodeInstruction(opts, genres, channelMoods(channel), seasonPacks[0], undefined, [slot]);
    expect(instruction).toContain('genreText');
    expect(instruction).toContain('weave that exact per-song lead/blended genre phrase');

    const raw = JSON.stringify({
      songs: [{
        trackNo: 1,
        title: 'Neon Lane',
        seasonMoment: 'rainy night',
        listenerSituation: 'night drive',
        emotionArc: 'steady glow to lift',
        hookPhrase: 'Neon Lane',
        stylePrompt: 'plain city pop, around 120 bpm',
        lyrics: '[verse 1]\\nline\\n[chorus]\\nNeon Lane\\nNeon Lane\\n[end]',
        youtube: { title: 'Neon Lane', description: 'desc', tags: ['city'] }
      }]
    });
    const report = importSongsJson(raw, opts, genres, channelMoods(channel), seasonPacks[0], [slot]);
    const song = report.blueprint!.songs[0];

    expect(song.genreId).toBe(slot.genreId);
    expect(song.genreText).toBe(slot.genreText);
    expect(song.stylePrompt).toContain(slot.genreText);
    expect(song.excludePrompt).toContain('cheap retro parody');
    expect(song.stylePrompt).not.toContain('cheap retro parody');
    expect(countBpmTextMentions(song.stylePrompt)).toBe(1);
  });

  it('translates safe Korean reference moods and blocks artist or soundalike input', () => {
    const blocked = '\uc544\uc774\uc720 \uac19\uc740 \ube44 \uc624\ub294 \uc0c8\ubcbd';
    const safe = '\ube44 \uc624\ub294 \uc0c8\ubcbd \ub4dc\ub77c\uc774\ube0c, \ub098\ub978\ud55c \uc5ec\uc131 \ubcf4\uceec';
    const clause = buildReferenceMoodStyleClause(safe);

    expect(referenceMoodSafetyIssues(blocked)).toHaveLength(1);
    expect(buildReferenceMoodStyleClause(blocked)).toBeUndefined();
    expect(clause).toContain('rainy atmosphere');
    expect(clause).toContain('predawn quiet');
    expect(clause).toContain('night-drive motion');
    expect(clause).toContain('laid-back phrasing');
    expect(clause).toContain('soft female vocal color');
  });
});

describe('[v3.49A] modern channel generation quality gates', () => {
  it('keeps 18-song modern channel packs under the style limit with average similarity at or below 70%', () => {
    for (const channelId of ['chill-hours', 'city-night-drive']) {
      const channel = channelById(channelId);
      const opts = makeOptions({
        channel,
        genreIds: channel.preferredGenres,
        moodIds: channel.preferredMoods,
        songCount: 18,
        referenceMood: channelId === 'chill-hours'
          ? '\ube44 \uc624\ub294 \uc0c8\ubcbd \ub4dc\ub77c\uc774\ube0c, \ub098\ub978\ud55c \uc5ec\uc131 \ubcf4\uceec'
          : '\ub3c4\uc2dc \uc57c\uac04 \ub4dc\ub77c\uc774\ube0c, \uccad\ub7c9\ud55c \ub514\uc2a4\ucf54 \uadf8\ub8e8\ube0c',
        genreBlendWeights: Object.fromEntries(channel.preferredGenres.map((id, index) => [id, index === 0 ? 70 : 30]))
      });
      const genres = genresByIds(channel.preferredGenres);
      const blueprint = generateLocalBlueprint(opts, genres, channelMoods(channel), seasonPacks[0]);
      const report = lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));

      expect(blueprint.songs.every(song => song.promptWithinLimit), channelId).toBe(true);
      expect(blueprint.songs.every(song => song.stylePrompt.length <= SUNO_COPY_LIMIT), channelId).toBe(true);
      expect(blueprint.songs.every(song => countBpmTextMentions(song.stylePrompt) === 1), channelId).toBe(true);
      expect(report.averageSimilarity, `${channelId}: ${JSON.stringify(report)}`).toBeLessThanOrEqual(0.70);
      expect(blueprint.songs.every(song => song.excludePrompt && song.excludePrompt.length > 0), channelId).toBe(true);
    }
  });
});
