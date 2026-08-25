import type { AudioMeasurements } from './audioMeasurements';

/**
 * codex 지시문 06 (TASK B) — "의도 대비 실제 음원": real, literal tolerance-
 * band comparison against the pack's own real target values (BPM/duration
 * come from core/audioTakes.ts's own real `AudioTakeDirectives`, itself
 * built from the pack's real generation-time genre/BPM choice and the
 * workspace's own AudienceProfile.songLengthSecondsRange — i.e. the real
 * GenerationSnapshot-derived intent this task's own spec asks to compare
 * against).
 *
 * Deliberately a NEW comparison, not a reuse of core/audioDirectiveAnalysis.ts's
 * `bpmMatchesTarget`/duration-in-range check: that module measures
 * EXECUTION RATE across many takes for the learning system (binary
 * matched/not, ±10% BPM tolerance with octave-correction) — a different
 * real purpose from this task's own literal 3-tier pass/warn/fail band
 * per-take compliance check (±5/±10 BPM, exact-range/±15s duration). Both
 * are real and coexist; reusing one for the other's job would silently
 * import the wrong tolerance semantics.
 */

export type ComplianceStatus = 'pass' | 'warn' | 'fail' | 'not-measured';

export interface ComplianceCheckResult {
  id: string;
  labelKo: string;
  status: ComplianceStatus;
  detail: string;
}

const DURATION_WARN_MARGIN_SEC = 15;
const BPM_PASS_TOLERANCE = 5;
const BPM_WARN_TOLERANCE = 10;
/** Same real "estimate isn't trustworthy below this" floor core/audioAnalysis.ts's own TEMPO_LOW_CONFIDENCE_THRESHOLD already establishes — reused so this module never reports a confident-sounding fail/warn off a genuinely unreliable BPM read. */
const BPM_CONFIDENCE_FLOOR = 0.4;
const LEADING_SILENCE_MAX_SEC = 1;
const TRAILING_SILENCE_MAX_SEC = 2;

function checkDuration(measuredSec: number, targetRangeSec: [number, number]): ComplianceCheckResult {
  const [min, max] = targetRangeSec;
  const detail = `실측 ${measuredSec.toFixed(1)}초 (목표 ${min}~${max}초)`;
  if (measuredSec >= min && measuredSec <= max) return { id: 'duration', labelKo: '길이', status: 'pass', detail };
  if (measuredSec >= min - DURATION_WARN_MARGIN_SEC && measuredSec <= max + DURATION_WARN_MARGIN_SEC) return { id: 'duration', labelKo: '길이', status: 'warn', detail };
  return { id: 'duration', labelKo: '길이', status: 'fail', detail };
}

/**
 * 지시문 28 (TASK C-3) — 실측(20260810 60년대 세트): 검출 BPM 중앙값이 설계
 * 중앙값보다 크게 높았고(112.3 vs 83), T3/T5/T8/T9/T12/T14/T17/T18 등 다수가
 * 설계 대역의 정확히 배음(약 2배) 근처였다 — onsetEnvelope 자동상관이 실제
 * 박자가 아니라 그 절반 주기(8분음표/16분음표 펄스)에 걸리는 흔한 추정
 * 오검출. core/audioDirectiveAnalysis.ts의 bpmMatchesTarget이 이미 같은
 * 문제를 ±10% 비율 허용오차로 배음 보정하지만, 이 모듈은 그 함수의 doc
 * comment가 명시하듯 절대 BPM 허용오차(±5/±10)라는 다른 허용오차 체계를
 * 쓴다 — 그 함수를 그대로 가져다 쓰면 허용오차 의미가 조용히 바뀐다. 같은 "measured,
 * measured*2, measured/2 중 목표에 가장 가까운 것을 쓴다" 보정 절차만
 * 이식하고, 절대 BPM 허용오차는 그대로 유지한다.
 */
function bestOctaveCandidate(measuredBpm: number, targetBpm: number): { bpm: number; octaveCorrected: boolean } {
  const candidates: Array<{ bpm: number; octaveCorrected: boolean }> = [
    { bpm: measuredBpm, octaveCorrected: false },
    { bpm: measuredBpm * 2, octaveCorrected: true },
    { bpm: measuredBpm / 2, octaveCorrected: true }
  ];
  return candidates.reduce((best, cur) => (Math.abs(cur.bpm - targetBpm) < Math.abs(best.bpm - targetBpm) ? cur : best));
}

function checkBpm(measuredBpm: number, bpmConfidence: number, targetBpm: number): ComplianceCheckResult {
  if (targetBpm <= 0) return { id: 'bpm', labelKo: 'BPM', status: 'not-measured', detail: '목표 BPM 없음' };
  if (bpmConfidence < BPM_CONFIDENCE_FLOOR) return { id: 'bpm', labelKo: 'BPM', status: 'not-measured', detail: `BPM 추정 신뢰도 낮음 (${bpmConfidence.toFixed(2)})` };
  const { bpm: correctedBpm, octaveCorrected } = bestOctaveCandidate(measuredBpm, targetBpm);
  const delta = Math.abs(correctedBpm - targetBpm);
  const detail = octaveCorrected
    ? `실측 ${measuredBpm.toFixed(0)}(배음보정 ${correctedBpm.toFixed(0)}) / 목표 ${targetBpm} (차이 ${delta.toFixed(1)})`
    : `실측 ${measuredBpm.toFixed(0)} / 목표 ${targetBpm} (차이 ${delta.toFixed(1)})`;
  if (delta <= BPM_PASS_TOLERANCE) return { id: 'bpm', labelKo: 'BPM', status: 'pass', detail };
  if (delta <= BPM_WARN_TOLERANCE) return { id: 'bpm', labelKo: 'BPM', status: 'warn', detail };
  return { id: 'bpm', labelKo: 'BPM', status: 'fail', detail };
}

function checkClipping(measurements: AudioMeasurements): ComplianceCheckResult {
  return {
    id: 'clipping', labelKo: '클리핑',
    status: measurements.clipping ? 'fail' : 'pass',
    detail: measurements.clipping ? `클리핑된 샘플 ${measurements.clippingSampleCount}개` : '클리핑 0건'
  };
}

function checkLeadingSilence(measurements: AudioMeasurements): ComplianceCheckResult {
  return {
    id: 'leading-silence', labelKo: '앞 무음',
    status: measurements.leadingSilenceSec <= LEADING_SILENCE_MAX_SEC ? 'pass' : 'fail',
    detail: `${measurements.leadingSilenceSec.toFixed(2)}초 (기준 ≤ ${LEADING_SILENCE_MAX_SEC}초)`
  };
}

function checkTrailingSilence(measurements: AudioMeasurements): ComplianceCheckResult {
  return {
    id: 'trailing-silence', labelKo: '뒤 무음',
    status: measurements.trailingSilenceSec <= TRAILING_SILENCE_MAX_SEC ? 'pass' : 'fail',
    detail: `${measurements.trailingSilenceSec.toFixed(2)}초 (기준 ≤ ${TRAILING_SILENCE_MAX_SEC}초)`
  };
}

export interface AudioComplianceTarget {
  targetDurationSec: [number, number];
  targetBpm: number;
}

/** The 6 real, literal core checks TASK B's own spec names — every real workspace runs these, regardless of any additional per-workspace checks layered on top (core/audioWorkspaceCompliance.ts). */
export function checkCoreAudioCompliance(measurements: AudioMeasurements, target: AudioComplianceTarget): ComplianceCheckResult[] {
  return [
    checkDuration(measurements.durationSec, target.targetDurationSec),
    checkBpm(measurements.bpm, measurements.bpmConfidence, target.targetBpm),
    checkClipping(measurements),
    checkLeadingSilence(measurements),
    checkTrailingSilence(measurements)
  ];
}

const STATUS_SEVERITY: Record<ComplianceStatus, number> = { 'not-measured': 0, pass: 0, warn: 1, fail: 2 };

/** Worst real status among the measured results — 'not-measured' never drags the overall verdict down (same "never a silent pass, but never a fake fail either" convention this whole app's audit code already uses). */
export function overallComplianceStatus(results: readonly ComplianceCheckResult[]): 'pass' | 'warn' | 'fail' {
  const worst = results.reduce((worst, result) => Math.max(worst, STATUS_SEVERITY[result.status]), 0);
  return worst === 2 ? 'fail' : worst === 1 ? 'warn' : 'pass';
}
