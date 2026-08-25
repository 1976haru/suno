import type { IssueScope, ScopedIssue, SongIdea } from '../types';
import type { WorkspaceQualityPolicy } from '../data/workspaceQualityPolicies';
import { shouldContinueRewriteLoop, rewriteLoopHasStagnated } from './rewriteLoop';

/**
 * codex 지시문 05 (TASK D) — the structured per-track rewrite instruction
 * object the spec's own §5 asks for (trackNo/원문/문제 유형/변경 필드/유지
 * 필드/바꾸면 안 되는 다른 트랙/workspace policy), layered ALONGSIDE (never
 * replacing) core/rewriteLoop.ts's existing `buildRewriteInstruction` flat
 * Korean prose string — that string is still the real thing a caller sends
 * to an LLM/bridge prompt; this structured object is what a caller (or a
 * test) can inspect/validate programmatically without re-parsing prose.
 */

export type RewriteScope = 'track-rewrite' | 'set-rebalance' | 'design-regenerate' | 'blocked-manual';

/**
 * Real mapping from types.ts's own 5-value IssueScope (already used by
 * core/rewriteLoop.ts's classifyReleaseReadinessFailures) onto this task's
 * own literal 4-way vocabulary — 'pair' folds into 'track-rewrite' (a
 * pair-scoped issue still only touches specific named tracks, same as
 * 'track'), 'full' folds into 'design-regenerate' (both mean "no per-item
 * fix, someone has to redo real design work"), 'blocked-manual' is never
 * produced by this mapping alone — see resolveRewriteScope below for when
 * it applies (round budget exhausted, not a property of any one issue).
 */
function scopeFromIssueScope(scope: IssueScope): RewriteScope {
  if (scope === 'track' || scope === 'pair') return 'track-rewrite';
  if (scope === 'rebalance') return 'set-rebalance';
  return 'design-regenerate';
}

/**
 * The real, overall scope for a rewrite round: the most severe scope among
 * all outstanding issues (design-regenerate > set-rebalance > track-rewrite,
 * since a round that includes even one design-level issue can't be resolved
 * by track-level fixes alone), UNLESS either real STOP condition fires —
 * spec's own §5 scope option "blocked/manual": the automatic round budget
 * (core/rewriteLoop.ts's own shouldContinueRewriteLoop, max 2) is already
 * exhausted, OR this round's own failing-item signature is IDENTICAL to the
 * previous round's (core/rewriteLoop.ts's own rewriteLoopHasStagnated — the
 * real "same failed signature repeated endlessly" stop condition, checked
 * even when the round budget technically allows one more try).
 */
export function resolveRewriteScope(
  issues: readonly ScopedIssue[],
  roundsAlreadyRun: number,
  previousFailingIds?: readonly { id: string }[]
): RewriteScope {
  if (!shouldContinueRewriteLoop(roundsAlreadyRun)) return 'blocked-manual';
  if (previousFailingIds && rewriteLoopHasStagnated(previousFailingIds, issues)) return 'blocked-manual';
  if (!issues.length) return 'track-rewrite';
  const scopes = new Set(issues.map(issue => scopeFromIssueScope(issue.scope)));
  if (scopes.has('design-regenerate')) return 'design-regenerate';
  if (scopes.has('set-rebalance')) return 'set-rebalance';
  return 'track-rewrite';
}

export interface StructuredRewriteInstruction {
  trackNo: number;
  originalText: { title: string; lyrics: string; stylePrompt: string; hookPhrase: string };
  problemTypes: string[];
  fieldsToChange: string[];
  fieldsToPreserve: string[];
  /** Real trackNos this instruction's own issues must NOT touch — every OTHER track in the pack, per spec's own §5-6 "재작성 시 통과한 곡을 건드리지 말 것". */
  otherTracksMustNotChange: number[];
  workspacePolicySummaryKo: string;
}

const ALL_CONTENT_FIELDS = ['title', 'listenerSituation', 'hookPhrase', 'stylePrompt', 'lyrics'] as const;

/**
 * Real, bounded per-item-id -> field mapping for the ids core/rewriteLoop.ts's
 * own TRACK_SCOPED_ITEM_ID_SET actually classifies as track-scoped (see
 * core/auditItemIds.ts) — every other (design/rebalance-scoped) id touches
 * the whole pack, so `fieldsToChange` for those defaults to every content
 * field rather than guessing a narrower one.
 */
const FIELDS_TOUCHED_BY_ITEM_ID: Record<string, readonly string[]> = {
  'english-grammar-errors': ['lyrics'],
  'in-song-line-repetition': ['lyrics'],
  'tempo-wording-contradiction': ['stylePrompt'],
  'scene-recent-set-overlap': ['listenerSituation', 'lyrics'],
  'scene-recent-set-similarity': ['listenerSituation', 'lyrics'],
  'title-full-history-collision': ['title'],
  'lyric-line-recent-set-overlap': ['lyrics'],
  'prompt-fingerprint-recent-set-overlap': ['stylePrompt'],
  'arrangement-recipe-recent-set-overlap': ['stylePrompt']
};

function fieldsForIssue(issue: ScopedIssue): readonly string[] {
  return FIELDS_TOUCHED_BY_ITEM_ID[issue.id] ?? ALL_CONTENT_FIELDS;
}

/**
 * Builds one structured instruction per track this round's issues actually
 * name — a whole-pack (design/rebalance) issue expands to every track, same
 * "scope itself tells you the reach" convention ScopedIssue.affectedTracks
 * already documents.
 */
export function buildStructuredRewriteInstructions(
  issues: readonly ScopedIssue[],
  songs: readonly SongIdea[],
  workspacePolicy: WorkspaceQualityPolicy
): StructuredRewriteInstruction[] {
  const allTrackNos = songs.map(song => song.trackNo);
  const songByTrackNo = new Map(songs.map(song => [song.trackNo, song]));
  const workspacePolicySummaryKo = `${workspacePolicy.workspaceId} / ${workspacePolicy.languagePolicy.defaultLyricLanguage} / era:${workspacePolicy.eraIntent.mode}`;

  const byTrack = new Map<number, { problemTypes: string[]; fields: Set<string> }>();
  for (const issue of issues) {
    for (const trackNo of issue.affectedTracks) {
      const entry = byTrack.get(trackNo) ?? { problemTypes: [], fields: new Set<string>() };
      entry.problemTypes.push(issue.labelKo);
      for (const field of fieldsForIssue(issue)) entry.fields.add(field);
      byTrack.set(trackNo, entry);
    }
  }

  const instructions: StructuredRewriteInstruction[] = [];
  for (const [trackNo, entry] of byTrack) {
    const song = songByTrackNo.get(trackNo);
    if (!song) continue;
    const fieldsToChange = [...entry.fields];
    const fieldsToPreserve = ALL_CONTENT_FIELDS.filter(field => !entry.fields.has(field));
    instructions.push({
      trackNo,
      originalText: { title: song.title, lyrics: song.lyrics, stylePrompt: song.stylePrompt, hookPhrase: song.hookPhrase },
      problemTypes: entry.problemTypes,
      fieldsToChange,
      fieldsToPreserve,
      otherTracksMustNotChange: allTrackNos.filter(t => t !== trackNo),
      workspacePolicySummaryKo
    });
  }
  return instructions.sort((a, b) => a.trackNo - b.trackNo);
}
