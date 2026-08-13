export type ProviderType = 'local' | 'openai' | 'anthropic';

export type Market = 'korea' | 'japan' | 'global' | 'custom';
export type LyricLanguage = 'english' | 'korean' | 'japanese' | 'bilingual';

/**
 * TASK (bilingual pair auto-detection gap) — the real EXPECTED language pair
 * for a `lyricLanguage: 'bilingual'` pack. Before this, checkLyricLanguageMatch
 * (core/lyricMetrics.ts) had no way to know which of Korean/Japanese a
 * bilingual pack was actually supposed to mix with English — it auto-detected
 * by picking whichever of the two happened to appear MORE in the lyrics body
 * it was given, so a jp-kids pack whose lyrics came back as English+Korean
 * instead of the expected English+Japanese still "passed" as long as enough
 * Korean was present. GenerationOptions.bilingualPair carries the real
 * expectation through so the check can validate against it directly instead
 * of guessing. Optional/undefined preserves every existing caller's exact
 * behavior — checkLyricLanguageMatch falls back to the old auto-detect
 * heuristic whenever it isn't supplied (see core/localGenerator.ts's
 * resolveBilingualPair for the real per-workspace default: kr-kids ->
 * 'en-ko', jp-kids -> 'en-ja', same opts.bilingualPair ?? archetype-default
 * priority shape as resolveKidsAgeTierId).
 */
export type BilingualPair = 'en-ko' | 'en-ja';

/**
 * v4.1 (TASK A) — how narrow or wide a concept's own intended diversity is.
 * 'focused': deliberately narrow ("잔잔한 보사노바 18곡", "수면용 어쿠스틱 팝") —
 * genre/BPM/vocal-type variety gates should relax, but lyric-scene/emotion
 * diversity must NOT (a unified sound needs MORE varied lyrics, not less —
 * see this task's own "음악이 통일될수록 가사가 더 달라야 합니다"). 'variety':
 * deliberately broad ("6070 올드팝 모음", "다양한 장르"). 'balanced': today's
 * existing fixed thresholds, unchanged — the default when neither signal
 * is detected. See core/constraints.ts's detectConceptBreadth for the
 * auto-detector and core/designGate.ts's BREADTH_THRESHOLDS for the actual
 * per-breadth gate numbers.
 */
export type ConceptBreadth = 'focused' | 'balanced' | 'variety';
export type LyricPerspective = 'firstPerson' | 'secondPerson' | 'thirdPerson' | 'radioHost';
/**
 * TASK v6.0 (perspectiveMode) — how strongly `perspective` (the chosen POV)
 * should dominate the pack's own pov axis, distinct from WHICH perspective
 * was chosen. 'dominant' is this app's pre-existing real behavior (see
 * core/setDirector.ts's povCounts) — the chosen perspective gets ~60% of the
 * songs (11 of 18), the rest spread across the other two — and stays the
 * type's own default so any caller that never sets this field keeps
 * byte-identical output. 'fixed' gives the chosen perspective 100% of the
 * pack ("18곡 전부 1인칭"). 'varied' spreads as evenly as songCount allows
 * across firstPerson/secondPerson/thirdPerson with no lean toward the chosen
 * one at all ("자동 분산") — see core/lyricDiversityPlan.ts's povDistribution
 * for the exact split math shared by both the manual (setDirector.ts
 * povCounts) and auto (lyricDiversityPlan.ts defaultPovPattern) pov paths.
 */
export type PerspectiveMode = 'fixed' | 'dominant' | 'varied';
/**
 * TASK (genreBlendMode) — whether every song's genre mix blends in the
 * first-selected ("primary") genre, or each song plays only its own
 * assigned lead genre. See core/genreRotation.ts's genresForTrack for the
 * actual function this toggles the behavior of (the v3.58 design this whole
 * feature makes visible/optional, not a bug — see that function's own doc
 * comment). 'shared-primary' (default): today's pre-existing behavior — the
 * pack's first-selected genre gets blended into every song regardless of
 * that song's own lead genre, giving a whole set a common sonic thread
 * rather than songs that sound genre-disconnected from each other
 * ("공통 중심 장르" in Step2Concept's picker). 'lead-only': each song gets
 * ONLY its own lead genre, no forced primary blend — sharper per-song genre
 * contrast ("곡마다 한 장르만").
 */
export type GenreBlendMode = 'shared-primary' | 'lead-only';
/**
 * TASK v5.13 (vocal allocation mode) — real regression: a K-pop channel's
 * fixed gender quota (ChannelProfile.vocalQuotaOverride, e.g. kr-idol-male's
 * `{male:15,female:0,mixed:3}`) had no label distinct from a genuinely
 * "balanced" auto-allocation — both the Step2Plan "목소리" recommendation
 * card and the pre-generation contract screen only ever displayed a boolean
 * (`vocalIsBalanced`), so a deliberately gender-locked idol channel read as
 * "고르게 배분" (evenly balanced) exactly like a senior channel with no lean
 * at all. This is a 4-way classification of WHY the resolved vocal quota
 * looks the way it does, not a new quota shape:
 *  - 'channel-fixed': the channel itself hard-codes the gender split
 *    (`channel.vocalQuotaOverride` is set) — never "balanced", regardless of
 *    whether a vocal-tone preset was also picked on top of it.
 *  - 'leaning': no channel-fixed quota, but the user's picked vocalTone
 *    resolves to a real gender lean (core/vocalPlan.ts's leaningGenderFor
 *    returns 'male'/'female'/'duet' — NOT the gender-neutral 'mixed', which
 *    leaves the quota untouched, see leaningAdultVocalQuota) that skews the
 *    quota toward one gender.
 *  - 'manual': the user picked something explicit that doesn't itself move
 *    the quota — a gender-neutral group/choir preset (gender 'mixed', e.g.
 *    "혼성 화음 그룹" — NOT a duet: a duet lean DOES skew the quota toward
 *    the 'mixed' vocalType, see leaningAdultVocalQuota, so a duet pick
 *    resolves to 'leaning' above, not here) or an unrecognized free-text
 *    tone — or an explicit opts.vocalQuota override was supplied directly.
 *  - 'balanced': the true default — no channel-fixed quota, no lean, no
 *    explicit tone pick (vocalTone is unset or still equals the channel's
 *    own untouched `defaultVocal`). See core/vocalPlan.ts's
 *    resolveVocalAllocationMode for the resolver and isVocalToneBalanced for
 *    the plain tone-only check this reuses for its final branch.
 */
export type VocalAllocationMode = 'balanced' | 'leaning' | 'channel-fixed' | 'manual';
export type LyricSectionStyleId = 'narrative' | 'image' | 'dialogue' | 'hookRepeat';
/** TASK D5 (v3.6) — the language titles/thumbnails/packaging are written in, independent of the lyrics' own language (e.g. a Korean channel commonly runs English lyrics with Korean packaging). */
export type DisplayLanguage = 'english' | 'korean' | 'japanese';
export type AgeGroup = 'kids' | 'teens' | 'twenties' | 'thirtiesForties' | 'seniors' | 'allAges' | 'general';

// TASK D1 §3-2 — 'kr-kids-song'/'jp-kids-song' added (Approach A, per user decision): 'kids' itself
// stays as-is (still used by the senior workspace's little-singalong-radio channel) so kr-kids/jp-kids
// get their own per-workspace archetype, matching every other non-senior workspace's convention
// (kr-2030-pop/jp-2030-pop). See utils/channelArchetype.ts's isKidsArchetype() for the combined check.
// TASK K2 — 'kr-idol-female' is added now (not by K3) per K2 §3-3's own
// explicit instruction: the 7 kr-idol genre packs reference both archetypes
// from day one so K3 never has to edit an existing genre's `archetypes`
// array later (this track's own additive-only rule). K3 is still the one
// that wires 'kr-idol-female' up to a real workspace/genre-visibility/audience
// entry — see the 'kr-idol-female': [] placeholders below and in
// utils/channelProfile.ts, the same "declared but not yet built" pattern
// 'christmas'/'lofi-study' already used in CORE_GENRE_IDS_BY_ARCHETYPE.
export type ChannelArchetype = 'senior-morning' | 'showa-cafe' | 'christmas' | 'lofi-study' | 'kids' | 'showa-70s' | 'j2000s' | 'modern-chill' | 'city-night' | 'oldpop-lounge' | 'kr-2030-pop' | 'jp-2030-pop' | 'kr-kids-song' | 'jp-kids-song' | 'kr-idol-male' | 'kr-idol-female';

/** v4.0 (TASK A1) — one app, five isolated workspaces; see src/data/workspaces/index.ts for the full definition and src/core/workspaceScope.ts for how data gets namespaced by this id. */
export type WorkspaceId = 'senior-oldpop' | 'kr-2030' | 'jp-2030' | 'kr-kids' | 'jp-kids' | 'kr-idol-male' | 'kr-idol-female';

/** v3.64 (TASK B) — see PreassignedSongSlot.introMode's own doc comment for why this exists and what each value governs. */
export type IntroMode = 'instrumental' | 'vocal-immediate' | 'vocal-after-texture';

/** 지시문 23 (TASK A) — 체감 에너지, 1(매우 잔잔)~5(매우 활기). core/perceivedEnergy.ts's computePerceivedEnergy가 계산한다. arcPlan.ts의 intensity(구조상의 위치)와는 별개 값 — 둘의 불일치가 보정 데이터다(§A-5). */
export type PerceivedEnergy = 1 | 2 | 3 | 4 | 5;

/**
 * 지시문 23 (TASK B) — "청취 목적". oldpoplounge의 기본 정체성을 "60~70년대
 * 음악을 복원하는 채널"에서 "60~70년대의 따뜻한 기억을 오늘 편하게 오래
 * 들을 수 있는 음악으로 만드는 채널"로 옮기는 하루의 판단(§0-1)을 반영하되,
 * 되돌릴 길(§0-2)로 'era-authentic'을 preset으로 남긴다.
 */
export type ListeningIntent = 'long-listen-comfort' | 'balanced' | 'era-authentic';

/**
 * 지시문 15 (TASK A-1) — SongIdea.distinctChoice(사람이 읽는 한 줄 설명, 위)와
 * 분리된, 기계가 판정 가능한 구조화 값. 어떤 ruleId를 이 워크스페이스가
 * 허용하는지는 core/workspaceQualityPolicies.ts의 DistinctChoicePolicy가
 * 정한다 — 이 타입 자체는 전체 카탈로그일 뿐 워크스페이스별 허용 여부를
 * 모른다. core/distinctChoiceTypes.ts에 verifiability 매핑·라벨·
 * coerceDistinctChoice(하위호환 파서)가 있다.
 */
export type DistinctChoiceRuleId =
  // ① 가사 AST로 검증 가능 (core/lyricsAst.ts의 LyricsSection[])
  | 'NO_CHORUS'
  | 'FINAL_QUESTION'
  | 'VOCAL_TOGETHER'
  | 'VERSE2_HALF_LENGTH'
  | 'VERSE_TAIL_REPEAT'
  | 'WORD_ACCUMULATION'
  | 'SCENE_PER_VERSE'
  | 'HOOK_LAST_WORD_SHIFT'
  | 'SINGLE_CHORUS'
  | 'CALL_AND_RESPONSE'
  // 지시문 37 (TASK C-2) — K-pop singability: 챈트형 훅 존재 · 훅 4회 이상 반복
  | 'CHANT_HOOK'
  | 'HOOK_REPEAT_4X'
  // ② stylePrompt 자기모순만 검증 가능
  | 'NO_INTRO'
  | 'KEY_LIFT'
  | 'OCTAVE_DOWN_CHORUS'
  | 'MODE_SHIFT'
  // ③ 검증 불가 — 미구현이 아니라 텍스트에 흔적이 남지 않는 편곡 지시
  | 'ARRANGEMENT_NUANCE';

/** 지시문 15 (TASK A-1) — ruleId 하나가 어떤 방식으로만 검증 가능한지 (고정, 곡마다 다르지 않음). */
export type DistinctChoiceVerifiability = 'lyrics-ast' | 'prompt-only' | 'not-measured';

/**
 * codex 지시문 02 (TASK D) — which system owns "what scene does this track's
 * lyric depict": 'fixed-pool' (data/lyricThemes.ts's allocated scene, the
 * default — the vast majority of real generations) vs 'concept-generated'
 * (core/bridgeInstruction.ts's conceptSceneInstructionLines asks the agent
 * to invent its OWN concept-derived scenes instead, single-pack bridge
 * generation only, when a real customConcept + conceptSceneContext are both
 * present). See core/bridgeInstruction.ts's resolveScenePlanningMode for the
 * real trigger condition and lyricThemeInstructionLineFor/
 * lyricThemeSceneSection for the collision this closes: those two functions
 * used to unconditionally tell the agent the FIXED-pool scene "must" be
 * depicted, even in the same instruction that separately told it to invent
 * its own concept-derived scene for the same track — two contradictory
 * scene authorities in one document. 'same-story-comparison' is an
 * explicit opt-in exemption this task's own spec named (e.g. "same event,
 * two different singers' perspectives") — kept as a real type member for
 * the day a caller wants it, but no UI/opts field selects it yet (see
 * resolveScenePlanningMode's own doc comment) — not fabricated ahead of a
 * real trigger.
 */
export type ScenePlanningMode = 'fixed-pool' | 'concept-generated' | 'same-story-comparison';

/**
 * 지시문 10 (TASK A-2) — decade-granularity era intent, distinct from
 * core/constraints.ts's own EraConstraint/EraBucket: EraBucket collapses
 * 1950s+1960s into one genre-data bucket ('1950s-60s', since the genre
 * library has no finer split), which is the right granularity for GENRE
 * selection but too coarse for reading what a stylePrompt's own PROSE
 * actually claims ("1960s" vs "1970s" are different literal strings a real
 * pack can and does mix — see core/eraIntent.ts's extractEraClaims). This
 * type is built ON TOP of the existing EraConstraint (core/eraIntent.ts's
 * deriveEraIntent reuses core/constraints.ts's extractEraConstraint
 * unchanged for all the hard Korean-text parsing work — no new parser),
 * never a replacement for it — genre-pool filtering still keys off
 * EraBucket/ERA_BUCKET_BY_GENRE_ID, only the prose-claim check below reads
 * this finer type. Stored on GenerationOptions.eraIntent (and so, via
 * GenerationSnapshot.options, on the generation snapshot too) once computed.
 */
export interface EraIntent {
  primary: '1950s' | '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s';
  secondary?: EraIntent['primary'];
  primaryMinShare: number;
  secondaryMaxShare?: number;
  transitionAllowed: boolean;
}

/**
 * v5.13 (TASK: kidsAgeTierId wiring) — the real, previously-undone gap named
 * in data/kidsAgeTiers.ts/data/kidsStructureTemplates.ts/data/kidsVocabularyWhitelist.ts/
 * data/killingPointsKids.ts/data/onomatopoeia.ts/core/arcModels.ts/core/promptComposer.ts's
 * own doc comments: every one of those already has real, tier-aware
 * behavior gated behind an optional `ageTier`/`kidsAgeTierId` parameter, but
 * no field anywhere on GenerationOptions/ChannelProfile ever supplied one —
 * every real call site called them with the parameter omitted (see
 * docs/v58-report.md/docs/d2-report.md's identical "ageTier 파이프라인 연결:
 * 없음" finding). This is that field, single-sourced here (not redefined —
 * data/kidsVocabularyWhitelist.ts now re-exports this exact type instead of
 * declaring its own copy, since every kids-tier data file already imports
 * from that one module's re-export chain).
 */
export type KidsAgeTierId = 'kids-t1' | 'kids-t2' | 'kids-t3';

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
  /**
   * TASK K2 §5-1 — a single-gender-group channel's own vocal quota,
   * overriding the shared DEFAULT_ADULT_VOCAL_QUOTA (core/vocalPlan.ts)
   * that senior-oldpop/kr-2030/jp-2030 all still use unchanged. Optional and
   * additive: undefined for every existing channel preset, so
   * core/localGenerator.ts's existing `opts.vocalQuota ?? (kids ? ... :
   * DEFAULT_ADULT_VOCAL_QUOTA)` fallback chain behaves 100% as before for
   * them — this only takes effect for a channel that explicitly sets it
   * (kr-idol-male's own 3 channel presets: `{ male: 15, female: 0, mixed: 3
   * }`, mixed left non-zero for real-world featuring/duet tracks — see K2's
   * own report for why 0 was rejected).
   */
  vocalQuotaOverride?: { male: number; female: number; mixed: number };
  /**
   * v5.13 (TASK: kidsAgeTierId wiring) — this channel's own default age
   * tier (see KidsAgeTierId's own doc comment). Only meaningful for a kids
   * archetype ('kids'/'kr-kids-song'/'jp-kids-song') — undefined for every
   * non-kids channel and for every kids channel that hasn't been assigned
   * one yet (falls back to data/kidsAgeTiers.ts's own
   * DEFAULT_KIDS_AGE_TIER_ID wherever a tier is actually needed, same
   * no-signal-yet fallback every consumer already had before this field
   * existed). GenerationOptions.kidsAgeTierId (below) can override this
   * per-generation the same way opts.vocalTone already overrides
   * channel.defaultVocal.
   */
  kidsAgeTierId?: KidsAgeTierId;
  /**
   * 지시문 29 (TASK D) — 실측: 채널 "퇴근 후 감성 밴드팝"(after-work-band-pop)의
   * 실제 배정이 emo-band-pop 6 · noir-deep-house 6 · electro-pop 6로 나와
   * 밴드팝(채널 정체성 장르)이 1/3에 불과했다 — preferredGenres는 "이 채널이
   * 쓸 수 있는 장르 풀"만 정의할 뿐 "그중 무엇이 이 채널의 정체성인가"는
   * 어디에도 없었다. primaryGenreIds가 그 정체성 장르(들)를 명시하고,
   * primaryGenreMinShare가 최소 비중을 정한다 — core/setDirector.ts's
   * chooseGenreIds가 후보 풀 구성 시 우선 채운다(genreIssues의 하드
   * 상한처럼 강제 배정은 아니다 — 후보 우선순위 힌트).
   * 값은 전부 추정치다 — 정책 필드로 두고 verified: false로 시작한다
   * (§하지 말 것 "verified: false인 값으로 세트를 차단하지 말 것" — 이
   * 필드는 advisory 관찰에만 쓰인다, 새 blocking 관문을 만들지 않는다).
   */
  primaryGenreIds?: string[];
  /** 0~1. 지시문 29 TASK D 정책값(추정) — 청취로 검증되지 않았다. */
  primaryGenreMinShare?: number;
}

/**
 * TASK K2 §5-3 — an idol group's part structure, entirely separate from
 * VocalGender (core/vocalPlan.ts): that union's 'duet' already has a fixed
 * meaning wired into several places (e.g. core/batchPreallocation.ts's own
 * mixed→duet remap for non-kids archetypes), so this is a new, optional,
 * additive axis rather than a widened union. Undefined for every existing
 * song — only a kr-idol-male (later kr-idol-female) song ever sets it.
 */
export interface IdolPartPlan {
  lead: 'main-vocal' | 'sub-vocal' | 'rapper';
  chorus: 'unison' | 'main-vocal' | 'layered-harmony';
  hasRapSection: boolean;
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
  /**
   * v5.8 (audit follow-up, docs/v58-report.md) — optional, defaults to
   * falsy/unset for every existing profile (strict no-op: senior-oldpop/
   * kr-2030/jp-2030/kr-idol-* keep the exact tempo-band behavior v3.58/v3.77
   * established — wide BPM variety drawn from this profile's own
   * tempoFloor/tempoCeiling regardless of which genre a track happens to
   * use, deliberately, per those tasks' own real-measured stddev findings).
   * When true, core/tempoPlan.ts's resolveTempoWithBand instead remaps each
   * track's within-band position onto that track's OWN selected genre's
   * real tempoRange, so a workspace whose genres genuinely span calm-to-
   * energetic (kr-kids: krkids-sleep-calm 62-84 vs krkids-action 112-128,
   * both in the same workspace) doesn't get every song clamped into one
   * wide, genre-blind band. See that function's own doc comment for why a
   * flat per-genre clamp isn't the fix used for the 4 adult workspaces —
   * this flag exists so kr-kids/jp-kids can opt into different tempo
   * semantics without changing anyone else's.
   */
  genreBoundedTempo?: boolean;
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
  /**
   * v4.1 (TASK B) — per-language lyric length targets. Real measurement: a
   * one-line Korean/Japanese/English translation of the same sentence came
   * back 6/1/9 "words" under English's own whitespace-split word counter —
   * Japanese has no spaces at all (the whole lyric collapses to ~1 "word"),
   * Korean's 어절 count runs well below English's word count for the same
   * sung duration. `lyricWordRange` above stays the language-agnostic
   * legacy field (still read by any caller that hasn't migrated to
   * core/lyricMetrics.ts's measureLyrics yet); this is the real per-language
   * source of truth going forward. Optional per-language entry — a profile
   * only needs to populate the languages it actually generates in.
   * **Values below (where populated) are estimates from a single reference
   * translation, not real Suno-render measurements — recalibrate after the
   * first real Korean/Japanese sets (see v4.2's own stated purpose).**
   */
  lyricMetricsByLanguage?: Partial<Record<LyricLanguage, {
    primaryRange: [number, number];
    syllableRange: [number, number];
    /** Kids-only: minimum required repeated-word ratio (0-1). */
    repetitionRatioMin?: number;
    /** Kids-only: maximum distinct non-repeated words allowed. */
    uniqueWordMax?: number;
  }>>;
  /**
   * TASK (design-gate audience decoupling) — core/designGate.ts's
   * arrangementDensityBlockingIssues used to hard-code `fullCount <= 4`
   * globally, a number real senior-listening feedback established (v4.16,
   * "12/18 tracks reading as 'full' density ... too dense to feel calm") and
   * that has no basis whatsoever for a K-pop performance-track workspace or
   * a kids action-song workspace — both legitimately WANT most tracks at
   * 'full' density. `fullMax` is the max count of 'full'-density tracks this
   * profile's own pack tolerates before blocking; `sparseMin` is a paired,
   * currently informational (not yet read by any check) minimum 'sparse'-
   * density count consistent with the same profile's character, reserved for
   * a future advisory check. senior's `fullMax` is EXACTLY 4 — the one real,
   * already-tuned number that must never move (see designGate.ts's own
   * "critical constraint" doc comment). `general`/generic `kids` (the two
   * profiles senior-oldpop's own non-senior-audience sub-channels — modern-
   * chill/city-night/lofi-study/the shared 'kids' archetype — resolve to via
   * the age-group fallback, NOT the literal 'senior' profile) are also kept
   * at 4 for the same reason: senior-oldpop workspace behavior must stay
   * byte-identical for ALL its archetypes, not just the literal senior-morning
   * one.
   */
  arrangementDensityLimits: { sparseMin: number; fullMax: number };
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
  /**
   * TASK v4.9 (TASK B, §2-3) — real listening feedback: "재즈는 남녀 상관없이
   * 약함. 재즈 = 무조건 여자" (and the analogous crooner/europop/soul
   * observations this task's own §2-3 table generalizes from). A soft
   * weighting hint (never a hard filter — this app's own established
   * "가중치로만 씁니다, 강제하지 않습니다" convention, matching
   * core/vocalPlan.ts's channelFlavorWeight) toward which vocalType this
   * genre's own real recordings actually lean, consulted by
   * core/vocalGenreAffinity.ts's applyGenreVocalAffinity to bias WHICH
   * song-slot gets which genre+vocalType pairing without changing either
   * axis's own pack-wide marginal counts (still 6 male/6 female/6 mixed for
   * an 18-song adult pack, unchanged). Weights need not sum to 1; absent
   * entirely means "no opinion" (uniform 1/1/1), the default for every
   * genre this task doesn't explicitly name.
   */
  vocalPreference?: { male: number; female: number; mixed: number };
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

/**
 * TASK K1 — a plan for a song where different sections use different
 * genres ("구간 배정", not the 2-genre blendGenreTraits average — see
 * core/sectionGenrePlan.ts's own doc comment for why K-pop's multi-genre
 * songs need per-section assignment rather than blending). Purely additive
 * and opt-in: a GenerationOptions/blueprint without this field uses the
 * existing single-genre-per-song path unchanged. Not used by any of the
 * five existing workspaces (senior-oldpop/kr-2030/jp-2030/kr-kids/jp-kids)
 * — reserved for the future idol workspaces (K2/K3).
 */
export interface SectionGenrePlan {
  sections: SectionGenreSlot[];
  /** How the transition between adjacent sections should read. See core/sectionGenrePlan.ts's own doc comment for the default. */
  transition: 'hard-cut' | 'ramp' | 'shared-spine';
}

export interface SectionGenreSlot {
  /** e.g. 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro' — follows whatever section-structure vocabulary the caller's structure template uses (A3's own structureTemplateSetId owns section naming; this field just references it by string id). */
  sectionId: string;
  genreId: string;
  /** How much this section's genre should stand out. */
  presence: 'accent' | 'primary';
}

/**
 * TASK K1 — the axes that stay fixed across every section of a
 * SectionGenrePlan (see core/sectionGenrePlan.ts's composeSectionGenres),
 * so a multi-genre song still reads as one song rather than several
 * stitched together. Sourced from the chorus section's own genre — see
 * that function's own doc comment for why.
 */
export interface SpineTraits {
  eraTag: string;
  vocalTraits: string[];
  productionTraits: string[];
  dynamicRange: 'low' | 'medium' | 'wide';
  structureTraits: string[];
  bpm: number;
  /** The single instrumentation item shared across every section, so the song doesn't sound like a splice. */
  sharedInstrument: string;
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

/**
 * TASK (provenance) — where a given field's CURRENT value on GenerationOptions
 * actually came from, recorded at the moment it was set rather than
 * reconstructed later by inspecting the resulting option shape (see
 * core/userChoices.ts's own doc comment for the real, verified gap this
 * closes: the old after-the-fact inference missed a genre-chip-only
 * selection and never tracked vocalTone at all — the exact bug class
 * v3.77/v4.13 shipped as live regressions).
 *  - 'user': a real UI click/keystroke this session (Step2Concept.tsx's
 *    pickers, Step1Channel.tsx/Step2Plan.tsx/Step3Generate.tsx's controls).
 *    Choosing the explicitly-labeled "balanced"/"고르게" option counts as
 *    'user' too — it's still a deliberate pick, even though the resulting
 *    value happens to equal what the field would have defaulted to anyway.
 *  - 'default': never touched — still whatever createInitialOptions (or a
 *    field's own resolver) set it to.
 *  - 'concept': applied via a concept-agent recommendation (Step2Concept.tsx's
 *    handleApplyConceptRecommendation).
 *  - 'channel': reset to a channel's own default the moment that channel was
 *    selected/applied (App.tsx's applyChannelToOptions, called from every
 *    useChannelManager.ts entry point that switches/saves/creates a channel).
 *  - 'system': overwritten by a system-driven correction, e.g. a design-gate
 *    auto-fix (Step2Plan.tsx's/Step3Generate.tsx's shared
 *    applyDesignGateAutoFix, via core/userChoices.ts's provenanceForSystemFix).
 *  - 'migration': reserved for a future schema-migration writer (e.g.
 *    normalizing an old saved pack's fields on load) — no real caller sets
 *    this today; included so a future migration doesn't have to invent a new
 *    ChoiceSource value and touch every switch/consumer of this type.
 */
export type ChoiceSource = 'user' | 'default' | 'concept' | 'channel' | 'system' | 'migration';

/**
 * TASK (provenance) — the 13 GenerationOptions axes this app has ever shipped
 * (or could plausibly ship) a "system default silently wins over what the
 * user picked" regression for, each mapped to its own ChoiceSource. Every key
 * here is optional on GenerationOptions.choiceProvenance (a field genuinely
 * untouched this session simply has no entry, read as 'default' by
 * consumers) — see core/userChoices.ts's userChoicesFromOptions for the one
 * function that reads this map to build UserExplicitChoices.source, and this
 * type's own field-by-field doc comments below on GenerationOptions for
 * exactly which UI control is responsible for each key.
 *
 * TASK (provenance extension) — widened from 13 to 20 axes. Real, verified
 * gap this closes: moodIds/durationTarget/lyricDepth/hookMode/referenceMood/
 * negativeStyle/avoidWords all have a real, direct click-time UI control in
 * Step2Concept.tsx (chip toggles, ChoiceGrids, or a textarea onChange —
 * grep-confirmed, same as every one of the original 13) but were never
 * tracked here, so a silent-drop regression on any of them (the same bug
 * class moneyChordMode/vocalTone/genreIds were fixed for) could never have
 * been caught by assertUserChoicesPreserved or shown on Step3Generate.tsx's
 * contract screen. Two named candidates were investigated and deliberately
 * NOT added:
 *  - openingStyle: declared on GenerationOptions and read by
 *    core/localGenerator.ts's resolveOpeningStyle, but grep-confirmed to have
 *    ZERO real UI control anywhere in src/components — nothing ever calls
 *    setOpts with an openingStyle key. There is no click-time moment to
 *    record, so adding a provenance field for it would only ever read
 *    'default' — a fake protection. (Step3Generate.tsx's contract screen
 *    still gets a display-only row for it; see that file's own comment.)
 *  - diversityAllocations' manually-set per-axis entries (structure/
 *    arrangement/intro-texture/etc.): these already carry their own
 *    AxisAllocation.mode: 'manual' | 'auto' flag, and
 *    core/diversityAllocation.ts's applyAxisAllocation already guarantees "a
 *    manual allocation always wins over the auto plan" by construction (see
 *    that function's own doc comment and core/setDirector.ts's repeated
 *    "manual-always-wins rule" references) — there is no silent-drop bug
 *    class here to protect against, and AxisAllocation[] isn't a
 *    single-value field this ChoiceSource-per-field shape fits anyway.
 */
export interface GenerationChoiceProvenance {
  moneyChordMode: ChoiceSource;
  vocalTone: ChoiceSource;
  genreIds: ChoiceSource;
  lyricLanguage: ChoiceSource;
  packagingLanguage: ChoiceSource;
  perspective: ChoiceSource;
  perspectiveMode: ChoiceSource;
  genreBlendMode: ChoiceSource;
  seasonId: ChoiceSource;
  songCount: ChoiceSource;
  breadth: ChoiceSource;
  paletteFamilyId: ChoiceSource;
  kidsAgeTierId: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's mood chip grid ("어떤 분위기로 만들까요?", toggleArray('moodIds', ...) in App.tsx) and applyChannelToOptions' channel-switch reset. */
  moodIds: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's "곡 길이" ChoiceGrid. */
  durationTarget: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's "가사 깊이" ChoiceGrid. */
  lyricDepth: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's "훅(가사 반복구) 생성 방식" chip pair. */
  hookMode: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's "Reference mood" textarea. */
  referenceMood: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's "Music Exclude styles" preset chips/textarea (toggleNegativeStylePreset and the raw textarea onChange); resetNegativeStyle records 'default' instead, since it deliberately restores the channel default. */
  negativeStyle: ChoiceSource;
  /** TASK (provenance extension) — Step2Concept.tsx's "가사에서 피할 것들" preset checkboxes + custom-term input (toggleAvoidPreset/addCustomAvoidTerm/removeAvoidTerm). */
  avoidWords: ChoiceSource;
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
  /**
   * v5.7 (TASK v5.7, TASK A) — true only when the user actually clicked a
   * money-chord choice in Step2Concept's picker this session (see that
   * component's ChoiceGrid/custom-input onChange), as opposed to
   * moneyChordMode simply still sitting at whatever createInitialOptions
   * (or a channel switch) defaulted it to. Real gap this closes: v3.15's
   * earworm mode (resolveEarwormMoneyChordMode) silently redirected ANY
   * non-default/non-canon/non-custom moneyChordMode back to 'default'
   * whenever the user had also checked "🎧 익숙한 멜로디로" — including a
   * moneyChordMode the user had JUST explicitly picked in the same screen,
   * which contradicts that function's own doc comment ("never overrides an
   * explicit user choice"). Undefined/false preserves every pre-existing
   * caller's exact behavior (including tests/earwormMode.test.ts's own
   * locked-in "showaModern -> default" expectation for the *non*-explicit
   * case) — only a caller that sets this true gets the new "explicit choice
   * wins" behavior. See core/userChoices.ts's UserExplicitChoices for the
   * broader pattern this is one instance of.
   */
  moneyChordModeIsExplicitChoice?: boolean;
  /**
   * TASK v6.0 (perspectiveMode) — how strongly `perspective` should dominate
   * the pack's pov axis; see PerspectiveMode's own doc comment for the 3
   * values. Optional/undefined resolves to 'dominant' for a non-kids
   * channel (today's exact real behavior, unchanged) and to 'varied' for a
   * kids channel (core/setDirector.ts's makeAllocations and
   * core/lyricDiversityPlan.ts's defaultPovPattern both apply this same
   * kids-varied fallback) — see this field's own
   * perspectiveModeIsExplicitChoice flag for why the resolution isn't just
   * "field present or not" (mirrors moneyChordMode/moneyChordModeIsExplicitChoice's
   * own sentinel-vs-explicit-choice problem: 'dominant' is both the neutral
   * default AND a legitimately clickable UI choice in Step2Concept's own
   * "적용 방식" picker).
   */
  perspectiveMode?: PerspectiveMode;
  /**
   * TASK v6.0 (perspectiveMode) — true only when the user actually clicked a
   * perspectiveMode choice in Step2Concept's "적용 방식" picker this session,
   * as opposed to perspectiveMode simply sitting at whatever createInitialOptions
   * defaulted it to. Same shape as moneyChordModeIsExplicitChoice just above.
   */
  perspectiveModeIsExplicitChoice?: boolean;
  customMoneyChord: string;
  customConcept: string;
  /**
   * 지시문 10 (TASK A-2) — computed once by core/eraIntent.ts's
   * deriveEraIntent (customConcept text, reusing core/constraints.ts's
   * extractEraConstraint) and stored here so every downstream reader (genre
   * candidate filtering, the design-gate insufficient-candidates check,
   * fullAudit.ts's era-prompt-claim check) reads the exact same resolved
   * intent instead of re-deriving it independently and risking drift.
   * Undefined for a concept with no era signal at all (era.unspecified) —
   * callers must not force an era in that case, same principle
   * EraConstraint.unspecified already documents.
   */
  eraIntent?: EraIntent;
  /**
   * v5.13 (TASK: kidsAgeTierId wiring) — per-generation override of
   * `channel.kidsAgeTierId`, same priority relationship opts.vocalTone
   * already has over channel.defaultVocal. Only ever read for a kids
   * archetype; every real resolver in this app uses the same
   * `opts.kidsAgeTierId ?? opts.channel.kidsAgeTierId ?? DEFAULT_KIDS_AGE_TIER_ID`
   * chain (core/localGenerator.ts's resolveKidsAgeTierId) so this stays the
   * single place downstream consumers (arc bundle plan, structure template,
   * hook-repeat count, kids killing-point set, tempo range clamp) all agree
   * on which tier a pack is actually using.
   */
  kidsAgeTierId?: KidsAgeTierId;
  /**
   * TASK (bilingual pair auto-detection gap) — per-generation override of the
   * expected 'bilingual' language pair; see BilingualPair's own doc comment.
   * Same priority relationship as kidsAgeTierId above (per-generation value
   * wins over the archetype's own real default) — core/localGenerator.ts's
   * resolveBilingualPair is the one resolver every real consumer
   * (core/lyricMetrics.ts's checkLyricLanguageMatch, threaded through
   * batchPreallocation.ts/importInspection.ts) calls instead of re-deriving
   * this per call site. Undefined for every non-'bilingual' lyricLanguage and
   * for a 'bilingual' pack whose channel archetype isn't kr-kids/jp-kids
   * (checkLyricLanguageMatch's own auto-detect fallback still applies then).
   */
  bilingualPair?: BilingualPair;
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
  /**
   * TASK v4.9 (TASK A, §1-6) — explicit override for the set's own
   * data/paletteFamilies.ts PaletteFamily id (Step2Plan's "이 세트의 계열"
   * selector). Distinct from selectedGenreFamilyIds just above (that's the
   * older, genre-level GenreFamily picker, still a separate concern — see
   * paletteFamilies.ts's own doc comment for how the two differ). Undefined
   * lets core/setDirector.ts's resolveMainFamilyId auto-resolve one instead
   * (concept keyword hint, then recency rotation).
   */
  paletteFamilyOverride?: string;
  /** v3.49A: optional selected-genre weights for blend/rotation previews. Keys are GenrePack ids, values are 0-100. */
  genreBlendWeights?: Record<string, number>;
  /**
   * TASK (genreBlendMode) — 'shared-primary' | 'lead-only'; see
   * GenreBlendMode's own doc comment for the two values. Optional/undefined
   * resolves to 'shared-primary' (core/genreRotation.ts's
   * resolveGenreBlendMode) — today's exact pre-existing genresForTrack
   * behavior, unchanged, so any caller that never sets this field keeps
   * byte-identical output. Mirrors perspectiveMode/
   * perspectiveModeIsExplicitChoice's own sentinel-vs-explicit-choice shape
   * (see that field's doc comment above): 'shared-primary' is both the
   * neutral default AND a legitimately clickable choice in Step2Concept's
   * own genre "적용 방식" picker.
   */
  genreBlendMode?: GenreBlendMode;
  /**
   * TASK (genreBlendMode) — true only when the user actually clicked a
   * genreBlendMode choice in Step2Concept's genre "적용 방식" picker this
   * session, as opposed to genreBlendMode simply sitting at whatever
   * createInitialOptions defaulted it to. Same shape as
   * perspectiveModeIsExplicitChoice/moneyChordModeIsExplicitChoice.
   */
  genreBlendModeIsExplicitChoice?: boolean;
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
   * 지시문 27 (TASK C-2) — 관문 1 위반 중 "슬롯 순서" 문제(같은 보컬 타입
   * 연속·에너지 급변)는 어떤 opts 필드로도 표현할 수 없었다 — 곡 내용
   * (moneyChordId·genreId 등)은 그대로 두고 트랙 번호만 재배열해야 하는데,
   * 기존 자동 수정은 GenerationOptions 패치만 할 수 있어서 이 종류의
   * 위반에는 실제로 아무 효과가 없었다(§C-1). 원래 트랙 번호의 순열 —
   * `preallocateSongSlots`/`generateLocalBlueprint`가 평소대로 슬롯을 전부
   * 만든 *뒤에* 마지막 단계로 한 번만 적용한다(곡 내용 재계산 없음, 순서만
   * 바뀜). 길이가 songCount와 다르거나 원소가 실제 trackNo 집합과 안 맞으면
   * 무시한다(방어적 — 오염된 값으로 슬롯을 잃지 않는다).
   */
  slotOrderOverride?: number[];
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
  /**
   * 지시문 46 (TASK D, 지시문 45 TASK C 미반영분) — core/vocalRecommender.ts's
   * recommendVocalPlan이 Step2Concept.tsx 화면에 보여주는 곡별 프리셋
   * 추천이 실측 결과 실제 생성에 전혀 닿지 않았다("추천이 화면에만 있고
   * 슬롯에 전달되지 않는다" — opts.vocalTone 하나로만 전체 팩이 생성됨).
   * data/vocalPresets.ts id의 배열, songCount와 같은 길이·곡 순서 대응.
   * 있으면 core/batchPreallocation.ts/core/localGenerator.ts가 그 트랙의
   * vocalType(quota로 이미 정해진 성별/듀엣 축)과 실제로 맞는 인덱스에서만
   * 그 프리셋의 prompt 텍스트를 그 트랙의 vocalText로 쓴다 — quota 자체는
   * 절대 바꾸지 않는다(성별/듀엣 배분은 이미 확정된 축, 이 필드는 그 위에
   * "어떤 구체적 프리셋을 쓸지"만 얹는다, vocalRecommender.ts의 기존
   * 설계 원칙 그대로). 길이가 안 맞거나 특정 인덱스의 프리셋 성별이 그
   * 트랙의 vocalType과 안 맞으면 그 인덱스만 조용히 기존 폴백(opts.vocalTone
   * 매칭·adultVocalTraitPlan 합성)으로 돌아간다 — 방어적, 절대 곡을 잃지
   * 않는다. undefined(기존 모든 호출부)면 완전히 기존 동작 그대로.
   */
  vocalPresetPlan?: string[];
  /**
   * v4.1 (TASK A) — user override for core/constraints.ts's
   * detectConceptBreadth auto-detection (Step2Plan.tsx's "이 세트의 성격" radio).
   * Undefined means "trust the auto-detector" — this field only ever holds
   * an EXPLICIT user choice, mirroring vocalQuota's own override pattern
   * just above. See ResolvedConstraints.breadthSource for which one actually won.
   */
  breadthOverride?: ConceptBreadth;
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
   * 지시문 23 (TASK B) — 사용자가 "청취 목적" 카드(Step2Concept.tsx)에서
   * 고른 preset. 실제 효과는 그 카드의 "적용" 버튼이 이 값과 함께
   * genreIds/diversityAllocations를 한 번에 채우는 명시적 사용자 행동으로만
   * 일어난다 — 그 뒤 사용자가 genreIds/diversityAllocations를 손으로 다시
   * 고치면 그 수동 선택이 그대로 남는다(§B-5 "사용자 명시 선택 > 청취 목적
   * preset", diversityAllocations의 manual이 항상 이기는 기존 보장과 동일
   * 원리). 이 필드 자체는 마지막으로 적용한 preset의 기록일 뿐, 매 생성마다
   * 다시 강제 적용되지 않는다.
   */
  listeningIntent?: ListeningIntent;
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
  /**
   * TASK (provenance) — click-time-recorded source for each of the 13 axes
   * GenerationChoiceProvenance names, the SOURCE OF TRUTH
   * core/userChoices.ts's userChoicesFromOptions now reads first (falling
   * back to its own after-the-fact heuristics only for a field with no entry
   * here — e.g. an old saved/imported pack from before this field existed).
   * Every real setOpts call site that changes one of the 13 tracked fields
   * merges its own entry in here (`choiceProvenance: { ...prev.choiceProvenance,
   * <field>: 'user' }`); a field this session never touched simply has no
   * key, which every consumer reads the same as 'default'. Undefined for the
   * whole map is fully backward-compatible — every pre-existing caller that
   * never sets this keeps userChoicesFromOptions' old inferred behavior
   * exactly (see that function's own doc comment for the one field,
   * vocalTone, that had no old inference to fall back to at all).
   */
  choiceProvenance?: Partial<GenerationChoiceProvenance>;
  /**
   * 지시문 18 (TASK C) — 이 세트를 실제로 만든 생성 에이전트. 가져오기 화면의
   * 선택 UI(직전 선택값을 기본으로 기억)에서 세팅되고, core/library.ts의
   * savePack이 SavedPack.generatedBy로 그대로 옮긴다. 선택 없이 저장되면
   * 'other'로 정직하게 기록한다(빈 값으로 남기지 않는다) — 미선택을 가져오기
   * 차단 사유로 만들지 말라는 지시문 자신의 요구와 짝을 이룬다.
   */
  generatedBy?: PackGeneratedBy;
  /** generatedBy가 'other'일 때만 쓰는 자유 입력 — 그 외 값일 때는 무시된다. */
  generatedByNote?: string;
}

/** 지시문 18 (TASK C) — SavedPack.generatedBy/GenerationOptions.generatedBy가 공유하는 값 집합. */
export type PackGeneratedBy = 'claude-code' | 'codex' | 'fable-5' | 'api-direct' | 'local' | 'other';

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

/**
 * v4.1 (TASK D) — six independent axes instead of one merged `qualityScore`
 * number, per this task's own "합산하지 마십시오. 각각 표시하십시오." Never
 * summed into a single score anywhere — a low `conceptFitScore` next to a
 * high `structureScore` is the whole point (a structurally perfect song
 * that doesn't fit the concept is not "mostly fine").
 */
export interface SongScores {
  /** Structural/format compliance — identical computation to (and value of) SongIdea.qualityScore. */
  structureScore: number;
  /** Copyright/blocked-token/content-ID safety. */
  safetyScore: number;
  /** v3.76 promiseAudit's overallFulfillment for this pack, as a 0-100 score — pack-wide, so every song in the same pack shares this value (concept fit is a property of the whole set, not any one track). */
  conceptFitScore: number;
  /** How much this song's own genre/vocal-type contributes to the pack's overall variety — a light heuristic (this task's own scope doesn't ask for a rigorous algorithm), not a precise measurement. */
  diversityScore: number;
  /** v5.22 (AXIS 3/4) — core/englishLint.ts's lintEnglishLyrics result, as a 0-100 score (100 = no issues). Computed for real inside core/quality.ts's scoreSong whenever `language === 'english'`; stays the neutral 100 ("nothing measured") for every other language, same convention conceptFitScore's own doc comment establishes for "no signal yet". */
  englishScore: number;
  /** v5.22 (AXIS 4) — how much this song's own scene/title collides with cross-pack ledger history (core/duplicationGate.ts) — 100 minus a flat penalty per collision. Pack-level context (recent-set/full-history data) isn't available inside scoreSong (no IndexedDB access there — same reason conceptFitScore stays neutral until display/import time), so this stays the neutral 100 placeholder until core/importInspection.ts's inspectImportReport recomputes it for real with real duplicationHistory (the one real consumer that already has it, via Gate 1/Gate 2 — see that function's own doc comment). */
  uniquenessScore: number;
  /** v3.73/74 audio-render metrics based. Undefined when no audio take exists for this song yet. */
  renderScore?: number;
  /** v3.68 listener rating based. Undefined when this song has never been rated. */
  listenerScore?: number;
}

/**
 * v4.1 (TASK C) — how far a fix for this issue actually has to reach.
 * Before this, every pack-level finding (title pattern, era share, vocab
 * repetition, ...) was flattened into every track's own blocking list (see
 * core/generationGate.ts's old `...pack.blocking` spread) — a 3-4-song
 * title-pattern problem read as an 18-song failure. The 5 scopes here are
 * this task's own classification table:
 * - 'track': fixable by touching only this one song (word count,
 *   placeholder text, vocab leak, missing vocal descriptor).
 * - 'pair': fixable by touching the worse-scoring song of a 2-track
 *   collision (scene/hook duplication).
 * - 'rebalance': fixable by touching a MINIMUM subset of tracks, computed
 *   from the actual shortfall (title pattern, emotion variety, vocal
 *   descriptor variety, excess vocab repetition) — never the whole pack.
 * - 'design': not fixable by regenerating songs at all; the pre-generation
 *   design itself (genre/BPM/vocal-type allocation) needs to change (BPM
 *   range, era share, genre skew, vocal type distribution).
 * - 'full': the pack is broken badly enough (promise fulfillment <40%, or
 *   >=12 blocking tracks) that a full regeneration is the realistic fix.
 */
export type IssueScope = 'track' | 'pair' | 'rebalance' | 'design' | 'full';

export interface ScopedIssue {
  scope: IssueScope;
  /** Stable machine id for this finding (e.g. 'title-pattern-variety') — same id across recomputations, so UI state (dismissed/expanded) can key off it. */
  id: string;
  labelKo: string;
  /** trackNos this specific finding actually touches. For 'design'/'full' scope this is every track in the pack (a design-level problem isn't any one song's fault, but nothing short of a redesign fixes it either) — the scope itself is what tells the UI a song-regen button can't help, not an empty list. */
  affectedTracks: number[];
  fixHintKo: string;
}

/**
 * v4.2 (TASK E) — how much confidence a quality threshold actually
 * deserves, so the UI can tell "estimated" (a guess awaiting validation)
 * apart from "measured"/"listener-verified" (backed by real data) instead
 * of presenting every hardcoded number with equal, unearned authority. See
 * this task's own §0-1 table — most of this app's existing thresholds are
 * `estimated` today, not because they're wrong, but because nobody has
 * checked yet.
 */
export type ThresholdBasis = 'measured' | 'listener-verified' | 'estimated';

/** v4.2 (TASK E) — a single adjustable quality/gate threshold, stored as data (see data/qualityThresholds.ts) instead of a bare hardcoded number, so a validation pass (TASK C/D) has somewhere to record what it found without editing source constants directly. */
export interface Threshold {
  id: string;
  labelKo: string;
  value: number;
  basis: ThresholdBasis;
  /** How many real A/B pairs or listener ratings this basis rests on — undefined/0 for a still-`estimated` threshold. */
  sampleSize?: number;
  /** ISO date of the last time this threshold was checked against real data, regardless of whether the check changed its value. */
  lastValidated?: string;
}

export interface SongIdea {
  trackNo: number;
  /** The trackNo this song claimed (or was index-assigned) BEFORE bridgeImport.ts's 1..N gap/duplicate-repair renumbering — see importSongsJson/parseBridgeExportForReview. Only set on bridge-imported songs whose renumbering pass actually ran; absent (not just equal) for every other creation path, so its presence alone signals "this song was renumbered on import." */
  originalTrackNo?: number;
  title: string;
  seasonMoment: string;
  listenerSituation: string;
  emotionArc: string;
  /**
   * v5.23 (TASK B) — one line, written by the agent itself, naming what
   * THIS song does differently from the other N-1 in the set (e.g. "후렴을
   * 한 번만 부른다", "마지막에 반주가 사라지고 목소리만 남는다"). Real,
   * verified problem this closes: the bridge instruction was almost
   * entirely a prohibition list (§0-2's own audit — 68 forbidden-thing
   * spots, 1 line of creative encouragement), so nothing ever asked the
   * agent to make an explicit creative choice per song, only to avoid
   * mistakes. Advisory-only by design (core/distinctChoiceCheck.ts) — never
   * blocking, since forcing this field would just produce a formulaic
   * non-answer (this task's own explicit "blocking으로 만들지 마십시오").
   * Optional: undefined for every song generated before this task, and for
   * local generation (which doesn't ask an LLM anything, so there's no
   * agent to make this call).
   */
  distinctChoice?: string;
  /**
   * 지시문 15 (TASK A) — distinctChoice의 구조화된 판정 값.
   * `distinctChoice`(위, string) 는 여전히 사람이 읽는 한 줄 설명
   * (DistinctChoice.descriptionKo와 동일한 값)으로 남는다 — SongCard.tsx
   * 등 기존 표시 소비처는 전혀 바뀌지 않는다. 이 필드는 core/
   * distinctChoiceGate.ts가 실제로 이행 여부를 판정할 때만 읽는다.
   * 구형(v5.23~) 자유 문자열 응답이나 인식 불가 ruleId는
   * core/distinctChoiceTypes.ts의 coerceDistinctChoice가 'ARRANGEMENT_NUANCE'
   * (not-measured)로 받아들인다 — undefined는 "이 필드 자체가 없던 과거
   * 응답"만을 뜻한다.
   */
  distinctChoiceRuleId?: DistinctChoiceRuleId;
  /** VERSE_TAIL_REPEAT · WORD_ACCUMULATION 등 규칙이 검증에 쓰는 인자. */
  distinctChoiceParams?: Record<string, string | number>;
  /**
   * v5.24 (TASK B §2-6) — one concrete physical action a kids listener does
   * along with this song (손뼉·발 구르기·점프·돌기·앉기·손가락 세기·흔들기·
   * 가리키기·소리 내기·숨 참기·크게 웃기 등). This is kids' own version of
   * "distinctChoice" — participation, not novelty (see §0-1: kids songs are
   * judged by whether a child can follow along, not by how new they sound).
   * Only ever populated for kr-kids/jp-kids; undefined everywhere else.
   */
  kidsAction?: string;
  hookPhrase: string;
  stylePrompt: string;
  /** Text meant for Suno's separate Advanced Options -> Exclude field, never pasted into the style prompt itself (avoidWords + copyright-avoidance terms). See core/promptComposer.ts's buildExcludePrompt. */
  excludePrompt?: string;
  /**
   * 지시문 10 (TASK D) — the stylePrompt exactly as a provider (bridge/Batch
   * API/realtime) wrote it, before core/batchPreallocation.ts's
   * normalizeProviderStylePrompt overlaid the locked fields (vocal gender,
   * verbatim atoms, instrument set, density, tempo, ...) onto it. Debug
   * metadata only — never read by any generation/scoring/export path, never
   * shown in the main UI. Undefined for local generation (nothing to
   * normalize against — localGenerator.ts composes stylePrompt directly) and
   * for any song reconciled with no slot at all.
   */
  rawProviderStylePrompt?: string;
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
  /**
   * v4.3 (TASK A) — packaging-language song title: a non-literal
   * reinterpretation of `title`'s scene/emotion in the pack's own
   * packagingLanguage (see core/packagingLanguage.ts), NOT a translation of
   * `title`'s words. Undefined when packagingLanguage resolves to 'english'
   * (nothing to show), or for any song generated before this task existed.
   * See core/titleLocalization.ts for the local-generation-path builder and
   * core/compositionScorer.ts for the transliteration/length/missing checks.
   */
  titleLocalized?: string;
  /**
   * v4.3 (TASK A) — display-ready "English (Localized)" string, e.g.
   * "Blue Cup (식어가는 찻잔)". Always derived from title+titleLocalized (never
   * hand-edited independently) — undefined whenever titleLocalized is.
   * NEVER used for the Suno-input title field (SongCard/SunoProgressMode/
   * standaloneProgressExport's "제목 복사" always copies the bare `title`) —
   * a parenthesized title confuses Suno's own title field.
   */
  titleDisplay?: string;
  qualityScore: number;
  /**
   * v4.1 (TASK D) — `qualityScore` above only ever measured structural
   * compliance (word count, prompt length, leak checks) but reads to a user
   * as "overall quality" — a real pack showed structure=95/concept-fit=49%
   * and the single merged number hid the low concept fit entirely. This is
   * additive, never a replacement: `qualityScore` keeps its exact existing
   * meaning/computation (still what `structureScore` below equals) for
   * every caller that hasn't migrated. Optional because it's computed
   * alongside scoring, not always available (e.g. a stub song before real
   * scoring runs — see core/localGenerator.ts's own qualityScore:0 stubs).
   */
  scores?: SongScores;
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
  /**
   * codex 지시문 02 (TASK K) — core/promptFingerprint.ts's buildPromptFingerprint
   * output for this track's PreassignedSongSlot, attached here (rather than
   * left slot-only) because introMode/arrangementDensity/hookDeviceId/
   * moneyChordId don't otherwise survive reconciliation onto the final
   * SongIdea — see core/promptFingerprintLedger.ts for the cross-pack
   * duplication check this enables. Undefined for any song reconciled
   * without a matching slot (e.g. an agent-invented extra track).
   */
  promptFingerprint?: string;
  /** codex 지시문 02 (TASK K) — core/promptFingerprint.ts's buildArrangementRecipe output; see promptFingerprint's own doc comment just above for why this is attached here instead of staying slot-only. */
  arrangementRecipe?: string;
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
  /**
   * 지시문 26 (TASK A) — killingPointId만으로는 감사·평가 화면이 "무슨
   * 킬링포인트인지"를 사람이 읽을 방법이 없었다(SongIdea에 텍스트가 아예
   * 없었다 — PreassignedSongSlot에는 있었는데 reconcileWithPreassignedSlot이
   * 이 필드를 복사하지 않았다). moneyChordText/hookDeviceText와 같은
   * 슬롯-소유 스냅샷 필드.
   */
  killingPointText?: string;
  /** 지시문 26 (TASK A) — killingPointText 모먼트가 곡 안 어디에 오는지. PreassignedSongSlot.killingPointPlacement와 동일한 값 집합. */
  killingPointPlacement?: 'final-chorus' | 'bridge' | 'mid-instrumental' | 'pre-chorus' | 'outro' | 'call-response';
  /** v3.68 (TASK B) — this track's killing point id (see data/killingPoints.ts), when the arc gave it one (peakStrength other than 'none' — see core/arcPlan.ts). */
  killingPointId?: string;
  /** v3.68 (TASK B) — this track's arc phase (see core/arcPlan.ts). */
  arcPhase?: string;
  /** v3.68 (TASK B) — this track's arc intensity, 1-5 (see core/arcPlan.ts). */
  intensity?: number;
  /**
   * 지시문 26 (TASK A) — 이 트랙의 아크 위치가 'none'/'subtle'/'strong' 중
   * 무엇인지(core/arcPlan.ts's PeakStrength). killingPointId 유무만으로는
   * "이 곡이 원래 킬링포인트가 없는 게 설계 의도였는지" 감사가 구분할 수
   * 없었다 — peakStrength가 있어야 "없는 게 정상인 4곡"과 "있어야 하는데
   * 유실된 곡"을 구별할 수 있다.
   */
  peakStrength?: 'none' | 'subtle' | 'strong';
  /** 지시문 23 (TASK A) — this track's computed perceived energy, 1-5 (see core/perceivedEnergy.ts). Deliberately separate from `intensity` above — see PreassignedSongSlot.perceivedEnergy's own doc comment. */
  perceivedEnergy?: PerceivedEnergy;
  /** 지시문 23 (TASK A) — perceivedEnergy의 사람이 읽는 근거 문구(판정에는 쓰이지 않음). */
  perceivedEnergyReasonKo?: string;
  /** v3.68 (TASK B) — resolved BPM actually planned for this track. The stylePrompt already carries this as text ("96 BPM"); this is the same number as a queryable field, since rating analysis needs to bucket by tempo without re-parsing prose. */
  bpm?: number;
  /** v3.68 (TASK B) — this track's lyric section-order template id, snapshotted for rating analysis (PreassignedSongSlot already carried this; SongIdea didn't until now). */
  structureTemplate?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  /** v3.68 (TASK B) — this track's resolved money-chord preset id, when the per-song quota plan (core/moneyChordPlan.ts) assigned one. */
  moneyChordId?: string;
  /**
   * 지시문 29 (TASK D-3) — 실측: 저장된 팩(lyrics/*.json)에 이 필드 자체가
   * 없었다 — killingPointText/arcPhase가 지시문 26 이전에 그랬던 것과 같은
   * 결함이다(PreassignedSongSlot.moneyChordText는 항상 있었지만
   * reconcileWithPreassignedSlot이 최종 song 객체로 복사한 적이 없음).
   * stylePrompt 자체는 core/batchPreallocation.ts의 mergeAtom이
   * slot.moneyChordText를 직접 꿰매 넣으므로 실제 생성물에는 진행이
   * 대체로 실려 있었다(실측: 70년대/2030/동요 세 실파일 재구성 결과
   * 프롬프트 누락 2/18·0/18·0/18) — 다만 이 필드가 없어서 song 객체 자체만
   * 봐서는 "이 트랙에 어떤 진행이 배정됐는지" 확인할 방법이 없었다.
   */
  moneyChordText?: string;
  /** 지시문 39 (TASK B) — 슬롯 소유 스냅샷 필드. PreassignedSongSlot.moneyChordSectionMap과 같은 값(이 곡이 2~3개 진행을 쓸 때만 존재). */
  moneyChordSectionMap?: MoneyChordSectionAssignment[];
  /** 지시문 39 (TASK B) — 슬롯 소유 스냅샷 필드. PreassignedSongSlot.moneyChordSectionText와 같은 값. */
  moneyChordSectionText?: string;
  /**
   * 지시문 37 (TASK A-5) — 팩 JSON에 이 필드가 없으면 지시문 26의 킬링포인트와
   * 같은 결함(슬롯에는 있는데 최종 SongIdea/저장된 팩에는 없음)을 반복하는
   * 것이다. 파트 계획은 앱이 배정한 값이며 LLM이 창작하지 않는다 —
   * reconcileWithPreassignedSlot이 PreassignedSongSlot.partPlan을 그대로
   * 복사해 여기 남긴다(moneyChordText/hookDeviceText와 같은 슬롯-소유
   * 스냅샷 모델).
   */
  partPlan?: KpopPartPlan;
  /** 지시문 37 (TASK B) — 슬롯 소유 스냅샷 필드. PreassignedSongSlot.sectionStyleShifts와 같은 값. */
  sectionStyleShifts?: SectionStyleShift[];
  /** v3.68 (TASK B) — this track's rotating earworm melodic-design phrase, when earwormMode was on (see core/promptComposer.ts's EARWORM_STYLE_VARIANTS). */
  earwormText?: string;
  /** v3.68 (TASK B) — which lyric scene frame this track's lyricTheme belongs to (see data/lyricThemes.ts's LyricTheme.frameId; PreassignedSongSlot already carried this — see v3.64 TASK A — SongIdea didn't until now), snapshotted for rating analysis. */
  lyricFrameId?: string;
  /**
   * v4.5 (TASK B) — this track's lyricTheme's motionKo/castKo/eraSettingKo
   * (data/lyricThemes.ts's LyricTheme — see that file's own doc comment:
   * these existed since v3.64 as "allocation diversity checks/reporting"
   * metadata only, never reaching generation). Snapshotted here for the
   * same rating-analysis parity every other lyricTheme field already has.
   */
  lyricThemeMotionKo?: string;
  lyricThemeCastKo?: string;
  lyricThemeEraSettingKo?: string;
  /** v4.5 (TASK C) — data/vocabularyBanks.ts's VocabularyBank.id this track was matched to (see PreassignedSongSlot.vocabularyBankId's own doc comment), snapshotted for rating-analysis/set-distribution reporting. */
  vocabularyBankId?: string;
  /**
   * v3.79 (TASK D) — "S20260802-01-T07": this track's stable identifier,
   * `${blueprint.meta.setCode}-T${trackNo padded to 2 digits}`. Assigned once
   * (core/library.ts's savePack, the first real — non-autosave — save; see
   * PlaylistBlueprint.meta's own doc comment for why save time rather than
   * generation time), never recomputed later. Optional so every song that
   * existed before this task, and any song in a pack never actually saved,
   * keeps loading/working with no code at all rather than a fabricated one.
   */
  songCode?: string;
  /**
   * v5.11 (TASK L) — this track's REAL applied money-chord preset id,
   * always resolved and always populated (unlike `moneyChordId` above,
   * which stays undefined whenever the per-song quota/rotation plan isn't
   * active). Real gap this closes: a channel using a FIXED single
   * money-chord preset (moneyChordMode picked but no per-song rotation —
   * see core/moneyChordPlan.ts's usesMoneyChordQuota/
   * usesUserChosenProgressionPlan) still applies a real progression to
   * every song via core/soundSignature.ts's compactMoneyChord, but nothing
   * ever surfaced WHICH id that was on the song itself — post-hoc
   * debugging ("why does this song sound like this") and CSV/export
   * records had no way to answer that. See
   * core/soundSignature.ts's resolveEffectiveMoneyChordId, the single
   * function both real generation paths now call to populate this.
   */
  effectiveMoneyChordId: string;
  /**
   * v5.11 (TASK L) — data/vocalPresets.ts id whose canonical `prompt`
   * matches this pack's `opts.vocalTone` selection (see
   * data/vocalPresets.ts's matchVocalPreset), when the user's vocalTone
   * recognizably names one. Optional (unlike the other 4 new fields here)
   * because a real song's actual vocal wording is frequently a
   * procedurally-composed blend (core/vocalPlan.ts's
   * buildAdultVocalTraitPlan / kidsVocalTextFor variant text) rather than
   * a single named preset applied verbatim — in that case there genuinely
   * is no discrete preset to report, not a skipped lookup. Always
   * attempted (matchVocalPreset(opts.vocalTone) is called for every song),
   * never silently skipped.
   */
  effectiveVocalPresetId?: string;
  /**
   * 지시문 49 (TASK A) — which mechanism resolved effectiveVocalPresetId
   * for this track, so an outside measurement (e.g. is
   * opts.vocalPresetPlan's per-track recommendation actually reaching the
   * slot, or is it being silently discarded to a pack-wide/generic
   * fallback) doesn't require re-deriving core/batchPreallocation.ts's own
   * internal branching. 'plan' — opts.vocalPresetPlan[idx] resolved via
   * core/batchPreallocation.ts's resolveVocalPresetOverride. 'tone-match' —
   * no per-track plan applied; fell back to the whole-pack
   * matchVocalPreset(opts.vocalTone) match (same value on every track).
   * 'auto' — neither matched; effectiveVocalPresetId is undefined and the
   * vocal wording came from the procedural blend
   * (buildAdultVocalTraitPlan/kidsVocalTextFor). Always populated when
   * this track has a resolved vocalType at all (mirrors
   * effectiveVocalPresetId's own "always attempted" guarantee) —
   * undefined only for the rare fallback-vocal-text case with no
   * vocalType at all.
   */
  vocalPresetSource?: 'plan' | 'tone-match' | 'auto';
  /**
   * v5.11 (TASK L) — this track's actual assigned genre id(s) (from
   * core/genreRotation.ts's genresForTrack, usually length 1, length 2 for
   * a blended pair), already run through core/genreSelection.ts's
   * sanitizeGenreIdsForArchetype so a foreign/contaminated id can never
   * leak into a rating-analysis/CSV record even if it somehow slipped past
   * this pack's own upstream sanitization.
   */
  effectiveGenreIds: string[];
  /** v5.11 (TASK L) — this song's real channel archetype at generation time (opts.channel.archetype), snapshotted alongside the other 4 "effective" fields so a rating/export record is self-describing without needing the channel it came from to still exist/be unchanged. */
  effectiveArchetype: ChannelArchetype;
  /** v5.11 (TASK L) — the workspace (data/workspaces/index.ts's WorkspaceDefinition.id) that owns `effectiveArchetype`, resolved via workspaceForArchetype. Every real ChannelArchetype resolves to exactly one workspace today (see that file's own WORKSPACE coverage), so this is always a real id, never a guess. */
  workspaceId: WorkspaceId;
  /**
   * v5.13 (TASK: kidsAgeTierId wiring) — mirrors effectiveArchetype/workspaceId's
   * own "record what actually happened" pattern: the real
   * `opts.kidsAgeTierId ?? opts.channel.kidsAgeTierId ?? DEFAULT_KIDS_AGE_TIER_ID`
   * resolution this track's arc bundle/structure/hook-repeat/tempo range
   * actually used, snapshotted at generation time. Optional (unlike the 2
   * fields above) since it's only ever resolved for a kids archetype —
   * absent for every senior/kr-2030/jp-2030/kr-idol song, same
   * kids-only-field convention `vocalType` already established.
   */
  effectiveKidsAgeTierId?: KidsAgeTierId;
}

/**
 * TASK (post-generation operation snapshot) — real, verified bug this closes:
 * once a pack finishes generating, every post-generation operation (retry,
 * refine, evaluate, save, persona rebuild, missing-track regen, audio-take
 * linking, bridge recompose instructions) used to read whatever `opts`/
 * `cm.selectedChannel` happened to be LIVE on screen at the moment that
 * operation was clicked — not what the pack was actually generated under.
 * Generate an 18-song pack under Channel A, switch the sidebar to Channel B
 * without regenerating, then retry track 5: that one track silently used
 * Channel B's genre/vocal/lyric rules while the other 17 stayed on Channel
 * A's, with nothing to tell the two apart afterward. This is the fix — a
 * real record of exactly what a pack was generated under, attached ONCE at
 * the real moment of generation (see core/generationSnapshot.ts's
 * withGenerationSnapshot, which every real PlaylistBlueprint construction
 * site calls) and carried forward automatically by every later `{...blueprint,
 * songs: ...}` spread (regenerateTrack/refineTracks/etc. already only ever
 * touch `songs`, never reconstruct the rest of the object) — so a retry/
 * refine on an already-generated pack keeps referencing the ORIGINAL
 * generation's settings unless the user explicitly opts into
 * "[현재 설정으로 다시 스타일링]" (see Step4Result.tsx's per-action override,
 * which passes live opts/channel through instead, one operation at a time).
 * `slots` is the real preassigned song-slot plan (core/batchPreallocation.ts's
 * preallocateSongSlots) this pack was actually generated against — the same
 * shape core/generationPreflight.ts's evaluateGenerationRequest already
 * builds, not a duplicate concept. `contractSignature` reuses that module's
 * own stableHash (never a second hashing mechanism) over {options, slots},
 * so two packs generated under content-identical settings hash identically
 * regardless of key order, and any later options/slot drift is detectable.
 */
/**
 * v5.17 (TASK A) — GenerationSnapshot's own reduced view of ProviderSettings.
 * A snapshot rides on PlaylistBlueprint, which is what IndexedDB pack
 * storage, workspace backup export (core/workspaceTransfer.ts), and pack
 * JSON sharing all serialize wholesale — so ProviderSettings' own
 * apiKey/accessToken/proxyEndpoint (real credentials, and in proxyEndpoint's
 * case potentially a private server address) must never ride along.
 * `hasApiKey` records only whether a key was present, never the key itself,
 * so a UI can still show "this pack was generated with a key configured"
 * without persisting the secret. core/generationSnapshot.ts's
 * buildGenerationSnapshot is the one place a full ProviderSettings is
 * narrowed down to this shape; resolveGenerationContext re-merges live
 * credentials back in at the point of actual use (retry/refine/evaluate),
 * exactly the "re-read from current settings" rule core/batchJobs.ts's own
 * BatchJobSnapshot already established for the same reason.
 */
export interface SnapshotProviderInfo {
  provider: ProviderType;
  model?: string;
  temperature: number;
  batchSize?: number;
  keyStorageMode?: 'server' | 'local';
  /** Whether a key was configured at generation time — never the key itself. */
  hasApiKey: boolean;
}

export interface GenerationSnapshot {
  workspaceId: WorkspaceId;
  channel: ChannelProfile;
  options: GenerationOptions;
  provider: SnapshotProviderInfo;
  season: SeasonPack;
  slots: PreassignedSongSlot[];
  contractSignature: string;
  generatedAt: string;
  /**
   * codex 지시문 01 (TASK F) — real gap this closes: exportMeta.ts's own
   * appVersion/schemaVersion always reflect the CURRENT build at export
   * time, not what the pack was actually generated under — if the app is
   * updated between generating a pack and exporting it, the export lies
   * about which version produced it. Captured once here, at the real
   * moment of generation (core/buildInfo.ts's BUILD_INFO — the same
   * appVersion/schemaVersion every export already uses, just captured at
   * the right time instead of read fresh every time).
   */
  appVersion: string;
  schemaVersion: number;
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
   * codex 지시문 01 (TASK D) — set only by App.tsx's onImportSongsJsonForSrt
   * (core/bridgeImport.ts's own importSongsForSrtOnly, the read-only "가사
   * 파일 → 바로 SRT 만들기" path — see that function's own doc comment for
   * the full "never saves, never registers hooks" guarantee). Never set by
   * any other construction site, so a normal generated/saved pack never
   * shows a read-only notice. Mirrors isLocalPreview's own "narrow,
   * construction-site-scoped flag" pattern just above.
   */
  isSrtOnlyImport?: boolean;
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
  /**
   * v3.79 (TASK D) — "음원분석도 데이터잖아... 연번 코드 같은 거 붙여서" (하루님):
   * a stable, dense identifier for this whole generated set (see
   * core/setCode.ts's buildSetCode — "S20260802-01", date + that day's
   * Nth set), separate from and parallel to utils/setNaming.ts's existing
   * human-readable setName (which this task never changes). Assigned ONCE
   * by core/library.ts's savePack, on the first real (non-autosave) save —
   * not at blueprint-construction time, since the "Nth set today" count can
   * only be answered once IndexedDB is actually queryable, and not
   * recomputed on any later save of the same pack (mirrors this interface's
   * own generatedAt field, just documented separately since it lives in its
   * own nested object rather than growing PlaylistBlueprint's flat field
   * list further). Undefined for every set generated before this task, and
   * for any set still only in memory (never saved).
   */
  meta?: {
    setCode?: string;
    /**
     * 지시문 18 (TASK C-2) — 브릿지 요청 payload에 실린 버전(core/bridgeInstruction.ts의
     * buildBridgeMeta)을 LLM이 응답에 그대로 복사했을 때 채워진다(bridgeImport.ts의
     * extractBridgeImportMeta가 읽음). 응답에 없으면(구형 응답, 또는 LLM이
     * meta를 생략함) 가져오기 시점의 현재 앱 버전으로 채운다 — 절대 undefined로
     * 남기지 않는다(§C-2 "응답에 없으면 앱이 생성 시점의 값을 채운다").
     */
    bridgeVersion?: string;
  };
  /**
   * TASK (post-generation operation snapshot) — see GenerationSnapshot's own
   * doc comment above for the full bug this closes. Attached exactly once,
   * at the real moment of generation (core/generationSnapshot.ts's
   * withGenerationSnapshot, called from every real construction site —
   * App.tsx's finalizeSinglePackBlueprint for realtime/local/batch/cache/
   * bridge-single-import, core/multiSetGeneration.ts's finalizeSetBlueprint
   * for multi-set local/realtime/batch, App.tsx's onImportMultiSetSongsJson
   * for bridge multi-set import); every later `{...blueprint, songs: ...}`
   * spread (regenerateTrack, refineTracks, resolveHookCollisions, ...)
   * carries it forward unchanged since none of them reconstruct any field
   * but `songs`. Undefined only for a blueprint built before this task
   * (e.g. an old saved/cached pack) or a display-only synthetic blueprint
   * that was never really "generated" this session — every real consumer
   * falls back to the current live opts/channel in that case, which is
   * exactly the pre-existing behavior for such a pack.
   */
  generationSnapshot?: GenerationSnapshot;
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
 * 지시문 37 (TASK A-1) — K-pop 곡의 섹션별 멤버 파트 배분. core/kpopPartPlan.ts's
 * buildKpopPartPlan이 채널 정책(core/kpopWorkspacePolicy.ts's groupGender/
 * memberCountRange)과 이 트랙의 vocalGender/structureTemplate로부터 생성한다.
 */
export type KpopPartRole =
  | 'main-vocal' | 'lead-vocal' | 'sub-vocal'
  | 'main-rapper' | 'lead-rapper'
  | 'all' | 'ad-lib';

export interface KpopMemberSlot {
  /** 'A' | 'B' | 'C' ... */
  memberId: string;
  role: KpopPartRole;
  gender: 'male' | 'female';
  /**
   * 지시문 52 (TASK A-1) — 이 멤버의 음색·창법. data/kpopMemberTimbres.ts's
   * assignMemberTimbres가 role별 후보에서 골라, 같은 곡의 다른 멤버와는
   * 겹치지 않는 timbreId를 배정한다(§A-3). 26종 보컬 프리셋(곡 단위)과는
   * 다른 층 — 이건 "곡 안에서 멤버마다 다르다".
   */
  timbreId: string;
  /** "bright thin tenor, clear forward attack" 형태 — lyric tag/stylePrompt에 그대로 얹는다. */
  timbreText: string;
}

/**
 * 지시문 37 (TASK B-2) — 곡 안 섹션별 스타일 전환. core/kpopSectionStyleShiftPlan.ts's
 * buildSectionStyleShiftPlan이 채널 정책(data/sectionStyleShifts.ts)에서
 * 생성한다. data/promptAxisLexicon.ts's SECTION_SCOPED_LABEL_PATTERN이 이
 * `section` 라벨을 인식해 finalPromptNormalizer의 단일 선언 축 중복 제거가
 * 서로 다른 섹션의 styleAtoms를 오판해 지우지 않게 한다.
 */
export interface SectionStyleShift {
  /** 'Verse' · 'Chorus' · 'Bridge' 등 — promptAxisLexicon의 SECTION_SCOPED_LABEL_PATTERN이 인식하는 라벨과 일치해야 한다. */
  section: string;
  styleAtoms: string[];
}

/**
 * 지시문 39 (TASK B) — "머니코드가 노래당 꼭 하나가 아니라 2~3개 있어도
 * 되지 않아?" core/moneyChordSectionPlan.ts's buildMoneyChordSectionPlan이
 * 기존 progressionPlan(단일 주 진행, 절대 안 바뀜) 위에 얹는 추가 레이어 —
 * SectionStyleShift와 완전히 같은 신뢰 모델(앱이 한 번 계산해 슬롯에
 * 싣고, 브릿지가 verbatim weave)이며 같은 SECTION_SCOPED_LABEL_PATTERN을
 * 재사용한다(새 프롬프트 축을 만들지 않는다 — harmony 축 그대로).
 */
export interface MoneyChordSectionAssignment {
  /** 'Verse' · 'Chorus' · 'Bridge' — promptAxisLexicon의 SECTION_SCOPED_LABEL_PATTERN과 일치해야 한다. */
  section: string;
  chordId: string;
}

export interface KpopPartPlan {
  /** 4~7명 — 채널 정책 필드(core/kpopWorkspacePolicy.ts's memberCountRange). 실제 아이돌 그룹 규모이며 추정치가 아니다. */
  memberCount: number;
  members: KpopMemberSlot[];
  /** 섹션별 파트 배정. */
  sectionAssignments: {
    section: string;
    memberIds: string[];
    role: KpopPartRole;
  }[];
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
   * 지시문 37 (TASK A) — 하루 지적: K-pop 곡에 보컬 파트 배분이 전혀 없다
   * ("[Verse 1]"만 있고 "[Verse 1: Member A]"가 없다 — 아이돌 그룹인데 한
   * 사람이 부르는 것처럼 보인다). moneyChordText/hookDeviceText와 같은
   * 신뢰 모델: 앱이 이 트랙의 파트 계획을 한 번 계산해 슬롯에 싣고,
   * bridgeInstruction이 이를 그대로(verbatim) 지시문에 전달한다 — LLM이
   * 스스로 파트를 창작하지 않는다. kr-idol-male/kr-idol-female에서만
   * 설정된다(core/kpopPartPlan.ts). 지시문 26의 킬링포인트가 슬롯에는
   * 있었지만 최종 SongIdea/팩 JSON에 남지 않았던 결함을 반복하지 않도록
   * reconcileWithPreassignedSlot 양쪽 경로 모두에서 SongIdea.partPlan으로
   * 복사된다.
   */
  partPlan?: KpopPartPlan;
  /**
   * 지시문 37 (TASK B) — 하루 지적: K-pop은 한 곡 안에서 절은 R&B, 후렴은
   * EDM, 브릿지는 랩처럼 섹션마다 장르/편곡이 바뀌는데 지금은 곡당 한
   * 장르로 고정돼 있다. moneyChordText와 같은 신뢰 모델: 앱이 이 트랙의
   * 섹션별 전환 계획을 한 번 계산해 슬롯에 싣고, 브릿지 지시문이 verbatim
   * weave하도록 전달한다("Section: style atoms" 형태 유지 — 라벨이
   * promptAxisLexicon의 SECTION_SCOPED_LABEL_PATTERN이 축 중복 오판을
   * 피하는 근거이기 때문). 2~3개 섹션만 전환한다(data/sectionStyleShifts.ts,
   * verified:false 정책 필드 — 너무 많으면 산만해진다).
   */
  sectionStyleShifts?: SectionStyleShift[];
  /** sectionStyleShifts를 "Section: atom, atom" 형태로 이미 합친 텍스트 — bridgeInstruction이 verbatim weave 지시에 쓴다. */
  sectionStyleShiftText?: string;
  /**
   * 지시문 36 (TASK C) — this trackNo's resolved verse/chorus arrangement-
   * contrast plan (see data/chorusContrast.ts's ChorusContrastPlan / this
   * task's own core/chorusContrastPlan.ts rotation). Same instruction-only
   * verbatim-weave trust model as moneyChordText/hookDeviceText above:
   * pre-computed once at slot-assignment time so realtime/Batch/bridge all
   * reference the identical plan for the same trackNo, and passed into the
   * bridge instruction as a REFERENCE arrangement idea (not required
   * wording) — same convention as hookDeviceText's own instruction line.
   * Distinct axis from hookDeviceText/killingPointText: this describes
   * ARRANGEMENT DENSITY contrast (what instruments/harmony layer in),
   * never modulation/key-change — 킬링포인트가 이미 다루는 영역이며 하루가
   * 직접 청취 검증한 축이라 대체하지 않는다(§C-4).
   */
  chorusContrastPlanId?: string;
  chorusContrastText?: string;
  /** 0~100, ChorusContrastPlan.score.total 그대로 — 세트 평균 계산/리포트용. */
  chorusContrastScore?: number;
  /**
   * TASK v4.11 (TASK B) — tracks 1-3 only (undefined for every other
   * track): a real waveform measurement found those tracks' first 15
   * seconds rendering ~3.7dB quieter than that same track's own full-song
   * average, even with an opening hook (below) already in place — Suno
   * tends to render an intro quietly by default regardless of what it
   * contains, a separate axis from WHAT the opening is (data/openingHooks.ts's
   * OPENING_LOUDNESS_DESCRIPTORS / assignOpeningLoudnessDescriptors).
   */
  openingLoudnessText?: string;
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
   * (see core/promptComposer.ts's buildArrangementDensityPlan /
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
  /**
   * v4.5 (TASK B) — data/lyricThemes.ts's LyricTheme.motionKo/castKo/
   * eraSettingKo, promoted from "allocation diversity metadata only" (their
   * original v3.64 scope — see that file's own field doc comment) to an
   * actual per-track bridge-instruction signal: real measurement found a
   * concept like "젊은 시절 춤추던 토요일 밤" assigned the right scene
   * (dance-saturday) but the generated lyrics still defaulted to a quiet,
   * solitary framing — the scene's own motion/cast/era axis (움직임/인물/
   * 시간축) was computed and available but never told to the agent, so
   * nothing pushed back against that default. See
   * core/bridgeInstruction.ts's lyricThemeInstructionLineFor.
   */
  lyricThemeMotionKo?: string;
  lyricThemeCastKo?: string;
  lyricThemeEraSettingKo?: string;
  /**
   * v4.5 (TASK C) — data/vocabularyBanks.ts's VocabularyBank.id this track
   * was matched to (see that file's own vocabularyBankForScene, keyed by
   * this track's lyricFrameId/lyricThemeMotionKo — falls back to
   * 'quiet-morning' for the ~80% of the theme pool with no frame/motion
   * data yet, this app's own pre-v4.5 default, not a new bias). Surfaced in
   * the bridge instruction as a REFERENCE word list (never a checklist to
   * paste in verbatim — see bridgeInstruction.ts's own vocabulary-bank
   * instruction line), and for rating-analysis/set-distribution reporting.
   */
  vocabularyBankId?: string;
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
  /** v5.11 (TASK L) — always-resolved counterpart to moneyChordId above (never undefined outside quota rotation); see SongIdea.effectiveMoneyChordId's own doc comment. Copied verbatim onto the final SongIdea by core/batchPreallocation.ts's reconcileWithPreassignedSlot. */
  effectiveMoneyChordId: string;
  /**
   * 지시문 39 (TASK B) — 이 트랙이 곡 안에서 2~3개 진행을 쓸 때만 존재
   * (1개면 undefined — moneyChordId/moneyChordText만으로 이미 충분하다).
   * moneyChordSectionMap[0]의 chordId는 항상 moneyChordId와 같다(주
   * 진행은 바뀌지 않는다 — 이 필드는 순수 추가 레이어).
   */
  moneyChordSectionMap?: MoneyChordSectionAssignment[];
  /** moneyChordSectionMap을 "Section: progression" verbatim 텍스트로 합친 것 — bridgeInstruction이 verbatim weave 지시에 쓴다. sectionStyleShiftText와 같은 패턴. */
  moneyChordSectionText?: string;
  /**
   * v5.11 (TASK L) — originally whole-pack-resolved (same value on every
   * slot, from matching opts.vocalTone once). 지시문 47 (TASK A) — 이제
   * opts.vocalPresetPlan이 유효할 때는 트랙별로 다른 값을 가진다(그
   * 트랙에 실제로 적용된 프리셋 id) — core/batchPreallocation.ts's
   * vocalPresetOverride 참고. vocalPresetPlan이 없거나 무효화됐으면
   * 기존처럼 전 트랙 동일값(또는 undefined)이다.
   */
  effectiveVocalPresetId?: string;
  /** 지시문 49 (TASK A) — mirrors SongIdea.vocalPresetSource's own doc comment; the source this slot's effectiveVocalPresetId actually came from. */
  vocalPresetSource?: 'plan' | 'tone-match' | 'auto';
  /** v5.11 (TASK L) — this trackNo's actual assigned genre id(s), already sanitized; mirrors SongIdea.effectiveGenreIds's own doc comment. */
  effectiveGenreIds: string[];
  /** v5.13 (TASK: kidsAgeTierId wiring) — mirrors SongIdea.effectiveKidsAgeTierId's own doc comment; whole-pack-resolved (same value on every slot for a kids archetype), not per-track. */
  effectiveKidsAgeTierId?: KidsAgeTierId;
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
  // TASK D2 §4 — 'call-response' added alongside data/killingPoints.ts's own identical widening (kids-only killing points; see KIDS_KILLING_POINTS).
  killingPointPlacement?: 'final-chorus' | 'bridge' | 'mid-instrumental' | 'pre-chorus' | 'outro' | 'call-response';
  /** v3.68 (TASK B) — this trackNo's killing point id (data/killingPoints.ts KillingPoint.id), snapshotted for rating analysis alongside killingPointText/killingPointPlacement above. */
  killingPointId?: string;
  /** v3.68 (TASK B) — this trackNo's own lead genre's broad era bucket (see data/genreLibrary's GenrePack.eraTag), for rating analysis. */
  eraTag?: string;
  /** v3.68 (TASK B) — this trackNo's arc phase (see core/arcPlan.ts), for rating analysis. */
  arcPhase?: string;
  /** v3.68 (TASK B) — this trackNo's arc intensity, 1-5 (see core/arcPlan.ts), for rating analysis. */
  intensity?: number;
  /**
   * 지시문 26 (TASK A) — this trackNo's PeakStrength (core/arcPlan.ts), snapshotted
   * at slot-creation time. Previously only readable transiently off the arc
   * plan array while building killingPointPlan (never stored on the slot
   * itself) — so nothing downstream (SongIdea, exported packs, audit) could
   * tell "peakStrength was genuinely 'none' by design" apart from "the field
   * was just never populated". Always set (even for 'none' tracks), unlike
   * killingPointText/Placement/Id which stay undefined only for 'none'.
   */
  peakStrength?: 'none' | 'subtle' | 'strong';
  /**
   * 지시문 23 (TASK A) — this trackNo's computed perceived energy, 1-5 (see
   * core/perceivedEnergy.ts's computePerceivedEnergy). Deliberately separate
   * from `intensity` above (arc *position*, fixed by trackNo regardless of
   * which genre/tempo actually landed on that slot) — perceivedEnergy is
   * derived from the slot's actual resolved tempo/arrangementDensity/
   * instrumentSet/vocalText and the lead genre's rhythm/instruments/vocal/
   * production fields. The two are expected to disagree sometimes; that
   * disagreement is itself the first calibration data (§A-5), not a bug to
   * reconcile away.
   */
  perceivedEnergy?: PerceivedEnergy;
  /** 지시문 23 (TASK A) — perceivedEnergy의 사람이 읽는 근거 문구. 판정에는 쓰이지 않는다(computePerceivedEnergy's own doc comment) — eraTag 자유 문자열 문제 재발 방지. */
  perceivedEnergyReasonKo?: string;
  /**
   * v3.82 (TASK B) — this trackNo's BPM-appropriate lyric length targets
   * (see core/bpmLengthControl.ts's resolveBpmLengthTier), so a slow-tempo
   * track is told to use FEWER sections/words than a fast one instead of
   * one flat target regardless of tempo (the real cause of T7's 4:16 — see
   * that module's own doc comment). Always set when `tempo` is (i.e.
   * always, in practice) by both core/batchPreallocation.ts and
   * core/localGenerator.ts's pre-pass.
   */
  sectionCountRange?: [number, number];
  wordCountRange?: [number, number];
  /** v3.82 (TASK B) — total instrumental-only sections allowed for this trackNo, INCLUDING the intro if instrumental. Flagship slots (tracks 2-3) are additionally hard-capped at 1 regardless of this tier value — see core/batchPreallocation.ts's own flagship override. */
  maxInstrumentalSections?: number;
  /** v3.82 (TASK B) — this trackNo's own design-time estimated render length in seconds (core/bpmLengthControl.ts's estimateSongLengthSec), for UI/report display alongside the design gate's own blocking check. */
  estimatedLengthSec?: number;
  /**
   * TASK (genre-archetype sanitization) — set only on trackNo 1's slot
   * (core/batchPreallocation.ts's preallocateSongSlots is the one place this
   * is computed, once per whole pack, not per track — see
   * core/genreSelection.ts's genreSanitizationWarningKo). A whole-pack fact
   * ("N genres removed for this channel's archetype"), so it's carried on a
   * single slot rather than duplicated identically across every one;
   * core/batchPreallocation.ts's reconcileWithPreassignedSlot folds it into
   * that one song's own `warnings`, the same SongCard-visible mechanism
   * every other post-hoc reconciliation warning already uses.
   */
  genreWarning?: string;
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
  /**
   * v3.79 (TASK D) — mirrors `blueprint.meta.setCode` at the top level (see
   * PlaylistBlueprint.meta's own doc comment) purely so core/library.ts's
   * cheap meta-only listPacks() (which strips `blueprint` out — see
   * SavedPackMeta below) can still read a pack's set code without loading
   * every full pack, e.g. to count today's existing sets when assigning the
   * next one's sequence number. Always kept equal to blueprint.meta.setCode
   * by savePack; never set independently of it.
   */
  setCode?: string;
  /**
   * 지시문 18 (TASK C) — 이 세트를 실제로 만든 생성 에이전트. savePack이
   * options.generatedBy(가져오기 화면 선택값)에서 옮겨 담는다 — 어느
   * 저장 경로도 이 필드를 빈 채로 남기지 않는다(정직한 기본값 'other').
   * 세트가 쌓여도 "클로드코드와 코덱스 중 어느 쪽이 나은가"를 사후에
   * 답할 수 없던 문제(§C-1)를 이 필드 하나로 해결한다.
   */
  generatedBy?: PackGeneratedBy;
  /** generatedBy가 'other'일 때만 쓰는 자유 입력. */
  generatedByNote?: string;
  /**
   * 지시문 18 (TASK C-2) — `blueprint.meta.bridgeVersion`을 top level로
   * 미러링한다(setCode와 정확히 같은 패턴 — SavedPackMeta가 blueprint를
   * 제외하므로, 가벼운 목록 조회에서도 이 값을 읽을 수 있어야 집계 화면이
   * 매 팩을 전부 로드하지 않고도 동작한다). savePack이 항상 blueprint.meta.bridgeVersion과
   * 동일하게 유지한다.
   */
  bridgeVersion?: string;
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
