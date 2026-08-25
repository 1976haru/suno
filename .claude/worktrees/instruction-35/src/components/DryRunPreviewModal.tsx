import { Copy, X } from 'lucide-react';
import { copyText } from '../utils/exporters';

interface DryRunPreviewModalProps {
  open: boolean;
  systemPrompt: string;
  userPrompt: string;
  onClose: () => void;
}

export default function DryRunPreviewModal({ open, systemPrompt, userPrompt, onClose }: DryRunPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="panel-header">
          <h2>🔍 API로 보낼 프롬프트 미리보기</h2>
          <button type="button" className="icon-button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>
        <p className="supporting">
          API를 호출하지 않고, 지금 설정대로 생성 버튼을 눌렀을 때 첫 번째 배치에서 실제로 전송될 시스템/사용자 프롬프트를 그대로 보여줍니다.
          배치가 여러 개면 두 번째 배치부터는 이전 트랙 제목/후렴이 프롬프트에 추가로 포함됩니다.
        </p>

        <div className="copy-block">
          <div className="copy-head">
            <h4>System Prompt</h4>
            <button type="button" onClick={() => void copyText(systemPrompt)}>
              <Copy size={15} />
              복사
            </button>
          </div>
          <pre>{systemPrompt}</pre>
        </div>

        <div className="copy-block">
          <div className="copy-head">
            <h4>User Prompt</h4>
            <button type="button" onClick={() => void copyText(userPrompt)}>
              <Copy size={15} />
              복사
            </button>
          </div>
          <pre>{userPrompt}</pre>
        </div>
      </div>
    </div>
  );
}
