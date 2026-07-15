export type ProviderType = 'local' | 'openai' | 'anthropic';

export type Market = 'korea' | 'japan' | 'global' | 'custom';
export type LyricLanguage = 'english' | 'korean' | 'japanese' | 'bilingual';
/** TASK D5 (v3.6) — the language titles/thumbnails/packaging are written in, independent of the lyrics' own language (e.g. a Korean channel commonly runs English lyrics with Korean packaging). */
export type DisplayLanguage = 'english' | 'korean' | 'japanese';
export type AgeGroup = 'kids' | 'teens' | 'twenties' | 'thirtiesForties' | 'seniors' | 'allAges';

export type ChannelArchetype = 'senior-morning' | 'showa-cafe' | 'christmas' | 'lofi-study' | 'kids';

/**
 * TASK I1 (v3.11) — how track 1 (the 'cold-open' role) opens.
 * 'hook-forward': no/minimal instrumental intro, hook heard immediately — the
 * safe, already-proven-in-this-pipeline technique (see promptComposer's
 * duration-control atoms). 'hum-intro': a short wordless hum of the hook
 * melody before vocals enter — an experimental technique, since a Suno text
 * meta-tag isn't guaranteed to produce a literal wordless hum. 'auto' resolves
 * per-archetype (see core/localGenerator.ts's resolveOpeningStyle), defaulting
 * to 'hook-forward' unless the archetype's own recommendation is 'hum-intro'.
 */
export type OpeningStyle = 'hook-forward' | 'hum-intro' | 'auto';

export interface ChannelProfile {
  id: string;
  name: string;
  englishName?: string;
  market: Market;
  primaryLanguage: LyricLanguage;
  audience: AgeGroup;
  promise: string;
  visualIdentity: string;
  defaultVocal: string;
  preferredGenres: string[];
  preferredMoods: string[];
  forbiddenCliches: string[];
  seoKeywords: string[];
  /** v3.4 — scopes which hook vocabulary bank this channel draws from. Missing/unrecognized values fall back to 'senior-morning' (see migrateArchetype in data/presets.ts). */
  archetype?: ChannelArchetype;
}

export interface GenrePack {
  id: string;
  label: string;
  styleCore: string;
  instruments: string[];
  tempoRange: [number, number];
  goodFor: string[];
  archetypes?: ChannelArchetype[];
  tier?: 'core' | 'extended';
  categoryId?: string;
  aliases?: string[];
  rhythm?: string[];
  vocal?: string[];
  production?: string[];
  harmony?: string[];
  tempo?: [number, number];
  moods?: string[];
  audiences?: string[];
  avoidTraits?: string[];
  shortPrompt?: string;
  productionGuidance?: string;
  source?: 'legacy-preset' | 'notion-analysis';
}

export interface MoodPack {
  id: string;
  label: string;
  emotionWords: string[];
  lyricImages: string[];
}

export interface SeasonPack {
  id: string;
  label: string;
  period: string;
  keywords: string[];
  visualDirection: string;
}

export interface GenerationPack {
  id: AgeGroup;
  label: string;
  audienceNote: string;
  lyricGuidance: string[];
  tempoBias: string;
  youtubeAngle: string;
}

export interface GenerationOptions {
  channel: ChannelProfile;
  projectTitle: string;
  songCount: number;
  lyricLanguage: LyricLanguage;
  market: Market;
  audience: AgeGroup;
  genreIds: string[];
  moodIds: string[];
  seasonId: string;
  vocalTone: string;
  perspective: 'firstPerson' | 'secondPerson' | 'thirdPerson' | 'radioHost';
  lyricDepth: 'simple' | 'literary' | 'poetic' | 'commercial';
  durationTarget: 'under3m30' | 'under4m' | 'playlistShort';
  moneyChordMode: 'default' | 'emotional' | 'jazzColor' | 'cityPop' | 'canon' | 'showaModern' | 'winterBallad' | 'custom';
  customMoneyChord: string;
  customConcept: string;
  avoidWords: string;
  /** v3.8 — when true, per-song Style Prompts keep only song-specific differences because Suno Persona supplies the stable voice/style identity. */
  personaMode: boolean;
  /** TASK D5 (v3.6) — thumbnail/title packaging language; defaults from `market` (see core/packagingLanguage.ts) but can be overridden independent of lyricLanguage. */
  packagingLanguage?: DisplayLanguage;
  /** TASK I1 (v3.11) — track 1's opening technique; defaults to 'auto' (archetype-resolved, see resolveOpeningStyle) when unset. */
  openingStyle?: OpeningStyle;
}

export interface YoutubeMetadata {
  title: string;
  description: string;
  tags: string[];
  thumbnailText: string;
}

export interface SongIdea {
  trackNo: number;
  title: string;
  seasonMoment: string;
  listenerSituation: string;
  emotionArc: string;
  hookPhrase: string;
  stylePrompt: string;
  /** Text meant for Suno's separate Advanced Options -> Exclude field, never pasted into the style prompt itself (avoidWords + copyright-avoidance terms). See core/promptComposer.ts's buildExcludePrompt. */
  excludePrompt?: string;
  lyrics: string;
  thumbnailText: string;
  youtube: YoutubeMetadata;
  youtubeTitleKo?: string;
  youtubeTitleJa?: string;
  qualityScore: number;
  warnings: string[];
  /** TASK A5 (v3.5) — length/budget of the final stylePrompt against Suno's style-field limit; always set by core/quality.ts's scoreSong. */
  promptLength?: number;
  promptWithinLimit?: boolean;
  promptDroppedTerms?: string[];
  /** Word count of the final stylePrompt — Suno responds best to 15-30 comma-separated descriptor words; above ~40 the model reportedly gets confused. */
  promptWordCount?: number;
  promptWithinWordTarget?: boolean;
  /**
   * TASK I1 (v3.11) — resolved opening/positioning role: 'cold-open' (track 1
   * only), 'flagship' (tracks 2-3), or one of localGenerator.ts's songRoles
   * strings for every other track. Optional so legacy saved packs (no field
   * at all) and hand-built test fixtures keep working without it.
   */
  songRole?: string;
  /** TASK I1 (v3.11) — only meaningful when songRole === 'cold-open'; records which opening technique this song's style prompt/lyrics were built with, so a later manual promotion (core/openingOverride.ts) knows what to swap out. */
  openingStyle?: 'hook-forward' | 'hum-intro';
}

export interface PlaylistBlueprint {
  projectTitle: string;
  channelName: string;
  oneLineConcept: string;
  sonicSignature: string;
  vocalSignature: string;
  lyricRules: string[];
  harmonyRules: string[];
  visualRules: string[];
  songs: SongIdea[];
}

export interface SoundSignature {
  short: string;
  full: string;
  personaName: string;
  shortLength: number;
  fullLength: number;
}

export interface ProviderSettings {
  provider: ProviderType;
  model?: string;
  temperature: number;
  proxyEndpoint?: string;
  apiKey?: string;
  keyStorageMode?: 'server' | 'local';
  /** TASK C2 (v3.6) — sent as X-Access-Token when a public deployment gates its server-side API key with ACCESS_TOKEN; irrelevant for BYOK (local key) mode. */
  accessToken?: string;
  batchSize?: number;
  /** Suno copy limit for Style Prompt, defaults to SUNO_COPY_LIMIT (1000) when unset. */
  promptCharLimit?: number;
  /** TASK D3 (v3.5) — optional per-stage model override (lyrics vs evaluation). Only applied when provider is 'anthropic'; unset means every stage just uses this ProviderSettings as-is (pre-v3.5 behavior). */
  stageModels?: { lyrics: 'local' | 'sonnet' | 'haiku'; evaluation: 'local' | 'sonnet' | 'haiku' };
}

export interface PlaylistIdentity {
  oneLineConcept: string;
  sonicSignature: string;
  vocalSignature: string;
  lyricRules: string[];
  harmonyRules: string[];
  visualRules: string[];
}

/**
 * TASK B2 (v3.6) — a trackNo/title/hookPhrase/songRole/tempo/emotionArc
 * assignment decided locally (see core/batchPreallocation.ts) before a Batch
 * API job is submitted. When a BatchContext carries these, the model is
 * instructed to use them verbatim instead of inventing its own — parallel
 * sub-batches can no longer collide on title/hook because none of them
 * choose it independently.
 */
export interface PreassignedSongSlot {
  trackNo: number;
  title: string;
  hookPhrase: string;
  songRole: string;
  tempo: number;
  emotionArc: string;
}

export interface BatchContext {
  trackNoOffset: number;
  totalSongCount: number;
  usedTitles: string[];
  usedHooks: string[];
  lockedIdentity: PlaylistIdentity | null;
  /** TASK B2 (v3.6) — only ever set for true parallel Batch API sub-requests, never the synchronous multi-batch path (which already avoids this collision by running batches sequentially). */
  preassignedSongs?: PreassignedSongSlot[];
}

export interface GenerationProgress {
  done: number;
  total: number;
  songs: SongIdea[];
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  /** TASK E1 (v3.5) — Anthropic prompt-cache read/write token counts, when the provider reports them. A nonzero cacheReadInputTokens on batch 2+ is the only real confirmation the cache boundary was placed correctly. */
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export interface SongEvaluation {
  trackNo: number;
  scores: {
    hookStrength: number;
    lyricOriginality: number;
    promptFitness: number;
    audienceFit: number;
    seasonFit: number;
    safety: number;
  };
  total: number;
  verdict: 'pass' | 'revise' | 'reject';
  issues: string[];
  suggestions: string[];
  rewrittenHook?: string;
}

export interface AgentEvaluation {
  evaluatedAt: string;
  model: string;
  packLevel: {
    diversityScore: number;
    coherenceScore: number;
    sequencingScore: number;
    duplicateWarnings: string[];
    summary: string;
  };
  songs: SongEvaluation[];
}

export interface SavedPack {
  id: string;
  name: string;
  savedAt: string;
  isAutosave: boolean;
  channelId: string;
  channelName: string;
  projectTitle: string;
  songCount: number;
  avgQualityScore: number;
  blueprint: PlaylistBlueprint;
  options: GenerationOptions;
  evaluation?: AgentEvaluation;
  thumbnailSpec?: ThumbnailSpec;
  soundSignature?: SoundSignature;
  personaMode?: boolean;
}

export type SavedPackMeta = Omit<SavedPack, 'blueprint' | 'options' | 'evaluation' | 'thumbnailSpec'>;

export type ThumbnailVariantId = 'A' | 'B' | 'C';

export interface ThumbnailVariant {
  id: ThumbnailVariantId;
  headline: string;
  subline: string;
  /** Korean label describing this variant's strategy (e.g. '계절 강조'), shown in the UI so A/B/C read as genuinely different angles, not a reworded duplicate. */
  angle: string;
}

export interface ThumbnailSpec {
  /** Always exactly 3 — season emphasis, emotion emphasis, audience emphasis (TASK B1, v3.4). */
  variants: ThumbnailVariant[];
  selected: ThumbnailVariantId;
  colorScheme: {
    background: string;
    accent: string;
    text: string;
  };
  objects: string[];
  composition: string;
  forbidden: string[];
  /** Generic/natural-language version — same as imagePromptVariants.generic (TASK B4, v3.5). */
  imagePrompt: string;
  /** TASK B4 (v3.5) — the same scene, phrased for each image tool's own prompt syntax. */
  imagePromptVariants: {
    generic: string;
    midjourney: string;
    stableDiffusion: string;
  };
}
