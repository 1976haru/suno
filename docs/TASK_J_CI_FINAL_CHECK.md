# TASK J — 최종 CI 점검 (지시문 11)

## 0. 실제 job 수 — 정직한 정정

지시문은 "15개 job 모두 blocking, 0 continue-on-error"를 요구했다.
`.github/workflows/ci.yml`을 직접 센 실제 job 수는 **14개**다(`typecheck`,
`unit`, `lint`, `matrix`, `build`, `isolation`, `audit`, `check-node`,
`check-reachability`, `build-single`, `stress`, `api-integration`,
`security-audit`, `playwright`). 15번째 job은 존재하지 않는다 — 허구로 하나를
추가하지 않고 실제 개수를 그대로 보고한다.

## 1. continue-on-error 제거

`playwright` job 하나만 `continue-on-error: true`였다(`lint`는 지시문 09에서
이미 제거됨). 이번 TASK J에서 제거했다 — 근거: 지시문 11 TASK G에서 실제로
`npx playwright install`로 chromium을 설치하고 51개 시나리오 전부를 이 로컬
환경에서 직접 실행해 직렬 실행 51/51 통과를 확인했다(WORKSPACE_ACCEPTANCE_REPORT.md
참고). 원래 이 플래그가 있던 이유("이 세션은 브라우저를 실제로 실행해 볼
수 없다")가 더 이상 사실이 아니다. **결과: 14개 job 전부 continue-on-error
없이 blocking 상태.**

## 2. 14개 job 실제 로컬 실행 결과 (실측, 미측정을 통과로 세지 않음)

| Job | 로컬 실행 명령 | 결과 |
|---|---|---|
| typecheck | `npm run typecheck` | ✅ 통과 |
| unit | `npm test` | ✅ 319 files / 3923 tests 통과 |
| lint | `npm run lint` | ❌ **132 errors + 66 warnings** (pre-existing) |
| matrix | `npm run test:matrix` | ❌ **14/178 실패** (pre-existing) |
| build | `npm run build` | ✅ 통과 |
| isolation | `npm run audit:isolation` | ✅ PASS 50 / FAIL 0 / SKIP 17 |
| audit | `npm run audit` | ❌ **회귀 2건** (exit 1, pre-existing) |
| check-node | `npm run check:node` | ✅ 통과 |
| check-reachability | `npm run check:reachability` | ✅ stale 0 · 사유없음 0 |
| build-single | `npm run build:single` | ✅ 통과 |
| stress | `npm run test:stress` | ✅ 43/43 통과 |
| api-integration | `npm run test:api-integration` | ✅ 10/10 통과 |
| security-audit | `npm run security:audit` | ✅ 전부 PASS |
| playwright | `npm run test:e2e` | ✅ 51/51 통과 (직렬 실행) |

**11/14 실제 통과, 3/14 실제 실패.** "0 continue-on-error"는 이제 설정상
사실이지만, 실제로 CI를 지금 돌리면 3개 job이 빨간불이다 — 이것을 숨기지
않는다.

## 3. 3개 실패 job — 전부 이 세션(지시문 11) 이전부터 있던 문제임을 실측 확인

각 파일에 대해 `git diff <지시문 11 시작 커밋>~1 HEAD -- <파일>`로 직접
대조해, 이 지시문의 어떤 커밋도 원인 파일을 건드리지 않았음을 확인했다.

### 3-1. `lint` — 132 errors + 66 warnings

지시문 09가 이미 문서화한 133개 사전 존재 오류(지시문 09 자신의 "측정-복구
태스크지 품질-수정 태스크가 아니다"라는 명시적 범위 밖 결정)의 연장선이다.
**이번 세션에서 직접 발견·수정한 것**: 세션 자신이 새로 만든 코드에서 실제로
2건의 새 오류를 찾았다 —

- `AudioAnalysisPanel.tsx`: import했지만 쓰지 않은 `canSelectTake` (지시문 11
  TASK F 자신의 실수) → 제거.
- `ProductionBundlePanel.tsx`: `useEffect` 본문에서 동기적으로
  `setState(false)`를 호출하던 실제 react-hooks/set-state-in-effect 위반
  (지시문 11 TASK F 자신의 실수) → `loadedForPackId` 파생 상태 패턴으로 재작성.

둘 다 고쳤다(132 = 134 - 2). 나머지 132개는 이 세션이 만들지 않은 사전
존재 백로그 — 고치지 않았다(범위 밖).

### 3-2. `matrix` — `tests/providerResponseFixtures.test.ts` 14/178 실패

`tests/fixtures/providerResponses/normal.json`·`withPreamble.json` 두
픽스처가 7개 워크스페이스 전부에서 실패한다. 세 가지 실제 원인을 정확히
특정했다:

1. **stylePrompt 인플레이션** — 픽스처 원문 stylePrompt는 ~19단어인데, 실제
   `importSongsJson`(reconcileWithPreassignedSlot 경유) 처리 후 72~101단어로
   불어난다. 모든 워크스페이스 자체의 목표(45~70단어)를 넘는다. 근본 원인은
   이번 세션에서 완전히 규명하지 못했다 — reconcileWithPreassignedSlot의 어떤
   보정 atom들이 이만큼 추가하는지는 별도의 깊은 조사가 필요하고, 지시문 10이
   이미 이 함수를 조심스럽게 다뤘던 이력(TASK C의 fast-path 버그 등)을 고려하면
   이 지시문(측정)의 범위를 넘는 리팩터링이다. **정직하게 미해결로 남김.**
2. **곡 내 문장 반복(englishLint 차단)** — 지시문 11 TASK H(§2)가 이미 정확히
   같은 근본 원인으로 문서화한 문제: `findInSongLineRepetition`이 hookPhrase
   그 줄 하나만 반복을 허용하고, 일반적인 팝송 관습(코러스 전체 반복)의
   나머지 줄은 차단한다. TASK H에서 이미 "체커 로직 변경은 이 지시문 범위
   밖"이라 결정했다 — 이 결정과 일관되게, 여기서도 체커를 고치지 않았다.
3. **kr-idol-male/kr-idol-female 전용: 제목 "Stay"가 단일 영단어** — K-pop
   제목 충돌 위험 규칙(§9-3)에 실제로 걸린다. 픽스처의 실제 결함.

**고치지 않은 이유**: 1번은 근본 원인이 불명확한 채로 건드리면 지시문 10이
이미 조심스럽게 만든 reconcileWithPreassignedSlot을 다시 흔들 위험이 있고,
2번은 TASK H가 이미 명시적으로 범위 밖으로 결정한 체커 로직이다. 픽스처
파일 자체(3번, 그리고 2번의 표면적 증상)만 고치는 것도 고려했으나, 1번이
해결되지 않는 한 이 테스트는 여전히 실패하므로 부분 수정은 "고쳤다"는 허위
인상만 남긴다 — 통째로 미해결로 정직하게 보고한다.

### 3-3. `audit` — 회귀 2건 (exit 1)

`npm run audit`가 기본으로 비교하는 팩("비틀즈 느낌의 밝은 60년대 팝",
2026-08-02 기준선)은 하루 자신의 실제 생성 이력이다 — 이 지시문이나 이
세션이 만든 데이터가 전혀 아니다(`lyrics/taskH/`의 신규 파일과는 무관).
`scripts/audit.ts`도 이번 세션에서 전혀 건드리지 않았다(git diff로 확인).
프롬프트 길이(722~942자, 기준 350~650자)와 서술어 개수(29~35, 기준 15~25)
회귀, 어휘 반복 49회(기준 30회) 등 — 전부 하루의 실제 팩 콘텐츠에 대한
실측이며, 이 지시문의 TASK 목록 어디에도 "하루의 기존 팩을 다시 쓰라"는
항목이 없다. **고치지 않고 그대로 보고.**

## 4. 결론

- continue-on-error: **0/14** (요구사항 충족).
- job 개수: **14개**(지시문이 말한 15개가 아님 — 정정 보고).
- 실제 그린 상태: **11/14**. 나머지 3개(lint/matrix/audit)는 전부 이 세션
  이전부터 존재했던 실제 실패이며, 원인을 정확히 특정했지만 이 지시문의
  범위(측정 및 TASK A-J에 명시된 항목) 밖이라 고치지 않았다.
- 이 세션이 실제로 만든 새 lint 오류 2건은 발견 즉시 수정했다.
