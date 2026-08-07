import type { SongIdea } from '../types';
import { stableHash } from './generationPreflight';

/**
 * codex 지시문 05 (TASK D) — "합격곡 잠금": `hashStableSongFields(song)` plus
 * a real reject-if-changed check around a rewrite response. Investigation
 * confirmed no hash/lock concept exists anywhere for this purpose —
 * core/promptFingerprint.ts's buildPromptFingerprint hashes structural
 * RECIPE axes (genre/tempo/vocal/intro/chord) for cross-SET duplication
 * tracking, a different real purpose from "prove this exact track's own
 * content didn't change across a rewrite roundtrip" — genuinely new here.
 *
 * Reuses core/generationPreflight.ts's own real stableHash (the same
 * canonicalizing hash ResolvedGenerationContract/DesignGateResult
 * acknowledgment already uses) rather than a second hashing approach.
 */

/**
 * The real CONTENT fields a rewrite response actually carries for a track —
 * deliberately excludes `scores`/`warnings` (this app's own post-hoc
 * scoreSongs output, recomputed fresh every finalize pass, never something
 * a provider echoes back) and `trackNo` (the identity key itself, checked
 * separately by the caller, not part of "did the CONTENT change").
 */
function stableSongFieldsFor(song: SongIdea): Record<string, unknown> {
  return {
    title: song.title,
    listenerSituation: song.listenerSituation,
    emotionArc: song.emotionArc,
    hookPhrase: song.hookPhrase,
    stylePrompt: song.stylePrompt,
    excludePrompt: song.excludePrompt,
    lyrics: song.lyrics,
    vocalType: song.vocalType,
    bpm: song.bpm,
    genreId: song.genreId,
    killingPointId: song.killingPointId,
    arcPhase: song.arcPhase,
    structureTemplate: song.structureTemplate,
    moneyChordId: song.moneyChordId
  };
}

/** Real, deterministic hash of one song's own stable content fields — same value for the same content regardless of object identity/key order. */
export function hashStableSongFields(song: SongIdea): string {
  return stableHash(stableSongFieldsFor(song));
}

export interface PassedTrackLock {
  trackNo: number;
  hash: string;
}

/** Real snapshot to take BEFORE dispatching a rewrite request — one lock per track the caller intends to leave untouched. */
export function lockPassedTracks(songs: readonly SongIdea[], passedTrackNos: readonly number[]): PassedTrackLock[] {
  const passedSet = new Set(passedTrackNos);
  return songs.filter(song => passedSet.has(song.trackNo)).map(song => ({ trackNo: song.trackNo, hash: hashStableSongFields(song) }));
}

export interface PassedTrackMutation {
  trackNo: number;
  expectedHash: string;
  actualHash: string;
}

/**
 * Real verification run AFTER a rewrite response comes back — spec's own
 * "재작성 응답에서 합격곡 hash가 바뀌면 거부한다". Returns the list of
 * mutations found (empty = clean, safe to accept). A track named in `locks`
 * but missing from `responseSongs` entirely also counts as a mutation (a
 * response that silently drops a passed track is exactly as untrustworthy
 * as one that alters it).
 */
export function findPassedTrackMutations(responseSongs: readonly SongIdea[], locks: readonly PassedTrackLock[]): PassedTrackMutation[] {
  const byTrackNo = new Map(responseSongs.map(song => [song.trackNo, song]));
  const mutations: PassedTrackMutation[] = [];
  for (const lock of locks) {
    const song = byTrackNo.get(lock.trackNo);
    const actualHash = song ? hashStableSongFields(song) : '(missing)';
    if (actualHash !== lock.hash) mutations.push({ trackNo: lock.trackNo, expectedHash: lock.hash, actualHash });
  }
  return mutations;
}

/** The one real entry point a caller (the rewrite dispatcher) should use: true only when every locked track survived unchanged. */
export function rewriteResponseRespectsPassedTracks(responseSongs: readonly SongIdea[], locks: readonly PassedTrackLock[]): boolean {
  return findPassedTrackMutations(responseSongs, locks).length === 0;
}
