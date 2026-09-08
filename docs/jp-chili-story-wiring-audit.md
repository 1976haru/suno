# JP CHILI STORY Wiring Audit

Date: 2026-09-08

Scope: instruction 81. The official measurement path is the Bridge path:
`GenerationOptions` -> `applyChiliStoryGenerationContract` -> Step2 plan allocations -> preflight -> `preallocateSongSlots` -> `buildClaudeCodeInstruction` -> `songs-output.json` import.

## Source Of Truth

The shared source of truth is `src/core/chiliStoryPov.ts`:

- `applyChiliStoryGenerationContract(opts)`
- `resolveEffectiveStoryVocalQuota(opts)`
- `isStoryVocalHardLocked(opts)`
- `clearChiliStorySoloVocalLock(opts)`

Solo Story no longer represents the hard lock as `vocalQuotaMode: "balanced"`. The effective quota is carried as `vocalQuota` plus a matching `vocalType` diversity allocation only when the selected Story mode owns that solo quota.

## End-To-End Table

| 축 | 입력 opts | effective contract | UI 표시 | preflight | slot | bridge | import | 판정 |
|---|---|---|---|---|---|---|---|---|
| lyricLanguage | stale values allowed | Japanese | Step2/Step3 read effective opts | allowed | Japanese story slots | native Japanese instruction | meta/songs keep Story metadata | PASS |
| perspective | stale values allowed | firstPerson | Step2 lock summary, Step3 contract panel | no POV mismatch | first-person story speaker plan | first-person POV instruction | storyPov preserved | PASS |
| perspectiveMode | stale values allowed | fixed | fixed-mode summary | no mode mismatch | fixed POV allocation | fixed POV instruction | meta preserved | PASS |
| storyPov | male / female / couple | male / female / couple | Story selector keeps selected POV | same effective POV | slot `storyPov` matches | Story contract block matches | imported songs match | PASS |
| songCount | 15 and 12 measured | hard lock scales to count | displayed from effective quota | allowed | 15/0/0, 0/15/0, 12/0/0, 0/12/0 | exact count text | imported count matches | PASS |
| vocalQuota | male: 15/0/0, female: 0/15/0, couple: no solo quota | solo hard lock; couple clears stale solo quota | Step2Concept locks generic gender UI; Step2Plan shows `STORY 고정`; Step3 shows Story 100% | vocal warning 0 for solo | male 15/15 or female 15/15 | hard lock line includes exact counts | imported songs have 0 violations | PASS |
| vocal gender | opposite vocal preset was injected in tests | preset cannot change solo gender quota | tone picker is locked from gender-ratio editing | no generic vocal-minimum warning | every solo slot has selected gender | `VOCAL HARD LOCK` | imported songs all selected gender | PASS |
| scenePlanningMode | source summary present | same-story-comparison | Story summary UI feeds contract | allowed | 5-act story roles assigned | same-story comparison guidance | meta preserved | PASS |
| storySourceTitle | parsed or restored | preserved | shown as auto-recognized title | unchanged | copied to slots | included in source event | imported meta/songs preserve | PASS |
| storySourceSummary | user summary or parsed line | preserved | base visible field | unchanged | copied to slots | included in source event | imported meta/songs preserve | PASS |
| storyPreviousContext | optional | preserved | advanced field | unchanged | copied to slots | context guidance when present | imported meta/songs preserve | PASS |
| storyNextHint | optional | preserved | advanced field | unchanged | copied to slots | next-episode hint when present | imported meta/songs preserve | PASS |
| storyLocation | optional | preserved | advanced field | unchanged | copied to slots | setting guidance when present | imported meta/songs preserve | PASS |
| storySeason | optional | preserved | advanced field | unchanged | copied to slots | season guidance when present | imported meta/songs preserve | PASS |

## Mode Measurements

| mode | effective quota | Step2Plan allocation | preallocated slots | Bridge instruction | import | stale quota check |
|---|---:|---:|---:|---|---|---|
| 彼のSTORY, 15 songs | male 15 / female 0 / mixed 0 | 15 / 0 / 0 | 15 / 0 / 0 | `male 15/15, female 0/15, mixed/duet 0/15` | 15 male songs | PASS |
| 彼女のSTORY, 15 songs | male 0 / female 15 / mixed 0 | 0 / 15 / 0 | 0 / 15 / 0 | `male 0/15, female 15/15, mixed/duet 0/15` | 15 female songs | PASS |
| 彼のSTORY, 12 songs | male 12 / female 0 / mixed 0 | restored from saved opts | 12 / 0 / 0 | count scales from `songCount` | measured through slots | PASS |
| 彼女のSTORY, 12 songs | male 0 / female 12 / mixed 0 | restored from saved opts | 0 / 12 / 0 | count scales from `songCount` | measured through slots | PASS |
| ふたりのSTORY | no solo hard quota | no stale solo `vocalType` axis | not equal to prior solo quota | follows non-solo Story contract | import uses current mode | PASS |
| 彼のCAFÉ STORY | male 15 / female 0 / mixed 0 | 15 / 0 / 0 | 15 / 0 / 0 | hard lock male | 15 male songs | PASS |
| 彼女のCAFÉ STORY | male 0 / female 15 / mixed 0 | 0 / 15 / 0 | 0 / 15 / 0 | hard lock female | 15 female songs | PASS |
| ふたりのCAFÉ STORY | male 6 / female 6 / mixed 3 | 6 / 6 / 3 | 6 / 6 / 3 | `male 6/15, female 6/15, mixed/duet 3/15` | 6 / 6 / 3 | PASS |

## UI Simplification

Base visible fields for JP CHILI Story:

- Story mode selector
- raw `원문 한 줄`
- `원문 적용` parser action
- auto-recognized EP/title text
- `사건 요약`

Additional base visible fields for JP Cafe CHILI Story:

- `카페 장소`
- `계절/분위기`

Advanced fields:

- `이전 맥락`
- `다음 힌트`
- `장소`
- `계절`
- Cafe-only type/weather/time fields

The raw line and summary are preserved when switching male/female/couple Story modes.

## Tests

- `npm run typecheck`: PASS
- `npx vitest run tests/jpChillhopPov.test.ts tests/jpChillhopParityAndCafe.test.ts`: PASS, 16 tests
- Story-owned solo quota is marked with `storyVocalQuotaSource: 'story-contract'`; couple switching clears only that derived lock and preserves user-owned manual quota.
- `npm run lint`: PASS
- `npm run test:fast`: PASS, 91 files, 1327 passed, 9 skipped
- `npm test`: PASS on escalated rerun, 376 files passed, 1 skipped, 4747 tests passed, 10 skipped. Initial sandboxed run failed only because `npm audit --json` could not reach/parse the npm audit endpoint.
- `npm run build`: PASS, with the existing Vite chunk-size warning
