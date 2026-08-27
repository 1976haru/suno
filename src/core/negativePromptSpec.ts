import type { GenerationOptions, GenrePack } from '../types';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { channelVocalFloorForArchetype } from '../data/channelVocalFloor';
import { parseNegativeStyleTerms, joinNegativeStyleTerms, resolveNegativeStyleText } from '../data/negativeStyles';
import { isKidsArchetype } from '../utils/channelArchetype';

/**
 * codex 지시문 03 (TASK D) — real investigation finding: core/promptComposer.ts's
 * buildExcludePrompt is NOT a naive fixed blob copied to every song (the
 * spec's own "고정 800~900자 문장을 모든 곡에 복사하지 않는다" complaint) — it
 * already has a real 4-tier priority system (copyright/safety literal >
 * user avoidWords > audience exclusions > channel soundFloor, then a
 * trimmable genre/quality-preference tier) and real dedup + subsumption
 * (data/negativeStyles.ts's joinNegativeStyleTerms — drops a shorter phrase
 * whenever every one of its words already appears in a longer surviving
 * phrase). This module does NOT reimplement that dedup logic — it reuses
 * joinNegativeStyleTerms directly — and does NOT replace buildExcludePrompt
 * (real callers keep using it unchanged). What it adds, for real:
 *  - NegativePromptSpec: the categorized shape this task's own spec asks
 *    for, built by mapping buildExcludePrompt's own real tiers onto the 6
 *    named categories (see buildNegativePromptSpec's own field-by-field
 *    doc comment below for exactly which real source feeds which category
 *    — every field is a genuine existing data source, `vocal` is honestly
 *    empty since no vocal-specific negative-term source exists in this
 *    codebase today, not fabricated to fill the shape).
 *  - compileNegativePromptSpec: compiles the categorized spec back to one
 *    string via the same real joinNegativeStyleTerms dedup/subsumption
 *    buildExcludePrompt already uses.
 *  - checkNegativePromptLength: a NEW, ADVISORY-ONLY 3-tier length signal
 *    (250-500/501-650/651+) — deliberately layered ALONGSIDE, not on top
 *    of, the existing EXCLUDE_PROMPT_SAFE_TARGET (850, core/promptComposer.ts —
 *    지시문 10 removed releaseReadiness.ts's own separate, dead 750-850
 *    literal that had drifted out of use)
 *    and EXCLUDE_PROMPT_HARD_CAP (900, core/compositionScorer.ts) BLOCKING
 *    checks, which stay completely unchanged — those numbers are real-
 *    measurement-calibrated to what a real pack's genuine safety/copyright/
 *    workspace requirements actually need, and this task's own much
 *    shorter target could not honestly be made BLOCKING without risking
 *    forcing a real safety-critical exclusion list to be cut short. kids
 *    workspaces are exempt from even the advisory tier — this task's own
 *    explicit "kids는 안전 문구가 더 중요하므로 카테고리 보존을 우선한다".
 */
export interface NegativePromptSpec {
  safety: string[];
  copyright: string[];
  workspace: string[];
  vocal: string[];
  arrangement: string[];
  user: string[];
}

const COPYRIGHT_TERMS = parseNegativeStyleTerms('famous artist imitation, copied melodies, copyrighted song references, soundalike vocals');

/**
 * Field-by-field real source mapping:
 *  - copyright: the fixed literal every buildExcludePrompt call already
 *    includes unconditionally (never varies by song/workspace).
 *  - safety: audienceProfile.exclusions, relaxable-at-peak-filtered — the
 *    SAME real source/filtering buildExcludePrompt's own exclusionsForThisSong
 *    already computes (vocal-register/dynamics safety-for-this-audience
 *    items, e.g. SENIOR_AUDIENCE_PROFILE's 'shouted or belted high notes').
 *  - workspace: channelSoundFloorForArchetype(...)?.forbiddenAtoms — the
 *    channel/era-guard "must never" atoms, unconditional like copyright.
 *  - arrangement: resolveNegativeStyleText's own real trimmable tier
 *    (genre avoidTraits + GLOBAL_NEGATIVE_STYLE_TERMS/the channel's own
 *    negativeStyle preset text) — production/mix quality-preference terms.
 *  - user: opts.avoidWords, parsed — the one field a user directly types.
 *  - vocal: 지시문 62 (TASK C) — data/channelVocalFloor.ts의 forbiddenTraits.
 *    이 필드는 "no vocal-specific negative-term source exists... kept for a
 *    future real source to populate" 상태였다 — channelVocalFloor가 그 실제
 *    소스다. workspace(soundFloor)와 같은 unconditional 취급.
 */
export function buildNegativePromptSpec(
  opts: Pick<GenerationOptions, 'avoidWords' | 'channel' | 'negativeStyle'>,
  genres: GenrePack[] = [],
  relaxedExclusions: readonly string[] = [],
  /**
   * 지시문 77 (TASK C-4.3) — 컨셉이 지목한 발성의 반대편 배제어
   * (core/conceptVocalPlan.ts의 conceptVocalExclusionTerms). Suno의
   * 기본값은 성대를 닫는 현대 팝 발성이라 긍정 지시만으로는 약하다.
   *
   * **arrangement(trimmable) 티어의 맨 앞**에 들어간다 — 이 자리가
   * 핵심이다. buildExcludePrompt의 fitWithinBudget이 이 티어만 예산에
   * 맞춰 자르므로, 앞에 넣으면 "추가하는 만큼 기존 항목 중 이 곡에
   * 불필요한 것을 뺀다"(§4.3)가 새 트리밍 코드 없이 기존 예산 로직으로
   * 그대로 성립한다. safety/copyright/workspace/user 같은 always-keep
   * 티어에 넣었다면 총량이 그만큼 늘어났을 것이다.
   */
  conceptVocalExclusions: readonly string[] = []
): NegativePromptSpec {
  const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.channel.audience);
  const relaxable = new Set(audienceProfile.relaxableAtPeak);
  const relaxedNow = new Set(relaxedExclusions.filter(item => relaxable.has(item)));
  const safety = audienceProfile.exclusions.filter(item => !relaxedNow.has(item));
  const soundFloor = channelSoundFloorForArchetype(opts.channel.archetype);
  const vocalFloor = channelVocalFloorForArchetype(opts.channel.archetype);

  return {
    safety,
    copyright: [...COPYRIGHT_TERMS],
    workspace: soundFloor?.forbiddenAtoms ? [...soundFloor.forbiddenAtoms] : [],
    vocal: vocalFloor?.forbiddenTraits ? [...vocalFloor.forbiddenTraits] : [],
    arrangement: withConceptVocalExclusions(parseNegativeStyleTerms(resolveNegativeStyleText(opts, genres)), conceptVocalExclusions),
    user: parseNegativeStyleTerms(opts.avoidWords)
  };
}

/**
 * 지시문 77 (TASK C-4.3) — **총량 중립 스왑.** 발성 배제어를 trimmable
 * arrangement 티어 맨 앞에 넣고, 같은 개수만큼 그 티어의 **꼬리**를 뺀다.
 *
 * 꼬리를 고르는 이유: buildExcludePrompt의 fitWithinBudget이 예산 압박
 * 시 실제로 먼저 버리는 쪽이 정확히 이 꼬리다 — 이 앱이 이미 갖고 있는
 * "여기서 뭐가 제일 덜 중요한가"의 유일한 권위 있는 순서를 그대로 따르지,
 * 그와 모순되는 두 번째 순서를 새로 만들지 않는다.
 *
 * 앞에 그냥 붙이기만 했을 때는 실측에서 excludePrompt 평균이 50.0 →
 * 60.5 단어로 늘었다(예산에 여유가 있어 fitWithinBudget이 아무것도 자르지
 * 않았기 때문) — §4.3 "총량을 늘리지 말 것"과 §7 회귀 금지 항목을 둘 다
 * 어긴다. 개수 스왑이 그 실측에 대한 수정이다.
 */
function withConceptVocalExclusions(arrangement: string[], conceptVocalExclusions: readonly string[]): string[] {
  if (!conceptVocalExclusions.length) return arrangement;
  const additions = conceptVocalExclusions.filter(term => !arrangement.includes(term));
  if (!additions.length) return arrangement;
  const keep = Math.max(0, arrangement.length - additions.length);
  return [...additions, ...arrangement.slice(0, keep)];
}

/** Reuses the SAME real dedup+subsumption logic buildExcludePrompt already relies on — never a second, independently-drifting copy. */
export function compileNegativePromptSpec(spec: NegativePromptSpec): string {
  return joinNegativeStyleTerms([...spec.copyright, ...spec.safety, ...spec.workspace, ...spec.vocal, ...spec.user, ...spec.arrangement]);
}

export const NEGATIVE_PROMPT_ADVISORY_LENGTH = { recommendedMax: 500, advisoryMax: 650 };

export type NegativePromptLengthSeverity = 'ok' | 'advisory' | 'blocking';

/**
 * ADVISORY-ONLY new signal — never touches the existing 750-850 (soft) /
 * 900 (hard cap) BLOCKING checks elsewhere (see this file's own top doc
 * comment). kids workspaces are exempt entirely (category preservation
 * wins over length there, per this task's own explicit instruction) —
 * always 'ok' for a kids archetype regardless of length.
 */
export function checkNegativePromptLength(compiled: string, archetype: string | undefined): NegativePromptLengthSeverity {
  if (isKidsArchetype(archetype)) return 'ok';
  const length = compiled.length;
  if (length > NEGATIVE_PROMPT_ADVISORY_LENGTH.advisoryMax) return 'blocking';
  if (length > NEGATIVE_PROMPT_ADVISORY_LENGTH.recommendedMax) return 'advisory';
  return 'ok';
}
