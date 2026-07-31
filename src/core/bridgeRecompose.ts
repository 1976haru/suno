import type { SongIdea } from '../types';
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
export function buildRecomposeInstruction(blockingSongs: Array<{ song: SongIdea; blocking: string[] }>): string {
  const lines: string[] = [];
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
