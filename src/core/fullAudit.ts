import type { AudienceProfile, ChannelArchetype, LyricLanguage, SongIdea } from '../types';
import { workspaceForArchetype } from '../data/workspaces';
import { distinctChoicePolicyForWorkspace, safetyForbiddenRuleIdsForWorkspace } from '../data/distinctChoicePolicy';
import { evaluateDistinctChoiceGate } from './distinctChoiceGate';
import { findLyricMetaLeaks } from './lyricMetaLeak';
import { evaluateObjectState, type ObjectStateLanguage } from './narrativeState';
import { objectStatePolicyForWorkspace } from '../data/objectStatePolicy';
import { descriptorCount, lyricWordAndSectionCounts, vocalZoneDistributionWarnings } from './compositionScorer';
import { findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { ARTIST_SCAN_FIELDS } from '../data/scanTargets';
import { findBlockingVocabularyRepetition, findExcessiveVocabularyRepetition, findHookWordOveruse, topWordFrequencies, WORD_BLOCKING_THRESHOLD } from './lyricVocabularyRepetition';
import { lintInPackStyleSimilarity } from './diversityLinter';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS } from '../data/eraExclusions';
import { classifyTitleShape } from './titleShapeVariety';
import { detectVocalGender, scaleVocalQuota, type VocalQuota } from './vocalPlan';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES } from '../data/vocalTraits';
import { auditPromises, auditTitleConceptConsistency, type PromiseAuditReport, type TitleConsistencyReport } from './promiseAudit';
import type { AudioSetReport } from './audioSetReport';
import { resolveBpmLengthTier } from './bpmLengthControl';
import { expectedArcPhaseCount, KIDS_ARC_PHASE_VALUES } from './arcModels';
import { deriveEraIntent, checkEraPromptAgainstIntent } from './eraIntent';
import { SENIOR_ERA_POLICY } from './seniorOldpopPolicy';
import { auditStylePromptAgainstSpec } from './promptSpec';
import { classifyClause, introSubcategory, type PromptAxis } from '../data/promptAxisLexicon';
import { resolveSceneSignatureSource } from './situationLedger';

/**
 * v3.76 (TASK B) — "정합성 전수 검사": every check this app's own task
 * documents (v3.58 through v3.76) have separately asked for, run together
 * in one pass instead of scattered across one-off scripts/tests. This
 * module is pure measurement — it imports checks that already exist
 * elsewhere (compositionScorer.ts, lyricVocabularyGuard.ts, diversityLinter.ts,
 * ...) rather than reimplementing them, per this task's own "검사 항목을
 * 임의로 줄이지 말 것" and "lyricEngine.ts / 프롬프트 조립 / 채점 층을 수정하지
 * 말 것" — nothing here changes what a song generates, only what gets
 * measured about it afterward.
 */

export type AuditStatus = 'pass' | 'fail' | 'not-measured';

export interface AuditItem {
  id: string;
  category: '생성 구조' | '보컬' | '프롬프트' | '가사' | '킬링포인트·아크' | '제목' | '약속 이행도' | '워크스페이스';
  labelKo: string;
  targetKo: string;
  actualKo: string;
  status: AuditStatus;
  /** True when this item can only be measured from a rendered mp3 (v3.73/v3.74's audio pipeline) — absent audio data, it's always 'not-measured', never 'fail'. */
  requiresAudio: boolean;
  /** True when this app has no existing check for this yet — reported honestly rather than faked (this task's own §9 "미구현 항목은 명시적으로 미구현이라고 적을 것"). */
  notImplemented?: boolean;
  /** Which past task first asked for this check, and any later task that re-asked for it — TASK D's own "지시문끼리 모순되거나 근본 원인을 못 잡은 것" signal. */
  specifiedBy: string[];
  /**
   * v4.4 (TASK C) — a comparable number for baseline "best value ever
   * measured" tracking, additive on top of the existing boolean pass/fail
   * (AuditItem never had a raw numeric value, only the pre-formatted
   * actualKo display string). Populated only for the handful of items
   * TASK C's own scope names (word count/leak count/prompt length/
   * descriptor count/vocab repeat/title patterns/era violations/vocal
   * description variety) — not all items, so this stays additive rather
   * than a full redesign. `direction` says which way is "better" so
   * scripts/audit.ts's classify() can tell "improving but still below
   * target" from "regressed" without hardcoding per-item knowledge.
   */
  metric?: { value: number; direction: 'higherIsBetter' | 'lowerIsBetter' };
}

export interface FullAuditReport {
  conceptLabel: string;
  songCount: number;
  items: AuditItem[];
  promiseAudit: PromiseAuditReport;
  titleConsistency: TitleConsistencyReport;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function longestRun<T>(items: readonly T[]): number {
  let longest = 1;
  let current = 1;
  for (let i = 1; i < items.length; i++) {
    current = items[i] === items[i - 1] ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return items.length ? longest : 0;
}

function item(
  partial: Omit<AuditItem, 'status'> & { pass: boolean | null }
): AuditItem {
  const { pass, ...rest } = partial;
  return { ...rest, status: pass === null ? 'not-measured' : pass ? 'pass' : 'fail' };
}

// ---------------------------------------------------------------------------
// [생성 구조]
// ---------------------------------------------------------------------------
function structureItems(songs: SongIdea[], expectedSongCount: number, audienceProfile: AudienceProfile): AuditItem[] {
  const genreCounts = new Map<string, number>();
  for (const song of songs) {
    if (!song.genreId) continue;
    genreCounts.set(song.genreId, (genreCounts.get(song.genreId) ?? 0) + 1);
  }
  const genreIds = songs.map(song => song.genreId ?? '(none)');
  const bpms = songs.map(song => song.bpm).filter((bpm): bpm is number => typeof bpm === 'number');

  return [
    item({
      id: 'song_count', category: '생성 구조', labelKo: '곡 수',
      targetKo: `${expectedSongCount}곡`, actualKo: `${songs.length}곡`,
      pass: songs.length === expectedSongCount, requiresAudio: false, specifiedBy: ['v3.63']
    }),
    item({
      id: 'genre_variety', category: '생성 구조', labelKo: '장르 종류',
      targetKo: '4~9종', actualKo: `${genreCounts.size}종`,
      pass: genreCounts.size >= 4 && genreCounts.size <= 9, requiresAudio: false, specifiedBy: ['v3.49A']
    }),
    item({
      id: 'genre_max5', category: '생성 구조', labelKo: '같은 장르 최대 곡수',
      targetKo: '≤ 5곡', actualKo: `${Math.max(0, ...genreCounts.values())}곡`,
      pass: [...genreCounts.values()].every(count => count <= 5), requiresAudio: false, specifiedBy: ['v3.63']
    }),
    item({
      id: 'genre_no_singleton', category: '생성 구조', labelKo: '1곡짜리 장르',
      targetKo: '0개', actualKo: `${[...genreCounts.values()].filter(count => count === 1).length}개`,
      pass: [...genreCounts.values()].every(count => count !== 1), requiresAudio: false, specifiedBy: ['v3.63']
    }),
    item({
      id: 'genre_no_triple_run', category: '생성 구조', labelKo: '같은 장르 연속',
      targetKo: '≤ 2곡', actualKo: `${longestRun(genreIds)}곡`,
      pass: longestRun(genreIds) <= 2, requiresAudio: false, specifiedBy: ['genreRotation']
    }),
    item({
      id: 'bpm_stddev', category: '생성 구조', labelKo: 'BPM 표준편차',
      targetKo: '≥ 8', actualKo: stddev(bpms).toFixed(1),
      pass: bpms.length ? stddev(bpms) >= 8 : null, requiresAudio: false, specifiedBy: ['v3.58 TASK 4', 'v3.64 TASK C']
    }),
    item({
      id: 'bpm_in_range', category: '생성 구조', labelKo: 'BPM 범위',
      targetKo: `${audienceProfile.tempoFloor}~${audienceProfile.tempoCeiling}`, actualKo: bpms.length ? `${Math.min(...bpms)}~${Math.max(...bpms)}` : '(없음)',
      pass: bpms.length ? bpms.every(bpm => bpm >= audienceProfile.tempoFloor && bpm <= audienceProfile.tempoCeiling) : null,
      requiresAudio: false, specifiedBy: ['audienceProfiles']
    })
  ];
}

// ---------------------------------------------------------------------------
// [보컬]
// ---------------------------------------------------------------------------
/**
 * TASK (정합성 점검 §1 결함2 fix) — a channel with a fixed vocalQuotaOverride
 * (e.g. kr-idol-male's real {male:15, female:0, mixed:3}) mirrors
 * designGate.ts's own vocalIssues/quotaFidelityIssues split (see that
 * function's doc comment): 15/18 male tracks guarantee long same-type runs
 * and a 0-share type no matter how the remaining songs are spread, so the
 * generic 25~42%-per-type / zone / consecutive-run checks below are
 * mathematically impossible to pass and were never a real quality signal for
 * these channels — before this fix they made kr-idol-male/female
 * permanently unable to reach releaseReady:true even on a correctly
 * generated pack, while designGate.ts (already override-aware since 6bc2633)
 * happily passed the same plan. `vocal_distribution` is replaced with a
 * quota-fidelity check against the same songCount-scaled target/tolerance
 * designGate.ts uses (scaleVocalQuota, ±1); `vocal_zone_max3`/
 * `vocal_no_triple_run` are reported not-measured (never silently "passed")
 * rather than evaluated against a threshold the override makes unreachable.
 */
function vocalItems(songs: SongIdea[], vocalQuotaOverride?: VocalQuota): AuditItem[] {
  const vocalTypes = songs.map(song => song.vocalType).filter((type): type is 'male' | 'female' | 'mixed' => Boolean(type));
  const counts: Record<string, number> = {};
  for (const type of vocalTypes) counts[type] = (counts[type] ?? 0) + 1;

  const scaledQuota = vocalQuotaOverride ? scaleVocalQuota(vocalQuotaOverride, songs.length) : undefined;
  const lowShare = songs.length ? Math.floor(songs.length * 0.25) : 0;
  const highShare = songs.length ? Math.ceil(songs.length * 0.42) : 0;
  const distributionOk = !vocalTypes.length ? null : scaledQuota
    ? (['male', 'female', 'mixed'] as const).every(type => {
      const actual = counts[type] ?? 0;
      const expected = scaledQuota[type];
      return expected === 0 ? actual === 0 : Math.abs(actual - expected) <= 1;
    })
    : Object.values(counts).every(count => count >= lowShare && count <= highShare);

  const zoneWarnings = vocalZoneDistributionWarnings(songs);
  const registerPool = [...MALE_VOCAL_TRAIT_AXES.register, ...FEMALE_VOCAL_TRAIT_AXES.register];
  const distinctVocalDescriptors = new Set(
    songs.flatMap(song => registerPool.filter(register => song.stylePrompt.toLowerCase().includes(register.toLowerCase())))
  );

  const femaleSongs = songs.filter(song => song.vocalType === 'female');
  const femaleMissingGenderWord = femaleSongs.filter(song => detectVocalGender(song.stylePrompt) !== 'female');

  return [
    item({
      id: 'vocal_distribution', category: '보컬', labelKo: '보컬 타입 배분',
      targetKo: scaledQuota
        ? `고정 쿼터: 남 ${scaledQuota.male}·여 ${scaledQuota.female}·혼성 ${scaledQuota.mixed} (±1)`
        : `각 ${lowShare}~${highShare}곡`,
      actualKo: JSON.stringify(counts),
      pass: distributionOk, requiresAudio: false, specifiedBy: ['v3.72 TASK A']
    }),
    item({
      id: 'vocal_zone_max3', category: '보컬', labelKo: '구간별 같은 보컬 타입',
      targetKo: scaledQuota ? '해당 없음 (고정 쿼터 채널)' : '≤ 3곡',
      actualKo: scaledQuota ? '고정 쿼터 채널 — 검사 제외' : (zoneWarnings.length ? `${zoneWarnings.length}건 초과 구간` : '0건'),
      pass: scaledQuota ? null : (songs.length >= 6 ? zoneWarnings.length === 0 : null), requiresAudio: false, specifiedBy: ['v3.75 TASK C']
    }),
    item({
      id: 'vocal_no_triple_run', category: '보컬', labelKo: '같은 보컬 타입 연속',
      targetKo: scaledQuota ? '해당 없음 (고정 쿼터 채널)' : '≤ 2곡',
      actualKo: scaledQuota ? '고정 쿼터 채널 — 검사 제외' : `${longestRun(vocalTypes)}곡`,
      pass: scaledQuota ? null : (vocalTypes.length ? longestRun(vocalTypes) <= 2 : null), requiresAudio: false, specifiedBy: ['v3.64-B', 'v3.72 TASK A']
    }),
    item({
      id: 'vocal_desc_present', category: '보컬', labelKo: '보컬 서술 누락',
      targetKo: '0곡', actualKo: `${songs.filter(song => !song.vocalType).length}곡`,
      pass: songs.every(song => Boolean(song.vocalType)), requiresAudio: false, specifiedBy: ['v3.72 TASK A']
    }),
    item({
      id: 'female_gender_explicit', category: '보컬', labelKo: '여성 곡의 female 명시',
      targetKo: '100%', actualKo: femaleSongs.length ? `${Math.round((1 - femaleMissingGenderWord.length / femaleSongs.length) * 100)}%` : '(여성 곡 없음)',
      pass: femaleSongs.length ? femaleMissingGenderWord.length === 0 : null, requiresAudio: false, specifiedBy: ['v3.75 TASK C']
    }),
    item({
      id: 'vocal_desc_variety', category: '보컬', labelKo: '보컬 서술 종류',
      targetKo: '≥ 12', actualKo: `${distinctVocalDescriptors.size}`,
      pass: distinctVocalDescriptors.size >= 12, requiresAudio: false, specifiedBy: ['v3.72 TASK B'],
      metric: { value: distinctVocalDescriptors.size, direction: 'higherIsBetter' }
    })
  ];
}

// ---------------------------------------------------------------------------
// [프롬프트]
// ---------------------------------------------------------------------------
const LABEL_LEAK_PATTERN = /^\s*(Money chords?|Killing point|Hook device|Arrangement density|Intro texture)\s*:/im;

function promptItems(songs: SongIdea[]): AuditItem[] {
  const lengths = songs.map(song => song.stylePrompt.length);
  const descriptorCounts = songs.map(song => descriptorCount(song.stylePrompt));
  const similarity = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  const eraViolations = songs.filter(song => {
    const bucket = eraBucketForGenreId(song.genreId);
    if (!bucket) return false;
    const forbidden = ERA_FORBIDDEN_DESCRIPTORS[bucket];
    const lower = song.stylePrompt.toLowerCase();
    return forbidden.some(term => lower.includes(term));
  });
  const labelLeaks = songs.filter(song => LABEL_LEAK_PATTERN.test(song.stylePrompt) || LABEL_LEAK_PATTERN.test(song.lyrics));
  // TASK v5.19 (P0 emergency fix) — lyrics scope requires real corroborating
  // context for commonWordRisk seeds (see artistReferenceDecomposer.ts's
  // hasArtistContextSignal), so ordinary words no longer read as a leak here.
  // TASK v5.18 (유형 D) — was stylePrompt+lyrics+youtube(title+description)
  // only; now reads data/scanTargets.ts's ARTIST_SCAN_FIELDS, the same list
  // every other artist-safety checker consults.
  const artistLeaks = songs.filter(song =>
    ARTIST_SCAN_FIELDS.some(fieldRef => findArtistReferenceLeaks(fieldRef.read(song), fieldRef.scope).length > 0)
  );
  const durationDuplicates = songs.filter(song => {
    const match = song.stylePrompt.match(/\d:\d{2}-\d:\d{2}/g);
    return match && match.length > 1;
  });
  // 지시문 10 (TASK C-4) — real measured bug: a real 18-song bridge pack's
  // excludePrompt was character-for-character IDENTICAL across all 18
  // tracks (1/18 unique). Only counts songs that actually HAVE an
  // excludePrompt — a pack with none yet (local preview before this field is
  // populated) reports not-measured below rather than a misleading "18/18
  // unique" over an empty set.
  const excludePromptsPresent = songs.map(song => song.excludePrompt).filter((value): value is string => Boolean(value?.trim()));
  const excludePromptUniqueCount = new Set(excludePromptsPresent).size;
  // 지시문 10 (TASK D-4) — "final prompt compiler-normalized" measurement.
  // core/promptSpec.ts's auditStylePromptAgainstSpec already runs per-song
  // inside core/quality.ts's scoreSong (지시문 09 TASK C-2); this is the
  // pack-level aggregate the directive's own D-4 table asks for. gender is
  // only checked when song.vocalType is actually set (kids archetype songs —
  // the one real per-song gender field SongIdea carries without needing
  // channel context this function doesn't receive); BPM-duplicate detection
  // needs no such context and always runs.
  const specViolationSongs = songs.filter(song => auditStylePromptAgainstSpec(song.stylePrompt, {
    vocal: { gender: song.vocalType === 'male' || song.vocalType === 'female' ? song.vocalType : undefined, text: '' }
  }).length > 0);

  // 지시문 16 (TASK D) — 실측 13건(인트로 모순 7·리드보컬 중복 5·중복 토큰 1)을
  // 재현하는 측정. data/promptAxisLexicon.ts's classifyClause로 stylePrompt를
  // 콤마절 단위로 축 분류해, 단일 선언 축(SINGLE_DECLARATION_AXES)이 한 곡
  // 안에 2번 이상 선언됐는지 센다. duration/tempo는 이미 duration_dup/
  // final_prompt_compiler_normalized가 측정 중이라 제외 — intro·leadVocal만
  // 새로 잰다(둘 다 실측 위반이 실제로 있었던 축).
  function axesOf(stylePrompt: string): PromptAxis[] {
    return stylePrompt.split(',').map(clause => clause.trim()).filter(Boolean)
      .map((text, index) => classifyClause(text, index === 0))
      .filter((axis): axis is PromptAxis => Boolean(axis));
  }
  const introContradictionSongs = songs.filter(song => {
    const introClauses = song.stylePrompt.split(',').map(c => c.trim()).filter(Boolean)
      .filter((text, index) => classifyClause(text, index === 0) === 'intro');
    const subcategories = new Set(introClauses.map(introSubcategory).filter(Boolean));
    return subcategories.size > 1;
  });
  const leadVocalDuplicateSongs = songs.filter(song => axesOf(song.stylePrompt).filter(axis => axis === 'leadVocal').length > 1);
  // 지시문 16 §1-4 실측("male male head-voice lead") — 같은 단어가 바로
  // 옆에서 반복되는 경우. 대소문자 무시.
  const DUPLICATE_TOKEN_PATTERN = /\b(\w+)\s+\1\b/i;
  const duplicateTokenSongs = songs.filter(song => DUPLICATE_TOKEN_PATTERN.test(song.stylePrompt));

  return [
    item({
      id: 'prompt_length', category: '프롬프트', labelKo: '프롬프트 길이',
      targetKo: '350~650자', actualKo: lengths.length ? `${Math.min(...lengths)}~${Math.max(...lengths)}자` : '(없음)',
      pass: lengths.length ? lengths.every(length => length >= 350 && length <= 650) : null, requiresAudio: false, specifiedBy: ['v3.56'],
      // v4.4 (TASK C) — the overshoot end (max) is this app's current known
      // problem (target's upper bound, 650), so that's the tracked value;
      // an undershoot below 350 would need the opposite direction, but
      // that has never been the measured failure mode.
      metric: lengths.length ? { value: Math.max(...lengths), direction: 'lowerIsBetter' } : undefined
    }),
    item({
      id: 'descriptor_count', category: '프롬프트', labelKo: '서술어 개수',
      targetKo: '15~25', actualKo: descriptorCounts.length ? `${Math.min(...descriptorCounts)}~${Math.max(...descriptorCounts)}` : '(없음)',
      pass: descriptorCounts.length ? descriptorCounts.every(count => count >= 15 && count <= 25) : null, requiresAudio: false, specifiedBy: ['v3.62 TASK 2-2'],
      metric: descriptorCounts.length ? { value: Math.max(...descriptorCounts), direction: 'lowerIsBetter' } : undefined
    }),
    item({
      id: 'shared_atoms', category: '프롬프트', labelKo: '공유 원자',
      targetKo: '≤ 5개', actualKo: `${similarity.sharedAtomCount}개`,
      pass: similarity.sharedAtomCount <= 5, requiresAudio: false, specifiedBy: ['v3.58 TASK 1']
    }),
    item({
      id: 'era_contradiction', category: '프롬프트', labelKo: '시대 모순 서술어',
      targetKo: '0건', actualKo: `${eraViolations.length}건`,
      pass: eraViolations.length === 0, requiresAudio: false, specifiedBy: ['v3.62 TASK 2-2'],
      metric: { value: eraViolations.length, direction: 'lowerIsBetter' }
    }),
    item({
      id: 'label_leak', category: '프롬프트', labelKo: '라벨 잔존',
      targetKo: '0건', actualKo: `${labelLeaks.length}건`,
      pass: labelLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.62 TASK 1']
    }),
    item({
      id: 'artist_leak', category: '프롬프트', labelKo: '아티스트명 누출',
      targetKo: '0건', actualKo: `${artistLeaks.length}건`,
      pass: artistLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.58 TASK 3']
    }),
    item({
      id: 'duration_dup', category: '프롬프트', labelKo: 'duration 중복',
      targetKo: '0건', actualKo: `${durationDuplicates.length}건`,
      pass: durationDuplicates.length === 0, requiresAudio: false, specifiedBy: ['v3.59 TASK D-2']
    }),
    item({
      id: 'exclude_prompt_unique', category: '프롬프트', labelKo: 'excludePrompt 고유값 (곡별 차별화)',
      targetKo: `${songs.length}/${songs.length}`,
      actualKo: excludePromptsPresent.length ? `${excludePromptUniqueCount}/${excludePromptsPresent.length}` : '(excludePrompt 없음)',
      pass: excludePromptsPresent.length ? excludePromptUniqueCount === excludePromptsPresent.length : null,
      requiresAudio: false, specifiedBy: ['지시문 10 TASK C-4'],
      metric: excludePromptsPresent.length ? { value: excludePromptUniqueCount, direction: 'higherIsBetter' } : undefined
    }),
    item({
      id: 'final_prompt_compiler_normalized', category: '프롬프트', labelKo: 'final prompt compiler-normalized (중복 BPM·보컬 선언 0건)',
      targetKo: '100%', actualKo: songs.length ? `${Math.round(((songs.length - specViolationSongs.length) / songs.length) * 100)}% (위반 ${specViolationSongs.length}곡${specViolationSongs.length ? `: T${specViolationSongs.map(s => s.trackNo).join(', T')}` : ''})` : '(없음)',
      pass: songs.length ? specViolationSongs.length === 0 : null, requiresAudio: false, specifiedBy: ['지시문 10 TASK D-4'],
      metric: songs.length ? { value: specViolationSongs.length, direction: 'lowerIsBetter' } : undefined
    }),
    item({
      id: 'intro_axis_contradiction', category: '프롬프트', labelKo: '인트로 모순 (즉시시작+인트로있음 동시 선언)',
      targetKo: '0곡', actualKo: `${introContradictionSongs.length}곡${introContradictionSongs.length ? `: T${introContradictionSongs.map(s => s.trackNo).join(', T')}` : ''}`,
      pass: songs.length ? introContradictionSongs.length === 0 : null, requiresAudio: false, specifiedBy: ['지시문 16 TASK B/D'],
      metric: songs.length ? { value: introContradictionSongs.length, direction: 'lowerIsBetter' } : undefined
    }),
    item({
      id: 'lead_vocal_axis_duplicate', category: '프롬프트', labelKo: '리드 보컬 중복 선언',
      targetKo: '0곡', actualKo: `${leadVocalDuplicateSongs.length}곡${leadVocalDuplicateSongs.length ? `: T${leadVocalDuplicateSongs.map(s => s.trackNo).join(', T')}` : ''}`,
      pass: songs.length ? leadVocalDuplicateSongs.length === 0 : null, requiresAudio: false, specifiedBy: ['지시문 16 TASK B/D'],
      metric: songs.length ? { value: leadVocalDuplicateSongs.length, direction: 'lowerIsBetter' } : undefined
    }),
    item({
      id: 'duplicate_token', category: '프롬프트', labelKo: '중복 토큰 (예: "male male")',
      targetKo: '0곡', actualKo: `${duplicateTokenSongs.length}곡${duplicateTokenSongs.length ? `: T${duplicateTokenSongs.map(s => s.trackNo).join(', T')}` : ''}`,
      pass: songs.length ? duplicateTokenSongs.length === 0 : null, requiresAudio: false, specifiedBy: ['지시문 16 TASK B/D'],
      metric: songs.length ? { value: duplicateTokenSongs.length, direction: 'lowerIsBetter' } : undefined
    })
  ];
}

// ---------------------------------------------------------------------------
// [가사]
// ---------------------------------------------------------------------------
const PLACEHOLDER_PATTERN = /\[PLACEHOLDER\]|\bTODO\b|lorem ipsum|\{\{.*?\}\}/i;
const END_TAG_PATTERN = /\[\s*(end|outro)\s*\]/i;

/**
 * TASK v4.8 (TASK B-1) — real per-song measurement traced the reported
 * "162-word floor undershoots the 175 floor even on slow BPM" symptom to a
 * wrong diagnosis: the 162-word outlier was track 1 (cold-open, 88 BPM —
 * not even in the slowest tier), not a slow-tempo song. Every genuinely
 * slow-BPM track in the same sample measured 202-220 words, comfortably
 * above 175. The real cause is lyricEngine.ts's own shortOpenerRoles
 * ('cold-open'/'clear opener' trim verse1 to 2 lines and skip the
 * situationLines boost, by design since v3.11/v4.4 — "reach their first
 * chorus sooner") — deliberate pacing, not a bug, and out of scope to
 * touch (this file's own "lyricEngine.ts... 수정하지 말 것").
 * This check was also a single fixed 215-230 window regardless of a song's
 * own BPM tier, when core/bpmLengthControl.ts's BPM_LENGTH_TIERS already
 * defines a per-tempo word target (175-195 for 62-78 BPM, up to 225-245 for
 * 105-112 BPM) that generation is actually meant to hit. Both fixed here:
 * the floor/ceiling now come from the song's own BPM tier, and a cold-open/
 * clear-opener track gets a lower (still enforced, not exempted) floor
 * reflecting its own intentionally shorter shape.
 */
function targetWordRangeFor(song: SongIdea): [number, number] {
  const tier = typeof song.bpm === 'number' ? resolveBpmLengthTier(song.bpm) : undefined;
  const [tierFloor, tierCeil] = tier ? tier.wordRange : [175, 245];
  const isShortOpener = song.songRole === 'cold-open' || song.songRole === 'clear opener';
  return isShortOpener ? [150, tierCeil] : [tierFloor, tierCeil];
}

/**
 * TASK v4.11 (TASK A) — mirrors targetWordRangeFor above, same per-song BPM
 * tier lookup (core/bpmLengthControl.ts's BPM_LENGTH_TIERS). cold-open/clear-
 * opener tracks get the same widened ceiling as they get on the word check:
 * core/structureTemplatePlan.ts's buildBpmAwareStructureTemplatePlan pins
 * track 1 to T1's fixed 8-section shape regardless of its own BPM tier (a
 * deliberate cold-open convention, not a bug), so a slow-tempo opener would
 * otherwise permanently fail a strict tier-only section check.
 */
function targetSectionRangeFor(song: SongIdea): [number, number] {
  const tier = typeof song.bpm === 'number' ? resolveBpmLengthTier(song.bpm) : undefined;
  const [tierMin, tierMax] = tier ? tier.sectionRange : [5, 8];
  const isShortOpener = song.songRole === 'cold-open' || song.songRole === 'clear opener';
  return isShortOpener ? [tierMin, Math.max(tierMax, 8)] : [tierMin, tierMax];
}

function lyricsItems(songs: SongIdea[]): AuditItem[] {
  const counts = songs.map(song => lyricWordAndSectionCounts(song.lyrics));
  const words = counts.map(c => c.words);
  const wordTargets = songs.map(targetWordRangeFor);
  const wordFailures = songs.filter((song, i) => words[i] < wordTargets[i][0] || words[i] > wordTargets[i][1]);
  const sections = counts.map(c => c.sections);
  const sectionTargets = songs.map(targetSectionRangeFor);
  const sectionFailures = songs.filter((song, i) => sections[i] < sectionTargets[i][0] || sections[i] > sectionTargets[i][1]);
  const situations = new Set(songs.map(song => song.listenerSituation));
  const emotionArcs = new Set(songs.map(song => song.emotionArc));
  const arrangementLeaks = findArrangementVocabularyInLyrics(songs);
  const titleLineLeaks = songs.filter(song => /^\s*Title\s*:/im.test(song.lyrics));
  const placeholderLeaks = songs.filter(song => PLACEHOLDER_PATTERN.test(song.lyrics));
  const endTagLeaks = songs.filter(song => END_TAG_PATTERN.test(song.lyrics));
  const vocabRepetition = findExcessiveVocabularyRepetition(songs);
  const blockingVocab = findBlockingVocabularyRepetition(songs);
  const maxWordRepeat = topWordFrequencies(songs, 1)[0]?.count ?? 0;
  const hookOveruse = findHookWordOveruse(songs);

  return [
    item({
      id: 'lyric_word_count', category: '가사', labelKo: '가사 단어수',
      // TASK v4.8 (TASK B-1) — was a single fixed 215~230 window for every
      // song regardless of BPM; now each song is checked against its own
      // BPM tier's word target (core/bpmLengthControl.ts's BPM_LENGTH_TIERS),
      // 150 as the floor for cold-open/clear-opener tracks specifically (see
      // targetWordRangeFor's own doc comment above) — reported here as the
      // overall observed span across whichever per-song targets applied.
      targetKo: 'BPM별 (150/175~245)', actualKo: words.length ? `${Math.min(...words)}~${Math.max(...words)}` : '(없음)',
      pass: words.length ? wordFailures.length === 0 : null, requiresAudio: false, specifiedBy: ['v3.29', 'v3.70 TASK B', 'v3.75 TASK A', 'v4.8 TASK B-1'],
      // v4.4 (TASK C) — the shortfall end (min) is this app's current known
      // problem (undershooting the floor), so that's the tracked value — the
      // exact "137단어에서 190단어로" progress case this task's own doc
      // names as the motivating example for "improving" classification.
      metric: words.length ? { value: Math.min(...words), direction: 'higherIsBetter' } : undefined
    }),
    item({
      id: 'section_count', category: '가사', labelKo: '섹션 수',
      // TASK v4.11 (TASK A) — was a single flat 7~8 window for every song
      // regardless of BPM (the same bug lyric_word_count's own v4.8 TASK B-1
      // fix already corrected for word count); now each song is checked
      // against its own BPM tier's sectionRange (core/bpmLengthControl.ts's
      // BPM_LENGTH_TIERS), same targetWordRangeFor-style per-song lookup.
      targetKo: 'BPM별 (5~8)', actualKo: sections.length ? `${Math.min(...sections)}~${Math.max(...sections)}` : '(없음)',
      pass: sections.length ? sectionFailures.length === 0 : null, requiresAudio: false, specifiedBy: ['v3.70 TASK B', 'v4.11 TASK A'],
      metric: sections.length ? { value: Math.max(...sections), direction: 'lowerIsBetter' } : undefined
    }),
    item({
      id: 'situation_all_distinct', category: '가사', labelKo: '상황 종류',
      targetKo: `= ${songs.length}곡 (전부 다름)`, actualKo: `${situations.size}종`,
      pass: situations.size === songs.length, requiresAudio: false, specifiedBy: ['v3.64 TASK A']
    }),
    item({
      id: 'emotion_arc_variety', category: '가사', labelKo: '감정 아크 종류',
      targetKo: '≥ 8', actualKo: `${emotionArcs.size}종`,
      pass: emotionArcs.size >= 8, requiresAudio: false, specifiedBy: ['v3.67 TASK D']
    }),
    item({
      id: 'arrangement_vocab_leak', category: '가사', labelKo: '편곡 어휘 가사 누출',
      targetKo: '0곡', actualKo: `${new Set(arrangementLeaks.map(f => f.trackNo)).size}곡`,
      pass: arrangementLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.60 TASK A'],
      metric: { value: new Set(arrangementLeaks.map(f => f.trackNo)).size, direction: 'lowerIsBetter' }
    }),
    item({
      id: 'title_line_leak', category: '가사', labelKo: 'Title: 첫줄 잔존',
      targetKo: '0곡', actualKo: `${titleLineLeaks.length}곡`,
      pass: titleLineLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.5x Title 제거']
    }),
    item({
      id: 'placeholder_leak', category: '가사', labelKo: '자리표시자',
      targetKo: '0곡', actualKo: `${placeholderLeaks.length}곡`,
      pass: placeholderLeaks.length === 0, requiresAudio: false, specifiedBy: ['lyricPlaceholderLeak.test.ts']
    }),
    item({
      id: 'grammar_article_errors', category: '가사', labelKo: '관사·복수 오류',
      targetKo: '0건', actualKo: '(검사 없음)',
      pass: null, requiresAudio: false, notImplemented: true, specifiedBy: []
    }),
    item({
      id: 'intro_leak', category: '가사', labelKo: '[intro] 아래 문장 (introMode 대조)',
      targetKo: '위반 0곡', actualKo: '(SongIdea에 introMode가 없어 재검사 불가)',
      pass: null, requiresAudio: false, notImplemented: true, specifiedBy: ['v3.64 TASK B']
    }),
    item({
      id: 'end_tag_leak', category: '가사', labelKo: '[end] 태그 잔존',
      targetKo: '0곡', actualKo: `${endTagLeaks.length}곡`,
      pass: endTagLeaks.length === 0, requiresAudio: false, specifiedBy: ['v3.70/v3.71']
    }),
    item({
      id: 'vocab_repeat_max20', category: '가사', labelKo: '어휘 최대 반복',
      targetKo: '≤ 20회', actualKo: `${maxWordRepeat}회`,
      pass: maxWordRepeat <= 20, requiresAudio: false, specifiedBy: ['v3.64 TASK A-4', 'v3.75 TASK D'],
      metric: { value: maxWordRepeat, direction: 'lowerIsBetter' }
    }),
    item({
      id: 'hook_word_overuse', category: '가사', labelKo: '훅 반복 단어',
      targetKo: '≤ 2개 훅', actualKo: hookOveruse.length ? hookOveruse.map(f => `${f.word}(${f.hookCount})`).join(', ') : '없음',
      pass: hookOveruse.length === 0, requiresAudio: false, specifiedBy: ['v4.2 TASK D-2'],
      notImplemented: false
    }),
    ...(vocabRepetition.length ? [item({
      id: 'vocab_repeat_advisory', category: '가사', labelKo: '어휘 반복 (advisory, 12회 기준)',
      targetKo: '≤ 12회', actualKo: vocabRepetition.slice(0, 5).map(f => `${f.word}(${f.count})`).join(', '),
      pass: null, requiresAudio: false, specifiedBy: ['v3.64 TASK A-4']
    })] : []),
    // v3.77 (TASK D-2/E) — mirrors compositionScorer.ts's own new BLOCKING
    // gate exactly (WORD_BLOCKING_THRESHOLD=30, hard-fails composition, not
    // just an advisory), so this audit surfaces whether the pack it just
    // generated would actually have been blocked at generation time, not
    // just "over the softer 12/20 advisory caps".
    item({
      id: 'vocab_repeat_blocking', category: '가사', labelKo: `어휘 반복 (blocking, ${WORD_BLOCKING_THRESHOLD}회 기준)`,
      targetKo: `≤ ${WORD_BLOCKING_THRESHOLD}회`, actualKo: `${maxWordRepeat}회${blockingVocab.length ? ` (${blockingVocab.slice(0, 5).map(f => `${f.word} ${f.count}회`).join(', ')})` : ''}`,
      pass: blockingVocab.length === 0, requiresAudio: false, specifiedBy: ['v3.77 TASK D-2']
    })
  ];
}

// ---------------------------------------------------------------------------
// [킬링포인트·아크]
// ---------------------------------------------------------------------------
function killingPointItems(songs: SongIdea[], arcModelId: 'five-phase' | 'repetition-cycle' = 'five-phase'): AuditItem[] {
  const withKillingPoint = songs.filter(song => song.killingPointId);
  const distinctKillingPoints = new Set(withKillingPoint.map(song => song.killingPointId));
  const arcPhases = new Set(songs.map(song => song.arcPhase).filter(Boolean));
  const targetAssignedShare = songs.length ? Math.round(songs.length * (14 / 18)) : 0;
  const targetVarietyShare = songs.length ? Math.max(1, Math.round(songs.length * (9 / 18))) : 0;
  const targetNoneShare = songs.length ? Math.round(songs.length * (4 / 18)) : 0;
  // v5.12 — arc-model-aware (see arcModels.ts's expectedArcPhaseCount doc
  // comment): 'five-phase' (every non-kids workspace) keeps the exact
  // pre-v5.12 "5종 전부" pass condition byte-identical. 'repetition-cycle'
  // (kids workspaces) is checked against its own real bundle count.
  // v5.13 (TASK: kidsAgeTierId wiring) — real gap this closes: generation
  // now actually resolves and uses a specific tier per pack (a kr-kids
  // channel preset can carry kids-t1/t3, not just the ageTier-omitted
  // default), so the "expected" bundle count must match that same real
  // tier or a correctly-tiered pack fails this check for using MORE/FEWER
  // distinct bundles than the old flat always-4 assumption. Derived from
  // the songs' own already-recorded SongIdea.effectiveKidsAgeTierId (the
  // real "what actually happened" field — see that field's own doc
  // comment) rather than requiring a new parameter threaded all the way
  // from GenerationOptions into this audit-only function.
  const kidsAgeTierId = songs.find(song => song.effectiveKidsAgeTierId)?.effectiveKidsAgeTierId;
  const expectedPhaseCount = expectedArcPhaseCount(arcModelId, songs.length, kidsAgeTierId);
  // Same "only real kids bundle phases count" filtering as
  // designGate.ts's killingPointAndArcIssues — see that file's own v5.12
  // comment. 'five-phase' keeps the original unfiltered Set (byte-identical).
  const countedArcPhases = arcModelId === 'repetition-cycle'
    ? new Set([...arcPhases].filter((phase): phase is string => typeof phase === 'string' && KIDS_ARC_PHASE_VALUES.has(phase)))
    : arcPhases;

  return [
    item({
      id: 'killing_point_assigned', category: '킬링포인트·아크', labelKo: '킬링포인트 배정',
      targetKo: `약 ${targetAssignedShare}/${songs.length}`, actualKo: `${withKillingPoint.length}/${songs.length}`,
      pass: songs.length ? Math.abs(withKillingPoint.length - targetAssignedShare) <= 2 : null, requiresAudio: false, specifiedBy: ['v3.67 TASK A']
    }),
    item({
      id: 'killing_point_variety', category: '킬링포인트·아크', labelKo: '킬링포인트 종류',
      targetKo: `≥ ${targetVarietyShare}`, actualKo: `${distinctKillingPoints.size}`,
      pass: distinctKillingPoints.size >= targetVarietyShare, requiresAudio: false, specifiedBy: ['v3.67 TASK A']
    }),
    item({
      id: 'arc_phase_all_used', category: '킬링포인트·아크',
      labelKo: arcModelId === 'repetition-cycle' ? '아크 번들 전체 사용' : '아크 5구간 사용',
      targetKo: `${expectedPhaseCount}종 전부`, actualKo: `${countedArcPhases.size}종`,
      pass: songs.length >= expectedPhaseCount ? countedArcPhases.size === expectedPhaseCount : null, requiresAudio: false, specifiedBy: ['v3.67 TASK C', 'v5.12']
    }),
    item({
      id: 'peak_none_count', category: '킬링포인트·아크', labelKo: 'peakStrength none 곡',
      targetKo: `약 ${targetNoneShare}곡`, actualKo: `${songs.length - withKillingPoint.length}곡`,
      pass: songs.length ? Math.abs((songs.length - withKillingPoint.length) - targetNoneShare) <= 2 : null, requiresAudio: false, specifiedBy: ['v3.67 arcPlan']
    })
  ];
}

// ---------------------------------------------------------------------------
// [제목]
// ---------------------------------------------------------------------------
function titleItems(songs: SongIdea[], titleConsistency: TitleConsistencyReport): AuditItem[] {
  const shapeCounts = new Map<string, number>();
  for (const song of songs) {
    const shape = classifyTitleShape(song.title);
    if (!shape) continue;
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
  }
  return [
    item({
      id: 'title_pattern_variety', category: '제목', labelKo: '제목 패턴 종류',
      targetKo: '≥ 4', actualKo: `${shapeCounts.size}`,
      pass: shapeCounts.size >= 4, requiresAudio: false, specifiedBy: ['v4.2 TASK C'],
      metric: { value: shapeCounts.size, direction: 'higherIsBetter' }
    }),
    item({
      id: 'title_pattern_max4', category: '제목', labelKo: '같은 패턴 최대 곡수',
      targetKo: '≤ 4곡', actualKo: `${Math.max(0, ...shapeCounts.values())}곡`,
      pass: [...shapeCounts.values()].every(count => count <= 4), requiresAudio: false, specifiedBy: ['v4.2 TASK C'],
      metric: { value: Math.max(0, ...shapeCounts.values()), direction: 'lowerIsBetter' }
    }),
    item({
      id: 'hook_connected_title', category: '제목', labelKo: '훅 연결 제목',
      targetKo: '≥ 6곡', actualKo: `${titleConsistency.hookConnectedCount}곡`,
      pass: titleConsistency.hookConnectedCount >= 6, requiresAudio: false, specifiedBy: ['v3.75 TASK D-3', 'v3.76 TASK A']
    })
  ];
}

// ---------------------------------------------------------------------------
// [약속 이행도] / [워크스페이스]
// ---------------------------------------------------------------------------
function promiseItems(promiseAudit: PromiseAuditReport): AuditItem[] {
  return [
    item({
      id: 'promise_fulfillment', category: '약속 이행도', labelKo: '약속 이행도 종합',
      targetKo: '≥ 70%', actualKo: `${Math.round(promiseAudit.overallFulfillment * 100)}%`,
      pass: promiseAudit.promises.length ? promiseAudit.overallFulfillment >= 0.7 : null,
      requiresAudio: false, specifiedBy: ['v3.76 TASK A']
    }),
    ...promiseAudit.promises.map(result => item({
      id: `promise_${result.promise.id}`, category: '약속 이행도', labelKo: `[${result.promise.kind}] ${result.promise.labelKo}`,
      targetKo: '개별 기준(§2-3)', actualKo: `${Math.round(result.fulfillment * 100)}%`,
      pass: null, requiresAudio: false, specifiedBy: ['v3.76 TASK A']
    }))
  ];
}

// ---------------------------------------------------------------------------
// [음원] — only ever measurable with a real rendered mp3 (v3.73/v3.74's
// browser-side audio analysis, core/audioSetReport.ts). Always
// 'not-measured' when no AudioSetReport is supplied — never 'fail', per
// this task's own "음원이 없으면... 실패로 처리하지 마십시오".
// ---------------------------------------------------------------------------
function audioItems(audioReport: AudioSetReport | undefined): AuditItem[] {
  if (!audioReport || !audioReport.analyzedCount) {
    return [
      item({
        id: 'real_duration_range', category: '가사', labelKo: '수노 실측 길이',
        targetKo: '3:15~3:35 (오디언스 프로파일)', actualKo: '(음원 미제공)',
        pass: null, requiresAudio: true, specifiedBy: ['v3.75 TASK A']
      }),
      item({
        id: 'killing_point_amplitude', category: '킬링포인트·아크', labelKo: '킬링포인트 곡 진폭',
        targetKo: '≥ 6dB', actualKo: '(음원 미제공)',
        pass: null, requiresAudio: true, specifiedBy: ['v3.75 TASK B']
      })
    ];
  }
  const underOrOver = audioReport.duration.overTarget.length + audioReport.duration.underTarget.length;
  return [
    item({
      id: 'real_duration_range', category: '가사', labelKo: '수노 실측 길이',
      targetKo: `${audioReport.duration.targetRange[0]}~${audioReport.duration.targetRange[1]}초`,
      actualKo: `${Object.keys(audioReport.duration.values).length}곡 분석, 목표 이탈 ${underOrOver}곡`,
      pass: underOrOver === 0, requiresAudio: true, specifiedBy: ['v3.75 TASK A']
    }),
    item({
      id: 'killing_point_amplitude', category: '킬링포인트·아크', labelKo: '킬링포인트 곡 진폭',
      targetKo: '≥ 6dB', actualKo: `진폭 부족 ${audioReport.killingPoint.weakDynamicTracks.length}곡`,
      pass: audioReport.killingPoint.weakDynamicTracks.length === 0, requiresAudio: true, specifiedBy: ['v3.75 TASK B']
    })
  ];
}

/**
 * 지시문 15 (TASK B-4) — "감사 항목이 되지 않으면 이 TASK 는 미완이다".
 * core/distinctChoiceGate.ts(구조는 7개 워크스페이스 공통, archetype 분기
 * 없음)를 그대로 실행해 이행률/안전위반을 감사 항목으로 노출한다.
 * verified 워크스페이스(현재 senior-oldpop)만 이행률 미달이 실제 fail로
 * 뜬다 — verified: false 6개는 숫자는 실측·표시하되 pass:null(not-measured)로
 * 남는다(§B-2 "advisory 전용, 절대 blocking하지 않는다"). 안전 제약
 * 위반만은 verified와 무관하게 항상 fail이다.
 */
function distinctChoiceItems(songs: SongIdea[], archetype?: ChannelArchetype): AuditItem[] {
  const workspaceId = workspaceForArchetype(archetype)?.id;
  if (!workspaceId) {
    return [
      item({
        id: 'distinct_choice_compliance', category: '워크스페이스', labelKo: '곡별 다른 시도 이행률 (distinctChoice gate)',
        targetKo: '워크스페이스 정책 필요', actualKo: '아키타입에서 워크스페이스를 확인할 수 없음 — 판정 불가',
        pass: null, requiresAudio: false, specifiedBy: ['지시문 15 TASK B-4']
      })
    ];
  }
  const policy = distinctChoicePolicyForWorkspace(workspaceId);
  const result = evaluateDistinctChoiceGate(songs, policy, {
    safetyForbiddenRuleIds: safetyForbiddenRuleIdsForWorkspace(workspaceId),
    sameGenderVocalOnly: policy.sameGenderVocalOnly
  });
  const safetyViolations = result.trackResults.filter(r => r.safetyViolation);
  return [
    item({
      id: 'distinct_choice_compliance', category: '워크스페이스',
      labelKo: `곡별 다른 시도 이행률 (distinctChoice gate${policy.verified ? '' : ' — 미검증/advisory'})`,
      targetKo: `≥ ${Math.round(policy.minComplianceRate * 100)}% (${policy.sourceKo})`,
      actualKo: `이행률 ${Math.round(result.complianceRate * 100)}% (compliant ${result.compliantCount} · violated ${result.violatedCount} · not-measured ${result.notMeasuredCount} · missing ${result.missingCount})`,
      pass: policy.verified ? !result.thresholdBlocking : null,
      requiresAudio: false,
      specifiedBy: ['지시문 15 TASK B-4'],
      metric: { value: result.complianceRate, direction: 'higherIsBetter' }
    }),
    item({
      id: 'distinct_choice_safety', category: '워크스페이스', labelKo: '곡별 다른 시도 — 안전 제약',
      targetKo: '위반 0건 (verified 무관 항상 강제)',
      actualKo: safetyViolations.length ? `${safetyViolations.length}건: ${safetyViolations.map(r => `T${r.trackNo}`).join(', ')}` : '위반 없음',
      pass: safetyViolations.length === 0, requiresAudio: false, specifiedBy: ['지시문 15 TASK B-4']
    })
  ];
}

/**
 * 지시문 17 (TASK A-4/D) — "감사 항목이 되지 않으면 미완이다"를 그대로
 * 이어받는다. 영어 매치는 워크스페이스 무관 항상 fail 후보(§A-3), 한국어·
 * 일본어 매치는 실측이 없어 not-measured로 표시만 한다.
 */
function metaLeakItems(songs: SongIdea[], lyricLanguage?: LyricLanguage): AuditItem[] {
  if (!lyricLanguage) {
    return [
      item({
        id: 'meta_leak_compliance', category: '가사', labelKo: '작곡 지시 유출 검사',
        targetKo: '0건', actualKo: 'lyricLanguage 미상 — 판정 불가',
        pass: null, requiresAudio: false, specifiedBy: ['지시문 17 TASK A-3']
      })
    ];
  }
  const findings = findLyricMetaLeaks(songs, lyricLanguage);
  const blocking = findings.filter(f => f.severity === 'blocking');
  const advisory = findings.filter(f => f.severity === 'advisory');
  return [
    item({
      id: 'meta_leak_compliance', category: '가사', labelKo: '작곡 지시 유출 검사 (영어 — verified 무관 항상 blocking)',
      targetKo: '0건', actualKo: blocking.length ? `${blocking.length}건: ${blocking.map(f => `T${f.trackNo} "${f.line}"`).join(' / ')}` : '0건',
      pass: blocking.length === 0, requiresAudio: false, specifiedBy: ['지시문 17 TASK A-3'],
      metric: { value: blocking.length, direction: 'lowerIsBetter' }
    }),
    item({
      id: 'meta_leak_advisory', category: '가사', labelKo: '작곡 지시 유출 검사 (한국어·일본어 — 실측 없어 advisory)',
      targetKo: '참고용, 미검증', actualKo: advisory.length ? `${advisory.length}건: ${advisory.map(f => `T${f.trackNo} "${f.line}"`).join(' / ')}` : '0건',
      pass: null, requiresAudio: false, specifiedBy: ['지시문 17 TASK A-3']
    })
  ];
}

/**
 * 지시문 17 (TASK B-5/D) — core/narrativeState.ts를 그대로 실행한다.
 * kind 단위 verified만 fail 후보(§B-3) — senior-oldpop이라도 letter를
 * 제외한 kind는 실측 근거가 없어 not-measured로 표시만 한다.
 */
function objectStateItems(songs: SongIdea[], archetype?: ChannelArchetype, lyricLanguage?: LyricLanguage): AuditItem[] {
  const workspaceId = workspaceForArchetype(archetype)?.id;
  const objectStateLanguage: ObjectStateLanguage | undefined =
    lyricLanguage === 'english' || lyricLanguage === 'korean' || lyricLanguage === 'japanese' ? lyricLanguage : undefined;
  if (!workspaceId || !objectStateLanguage) {
    return [
      item({
        id: 'object_state_compliance', category: '가사', labelKo: '소품 상태 모순 검사',
        targetKo: '0건', actualKo: '워크스페이스/언어를 확인할 수 없음 — 판정 불가',
        pass: null, requiresAudio: false, specifiedBy: ['지시문 17 TASK B-5']
      })
    ];
  }
  const policy = objectStatePolicyForWorkspace(workspaceId);
  const perTrack = songs.map(song => ({ trackNo: song.trackNo, findings: evaluateObjectState(song.lyrics, policy.kinds, policy.verifiedKinds, objectStateLanguage) }));
  const blocking = perTrack.flatMap(entry => entry.findings.filter(f => f.severity === 'blocking').map(f => ({ trackNo: entry.trackNo, finding: f })));
  const advisory = perTrack.flatMap(entry => entry.findings.filter(f => f.severity === 'advisory').map(f => ({ trackNo: entry.trackNo, finding: f })));
  return [
    item({
      id: 'object_state_compliance', category: '가사',
      labelKo: `소품 상태 모순 검사 (실측 kind: ${policy.verifiedKinds.join(', ') || '없음'})`,
      targetKo: '0건', actualKo: blocking.length ? `${blocking.length}건: ${blocking.map(b => `T${b.trackNo} (${b.finding.kind})`).join(' / ')}` : '0건',
      pass: blocking.length === 0, requiresAudio: false, specifiedBy: ['지시문 17 TASK B-5'],
      metric: { value: blocking.length, direction: 'lowerIsBetter' }
    }),
    item({
      id: 'object_state_advisory', category: '가사', labelKo: '소품 상태 모순 검사 (미검증 kind — 참고용)',
      targetKo: '참고용, 미검증', actualKo: advisory.length ? `${advisory.length}건: ${advisory.map(a => `T${a.trackNo} (${a.finding.kind})`).join(' / ')}` : '0건',
      pass: null, requiresAudio: false, specifiedBy: ['지시문 17 TASK B-5']
    })
  ];
}

function workspaceItems(): AuditItem[] {
  return [
    item({
      id: 'workspace_isolation', category: '워크스페이스', labelKo: '워크스페이스 격리',
      targetKo: '다른 워크스페이스 데이터 0건', actualKo: '(메모리 상의 팩에는 해당 없음 — 저장된 라이브러리 전체를 대상으로만 검사 가능)',
      pass: null, requiresAudio: false, notImplemented: true, specifiedBy: ['A1', 'A2']
    })
  ];
}

/**
 * 지시문 10 (TASK B-4-4) — "legacy-missing SceneSignature를 pass 처리하지
 * 말 것". core/situationLedger.ts's resolveSceneSignatureSource is the same
 * function the ledger itself now uses when recording — applied here directly
 * to the pack's own songs so signatureSource coverage is visible without
 * needing IndexedDB history. 18/18 (every song has SOME real source, even a
 * derived one) is the target; any 'legacy-missing' song makes this
 * not-measured, never a silent pass.
 */
function sceneSignatureSourceItems(songs: SongIdea[]): AuditItem[] {
  if (!songs.length) {
    return [item({ id: 'scene_signature_source', category: '워크스페이스', labelKo: 'SceneSignature 출처 기록', targetKo: `${songs.length}/${songs.length} (provider 또는 local-parser)`, actualKo: '(곡 없음)', pass: null, requiresAudio: false, specifiedBy: ['지시문 10 TASK B-4-4'] })];
  }
  const resolved = songs.map(song => resolveSceneSignatureSource(song));
  const legacyMissing = resolved.filter(r => r.source === 'legacy-missing').length;
  const providerCount = resolved.filter(r => r.source === 'provider').length;
  const localParserCount = resolved.filter(r => r.source === 'local-parser').length;
  return [
    item({
      id: 'scene_signature_source', category: '워크스페이스', labelKo: 'SceneSignature 출처 기록 (legacy-missing 0건)',
      targetKo: `${songs.length}/${songs.length}`, actualKo: `provider ${providerCount} · local-parser ${localParserCount} · legacy-missing ${legacyMissing}`,
      pass: legacyMissing === 0 ? true : null, requiresAudio: false, specifiedBy: ['지시문 10 TASK B-4-4'],
      metric: { value: legacyMissing, direction: 'lowerIsBetter' }
    })
  ];
}

/**
 * 지시문 10 (TASK A-4) — the prose-claim counterpart to promptItems' own
 * eraViolations check (which reads genre-bucket-derived ERA_FORBIDDEN_DESCRIPTORS
 * anachronism terms, not what the stylePrompt's decade-prose actually
 * claims). `not-measured` (never a fake pass) whenever the concept has no
 * detected era signal at all — deriveEraIntent returns undefined for that
 * case and this app never forces an era onto a concept that didn't name one.
 */
function eraIntentItems(songs: SongIdea[], conceptLabel: string, explorationTrackNos: readonly number[] = []): AuditItem[] {
  const intent = deriveEraIntent(conceptLabel);
  if (!intent) {
    return [
      item({
        id: 'era_prompt_claim', category: '워크스페이스', labelKo: 'stylePrompt 시대 표기 (EraIntent)',
        targetKo: `primary ≥ ${Math.round(SENIOR_ERA_POLICY.singlePrimaryMin * 100)}%`, actualKo: '컨셉에 시대 신호 없음 — 판정 불가',
        pass: null, requiresAudio: false, specifiedBy: ['지시문 10 TASK A-4']
      })
    ];
  }
  const result = checkEraPromptAgainstIntent(songs, intent, new Set(explorationTrackNos));
  return [
    item({
      id: 'era_prompt_claim', category: '워크스페이스', labelKo: 'stylePrompt 시대 표기 — primary 비중',
      targetKo: `≥ ${Math.round(intent.primaryMinShare * 100)}%`, actualKo: `${Math.round(result.primaryShare * 100)}%`,
      pass: !result.primaryBelowTarget, requiresAudio: false, specifiedBy: ['지시문 10 TASK A-4'],
      metric: { value: result.primaryShare, direction: 'higherIsBetter' }
    }),
    item({
      id: 'era_prompt_other_pure', category: '워크스페이스', labelKo: 'stylePrompt 시대 표기 — 다른 시대 단독 (탐색 슬롯 제외)',
      targetKo: '0곡 (탐색 슬롯 아닌 트랙)', actualKo: `${result.blockingOtherEraPureTrackNos.length}곡${result.blockingOtherEraPureTrackNos.length ? ` (T${result.blockingOtherEraPureTrackNos.join(', T')})` : ''}`,
      pass: result.blockingOtherEraPureTrackNos.length === 0, requiresAudio: false, specifiedBy: ['지시문 10 TASK A-4'],
      metric: { value: result.blockingOtherEraPureTrackNos.length, direction: 'lowerIsBetter' }
    })
  ];
}

/**
 * v3.76 (TASK B) — the one entry point: given an already-generated pack,
 * runs every check this app's task history has asked for, in one pass.
 * Pure — no IndexedDB, no fetch, no file I/O (scripts/audit.ts's CLI wraps
 * this with generation + baseline I/O).
 */
export function runFullAudit(
  songs: SongIdea[],
  opts: { conceptLabel: string; songCount: number; audienceProfile: AudienceProfile; audioReport?: AudioSetReport; explorationTrackNos?: number[]; vocalQuotaOverride?: VocalQuota; archetype?: ChannelArchetype; lyricLanguage?: LyricLanguage }
): FullAuditReport {
  const promiseAuditReport = auditPromises(songs, opts.conceptLabel);
  const titleConsistency = auditTitleConceptConsistency(songs);
  const items = [
    ...structureItems(songs, opts.songCount, opts.audienceProfile),
    ...vocalItems(songs, opts.vocalQuotaOverride),
    ...promptItems(songs),
    ...lyricsItems(songs),
    ...killingPointItems(songs, opts.audienceProfile.arcModelId),
    ...audioItems(opts.audioReport),
    ...titleItems(songs, titleConsistency),
    ...promiseItems(promiseAuditReport),
    ...workspaceItems(),
    ...eraIntentItems(songs, opts.conceptLabel, opts.explorationTrackNos ?? []),
    ...sceneSignatureSourceItems(songs),
    ...distinctChoiceItems(songs, opts.archetype),
    ...metaLeakItems(songs, opts.lyricLanguage),
    ...objectStateItems(songs, opts.archetype, opts.lyricLanguage)
  ];
  return { conceptLabel: opts.conceptLabel, songCount: songs.length, items, promiseAudit: promiseAuditReport, titleConsistency };
}
