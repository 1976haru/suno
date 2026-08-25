import type { PreassignedSongSlot } from '../types';

/**
 * codex 지시문 02 (TASK K) — real gap: nothing in this codebase tracked
 * whether a song's overall STRUCTURAL recipe (not its title/hook/lyrics —
 * those already have hookLedger.ts/situationLedger.ts/lyricLineLedger.ts of
 * their own) had already been used recently. Two tracks can have completely
 * distinct titles/hooks/scenes and still be functionally the same song —
 * same genre, same tempo bracket, same vocal type, same intro shape, same
 * chord progression, same hook device, same arrangement density — which no
 * existing ledger would ever catch. Built from PreassignedSongSlot (the
 * PLAN, available for every generation path before generation even runs) —
 * not from the post-hoc SongIdea — since introMode/arrangementDensity/
 * hookDeviceId don't survive reconciliation onto the final SongIdea today;
 * see batchPreallocation.ts's reconcileWithPreassignedSlot for where these
 * are computed and attached (SongIdea.promptFingerprint/arrangementRecipe).
 *
 * Two distinct granularities, matching this task's own two named concepts:
 *  - "prompt fingerprint" (buildPromptFingerprint): the full 8-axis recipe —
 *    genre + tempo band + vocal type + intro mode + progression (moneyChord)
 *    + hook device + modulation + arrangement density. A match here means
 *    "this is essentially the same song."
 *  - "arrangement recipe" (buildArrangementRecipe): a narrower 3-axis
 *    subset — intro mode + arrangement density + instrument set — "how this
 *    song is PRODUCED," independent of genre/melody/chords. A match here is
 *    a real but lesser signal (two different songs can legitimately share an
 *    arrangement approach), which is why core/promptFingerprintLedger.ts
 *    checks it over a shorter window (5 sets) than the full fingerprint (10
 *    sets) — see that module's own doc comment.
 */

/**
 * Real signal, not fabricated: "modulation" has no structured field anywhere
 * in this codebase — data/moneyChords.ts's own MoneyChordPreset.prompt is
 * free-text, and a handful of real presets happen to describe a key change
 * in that prose (e.g. "gentle key-up half-step modulation on the final
 * chorus only"). Rather than invent a structured axis with no backing data,
 * this derives a real boolean from the ACTUAL preset text already in use.
 */
const MODULATION_PATTERN = /\bmodulation\b|key[\s-]?up|half[\s-]?step|key change/i;

export function hasModulationSignal(moneyChordText: string | undefined): boolean {
  return Boolean(moneyChordText && MODULATION_PATTERN.test(moneyChordText));
}

/**
 * Simple fixed-width decade bucket (e.g. 92 BPM -> "90s"), deliberately NOT
 * data/audienceProfiles.ts's own per-profile TempoBand (SENIOR_TEMPO_BANDS
 * vs. generateTempoBands' auto 4-band split) — pulling in a specific
 * AudienceProfile here would couple a plan-level fingerprint helper to
 * profile-resolution logic for no real benefit; "same tempo decade" is a
 * perfectly real, profile-independent structural signal on its own.
 */
export function tempoBandLabel(tempo: number | undefined): string {
  if (!Number.isFinite(tempo)) return '?';
  return `${Math.floor((tempo as number) / 10) * 10}s`;
}

function axis(value: string | undefined): string {
  return value?.trim() || '?';
}

/**
 * The full 8-axis structural recipe. Order is fixed (not alphabetized) so
 * two callers building a fingerprint from the same slot always agree
 * byte-for-byte; each axis is '?' when the slot has no value for it, so a
 * fingerprint is still comparable (never throws) even for an
 * incompletely-planned slot (e.g. a track with peakStrength 'none' has no
 * killingPoint, unrelated axes here are unaffected).
 */
export function buildPromptFingerprint(slot: PreassignedSongSlot): string {
  return [
    axis(slot.genreId),
    tempoBandLabel(slot.tempo),
    axis(slot.vocalType),
    axis(slot.introMode),
    axis(slot.moneyChordId),
    axis(slot.hookDeviceId),
    hasModulationSignal(slot.moneyChordText) ? 'mod' : 'no-mod',
    axis(slot.arrangementDensity)
  ].join('|');
}

/**
 * The narrower "how this is produced" subset — see this file's own top doc
 * comment for why this is a separate, looser signal from the full
 * fingerprint above. instrumentSet is sorted before joining so the same set
 * chosen in a different order still recipe-matches (this is a "which
 * instruments" signal, not "in what order they were listed").
 */
export function buildArrangementRecipe(slot: PreassignedSongSlot): string {
  const instruments = [...(slot.instrumentSet ?? [])].map(i => i.trim().toLowerCase()).sort().join(',') || '?';
  return [axis(slot.introMode), axis(slot.arrangementDensity), instruments].join('|');
}
