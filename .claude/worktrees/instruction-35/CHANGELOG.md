# Changelog

Summary of notable changes from v3.0 through v3.6. Dates are omitted since
versions weren't tagged at release time — this is a retrospective summary
written alongside the v3.6 work.

## v5.25.0

**Gap notice**: this file stopped at v5.14.0 while `package.json`'s own
`"version"` field kept moving informally (comments throughout the codebase
reference "v5.15" through "v5.24") — the same drift v5.14.0's own entry
above already fixed once, recurred. This entry both catches the changelog
up to the real current state and documents the 7 "codex 지시문" specs
(01-07) that landed since, each as its own single commit on
`feat/notion-genre-library`:

- **지시문 01 (P0)** — response collection/import/snapshot/history
  stabilization: `GenerationSnapshot.appVersion`/`schemaVersion`,
  SRT-import channel-preservation fixes, `validateChannelProfile` wired
  into the real generation gate, `generationHistoryRevision`/
  `generationReservationLedger` modules.
- **지시문 02 (P0)** — workspace-wide common policy/semantic-duplication/
  choice-contract: `WorkspaceQualityPolicy` registry, `GenreWorkspaceOwnership`/
  `WorkspaceAvailability` wrappers, generalized era detection, `SceneSignature`/
  `sceneSimilarity` scorer, `MotifFamily` cross-pack cooldown registry,
  expanded `GenerationChoiceProvenance`.
- **지시문 03 (P1)** — type-based prompt/lyrics compiler: `PromptSpec`,
  vocal/BPM/intro/duration conflict fixes, per-workspace prompt word
  budgets, `NegativePromptSpec`, the real Lyrics AST
  (`parseLyricsSections`), section-aware repetition detection,
  multilingual `lyricMetaLeak` detection, `TitleHookRelationship`
  taxonomy, per-language (EN/KO/JA) lyric quality checks,
  `resolveLyricBudget`.
- **지시문 04 (P1)** — per-workspace dedicated quality rules: real adapter
  modules for all 7 workspaces (senior-oldpop/kr-2030/jp-2030/kr-kids/
  jp-kids/kr-idol-male/kr-idol-female) built on the 지시문 01-03 common
  engine, plus the shared `textMotifQuota`/`kpopWorkspacePolicy` engines.
- **지시문 05 (P1)** — quality score/selective rewrite/final export:
  the single `finalizeBlueprintForUse` pipeline, `ArtifactStage`/
  `ArtifactAuditMeta`, unified `auditItemIds.ts` registry, the selective
  rewrite loop (`hashStableSongFields` lock/verify, max-2-round cap +
  stagnation stop condition), Release Readiness V2 (real 10-category
  taxonomy, removed the old fixed 750-850자/제목=훅 exact-count bands),
  stage-suffixed final export, the workspace-keyed rewrite-stage
  dashboard. Also fixed a real, confirmed live bug: `conceptFitScore:100`
  used to ship in every saved/exported pack.
- **지시문 06 (P2)** — real audio takes/take comparison/blind A-B/
  production bundles: `core/audioMeasurements.ts` (clipping/silence/
  approximate-loudness/stereo-width/sampleRate/channels — extending the
  already-real `core/audioTakes.ts`/`core/audioAnalysis.ts` pipeline),
  `core/audioCompliance.ts`'s literal tolerance-band checks + per-workspace
  additions, the 12-item rejection-reason taxonomy and selection-safety
  gate, the honest `MusicGenerationProvider` contract (no real Suno API
  access exists anywhere in this codebase, confirmed), the 5-axis blind
  benchmark, the 5-stage safe-learning lifecycle extending
  `verifiedCombos.ts`, and the real production-bundle exporter.
- **지시문 07 (P2)** — CI/performance/migration/release readiness: split
  CI jobs (typecheck/lint/unit/matrix/stress/isolation/build/build:single/
  playwright/api-integration/security-audit — 11 independent jobs, none
  bundled), `WorkspaceAvailability` unified as the one real gate across
  UI/preflight/routing (3 previously-independent `.ready` re-derivations
  now share one function), IndexedDB migration gaps closed
  (`release-readiness` store), a real `/?repair=1` bug fixed (its
  recoverable-database list had gone stale, silently leaving 8 of 17 real
  databases un-wiped — now backed by a real regression test), a real
  migration-progress callback, a real security audit script (0 high/critical
  dependency vulnerabilities, 0 secret-leak findings across API-key/
  localStorage/snapshot/export/log/error-message/upload-path checks), real
  API integration tests (batch polling/cancellation/timeout/malformed-body/
  secret-redaction, mock-contract only, zero real cost), a real
  performance-baseline script + budget tests (9 operations measured, all
  well under a 60fps frame budget at 18-song single-set scale — no worker
  offload needed today), a 21-scenario real Playwright E2E suite (14
  numbered wizard/import/results scenarios + 7-workspace smoke), and this
  version-drift fix itself. Also fixed a real, previously-undetected bug
  the new E2E smoke suite caught: every one of kr-idol-male/kr-idol-female's
  6 default channel presets referenced 5 mood ids
  (confident/energetic/bright/intimate/emotional) that were never added to
  `moodPacks` — both idol workspaces failed `validateChannelProfile` on
  their own defaults, out of the box, until now.

**Gap notice (added in v5.14.0):** this file was never updated past v3.6,
even though `package.json`'s `"version"` field and the commit history both
kept moving (informal task-doc naming reached "v5.13" before this entry was
written). Nothing between v3.7 and v5.13 is documented here — this entry
does not attempt to reconstruct that history retroactively (see v5.14.0's
own entry below for why), so treat everything below v5.14.0 as accurate but
incomplete relative to the actual commit log.

## v5.14.0

- **Version consolidation**: `package.json`'s `"version"` (previously stale
  at `4.0.0`), the app's own UI header (previously a hardcoded "Suno Weaver
  Studio v3" string, unrelated to either the package version or the commit
  history), and this changelog had drifted into three unrelated numbers
  with no way for anyone looking at a running build to tell which
  commit/feature-set they were actually looking at.
- Added `src/core/buildInfo.ts`'s `BUILD_INFO` (`appVersion`,
  `schemaVersion`, `commitSha`, `builtAt`) as the single source every
  version display now reads from — extending v4.0 (TASK C)'s existing
  `APP_VERSION`/`COMMIT_SHA` injection (Vite `define`, see
  `vite.config.ts`/`vite.config.single.ts`) with a real `builtAt` (`new
  Date().toISOString()`, injected the same way) and `schemaVersion` (reused
  from `core/schemaVersion.ts`'s `CURRENT_SCHEMA_VERSION`, not a new
  constant).
- Fixed the app header's hardcoded "Suno Weaver Studio v3" string to show
  the real `BUILD_INFO.appVersion`, commit, and schema.
- `BUILD_INFO`/`builtAt` now flows through every real export this app
  produces: the pack JSON/CSV export meta (`core/exportMeta.ts`'s
  `buildExportMeta`, already used by `utils/exporters.ts` and
  `core/standaloneProgressExport.ts`), the workspace backup file
  (`core/workspaceTransfer.ts`'s `WorkspaceExportFile`/`WorkspaceBundleFile`
  — `appVersion`/`schemaVersion`/`commitSha` were already wired in v4.0;
  this task added `builtAt`), and the take-ledger/set-summary CSV downloads
  (`core/csvExport.ts`'s `downloadCsv`, previously carrying no version
  information at all).

## v3.6

- **Prompt hard cap**: added `INPUT_LIMITS` with live character counters on
  vocal tone / custom money chord / avoid words / custom concept, clamp-and-warn
  on loading an over-limit saved pack, and confirmed the existing
  `enforcePromptLengthBudget` backstop guarantees every generated style prompt
  fits Suno's 1,000-character style field regardless of input length.
- **Batch API stability**: batch jobs now snapshot the exact settings they
  were submitted with (so a resumed job never silently picks up today's
  screen state); parallel sub-batches pre-allocate every track's title/hook/
  role/tempo/emotion-arc locally before submission so they structurally
  cannot collide; stitching is now trackNo-keyed (a retry overwrites instead
  of duplicating) with an explicit `validateStitched()` completeness/
  duplicate check; canceling a job now waits for Anthropic's terminal status
  and recovers whatever finished first instead of discarding it.
- **Thumbnails**: fixed the Midjourney prompt variant missing the
  composition/text-safe-zone instruction; added `packagingLanguage`
  (market-derived, independent of `lyricLanguage`) so a Korean or Japanese
  channel gets native-language titles/thumbnails even when its lyrics are in
  English.
- **Genre prompt library**: added a structured genre library (category,
  rhythm/vocal/production/harmony traits, compressed `shortPrompt`) with a
  1-primary + 2-secondary genre selection cap, keeping backward compatibility
  with existing saved packs.
- **Maintenance**: introduced `src/data/modelRegistry.ts` as the single
  source of truth for model ids (previously hardcoded in 6+ files), added a
  GitHub Actions CI workflow (typecheck/test/build on push and PR).

## v3.5

- Rewrote thumbnail image prompts as full scene descriptions (placement,
  lighting, camera, color, texture) instead of a flat object list; colors are
  expressed as plain-English names, never hex; thumbnail objects are filtered
  by season family; added Midjourney/Stable Diffusion prompt variants.
- Added the Anthropic Batch API generation pipeline (submit/poll/fetch/
  cancel/retry, IndexedDB job persistence surviving a closed tab) alongside
  the existing synchronous multi-batch path.
- Video operations dashboard for tracking published videos, not just
  generated songs.
- Thumbnail spec now generates 3 parallel headline strategies (A/B/C —
  season/emotion/audience emphasis) instead of one.
- Relaxed the thumbnail people policy from a blanket "no people" ban to a
  narrower "no identifiable person" ban (distant silhouettes allowed).

## v3.4

- Cross-pack hook ledger, combinatorial hook supply, and channel archetype
  hook banks, with test coverage for the hook engine (H1-H5) and thumbnail
  spec generation.
- Fixed Korean/Japanese hook tone and made hook length checking
  language-aware (syllable/mora count instead of naive word count).
- Fixed a situation-template gerund/noun mismatch and a hook-repeat overshoot.

## v3.3

- Replaced image-generation API calls with a generated thumbnail spec (a
  human/Canva-actionable spec, not a finished AI image) — deliberate product
  decision to keep a channel's thumbnail grid visually consistent across a
  season's uploads.
- Included the thumbnail spec in pack exports and saved packs.

## v3.2

- Hybrid generation mode (free local draft, then selective API refine).
- Dry-run prompt preview (see the exact API request with no call made).
- Rebuilt hooks as repeated, title-matching, grammatically-safe phrases; added
  rule-based hook quality scoring with no API call required.
- Batched hybrid refine calls for 4+ tracks with a live cost estimate.

## v3.1

- Fixed template grammar/repetition bugs (motif article grammar, double
  genitive titles, chorus lines stuffed with lowercased titles).
- Replaced free-text/dropdown fields with a click-based Korean UI
  (`ChoiceGrid`).
- Single-track regeneration with collision/quality retry and undo.
- Pre-generation cost estimate and an opt-in IndexedDB response cache.

## v3.0

- Rebuilt `App.tsx` into a 4-step wizard with sidebar.
- Added an IndexedDB-backed pack library (autosave, backup, per-song export).
- Added the LLM evaluation agent for pack- and song-level quality review.
- Added the API key settings UI and a dev-mode `/api/generate` proxy.
- Added the vitest suite, stress tests, and retry/partial-result handling
  for API providers.
