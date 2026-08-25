import type { GenerationOptions } from '../types';
import { moneyChordPresets } from '../data/moneyChords';

/**
 * TASK v5.8 (TASK B) — "선택 vs 실제 적용" comparison for the money-chord
 * section, plus a mismatch warning that fires only on a REAL detected
 * mismatch. Deliberately a pure function (no React, no gateSlots
 * recomputation) so it's testable without a DOM — the caller (Step2Plan.tsx
 * via ConceptRecommendationPanel.tsx) hands in the SAME `moneyChordBreakdown`
 * tally it already derives from gateSlots (the real per-song resolved
 * progression ids); this module never recomputes or duplicates that.
 *
 * Investigation (v5.8, real generation via a scratch probe script mirroring
 * scripts/v57FollowupMeasure.ts's own directSetLocal -> generateLocalBlueprint
 * pattern) found core/moneyChordPlan.ts's usesUserChosenProgressionPlan is
 * already archetype-independent (v5.7) — an explicit non-default/non-custom
 * pick gets its 50-60%-share plan on EVERY channel archetype, including ones
 * outside usesMoneyChordQuota's own 7-archetype allowlist. Preview
 * (batchPreallocation.ts's preallocateSongSlots, what Step2Plan.tsx's
 * gateSlots reads) and real generation (localGenerator.ts's
 * generateLocalBlueprint) matched exactly in every scenario probed. No live
 * reproducible mismatch was found for the non-default/non-custom explicit
 * case; the warning below is implemented generically (chosen id resolves to
 * 0 songs in the real distribution) so a future regression that reintroduces
 * one still gets caught, matching this task's own root-cause shape (a chosen
 * preset silently landing at 0/18).
 *
 * Two adjacent, genuinely-confirmed display gaps (not resolution bugs — the
 * correct progression IS applied 100% of the time in both) are also handled
 * here rather than left to look like "nothing happened":
 *  - explicit moneyChordMode 'default' on a channel archetype outside
 *    usesMoneyChordQuota's allowlist, and
 *  - explicit moneyChordMode 'custom'
 * both resolve to a single progression applied uniformly across every song
 * via core/soundSignature.ts's compactMoneyChord (never tagging a per-track
 * moneyChordId), so `moneyChordBreakdown` is always empty for them — without
 * this module, the "머니코드 배분" block would previously just disappear
 * (ConceptRecommendationPanel.tsx's own `moneyChordBreakdown.length > 0`
 * guard) instead of confirming the 100% application.
 */

export interface MoneyChordBreakdownEntry {
  id: string;
  count: number;
}

export interface MoneyChordComparison {
  /** e.g. "겨울 발라드", "자동 배분", 커스텀 진행 텍스트를 포함한 라벨 등 — no "선택:" prefix, caller decides layout. */
  chosenLabelKo: string;
  /** e.g. "겨울 발라드 10곡 (나머지는 감성·캐논 등)", "3종 회전 (...)" — no "실제 적용:" prefix, caller decides layout. */
  appliedSummaryKo: string;
  /** null when no mismatch was detected; a ready-to-render Korean warning line otherwise. */
  mismatchWarningKo: string | null;
}

type ComparisonOpts = Pick<GenerationOptions, 'moneyChordMode' | 'moneyChordModeIsExplicitChoice' | 'customMoneyChord'>;

function labelFor(id: string): string {
  return moneyChordPresets[id]?.labelKo ?? id;
}

function rotationSummaryKo(breakdown: MoneyChordBreakdownEntry[]): string {
  const detail = breakdown.map(entry => `${labelFor(entry.id)} ${entry.count}곡`).join(' · ');
  return `${breakdown.length}종 회전 (${detail})`;
}

export function computeMoneyChordComparison(
  opts: ComparisonOpts,
  breakdown: MoneyChordBreakdownEntry[],
  songCount: number
): MoneyChordComparison {
  const isExplicit = Boolean(opts.moneyChordModeIsExplicitChoice);
  const mode = opts.moneyChordMode;

  if (!isExplicit) {
    return {
      chosenLabelKo: '자동 배분',
      appliedSummaryKo: breakdown.length > 0
        ? rotationSummaryKo(breakdown)
        : `전체 ${songCount}곡 동일 진행 (기본, 회전 없음)`,
      mismatchWarningKo: null
    };
  }

  if (mode === 'custom') {
    const text = (opts.customMoneyChord ?? '').trim();
    const chosenLabelKo = text ? `커스텀 진행 "${text}"` : '커스텀 진행 (입력 없음)';
    if (!text) {
      return {
        chosenLabelKo,
        appliedSummaryKo: '기본적인 진행 문구로 대체 적용됨 (아직 코드 진행을 입력하지 않음)',
        mismatchWarningKo: `⚠ "커스텀 진행"을 선택했지만 코드 진행을 아직 입력하지 않아 일반적인 진행으로 대체됩니다 — 원하는 진행을 입력하세요.`
      };
    }
    return {
      chosenLabelKo,
      appliedSummaryKo: `전체 ${songCount}곡 동일 진행 (직접 입력한 텍스트 그대로 적용)`,
      mismatchWarningKo: null
    };
  }

  const preset = moneyChordPresets[mode];
  const chosenLabelKo = preset?.labelKo ?? mode;

  if (mode === 'default') {
    // 'default' has no adjacent-progression identity to blend against — both
    // outcomes below are correct depending on the channel archetype, not a mismatch.
    return {
      chosenLabelKo,
      appliedSummaryKo: breakdown.length > 0
        ? rotationSummaryKo(breakdown)
        : `전체 ${songCount}곡 동일 진행 (${chosenLabelKo})`,
      mismatchWarningKo: null
    };
  }

  // Explicit non-default, non-custom pick: core/moneyChordPlan.ts's
  // usesUserChosenProgressionPlan should have given this id ~50-60% of the
  // pack (buildUserChosenProgressionPlan) regardless of channel archetype.
  const chosenEntry = breakdown.find(entry => entry.id === mode);
  const chosenCount = chosenEntry?.count ?? 0;
  const restKo = breakdown
    .filter(entry => entry.id !== mode)
    .map(entry => labelFor(entry.id))
    .slice(0, 3)
    .join('·');

  if (chosenCount === 0) {
    return {
      chosenLabelKo,
      appliedSummaryKo: '적용되지 않음 (0곡)',
      mismatchWarningKo: `⚠ 선택하신 "${chosenLabelKo}"가 적용되지 않습니다 — 실제로는 다른 진행으로 대체되었습니다. 다시 선택하거나 새로고침 후 재시도하세요.`
    };
  }

  return {
    chosenLabelKo,
    appliedSummaryKo: `${chosenLabelKo} ${chosenCount}곡${restKo ? ` (나머지는 ${restKo} 등)` : ''}`,
    mismatchWarningKo: null
  };
}
