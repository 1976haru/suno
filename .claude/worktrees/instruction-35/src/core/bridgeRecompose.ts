import type { ScopedIssue, SongIdea } from '../types';
import { CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME } from './bridgeInstruction';

/**
 * v3.66 (TASK C) — split out of claudeCodeBridge.ts. Pure move, no logic
 * altered. See bridgeInstruction.ts / bridgeImport.ts for the other two
 * halves of the bridge; claudeCodeBridge.ts re-exports all three.
 */

/**
 * TASK v3.62 (TASK 3) — the bridge (manual copy-paste) path has no API call
 * to automatically retry through, unlike providers/index.ts's
 * recomposeBlockingTracks. This builds a second, much smaller instruction
 * that targets ONLY the tracks core/compositionScorer.ts flagged as
 * blocking — not the whole pack — so re-running it through an external
 * coding agent doesn't waste tokens re-writing songs that already passed.
 */
/**
 * v4.1 (TASK C) — `fields: 'titleOnly'` is the narrow variant this task
 * exists to add: a `rebalance`-scope issue (e.g. title pattern collapse)
 * is fixable by touching only a handful of TITLES, not by regenerating
 * those tracks' lyrics/stylePrompt too — asking an external coding agent
 * to rewrite the whole song when only the title is wrong wastes tokens and
 * risks an unrelated regression in text that already passed. Defaults to
 * 'all' (this function's original, unchanged full-track behavior) so every
 * existing caller keeps working exactly as before.
 */
export function buildRecomposeInstruction(blockingSongs: Array<{ song: SongIdea; blocking: string[] }>, fields: 'all' | 'titleOnly' = 'all'): string {
  const lines: string[] = [];

  if (fields === 'titleOnly') {
    lines.push(
      `다음 ${blockingSongs.length}곡의 제목만 다시 지어주십시오. 가사와 스타일 프롬프트는 유지하십시오.`
    );
    lines.push('');
    lines.push('Output a JSON object containing ONLY the new titles, keyed by trackNo: { "titles": { "3": "New Title", "7": "New Title" } }');
    lines.push('');
    for (const { song, blocking } of blockingSongs) {
      lines.push(`--- Track ${song.trackNo}: current title "${song.title}" ---`);
      lines.push('Problems found (must all be fixed by the new title):');
      for (const reason of blocking) lines.push(`- ${reason}`);
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  lines.push(
    'You are revising a subset of songs from an existing Suno playlist pack that failed an automated quality check. ' +
    'Rewrite ONLY the tracks listed below, fixing every problem listed for that track — do not touch any other track, ' +
    'and keep each track\'s trackNo, title, hookPhrase, seasonMoment, listenerSituation, and emotionArc unless a listed ' +
    'problem specifically requires changing one of them.'
  );
  lines.push('');
  lines.push(`Output a JSON object of the same shape as ${CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME}, containing ONLY these ${blockingSongs.length} track(s): { "songs": [ ... ] }`);
  lines.push('');

  for (const { song, blocking } of blockingSongs) {
    lines.push(`--- Track ${song.trackNo}: "${song.title}" ---`);
    if (song.genreText) lines.push(`Genre: ${song.genreText}`);
    lines.push('Current style prompt:');
    lines.push(song.stylePrompt);
    lines.push('Problems found (must all be fixed in the rewrite):');
    for (const reason of blocking) lines.push(`- ${reason}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

/** v4.1 (TASK C) — turns a single ScopedIssue's affectedTracks into the `{song, blocking}` shape buildRecomposeInstruction expects, so a `rebalance`-scope issue's own narrow "N곡만 재생성" button can reuse this function directly instead of building its own instruction text. */
export function songsForScopedIssue(issue: ScopedIssue, songs: SongIdea[]): Array<{ song: SongIdea; blocking: string[] }> {
  return issue.affectedTracks
    .map(trackNo => songs.find(song => song.trackNo === trackNo))
    .filter((song): song is SongIdea => Boolean(song))
    .map(song => ({ song, blocking: [issue.labelKo] }));
}
