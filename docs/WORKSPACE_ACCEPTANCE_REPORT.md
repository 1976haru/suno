# 7-워크스페이스 인수 기준표 (codex 지시문 07)

이 문서는 지시문 07의 **최종 인수 매트릭스** 요구사항(18곡 단일 세트 / 3세트
멀티세트 / 유효한 가져오기 / 복구 가능한 가져오기 / 차단된 가져오기 /
선택 재작성 / 감사된 export / 오디오 테이크 선택 / 프로덕션 번들, 7개
워크스페이스 × 9개 항목)에 대해, **실제 존재하는 자동화 커버리지를 근거로**
작성했습니다. 63칸을 전부 수동으로 새로 클릭 검증하는 대신, 각 항목이 실제로
어떤 real test/E2E로 뒷받침되는지를 정직하게 표로 남깁니다 — 뒷받침이 약하거나
없는 칸은 "부분"/"미검증"으로 명시했습니다 (허위로 "통과"라 적지 않습니다).

## 범례

- ✅ **실제 커버리지 있음** — 이 항목을 검증하는 real test/E2E가 존재하고 통과함
- 🟡 **부분 커버리지** — 로직은 워크스페이스 비의존적(workspace-agnostic)이거나
  카테고리 단위로만 검증됨 (7개 워크스페이스 각각을 리터럴로 찌르지는 않음)
- ⚠️ **미검증/알려진 gap** — 실제로 확인되지 않았거나, UI 진입점이 아예 없음

## 매트릭스

| 워크스페이스 | 18곡 단일세트 | 3세트 멀티세트 | 유효 가져오기 | 복구가능 가져오기 | 차단 가져오기 | 선택 재작성 | 감사된 export | 오디오 테이크 선택 | 프로덕션 번들 |
|---|---|---|---|---|---|---|---|---|---|
| senior-oldpop | ✅ E2E smoke + `seniorBaseline.test.ts` | 🟡 `multiSetPreflight.test.ts` (senior 포함) | ✅ E2E-07 | ✅ E2E-08 | ✅ E2E-09 | ✅ E2E-12 + `generationGatePanel` 로직 | ✅ E2E-13 + `exportMeta.test.ts` | 🟡 `checkSeniorAudioCompliance` (category-level) | 🟡 `productionBundleExport.test.ts` (workspace-무관 로직만) |
| kr-2030 | ✅ E2E smoke + `workspaces.test.ts` | 🟡 `multiSetPreflight.test.ts` | 🟡 동일 core 로직(bridgeImport는 workspace-비의존) | 🟡 상동 | 🟡 상동 | 🟡 상동 (GenerationGatePanel은 전 워크스페이스 공유) | 🟡 상동 (exportMeta는 workspaceId 파라미터화됨) | 🟡 `check2030AudioCompliance` | 🟡 상동 |
| jp-2030 | ✅ E2E smoke + `workspaces.test.ts` | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 `check2030AudioCompliance` | 🟡 상동 |
| kr-kids | ✅ E2E smoke (kids 배너 처리 포함) + `kidsAgeTierWiring.test.ts` | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 `checkKidsAudioCompliance` | 🟡 상동 |
| jp-kids | ✅ E2E smoke (kids 배너 처리 포함) | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 `checkKidsAudioCompliance` | 🟡 상동 |
| kr-idol-male | ✅ E2E smoke — **이번 태스크에서 발견/수정한 실제 버그**(moodPacks 5종 누락)로 이전엔 기본값 자체가 깨져 있었음 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 `checkKpopAudioCompliance` | 🟡 상동 |
| kr-idol-female | ✅ E2E smoke — 상동 버그 수정 대상 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 상동 | 🟡 `checkKpopAudioCompliance` | 🟡 상동 |

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

## 알려진 한계 (정직하게 남김)

1. **프로덕션 번들 UI 진입점 없음**: `core/productionBundle.ts`의
   `buildProductionBundleFiles`/`buildProductionBundleManifest`는 실제
   함수 레벨에서는 테스트되지만(`productionBundleExport.test.ts`), 이를
   호출하는 버튼/화면이 어디에도 없습니다 (전체 `.tsx` grep 재확인 완료).
   7개 워크스페이스 어디서도 실제 사용자가 도달할 수 없는 기능입니다.
2. **오디오 테이크 선택은 카테고리 단위로만 워크스페이스 분화**: kids/kpop/
   2030/senior 4개 카테고리 함수로 나뉘어 있어 kr-kids와 jp-kids, 혹은
   kr-idol-male과 kr-idol-female이 서로 다른 실제 값으로 개별 검증되지는
   않습니다 (두 워크스페이스가 같은 카테고리 정책을 공유하는 것이 의도인지,
   더 세분화가 필요한지는 이번 태스크 범위 밖입니다).
3. **가져오기/재작성/export의 senior-oldpop 외 워크스페이스 E2E 실증 없음**:
   TASK C의 14개 시나리오는 senior-oldpop 하나로 전체 wizard flow를
   실증하고, 나머지 6개 워크스페이스는 "채널→생성 준비까지 깨지지 않는다"는
   스모크 수준만 검증합니다. 근거 함수(`bridgeImport.ts`/
   `importInspection.ts`/`exportMeta.ts`)는 모두 workspaceId를
   파라미터로만 받는 순수 함수라 워크스페이스별 분기가 거의 없다는 점은
   코드 레벨에서 확인했지만, 6개 워크스페이스 각각에 대해 실제 브라우저로
   가져오기/재작성/export를 눌러본 것은 아닙니다.
