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

/** TASK H2 (v3.13) — same {english, korean, japanese} shape as localGenerator's LocalizedPhrase, duplicated here (not imported) since types.ts must stay free of core/* imports; keeps genre-flavor lyric images correctly localized instead of leaking raw English nouns into Korean/Japanese lyrics. */
export interface GenreLyricFlavorImage {
  english: string;
  korean: string;
  japanese: string;
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
  /** TASK H2 (v3.13) — 3-5 short lyric images distinctive to this genre (e.g. jazz-pop: candlelight/brass hush), used for exactly one lyric slot so genre selection is audible in the words, not just the style prompt. Absent for extended-tier genres — composeLyrics falls back to the shared generic filler pool when this is missing, same as before v3.13. */
  lyricFlavorImages?: GenreLyricFlavorImage[];
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
  /**
   * TASK v3.38 Part B — per-song male/female/mixed vocal distribution for
   * the 'kids' channel archetype (see core/vocalPlan.ts). Only consulted
   * when the channel archetype is 'kids' (usesVocalQuota); undefined for
   * every other channel, unchanged from pre-v3.38 behavior. Counts are
   * proportions, not a hard songCount-must-equal-sum requirement — scaled
   * to the actual songCount by scaleVocalQuota so the 6/6/6 default still
   * applies its ratio at any song count.
   */
  vocalQuota?: { male: number; female: number; mixed: number };
  /** v3.8 — when true, per-song Style Prompts keep only song-specific differences because Suno Persona supplies the stable voice/style identity. */
  personaMode: boolean;
  /** TASK D5 (v3.6) — thumbnail/title packaging language; defaults from `market` (see core/packagingLanguage.ts) but can be overridden independent of lyricLanguage. */
  packagingLanguage?: DisplayLanguage;
  /** TASK I1 (v3.11) — track 1's opening technique; defaults to 'auto' (archetype-resolved, see resolveOpeningStyle) when unset. */
  openingStyle?: OpeningStyle;
  /**
   * v3.15 — "누구나 익숙하게 느끼는" mode: prefers cold-open/flagship hook
   * candidates that score high on core/openingContest.ts's familiarity
   * dimension (short, easy to hum, repeats its own rhythm), nudges the money
   * chord toward the most common progressions (see
   * data/moneyChords.ts's resolveEarwormMoneyChordMode), and appends a few
   * safe, generic songwriting-technique descriptors to the style prompt. This
   * raises the odds of a familiar-feeling result — it never guarantees one,
   * since Suno's actual melody isn't controlled precisely by text.
   */
  earwormMode?: boolean;
  /**
   * TASK v3.27 — 'ai-creative' (default) lets the remote model/coding agent
   * write its own title for each preassigned hookPhrase instead of copying
   * core/lyricEngine.ts's titleFromHook output verbatim — that mechanical
   * derivation (hook phrase as-is, or "<time word> <hook>") is what made a
   * whole pack's titles read as structurally uniform even though the hooks
   * themselves varied. 'local' keeps the old fully-deterministic behavior
   * (offline-safe fallback, and for users who prefer the old titles).
   * hookPhrase/emotionArc/songRole stay locally pre-decided either way — see
   * core/batchPreallocation.ts's reconcileWithPreassignedSlot.
   */
  titleMode?: 'local' | 'ai-creative';
  /**
   * TASK v3.33 — mirrors titleMode's pattern exactly, one axis over: 'pool'
   * (old behavior) forces every song's hookPhrase to core/lyricEngine.ts's
   * composeHook()-drawn slot value, hard-capping how many songs a channel can
   * generate before its ~400-hook combinatorial pool exhausts (~4.4 weeks at
   * 90 songs/week). 'ai-creative' (default) lets the model write its own
   * hook per song instead — no pool draw, no exhaustion — checked against
   * the channel's hook ledger (core/hookLedger.ts) for collisions instead of
   * pre-decided. Applies to every track including cold-open/flagship: the
   * k=3 opening contest (core/openingContest.ts) is a pool-only mechanism
   * (it scores composeHook candidates), so those tracks skip the contest in
   * this mode and get extra prompt emphasis instead (see
   * promptComposer.ts's buildBatchSystemNote). title/emotionArc/songRole
   * behavior is unaffected by this field — see titleMode above for title.
   */
  hookMode?: 'pool' | 'ai-creative';
  /**
   * TASK v3.35 — multi-set generation only (core/multiSetGeneration.ts):
   * when on (default), each set's songs get their set-local trackNo (1..N,
   * reset per set) prefixed onto the display title as "01. ", "02. ", etc,
   * applied *after* that set's own title/hook dedup finishes — so
   * duplicate/collision checks always compare the bare creative title, never
   * the prefixed one (see utils/generation.ts's stripSetTitlePrefix). No
   * effect on single-pack generation. Off reverts to the plain creative
   * title, unchanged from pre-v3.35 behavior.
   */
  setNumberPrefix?: boolean;
}

export interface YoutubeMetadata {
  title: string;
  description: string;
  tags: string[];
  /** TASK v3.23 — the app no longer asks the API for this (user makes thumbnails externally); optional so old saved packs that still have it keep rendering/exporting fine. */
  thumbnailText?: string;
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
  /** TASK v3.23 — the app no longer asks the API for this (user makes thumbnails externally); optional so old saved packs that still have it keep rendering/exporting fine. */
  thumbnailText?: string;
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
  /** TASK v3.38 Part B — which vocal type this song was assigned by core/vocalPlan.ts's per-song quota plan; only set for the 'kids' channel archetype. */
  vocalType?: 'male' | 'female' | 'mixed';
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
  /** TASK v3.23 — off by default; most users make thumbnails externally. When true, the API is asked to generate thumbnailText again (song.thumbnailText / song.youtube.thumbnailText). */
  generateThumbnailText?: boolean;
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
  /**
   * TASK v3.33 Part C — this trackNo's resolved money-chord progression
   * text (compact tag + feel-reinforcement, see
   * core/soundSignature.ts's compactMoneyChord/MONEY_CHORD_FEEL_SUFFIX).
   * Unlike hookPhrase/emotionArc, this isn't its own SongIdea output field
   * to reconcile post-hoc — it's instruction-only guidance the model is
   * told to weave verbatim into the stylePrompt it writes (same trust
   * model the flat, pre-v3.33 moneyChordMode instruction already used; no
   * new post-hoc verification is added here). Computed once locally so
   * realtime/Batch/bridge all reference the identical text for the same
   * trackNo (see core/batchPreallocation.ts's preallocateSongSlots).
   */
  moneyChordText: string;
}

export interface BatchContext {
  trackNoOffset: number;
  totalSongCount: number;
  usedTitles: string[];
  usedHooks: string[];
  lockedIdentity: PlaylistIdentity | null;
  /**
   * TASK B2 (v3.6) — originally only set for true parallel Batch API sub-
   * requests, since the synchronous multi-batch path ran fully sequentially
   * and could always see the real titles/hooks of every prior chunk. TASK
   * v3.21 made the synchronous (real-time) path parallel too, past the
   * first chunk — it now sets this too, for the same reason: parallel
   * sibling requests can't see each other's real output, so title/hook are
   * decided locally up front instead of left for the model to invent.
   */
  preassignedSongs?: PreassignedSongSlot[];
  /**
   * TASK v3.21 — when set, computeMaxTokens uses this instead of the real
   * requested song count for its max_tokens formula only (a "budget boost"
   * for the one-time retry generateChunkWithSplitRetry does when even a
   * single song still truncates at the normal per-song budget). Everything
   * else about the request — songCount, trackNoOffset, etc. — is unchanged.
   */
  maxTokensBudgetSongs?: number;
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
  /**
   * TASK v3.33 — multi-set generation (core/multiSetGeneration.ts) produces
   * N independent SavedPacks per run (one per set), not one merged
   * blueprint — see the projectTitle "Set 0N" naming convention. These three
   * fields are UI-grouping metadata only (sidebar badge, "N/total" display);
   * `undefined` for every single-pack-mode pack, before and after this task,
   * so no migration is needed.
   */
  setGroupId?: string;
  setIndex?: number;
  setTotal?: number;
}

export type SavedPackMeta = Omit<SavedPack, 'blueprint' | 'options' | 'evaluation' | 'thumbnailSpec'>;

export type ThumbnailVariantId = 'A' | 'B' | 'C';

export interface ThumbnailVariant {
  id: ThumbnailVariantId;
  headline: string;
  /** TASK v3.38 Part A — the small subtitle line beneath the divider (e.g. "추억 감성 플레이리스트"), 8-14 characters for Korean. Supersedes the old songCount-derived subline. */
  subline: string;
  /** Korean label describing this variant's strategy — A: 질문형(호기심), B: 감성형, C: 공감형 (TASK v3.38 Part A). */
  angle: string;
}

/**
 * TASK v3.38 Part A — the Korean-serif grammar's fixed typography
 * recommendation (thin serif, dark-brown-or-white depending on background,
 * no outline, thin divider, small subtitle). Deliberately kept as its own
 * struct, never interpolated into an image-generation prompt string — see
 * thumbnailSpec.ts/thumbnailPromptComposer.ts's tests asserting the two stay
 * separated.
 */
export interface ThumbnailTypographyGuide {
  font: string;
  color: string;
  outline: string;
  shadow: string;
  /** Thin horizontal divider line beneath the main headline. */
  divider: boolean;
  /** Small subtitle line beneath the divider, ~25-30% of the headline's size. */
  subtitle: boolean;
}

export interface ThumbnailSpec {
  /** Always exactly 3 — A: 질문형(호기심), B: 감성형, C: 공감형 (TASK v3.38 Part A). */
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
  /** TASK v3.38 — the archetype's recommended on-image typography, kept separate from imagePromptVariants. */
  typography: ThumbnailTypographyGuide;
}

/**
 * TASK v3.37 — channel brand template for the image-generation/canvas-compose
 * pipeline (ported from creator-studio's tools/thumbnail studio). Set once
 * per channel and locked so every future thumbnail/cover only changes the
 * background and copy text, never the font/color/badge look.
 */
export type ThumbnailFontId = 'blackHanSans' | 'doHyeon' | 'jua' | 'gowunDodum' | 'yeonSung' | 'nanumPenScript';

export type ThumbnailTextPosition =
  | 'top-center' | 'center' | 'bottom-center'
  | 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';

export type ThumbnailBadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ThumbnailBrandBadge {
  icon: string;
  tag: string;
  position: ThumbnailBadgePosition;
}

export interface ThumbnailBrandTemplate {
  channelName: string;
  fontId: ThumbnailFontId;
  textColor: string;
  shadowColor: string;
  shadowWidth: number;
  strokeOn: boolean;
  position: ThumbnailTextPosition;
  badge: ThumbnailBrandBadge;
  locked: boolean;
  updatedAt: string;
}
