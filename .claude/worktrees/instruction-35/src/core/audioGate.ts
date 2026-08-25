import type { AudioSetReport } from './audioSetReport';
import type { DesignIssue } from './designGate';

/**
 * v3.78 (TASK C) — "관문 3": v3.73/v3.74 already built the real measurement
 * (core/audioSetReport.ts, browser-side waveform analysis) — this module
 * only wires that measurement to blocking/advisory judgments, per this
 * task's own "v3.73/v3.74가 이미 있습니다. 게이트로 연결만 하십시오." No new
 * measurement logic here.
 *
 * Per this task's own §4 "음원 검증은 blocking으로 만들지 말 것" (length only):
 * only the two duration checks block; every timbre/dynamics/similarity
 * check stays advisory, because the songs already exist by the time audio
 * is measurable — blocking here would mean discarding a finished song over
 * a soft quality signal, which this task explicitly forbids.
 */

export interface AudioGateResult {
  /** true whenever there's nothing to block on — including "no audio supplied yet" (§4's own "실패로 처리하지 마십시오"), matching core/fullAudit.ts's audioItems' own not-measured-is-not-failed convention. */
  passed: boolean;
  blocking: DesignIssue[];
  advisory: DesignIssue[];
  measured: boolean;
}

/** Absolute floor regardless of audience profile — a track under 2:50 is pathologically short no matter which profile's own target range applies (mirrors compositionScorer.ts's own LYRIC_WORD_COUNT_BLOCKING_FLOOR pattern: one workspace-independent floor beneath every profile's own tighter target). */
const AUDIO_DURATION_ABSOLUTE_MIN_SECONDS = 170;

export function evaluateAudioGate(report: AudioSetReport | undefined): AudioGateResult {
  if (!report || !report.analyzedCount) {
    return { passed: true, blocking: [], advisory: [], measured: false };
  }

  const blocking: DesignIssue[] = [];
  const advisory: DesignIssue[] = [];
  const [targetLow, targetHigh] = report.duration.targetRange;
  const outOfTarget = [...report.duration.overTarget, ...report.duration.underTarget];
  if (outOfTarget.length) {
    blocking.push({
      id: 'audio-duration',
      labelKo: '수노 실측 길이',
      expected: `${targetLow}~${targetHigh}초 (오디언스 프로파일)`,
      actual: `목표 이탈 ${outOfTarget.length}곡 (트랙 ${outOfTarget.join(', ')})`,
      fixHintKo: '이 트랙들은 오디언스 프로파일의 목표 길이를 벗어났습니다 — 다음 세트에서 가사 길이/구조를 조정하세요.'
    });
  }
  const underAbsoluteMin = Object.entries(report.duration.values).filter(([, seconds]) => seconds < AUDIO_DURATION_ABSOLUTE_MIN_SECONDS);
  if (underAbsoluteMin.length) {
    blocking.push({
      id: 'audio-duration-min',
      labelKo: '수노 실측 길이 절대 하한',
      expected: `≥ ${AUDIO_DURATION_ABSOLUTE_MIN_SECONDS}초 (2:50)`,
      actual: `${underAbsoluteMin.length}곡 미달 (트랙 ${underAbsoluteMin.map(([trackNo]) => trackNo).join(', ')})`,
      fixHintKo: '2:50 미만으로 렌더링된 트랙이 있습니다 — 가사 길이가 지나치게 짧았을 가능성이 큽니다.'
    });
  }

  // v4.6 (TASK C, §3-5) — a real 7:59 track is a Suno rendering outlier a
  // style prompt can't reliably control (see audioSetReport.ts's own
  // severelyOverTracks doc comment) — advisory, not blocking, same reasoning
  // as this file's own top doc comment for every non-absolute-length check:
  // the song already exists by the time audio is measurable.
  if (report.duration.severelyOverTracks.length) {
    advisory.push({
      id: 'audio-duration-severe',
      labelKo: '4:30 초과 트랙',
      expected: '≤ 4:30',
      actual: `${report.duration.severelyOverTracks.length}곡 (트랙 ${report.duration.severelyOverTracks.join(', ')})`,
      fixHintKo: '프롬프트로 통제하기 어려운 수노 렌더링 편차입니다 — 페이드아웃 편집 또는 재생성(A/B 중 짧은 쪽 채택)을 권장합니다.'
    });
  }
  if (report.killingPoint.weakDynamicTracks.length) {
    advisory.push({
      id: 'audio-dynamic-range',
      labelKo: '킬링포인트 곡 진폭',
      expected: '≥ 5dB',
      actual: `진폭 부족 ${report.killingPoint.weakDynamicTracks.length}곡 (트랙 ${report.killingPoint.weakDynamicTracks.join(', ')})`,
      fixHintKo: '킬링포인트가 있는데도 진폭 변화가 약한 트랙입니다 — 다음 세트의 편곡 밀도/다이나믹 지시를 강화하세요.'
    });
  }
  if (report.killingPoint.noLatePeakTracks.length) {
    advisory.push({
      id: 'audio-peak-position',
      labelKo: '킬링포인트 곡 최대구간 위치',
      expected: '후반부(≥ 70% 지점)',
      actual: `후반 상승 없음 ${report.killingPoint.noLatePeakTracks.length}곡 (트랙 ${report.killingPoint.noLatePeakTracks.join(', ')})`,
      fixHintKo: '킬링포인트 배치가 곡 후반부에서 청감상 드러나지 않는 트랙입니다.'
    });
  }
  // v3.79 (TASK B) — report.timbre is the FULL 0..Nyquist spectrum (guitar/
  // piano/strings/horns included, not just voice), and Suno masters every
  // track to a similar overall brightness — so this was never actually
  // measuring "vocal similarity" despite the old id/labelKo below claiming
  // so. Real measurement: three different band/method combinations all
  // scored a real pair >= 0.97 "similar" while the user's own ears heard
  // them as completely different singers (see audioSetReport.ts's own
  // buildVocalDiversityReport doc comment for the full account). Renamed to
  // "믹스 밝기" (mix brightness) and reframed as an arrangement-diversity
  // advisory, never a same-voice claim — this task's own §9 "보컬 유사도
  // 판정을 다른 방식으로 되살리지 말 것".
  if (report.timbre.centroidSpread < 200) {
    advisory.push({
      id: 'audio-mix-brightness-spread',
      labelKo: '믹스 중심 주파수 폭',
      expected: '≥ 200Hz',
      actual: `${Math.round(report.timbre.centroidSpread)}Hz`,
      fixHintKo: '분석된 트랙들의 믹스 전체 밝기(스펙트럼 중심)가 서로 가깝습니다 — 편곡 다양성 참고용입니다. 목소리가 같다는 뜻은 아닙니다.'
    });
  }
  if (report.timbre.clusteredPairs.length) {
    advisory.push({
      id: 'audio-mix-brightness-similarity',
      labelKo: '믹스 밝기 유사도',
      expected: '유사도 0.95 초과 쌍 0개',
      actual: `${report.timbre.clusteredPairs.length}쌍 (${report.timbre.clusteredPairs.map(([a, b]) => `${a}-${b}`).join(', ')})`,
      fixHintKo: '이 트랙 쌍은 믹스 밝기가 비슷합니다(편곡 다양성 참고). 목소리가 같다는 뜻이 아닙니다.'
    });
  }

  return { passed: blocking.length === 0, blocking, advisory, measured: true };
}
