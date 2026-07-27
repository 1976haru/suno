import type { ImportSongsReport } from './claudeCodeBridge';

export const BRIDGE_IMPORT_PRECONDITION_REASON = '채널·시즌 설정을 먼저 선택한 뒤 가져오기를 실행하세요.';

export interface BridgeImportPrerequisites {
  hasSelectedChannel: boolean;
  hasSelectedSeason: boolean;
}

export interface BridgeImportReasonCount {
  reason: string;
  count: number;
}

export interface BridgeImportTotals {
  attemptedCount: number;
  importedCount: number;
  skippedCount: number;
  successfulReportCount: number;
  failedReportCount: number;
}

export function bridgeImportStatusText(prerequisites: BridgeImportPrerequisites): string {
  return `채널: ${prerequisites.hasSelectedChannel ? '선택됨' : '미선택'} · 시즌: ${prerequisites.hasSelectedSeason ? '선택됨' : '미선택'}`;
}

export function bridgeImportBlockMessage(prerequisites: BridgeImportPrerequisites): string {
  if (prerequisites.hasSelectedChannel && prerequisites.hasSelectedSeason) return '';
  if (!prerequisites.hasSelectedChannel && !prerequisites.hasSelectedSeason) return '채널과 시즌을 먼저 선택하세요.';
  if (!prerequisites.hasSelectedChannel) return '채널을 먼저 선택하세요.';
  return '시즌을 먼저 선택하세요.';
}

export function makeBridgeImportFailureReport(reasons: string | string[]): ImportSongsReport {
  return {
    blueprint: null,
    importedCount: 0,
    skippedCount: 0,
    skippedReasons: Array.isArray(reasons) ? reasons : [reasons],
    warnings: []
  };
}

export function bridgeImportExceptionReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return `가져오기 중 오류가 발생했습니다: ${error.message}`;
  return '가져오기 중 알 수 없는 오류가 발생했습니다.';
}

export function countBridgeImportReasons(reports: ImportSongsReport | ImportSongsReport[]): BridgeImportReasonCount[] {
  const items = Array.isArray(reports) ? reports : [reports];
  const counts = new Map<string, number>();
  items.flatMap(report => report.skippedReasons).forEach(reason => {
    const normalized = reason.trim() || '알 수 없는 오류';
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });
  return Array.from(counts, ([reason, count]) => ({ reason, count }));
}

export function bridgeImportTotals(reports: ImportSongsReport | ImportSongsReport[]): BridgeImportTotals {
  const items = Array.isArray(reports) ? reports : [reports];
  return items.reduce<BridgeImportTotals>((totals, report) => {
    const successful = Boolean(report.blueprint) && report.importedCount > 0;
    return {
      attemptedCount: totals.attemptedCount + report.importedCount + report.skippedCount,
      importedCount: totals.importedCount + report.importedCount,
      skippedCount: totals.skippedCount + report.skippedCount,
      successfulReportCount: totals.successfulReportCount + (successful ? 1 : 0),
      failedReportCount: totals.failedReportCount + (successful ? 0 : 1)
    };
  }, { attemptedCount: 0, importedCount: 0, skippedCount: 0, successfulReportCount: 0, failedReportCount: 0 });
}

export async function runBridgeImportAction<TReport>({
  prerequisites,
  run,
  makeBlockedReport,
  makeErrorReport,
  setLoading,
  setReport
}: {
  prerequisites: BridgeImportPrerequisites;
  run: () => Promise<TReport>;
  makeBlockedReport: (reason: string) => TReport;
  makeErrorReport: (reason: string) => TReport;
  setLoading: (value: boolean) => void;
  setReport: (report: TReport) => void;
}): Promise<TReport> {
  const blockMessage = bridgeImportBlockMessage(prerequisites);
  if (blockMessage) {
    const report = makeBlockedReport(BRIDGE_IMPORT_PRECONDITION_REASON);
    setReport(report);
    setLoading(false);
    return report;
  }

  setLoading(true);
  try {
    const report = await run();
    setReport(report);
    return report;
  } catch (error) {
    const report = makeErrorReport(bridgeImportExceptionReason(error));
    setReport(report);
    return report;
  } finally {
    setLoading(false);
  }
}
