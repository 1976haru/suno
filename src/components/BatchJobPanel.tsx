import { Clock10, RefreshCw, XCircle } from 'lucide-react';
import type { BatchJobRecord } from '../core/batchJobs';

interface BatchJobPanelProps {
  job: BatchJobRecord;
  onCancel: () => void;
  onRetryFailed: () => void;
}

const STATUS_LABEL: Record<BatchJobRecord['status'], string> = {
  submitting: '제출 중...',
  in_progress: '처리 중...',
  ended: '완료',
  failed: '실패',
  canceled: '취소됨'
};

export default function BatchJobPanel({ job, onCancel, onRetryFailed }: BatchJobPanelProps) {
  const totalRequests = job.requests.length;
  const failedCount = job.failedBatchIndexes?.length || 0;

  return (
    <div className="provider-summary batch-job-panel">
      <div className="panel-title">
        <Clock10 size={18} />
        <h2>⏳ Batch API 작업 — {STATUS_LABEL[job.status]}</h2>
      </div>
      <p className="supporting">
        "{job.projectTitle}" · {job.totalSongCount}곡 · 요청 {totalRequests}건
      </p>
      {(job.status === 'submitting' || job.status === 'in_progress') && (
        <p className="supporting">
          ⚠️ 보통 몇 분 내에 끝나지만 최대 24시간까지 걸릴 수 있습니다. 이 탭을 닫아도 괜찮습니다 — 다시 열면 자동으로 이어서 확인해요.
        </p>
      )}
      {job.status === 'ended' && failedCount > 0 && (
        <p className="error">
          ⚠️ {failedCount}개 배치 요청이 실패했습니다. 나머지 곡은 정상 반영되었습니다.
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
      </div>
    </div>
  );
}
