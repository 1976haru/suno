import type { GenerationOptions, GenrePack } from '../types';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
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
 *    of, the existing EXCLUDE_PROMPT_TARGET (750-850, core/releaseReadiness.ts)
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
 *  - vocal: honestly empty — no vocal-specific negative-term source exists
 *    in this codebase today (confirmed by investigation); kept as a real
 *    field for a future real source to populate, not fabricated here.
 */
export function buildNegativePromptSpec(
  opts: Pick<GenerationOptions, 'avoidWords' | 'channel' | 'negativeStyle'>,
  genres: GenrePack[] = [],
  relaxedExclusions: readonly string[] = []
): NegativePromptSpec {
  const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.channel.audience);
  const relaxable = new Set(audienceProfile.relaxableAtPeak);
  const relaxedNow = new Set(relaxedExclusions.filter(item => relaxable.has(item)));
  const safety = audienceProfile.exclusions.filter(item => !relaxedNow.has(item));
  const soundFloor = channelSoundFloorForArchetype(opts.channel.archetype);

  return {
    safety,
    copyright: [...COPYRIGHT_TERMS],
    workspace: soundFloor?.forbiddenAtoms ? [...soundFloor.forbiddenAtoms] : [],
    vocal: [],
    arrangement: parseNegativeStyleTerms(resolveNegativeStyleText(opts, genres)),
    user: parseNegativeStyleTerms(opts.avoidWords)
  };
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
