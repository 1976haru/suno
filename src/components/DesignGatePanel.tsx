import { AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import type { DesignGateResult, DesignIssue } from '../core/designGate';
import type { GenerationOptions } from '../types';

/**
 * v3.78 (TASK A, §2-4) — the "관문 1" panel shown both on Step2Plan (설계 확인)
 * and Step3Generate (브릿지 지시문 복사 직전). Same component in both places so
 * the visual language of "이 설정으로는 컨셉대로 나오지 않습니다" is consistent
 * end to end. Per this task's own §2-4: passing state shows only "설계 검증
 * 통과 ✅"; a failing state lists every blocking issue with its own fix hint
 * and, when available, an [자동 수정] button; [무시하고 진행] always stays
 * available — this app must never fully block 하루's own judgment (§8
 * "[무시하고 진행]을 없애지 말 것").
 *
 * v4.4 (TASK E) — was a real 2-click flow disguised as 1 click: the
 * "무시하고 진행" button only ever expanded a menu, and a checkbox INSIDE
 * that menu was the actual acknowledgment. Real feedback: 하루 clicked the
 * button once, saw nothing visibly change (no menu was obviously new
 * content in the flow), and concluded progress was blocked. Collapsed to a
 * real 1-click: the warning text is now always visible (not hidden behind
 * the button), and the button itself directly sets acknowledged=true —
 * with a [취소] to undo, since a single click should still be reversible.
 */

interface DesignGatePanelProps {
  result: DesignGateResult;
  onAutoFix: (fix: Partial<GenerationOptions>) => void;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  /** Step3's copy button reads this instead of re-deriving passed||acknowledged itself. */
  title?: string;
}

function IssueRow({ issue, onAutoFix }: { issue: DesignIssue; onAutoFix: (fix: Partial<GenerationOptions>) => void }) {
  return (
    <div className="design-gate-issue">
      <div>
        <b>{issue.labelKo}</b>
        <span className="supporting"> {issue.expected} · 현재 {issue.actual}</span>
      </div>
      <p className="supporting">{issue.fixHintKo}</p>
      {issue.autoFix && (
        <button type="button" className="chip" onClick={() => onAutoFix(issue.autoFix!())}>
          <Wand2 size={13} />
          자동 수정
        </button>
      )}
    </div>
  );
}

export default function DesignGatePanel({ result, onAutoFix, acknowledged, onAcknowledgedChange, title = '설계 검증' }: DesignGatePanelProps) {
  if (result.passed) {
    return (
      <div className="provider-summary design-gate-panel passed">
        <CheckCircle2 size={16} />
        <b>{title} 통과 ✅</b>
        {result.advisory.length > 0 && (
          <ul className="import-reason-list">
            {result.advisory.map(issue => (
              <li key={issue.id}>⚠ {issue.labelKo}: {issue.actual} ({issue.expected})</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="error design-gate-panel failed">
      <div className="section-head">
        <b><AlertTriangle size={16} /> 이 설정으로는 컨셉대로 나오지 않습니다</b>
      </div>
      <div className="design-gate-issue-list">
        {result.blocking.map(issue => <IssueRow key={issue.id} issue={issue} onAutoFix={onAutoFix} />)}
      </div>
      {result.advisory.length > 0 && (
        <ul className="import-reason-list">
          {result.advisory.map(issue => (
            <li key={issue.id}>⚠ {issue.labelKo}: {issue.actual} ({issue.expected})</li>
          ))}
        </ul>
      )}
      <div className="design-gate-ignore">
        {acknowledged ? (
          <div className="button-row">
            <span className="supporting">✅ 확인함 — 이대로 진행합니다</span>
            <button type="button" className="chip" onClick={() => onAcknowledgedChange(false)}>
              취소
            </button>
          </div>
        ) : (
          <>
            <p className="supporting">
              ⚠ {result.blocking.length}개 항목이 컨셉을 지키지 못할 수 있습니다.
            </p>
            <button type="button" className="chip" onClick={() => onAcknowledgedChange(true)}>
              그래도 이대로 진행하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
