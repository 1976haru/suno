import { Database } from 'lucide-react';

interface CachePromptModalProps {
  open: boolean;
  cachedAt: string;
  onUseCache: () => void;
  onGenerateFresh: () => void;
  onCancel: () => void;
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return '방금 전';
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function CachePromptModal({ open, cachedAt, onUseCache, onGenerateFresh, onCancel }: CachePromptModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="panel-header">
          <h2>
            <Database size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            같은 조건으로 생성한 결과가 있어요
          </h2>
        </div>
        <p className="supporting">
          {relativeTime(cachedAt)}에 동일한 조건(채널·컨셉·곡 수·AI 설정)으로 생성한 결과가 저장되어 있습니다.
          캐시를 재사용하면 API를 호출하지 않아 비용이 들지 않고 즉시 결과를 볼 수 있어요.
        </p>
        <p className="supporting">
          단, 온도(창의성) 설정이 0보다 크면 매번 새로 생성할 때마다 다른 결과가 나올 수 있어요.
          이전과 다른 가사/구성을 원한다면 "새로 생성하기"를 선택하세요.
        </p>
        <div className="button-row">
          <button type="button" className="primary" onClick={onUseCache}>
            캐시 사용하기 (무료 · 즉시)
          </button>
          <button type="button" onClick={onGenerateFresh}>새로 생성하기 (API 호출)</button>
          <button type="button" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}
