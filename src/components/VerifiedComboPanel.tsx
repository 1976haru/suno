import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import type { WorkspaceId } from '../types';
import { getGenreById } from '../data/genreLibrary';
import { getRatings } from '../core/ratingLedger';
import {
  approveCombo,
  effectiveVerifiedCombos,
  getApprovedCombos,
  resolveFlagshipCombo,
  suggestCombosFromRatings,
  verifiedComboFromSuggestion,
  type ComboSuggestion
} from '../core/verifiedCombos';

interface VerifiedComboPanelProps {
  workspaceId: WorkspaceId;
  /** This pack's own resolved genre candidate pool (see Step2Plan.tsx's gateGenreIds) — a combo only counts as "applied" when its genre is actually available here. */
  availableGenreIds: string[];
}

/**
 * v3.82 (TASK A, 1-3/1-4) — "검증된 조합 1개가 대표곡에 배정됐습니다" +
 * the propose-never-auto-register suggestion flow. Self-contained: fetches
 * its own approved-combo/rating data rather than threading more props
 * through Step2Plan.tsx, mirroring that screen's own existing
 * getRatings-in-a-useEffect pattern.
 */
export default function VerifiedComboPanel({ workspaceId, availableGenreIds }: VerifiedComboPanelProps) {
  const [approved, setApproved] = useState<Awaited<ReturnType<typeof getApprovedCombos>>>([]);
  const [suggestions, setSuggestions] = useState<ComboSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function reload() {
    let cancelled = false;
    getApprovedCombos(workspaceId)
      .then(async list => {
        if (cancelled) return;
        setApproved(list);
        const effective = effectiveVerifiedCombos(workspaceId, list);
        try {
          const ratings = await getRatings();
          if (cancelled) return;
          setSuggestions(suggestCombosFromRatings(ratings, workspaceId, effective));
        } catch {
          if (!cancelled) setSuggestions([]);
        }
      })
      .catch(() => { if (!cancelled) { setApproved([]); setSuggestions([]); } });
    return () => { cancelled = true; };
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [workspaceId]);

  const effectiveCombos = useMemo(() => effectiveVerifiedCombos(workspaceId, approved), [workspaceId, approved]);
  const appliedCombo = useMemo(() => resolveFlagshipCombo(effectiveCombos, availableGenreIds), [effectiveCombos, availableGenreIds]);
  const visibleSuggestions = suggestions.filter(s => !dismissed.has(`${s.genreId}|${s.bpmRange[0]}`));

  async function handleApprove(suggestion: ComboSuggestion) {
    const key = `${suggestion.genreId}|${suggestion.bpmRange[0]}`;
    setBusyKey(key);
    try {
      await approveCombo(verifiedComboFromSuggestion(suggestion, workspaceId));
      setDismissed(prev => new Set(prev).add(key));
      reload();
    } catch {
      // best-effort — leave the suggestion visible so the user can retry
    } finally {
      setBusyKey(null);
    }
  }

  function handleDismiss(suggestion: ComboSuggestion) {
    setDismissed(prev => new Set(prev).add(`${suggestion.genreId}|${suggestion.bpmRange[0]}`));
  }

  if (!appliedCombo && !visibleSuggestions.length) return null;

  return (
    <div className="option-block compact verified-combo-panel">
      {appliedCombo && (
        <p className="supporting">
          <CheckCircle2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          검증된 조합 1개가 대표곡(2번)에 배정됐습니다 — {getGenreById(appliedCombo.genreId)?.label ?? appliedCombo.genreId} · {appliedCombo.bpmRange[0]}-{appliedCombo.bpmRange[1]} BPM
          {appliedCombo.vocalType ? ` · ${appliedCombo.vocalType}` : ' · 보컬 성별 무관'} (표본 {appliedCombo.sampleSize}곡)
        </p>
      )}
      {visibleSuggestions.map(suggestion => {
        const key = `${suggestion.genreId}|${suggestion.bpmRange[0]}`;
        return (
          <div key={key} className="verified-combo-suggestion">
            <p className="supporting">
              <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {getGenreById(suggestion.genreId)?.label ?? suggestion.genreId} · {suggestion.bpmRange[0]}-{suggestion.bpmRange[1]} BPM — {suggestion.reasonKo}
            </p>
            <div className="button-row">
              <button type="button" className="chip" disabled={busyKey === key} onClick={() => void handleApprove(suggestion)}>
                {suggestion.suggestedVerdict === 'good' ? '검증된 조합으로 승인' : '피할 조합으로 승인'}
              </button>
              <button type="button" className="chip" disabled={busyKey === key} onClick={() => handleDismiss(suggestion)}>
                기각
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
