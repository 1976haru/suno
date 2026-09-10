# Suno v6 Senior / Kids Regression

## 089 완료

1. 실제 senior workspace/profile IDs: workspace `senior-oldpop`, default profile `senior`; profiles `good-morning-memory-radio` (`senior-morning`), `oldpop-lounge-main` (`oldpop-lounge`), `morning-showa-cafe` (`showa-cafe`). The workspace also retains its existing `christmas`, `lofi-study`, `kids`, `showa-70s`, `j2000s`, `modern-chill`, and `city-night` archetypes.
2. 실제 kids workspace/profile IDs: workspaces `kr-kids` (`kr-kids-song`, profile `kr-kids`) and `jp-kids` (`jp-kids-song`, profile `jp-kids`). Generic kids profile is `kids`; tier registry is `kids-t1`, `kids-t2`, `kids-t3`.
3. kids-pop 존재 여부: separate `kids-pop` or `children` archetype was not found. The actual general English nursery profile is `little-singalong-radio` (`kids`, audience `kids`) and has no explicit `kidsAgeTierId`; the app default is `kids-t2`. No unsupported English grades 3-5 ID was invented.
4. senior v6 default: `v6 Production`, recommended Variety `0`, Standard execution.
5. senior vocal QA: existing `senior` profile retains clear diction, audible lead, warm midrange, comfortable register, singable stepwise melody, and restrained exclusions for belting, harsh top end, rapid phrasing, and aggressive percussion.
6. senior genre QA: `senior-morning` and `oldpop-lounge` preallocation keeps multiple genre identities; no KIDS or idol genre IDs appear. Production is not forced to Showa/vintage tape across the senior channels.
7. senior lyric/scene QA: existing concrete senior scene planning and channel-specific genre/vocal plans remain in the Bridge path; JP CHILI contract blocks do not appear.
8. kids age profiles: all three real tiers are present: `kids-t1` 0-2, `kids-t2` 2-4, `kids-t3` 4-7; each retains its own tempo, word, hook-repeat, instrument, and forbidden-trait values.
9. kids language QA: Korean, Japanese, and English channel defaults remain unchanged through v6 engine switches.
10. kids vocabulary QA: selected age tier remains attached to every preassigned slot; tier-specific total word target and max hook-repeat values remain available.
11. kids hook QA: existing `preassignedSongs` hook plan and repeat policy remain unchanged across v6, v6-wild, and v6-mini.
12. kids structure QA: existing tier structure and per-track saved plan remain unchanged; no fixed single structure was introduced.
13. kids-pop separation: no separate kids-pop registry was found; general `kids`, `kr-kids-song`, and `jp-kids-song` remain distinct archetypes with children content tier.
14. Variety: Production `0`, wild `50`, mini `0`; recommendation metadata only.
15. Max: recommendation only; no automatic forcing and no invented API field. Kids remain Standard by default.
16. manual genre: existing genre allocation fields are preserved across all v6 profiles.
17. manual vocal: existing vocal allocation fields and per-track vocal plan are preserved across all v6 profiles.
18. v6-wild regression: senior comfort, kids age tier, language, genre, vocal, hook, and difficulty fields unchanged.
19. v6-mini regression: switching mini -> v6 preserves the same audience and saved-plan contract.
20. leakage tests: senior has no JP CHILI STORY/CAFE contract and no kids/idol genre plan; kids has no JP CHILI contract and no oldpop/idol genre plan. Audience-owned forbidden-topic boundaries remain on the actual channel profiles.
21. old saved pack: v5.5-shaped senior and kids options without `sunoEngine` resolve to v6 Production while retaining language, genres, vocal quota, and age tier.
22. Bridge meta: all tested profiles include `[SUNO ENGINE]`, model, purpose, Variety recommendation, Max recommendation, v6 compiler, and 900-character app-side budget.
23. typecheck: PASS (`npm.cmd run typecheck`).
24. lint: PASS (`npm.cmd run lint`).
25. test:fast: PASS, `92` files, `1350` passed, `9` skipped.
26. npm test: PASS, `377` files, `4770` passed, `10` skipped.
27. build: PASS (`npm.cmd run build`).
28. 남은 문제: 없음.
