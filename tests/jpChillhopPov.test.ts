import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import {
  applyChiliStoryGenerationContract,
  CHILI_STORY_DEFAULT_SONG_COUNT,
  CHILI_STORY_POV_LABEL_JA,
  parseChiliStoryLine,
  storyMetaFieldsFromOptions
} from '../src/core/chiliStoryPov';
import { evaluateJapaneseChiliQuality } from '../src/core/japaneseChiliQuality';
import { resolveScenePlanningMode } from '../src/core/scenePlanningMode';
import { CORE_GENRE_IDS_BY_ARCHETYPE } from '../src/data/genreLibrary';
import { getWorkspace, workspaceDefinitions } from '../src/data/workspaces';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import type { ChiliStoryPov, GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

const channel = channelPresets.find(preset => preset.id === 'jp-chili-lab-story')!;
const season = seasonPacks.find(item => item.id === 'christmas') ?? seasonPacks[0];

const STORY_SOURCE = {
  storySourceEpisodeId: '003',
  storySourceTitle: '雨のホーム',
  storySourceSummary: 'ひとつの傘で終電のホームまで歩いた夜。言えなかった言葉だけが雨音に残った。',
  storyPreviousContext: 'まだ名前で呼び合えない距離のまま、短いメッセージだけが続いていた。',
  storyNextHint: '次の夜、既読のまま止まった返信がふたりの誤解になる。',
  storyLocation: '下北沢の駅前',
  storySeason: 'late autumn rain'
};

const JAPANESE_TITLES = [
  '雨のホーム',
  '傘の半分',
  '終電前の息',
  '近い肩先',
  '窓際の告白',
  '既読の夜',
  '遅れた返信',
  '言えない名前',
  'すれ違う改札',
  '選び直す夜',
  '小さな本音',
  '朝までの約束',
  '洗いたての空',
  '同じ駅の光',
  '余韻のコーヒー'
];

const JAPANESE_HOOKS = [
  '雨音だけが知っている',
  '傘の半分で近づく',
  '終電前に息を止めた',
  '肩先だけが本当だった',
  '窓の向こうで言えたなら',
  '既読の夜を抱きしめる',
  '遅れた返信が揺れている',
  '名前の奥で迷っている',
  '改札の前でほどけていく',
  '選び直す夜に戻る',
  '小さな本音を渡したい',
  '朝まで約束をほどかない',
  '洗いたての空が見える',
  '同じ駅で光を待つ',
  'コーヒーの湯気に残る'
];

function optsFor(storyPov: ChiliStoryPov, overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return applyChiliStoryGenerationContract(makeOptions({
    channel,
    projectTitle: `${CHILI_STORY_POV_LABEL_JA[storyPov]} fixture`,
    songCount: CHILI_STORY_DEFAULT_SONG_COUNT,
    lyricLanguage: 'japanese',
    market: channel.market,
    audience: channel.audience,
    genreIds: CORE_GENRE_IDS_BY_ARCHETYPE['jp-chillhop'].slice(0, 6),
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    perspectiveMode: 'fixed',
    customConcept: STORY_SOURCE.storySourceSummary,
    storyPov,
    ...STORY_SOURCE,
    ...overrides
  }));
}

function genresFor(opts: GenerationOptions) {
  return genrePacks.filter(genre => opts.genreIds.includes(genre.id));
}

function moodsFor(opts: GenerationOptions) {
  return moodPacks.filter(mood => opts.moodIds.includes(mood.id));
}

function vocalTag(slot: PreassignedSongSlot): string {
  if (slot.vocalType === 'female') return '[female vocal]';
  if (slot.vocalType === 'mixed') return '[duet vocal]';
  return '[male vocal]';
}

function lyricsFor(slot: PreassignedSongSlot, hook: string): string {
  const subject = slot.storyPov === 'female'
    ? '私は濡れた前髪を直しながら、あなたの横顔にまだ返せない言葉を探していた'
    : slot.storyPov === 'male'
      ? '僕は濡れた袖を隠しながら、君の歩幅に合わせてまだ言えない言葉を飲み込んだ'
      : '雨の歩道でふたりは少しだけ黙り、ひとつの傘の下で同じ信号を待っていた';
  return [
    vocalTag(slot),
    '[verse]',
    subject,
    '終電のアナウンスが遠くで揺れて、駅前の灯りだけがやさしく滲んでいた',
    '[pre-chorus]',
    '返事を急がないふりをしても、胸の奥では小さな音がずっと鳴っている',
    '[chorus]',
    hook,
    '雨音の向こうで同じ景色をまだ覚えている',
    hook,
    '言えなかった気持ちほど静かに近くで息をする',
    hook,
    '[bridge]',
    '次の朝になっても消えない匂いを、ポケットの中でそっと確かめた'
  ].join('\n');
}

function bridgeSongs(slots: readonly PreassignedSongSlot[]): Partial<SongIdea>[] {
  return slots.map((slot, index) => ({
    trackNo: slot.trackNo,
    title: JAPANESE_TITLES[index] ?? `雨の記憶 ${slot.trackNo}`,
    hookPhrase: JAPANESE_HOOKS[index] ?? `雨音の記憶 ${slot.trackNo}`,
    stylePrompt: `${slot.vocalText ?? 'intimate Japanese vocal'}, ${slot.genreText ?? 'modern Japanese chillhop'}, ${slot.moneyChordText}, ${slot.tempo} BPM, Rhodes keys, soft drums, warm bass, compact Suno-ready style prompt`,
    lyrics: lyricsFor(slot, JAPANESE_HOOKS[index] ?? `雨音の記憶 ${slot.trackNo}`),
    seasonMoment: STORY_SOURCE.storySeason,
    listenerSituation: `${STORY_SOURCE.storyLocation} / ${slot.storyActLabel}`,
    emotionArc: slot.storyArcRole ?? '',
    storyPov: slot.storyPov,
    storySourceEpisodeId: slot.storySourceEpisodeId,
    storySourceTitle: slot.storySourceTitle,
    storySourceSummary: slot.storySourceSummary,
    storyPreviousContext: slot.storyPreviousContext,
    storyNextHint: slot.storyNextHint,
    storyLocation: slot.storyLocation,
    storySeason: slot.storySeason,
    storyAct: slot.storyAct,
    storyActLabel: slot.storyActLabel,
    storyArcRole: slot.storyArcRole,
    youtube: {
      title: JAPANESE_TITLES[index] ?? `雨の記憶 ${slot.trackNo}`,
      description: 'JP CHILI LAB STORY fixture',
      tags: ['japanese chillhop', 'story album']
    }
  }));
}

function runBridgeFixture(opts: GenerationOptions) {
  const genres = genresFor(opts);
  const moods = moodsFor(opts);
  const slots = preallocateSongSlots(opts, genres);
  const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots, false);
  const raw = JSON.stringify({ meta: storyMetaFieldsFromOptions(opts), songs: bridgeSongs(slots) });
  const report = importSongsJson(raw, opts, genres, moods, season, slots);
  return { slots, instruction, report };
}

describe('[instruction 79] jp-chillhop STORY POV workspace', () => {
  it('registers exactly one JP CHILI LAB workspace and channel profile without replacing existing workspaces', () => {
    const ids = workspaceDefinitions.map(workspace => workspace.id);
    expect(ids).toContain('en-chillhop');
    expect(ids).toContain('jp-chillhop');
    expect(new Set(ids).size).toBe(ids.length);

    const workspace = getWorkspace('jp-chillhop');
    expect(workspace.defaultLyricLanguage).toBe('japanese');
    expect(workspace.archetypeIds).toEqual(['jp-chillhop']);
    expect(workspace.defaultAudienceProfileId).toBe('jp-chillhop');

    const jpChillhopChannels = channelPresets.filter(preset => preset.archetype === 'jp-chillhop');
    expect(jpChillhopChannels.map(preset => preset.id)).toEqual(['jp-chili-lab-story']);
    expect(CORE_GENRE_IDS_BY_ARCHETYPE['jp-chillhop']).toEqual(CORE_GENRE_IDS_BY_ARCHETYPE['en-chillhop']);
  });

  it('parses one-line story input and connects solo POV source summaries to same-story-comparison mode', () => {
    expect(parseChiliStoryLine('003. 雨のホーム — ひとつの傘で終電まで歩いた夜')).toEqual({
      storySourceEpisodeId: '003',
      storySourceTitle: '雨のホーム',
      storySourceSummary: 'ひとつの傘で終電まで歩いた夜'
    });

    const opts = optsFor('male');
    expect(resolveScenePlanningMode(opts, undefined)).toBe('same-story-comparison');

    const withoutSummary = applyChiliStoryGenerationContract({ ...opts, storySourceSummary: '', scenePlanningMode: 'same-story-comparison' });
    expect(withoutSummary.scenePlanningMode).toBeUndefined();
  });

  it('hard-locks 彼のSTORY to Japanese, first-person fixed mode, and male vocals for all 15 tracks', () => {
    const opts = optsFor('male', {
      lyricLanguage: 'english',
      perspective: 'thirdPerson',
      perspectiveMode: 'varied'
    });
    expect(opts.lyricLanguage).toBe('japanese');
    expect(opts.perspective).toBe('firstPerson');
    expect(opts.perspectiveMode).toBe('fixed');
    expect(opts.vocalQuota).toEqual({ male: 15, female: 0, mixed: 0 });

    const { slots, instruction, report } = runBridgeFixture(opts);
    expect(slots).toHaveLength(15);
    expect(slots.every(slot => slot.vocalType === 'male')).toBe(true);
    expect(slots.filter(slot => slot.vocalType === 'female' || slot.vocalType === 'mixed')).toHaveLength(0);
    expect(new Set(slots.map(slot => slot.storyAct))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect([1, 2, 3, 4, 5].map(act => slots.filter(slot => slot.storyAct === act).length)).toEqual([3, 3, 3, 3, 3]);

    expect(instruction).toContain('[JP CHILI LAB STORY POV CONTRACT]');
    expect(instruction).toContain('POV selector is 彼のSTORY');
    expect(instruction).toContain('Write natively in natural contemporary Japanese');
    expect(instruction).toContain('VOCAL HARD LOCK: every one of the 15 songs is male vocal only');
    expect(instruction).toContain('Treat the pack as one 5-act story album');
    expect(instruction).toContain('Keep Suno "stylePrompt" and "lyrics" separate');

    expect(report.importedCount).toBe(15);
    expect(report.blueprint?.meta?.workspaceId).toBe('jp-chillhop');
    expect(report.blueprint?.meta?.storyPov).toBe('male');
    expect(report.blueprint?.songs.every(song => song.storyPov === 'male')).toBe(true);
    expect(report.blueprint?.songs.every(song => song.effectiveArchetype === 'jp-chillhop')).toBe(true);

    const quality = evaluateJapaneseChiliQuality(report.blueprint!.songs, {
      channel,
      language: opts.lyricLanguage,
      storyPov: 'male',
      songCount: opts.songCount
    });
    expect(quality.applies).toBe(true);
    expect(quality.vocalCounts).toEqual({ male: 15, female: 0, mixed: 0, unknown: 0 });
    expect(quality.languageFailureTrackNos).toEqual([]);
    expect(quality.actCounts).toEqual({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 });
  });

  it('hard-locks 彼女のSTORY to female vocals and still represents all 5 acts in a dynamic 12-track run', () => {
    const opts = optsFor('female', { songCount: 12 });
    expect(opts.vocalQuota).toEqual({ male: 0, female: 12, mixed: 0 });

    const { slots, instruction, report } = runBridgeFixture(opts);
    expect(slots).toHaveLength(12);
    expect(slots.every(slot => slot.vocalType === 'female')).toBe(true);
    expect(slots.filter(slot => slot.vocalType === 'male' || slot.vocalType === 'mixed')).toHaveLength(0);
    expect(new Set(slots.map(slot => slot.storyAct))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(instruction).toContain('POV selector is 彼女のSTORY');
    expect(instruction).toContain('VOCAL HARD LOCK: every one of the 12 songs is female vocal only');

    expect(report.importedCount).toBe(12);
    expect(report.blueprint?.meta?.storyPov).toBe('female');
    expect(report.blueprint?.songs.every(song => song.storyPov === 'female')).toBe(true);
  });

  it('keeps couple POV additive and leaves en-chillhop / jp-2030 behavior unpolluted', () => {
    const couple = optsFor('couple');
    expect(couple.lyricLanguage).toBe('japanese');
    expect(couple.vocalQuota).toBeUndefined();
    expect(couple.perspectiveMode).toBe('fixed');

    const { report } = runBridgeFixture(couple);
    expect(report.importedCount).toBe(15);
    expect(report.blueprint?.meta?.storyPov).toBe('couple');

    const enChillhop = channelPresets.find(preset => preset.archetype === 'en-chillhop')!;
    const enOpts = applyChiliStoryGenerationContract(makeOptions({
      channel: enChillhop,
      lyricLanguage: 'english',
      storyPov: 'male',
      storySourceSummary: STORY_SOURCE.storySourceSummary
    }));
    expect(enOpts.lyricLanguage).toBe('english');
    expect(enOpts.vocalQuota).toBeUndefined();
    expect(enOpts.scenePlanningMode).toBeUndefined();

    const jp2030 = channelPresets.find(preset => preset.archetype === 'jp-2030-pop')!;
    const jp2030Opts = applyChiliStoryGenerationContract(makeOptions({
      channel: jp2030,
      lyricLanguage: 'japanese',
      storyPov: 'female',
      storySourceSummary: STORY_SOURCE.storySourceSummary
    }));
    expect(jp2030Opts.vocalQuota).toBeUndefined();
    expect(jp2030Opts.scenePlanningMode).toBeUndefined();
  });

  it('runs four practical bridge fixtures through instruction -> songs-output.json -> import without API calls', () => {
    const fixtures: Array<{ label: string; pov: ChiliStoryPov; songCount: number }> = [
      { label: 'male rainy platform', pov: 'male', songCount: 15 },
      { label: 'female rainy platform', pov: 'female', songCount: 15 },
      { label: 'couple rainy platform', pov: 'couple', songCount: 15 },
      { label: 'female dynamic twelve', pov: 'female', songCount: 12 }
    ];

    for (const fixture of fixtures) {
      const opts = optsFor(fixture.pov, {
        projectTitle: fixture.label,
        songCount: fixture.songCount
      });
      const { slots, instruction, report } = runBridgeFixture(opts);
      expect(instruction, fixture.label).toContain('[JP CHILI LAB STORY POV CONTRACT]');
      expect(report.importedCount, fixture.label).toBe(fixture.songCount);
      expect(report.blueprint?.meta?.workspaceId, fixture.label).toBe('jp-chillhop');
      expect(report.blueprint?.songs, fixture.label).toHaveLength(fixture.songCount);
      if (fixture.pov === 'male') {
        expect(slots.every(slot => slot.vocalType === 'male'), fixture.label).toBe(true);
      }
      if (fixture.pov === 'female') {
        expect(slots.every(slot => slot.vocalType === 'female'), fixture.label).toBe(true);
      }
    }
  });
});
