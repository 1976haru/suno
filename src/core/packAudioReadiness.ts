import type { AudioTake } from './audioTakes';
import { evaluateTakeSelectionSafety, type SelectionSafetyIssue } from './audioTakeSelection';
import { checkCoreAudioCompliance, overallComplianceStatus, type ComplianceStatus } from './audioCompliance';

/**
 * 지시문 11 (TASK F-6) — "단일 `audioConfirmed: boolean` 플래그를 대체하는
 * PackAudioReadiness 게이팅". 실측 확인: `audioConfirmed`(core/artifactStage.ts)는
 * 지시문 08 범위의 finalizeBlueprint 초크포인트 안에서만 존재하고, 그 경로
 * 자체가 실제 UI 어디에서도 호출되지 않는 테스트 전용 경로다(실제 앱에서
 * `audioConfirmed: true`를 세팅하는 호출부가 하나도 없다 — grep으로 확인).
 * 이 모듈은 그 자리를 대신 채우는 게 아니라(그건 지시문 08 범위), 이 지시문이
 * 실제로 새로 만드는 "업로드 기반 오디오 파이프라인"의 산출물 — 프로덕션
 * 번들(F-5)이 "이 팩을 번들로 낼 준비가 됐는가"를 판단할 때 실제로 참조하는
 * 트랙별 실측 근거다. 불리언 하나가 아니라 트랙마다 "채택된 테이크가 있는가 /
 * 측정값이 있는가 / 선택 안전성 이슈가 있는가 / 코어 컴플라이언스 상태가
 * 무엇인가"를 그대로 들고 있어, 번들 UI가 "몇 곡이 왜 준비 안 됐는지"를
 * 정직하게 보여줄 수 있다(조용히 제외하지 않는다).
 */

export interface TrackAudioReadiness {
  trackNo: number;
  hasAdoptedTake: boolean;
  adoptedTakeId?: string;
  hasMeasurements: boolean;
  selectionIssues: SelectionSafetyIssue[];
  complianceStatus: ComplianceStatus | 'not-measured';
  /** 채택된 테이크가 있고, blocking 이슈가 없고, 코어 컴플라이언스가 fail이 아닐 때만 true. */
  ready: boolean;
}

export interface PackAudioReadiness {
  trackReadiness: TrackAudioReadiness[];
  totalTracks: number;
  readyTrackCount: number;
  /** 채택된 테이크 자체가 없는 트랙 수 — 업로드가 전혀 안 됐거나 아직 채택하지 않음. */
  missingTrackCount: number;
  /** 채택된 테이크는 있지만 (측정값 없음/클리핑/코어 컴플라이언스 fail 등으로) 준비되지 않은 트랙 수. */
  blockedTrackCount: number;
  overallReady: boolean;
}

/**
 * 순수 함수 — 실제 IndexedDB 조회(getTakes)는 호출자가 먼저 수행하고, 이
 * 함수는 그 결과(트랙 목록 + 해당 채널/팩의 AudioTake[])만으로 판정한다.
 * `songs`는 trackNo만 있으면 되므로 SongIdea 전체를 요구하지 않는다.
 */
export function evaluatePackAudioReadiness(
  songs: readonly { trackNo: number }[],
  takes: readonly AudioTake[]
): PackAudioReadiness {
  const trackReadiness: TrackAudioReadiness[] = songs.map(song => {
    const adopted = takes.find(t => t.trackNo === song.trackNo && t.adopted);
    if (!adopted) {
      return {
        trackNo: song.trackNo,
        hasAdoptedTake: false,
        hasMeasurements: false,
        selectionIssues: [],
        complianceStatus: 'not-measured',
        ready: false
      };
    }
    const selectionIssues = evaluateTakeSelectionSafety(adopted);
    const blocking = selectionIssues.some(issue => issue.severity === 'blocking');
    const complianceStatus: ComplianceStatus | 'not-measured' = adopted.measurements
      ? overallComplianceStatus(checkCoreAudioCompliance(adopted.measurements, {
          targetDurationSec: adopted.directives.targetDurationSec,
          targetBpm: adopted.directives.targetBpm
        }))
      : 'not-measured';
    return {
      trackNo: song.trackNo,
      hasAdoptedTake: true,
      adoptedTakeId: adopted.takeId,
      hasMeasurements: Boolean(adopted.measurements),
      selectionIssues,
      complianceStatus,
      ready: !blocking && complianceStatus !== 'fail'
    };
  });

  const readyTrackCount = trackReadiness.filter(t => t.ready).length;
  const missingTrackCount = trackReadiness.filter(t => !t.hasAdoptedTake).length;
  const blockedTrackCount = trackReadiness.filter(t => t.hasAdoptedTake && !t.ready).length;

  return {
    trackReadiness,
    totalTracks: songs.length,
    readyTrackCount,
    missingTrackCount,
    blockedTrackCount,
    overallReady: songs.length > 0 && readyTrackCount === songs.length
  };
}
