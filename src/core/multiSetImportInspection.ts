import type { BilingualPair, GenerationOptions, PreassignedSongSlot, SongIdea } from '../types';
import type { ImportSongsReport } from './bridgeImport';
import { inspectImportReport, type ImportInspection } from './importInspection';

/**
 * v5.17 (TASK B) — real, verified gap this module fixes: the multi-set
 * bridge import path (App.tsx's onImportMultiSetSongsJson) ran every set
 * through importSongsJson (so validateProviderTrackSet's hard structural
 * check DID already apply per set — see core/importValidation.ts), but never
 * ran core/importInspection.ts's inspectImportReport at all. It saved
 * (library.saveGeneratedSet) and folded hooks into the next set's avoid-list
 * for EVERY set that produced a non-null blueprint, with zero regard for
 * whether that set was actually short of what was requested, had an
 * artist-name leak, or would have been classified 'repairable' on the
 * single-file import path (onImportSongsJson) — exactly the "auto-save the
 * instant a blueprint exists" bug this module's own sibling
 * (core/importInspection.ts's own header doc comment) already closed for
 * the single-set path, still wide open here.
 *
 * This module is the pure decision layer App.tsx's onImportMultiSetSongsJson
 * now calls BEFORE persisting anything: every set's ImportStatus is computed
 * first (reusing inspectImportReport directly — no re-implementation), then:
 *   - any set 'blocked' -> the WHOLE batch persists nothing (`wholeBatchBlocked`),
 *     mirroring the single-set path's own "a structurally broken response
 *     can never be trusted" rule, just applied at the batch level per this
 *     task's own spec (§2-3 "한 세트라도 blocked 면 전체 저장 금지").
 *   - otherwise, a 'valid' set is ready to persist immediately (`readyToPersist`)
 *     — same "zero extra clicks for the common case" behavior the single-set
 *     path already has.
 *   - a 'repairable' set is held back on its OWN (`pendingConfirmation`) —
 *     spec §2-3's own "repairable 이 있으면 그 세트만 보류": other sets in the
 *     same batch are not punished for one set needing review.
 * Hook registration is bundled with persistence per set (App.tsx's real save
 * call registers both together, same as the single-set path already does),
 * so "훅 등록은 모든 세트가 valid 일 때만" (spec §2-3) holds per set: a set's
 * hooks are only ever registered once THAT set is confirmed valid — a
 * 'repairable' set's hooks are never registered until its own explicit
 * "[N곡만 확정]"-style confirmation, and a 'blocked' anywhere never registers
 * ANY set's hooks at all (wholeBatchBlocked empties both persist buckets).
 */

export interface MultiSetImportSetInput {
  /** 1-based set number (Step3Generate's own "세트별 지시문" numbering — matches App.tsx's existing setIndex). */
  setIndex: number;
  report: ImportSongsReport;
  rawSongs: unknown[];
  importOpts: GenerationOptions;
  languageContext?: { archetype?: string; bilingualPair?: BilingualPair };
  /** This set's own resolved slot plan (App.tsx's preallocateSongSlots call for this file) — carried through unchanged so a later persist step (App.tsx's saveGeneratedSet + withGenerationSnapshot) never has to re-derive it. */
  preassignedSongs?: PreassignedSongSlot[];
}

export interface MultiSetImportSetResult {
  setIndex: number;
  report: ImportSongsReport;
  inspection: ImportInspection;
  importOpts: GenerationOptions;
  rawSongs: unknown[];
  preassignedSongs?: PreassignedSongSlot[];
}

export type CrossSetDuplicateKind = 'hook' | 'title' | 'genreDistribution' | 'situation';

export interface CrossSetDuplicateWarning {
  kind: CrossSetDuplicateKind;
  /** The shared hook/title text, or (for 'genreDistribution') a stable signature string — never shown to the user directly, only the setIndexes/labelKo are. */
  value: string;
  setIndexes: number[];
  labelKo: string;
}

export interface MultiSetImportPlan {
  results: MultiSetImportSetResult[];
  /** true when ANY set's status is 'blocked' — nothing in the batch may be persisted (spec §2-3). */
  wholeBatchBlocked: boolean;
  /** 'valid' sets, safe to persist (save + register hooks) immediately — empty whenever wholeBatchBlocked. */
  readyToPersist: MultiSetImportSetResult[];
  /** 'repairable' sets, held back for individual "[N곡만 확정]"-style confirmation — empty whenever wholeBatchBlocked. */
  pendingConfirmation: MultiSetImportSetResult[];
  crossSetDuplicates: CrossSetDuplicateWarning[];
}

/**
 * Reuses inspectImportReport directly (per set) — the single-set path's own
 * classifier, never a parallel reimplementation — then applies this task's
 * own batch-level persistence rules on top.
 */
export function planMultiSetImport(
  inputs: MultiSetImportSetInput[],
  sessionExemptions?: Set<string>,
  /**
   * v5.22 (AXIS 1) — ONE snapshot fetched before this whole batch starts,
   * reused identically for every set's own inspectImportReport call — a
   * multi-set run's later sets are NOT checked against scenes/lines the
   * earlier sets in this SAME run just produced (that within-batch case is
   * detectCrossSetDuplicates' own job below, via its 'situation' kind), only
   * against real cross-pack history that already existed before this run.
   */
  duplicationHistory?: { recentSituations: string[]; recentLyricLines: string[]; historicalTitles: Set<string> }
): MultiSetImportPlan {
  const results: MultiSetImportSetResult[] = inputs.map(input => ({
    setIndex: input.setIndex,
    report: input.report,
    importOpts: input.importOpts,
    rawSongs: input.rawSongs,
    preassignedSongs: input.preassignedSongs,
    inspection: inspectImportReport(input.report, input.rawSongs, input.importOpts.lyricLanguage, input.languageContext, sessionExemptions, duplicationHistory)
  }));

  const wholeBatchBlocked = results.some(result => result.inspection.status === 'blocked');
  const readyToPersist = wholeBatchBlocked ? [] : results.filter(result => result.inspection.status === 'valid');
  const pendingConfirmation = wholeBatchBlocked ? [] : results.filter(result => result.inspection.status === 'repairable');

  const crossSetDuplicates = detectCrossSetDuplicates(
    results.filter(result => result.report.blueprint).map(result => ({ setIndex: result.setIndex, songs: result.report.blueprint!.songs }))
  );

  return { results, wholeBatchBlocked, readyToPersist, pendingConfirmation, crossSetDuplicates };
}

function genreDistributionSignature(songs: Pick<SongIdea, 'genreId'>[]): string {
  const counts = new Map<string, number>();
  for (const song of songs) {
    if (!song.genreId) continue;
    counts.set(song.genreId, (counts.get(song.genreId) ?? 0) + 1);
  }
  if (!counts.size) return '';
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`)
    .join(',');
}

/**
 * v5.17 (TASK B §2-4) — problems only a MULTI-set import can have: the same
 * hook or title reused across two sets (each set's own single-file import
 * only ever avoids hooks/titles from PREVIOUS sets/packs, via the
 * usedHooks/usedTitles avoid-list App.tsx already threads through
 * onImportMultiSetSongsJson — but that avoid-list is advisory, not
 * enforced, so a provider ignoring it still slips through), or two sets
 * whose genre distribution is identical (a sign the "diversify across sets"
 * instruction was ignored entirely for one of them). Purely informational —
 * never contributes to ImportStatus/wholeBatchBlocked, only surfaced as
 * extra warnings for a human to review.
 */
export function detectCrossSetDuplicates(sets: { setIndex: number; songs: SongIdea[] }[]): CrossSetDuplicateWarning[] {
  const warnings: CrossSetDuplicateWarning[] = [];
  const hookOwners = new Map<string, Set<number>>();
  const titleOwners = new Map<string, Set<number>>();
  const genreSignatureOwners = new Map<string, Set<number>>();
  // v5.22 (AXIS 1) — the WITHIN-THIS-BATCH counterpart to
  // core/duplicationGate.ts's checkSceneOverlap (which only ever checks
  // against real cross-pack ledger history fetched BEFORE the batch
  // started — see planMultiSetImport's own doc comment on why later sets
  // in the same run aren't checked against earlier sets' just-generated
  // scenes there). Two sets in the SAME multi-set run sharing a scene is
  // exactly the kind of duplication a per-set ledger snapshot can't catch.
  const situationOwners = new Map<string, Set<number>>();

  for (const set of sets) {
    for (const song of set.songs) {
      const hookKey = song.hookPhrase?.trim().toLowerCase();
      if (hookKey) {
        const owners = hookOwners.get(hookKey) ?? new Set<number>();
        owners.add(set.setIndex);
        hookOwners.set(hookKey, owners);
      }
      const titleKey = song.title?.trim().toLowerCase();
      if (titleKey) {
        const owners = titleOwners.get(titleKey) ?? new Set<number>();
        owners.add(set.setIndex);
        titleOwners.set(titleKey, owners);
      }
      const situationKey = song.listenerSituation?.trim().toLowerCase();
      if (situationKey) {
        const owners = situationOwners.get(situationKey) ?? new Set<number>();
        owners.add(set.setIndex);
        situationOwners.set(situationKey, owners);
      }
    }
    const signature = genreDistributionSignature(set.songs);
    if (signature) {
      const owners = genreSignatureOwners.get(signature) ?? new Set<number>();
      owners.add(set.setIndex);
      genreSignatureOwners.set(signature, owners);
    }
  }

  for (const [value, owners] of hookOwners) {
    if (owners.size < 2) continue;
    const setIndexes = Array.from(owners).sort((a, b) => a - b);
    warnings.push({ kind: 'hook', value, setIndexes, labelKo: `세트 ${setIndexes.join(', ')}에 같은 훅이 반복됨: "${value}"` });
  }
  for (const [value, owners] of titleOwners) {
    if (owners.size < 2) continue;
    const setIndexes = Array.from(owners).sort((a, b) => a - b);
    warnings.push({ kind: 'title', value, setIndexes, labelKo: `세트 ${setIndexes.join(', ')}에 같은 제목이 반복됨: "${value}"` });
  }
  for (const [value, owners] of situationOwners) {
    if (owners.size < 2) continue;
    const setIndexes = Array.from(owners).sort((a, b) => a - b);
    warnings.push({ kind: 'situation', value, setIndexes, labelKo: `세트 ${setIndexes.join(', ')}에 같은 장면이 반복됨: "${value}"` });
  }
  for (const [value, owners] of genreSignatureOwners) {
    if (owners.size < 2) continue;
    const setIndexes = Array.from(owners).sort((a, b) => a - b);
    warnings.push({ kind: 'genreDistribution', value, setIndexes, labelKo: `세트 ${setIndexes.join(', ')}의 장르 분포가 동일함 — 세트 간 다양화가 적용되지 않았을 수 있습니다.` });
  }

  return warnings;
}

/** Small shared summary formatter — App.tsx's own multi-set import failure/warning surface reuses this instead of re-deriving the same "N개 세트 중 M개..." phrasing per call site. */
export function describeMultiSetImportPlan(plan: MultiSetImportPlan): string {
  if (plan.wholeBatchBlocked) {
    const blockedSets = plan.results.filter(r => r.inspection.status === 'blocked').map(r => r.setIndex);
    return `세트 ${blockedSets.join(', ')}이(가) 구조적으로 손상되어 전체 배치를 저장하지 않았습니다.`;
  }
  const parts: string[] = [];
  if (plan.readyToPersist.length) parts.push(`${plan.readyToPersist.length}개 세트 저장 완료`);
  if (plan.pendingConfirmation.length) parts.push(`${plan.pendingConfirmation.length}개 세트는 검토가 필요합니다`);
  if (plan.crossSetDuplicates.length) parts.push(`세트 간 중복 ${plan.crossSetDuplicates.length}건 발견`);
  return parts.join(' / ');
}
