import { useEffect, useState } from 'react';
import { Compass, Lightbulb } from 'lucide-react';
import type { WorkspaceId } from '../types';
import {
  computeExplorationLearningSuggestions,
  listExplorationHistory,
  recordExplorationOutcomes,
  type ExplorationRating,
  type ExplorationRecord
} from '../core/explorationLedger';
import { AXIS_LABEL_KO, type ExplorationAxis } from '../core/explorationSlots';

interface ExplorationLedgerPanelProps {
  workspaceId: WorkspaceId;
}

const RATING_LABEL_KO: Record<ExplorationRating, string> = { good: '좋음', ok: '보통', bad: '별로' };
const RATING_ORDER: ExplorationRating[] = ['good', 'ok', 'bad'];

/**
 * v5.23 (TASK E §5-2) — "무엇을 시도했고 결과가 어땠는지 한눈에 보이는 화면":
 * reads core/explorationLedger.ts's own history (recorded by
 * Step3Generate.tsx's handleImportSongsFile right after a bridge import —
 * see that function's own doc comment) and lets the user rate each
 * exploration attempt (👍/🤷/👎), then shows computeExplorationLearningSuggestions'
 * own read-only suggestions. Deliberately does NOT offer an "승인" button
 * on a suggestion the way VerifiedComboPanel's genre/BPM suggestions do —
 * a free-text exploration description (e.g. "후렴을 한 번만 부른다") has no
 * genreId/bpmRange to fill a VerifiedCombo with, so "제안하고 자동 등록하지
 * 않는다" here just means "show it clearly and let 하루님 act on it herself",
 * not a mis-shaped auto-fill button.
 */
export default function ExplorationLedgerPanel({ workspaceId }: ExplorationLedgerPanelProps) {
  const [records, setRecords] = useState<ExplorationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function reload() {
    let cancelled = false;
    listExplorationHistory(workspaceId)
      .then(list => { if (!cancelled) { setRecords(list); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setRecords([]); setLoaded(true); } });
    return () => { cancelled = true; };
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [workspaceId]);

  async function handleRate(record: ExplorationRecord, trackNo: number, rating: ExplorationRating) {
    const key = `${record.setCode}|${trackNo}`;
    setBusyKey(key);
    try {
      const nextOutcomes = [
        ...(record.outcomes ?? []).filter(outcome => outcome.trackNo !== trackNo),
        { trackNo, rating }
      ];
      await recordExplorationOutcomes(record.setCode, nextOutcomes);
      reload();
    } catch {
      // best-effort — the button just stays clickable for a retry
    } finally {
      setBusyKey(null);
    }
  }

  if (!loaded) return null;

  const suggestions = computeExplorationLearningSuggestions(records);

  return (
    <div className="option-block compact exploration-ledger-panel">
      <div className="section-head">
        <Compass size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        <h3>탐색 원장 — 지금까지 무엇을 시도했나</h3>
      </div>

      {!records.length && (
        <p className="supporting">
          아직 기록된 탐색 슬롯이 없습니다. senior-oldpop 세트를 브릿지로 가져오면 이 세트의 탐색 트랙(distinctChoice)이 여기 자동으로 기록됩니다.
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="exploration-ledger-suggestions">
          {suggestions.map(suggestion => (
            <p key={`${suggestion.kind}|${suggestion.description}`} className="supporting">
              <Lightbulb size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {suggestion.kind === 'promote'
                ? `"${suggestion.description}" — ${suggestion.matchingCount}번 좋음으로 평가됐습니다 (${suggestion.setCodes.join(', ')}). 검증된 조합으로 등록을 검토해 보세요.`
                : `"${suggestion.description}" — ${suggestion.matchingCount}번 별로로 평가됐습니다 (${suggestion.setCodes.join(', ')}). 다음 세트에서는 피하는 것을 검토해 보세요.`}
            </p>
          ))}
        </div>
      )}

      {records.map(record => (
        <div key={record.id} className="exploration-ledger-record">
          <p className="supporting">
            <strong>{record.packLabel || record.setCode}</strong> · 탐색 축: {AXIS_LABEL_KO[record.axis as ExplorationAxis] ?? record.axis}
          </p>
          <ul className="exploration-ledger-attempts">
            {record.attempts.map(attempt => {
              const outcome = record.outcomes?.find(o => o.trackNo === attempt.trackNo);
              const key = `${record.setCode}|${attempt.trackNo}`;
              return (
                <li key={key}>
                  <span>T{attempt.trackNo} — {attempt.description}</span>
                  {outcome ? (
                    <span className="chip active">{RATING_LABEL_KO[outcome.rating]}</span>
                  ) : (
                    <span className="button-row">
                      {RATING_ORDER.map(rating => (
                        <button
                          key={rating}
                          type="button"
                          className="chip"
                          disabled={busyKey === key}
                          onClick={() => void handleRate(record, attempt.trackNo, rating)}
                        >
                          {RATING_LABEL_KO[rating]}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
