# 7-워크스페이스 인수 기준표 (codex 지시문 07 → 지시문 11 TASK G 갱신)

이 문서는 지시문 07의 **최종 인수 매트릭스** 요구사항(18곡 단일 세트 / 3세트
멀티세트 / 유효한 가져오기 / 복구 가능한 가져오기 / 차단된 가져오기 /
선택 재작성 / 감사된 export / 오디오 테이크 선택 / 프로덕션 번들, 7개
워크스페이스 × 9개 항목)에 대해, **실제 존재하는 자동화 커버리지를 근거로**
작성했습니다. 63칸을 전부 수동으로 새로 클릭 검증하는 대신, 각 항목이 실제로
어떤 real test/E2E로 뒷받침되는지를 정직하게 표로 남깁니다 — 뒷받침이 약하거나
없는 칸은 "부분"/"미검증"으로 명시했습니다 (허위로 "통과"라 적지 않습니다).

**지시문 11 TASK G 갱신 (실측)**: 지시문 11은 "공통 로직이므로 통과"를
근거로 인정하지 않는다고 명시했다. 이전 버전의 매트릭스에서 🟡로 남아있던
5개 열(유효/복구가능/차단 가져오기, 선택 재작성, 감사된 export)은 실제로
senior-oldpop 하나로만 실증되고 나머지 6개는 "core 로직이 workspace-비의존
이므로"라는 근거만으로 🟡 처리되어 있었다 — 이 근거 자체가 이 지시문이
금지한 패턴이다. `scripts/genE2eFixtures.ts`를 7개 워크스페이스 전부의 실제
`generateLocalBlueprint()` 출력으로 확장하고, `tests/e2e/import.spec.ts`·
`tests/e2e/resultsFlow.spec.ts`의 해당 시나리오를 7개 워크스페이스 루프로
바꿔 실제로 브라우저에서 실행했다. **실측 과정에서 실제 버그 하나 발견·수정**:
최초 버전의 fixture 생성 스크립트가 워크스페이스 언어 정책과 무관하게
`lyricLanguage: 'english'`를 강제해, jp-2030 fixture의 가사가 일본어인데도
"language" 필드는 english였다 — 실제 import 시 18/18 트랙 전부 "언어 불일치
의심" 경고가 뜨며 정상 가져오기가 아니라 "검토 필요(repairable)" 모달로
빠졌다(브라우저에서 실제로 재현·확인). `data/workspaces/index.ts`의 진짜
`defaultLyricLanguage`를 쓰도록 고치자 즉시 해결됨 — 이 자체가 "실제로 돌려
보지 않았으면 못 잡았을 버그"의 사례.

## 범례

- ✅ **실제 커버리지 있음** — 이 항목을 검증하는 real test/E2E가 존재하고 통과함
- 🟡 **부분 커버리지** — 로직은 워크스페이스 비의존적(workspace-agnostic)이거나
  카테고리 단위로만 검증됨 (7개 워크스페이스 각각을 리터럴로 찌르지는 않음)
- ⚠️ **미검증/알려진 gap** — 실제로 확인되지 않았거나, UI 진입점이 아예 없음

## 매트릭스

| 워크스페이스 | 18곡 단일세트 | 3세트 멀티세트 | 유효 가져오기 | 복구가능 가져오기 | 차단 가져오기 | 선택 재작성 | 감사된 export | 오디오 테이크 선택 | 프로덕션 번들 |
|---|---|---|---|---|---|---|---|---|---|
| senior-oldpop | ✅ E2E smoke + `seniorBaseline.test.ts` | 🟡 `multiSetPreflight.test.ts` (senior 포함, E2E 아님) | ✅ E2E-07 (실제 실행) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `checkSeniorAudioCompliance`(단위 테스트) + `AudioAnalysisPanel.tsx` 실제 UI 배선(지시문 11 TASK F) — 실제 오디오 업로드 E2E는 아직 없음 | 🟡 `productionBundleExport.test.ts`(단위) + `ProductionBundlePanel.tsx` 실제 UI 진입점(지시문 11 TASK F 신규) — 실제 다운로드 E2E는 아직 없음 |
| kr-2030 | ✅ E2E smoke | 🟡 상동 | ✅ E2E-07 (실제 실행, 워크스페이스별 fixture) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `check2030AudioCompliance`(단위) — 위와 동일 UI 배선/E2E 상태 | 🟡 상동 |
| jp-2030 | ✅ E2E smoke | 🟡 상동 | ✅ E2E-07 (실제 실행) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `check2030AudioCompliance`(단위) | 🟡 상동 |
| kr-kids | ✅ E2E smoke (kids 배너 처리 포함) | 🟡 상동 | ✅ E2E-07 (실제 실행) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `checkKidsAudioCompliance`(단위) | 🟡 상동 |
| jp-kids | ✅ E2E smoke (kids 배너 처리 포함) | 🟡 상동 | ✅ E2E-07 (실제 실행) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `checkKidsAudioCompliance`(단위) | 🟡 상동 |
| kr-idol-male | ✅ E2E smoke | 🟡 상동 | ✅ E2E-07 (실제 실행) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `checkKpopAudioCompliance`(단위) | 🟡 상동 |
| kr-idol-female | ✅ E2E smoke | 🟡 상동 | ✅ E2E-07 (실제 실행) | ✅ E2E-08 (실제 실행) | ✅ E2E-09 (실제 실행) | ✅ E2E-12 (실제 실행) | ✅ E2E-13 (실제 실행) | 🟡 `checkKpopAudioCompliance`(단위) | 🟡 상동 |

**실측 실행 결과**: `npx playwright test` 전체 51개 시나리오 — 단독/직렬
실행 시 51/51 통과. 12-worker 병렬 실행에서 1건(`E2E-08 repairable —
kr-idol-male`)이 기본 5초 assertion 타임아웃으로 실패했으나, 동일 테스트를
단독 재실행하면 즉시 통과(1.8초) — 실제 앱 결함이 아니라 이 개발 머신에서
12개 헤드리스 Chrome을 동시에 띄울 때의 리소스 경합으로 판단된다(TASK J의
CI 안정성 검토에서 worker 수/타임아웃 조정을 함께 고려할 것).

## 공통 목표 대비 실측치

지시문 07 최종 승인 기준의 "공통 목표"는 다음과 같이 실측했습니다 (7개
워크스페이스 스모크 + 304개 테스트 파일 / 3781 테스트 기준, 지시문 07 작업
완료 시점):

- **구조적 인수 오류 = 0**: `npm test` 304 파일 전부 통과 (0 실패), 7-워크스페이스
  E2E 스모크 21/21 통과.
- **사용자 선택 손실 = 0**: `userChoicePreservation*.test.ts`/
  `channelProfileFieldPreservation.test.ts` 기존 통과 유지 (이번 태스크에서
  회귀 없음, 새 코드 변경 없음).
- **워크스페이스 정책 누출 = 0**: `workspaceDataIsolation.test.ts` 기존 통과
  유지.
- **CI job 전부 green**: 11개 job 중 9개는 blocking(실패 시 CI 실패),
  `lint`/`playwright` 2개는 `continue-on-error: true` — 각각 실제 외부 제약
  (TS7/typescript-eslint 미지원) 및 "이 프로젝트의 첫 E2E 스위트라 안정화
  전까지는 전체 파이프라인을 막지 않는다"는 의도적 선택. `playwright` job
  자체는 이번 태스크에서 만든 21개 시나리오로 실제 실행되며 로컬에서는
  21/21 통과 확인함.
- **가사/프롬프트 1차 완성률 ≥80%, 재작성 1회 ≥95%, 2회 ≥98%**: 지시문 05의
  선택적 재작성 루프(최대 2라운드)가 이 목표를 위해 만들어졌으나, 이 수치
  자체를 지시문 07에서 새로 측정하지는 않았습니다 — 지시문 05/06 완료
  보고서의 기존 측정치를 그대로 승계합니다 (이번 태스크의 실제 작업 범위는
  CI/성능/마이그레이션/E2E였지 재작성 성공률 재측정이 아니었습니다).

*(위 수치는 지시문 07 완료 시점의 스냅샷이다 — 이후 세션에서 파일/테스트
수는 계속 늘었다. 아래는 지시문 11 TASK G 완료 시점의 별도 실측이다.)*

## 지시문 11 TASK G 실측치 (2026-08-07)

- `npm test`: 319개 파일 / 3923개 테스트 전부 통과 (TASK D 완료 시점 기준,
  TASK G는 신규 유닛 테스트를 추가하지 않고 E2E만 확장).
- `npx playwright test` 전체 51개 시나리오: 단독/직렬 실행 51/51 통과
  (12-worker 병렬 실행에서 리소스 경합으로 추정되는 1건의 flaky 재현 —
  위 매트릭스 하단 참고).
- E2E 시나리오 수: 지시문 07 완료 시점 21개 → 이번 TASK G에서 30개 추가
  (E2E-07/08/09/12/13 × 6개 non-senior 워크스페이스 = 30) = 51개.

## 알려진 한계 (정직하게 남김, 지시문 11 TASK G 기준 갱신)

1. ~~프로덕션 번들 UI 진입점 없음~~ — **지시문 11 TASK F에서 해소**:
   `ProductionBundlePanel.tsx`가 실제 UI 진입점으로 추가됐고(Step4Result.tsx
   `audio` 탭), `PackAudioReadiness`로 트랙별 준비 상태를 먼저 보여준 뒤 ZIP
   다운로드를 제공한다. 다만 이 패널은 실제 오디오 bytes 없이
   가사/SRT/메타데이터만 담는다는 것을 화면에 정직하게 표시한다(브라우저
   File 객체가 컴포넌트 경계를 넘지 못하는 실제 아키텍처 제약, 그 패널 자신의
   doc comment에 명시). 이 UI 진입점 자체의 실제 브라우저 E2E(파일 업로드→
   측정→ZIP 다운로드까지)는 아직 없다 — 합성 WAV 픽스처를 만들어 실제로
   돌리는 건 이번 TASK G 범위에서 시도하지 않았다(정직하게 남김).
2. **오디오 테이크 선택은 카테고리 단위로만 워크스페이스 분화**: kids/kpop/
   2030/senior 4개 카테고리 함수로 나뉘어 있어 kr-kids와 jp-kids, 혹은
   kr-idol-male과 kr-idol-female이 서로 다른 실제 값으로 개별 검증되지는
   않습니다 (두 워크스페이스가 같은 카테고리 정책을 공유하는 것이 의도인지,
   더 세분화가 필요한지는 이번 태스크 범위 밖입니다). 지시문 11 TASK F에서
   `checkCoreAudioCompliance`의 5개 pass/warn/fail 판정과 시니어 전용
   `checkSeniorAmplitudeDeviation`은 실제 UI(`AudioAnalysisPanel.tsx`)에
   노출되도록 배선했지만, kids/kpop/2030 각 카테고리 전용 체크
   (`checkKidsAudioCompliance` 등)는 여전히 함수만 존재하고 UI에 아직
   노출되지 않는다.
3. ~~가져오기/재작성/export의 senior-oldpop 외 워크스페이스 E2E 실증 없음~~ —
   **지시문 11 TASK G에서 해소**: 위 매트릭스의 "유효/복구가능/차단
   가져오기·선택 재작성·감사된 export" 5개 열이 이제 7개 워크스페이스 전부
   실제 브라우저 E2E로 뒷받침된다(`tests/e2e/import.spec.ts`,
   `tests/e2e/resultsFlow.spec.ts` — 51개 시나리오 직렬 실행 51/51 통과).
   이 작업 자체가 실제 버그 하나를 발견·수정했다: fixture 생성 스크립트가
   워크스페이스 언어 정책과 무관하게 영어를 강제해 jp-2030 등에서 실제로
   "언어 불일치 의심" 경고가 뜨는 걸 실측으로 확인 — `scripts/
   genE2eFixtures.ts`를 각 워크스페이스의 진짜 `defaultLyricLanguage`를
   쓰도록 고쳐 해결했다.
4. **3세트 멀티세트는 여전히 unit-test 레벨만**: `multiSetPreflight.test.ts`가
   senior 포함 여러 워크스페이스를 다루지만 실제 브라우저 E2E는 없다 — 이번
   TASK G에서 시도하지 않은 유일한 나머지 열.
5. **오디오 테이크 선택/프로덕션 번들 두 열은 여전히 실제 브라우저 E2E가
   없다**: 실제 오디오 파일 업로드가 필요해 합성 WAV를 만들어 붙이는 별도
   작업이 필요하다 — 이번 TASK G 범위에서는 시도하지 않았다.
