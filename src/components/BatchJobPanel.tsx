import { Clock10, RefreshCw, XCircle } from 'lucide-react';
import { describeSnapshotMismatch, type BatchJobRecord } from '../core/batchJobs';
import type { GenerationOptions } from '../types';

interface BatchJobPanelProps {
  job: BatchJobRecord;
  currentOpts: GenerationOptions;
  onCancel: () => void;
  onRetryFailed: () => void;
  onRegenerateMissing: () => void;
}

const STATUS_LABEL: Record<BatchJobRecord['status'], string> = {
  submitting: '제출 중...',
  in_progress: '처리 중...',
  canceling: '취소 중... (완료된 곡 회수 대기)',
  ended: '완료',
  failed: '실패',
  canceled: '취소됨',
  canceled_with_partial_results: '취소됨 (일부 결과 회수)'
};

export default function BatchJobPanel({ job, currentOpts, onCancel, onRetryFailed, onRegenerateMissing }: BatchJobPanelProps) {
  const totalRequests = job.requests.length;
  const failedCount = job.failedBatchIndexes?.length || 0;
  const missingCount = job.missingTrackNos?.length || 0;
  const mismatch = describeSnapshotMismatch(job.snapshot, currentOpts);
  const recoveredCount = job.resultBlueprint?.songs.length || 0;

  return (
    <div className="provider-summary batch-job-panel">
      <div className="panel-title">
        <Clock10 size={18} />
        <h2>⏳ Batch API 작업 — {STATUS_LABEL[job.status]}</h2>
      </div>
      <p className="supporting">
        "{job.projectTitle}" · {job.totalSongCount}곡 · 요청 {totalRequests}건
      </p>
      {mismatch && <p className="supporting">ℹ️ {mismatch}</p>}
      {(job.status === 'submitting' || job.status === 'in_progress') && (
        <p className="supporting">
          ⚠️ 보통 몇 분 내에 끝나지만 최대 24시간까지 걸릴 수 있습니다. 이 탭을 닫아도 괜찮습니다 — 다시 열면 자동으로 이어서 확인해요.
        </p>
      )}
      {job.status === 'canceling' && (
        <p className="supporting">
          ⏸ 취소 중... 이미 완성된 곡은 회수합니다. (완료: {recoveredCount} / {job.totalSongCount}곡)
        </p>
      )}
      {job.status === 'canceled_with_partial_results' && (
        <p className="supporting">
          ✅ 취소 전까지 완성된 {recoveredCount}곡을 회수했습니다.
        </p>
      )}
      {job.status === 'ended' && failedCount > 0 && (
        <p className="error">
          ⚠️ {failedCount}개 배치 요청이 실패했습니다. 나머지 곡은 정상 반영되었습니다.
        </p>
      )}
      {missingCount > 0 && (
        <p className="error">
          ⚠️ {missingCount}개 트랙이 결과에서 빠졌습니다: {job.missingTrackNos!.join(', ')}번
        </p>
      )}
      {job.status === 'failed' && job.errorMessage && <p className="error">{job.errorMessage}</p>}
      <div className="button-row">
        {(job.status === 'submitting' || job.status === 'in_progress') && (
          <button type="button" onClick={onCancel}>
            <XCircle size={16} />
            취소
          </button>
        )}
        {job.status === 'ended' && failedCount > 0 && (
          <button type="button" onClick={onRetryFailed}>
            <RefreshCw size={16} />
            실패한 {failedCount}개 배치만 재시도
          </button>
        )}
        {missingCount > 0 && (
          <button type="button" onClick={onRegenerateMissing}>
            <RefreshCw size={16} />
            빠진 {missingCount}개 트랙만 재생성
          </button>
        )}
      </div>
    </div>
  );
}
