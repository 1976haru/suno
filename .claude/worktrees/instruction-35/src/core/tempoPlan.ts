import type { TempoBand } from '../data/audienceProfiles';
import { shuffle } from './lyricEngine';

/**
 * TASK v3.58 (지시문 v3.58 TASK 4) — real measurement found BPM clustered
 * into an 8-step range around 92-100 for an 18-song senior pack (see
 * genreRotation.ts's TASK 1 fix for why: the same primary genre's tempo
 * range dominated every song). This builds a genre-independent tempo BAND
 * assignment per track — deliberately data-driven (data/audienceProfiles.ts's
 * SENIOR_TEMPO_BANDS), scaled proportionally to songCount via largest-
 * remainder so counts always sum exactly, then shuffled (seeded) so which
 * track lands in which band isn't always the same low-to-high order.
 */
function scaleBandCounts(bands: readonly TempoBand[], songCount: number): number[] {
  const totalShare = bands.reduce((sum, band) => sum + band.shareOf18, 0) || 1;
  const raw = bands.map(band => (band.shareOf18 / totalShare) * songCount);
  const floors = raw.map(Math.floor);
  let remainder = songCount - floors.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  const counts = [...floors];
  for (let k = 0; k < byFraction.length && remainder > 0; k += 1, remainder -= 1) {
    counts[byFraction[k].index] += 1;
  }
  return counts;
}

export function buildTempoBandPlan(bands: readonly TempoBand[], songCount: number, seed: number): TempoBand[] {
  if (!bands.length || songCount <= 0) return [];
  const counts = scaleBandCounts(bands, songCount);
  const flat: TempoBand[] = [];
  bands.forEach((band, index) => {
    for (let n = 0; n < counts[index]; n += 1) flat.push(band);
  });
  return shuffle(flat, seed + 2003).slice(0, songCount);
}

/**
 * Resolves a track's final BPM primarily from its assigned tempo band, not
 * the genre's own tempoRange — per TASK 4's own role-separation table,
 * tempo range is an AudienceProfile-level concern (types.ts), genre governs
 * instrumentation/rhythm-feel/harmony/swing/era, not tempo.
 *
 * Two earlier designs were tried and measurably failed before this one:
 * (1) hard-clamping the band center to the genre's own range collapsed
 * multiple out-of-range bands down to the same boundary value for a
 * narrow genre (e.g. jazz-pop, 82-96) — 4 bands producing 2-3 distinct
 * BPMs. (2) proportionally mapping the band center into the genre's range
 * preserved ordering but still bounded the achievable spread to whatever a
 * pack's narrowest selected genres could support — a real 18-song senior
 * pack (3-10 genres, individual ranges spanning 78-108) only reached
 * stddev ~5.5-6.4 against this task's >=8 target, because "never exceed
 * this genre's own range" is fighting the exact variety the audience-level
 * band plan exists to create.
 *
 * This version stays within the assigned band's own [low, high] (already a
 * deliberately chosen, sensible sub-range of the audience profile's full
 * span), with a small genre-derived jitter around the band center so two
 * songs sharing a band don't land on the exact same BPM, clamped to the
 * audience profile's absolute floor/ceiling as the only outer bound.
 * fallbackCenter (the old averageTempo genre-only computation, clamped to
 * [genreLow, genreHigh]) is used verbatim when no band was assigned (empty
 * band plan, e.g. songCount <= 0 upstream).
 *
 * v5.8 (audit follow-up, docs/v58-report.md) — `genreBounded` opts a track
 * into approach (2) from this comment's own history above ("proportionally
 * mapping the band center into the genre's range"), rejected for senior
 * specifically because it capped pack-wide stddev below the >=8 target —
 * a real, valid tradeoff for a workspace whose genres all share roughly one
 * tempo character and where cross-song BPM VARIETY is the actual goal.
 * kr-kids has the opposite problem: its 7 genres genuinely span calm
 * (krkids-sleep-calm, 62-84) to energetic (krkids-action, 112-128) in the
 * SAME workspace, and audience-profile-wide bands (data/audienceProfiles.ts's
 * KR_KIDS_AUDIENCE_PROFILE, kept at 92-128 specifically because widening it
 * broke krkids-action instead of fixing krkids-sleep-calm — see that
 * profile's own doc comment) made every song land in the same wide
 * genre-blind range regardless of which genre was actually selected. When
 * `genreBounded` is true, the track's position within its own band gets
 * remapped proportionally onto ITS OWN genre's real [genreLow, genreHigh]
 * instead of being clamped to the audience-wide floor/ceiling — a calm
 * genre stays calm, an energetic genre stays energetic, with variety now
 * coming from where in ITS OWN range each track lands rather than across
 * the whole workspace. `undefined`/falsy (every existing profile) is a
 * strict no-op — identical output to before this change.
 */
export function resolveTempoWithBand(
  genreLow: number,
  genreHigh: number,
  band: Pick<TempoBand, 'low' | 'high'> | undefined,
  audienceFloor: number,
  audienceCeiling: number,
  fallbackCenter: number,
  genreBounded?: boolean
): number {
  if (!band) return Math.min(Math.max(fallbackCenter, genreLow), genreHigh);
  const bandCenter = Math.round((band.low + band.high) / 2);
  const bandSpan = Math.max(1, band.high - band.low);
  // Deterministic per-genre jitter (not random) so the same genre+band
  // combination always renders the same BPM — genreLow/genreHigh differ
  // per genre, so this varies which side of the band center a genre lands
  // on without needing its own seed parameter.
  const jitter = ((genreLow + genreHigh) % (bandSpan + 1)) - Math.floor(bandSpan / 2);
  const withinBand = Math.min(band.high, Math.max(band.low, bandCenter + jitter));
  if (genreBounded) {
    const audienceSpan = Math.max(1, audienceCeiling - audienceFloor);
    const positionInAudienceRange = Math.min(1, Math.max(0, (withinBand - audienceFloor) / audienceSpan));
    const genreSpan = Math.max(1, genreHigh - genreLow);
    const mappedToGenre = Math.round(genreLow + positionInAudienceRange * genreSpan);
    return Math.min(genreHigh, Math.max(genreLow, mappedToGenre));
  }
  return Math.min(audienceCeiling, Math.max(audienceFloor, withinBand));
}
