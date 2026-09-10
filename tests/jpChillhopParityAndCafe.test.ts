import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, extractBridgeImportMeta, importSongsJson } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { containsChiliStoryFutureStageViolation } from '../src/core/chiliStoryScenePlanner';
import {
  applyChiliStoryGenerationContract,
  CAFE_STORY_MODE_LABEL_JA,
  CHILI_STORY_DEFAULT_SONG_COUNT,
  storyMetaFieldsFromOptions,
  vocalQuotaForCafeStoryMode
} from '../src/core/chiliStoryPov';
import { evaluateJapaneseChiliQuality } from '../src/core/japaneseChiliQuality';
import { suitablePresetsForArchetype } from '../src/core/vocalRecommender';
import { CORE_GENRE_IDS_BY_ARCHETYPE, JP_CAFE_CHILLHOP_CORE_GENRE_IDS } from '../src/data/genreLibrary';
import { overrideForArchetype } from '../src/data/hookBanks';
import { introTexturesForArchetype } from '../src/data/introTextures';
import { killingPointSetForNonKidsArchetype } from '../src/data/killingPointWorkspaceSets';
import { lyricThemesForOptions } from '../src/data/lyricThemes';
import { moneyChordRotationPool } from '../src/data/moneyChords';
import { channelSoundFloorForArchetype } from '../src/data/channelSoundFloor';
import { channelVocalFloorForArchetype } from '../src/data/channelVocalFloor';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { getWorkspace, workspaceDefinitions, workspaceForArchetype } from '../src/data/workspaces';
import { computeWorkspaceReadiness } from '../src/core/workspaceReadiness';
import { SUNO_V6_ENGINE_PROFILES } from '../src/core/sunoV6';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import type { ChiliStoryPov, GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

const enChannel = channelPresets.find(preset => preset.archetype === 'en-chillhop')!;
const jpChannel = channelPresets.find(preset => preset.id === 'jp-chili-lab-story')!;
const cafeChannel = channelPresets.find(preset => preset.id === 'jp-cafe-chili-lab')!;
const season = seasonPacks.find(item => item.id === 'spring') ?? seasonPacks[0];

const CAFE_SOURCE = {
  storySourceLine: 'cafe-007. 雨の窓際ラテ — 吉祥寺の路地裏カフェで雨宿りの会話が距離を変える',
  storySourceEpisodeId: 'cafe-007',
  storySourceTitle: '雨の窓際ラテ',
  storySourceSummary: '吉祥寺の路地裏カフェで、雨宿りの短い会話からふたりの距離が少し変わる。',
  storyPreviousContext: '前の週に同じ店で隣の席になり、名前だけを覚えている。',
  storyNextHint: '閉店後のメッセージが次の約束につながる。',
  storyLocation: '吉祥寺の路地裏カフェ',
  storySeason: '春の雨',
  cafeLocation: 'Tokyo Kichijoji cafe lane',
  cafeType: 'quiet roaster cafe',
  cafeSeason: 'spring rain',
  cafeTimeOfDay: 'late afternoon',
  cafeWeather: 'soft rain'
};

const CAFE_TITLES = [
  '雨音ラテの席',
  '窓際でほどける午後',
  '二杯目の小さな沈黙',
  '砂糖を入れない返事',
  '湯気の向こうの名前',
  'テーブル越しの本音',
  'レシート裏の約束',
  '閉店前のため息',
  'テラスに残る傘',
  '苦いミルクの夜',
  '返信待ちの角席',
  '雨上がりの会計',
  '駅まで残る香り',
  '次の土曜の窓',
  '最後の一口だけ'
];

const CAFE_HOOKS = [
  '雨音まで味方にして',
  '窓際だけが覚えてる',
  '二杯目から近づいた',
  '甘くしないまま言えた',
  '湯気の奥で名前を呼ぶ',
  'テーブル越しにほどける',
  'レシートの裏で約束',
  '閉店前なら素直になれる',
  '残した傘が答えになる',
  '苦いミルクも悪くない',
  '角席の通知を待ってる',
  '会計のあとで振り向く',
  '駅まで香りがついてくる',
  '次の土曜も同じ窓',
  '最後の一口で笑った'
];

function hookVocabularySize(archetype: 'en-chillhop' | 'jp-chillhop' | 'jp-cafe-chillhop') {
  const bank = overrideForArchetype(archetype, archetype === 'en-chillhop' ? 'english' : 'japanese');
  return Object.values(bank).reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0);
}

function optsForChannel(channel: typeof enChannel | typeof jpChannel | typeof cafeChannel, overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return makeOptions({
    channel,
    projectTitle: `${channel.name} fixture`,
    songCount: channel.archetype === 'jp-cafe-chillhop' ? 15 : 12,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: channel.defaultVocal,
    ...overrides
  });
}

function optsForCafe(mode: ChiliStoryPov, overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return applyChiliStoryGenerationContract(optsForChannel(cafeChannel, {
    projectTitle: CAFE_STORY_MODE_LABEL_JA[mode],
    songCount: CHILI_STORY_DEFAULT_SONG_COUNT,
    lyricLanguage: 'english',
    genreIds: [...JP_CAFE_CHILLHOP_CORE_GENRE_IDS],
    perspective: 'thirdPerson',
    perspectiveMode: 'varied',
    scenePlanningMode: 'concept-generated',
    customConcept: CAFE_SOURCE.storySourceSummary,
    storyPov: mode,
    cafeStoryMode: mode,
    ...CAFE_SOURCE,
    ...overrides
  }));
}

function genresFor(opts: GenerationOptions) {
  return genrePacks.filter(genre => opts.genreIds.includes(genre.id));
}

function moodsFor(opts: GenerationOptions) {
  return moodPacks.filter(mood => opts.moodIds.includes(mood.id));
}

function vocalCounts(slots: readonly Pick<PreassignedSongSlot, 'vocalType'>[]) {
  return {
    male: slots.filter(slot => slot.vocalType === 'male').length,
    female: slots.filter(slot => slot.vocalType === 'female').length,
    mixed: slots.filter(slot => slot.vocalType === 'mixed').length
  };
}

function actCounts(slots: readonly Pick<PreassignedSongSlot, 'storyAct'>[]) {
  return [1, 2, 3, 4, 5].map(act => slots.filter(slot => slot.storyAct === act).length);
}

function vocalTag(slot: PreassignedSongSlot): string {
  if (slot.vocalType === 'female') return '[female vocal]';
  if (slot.vocalType === 'mixed') return '[duet vocal]';
  return '[male vocal]';
}

function lyricPerspectiveLine(slot: PreassignedSongSlot): string {
  if (slot.storySpeaker === 'female') return '私はカフェの窓際で、冷めないラテみたいに本音を守っている。';
  if (slot.storySpeaker === 'male') return '僕はカフェの角席で、雨粒を数えながら返事の言葉を探している。';
  return 'ふたりはカフェの小さなテーブルで、同じ湯気の向こうに次の約束を見ている。';
}

function lyricsFor(slot: PreassignedSongSlot, hook: string): string {
  return [
    vocalTag(slot),
    '[verse]',
    lyricPerspectiveLine(slot),
    '木の椅子が鳴るたび、吉祥寺の雨が少しだけ静かになる。',
    '[pre-chorus]',
    '言えなかったひと言を、コーヒーの苦みにそっと混ぜる。',
    '[chorus]',
    hook,
    '窓の外の春雨まで、今日の沈黙をやさしく照らす。',
    hook,
    '閉店前のランプが、ふたりの距離を少し近くする。',
    '[bridge]',
    '駅へ向かう前に、カフェの香りだけがまだ袖に残る。'
  ].join('\n');
}

function cafeBridgeSongs(slots: readonly PreassignedSongSlot[]): Partial<SongIdea>[] {
  return slots.map((slot, index) => ({
    trackNo: slot.trackNo,
    title: CAFE_TITLES[index] ?? `カフェの続き ${slot.trackNo}`,
    hookPhrase: CAFE_HOOKS[index] ?? `同じ窓で待ってる ${slot.trackNo}`,
    stylePrompt: `${slot.vocalText ?? 'intimate Japanese vocal'}, ${slot.genreText ?? 'cafe chillhop'}, ${slot.moneyChordText}, ${slot.tempo} BPM, warm organic cafe groove, Rhodes keys, soft drums`,
    lyrics: lyricsFor(slot, CAFE_HOOKS[index] ?? `同じ窓で待ってる ${slot.trackNo}`),
    listenerSituation: `${CAFE_SOURCE.storyLocation} / ${slot.storyActLabel}`,
    seasonMoment: CAFE_SOURCE.cafeSeason,
    emotionArc: slot.storyArcRole ?? '',
    storyPov: slot.storyPov,
    cafeStoryMode: slot.cafeStoryMode,
    storySourceLine: slot.storySourceLine,
    storySourceEpisodeId: slot.storySourceEpisodeId,
    storySourceTitle: slot.storySourceTitle,
    storySourceSummary: slot.storySourceSummary,
    storyPreviousContext: slot.storyPreviousContext,
    storyNextHint: slot.storyNextHint,
    storyLocation: slot.storyLocation,
    storySeason: slot.storySeason,
    cafeLocation: slot.cafeLocation,
    cafeType: slot.cafeType,
    cafeSeason: slot.cafeSeason,
    cafeTimeOfDay: slot.cafeTimeOfDay,
    cafeWeather: slot.cafeWeather,
    storySpeaker: slot.storySpeaker,
    storyAct: slot.storyAct,
    storyActLabel: slot.storyActLabel,
    storyArcRole: slot.storyArcRole,
    youtube: {
      title: CAFE_TITLES[index] ?? `カフェの続き ${slot.trackNo}`,
      description: 'Japanese cafe CHILI LAB story fixture',
      tags: ['japanese cafe chillhop', 'cafe story']
    }
  }));
}

function lyricBody(song: Pick<SongIdea, 'lyrics'>): string {
  return song.lyrics.replace(/\[[^\]]+\]/g, '');
}

describe('[instruction 80] JP CHILI parity and Japan Cafe CHILI LAB', () => {
  it('audits en-chillhop vs jp-chillhop parity and locks the repaired readiness gap', () => {
    const enOpts = optsForChannel(enChannel);
    const jpOpts = optsForChannel(jpChannel);
    const enThemes = lyricThemesForOptions(enOpts);
    const jpThemes = lyricThemesForOptions(jpOpts);

    expect(CORE_GENRE_IDS_BY_ARCHETYPE['jp-chillhop']).toEqual(CORE_GENRE_IDS_BY_ARCHETYPE['en-chillhop']);
    expect(jpThemes.length).toBeGreaterThanOrEqual(enThemes.length);
    expect(moneyChordRotationPool('jp-chillhop')).toHaveLength(moneyChordRotationPool('en-chillhop').length);
    expect(suitablePresetsForArchetype('jp-chillhop')).toHaveLength(suitablePresetsForArchetype('en-chillhop').length);
    expect(introTexturesForArchetype('jp-chillhop').length).toBeGreaterThanOrEqual(introTexturesForArchetype('en-chillhop').length);
    expect(killingPointSetForNonKidsArchetype('jp-chillhop')).toHaveLength(killingPointSetForNonKidsArchetype('en-chillhop')?.length ?? 0);
    expect(hookVocabularySize('jp-chillhop')).toBeGreaterThanOrEqual(hookVocabularySize('en-chillhop'));

    expect(channelPresets.filter(preset => preset.archetype === 'jp-chillhop').map(preset => preset.id)).toEqual(['jp-chili-lab-story']);
    expect(channelPresets.filter(preset => preset.archetype === 'en-chillhop')).toHaveLength(5);

    expect(computeWorkspaceReadiness(getWorkspace('jp-chillhop'), 0)).toMatchObject({ passCount: 4, total: 5 });
    expect(computeWorkspaceReadiness(getWorkspace('jp-chillhop'), 1)).toMatchObject({ passCount: 5, total: 5 });
  });

  it('registers jp-cafe-chillhop as a dedicated workspace without duplicating genre definitions', () => {
    const workspaceIds = workspaceDefinitions.map(workspace => workspace.id);
    expect(workspaceIds.slice(workspaceIds.indexOf('en-chillhop'), workspaceIds.indexOf('jp-cafe-chillhop') + 1)).toEqual([
      'en-chillhop',
      'jp-chillhop',
      'jp-cafe-chillhop'
    ]);

    const workspace = getWorkspace('jp-cafe-chillhop');
    expect(workspace.labelKo).toBe('일본 카페 CHILI LAB');
    expect(workspace.defaultLyricLanguage).toBe('japanese');
    expect(workspace.contentTier).toBe('adult');
    expect(workspace.archetypeIds).toEqual(['jp-cafe-chillhop']);
    expect(workspace.defaultAudienceProfileId).toBe('jp-cafe-chillhop');
    expect(workspaceForArchetype('jp-cafe-chillhop')?.id).toBe('jp-cafe-chillhop');

    expect(cafeChannel).toMatchObject({
      id: 'jp-cafe-chili-lab',
      name: '日本 Café CHILI LAB',
      primaryLanguage: 'japanese',
      market: 'japan',
      audience: 'twenties',
      archetype: 'jp-cafe-chillhop'
    });
    expect(cafeChannel.visualIdentity).toContain('Japanese cafe background');
    expect(cafeChannel.visualIdentity).toContain('recurring anime couple');
    expect(cafeChannel.visualIdentity).toContain('left title safe zone');

    expect(CORE_GENRE_IDS_BY_ARCHETYPE['jp-cafe-chillhop']).toEqual([...JP_CAFE_CHILLHOP_CORE_GENRE_IDS]);
    expect(CORE_GENRE_IDS_BY_ARCHETYPE['jp-cafe-chillhop'].every(id => CORE_GENRE_IDS_BY_ARCHETYPE['en-chillhop'].includes(id))).toBe(true);
    expect(new Set(genrePacks.map(genre => genre.id)).size).toBe(genrePacks.length);

    const cafeThemes = lyricThemesForOptions(optsForChannel(cafeChannel));
    expect(cafeThemes.length).toBeGreaterThanOrEqual(80);
    expect(cafeThemes.filter(theme => theme.cafeLocation && theme.cafeType && theme.cafeSeason && theme.cafeTimeOfDay && theme.cafeWeather && theme.storyBeat)).toHaveLength(cafeThemes.length);
    expect(cafeThemes.some(theme => /airport|moving|office|commute/i.test(theme.scene))).toBe(false);

    expect(moneyChordRotationPool('jp-cafe-chillhop')).toHaveLength(6);
    expect(suitablePresetsForArchetype('jp-cafe-chillhop')).toHaveLength(19);
    expect(introTexturesForArchetype('jp-cafe-chillhop').length).toBeGreaterThanOrEqual(10);
    expect(killingPointSetForNonKidsArchetype('jp-cafe-chillhop')).toHaveLength(12);
    expect(hookVocabularySize('jp-cafe-chillhop')).toBeGreaterThan(0);

    const audience = audienceProfileForChannelArchetype('jp-cafe-chillhop', cafeChannel.audience);
    expect(audience.id).toBe('jp-cafe-chillhop');
    expect(audience.constraints.join(' ')).toMatch(/cafe/i);
    expect(audience.hardExclusions?.join(' ')).toMatch(/festival EDM|big-room|enka/i);

    const soundFloor = channelSoundFloorForArchetype('jp-cafe-chillhop');
    expect(soundFloor?.workspaceId).toBe('jp-cafe-chillhop');
    expect(soundFloor?.requiredAtoms.join(' ')).toMatch(/cafe|Rhodes|lo-fi/i);
    expect(soundFloor?.forbiddenAtoms.join(' ')).toMatch(/festival EDM|big-room|hard trap|enka/i);

    const vocalFloor = channelVocalFloorForArchetype('jp-cafe-chillhop');
    expect(vocalFloor?.workspaceId).toBe('jp-cafe-chillhop');
    expect(vocalFloor?.requiredTraits.join(' ')).toMatch(/Japanese|cafe|conversational/i);
    expect(vocalFloor?.forbiddenTraits.join(' ')).toMatch(/belting|shouting|enka|soundalike/i);

    expect(computeWorkspaceReadiness(workspace, 0)).toMatchObject({ passCount: 4, total: 5 });
    expect(computeWorkspaceReadiness(workspace, 1)).toMatchObject({ passCount: 5, total: 5 });
  });

  it('saves and restores the three Cafe Story Mode contracts with exact vocal quotas', () => {
    const expectations: Record<ChiliStoryPov, { quota: { male: number; female: number; mixed: number }; speaker: 'couple' | 'male' | 'female' }> = {
      couple: { quota: { male: 6, female: 6, mixed: 3 }, speaker: 'couple' },
      male: { quota: { male: 15, female: 0, mixed: 0 }, speaker: 'male' },
      female: { quota: { male: 0, female: 15, mixed: 0 }, speaker: 'female' }
    };

    for (const mode of ['couple', 'male', 'female'] as const) {
      const opts = optsForCafe(mode);
      expect(CAFE_STORY_MODE_LABEL_JA[mode]).toMatch(/CAFÉ STORY/);
      expect(opts.lyricLanguage).toBe('japanese');
      expect(opts.storyPov).toBe(mode);
      expect(opts.cafeStoryMode).toBe(mode);
      expect(opts.perspective).toBe('firstPerson');
      expect(opts.perspectiveMode).toBe('fixed');
      expect(opts.scenePlanningMode).toBe('same-story-comparison');
      expect(opts.songCount).toBe(15);
      expect(opts.vocalQuota).toEqual(expectations[mode].quota);
      expect(opts.vocalQuotaMode).toBeUndefined();
      expect(opts.storyVocalQuotaSource).toBe('story-contract');
      expect(vocalQuotaForCafeStoryMode(mode, 15)).toEqual(expectations[mode].quota);
      expect(storyMetaFieldsFromOptions(opts)).toMatchObject({
        workspaceId: 'jp-cafe-chillhop',
        storyPov: mode,
        cafeStoryMode: mode,
        storySpeaker: expectations[mode].speaker,
        storySourceLine: CAFE_SOURCE.storySourceLine,
        season: CAFE_SOURCE.cafeSeason,
        cafeLocation: CAFE_SOURCE.cafeLocation,
        cafeType: CAFE_SOURCE.cafeType
      });

      const restored = applyChiliStoryGenerationContract(JSON.parse(JSON.stringify(opts)) as GenerationOptions);
      expect(restored.cafeStoryMode).toBe(mode);
      expect(restored.cafeLocation).toBe(CAFE_SOURCE.cafeLocation);
      expect(restored.cafeWeather).toBe(CAFE_SOURCE.cafeWeather);
      expect(restored.vocalQuota).toEqual(expectations[mode].quota);
      expect(restored.storyVocalQuotaSource).toBe('story-contract');
    }

    const broadJp = applyChiliStoryGenerationContract(optsForChannel(jpChannel, {
      storyPov: 'couple',
      cafeStoryMode: 'female',
      storySourceSummary: '同じ駅前で再会する広い関係ストーリー。'
    }));
    expect(storyMetaFieldsFromOptions(broadJp)).toMatchObject({ workspaceId: 'jp-chillhop', storyPov: 'couple' });
    expect(storyMetaFieldsFromOptions(broadJp)).not.toHaveProperty('cafeStoryMode');
  });

  it('hands Cafe Story Mode through the official bridge instruction and import metadata path', () => {
    const opts = optsForCafe('couple');
    const genres = genresFor(opts);
    const moods = moodsFor(opts);
    const slots = preallocateSongSlots(opts, genres);
    const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots, false);

    expect(slots).toHaveLength(15);
    expect(vocalCounts(slots)).toEqual({ male: 6, female: 6, mixed: 3 });
    expect(slots.filter(slot => slot.vocalType === 'mixed').length).toBeLessThan(slots.length / 2);
    expect(new Set(slots.map(slot => slot.storySpeaker))).toEqual(new Set(['male', 'female', 'couple']));
    expect(actCounts(slots)).toEqual([3, 3, 3, 3, 3]);
    expect(slots.every(slot => slot.lyricTheme?.startsWith('jpcafe-source-local-act'))).toBe(true);
    expect(new Set(slots.map(slot => slot.vocabularyBankId)).size).toBeGreaterThanOrEqual(5);
    expect(slots.every(slot => !containsChiliStoryFutureStageViolation(`${slot.lyricThemeText} ${slot.storyArcRole}`))).toBe(true);

    expect(instruction).toContain('[JP CAFE CHILI LAB STORY CONTRACT]');
    expect(instruction).toContain('Workspace is "jp-cafe-chillhop"');
    expect(instruction).toContain(`Cafe Story Mode is ${CAFE_STORY_MODE_LABEL_JA.couple}`);
    expect(instruction).toContain('Write natively in natural contemporary Japanese');
    expect(instruction).toContain('Cafe setting supplied by app: Tokyo Kichijoji cafe lane / quiet roaster cafe / spring rain / late afternoon / soft rain');
    expect(instruction).toContain('5-act cafe story album');
    expect(instruction).toContain('follow preassignedSongs vocalType exactly');
    expect(instruction).toContain('male 6/15, female 6/15, mixed/duet 3/15');
    expect(instruction).toContain('Titles and hookPhrase values must be source-local');
    expect(instruction).toContain('Cafe sound policy');
    expect(instruction).toContain('Do not imitate, name, evoke as soundalike, clone');

    const meta = storyMetaFieldsFromOptions(opts);
    const raw = JSON.stringify({ meta, songs: cafeBridgeSongs(slots) });
    expect(extractBridgeImportMeta(raw)).toMatchObject({
      workspaceId: 'jp-cafe-chillhop',
      storyPov: 'couple',
      cafeStoryMode: 'couple',
      storySourceLine: CAFE_SOURCE.storySourceLine,
      storySourceTitle: CAFE_SOURCE.storySourceTitle,
      storySourceSummary: CAFE_SOURCE.storySourceSummary,
      cafeLocation: CAFE_SOURCE.cafeLocation,
      cafeType: CAFE_SOURCE.cafeType,
      season: CAFE_SOURCE.cafeSeason,
      storySpeaker: 'couple'
    });

    const report = importSongsJson(raw, opts, genres, moods, season, slots);
    expect(report.importedCount).toBe(15);
    expect(report.blueprint?.meta).toMatchObject({
      workspaceId: 'jp-cafe-chillhop',
      storyPov: 'couple',
      cafeStoryMode: 'couple',
      storySourceLine: CAFE_SOURCE.storySourceLine,
      storySourceTitle: CAFE_SOURCE.storySourceTitle,
      storySourceSummary: CAFE_SOURCE.storySourceSummary,
      cafeLocation: CAFE_SOURCE.cafeLocation,
      cafeType: CAFE_SOURCE.cafeType,
      cafeSeason: CAFE_SOURCE.cafeSeason,
      season: CAFE_SOURCE.cafeSeason,
      storySpeaker: 'couple'
    });

    const songs = report.blueprint?.songs ?? [];
    expect(songs).toHaveLength(15);
    expect(vocalCounts(songs)).toEqual({ male: 6, female: 6, mixed: 3 });
    expect(actCounts(songs)).toEqual([3, 3, 3, 3, 3]);
    expect(new Set(songs.map(song => song.title)).size).toBe(15);
    expect(new Set(songs.map(song => song.hookPhrase)).size).toBe(15);
    expect(songs.filter(song => /[가-힣]/.test(song.lyrics))).toHaveLength(0);
    expect(songs.filter(song => /[A-Za-z]{3,}/.test(lyricBody(song)))).toHaveLength(0);
    expect(songs.every(song => song.lyrics.includes('カフェ') || song.lyrics.includes('コーヒー'))).toBe(true);

    const quality = evaluateJapaneseChiliQuality(songs, {
      channel: cafeChannel,
      language: 'japanese',
      cafeStoryMode: 'couple',
      songCount: 15
    });
    expect(quality.applies).toBe(true);
    expect(quality.languageFailureTrackNos).toEqual([]);
    expect(quality.vocalCounts).toEqual({ male: 6, female: 6, mixed: 3, unknown: 0 });
    expect(quality.actCounts).toEqual({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 });
    expect(quality.packWarnings.filter(warning => /duplicate|vocal balance|5-act/.test(warning))).toEqual([]);

    const legacySongs = cafeBridgeSongs(slots).map(song => {
      const legacySong = { ...song };
      delete legacySong.cafeStoryMode;
      delete legacySong.cafeLocation;
      delete legacySong.cafeType;
      delete legacySong.cafeSeason;
      delete legacySong.cafeTimeOfDay;
      delete legacySong.cafeWeather;
      delete legacySong.storySpeaker;
      return legacySong;
    });
    const legacyRaw = JSON.stringify({ songs: legacySongs });
    expect(extractBridgeImportMeta(legacyRaw)).toBeNull();
    const legacyReport = importSongsJson(legacyRaw, opts, genres, moods, season, slots);
    expect(legacyReport.importedCount).toBe(15);
    expect(legacyReport.blueprint?.meta).toMatchObject({ workspaceId: 'jp-cafe-chillhop', cafeStoryMode: 'couple' });
  });

  it('keeps male and female Cafe Story Mode bridge runs fully vocal locked', () => {
    for (const mode of ['male', 'female'] as const) {
      const opts = optsForCafe(mode);
      const genres = genresFor(opts);
      const moods = moodsFor(opts);
      const slots = preallocateSongSlots(opts, genres);
      const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots, false);
      const report = importSongsJson(JSON.stringify({ meta: storyMetaFieldsFromOptions(opts), songs: cafeBridgeSongs(slots) }), opts, genres, moods, season, slots);
      const songs = report.blueprint?.songs ?? [];

      expect(vocalCounts(slots)).toEqual(mode === 'male' ? { male: 15, female: 0, mixed: 0 } : { male: 0, female: 15, mixed: 0 });
      expect(instruction).toContain(`Cafe Story Mode is ${CAFE_STORY_MODE_LABEL_JA[mode]}`);
      expect(instruction).toContain(`every one of the 15 songs is ${mode} vocal only`);
      expect(instruction).toContain(mode === 'male' ? 'male 15/15, female 0/15, mixed/duet 0/15' : 'male 0/15, female 15/15, mixed/duet 0/15');
      expect(report.importedCount).toBe(15);
      expect(vocalCounts(songs)).toEqual(mode === 'male' ? { male: 15, female: 0, mixed: 0 } : { male: 0, female: 15, mixed: 0 });

      const quality = evaluateJapaneseChiliQuality(songs, {
        channel: cafeChannel,
        language: 'japanese',
        cafeStoryMode: mode,
        songCount: 15
      });
      expect(quality.languageFailureTrackNos).toEqual([]);
      expect(quality.packWarnings.filter(warning => /vocal hard lock|5-act|duplicate/.test(warning))).toEqual([]);
    }
  });

  it('keeps Cafe male, female, and couple contracts stable across every v6 engine profile', () => {
    const expected = {
      male: { male: 15, female: 0, mixed: 0 },
      female: { male: 0, female: 15, mixed: 0 },
      couple: { male: 6, female: 6, mixed: 3 }
    } as const;

    for (const model of ['v6', 'v6-wild', 'v6-mini'] as const) {
      for (const mode of ['male', 'female', 'couple'] as const) {
        const opts = optsForCafe(mode, { sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } });
        const genres = genresFor(opts);
        const slots = preallocateSongSlots(opts, genres);
        const instruction = buildClaudeCodeInstruction(opts, genres, moodsFor(opts), season, { usedTitles: [], usedHooks: [] }, slots, false);
        expect(opts.lyricLanguage, `${model}/${mode} language`).toBe('japanese');
        expect(opts.perspective, `${model}/${mode} POV`).toBe('firstPerson');
        expect(vocalCounts(slots), `${model}/${mode} quota`).toEqual(expected[mode]);
        expect(actCounts(slots), `${model}/${mode} acts`).toEqual([3, 3, 3, 3, 3]);
        expect(slots.every(slot => slot.cafeStoryMode === mode), `${model}/${mode} cafe mode`).toBe(true);
        expect(slots.every(slot => slot.cafeLocation && slot.cafeType && slot.cafeSeason && slot.cafeTimeOfDay && slot.cafeWeather), `${model}/${mode} cafe source fields`).toBe(true);
        expect(instruction, `${model}/${mode} engine`).toContain(`Model: ${model}`);
        expect(instruction, `${model}/${mode} contract`).toContain('[JP CAFE CHILI LAB STORY CONTRACT]');
        expect(instruction, `${model}/${mode} lock`).toContain(`Cafe Story Mode is ${CAFE_STORY_MODE_LABEL_JA[mode]}`);
        expect(instruction, `${model}/${mode} Japanese`).toContain('Write natively in natural contemporary Japanese');
      }
    }
  });
});
