import type { WorkspaceId } from '../types';

/**
 * 지시문 32 (§4) — "워크스페이스별 측정 곡 수 누적". 지시문 15/16/17이 만든
 * `promoteAfterMeasuredSongs`(data/distinctChoicePolicy.ts)는 값만 있고
 * 실제로 채워지는 카운터가 없었다 — 이 파일이 그 카운터의 순수 계산부다
 * (파일 IO는 scripts/audit.ts가 한다, core/는 항상 순수 함수만 — 기존
 * loadBaseline/saveBaseline과 같은 분리).
 *
 * `measuredPackPaths`로 같은 --pack 파일을 두 번 감사해도 두 번 세지
 * 않는다 — "측정 곡 수"는 서로 다른 실제 세트의 개수여야지, 같은 세트를
 * 몇 번 다시 돌렸는지가 아니다.
 */
export interface MeasuredSongLedgerEntry {
  totalSongs: number;
  setCount: number;
  measuredPackPaths: string[];
  lastMeasuredAt?: string;
}

export type MeasuredSongLedger = Partial<Record<WorkspaceId, MeasuredSongLedgerEntry>>;

export function recordMeasuredPack(
  ledger: MeasuredSongLedger,
  workspaceId: WorkspaceId,
  packPath: string,
  songCount: number,
  measuredAt: string
): { ledger: MeasuredSongLedger; alreadyRecorded: boolean } {
  const existing = ledger[workspaceId] ?? { totalSongs: 0, setCount: 0, measuredPackPaths: [] };
  if (existing.measuredPackPaths.includes(packPath)) {
    return { ledger, alreadyRecorded: true };
  }
  const updated: MeasuredSongLedgerEntry = {
    totalSongs: existing.totalSongs + Math.max(0, songCount),
    setCount: existing.setCount + 1,
    measuredPackPaths: [...existing.measuredPackPaths, packPath],
    lastMeasuredAt: measuredAt
  };
  return { ledger: { ...ledger, [workspaceId]: updated }, alreadyRecorded: false };
}

/**
 * 승격 조건 충족 여부만 판정한다 — 절대 승격시키지 않는다(§ "하지 말 것":
 * 자동 승격 메커니즘 금지). 호출자(scripts/checkArchetypeCoverage.ts)는 이
 * 결과를 알림으로만 표시하고, verified:true로의 실제 전환은 항상 하루가
 * distinctChoicePolicy.ts를 손으로 고치는 미래의 별도 지시문에서만 일어난다.
 */
export function promotionEligibility(entry: MeasuredSongLedgerEntry | undefined, promoteAfterMeasuredSongs: number): {
  measuredSongs: number;
  eligible: boolean;
} {
  const measuredSongs = entry?.totalSongs ?? 0;
  return {
    measuredSongs,
    eligible: promoteAfterMeasuredSongs > 0 && measuredSongs >= promoteAfterMeasuredSongs
  };
}
