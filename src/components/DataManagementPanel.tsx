import { useEffect, useMemo, useState } from 'react';
import { listAllHooksForWorkspace } from '../core/hookLedger';
import { listFullPacksForWorkspace } from '../core/library';
import { listAllRatingsForWorkspace } from '../core/ratingLedger';
import { listAllTakesForWorkspace } from '../core/audioTakes';
import { importViewerRatings, type ViewerRatingsImportResult } from '../core/viewerRatingsImport';
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
import { backfillHistoryFromPacks, diagnoseWorkspaceHistory, formatWorkspaceHistoryDiagnostic, type BackfillResult, type BackfillSource } from '../core/historyBackfill';
import type { PackGeneratedBy, WorkspaceId } from '../types';

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
  /** TASK v5.20 (독립 수노모드 뷰어, TASK C-3) — kept separate from the workspace-transfer `stage` state machine above: a viewer ratings file is a much smaller, single-purpose import (no preview/merge-vs-replace choice, just "match what you can, tell me what you couldn't"). */
  const [viewerImportBusy, setViewerImportBusy] = useState(false);
  const [viewerImportError, setViewerImportError] = useState('');
  const [viewerImportResult, setViewerImportResult] = useState<ViewerRatingsImportResult | null>(null);
  /** 지시문 14 (TASK D-4) — "과거 세트 이력 등록": kept separate from the workspace-transfer `stage` state machine above, same reasoning as the viewer-ratings import just above — this is a much narrower, single-purpose import (no preview/merge-vs-replace choice, ledger-only, no library/result-screen writes). */
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResults, setBackfillResults] = useState<BackfillResult[] | null>(null);
  const [backfillDiagnostic, setBackfillDiagnostic] = useState<string | null>(null);
  // 지시문 18 (TASK C-2) — 이 배치의 파일들을 만든 에이전트. 이 패널
  // 자체의 마지막 선택을 기억하지는 않는다(생성 화면의 선택과 별개 축 —
  // 과거 파일을 한꺼번에 등록하는 드문 작업이라 매번 새로 고르는 편이
  // 더 안전하다).
  const [backfillGeneratedBy, setBackfillGeneratedBy] = useState<PackGeneratedBy>('other');

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

  /** TASK v5.20 (독립 수노모드 뷰어, TASK C-3) — "[뷰어 평가 가져오기]": reads a ratings_<setName>_<date>.json file core/sunoViewerExport.ts's viewer produced and merges it into ratingLedger.ts via core/viewerRatingsImport.ts. Never throws on a malformed file — importViewerRatings itself returns a result/warnings shape instead. */
  async function handleImportViewerRatings(file: File | undefined) {
    if (!file) return;
    setViewerImportError('');
    setViewerImportResult(null);
    setViewerImportBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importViewerRatings(parsed, workspaceId);
      setViewerImportResult(result);
      setCounts(await countsForWorkspace(workspaceId));
    } catch {
      setViewerImportError('파일을 읽는 중 문제가 발생했습니다 — 뷰어의 [평가 내보내기] 파일인지 확인하세요.');
    } finally {
      setViewerImportBusy(false);
    }
  }

  /** Recursively reads .json files out of a dropped folder — "폴더 드래그" (지시문 14 §D-4). Not exposed for a plain drag-of-loose-files (no directory entries): that path already falls through to `dataTransfer.files` below. */
  async function readAllFilesFromEntry(entry: FileSystemEntry): Promise<File[]> {
    if (entry.isFile) {
      return new Promise(resolve => {
        (entry as FileSystemFileEntry).file(
          file => resolve(file.name.toLowerCase().endsWith('.json') ? [file] : []),
          () => resolve([])
        );
      });
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries: FileSystemEntry[] = await new Promise(resolve => {
        const all: FileSystemEntry[] = [];
        const readBatch = () => {
          reader.readEntries(batch => {
            if (!batch.length) { resolve(all); return; }
            all.push(...batch);
            readBatch();
          }, () => resolve(all));
        };
        readBatch();
      });
      const nested = await Promise.all(entries.map(readAllFilesFromEntry));
      return nested.flat();
    }
    return [];
  }

  async function readFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
    const entries = Array.from(dataTransfer.items || [])
      .map(item => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));
    if (entries.length) {
      const nested = await Promise.all(entries.map(readAllFilesFromEntry));
      return nested.flat();
    }
    return Array.from(dataTransfer.files || []).filter(file => file.name.toLowerCase().endsWith('.json'));
  }

  /**
   * 지시문 14 (TASK D-4) — "과거 세트 이력 등록": every file is registered under
   * this panel's OWN currently selected `workspaceId` (the "사용자가 지정
   * (기본값: 현재 워크스페이스)" default §D-4 asks for) — a file's own
   * meta.channelId still gets a real chance to resolve independently inside
   * historyBackfill.ts's planBackfillSource, but the panel's explicit
   * selection wins when the user has deliberately chosen a workspace here
   * (this panel is workspace-scoped by its own `workspaceId` selector,
   * independent of whatever the globally "current" app workspace happens to
   * be — see this component's own header doc comment on why that selector
   * exists at all).
   */
  async function handleBackfillFiles(files: File[]) {
    if (!files.length) return;
    setBackfillBusy(true);
    setBackfillResults(null);
    setBackfillDiagnostic(null);
    try {
      const sources: BackfillSource[] = await Promise.all(files.map(async file => {
        try {
          const text = await file.text();
          return { fileName: file.name, json: JSON.parse(text), workspaceId, generatedBy: backfillGeneratedBy };
        } catch {
          return { fileName: file.name, json: null, workspaceId, generatedBy: backfillGeneratedBy };
        }
      }));
      const results = await backfillHistoryFromPacks(sources);
      setBackfillResults(results);
      const diagnostic = await diagnoseWorkspaceHistory(workspaceId, workspace.defaultLyricLanguage);
      setBackfillDiagnostic(formatWorkspaceHistoryDiagnostic(diagnostic));
      setCounts(await countsForWorkspace(workspaceId));
    } finally {
      setBackfillBusy(false);
    }
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

            <label className="button-like">
              뷰어 평가 가져오기
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                disabled={viewerImportBusy}
                onChange={e => { void handleImportViewerRatings(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>
            <p className="hint">수노 진행 모드 뷰어(suno-mode.html)의 [평가 내보내기] 파일을 가져와 이 워크스페이스의 평가 원장에 합칩니다.</p>
            {viewerImportResult && (
              <p className="supporting">
                뷰어 평가 가져오기 완료 — 병합 {viewerImportResult.matched}건 · 건너뜀 {viewerImportResult.skipped}건
                {viewerImportResult.warnings.map(w => <span key={w}><br />⚠ {w}</span>)}
              </p>
            )}
            {viewerImportError && <p className="import-warning">⚠ {viewerImportError}</p>}

            {/* 지시문 18 (TASK C-2) — 이 배치를 만든 에이전트. historyBackfill.ts는 library 팩을 만들지 않으므로 이 값은 등록 결과 표시용일 뿐, qualityScore 집계에는 들어가지 않는다(그 파일 자신의 doc comment 참고). */}
            <label>
              이 파일들을 만든 생성 에이전트
              <select value={backfillGeneratedBy} onChange={e => setBackfillGeneratedBy(e.target.value as PackGeneratedBy)}>
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
                <option value="fable-5">Fable 5</option>
                <option value="api-direct">API 직접 호출</option>
                <option value="local">로컬 생성(에이전트 아님)</option>
                <option value="other">기타</option>
              </select>
            </label>
            <div
              className="button-like"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                void readFilesFromDataTransfer(e.dataTransfer).then(handleBackfillFiles);
              }}
            >
              과거 세트 이력 등록 (파일 선택 또는 폴더 드래그)
              <input
                type="file"
                accept="application/json"
                multiple
                style={{ display: 'none' }}
                disabled={backfillBusy}
                onChange={e => { void handleBackfillFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
              />
            </div>
            <p className="hint">
              지난 세트 songs-output.json 파일을 이 워크스페이스({workspace.labelKo})의 회피 이력(장면·훅·가사 문장·구조 지문)에만 등록합니다 — 라이브러리 저장·화면 표시는 하지 않습니다.
            </p>
            {backfillBusy && <p className="supporting">등록 중...</p>}
            {backfillResults && (
              <ul className="supporting">
                {backfillResults.map(r => (
                  <li key={r.fileName}>
                    {r.fileName} — {
                      r.status === 'registered' ? `신규 등록 ${r.songCount}곡 (${r.generatedBy ?? 'other'})`
                        : r.status === 'skipped-duplicate' ? '이미 등록됨 — 건너뜀'
                          : `등록 불가 (${r.reasonKo})`
                    }
                  </li>
                ))}
              </ul>
            )}
            {backfillDiagnostic && <pre className="supporting backfill-diagnostic">{backfillDiagnostic}</pre>}

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
            {stage.result.warnings.map(w => (
              <p key={w} className="import-warning">⚠ {w}</p>
            ))}
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
