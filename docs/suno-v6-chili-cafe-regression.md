# Suno v6 CHILI / CAFE / POV Regression

## 087 완료

1. 실제 확인 workspace IDs: `jp-chillhop` (`jp-chillhop` archetype), `jp-cafe-chillhop` (`jp-cafe-chillhop` archetype), and the existing `en-chillhop` workspace. Channel profiles: `jp-chili-lab-story` (`jp-chillhop`), `jp-cafe-chili-lab` (`jp-cafe-chillhop`), `headphones-down-low`, `after-hours-deep-house`, `city-lights-crossfade`, `tokyo-night-headphones`, and `harbour-line-house` (`en-chillhop`).
2. v6 default: `v6 Production`, recommended Variety `0`, Standard execution, app-side style budget `900`.
3. JP Story male: actual EP.001 train first-meeting plan line parsed identically on all engines; Japanese, `firstPerson`, male `15/15`, female `0`, mixed `0`.
4. JP Story female: actual EP.001 train first-meeting plan line parsed identically on all engines; Japanese, `firstPerson`, female `15/15`, male `0`, mixed `0`.
5. couple: existing JP STORY couple contract remains Japanese/first-person with the pre-existing non-solo allocation.
6. source parser: v6, v6-wild, and v6-mini produce deep-equal parser results for both actual EP.001 plan-line fixtures.
7. source-local scenes: `15/15` for both solo STORY fixtures; all scenes remain in the EP.001 train first-meeting source.
8. 5-act: `T1-T3 Act1`, `T4-T6 Act2`, `T7-T9 Act3`, `T10-T12 Act4`, `T13-T15 Act5` on all three engines.
9. male/female title overlap: existing fixture regression remains `<=2/15`; each side remains unique.
10. male/female hook overlap: existing fixture regression remains `<=2/15`; each side remains unique.
11. manual genre exact: the `4/4/4/3` fixture is identical for requested counts, SetPlan, preassignedSongs, and Bridge on `v6`, `v6-wild`, and `v6-mini`.
12. JP Cafe male: Japanese/first-person, male `15/15`, Cafe fields preserved, 5 acts preserved, all three engines.
13. JP Cafe female: Japanese/first-person, female `15/15`, Cafe fields preserved, 5 acts preserved, all three engines.
14. JP Cafe couple: Japanese/first-person, male `6`, female `6`, mixed `3`, Cafe fields preserved, all three engines.
15. EN CHILI: existing `en-chillhop` remains English and does not receive JP STORY or JP CAFE contract blocks.
16. v6-wild hard-lock regression: POV, vocal quota, Japanese language, source EP, source-local scenes, 5 acts, and manual genre counts unchanged.
17. v6-mini regression: same Story and manual genre invariants as v6 and v6-wild.
18. engine switch preservation: switching v6 -> v6-wild -> v6-mini preserves channel, Story source metadata, POV, language, perspective, song count, and allocations.
19. prompt QA: v6 compiler keeps genre, BPM, effective vocal, money chord, structure/instrumentation, and duration in ordered non-truncated atoms; duplicate optional clauses are removed. No invented Suno API field is emitted.
20. Bridge snapshot: official `buildClaudeCodeInstruction` output contains `[SUNO ENGINE]`, `[JP CHILI LAB STORY PLAN]` or `[JP CAFE CHILI LAB STORY CONTRACT]`, source episode metadata, vocal hard lock, source-local guidance, and engine model.
21. typecheck: PASS (`npm.cmd run typecheck`).
22. lint: PASS (`npm.cmd run lint`).
23. test:fast: PASS, `92` files, `1342` passed, `9` skipped.
24. npm test: PASS, `377` files passed, `1` skipped, `4762` passed, `10` skipped (network-enabled audit check).
25. build: PASS (`npm.cmd run build`; Vite completed successfully).
26. 남은 문제: none.
