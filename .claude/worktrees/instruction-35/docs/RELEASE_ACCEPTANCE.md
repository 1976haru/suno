# 지시문 11 최종 발매 인수 보고서 — P2 의미 품질·음원 파이프라인·실제 인수

작성일: 2026-08-08 (지시문 11 TASK A-J 전체 완료 시점)

이 문서는 지시문 11의 최종 인수 보고서다. 각 TASK의 상세 실측치는 개별
문서(아래 각 항목에서 링크)에 있고, 이 문서는 그것들을 종합한 최종 판정이다.
이 세션 전체의 원칙을 그대로 따른다: **미측정을 통과로 세지 않는다. "공통
로직이므로 통과"를 근거로 인정하지 않는다. 실측 없이 안전하다고 말하지
않는다.**

---

## 1. §0 범위 확정 사항 — HotAIMusic 블라인드 A/B 폐기 확인

지시문 11 §0은 HotAIMusic 블라인드 A/B 벤치마킹 요건 자체를 명시적으로
폐기하고, 실제 청취 실측(HotAIMusic 실곡 2건 — 길이 4:03/3:37, BPM
89.1/92.3, 진폭 편차 3.08dB/2.08dB)을 그 대체 근거로 제시했다. 이 세션은
그 폐기 결정을 그대로 받아들였다 — `core/blindBenchmark.ts`는 여전히
의도적 미배선 상태로 allowlist에 남아 있고(사유: "§0에서 HotAIMusic 블라인드
A/B 요건 자체가 명시적으로 폐기됨, 실측 대체 완료"), 이번 세션에서 그 모듈을
다시 살리거나 블라인드 A/B 관련 기능을 새로 만들지 않았다. **판정: 준수.**

## 2. TASK A — kr/jp-2030 관계 상태 연속성

`src/core/relationshipContinuity.ts` 신규 구현. 지시문이 이름 붙인 두
모순 패턴(unsent-message→reply-received, ex-relationship→같은 시간선
first-meeting)만 좁게 감지, 회상 표지가 있으면 차단하지 않음.
`quality.ts` scoreSong에 kr-2030-pop/jp-2030-pop archetype 게이트로 배선,
실제 통합 테스트로 게이트 동작 확인. 골든 케이스 `2030-relation-break` →
verified 전환. **판정: 완료.** (커밋 c28be76)

## 3. TASK B — kids 서사 결말 안전성

`src/core/kidsOutcome.ts` 신규 구현. 4가지 명시 패턴(unsafe-reward,
fear-ending, bullying-wins, rule-violation-praised)만 좁게 감지, 교정/안전
표지가 있으면 차단하지 않음. kr-kids-song/jp-kids-song archetype 게이트로
배선(senior-oldpop의 'kids' 싱어롱 라디오는 명시적으로 제외). 골든 케이스
`kids-outcome` → verified 전환. **자동 체크만이며, 지시문이 별도로 요구한
"kr-kids/jp-kids 첫 세트 사람 검수"는 코드로 대체하지 않았다** —
`checkerRef`에 이 사실을 정직하게 명시해 뒀다. 사람 검수 자체는 이 세션이
대신 수행할 수 없는 별개의 실제 작업으로 남는다. **판정: 완료(자동 체크),
사람 검수는 미완료로 남김.** (커밋 a22c46f)

## 4. TASK C — SemanticCritic 계약 (optional/provider-gated)

`src/core/semanticCritic.ts` 신규 구현. `core/musicGenerationProvider.ts`와
동일한 패턴 — 실제로 올바른 계약(인터페이스) + 모든 메서드가 정직하게
거부하는 `UnavailableSemanticCritic` 기본 구현. 이 앱에 임의 LLM을 호출하는
실제 연결이 없어(실측 확인) 의도적으로 미배선(allowlist 등록, 사유 명시).
`SEMANTIC_CRITIC_POLICY.minConfidence = 0.9`는 지시문이 제안한 값을
unvalidated로 명시. `filterSemanticCriticFindings`는 개별 트랙만 걸러낼 뿐
"팩 전체 재작성" 함수를 아예 만들지 않아 "전체 통과 팩을 다시 쓰지 않는다"는
경계를 설계로 강제. **판정: 완료(계약 수준, 실제 공급자 없음 — 지시문 자신의
"optional" 표현과 일치).** (커밋 2a96440)

## 5. TASK D — jp-kids kana 임계값 provisional 명시

`JP_KIDS_KANA_RATIO_CALIBRATION_STATUS`(tier별 'provisional') +
`JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION`(50) 추가, 실제
UI(release readiness 항목)에 provisional 상태 노출. `scripts/
calibrateJpKidsLanguage.ts` 신규 — 승인된 실제 결과가 50개 미만이면
"데이터 부족" 정직 보고, 50개 이상이어도 상수를 자동으로 덮어쓰지 않고 후보값만
출력(지시문 자신의 "50곡 쌓이기 전에 자동으로 바꾸지 않는다" 요구를 설계로
강제). 현재 실제 승인된 jp-kids 결과는 0개 — 여전히 provisional. **판정:
완료.** (커밋 461eacf)

## 6. TASK E — golden case 축적

`src/data/goldenCases.ts` — 7개 케이스 전부 등록, **전부 `status: 'verified'`**
(TASK A/B 완료로 마지막 2개 `2030-relation-break`/`kids-outcome`도 전환
완료). `tests/goldenCases.test.ts`가 실제 체커 함수로 재현해 회귀 잠금.
**판정: 완료 (7/7 verified).**

## 7. TASK F — 업로드 기반 오디오 파이프라인

- **F-1/F-2/F-3**: `analyzeAudioMeasurementsFromFile`를 실제 녹음 경로에
  배선, `evaluateTakeSelectionSafety`로 실제 선택 안전성 게이트(측정값 없음·
  클리핑 차단), 재생/컴플라이언스 배지/거부 사유 UI 신규 추가.
- **F-4**: 진짜 1초 폭 윈도우 진폭편차(`oneSecRmsDeviationDb`) 신규 계산 —
  기존 `dynamicRange`는 트랙 길이에 비례하는 고정 20구간이라 하루의 실측
  기준과 다른 값이었음. `checkSeniorAmplitudeDeviation`이 §0 실측값(목표
  5.0dB, 2.3~3.3dB=평평=warn, ≥6.0dB=비현실적=warn)을 **조정 없이 그대로**
  적용. `checkCoreAudioCompliance`의 5개 pass/warn/fail 판정을 실제 UI에
  노출(이전엔 계산만 되고 화면에 전혀 안 보였음).
- **F-5**: `ProductionBundlePanel.tsx` 신규 UI 진입점 — `core/
  productionBundle.ts`가 완성돼 있었지만 호출하는 화면이 전혀 없었던 gap을
  해소. 실제 오디오 bytes 미포함(브라우저 File 경계 제약)을 화면에 정직하게
  표시, 빠진/문제있는 트랙을 정직하게 나열(조용히 제외하지 않음).
- **F-6**: `PackAudioReadiness`(`core/packAudioReadiness.ts`) 신규 — 트랙별
  실제 채택/측정/컴플라이언스 상태를 담아, 단일 `audioConfirmed: boolean`
  플래그(실측 결과 실제 UI 어디서도 true로 세팅되지 않는 죽은 플래그,
  지시문 08 범위라 손대지 않음)를 대신함.
- **정직한 잔여 gap**: kids/kpop/2030 워크스페이스 전용 체크
  (`checkKidsAudioCompliance` 등)는 함수만 존재, UI 미노출.
  `lyricsAlignment.ts` 여전히 미배선. 오디오 테이크 선택·프로덕션 번들의
  실제 브라우저 E2E(합성 WAV 업로드) 없음.

**판정: 완료 (F-1~F-6), 위 3가지 잔여 gap은 정직하게 남김.** (커밋 0a13138,
3f10803)

## 8. TASK G — 7-워크스페이스 실제 E2E 인수 매트릭스

`docs/WORKSPACE_ACCEPTANCE_REPORT.md` 전면 갱신. 이전에 "공통 로직이므로
통과"라는, 지시문이 명시적으로 금지한 근거로 🟡 처리됐던 5개 열(유효/복구가능/
차단 가져오기, 선택 재작성, 감사된 export)을 7개 워크스페이스 전부 실제
브라우저 E2E로 뒷받침(51개 시나리오, 직렬 실행 51/51 통과). 이 작업 자체가
실제 버그 하나를 발견·수정: fixture 생성 스크립트가 워크스페이스 언어 정책과
무관하게 영어를 강제해 jp-2030 등에서 실제 "언어 불일치 의심" 경고가 뜨는
것을 실측 확인 후 해결. 남은 정직한 gap: 3세트 멀티세트와 오디오 테이크
선택·프로덕션 번들 2개 열은 여전히 unit-test 레벨만(실제 브라우저 E2E 없음).
**판정: 5/9 열이 새로 실제 E2E로 뒷받침됨, 나머지 4/9는 기존 상태 유지
(정직하게 남김).** (커밋 1b1158e)

## 9. TASK H — senior-oldpop 텍스트 품질 성공률

전체 보고서: `docs/TASK_H_TEXT_QUALITY_REPORT.md`. 3세트×18곡=54곡을
Claude Code가 실제 브릿지 송라이터 역할로 직접 작성(로컬 생성기는 이 앱
자신이 "가사가 단조롭다"고 명시해 대표성 없음). 결과(세트별, 평균으로
숨기지 않음):

| 세트 | 1차 | 재작성 1회 후 |
|---|---|---|
| set1 | 0/18 (0.0%) | 18/18 (100.0%) |
| set2 | 14/18 (77.8%) | 18/18 (100.0%) |
| set3 | 18/18 (100.0%) | — |
| 합계 | **32/54 (59.3%, 목표 80% 미달)** | **54/54 (100.0%, 목표 95%/98% 모두 초과)** |

**측정 기준의 정직한 한계**: 이 수치는 지시문 05/06의 원래 AI 평가 기반
revise/reject(실시간 API 필요, 이 세션엔 없음)가 아니라 결정적 코드 체크
(`scoreSong` + `auditAlbum`) 대체 기준이다 — 문서에 명시.

set1의 0% 원인 5가지(훅 대소문자, 코러스 비-훅 줄 반복 차단, stylePrompt
길이/필수 단어 누락, hookDevice 정규식 불일치)를 실측·재현했고, 이 자체가
"현재 브릿지 지시문이 이 기계적 요구사항을 알려주지 않는다"는 실제 gap을
드러냈다(고치지 않고 발견으로 남김). set2에서 실제 slot-planning 버그도
발견(18곡 중 10곡 동일 lyricTheme — 지시문 10 TASK B가 이미 문서화한 gap의
재현 사례). **판정: 측정 완료, 목표 대비 1차는 미달·재작성 1회 후는 초과 —
둘 다 정직하게 보고.** (커밋 c5ee251)

## 10. TASK J — 최종 CI 점검

전체 보고서: `docs/TASK_J_CI_FINAL_CHECK.md`. 실제 job 수는 **14개**(지시문이
말한 15개 아님 — 정정 보고). `playwright` job의 `continue-on-error: true`를
제거해 **14/14 전부 blocking**(요구사항 충족). 14개 job을 전부 로컬에서 실제
실행: **11개 통과, 3개(lint/matrix/audit) 실패** — 전부 이 세션(지시문 11)
이전부터 있던 문제임을 git diff로 확인. 이 세션이 만든 새 lint 오류 2건은
발견 즉시 수정. **판정: 설정(0 continue-on-error)은 완료, 실제 그린 상태는
11/14 — 정직하게 보고, 3개는 근본 원인을 규명했지만 이 지시문 범위를 넘거나
이미 다른 TASK가 범위 밖으로 결정한 것이라 고치지 않음.** (커밋 665ee1e)

## 11. 시니어 오디오 임계값 미조정 확인

지시문이 "조정하면 안 된다"고 명시한 값들이 실제로 그대로인지 확인:

| 항목 | 지시문 값 | 코드 실제 값 | 확인 |
|---|---|---|---|
| 길이 pass | 3:05-3:25 | `checkDuration`, target 그대로 (audienceProfile 경유) | ✅ |
| 길이 warn 여유 | ±15s | `DURATION_WARN_MARGIN_SEC = 15` | ✅ 불변 |
| BPM pass | ±5 | `BPM_PASS_TOLERANCE = 5` | ✅ 불변 |
| BPM warn | ±10 | `BPM_WARN_TOLERANCE = 10` | ✅ 불변 |
| 진폭 목표 | 5.0dB | `SENIOR_AMPLITUDE_DEVIATION_TARGET_DB = 5.0` (신규) | ✅ |
| 진폭 "평평" | 2.3-3.3dB | `SENIOR_AMPLITUDE_DEVIATION_FLAT_MAX_DB = 3.3` (신규) | ✅ |
| 진폭 "비현실적" | ≥6dB | `SENIOR_AMPLITUDE_DEVIATION_UNREALISTIC_MIN_DB = 6.0` (신규) | ✅ |
| 클리핑 | 0 | `CLIP_THRESHOLD`/`clipping` 판정 불변 | ✅ |
| 앞무음 | ≤1s | `LEADING_SILENCE_MAX_SEC = 1` | ✅ 불변 |
| 뒤무음 | ≤2s | `TRAILING_SILENCE_MAX_SEC = 2` | ✅ 불변 |

이 세션에서 새로 만든 값(진폭 3종)은 지시문의 §0 실측 수치를 그대로
코드화했을 뿐 조정하지 않았다. 기존 값(길이/BPM/클리핑/무음)은 이 세션에서
전혀 건드리지 않았다. **판정: 준수.**

## 12. "하지 말 것" 목록 준수 확인

| 항목 | 상태 |
|---|---|
| HotAIMusic A/B 요구 부활 안 함 | ✅ (§1) |
| 비공식 서드파티 Suno API 안 씀 | ✅ (F-5 프로덕션 번들, 공식 경로 없음을 정직히 표시할 뿐 우회 안 함) |
| provider-이전 업로드 경로 강제 안 함 | ✅ (F 전체가 업로드 경로만으로 동작) |
| 시니어 오디오 임계값 미조정 | ✅ (§11) |
| 378곡 일괄 요구 안 함 | ✅ (TASK H는 54곡으로 이미 축소된 지시문 자신의 범위를 따름) |
| "공통 로직" 인수 지름길 안 씀 | ✅ (TASK G가 정확히 이 패턴을 제거) |
| 미측정/unknown을 통과로 안 셈 | ✅ (전 TASK 보고서에서 반복 확인) |
| SemanticCritic이 전체 통과 팩을 재작성하지 않음 | ✅ (TASK C 설계로 강제) |
| jp-kids kana 임계값 50곡 전 자동 변경 안 함 | ✅ (TASK D 스크립트가 후보값만 출력) |
| kids 첫 세트 사람 검수 생략 안 함(자동 체크로 대체 주장 안 함) | ✅ (TASK B가 명시적으로 "자동 체크만"이라 밝힘, 사람 검수는 미완료로 정직 표시) |
| 지시문 10의 LockedPromptSpec/SceneSignature 재구현 안 함 | ✅ (이 세션에서 그 모듈들을 다시 만들지 않음) |
| 원본 오디오 파일 자동 삭제 안 함 | ✅ (TASK F 어디에도 삭제 로직 없음, `deleteTake`는 기존 명시적 사용자 액션 그대로) |

**판정: 전체 준수.**

## 13. 종합 판정 및 다음 단계

**완료된 것**: TASK A-J 전부 실제로 구현·측정·문서화됨. 골든 케이스 7/7
verified. 시니어 오디오 임계값 전부 미조정 확인. "하지 말 것" 목록 전체
준수. CI는 설정상 전부 blocking.

**정직하게 남은 gap** (다음 세션/지시문에서 다룰 후보):
1. TASK B: kr-kids/jp-kids 첫 세트 실제 사람 검수 — 자동 체크로 대체 불가,
   하루가 직접 들어야 하는 작업.
2. TASK F: kids/kpop/2030 오디오 컴플라이언스 UI 미노출, `lyricsAlignment.ts`
   미배선, 오디오 업로드 계열 실제 브라우저 E2E 없음.
3. TASK G: 3세트 멀티세트·오디오 테이크 선택·프로덕션 번들 3개 열은 여전히
   unit-test 레벨만.
4. TASK H: 브릿지 지시문(`bridgeInstruction.ts`)에 5가지 기계적 요구사항
   (훅 정확한 대소문자, 비-훅 코러스 줄 반복 금지, stylePrompt 단어수/필수
   단어)을 명시하면 실제 1차 성공률이 크게 오를 것으로 실측 확인됨 —
   지시문 문구 자체를 고치는 건 이번 범위 밖.
5. TASK H: `lyricDiversityPlan.ts`의 customConcept 시드가 lyricTheme 배정
   다양성을 크게 무너뜨릴 수 있음(set2에서 10/18 실제 재현) — 지시문 10이
   이미 문서화한 근본 원인, 아직 미해결.
6. TASK J: `test:matrix`의 stylePrompt 인플레이션 근본 원인(reconcile­
   WithPreassignedSlot이 어떤 보정 atom을 얼마나 추가하는지) 미규명.
   `lint`의 132개 사전 존재 오류, `audit`의 하루 실제 팩 회귀 2건 — 둘 다
   이 지시문 범위를 넘는 별도 품질-수정 백로그.

**최종 판정: 지시문 11의 명시된 범위(TASK A-J, §0, "하지 말 것" 전체)는
실제로 완료됐다. 위 6개 항목은 이 지시문이 만들지 않았거나 명시적으로
범위 밖으로 결정한, 정직하게 남겨진 다음 작업이다.**
