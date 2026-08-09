interface MigrationBackupPromptProps {
  busy: boolean;
  onBackupAndContinue: () => void;
  onSkip: () => void;
}

/**
 * v4.1 (TASK A2, §4-3) — shown once, only when core/workspaceMigration.ts's
 * one-time A1 migration hasn't run yet on this browser profile ("마이그레이션은
 * 되돌리기 어렵습니다"). Not forced (A1's own "강제하지 마십시오" ethos extends
 * here) — [건너뛰고 계속] proceeds without a backup for a user who's already
 * confident or has nothing to lose.
 */
export default function MigrationBackupPrompt({ busy, onBackupAndContinue, onSkip }: MigrationBackupPromptProps) {
  return (
    <div className="workspace-select-screen">
      <div className="workspace-select-head">
        <p className="eyebrow">하루 스튜디오</p>
        <h1>데이터 구조를 업데이트합니다</h1>
        <p className="step-hint">
          이번 업데이트부터 워크스페이스별로 데이터가 나뉩니다. 기존 데이터는 자동으로 옮겨지며 사라지지 않지만,
          혹시 모를 상황에 대비해 먼저 백업을 저장해 두는 것을 권장합니다.
        </p>
      </div>
      <div className="button-row">
        <button type="button" className="primary" disabled={busy} onClick={onBackupAndContinue}>
          백업하고 계속
        </button>
        <button type="button" disabled={busy} onClick={onSkip}>
          건너뛰고 계속
        </button>
      </div>
    </div>
  );
}
