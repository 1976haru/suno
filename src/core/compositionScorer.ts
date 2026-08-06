import type { AudienceProfile, BilingualPair, ChannelArchetype, DisplayLanguage, LyricLanguage, ScopedIssue, SongIdea } from '../types';
import { isOverLengthAdvisory, isTransliteratedTitle, looksLikeLiteralTranslation } from './titleLocalizationChecks';
import { lyricLanguageMismatchReasonKo, measureLyrics, resolveLyricRange, stripLyricsToBody } from './lyricMetrics';
import { findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { lintInPackLyricDiversity, lintInPackStyleSimilarity } from './diversityLinter';
import { hookSceneTimeOfDayWarning, scenePropContradictionWarning, titleHookOverlapWarning } from './quality';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS, ERA_LABEL } from '../data/eraExclusions';
import { findBlockingVocabularyRepetition, findExcessiveVocabularyRepetition, findHookWordOveruse, WORD_BLOCKING_THRESHOLD } from './lyricVocabularyRepetition';
import { findNearDuplicateHook } from './hookSimilarity';
import { titleShapeVarietyWarning } from './titleShapeVariety';
import { eraSharesOf, type EraConstraint } from './constraints';
import { ERA_POLICY } from '../data/eraPolicy';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES, DUET_TRAIT_AXES } from '../data/vocalTraits';
import { detectVocalGenderPresence } from './vocalPlan';

/**
 * TASK v3.62 (TASK 2) — C안's whole premise is "the app plans and scores,
 * the LLM composes" instead of "the app dictates and hopes." This module
 * is deliberately almost entirely reuse: every check below except the two
 * marked NEW already existed (v3.58-v3.61) and previously only ran as
 * import-time warnings nobody had to act on. Here they become the gate a
 * recomposed song must pass (see core/compositionRecompose.ts, TASK 3) —
 * the same functions, now actually blocking instead of just informational.
 */
export interface CompositionScore {
  trackNo: number;
  passed: boolean;
  /** Must be fixed by recomposing this song (TASK 3's retry loop targets these). Track-scoped only as of v4.1 (TASK C) — pack-level findings live in CompositionScoreResult.packBlocking/packAdvisory instead of being broadcast into every track (see this module's own top-of-scoreComposition doc note). */
  blocking: string[];
  /** Surfaced to the user but never blocks. Track-scoped only, same v4.1 note as `blocking`. */
  advisory: string[];
}

/**
 * v4.1 (TASK C) — scoreComposition's real return shape: per-track findings
 * plus the pack-level findings that used to be copied into every track's
 * own blocking/advisory array (era consistency, vocal/tempo structure
 * collapse, vocabulary repetition, hook-word overuse, title-shape variety —
 * see scoreComposition's own doc comment for exactly which). A pack-level
 * finding is a property of the whole set, not any one song, so it belongs
 * here once, not duplicated 18 times.
 */
export interface CompositionScoreResult {
  tracks: CompositionScore[];
  packBlocking: ScopedIssue[];
  packAdvisory: ScopedIssue[];
}

/** TASK v3.62 (TASK 2-2, NEW) — a real pack measured 106 comma-separated descriptors in one stylePrompt; Suno reads a descriptor list, not prose, and this many stops being legible. 20/40 are the hard bounds; 25/35 is the advisory sweet spot the task's own spec asked for. */
const DESCRIPTOR_COUNT_BLOCK_MIN = 20;
const DESCRIPTOR_COUNT_BLOCK_MAX = 40;
const DESCRIPTOR_COUNT_ADVISORY_MIN = 25;
const DESCRIPTOR_COUNT_ADVISORY_MAX = 35;

/** v3.76 (TASK B) — exported so core/fullAudit.ts can reuse the exact same counting logic instead of duplicating it; no behavior change. */
export function descriptorCount(stylePrompt: string): number {
  return stylePrompt.split(',').map(atom => atom.trim()).filter(Boolean).length;
}

/**
 * v3.75 (TASK A) — real waveform measurement: a real 18-song pack averaged
 * 2:34 against a 3:10-3:35 target, with one track at 1:38. Real
 * measurement also showed word count alone does NOT reliably predict
 * render length (a near-identical 191-word pack rendered 65s longer than
 * this 194-word one) — so this check is deliberately NOT a precise duration
 * estimator. It only catches the unambiguous pathological case: a lyric so
 * short that no reasonable Suno pacing could reach 2:50. Passing this check
 * is not proof a song renders >= 2:50; failing it is strong evidence it
 * won't. See promptComposer.ts's MIN_LYRIC_WORDS (215-230, the actual
 * instruction) — the floor here sits well below that, at the point where
 * shortness stops being "a bit under target" and starts being "1:38-class".
 */
const LYRIC_BLOCKING_FLOOR_RATIO = 130 / 215;
const LYRIC_ADVISORY_FLOOR_RATIO = 190 / 215;
const SECTION_COUNT_ADVISORY_FLOOR = 5;

/**
 * v3.76 (TASK B) — exported for core/fullAudit.ts.
 * v4.1 (TASK B) — `language` picks the counting rule: English/Korean count
 * whitespace-delimited units (word/eojeol), Japanese counts characters (see
 * core/lyricMetrics.ts's measureLyrics -- NOT whitespace, Japanese lyrics
 * have none). Defaults to 'english' so the two out-of-scope callers
 * (csvExport.ts, fullAudit.ts -- not part of this task's 3-site list) keep
 * their exact pre-v4.1 behavior unchanged.
 */
/**
 * TASK v4.11 (TASK A) — the single blanket "[male vocal]"/"[duet vocal]"
 * meta tag every solo/duet song gets at the very top of its lyrics
 * (core/vocalPlan.ts's resolveVocalMetaTag; see this file's own
 * sectionLevelGenderTags comment on the same distinction) is not a musical
 * section, but the bracket-tag regex below used to count it as one — every
 * song's measured section count was 1 higher than its real structural
 * shape, which made a template that actually matched its BPM tier's
 * sectionRange (core/bpmLengthControl.ts) read as a false violation. Mirrors
 * srtExport.ts's own identical VOCAL_META_TAG_LINE exclusion.
 */
/**
 * TASK (ratio-based lyric language mismatch) — the meta-tag/section-header
 * stripping this function used to do inline now lives in
 * core/lyricMetrics.ts's stripLyricsToBody (that file's own new ratio check
 * needs the exact same stripping, so it moved there rather than staying
 * duplicated in two files — see that function's own doc comment). Behavior
 * here is unchanged: same VOCAL_META_TAG_LINE/bracket-line rules, same
 * `sections` count, same `words` measurement.
 */
export function lyricWordAndSectionCounts(lyrics: string, language: LyricLanguage = 'english'): { words: number; sections: number } {
  const { text, sectionCount } = stripLyricsToBody(lyrics);
  const words = measureLyrics(text, language).primary;
  return { words, sections: sectionCount };
}

/**
 * v3.75 (TASK C) — real measurement: overall vocal-type counts were normal
 * (duet 6 / male 7 / female 5 across 18 songs) but the ORDER clumped 3
 * duets into the first 6 tracks and 4 males in a row into tracks 13-16. A
 * listener who samples a handful of tracks (a real user picking "6곡") sees
 * this clumping directly. core/vocalPlan.ts's buildVocalPlan now schedules
 * for even spread by construction (see its own v3.75 comment); this is the
 * detection half — advisory only, checked in fixed thirds of the actual
 * delivered pack (not the plan) so it also catches a hand-edited or
 * partially-regenerated pack that drifted from the original plan.
 */
const VOCAL_ZONE_COUNT = 3;
const VOCAL_ZONE_SAME_TYPE_ADVISORY_FLOOR = 4;

/** v3.76 (TASK B) — exported for core/fullAudit.ts; no behavior change. */
export function vocalZoneDistributionWarnings(songs: Pick<SongIdea, 'trackNo' | 'vocalType'>[]): string[] {
  if (songs.length < 6) return [];
  const ordered = [...songs].sort((a, b) => a.trackNo - b.trackNo);
  const zoneSize = Math.ceil(ordered.length / VOCAL_ZONE_COUNT);
  const warnings: string[] = [];
  for (let zoneIndex = 0; zoneIndex < VOCAL_ZONE_COUNT; zoneIndex++) {
    const zoneSongs = ordered.slice(zoneIndex * zoneSize, (zoneIndex + 1) * zoneSize);
    if (!zoneSongs.length) continue;
    const counts = new Map<string, number>();
    for (const song of zoneSongs) {
      if (!song.vocalType) continue;
      counts.set(song.vocalType, (counts.get(song.vocalType) ?? 0) + 1);
    }
    for (const [type, count] of counts) {
      if (count >= VOCAL_ZONE_SAME_TYPE_ADVISORY_FLOOR) {
        const first = zoneSongs[0].trackNo;
        const last = zoneSongs[zoneSongs.length - 1].trackNo;
        warnings.push(`트랙 ${first}~${last} 구간에 ${type} 보컬이 ${count}곡 몰려 있습니다 — 이 구간만 들으면 보컬이 다양하지 않게 느껴질 수 있습니다.`);
      }
    }
  }
  return warnings;
}

/** TASK v3.58 (TASK 1) threshold, reused here as the blocking bar for cross-song style-prompt similarity. */
const STYLE_SIMILARITY_BLOCK_THRESHOLD = 0.28;

/**
 * TASK v3.70 (TASK A) — a duet song's stylePrompt reliably contains the
 * literal word "duet" without needing any extra slot/plan plumbing threaded
 * into this function: both duet vocal presets' own prompt text says "...
 * duet, ..." (data/vocalPresets.ts), and reconcileWithPreassignedSlot
 * (core/batchPreallocation.ts) force-appends that exact vocalText into the
 * final stylePrompt if a remote agent ever omits it — so by the time a song
 * reaches this scorer, "duet" is a reliable, self-contained signal.
 */
const DUET_STYLE_SIGNAL = /\bduet\b/i;

/** Only a colon-bearing bracket tag counts as a per-section assignment (e.g. "[verse 1: male vocal]") — the single blanket "[male vocal]"/"[duet vocal]" meta tag every solo/duet song already gets at the very top of its lyrics (core/vocalPlan.ts's resolveVocalMetaTag) must never be mistaken for one. */
function sectionLevelGenderTags(lyrics: string): string[] {
  return (lyrics.match(/\[[^\]]*:[^\]]*\]/g) || []).filter(tag => /\b(male|female)\b/i.test(tag));
}

export interface ScoreCompositionOptions {
  /**
   * TASK v3.64 (TASK A) — the channel's real cross-pack hook history (see
   * core/hookLedger.ts's recentUsedTitlesAndHooks). Wiring this in turns
   * the previously-warning-only "duplicates a hook already used by this
   * channel" check (claudeCodeBridge.ts's flagHookCollisions, still
   * running unchanged at import time) into an actual blocking gate here —
   * so the recompose loop (TASK 3) and the bridge's "재작곡 지시문 복사" button
   * (Step4Result.tsx) both act on it instead of it only ever showing as a
   * soft warning nobody had to act on. Optional — omitting it (e.g. a
   * caller with no channel/IndexedDB context) just skips this specific
   * check, same as any other omitted context.
   */
  historicalHooks?: string[];
  /**
   * v4.2 (TASK A3, TASK B) — this pack's own resolved era constraint (see
   * core/constraints.ts's EraConstraint), when the caller has one. Undefined
   * (or era.unspecified — no decade/artist-era signal in the concept)
   * skips this check entirely, same as any other omitted context; never
   * invented from the songs themselves.
   */
  eraConstraint?: EraConstraint;
  /** v4.1 (TASK B) -- which language's counting rule lyricWordAndSectionCounts should use. Defaults to 'english' when omitted. */
  lyricLanguage?: LyricLanguage;
  /** v4.1 (TASK B) -- source of the real per-language target range (see core/lyricMetrics.ts's resolveLyricRange). Omitting it falls back to language-appropriate estimates, not this file's own hardcoded numbers. */
  audienceProfile?: AudienceProfile;
  /** v4.3 (TASK A) — this pack's resolved packaging language (see core/packagingLanguage.ts's resolvePackagingLanguage). Undefined/'english' skips every titleLocalized check below entirely — there is nothing to require. */
  packagingLanguage?: DisplayLanguage;
  /**
   * v5.14 (compositionScorer follow-up to v5.12's channel-fixed vocal quota
   * work) — this channel's real fixed gender quota
   * (ChannelProfile.vocalQuotaOverride, e.g. kr-idol-male's
   * `{male:15,female:0,mixed:3}`), when the caller has one. Gates the 3
   * male-only/female-only text-leak checks below (opposite-gender descriptor
   * in stylePrompt, opposite-gender meta tag in lyrics, duet/group phrasing
   * outside a mixed-quota track) — see this module's own doc comment just
   * above those checks for why an auto-balanced channel (no
   * vocalQuotaOverride) must never run them. Undefined (the default for
   * every existing caller) skips all 3 checks entirely, same as every other
   * omitted opt in this file.
   */
  vocalQuotaOverride?: { male: number; female: number; mixed: number };
  /**
   * v5.16 follow-up — the language blocking check just above (via
   * lyricLanguageMismatchReasonKo) was still calling with no context at
   * all, so it silently kept the flat 0.6 Korean-hangul floor and the
   * auto-detected (not explicitly-checked) bilingual pair even after
   * core/lyricMetrics.ts gained real per-workspace thresholds and an
   * explicit BilingualPair check (v5.16 TASK B+C). Both undefined (every
   * caller before this follow-up) reproduces the exact old behavior —
   * these are additive, not a breaking change.
   */
  archetype?: ChannelArchetype;
  bilingualPair?: BilingualPair;
}

/**
 * v5.14 (compositionScorer follow-up) — text-level counterpart to
 * core/designGate.ts's numeric "quota-fidelity" check (v5.12): designGate.ts
 * only ever sees PreassignedSongSlot[] (pre-text planning data), never the
 * real generated stylePrompt/lyrics, so it can verify a fixed-quota
 * channel's male/female/mixed song COUNTS match channel.vocalQuotaOverride
 * but can never verify that a male-only track's own TEXT stays free of
 * female-vocal language (or vice versa) — that gap was named as a follow-up
 * left for this module, the one that actually sees post-generation text (관문
 * 2). Only meaningful for a channel with a real fixed gender quota: an
 * auto-balanced channel's 'male'/'female' vocalType is a soft outcome of
 * scaleVocalQuota/buildVocalPlan, not a hard per-track promise, so there is
 * no "this track IS strictly this gender, no exceptions" contract to check
 * there — see ScoreCompositionOptions.vocalQuotaOverride's own doc comment.
 *
 * Vocabulary reused, not reinvented: detectVocalGenderPresence
 * (core/vocalPlan.ts) is the exact male/female word-presence detector
 * enforceVocalTextInStylePrompt already uses to correct a stray gender word
 * at generation time (FEMALE_VOICE_TERMS/MALE_VOICE_TERMS — she/her/soprano/
 * alto/... vs he/his/tenor/baritone/..., the real words this app's own
 * vocal-trait axes and vocal presets actually compose into a stylePrompt).
 * This is that same vocabulary, applied as a post-generation BLOCKING check
 * instead of a silent auto-correction — defense-in-depth for a leak that
 * slips past that correction, or is introduced by a future code path that
 * never calls it.
 */
function bracketTagsIn(text: string): string {
  return (text.match(/\[[^\]]*\]/g) || []).join(' ');
}

/**
 * v5.14 (compositionScorer follow-up) — real duet/group phrasing markers,
 * sourced from this codebase's own composed vocabulary rather than guessed:
 * DUET_STYLE_SIGNAL (data/vocalPresets.ts's "... duet, ..." text, reused
 * from this file's own TASK v3.70 check above), the literal meta-tag set
 * core/vocalPlan.ts's resolveVocalMetaTag actually emits, the literal "male
 * and female call and response" text core/vocalPlan.ts's
 * applyDuetSectionVocalTags hardcodes for a bridge/breakdown section, and
 * every DUET_TRAIT_AXES.pairing phrase (data/vocalTraits.ts) — the exact
 * pool core/vocalPlan.ts's buildAdultVocalTraitPlan draws from to compose a
 * mixed-quota track's own stylePrompt text. None of these phrases can appear
 * in a correctly-generated male-only/female-only track (buildAdultVocalTraitPlan
 * only ever composes them for a 'mixed'-type slot) — a match here means a
 * duet/group phrase leaked into a track that must read as one solo voice.
 */
const DUET_GROUP_PHRASING_MARKERS: RegExp[] = [
  DUET_STYLE_SIGNAL,
  /\[(duet vocal|mixed vocal|group vocal|children'?s choir)\]/i,
  /male and female call and response/i,
  ...DUET_TRAIT_AXES.pairing.map(phrase => new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
];

/**
 * v4.2 (TASK A3, TASK B) — see this task's own §3-3 "primary 비중 < 50% →
 * blocking, forbidden 시대 장르 존재 → blocking, 범용 장르 > 20% → advisory".
 * Pack-level (not attributable to one track), so every song's own score
 * gets the same findings, same pattern as vocabularyRepetitionWarning/
 * titleShapeWarning below.
 *
 * TASK E (design-gate and post-generation era-share checks disagree) —
 * thresholds now read from data/eraPolicy.ts's shared ERA_POLICY instead of
 * hardcoding their own numbers here (single-primary 0.5/generic-advisory
 * 0.2 are unchanged, byte-identical values — just re-sourced), and gained a
 * real co-primary check that was previously entirely absent (a compound-
 * decade concept's 30%/30% co-primary set used to pass core/designGate.ts's
 * pre-generation gate with NO equivalent post-generation check waiting for
 * it at all — see ERA_POLICY's own doc comment for the real investigation
 * that closed this gap and picked 40% each as the correct, validated
 * number, sourced from core/constraints.ts's applyEraQuota).
 */
function eraConsistencyFindings(songs: SongIdea[], eraConstraint: EraConstraint | undefined): { blocking: string[]; advisory: string[] } {
  if (!eraConstraint || eraConstraint.unspecified) return { blocking: [], advisory: [] };
  const genreCounts: Record<string, number> = {};
  for (const song of songs) {
    if (song.genreId) genreCounts[song.genreId] = (genreCounts[song.genreId] ?? 0) + 1;
  }
  const shares = eraSharesOf(genreCounts);
  const genericShare = shares.generic ?? 0;
  const forbiddenBuckets = eraConstraint.forbidden.filter(bucket => (shares[bucket] ?? 0) > 0);

  const blocking: string[] = [];
  const advisory: string[] = [];

  if (eraConstraint.coPrimary) {
    const primaryShare = shares[eraConstraint.primary] ?? 0;
    const coPrimaryShare = shares[eraConstraint.coPrimary] ?? 0;
    const minEach = ERA_POLICY.coPrimaryMinEach;
    if (primaryShare < minEach || coPrimaryShare < minEach) {
      blocking.push(`이 컨셉의 복수 주 시대(${ERA_LABEL[eraConstraint.primary]}·${ERA_LABEL[eraConstraint.coPrimary]}) 중 비중이 최소 ${Math.round(minEach * 100)}% 미만인 쪽이 있습니다 (${ERA_LABEL[eraConstraint.primary]} ${Math.round(primaryShare * 100)}% / ${ERA_LABEL[eraConstraint.coPrimary]} ${Math.round(coPrimaryShare * 100)}%).`);
    }
  } else {
    const primaryShare = shares[eraConstraint.primary] ?? 0;
    const min = ERA_POLICY.singlePrimaryMin;
    if (primaryShare < min) {
      blocking.push(`이 컨셉의 주 시대(${ERA_LABEL[eraConstraint.primary]}) 장르 비중이 ${Math.round(primaryShare * 100)}%로 최소 ${Math.round(min * 100)}% 미만입니다.`);
    }
  }

  if (forbiddenBuckets.length) {
    blocking.push(`이 컨셉이 금지한 시대(${forbiddenBuckets.map(bucket => ERA_LABEL[bucket]).join(', ')}) 장르가 포함되어 있습니다 (${forbiddenBuckets.map(bucket => `${Math.round((shares[bucket] ?? 0) * 100)}%`).join(', ')}).`);
  }
  if (genericShare > ERA_POLICY.genericAdvisoryMax) {
    advisory.push(`시대 표기 없는 범용 장르 비중이 ${Math.round(genericShare * 100)}%로 권장 상한(${Math.round(ERA_POLICY.genericAdvisoryMax * 100)}%)을 넘습니다.`);
  }
  return { blocking, advisory };
}

/**
 * v3.77 (TASK A-5 / TASK B-4) — regression-prevention blocking checks: this
 * app has repeatedly shipped a pack where vocal quota math and BPM band math
 * were individually "correct" (every share/count in range) while the actual
 * delivered pack still collapsed to one vocal descriptor or one BPM value
 * (usesVocalQuota/tempoBandsForProfile silently returning nothing —
 * see core/vocalPlan.ts and data/audienceProfiles.ts's own v3.77 comments).
 * These are the "산출물로 직접 확인" checks this task's own §10 principle asks
 * for: they read the SONGS actually produced, never the plan/settings that
 * were supposed to produce them, so a future regression that reintroduces
 * either silent-collapse bug fails a BLOCKING check immediately instead of
 * only showing up in a manual measurement months later. Thresholds are
 * deliberately far below fullAudit.ts's own advisory targets (vocal variety
 * >= 12, BPM stddev >= 8) — those stay advisory "room to improve" bars; these
 * are the "something is actually broken" floor, same relationship as
 * WORD_BLOCKING_THRESHOLD (30) sitting far below GENERIC_WORD_CAP (12).
 */
const VOCAL_DESCRIPTOR_VARIETY_BLOCKING_FLOOR = 5;
const VOCAL_DESCRIPTOR_SAME_MAX_SONGS = 3;
const BPM_STDDEV_BLOCKING_FLOOR = 6;
const BPM_RANGE_WIDTH_BLOCKING_FLOOR = 25;

function stddevOf(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function vocalAndTempoStructureFindings(songs: SongIdea[]): { blocking: string[] } {
  const blocking: string[] = [];

  const registerPool = [...MALE_VOCAL_TRAIT_AXES.register, ...FEMALE_VOCAL_TRAIT_AXES.register];
  const songsPerDescriptor = new Map<string, number>();
  const distinctDescriptors = new Set<string>();
  for (const song of songs) {
    const lower = song.stylePrompt.toLowerCase();
    for (const register of registerPool) {
      if (!lower.includes(register.toLowerCase())) continue;
      distinctDescriptors.add(register);
      songsPerDescriptor.set(register, (songsPerDescriptor.get(register) ?? 0) + 1);
    }
  }
  // distinctDescriptors.size === 0 means this pack's stylePrompt prose never
  // literally contains one of MALE/FEMALE_VOCAL_TRAIT_AXES' exact register
  // phrases — for a pack generated by the current pipeline that means
  // vocalPlan.ts's own register text never reached the prompt (a real
  // collapse, worth flagging elsewhere), but it's indistinguishable from an
  // older/frozen pack that predates this literal-phrase vocabulary entirely
  // (no measurable signal either way — same "skip, don't fail" treatment
  // this function already gives bpms.length < 6 above).
  if (songs.length >= 6 && distinctDescriptors.size > 0 && distinctDescriptors.size < VOCAL_DESCRIPTOR_VARIETY_BLOCKING_FLOOR) {
    blocking.push(`보컬 서술(레지스터)이 ${distinctDescriptors.size}종뿐입니다 (최소 ${VOCAL_DESCRIPTOR_VARIETY_BLOCKING_FLOOR}종) — 보컬 다양성 로직이 무너졌을 가능성이 큽니다.`);
  }
  for (const [descriptor, count] of songsPerDescriptor) {
    if (count > VOCAL_DESCRIPTOR_SAME_MAX_SONGS) {
      blocking.push(`보컬 서술 "${descriptor}"가 ${count}곡에 반복됩니다 (최대 ${VOCAL_DESCRIPTOR_SAME_MAX_SONGS}곡).`);
    }
  }

  const vocalTypes = songs.map(song => song.vocalType).filter((type): type is 'male' | 'female' | 'mixed' => Boolean(type));
  if (vocalTypes.length >= 6 && new Set(vocalTypes).size === 1) {
    blocking.push(`전체 세트의 보컬 타입이 "${vocalTypes[0]}" 한 종류뿐입니다 — 보컬 쿼터 로직이 무너졌을 가능성이 큽니다.`);
  }

  const bpms = songs.map(song => song.bpm).filter((bpm): bpm is number => typeof bpm === 'number');
  if (bpms.length >= 6) {
    const spread = stddevOf(bpms);
    if (spread < BPM_STDDEV_BLOCKING_FLOOR) {
      blocking.push(`BPM 표준편차가 ${spread.toFixed(1)}입니다 (최소 ${BPM_STDDEV_BLOCKING_FLOOR}) — 템포 밴드 로직이 무너졌을 가능성이 큽니다.`);
    }
    const width = Math.max(...bpms) - Math.min(...bpms);
    if (width < BPM_RANGE_WIDTH_BLOCKING_FLOOR) {
      blocking.push(`BPM 범위가 ${Math.min(...bpms)}~${Math.max(...bpms)}(폭 ${width})입니다 (최소 폭 ${BPM_RANGE_WIDTH_BLOCKING_FLOOR}) — 템포 밴드 로직이 무너졌을 가능성이 큽니다.`);
    }
  }

  return { blocking };
}

/** v4.1 (TASK C) — which tracks actually contain `word` (case-insensitive whole-word match) in the given field, so a pack-level vocabulary finding can carry a real affectedTracks list instead of "all of them". */
function tracksContainingWord(songs: SongIdea[], word: string, field: 'lyrics' | 'hookPhrase'): number[] {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return songs.filter(song => pattern.test(field === 'lyrics' ? song.lyrics : (song.hookPhrase || ''))).map(song => song.trackNo);
}

export function scoreComposition(songs: SongIdea[], opts?: ScoreCompositionOptions): CompositionScoreResult {
  if (!songs.length) return { tracks: [], packBlocking: [], packAdvisory: [] };
  const allTrackNos = songs.map(song => song.trackNo);

  const historicalHooks = opts?.historicalHooks ?? [];
  const historicalHookKeys = new Set(historicalHooks.map(hook => hook.trim().toLowerCase()));
  const lyricLanguage: LyricLanguage = opts?.lyricLanguage ?? 'english';
  const { primaryRange: lyricTargetRange } = resolveLyricRange(lyricLanguage, opts?.audienceProfile);
  const lyricBlockingFloor = Math.round(lyricTargetRange[0] * LYRIC_BLOCKING_FLOOR_RATIO);
  const lyricAdvisoryFloor = Math.round(lyricTargetRange[0] * LYRIC_ADVISORY_FLOOR_RATIO);
  const eraFindings = eraConsistencyFindings(songs, opts?.eraConstraint);
  const vocalZoneWarnings = vocalZoneDistributionWarnings(songs);
  const structureFindings = vocalAndTempoStructureFindings(songs);
  // v5.14 (compositionScorer follow-up) — see DUET_GROUP_PHRASING_MARKERS'
  // own doc comment for the full background; gates the 3 male-only/
  // female-only text-leak checks below to a real fixed-quota channel only.
  const fixedQuotaChannel = Boolean(opts?.vocalQuotaOverride);

  const vocabFindings = findArrangementVocabularyInLyrics(songs);
  const vocabByTrack = new Map<number, string[]>();
  for (const finding of vocabFindings) {
    vocabByTrack.set(finding.trackNo, [...(vocabByTrack.get(finding.trackNo) || []), finding.line]);
  }

  const similarityReport = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  const lyricDiversityReport = lintInPackLyricDiversity(songs.map(song => ({ trackNo: song.trackNo, lyrics: song.lyrics, hookPhrase: song.hookPhrase, title: song.title })));
  const repeatedPatternTracks = new Set([
    ...lyricDiversityReport.repeatedChorusHookPatterns.flatMap(p => p.trackNos),
    ...lyricDiversityReport.repeatedTitleShapes.flatMap(p => p.trackNos),
    ...lyricDiversityReport.repeatedFirstLinePatterns.flatMap(p => p.trackNos),
    ...lyricDiversityReport.repeatedChorusStructures.flatMap(p => p.trackNos)
  ]);

  // NEW (TASK v3.64 TASK A-4) — pack-wide vocabulary repetition (e.g. a real
  // pack repeated "window" 28x, "light"/"old" 27x each). This is a
  // whole-pack word-choice property, not attributable to any one track, so
  // (like the pack-level lyric-diversity checks above) the same finding is
  // surfaced as an advisory on every track rather than picking one to blame.
  const vocabularyRepetitionFindings = findExcessiveVocabularyRepetition(songs);
  const vocabularyRepetitionWarning = vocabularyRepetitionFindings.length
    ? `이 세트에서 다음 단어가 상한을 넘겨 반복됩니다: ${vocabularyRepetitionFindings.map(f => `${f.word} ${f.count}회 (상한 ${f.cap})`).join(', ')}`
    : undefined;

  // NEW (v3.77 TASK D-2) — "같은 단어 30회 초과 → blocking". Pack-level, same
  // attribution pattern as vocabularyRepetitionWarning above (every track's
  // score carries the same finding — this is a whole-pack word-choice
  // failure, not any one song's fault).
  const blockingVocabularyFindings = findBlockingVocabularyRepetition(songs);
  const blockingVocabularyMessage = blockingVocabularyFindings.length
    ? `이 세트에서 다음 단어가 ${WORD_BLOCKING_THRESHOLD}회를 초과해 반복됩니다 (차단 기준): ${blockingVocabularyFindings.map(f => `${f.word} ${f.count}회`).join(', ')}`
    : undefined;

  // NEW (v4.2, TASK A3 TASK D-2) — a word anchoring 3+ distinct hooks reads
  // as a recurring gimmick even when its pack-wide word count never crosses
  // GENERIC_WORD_CAP (findExcessiveVocabularyRepetition above counts lyric
  // bodies, not hooks specifically). Advisory only, per this task's own
  // "어휘 반복을 blocking으로 세게 걸지 말 것".
  const hookWordOveruseFindings = findHookWordOveruse(songs);
  const hookWordOveruseWarning = hookWordOveruseFindings.length
    ? `다음 단어가 3개 이상의 훅에 반복됩니다: ${hookWordOveruseFindings.map(f => `${f.word} (훅 ${f.hookCount}개)`).join(', ')}`
    : undefined;

  // NEW (TASK v3.64 TASK E) — real measurement: a real pack's titles were
  // almost entirely "[noun][noun]" (Firstlight Cup, Folded Frost, ...).
  // Warning-level only — title/hook overlap is never enforced as a ratio.
  const titleShapeWarning = titleShapeVarietyWarning(songs.map(song => song.title));

  // v4.1 (TASK C) — pack-level findings, exposed once instead of copied
  // into every track's own blocking/advisory array. `affectedTracks` is
  // real where computable (which tracks actually contain the offending
  // word); era/vocal/tempo structure collapse is a design-level property
  // of the whole pack (not any one song's fault), so those carry every
  // trackNo — that's what tells a caller "regenerating one song can't fix
  // this", not an empty list.
  const packBlocking: ScopedIssue[] = [];
  const packAdvisory: ScopedIssue[] = [];
  for (const message of eraFindings.blocking) {
    packBlocking.push({ scope: 'design', id: 'era-consistency', labelKo: message, affectedTracks: allTrackNos, fixHintKo: '설계 단계에서 시대(era) 장르 비중을 다시 배분해야 합니다 — 곡을 다시 만드는 것만으로는 고쳐지지 않습니다.' });
  }
  for (const message of eraFindings.advisory) {
    packAdvisory.push({ scope: 'design', id: 'era-consistency-advisory', labelKo: message, affectedTracks: allTrackNos, fixHintKo: '설계 단계에서 시대 장르 비중을 다시 배분하는 것을 고려하세요.' });
  }
  for (const message of structureFindings.blocking) {
    packBlocking.push({ scope: 'design', id: 'vocal-tempo-structure', labelKo: message, affectedTracks: allTrackNos, fixHintKo: '설계 단계에서 보컬/BPM 배분 로직을 다시 실행해야 합니다 — 곡을 다시 만드는 것만으로는 고쳐지지 않습니다.' });
  }
  if (blockingVocabularyMessage) {
    const affected = blockingVocabularyFindings.flatMap(finding => tracksContainingWord(songs, finding.word, 'lyrics'));
    packBlocking.push({ scope: 'rebalance', id: 'vocabulary-repetition-blocking', labelKo: blockingVocabularyMessage, affectedTracks: [...new Set(affected)].sort((a, b) => a - b), fixHintKo: '해당 단어가 쓰인 곡들만 골라 다른 표현으로 바꿔 다시 작성하십시오.' });
  }
  if (vocabularyRepetitionWarning) {
    const affected = vocabularyRepetitionFindings.flatMap(finding => tracksContainingWord(songs, finding.word, 'lyrics'));
    packAdvisory.push({ scope: 'rebalance', id: 'vocabulary-repetition-advisory', labelKo: vocabularyRepetitionWarning, affectedTracks: [...new Set(affected)].sort((a, b) => a - b), fixHintKo: '해당 단어가 자주 쓰인 곡들만 다른 표현으로 바꾸는 것을 고려하세요.' });
  }
  if (hookWordOveruseWarning) {
    const affected = hookWordOveruseFindings.flatMap(finding => tracksContainingWord(songs, finding.word, 'hookPhrase'));
    packAdvisory.push({ scope: 'rebalance', id: 'hook-word-overuse', labelKo: hookWordOveruseWarning, affectedTracks: [...new Set(affected)].sort((a, b) => a - b), fixHintKo: '해당 단어가 쓰인 훅 몇 개만 다른 단어로 바꾸는 것을 고려하세요.' });
  }
  if (titleShapeWarning) {
    packAdvisory.push({ scope: 'rebalance', id: 'title-shape-variety', labelKo: titleShapeWarning, affectedTracks: allTrackNos, fixHintKo: '제목 형태가 겹치는 곡 일부만 골라 제목을 다시 짓는 것을 고려하세요.' });
  }

  const tracks = songs.map(song => {
    const blocking: string[] = [];
    const advisory: string[] = [];

    // NEW (v3.75 TASK A) — see LYRIC_BLOCKING_FLOOR_RATIO's own doc
    // comment: catches only the pathological-short case, not a precise
    // duration prediction.
    // v4.1 (TASK B) — lyricUnitLabel/lyricWordCount now reflect the real
    // per-language unit (character count for Japanese, not whitespace
    // "words" -- see lyricWordAndSectionCounts's own doc comment).
    const lyricUnitLabel = lyricLanguage === 'japanese' ? '자' : '단어';
    const { words: lyricWordCount, sections: sectionCount } = lyricWordAndSectionCounts(song.lyrics, lyricLanguage);
    if (lyricWordCount < lyricBlockingFloor) {
      blocking.push(`가사가 ${lyricWordCount}${lyricUnitLabel}로 지나치게 짧습니다 (최소 ${lyricBlockingFloor}${lyricUnitLabel}) — 2:50 미만으로 렌더링될 위험이 큽니다. 참고: ${lyricUnitLabel}수만으로 정확한 길이를 예측할 수 없어 이 검사는 명백히 부족한 경우만 차단합니다.`);
    } else if (lyricWordCount < lyricAdvisoryFloor) {
      advisory.push(`가사가 ${lyricWordCount}${lyricUnitLabel}입니다 (권장 ${lyricTargetRange[0]}~${lyricTargetRange[1]}${lyricUnitLabel}) — 목표보다 짧게 렌더링될 수 있습니다.`);
    }
    if (sectionCount < SECTION_COUNT_ADVISORY_FLOOR) {
      advisory.push(`섹션이 ${sectionCount}개뿐입니다 (권장 ${SECTION_COUNT_ADVISORY_FLOOR}개 이상) — 인스트루멘털 구간이나 브릿지가 빠졌을 수 있습니다.`);
    }

    // TASK (ratio-based lyric language mismatch) — BLOCKING, not advisory:
    // this is the tier CompositionScore.blocking's own doc comment describes
    // ("must be fixed by recomposing this song", TASK 3's retry loop
    // target), the real "block + mark for recompose" mechanism this
    // codebase already has (core/compositionRecompose.ts's
    // recomposeBlockingTracks retries exactly these findings for the
    // realtime/AI-creative path; every other caller surfaces the same
    // blocking list to the user for the manual "재작곡 지시문 복사" flow).
    // core/batchPreallocation.ts's reconcileWithPreassignedSlot already
    // surfaces the identical finding earlier as a non-blocking
    // `song.warnings` entry (lyricLanguageMismatchWarning) — this is the
    // stricter tier on top of that, not a replacement for it.
    //
    // Only runs when the caller explicitly declared a real target language
    // via opts.lyricLanguage (not this function's own `lyricLanguage`
    // constant, which silently falls back to 'english' when omitted) —
    // mirrors lyricWordAndSectionCounts's own pre-v4.1 carve-out for the
    // out-of-scope callers that never supply a real language
    // (csvExport.ts's evaluateGenerationGate call, and this file's own
    // no-opts test calls): those must keep reading as "no finding" rather
    // than getting a spurious block on every non-English pack just because
    // nothing told this function what language to expect.
    if (opts?.lyricLanguage) {
      const languageReason = lyricLanguageMismatchReasonKo(song.lyrics, opts.lyricLanguage, { archetype: opts.archetype, bilingualPair: opts.bilingualPair });
      if (languageReason) blocking.push(languageReason);
    }

    // Reused: TASK v3.60 TASK A — arrangement/production vocabulary sung as lyrics.
    const vocabLines = vocabByTrack.get(song.trackNo);
    if (vocabLines?.length) {
      blocking.push(`가사에 편곡/악기 어휘가 문장의 주어로 등장합니다 — "${vocabLines[0]}"`);
    }

    // Reused: TASK v3.58 TASK 3 — artist-name leak guard (style prompt + lyrics + youtube).
    // TASK v5.19 (P0 emergency fix) — lyrics scope now requires real
    // corroborating context for commonWordRisk seeds (bread/eagles/
    // carpenters and similar), so an ordinary lyric line ("breaking bread at
    // the table") no longer trips this generation-time blocking gate; see
    // artistReferenceDecomposer.ts's hasArtistContextSignal. stylePrompt
    // stays strict/context-free — it's app-generated, not natural language.
    const styleLeaks = findArtistReferenceLeaks(song.stylePrompt);
    if (styleLeaks.length) blocking.push(`style prompt에 아티스트/밴드명 누출 (${styleLeaks.map(l => l.surface).join(', ')})`);
    const lyricLeaks = findArtistReferenceLeaks(song.lyrics, 'lyrics');
    if (lyricLeaks.length) blocking.push(`가사에 아티스트/밴드명 누출 (${lyricLeaks.map(l => l.surface).join(', ')})`);
    const youtubeLeaks = findArtistReferenceLeaks(`${song.youtube?.title ?? ''} ${song.youtube?.description ?? ''}`);
    if (youtubeLeaks.length) blocking.push(`youtube 메타데이터에 아티스트/밴드명 누출 (${youtubeLeaks.map(l => l.surface).join(', ')})`);

    // NEW (TASK v3.70 TASK A) — real listening feedback: a duet-prompted
    // track rendered as a single voice because nothing in the lyrics told
    // Suno which section is which singer (Suno reads lyric tags to split
    // vocals, not stylePrompt prose — see core/vocalPlan.ts's
    // applyDuetSectionVocalTags). Blocking for a duet missing both genders'
    // section tags; advisory (not blocking) for a non-duet song that
    // somehow has them, since that's surprising but not necessarily wrong.
    const isDuetSong = DUET_STYLE_SIGNAL.test(song.stylePrompt);
    const genderTags = sectionLevelGenderTags(song.lyrics);
    const hasMaleSectionTag = genderTags.some(tag => /\bmale\b/i.test(tag));
    const hasFemaleSectionTag = genderTags.some(tag => /\bfemale\b/i.test(tag));
    if (isDuetSong && !(hasMaleSectionTag && hasFemaleSectionTag)) {
      blocking.push('듀엣 곡인데 가사에 [Verse 1: Male Vocal]/[Verse 2: Female Vocal] 같은 섹션별 보컬 배정 태그가 없습니다 — Suno는 가사 태그로 보컬을 나누므로, 태그가 없으면 한 명이 전부 부릅니다.');
    } else if (!isDuetSong && (hasMaleSectionTag || hasFemaleSectionTag)) {
      advisory.push('단독 보컬 곡인데 가사에 섹션별 성별 보컬 배정 태그가 있습니다 — 의도한 것인지 확인하세요.');
    }

    // NEW (v5.14, compositionScorer follow-up to v5.12's channel-fixed vocal
    // quota work) — see DUET_GROUP_PHRASING_MARKERS' own doc comment above
    // for the full background/vocabulary sourcing. Only engages for a real
    // fixed-quota channel (opts.vocalQuotaOverride set) and only for a track
    // whose own assigned vocalType is strictly 'male' or 'female' — a
    // 'mixed'-type track (or a track with no vocalType at all) is skipped
    // entirely, since duet/group phrasing and either gender's descriptors
    // are legitimate there.
    if (fixedQuotaChannel && (song.vocalType === 'male' || song.vocalType === 'female')) {
      const oppositeGender = song.vocalType === 'male' ? 'female' : 'male';
      const oppositeLabel = oppositeGender === 'female' ? '여성' : '남성';

      // Check 1 — zero opposite-gender vocal descriptors in the stylePrompt.
      const stylePresence = detectVocalGenderPresence(song.stylePrompt);
      if (stylePresence[oppositeGender]) {
        blocking.push(`고정 보컬 쿼터 채널의 "${song.vocalType}" 전용 곡인데 style prompt에 ${oppositeLabel} 보컬 서술 어휘가 섞여 있습니다.`);
      }

      // Check 2 — zero opposite-gender meta tags in the lyrics (the top-level
      // blanket tag or a per-section "[...: female vocal]"-style tag), scoped
      // to bracket tags only so ordinary third-person pronouns in a lyric's
      // storytelling body ("she"/"her" about someone the singer addresses)
      // never false-positive here — see sectionLevelGenderTags above for the
      // same bracket-only scoping principle on the colon-tag check.
      const tagPresence = detectVocalGenderPresence(bracketTagsIn(song.lyrics));
      if (tagPresence[oppositeGender]) {
        blocking.push(`고정 보컬 쿼터 채널의 "${song.vocalType}" 전용 곡인데 가사의 보컬 메타 태그에 ${oppositeLabel} 표기가 섞여 있습니다.`);
      }

      // Check 3 — zero duet/group phrasing (only appropriate for a
      // mixed-quota track), checked across both stylePrompt and lyrics.
      const combinedVocalText = `${song.stylePrompt}\n${song.lyrics}`;
      if (DUET_GROUP_PHRASING_MARKERS.some(pattern => pattern.test(combinedVocalText))) {
        blocking.push(`고정 보컬 쿼터 채널의 "${song.vocalType}" 전용 곡인데 듀엣/그룹 보컬 표현이 섞여 있습니다 — 듀엣/그룹 표현은 mixed 쿼터 곡에만 허용됩니다.`);
      }
    }

    // NEW (TASK v3.64 TASK D) — was a warning-only check (claudeCodeBridge.ts's
    // flagHookCollisions, unchanged, still runs at import time too); this is
    // the same real-history data now also gating recompose/the copy-instruction button.
    if (song.hookPhrase && historicalHookKeys.has(song.hookPhrase.trim().toLowerCase())) {
      blocking.push(`훅 "${song.hookPhrase}"가 이 채널의 이전 세트에서 이미 사용됐습니다`);
    } else if (song.hookPhrase) {
      const nearDuplicate = findNearDuplicateHook(song.hookPhrase, historicalHooks);
      if (nearDuplicate) {
        blocking.push(`훅 "${song.hookPhrase}"가 이전 세트의 훅 "${nearDuplicate.matchedAgainst}"과 사실상 같은 훅입니다 (단어 일치율 ${Math.round(nearDuplicate.similarity * 100)}%)`);
      }
    }

    // Reused: TASK v3.58 TASK 1 — cross-song style-prompt similarity, only the pair(s) this track is actually part of.
    if (similarityReport.worstPair && similarityReport.worstPair.similarity > STYLE_SIMILARITY_BLOCK_THRESHOLD
      && (similarityReport.worstPair.trackNoA === song.trackNo || similarityReport.worstPair.trackNoB === song.trackNo)) {
      blocking.push(`다른 트랙(${similarityReport.worstPair.trackNoA === song.trackNo ? similarityReport.worstPair.trackNoB : similarityReport.worstPair.trackNoA})과 스타일 프롬프트 유사도 ${Math.round(similarityReport.worstPair.similarity * 100)}% (기준 ${Math.round(STYLE_SIMILARITY_BLOCK_THRESHOLD * 100)}% 이하)`);
    }

    // NEW (TASK 2-2) — descriptor count.
    const count = descriptorCount(song.stylePrompt);
    if (count < DESCRIPTOR_COUNT_BLOCK_MIN || count > DESCRIPTOR_COUNT_BLOCK_MAX) {
      blocking.push(`style prompt 서술어가 ${count}개입니다 (허용 ${DESCRIPTOR_COUNT_BLOCK_MIN}-${DESCRIPTOR_COUNT_BLOCK_MAX}개)`);
    } else if (count < DESCRIPTOR_COUNT_ADVISORY_MIN || count > DESCRIPTOR_COUNT_ADVISORY_MAX) {
      advisory.push(`style prompt 서술어가 ${count}개입니다 (권장 ${DESCRIPTOR_COUNT_ADVISORY_MIN}-${DESCRIPTOR_COUNT_ADVISORY_MAX}개)`);
    }

    // NEW (TASK 2-2) — era-anachronism check for the oldpop-* family.
    const eraBucket = eraBucketForGenreId(song.genreId);
    if (eraBucket) {
      const forbidden = ERA_FORBIDDEN_DESCRIPTORS[eraBucket];
      const lowerPrompt = song.stylePrompt.toLowerCase();
      const found = forbidden.filter(term => lowerPrompt.includes(term));
      if (found.length) {
        blocking.push(`${eraBucket} 장르(${song.genreId})인데 이 시대에 없는 서술어가 있습니다: ${found.join(', ')}`);
      }
    }

    // Reused: TASK v3.60 TASK E — hook/scene time-of-day and prop contradictions (advisory).
    const timeOfDayWarning = hookSceneTimeOfDayWarning(song.hookPhrase, song.listenerSituation);
    if (timeOfDayWarning) advisory.push(timeOfDayWarning);
    const propWarning = scenePropContradictionWarning(song.listenerSituation, song.lyrics);
    if (propWarning) advisory.push(propWarning);

    // Reused: v3.58 TASK 5-6 — title/hook zero-overlap (advisory).
    const overlapWarning = titleHookOverlapWarning(song.title, song.hookPhrase);
    if (overlapWarning) advisory.push(overlapWarning);

    // NEW (v4.3 TASK A) — 이중언어 제목 검사. packagingLanguage가 english가
    // 아닐 때만 적용 (§1-6). 나머지 세 검사는 titleLocalized가 실제로 있을
    // 때만 의미가 있으므로 missing 검사와 서로 배타적으로 실행한다.
    const packagingLanguage = opts?.packagingLanguage;
    if (packagingLanguage && packagingLanguage !== 'english') {
      if (!song.titleLocalized) {
        blocking.push(`packagingLanguage가 "${packagingLanguage}"인데 titleLocalized가 없습니다 — 이중언어 제목이 누락됐습니다.`);
      } else {
        if (isTransliteratedTitle(song.titleLocalized, packagingLanguage)) {
          blocking.push(`titleLocalized "${song.titleLocalized}"가 영어 제목의 음차(발음 그대로 옮김)로 보입니다 — 재해석된 제목이어야 합니다.`);
        }
        if (isOverLengthAdvisory(song.titleLocalized)) {
          advisory.push(`titleLocalized "${song.titleLocalized}"가 ${song.titleLocalized.length}자로 15자를 넘습니다 — 썸네일/목록에서 잘릴 수 있습니다.`);
        }
        if (looksLikeLiteralTranslation(song.title, song.titleLocalized, packagingLanguage)) {
          advisory.push(`titleLocalized "${song.titleLocalized}"가 title "${song.title}"의 단어별 직역으로 보입니다 — 장면/감정을 재해석했는지 확인하세요. (자동 판정은 오탐이 있을 수 있습니다)`);
        }
      }
    }

    // Reused: TASK v3.60 TASK D — chorus/title monotony (advisory, pack-level but attributed per track when this track is part of the repeated group).
    if (repeatedPatternTracks.has(song.trackNo)) {
      advisory.push('이 곡의 후렴 반복 패턴/제목 형태/첫줄 패턴이 세트 내 다른 곡들과 반복됩니다.');
    }

    // v4.1 (TASK C) — vocabularyRepetitionWarning/blockingVocabularyMessage/
    // hookWordOveruseWarning/titleShapeWarning/eraFindings/
    // structureFindings.blocking used to be pushed into EVERY track's own
    // blocking/advisory here (an 18x copy of a whole-pack finding). They now
    // live in packBlocking/packAdvisory above instead — see this function's
    // own top note. vocalZoneWarnings stays here unchanged (not part of
    // this task's pack-level-findings list; still broadcast per track).
    advisory.push(...vocalZoneWarnings);

    return { trackNo: song.trackNo, passed: blocking.length === 0, blocking, advisory };
  });

  return { tracks, packBlocking, packAdvisory };
}
