# JP CHILI STORY Plan-Line Final Audit

## Summary Table

축 | 여자 fixture | 남자 fixture | 판정
--- | --- | --- | ---
planEpisodeId | 001 | 001 | PASS
povTitle | 目が合っただけなのに | 窓ぎわの君が気になった | PASS
sourceEpisodeId | 001 | 001 | PASS
sourceTitle | 기차에서 처음 만남 | 기차에서 처음 만남 | PASS
sourceSummary | 같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다. | 같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다. | PASS
povIntentSummary | 그녀의 작은 행동/기대/원한 다음 행동 분리 | 그의 숨김/말하지 못한 마음 분리 | PASS
storyAct sequence | 1-3 Act1, 4-6 Act2, 7-9 Act3, 10-12 Act4, 13-15 Act5 | 1-3 Act1, 4-6 Act2, 7-9 Act3, 10-12 Act4, 13-15 Act5 | PASS
scene source-local count | 15/15 | 15/15 | PASS
unrelated scene count | 0/15 | 0/15 | PASS
vocal quota | female 15, male 0, mixed 0 | male 15, female 0, mixed 0 | PASS
genre count | auto jp-chillhop core rotation; manual regression 4/4/4/3 preserved | auto jp-chillhop core rotation; manual regression unaffected | PASS
Japanese guidance | Japanese primary title schema, Japanese hook rule | Japanese primary title schema, Japanese hook rule | PASS
title/hook overlap | title==hook 0/15 | title==hook 1/15 | PASS
Bridge contradiction | unlisted 0, untitled 0, old English guidance 0 | same parser/slot path | PASS

## Measured Counts

```text
female source-local scenes: 15/15
female unrelated scenes: 0/15
male source-local scenes: 15/15
male unrelated scenes: 0/15
relationship-stage violations: 0

male/female exact same titles: 0/15
male/female exact same hooks: 0/15
male title==hook: 1/15
female title==hook: 0/15

female unique titles/hooks: 15/15, 15/15
male unique titles/hooks: 15/15, 15/15
hook length outliers: 0

female vocabulary banks: 5 kinds, 3 tracks each
male vocabulary banks: 5 kinds, 3 tracks each
manual genre regression: chill-rap 4, boom-bap-mellow 4, jazz-rap 4, lofi-hiphop-study 3
manual female vocal regression: male 0, female 15, mixed 0

JP Cafe couple regression: male 6, female 6, mixed 3; 15/15 source-local cafe scenes; 5 vocabulary-bank kinds
```

## Bridge Checks

```text
[JP CHILI LAB STORY PLAN]: present
POV TITLE: present
SOURCE: EP.001 「기차에서 처음 만남」
SOURCE EVENT: present
VOCAL HARD LOCK: present
title output shape: natural Japanese primary song title
episode (unlisted): 0
untitled: 0
playlist-friendly English works well: 0
2-5 words, Title Case: 0
future-stage terms in story-plan/lyric-scene blocks: 0
```

## Test Results

```text
npm.cmd run typecheck: PASS
npm.cmd run lint: PASS
npm.cmd run test:fast: PASS (91 files, 1332 passed, 9 skipped)
npm.cmd test: PASS after registry-access rerun (376 files, 4752 passed, 10 skipped)
npm.cmd run build: PASS
```

Initial non-escalated `npm.cmd test` failed only because the embedded `npm audit --json` call could not parse the sandboxed registry response. Escalated `npm.cmd audit --json` returned high=0, critical=0, moderate=2, and the escalated full Vitest suite passed.

## Final Report

```text
[지시문 84 완료 보고]

1. 작업 브랜치: main
2. 시작 commit: e702439
3. 최종 commit: e702439 (커밋하지 않음; 변경사항은 작업트리에 남김)

[A. 여자 실제 fixture]
4. planEpisodeId: 001
5. povTitle: 目が合っただけなのに
6. sourceEpisodeId: 001
7. sourceTitle: 기차에서 처음 만남
8. sourceSummary: 같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다.
9. povIntentSummary: 그 뒤 그녀는 작은 행동의 의미를 혼자 오래 되짚다가, 그때 말하지 못한 기대와 자신이 정말 원했던 다음 행동을 돌아본다.
10. vocal: female 15/15, male 0/15, mixed 0/15
11. genre: JP CHILI core auto rotation; manual regression 4/4/4/3 preserved
12. act sequence: T1-3 Act1, T4-6 Act2, T7-9 Act3, T10-12 Act4, T13-15 Act5

[B. 남자 실제 fixture]
13. planEpisodeId: 001
14. povTitle: 窓ぎわの君が気になった
15. sourceEpisodeId: 001
16. sourceTitle: 기차에서 처음 만남
17. sourceSummary: 같은 칸, 같은 창가를 바라보다 우연히 눈이 마주친다.
18. povIntentSummary: 그 뒤 그는 설렘을 인정하지 않으려 했지만, 겉으로 숨겼던 이유와 말하지 못한 마음을 자기 시점에서 되짚는다.
19. vocal: male 15/15, female 0/15, mixed 0/15
20. genre: JP CHILI core auto rotation; manual genre path untouched
21. act sequence: T1-3 Act1, T4-6 Act2, T7-9 Act3, T10-12 Act4, T13-15 Act5

[C. Scene planner]
22. female source-local scenes: 15/15
23. female unrelated scenes: 0/15
24. male source-local scenes: 15/15
25. male unrelated scenes: 0/15
26. relationship-stage violations: 0

[D. Title/Hook]
27. same titles male/female: 0/15
28. same hooks male/female: 0/15
29. male title==hook: 1/15
30. female title==hook: 0/15
31. Japanese primary title: PASS, 30/30 planned titles Japanese primary

[E. Bridge]
32. unlisted occurrences: 0 for EP.001 source placeholder
33. untitled occurrences: 0 for EP.001 source placeholder
34. English lyric-guidance conflicts: 0 targeted old conflicts
35. story metadata complete: PASS
36. source-aware scene plan: PASS

[F. Regression]
37. JP Café male: PASS, solo hard lock male 15/15 covered
38. JP Café female: PASS, solo hard lock female 15/15 covered
39. JP Café couple: PASS, male 6 / female 6 / mixed 3, 15/15 source-local cafe scenes
40. en-chillhop: PASS, no JP STORY contract pollution
41. jp-2030: PASS, no JP STORY contract pollution

[G. Tests]
42. typecheck: PASS
43. lint: PASS
44. test:fast: PASS
45. npm test: PASS after registry-access rerun
46. build: PASS

47. 남은 문제: 없음. npm audit registry access는 sandbox 밖에서 재확인했고 high/critical 0.
48. GitHub push 여부: 아니오
```
