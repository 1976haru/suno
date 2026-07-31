# v3.66 완료 보고 — 구조 정리: 파이프라인 단일화 · 테스트 2단계 분리

기준 커밋: `9267e7e` (v3.64/v3.64-B 완료 후 진행). 이 작업은 **정리**이며 기능 추가가 아닙니다 — 아래 3절이 이 작업의 핵심 검증입니다.

커밋: TASK A `6b6b8ad` · TASK B `4aafcfd` · TASK C `bb8edf0` (TASK D는 조사 전용, 별도 커밋 없음 — 이 보고서 4절/6절에 결과 반영). 모두 `feat/notion-genre-library`에 push 완료.

---

## 1. `npm run test:fast` 실행 시간과 포함된 테스트 파일 목록

**실측 (이 머신, PowerShell/Bash 양쪽에서 동일하게 확인)**: 50개 파일 / 529개 테스트, **약 4.4~4.9초**.

포함된 49개 glob 패턴(정확히는 리터럴 파일명 49개 나열 — 이유는 아래 참고)이 매치한 50개 파일:

```
albumAudit.test.ts, albumAuditAggregation.test.ts, bridgeComposerMode.test.ts,
bridgeImportUi.test.ts, bridgeSetPlanHandoff.test.ts, bridgeSongCountMismatch.test.ts,
bridgeTempoBand.test.ts, claudeCodeBridge.test.ts, combinedDifferentiation.test.ts,
compositionRecompose.test.ts, compositionScorer.test.ts, diversityLinter.test.ts,
earwormMode.test.ts, generateBlueprintRecompose.test.ts, genreDifferentiation.test.ts,
genreFamilies.test.ts, genreLibrary.test.ts, genreRotationIdentity.test.ts, hook.test.ts,
hookBanks.test.ts, hookDedup.test.ts, hookLedger.test.ts, hookLedgerDashboard.test.ts,
hookParts.test.ts, hookPoolCapacity.test.ts, hookSceneContradiction.test.ts,
hookSimilarity.test.ts, introModePlan.test.ts, lyricBodyFidelity.test.ts,
lyricEngine.test.ts, lyricPlaceholderLeak.test.ts, lyricSituationFrames.test.ts,
lyricVocabularyGuard.test.ts, lyricVocabularyRepetition.test.ts, lyricsTranslation.test.ts,
oldpopArtistSeeds.test.ts, oldpopGenreFamily.test.ts, recomposeInstruction.test.ts,
setConcept.test.ts, setDirector.test.ts, setTitlePrefix.test.ts, sharedAtomRatio.test.ts,
songPostProcess.test.ts, structureTitleMonotony.test.ts, tempoPlan.test.ts,
titleHookOverlap.test.ts, titleNumbering.test.ts, titleShapeVariety.test.ts,
vocalGenderEnforcement.test.ts, vocalPlan.test.ts
```

**선정 기준**: 프롬프트/가사 조립, 장르·다양성 배분, 채점, 훅 중복 방지, 브릿지 핸드오프, BPM/보컬 계획 — 최근 v3.62~v3.64 작업이 실제로 손댄 영역. 썸네일·이미지 스튜디오·설정·스토리지·배치 잡·내보내기(안정화된 영역)와 `promptComposer`/`promptBudget` 관련 테스트(`promptBudgetLoopGuard`, `promptBudgetTargets`, `promptAtomLengthDiagnostic`, `promptCache`, `promptContradictions`, `promptLength`)는 제외 — TASK B에서 확인했듯 이 두 모듈이 로컬 미리보기 전용이기 때문입니다.

**정직한 구현 노트**: 스펙 예시(`tests/promptBudget*.test.ts tests/genre*.test.ts ...`)처럼 셸 글롭 패턴으로 처음 작성했더니 `npm run test:fast`가 11개 파일만 실행했습니다 — 원인은 npm이 Windows에서 스크립트를 `cmd.exe`로 실행하는데, `cmd.exe`는 글롭을 확장하지 않고 vitest에 리터럴 문자열을 그대로 넘기기 때문입니다(Bash 도구로 직접 실행했을 때는 Bash가 글롭을 확장해줘서 50개가 매치했습니다). PowerShell과 Bash 양쪽에서 동일하게 50/529가 나오도록, 최종적으로 리터럴 파일명 49개를 나열하는 방식으로 바꿨습니다.

---

## 2. `npm test` 전체 실행 시간

**실측 (이 머신)**: 131개 파일 / 1,473개 테스트, **약 23~25초**.

**정직한 공개**: 스펙은 "7~10분"을 근거로 들었지만, 이 머신에서는 vitest의 기본 병렬 스레드풀 덕분에 전체 스위트가 이미 25초 안팎으로 끝납니다. 스펙의 추정치는 아마 파일 3개 실행 시간(10.31초)을 124개로 단순 선형 외삽했거나(병렬성을 고려하지 않음), 병렬성이 낮은 다른 환경(예: CI, 코어 수 제한)에서 측정된 값일 가능성이 높습니다. 실측과 다르다는 점을 숨기지 않고 그대로 보고합니다 — 그렇다고 `test:fast`가 무의미한 것은 아닙니다. 병렬성이 낮은 환경(예: 사양이 낮은 로컬 머신, 단일 코어 CI)에서는 여전히 유효한 개선이며, 어느 환경에서든 50파일 서브셋이 131파일 전체보다 빠른 것은 항상 참입니다.

---

## 3. 작업 전후 18곡 산출물 diff — 이 작업의 핵심 검증

**TASK A (테스트 스크립트 분리)**: `package.json`/`AGENTS.md`만 수정. 곡 생성 파이프라인 코드에 손대지 않았으므로 산출물에 영향을 줄 수 없습니다 (구조적으로 불가능).

**TASK B (파이프라인 지위 확정)**: 코드 변경은 다음 하나뿐입니다 — `providers/index.ts`의 로컬 분기가 반환하는 객체에 `isLocalPreview: true` 키 하나를 추가:
```diff
- return { ...blueprint, songs };
+ return { ...blueprint, songs, isLocalPreview: true };
```
기존 `blueprint`/`songs` 값 자체는 건드리지 않으므로(새 키 추가는 기존 키에 영향 없음), 곡 내용이 달라질 수 없습니다. `types.ts`의 `isLocalPreview?: boolean` 필드 추가와 `Step4Result.tsx`의 배너 표시도 마찬가지로 순수 추가입니다. `promptComposer.ts`/`promptBudget.ts`는 주석만 추가했습니다(로직 라인 0줄 변경).

**TASK C (`claudeCodeBridge.ts` 분할) — 실제 위험이 있는 유일한 작업, 직접 diff 실측**:

동일한 채널(`senior-morning`)·동일한 concept(`"비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝"`)·동일한 avoid 목록으로 `buildClaudeCodeInstruction`을 18곡 기준으로 호출해 브릿지 지시문 전문을 생성하고, `git stash`로 분할 전(pre-split) 코드와 분할 후(post-split) 코드를 오가며 각각의 출력을 저장한 뒤 diff했습니다. (생성 타임스탬프 한 줄만 비결정적이라 그 줄만 제외하고 비교.)

```
$ diff before.txt after.txt && echo "IDENTICAL"
IDENTICAL
```

**분할 전후 출력이 2182/2182줄로 완전히 동일합니다.** SetPlan 테이블(18개 트랙 전부), 훅/장르/템포/구조/인트로/장면 프레임 지시문, JSON payload 전부 바이트 단위로 일치합니다. 이는 함수 본문을 그대로 잘라 옮겼을 뿐(순수 이동, 로직 미변경) 임을 직접 실측으로 증명합니다.

**전체 테스트**: TASK A/B/C 각 커밋 시점 모두 131개 파일 / 1,473개 테스트 전부 통과 (회귀 없음).

---

## 4. 검사 호출 지점 표 (TASK D, 조사 전용 — 수정 없음)

| 검사 | export 위치 | 실제 호출 지점 | 브릿지 경로 통과? | 로컬 경로 통과? | 중복 실행 발견? |
|---|---|---|---|---|---|
| `scoreSongs` | `quality.ts` | `bridgeImport.ts`(구 claudeCodeBridge.ts)의 `importSongsJson`; `localGenerator.ts`의 `generateLocalBlueprint`; `providers/index.ts`의 `generateBlueprint` (로컬 분기 재호출 + 원격 분기 2회) | **예** | **예** | **예** — `providers/index.ts`가 로컬 분기에서 `generateLocalBlueprint`가 이미 채점한 곡을 다시 `scoreSongs`로 채점 (1회 중복); 원격 분기는 recompose 전후 2회 호출 |
| `titleHookOverlapWarning`/`hookSceneTimeOfDayWarning`/`scenePropContradictionWarning` | `quality.ts` | `quality.ts`의 `checkHookQuality`(→ 모든 `scoreSongs` 경로에서 자동 포함); `albumAudit.ts`의 `auditAlbum`; `compositionScorer.ts`의 `scoreComposition` | 간접(scoreSongs 경유만) | 간접(scoreSongs 경유만) | **예** — `Step4Result.tsx`가 같은 블루프린트에 `auditAlbum`과 `scoreComposition`을 둘 다 호출해 렌더링마다 2회 중복 실행 |
| `auditAlbum` | `albumAudit.ts` | `Step4Result.tsx`(렌더 시점, UI 전용) | 아니오 | 아니오 | 해당 없음(호출 지점 1곳) |
| `lintInPackLyricDiversity`/`lintInPackStyleSimilarity` | `diversityLinter.ts` | `bridgeImport.ts`의 `importSongsJson`; `compositionScorer.ts`; `Step4Result.tsx`(스타일 유사도만 직접) | **예** | 아니오 | **예(유사도만)** — `Step4Result.tsx`가 직접 호출 + `scoreComposition` 경유로 2회 |
| `findArrangementVocabularyInLyrics` | `lyricVocabularyGuard.ts` | `compositionScorer.ts`; `albumAudit.ts` | 간접(scoreComposition 경유 시에만) | 간접 | `Step4Result.tsx`에서 auditAlbum+scoreComposition 동시 호출 시 2회 |
| `findArtistReferenceLeaks` | `artistReferenceDecomposer.ts` | `compositionScorer.ts`; `albumAudit.ts`; `conceptAgent.ts`(장르 추천용, 별개 용도); `localGenerator.ts`(아티스트 원자 풀 필터링) | 간접 | **예**(원자 풀 필터링) | 위와 동일 |
| `normalizeSongOutput` | `songPostProcess.ts` | `bridgeImport.ts`의 `importSongsJson`; `localGenerator.ts`의 `generateLocalBlueprint` | **예** | **예** | 아니오 |
| `scoreComposition` | `compositionScorer.ts` | `compositionRecompose.ts`(자동 재작곡 루프 전용); `Step4Result.tsx`(재작곡 지시문 복사 버튼용) | **아니오** — `importSongsJson` 자체는 `scoreComposition`을 호출하지 않습니다. 결과 블루프린트가 화면에 렌더될 때 `Step4Result.tsx`가 호출합니다(수동 검토용, v3.62 C안 설계) | **아니오** (로컬 경로도 `generateBlueprint`에서 `enableRecompose`가 꺼져 있으면 미호출) | 위와 동일 |
| `eraBucketForGenreId`/`ERA_FORBIDDEN_DESCRIPTORS` | `eraExclusions.ts` | `compositionScorer.ts`(탐지); `bridgeInstruction.ts`의 `eraGuardrailLines`/`eraLabelForSlot`(예방 — 지시문 텍스트 생성용, 탐지 아님) | 아니오(예방 문구 생성에만 사용, 탐지 호출 아님) | 아니오 | 아니오 |

**세 가지 구체 확인 사항**:
- `bridgeImport.ts`(구 `claudeCodeBridge.ts`)의 `importSongsJson`: `scoreSongs` **호출함** / `auditAlbum` **호출 안 함** / `scoreComposition` **호출 안 함**.
- `localGenerator.ts`의 `generateLocalBlueprint`: `scoreSongs` **호출함** / `auditAlbum` **호출 안 함** / `scoreComposition` **호출 안 함**.
- `providers/index.ts`의 `generateBlueprint`: `recomposeBlockingTracks`(→ `scoreComposition`)를 거치는 것과 별개로 `scoreSongs`를 직접 3번 호출 (로컬 분기 1회, 원격 분기 recompose 전후 2회) — 이것이 위 표의 "중복 실행" 항목.

**결론**: 새 검사는 만들지 않았고(스펙 지시대로), 기존 8종의 배선 상태만 확인했습니다. `scoreComposition`이 자동 재작곡 루프에 실제로 연결된 경로는 `providers/index.ts`의 `generateBlueprint`(`enableRecompose=true`일 때)뿐이며, 브릿지 import 경로(`importSongsJson`)는 자동 재작곡 루프를 타지 않고 `Step4Result.tsx`의 수동 "재작곡 지시문 복사" 버튼으로만 연결되어 있습니다 — 이는 v3.62 C안이 설계한 그대로이며(가져오기는 API 호출이 없으므로 자동 재시도가 불가능), 버그가 아니라 이미 문서화된 설계 제약입니다. `Step4Result.tsx`에서 `auditAlbum`과 `scoreComposition`을 같은 블루프린트에 둘 다 호출하는 것은 실제 성능 중복이지만, 렌더링 레이어의 문제이지 생성 파이프라인의 문제는 아니므로 이번 정리 범위(파이프라인 단일화) 밖으로 두고 발견 사실만 기록합니다.

---

## 5. `claudeCodeBridge.ts` 분할 결과 — 파일별 줄 수

| 파일 | 줄 수 | 내용 |
|---|---|---|
| `claudeCodeBridge.ts` (기존) | 1,207 (분할 전) | — |
| `claudeCodeBridge.ts` (분할 후) | **40** | 배럴(barrel) — 아래 3개 모듈을 그대로 재수출, 기존 23개 파일의 import 경로 전부 무변경 |
| `bridgeInstruction.ts` (신규) | 834 | 지시문 텍스트 생성 (`buildClaudeCodeInstruction`, 멀티셋 변형, `buildSetPlanHandoffSection`, ~20개 지시문 라인 헬퍼) |
| `bridgeImport.ts` (신규) | 357 | `songs-output.json` 파싱·정규화 (`importSongsJson`, JSON 관용 파싱, 훅 충돌 플래깅) |
| `bridgeRecompose.ts` (신규) | 41 | 재작곡 지시문 (`buildRecomposeInstruction`) |
| **합계** | 1,272 | (분할 전 1,207 대비 +65줄 — 각 파일의 독립적인 모듈 설명 주석 추가분) |

**정직한 공개**: 완료 판정표의 "`claudeCodeBridge.ts` ≤ 500줄" 기준은 이제 40줄로 크게 충족합니다. 다만 `bridgeInstruction.ts` 자체는 834줄로 여전히 상당히 큽니다 — 지시문 조립 로직(전용 SetPlan 핸드오프 테이블, 시대/BPM/보컬/구조/장면 프레임별 지시문 라인 헬퍼 ~20개)이 서로 강하게 얽혀 있어(단일-팩/멀티셋 두 진입점이 거의 같은 헬퍼 집합을 공유) 추가로 쪼개려면 그 결합을 풀어야 하는데, 이번 "정리" 범위에서 그 위험까지 감수하지 않았습니다. 스펙이 명시한 3-파일 분할(`bridgeInstruction`/`bridgeImport`/`bridgeRecompose`) 구조 자체는 정확히 그대로 구현했습니다.

`lyricEngine.ts`(1,659줄)는 스펙의 명시적 허가("자신이 없으면 건너뛰십시오")에 따라 이번 작업에서 건드리지 않았습니다 — v3.59/v3.60의 성과(자리표시자 0건, 편곡어휘 누출 0건)가 이 파일에 있고, 분할 시 로직이 미묘하게 바뀔 위험이 이번 정리의 이득보다 크다고 판단했습니다.

---

## 6. 슬롯·템포 계획 공유 여부 조사 결과 — BPM 3회 재발의 원인이 여기인지

**결론: 공유되고 있습니다. 원인이 아닙니다.**

`grep`으로 `preallocateSongSlots` 호출 지점을 전부 확인한 결과:
- `providers/index.ts:277` (로컬 경로가 아닌 원격 API 경로에서 호출 — 로컬 경로는 `generateLocalBlueprint` 내부에서 별도로 처리)
- `bridgeInstruction.ts:681` (구 `claudeCodeBridge.ts`, 브릿지 경로)
- `App.tsx:339, 405` / `hooks/useBatchGenerationFlow.ts:195` / `Step3Generate.tsx:323` / `setDirector.ts:464`

**모두 `core/batchPreallocation.ts`의 동일한 `preallocateSongSlots` 함수 하나를 호출합니다.** 별도로 복제된 구현이 없습니다. 즉 각 트랙의 BPM(`slot.tempo`)은 경로에 관계없이 정확히 같은 코드로 계산됩니다.

이는 v3.64 TASK C의 결론(app 자체 계획은 정상, stddev ~14)과 정확히 일치하며, 이번 조사로 "혹시 슬롯/템포 계획 자체가 두 경로에서 다르게 구현돼 있어서 재발하는 것 아닌가"라는 가능성을 **완전히 배제**합니다. BPM 3회 재발의 남은 유력한 원인은 (v3.64 TASK C가 이미 결론 내렸듯) 브릿지 지시문을 받는 원격 LLM 자체의 잔여 비순응(non-compliance)이며, 이는 앱 코드로 100% 강제할 수 없는 브릿지 방식 고유의 한계입니다.

---

## 7. 완료 판정표 (실측)

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| `npm run test:fast` 실행 시간 | ≤ 60초 | **약 4.4~4.9초** (50파일/529테스트) | PASS |
| `npm test` 실행 시간 | 측정치 기록 | **약 23~25초** (131파일/1473테스트) — 스펙의 "7~10분" 추정과 다름, 정직하게 공개 | 기록 완료 |
| `AGENTS.md` 테스트 규칙 명시 | 있음 | 있음 ("테스트 실행 규칙 (v3.66 TASK A)" 절) | PASS |
| 로컬 경로 "미리보기" UI 표시 | 있음 | 있음 (`Step4Result.tsx`, `blueprint.isLocalPreview` 조건부 배너) | PASS |
| `promptComposer`/`promptBudget` 지위 주석 | 있음 | 있음 (두 파일 상단에 각각 추가) | PASS |
| 슬롯·템포 계획을 두 경로가 공유 | 공유 | **공유 확인** (`batchPreallocation.ts`의 `preallocateSongSlots` 단일 함수, grep으로 모든 호출부 확인) | PASS |
| `claudeCodeBridge.ts` 최대 파일 크기 | ≤ 500줄 | **40줄** (배럴) — 단, 새로 만든 `bridgeInstruction.ts`는 834줄 | PASS (원 파일 기준) / 참고 (신규 파일 중 하나는 여전히 큼, 5절 참고) |
| 검사 호출 지점 표 | 작성됨 | 작성됨 (4절) | PASS |

### 회귀 방지 — 결과물 동일성 확인 (3절 참고)

| 항목 | v3.64 기준 유지 | 이번 작업 후 실측 | 판정 |
|---|---|---|---|
| 브릿지 지시문 전문 (18곡, 동일 입력) | 동일해야 함 | **바이트 단위로 동일** (2182/2182줄, 타임스탬프 제외) | PASS |
| 전체 테스트 스위트 | 통과 | 131/131 파일, 1473/1473 테스트 (TASK A/B/C 각 커밋 시점 모두) | PASS |
| 편곡 어휘 가사 누출 / 시대 모순 / 프롬프트 길이 / 서술어 수 등 v3.64 회귀 지표 | 유지 | 파이프라인 로직을 전혀 바꾸지 않았으므로 (순수 이동 + 순수 추가) 재측정 없이도 구조적으로 불변 — 위 지시문 바이트 동일성이 이를 직접 증명 | PASS |

---

## 8. 미구현 / 정직한 한계 공개

1. **`bridgeInstruction.ts`(834줄)는 여전히 크다.** 500줄 기준을 만족하는 건 배럴이 된 `claudeCodeBridge.ts`뿐이다. 지시문 조립 로직 자체를 더 쪼개려면(예: ~20개 인스트럭션-라인 헬퍼를 별도 파일로) 단일-팩/멀티셋 두 진입점이 공유하는 헬퍼 집합의 결합을 풀어야 하는데, 이번 패스에서는 하지 않았다.
2. **`Step4Result.tsx`의 `auditAlbum`+`scoreComposition` 중복 실행(4절)을 고치지 않았다.** 조사만 하고 수정하지 말라는 TASK D의 지시를 그대로 따랐다. 실제 성능 낭비이지만 생성 파이프라인이 아니라 렌더링 레이어의 문제이므로 이번 "파이프라인 단일화" 범위 밖으로 분류했다.
3. **`providers/index.ts`의 `scoreSongs` 중복 호출(로컬 분기 1회 재호출, 원격 분기 recompose 전후 2회)도 고치지 않았다.** 같은 이유 — 조사 전용 TASK D 범위.
4. **`lyricEngine.ts`(1,659줄)는 전혀 손대지 않았다.** 스펙이 명시적으로 허용한 스킵이다.
5. **`scoreComposition`이 브릿지 import 경로(`importSongsJson`) 자체에는 배선돼 있지 않다.** `Step4Result.tsx`의 수동 버튼으로만 연결된다 — v3.62 C안 설계 그대로이며 이번 작업에서 바꾸지 않았다(스펙이 "새 기능 추가 아님"이라고 명시했으므로).
6. **`npm test`의 실측 실행 시간(23~25초)이 스펙이 인용한 "7~10분"과 크게 다르다.** 어느 쪽이 더 널리 대표적인 환경인지는 알 수 없다 — 이 리포트는 이 머신에서의 실측치만 정직하게 보고한다.
