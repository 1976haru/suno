import type { WorkspaceId } from '../types';

/**
 * codex 지시문 03 (TASK I) — real gap confirmed by investigation: no
 * TitleHookRelationship taxonomy exists anywhere. Only two blunt, separate
 * signals exist today — core/quality.ts's titleHookOverlapWarning (a
 * boolean "shares >= 1 word or not", used as this taxonomy's own
 * 'disconnected' definition below, not reimplemented) and
 * core/releaseReadiness.ts's TITLE_EQUALS_HOOK_TARGET (exact string
 * equality only, no near/semantic tiering — this taxonomy's own 'exact'
 * definition matches it). This module is the real 4-way classifier neither
 * existing signal provides.
 *
 * Word-overlap here is deliberately whitespace-based (not traitMatcher.ts's
 * tokenOverlap, whose `[^a-z0-9]+` tokenizer strips every non-ASCII
 * character — it would score any two Korean/Japanese titles 0/0 -> 0
 * regardless of real overlap, the same real limitation already flagged for
 * core/sceneSimilarity.ts this same session). Real titles/hooks in this
 * app are space-delimited in all 3 languages (Korean word-spacing, Suno's
 * own English convention), so a plain whitespace split is the honest
 * language-agnostic signal here.
 */

export type TitleHookRelationship = 'exact' | 'near' | 'semantic' | 'disconnected';

function normalizeWords(text: string): Set<string> {
  return new Set(text.toLowerCase().trim().split(/\s+/).filter(Boolean));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Jaccard word overlap, whitespace-tokenized (see this file's own top doc comment for why, not traitMatcher.ts's ASCII-only tokenOverlap). */
export function wordOverlapRatio(a: string, b: string): number {
  const setA = normalizeWords(a);
  const setB = normalizeWords(b);
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

const NEAR_OVERLAP_THRESHOLD = 0.5;

/**
 * 'exact': case/whitespace-insensitive equality (matches
 * releaseReadiness.ts's own TITLE_EQUALS_HOOK_TARGET definition exactly).
 * 'near': not exact, but one contains the other verbatim, or >= 50% word
 * overlap (Jaccard). 'semantic': shares at least one real word but under
 * the near threshold. 'disconnected': shares no word at all (matches
 * core/quality.ts's own titleHookOverlapWarning trigger condition exactly
 * — this classifier's 'disconnected' and that warning's own "flag" case
 * are the same real signal, not two independently-drifting definitions).
 */
export function classifyTitleHookRelationship(title: string, hookPhrase: string): TitleHookRelationship {
  const normTitle = normalize(title);
  const normHook = normalize(hookPhrase);
  if (!normTitle || !normHook) return 'disconnected';
  if (normTitle === normHook) return 'exact';
  const overlap = wordOverlapRatio(title, hookPhrase);
  if (overlap >= NEAR_OVERLAP_THRESHOLD || normHook.includes(normTitle) || normTitle.includes(normHook)) return 'near';
  if (overlap > 0) return 'semantic';
  return 'disconnected';
}

export interface TitleHookRelationshipPolicy {
  /** Documentation/advisory only — the real, workspace-tuned lean this taxonomy expects, not independently enforced per-category (only the COMMON rules below are actually checked, per this task's own spec: "정책은 워크스페이스별로 다르게 한다" for the lean, but "공통" rules for the hard limits). */
  leanKo: string;
}

export const TITLE_HOOK_RELATIONSHIP_POLICY: Record<WorkspaceId, TitleHookRelationshipPolicy> = {
  'senior-oldpop': { leanKo: 'exact/near 비중 높음' },
  'kr-2030': { leanKo: 'semantic·이미지 제목 허용' },
  'jp-2030': { leanKo: 'semantic·이미지 제목 허용' },
  'kr-kids': { leanKo: 'exact/near 매우 높음' },
  'jp-kids': { leanKo: 'exact/near 매우 높음' },
  'kr-idol-male': { leanKo: 'hook 제목·슬로건 제목·컨셉 제목 혼합' },
  'kr-idol-female': { leanKo: 'hook 제목·슬로건 제목·컨셉 제목 혼합' }
};

// ---------------------------------------------------------------------------
// Common rules
// ---------------------------------------------------------------------------

/** disconnected 최대 2/18곡 — proportionally scaled for other pack sizes, floor 1 for any real pack (never silently 0 for a tiny pack). */
export function maxDisconnectedAllowed(songCount: number): number {
  return Math.max(1, Math.round((2 / 18) * songCount));
}

/** Same word-count-bucket "shape" concept as core/diversityLinter.ts's own private titleShape (not imported — that function is a private, differently-scoped helper for a different check; this is a self-contained equivalent for this task's own "same title shape > 50%" rule). */
export function titleWordCountShape(title: string): 'short' | 'mid' | 'long' {
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  return wordCount <= 2 ? 'short' : wordCount <= 4 ? 'mid' : 'long';
}

/** 동일 접두/접미 패턴 과다 금지 — flags a real shared prefix/suffix word across more than half the pack's titles. */
export function excessSharedAffixWord(titles: string[]): { word: string; count: number } | undefined {
  if (titles.length < 2) return undefined;
  const prefixCounts = new Map<string, number>();
  const suffixCounts = new Map<string, number>();
  for (const title of titles) {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const first = words[0].toLowerCase();
    const last = words[words.length - 1].toLowerCase();
    prefixCounts.set(first, (prefixCounts.get(first) ?? 0) + 1);
    suffixCounts.set(last, (suffixCounts.get(last) ?? 0) + 1);
  }
  const half = titles.length / 2;
  for (const [word, count] of [...prefixCounts, ...suffixCounts]) {
    if (count > half) return { word, count };
  }
  return undefined;
}

export interface TitleHookRelationshipReport {
  relationships: { trackNo: number; relationship: TitleHookRelationship }[];
  disconnectedCount: number;
  disconnectedOverQuota: boolean;
  dominantShape: { shape: string; share: number } | undefined;
  dominantShapeOverQuota: boolean;
  excessAffix: { word: string; count: number } | undefined;
}

/**
 * The one real entry point — pure, no IndexedDB, same convention every
 * other releaseReadiness-consumable check in this codebase already
 * follows.
 */
export function checkTitleHookRelationships(songs: { trackNo: number; title: string; hookPhrase: string }[]): TitleHookRelationshipReport {
  const relationships = songs.map(song => ({ trackNo: song.trackNo, relationship: classifyTitleHookRelationship(song.title, song.hookPhrase) }));
  const disconnectedCount = relationships.filter(r => r.relationship === 'disconnected').length;
  const quota = maxDisconnectedAllowed(songs.length);

  const shapeCounts = new Map<string, number>();
  for (const song of songs) {
    const shape = titleWordCountShape(song.title);
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
  }
  let dominantShape: { shape: string; share: number } | undefined;
  for (const [shape, count] of shapeCounts) {
    const share = songs.length ? count / songs.length : 0;
    if (!dominantShape || share > dominantShape.share) dominantShape = { shape, share };
  }

  return {
    relationships,
    disconnectedCount,
    disconnectedOverQuota: disconnectedCount > quota,
    dominantShape,
    dominantShapeOverQuota: Boolean(dominantShape && dominantShape.share > 0.5),
    excessAffix: excessSharedAffixWord(songs.map(s => s.title))
  };
}
