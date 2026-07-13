import type {
  BatchContext,
  GenerationOptions,
  GenerationProgress,
  GenrePack,
  MoodPack,
  PlaylistBlueprint,
  PlaylistIdentity,
  ProviderSettings,
  SeasonPack,
  SongIdea
} from '../types';
import { generateLocalBlueprint } from '../core/localGenerator';
import { scoreSongs } from '../core/quality';
import { assertLyricDiversity } from '../core/lyricEngine';
import { recordUsage } from '../core/usageLedger';
import { generateWithOpenAI, type ProviderCallResult } from './openai';
import { generateWithAnthropic } from './anthropic';

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

  const batchSize = Math.min(12, Math.max(1, Math.round(settings.batchSize || DEFAULT_BATCH_SIZE)));
  const batches = chunkRange(opts.songCount, batchSize);
  let lockedIdentity: PlaylistIdentity | null = null;
  let base: Omit<PlaylistBlueprint, 'songs'> | null = null;
  const allSongs: PlaylistBlueprint['songs'] = [];

  for (const [index, trackNumbers] of batches.entries()) {
    const batchOpts: GenerationOptions = { ...opts, songCount: trackNumbers.length };
    const batchContext: BatchContext = {
      trackNoOffset: trackNumbers[0] - 1,
      totalSongCount: opts.songCount,
      usedTitles: [...(avoid?.usedTitles ?? []), ...allSongs.map(song => song.title)],
      usedHooks: [...(avoid?.usedHooks ?? []), ...allSongs.map(song => song.hookPhrase)],
      lockedIdentity
    };

    const { blueprint: result, usage } = await callProviderBatch(settings, batchOpts, genres, moods, season, batchContext);
    void recordProviderUsage(settings, 'generate', usage);

    if (index === 0) {
      base = {
        projectTitle: result.projectTitle || opts.projectTitle,
        channelName: result.channelName || opts.channel.name,
        oneLineConcept: result.oneLineConcept,
        sonicSignature: result.sonicSignature,
        vocalSignature: result.vocalSignature,
        lyricRules: result.lyricRules,
        harmonyRules: result.harmonyRules,
        visualRules: result.visualRules
      };
      lockedIdentity = extractIdentity(result);
    }

    allSongs.push(...(result.songs || []));
    onProgress?.({ done: allSongs.length, total: opts.songCount, songs: [...allSongs] });
  }

  const blueprint: PlaylistBlueprint = {
    ...(base as Omit<PlaylistBlueprint, 'songs'>),
    songs: allSongs
  };

  return { ...blueprint, songs: scoreSongs(blueprint.songs, opts.channel, opts.lyricLanguage) };
}

const REGENERATE_MAX_ATTEMPTS = 3; // initial try + 2 retries
const REGENERATE_QUALITY_BAR = 70;

function collidesWithOthers(candidate: SongIdea, usedTitles: string[], usedHooks: string[]): boolean {
  const title = candidate.title.toLowerCase();
  const hook = candidate.hookPhrase.toLowerCase();
  return usedTitles.some(t => t.toLowerCase() === title) || usedHooks.some(h => h.toLowerCase() === hook);
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
  const usedTitles = [...(avoid?.usedTitles ?? []), ...others.map(song => song.title)];
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
      const usedTitles = [...(avoid?.usedTitles ?? []), ...others.map(song => song.title)];
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
