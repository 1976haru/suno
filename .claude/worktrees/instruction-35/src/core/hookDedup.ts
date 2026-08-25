import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, SongIdea } from '../types';
import { regenerateTrack } from '../providers/index';

/**
 * TASK v3.33 — hookMode='ai-creative' (see GenerationOptions.hookMode) lets
 * the model write its own hookPhrase instead of copying a locally
 * pre-decided pool slot, so unlike the old pool-locked behavior, two songs
 * genuinely can land on the same hook (parallel chunks/sub-batches can't see
 * each other's real pick — same reasoning as core/lyricEngine.ts's
 * dedupeTitlesAcrossPack for titles). Unlike titles, a hook can't be
 * text-mutated to make it unique after the fact: the hookPhrase is baked
 * into the lyrics as the literal chorus-bookend line, so silently rewriting
 * just the field would desync it from the lyrics content (the same reason
 * core/claudeCodeBridge.ts's flagHookCollisions never auto-rewrites either).
 * The only safe fix is regenerating the whole song via the existing
 * regenerateTrack (providers/index.ts), which already treats a hook
 * collision as one of its retry gates.
 */
export interface HookCollision {
  trackNo: number;
  hookPhrase: string;
  /** 'within-pack': collides with another song in this same generation run (this set, or an earlier set in the same multi-set run). 'ledger': collides with a hook already recorded for this channel in an older pack. */
  reason: 'within-pack' | 'ledger';
}

/** Pure — detects every trackNo whose hookPhrase either repeats within `songs` or matches something in `avoidHooks` (the channel's recent hook history, see hookLedger.ts's recentUsedTitlesAndHooks). */
export function detectHookCollisions(songs: Pick<SongIdea, 'trackNo' | 'hookPhrase'>[], avoidHooks: string[] = []): HookCollision[] {
  const avoidSet = new Set(avoidHooks.map(hook => hook.trim().toLowerCase()).filter(Boolean));
  const byHook = new Map<string, number[]>();
  for (const song of songs) {
    const key = song.hookPhrase.trim().toLowerCase();
    if (!key) continue;
    byHook.set(key, [...(byHook.get(key) ?? []), song.trackNo]);
  }

  const collisions: HookCollision[] = [];
  for (const [key, trackNos] of byHook) {
    if (trackNos.length > 1) {
      for (const trackNo of trackNos) collisions.push({ trackNo, hookPhrase: key, reason: 'within-pack' });
    } else if (avoidSet.has(key)) {
      collisions.push({ trackNo: trackNos[0], hookPhrase: key, reason: 'ledger' });
    }
  }
  return collisions.sort((a, b) => a.trackNo - b.trackNo);
}

/** Initial generation + this many regenerate-on-collision passes, per the spec ("최대 2회"). Bounded: at most HOOK_DEDUP_MAX_ROUNDS full passes over whatever's still colliding each round. */
const HOOK_DEDUP_MAX_ROUNDS = 2;

export interface ResolveHookCollisionsResult {
  blueprint: PlaylistBlueprint;
  /** Korean, one per trackNo that still collides after HOOK_DEDUP_MAX_ROUNDS attempts — surfaced to the UI as a non-blocking warning, never thrown. */
  warnings: string[];
}

/**
 * Detects hook collisions in `blueprint` and regenerates each colliding
 * track (via the existing regenerateTrack, reused as-is — it already checks
 * a candidate's hook against every other song plus the avoid list) up to
 * HOOK_DEDUP_MAX_ROUNDS times. Only meaningful when hookMode is
 * 'ai-creative' — under 'pool' mode hookPhrase is always forced from the
 * locally preallocated slot, so detectHookCollisions should never find
 * anything (hook-collision-zero stays a hard guarantee in that mode).
 */
export async function resolveHookCollisions(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): Promise<ResolveHookCollisionsResult> {
  let current = blueprint;

  for (let round = 0; round < HOOK_DEDUP_MAX_ROUNDS; round++) {
    const collisions = detectHookCollisions(current.songs, avoid?.usedHooks ?? []);
    if (!collisions.length) break;
    for (const collision of collisions) {
      const { blueprint: next } = await regenerateTrack(
        current,
        collision.trackNo,
        opts,
        genres,
        moods,
        season,
        settings,
        [`hook collision: "${collision.hookPhrase}" was already used elsewhere — write a different original hook`],
        avoid
      );
      current = next;
    }
  }

  const residual = detectHookCollisions(current.songs, avoid?.usedHooks ?? []);
  const warnings = residual.map(
    collision => `${collision.trackNo}번: 훅 중복이 ${HOOK_DEDUP_MAX_ROUNDS}회 재시도 후에도 해결되지 않았습니다 ("${collision.hookPhrase}").`
  );
  return { blueprint: current, warnings };
}
