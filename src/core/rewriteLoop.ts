import type { IssueScope, ScopedIssue, SongIdea } from '../types';
import type { ReleaseReadinessItem, ReleaseReadinessReport } from './releaseReadiness';

/**
 * v5.22 (AXIS 5) — real, verified gap this module fixes: no rewrite loop
 * existed at all (recompose/regenerateFailedSongs/rewriteLoop were all
 * unimplemented) — a failed release-readiness check required the user to
 * manually re-run Codex with no app-generated guidance on what specifically
 * to fix. Reuses types.ts's own pre-existing IssueScope/ScopedIssue (built
 * for exactly this "how far does a fix have to reach" classification —
 * core/generationGate.ts's packLevelFindings already produces these for its
 * own pack-level blocking findings) rather than inventing a second scope
 * taxonomy.
 */

const MAX_AUTOMATIC_ROUNDS = 2;

/** Spec's own §5-5 "자동 재작성 최대 2회" — pure so the cap itself is testable without any real loop state. */
export function shouldContinueRewriteLoop(roundsAlreadyRun: number): boolean {
  return roundsAlreadyRun < MAX_AUTOMATIC_ROUNDS;
}

const TRACK_SCOPED_ITEM_IDS = new Set([
  'english-grammar-errors', 'in-song-line-repetition', 'tempo-wording-contradiction',
  'scene-recent-set-overlap', 'title-full-history-collision', 'lyric-line-recent-set-overlap'
]);
const DESIGN_SCOPED_ITEM_IDS = new Set([
  'era-primary-share', 'bpm-in-range', 'genre-variety', 'genre-max5', 'vocal_distribution', 'vocal_no_triple_run', 'modulation-count', 'intro-type-variety'
]);

/**
 * Classifies each failing ReleaseReadinessItem into a real IssueScope. Item
 * ids not named in either curated set above default to 'rebalance' (a
 * shortfall fixable by touching a minimum subset, per IssueScope's own doc
 * comment) rather than guessing 'full' — 'full' is reserved for the
 * genuinely catastrophic case (see classifyOverallScope below), never a
 * single item's own default.
 */
function scopeForItem(item: ReleaseReadinessItem): IssueScope {
  if (TRACK_SCOPED_ITEM_IDS.has(item.id)) return 'track';
  if (DESIGN_SCOPED_ITEM_IDS.has(item.id)) return 'design';
  return 'rebalance';
}

/**
 * v5.22 (AXIS 5 §5-3) — reuses types.ts's own IssueScope classification
 * table verbatim (see that type's own doc comment for the 5 scopes' real
 * definitions). `songs` is needed to resolve WHICH trackNos a track-scoped
 * item actually touches (a ReleaseReadinessItem's own `detail` string names
 * them in Korean prose, not a structured list — this re-derives it from the
 * same real check functions instead of parsing that prose back out).
 */
export function classifyReleaseReadinessFailures(report: ReleaseReadinessReport, songs: Pick<SongIdea, 'trackNo'>[]): ScopedIssue[] {
  const allTrackNos = songs.map(song => song.trackNo);
  // spec's own §2-4 "full" threshold: 32개 중 20개 미만 통과 -> full regeneration, not per-item fixes.
  if (report.totalCriteria > 0 && report.passedCriteria < report.totalCriteria - 12) {
    return [{
      scope: 'full',
      id: 'release-readiness-catastrophic',
      labelKo: `${report.totalCriteria}개 중 ${report.passedCriteria}개만 통과 — 부분 재작성으로는 부족합니다.`,
      affectedTracks: allTrackNos,
      fixHintKo: '전체 재생성이 현실적인 해결책입니다.'
    }];
  }
  return report.failing
    .filter(item => !item.notImplemented) // an unimplemented check has nothing to rewrite toward — never generates a rewrite instruction for it.
    .map(item => ({
      scope: scopeForItem(item),
      id: item.id,
      labelKo: item.labelKo,
      // Track-scoped items' own detail strings already name "T<n>" — a
      // design/rebalance-scoped item touches the whole pack (same
      // convention ScopedIssue's own doc comment establishes: scope itself
      // tells the UI a single-track regen can't help, not an empty list).
      affectedTracks: scopeForItem(item) === 'track' ? extractTrackNosFromDetail(item.detail, allTrackNos) : allTrackNos,
      fixHintKo: item.detail
    }));
}

function extractTrackNosFromDetail(detail: string, allTrackNos: number[]): number[] {
  const matches = [...detail.matchAll(/T(\d+)/g)].map(match => Number(match[1]));
  const valid = matches.filter(trackNo => allTrackNos.includes(trackNo));
  return valid.length ? [...new Set(valid)] : allTrackNos;
}

/**
 * v5.22 (AXIS 5 §5-4) — builds the exact instruction shape the task spec's
 * own §5-4 example shows: a per-track "문제"/"요구" block, never a generic
 * "please fix issues" — spec's own explicit "무엇이 왜 잘못됐는지 구체적으로
 * 적으십시오. 추상적으로 쓰면 같은 결과가 나옵니다." Only ever names tracks that
 * actually need touching (design/full-scope issues list every track, since
 * that's genuinely what they affect); every OTHER track is explicitly told
 * to stay untouched (spec's own §5-6 "재작성 시 통과한 곡을 건드리지 말 것").
 */
export function buildRewriteInstruction(issues: ScopedIssue[], allTrackNos: number[]): string {
  if (!issues.length) return '';
  const affectedTrackNos = [...new Set(issues.flatMap(issue => issue.affectedTracks))].sort((a, b) => a - b);
  const untouchedCount = allTrackNos.length - affectedTrackNos.length;

  const byTrack = new Map<number, string[]>();
  const wholePackIssues: ScopedIssue[] = [];
  for (const issue of issues) {
    if (issue.scope === 'track' || issue.scope === 'pair') {
      for (const trackNo of issue.affectedTracks) {
        const list = byTrack.get(trackNo) ?? [];
        list.push(issue.fixHintKo ? `${issue.labelKo} — ${issue.fixHintKo}` : issue.labelKo);
        byTrack.set(trackNo, list);
      }
    } else {
      wholePackIssues.push(issue);
    }
  }

  const lines: string[] = [];
  lines.push(`아래 ${affectedTrackNos.length}곡만 다시 만드십시오. 나머지 ${untouchedCount}곡은 그대로 유지합니다.`, '');

  for (const trackNo of affectedTrackNos) {
    const problems = byTrack.get(trackNo);
    if (!problems?.length) continue;
    lines.push(`T${trackNo}`);
    lines.push(`  문제  ${problems.join(' / ')}`);
    lines.push('');
  }

  if (wholePackIssues.length) {
    lines.push('[세트 전체에 적용되는 문제]');
    for (const issue of wholePackIssues) {
      lines.push(`  ${issue.labelKo}${issue.fixHintKo ? ` — ${issue.fixHintKo}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
