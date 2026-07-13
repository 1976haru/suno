# Changelog

Summary of notable changes from v3.0 through v3.6. Dates are omitted since
versions weren't tagged at release time — this is a retrospective summary
written alongside the v3.6 work.

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
