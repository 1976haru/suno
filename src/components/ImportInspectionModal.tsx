import { AlertTriangle, Check, Copy, ShieldQuestion, X } from 'lucide-react';
import type { ImportInspection } from '../core/importInspection';

interface ImportInspectionModalProps {
  inspection: ImportInspection;
  /** Only meaningful for status === 'repairable' — the explicit "[N곡만 확정]" action; never called automatically. */
  onConfirmPartial?: () => void;
  /** "[재생성 지시문 복사]" — no-op when there is nothing to copy (see canCopyRegenerateInstruction). */
  onCopyRegenerateInstruction?: () => void;
  /** TASK v5.19 (TASK C) — "[해당 곡 재작곡 지시문 복사]" for artist-leak-excluded tracks specifically; no-op when there is nothing to copy. */
  onCopyArtistLeakInstruction?: () => void;
  /** TASK v5.19 (TASK C, "오탐 신고 경로") — "오탐입니다 — 이대로 진행" for one detected surface (e.g. "bread"). Never auto-applied; logs the report and exempts that surface for this session only (see App.tsx's onReportArtistLeakFalsePositive). */
  onReportFalsePositive?: (surface: string) => void;
  onClose: () => void;
}

const CHECK_ICON: Record<ImportInspection['checks'][number]['status'], string> = {
  pass: '✅',
  info: 'ℹ️',
  warn: '⚠',
  blocked: '⛔'
};

const STATUS_LABEL: Record<ImportInspection['status'], string> = {
  valid: '완료 (valid)',
  repairable: '부분 (repairable)',
  blocked: '차단 (blocked)'
};

/**
 * TASK (import transaction / pre-persistence inspection) — the real
 * inspection screen App.tsx's onImportSongsJson now shows BEFORE any
 * autosave/hook-registration for a 'repairable' or 'blocked' classification
 * (core/importInspection.ts's inspectImportReport). Never shown for 'valid'
 * — that status proceeds exactly as this app always has, with zero extra
 * clicks (App.tsx never even constructs this component's props for that
 * case). Follows this codebase's existing modal convention
 * (HookExhaustionWarningModal.tsx: .modal-overlay/.modal-panel/.button-row),
 * not a new UI pattern.
 *
 * TASK v5.19 (TASK C) — an artist/band-name leak no longer forces
 * status === 'blocked' for the whole pack (see importInspection.ts's own
 * file-header doc comment); it now shows up here as per-track detail
 * (inspection.artistLeaks) under the normal 'repairable' flow, with its own
 * regen-instruction copy button and a per-surface false-positive report
 * action — "bread" the food should never cost a clean 17-of-18 pack.
 */
export default function ImportInspectionModal({
  inspection,
  onConfirmPartial,
  onCopyRegenerateInstruction,
  onCopyArtistLeakInstruction,
  onReportFalsePositive,
  onClose
}: ImportInspectionModalProps) {
  const shortfall = inspection.requestedCount - inspection.importedCount;
  const canCopyRegenerateInstruction = Boolean(onCopyRegenerateInstruction) && inspection.missingTrackNos.length > 0;
  const canCopyArtistLeakInstruction = Boolean(onCopyArtistLeakInstruction) && inspection.artistLeaks.length > 0;
  // The button label must reflect what "[N곡만 확정]" actually SAVES, not
  // the raw importedCount — leak-flagged tracks are excluded from the save
  // (see App.tsx's onConfirmPartialImport filter), so counting them in would
  // overstate what the user is about to confirm.
  const confirmableCount = inspection.importedCount - inspection.artistLeakTrackNos.length;
  const uniqueLeakSurfaces = [...new Set(inspection.artistLeaks.flatMap(entry => entry.leaks.map(leak => leak.surface)))];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel import-inspection-modal">
        <div className="panel-header">
          <h2>
            {inspection.status === 'blocked' ? '⛔ 가져오기 차단됨' : '⚠ 가져오기 검토 필요'}
          </h2>
        </div>

        <p className="supporting">
          {shortfall > 0
            ? `⚠ ${inspection.importedCount}곡 (요청 ${inspection.requestedCount}곡)`
            : `${inspection.importedCount}곡 (요청 ${inspection.requestedCount}곡)`}
        </p>
        {inspection.missingTrackNos.length > 0 && (
          <p className="warning">T{inspection.missingTrackNos.join(', T')} 누락</p>
        )}

        <ul className="import-check-list">
          {inspection.checks.map(check => (
            <li key={check.id} className={`import-check-line import-check-${check.status}`}>
              <span aria-hidden="true">{CHECK_ICON[check.status]}</span> {check.labelKo}
              {check.detail && <span className="import-check-detail"> — {check.detail}</span>}
            </li>
          ))}
        </ul>

        {inspection.artistLeaks.length > 0 && (
          <div className="artist-leak-review">
            <p className="warning">
              <AlertTriangle size={14} /> 아티스트명 노출로 T{inspection.artistLeaks.map(entry => entry.trackNo).join(', T')} 제외됨 — 나머지 {confirmableCount}곡은 정상 확정할 수 있습니다.
            </p>
            <ul className="import-check-list">
              {inspection.artistLeaks.map(entry => (
                <li key={entry.trackNo} className="import-check-line import-check-blocked">
                  Track {entry.trackNo}: {[...new Set(entry.leaks.map(leak => leak.surface))].join(', ')}
                </li>
              ))}
            </ul>
            {onReportFalsePositive && uniqueLeakSurfaces.length > 0 && (
              <div className="button-row">
                {uniqueLeakSurfaces.map(surface => (
                  <button key={surface} type="button" onClick={() => onReportFalsePositive(surface)}>
                    <ShieldQuestion size={14} /> "{surface}"는 오탐입니다 — 이대로 진행
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="supporting">
          상태: {STATUS_LABEL[inspection.status]}
        </p>

        {inspection.status === 'blocked' && (
          <p className="error">
            <AlertTriangle size={14} /> 차단된 가져오기는 저장/훅 등록 없이 그대로 폐기됩니다 — "그래도 진행" 옵션은 없습니다.
          </p>
        )}

        <div className="button-row">
          {canCopyRegenerateInstruction && (
            <button type="button" onClick={onCopyRegenerateInstruction}>
              <Copy size={14} /> 재생성 지시문 복사
            </button>
          )}
          {canCopyArtistLeakInstruction && (
            <button type="button" onClick={onCopyArtistLeakInstruction}>
              <Copy size={14} /> 해당 곡 재작곡 지시문 복사
            </button>
          )}
          {inspection.status === 'repairable' && onConfirmPartial && (
            <button type="button" className="primary" onClick={onConfirmPartial}>
              <Check size={14} /> {confirmableCount}곡만 확정
            </button>
          )}
          <button type="button" onClick={onClose}>
            <X size={14} /> {inspection.status === 'repairable' ? '나중에 결정 (저장 안 함)' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  );
}
