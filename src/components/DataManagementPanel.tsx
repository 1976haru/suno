import { useEffect, useMemo, useState } from 'react';
import { listAllHooksForWorkspace } from '../core/hookLedger';
import { listFullPacksForWorkspace } from '../core/library';
import { listAllRatingsForWorkspace } from '../core/ratingLedger';
import { listAllTakesForWorkspace } from '../core/audioTakes';
import {
  applyImport,
  daysSinceLastBackup,
  DEFAULT_EXPORT_INCLUDE,
  downloadBlob,
  exportAllWorkspacesBlob,
  exportWorkspaceBlob,
  ImportFormatError,
  nextTransferFileName,
  previewImport,
  recordBackupNow,
  type ExportInclude,
  type ImportPreview,
  type ImportResult
} from '../core/workspaceTransfer';
import { getWorkspace, workspaceDefinitions } from '../data/workspaces';
import type { WorkspaceId } from '../types';

interface DataManagementPanelProps {
  initialWorkspaceId: WorkspaceId;
  onClose: () => void;
}

interface WorkspaceCounts {
  packs: number;
  hooks: number;
  ratings: number;
  takes: number;
}

async function countsForWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceCounts> {
  const [packs, hooks, ratings, takes] = await Promise.all([
    listFullPacksForWorkspace(workspaceId),
    listAllHooksForWorkspace(workspaceId).catch(() => []),
    listAllRatingsForWorkspace(workspaceId).catch(() => []),
    listAllTakesForWorkspace(workspaceId).catch(() => [])
  ]);
  return { packs: packs.length, hooks: hooks.length, ratings: ratings.length, takes: takes.length };
}

type Stage = { kind: 'idle' } | { kind: 'previewing'; file: File; preview: ImportPreview } | { kind: 'done'; result: ImportResult };

/**
 * v4.1 (TASK A2, TASK E) — the entry screen's [데이터 관리] button opens this.
 * Deliberately generalized over workspaceId (§11) via a selector rather than
 * hardcoded to "whatever's current" — the same panel manages any of the 5.
 */
export default function DataManagementPanel({ initialWorkspaceId, onClose }: DataManagementPanelProps) {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>(initialWorkspaceId);
  const [counts, setCounts] = useState<WorkspaceCounts | null>(null);
  const [include, setInclude] = useState<ExportInclude>(DEFAULT_EXPORT_INCLUDE);
  const [partialOpen, setPartialOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const workspace = getWorkspace(workspaceId);
  const staleDays = useMemo(() => daysSinceLastBackup(workspaceId), [workspaceId, stage]);

  useEffect(() => {
    let cancelled = false;
    setCounts(null);
    void countsForWorkspace(workspaceId).then(next => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleExportWorkspace() {
    setBusy(true);
    setError('');
    try {
      const blob = await exportWorkspaceBlob({ workspaceId, include });
      await downloadBlob(blob, nextTransferFileName(workspaceId));
      recordBackupNow(workspaceId);
    } finally {
      setBusy(false);
    }
  }

  async function handleExportAll() {
    setBusy(true);
    setError('');
    try {
      const blob = await exportAllWorkspacesBlob();
      await downloadBlob(blob, nextTransferFileName('ALL'));
      for (const ws of workspaceDefinitions) recordBackupNow(ws.id);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const preview = await previewImport(file);
      setStage({ kind: 'previewing', file, preview });
    } catch (err) {
      setError(err instanceof ImportFormatError ? err.message : '파일을 읽는 중 문제가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmImport(chosenMode: 'merge' | 'replace') {
    if (stage.kind !== 'previewing') return;
    setBusy(true);
    setError('');
    try {
      const result = await applyImport(stage.file, chosenMode, { allowCrossWorkspace: stage.preview.isCrossWorkspace });
      setStage({ kind: 'done', result });
      setCounts(await countsForWorkspace(workspaceId));
    } catch (err) {
      setError(err instanceof ImportFormatError ? err.message : '가져오기 중 문제가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function toggleInclude(key: keyof ExportInclude) {
    setInclude(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="data-management-overlay" role="dialog" aria-label="데이터 관리">
      <div className="data-management-panel">
        <div className="panel-header">
          <h2>데이터 관리</h2>
          <button type="button" onClick={onClose}>닫기</button>
        </div>

        {stage.kind === 'idle' && (
          <>
            <label>
              워크스페이스
              <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value as WorkspaceId)}>
                {workspaceDefinitions.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.labelKo}</option>
                ))}
              </select>
            </label>

            <p className="supporting">
              {counts
                ? `팩 ${counts.packs}개 · 훅 ${counts.hooks}개 · 평가 ${counts.ratings}개 · 테이크 ${counts.takes}개`
                : '불러오는 중...'}
            </p>

            <p className={staleDays === null || staleDays >= 7 ? 'backup-status stale' : 'backup-status'}>
              {staleDays === null ? '마지막 백업: 기록 없음 ⚠' : staleDays >= 7 ? `마지막 백업: ${staleDays}일 전 ⚠` : `마지막 백업: ${staleDays}일 전`}
            </p>

            <div className="button-row">
              <button type="button" className="primary" disabled={busy} onClick={() => void handleExportWorkspace()}>
                이 워크스페이스 내보내기
              </button>
              <button type="button" disabled={busy} onClick={() => void handleExportAll()}>
                전체 백업
              </button>
            </div>

            <label className="button-like">
              파일에서 가져오기
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => void handlePickFile(e.target.files?.[0])} />
            </label>

            <button type="button" className="chip" onClick={() => setPartialOpen(o => !o)}>
              부분 내보내기 {partialOpen ? '▴' : '▾'}
            </button>
            {partialOpen && (
              <div className="partial-export-grid">
                {(['packs', 'hooks', 'ratings', 'takes', 'videos', 'settings', 'channels', 'usage'] as const).map(key => (
                  <label key={key}>
                    <input type="checkbox" checked={include[key]} onChange={() => toggleInclude(key)} />
                    {{ packs: '팩', hooks: '훅 원장', ratings: '평가', takes: '테이크', videos: '영상', settings: '설정', channels: '채널', usage: '사용량' }[key]}
                  </label>
                ))}
                <label className="api-keys-checkbox">
                  <input type="checkbox" checked={include.apiKeys} onChange={() => toggleInclude('apiKeys')} />
                  API 키 포함 (⚠ 파일 공유 시 주의)
                </label>
              </div>
            )}

            <details className="multi-pc-hint">
              <summary>여러 컴퓨터에서 쓰실 때</summary>
              <ol>
                <li>작업을 마치면 [이 워크스페이스 내보내기]</li>
                <li>파일을 USB·클라우드 드라이브에 두기</li>
                <li>다른 컴퓨터에서 [파일에서 가져오기] → 병합</li>
                <li>그 컴퓨터에서 작업 후 다시 내보내기</li>
              </ol>
              <p>⚠ 두 컴퓨터에서 동시에 작업하면 나중에 합칠 때 팩이 중복될 수 있습니다. 한 번에 한 곳에서 작업하세요. 자동 동기화는 지원하지 않습니다 — 파일을 직접 주고받아야 합니다.</p>
            </details>
          </>
        )}

        {stage.kind === 'previewing' && (
          <div className="import-preview">
            <p className="supporting">
              파일: {stage.file.name}<br />
              만든 시각: {new Date(stage.preview.exportedAt).toLocaleString('ko-KR')} · 앱 {stage.preview.appVersion}
            </p>
            {stage.preview.warnings.map(w => (
              <p key={w} className="import-warning">⚠ {w}</p>
            ))}
            <table className="import-plan-table">
              <tbody>
                <tr><td>팩</td><td>새로 {stage.preview.plan.packs.new}개 · 이미 있음 {stage.preview.plan.packs.skipped}개 (건너뜀)</td></tr>
                <tr><td>훅 원장</td><td>새로 {stage.preview.plan.hooks.new}개 · 이미 있음 {stage.preview.plan.hooks.existing}개</td></tr>
                <tr><td>평가</td><td>새로 {stage.preview.plan.ratings.new}개 · 갱신 {stage.preview.plan.ratings.updated}개 · 건너뜀 {stage.preview.plan.ratings.skipped}개</td></tr>
                <tr><td>테이크</td><td>새로 {stage.preview.plan.takes.new}개 · 갱신 {stage.preview.plan.takes.updated}개</td></tr>
                <tr><td>채널</td><td>새로 {stage.preview.plan.channels.new}개 · 이미 있음 {stage.preview.plan.channels.skipped}개 (건너뜀)</td></tr>
              </tbody>
            </table>
            <p className="supporting">⚠ 가져오기 전 현재 상태를 자동 백업합니다.</p>
            <div className="button-row">
              <button type="button" className="primary" disabled={busy} onClick={() => void handleConfirmImport('merge')}>병합하기</button>
              <button type="button" disabled={busy} onClick={() => void handleConfirmImport('replace')}>덮어쓰기</button>
              <button type="button" disabled={busy} onClick={() => setStage({ kind: 'idle' })}>취소</button>
            </div>
          </div>
        )}

        {stage.kind === 'done' && (
          <div className="import-result">
            <p className="supporting">가져오기가 끝났습니다.</p>
            <ul>
              <li>팩: 추가 {stage.result.packs.added}개 · 교체 {stage.result.packs.replaced}개 · 건너뜀 {stage.result.packs.skipped}개</li>
              <li>훅 원장: {stage.result.hooks.written}건 반영</li>
              <li>평가: 추가 {stage.result.ratings.added}개 · 갱신 {stage.result.ratings.updated}개</li>
              <li>테이크: 새로 {stage.result.takes.new}개 · 갱신 {stage.result.takes.updated}개</li>
              <li>채널: 추가 {stage.result.channels.added}개</li>
            </ul>
            <button type="button" className="primary" onClick={() => setStage({ kind: 'idle' })}>확인</button>
          </div>
        )}

        {error && <p className="import-warning">⚠ {error}</p>}
      </div>
    </div>
  );
}
