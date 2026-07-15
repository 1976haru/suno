import type { ChannelArchetype, DisplayLanguage, ProviderSettings } from '../types';
import { getCoreGenreIdsForArchetype, getCoreGenresForArchetype, getGenreById } from '../data/genreLibrary';
import { moodPacks, seasonPacks } from '../data/presets';
import { vocalPresets } from '../data/vocalPresets';
import { CONCEPT_KEYWORD_RULES, matchConceptRules } from '../data/conceptKeywords';
import { callGenerateProxy } from '../providers/proxyFetch';
import { buildProxyHeaders } from '../providers/proxyFetch';
import { MODEL_REGISTRY, defaultModelFor } from '../data/modelRegistry';
import { getConceptCache, setConceptCache } from './library';
import { recordUsage } from './usageLedger';

export interface ConceptRecommendation {
  id: string;
  genreId: string;
  moodIds: string[];
  seasonId: string;
  vocalPresetId: string;
  reasonKo: string;
  previewLine: string;
  confidence: 'high' | 'medium';
}

export interface ConceptAgentResult {
  input: string;
  recommendations: ConceptRecommendation[];
  method: 'local' | 'api';
}

export interface ConceptWhitelist {
  genreIds: string[];
  moodIds: string[];
  seasonIds: string[];
  vocalPresetIds: string[];
}

/**
 * TASK H2 (v3.10) — never the full 264-genre library; only this archetype's
 * core tier (<=12 ids), same restriction the concept grid itself already
 * enforces (see genreLibrary.ts's getCoreGenresForArchetype). Recommending
 * an 'extended' genre (Bebop, Big Band, ...) would break the channel's tone.
 */
export function buildConceptWhitelist(archetype: ChannelArchetype): ConceptWhitelist {
  return {
    genreIds: getCoreGenreIdsForArchetype(archetype),
    moodIds: moodPacks.map(mood => mood.id),
    seasonIds: seasonPacks.map(season => season.id),
    vocalPresetIds: vocalPresets.map(preset => preset.id)
  };
}

export function validateRecommendation(rec: ConceptRecommendation, whitelist: ConceptWhitelist): boolean {
  if (!whitelist.genreIds.includes(rec.genreId)) return false;
  if (!rec.moodIds.length || !rec.moodIds.every(id => whitelist.moodIds.includes(id))) return false;
  if (!whitelist.seasonIds.includes(rec.seasonId)) return false;
  if (rec.vocalPresetId && !whitelist.vocalPresetIds.includes(rec.vocalPresetId)) return false;
  return true;
}

function normalizeInput(freeText: string): string {
  return freeText.trim().toLowerCase().replace(/\s+/g, ' ');
}

const PREVIEW_WORDS_BY_MOOD: Record<string, string[]> = {
  nostalgic: ['Old Radio Light', 'Familiar Song', 'Quiet Memory'],
  warm: ['Warm Coffee', 'Gentle Morning', 'Soft Light'],
  bittersweet: ['Falling Leaves', 'Quiet Rain', 'Distant Song'],
  hopeful: ['New Morning', 'Open Sky', 'Fresh Start'],
  romantic: ['Shared Umbrella', 'Soft Rain Walk', 'Quiet Confession'],
  christmas: ['Winter Coffee Light', 'Quiet Bells', 'Candle Window'],
  'calm-focus': ['Slow Afternoon', 'Quiet Desk', 'Steady Hour'],
  'fresh-start': ['Clean Morning', 'Open Calendar', 'New Page'],
  'rainy-comfort': ['Rain Window', 'Warm Inside', 'Umbrella Light'],
  elegant: ['Porcelain Cup', 'Quiet Lobby', 'Old Record']
};

function pickPreviewLine(moodId: string, seed: number): string {
  const pool = PREVIEW_WORDS_BY_MOOD[moodId] || PREVIEW_WORDS_BY_MOOD.warm;
  return pool[Math.abs(seed) % pool.length];
}

function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface RankedScores {
  genres: string[];
  moods: string[];
  seasons: string[];
}

function rankFromRules(freeText: string, coreGenreIds: Set<string>): RankedScores {
  const matched = matchConceptRules(freeText);
  const genreScore = new Map<string, number>();
  const moodScore = new Map<string, number>();
  const seasonScore = new Map<string, number>();

  for (const rule of matched) {
    for (const [id, weight] of Object.entries(rule.genreWeights || {})) {
      if (!coreGenreIds.has(id)) continue;
      genreScore.set(id, (genreScore.get(id) || 0) + weight);
    }
    for (const [id, weight] of Object.entries(rule.moodWeights || {})) {
      moodScore.set(id, (moodScore.get(id) || 0) + weight);
    }
    for (const [id, weight] of Object.entries(rule.seasonWeights || {})) {
      seasonScore.set(id, (seasonScore.get(id) || 0) + weight);
    }
  }

  const rank = (scores: Map<string, number>) => [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return { genres: rank(genreScore), moods: rank(moodScore), seasons: rank(seasonScore) };
}

function buildRecommendation(input: {
  id: string;
  genreId: string;
  moodIds: string[];
  seasonId: string;
  reasonKo: string;
  confidence: 'high' | 'medium';
}): ConceptRecommendation {
  const primaryMood = input.moodIds[0] || 'warm';
  const seed = hashSeed(`${input.genreId}::${primaryMood}::${input.seasonId}`);
  return {
    id: input.id,
    genreId: input.genreId,
    moodIds: input.moodIds,
    seasonId: input.seasonId,
    vocalPresetId: vocalPresets[0].id,
    reasonKo: input.reasonKo,
    previewLine: pickPreviewLine(primaryMood, seed),
    confidence: input.confidence
  };
}

function seasonLabelKo(seasonId: string): string {
  return seasonPacks.find(season => season.id === seasonId)?.label || seasonId;
}

function genreLabelKo(genreId: string): string {
  return getGenreById(genreId)?.label || genreId;
}

/**
 * TASK H3 (v3.10) — API-free path; always returns at least one
 * recommendation ("아무것도 안 걸리면 채널 대표 조합을 기본 추천으로"). When two
 * genre candidates are roughly equally supported by the input, returns two
 * different angles side by side instead of asking the user to disambiguate
 * ("모호한 입력에는 되묻지 말고 두 방향 모두 보여주십시오").
 */
function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length || !offset) return items;
  const n = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

export function recommendConceptLocal(
  freeText: string,
  archetype: ChannelArchetype,
  defaults?: { genreId?: string; moodId?: string; seasonId?: string },
  /** TASK H7 (v3.10) — "다른 추천 보기": rotates through the next-ranked candidates instead of dead-ending on the same top-2 every click. */
  variantOffset = 0
): ConceptAgentResult {
  const coreGenres = getCoreGenresForArchetype(archetype);
  const coreGenreIds = new Set(coreGenres.map(genre => genre.id));
  const ranked = rankFromRules(freeText, coreGenreIds);

  const fallbackGenreId = defaults?.genreId && coreGenreIds.has(defaults.genreId) ? defaults.genreId : coreGenres[0]?.id || 'adult-contemporary';
  const fallbackMoodId = defaults?.moodId && moodPacks.some(m => m.id === defaults.moodId) ? defaults.moodId : 'nostalgic';
  // TASK H2 fix (v3.10) — falling back to seasonPacks[0] ('new-year')
  // whenever no season keyword matched put "New Year Reset" on unrelated
  // recommendations like "café song" or "comfort when it's hard". Prefer
  // whatever season the wizard already had selected; only fall back to a
  // fixed pack if the caller genuinely has no current selection.
  const fallbackSeasonId = defaults?.seasonId && seasonPacks.some(s => s.id === defaults.seasonId) ? defaults.seasonId : (seasonPacks[0]?.id || 'early-autumn');

  const genreCandidates = rotate(ranked.genres.length ? ranked.genres : [fallbackGenreId], variantOffset);
  const moodCandidates = rotate(ranked.moods.length ? ranked.moods : [fallbackMoodId], variantOffset);
  const seasonId = ranked.seasons[0] || fallbackSeasonId;

  const recommendations: ConceptRecommendation[] = [];
  const primaryGenreId = genreCandidates[0];
  const primaryMoodIds = moodCandidates.slice(0, 2);
  const hasSignal = ranked.genres.length > 0 || ranked.moods.length > 0 || ranked.seasons.length > 0;

  recommendations.push(buildRecommendation({
    id: 'primary',
    genreId: primaryGenreId,
    moodIds: primaryMoodIds,
    seasonId,
    reasonKo: hasSignal
      ? `${seasonLabelKo(seasonId)} 분위기의 ${genreLabelKo(primaryGenreId)} 느낌이에요.`
      : `이 채널에서 가장 무난하게 어울리는 조합이에요.`,
    confidence: hasSignal ? 'high' : 'medium'
  }));

  // Second angle: a distinct genre candidate, or (if the input only really
  // suggested one direction) a mood-shifted variation of the same genre so
  // the user still gets a real choice between two options.
  const secondaryGenreId = genreCandidates.find(id => id !== primaryGenreId);
  if (secondaryGenreId) {
    recommendations.push(buildRecommendation({
      id: 'secondary',
      genreId: secondaryGenreId,
      moodIds: moodCandidates.slice(0, 2),
      seasonId,
      reasonKo: `${genreLabelKo(secondaryGenreId)} 쪽으로 더 어울릴 수도 있어요.`,
      confidence: 'medium'
    }));
  } else if (moodCandidates.length > 1) {
    recommendations.push(buildRecommendation({
      id: 'secondary',
      genreId: primaryGenreId,
      moodIds: [moodCandidates[1]],
      seasonId,
      reasonKo: `같은 장르에 조금 더 ${moodPacks.find(m => m.id === moodCandidates[1])?.label || ''} 느낌을 더한 버전이에요.`,
      confidence: 'medium'
    }));
  }

  return { input: freeText, recommendations: recommendations.slice(0, 2), method: 'local' };
}

function conceptSystemPrompt(): string {
  return `너는 시니어 대상 플레이리스트 채널의 곡 컨셉을 추천하는 도우미다. 사용자가 한국어/영어/일본어로 막연한 느낌을 설명하면, 제공된 화이트리스트 id 안에서만 1~2개 조합을 추천하고 각각 한국어 한 줄 이유(reasonKo)와 짧은 영어 미리보기 제목(previewLine, 2-4단어)을 단다. 화이트리스트에 없는 id는 절대 만들어내지 마라. 모호한 입력이면 되묻지 말고 서로 다른 두 조합을 제시하라. 반드시 JSON으로만 답하라. 형식: {"recommendations":[{"genreId":"","moodIds":[""],"seasonId":"","reasonKo":"","previewLine":"","confidence":"high"}]}`;
}

/**
 * TASK H4 (v3.10) — Haiku-only, output capped small (~80 tokens), whitelist
 * re-validated on every response regardless of cache/API result since an
 * LLM can hallucinate an id that looks plausible but isn't in this
 * channel's core tier. Any failure (network, parse, hallucinated id) falls
 * back to the local matcher rather than surfacing an error — the agent is
 * optional, never a blocking gate.
 */
export async function recommendConceptViaApi(
  freeText: string,
  archetype: ChannelArchetype,
  settings: ProviderSettings
): Promise<ConceptAgentResult> {
  const whitelist = buildConceptWhitelist(archetype);
  const cacheKey = `${archetype}::${normalizeInput(freeText)}`;

  const cached = await getConceptCache(cacheKey).catch(() => undefined);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as ConceptAgentResult;
      if (parsed.recommendations?.length && parsed.recommendations.every(rec => validateRecommendation(rec, whitelist))) {
        return { ...parsed, method: 'api' };
      }
    } catch {
      // stale/corrupt cache entry — fall through to a fresh call
    }
  }

  try {
    const model = MODEL_REGISTRY.anthropic.find(m => m.tier === 'fast')?.id || defaultModelFor('anthropic');
    const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
      provider: 'anthropic',
      model,
      temperature: 0.6,
      batchSize: 1,
      cacheableSystemBlocks: [conceptSystemPrompt()],
      user: { whitelist, input: freeText }
    });

    const usage = data.usage as { inputTokens?: number; outputTokens?: number } | undefined;
    if (usage) {
      try {
        await recordUsage({ provider: 'anthropic', model, purpose: 'concept', inputTokens: usage.inputTokens || 0, outputTokens: usage.outputTokens || 0, cacheHit: false });
      } catch {
        // usage tracking is a convenience dashboard; never block on it
      }
    }

    const raw = (data.blueprint ?? data) as { recommendations?: unknown[] };
    const candidates = (raw.recommendations || []) as Array<Record<string, unknown>>;
    const recommendations: ConceptRecommendation[] = candidates.slice(0, 2).map((candidate, index) => ({
      id: `api-${index}`,
      genreId: String(candidate.genreId || ''),
      moodIds: Array.isArray(candidate.moodIds) ? candidate.moodIds.map(String) : [],
      seasonId: String(candidate.seasonId || ''),
      vocalPresetId: String(candidate.vocalPresetId || vocalPresets[0].id),
      reasonKo: String(candidate.reasonKo || ''),
      previewLine: String(candidate.previewLine || ''),
      confidence: candidate.confidence === 'high' ? 'high' : 'medium'
    }));

    if (!recommendations.length || !recommendations.every(rec => validateRecommendation(rec, whitelist))) {
      return recommendConceptLocal(freeText, archetype);
    }

    const result: ConceptAgentResult = { input: freeText, recommendations, method: 'api' };
    void setConceptCache(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return recommendConceptLocal(freeText, archetype);
  }
}

// ---------------------------------------------------------------------------
// TASK H6 (v3.10) — thumbnail copy: same free-text-in, pick-one-out pattern
// as the concept agent, but for headline text rather than genre/mood. Reuses
// the v3.6 ThumbnailVariant shape so callers can drop these straight into
// an existing thumbnailSpec.variants array; the season/emotion/audience A/B/C
// strategy from v3.6 is untouched and still the default when no free text
// is given (see thumbnailSpec.ts).
// ---------------------------------------------------------------------------

export interface ThumbnailCopySuggestion {
  headline: string;
  angle: string;
}

interface ThumbnailThemeBank {
  patterns: RegExp[];
  phrases: Record<DisplayLanguage, [string, string, string]>;
}

const THUMBNAIL_THEME_BANKS: ThumbnailThemeBank[] = [
  {
    patterns: [/어디선가\s*들어본/, /들어본\s*적/, /익숙한/, /heard\s*(it\s*)?before/i, /familiar/i, /どこかで聞いた/, /聞き覚え/],
    phrases: {
      korean: ['어디서 들어본 그 노래', '익숙한 그 멜로디', '다시 만난 옛 노래'],
      english: ['A Song You\'ve Heard', 'That Familiar Tune', 'An Old Song Again'],
      japanese: ['どこかで聞いた歌', '懐かしいメロディ', 'また出会った歌']
    }
  },
  {
    patterns: [/겨울/, /winter/i, /冬/, /雪/],
    phrases: {
      korean: ['그 겨울이 떠오르는 노래', '겨울밤의 작은 위로', '눈 내리던 그 계절'],
      english: ['That Winter Feeling', 'A Small Winter Comfort', 'The Season It Snowed'],
      japanese: ['あの冬を思い出す歌', '冬の夜の小さな癒し', '雪が降ったあの季節']
    }
  },
  {
    patterns: [/카페/, /커피/, /창가/, /\bcafe\b/i, /coffee/i, /カフェ/, /コーヒー/],
    phrases: {
      korean: ['카페에서 듣던 노래', '창가에 앉아 듣는 음악', '커피 한 잔의 여유'],
      english: ['That Cafe Playlist', 'Songs by the Window', 'A Cup of Coffee Calm'],
      japanese: ['カフェで聴いた歌', '窓辺で聴く音楽', 'コーヒー一杯の余裕']
    }
  },
  {
    patterns: [/위로/, /힘들\s*때/, /지칠\s*때/, /comfort/i, /healing/i, /癒し/, /疲れた/],
    phrases: {
      korean: ['지친 하루의 위로', '괜찮다고 말해주는 노래', '오늘의 작은 쉼표'],
      english: ['Comfort for a Tired Day', 'A Song That Says It\'s Okay', 'Today\'s Small Rest'],
      japanese: ['疲れた一日の癒し', '大丈夫だよと言う歌', '今日の小さな休息']
    }
  },
  {
    patterns: [/가을/, /단풍/, /낙엽/, /autumn/i, /\bfall\b/i, /秋/, /紅葉/],
    phrases: {
      korean: ['가을이 스며드는 노래', '낙엽 지는 계절의 기억', '단풍처럼 물든 하루'],
      english: ['A Song Autumn Seeps Into', 'Memories as Leaves Fall', 'A Day Colored Like Maple'],
      japanese: ['秋がしみこむ歌', '落ち葉の季節の記憶', '紅葉に染まる一日']
    }
  }
];

export function recommendThumbnailCopyLocal(freeText: string, language: DisplayLanguage): ThumbnailCopySuggestion[] {
  const text = freeText.trim();
  const bank = text ? THUMBNAIL_THEME_BANKS.find(candidate => candidate.patterns.some(pattern => pattern.test(text))) : undefined;
  const angles = ['계절/느낌 강조', '감정 강조', '다시 만남 강조'];
  if (!bank) {
    // No theme matched — still return something rather than nothing, using
    // the most broadly applicable bank (familiarity) as a safe default.
    const fallback = THUMBNAIL_THEME_BANKS[0];
    return fallback.phrases[language].map((headline, index) => ({ headline, angle: angles[index] }));
  }
  return bank.phrases[language].map((headline, index) => ({ headline, angle: angles[index] }));
}

export { CONCEPT_KEYWORD_RULES };
