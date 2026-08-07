import { useEffect, useState } from 'react';
import { listPacks } from '../core/library';
import { currentWorkspaceId, setCurrentWorkspace } from '../core/workspaceScope';
import { workspaceDefinitions, type WorkspaceDefinition } from '../data/workspaces';
import { workspaceAvailabilityFor } from '../data/workspaceAvailability';
import type { WorkspaceId } from '../types';
import DataManagementPanel from './DataManagementPanel';

/** codex 지시문 07 (TASK G) — this card's own real gate now reads through the same workspaceAvailabilityFor() every other real gate (generationPreflight.ts/featureFlags.ts) uses, instead of `workspace.ready` directly. */
function isWorkspaceReady(workspace: WorkspaceDefinition): boolean {
  return workspaceAvailabilityFor(workspace).status === 'ready';
}

interface WorkspaceSelectScreenProps {
  onSelect: (id: WorkspaceId) => void;
}

interface WorkspaceCardStats {
  count: number;
  lastSavedAt: string | null;
}

/** v4.0 (TASK A1) — reads a workspace's own pack count/last-saved date for its entry-screen card. Passes `id` straight through to listPacks()'s explicit workspaceId override rather than temporarily mutating the shared currentWorkspaceId() global — an earlier version did that and raced under React StrictMode's dev-only double-effect invocation (see workspaceScope.ts's scopeFilter doc comment). */
async function packSummaryForWorkspace(id: WorkspaceId): Promise<WorkspaceCardStats> {
  const packs = await listPacks(id);
  const lastSavedAt = packs.reduce<string | null>((latest, pack) => (!latest || pack.savedAt > latest ? pack.savedAt : latest), null);
  return { count: packs.length, lastSavedAt };
}

function formatLastWorked(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function WorkspaceSelectScreen({ onSelect }: WorkspaceSelectScreenProps) {
  const [stats, setStats] = useState<Partial<Record<WorkspaceId, WorkspaceCardStats>>>({});
  const [notReadyNotice, setNotReadyNotice] = useState<WorkspaceDefinition | null>(null);
  const [skipNextTime, setSkipNextTime] = useState(false);
  const [dataManagementOpen, setDataManagementOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Safe to run concurrently: packSummaryForWorkspace() takes an explicit
    // workspaceId parameter now, with no shared mutable state between calls.
    void Promise.all(workspaceDefinitions.map(async ws => [ws.id, await packSummaryForWorkspace(ws.id)] as const)).then(entries => {
      if (!cancelled) setStats(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCardClick(workspace: WorkspaceDefinition) {
    if (!isWorkspaceReady(workspace)) {
      setNotReadyNotice(workspace);
      return;
    }
    setNotReadyNotice(null);
    if (skipNextTime) setSkipWorkspacePickerPreference(workspace.id);
    onSelect(workspace.id);
  }

  return (
    <div className="workspace-select-screen">
      <div className="workspace-select-head">
        <p className="eyebrow">Suno Weaver Studio</p>
        <h1>어떤 작업을 하시겠어요?</h1>
        <p className="step-hint">워크스페이스를 고르면 화면과 데이터가 완전히 갈립니다 — 다른 워크스페이스의 채널·팩·훅·평가는 여기서 보이지 않습니다.</p>
      </div>

      <div className="workspace-card-grid">
        {workspaceDefinitions.map(workspace => {
          const stat = stats[workspace.id];
          const ready = isWorkspaceReady(workspace);
          return (
            <button
              key={workspace.id}
              type="button"
              className={ready ? 'workspace-card' : 'workspace-card not-ready'}
              style={{ borderColor: ready ? workspace.theme.accent : undefined }}
              onClick={() => handleCardClick(workspace)}
            >
              <span className="workspace-card-label">{workspace.labelKo}</span>
              {ready ? (
                <span className="workspace-card-meta">
                  {stat ? `세트 ${stat.count}개` : ' '}
                  {stat?.lastSavedAt ? ` · 마지막 ${formatLastWorked(stat.lastSavedAt)}` : ''}
                </span>
              ) : (
                <span className="workspace-card-meta">준비 중</span>
              )}
            </button>
          );
        })}
      </div>

      {notReadyNotice && (
        <p className="workspace-not-ready-notice">
          "{notReadyNotice.labelKo}"은(는) 아직 준비 중입니다. {notReadyNotice.descriptionKo}
        </p>
      )}

      <div className="workspace-select-footer">
        <label className="workspace-skip-checkbox">
          <input type="checkbox" checked={skipNextTime} onChange={e => setSkipNextTime(e.target.checked)} />
          다음부터 시니어 올드팝으로 바로 열기
        </label>
        <div className="button-row">
          <button type="button" title="워크스페이스를 먼저 선택하면 설정을 열 수 있습니다" disabled>
            설정
          </button>
          <button type="button" onClick={() => setDataManagementOpen(true)}>
            데이터 관리
          </button>
        </div>
      </div>

      {dataManagementOpen && (
        <DataManagementPanel initialWorkspaceId={currentWorkspaceId()} onClose={() => setDataManagementOpen(false)} />
      )}
    </div>
  );
}

const SKIP_PICKER_KEY = 'suno-weaver-skip-workspace-picker';

/** Reads which workspace (if any) should auto-open, skipping this screen entirely. Deliberately NOT itself workspace-scoped (scopedKey would be circular — this is what CHOOSES the workspace in the first place). */
export function skipWorkspacePickerPreference(): WorkspaceId | null {
  if (typeof window === 'undefined') return null;
  try {
    return (window.localStorage.getItem(SKIP_PICKER_KEY) as WorkspaceId | null) || null;
  } catch {
    return null;
  }
}

export function setSkipWorkspacePickerPreference(id: WorkspaceId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SKIP_PICKER_KEY, id);
  } catch {
    // Storage can be blocked in private/embedded contexts; the picker just reappears next time, harmless.
  }
}

export function clearSkipWorkspacePickerPreference(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SKIP_PICKER_KEY);
  } catch {
    // ignore
  }
}
