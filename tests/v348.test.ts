import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildSystemInstruction } from '../src/core/promptComposer';
import { scoreSong } from '../src/core/quality';
import { buildThumbnailSpec } from '../src/core/thumbnailSpec';
import { applyLyricWorkspaceEdit, applyPronunciationHints, regenerateSingleLyricLine } from '../src/core/lyricAuthorship';
import { containsEraAnachronism, eraLyricGuidanceForArchetype } from '../src/data/japaneseEraGuidance';
import { getGenreById, getVisibleGenresForArchetype, LEAD_ARRANGEMENT_NARRATIVES } from '../src/data/genreLibrary';
import { introTexturesForArchetype } from '../src/data/introTextures';
import { lyricThemesForArchetype } from '../src/data/lyricThemes';
import { buildDefaultNegativeStyle } from '../src/data/negativeStyles';
import { thumbnailArchetypeById } from '../src/data/thumbnailArchetypes';
import { createInitialOptions } from '../src/utils/generation';
import { buildSongTxt, exportJson } from '../src/utils/exporters';
import { channelPresets, genrePacks, moodPacks, makeOptions, seasonPacks } from './fixtures';
import type { ChannelProfile, SongIdea } from '../src/types';

const SHOWA_70S_IDS = ['kayokyoku-70s', 'japanese-folk-70s', 'new-music-70s', 'showa-groove-70s'];
const J2000S_IDS = ['jpop-2000s-ballad', 'jpop-2000s-rnb', 'jpop-2000s-band', 'jpop-2000s-dance'];
const SMARTPHONE = '\u30b9\u30de\u30db';
const SHOWA_NAME = '\u662d\u548c\u30bb\u30d6\u30f3\u30c6\u30a3\u30fc\u30ba';
const MILLENNIUM_NAME = '\u30df\u30ec\u30cb\u30a2\u30e0J-POP';
const JAPANESE_DRAFT = [
  '[male vocal]',
  '[verse 1]',
  '\u591c\u6c7d\u8eca\u306e\u7a93\u306b\u53e4\u3044\u96e8',
  '\u5207\u7b26\u3092\u3057\u307e\u3046\u624b\u304c\u9707\u3048\u308b',
  '',
  '[chorus]',
  '\u5fd8\u308c\u306a\u3044\u3067',
  '\u99c5\u306e\u706f\u308a',
  '\u5fd8\u308c\u306a\u3044\u3067',
  '',
  '[final chorus]',
  '\u5fd8\u308c\u306a\u3044\u3067',
  '\u5fd8\u308c\u306a\u3044\u3067',
  '',
  '[end]'
].join('\n');

const famousArtistTerms = /\b(in the style of|sounds like|as sung by|voice like|clone of|copy of|cover of|rewrite of|melody from|lyrics from|yoasobi|utada|matsutoya|ado|southern all stars|b'z|mr\. children|hikki)\b/i;

function channelById(id: string): ChannelProfile {
  const channel = channelPresets.find(item => item.id === id);
  if (!channel) throw new Error(`Missing channel ${id}`);
  return channel;
}

function channelGenres(channel: ChannelProfile) {
  return genrePacks.filter(genre => channel.preferredGenres.includes(genre.id));
}

function channelMoods(channel: ChannelProfile) {
  return moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
}

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Station Light',
    seasonMoment: 'rainy station',
    listenerSituation: 'station farewell',
    emotionArc: 'quiet memory to acceptance',
    hookPhrase: '\u5fd8\u308c\u306a\u3044\u3067',
    stylePrompt: 'mature Japanese male tenor, 1970s Japanese kayokyoku, I-V-vi-IV progression, chorus lift, hook entry uses a cymbal swell, 86 BPM',
    lyrics: JAPANESE_DRAFT,
    youtube: { title: 'Station Light', description: 'desc', tags: ['showa'] },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('[v3.48] Japanese era channels and genre visibility', () => {
  it('adds two Japanese-language era channel presets without changing the existing Showa cafe language', () => {
    const showa70s = channelById('showa-seventies');
    const j2000s = channelById('millennium-jpop');
    const showaCafe = channelById('morning-showa-cafe');

    expect(showa70s.name).toBe(SHOWA_NAME);
    expect(showa70s.market).toBe('japan');
    expect(showa70s.primaryLanguage).toBe('japanese');
    expect(showa70s.audience).toBe('seniors');
    expect(showa70s.archetype).toBe('showa-70s');

    expect(j2000s.name).toBe(MILLENNIUM_NAME);
    expect(j2000s.market).toBe('japan');
    expect(j2000s.primaryLanguage).toBe('japanese');
    expect(j2000s.audience).toBe('general');
    expect(j2000s.archetype).toBe('j2000s');

    expect(showaCafe.primaryLanguage).toBe('english');
    expect(createInitialOptions(showa70s).lyricLanguage).toBe('japanese');
    expect(createInitialOptions(j2000s).lyricLanguage).toBe('japanese');
    expect(createInitialOptions(showa70s).packagingLanguage).toBe('japanese');
  });

  it('exposes all eight era genre packs as chips and through getGenreById', () => {
    expect(getVisibleGenresForArchetype('showa-70s').map(genre => genre.id)).toEqual(SHOWA_70S_IDS);
    expect(getVisibleGenresForArchetype('j2000s').map(genre => genre.id)).toEqual(J2000S_IDS);

    for (const id of [...SHOWA_70S_IDS, ...J2000S_IDS]) {
      const genre = getGenreById(id);
      expect(genre, id).toBeDefined();
      expect(genre!.categoryId, id).toBe('japanese-era');
      expect(genre!.styleCore, id).toMatch(/Japanese|J-Pop|J-pop|kayokyoku|folk|new music/i);
    }
  });

  it('adds arrangement narratives only to the lead era genres and keeps them free of artist references', () => {
    const eraNarrativeIds = [...SHOWA_70S_IDS, ...J2000S_IDS].filter(id => LEAD_ARRANGEMENT_NARRATIVES[id]);
    expect(eraNarrativeIds).toEqual(['kayokyoku-70s', 'new-music-70s', 'jpop-2000s-ballad']);

    for (const id of eraNarrativeIds) {
      const narrative = getGenreById(id)!.arrangementNarrative!;
      expect(narrative).toMatch(/\bverse\b/i);
      expect(narrative).toMatch(/\bpre-chorus\b/i);
      expect(narrative).toMatch(/\bchorus\b/i);
      expect(narrative).toMatch(/hook entry|dropout|one-beat breath|swell/i);
      expect(narrative).toMatch(/analog tape|spring reverb|digital polish|close-mic/i);
      expect(narrative).not.toMatch(famousArtistTerms);
    }
  });
});

describe('[v3.48] era negatives, intro textures, and lyric guards', () => {
  it('turns era-specific forbidden cliches into Suno Exclude styles', () => {
    const showa70s = channelById('showa-seventies');
    const j2000s = channelById('millennium-jpop');
    const showaNegative = buildDefaultNegativeStyle(showa70s);
    const j2000sNegative = buildDefaultNegativeStyle(j2000s);

    for (const term of ['modern EDM synths', 'trap hi-hats', 'hard autotune', 'sidechain pumping', 'ultra-wide modern mix', 'famous artist imitation']) {
      expect(showaNegative).toContain(term);
    }
    for (const term of ['lo-fi vintage texture', 'trap elements', 'modern bedroom-pop texture', 'famous artist imitation']) {
      expect(j2000sNegative).toContain(term);
    }

    const opts = makeOptions({ channel: showa70s, lyricLanguage: 'japanese', songCount: 3 });
    const slots = preallocateSongSlots(opts, channelGenres(showa70s));
    expect(slots.every(slot => slot.negativeStyleText?.includes('hard autotune'))).toBe(true);
  });

  it('provides 10+ era-suited intro-only textures for both new archetypes', () => {
    for (const archetype of ['showa-70s', 'j2000s'] as const) {
      const textures = introTexturesForArchetype(archetype);
      expect(textures.length, archetype).toBeGreaterThanOrEqual(10);
      expect(textures.every(texture => /intro texture/i.test(texture.tag))).toBe(true);
      expect(textures.every(texture => /intro only/i.test(texture.tag))).toBe(true);
    }
  });

  it('keeps era lyric theme pools concrete and blocks 1970s anachronisms', () => {
    const showaThemes = lyricThemesForArchetype('showa-70s', undefined, 'japanese');
    const j2000sThemes = lyricThemesForArchetype('j2000s', undefined, 'japanese');

    expect(showaThemes).toHaveLength(12);
    expect(j2000sThemes).toHaveLength(12);
    expect(showaThemes.every(theme => theme.scene.split(/\s+/).length >= 8)).toBe(true);
    expect(j2000sThemes.some(theme => /flip phone|keitai mail/i.test(theme.scene))).toBe(true);
    expect(showaThemes.every(theme => !containsEraAnachronism(theme.scene, 'showa-70s'))).toBe(true);

    const injected = baseSong({ lyrics: `${JAPANESE_DRAFT}\n${SMARTPHONE}` });
    expect(containsEraAnachronism(injected.lyrics, 'showa-70s')).toBe(true);
    const scored = scoreSong(injected, channelById('showa-seventies'), 'japanese');
    expect(scored.warnings.some(warning => warning.includes('Era lyric guard'))).toBe(true);
  });
});

describe('[v3.48] bridge/local generation and authorship records', () => {
  it('passes Japanese era lyric guidance through the bridge instruction and payload', () => {
    const channel = channelById('showa-seventies');
    const opts = makeOptions({ channel, lyricLanguage: 'japanese', genreIds: channel.preferredGenres, moodIds: channel.preferredMoods, songCount: 2 });
    const genres = channelGenres(channel);
    const slots = preallocateSongSlots(opts, genres);
    const instruction = buildClaudeCodeInstruction(opts, genres, channelMoods(channel), seasonPacks[0], undefined, slots);

    expect(eraLyricGuidanceForArchetype('showa-70s')).toContain('1970s Japanese lyrics');
    expect(buildSystemInstruction(opts)).toContain('For 1970s Japanese lyrics');
    expect(instruction).toContain('japaneseEraLyricGuidance');
    expect(instruction).toContain('Do not mention modern phones');
    expect(instruction).toContain('never claim that a song is eligible for collecting-society registration');
  });

  it('generates Japanese local lyrics for both era channels without modern 1970s device terms', () => {
    for (const channel of [channelById('showa-seventies'), channelById('millennium-jpop')]) {
      const opts = makeOptions({
        channel,
        lyricLanguage: 'japanese',
        genreIds: channel.preferredGenres,
        moodIds: channel.preferredMoods,
        songCount: 2
      });
      const blueprint = generateLocalBlueprint(opts, channelGenres(channel), channelMoods(channel), seasonPacks[0]);
      const joinedLyrics = blueprint.songs.map(song => song.lyrics).join('\n');

      expect(joinedLyrics).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/u);
      if (channel.archetype === 'showa-70s') {
        expect(containsEraAnachronism(joinedLyrics, 'showa-70s')).toBe(false);
        expect(blueprint.songs.every(song => song.excludePrompt?.includes('hard autotune'))).toBe(true);
      }
      expect(blueprint.songs.every(song => !famousArtistTerms.test([song.stylePrompt, song.lyrics].join('\n')))).toBe(true);
    }
  });

  it('records user lyric rewrites, pronunciation hints, and factual authorship exports', () => {
    const editedLyrics = JAPANESE_DRAFT.replace('\u5207\u7b26\u3092\u3057\u307e\u3046\u624b\u304c\u9707\u3048\u308b', '\u5207\u7b26\u3092\u3057\u307e\u3046\u6307\u306b\u706f\u304c\u6b8b\u308b');
    const edited = applyLyricWorkspaceEdit(baseSong(), editedLyrics);
    const withHints = applyPronunciationHints(edited, '\u306f is sung as wa on line 7; hold \u308a one beat longer');
    const txt = buildSongTxt(withHints);
    const json = JSON.parse(exportJson({ projectTitle: 'Pack', channelName: 'Channel', oneLineConcept: 'concept', sonicSignature: 'sig', vocalSignature: 'vocal', lyricRules: [], harmonyRules: [], visualRules: [], songs: [withHints] }));

    expect(withHints.aiDraftLyrics).toBe(JAPANESE_DRAFT);
    expect(withHints.aiAssisted).toBe(true);
    expect(withHints.humanContribution?.editedLineCount).toBe(1);
    expect(withHints.humanContribution?.editedLineNumbers).toEqual([4]);
    expect(withHints.humanContribution?.summary).toContain('no legal registration decision');
    expect(withHints.japanesePronunciationHints).toContain('line 7');
    expect(txt).toContain('===== AUTHORSHIP RECORD =====');
    expect(txt).toContain('AI assisted: true');
    expect(json.songs[0].humanContribution.editedLineCount).toBe(1);

    const regenerated = regenerateSingleLyricLine(baseSong({ lyrics: 'Title: X\n[verse 1]\nplain line\n[chorus]\nHook\nHook\nHook\n[end]' }), 2);
    expect(regenerated.lyrics).toContain('just a little longer');
    expect(regenerated.humanContribution?.editedLineNumbers).toEqual([3]);
  });
});

describe('[v3.48] era thumbnail archetypes', () => {
  it('adds Showa 70s and early-2000s thumbnail archetypes with text-safe prompts', () => {
    const showaArchetype = thumbnailArchetypeById['showa-70s-kissaten-film'];
    const j2000sArchetype = thumbnailArchetypeById['j2000s-digital-station'];
    expect(showaArchetype).toBeDefined();
    expect(j2000sArchetype).toBeDefined();
    expect(showaArchetype.promptTemplate).toContain('1970s Showa');
    expect(j2000sArchetype.promptTemplate).toContain('early-2000s Japanese');

    const channel = channelById('showa-seventies');
    const opts = makeOptions({ channel, lyricLanguage: 'japanese' });
    const blueprint = generateLocalBlueprint(opts, channelGenres(channel), channelMoods(channel), seasonPacks[0]);
    const spec = buildThumbnailSpec(blueprint, opts, seasonPacks[0], channel, 0, 'showa-70s-kissaten-film');

    expect(spec.imagePrompt).toContain('1970s Showa');
    expect(spec.imagePrompt).toContain('left third');
    expect(spec.imagePrompt).toContain('no text');
    expect(spec.imagePrompt).not.toContain('undefined');
  });
});
