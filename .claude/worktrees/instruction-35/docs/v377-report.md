# v3.77 완료 보고 — 보컬·BPM 재발 근본 수정 (재발 방지 포함)

기준: v3.76(`0fe4525`) 위에서 진행.

변경/신규 파일:
- `src/core/vocalPlan.ts` — TASK A: `usesVocalQuota` 무조건 `true`, `leaningGenderFor`/`leaningAdultVocalQuota` 신규, `resolveVocalMetaTag` 순서 버그 수정, 4축 보컬 서술 시드 재설계
- `src/core/batchPreallocation.ts`, `src/core/localGenerator.ts` — TASK A 배선 (leaning quota 계산, `explicitUnrecognizedVocalTone` 가드), `averageTempo` 폴백 경고
- `src/data/audienceProfiles.ts` — TASK B: `tempoBandsForProfile`가 `undefined`를 반환하지 않도록 재작성, `generateTempoBands` 신규
- `src/utils/channelProfile.ts` — TASK C: `createDraftChannel`/`normalizeChannel`의 `archetype`↔`audience` 불일치 버그 수정
- `src/components/steps/Step1Channel.tsx` — TASK C: 라벨 문구 보강
- `src/core/constraints.ts` — TASK D-1: `EraConstraint.coPrimary`, `detectCompoundDecades`, `applyEraQuota`의 공동 주 시대 배분/상한 로직 신규
- `src/core/lyricVocabularyRepetition.ts` — TASK D-2: `WORD_BLOCKING_THRESHOLD`(30), `findBlockingVocabularyRepetition` 신규
- `src/core/compositionScorer.ts` — TASK A-5/B-4/D-2: 신규 blocking 검사 5종 (`vocalAndTempoStructureFindings`, 어휘 30회 blocking)
- `src/core/fullAudit.ts` — TASK E: `vocab_repeat_blocking` 감사 항목 신규
- `src/core/setDirector.ts`, `src/components/steps/Step2Plan.tsx` — **세션 중 추가 발견·수정**: 실제 UI 플로우에서 leaning이 도달하지 못하던 배선 문제 (아래 §6)
- 테스트: `tests/v377EraCompound.test.ts`(신규), `tests/channelProfileAudience.test.ts`(신규), `tests/compositionScorer.test.ts`(신규 describe 블록 9개), 기존 8개 테스트 파일의 leaning 관련 기대값 갱신

---

## 1. TASK A — 보컬 쿼터가 조건부로 꺼지던 버그

### 1-1. 원인과 수정

`core/vocalPlan.ts:usesVocalQuota`가 "명시적 `vocalTone`이 채널 기본값과 다르면 자동 쿼터를 끈다"는 조건을 갖고 있었습니다 — 사용자가 보컬 프리셋을 하나라도 고르면(가장 흔한 경우) 그 즉시 4축 다양성 로직 전체가 꺼지고 한 문장을 18곡에 그대로 복사하는 구조였습니다. 수정 후 `usesVocalQuota`는 항상 `true`를 반환하며, 대신 `leaningGenderFor`/`leaningAdultVocalQuota`가 요청된 성별로 쿼터를 **기울이기만** 합니다(비율 55%, 나머지 두 유형은 각각 최소 확보).

### 1-2. 실측 — leaning이 다양성을 지키는지 (스펙 §8-4, "핵심")

`generateLocalBlueprint(makeOptions({ songCount: 18, vocalTone: '따뜻한 중년 남성이 아닌 다른 male 프리셋(low-calm-male)' }))` 실측:

```
{ male: 10, female: 4, mixed: 4 }
```

스펙이 제시한 워크된 예시(18곡, male 선택 시 `{male:10, female:4, mixed:4}`)와 정확히 일치합니다. `female`/`mixed`(듀엣)이 각각 4곡씩 보장되며, 보컬 서술(register/delivery/timbre/proximity) 텍스트도 18곡 모두 서로 다릅니다(§1-3).

### 1-3. `resolveVocalMetaTag` 순서 버그 (leaning이 드러낸 2차 버그)

`vocalType==='mixed'`을 `gender==='duet'`보다 먼저 체크하고 있어, 성인(비-kids) 채널의 듀엣 곡이 `[children's choir]`로 잘못 태깅될 수 있었습니다. 이 버그는 v3.72부터 존재했지만, "명시적 vocalTone은 vocalType을 아예 안 만든다"는 구버전 동작 때문에 실제로는 한 번도 두 필드가 동시에 채워지지 않아 드러나지 않았습니다. leaning 도입으로 성인 듀엣 곡도 `vocalType==='mixed'`를 갖게 되면서 즉시 노출됐습니다(`tests/v341.test.ts`가 실제로 실패 → 수정 → 통과).

### 1-4. 회귀 없음 확인

`usesVocalQuota` 변경이 깨뜨린 테스트 8개(`lyricBodyFidelity`, `lyricEngine`, `vocalGenderEnforcement`, `claudeCodeBridge`, `kidsVocalPipeline`, `personaMode`, `v352ConceptDiversity`, `v341`)를 전부 확인·수정했습니다 — 전부 "vocalTone이 다르면 쿼터가 꺼진다"는 **구버전 버그를 스펙으로 착각한** 테스트였고, leaning 동작(다수 편향 + 최소 다양성 보장)을 검증하도록 다시 작성했습니다.

---

## 2. TASK B — `tempoBandsForProfile`가 `undefined`를 반환하던 버그

`data/audienceProfiles.ts:tempoBandsForProfile`가 `senior` 외 프로파일에서 `undefined`를 반환할 수 있었고, 호출부(`averageTempo`)는 이를 조용히 장르 평균 BPM으로 폴백해 전체 트랙이 거의 같은 BPM에 수렴했습니다. `generateTempoBands(floor, ceiling, count=4)`를 신규 추가해 모든 프로파일이 항상 4개 밴드를 반환하도록 재작성했고, 폴백 경로에는 `console.warn`을 추가해 "이 상황이 발생하면 안 됨"을 눈에 보이게 했습니다.

### 실측 — BPM 분산 (경고: `warm-mature-male` = 채널 기본값 케이스와, `low-calm-male` = 다른 프리셋 케이스 둘 다 측정)

`low-calm-male` 프리셋으로 18곡 생성(§1-2와 동일 세트):

```
BPM: [84, 82, 97, 86, 82, 100, 84, 95, 108, 110, 100, 112, 97, 95, 108, 63, 70, 62]
표준편차: 14.90
범위: 62~112 (폭 50)
```

`compositionScorer.ts`의 신규 blocking 하한(표준편차 <6, 폭 <25)을 여유 있게 통과합니다. `npm run audit`의 기존 `bpm_stddev`(≥8 권장) 항목도 확인했습니다 — 회귀 없음.

---

## 3. TASK C — `oldpoplounge` 채널의 `audience` 불일치

`utils/channelProfile.ts:createDraftChannel`(퀵 생성 플로우)이 `audience: 'allAges'`를 하드코딩하는 동안 `normalizeChannel`은 누락된 `archetype`을 독립적으로 `'senior-morning'`에 기본값 처리하고 있었습니다 — 퀵 생성으로 만든 채널은 `archetype:'senior-morning'` + `audience:'allAges'`라는 불일치 쌍을 갖게 되고, `'allAges'`는 `GENERAL_AUDIENCE_PROFILE`로 해석되어(TASK B 수정 전에는) BPM 붕괴로 이어질 수 있었습니다. `ARCHETYPE_DEFAULT_AUDIENCE` 테이블을 추가해 `audience`가 항상 이미 계산된 `archetype`에서 파생되도록 수정했고, `createDraftChannel`의 하드코딩을 제거했습니다. `tests/channelProfileAudience.test.ts`(신규, 5개) 통과.

---

## 4. TASK D-1 — "60~70년대" 복합 연대 파싱

### 원인

`extractEraConstraint`의 구 정규식은 "60~70년대"에서 물결표(`~`) 때문에 "60년"이 연속 부분 문자열로 등장하지 않아, `70년대`만 매칭하고 전체를 1970년대 단일 시대로 처리했습니다.

### 실측 (스펙 원문 시나리오: "60~70년대 향수가 느껴지는 올드팝")

수정 전(베이스라인 `0fe4525`, 동일 시드로 재현): 1970s 13곡, 없음 5곡, **1960s 0곡**.

수정 후(`detectCompoundDecades` + `applyEraQuota`의 공동 주 시대 배분):

```
1970s: 10곡 (56%)
1950s-60s: 8곡 (44%)
1980s: 0곡
```

두 시대 모두 40% 이상 확보. `applyEraQuota`에 발견된 2차 버그: 공동 주 시대 중 한쪽이 이미 전체를 채운 경우 다른 쪽으로 재분배할 "여유분"이 전혀 없었던 문제(다른 버킷은 트리밍되지만 주 시대 버킷끼리는 서로 트리밍하지 않았음)를 새 트림 단계로 수정. `tests/v377EraCompound.test.ts`(신규, 7개) 통과.

---

## 5. TASK D-2 — 어휘 반복 blocking 기준

`GENERIC_WORD_CAP`(12)/`CHANNEL_IDENTITY_WORD_CAP`(20)은 그대로 advisory로 유지하고, `WORD_BLOCKING_THRESHOLD = 30`을 신규 추가 — 30회 초과 단어는 `compositionScorer.scoreComposition`에서 **blocking**으로 승격됩니다. `npm run audit`에 `vocab_repeat_blocking` 항목을 추가해 실제로 어떤 단어가 이 기준을 넘는지 노출합니다.

### 실측

같은 "60~70년대" 세트: `quiet 48회, hour 44회, feel 41회, light 40회, evening 38회` — 5개 단어가 30회 기준을 초과, `npm run audit` 출력에 명시적으로 표시됩니다.

---

## 6. 세션 중 추가로 발견한 버그 — leaning이 실제 UI 플로우에 도달하지 못하던 배선 문제

TASK A를 스펙 §10 "결과물 검사에서 이 기능이 작동했는가를 직접 확인"에 따라 실제 앱 플로우(`Step2Concept` → `Step2Plan` → 생성)로 검증하는 과정에서 발견했습니다:

`Step2Plan.tsx`는 `directSetLocal`로 세트 계획(`plan.allocations`)을 미리 계산하고, 이 계획이 **`vocalType` 축을 항상 'manual' 6/6/6 균등 분배로** 채워 넣습니다(`core/setDirector.ts`의 `vocalCounts()` — vocalTone을 전혀 보지 않음). `core/diversityAllocation.ts:applyAxisAllocation`는 manual 배분이 항상 auto/leaning을 이깁니다 — 즉 **TASK A의 leaning 로직 자체는 정확했지만, 실제 "개념 확인 → 생성" 플로우에서는 이 manual 오버라이드에 가려 한 번도 도달하지 못했습니다.** 이 세션의 모든 leaning 검증(§1-2 포함)이 `diversityAllocations` 없이 `generateLocalBlueprint`/`preallocateSongSlots`를 직접 호출하는 방식이었기 때문에 여태 드러나지 않았습니다.

### 수정

`core/setDirector.ts`에 `resolveVocalCounts(channel, songCount, vocalTone)`를 추가해 `directSetLocal`의 일반(비-세그먼트) 경로가 만드는 manual `vocalType` 배분 자체를 leaning-aware하게 계산하도록 했습니다. `directSetLocal`에 선택적 6번째 인자 `vocalTone`을 추가(기존 호출부는 인자를 안 주면 그대로 구동작 유지 — 실제로 `setDirector.test.ts`/`setDirectorSegments.test.ts` 등 기존 테스트 전부 무수정 통과 확인), `Step2Plan.tsx`가 `opts.vocalTone`을 넘기도록 배선했습니다.

**범위 제한(정직하게 명시)**: 이 수정은 `directSetLocal`의 일반 경로만 다룹니다. 2개 이상 아티스트 참조나 "X 느낌이 나는 Y" 블렌드 힌트가 감지되는 `buildSetPlanFromIntent` 세그먼트 경로는 여전히 구버전 균등 분배를 씁니다 — 별도 후속 작업이 필요합니다.

### 실측 (수정 후)

```
directSetLocal(concept, channel, 18, history, [], 'low-calm-male 프리셋')
plan.allocations의 vocalType: { male: 10, female: 4, mixed: 4 }
plan.slots의 실제 resolved vocalType: { male: 10, female: 4, mixed: 4 }
```

vocalTone을 넘기지 않은 기존 호출(인자 생략)은 `{ male: 6, female: 6, mixed: 6 }`으로 완전히 동일 — 하위 호환 확인.

---

## 7. TASK A-5/B-4/D-2 — 재발 방지 blocking 검사 (스펙 §8-5, "핵심")

`compositionScorer.ts`에 5개 신규 blocking 검사를 추가했습니다: 보컬 서술 종류 <5, 같은 보컬 서술 4곡 이상, 보컬 타입 전체 1종류, BPM 표준편차 <6, BPM 범위 폭 <25. 여기에 TASK D-2의 어휘 30회 초과 blocking을 더해 총 6개.

**각 검사가 실제로 발동하는지 직접 재현해 증명했습니다**(`tests/compositionScorer.test.ts`, 신규 describe 블록, 9개 테스트):

| 재현한 실패 | 검사 발동 여부 |
|---|---|
| 6곡 전체가 동일 보컬 서술("male deep chest-register lead")로 수렴 | ✅ blocking |
| 하나의 보컬 서술이 4곡 이상에 등장(3곡 상한 초과) | ✅ blocking |
| 전체 팩의 `vocalType`이 "male" 한 종류뿐 | ✅ blocking |
| BPM이 [95,96,95,96,95,96]으로 거의 고정 (표준편차 붕괴) | ✅ blocking |
| BPM 범위가 [90..100]으로 폭 10에 불과 | ✅ blocking |
| 단어가 31회 반복 | ✅ blocking |
| 건강한 팩(BPM 78~108, 보컬 서술 6종 모두 다름) | ✅ 위 6개 검사 전부 미발동 (오탐 없음) |
| 단어가 25회 반복(12/20 advisory ~ 30 blocking 사이) | ✅ advisory만, blocking 안 됨 (경계 확인) |

의도적으로 각 버그를 재현했을 때 검사가 켜지고, 건강한 팩·경계값에서는 켜지지 않는다는 것을 실측으로 확인했습니다.

---

## 8. TASK E — `npm run audit`가 실제로 잡아내는지 검증

`npm run audit` (기본 컨셉, 회귀 0건, 통과 26건/미달 12건/미측정 9건, 총 47개 항목)와 `npx tsx scripts/audit.ts --concept "60~70년대 향수가 느껴지는 올드팝"` 둘 다 실행했습니다.

- 신규 `vocab_repeat_blocking` 항목이 30회 초과 단어를 명시적으로 나열합니다(§5 실측 참고).
- 기존 `bpm_stddev`(≥8), `vocal_desc_variety`(≥12) 항목이 여전히 정상 동작 — TASK B/A 회귀 없음.
- **회귀 0건** — `audit-baseline.json` 대비 이번 세션 코드 변경으로 인해 새로 실패하기 시작한 항목 없음(단, §9에서 별도 발견한 사전 존재 이슈 1건은 예외).

---

## 9. 정직성 노트 — 발견했지만 이 작업 범위 밖인 버그

`npm run audit --concept "60~70년대..."`를 돌리던 중, `여성 곡의 female 명시` 항목이 baseline 대비 100%→67%로 떨어지는 것을 발견했습니다. 조사 결과:

```
트랙 2, 14의 stylePrompt: "... smooth adult tenor lead, ... female full chest alto, ..."
```

`data/genreTraits.ts`/`genreLibrary/index.ts`의 일부 장르(예: `oldpop-soft-rock-am`)가 자체 `vocal: ['smooth adult tenor lead']` 서술을 갖고 있고, 이 장르 레벨 텍스트가 실제 배정된 성별과 무관하게 stylePrompt에 그대로 섞여 들어갑니다 — "tenor"(남성 코드 단어)와 vocalPlan이 넣은 "female ... alto"가 한 프롬프트 안에 공존해 `detectVocalGender`가 `null`을 반환합니다.

**이 버그는 이 세션의 변경 때문이 아닙니다** — 클린 베이스라인(`0fe4525`)에 동일 스크립트를 돌려 똑같은 현상(트랙 14, 동일한 "smooth adult tenor lead" 충돌)을 확인했습니다. era 쿼터 수정(§4)이 이 컨셉을 더 많은 oldpop 장르로 라우팅하면서 이전에는 덜 노출되던 기존 버그가 더 많이 보이게 된 것뿐입니다. v3.75 TASK C가 해결한 것은 "vocalPlan이 만드는 성별 단어 누락"이었고, 이번에 발견한 것은 "장르 데이터 자체가 갖고 있는 고정된 성별 단어와의 충돌"이라는 별개의 원인입니다. v3.77 범위 밖으로 두고 여기 명시적으로 남깁니다 — 후속 작업 후보.

---

## 10. 완료 판정

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| `usesVocalQuota` 무조건 true | 코드 확인 | `vocalPlan.ts:usesVocalQuota` 항상 `true` 반환 | ✅ PASS |
| leaning이 다양성 보존 | female/듀엣 각 ≥3곡 | 18곡 중 male 10 / female 4 / mixed 4 | ✅ PASS |
| 보컬 프리셋 UI 유지 | 제거 안 함 | `Step2Concept.tsx` 보컬 그리드 무수정 | ✅ PASS |
| `tempoBandsForProfile` undefined 반환 없음 | 코드 확인 | 모든 프로파일에서 4개 밴드 반환 | ✅ PASS |
| `averageTempo` 폴백 경고 | `console.warn` 존재 | `localGenerator.ts`에 추가 | ✅ PASS |
| `oldpoplounge` audience 불일치 조사·수정 | 완료 | `channelProfile.ts` 수정 + 신규 테스트 5개 | ✅ PASS |
| "60~70년대" 복합 연대 파싱 | 두 시대 각 ≥40% | 1950s-60s 44% / 1970s 56% | ✅ PASS |
| 어휘 20회 advisory / 30회 blocking | 코드+실측 | `WORD_BLOCKING_THRESHOLD=30`, 실측 5개 단어 blocking | ✅ PASS |
| 신규 blocking 검사 5종 실제 발동 확인 | 재현 테스트 | 9개 테스트 전부 통과(§7) | ✅ PASS |
| `npm run audit` 신규 이슈 반영 | 항목 추가 | `vocab_repeat_blocking` 추가 | ✅ PASS |
| 회귀 0건 (v3.75/v3.76 대비) | `npm run audit` | 0건 (§9의 사전 존재 이슈 제외) | ✅ PASS |
| 전체 테스트 스위트 | 전부 통과 | 161 파일 / 1877 테스트 전부 통과 | ✅ PASS |
| lyricEngine.ts 미수정 | git diff 확인 | 수정 없음 | ✅ PASS |
| 실제 UI 플로우에서 leaning 도달 확인 | 실측 | 미도달 발견 → `setDirector.ts` 배선 수정 → 도달 확인 | ✅ PASS (§6, 범위 밖 발견을 수정까지 완료) |

### 회귀 방지 목록 — 되돌리지 않았음 확인

- v3.75 제목/단어수/섹션수 개선: `lyric_word_count`/`section_count` 감사 항목, 이번 세션 회귀 없음(§8).
- v3.75 217단어 가사, 634자 프롬프트 수준: `promptLength.test.ts` 등 관련 테스트 전부 통과.
- v3.72 4축 보컬 다양성(register/delivery/timbre/proximity): `vocalPlan.test.ts` 34개 전부 통과, `AXIS_REPEAT_CAPS` 무수정.

---

## 11. 하지 말 것 — 준수 확인

- `vocalTone` 무시 안 함 — leaning 가중치로만 사용, §1-2/§6에서 실측.
- 보컬 프리셋 UI 제거 안 함.
- 비선택 성별 0곡 처리 안 함 — 최소 보장 로직(`minEach`) 확인, §1-2.
- `tempoBandsForProfile` 어떤 경로도 `undefined` 반환하지 않음.
- `averageTempo` 폴백 무음 처리 안 함 — `console.warn` 추가.
- v3.75 제목/단어수/섹션수 개선 되돌리지 않음(§10).
- 새 "조건부로만 켜지는" 기능 만들지 않음 — leaning은 항상 계산되고, 명시적 `opts.vocalQuota`만 이를 오버라이드(기존에 이미 있던, 문서화된 유일한 예외).
- `lyricEngine.ts`의 문장 생성 로직 미수정.

## 12. 미구현/범위 제한 목록 (명시)

1. `buildSetPlanFromIntent`의 세그먼트(2인 이상 아티스트 참조, "X 느낌 Y" 블렌드) 경로는 여전히 vocalTone-무관 균등 분배를 씁니다 — §6에서 발견한 배선 수정은 `directSetLocal`의 일반 경로만 커버합니다.
2. 장르 데이터 자체의 고정 성별 단어("tenor" 등)와 실제 배정된 보컬 성별의 충돌 — §9, 사전 존재 버그, 이번 범위 밖.
3. `vocab_repeat_blocking`/신규 blocking 검사는 `compositionScorer.ts`(재작곡 게이트)에만 연결되어 있고, `fullAudit.ts`는 진단 전용이라 blocking 여부와 무관하게 항상 실측치를 보여줍니다 — 의도된 설계(§7/§8)이며 미구현이 아닙니다.
