import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Compass, Sparkles } from 'lucide-react';
import type { PlaylistBlueprint, WorkspaceId } from '../types';
import { getGenreById } from '../data/genreLibrary';
import { getRatings } from '../core/ratingLedger';
import {
  approveCombo,
  effectiveVerifiedCombosWithTriedVariations,
  resolveFlagshipCombo,
  suggestCombosFromRatings,
  verifiedComboFromSuggestion,
  type ComboSuggestion
} from '../core/verifiedCombos';
import type { VerifiedCombo } from '../data/verifiedCombos';
import { resolveFlagshipVariationPlan } from '../core/comboVariations';
import { recordComboVariationOutcome } from '../core/comboVariationLedger';

interface VerifiedComboPanelProps {
  workspaceId: WorkspaceId;
  /** This pack's own resolved genre candidate pool (see Step2Plan.tsx's gateGenreIds) — a combo only counts as "applied" when its genre is actually available here. */
  availableGenreIds: string[];
  /**
   * v5.23 (TASK D gap 3) — when supplied (Step4Result.tsx's own mount,
   * after real songs exist), enables the "이 변주가 어땠나요" rating row:
   * resolves the same FlagshipVariationPlan the bridge instruction and the
   * deterministic generators already used (comboVariations.ts's
   * resolveFlagshipVariationPlan — one shared source of truth for WHICH
   * track is the variation track), and lets 하루님 record a real verdict
   * via core/comboVariationLedger.ts. Omitted at Step2Plan.tsx's own
   * pre-generation mount, where no real songs exist yet to rate.
   */
  blueprint?: PlaylistBlueprint;
}

/**
 * v3.82 (TASK A, 1-3/1-4) — "검증된 조합 1개가 대표곡에 배정됐습니다" +
 * the propose-never-auto-register suggestion flow. Self-contained: fetches
 * its own approved-combo/rating data rather than threading more props
 * through Step2Plan.tsx, mirroring that screen's own existing
 * getRatings-in-a-useEffect pattern.
 */
export default function VerifiedComboPanel({ workspaceId, availableGenreIds, blueprint }: VerifiedComboPanelProps) {
  const [effectiveCombos, setEffectiveCombos] = useState<VerifiedCombo[]>([]);
  const [suggestions, setSuggestions] = useState<ComboSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [variationRated, setVariationRated] = useState<{ verdict: 'good' | 'mixed' | 'bad' } | null>(null);

  function reload() {
    let cancelled = false;
    // v5.23 (TASK D gap 3) — was getApprovedCombos + effectiveVerifiedCombos;
    // now also folds core/comboVariationLedger.ts's own recorded outcomes in,
    // so a variation already tried and rated in an earlier set is reflected
    // here too (both in the suggestion pool below and in the rating row's
    // own "already tried" state).
    effectiveVerifiedCombosWithTriedVariations(workspaceId)
      .then(async effective => {
        if (cancelled) return;
        setEffectiveCombos(effective);
        try {
          const ratings = await getRatings();
          if (cancelled) return;
          setSuggestions(suggestCombosFromRatings(ratings, workspaceId, effective));
        } catch {
          if (!cancelled) setSuggestions([]);
        }
      })
      .catch(() => { if (!cancelled) { setEffectiveCombos([]); setSuggestions([]); } });
    return () => { cancelled = true; };
  }

   
  useEffect(reload, [workspaceId]);
  useEffect(() => setVariationRated(null), [blueprint]);

  const appliedCombo = useMemo(() => resolveFlagshipCombo(effectiveCombos, availableGenreIds), [effectiveCombos, availableGenreIds]);
  const variationPlan = useMemo(
    () => (blueprint ? resolveFlagshipVariationPlan(blueprint.songs, appliedCombo) : undefined),
    [blueprint, appliedCombo]
  );
  const visibleSuggestions = suggestions.filter(s => !dismissed.has(`${s.genreId}|${s.bpmRange[0]}`));

  async function handleRateVariation(verdict: 'good' | 'mixed' | 'bad') {
    if (!variationPlan || !appliedCombo || !blueprint) return;
    setBusyKey('variation');
    try {
      await recordComboVariationOutcome({
        comboId: appliedCombo.id,
        variation: variationPlan.variation,
        verdict,
        setCode: blueprint.meta?.setCode || blueprint.projectTitle,
        trackNo: variationPlan.trackNo
      });
      setVariationRated({ verdict });
      reload();
    } catch {
      // best-effort — the buttons stay clickable for a retry
    } finally {
      setBusyKey(null);
    }
  }

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
      {variationPlan && (
        <div className="verified-combo-variation">
          <p className="supporting">
            <Compass size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            T{variationPlan.trackNo}는 이 조합의 변주입니다 — {variationPlan.variation}. 결과가 어땠나요?
          </p>
          {variationRated ? (
            <p className="supporting">기록됨: {variationRated.verdict === 'good' ? '좋음' : variationRated.verdict === 'mixed' ? '보통' : '별로'}</p>
          ) : (
            <div className="button-row">
              <button type="button" className="chip" disabled={busyKey === 'variation'} onClick={() => void handleRateVariation('good')}>좋음</button>
              <button type="button" className="chip" disabled={busyKey === 'variation'} onClick={() => void handleRateVariation('mixed')}>보통</button>
              <button type="button" className="chip" disabled={busyKey === 'variation'} onClick={() => void handleRateVariation('bad')}>별로</button>
            </div>
          )}
        </div>
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
