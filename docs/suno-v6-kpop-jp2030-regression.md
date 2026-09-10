# Suno v6 K-POP / JP2030 Regression

## 088 완료

1. 실제 KPOP workspace/profile IDs: workspaces `kr-idol-male`, `kr-idol-female`; archetypes `kr-idol-male`, `kr-idol-female`. Profiles `stage-night`, `drive-kpop-playlist`, `dawn-confession`; `daylight-city-kpop`, `nonstop-playlist`, `songs-for-after-its-over`.
2. 실제 JP2030 workspace/profile IDs: workspace `jp-2030`, archetype `jp-2030-pop`, audience profile `jp-2030-melodic`. Profiles `reiwa-way-home-jpop`, `tokyo-night-melodic-pop`, `want-to-cry-band-playlist`.
3. v6 default: `v6 Production`, recommended Variety `0`, Standard execution; wild is exploration and mini is draft.
4. KPOP prompt contract: real preassigned plans preserve genre identity, short intro/opening policy, verse/chorus section structure, vocal descriptors, hook device, chorus contrast, and arrangement variation.
5. KPOP hook QA: hook bank is the existing `kr-idol-male` policy path; hooks, hook devices, and safety exclusions remain populated and engine-independent.
6. KPOP chorus contrast: all measured baseline slots carry `chorusContrastText`; Bridge instruction retains the chorus-fuller-than-verse arrangement rule.
7. KPOP vocal diversity: baseline 15-track `stage-night` plan measured `male 13 / female 0 / mixed 2`; vocal descriptor set has multiple values and is identical after engine switching.
8. JP2030 native Japanese QA: `jp2030Policy.ts` and `modern2030PolicyFor('jp-2030')` are reused; language remains Japanese, translationese sample check is empty, and a natural Japanese sample has no katakana-overuse finding.
9. JP2030 title policy: existing `jp2030Override('japanese')` hook bank and `jp-2030-melodic` audience profile are used; genre, vocal allocation, hooks, and saved plan remain unchanged across engines.
10. CHILI leakage: JP2030 Bridge snapshots contain no JP CHILI STORY or JP CAFE contract block; JP2030 does not receive CHILI POV/parser/5-act/source-local behavior.
11. senior/kids leakage: JP2030 registry uses its own `jp-2030-melodic` audience profile and dedicated `jp2030Override`; no senior/kids policy was introduced.
12. manual genre: existing manual allocations remain preserved by the v6 engine profile; engine changes do not mutate genre allocation fields.
13. manual vocal: KPOP fixed policy remains `male 13 / female 0 / mixed 2` for the measured 15-track preallocation; engine changes preserve the exact per-track vocal plan.
14. v6-wild: exploration metadata changes only; KPOP/JP2030 language, genre, vocal, hook, and saved plan remain unchanged.
15. v6-mini: draft metadata changes only; KPOP/JP2030 content contracts remain unchanged.
16. Max recommendation: remains recommendation metadata only; no automatic forcing or invented API field.
17. Variety recommendation: Production `0`; wild `50`; mini `0`, with no content-contract mutation.
18. Bridge meta: all engine snapshots include `[SUNO ENGINE]`, model, purpose, Variety recommendation, Max recommendation, v6 compiler, and 900-character app-side budget.
19. old saved pack: missing `sunoEngine` resolves to v6 Production while retaining JP2030 Japanese language, genres, vocal allocation, and saved plan fields.
20. typecheck: PASS (`npm.cmd run typecheck`).
21. lint: PASS (`npm.cmd run lint`).
22. test:fast: PASS, `92` files, `1346` passed, `9` skipped.
23. npm test: PASS, `377` files, `4766` passed, `10` skipped.
24. build: PASS (`npm.cmd run build`).
25. 남은 문제: 없음.
