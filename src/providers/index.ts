import type {
  BatchContext,
  GenerationOptions,
  GenerationProgress,
  GenrePack,
  MoodPack,
  PlaylistBlueprint,
  PlaylistIdentity,
  PreassignedSongSlot,
  ProviderSettings,
  SeasonPack,
  SongIdea
} from '../types';
import { generateLocalBlueprint } from '../core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot, slotsForRange } from '../core/batchPreallocation';
import { scoreSongs } from '../core/quality';
import { assertLyricDiversity, dedupeTitlesAcrossPack } from '../core/lyricEngine';
import { recordUsage } from '../core/usageLedger';
import { stripSetTitlePrefix } from '../utils/generation';
import { generateWithOpenAI, type ProviderCallResult } from './openai';
import { generateWithAnthropic } from './anthropic';
import { ProxyError } from './proxyFetch';

async function recordProviderUsage(settings: ProviderSettings, purpose: 'generate' | 'refine', usage: ProviderCallResult['usage']) {
  if (!usage) return;
  try {
    await recordUsage({
      provider: settings.provider,
      model: settings.model || settings.provider,
      purpose,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheHit: false,
      cacheReadTokens: usage.cacheReadInputTokens || 0
    });
  } catch {
    // Usage tracking is a convenience dashboard, not critical path; never block generation on it.
  }
}

export const DEFAULT_BATCH_SIZE = 6;

export function chunkRange(total: number, size: number): number[][] {
  const batches: number[][] = [];
  for (let start = 1; start <= total; start += size) {
    const end = Math.min(start + size - 1, total);
    batches.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }
  return batches;
}

export function extractIdentity(blueprint: PlaylistBlueprint): PlaylistIdentity {
  return {
    oneLineConcept: blueprint.oneLineConcept,
    sonicSignature: blueprint.sonicSignature,
    vocalSignature: blueprint.vocalSignature,
    lyricRules: blueprint.lyricRules,
    harmonyRules: blueprint.harmonyRules,
    visualRules: blueprint.visualRules
  };
}

export async function callProviderBatch(
  settings: ProviderSettings,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  batch: BatchContext
): Promise<ProviderCallResult> {
  if (settings.provider === 'openai') return generateWithOpenAI(opts, genres, moods, season, settings, batch);
  return generateWithAnthropic(opts, genres, moods, season, settings, batch);
}

export interface GenerateChunkIdentity {
  base: Omit<PlaylistBlueprint, 'songs'> | null;
  locked: PlaylistIdentity | null;
}

const MIN_SPLIT_RETRY_SIZE = 1;

/**
 * TASK v3.21 — when even a single song truncates at the normal per-song
 * max_tokens budget, retry it exactly once pretending the request was for
 * this many songs (purely for the max_tokens formula — trackNumbers/opts
 * still only ask for the real 1 song). See BatchContext.maxTokensBudgetSongs
 * and api/generate.js's resolveTokenBudgetSize.
 */
const SINGLE_SONG_BUDGET_BOOST_SONGS = 4;

/**
 * TASK v3.20 — real Claude output per song runs well past the local
 * generator's template, so a batch that would have fit comfortably can
 * still hit stop_reason: 'max_tokens' on the actual API. api/generate.js
 * signals this distinctly via error.code === 'TRUNCATED' (ProxyError)
 * instead of a generic failure, so instead of failing the whole request,
 * split the chunk in half and retry each half — recursively, if a half
 * still truncates — merging results back in trackNo order. Only gives up
 * (surfacing a "reduce the song count" error) once a single song alone
 * still truncates at a boosted budget too, since there's nothing smaller
 * left to try (TASK v3.21: the boosted-budget retry below).
 *
 * preassignedSongs (TASK v3.21), if given, is filtered to this call's own
 * trackNumbers and threaded into the request — see generateBlueprint's
 * Anthropic branch for why: parallel sibling chunks can't see each other's
 * real output, so titles/hooks are decided locally up front instead of
 * left for the model to invent (same mechanism the Batch API already used
 * for parallel sub-batches).
 */
export async function generateChunkWithSplitRetry(
  trackNumbers: number[],
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  avoid: { usedTitles: string[]; usedHooks: string[] },
  identity: GenerateChunkIdentity,
  preassignedSongs?: PreassignedSongSlot[],
  /** internal only — set true for the one-shot budget-boost retry so it can't recurse into itself. */
  boosted = false
): Promise<PlaylistBlueprint['songs']> {
  const batchOpts: GenerationOptions = { ...opts, songCount: trackNumbers.length };
  const batchContext: BatchContext = {
    trackNoOffset: trackNumbers[0] - 1,
    totalSongCount: opts.songCount,
    usedTitles: avoid.usedTitles,
    usedHooks: avoid.usedHooks,
    lockedIdentity: identity.locked,
    preassignedSongs: preassignedSongs ? slotsForRange(preassignedSongs, trackNumbers) : undefined,
    maxTokensBudgetSongs: boosted ? SINGLE_SONG_BUDGET_BOOST_SONGS : undefined
  };

  try {
    const { blueprint: result, usage } = await callProviderBatch(settings, batchOpts, genres, moods, season, batchContext);
    void recordProviderUsage(settings, 'generate', usage);

    if (!identity.base) {
      identity.base = {
        projectTitle: result.projectTitle || opts.projectTitle,
        channelName: result.channelName || opts.channel.name,
        oneLineConcept: result.oneLineConcept,
        sonicSignature: result.sonicSignature,
        vocalSignature: result.vocalSignature,
        lyricRules: result.lyricRules,
        harmonyRules: result.harmonyRules,
        visualRules: result.visualRules
      };
      identity.locked = extractIdentity(result);
    }
    // TASK v3.27 (Part A3) — the same reconciliation stitchBatchResults
    // already applies to Batch API sub-results: hookPhrase/emotionArc/
    // songRole always win from the locally pre-decided slot (hook-collision-
    // zero is unconditional), while "title" only does in 'local' titleMode —
    // by default ('ai-creative') the model's own title for this chunk is
    // trusted. Cross-chunk title collisions (parallel siblings can't see
    // each other's pick any more than they could before) are handled once
    // the whole pack is merged — see generateBlueprint's dedupeTitlesAcrossPack call.
    const titleMode = opts.titleMode ?? 'ai-creative';
    const hookMode = opts.hookMode ?? 'ai-creative';
    const slotByTrackNo = new Map((batchContext.preassignedSongs ?? []).map(slot => [slot.trackNo, slot]));
    return (result.songs || []).map(song => reconcileWithPreassignedSlot(song, slotByTrackNo.get(song.trackNo), titleMode, {}, hookMode));
  } catch (error) {
    const isTruncated = error instanceof ProxyError && error.code === 'TRUNCATED';
    if (isTruncated && trackNumbers.length > MIN_SPLIT_RETRY_SIZE) {
      const mid = Math.ceil(trackNumbers.length / 2);
      const firstHalf = trackNumbers.slice(0, mid);
      const secondHalf = trackNumbers.slice(mid);
      const firstSongs = await generateChunkWithSplitRetry(firstHalf, opts, genres, moods, season, settings, avoid, identity, preassignedSongs);
      const combinedAvoid = {
        usedTitles: [...avoid.usedTitles, ...firstSongs.map(song => stripSetTitlePrefix(song.title))],
        usedHooks: [...avoid.usedHooks, ...firstSongs.map(song => song.hookPhrase)]
      };
      const secondSongs = await generateChunkWithSplitRetry(secondHalf, opts, genres, moods, season, settings, combinedAvoid, identity, preassignedSongs);
      return [...firstSongs, ...secondSongs];
    }
    if (isTruncated && !boosted) {
      return generateChunkWithSplitRetry(trackNumbers, opts, genres, moods, season, settings, avoid, identity, preassignedSongs, true);
    }
    if (isTruncated) {
      throw new Error('응답이 계속 잘립니다. 곡 수를 줄여보세요.');
    }
    throw error;
  }
}

/**
 * TASK v3.21 — runs `worker` over `items` with at most `limit` concurrent
 * calls in flight. Unlike Promise.all(items.map(worker)), a rejection
 * doesn't abort in-flight siblings or lose their results — every item gets
 * a chance to finish (worker is expected to record its own success as a
 * side effect, e.g. into a shared map, before this function ever looks at
 * outcomes), and only after all settle does this throw one aggregated error
 * naming every item that failed. This is what keeps a single failing chunk
 * from discarding chunks that already succeeded.
 */
export async function runWithConcurrencyLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const failures: { item: T; error: unknown }[] = [];
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const current = nextIndex++;
    if (current >= items.length) return;
    try {
      await worker(items[current]);
    } catch (error) {
      failures.push({ item: items[current], error });
    }
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));

  if (failures.length) {
    const firstMessage = failures[0].error instanceof Error ? failures[0].error.message : String(failures[0].error);
    throw new Error(`${failures.length}개 청크 생성에 실패했습니다: ${firstMessage}`);
  }
}

/** TASK v3.21 — real-time Anthropic chunk size: small on purpose (see generateBlueprint's Anthropic branch), configurable via settings.batchSize but clamped much tighter than the old 1-12 range. */
const REALTIME_CHUNK_SIZE_DEFAULT = 2;
const REALTIME_CHUNK_SIZE_MAX = 3;
/** Anthropic's per-account rate limits vary; 3 concurrent requests is fast without courting 429s on a typical tier. */
const REALTIME_CONCURRENCY = 3;

export async function generateBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  onProgress?: (progress: GenerationProgress) => void,
  /** TASK X1 (v3.4) — this channel's cross-pack hook/title history, so a new pack never silently reuses a title from an older one. Capped by the caller (see core/hookLedger.ts's recentUsedTitlesAndHooks) before being sent to a remote LLM, to bound prompt token cost. */
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): Promise<PlaylistBlueprint> {
  if (settings.provider === 'local') {
    const blueprint = generateLocalBlueprint(opts, genres, moods, season, avoid, settings.promptCharLimit);
    const songs = scoreSongs(blueprint.songs, opts.channel, opts.lyricLanguage);
    onProgress?.({ done: songs.length, total: opts.songCount, songs });
    return { ...blueprint, songs };
  }

  const identity: GenerateChunkIdentity = { base: null, locked: null };
  const songsByTrackNo = new Map<number, PlaylistBlueprint['songs'][number]>();
  const reportProgress = () => {
    const songs = [...songsByTrackNo.values()].sort((a, b) => a.trackNo - b.trackNo);
    onProgress?.({ done: songs.length, total: opts.songCount, songs });
  };

  if (settings.provider === 'anthropic') {
    // TASK v3.21 — real Claude output is rich enough that even the raised
    // v3.20 max_tokens budget kept truncating at the old up-to-12-song
    // chunk size. Small fixed chunks (default 2, 1-3 range) never come
    // close to any max_tokens budget, and running them with bounded
    // concurrency instead of one at a time keeps this from being 6x slower.
    // The first chunk still runs alone — it's what locks sonicSignature/
    // vocalSignature/etc — then the rest run in parallel against that
    // locked identity. Titles/hooks are pre-decided locally (preallocateSongSlots,
    // the same mechanism the Batch API already used for parallel sub-batches)
    // instead of left for the model to invent, since concurrent siblings
    // can't see each other's real output to avoid colliding on their own.
    const chunkSize = Math.min(REALTIME_CHUNK_SIZE_MAX, Math.max(1, Math.round(settings.batchSize || REALTIME_CHUNK_SIZE_DEFAULT)));
    const batches = chunkRange(opts.songCount, chunkSize);
    const preassignedSongs = preallocateSongSlots(opts, genres, avoid);
    const baseAvoid = { usedTitles: avoid?.usedTitles ?? [], usedHooks: avoid?.usedHooks ?? [] };

    const [firstChunk, ...restChunks] = batches;
    if (firstChunk) {
      const songs = await generateChunkWithSplitRetry(firstChunk, opts, genres, moods, season, settings, baseAvoid, identity, preassignedSongs);
      for (const song of songs) songsByTrackNo.set(song.trackNo, song);
      reportProgress();
    }

    if (restChunks.length) {
      await runWithConcurrencyLimit(restChunks, REALTIME_CONCURRENCY, async trackNumbers => {
        const songs = await generateChunkWithSplitRetry(trackNumbers, opts, genres, moods, season, settings, baseAvoid, identity, preassignedSongs);
        for (const song of songs) songsByTrackNo.set(song.trackNo, song);
        reportProgress();
      });
    }
  } else {
    // OpenAI: unchanged from v3.20 — sequential, larger chunks. Kept
    // separate from the Anthropic branch above because OpenAI's own prompt
    // builder (buildUserInstruction) doesn't forward preassignedSongs, so
    // parallelizing it today would reopen the title/hook collision risk
    // preallocation exists to prevent. Nothing has reported OpenAI hitting
    // the truncation problem this task fixes, so its proven sequential path
    // is left as-is rather than risking a new bug to fix one that doesn't
    // exist yet.
    const batchSize = Math.min(12, Math.max(1, Math.round(settings.batchSize || DEFAULT_BATCH_SIZE)));
    const batches = chunkRange(opts.songCount, batchSize);
    for (const trackNumbers of batches) {
      const priorSongs = [...songsByTrackNo.values()];
      const chunkAvoid = {
        usedTitles: [...(avoid?.usedTitles ?? []), ...priorSongs.map(song => stripSetTitlePrefix(song.title))],
        usedHooks: [...(avoid?.usedHooks ?? []), ...priorSongs.map(song => song.hookPhrase)]
      };
      const songs = await generateChunkWithSplitRetry(trackNumbers, opts, genres, moods, season, settings, chunkAvoid, identity);
      for (const song of songs) songsByTrackNo.set(song.trackNo, song);
      reportProgress();
    }
  }

  const mergedSongs = [...songsByTrackNo.values()].sort((a, b) => a.trackNo - b.trackNo);
  // TASK v3.27 (Part A3) — parallel chunks (Anthropic branch) or independent
  // sequential batches (OpenAI branch) can each land on the same AI-creative
  // title with no visibility into each other's pick; catch and auto-uniquify
  // it here against both the rest of this pack and the channel's cross-pack
  // history, same as the Batch API / Claude Code bridge paths.
  const { songs: allSongs } = dedupeTitlesAcrossPack(mergedSongs, avoid?.usedTitles ?? []);
  const blueprint: PlaylistBlueprint = {
    ...(identity.base as Omit<PlaylistBlueprint, 'songs'>),
    songs: allSongs
  };

  return { ...blueprint, songs: scoreSongs(blueprint.songs, opts.channel, opts.lyricLanguage) };
}

const REGENERATE_MAX_ATTEMPTS = 3; // initial try + 2 retries
const REGENERATE_QUALITY_BAR = 70;

function collidesWithOthers(candidate: SongIdea, usedTitles: string[], usedHooks: string[]): boolean {
  const title = stripSetTitlePrefix(candidate.title).toLowerCase();
  const hook = candidate.hookPhrase.toLowerCase();
  return usedTitles.some(t => stripSetTitlePrefix(t).toLowerCase() === title) || usedHooks.some(h => h.toLowerCase() === hook);
}

function tooSimilarToOthers(candidate: SongIdea, others: SongIdea[], trackNo: number): boolean {
  return assertLyricDiversity([...others, candidate], 0.4).some(pair => pair.trackA === trackNo || pair.trackB === trackNo);
}

export interface RegenerateTrackResult {
  blueprint: PlaylistBlueprint;
  warning?: string;
}

/**
 * Regenerates exactly one track instead of the whole pack — evaluator
 * rejections are usually 1-3 songs out of up to 30, so re-running the full
 * batch to fix them would waste most of the API cost on songs that were
 * already fine. Retries up to REGENERATE_MAX_ATTEMPTS times (varying the
 * seed/sampling each attempt) until the candidate clears the quality bar
 * and doesn't collide or overlap with the rest of the pack; if every
 * attempt falls short, the last candidate is still returned (with a
 * warning) rather than leaving the track blank or looping forever.
 */
export async function regenerateTrack(
  blueprint: PlaylistBlueprint,
  trackNo: number,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  feedback: string[] = [],
  /** TASK X1 (v3.4) — cross-pack hook/title history, merged in alongside the rest of this pack so a regenerated track can't collide with a hook used in a *different* pack either. */
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): Promise<RegenerateTrackResult> {
  const others = blueprint.songs.filter(song => song.trackNo !== trackNo);
  const usedTitles = [...(avoid?.usedTitles ?? []), ...others.map(song => stripSetTitlePrefix(song.title))];
  const usedHooks = [...(avoid?.usedHooks ?? []), ...others.map(song => song.hookPhrase)];
  const avoidWords = [opts.avoidWords, ...feedback].filter(Boolean).join('; ');
  const feedbackNote = feedback.length
    ? `previous attempt was rejected for: ${feedback.join('; ')}. Rewrite to avoid these specific issues.`
    : '';
  const candidateOpts: GenerationOptions = { ...opts, songCount: 1, avoidWords, customConcept: [opts.customConcept, feedbackNote].filter(Boolean).join(' ') };

  let candidate: SongIdea | null = null;
  let warning: string | undefined;

  for (let attempt = 0; attempt < REGENERATE_MAX_ATTEMPTS; attempt++) {
    let raw: SongIdea;
    if (settings.provider === 'local') {
      const single = generateLocalBlueprint(
        { ...candidateOpts, projectTitle: `${opts.projectTitle}::retry-${trackNo}-${attempt}-${Date.now()}` },
        genres,
        moods,
        season,
        { usedTitles, usedHooks },
        settings.promptCharLimit
      );
      raw = { ...single.songs[0], trackNo };
    } else {
      const batchContext: BatchContext = {
        trackNoOffset: trackNo - 1,
        totalSongCount: blueprint.songs.length,
        usedTitles,
        usedHooks,
        lockedIdentity: extractIdentity(blueprint)
      };
      const { blueprint: result, usage } = await callProviderBatch(settings, candidateOpts, genres, moods, season, batchContext);
      void recordProviderUsage(settings, 'refine', usage);
      raw = { ...result.songs[0], trackNo };
    }

    candidate = scoreSongs([raw], opts.channel, opts.lyricLanguage)[0];
    const collides = collidesWithOthers(candidate, usedTitles, usedHooks);
    const tooSimilar = tooSimilarToOthers(candidate, others, trackNo);
    const meetsQualityBar = candidate.qualityScore >= REGENERATE_QUALITY_BAR;

    if (meetsQualityBar && !collides && !tooSimilar) {
      warning = undefined;
      break;
    }
    warning = collides
      ? '재생성된 곡이 팩 안의 다른 곡과 제목/후렴이 겹칩니다.'
      : tooSimilar
        ? '재생성된 곡이 팩 안의 다른 곡과 가사가 너무 비슷합니다.'
        : `재생성된 곡의 품질 점수(${candidate.qualityScore}/100)가 기준(${REGENERATE_QUALITY_BAR})에 못 미칩니다.`;
  }

  // TASK B3 (v3.6) — a batch job's stitched result can be missing a trackNo
  // entirely (not just low-quality), e.g. when recovering from a canceled
  // job's partial results; insert rather than only ever replacing in place.
  const exists = blueprint.songs.some(song => song.trackNo === trackNo);
  const songs = exists
    ? blueprint.songs.map(song => (song.trackNo === trackNo ? (candidate as SongIdea) : song))
    : [...blueprint.songs, candidate as SongIdea].sort((a, b) => a.trackNo - b.trackNo);
  return { blueprint: { ...blueprint, songs }, warning: warning ? `${warning} (최대 ${REGENERATE_MAX_ATTEMPTS}회 시도 후 최선의 결과를 사용합니다.)` : undefined };
}

const REFINE_BATCH_THRESHOLD = 4; // below this, per-track calls are cheap enough that failure isolation matters more than token savings
const REFINE_BATCH_SIZE = 6;

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface RefineTracksResult {
  blueprint: PlaylistBlueprint;
  warnings: string[];
}

/**
 * TASK C1 (v3.3): regenerateTrack's per-song call re-sends the full system
 * prompt + channel profile + accumulated usedTitles/usedHooks on every
 * single call, so refining N selected tracks one-by-one costs roughly N
 * times that overhead. Below REFINE_BATCH_THRESHOLD the per-track path
 * stays (failure isolation and the collision/quality retry loop matter more
 * than the token savings for 1-3 songs); at or above it, selected tracks
 * are grouped into REFINE_BATCH_SIZE-sized batches and each batch is
 * requested as a single multi-song API call, with the returned songs
 * positionally remapped onto the actual (possibly non-contiguous) selected
 * trackNos. A failed batch only drops that batch's tracks (with a warning)
 * — it never discards results already applied from other batches.
 */
export async function refineTracks(
  blueprint: PlaylistBlueprint,
  trackNos: number[],
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  feedback: string[] = [],
  onProgress?: (done: number, total: number) => void,
  /** TASK X1 (v3.4) — cross-pack hook/title history. */
  avoid?: { usedTitles?: string[]; usedHooks?: string[] }
): Promise<RefineTracksResult> {
  const total = trackNos.length;
  if (settings.provider === 'local' || trackNos.length < REFINE_BATCH_THRESHOLD) {
    let current = blueprint;
    const warnings: string[] = [];
    let done = 0;
    for (const trackNo of trackNos) {
      const { blueprint: next, warning } = await regenerateTrack(current, trackNo, opts, genres, moods, season, settings, feedback, avoid);
      current = next;
      if (warning) warnings.push(`${trackNo}번: ${warning}`);
      done += 1;
      onProgress?.(done, total);
    }
    return { blueprint: current, warnings };
  }

  let current = blueprint;
  const warnings: string[] = [];
  let done = 0;
  const avoidWords = [opts.avoidWords, ...feedback].filter(Boolean).join('; ');
  const feedbackNote = feedback.length
    ? `previous attempt was rejected for: ${feedback.join('; ')}. Rewrite to avoid these specific issues.`
    : '';

  for (const chunk of chunkArray(trackNos, REFINE_BATCH_SIZE)) {
    try {
      const others = current.songs.filter(song => !chunk.includes(song.trackNo));
      const usedTitles = [...(avoid?.usedTitles ?? []), ...others.map(song => stripSetTitlePrefix(song.title))];
      const usedHooks = [...(avoid?.usedHooks ?? []), ...others.map(song => song.hookPhrase)];
      const batchOpts: GenerationOptions = {
        ...opts,
        songCount: chunk.length,
        avoidWords,
        customConcept: [opts.customConcept, feedbackNote].filter(Boolean).join(' ')
      };
      const batchContext: BatchContext = {
        trackNoOffset: 0,
        totalSongCount: current.songs.length,
        usedTitles,
        usedHooks,
        lockedIdentity: extractIdentity(current)
      };

      const { blueprint: result, usage } = await callProviderBatch(settings, batchOpts, genres, moods, season, batchContext);
      void recordProviderUsage(settings, 'refine', usage);

      const remapped = (result.songs || []).map((song, i) => ({ ...song, trackNo: chunk[i] }));
      const scored = scoreSongs(remapped, opts.channel, opts.lyricLanguage);
      const byTrackNo = new Map(scored.map(song => [song.trackNo, song]));
      const songs = current.songs.map(song => byTrackNo.get(song.trackNo) ?? song);
      current = { ...current, songs };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      warnings.push(`${chunk.join(', ')}번 곡 배치 보정에 실패했습니다: ${message} (다른 배치의 결과는 정상 반영되었습니다.)`);
    }
    done += chunk.length;
    onProgress?.(done, total);
  }

  return { blueprint: current, warnings };
}
