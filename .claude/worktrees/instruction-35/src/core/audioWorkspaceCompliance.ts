import type { AudioMeasurements } from './audioMeasurements';
import type { VocalMetrics, SongAudioMetrics } from './audioAnalysis';
import type { ComplianceCheckResult } from './audioCompliance';
import { KIDS_AGE_TIERS, type KidsAgeTierId } from '../data/kidsAgeTiers';

/**
 * codex 지시문 06 (TASK B) — "워크스페이스별 추가" checks, layered ALONGSIDE
 * (never replacing) core/audioCompliance.ts's own 5 core checks — same
 * "common engine + per-workspace adapter" pattern established across
 * 지시문 04's entire workspace-adapter set.
 *
 * Honest scoping: several of this task's own named items have no real
 * measurable signal in this app today and are NOT faked here —
 * "group/solo/rap/chant 구현"/"파트 분배" (K-pop) and "선택 장르·분위기"
 * (2030) all need either lyric-timestamp alignment (ASR, TASK E's own
 * "향후" scope) or audio genre/mood classification (no such model exists
 * anywhere in this codebase, confirmed by investigation) — left as real,
 * explicit 'not-measured' items rather than a fabricated pass/fail. Every
 * item that DOES have a real measurable basis (vocal-gender heuristic via
 * VocalMetrics, kids lyric pace via existing word-count/duration data,
 * senior high-band/loudness via SongAudioMetrics) is real and computed.
 */

/**
 * VocalMetrics.registerHint is explicitly documented (audioAnalysis.ts) as
 * "참고용, 확정 아님" — this check is correspondingly ADVISORY-only, never a
 * hard fail, for every workspace that uses it. Exported (not just used via
 * checkKpopAudioCompliance/check2030AudioCompliance below) so
 * core/audioTakeSelection.ts's own real selection-safety gate (지시문 06
 * TASK C, 완료 기준 "wrong vocal gender selected without warning = 0") can
 * reuse the exact same real check rather than a second copy.
 */
export function checkVocalGenderPlausibility(vocalMetrics: VocalMetrics, expectedVocalType: string): ComplianceCheckResult {
  const suspectMismatch =
    (expectedVocalType === 'male' && vocalMetrics.registerHint === 'high') ||
    (expectedVocalType === 'female' && vocalMetrics.registerHint === 'low');
  return {
    id: 'vocal-gender-plausibility', labelKo: '보컬 성별 개연성 (advisory)',
    status: suspectMismatch ? 'warn' : 'pass',
    detail: suspectMismatch
      ? `목표 ${expectedVocalType}, 측정된 음역대는 ${vocalMetrics.registerHint} — 성별 불일치 가능성 (참고용, 확정 아님)`
      : `목표 ${expectedVocalType}, 측정된 음역대 ${vocalMetrics.registerHint}`
  };
}

// ---------------------------------------------------------------------------
// kids — "지나치게 큰 음량·공포 음향 advisory / 가사 속도 연령대 적합성"
// ---------------------------------------------------------------------------

/** A whole-track RMS above this reads as uncomfortably loud for a young child listener — advisory only, no hard science behind the exact number (same honest-heuristic status as this whole file's other advisory checks). */
const KIDS_LOUD_ADVISORY_DB = -8;

function checkKidsVolumeAdvisory(measurements: AudioMeasurements): ComplianceCheckResult {
  const tooLoud = measurements.approximateLoudnessDb > KIDS_LOUD_ADVISORY_DB;
  return {
    id: 'kids-volume-advisory', labelKo: '음량 (advisory)',
    status: tooLoud ? 'warn' : 'pass',
    detail: tooLoud ? `측정 음량 ${measurements.approximateLoudnessDb.toFixed(1)}dB — 아동에게 다소 큰 음량일 수 있음` : `측정 음량 ${measurements.approximateLoudnessDb.toFixed(1)}dB`
  };
}

/**
 * "공포 음향" (scary sound) — honestly left 'not-measured': no real signal
 * in PCM alone distinguishes "scary" from merely "loud/dynamic" without a
 * trained classifier this codebase doesn't have. Reported explicitly
 * rather than silently omitted.
 */
function scarySoundNotMeasured(): ComplianceCheckResult {
  return { id: 'kids-scary-sound', labelKo: '공포 음향 (advisory)', status: 'not-measured', detail: '미구현 — PCM만으로 "공포스러움"을 판별할 신호가 없음' };
}

/** Real basis: lyricWordCount / measured durationSec vs. the age tier's own real totalWordTarget / target duration midpoint (data/kidsAgeTiers.ts) — a genuine, if approximate, "did this land at a pace this age tier can follow" signal. */
function checkKidsLyricPace(measurements: AudioMeasurements, lyricWordCount: number, kidsAgeTierId: KidsAgeTierId, targetDurationSec: [number, number]): ComplianceCheckResult {
  const tier = KIDS_AGE_TIERS[kidsAgeTierId];
  const targetMidpoint = (targetDurationSec[0] + targetDurationSec[1]) / 2;
  if (!tier.totalWordTarget || targetMidpoint <= 0 || measurements.durationSec <= 0) {
    return { id: 'kids-lyric-pace', labelKo: '가사 속도 (연령대 적합성)', status: 'not-measured', detail: '연령대 기준 단어수 또는 길이 정보 없음' };
  }
  const expectedWordsPerSec = tier.totalWordTarget / targetMidpoint;
  const actualWordsPerSec = lyricWordCount / measurements.durationSec;
  const ratio = expectedWordsPerSec > 0 ? actualWordsPerSec / expectedWordsPerSec : 1;
  const tooFast = ratio > 1.3;
  return {
    id: 'kids-lyric-pace', labelKo: '가사 속도 (연령대 적합성)',
    status: tooFast ? 'warn' : 'pass',
    detail: `실측 초당 ${actualWordsPerSec.toFixed(2)}단어 / ${tier.labelKo} 기준 초당 ${expectedWordsPerSec.toFixed(2)}단어`
  };
}

export function checkKidsAudioCompliance(input: {
  measurements: AudioMeasurements;
  lyricWordCount: number;
  kidsAgeTierId: KidsAgeTierId;
  targetDurationSec: [number, number];
}): ComplianceCheckResult[] {
  return [
    checkKidsVolumeAdvisory(input.measurements),
    scarySoundNotMeasured(),
    checkKidsLyricPace(input.measurements, input.lyricWordCount, input.kidsAgeTierId, input.targetDurationSec)
  ];
}

// ---------------------------------------------------------------------------
// K-pop — "group/solo/rap/chant 구현 / 잘못된 성별 / 파트 분배"
// ---------------------------------------------------------------------------

function partImplementationNotMeasured(): ComplianceCheckResult {
  return { id: 'kpop-part-implementation', labelKo: 'group/solo/rap/chant 구현', status: 'not-measured', detail: '미구현 — 가사-타임스탬프 정렬(ASR) 없이는 파트별 실제 구현 여부를 오디오만으로 판별 불가 (TASK E 향후 범위)' };
}

function partDistributionNotMeasured(): ComplianceCheckResult {
  return { id: 'kpop-part-distribution', labelKo: '파트 분배', status: 'not-measured', detail: '미구현 — 위와 동일한 이유로 ASR 없이는 측정 불가' };
}

export function checkKpopAudioCompliance(vocalMetrics: VocalMetrics, expectedVocalType: string): ComplianceCheckResult[] {
  return [
    checkVocalGenderPlausibility(vocalMetrics, expectedVocalType),
    partImplementationNotMeasured(),
    partDistributionNotMeasured()
  ];
}

// ---------------------------------------------------------------------------
// 2030 — "선택 장르·보컬·분위기"
// ---------------------------------------------------------------------------

function genreMoodNotMeasured(): ComplianceCheckResult {
  return { id: 'modern2030-genre-mood', labelKo: '선택 장르·분위기', status: 'not-measured', detail: '미구현 — 오디오 장르/분위기 분류 모델이 이 앱에 없음' };
}

export function check2030AudioCompliance(vocalMetrics: VocalMetrics, expectedVocalType: string): ComplianceCheckResult[] {
  return [
    checkVocalGenderPlausibility(vocalMetrics, expectedVocalType),
    genreMoodNotMeasured()
  ];
}

// ---------------------------------------------------------------------------
// senior — "길이·템포·과도한 고역·보컬 편안함" (길이/템포는 core 체크가 이미 커버)
// ---------------------------------------------------------------------------

/** No prior threshold for highBandRatio existed anywhere in this codebase (confirmed by investigation) — this is a real, new, documented heuristic: senior listeners' own real tempoFloor/tempoCeiling-driven genre pool already skews toward warmer, less treble-forward mixes, so a share this high reads as an unusually harsh/bright master for that audience. */
const SENIOR_HIGH_BAND_ADVISORY_RATIO = 0.35;
/** A dynamic range this wide (loudest segment minus quietest, in dB) reads as an uncomfortably "punchy"/inconsistent listen for an audience that skews toward easy-listening comfort. */
const SENIOR_DYNAMIC_RANGE_ADVISORY_DB = 25;

function checkSeniorHighBand(metrics: SongAudioMetrics): ComplianceCheckResult {
  const excessive = metrics.highBandRatio > SENIOR_HIGH_BAND_ADVISORY_RATIO;
  return {
    id: 'senior-high-band', labelKo: '과도한 고역 (advisory)',
    status: excessive ? 'warn' : 'pass',
    detail: `고역 비율 ${(metrics.highBandRatio * 100).toFixed(0)}% (기준 ≤ ${(SENIOR_HIGH_BAND_ADVISORY_RATIO * 100).toFixed(0)}%)`
  };
}

function checkSeniorVocalComfort(metrics: SongAudioMetrics): ComplianceCheckResult {
  const uncomfortable = metrics.dynamicRange > SENIOR_DYNAMIC_RANGE_ADVISORY_DB;
  return {
    id: 'senior-vocal-comfort', labelKo: '보컬 편안함 (advisory)',
    status: uncomfortable ? 'warn' : 'pass',
    detail: `다이나믹 레인지 ${metrics.dynamicRange.toFixed(1)}dB (기준 ≤ ${SENIOR_DYNAMIC_RANGE_ADVISORY_DB}dB)`
  };
}

/**
 * 지시문 11 §0 — 하루의 실제 청취 실측(HotAIMusic 실곡 2건: 진폭 편차 3.08dB/2.08dB)에서
 * 나온 문자 그대로의 판정 밴드. "이 값들은 조정하면 안 된다"고 명시됐다 — 목표 5.0dB,
 * 2.3~3.3dB는 "평평하다"는 실제 청취 판단과 일치하는 warn 구간, 6.0dB 이상은 하루가
 * 실제로 들어본 범위를 벗어나는 "비현실적" 편차라 마찬가지로 warn(과대 편차 경고)으로
 * 취급한다. 둘 사이(3.3~6.0dB)가 목표 5.0dB에 가장 가까운 pass 구간.
 */
const SENIOR_AMPLITUDE_DEVIATION_TARGET_DB = 5.0;
const SENIOR_AMPLITUDE_DEVIATION_FLAT_MAX_DB = 3.3;
const SENIOR_AMPLITUDE_DEVIATION_UNREALISTIC_MIN_DB = 6.0;

function checkSeniorAmplitudeDeviation(measurements: AudioMeasurements): ComplianceCheckResult {
  const deviation = measurements.oneSecRmsDeviationDb;
  const detail = `1초 단위 RMS 편차 ${deviation.toFixed(2)}dB (목표 ${SENIOR_AMPLITUDE_DEVIATION_TARGET_DB}dB)`;
  if (deviation >= SENIOR_AMPLITUDE_DEVIATION_UNREALISTIC_MIN_DB) {
    return { id: 'senior-amplitude-deviation', labelKo: '진폭 편차 (advisory)', status: 'warn', detail: `${detail} — 비현실적으로 큰 편차` };
  }
  if (deviation <= SENIOR_AMPLITUDE_DEVIATION_FLAT_MAX_DB) {
    return { id: 'senior-amplitude-deviation', labelKo: '진폭 편차 (advisory)', status: 'warn', detail: `${detail} — 평평함(단조로움)` };
  }
  return { id: 'senior-amplitude-deviation', labelKo: '진폭 편차 (advisory)', status: 'pass', detail };
}

export function checkSeniorAudioCompliance(metrics: SongAudioMetrics, measurements?: AudioMeasurements): ComplianceCheckResult[] {
  const results = [checkSeniorHighBand(metrics), checkSeniorVocalComfort(metrics)];
  if (measurements) results.push(checkSeniorAmplitudeDeviation(measurements));
  return results;
}
