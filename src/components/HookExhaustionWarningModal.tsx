import type { ExhaustionStats } from '../core/hookLedger';

interface HookExhaustionWarningModalProps {
  channelName: string;
  stats: ExhaustionStats;
  onCleanUpHistory: () => void;
  onCopyExpansionInfo: () => void;
  onContinueAnyway: () => void;
  onClose: () => void;
}

/**
 * v3.12 PART C-3 — shown at 90%+ pool usage, before the existing (unchanged)
 * hard exhaustion error that composeHook throws at 100%. Gives the user a
 * choice instead of letting them hit that error mid-generation.
 */
export default function HookExhaustionWarningModal({
  channelName,
  stats,
  onCleanUpHistory,
  onCopyExpansionInfo,
  onContinueAnyway,
  onClose
}: HookExhaustionWarningModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel hook-exhaustion-modal">
        <div className="panel-header">
          <h2>⚠️ 훅 풀이 거의 소진되었습니다</h2>
        </div>
        <p className="supporting">
          "{channelName}" 채널은 현재 훅 풀의 {stats.percentUsed}%를 사용했습니다 ({stats.used} / {stats.poolSize}, 남은 훅 {stats.remaining}개).
          곧 새 훅을 만들 수 없게 될 수 있습니다. 계속 진행하기 전에 아래 중 하나를 선택하세요.
        </p>
        <div className="button-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
          <button type="button" onClick={onCleanUpHistory}>🧹 훅 이력 정리 (오래된 팩 정리하여 풀 회수)</button>
          <button type="button" onClick={onCopyExpansionInfo}>📋 풀 확장 안내 (개발자에게 전달할 진단 정보 복사)</button>
          <button type="button" onClick={onContinueAnyway}>▶️ 그래도 계속 생성 (남은 훅으로 진행)</button>
        </div>
        <div className="button-row">
          <button type="button" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
