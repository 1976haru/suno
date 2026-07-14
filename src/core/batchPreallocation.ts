import type { GenerationOptions, GenrePack, PreassignedSongSlot } from '../types';
import { createTitleGenerator, hashSeed, seedForBlueprint, UniquePool } from './lyricEngine';
import { averageTempo, emotionArcs, songRoles } from './localGenerator';

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
  opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount'>,
  genres: GenrePack[],
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): PreassignedSongSlot[] {
  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  const emotionArcPool = new UniquePool(emotionArcs, seed + 22);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype);

  return Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const songRole = songRoles[Math.min(idx, songRoles.length - 1)];
    const { title, hook } = nextTitle(songRole);
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
