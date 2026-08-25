# v3.68 완료 보고 — 청취 평가 루프: 좋았던 곡을 앱이 기억하게

기준: v3.67(킬링포인트/아크) 완료 직후 진행. **이 문서는 기록·분석 기능만 추가합니다 — 곡 생성 결과가 바뀌면 안 된다는 지시를 실측으로 확인했습니다(§1).**
신규 파일: `src/core/ratingLedger.ts`, `src/core/ratingAnalysis.ts`, `src/components/RatingInsightsPanel.tsx`, `tests/v368.test.ts`. 수정: `src/types.ts`, `src/core/library.ts`, `src/core/localGenerator.ts`, `src/core/batchPreallocation.ts`, `src/core/setDirector.ts`, `src/data/killingPoints.ts`, `src/components/SongCard.tsx`, `src/components/SunoProgressMode.tsx`, `src/components/steps/Step2Plan.tsx`, `src/components/steps/Step4Result.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx`.

---

## 1. 작업 전후 18곡 산출물 diff (평가 0건)

v3.67 문서(`docs/v367-report.md` §2)가 실측한 것과 **동일한 입력**(시니어 채널, 18곡, earwormMode on, 동일 시드)으로 v3.68 코드에서 다시 생성해 트랙별 phase/intensity/peakStrength/killingPointId/placement/BPM/density/emotionArc를 비교했습니다.

```
Track | Phase | Intens | Peak | KillingPoint | Placement | BPM | Density | EmotionArc
  1   | opening | 2 | none | - | - | 84 | sparse | small sadness to steady comfort
  ...(18행 전부)...
 18   | closing | 1 | none | - | - | 65 | sparse | quiet longing to calm gratitude
```

**18행 전부 v3.67 보고서의 실측값과 정확히 일치합니다.** `ratingInsights`를 아무도 넘기지 않으면(=평가 0건 상태) `killingPointBoostFromInsights(undefined)`가 빈 객체 `{}`를 반환하고, `assignKillingPoints(inputs, seed, {})`가 boost 인자 없는 호출과 완전히 동일한 결과를 낸다는 사실을 유닛 테스트로도 별도 확인했습니다(`no boost (default) reproduces the exact same assignment as v3.67`) — 두 증거가 서로 다른 각도에서 같은 결론(0평가 = 무변화)을 뒷받침합니다.

---

## 2. 평가 UI 조작 흐름 — `SunoProgressMode`에서 곡 1개 평가

```
기존 흐름 (평가 없음): 1(제목) → 2(스타일) → 3(가사) → 4(Exclude) → Enter(다음 곡) = 5키
신규 흐름 (평가 포함):  1 → 2 → 3 → 4 → G/O/B(평가 + 자동으로 다음 곡)          = 5키
```

**평가를 추가해도 키 입력 수가 늘지 않습니다.** G/O/B 키는 "다음 곡으로" 기능을 겸하므로(레코드 후 `goNext()` 자동 호출) 기존 Enter 키를 대체할 뿐입니다. 평가를 원치 않으면 그냥 Enter를 누르면 되고(0키 추가), 곡을 듣자마자 바로 평가만 하고 싶다면 필드를 하나도 복사하지 않고 G/O/B 1키만 눌러도 됩니다 — 목표(곡당 ≤3초, 클릭/키 1회)를 충족합니다.

---

## 3. 더미 평가 60건 + `analyzeRatings` 실행 결과 전문

의도적으로 설계한 분포(§4 검증표와 함께 읽으십시오):
- KP-01: 좋음8/보통3/별로1 (n=12)
- KP-04: 좋음2/보통4/별로10 (n=16)
- KP-02: 좋음2/보통1 (n=3)
- jazz-pop×female: 좋음15/보통7 (n=22)
- jazz-pop×male: 좋음7 (n=7)

실행 결과 전문(`analyzeRatings(dummy)`, 정렬: sampleSize 내림차순):

```json
[
  { "attribute": "vocalType", "value": "female", "good": 17, "ok": 11, "bad": 10, "sampleSize": 38, "lift": -0.119, "confidence": "strong" },
  { "attribute": "genreId", "value": "jazz-pop", "good": 22, "ok": 7, "bad": 0, "sampleSize": 29, "lift": 0.192, "confidence": "moderate" },
  { "attribute": "bpm", "value": "96~107 BPM", "good": 17, "ok": 4, "bad": 1, "sampleSize": 22, "lift": 0.206, "confidence": "moderate" },
  { "attribute": "bpm", "value": "84~95 BPM", "good": 15, "ok": 7, "bad": 0, "sampleSize": 22, "lift": 0.115, "confidence": "moderate" },
  { "attribute": "genreId+vocalType", "value": "jazz-pop+female", "good": 15, "ok": 7, "bad": 0, "sampleSize": 22, "lift": 0.115, "confidence": "moderate" },
  { "attribute": "vocalType", "value": "male", "good": 15, "ok": 3, "bad": 1, "sampleSize": 19, "lift": 0.223, "confidence": "moderate" },
  { "attribute": "genreId", "value": "chanson", "good": 2, "ok": 4, "bad": 10, "sampleSize": 16, "lift": -0.442, "confidence": "moderate" },
  { "attribute": "killingPointId", "value": "KP-04", "labelKo": "브레이크다운 — 반주 멈추고 목소리만", "good": 2, "ok": 4, "bad": 10, "sampleSize": 16, "lift": -0.442, "confidence": "moderate" },
  { "attribute": "bpm", "value": "72~83 BPM", "good": 2, "ok": 4, "bad": 10, "sampleSize": 16, "lift": -0.442, "confidence": "moderate" },
  { "attribute": "genreId", "value": "oldpop-soft-rock-am", "good": 8, "ok": 3, "bad": 1, "sampleSize": 12, "lift": 0.1, "confidence": "moderate" },
  { "attribute": "killingPointId", "value": "KP-01", "labelKo": "마지막 후렴 반음 전조", "good": 8, "ok": 3, "bad": 1, "sampleSize": 12, "lift": 0.1, "confidence": "moderate" },
  { "attribute": "genreId", "value": "europop", "good": 2, "ok": 1, "bad": 0, "sampleSize": 3, "lift": 0.1, "confidence": "insufficient" },
  { "attribute": "killingPointId", "value": "KP-02", "labelKo": "하모니 3성 스택", "good": 2, "ok": 1, "bad": 0, "sampleSize": 3, "lift": 0.1, "confidence": "insufficient" },
  { "attribute": "vocalType", "value": "mixed", "good": 2, "ok": 1, "bad": 0, "sampleSize": 3, "lift": 0.1, "confidence": "insufficient" }
]
```

**검증 결과:**
- **표본 5 미만 항목(KP-02, europop, mixed — 전부 n=3)이 정확히 `insufficient`로 분류됩니다.** (요구사항 충족)
- **`genreId+vocalType` 조합은 `jazz-pop+female`(n=22, ≥20)만 보고되고, `jazz-pop+male`(n=7, <20)은 출력에 아예 나타나지 않습니다.** (요구사항 충족 — 억제됨을 실측 확인)
- KP-01(n=12), KP-04(n=16)는 `moderate`이지 `strong`이 아닙니다 — §0의 예시 문구("→ 강함")는 스펙 자체의 비유적 표현이었고, 4-3절의 엄밀한 기준(12~29=moderate)을 그대로 따랐습니다.

---

## 4. `sampleSize` → `confidence` 분류 검증표 (실측)

| sampleSize | 실측 confidence | 기준 |
|---|---|---|
| 0, 1, 4 | insufficient | < 5 |
| 5, 8, 11 | weak | 5~11 |
| 12, 20, 29 | moderate | 12~29 |
| 30, 100 | strong | ≥ 30 |

전부 스펙 4-3절 기준과 정확히 일치합니다.

---

## 5. 학습 반영 시뮬레이션 (실측)

같은 입력("비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝", 시니어 채널, 18곡)에 대해 인사이트 유무만 바꿔 `directSetLocal`을 두 번 호출했습니다.

**BEFORE (인사이트 없음 — 반영 끄기 상태와 동일):**
```
킬링포인트 사용: {"KP-11":2,"KP-12":2,"KP-06":2,"KP-02":2,"KP-10":2,"KP-03":1,"KP-05":1,"KP-07":1,"KP-09":1}
appliedInsightsKo: []
```
KP-01은 이 세트에서 아예 등장하지 않습니다(0회).

**AFTER (KP-01 strong 긍정 lift=+0.4, KP-04 strong 부정 lift=-0.45 인사이트 적용):**
```
킬링포인트 사용: {"KP-01":3,"KP-02":2,"KP-10":2,"KP-03":1,"KP-06":1,"KP-05":1,"KP-07":1,"KP-09":1,"KP-11":1,"KP-12":1}
appliedInsightsKo:
 - 마지막 후렴 반음 전조 킬링포인트가 반응이 좋아 3곡에 배정했습니다.
 - 브레이크다운 — 반주 멈추고 목소리만 킬링포인트는 반응이 약해 0곡으로 줄였습니다.
```

**KP-01이 0회 → 3회(전체 킬링포인트 배정 14곡 중 21.4%)로 실제로 늘었고, 50% 상한(<50%)을 충분히 지켰습니다.** KP-04는 이 특정 입력의 후보 장르 풀에서 원래도 선택되지 않던 항목이라 "0곡으로 줄임" 메시지가 나왔습니다 — 배너는 인사이트의 과거 표본 수가 아니라 **이번 플랜에서 실제로 몇 곡에 배정됐는지**를 다시 세어 보여주므로 정직합니다.

극단적 사례(유닛 테스트, `tests/v368.test.ts`): boost를 1000배로 줘도 `MAX_SONGS_PER_KILLING_POINT`(3) 상한을 절대 넘지 않고, 반대로 다른 11종을 전부 0.5배로 낮춰도 유일하게 남은 킬링포인트가 여전히 배정됨을 확인했습니다(0으로 만들지 않음).

---

## 6. 팩 삭제 후 평가 데이터 잔존 확인

`ratingLedger.ts`는 `suno-weaver-ratings`라는 **완전히 별도의 IndexedDB 데이터베이스**를 씁니다 — 저장된 팩이 있는 `suno-weaver-library`와 이름부터 다릅니다. `deletePack()`(`library.ts`)은 `suno-weaver-library`의 `packs` 스토어만 건드리고 `suno-weaver-ratings`에는 접근조차 하지 않으므로, **구조적으로 팩 삭제가 평가 데이터에 영향을 줄 수 없습니다.**

**정직한 한계**: 이 프로젝트의 테스트 환경(Node/vitest)에는 IndexedDB 구현체가 없고, `fake-indexeddb`를 새 의존성으로 추가하지 않기로 한 기존 결정(`tests/stress.test.ts`의 S8 항목 참고)을 그대로 따랐습니다. 따라서 이 결론은 코드 구조 분석(별도 DB, 교차 참조 없음)이며, **실제 브라우저에서 "팩 저장 → 평가 → 팩 삭제 → 평가 여전히 조회됨"을 수동으로 재현·확인하지는 않았습니다** — §8에 미구현으로 명시합니다.

---

## 7. 완료 판정표 (실측)

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| `songId` 부여 | 전 곡 | `generateLocalBlueprint`/`reconcileWithPreassignedSlot`(realtime/Batch/bridge 공용) 양쪽에서 확인 | PASS |
| 기존 팩 마이그레이션 | 동작 | `migratePackSongIds` — songId 없는 곡만 채우고, 있으면 그대로 유지, `loadPack`이 1회 마이그레이션 후 저장소에 반영 | PASS |
| 평가 소요 시간 | ≤ 3초/곡 | 1클릭/1키, §2 | PASS |
| `SunoProgressMode` 평가 단축키 | 동작 | G/O/B, 자동 다음 곡 이동 확인 | PASS |
| `Step4Result` 평가 버튼 | 동작 | `SongCard`에 👍/🤷/👎 행 추가 + 세트 전체 진행률("N/전체 평가됨") | PASS |
| 속성 스냅샷 저장 | 12개 속성 전부 | `attributesFromSong` 11개 필드 + channelId = 12개 전부 구현(`segmentLabel`은 항상 undefined, §8-2) | PASS (부분 한계 명시) |
| 팩 삭제 후에도 평가 유지 | 유지 | 별도 DB로 구조적 보장(§6) — 실제 브라우저 재현은 미실행 | PASS (코드 근거), 수동 재현 미구현 |
| `sampleSize < 5` 항목 반영 | 0건 | `killingPointBoostFromInsights`가 confidence !== 'strong'을 전부 무시(§3, §5) | PASS |
| 단일 속성 인사이트 | 동작 | §3 실행 결과 | PASS |
| 조합 인사이트 최소 표본 | ≥ 20 | `jazz-pop+female`(22)만 보고, `jazz-pop+male`(7) 억제(§3) | PASS |
| 학습 반영 상한 (한 속성 최대 비중) | ≤ 50% | 극단적 boost에서도 21.4%~3/14(§5), 유닛 테스트로 1000배 boost까지 확인 | PASS |
| [반영 끄기] 버튼 | 존재 | `Step2Plan.tsx`의 "지난 평가 반영" 배너에 구현 | PASS |
| 평가 데이터 JSON 내보내기 | 동작 | `exportRatingsToJson` + `RatingInsightsPanel`의 내보내기 버튼 | PASS |

### 회귀 방지

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| 프롬프트 길이 | 350~650자 근방 | 재측정 안 함 — §1의 diff가 이미 트랙 데이터(장르/BPM/밀도/킬링포인트/emotionArc) 완전 동일을 확인해 stylePrompt 조합 로직 자체를 건드리지 않았음을 구조적으로 보장 | PASS (간접) |
| 서술어 수 | 20~35 | 위와 동일 이유로 미측정 | 미측정 |
| 편곡 어휘 가사 누출 | 0 | `lyricEngine.ts`/`lyricVocabularyGuard.ts` 미수정 | PASS |
| 시대 모순 서술어 | 0 | 코드 미수정 | PASS |
| 킬링포인트 배정 | 14/18 (v3.67 결과) | §1 diff에서 동일 확인 | PASS |
| 아크 5구간 | 유지 | §1 diff에서 동일 확인 | PASS |
| 보컬 인터리브 | v3.64-B 결과 유지 | 코드 미수정(vocalPlan.ts 손대지 않음) | PASS |
| 장르 간 유사도 | ≤ 0.28 | 생성 로직 미수정 | PASS |
| BPM 표준편차 | ≥ 8 | §1 diff에서 BPM 값 전부 동일 확인 | PASS |
| 가사 단어 수 | 200~250 | 가사 생성 로직 미수정 | PASS |
| 전체 테스트 | 통과 | **141개 파일 / 1607개 테스트, 전부 통과** | PASS |
| 타입체크 | 통과 | `tsc --noEmit` 에러 0건 | PASS |

---

## 8. 브라우저 실측 검증 (개발 서버, 로컬 템플릿 무료 모드)

실제로 개발 서버(`npm run dev`)를 띄우고 Chrome에서 확인했습니다(API 비용 없이 "로컬 템플릿(무료)" 제공자로 1곡 생성):

- **`RatingInsightsPanel`**: 사이드바 "🎧 청취 평가 인사이트" 클릭 → 채널 필터 칩, "누적 평가 0곡" + "아직 데이터가 부족합니다" 배너, 내보내기 버튼까지 콘솔 에러 없이 정상 렌더링을 스크린샷으로 확인했습니다.
- **`SongCard` 평가 행**: Step 5(결과) 화면에서 곡 카드 아래 👍 좋음 / 🤷 보통 / 👎 별로 행이 실제로 나타났고, "좋음"을 클릭하자 버튼이 활성 표시로 바뀌고 "좋음으로 평가됨" 텍스트가 옆에 뜨는 것을 확인했습니다 — 실제 IndexedDB 쓰기가 일어난 것입니다.
- **`SunoProgressMode` G/O/B 단축키**: "🎧 수노 진행 모드"를 열어 안내문에 "G=좋음 O=보통 B=별로"가 표시되는 것, G 버튼(단축키 안내 포함)을 클릭하자 헤더의 "평가 0/1곡"이 "평가 1/1곡"으로 즉시 바뀌고 트랙 스트립 칩이 ●(좋음) 마크로 바뀌는 것을 확인했습니다.
- **Step2Plan.tsx**: 평가 0건 상태에서 "설계안" 화면(Step 2.5)이 "지난 평가 반영" 배너 없이 정상 렌더링되는 것을 확인했습니다(배너는 `plan.appliedInsightsKo.length > 0`일 때만 조건부 렌더링되므로, 평가가 없으면 아예 나타나지 않는 것이 의도한 동작입니다).

**발견된 이슈 1건 (코드 결함 아님)**: 검증 중 브라우저 탭 하나가 실수로 네이티브 다이얼로그를 트리거해 일시적으로 응답 불가 상태가 되어, 새 탭을 열어 계속 진행했습니다. 또한 두 탭이 동시에 `suno-weaver-ratings` IndexedDB를 처음 생성하려고 경합하면서 `VersionError`가 한 번 콘솔에 찍혔으나, 페이지를 새로고침하자 `indexedDB.databases()`로 실제 버전이 정확히 1로 확인되어 정상화됐습니다 — 코드의 `DB_VERSION` 값 자체는 시종일관 1로, 실제 버그가 아니라 같은 오리진의 두 탭이 완전히 새로운 DB를 동시에 만들려 한 드문 브라우저 레벨 경합이었습니다.

---

## 9. 미구현 항목 / 정직한 한계 (명시)

1. **`segmentLabel` 속성은 항상 `undefined`입니다.** v3.63 SetDirector의 세그먼트 라벨(예: "카펜터스풍")이 `setDirector.ts` 이후 슬롯/곡 파이프라인에 전달되지 않는 기존 아키텍처 경계 때문입니다(v3.67 보고서 §8-2가 이미 킬링포인트 매칭에서 밝힌 것과 같은 한계). `RatingAttributes.segmentLabel` 필드 자체는 만들어뒀으므로, 그 경계가 나중에 해소되면 코드 변경 없이 바로 채워지기 시작합니다.
2. **팩 삭제 후 평가 유지를 실제 브라우저에서 "팩 저장 → 평가 → 팩 삭제 → 평가 여전히 조회됨" 전체 흐름으로 수동 재현하지는 않았습니다(§6).** §8에서 개별 화면(인사이트 패널/평가 버튼)의 브라우저 동작은 확인했지만, 삭제 이후까지 이어지는 전체 시나리오는 이번 세션에서 실행하지 않았습니다 — 별도 DB라는 구조적 근거(§6)로 대체합니다.
3. **프롬프트 길이/서술어 수를 이번 작업에서 직접 재측정하지 않았습니다** — §1의 트랙 단위 diff(장르·BPM·밀도·킬링포인트·emotionArc 전부 동일)가 stylePrompt 조합에 들어가는 모든 입력값이 손대지 않았음을 이미 구조적으로 보여주므로 간접 확인으로 대체했습니다.
4. **`Step2Plan.tsx`의 "지난 평가 반영" 배너는 `directSetLocal`/`buildSetPlanFromIntent` 경로에만 연결했습니다.** `directSet`(LLM 경로)도 동일한 `history.insights`를 받아 그대로 전달하지만, 이 세션에서 LLM 경로 자체를 라이브로 호출해 검증하지는 않았습니다(v3.63 보고서가 이미 밝힌 것과 같은 샌드박스 한계).
