import type { GenerationOptions, GenrePack, PreassignedSongSlot, SongIdea } from '../types';
import { createTitleGenerator, hashSeed, seedForBlueprint, UniquePool } from './lyricEngine';
import { averageTempo, emotionArcs, nextContestedTitle, resolveSongRole } from './localGenerator';
import type { OpeningPackContext } from './openingContest';

export type { PreassignedSongSlot };

/**
 * TASK B2 (v3.6) — parallel Anthropic Message Batch requests run with no
 * visibility into each other (see providers/batchAnthropic.ts's known
 * limitation note), so two sub-batches submitted together can independently
 * invent the same title or hook. The fix is to never let a batch invent a
 * title/hook at all: every trackNo's title, hook, song role, tempo, and
 * emotion arc is decided locally, up front, with the exact same
 * (avoid-list-aware, hookLedger-informed) generator the local engine itself
 * uses — then handed to every sub-batch as a fixed assignment. Batches only
 * write lyrics/stylePrompt/situations for the trackNos they own; they can no
 * longer collide on identity because they never choose it.
 */
export function preallocateSongSlots(
  opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount' | 'genreIds' | 'moodIds'>,
  genres: GenrePack[],
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): PreassignedSongSlot[] {
  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  const emotionArcPool = new UniquePool(emotionArcs, seed + 22);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype);
  // TASK I2 (v3.11) — the Batch API path is local-then-submit (this whole
  // function's point per its own docstring), so tracks 1-3 get the same
  // local k=3 contest the synchronous path uses, not a plain single-hook pick.
  const packContext: OpeningPackContext = { dominantGenreIds: opts.genreIds ?? [], dominantMoodIds: opts.moodIds ?? [] };

  return Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const songRole = resolveSongRole(trackNo, idx);
    const { title, hook } = trackNo <= 3
      ? nextContestedTitle(nextTitle, opts.lyricLanguage, opts.channel.archetype, songRole, songRole === 'cold-open' ? 'cold-open' : 'flagship', packContext)
      : nextTitle(songRole);
    return {
      trackNo,
      title,
      hookPhrase: hook,
      songRole,
      tempo: averageTempo(genres, trackNo),
      emotionArc: emotionArcPool.take()
    };
  });
}

/** Splits a full slot list into the same trackNo ranges buildBatchRequestSpecs chunks the songs into, so each sub-batch's request only carries its own slots. */
export function slotsForRange(slots: PreassignedSongSlot[], trackNumbers: number[]): PreassignedSongSlot[] {
  const range = new Set(trackNumbers);
  return slots.filter(slot => range.has(slot.trackNo));
}

/**
 * TASK v3.27 — the single place every generation path (realtime, Batch API,
 * Claude Code bridge import) reconciles a model/agent's raw song output
 * against the locally pre-decided slot for its trackNo, so the three paths
 * can't drift out of sync on what "verbatim" means (same drift risk v3.21's
 * batchPlanningBullets/songOutputShape extraction already guards against
 * elsewhere in this codebase).
 *
 * hookPhrase/emotionArc/songRole are ALWAYS forced to the slot's value when a
 * slot exists — hook-collision-zero is a hard guarantee this app makes
 * regardless of titleMode (see GenerationOptions.titleMode's comment).
 * "title" is the one field titleMode governs: 'local' forces it to the
 * slot's mechanically-derived title (old behavior, unchanged); 'ai-creative'
 * (default) trusts whatever original title the model/agent actually wrote,
 * falling back to the slot's title only if that's missing/blank (e.g. the
 * model ignored the instruction entirely) so a song is never left titleless.
 */
export interface ReconcilePreassignedOptions {
  /**
   * Bridge imports must preserve the imported hook/lyrics pair. Realtime and
   * Batch paths leave this off so their locally preallocated hook guarantee
   * remains unchanged.
   */
  keepHook?: boolean;
  /**
   * Metadata-only field. Bridge imports may keep the agent's arc because it
   * can describe the imported lyric tone more accurately than the planning
   * slot. Song role stays slot-owned because it drives opener/flagship
   * structure.
   */
  keepEmotionArc?: boolean;
}

export function reconcileWithPreassignedSlot(
  song: SongIdea,
  slot: PreassignedSongSlot | undefined,
  titleMode: 'local' | 'ai-creative' = 'ai-creative',
  options: ReconcilePreassignedOptions = {}
): SongIdea {
  if (!slot) return song;
  const title = titleMode === 'local' ? slot.title : song.title?.trim() ? song.title : slot.title;
  return {
    ...song,
    title,
    hookPhrase: options.keepHook && song.hookPhrase?.trim() ? song.hookPhrase : slot.hookPhrase,
    emotionArc: options.keepEmotionArc && song.emotionArc?.trim() ? song.emotionArc : slot.emotionArc,
    songRole: slot.songRole
  };
}
