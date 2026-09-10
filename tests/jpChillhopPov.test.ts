import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { directSetLocal } from '../src/core/setDirector';
import { evaluateGenerationRequest } from '../src/core/generationPreflight';
import { buildResolvedGenerationContract, userChoicesFromOptions } from '../src/core/userChoices';
import {
  applyChiliStoryGenerationContract,
  CHILI_STORY_DEFAULT_SONG_COUNT,
  CHILI_STORY_LEGACY_PROJECT_TITLE,
  CHILI_STORY_POV_LABEL_JA,
  clearChiliStorySoloVocalLock,
  isStoryVocalHardLocked,
  parseChiliStoryLine,
  parseChiliStoryPlanLine,
  parseChiliStorySourceLine,
  resolveChiliStorySource,
  resolveEffectiveStoryVocalQuota,
  resolveChiliStoryProjectTitle,
  storyMetaFieldsFromOptions
} from '../src/core/chiliStoryPov';
import {
  containsChiliStoryFutureStageViolation,
  inferChiliStoryRelationshipStage,
  isSourceLocalChiliStoryScene,
  planChiliStoryScenes,
  planChiliStoryTitlesAndHooks
} from '../src/core/chiliStoryScenePlanner';
import { evaluateJapaneseChiliQuality } from '../src/core/japaneseChiliQuality';
import { resolveScenePlanningMode } from '../src/core/scenePlanningMode';
import { SUNO_V6_ENGINE_PROFILES } from '../src/core/sunoV6';
import { CORE_GENRE_IDS_BY_ARCHETYPE } from '../src/data/genreLibrary';
import { getWorkspace, workspaceDefinitions } from '../src/data/workspaces';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import type { AxisAllocation, ChiliStoryPov, GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

const channel = channelPresets.find(preset => preset.id === 'jp-chili-lab-story')!;
const season = seasonPacks.find(item => item.id === 'christmas') ?? seasonPacks[0];
const projectRoot = resolve(__dirname, '..');

const STORY_SOURCE = {
  storySourceLine: '003. 雨のホーム — ひとつの傘で終電のホームまで歩いた夜',
  storySourceEpisodeId: '003',
  storySourceTitle: '雨のホーム',
  storySourceSummary: 'ひとつの傘で終電のホームまで歩いた夜。言えなかった言葉だけが雨音に残った。',
  storyPreviousContext: 'まだ名前で呼び合えない距離のまま、短いメッセージだけが続いていた。',
  storyNextHint: '次の夜、既読のまま止まった返信がふたりの誤解になる。',
  storyLocation: '下北沢の駅前',
  storySeason: 'late autumn rain'
};

const TRAIN_PLAN_FEMALE = '001. 目が合っただけなのに — 본편 EP.001 「기차에서 처음 만남」. 같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다. 그 뒤 그녀는 작은 행동의 의미를 혼자 오래 되짚다가, 그때 말하지 못한 기대와 자신이 정말 원했던 다음 행동을 돌아본다.';
const TRAIN_PLAN_MALE = '001. 窓ぎわの君が気になった — 본편 EP.001 「기차에서 처음 만남」. 같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다. 그 뒤 그는 설렘을 인정하지 않으려 했지만, 겉으로 숨겼던 이유와 말하지 못한 마음을 자기 시점에서 되짚는다.';
const JAPANESE_TITLE_RE = /[ぁ-んァ-ヶ一-龯]/u;

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

function optsForPlanLine(storyPov: ChiliStoryPov, planLine: string, overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const parsed = parseChiliStoryPlanLine(planLine);
  return applyChiliStoryGenerationContract(makeOptions({
    channel,
    projectTitle: `${CHILI_STORY_POV_LABEL_JA[storyPov]} plan-line fixture`,
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
    customConcept: parsed?.storySourceSummary ?? planLine,
    storyPov,
    storyPlanLine: planLine,
    storySourceLine: planLine,
    ...(parsed?.storyPlanEpisodeId ? { storyPlanEpisodeId: parsed.storyPlanEpisodeId } : {}),
    ...(parsed?.storyPovTitle ? { storyPovTitle: parsed.storyPovTitle } : {}),
    ...(parsed?.storySourceEpisodeId ? { storySourceEpisodeId: parsed.storySourceEpisodeId } : {}),
    ...(parsed?.storySourceTitle ? { storySourceTitle: parsed.storySourceTitle } : {}),
    ...(parsed?.storySourceSummary ? { storySourceSummary: parsed.storySourceSummary } : {}),
    ...(parsed?.storyPovIntentSummary ? { storyPovIntentSummary: parsed.storyPovIntentSummary } : {}),
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

function vocalAllocationCounts(allocations: AxisAllocation[] | undefined) {
  return allocations?.find(allocation => allocation.axis === 'vocalType')?.counts;
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
    storySourceLine: slot.storySourceLine,
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

  it('wires the Story hard-lock helpers into the UI-facing Step2 and Step3 surfaces', () => {
    const concept = readFileSync(resolve(projectRoot, 'src/components/steps/Step2Concept.tsx'), 'utf8');
    const plan = readFileSync(resolve(projectRoot, 'src/components/steps/Step2Plan.tsx'), 'utf8');
    const generate = readFileSync(resolve(projectRoot, 'src/components/steps/Step3Generate.tsx'), 'utf8');

    expect(concept).toContain('storyInputUiModeForWorkspace');
    expect(concept).toContain('STORY 기획안 한 줄');
    expect(concept).toContain('기획안 해석');
    expect(concept).toContain('사건 요약');
    expect(concept).toContain('hasChiliStoryVocalLock');
    expect(concept).toContain('STORY POV를 지키기 위해 배정 방식을 선택할 수 없습니다.');
    expect(plan).toContain('isStoryVocalHardLocked(gateOpts)');
    expect(plan).toContain('STORY 고정');
    expect(plan).toContain("!(storyVocalLock.locked && editingAxis === 'vocalType')");
    expect(generate).toContain('const effectiveStoryOpts = useMemo(() => applyChiliStoryGenerationContract(opts), [opts]);');
    expect(generate).toContain('STORY ${storyVocalLock.gender');
    expect(generate).toContain('100% 고정');
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

  it('accepts short and numberless source lines and prefers a separately edited summary', () => {
    expect(parseChiliStorySourceLine('002. 雨のホーム')).toEqual({
      storySourceEpisodeId: '002',
      storySourceTitle: '雨のホーム'
    });
    expect(parseChiliStorySourceLine('雨のホーム')).toEqual({ storySourceTitle: '雨のホーム' });
    expect(resolveChiliStorySource({
      rawLine: '002. 雨のホーム — inline summary',
      separateSummary: 'edited event summary'
    })).toEqual({
      storySourceEpisodeId: '002',
      storySourceTitle: '雨のホーム',
      storySourceSummary: 'edited event summary'
    });
  });

  it('splits the real one-line CHILI plan into POV title, source episode/title/event, and intent', () => {
    const line = '001. 夜の改札 | EP.001 "駅前で初めて会う". 同じ傘を見つめた夜、ふたりの距離が少し縮まる。彼は言えなかった言葉を次の約束に託す。';
    const plan = parseChiliStoryPlanLine(line);
    expect(plan).toMatchObject({
      storyPlanEpisodeId: '001',
      storyPovTitle: '夜の改札',
      storySourceEpisodeId: '001',
      storySourceTitle: '駅前で初めて会う',
      storySourceSummary: '同じ傘を見つめた夜、ふたりの距離が少し縮まる。',
      storyPovIntentSummary: '彼は言えなかった言葉を次の約束に託す。',
      rawLine: line,
      confidence: 'source-plan',
      planEpisodeId: '001',
      povTitle: '夜の改札',
      sourceEpisodeId: '001',
      sourceTitle: '駅前で初めて会う',
      sourceEventSummary: '同じ傘を見つめた夜、ふたりの距離が少し縮まる。',
      povIntentSummary: '彼は言えなかった言葉を次の約束に託す。'
    });
  });

  it('plans the real EP.001 train first-meeting source locally for 15 bridge slots without future-stage drift', () => {
    const parsedFemale = parseChiliStoryPlanLine(TRAIN_PLAN_FEMALE);
    const parsedMale = parseChiliStoryPlanLine(TRAIN_PLAN_MALE);
    expect(parsedFemale).toMatchObject({
      storyPlanEpisodeId: '001',
      storyPovTitle: '目が合っただけなのに',
      storySourceEpisodeId: '001',
      storySourceTitle: '기차에서 처음 만남',
      storySourceSummary: '같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다.',
      storyPovIntentSummary: '그 뒤 그녀는 작은 행동의 의미를 혼자 오래 되짚다가, 그때 말하지 못한 기대와 자신이 정말 원했던 다음 행동을 돌아본다.',
      confidence: 'source-plan'
    });
    expect(parsedMale).toMatchObject({
      storyPlanEpisodeId: '001',
      storyPovTitle: '窓ぎわの君が気になった',
      storySourceEpisodeId: '001',
      storySourceTitle: '기차에서 처음 만남',
      storySourceSummary: '같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다.',
      storyPovIntentSummary: '그 뒤 그는 설렘을 인정하지 않으려 했지만, 겉으로 숨겼던 이유와 말하지 못한 마음을 자기 시점에서 되짚는다.',
      confidence: 'source-plan'
    });
    expect(inferChiliStoryRelationshipStage({
      storySourceTitle: parsedFemale?.storySourceTitle,
      storySourceSummary: parsedFemale?.storySourceSummary,
      storyPlanLine: TRAIN_PLAN_FEMALE,
      storySourceLine: TRAIN_PLAN_FEMALE
    })).toBe('first-meeting');

    const femaleOpts = optsForPlanLine('female', TRAIN_PLAN_FEMALE);
    const maleOpts = optsForPlanLine('male', TRAIN_PLAN_MALE);
    const femaleScenes = planChiliStoryScenes({ ...femaleOpts, isCafe: false });
    const maleScenes = planChiliStoryScenes({ ...maleOpts, isCafe: false });
    expect(femaleScenes).toHaveLength(15);
    expect(maleScenes).toHaveLength(15);
    expect(femaleScenes.filter(isSourceLocalChiliStoryScene)).toHaveLength(15);
    expect(maleScenes.filter(isSourceLocalChiliStoryScene)).toHaveLength(15);
    expect(planChiliStoryTitlesAndHooks({ ...femaleOpts, isCafe: false, storyScenes: femaleScenes }).map(item => item.title)).toEqual(femaleScenes.map(scene => scene.title));

    const femaleSlots = preallocateSongSlots(femaleOpts, genresFor(femaleOpts));
    const maleSlots = preallocateSongSlots(maleOpts, genresFor(maleOpts));
    expect(femaleSlots).toHaveLength(15);
    expect(maleSlots).toHaveLength(15);
    expect(vocalCounts(femaleSlots)).toEqual({ male: 0, female: 15, mixed: 0 });
    expect(vocalCounts(maleSlots)).toEqual({ male: 15, female: 0, mixed: 0 });
    expect(femaleSlots.map(slot => slot.storyAct)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
    expect(maleSlots.map(slot => slot.storyAct)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
    expect(femaleSlots.every(slot => slot.lyricTheme?.startsWith('jpstory-train-first-meeting-'))).toBe(true);
    expect(maleSlots.every(slot => slot.lyricTheme?.startsWith('jpstory-train-first-meeting-'))).toBe(true);
    expect(new Set(femaleSlots.map(slot => slot.vocabularyBankId)).size).toBe(5);
    expect(new Set(maleSlots.map(slot => slot.vocabularyBankId)).size).toBe(5);
    expect(femaleSlots.every(slot => JAPANESE_TITLE_RE.test(slot.title) && JAPANESE_TITLE_RE.test(slot.hookPhrase))).toBe(true);
    expect(maleSlots.every(slot => JAPANESE_TITLE_RE.test(slot.title) && JAPANESE_TITLE_RE.test(slot.hookPhrase))).toBe(true);
    expect(new Set(femaleSlots.map(slot => slot.title)).size).toBe(15);
    expect(new Set(femaleSlots.map(slot => slot.hookPhrase)).size).toBe(15);
    expect(new Set(maleSlots.map(slot => slot.title)).size).toBe(15);
    expect(new Set(maleSlots.map(slot => slot.hookPhrase)).size).toBe(15);
    expect(femaleSlots.filter(slot => slot.title === slot.hookPhrase).length).toBeLessThanOrEqual(5);
    expect(maleSlots.filter(slot => slot.title === slot.hookPhrase).length).toBeLessThanOrEqual(5);

    const femaleTitles = new Set(femaleSlots.map(slot => slot.title));
    const femaleHooks = new Set(femaleSlots.map(slot => slot.hookPhrase));
    expect(maleSlots.filter(slot => femaleTitles.has(slot.title)).length).toBeLessThanOrEqual(2);
    expect(maleSlots.filter(slot => femaleHooks.has(slot.hookPhrase)).length).toBeLessThanOrEqual(2);

    for (const slot of [...femaleSlots, ...maleSlots]) {
      expect(containsChiliStoryFutureStageViolation(`${slot.title} ${slot.hookPhrase} ${slot.lyricThemeText} ${slot.storyArcRole}`), `T${slot.trackNo}`).toBe(false);
      expect(`${slot.lyricThemeText} ${slot.storyArcRole}`).toMatch(/기차|칸|창가|눈|이어폰|안내|손잡이|문|창문|표|시선|정거장|역/u);
    }

    const { instruction } = runBridgeFixture(femaleOpts);
    expect(instruction).toContain('[JP CHILI LAB STORY PLAN]');
    expect(instruction).toContain('POV TITLE:\n目が合っただけなのに');
    expect(instruction).toContain('SOURCE:\nEP.001 「기차에서 처음 만남」');
    expect(instruction).toContain('SOURCE EVENT:\n같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다.');
    expect(instruction).toContain('VOCAL HARD LOCK:\nevery one of the 15 songs is female vocal only');
    expect(instruction).toContain('"title": "string — natural Japanese primary song title for this track, not English"');
    expect(instruction).not.toContain('episode (unlisted)');
    expect(instruction).not.toContain('untitled');
    expect(instruction).not.toContain('male tenor');
    expect(instruction).not.toContain('playlist-friendly English works well');
    expect(instruction).not.toContain('2-5 words, Title Case');
    const storyPlanInstruction = instruction.split('[JP CHILI LAB STORY PLAN]')[1]?.split('[세트 전체의 완성도')[0] ?? '';
    const lyricSceneInstruction = instruction.split('[Lyric scenes]')[1]?.split('[Vocabulary per track]')[0] ?? '';
    expect(containsChiliStoryFutureStageViolation(`${storyPlanInstruction}\n${lyricSceneInstruction}`)).toBe(false);
  });

  it('keeps female Bridge slots free of a stale male tenor and honors manual genre counts exactly', () => {
    const manualGenreIds = CORE_GENRE_IDS_BY_ARCHETYPE['jp-chillhop'].slice(0, 4);
    const manualCounts = Object.fromEntries(manualGenreIds.map((id, index) => [id, index < 3 ? 4 : 3]));
    const opts = optsFor('female', {
      vocalTone: 'mature soulful male tenor, soft slightly husky close-mic delivery',
      genreIds: [],
      diversityAllocations: [{ axis: 'genre', mode: 'manual', counts: manualCounts }]
    });
    const slots = preallocateSongSlots(opts, []);
    expect(vocalCounts(slots)).toEqual({ male: 0, female: 15, mixed: 0 });
    expect(slots.every(slot => !/male tenor|male baritone|male voice/i.test(`${slot.vocalText} ${slot.vocalVariantText ?? ''}`))).toBe(true);
    expect(Object.fromEntries(manualGenreIds.map(id => [id, slots.filter(slot => slot.genreId === id).length]))).toEqual(manualCounts);
    expect(slots.every(slot => JAPANESE_TITLE_RE.test(slot.title) && JAPANESE_TITLE_RE.test(slot.hookPhrase))).toBe(true);
    expect(slots.every(slot => !slot.title.includes('彼女の視点') && !slot.hookPhrase.includes('彼女の視点'))).toBe(true);
    expect(new Set(slots.map(slot => slot.title)).size).toBe(15);
    expect(new Set(slots.map(slot => slot.hookPhrase)).size).toBe(15);
    const plan = directSetLocal(
      opts.customConcept,
      channel,
      opts.songCount,
      { recentGenreIds: [], recentHooks: [] },
      [],
      opts.vocalTone,
      undefined,
      undefined,
      userChoicesFromOptions(opts),
      opts
    );
    expect(plan.allocations.find(allocation => allocation.axis === 'genre')?.counts).toEqual(manualCounts);
    expect(Object.fromEntries(manualGenreIds.map(id => [id, plan.slots.filter(slot => slot.genreId === id).length]))).toEqual(manualCounts);
    const maleSlots = preallocateSongSlots(optsFor('male'), genresFor(optsFor('male')));
    expect(maleSlots.filter((slot, index) => slots[index]?.title === slot.title).length).toBe(0);
    expect(maleSlots.filter((slot, index) => slots[index]?.hookPhrase === slot.hookPhrase).length).toBe(0);
    expect(slots.filter(slot => slot.title === slot.hookPhrase).length).toBe(0);
    expect(maleSlots.filter(slot => slot.title === slot.hookPhrase).length).toBe(0);
  });

  it('keeps instruction 85 metadata source-local and removes the legacy season/title leak', () => {
    const opts = applyChiliStoryGenerationContract(makeOptions({
      channel,
      projectTitle: CHILI_STORY_LEGACY_PROJECT_TITLE,
      songCount: 15,
      storyPov: 'female',
      storyPlanLine: TRAIN_PLAN_FEMALE,
      storySourceLine: TRAIN_PLAN_FEMALE,
      seasonId: 'christmas',
      choiceProvenance: { seasonId: 'default' }
    }));
    const meta = storyMetaFieldsFromOptions(opts);
    expect(resolveChiliStoryProjectTitle(opts)).toContain('Tokyo Chill Love Story');
    expect(resolveChiliStoryProjectTitle(opts)).toContain('EP.001');
    expect(resolveChiliStoryProjectTitle(opts)).not.toBe(CHILI_STORY_LEGACY_PROJECT_TITLE);
    expect(meta.season).toBe('Story Neutral');
    expect(meta.storySourceEpisodeId).toBe('001');
    expect(meta.storySourceTitle).toBe(parseChiliStoryPlanLine(TRAIN_PLAN_FEMALE)?.storySourceTitle);
    expect(meta.storyPovTitle).toBe(parseChiliStoryPlanLine(TRAIN_PLAN_FEMALE)?.storyPovTitle);
  });

  it('does not turn train window language into a Cafe genre warning, but preserves explicit unsupported-genre warnings', () => {
    const train = optsForPlanLine('female', TRAIN_PLAN_FEMALE, { genreIds: CORE_GENRE_IDS_BY_ARCHETYPE['jp-chillhop'].slice(0, 6) });
    expect(preallocateSongSlots(train, genresFor(train))[0].genreWarning).toBeUndefined();

    const explicitCafeGenre = optsForPlanLine('female', TRAIN_PLAN_FEMALE, { genreIds: ['lofi-cafe'] });
    expect(preallocateSongSlots(explicitCafeGenre, genrePacks.filter(genre => genre.id === 'lofi-cafe'))[0].genreWarning).toBeTruthy();
  });

  it('keeps the instruction 82 manual genre exact-count wiring for both solo Story POV packs', () => {
    const cases = [
      {
        pov: 'male' as const,
        counts: { 'chill-rap': 4, 'jazz-rap': 4, 'en-deep-house-vocal-anthem': 4, 'boom-bap-mellow': 3 }
      },
      {
        pov: 'female' as const,
        counts: { 'chill-rap': 4, 'en-deep-house-melodic': 4, 'en-chill-deep-house': 4, 'en-lounge-house': 3 }
      }
    ];
    for (const fixture of cases) {
      const opts = optsFor(fixture.pov, {
        genreIds: [],
        diversityAllocations: [{ axis: 'genre', mode: 'manual', counts: fixture.counts }]
      });
      const genres = genrePacks.filter(genre => Object.hasOwn(fixture.counts, genre.id));
      const slots = preallocateSongSlots(opts, genres);
      const slotCounts = Object.fromEntries(Object.keys(fixture.counts).map(id => [id, slots.filter(slot => slot.genreId === id).length]));
      expect(slotCounts, fixture.pov).toEqual(fixture.counts);
      const plan = directSetLocal(opts.customConcept, channel, 15, { recentGenreIds: [], recentHooks: [] }, [], opts.vocalTone, undefined, undefined, userChoicesFromOptions(opts), opts);
      expect(plan.allocations.find(allocation => allocation.axis === 'genre')?.counts, fixture.pov).toEqual(fixture.counts);
      expect(Object.fromEntries(Object.keys(fixture.counts).map(id => [id, plan.slots.filter(slot => slot.genreId === id).length])), fixture.pov).toEqual(fixture.counts);
      const instruction = buildClaudeCodeInstruction(opts, genres, moodsFor(opts), season, { usedTitles: [], usedHooks: [] }, slots);
      const setPlanText = instruction.split('[SetPlan handoff]')[1]?.split('[Diversity groups]')[0] ?? instruction;
      for (const [id, count] of Object.entries(fixture.counts)) {
        const label = genres.find(genre => genre.id === id)?.label;
        expect(label, `${fixture.pov}/${id} genre fixture`).toBeTruthy();
        expect(setPlanText.split(`| ${label} |`).length - 1, `${fixture.pov}/${id} bridge SetPlan count`).toBe(count);
        expect(slots.filter(slot => slot.genreId === id)).toHaveLength(count);
      }
    }
  });

  it('keeps the real EP.001 plan parser, source-local scenes, POV locks, and manual genres identical across all v6 engines', () => {
    const engines = ['v6', 'v6-wild', 'v6-mini'] as const;
    const parserBaseline = {
      male: parseChiliStoryPlanLine(TRAIN_PLAN_MALE),
      female: parseChiliStoryPlanLine(TRAIN_PLAN_FEMALE)
    };
    const manualCounts = { 'chill-rap': 4, 'jazz-rap': 4, 'en-deep-house-vocal-anthem': 4, 'boom-bap-mellow': 3 };

    for (const model of engines) {
      for (const [pov, line] of [['male', TRAIN_PLAN_MALE], ['female', TRAIN_PLAN_FEMALE]] as const) {
        const opts = optsForPlanLine(pov, line, { sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } });
        expect(parseChiliStoryPlanLine(line), `${model}/${pov} parser`).toEqual(parserBaseline[pov]);
        expect(opts.lyricLanguage, `${model}/${pov} language`).toBe('japanese');
        expect(opts.perspective, `${model}/${pov} POV`).toBe('firstPerson');
        expect(opts.storyPlanEpisodeId, `${model}/${pov} plan episode`).toBe('001');
        expect(opts.storySourceEpisodeId, `${model}/${pov} source episode`).toBe('001');
        expect(opts.storySeason, `${model}/${pov} season`).toBeUndefined();
        expect(resolveEffectiveStoryVocalQuota(opts), `${model}/${pov} quota`).toEqual(
          pov === 'male' ? { male: 15, female: 0, mixed: 0 } : { male: 0, female: 15, mixed: 0 }
        );

        const scenes = planChiliStoryScenes({ ...opts, isCafe: false });
        expect(scenes.filter(isSourceLocalChiliStoryScene), `${model}/${pov} source-local`).toHaveLength(15);
        expect(scenes.map(scene => scene.storyAct), `${model}/${pov} acts`).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
        expect(scenes.some(scene => containsChiliStoryFutureStageViolation(`${scene.title} ${scene.hookPhrase} ${scene.lyricThemeText} ${scene.storyArcRole}`)), `${model}/${pov} future stage`).toBe(false);

        const { slots, instruction } = runBridgeFixture(opts);
        expect(vocalCounts(slots), `${model}/${pov} slots`).toEqual(
          pov === 'male' ? { male: 15, female: 0, mixed: 0 } : { male: 0, female: 15, mixed: 0 }
        );
        expect(instruction, `${model}/${pov} engine`).toContain(`Model: ${model}`);
        expect(instruction, `${model}/${pov} story plan`).toContain('[JP CHILI LAB STORY PLAN]');
        expect(instruction, `${model}/${pov} Japanese title`).toContain('natural Japanese primary song title');
        expect(instruction, `${model}/${pov} source-local`).toContain('source-local');
      }

      const manualOpts = optsFor('male', {
        genreIds: [],
        diversityAllocations: [{ axis: 'genre', mode: 'manual', counts: manualCounts }],
        sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] }
      });
      const genres = genrePacks.filter(genre => Object.hasOwn(manualCounts, genre.id));
      const slots = preallocateSongSlots(manualOpts, genres);
      const slotCounts = Object.fromEntries(Object.keys(manualCounts).map(id => [id, slots.filter(slot => slot.genreId === id).length]));
      const plan = directSetLocal(manualOpts.customConcept, channel, 15, { recentGenreIds: [], recentHooks: [] }, [], manualOpts.vocalTone, undefined, undefined, userChoicesFromOptions(manualOpts), manualOpts);
      const bridge = buildClaudeCodeInstruction(manualOpts, genres, moodsFor(manualOpts), season, { usedTitles: [], usedHooks: [] }, slots);
      const setPlanText = bridge.split('[SetPlan handoff]')[1]?.split('[Diversity groups]')[0] ?? bridge;
      const bridgeCounts = Object.fromEntries(genres.map(genre => [genre.id, setPlanText.split(`| ${genre.label} |`).length - 1]));
      expect(slotCounts, `${model} preassigned`).toEqual(manualCounts);
      expect(plan.allocations.find(allocation => allocation.axis === 'genre')?.counts, `${model} SetPlan`).toEqual(manualCounts);
      expect(Object.fromEntries(Object.keys(manualCounts).map(id => [id, plan.slots.filter(slot => slot.genreId === id).length])), `${model} SetPlan slots`).toEqual(manualCounts);
      expect(bridgeCounts, `${model} Bridge`).toEqual(manualCounts);
    }
  });

  it('preserves the Story contract through v6 engine switching and keeps English CHILI unpolluted', () => {
    const base = optsForPlanLine('female', TRAIN_PLAN_FEMALE);
    const contractSnapshot = {
      channelId: base.channel.id,
      storyPov: base.storyPov,
      storyPlanEpisodeId: base.storyPlanEpisodeId,
      storySourceEpisodeId: base.storySourceEpisodeId,
      storySourceTitle: base.storySourceTitle,
      storySourceSummary: base.storySourceSummary,
      lyricLanguage: base.lyricLanguage,
      perspective: base.perspective,
      songCount: base.songCount,
      diversityAllocations: base.diversityAllocations
    };
    for (const model of ['v6', 'v6-wild', 'v6-mini'] as const) {
      const switched = applyChiliStoryGenerationContract({ ...base, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES[model] } });
      expect({
        channelId: switched.channel.id,
        storyPov: switched.storyPov,
        storyPlanEpisodeId: switched.storyPlanEpisodeId,
        storySourceEpisodeId: switched.storySourceEpisodeId,
        storySourceTitle: switched.storySourceTitle,
        storySourceSummary: switched.storySourceSummary,
        lyricLanguage: switched.lyricLanguage,
        perspective: switched.perspective,
        songCount: switched.songCount,
        diversityAllocations: switched.diversityAllocations
      }, model).toEqual(contractSnapshot);
      expect(resolveEffectiveStoryVocalQuota(switched), model).toEqual({ male: 0, female: 15, mixed: 0 });
    }

    const enChannel = channelPresets.find(preset => preset.archetype === 'en-chillhop')!;
    const enOpts = applyChiliStoryGenerationContract(makeOptions({ channel: enChannel, lyricLanguage: 'english', songCount: 15, sunoEngine: { ...SUNO_V6_ENGINE_PROFILES.v6 } }));
    const enGenres = genresFor(enOpts);
    const enSlots = preallocateSongSlots(enOpts, enGenres);
    const enInstruction = buildClaudeCodeInstruction(enOpts, enGenres, moodsFor(enOpts), season, { usedTitles: [], usedHooks: [] }, enSlots);
    expect(enOpts.lyricLanguage).toBe('english');
    expect(enOpts.storyPov).toBeUndefined();
    expect(enInstruction).not.toContain('[JP CHILI LAB STORY CONTRACT]');
    expect(enInstruction).not.toContain('[JP CAFE CHILI LAB STORY CONTRACT]');
  });

  it('keeps solo STORY vocal quota as one source of truth from UI options through plan, preflight, bridge, and import', async () => {
    const staleBalancedAllocation: AxisAllocation = {
      axis: 'vocalType',
      mode: 'manual',
      counts: { male: 5, female: 5, mixed: 5 }
    };
    const cases: Array<{ pov: 'male' | 'female'; quota: { male: number; female: number; mixed: number }; label: string }> = [
      { pov: 'male', quota: { male: 15, female: 0, mixed: 0 }, label: '彼のSTORY' },
      { pov: 'female', quota: { male: 0, female: 15, mixed: 0 }, label: '彼女のSTORY' }
    ];

    for (const fixture of cases) {
      const opts = optsFor(fixture.pov, {
        diversityAllocations: [staleBalancedAllocation],
        vocalTone: fixture.pov === 'male' ? 'bright female lead vocal' : 'warm male baritone lead vocal'
      });

      expect(resolveEffectiveStoryVocalQuota(opts), fixture.label).toEqual(fixture.quota);
      expect(isStoryVocalHardLocked(opts), fixture.label).toMatchObject({ locked: true, gender: fixture.pov, quota: fixture.quota });
      expect(opts.vocalQuota, fixture.label).toEqual(fixture.quota);
      expect(opts.vocalQuotaMode, fixture.label).toBeUndefined();
      expect(opts.storyVocalQuotaSource, fixture.label).toBe('story-contract');
      expect(vocalAllocationCounts(opts.diversityAllocations), fixture.label).toEqual(fixture.quota);
      expect(vocalAllocationCounts(opts.diversityAllocations), fixture.label).not.toEqual({ male: 5, female: 5, mixed: 5 });

      const plan = directSetLocal(
        opts.customConcept,
        opts.channel,
        opts.songCount,
        { recentGenreIds: [], recentHooks: [] },
        [],
        opts.vocalTone,
        opts.breadthOverride,
        opts.paletteFamilyOverride,
        userChoicesFromOptions(opts),
        opts
      );
      expect(vocalAllocationCounts(plan.allocations), fixture.label).toEqual(fixture.quota);
      expect(vocalCounts(plan.slots), fixture.label).toEqual(fixture.quota);
      expect(vocalAllocationCounts(plan.allocations), fixture.label).not.toEqual({ male: 5, female: 5, mixed: 5 });

      const slots = preallocateSongSlots(opts, genresFor(opts));
      expect(vocalCounts(slots), fixture.label).toEqual(fixture.quota);
      const contract = buildResolvedGenerationContract(opts, userChoicesFromOptions(opts), slots, 'jp-chillhop');
      expect(contract.vocal.effectiveQuota, fixture.label).toEqual(fixture.quota);

      const preflight = await evaluateGenerationRequest({
        workspaceId: 'jp-chillhop',
        options: opts,
        genres: genresFor(opts)
      });
      expect(preflight.reasons.filter(reason => reason.field.includes('vocal') || reason.messageKo.includes('보컬')), fixture.label).toEqual([]);

      const { instruction, report } = runBridgeFixture(opts);
      expect(instruction, fixture.label).toContain(`VOCAL HARD LOCK: every one of the 15 songs is ${fixture.pov} vocal only`);
      expect(instruction, fixture.label).toContain(`male ${fixture.quota.male}/15, female ${fixture.quota.female}/15, mixed/duet ${fixture.quota.mixed}/15`);
      expect(instruction, fixture.label).not.toContain('male 5/15, female 5/15, mixed/duet 5/15');
      expect(report.importedCount, fixture.label).toBe(15);
      expect(report.blueprint?.meta?.storyPov, fixture.label).toBe(fixture.pov);
      expect(report.blueprint?.meta?.storySourceLine, fixture.label).toBe(STORY_SOURCE.storySourceLine);
      expect(report.blueprint?.songs.every(song => song.storyPov === fixture.pov), fixture.label).toBe(true);
      expect(report.blueprint?.songs.every(song => song.storySourceLine === STORY_SOURCE.storySourceLine), fixture.label).toBe(true);
    }
  });

  it('clears stale male/female solo quota when switching to couple and reapplies the selected solo quota when switching back', () => {
    for (const pov of ['male', 'female'] as const) {
      const solo = optsFor(pov);
      const soloQuota = resolveEffectiveStoryVocalQuota(solo)!;
      expect(vocalAllocationCounts(solo.diversityAllocations)).toEqual(soloQuota);

      const directCouple = applyChiliStoryGenerationContract({ ...solo, storyPov: 'couple' });
      expect(resolveEffectiveStoryVocalQuota(directCouple)).toBeUndefined();
      expect(directCouple.vocalQuota).toBeUndefined();
      expect(directCouple.storyVocalQuotaSource).toBeUndefined();
      expect(vocalAllocationCounts(directCouple.diversityAllocations)).toBeUndefined();
      expect(vocalCounts(preallocateSongSlots(directCouple, genresFor(directCouple)))).not.toEqual(soloQuota);

      const uiCouple = applyChiliStoryGenerationContract({ ...clearChiliStorySoloVocalLock(solo), storyPov: 'couple' });
      expect(uiCouple.vocalQuota).toBeUndefined();
      expect(uiCouple.storyVocalQuotaSource).toBeUndefined();
      expect(vocalAllocationCounts(uiCouple.diversityAllocations)).toBeUndefined();

      const switchedBack = applyChiliStoryGenerationContract({ ...uiCouple, storyPov: pov });
      expect(resolveEffectiveStoryVocalQuota(switchedBack)).toEqual(soloQuota);
      expect(switchedBack.vocalQuota).toEqual(soloQuota);
      expect(switchedBack.storyVocalQuotaSource).toBe('story-contract');
      expect(vocalAllocationCounts(switchedBack.diversityAllocations)).toEqual(soloQuota);
      expect(vocalCounts(preallocateSongSlots(switchedBack, genresFor(switchedBack)))).toEqual(soloQuota);
    }
  });

  it('does not delete a user-owned manual solo-shaped quota while already in couple Story mode', () => {
    const manualQuota = { male: 15, female: 0, mixed: 0 };
    const manualCouple = applyChiliStoryGenerationContract(makeOptions({
      ...STORY_SOURCE,
      channel,
      songCount: 15,
      lyricLanguage: 'japanese',
      storyPov: 'couple',
      vocalQuota: manualQuota,
      diversityAllocations: [{ axis: 'vocalType', mode: 'manual', counts: manualQuota }]
    }));

    expect(manualCouple.storyPov).toBe('couple');
    expect(manualCouple.storyVocalQuotaSource).toBeUndefined();
    expect(manualCouple.vocalQuota).toEqual(manualQuota);
    expect(vocalAllocationCounts(manualCouple.diversityAllocations)).toEqual(manualQuota);
  });

  it('restores old saved solo STORY options and rescales the hard lock to the saved song count', () => {
    const cases: Array<{ pov: 'male' | 'female'; quota: { male: number; female: number; mixed: number } }> = [
      { pov: 'male', quota: { male: 12, female: 0, mixed: 0 } },
      { pov: 'female', quota: { male: 0, female: 12, mixed: 0 } }
    ];

    for (const fixture of cases) {
      const saved = JSON.parse(JSON.stringify(optsFor(fixture.pov, {
        songCount: 12,
        lyricLanguage: 'english',
        perspective: 'thirdPerson',
        perspectiveMode: 'varied',
        vocalTone: fixture.pov === 'male' ? 'airy female lead vocal' : 'warm male baritone lead vocal'
      }))) as GenerationOptions;
      delete saved.vocalQuota;
      delete saved.vocalQuotaMode;
      delete saved.diversityAllocations;

      const restored = applyChiliStoryGenerationContract(saved);
      expect(restored.storyPov).toBe(fixture.pov);
      expect(restored.lyricLanguage).toBe('japanese');
      expect(restored.perspective).toBe('firstPerson');
      expect(restored.perspectiveMode).toBe('fixed');
      expect(restored.storySourceLine).toBe(STORY_SOURCE.storySourceLine);
      expect(restored.storySourceSummary).toBe(STORY_SOURCE.storySourceSummary);
      expect(resolveEffectiveStoryVocalQuota(restored)).toEqual(fixture.quota);
      expect(restored.vocalQuota).toEqual(fixture.quota);
      expect(restored.storyVocalQuotaSource).toBe('story-contract');
      expect(vocalAllocationCounts(restored.diversityAllocations)).toEqual(fixture.quota);
      expect(vocalCounts(preallocateSongSlots(restored, genresFor(restored)))).toEqual(fixture.quota);
    }
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
