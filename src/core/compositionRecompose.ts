import type { SongIdea } from '../types';
import { scoreComposition } from './compositionScorer';

/**
 * TASK v3.62 (TASK 3) — C안's automatic recomposition gate for the real-API
 * path. Hard-coded, not configurable: a v3.54 incident (an unbounded
 * "regenerate until it passes" loop that never terminated) is why this
 * number is a source constant, not a settings field or function parameter.
 * A song that still has blocking issues after this many attempts ships
 * anyway, with the remaining issues recorded as a warning — this loop must
 * always terminate and must never block generation from completing.
 */
export const RECOMPOSE_MAX_RETRIES = 2;

export interface RecomposeLogEntry {
  trackNo: number;
  attempts: number;
  initialBlockingCount: number;
  finalBlockingCount: number;
  resolved: boolean;
  /** Stopped before using all RECOMPOSE_MAX_RETRIES attempts because an attempt didn't reduce the blocking count — retrying further wasn't going anywhere. */
  abortedEarly: boolean;
  remainingBlocking: string[];
}

export interface RecomposeResult {
  songs: SongIdea[];
  log: RecomposeLogEntry[];
}

/**
 * Regenerates only the tracks compositionScorer.ts flags as blocking,
 * feeding its exact blocking reasons back in as feedback (the same
 * feedback channel providers/index.ts's regenerateTrack already uses for
 * the manual AI-evaluation "재시도" button — see hooks/useEvaluationFlow.ts).
 * `regenerateOne` is injected rather than importing regenerateTrack
 * directly, so this module stays a pure, provider-agnostic unit that's
 * testable without mocking network calls.
 */
export async function recomposeBlockingTracks(
  songs: SongIdea[],
  regenerateOne: (currentSongs: SongIdea[], trackNo: number, feedback: string[]) => Promise<SongIdea[]>
): Promise<RecomposeResult> {
  let current = songs;
  const log: RecomposeLogEntry[] = [];
  const blockingTrackNos = scoreComposition(current).filter(score => !score.passed).map(score => score.trackNo);

  for (const trackNo of blockingTrackNos) {
    let score = scoreComposition(current).find(item => item.trackNo === trackNo)!;
    const initialBlockingCount = score.blocking.length;
    let attempts = 0;
    let abortedEarly = false;

    while (attempts < RECOMPOSE_MAX_RETRIES && score.blocking.length > 0) {
      const feedback = score.blocking;
      current = await regenerateOne(current, trackNo, feedback);
      attempts += 1;
      const nextScore = scoreComposition(current).find(item => item.trackNo === trackNo)!;
      if (nextScore.blocking.length >= score.blocking.length) {
        score = nextScore;
        abortedEarly = attempts < RECOMPOSE_MAX_RETRIES;
        break;
      }
      score = nextScore;
    }

    if (score.blocking.length > 0) {
      current = current.map(song => (song.trackNo === trackNo
        ? { ...song, warnings: [...song.warnings, `재작곡 ${attempts}회 시도 후에도 남은 문제: ${score.blocking.join(' / ')}`] }
        : song));
    }

    log.push({
      trackNo,
      attempts,
      initialBlockingCount,
      finalBlockingCount: score.blocking.length,
      resolved: score.blocking.length === 0,
      abortedEarly,
      remainingBlocking: score.blocking
    });
  }

  return { songs: current, log };
}
