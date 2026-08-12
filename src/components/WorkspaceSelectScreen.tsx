import { useEffect, useState } from 'react';
import { listPacks } from '../core/library';
import { currentWorkspaceId } from '../core/workspaceScope';
import { workspaceDefinitions, type WorkspaceDefinition } from '../data/workspaces';
import { workspaceAvailabilityFor } from '../data/workspaceAvailability';
import { computeWorkspaceReadiness, type WorkspaceReadiness } from '../core/workspaceReadiness';
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
  readiness: WorkspaceReadiness;
}

/**
 * v4.0 (TASK A1) — reads a workspace's own pack count/last-saved date for its entry-screen card. Passes `id` straight through to listPacks()'s explicit workspaceId override rather than temporarily mutating the shared currentWorkspaceId() global — an earlier version did that and raced under React StrictMode's dev-only double-effect invocation (see workspaceScope.ts's scopeFilter doc comment).
 * 지시문 28 (TASK B) — packs.length(실전 검증 세트 수)를 computeWorkspaceReadiness에
 * 그대로 넘긴다 — IndexedDB를 두 번 두드리지 않는다.
 */
async function packSummaryForWorkspace(id: WorkspaceId, workspace: WorkspaceDefinition): Promise<WorkspaceCardStats> {
  const packs = await listPacks(id);
  const lastSavedAt = packs.reduce<string | null>((latest, pack) => (!latest || pack.savedAt > latest ? pack.savedAt : latest), null);
  return { count: packs.length, lastSavedAt, readiness: computeWorkspaceReadiness(workspace, packs.length) };
}

function formatLastWorked(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 지시문 28 (TASK B) — 워크스페이스 카드 자체가 <button>이라 안에 <details>
 * 같은 인터랙티브 요소를 넣을 수 없었다(HTML 중첩 규칙 위반 + 클릭
 * 가로채기). title 호버로 5개 축을 보여줬지만, 지시문 41 (TASK D) —
 * "왜 3/5인지 알 수 있어야 조치할 수 있다. 눌렀을 때 내역이 보이게" —
 * 호버는 터치 기기에서 아예 닿을 수 없다. 카드 구조를 바꿔(바깥은 이제
 * <div>, "워크스페이스 열기"만 진짜 <button>) 이 배지를 그 옆의 독립된
 * <button>으로 분리했다 — 형제 요소라 중첩 문제 없이 눌러서 펼칠 수 있다.
 * 차단은 여전히 없다 — 색과 숫자, 펼침 여부만 다를 뿐 ready 판정 자체는
 * 손대지 않는다.
 */
function WorkspaceReadinessBadge({ readiness, expanded, onToggle }: { readiness: WorkspaceReadiness; expanded: boolean; onToggle: () => void }) {
  const { items, passCount, total } = readiness;
  const allPass = passCount === total;
  const title = items.map(i => `${i.ok ? '✅' : '❌'} ${i.labelKo}: ${i.detailKo}`).join('\n');
  return (
    <>
      <button
        type="button"
        className={allPass ? 'chip workspace-card-readiness' : 'chip warning-chip workspace-card-readiness'}
        title={title}
        onClick={e => { e.stopPropagation(); onToggle(); }}
      >
        {allPass ? '✅' : '⚠'} 준비 상태 {passCount}/{total}
      </button>
      {expanded && (
        <ul className="workspace-card-readiness-detail" onClick={e => e.stopPropagation()}>
          {items.map(item => (
            <li key={item.id}>
              {item.ok ? '✅' : '⚠'} {item.labelKo} — {item.detailKo}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function WorkspaceSelectScreen({ onSelect }: WorkspaceSelectScreenProps) {
  const [stats, setStats] = useState<Partial<Record<WorkspaceId, WorkspaceCardStats>>>({});
  const [notReadyNotice, setNotReadyNotice] = useState<WorkspaceDefinition | null>(null);
  const [skipNextTime, setSkipNextTime] = useState(false);
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  // 지시문 41 (TASK D) — 한 번에 한 카드만 펼친다(아코디언). 같은 배지를 다시 누르면 접는다.
  const [expandedReadinessId, setExpandedReadinessId] = useState<WorkspaceId | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Safe to run concurrently: packSummaryForWorkspace() takes an explicit
    // workspaceId parameter now, with no shared mutable state between calls.
    void Promise.all(workspaceDefinitions.map(async ws => [ws.id, await packSummaryForWorkspace(ws.id, ws)] as const)).then(entries => {
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
        <p className="eyebrow">하루 스튜디오</p>
        <h1>어떤 작업을 하시겠어요?</h1>
        <p className="step-hint">워크스페이스를 고르면 화면과 데이터가 완전히 갈립니다 — 다른 워크스페이스의 채널·팩·훅·평가는 여기서 보이지 않습니다.</p>
      </div>

      <div className="workspace-card-grid">
        {workspaceDefinitions.map(workspace => {
          const stat = stats[workspace.id];
          const ready = isWorkspaceReady(workspace);
          return (
            <div
              key={workspace.id}
              className={ready ? 'workspace-card' : 'workspace-card not-ready'}
              style={{ borderColor: ready ? workspace.theme.accent : undefined }}
            >
              <button type="button" className="workspace-card-enter" onClick={() => handleCardClick(workspace)}>
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
              {ready && stat && (
                <WorkspaceReadinessBadge
                  readiness={stat.readiness}
                  expanded={expandedReadinessId === workspace.id}
                  onToggle={() => setExpandedReadinessId(current => (current === workspace.id ? null : workspace.id))}
                />
              )}
            </div>
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
// 지시문 19 (TASK C) — these 3 real cross-file utilities stay co-located
// rather than being split into their own module; see
// ExplorationLedgerPanel.tsx's identical doc comment on why (dev-only Fast
// Refresh rule, no runtime effect).
// eslint-disable-next-line react-refresh/only-export-components
export function skipWorkspacePickerPreference(): WorkspaceId | null {
  if (typeof window === 'undefined') return null;
  try {
    return (window.localStorage.getItem(SKIP_PICKER_KEY) as WorkspaceId | null) || null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function setSkipWorkspacePickerPreference(id: WorkspaceId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SKIP_PICKER_KEY, id);
  } catch {
    // Storage can be blocked in private/embedded contexts; the picker just reappears next time, harmless.
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function clearSkipWorkspacePickerPreference(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SKIP_PICKER_KEY);
  } catch {
    // ignore
  }
}
