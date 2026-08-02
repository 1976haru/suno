import type { SongIdea } from '../types';

/**
 * v4.3 (TASK E-1) — "이미 만든 18곡의 순서를 재배치합니다. 재생성 비용 0."
 * (하루님). This is a PLAYBACK-ORDER suggestion only — it never renumbers
 * trackNo/songId or mutates any song content. Renumbering trackNo would
 * desync every trackNo-keyed subsystem this app already has (AudioTake,
 * rating-by-songId-but-directives-by-trackNo, CSV take ledger, hook/title
 * dedup history) for zero real benefit — the actual goal (a better-flowing
 * final YouTube video) only needs a reordered CONCATENATION list, which
 * utils/videoExport.ts's ffmpeg script and any manual editing already take
 * a plain ordered trackNo list for. See SetOrderSuggestionPanel.tsx for the
 * read-only UI (suggested order + rationale + a copyable trackNo sequence)
 * built on top of this module.
 */

export interface TrackAudioSignal {
  trackNo: number;
  /** Amplitude-weighted mean frequency (Hz) — higher reads brighter. From a real adopted AudioTake's metrics.spectralCentroid when available. */
  spectralCentroid?: number;
  /** Whole-track RMS in dB — from a real adopted AudioTake's metrics.overallLevel. Used as the "진폭 큰 곡" signal for arc positioning. */
  overallLevel?: number;
}

export interface SetOrderSuggestionEntry {
  position: number;
  trackNo: number;
  title: string;
  noteKo: string;
}

export interface SetOrderSuggestionResult {
  /** Original trackNo order (unchanged) — for a before/after comparison in the UI. */
  originalOrder: number[];
  /** Suggested playback order, as a list of ORIGINAL trackNos. */
  suggestedOrder: number[];
  entries: SetOrderSuggestionEntry[];
  /** true when suggestedOrder differs from originalOrder at any position. */
  changed: boolean;
  /** Which signals actually had real data (vs. falling back to an estimate) — shown in the UI so a "완전 추측"과 "실측 기반" 제안 are visibly distinguished. */
  usedRealAudioSignals: boolean;
}

const FAST_SLOW_MEDIAN_FALLBACK_BPM = 95;

/** Falls back to arcPhase-implied brightness when no real spectralCentroid exists — never blocks the suggestion on missing audio analysis (this task's own "재생성 비용 0" — no re-render, no re-analysis required to get SOME suggestion). */
function brightnessScoreFor(song: SongIdea, signal: TrackAudioSignal | undefined): number {
  if (signal?.spectralCentroid !== undefined) return signal.spectralCentroid;
  // Peak/rising arc phases lean brighter in this app's own vocal/production planning; easing/closing lean darker. Purely an estimate, scaled to a plausible Hz range so it sorts sensibly alongside real measurements when only some tracks have audio.
  const byPhase: Record<string, number> = { opening: 1800, rising: 2200, peak: 2600, easing: 1600, closing: 1400 };
  const phaseValue = song.arcPhase ? byPhase[song.arcPhase] : undefined;
  return phaseValue ?? 2000;
}

function amplitudeScoreFor(song: SongIdea, signal: TrackAudioSignal | undefined): number {
  if (signal?.overallLevel !== undefined) return signal.overallLevel;
  return song.intensity ?? 3;
}

/**
 * Greedy nearest-neighbor-style reorder: starting from a fixed opening
 * (cold-open) and fixed flagship block (tracks 2-3, per this app's own
 * songRole convention), each remaining position picks whichever unplaced
 * song best alternates brightness/tempo and avoids repeating the previous
 * track's genre/vocal type, with a bonus for landing a high-amplitude track
 * in the 9-11 "peak" window (v3.67 arc convention this task's own spec
 * references). This is a suggestion heuristic, not an optimal solver.
 */
export function suggestSetOrder(songs: SongIdea[], audioSignals: TrackAudioSignal[] = []): SetOrderSuggestionResult {
  const originalOrder = songs.map(song => song.trackNo).sort((a, b) => a - b);
  if (songs.length < 4) {
    return {
      originalOrder,
      suggestedOrder: originalOrder,
      entries: songs.map((song, i) => ({ position: i + 1, trackNo: song.trackNo, title: song.title, noteKo: '4곡 미만 — 재배치를 제안하지 않습니다.' })),
      changed: false,
      usedRealAudioSignals: false
    };
  }

  const signalByTrackNo = new Map(audioSignals.map(signal => [signal.trackNo, signal]));
  const usedRealAudioSignals = audioSignals.some(signal => signal.spectralCentroid !== undefined || signal.overallLevel !== undefined);
  const byTrackNo = new Map(songs.map(song => [song.trackNo, song]));
  const total = songs.length;
  const peakWindowStart = Math.max(1, Math.round(total * (9 / 18)));
  const peakWindowEnd = Math.min(total, Math.round(total * (11 / 18)));

  const coldOpen = songs.find(song => song.songRole === 'cold-open') ?? songs[0];
  const flagships = songs.filter(song => song.songRole === 'flagship' && song.trackNo !== coldOpen.trackNo);
  const placed: number[] = [coldOpen.trackNo, ...flagships.map(song => song.trackNo)];
  const placedSet = new Set(placed);
  const remaining = songs.filter(song => !placedSet.has(song.trackNo));

  const notes = new Map<number, string>();
  notes.set(coldOpen.trackNo, '오프닝 — 콜드오픈 곡 유지');
  for (const flagship of flagships) notes.set(flagship.trackNo, '대표곡 — 2~3번 자리 유지');

  function pop(pool: SongIdea[]): SongIdea {
    // Deterministic among ties: lowest original trackNo wins.
    pool.sort((a, b) => a.trackNo - b.trackNo);
    return pool[0];
  }

  let prev = byTrackNo.get(placed[placed.length - 1])!;
  const pending = [...remaining];
  while (pending.length) {
    const position = placed.length + 1;
    const wantBrightAlternation = true;
    const prevBrightness = brightnessScoreFor(prev, signalByTrackNo.get(prev.trackNo));
    const prevBpm = prev.bpm ?? FAST_SLOW_MEDIAN_FALLBACK_BPM;
    const inPeakWindow = position >= peakWindowStart && position <= peakWindowEnd;

    let best: SongIdea | null = null;
    let bestScore = -Infinity;
    for (const candidate of pending) {
      const signal = signalByTrackNo.get(candidate.trackNo);
      let score = 0;
      const brightness = brightnessScoreFor(candidate, signal);
      const bpm = candidate.bpm ?? FAST_SLOW_MEDIAN_FALLBACK_BPM;
      if (wantBrightAlternation) score += Math.abs(brightness - prevBrightness) > 150 ? 2 : 0;
      score += Math.abs(bpm - prevBpm) > 10 ? 2 : 0;
      if (candidate.genreId && prev.genreId && candidate.genreId !== prev.genreId) score += 1;
      if (candidate.vocalType && prev.vocalType && candidate.vocalType !== prev.vocalType) score += 1;
      if (inPeakWindow) score += amplitudeScoreFor(candidate, signal) / 10;
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    if (!best) best = pop(pending);

    const idx = pending.indexOf(best);
    pending.splice(idx, 1);
    placed.push(best.trackNo);
    const reasonParts: string[] = [];
    const brightness = brightnessScoreFor(best, signalByTrackNo.get(best.trackNo));
    reasonParts.push(brightness > prevBrightness ? '밝은 곡' : '어두운 곡');
    reasonParts.push((best.bpm ?? FAST_SLOW_MEDIAN_FALLBACK_BPM) > prevBpm ? '빠른 템포' : '느린 템포');
    if (inPeakWindow) reasonParts.push('아크 피크 구간(9~11번대)');
    notes.set(best.trackNo, `${reasonParts.join(' · ')} — 이전 곡과 대비`);
    prev = best;
  }

  const entries: SetOrderSuggestionEntry[] = placed.map((trackNo, i) => ({
    position: i + 1,
    trackNo,
    title: byTrackNo.get(trackNo)!.title,
    noteKo: notes.get(trackNo) ?? ''
  }));

  const changed = placed.some((trackNo, i) => trackNo !== originalOrder[i]);

  return { originalOrder, suggestedOrder: placed, entries, changed, usedRealAudioSignals };
}
