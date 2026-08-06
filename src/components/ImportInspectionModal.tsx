import { AlertTriangle, Check, Copy, X } from 'lucide-react';
import type { ImportInspection } from '../core/importInspection';

interface ImportInspectionModalProps {
  inspection: ImportInspection;
  /** Only meaningful for status === 'repairable' — the explicit "[N곡만 확정]" action; never called automatically. */
  onConfirmPartial?: () => void;
  /** "[재생성 지시문 복사]" — no-op when there is nothing to copy (see canCopyRegenerateInstruction). */
  onCopyRegenerateInstruction?: () => void;
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
 */
export default function ImportInspectionModal({ inspection, onConfirmPartial, onCopyRegenerateInstruction, onClose }: ImportInspectionModalProps) {
  const shortfall = inspection.requestedCount - inspection.importedCount;
  const canCopyRegenerateInstruction = Boolean(onCopyRegenerateInstruction) && inspection.missingTrackNos.length > 0;

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
          {inspection.status === 'repairable' && onConfirmPartial && (
            <button type="button" className="primary" onClick={onConfirmPartial}>
              <Check size={14} /> {inspection.importedCount}곡만 확정
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
