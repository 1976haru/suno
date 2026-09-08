# JP CHILI STORY Final Wiring Audit

## Scope

This audit covers the existing Bridge path only: resolved options -> SetPlan -> preassigned slots -> Bridge payload/instruction -> import. No new generation feature was added.

## Measured Fixtures

| Fixture | Vocal quota | Manual genre request | SetPlan genre counts | Bridge slot counts | Result |
| --- | --- | --- | --- | --- | --- |
| 彼のSTORY, 15 tracks | male 15 / female 0 / mixed 0 | 4 / 4 / 4 / 3 | 4 / 4 / 4 / 3 | 4 / 4 / 4 / 3 | PASS |
| 彼女のSTORY, 15 tracks | male 0 / female 15 / mixed 0 | 4 / 4 / 4 / 3 | 4 / 4 / 4 / 3 | 4 / 4 / 4 / 3 | PASS |

The female fixture's stale `mature soulful male tenor` input is normalized before preallocation. Bridge payload and slot vocal text contain zero male-tenor, male-baritone, or male-voice conflicts. The male fixture likewise rejects conflicting female lead descriptors.

## Source Parser And Identity

- `parseChiliStoryPlanLine` separates `planEpisodeId`, `povTitle`, `sourceEpisodeId`, `sourceTitle`, `sourceEventSummary`, and `povIntentSummary` from one pasted plan line.
- The parsed plan line is copied to options, preassigned slots, Bridge meta, and the Bridge instruction brief.
- `002. title` parses as episode `002` plus title.
- `002. title — inline summary` parses all three source fields.
- A numberless line parses as an unlisted source title.
- A separately edited summary overrides the inline summary.
- Story preassigned titles and hooks include source title, POV, and track context, preventing male/female fixture identity collapse and title/hook equality.

## Mode And Regression Checks

- `male -> female`, `female -> male`, and solo -> couple transitions clear stale solo Story state.
- JP Cafe male, female, and couple contracts remain covered by the existing parity tests.
- Non-Story workspaces retain their existing contract behavior.

## Verification

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test:fast`: PASS, 91 files, 1331 passed, 9 skipped
- Story targeted tests: PASS, 19 passed
- `npm test`: PASS, 376 files passed, 1 skipped, 4751 passed, 10 skipped
- `npm run build`: PASS; existing Vite chunk-size warning remains
- `git diff --check`: PASS; only normal LF/CRLF conversion warnings
