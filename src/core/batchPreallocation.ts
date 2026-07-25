import type { GenerationOptions, GenrePack, PreassignedSongSlot, SongIdea } from '../types';
import { createTitleGenerator, hashSeed, seedForBlueprint, UniquePool } from './lyricEngine';
import { averageTempo, emotionArcs, nextContestedTitle, resolveSongRole } from './localGenerator';
import { compactMoneyChord } from './soundSignature';
import { buildProgressionPlan, usesMoneyChordQuota } from './moneyChordPlan';
import {
  buildVocalPlan,
  DEFAULT_KIDS_VOCAL_QUOTA,
  ensureVocalMetaTag,
  enforceVocalTextInStylePrompt,
  resolveVocalMetaTag,
  usesVocalQuota,
  vocalDescriptionFor
} from './vocalPlan';
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
  opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount' | 'genreIds' | 'moodIds' | 'moneyChordMode' | 'customMoneyChord' | 'earwormMode' | 'vocalQuota' | 'vocalTone'>,
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

  // TASK v3.33 Part C — mirrors localGenerator.ts's own pre-pass exactly
  // (same roles, same seed) so the realtime/Batch/bridge paths that call
  // this function agree with the local path on every trackNo's progression.
  const songRoles = Array.from({ length: opts.songCount }, (_, idx) => resolveSongRole(idx + 1, idx));
  const progressionPlan = usesMoneyChordQuota(opts) ? buildProgressionPlan(opts.channel.archetype, seed, songRoles) : null;
  // TASK v3.39 — mirrors progressionPlan immediately above: same pre-pass
  // shape, same seed, so this path (realtime/Batch/bridge) agrees with
  // localGenerator.ts's own buildVocalPlan call on every trackNo's vocal
  // type for the same opts.
  const vocalPlan = usesVocalQuota(opts) ? buildVocalPlan(opts.vocalQuota ?? DEFAULT_KIDS_VOCAL_QUOTA, opts.songCount, seed) : null;
  // TASK v3.39 Part H — every channel (not just kids) now carries a per-song
  // vocalText, so reconcileWithPreassignedSlot below can enforce the
  // selected vocal across realtime/Batch/bridge the same way moneyChordText
  // already enforces the progression. Falls back to the channel's own
  // defaultVocal if this particular request never set vocalTone.
  const fallbackVocalText = opts.vocalTone?.trim() || opts.channel.defaultVocal;

  return Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const songRole = songRoles[idx];
    const { title, hook } = trackNo <= 3
      ? nextContestedTitle(nextTitle, opts.lyricLanguage, opts.channel.archetype, songRole, songRole === 'cold-open' ? 'cold-open' : 'flagship', packContext)
      : nextTitle(songRole);
    const vocalType = vocalPlan ? vocalPlan[idx] : undefined;
    const vocalText = vocalType ? vocalDescriptionFor(vocalType, opts.lyricLanguage) : fallbackVocalText;
    return {
      trackNo,
      title,
      hookPhrase: hook,
      songRole,
      tempo: averageTempo(genres, trackNo),
      emotionArc: emotionArcPool.take(),
      moneyChordText: compactMoneyChord(opts, { moneyChordIdOverride: progressionPlan ? progressionPlan[idx] : undefined, includeFeelReinforcement: true }),
      vocalText,
      ...(vocalType ? { vocalType } : {})
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
 * emotionArc/songRole are ALWAYS forced to the slot's value when a slot
 * exists. "title" and "hookPhrase" are the two fields governed by their own
 * mode: titleMode 'local' forces title to the slot's mechanically-derived
 * value (old behavior, unchanged); 'ai-creative' (default) trusts the
 * model/agent's own title, falling back to the slot's only if blank.
 * hookMode (TASK v3.33) works the same way one field over: 'pool' forces
 * hookPhrase to the slot's composeHook()-drawn value (old behavior,
 * hook-collision-zero via the pool — unconditional before this task);
 * 'ai-creative' (default) trusts the model's own hook, falling back to the
 * slot's only if blank. See GenerationOptions.titleMode/hookMode's comments.
 */
export interface ReconcilePreassignedOptions {
  /**
   * Bridge imports must preserve the imported hook/lyrics pair. Realtime and
   * Batch paths leave this off so hookMode governs hookPhrase normally.
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
  options: ReconcilePreassignedOptions = {},
  /** TASK v3.33 — see GenerationOptions.hookMode. Kept as its own trailing param (not folded into ReconcilePreassignedOptions) since every non-bridge caller passes it explicitly, the same way titleMode is its own positional param rather than an option. */
  hookMode: 'pool' | 'ai-creative' = 'ai-creative'
): SongIdea {
  if (!slot) return song;
  const title = titleMode === 'local' ? slot.title : song.title?.trim() ? song.title : slot.title;
  const hookPhrase = options.keepHook && song.hookPhrase?.trim()
    ? song.hookPhrase
    : hookMode === 'ai-creative' && song.hookPhrase?.trim()
      ? song.hookPhrase
      : slot.hookPhrase;
  // TASK v3.39 Part H — a real showa-cafe channel selected a male vocal
  // preset but a Codex-bridge-generated stylePrompt came back female,
  // because nothing forced the agent's free-form text to actually match the
  // selection. Rather than trust the verbatim-weave instruction alone (see
  // claudeCodeBridge.ts/promptComposer.ts), this deterministically corrects
  // the gender here — the one place realtime/Batch/bridge output all funnel
  // through — regardless of whether the agent complied. No-op when
  // vocalText has no detectable gender (e.g. a children's choir) or when the
  // stylePrompt already matches.
  const vocalFix = enforceVocalTextInStylePrompt(song.stylePrompt, slot.vocalText);
  const vocalTag = resolveVocalMetaTag(slot.vocalType, slot.vocalText);
  return {
    ...song,
    title,
    hookPhrase,
    stylePrompt: vocalFix.text,
    lyrics: ensureVocalMetaTag(song.lyrics, vocalTag),
    emotionArc: options.keepEmotionArc && song.emotionArc?.trim() ? song.emotionArc : slot.emotionArc,
    songRole: slot.songRole,
    // TASK v3.39 — vocalType is slot-owned like songRole/emotionArc: it
    // drives the per-song male/female/mixed quota, so a realtime/Batch/
    // bridge response can never silently drift from the locally-decided
    // plan. Non-kids slots never set this field, so this is a no-op there.
    ...(slot.vocalType ? { vocalType: slot.vocalType } : {})
  };
}
