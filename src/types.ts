export type ProviderType = 'local' | 'openai' | 'anthropic';

export type Market = 'korea' | 'japan' | 'global' | 'custom';
export type LyricLanguage = 'english' | 'korean' | 'japanese' | 'bilingual';
export type AgeGroup = 'kids' | 'teens' | 'twenties' | 'thirtiesForties' | 'seniors' | 'allAges';

export type ChannelArchetype = 'senior-morning' | 'showa-cafe' | 'christmas' | 'lofi-study' | 'kids';

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
  lyrics: string;
  thumbnailText: string;
  youtube: YoutubeMetadata;
  youtubeTitleKo?: string;
  youtubeTitleJa?: string;
  qualityScore: number;
  warnings: string[];
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

export interface ProviderSettings {
  provider: ProviderType;
  model?: string;
  temperature: number;
  proxyEndpoint?: string;
  apiKey?: string;
  keyStorageMode?: 'server' | 'local';
  batchSize?: number;
}

export interface PlaylistIdentity {
  oneLineConcept: string;
  sonicSignature: string;
  vocalSignature: string;
  lyricRules: string[];
  harmonyRules: string[];
  visualRules: string[];
}

export interface BatchContext {
  trackNoOffset: number;
  totalSongCount: number;
  usedTitles: string[];
  usedHooks: string[];
  lockedIdentity: PlaylistIdentity | null;
}

export interface GenerationProgress {
  done: number;
  total: number;
  songs: SongIdea[];
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
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
}

export type SavedPackMeta = Omit<SavedPack, 'blueprint' | 'options' | 'evaluation' | 'thumbnailSpec'>;

export interface ThumbnailSpec {
  headline: string;
  subline: string;
  colorScheme: {
    background: string;
    accent: string;
    text: string;
  };
  objects: string[];
  composition: string;
  forbidden: string[];
  imagePrompt: string;
}
