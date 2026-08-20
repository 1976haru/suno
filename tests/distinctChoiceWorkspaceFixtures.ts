import type { ChannelArchetype, DistinctChoiceRuleId, SongIdea, WorkspaceId } from '../src/types';
import { workspaceForArchetype } from '../src/data/workspaces';

/**
 * 지시문 15 (TASK C) — 7개 워크스페이스 실증에 공통으로 쓰는 fixture 빌더.
 * 실제 팩(tests/fixtures/distinctChoice20260808Pack.json)은 senior-oldpop
 * 하나뿐이라, 나머지 6개는 core/distinctChoiceGate.ts의 checkRule() 판정
 * 로직(§B-1, 20260808 팩으로 校정됨)을 그대로 겨냥해 각 ruleId를
 * compliant/violated로 확정적으로 만드는 최소 lyrics/stylePrompt를 직접
 * 구성한다 — 미검증 워크스페이스는 실측 데이터가 없다는 것 자체가 정책이
 * verified:false인 이유이므로, 실제 데이터가 아니라 통제된 fixture가 맞다.
 */

// 지시문 15 (TASK C) — qualityScore 격리 테스트가 바닥값(Math.max(0, ...))에
// 걸려 델타가 사라지지 않도록, 필러 문장을 충분히 길게 잡아(80단어 이상)
// core/quality.ts의 기본 구조 점수가 매번 높게 나오도록 한다. distinctChoice
// 규칙 판정 자체(섹션 존재/줄 수 비율 등)는 문장 내용이 아니라 구조에서만
// 나오므로 문장 자체를 길게 늘려도 각 규칙의 compliant/violated 판정에는
// 영향이 없다.
// core/quality.ts also runs in-song line/section-repetition checks (real
// songs repeat a chorus verbatim on purpose, but a verse echoing another
// verse or section verbatim is flagged and heavily penalized) — reusing one
// literal filler block across every section collapsed several fixtures'
// baseline score to 0 before any distinctChoice penalty was even applied.
// A small rotating bank keeps every section's text distinct.
const FILLER_BANK: string[][] = [
  ['A quiet line moves slowly through the empty room tonight', 'Another gentle line follows soft and low behind it', 'The whole scene holds still for one more warm moment'],
  ['A distant clock ticks softly somewhere down the hall', 'The curtains sway a little in the cooling evening air', 'Nothing here is rushing toward the coming dawn'],
  ['A worn out coat still hangs beside the wooden door', 'The kettle waits in silence on the old stove top', 'Every corner of this house remembers something warm'],
  ['The streetlight flickers gently on the wet grey stone', 'A slow car passes somewhere far beyond the hill', 'The night keeps holding on to one more quiet hour']
];
function fillerGroup(n: number): string[] {
  return FILLER_BANK[n % FILLER_BANK.length];
}
function fillerGroup2(n: number): string[] {
  return fillerGroup(n).slice(0, 2);
}

function section(tag: string, lines: string[]): string {
  return `[${tag}]\n${lines.join('\n')}`;
}

/** ruleId 하나를 compliant 또는 violated로 확정 재현하는 최소 lyrics. */
function lyricsForRule(ruleId: DistinctChoiceRuleId, compliant: boolean, trackNo: number): string {
  switch (ruleId) {
    case 'NO_CHORUS':
      return compliant
        ? [section('verse 1', fillerGroup(0)), section('verse 2', fillerGroup(1))].join('\n\n')
        : [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1))].join('\n\n');
    case 'SINGLE_CHORUS':
      return compliant
        ? [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1)), section('verse 2', fillerGroup(2))].join('\n\n')
        : [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1)), section('verse 2', fillerGroup(2)), section('chorus', fillerGroup(1))].join('\n\n');
    case 'FINAL_QUESTION':
      return compliant
        ? [section('verse 1', fillerGroup(0)), section('chorus', [...fillerGroup2(1), 'Will you still remember tonight?'])].join('\n\n')
        : [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1))].join('\n\n');
    case 'VOCAL_TOGETHER':
      return compliant
        ? [section('verse 1: Full Group Unison', fillerGroup(0)), section('chorus: Full Group Unison', fillerGroup(1))].join('\n\n')
        : [section('verse 1: Male Vocal', fillerGroup(0)), section('chorus: Female Vocal', fillerGroup(1))].join('\n\n');
    case 'VERSE2_HALF_LENGTH':
      return compliant
        ? [section('verse 1', ['a line about the morning light', 'a line about the empty street', 'a line about the falling rain', 'a line about the closing door']), section('verse 2', ['a line about the fading dusk', 'a line about the quiet hall'])].join('\n\n')
        : [section('verse 1', ['a line about the morning light', 'a line about the empty street', 'a line about the falling rain', 'a line about the closing door']), section('verse 2', ['a line about the fading dusk', 'a line about the quiet hall', 'a line about the winter coat', 'a line about the borrowed key'])].join('\n\n');
    case 'VERSE_TAIL_REPEAT':
      return compliant
        ? [section('verse 1', ['a line about the winding road', 'there is no fixed hour']), section('verse 2', ['a line about the fading light', 'there is no fixed hour'])].join('\n\n')
        : [section('verse 1', ['a line about the winding road', 'there is no fixed hour']), section('verse 2', ['a line about the fading light', 'a different closing line entirely'])].join('\n\n');
    case 'WORD_ACCUMULATION':
      // checkRule counts how many DISTINCT params.words appear per verse
      // (not repetitions of one word) — verse1 only says "home", verse2
      // adds "stay" too, so the word-count per verse goes 1 → 2.
      return compliant
        ? [section('verse 1', ['home is where the quiet starts tonight']), section('verse 2', ['home is where we finally stay and rest'])].join('\n\n')
        : [section('verse 1', ['a plain line about the weather here']), section('verse 2', ['another plain line about the weather there'])].join('\n\n');
    case 'SCENE_PER_VERSE':
      return compliant
        ? [section('verse 1', ['the kitchen holds the morning light and steam']), section('verse 2', ['a bus moves through the evening rain downtown'])].join('\n\n')
        : [section('verse 1', ['the kitchen holds the morning light and steam']), section('verse 2', ['the kitchen holds the morning light again today'])].join('\n\n');
    case 'HOOK_LAST_WORD_SHIFT':
      return compliant
        ? [section('chorus', ['this is the hook line calling home']), section('final chorus', ['this is the hook line running free'])].join('\n\n')
        : [section('chorus', ['this is the hook line calling home']), section('final chorus', ['this is the hook line calling home'])].join('\n\n');
    case 'CALL_AND_RESPONSE':
      return compliant
        ? [section('verse 1', fillerGroup(0)), section('bridge', fillerGroup2(2))].join('\n\n')
        : [section('verse 1', fillerGroup(0)), section('bridge', fillerGroup(2))].join('\n\n');
    // 지시문 37 (TASK C-2)
    case 'CHANT_HOOK':
      return compliant
        ? [section('verse 1', fillerGroup(0)), section('chant', ['hey hey hey hey'])].join('\n\n')
        : [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1))].join('\n\n');
    case 'HOOK_REPEAT_4X': {
      const hook = `Track ${trackNo} Hook`;
      const repeatCount = compliant ? 4 : 2;
      return [section('verse 1', fillerGroup(0)), section('chorus', Array.from({ length: repeatCount }, () => hook))].join('\n\n');
    }
    case 'NO_INTRO':
    case 'KEY_LIFT':
    case 'OCTAVE_DOWN_CHORUS':
    case 'MODE_SHIFT':
    case 'ARRANGEMENT_NUANCE':
      return [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1))].join('\n\n');
  }
}

function stylePromptForRule(ruleId: DistinctChoiceRuleId, compliant: boolean, trackNo: number): string {
  // core/quality.ts's own structural checks (progression/chorus/hook-device
  // disclosure) are otherwise unrelated to distinctChoice — included here
  // only so the qualityScore isolation tests below don't collide with
  // Math.max(0, ...)'s floor and hide a real distinctChoice penalty behind
  // an already-zeroed baseline. None of these three phrases match any of
  // the 4 stylePrompt-sensitive rule regexes below (NO_INTRO/KEY_LIFT/
  // OCTAVE_DOWN_CHORUS/MODE_SHIFT).
  const base = `Old Pop, 92 BPM, warm acoustic guitar, gentle strings, I-V-vi-IV progression, warm chorus lift, double-tracked harmony, track ${trackNo}`;
  switch (ruleId) {
    case 'NO_INTRO':
      return compliant ? base : `${base}, short intro before the vocal enters`;
    case 'KEY_LIFT':
      return compliant ? `${base}, one key change into the final chorus` : base;
    case 'OCTAVE_DOWN_CHORUS':
      return compliant ? `${base}, octave down on the last chorus repeat` : base;
    case 'MODE_SHIFT':
      return compliant ? `${base}, minor verse opening into a major chorus` : base;
    default:
      return base;
  }
}

/**
 * checkRule() reads VERSE_TAIL_REPEAT's `params.phrase` as a string and
 * WORD_ACCUMULATION's `params.words` as a string[] (core/distinctChoiceGate.ts
 * casts it internally) — SongIdea.distinctChoiceParams is typed
 * `Record<string, string | number>` for the common case, so the words array
 * needs one explicit cast here, at the single place it's constructed.
 */
function paramsForRule(ruleId: DistinctChoiceRuleId, compliant: boolean): Record<string, string | number> | undefined {
  if (ruleId === 'VERSE_TAIL_REPEAT' && compliant) return { phrase: 'there is no fixed hour' };
  if (ruleId === 'WORD_ACCUMULATION' && compliant) return { words: ['home', 'stay'] } as unknown as Record<string, string | number>;
  return undefined;
}

export type MinimalSong = Pick<SongIdea, 'trackNo' | 'lyrics' | 'stylePrompt' | 'distinctChoice' | 'distinctChoiceRuleId' | 'distinctChoiceParams'>;

export interface BuildRuleSongOptions {
  compliant: boolean;
  /** VOCAL_TOGETHER 전용 — safety 제약(§B-2 sameGenderVocalOnly)을 겨냥해 "Male and Female Duet"처럼 성별 단어를 모두 포함하되(기본 규칙상은 together로 필터되어 compliant) 안전 판정에서는 걸리는 태그를 쓴다. */
  mixedGenderVocalTogether?: boolean;
  /** 안전 제약(예: kids의 NO_CHORUS/FINAL_QUESTION)을 겨냥할 때 — 실제 가사 내용과 무관하게 ruleId 자체가 금지 목록에 있으면 항상 안전 위반이 뜬다. */
}

export function buildRuleSong(trackNo: number, ruleId: DistinctChoiceRuleId, opts: BuildRuleSongOptions): MinimalSong {
  const { compliant, mixedGenderVocalTogether } = opts;
  const lyrics = ruleId === 'VOCAL_TOGETHER' && mixedGenderVocalTogether
    ? [section('verse 1: Male and Female Duet', fillerGroup(0)), section('chorus: Male and Female Duet', fillerGroup(1))].join('\n\n')
    : lyricsForRule(ruleId, compliant, trackNo);
  const stylePrompt = stylePromptForRule(ruleId, compliant, trackNo);
  const params = paramsForRule(ruleId, compliant);
  return {
    trackNo,
    lyrics,
    stylePrompt,
    distinctChoice: `테스트 fixture — ${ruleId} ${compliant ? '이행' : '위반'}`,
    distinctChoiceRuleId: ruleId,
    ...(params ? { distinctChoiceParams: params } : {})
  };
}

/** ruleId 자체가 없는(구형 자유 문자열만 있는) not-measured 트랙. */
export function buildLegacyFreeTextSong(trackNo: number): MinimalSong {
  return {
    trackNo,
    lyrics: [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1))].join('\n\n'),
    stylePrompt: `Old Pop, 92 BPM, track ${trackNo}`,
    distinctChoice: '이 트랙은 구조화 이전 자유 문자열 응답이다'
  };
}

/** distinctChoice 자체가 완전히 없는(missing) 트랙. */
export function buildMissingSong(trackNo: number): MinimalSong {
  return {
    trackNo,
    lyrics: [section('verse 1', fillerGroup(0)), section('chorus', fillerGroup(1))].join('\n\n'),
    stylePrompt: `Old Pop, 92 BPM, track ${trackNo}`
  };
}

/** SongIdea가 요구하는 나머지 필드를 채워 core/quality.ts의 scoreSongs로 바로 넘길 수 있게 만든다. */
export function toFullSongIdea(song: MinimalSong, archetype: ChannelArchetype): SongIdea {
  const workspaceId: WorkspaceId = workspaceForArchetype(archetype)?.id ?? 'senior-oldpop';
  return {
    trackNo: song.trackNo,
    title: `Track ${song.trackNo}`,
    seasonMoment: 'a quiet evening scene',
    listenerSituation: 'sitting quietly at home',
    emotionArc: 'calm opening into warmth',
    hookPhrase: `Track ${song.trackNo} Hook`,
    stylePrompt: song.stylePrompt,
    lyrics: song.lyrics,
    youtube: { title: `Track ${song.trackNo}`, description: 'test fixture', tags: [] },
    qualityScore: 0,
    warnings: [],
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: archetype,
    workspaceId,
    ...(song.distinctChoice !== undefined ? { distinctChoice: song.distinctChoice } : {}),
    ...(song.distinctChoiceRuleId ? { distinctChoiceRuleId: song.distinctChoiceRuleId } : {}),
    ...(song.distinctChoiceParams ? { distinctChoiceParams: song.distinctChoiceParams } : {})
  };
}

export const WORKSPACE_REPRESENTATIVE_ARCHETYPE: Record<WorkspaceId, ChannelArchetype> = {
  'senior-oldpop': 'senior-morning',
  'kr-2030': 'kr-2030-pop',
  'jp-2030': 'jp-2030-pop',
  'kr-idol-male': 'kr-idol-male',
  'kr-idol-female': 'kr-idol-female',
  'kr-kids': 'kr-kids-song',
  'jp-kids': 'jp-kids-song'
};

export const ALL_WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-idol-male', 'kr-idol-female', 'kr-kids', 'jp-kids'];
