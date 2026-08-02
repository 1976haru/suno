import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AudienceProfile, SongIdea } from '../types';
import type { AuditItem, FullAuditReport } from '../core/fullAudit';
import { runFullAuditResponsive } from '../core/localGenerationClient';
import { scopedKey } from '../core/workspaceScope';

interface PromiseAuditPanelProps {
  songs: SongIdea[];
  conceptLabel: string;
  audienceProfile: AudienceProfile;
  channelId: string;
}

interface StoredBaseline {
  savedAt: string;
  conceptLabel: string;
  items: Record<string, boolean>;
}

type Classification = 'pass' | 'regression' | 'below-target' | 'not-measured' | 'new';

function baselineStorageKey(channelId: string): string {
  return scopedKey(`audit-baseline:${channelId}`);
}

function loadBaseline(channelId: string): StoredBaseline | undefined {
  try {
    const raw = localStorage.getItem(baselineStorageKey(channelId));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function saveBaseline(channelId: string, report: FullAuditReport) {
  const items: Record<string, boolean> = {};
  for (const it of report.items) {
    if (it.status === 'not-measured') continue;
    items[it.id] = it.status === 'pass';
  }
  const baseline: StoredBaseline = { savedAt: new Date().toISOString(), conceptLabel: report.conceptLabel, items };
  localStorage.setItem(baselineStorageKey(channelId), JSON.stringify(baseline));
}

function classify(it: AuditItem, baseline: StoredBaseline | undefined): Classification {
  if (it.status === 'not-measured') return 'not-measured';
  const prior = baseline?.items[it.id];
  if (prior === undefined) return it.status === 'pass' ? 'pass' : 'new';
  if (prior === true && it.status === 'fail') return 'regression';
  if (prior === false && it.status === 'fail') return 'below-target';
  return 'pass';
}

/**
 * v3.76 (TASK C) — Step4 result screen's "정합성 검사" tab. Reuses
 * core/fullAudit.ts / core/promiseAudit.ts exactly as scripts/audit.ts's
 * CLI does (TASK B) — same checks, same classification logic — so a
 * browser session and a CLI run of the same pack never disagree. Baseline
 * lives in localStorage (scoped per workspace+channel via
 * core/workspaceScope.ts's scopedKey), separate from the CLI's file-based
 * audit-baseline.json — the two are independent snapshots by design (a CLI
 * run against a fresh local-preview pack isn't the same artifact as a real
 * generated/saved pack in the browser).
 *
 * Per this task's own §4/§8: [기준선 갱신] is a deliberate, explicit click
 * only — never automatic. A regression here is a warning, never a block —
 * every other action on this screen (bridge instruction copy, etc.) stays
 * fully available regardless of what this panel shows.
 */
export default function PromiseAuditPanel({ songs, conceptLabel, audienceProfile, channelId }: PromiseAuditPanelProps) {
  const [baseline, setBaseline] = useState(() => loadBaseline(channelId));
  const [expanded, setExpanded] = useState(false);
  // v4.0 (TASK A) — runFullAudit (49 items, including the pack-wide style-
  // similarity linter) now runs inside a Worker (see
  // core/localGenerationClient.ts's runFullAuditResponsive) instead of
  // synchronously inside a useMemo — an 18-80 song pack's full audit was a
  // real main-thread freeze risk this task exists to fix. `report` starts
  // null while the worker runs; a stale-closure guard drops any response
  // that arrives after the inputs changed again.
  const [report, setReport] = useState<FullAuditReport | null>(null);
  const [auditError, setAuditError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setAuditError('');
    runFullAuditResponsive(songs, { conceptLabel, songCount: songs.length, audienceProfile })
      .then(result => { if (!cancelled) setReport(result); })
      .catch(error => { if (!cancelled) setAuditError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [songs, conceptLabel, audienceProfile]);

  const classified = useMemo(() => report?.items.map(it => ({ item: it, classification: classify(it, baseline) })) ?? [], [report, baseline]);
  const regressions = classified.filter(c => c.classification === 'regression');
  const belowTarget = classified.filter(c => c.classification === 'below-target' || c.classification === 'new');
  const passed = classified.filter(c => c.classification === 'pass');
  const notMeasured = classified.filter(c => c.classification === 'not-measured');

  const overallPct = report ? Math.round(report.promiseAudit.overallFulfillment * 100) : 0;

  if (auditError) {
    return <div className="promise-audit-panel promise-audit-error">정합성 검사를 실행하지 못했습니다: {auditError}</div>;
  }
  if (!report) {
    return <div className="promise-audit-panel promise-audit-loading">정합성 검사 실행 중...</div>;
  }

  return (
    <div className="promise-audit-panel">
      <div className="promise-audit-summary">
        <div className="promise-audit-headline">
          <ShieldCheck size={16} />
          <strong>약속 이행도</strong>
          <span className={overallPct >= 70 ? 'promise-audit-pct good' : 'promise-audit-pct bad'}>{overallPct}%</span>
        </div>
        <div className="promise-audit-breakdown">
          {report.promiseAudit.promises.map(result => (
            <span key={result.promise.id} title={result.explanationKo}>
              {result.promise.labelKo} {Math.round(result.fulfillment * 100)}%
            </span>
          ))}
          {!report.promiseAudit.promises.length && <span>이 컨셉에서 감지된 약속이 없습니다.</span>}
        </div>

        {regressions.length > 0 && (
          <div className="promise-audit-regressions">
            🔻 회귀 {regressions.length}건
            <ul>
              {regressions.map(({ item: it }) => (
                <li key={it.id}>{it.labelKo} — {it.targetKo} 기준, 지금 {it.actualKo}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="promise-audit-counts">
          <span>⚠ 미달 {belowTarget.length}건</span>
          <span>✅ 통과 {passed.length}건</span>
          <span>⬜ 미측정 {notMeasured.length}건</span>
        </div>

        <div className="promise-audit-actions">
          <button type="button" onClick={() => setExpanded(value => !value)}>
            {expanded ? '접기' : '[상세 보기]'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('지금 상태를 새 기준선으로 저장합니다. 회귀를 의도적으로 수용할 때만 사용하십시오. 계속하시겠습니까?')) return;
              saveBaseline(channelId, report);
              setBaseline(loadBaseline(channelId));
            }}
          >
            [기준선 갱신]
          </button>
        </div>
        {baseline && <div className="promise-audit-baseline-note">기준선: {new Date(baseline.savedAt).toLocaleString()}</div>}
        {!baseline && <div className="promise-audit-baseline-note">기준선 없음 — 회귀 비교 없이 통과/미달만 표시됩니다.</div>}
      </div>

      {expanded && (
        <table className="promise-audit-table">
          <thead>
            <tr>
              <th>분류</th><th>항목</th><th>기준</th><th>실측</th><th>상태</th>
            </tr>
          </thead>
          <tbody>
            {classified.map(({ item: it, classification }) => (
              <tr key={it.id} className={`promise-audit-row-${classification}`}>
                <td>{it.category}</td>
                <td>{it.labelKo}</td>
                <td>{it.targetKo}</td>
                <td>{it.actualKo}</td>
                <td>
                  {classification === 'pass' && '✅'}
                  {classification === 'regression' && '🔻 회귀'}
                  {classification === 'below-target' && '⚠ 미달'}
                  {classification === 'new' && '⚠ 신규'}
                  {classification === 'not-measured' && (it.notImplemented ? '⬜ 미구현' : '⬜ 미측정')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
