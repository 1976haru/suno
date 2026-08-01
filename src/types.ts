export type ProviderType = 'local' | 'openai' | 'anthropic';

export type Market = 'korea' | 'japan' | 'global' | 'custom';
export type LyricLanguage = 'english' | 'korean' | 'japanese' | 'bilingual';
export type LyricPerspective = 'firstPerson' | 'secondPerson' | 'thirdPerson' | 'radioHost';
export type LyricSectionStyleId = 'narrative' | 'image' | 'dialogue' | 'hookRepeat';
/** TASK D5 (v3.6) — the language titles/thumbnails/packaging are written in, independent of the lyrics' own language (e.g. a Korean channel commonly runs English lyrics with Korean packaging). */
export type DisplayLanguage = 'english' | 'korean' | 'japanese';
export type AgeGroup = 'kids' | 'teens' | 'twenties' | 'thirtiesForties' | 'seniors' | 'allAges' | 'general';

export type ChannelArchetype = 'senior-morning' | 'showa-cafe' | 'christmas' | 'lofi-study' | 'kids' | 'showa-70s' | 'j2000s' | 'modern-chill' | 'city-night' | 'oldpop-lounge';

/** v4.0 (TASK A1) — one app, five isolated workspaces; see src/data/workspaces/index.ts for the full definition and src/core/workspaceScope.ts for how data gets namespaced by this id. */
export type WorkspaceId = 'senior-oldpop' | 'kr-2030' | 'jp-2030' | 'kr-kids' | 'jp-kids';

/** v3.64 (TASK B) — see PreassignedSongSlot.introMode's own doc comment for why this exists and what each value governs. */
export type IntroMode = 'instrumental' | 'vocal-immediate' | 'vocal-after-texture';

export type DiversityAxisId =
  | 'genre' | 'vocalType' | 'introTexture' | 'hookDevice'
  | 'arrangementDensity' | 'structureTemplate' | 'lyricTheme' | 'pov';

export interface AxisAllocation {
  axis: DiversityAxisId;
  mode: 'auto' | 'manual';
  counts: Record<string, number>;
}

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
/**
 * TASK v3.58 (지시문 v3.58 TASK 4) — separates "who this channel is for"
 * (vocal register, diction clarity, tempo range, mix character, hard
 * exclusions) from "what genre this song is" (instrumentation, rhythm
 * feel, harmony, era). Before this, ChannelProfile's own preferredGenres[0]
 * carried both roles at once — the channel's overall identity AND the
 * literal genre of whichever song happened to render it — so genuinely
 * diversifying genre per song necessarily diluted the channel's identity,
 * and protecting the channel's identity necessarily flattened every song
 * onto one genre (see core/genreRotation.ts's TASK 1 fix, which resolved
 * the mechanical half of this; AudienceProfile resolves the other half by
 * giving channel identity its own always-on, genre-independent home).
 */
/**
 * v4.2 (TASK A3) — 'five-phase' is the existing opening-rising-peak-easing-
 * closing set-level curve (core/arcPlan.ts), unchanged. 'repetition-cycle'
 * is new and for children's-song workspaces only (see AudienceProfile.arcModelId's
 * own doc comment) — no set-level 5-phase curve is imposed; a single song's
 * own internal repetition is what matters instead. Not yet implemented
 * (arcPlan.ts still only ever builds a five-phase curve) — this is the type
 * D1/E1/F1 will switch on once a real repetition-cycle builder exists.
 */
export type ArcModelId = 'five-phase' | 'repetition-cycle';

export interface AudienceProfile {
  /** v4.2 (TASK A3) — widened from the closed 'senior'|'general'|'kids' union so workspace-scoped profiles (e.g. 'kr-2030-emotional', 'kids-0to2') can exist without extending this union for every new one; every existing `=== 'senior'`/`=== 'kids'` comparison still works unchanged since those are still the literal ids in use. */
  id: string;
  labelKo: string;
  /** Woven into every song's style prompt regardless of genre (non-essential/droppable under hard budget pressure, same as any other style atom — never a new promptBudget.ts "never drop" category). */
  constraints: string[];
  /** Merged into every song's excludePrompt regardless of genre. */
  exclusions: string[];
  tempoFloor: number;
  tempoCeiling: number;
  lyricWordRange: [number, number];
  /**
   * v3.73 (TASK A) — target rendered-song length in seconds, for
   * core/audioSetReport.ts to judge a real mp3's duration against (audio
   * analysis has no other source of a "target length" — GenerationOptions'
   * own `durationTarget` is a request-text field, not a numeric per-audience
   * range). Deliberately separate from lyricWordRange: word count and actual
   * Suno render length are exactly the two things v3.71/v3.72's own real
   * measurements showed can diverge.
   */
  songLengthSecondsRange: [number, number];
  /**
   * v3.67 (TASK B) — the subset of `exclusions` a track's own killing point
   * (see data/killingPoints.ts) may relax, once per song, only at that
   * song's own killing-point location — never pack-wide, and never for a
   * song with no killing point (arc peakStrength 'none', see
   * core/arcPlan.ts). A memorable reference song's most striking moment —
   * a harmony swell, a final-chorus key change — is exactly the kind of
   * thing a flat, always-on exclusion list bans everywhere; this lets
   * "comfortable" mean "comfortable by default", not "never varies at all".
   * Empty for profiles with no killing-point concept (general/kids).
   */
  relaxableAtPeak: string[];
  /**
   * v3.67 (TASK B) — never relaxed regardless of any killing point (belted
   * vocals, distorted/aggressive percussion, sub bass, harsh top end,
   * excessive reverb, dense syncopated phrasing — see this task's own
   * "하드 익스클루전을 완화하지 말 것"). For a profile with no
   * relaxableAtPeak split, this should equal `exclusions` verbatim so
   * nothing becomes relaxable merely by omission.
   */
  hardExclusions: string[];

  /**
   * v4.2 (TASK A3, TASK E) — the seven fields below let a whole workspace's
   * generation "shape" (which killing points, structure templates, title
   * patterns, vocabulary, arc curve) be swapped by picking a different
   * AudienceProfile, instead of new workspace support meaning new branches
   * inside core/*.ts (see this task's own §11 "코드 수정 없이 데이터만
   * 추가하면 되어야 합니다"). Only `senior` is fully wired end-to-end today
   * (killingPointSetId/structureTemplateSetId are id-only — no actual
   * per-workspace killing-point/structure-template SET exists yet, since
   * there is still only ever one KILLING_POINTS array and one T1-T5
   * template list; a real multi-set split is B1/D1's job, not this task's).
   */
  killingPointSetId: string;
  /** See ArcModelId's own doc comment. */
  arcModelId: ArcModelId;
  structureTemplateSetId: string;
  /** data/titlePatterns.ts pattern-set id this profile draws from — today every profile shares the same one adult-English pattern list (see core/constraints.ts's buildTitleConstraint), so this is informational until a workspace needs its own set (§4-6). */
  titlePatternSetId: string;
  /** data/vocabularyBanks.ts VocabularyBank ids this profile draws from by default (before era-based narrowing — see core/constraints.ts's buildVocabularyConstraint). */
  vocabularyBankIds: string[];
  /** D1's safety policy (children's workspaces) reads this; undefined for every non-children profile. */
  safetyPolicyId?: string;
}

export interface GenreLyricFlavorImage {
  english: string;
  korean: string;
  japanese: string;
}

export interface GenrePack {
  id: string;
  label: string;
  styleCore: string;
  /** Compact genre fingerprint: rhythm, signature instruments, and production color. */
  signatureSound?: string;
  /** v3.56: compressed replacement for signatureSound under hard character-budget pressure (stage 2 of the full/short/minimal abbreviation ladder — see core/promptBudget.ts). */
  shortSignatureSound?: string;
  /** v3.56: further-compressed replacement for signatureSound, used only when short form still doesn't fit (stage 3 of the abbreviation ladder). */
  minimalSignatureSound?: string;
  /** Optional section-by-section arrangement narrative for lead genres only. Flat tag fields stay as the backward-compatible baseline. */
  arrangementNarrative?: string;
  instruments: string[];
  tempoRange: [number, number];
  goodFor: string[];
  archetypes?: ChannelArchetype[];
  tier?: 'core' | 'extended';
  categoryId?: string;
  /** Optional broad era bucket used by set planning and era-authenticity guardrails. */
  eraTag?: string;
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
  /**
   * v3.65 (TASK A) — decomposed, axis-separated genre traits for the
   * trait-matching engine (core/traitMatcher.ts). Optional and additive:
   * every existing GenrePack field above is untouched, and a genre without
   * `traits` still works everywhere it always did (the matcher falls back
   * to styleCore/instruments/tempoRange estimation, at a score penalty —
   * see traitMatcher.ts's own doc comment). Hand-curated for ~60-80 genres
   * (the senior/oldpop-lounge candidate pool); not populated for the full
   * 320-genre catalog by design (see docs/v365-report.md TASK A section).
   */
  traits?: GenreTraits;
}

/**
 * v3.65 (TASK A) — the five decomposed axes a genre's sound is described
 * along, kept deliberately separate (not one flat string like
 * GenrePack.signatureSound) so a matching/blending engine can compare or
 * recombine just one axis at a time — e.g. taking chanson's harmonyTraits
 * and instrumentation onto an oldpop-soft-rock-am's rhythmFeel/
 * structureTraits (see core/genreBlend.ts's blendGenreTraits) instead of
 * concatenating two whole genre descriptions into a mismatched pile.
 */
export interface GenreTraits {
  /** Era/period this genre's sound belongs to. Field name matches eraExclusions.ts's own era-bucket vocabulary. */
  eraTag: string;
  /** Instrumentation/arrangement — what physically plays. */
  instrumentation: string[];
  /** Rhythm, groove, and meter/pulse feel. */
  rhythmFeel: string[];
  /** Harmony, chord progression, and tonal color. */
  harmonyTraits: string[];
  /** Mix, studio, and spatial/production character. */
  productionTraits: string[];
  /** Vocal delivery, register, and closeness/distance. */
  vocalTraits: string[];
  /** Overall dynamic range across a song. */
  dynamicRange: 'low' | 'medium' | 'wide';
  /** Song-structure character (verse-driven vs. hook-driven, build shape, etc). */
  structureTraits: string[];
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
  perspective: LyricPerspective;
  lyricDepth: 'simple' | 'literary' | 'poetic' | 'commercial';
  durationTarget: 'under3m30' | 'under4m' | 'playlistShort';
  moneyChordMode: 'default' | 'emotional' | 'jazzColor' | 'cityPop' | 'canon' | 'showaModern' | 'winterBallad' | 'custom';
  customMoneyChord: string;
  customConcept: string;
  /** v3.49A: user-written vibe reference converted to safe English style clauses; artist/song names are blocked before use. */
  referenceMood?: string;
  /**
   * v3.58 (TASK 2/3) — musical descriptor atoms from an artist/band
   * reference detected in a concept-agent free-text input (e.g. "비틀즈
   * 스타일로"), already decomposed into generic era/instrumentation/
   * harmony/production language with the artist's own name stripped out
   * (see core/artistReferenceDecomposer.ts). Woven into the style prompt's
   * non-essential 'concept' atom group alongside customConcept's own
   * keyword-matched style text — never a replacement for it.
   */
  artistReferenceStyleAtoms?: string[];
  /** v3.63 (TASK B) — GenreFamily ids the user checked in Step2Concept's family picker (see data/genreFamilies.ts). When non-empty, setDirector.ts's directSetLocal uses these to choose the genre axis instead of free-text keyword scoring alone. */
  selectedGenreFamilyIds?: string[];
  /** v3.49A: optional selected-genre weights for blend/rotation previews. Keys are GenrePack ids, values are 0-100. */
  genreBlendWeights?: Record<string, number>;
  /** Optional user-written concrete lyric scene added to the lyric-theme allocation pool. */
  customLyricThemeScene?: string;
  avoidWords: string;
  /** Music-side negative style text for Suno's separate Exclude styles field. Undefined means use the channel/global default. */
  negativeStyle?: string;
  /** How aggressively intro textures should vary across a pack. Defaults to 50 for balanced rotation. */
  introUniqueness?: 0 | 50 | 100;
  /**
   * v3.47 Step 3: per-axis count controls. Missing or mode:'auto' preserves
   * the existing stride/quota rotations exactly; manual counts only override
   * the named axis and any shortfall is filled by that axis's auto plan.
   */
  diversityAllocations?: AxisAllocation[];
  /**
   * TASK v3.38 Part B — per-song male/female/mixed vocal distribution for
   * the 'kids' channel archetype (see core/vocalPlan.ts). Only consulted
   * when the channel archetype is 'kids' or a manual vocalType diversity
   * allocation is present (usesVocalQuota); undefined otherwise. Counts are
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
   * TASK v3.40 extends the same display prefix to single-pack generation.
   * when on (default), each set's songs get their set-local trackNo (1..N,
   * reset per set) prefixed onto the display title as "01. ", "02. ", etc,
   * applied *after* that set's own title/hook dedup finishes — so
   * duplicate/collision checks always compare the bare creative title, never
   * the prefixed one (see utils/generation.ts's stripSetTitlePrefix). It
   * now applies to single-pack generation too. Off reverts to the plain
   * creative title by stripping any existing display prefix.
   */
  setNumberPrefix?: boolean;
  /**
   * v3.68 (TASK E) — 'strong'-confidence rating insights (core/ratingAnalysis.ts's
   * analyzeRatings) the user has chosen to apply to this generation. Only
   * ever computed/attached by the UI (Step2Plan.tsx's "지난 평가 반영"
   * toggle) — undefined (the default) means no influence at all, which is
   * exactly what turning that toggle off restores. Structurally mirrors
   * AttributeInsight rather than importing it, keeping this foundational
   * file free of any core/ dependency (see its own zero-import convention).
   */
  ratingInsights?: {
    attribute: string;
    value: string;
    labelKo: string;
    good: number;
    ok: number;
    bad: number;
    sampleSize: number;
    lift: number;
    confidence: 'insufficient' | 'weak' | 'moderate' | 'strong';
  }[];
}

export interface YoutubeMetadata {
  title: string;
  description: string;
  tags: string[];
  /** TASK v3.23 — the app no longer asks the API for this (user makes thumbnails externally); optional so old saved packs that still have it keep rendering/exporting fine. */
  thumbnailText?: string;
}

export interface HumanContributionRecord {
  aiDraftLyrics: string;
  editedLyrics: string;
  totalLineCount: number;
  editedLineCount: number;
  editedLineRatio: number;
  editedLineNumbers: number[];
  summary: string;
  pronunciationHints?: string;
  arrangementNotes?: string;
  updatedAt: string;
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
  /** v3.48: original AI lyric draft kept when the user rewrites lyrics in the authorship workspace. */
  aiDraftLyrics?: string;
  /** v3.48: optional manual singing-pronunciation notes, especially for Japanese lines. */
  japanesePronunciationHints?: string;
  /**
   * v3.57: Korean/Japanese lyric-line translations for CapCut SRT subtitle
   * export (see core/srtExport.ts). Each array is line-aligned with
   * core/srtExport.ts's extractLyricLines(lyrics) output — same length and
   * order, one translated line per sung lyric line (section tags, the
   * vocal-meta-tag line, and the "Title:" line are never part of this list).
   * Not auto-invalidated if lyrics are edited afterward (same as this app's
   * other derived/optional fields, e.g. promptLength) — a stale translation
   * just means re-generating it before the next SRT export.
   */
  lyricTranslations?: {
    ko?: string[];
    ja?: string[];
  };
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
  /** v3.47 Step 3: planned lyric theme id, mainly for allocation preview/auditing. */
  lyricTheme?: string;
  /** v3.49A: planned lead genre id for this track. */
  genreId?: string;
  /** v3.49A: prompt-facing lead/blended genre text assigned to this track. */
  genreText?: string;
  /** v3.47 Step 2: concrete scene text assigned per song; this is the lyric theme's prompt-facing value. */
  lyricThemeText?: string;
  /** v3.47 Step 2: emotional turn paired with lyricThemeText. */
  lyricThemeArc?: string;
  /** v3.47 Step 3: planned lyric point of view, mainly for allocation preview/auditing. */
  pov?: LyricPerspective;
  /** v3.47 Step 2: verse writing approach assigned per song. */
  verseStyle?: LyricSectionStyleId;
  verseStyleText?: string;
  /** v3.47 Step 2: chorus writing approach assigned per song. */
  chorusStyle?: LyricSectionStyleId;
  chorusStyleText?: string;
  /**
   * TASK v3.39.1 Part B3 — free-text record of what a human actually chose/
   * changed for this song (which take was kept, a manual title/lyric edit,
   * why this thumbnail was picked, etc). YouTube's "inauthentic content"
   * enforcement explicitly weighs human editorial judgment — this is the
   * evidence trail for an appeal, not a feature the app reads back anywhere
   * else. Always user-entered; never auto-populated.
   */
  humanEdits?: string;
  /** v3.48: factual AI-assistance flag for export/audit records; never a legal registration decision. */
  aiAssisted?: boolean;
  /** v3.48: factual line-edit contribution record produced by the lyric workspace. */
  humanContribution?: HumanContributionRecord;
  /**
   * v3.68 (TASK A) — assigned once at generation time (local generation or
   * bridge import), never reused across sets the way trackNo is. This is
   * the only thing that lets a rating (core/ratingLedger.ts) survive past
   * the set it was made in — trackNo alone can't, since it resets to 1 in
   * every new pack. Optional so existing saved packs (generated before this
   * task) load fine; core/library.ts backfills it on load for any pack that
   * doesn't have one yet (see migratePackSongIds).
   */
  songId?: string;
  /** v3.68 (TASK B) — this track's own lead genre's broad era bucket (see data/genreLibrary's GenrePack.eraTag), snapshotted at rating time since genreId alone loses era context once a pack is deleted. */
  eraTag?: string;
  /** v3.68 (TASK B) — this track's killing point id (see data/killingPoints.ts), when the arc gave it one (peakStrength other than 'none' — see core/arcPlan.ts). */
  killingPointId?: string;
  /** v3.68 (TASK B) — this track's arc phase (see core/arcPlan.ts). */
  arcPhase?: string;
  /** v3.68 (TASK B) — this track's arc intensity, 1-5 (see core/arcPlan.ts). */
  intensity?: number;
  /** v3.68 (TASK B) — resolved BPM actually planned for this track. The stylePrompt already carries this as text ("96 BPM"); this is the same number as a queryable field, since rating analysis needs to bucket by tempo without re-parsing prose. */
  bpm?: number;
  /** v3.68 (TASK B) — this track's lyric section-order template id, snapshotted for rating analysis (PreassignedSongSlot already carried this; SongIdea didn't until now). */
  structureTemplate?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  /** v3.68 (TASK B) — this track's resolved money-chord preset id, when the per-song quota plan (core/moneyChordPlan.ts) assigned one. */
  moneyChordId?: string;
  /** v3.68 (TASK B) — this track's rotating earworm melodic-design phrase, when earwormMode was on (see core/promptComposer.ts's EARWORM_STYLE_VARIANTS). */
  earwormText?: string;
  /** v3.68 (TASK B) — which lyric scene frame this track's lyricTheme belongs to (see data/lyricThemes.ts's LyricTheme.frameId; PreassignedSongSlot already carried this — see v3.64 TASK A — SongIdea didn't until now), snapshotted for rating analysis. */
  lyricFrameId?: string;
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
  /**
   * v3.66 (TASK B) — set only by providers/index.ts's generateBlueprint when
   * settings.provider === 'local' (the app-assembled preview path,
   * localGenerator.ts + promptComposer.ts/promptBudget.ts). Never set by the
   * Claude Code bridge import path (claudeCodeBridge.ts's importSongsJson)
   * or the remote anthropic/openai branches, which are the pipeline this
   * app's real generation checks/measurements are based on. Undefined
   * everywhere else, including on blueprints loaded from the library, so
   * existing saved packs never retroactively show a preview banner.
   */
  isLocalPreview?: boolean;
  /**
   * v3.69 (TASK B) — ISO timestamp captured once, at generation time (never
   * recomputed later), so every set-level export (Claude Code bridge output
   * path, standalone Suno Progress Mode file, SRT zip) can name itself after
   * when the set was actually generated rather than whenever it happens to
   * be exported/imported — see utils/setNaming.ts's buildSetName, whose
   * whole point is a stable name that doesn't drift with later actions.
   * Optional so blueprints from before this field existed (and any
   * construction site this task didn't reach) degrade gracefully to "now"
   * at the point of use, never a hard requirement.
   */
  generatedAt?: string;
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
   * text (compact tag + that preset's own audibleEffect, see
   * core/soundSignature.ts's compactMoneyChord).
   * Unlike hookPhrase/emotionArc, this isn't its own SongIdea output field
   * to reconcile post-hoc — it's instruction-only guidance the model is
   * told to weave verbatim into the stylePrompt it writes (same trust
   * model the flat, pre-v3.33 moneyChordMode instruction already used; no
   * new post-hoc verification is added here). Computed once locally so
   * realtime/Batch/bridge all reference the identical text for the same
   * trackNo (see core/batchPreallocation.ts's preallocateSongSlots).
   */
  moneyChordText: string;
  /** v3.49A: per-song lead genre id chosen by the genre diversity axis. */
  genreId?: string;
  /** v3.49A: prompt-facing genre text for the selected/blended per-song genre plan. */
  genreText?: string;
  /** v3.54: essential, genre-defining sound identity carried through remote reconciliation. */
  signatureSound?: string;
  /** Music-side exclude text kept out of stylePrompt and exported to Suno Exclude styles. */
  negativeStyleText?: string;
  /** Per-song intro-only texture phrase to weave into stylePrompt, never as whole-song instrumentation. */
  introTextureText?: string;
  /**
   * TASK v3.39 — mirrors moneyChordText's per-trackNo verbatim-instruction
   * pattern for the kids channel's male/female/mixed vocal quota (see
   * core/vocalPlan.ts's buildVocalPlan/usesVocalQuota).
   * TASK v3.72 (TASK A) — usesVocalQuota(opts) is now true by default for
   * every archetype (was kids-only); it's false only when the user picked an
   * explicit single vocal preset/free-text different from the channel's own
   * defaultVocal (Step2Concept's "어떤 목소리로 부를까요?" grid) — that stays a
   * deliberate whole-pack choice, same as before this task. vocalType is
   * still undefined in that one case. vocalType is the raw pick; vocalText is
   * its resolved, ready-to-weave description (vocalDescriptionFor) so
   * realtime/Batch/bridge can all instruct "use this verbatim" the same way
   * they already do for moneyChordText.
   */
  vocalType?: 'male' | 'female' | 'mixed';
  vocalText?: string;
  /** v3.52: resolved concept direction carried into remote/batch reconciliation. */
  conceptText?: string;
  conceptLyricImages?: string[];
  /** v3.52: same channel vocal identity, expressed with track-level phrasing. */
  vocalVariantText?: string;
  /**
   * TASK v3.41 Part A1 — the explicit gender axis (see
   * core/vocalPlan.ts's VocalGender / data/vocalPresets.ts's VocalPreset.gender)
   * backing vocalText, so enforcement/meta-tag resolution can trust this
   * instead of sniffing vocalText's own prose — the only way a 'duet'
   * selection is enforceable at all, since a duet's text legitimately
   * contains both a male and a female word. For a kids-quota slot this is
   * always equal to vocalType; for every other channel it's the matched
   * preset's own gender (or undefined for custom free-text vocalTone).
   */
  vocalGender?: 'male' | 'female' | 'mixed' | 'duet';
  /**
   * TASK v3.42 Part B2 — this trackNo's resolved hook-device text (see
   * data/hookDevices.ts / core/hookDevicePlan.ts's buildHookDevicePlan),
   * same instruction-only verbatim-weave trust model moneyChordText already
   * uses. Replaces the old fixed MONEY_CHORD_FEEL_SUFFIX reinforcement
   * boilerplate — measured identical across every song in a real 15-song
   * pack — with a per-song rotating arrangement-contrast device instead.
   * Always set (every archetype, not gated behind a quota), since the
   * boilerplate it replaces was never archetype-specific either.
   */
  hookDeviceText?: string;
  /**
   * TASK v3.64-B — this trackNo's rotating melodic-design/earworm phrase
   * (see core/promptComposer.ts's EARWORM_STYLE_VARIANTS /
   * rotatingEarwormText). Only set when opts.earwormMode is on. Replaces
   * the old fixed EARWORM_STYLE_ATOMS string, which every song in a real
   * 18-song pack carried identically ("simple stepwise melody, easy to
   * hum, singalong-friendly pop hook, predictable diatonic phrase
   * structure", 18/18) — different instrumentation per genre still read as
   * "the same song" because the melodic-construction technique itself
   * never varied. Same instruction-only, reference-not-verbatim trust
   * model as hookDeviceText above.
   */
  earwormText?: string;
  /**
   * TASK v3.43 Step 2 (Part A3) — this trackNo's rotating instrument
   * selection: the channel's identity-anchor instrument plus 1-2 more
   * seed-shuffled from the rest of the genre pack's pool (see
   * core/promptComposer.ts's rotatingInstrumentSet — the array form
   * rotatingInstrumentText's comma-joined string is built from). Local
   * generation already computes this per song directly; this promotes the
   * same value to realtime/Batch/bridge so those paths get the same
   * per-song instrument variety instead of a flat whole-pack instrument
   * list. An array (not pre-joined text) so the agent instruction/import
   * repair can check/weave each instrument name individually.
   */
  instrumentSet?: string[];
  /**
   * TASK v3.43 Step 2 (Part A3) — this trackNo's arrangement-weight level
   * (see core/promptComposer.ts's arrangementDensityLevel /
   * ARRANGEMENT_DENSITY_TEXT_BY_LEVEL for the level->descriptive-text
   * lookup used to weave/verify this in a stylePrompt). Kept as the bare
   * enum tag (not pre-composed text) to match moneyChordPlan-style rotation
   * fields the model receives alongside a one-time legend in the
   * instructions, rather than duplicating the description on every entry.
   */
  arrangementDensity?: 'sparse' | 'medium' | 'full';
  /**
   * TASK v3.43 Step 2 (Part A3) — this trackNo's lyric section-order
   * template id (see core/lyricEngine.ts's StructureTemplateId /
   * buildStructureTemplatePlan). Unlike moneyChordText/hookDeviceText/
   * instrumentSet/arrangementDensity, this shapes the lyric's own section
   * tags, not a stylePrompt phrase — a remote agent writes its own lyrics
   * from a one-time template legend in the instructions (see
   * core/lyricEngine.ts's STRUCTURE_TEMPLATE_SECTION_NOTES), so there is
   * nothing to inject post-hoc the way stylePrompt atoms are; import
   * checks for a template's distinctive section tag instead and warns
   * (never errors) if it's missing.
   */
  structureTemplate?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  /**
   * TASK v3.64 (TASK B) — real bridge output measured 12/18 songs singing a
   * leaked line under a bare [intro] tag. The v3.62 TASK 2-4 strip rule
   * keyed off stylePrompt declaring "(INTRO ONLY)" verbatim, but v3.62
   * TASK 1 removed that exact verbatim requirement — the declaration this
   * rule looked for stopped being written, so the rule never fired again.
   * This is the app-planned replacement signal (never inferred from
   * stylePrompt text): 'instrumental' means no sung line may appear under
   * [intro] (songPostProcess.ts strips it); 'vocal-immediate' means no
   * [intro] tag at all (cold-open convention, see lyricEngine.ts);
   * 'vocal-after-texture' allows a short sung line under [intro] as-is.
   */
  introMode?: IntroMode;
  /** v3.47 Step 3: planned lyric theme id for UI/bridge inspection and optional manual allocation. */
  lyricTheme?: string;
  /** v3.47 Step 2: concrete lyric scene copied from data/lyricThemes.ts, not generated here. */
  lyricThemeText?: string;
  /** v3.47 Step 2: emotional arc paired with lyricThemeText. */
  lyricThemeArc?: string;
  /** v3.64 (TASK A) — which scene frame this trackNo's lyricTheme belongs to (see data/lyricThemes.ts's LyricTheme.frameId); 'solitary-object' for every theme that predates this field. Surfaced in the bridge instruction so the agent understands what kind of scene it's writing, not just its concrete details. */
  lyricFrameId?: string;
  /** v3.47 Step 3: planned lyric point of view for UI/bridge inspection and optional manual allocation. */
  pov?: LyricPerspective;
  /** v3.47 Step 2: section-level lyric-writing approach for the verse. */
  verseStyle?: LyricSectionStyleId;
  verseStyleText?: string;
  /** v3.47 Step 2: section-level lyric-writing approach for the chorus. */
  chorusStyle?: LyricSectionStyleId;
  chorusStyleText?: string;
  /** Optional ids carried for pre-generation preview labels; text fields remain the authoritative prompt instructions. */
  moneyChordId?: string;
  hookDeviceId?: string;
  introTextureId?: string;
  /**
   * v3.67 (TASK A) — this trackNo's one designed peak moment (see
   * data/killingPoints.ts), a single short style-prompt atom. Undefined for
   * a track with no killing point (arc peakStrength 'none' — see
   * core/arcPlan.ts, roughly 4 of 18 tracks by design). Unlike
   * moneyChordText/hookDeviceText, this is never force-injected into
   * stylePrompt verbatim (see core/batchPreallocation.ts's
   * reconcileWithPreassignedSlot, which does not enforce this field) — it's
   * conveyed as intent, the composer chooses its own exact wording.
   */
  killingPointText?: string;
  /** v3.67 (TASK A) — where in the song killingPointText's moment lands. */
  killingPointPlacement?: 'final-chorus' | 'bridge' | 'mid-instrumental' | 'pre-chorus' | 'outro';
  /** v3.68 (TASK B) — this trackNo's killing point id (data/killingPoints.ts KillingPoint.id), snapshotted for rating analysis alongside killingPointText/killingPointPlacement above. */
  killingPointId?: string;
  /** v3.68 (TASK B) — this trackNo's own lead genre's broad era bucket (see data/genreLibrary's GenrePack.eraTag), for rating analysis. */
  eraTag?: string;
  /** v3.68 (TASK B) — this trackNo's arc phase (see core/arcPlan.ts), for rating analysis. */
  arcPhase?: string;
  /** v3.68 (TASK B) — this trackNo's arc intensity, 1-5 (see core/arcPlan.ts), for rating analysis. */
  intensity?: number;
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
  /** TASK v3.39.1 Part B4 — always set at save time (see core/library.ts's savePack); optional only so packs saved before this task keep loading. true for every pack this app produces (see core/exportCompliance.ts's AI_DISCLOSURE_LINE) — there is no non-AI generation path. */
  aiDisclosure?: boolean;
  /** TASK v3.39.1 Part B4 — derived from channel.archetype === 'kids' at save time (core/exportCompliance.ts's isMadeForKidsChannel), stored so a saved pack's COPPA status is visible without re-deriving it from the channel record, which may since have changed. */
  madeForKids?: boolean;
  /** v4.0 (TASK A1) — which workspace this pack belongs to; optional only so packs saved before this task keep loading (core/workspaceMigration.ts backfills them to 'senior-oldpop'). See core/workspaceScope.ts. */
  workspaceId?: WorkspaceId;
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

export interface ThumbnailCompositionGuide {
  topSubcaption: string;
  mainPhrase: string;
  subtitle: string;
  bottomBrandLine: string;
  textColor: string;
  shadowColor: string;
  playerOverlay: boolean;
}

export interface ThumbnailMotionGuide {
  kenBurns: {
    direction: string;
    speed: string;
    startFrame: string;
    endFrame: string;
  };
  aiVideoPrompt: string;
  loopAdvice: string;
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
    qwenImage: string;
    stableDiffusion: string;
  };
  /** TASK v3.40 Part D4 — text/canvas guidance kept separate from every image prompt. */
  compositionGuide?: ThumbnailCompositionGuide;
  /** TASK v3.40 Part D6 - video background motion guidance, separate from image prompts. */
  motionGuide?: ThumbnailMotionGuide;
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
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type ThumbnailBadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ThumbnailBrandBadge {
  icon: string;
  tag: string;
  position: ThumbnailBadgePosition;
}

export interface ThumbnailTextStyle {
  fontId: ThumbnailFontId;
  textColor: string;
  shadowColor: string;
  shadowWidth: number;
  strokeOn: boolean;
  position: ThumbnailTextPosition;
}

export type ThumbnailLayerRole = 'topSubcaption' | 'title' | 'divider' | 'subtitle' | 'brandLine';

export type ThumbnailDividerPreset = 'line' | 'line-ornament' | 'text';

export interface ThumbnailTextLayer extends ThumbnailTextStyle {
  id: string;
  role: ThumbnailLayerRole;
  text: string;
  enabled: boolean;
  /** Canvas-height relative font size. Legacy title default is 0.13 for one line and 0.11 for two lines. */
  sizeRatio: number;
  /** Anchor-relative fine movement stored as canvas-size ratios so layouts survive resolution changes. */
  offsetXRatio: number;
  offsetYRatio: number;
  lineHeightRatio: number;
  letterSpacingRatio: number;
  opacity: number;
  maxLines: number;
  /** Optional anchor padding override. Missing preserves the legacy 0.07 canvas-height padding. */
  paddingRatio?: number;
  dividerPreset?: ThumbnailDividerPreset;
  dividerThicknessRatio?: number;
  dividerWidthRatio?: number;
  /** Default-on readability plate behind editable text in the composed image. */
  scrimEnabled?: boolean;
  scrimColor?: string;
  scrimOpacity?: number;
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
  layers?: ThumbnailTextLayer[];
  locked: boolean;
  updatedAt: string;
}
