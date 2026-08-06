import type { BilingualPair, ChannelArchetype, LyricLanguage, SongIdea } from '../types';
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
  regenerateOne: (currentSongs: SongIdea[], trackNo: number, feedback: string[]) => Promise<SongIdea[]>,
  /** TASK v3.64 (TASK D) — the channel's real cross-pack hook history, so a song that duplicates (or near-duplicates) a previously-used hook gets caught and retried here too, not only via the bridge path's manual "재작곡 지시문 복사" button. */
  historicalHooks: string[] = [],
  /**
   * TASK (ratio-based lyric language mismatch) — this loop's own
   * scoreComposition() call below previously always omitted lyricLanguage
   * entirely (a pre-existing gap, unrelated to this task's own fix). The
   * new per-track language-ratio blocking check in compositionScorer.ts is
   * deliberately gated on opts.lyricLanguage being explicitly present (see
   * that check's own comment) specifically so this gap could never turn
   * into a false block — omitting this param just means the check silently
   * never runs during a recompose pass, not that it misfires. Passing it
   * through is what makes a genuine language mismatch actually retried by
   * this loop instead of only showing up in the score afterward. Optional
   * so the one pre-existing call site (providers/index.ts's
   * generateBlueprint) is the only thing that changes; a caller that still
   * omits it keeps the exact old behavior (language-ratio check never
   * fires here, same as before this task).
   */
  lyricLanguage?: LyricLanguage,
  /**
   * v5.14 (compositionScorer follow-up to v5.12's channel-fixed vocal quota
   * work) — this channel's real fixed gender quota
   * (ChannelProfile.vocalQuotaOverride), threaded straight into
   * scoreComposition's own opts of the same name so the new male-only/
   * female-only text-leak checks (opposite-gender descriptor in stylePrompt,
   * opposite-gender meta tag in lyrics, duet/group phrasing outside a
   * mixed-quota track — see compositionScorer.ts's own doc comment on those
   * checks) actually gate a blocking recompose here, not just a one-off
   * evaluateGenerationGate() call elsewhere. Optional, same "omitted =
   * no-op" pattern as historicalHooks/lyricLanguage above — a caller that
   * doesn't pass it just never triggers those 3 checks in this loop, same as
   * before this task.
   */
  vocalQuotaOverride?: { male: number; female: number; mixed: number },
  /**
   * v5.16 follow-up — same "omitted = exact old behavior" pattern as
   * lyricLanguage/vocalQuotaOverride above. Without these, the language
   * blocking check inside scoreComposition() falls back to the flat 0.6
   * Korean-hangul floor and auto-detected bilingual pair instead of the
   * per-workspace thresholds / explicit pair check core/lyricMetrics.ts
   * gained in v5.16 TASK B+C — so a genuine language mismatch during a
   * recompose pass wouldn't get the benefit of either fix unless a caller
   * threads these through.
   */
  archetype?: ChannelArchetype,
  bilingualPair?: BilingualPair
): Promise<RecomposeResult> {
  let current = songs;
  const log: RecomposeLogEntry[] = [];
  const scoreOpts = { historicalHooks, lyricLanguage, vocalQuotaOverride, archetype, bilingualPair };
  // v4.1 (TASK C) — .tracks only (not packBlocking/packAdvisory): a
  // pack-level design issue (era share, BPM/vocal structure collapse) isn't
  // fixable by recomposing any one song, so this loop — which regenerates
  // exactly one track at a time — must never target one just because a
  // pack-level finding used to be copied into its own blocking list.
  const blockingTrackNos = scoreComposition(current, scoreOpts).tracks.filter(score => !score.passed).map(score => score.trackNo);

  for (const trackNo of blockingTrackNos) {
    let score = scoreComposition(current, scoreOpts).tracks.find(item => item.trackNo === trackNo)!;
    const initialBlockingCount = score.blocking.length;
    let attempts = 0;
    let abortedEarly = false;

    while (attempts < RECOMPOSE_MAX_RETRIES && score.blocking.length > 0) {
      const feedback = score.blocking;
      current = await regenerateOne(current, trackNo, feedback);
      attempts += 1;
      const nextScore = scoreComposition(current, scoreOpts).tracks.find(item => item.trackNo === trackNo)!;
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
