/**
 * codex 지시문 05 (TASK C) — single source-of-truth for every audit/design-
 * issue id string used across release readiness, the rewrite loop, and (per
 * this task's own list) the UI/tests. Real, confirmed drift bug this closes:
 * core/rewriteLoop.ts's own `DESIGN_SCOPED_ITEM_IDS` hand-typed hyphenated
 * guesses ('era-primary-share', 'bpm-in-range', 'genre-max5') that do NOT
 * match core/fullAudit.ts's real, underscored ids ('bpm_in_range',
 * 'genre_max5') — self-documented as a known bug in
 * core/releaseReadiness.ts's own STYLE_ALLOCATION_ITEM_IDS comment, and
 * confirmed by investigation to mean rewriteLoop.ts's design-scope
 * classification silently exempted nothing it meant to.
 *
 * Scoping decision: four DIFFERENT id vocabularies are already live in
 * production (fullAudit.ts: snake_case; designGate.ts: hyphenated;
 * releaseReadiness.ts's own new items: a third, independently-hyphenated
 * set; compositionScorer.ts's pack-level findings: a fourth). Mass-renaming
 * every existing literal across those 4 files to one convention would touch
 * every one of their own already-passing tests that pin exact id strings,
 * for zero behavior change — out of scope here. Instead: every id below is
 * the REAL, unmodified current value (verified by direct read of its source
 * file), re-exported from ONE place so no future consumer has to
 * hand-type/guess a spelling again. `auditItemIds.test.ts` asserts no two
 * constants collide on value (the real drift-detection the old, silently
 * broken rewriteLoop.ts sets never had).
 */

// ---------------------------------------------------------------------------
// core/fullAudit.ts — real ids, snake_case (unchanged, not this task's to rename)
// ---------------------------------------------------------------------------
export const FULL_AUDIT_ITEM_IDS = {
  songCount: 'song_count',
  genreVariety: 'genre_variety',
  genreMax5: 'genre_max5',
  genreNoSingleton: 'genre_no_singleton',
  genreNoTripleRun: 'genre_no_triple_run',
  bpmStddev: 'bpm_stddev',
  bpmInRange: 'bpm_in_range',
  vocalDistribution: 'vocal_distribution',
  vocalZoneMax3: 'vocal_zone_max3',
  vocalNoTripleRun: 'vocal_no_triple_run',
  vocalDescPresent: 'vocal_desc_present',
  femaleGenderExplicit: 'female_gender_explicit',
  vocalDescVariety: 'vocal_desc_variety',
  promptLength: 'prompt_length',
  descriptorCount: 'descriptor_count',
  sharedAtoms: 'shared_atoms',
  eraContradiction: 'era_contradiction',
  labelLeak: 'label_leak',
  artistLeak: 'artist_leak',
  durationDup: 'duration_dup',
  lyricWordCount: 'lyric_word_count',
  sectionCount: 'section_count',
  situationAllDistinct: 'situation_all_distinct',
  emotionArcVariety: 'emotion_arc_variety',
  arrangementVocabLeak: 'arrangement_vocab_leak',
  titleLineLeak: 'title_line_leak',
  placeholderLeak: 'placeholder_leak',
  grammarArticleErrors: 'grammar_article_errors',
  introLeak: 'intro_leak',
  endTagLeak: 'end_tag_leak',
  vocabRepeatMax20: 'vocab_repeat_max20',
  hookWordOveruse: 'hook_word_overuse',
  vocabRepeatAdvisory: 'vocab_repeat_advisory',
  vocabRepeatBlocking: 'vocab_repeat_blocking',
  killingPointAssigned: 'killing_point_assigned',
  killingPointVariety: 'killing_point_variety',
  arcPhaseAllUsed: 'arc_phase_all_used',
  peakNoneCount: 'peak_none_count',
  titlePatternVariety: 'title_pattern_variety',
  titlePatternMax4: 'title_pattern_max4',
  hookConnectedTitle: 'hook_connected_title',
  promiseFulfillment: 'promise_fulfillment',
  realDurationRange: 'real_duration_range',
  killingPointAmplitude: 'killing_point_amplitude',
  workspaceIsolation: 'workspace_isolation'
} as const;

// ---------------------------------------------------------------------------
// core/releaseReadiness.ts — real ids this file defines itself (hyphenated),
// distinct from the fullAudit.ts ones it also reuses verbatim above.
// ---------------------------------------------------------------------------
export const RELEASE_READINESS_ITEM_IDS = {
  sceneRecentSetOverlap: 'scene-recent-set-overlap',
  sceneRecentSetSimilarity: 'scene-recent-set-similarity',
  titleFullHistoryCollision: 'title-full-history-collision',
  lyricLineRecentSetOverlap: 'lyric-line-recent-set-overlap',
  promptFingerprintRecentSetOverlap: 'prompt-fingerprint-recent-set-overlap',
  arrangementRecipeRecentSetOverlap: 'arrangement-recipe-recent-set-overlap',
  englishGrammarErrors: 'english-grammar-errors',
  inSongLineRepetition: 'in-song-line-repetition',
  tempoWordingContradiction: 'tempo-wording-contradiction',
  /**
   * codex 지시문 05 (TASK F) — replaces the old fixed 750~850자 hard band
   * (`exclude-prompt-length`) and the old exact-count "제목=훅 8~10곡" hard
   * band (`title-equals-hook-band`, both removed). New ids, new real checks
   * reusing already-built 지시문 03 infrastructure instead of a second
   * arbitrary fixed window.
   */
  titleHookDisconnectedQuota: 'title-hook-disconnected-quota',
  negativePromptLength: 'negative-prompt-length',
  sameSubjectCap: 'same-subject-cap',
  motifFamilyRecentPackCooldown: 'motif-family-recent-pack-cooldown',
  modulationCount: 'modulation-count',
  introTypeVariety: 'intro-type-variety',
  /** codex 지시문 05 (TASK F) — genuinely new categories this task's own §measure list adds (language/export-completeness). */
  languageMatch: 'language-match',
  exportFieldCompleteness: 'export-field-completeness',
  /** 지시문 08 (TASK C) — core/seniorOldpopPolicy.ts's own 3 remaining checks (era share, motif sub-quotas, chord-progression dominance), senior-morning archetype only. */
  seniorEraShare: 'senior-era-share',
  seniorMotifQuota: 'senior-motif-quota',
  seniorChordDominance: 'senior-chord-dominance'
} as const;

// ---------------------------------------------------------------------------
// core/designGate.ts — real ids, hyphenated (design-time / pre-generation gate)
// ---------------------------------------------------------------------------
export const DESIGN_GATE_ITEM_IDS = {
  vocalTypeVariety: 'vocal-type-variety',
  vocalTypeMin: 'vocal-type-min',
  vocalConsecutive: 'vocal-consecutive',
  vocalSegmentBalance: 'vocal-segment-balance',
  vocalQuotaFidelity: 'vocal-quota-fidelity',
  bpmStddev: 'bpm-stddev',
  bpmRange: 'bpm-range',
  bpmWithinProfile: 'bpm-within-profile',
  songLengthEstimate: 'song-length-estimate',
  paletteCoverage: 'palette-coverage',
  paletteVariety: 'palette-variety',
  paletteVarietyMax: 'palette-variety-max',
  genreVariety: 'genre-variety',
  genreMax: 'genre-max',
  genreSingleton: 'genre-singleton',
  genreConsecutive: 'genre-consecutive',
  moneychordExplicitChoiceZero: 'moneychord-explicit-choice-zero',
  moneychordExplicitChoiceFlagship: 'moneychord-explicit-choice-flagship',
  moneychordMax: 'moneychord-max',
  moneychordExplicitChoiceShare: 'moneychord-explicit-choice-share',
  moneychordVariety: 'moneychord-variety',
  arrangementDensityFullMax: 'arrangement-density-full-max',
  arrangementDensityMediumMin: 'arrangement-density-medium-min',
  arrangementDensityConsecutive: 'arrangement-density-consecutive',
  eraPrimaryShare: 'era-primary-share',
  eraForbidden: 'era-forbidden',
  eraUnspecifiedShare: 'era-unspecified-share',
  killingPointCount: 'killing-point-count',
  killingPointVariety: 'killing-point-variety',
  arcPhases: 'arc-phases',
  kidsArcAdultPhaseLeak: 'kids-arc-adult-phase-leak',
  kidsArcBundleSetMismatch: 'kids-arc-bundle-set-mismatch',
  kidsArcBundleCountMismatch: 'kids-arc-bundle-count-mismatch',
  kidsArcLastPhaseIdentity: 'kids-arc-last-phase-identity',
  kidsArcLastBundleIntensity: 'kids-arc-last-bundle-intensity',
  kidsArcMovingConsecutive: 'kids-arc-moving-consecutive',
  vocabDiversityForecast: 'vocab-diversity-forecast'
} as const;

// ---------------------------------------------------------------------------
// core/compositionScorer.ts — real pack-level ScopedIssue ids (post-generation gate)
// ---------------------------------------------------------------------------
export const COMPOSITION_SCORER_ITEM_IDS = {
  eraConsistency: 'era-consistency',
  eraConsistencyAdvisory: 'era-consistency-advisory',
  vocalTempoStructure: 'vocal-tempo-structure',
  vocabularyRepetitionBlocking: 'vocabulary-repetition-blocking',
  vocabularyRepetitionAdvisory: 'vocabulary-repetition-advisory',
  hookWordOveruse: 'hook-word-overuse',
  titleShapeVariety: 'title-shape-variety'
} as const;

// ---------------------------------------------------------------------------
// codex 지시문 05 (TASK D) — genuinely NEW ids this task introduces for the
// rewrite loop's own findings, kept hyphenated (this task's own new-code
// convention, per its own "하이픈/밑줄 형태 혼용 금지" — new ids never mix).
// ---------------------------------------------------------------------------
export const REWRITE_LOOP_ITEM_IDS = {
  releaseReadinessCatastrophic: 'release-readiness-catastrophic',
  passedTrackMutated: 'passed-track-mutated',
  rewriteStopConditionExhausted: 'rewrite-stop-condition-exhausted'
} as const;

/**
 * The REAL, corrected track/design scope-classification sets rewriteLoop.ts
 * should have used — every id here is verified against its own source file
 * above (fullAudit.ts's real snake_case, releaseReadiness.ts's real
 * hyphenated own-ids), unlike the old hand-typed guesses.
 */
export const TRACK_SCOPED_ITEM_ID_SET: ReadonlySet<string> = new Set([
  RELEASE_READINESS_ITEM_IDS.englishGrammarErrors,
  RELEASE_READINESS_ITEM_IDS.inSongLineRepetition,
  RELEASE_READINESS_ITEM_IDS.tempoWordingContradiction,
  RELEASE_READINESS_ITEM_IDS.sceneRecentSetOverlap,
  RELEASE_READINESS_ITEM_IDS.sceneRecentSetSimilarity,
  RELEASE_READINESS_ITEM_IDS.titleFullHistoryCollision,
  RELEASE_READINESS_ITEM_IDS.lyricLineRecentSetOverlap,
  RELEASE_READINESS_ITEM_IDS.promptFingerprintRecentSetOverlap,
  RELEASE_READINESS_ITEM_IDS.arrangementRecipeRecentSetOverlap
]);

export const DESIGN_SCOPED_ITEM_ID_SET: ReadonlySet<string> = new Set([
  FULL_AUDIT_ITEM_IDS.bpmInRange,
  FULL_AUDIT_ITEM_IDS.bpmStddev,
  FULL_AUDIT_ITEM_IDS.genreVariety,
  FULL_AUDIT_ITEM_IDS.genreMax5,
  FULL_AUDIT_ITEM_IDS.genreNoSingleton,
  FULL_AUDIT_ITEM_IDS.genreNoTripleRun,
  FULL_AUDIT_ITEM_IDS.vocalDistribution,
  FULL_AUDIT_ITEM_IDS.vocalZoneMax3,
  FULL_AUDIT_ITEM_IDS.vocalNoTripleRun,
  RELEASE_READINESS_ITEM_IDS.modulationCount,
  RELEASE_READINESS_ITEM_IDS.introTypeVariety,
  RELEASE_READINESS_ITEM_IDS.sameSubjectCap,
  RELEASE_READINESS_ITEM_IDS.motifFamilyRecentPackCooldown
]);

/** Flat lookup of every id above, by its own constant name — used only by auditItemIds.test.ts's own collision check. */
export const ALL_AUDIT_ITEM_ID_GROUPS = {
  fullAudit: FULL_AUDIT_ITEM_IDS,
  releaseReadiness: RELEASE_READINESS_ITEM_IDS,
  designGate: DESIGN_GATE_ITEM_IDS,
  compositionScorer: COMPOSITION_SCORER_ITEM_IDS,
  rewriteLoop: REWRITE_LOOP_ITEM_IDS
} as const;
