# v3.72 완료 보고 — 보컬 계획 복구와 보컬 다양성 심화

기준: v3.71(`3e75cf5`) 이후, 기준 커밋 `5e4813a` 위에서 진행.

변경 파일:
- `src/core/vocalPlan.ts` (핵심), `src/data/vocalTraits.ts` (신규), `src/core/vocalComboLedger.ts` (신규)
- `src/core/batchPreallocation.ts`, `src/core/localGenerator.ts`, `src/core/bridgeInstruction.ts`, `src/providers/index.ts`, `src/core/library.ts`
- `src/components/steps/Step1Channel.tsx`, `src/components/steps/Step2Plan.tsx`
- `src/types.ts`
- 테스트: `tests/vocalPlan.test.ts`(대폭 추가), `tests/vocalComboLedger.test.ts`(신규), `tests/vocalGenderEnforcement.test.ts`, `tests/lyricBodyFidelity.test.ts`, `tests/lyricEngine.test.ts`, `tests/claudeCodeBridge.test.ts` (모두 기존 회귀 커버리지 유지 목적 수정)

---

## 1. TASK A — 보컬 계획이 꺼지는 조건 수정

### 1-1. 원인

`usesVocalQuota(opts)`가 `kids` 아키타입이거나 8축에서 `vocalType`을 수동 설정했을 때만 `true`였습니다. 8축을 건드리지 않은 일반 채널은 `false` → `vocalPlan = null` → `vocalText = fallbackVocalText`(=`opts.vocalTone?.trim() || channel.defaultVocal`)가 18곡 전부에 그대로 들어갔습니다.

### 1-2. 수정 — 조건부 기본 활성화 (스펙의 "더 안전한" 옵션을 채택)

스펙은 두 가지 안을 제시했습니다: ① 무조건 `true` ② 명시적으로 끈 경우만 예외. **②를 선택했습니다.** 이유: 이 채널에는 이미 실제 사용 중인 기능이 있습니다 — Step2Concept.tsx의 "어떤 목소리로 부를까요?" 프리셋 그리드로 사용자가 듀엣 프리셋 등 **단일 보컬을 명시적으로 선택**하면 `vocalTone`이 채널 `defaultVocal`과 달라집니다. ①을 그대로 적용하면 이 명시적 선택이 자동 6/6/6 쿼터에 희석되어 버립니다(실제로 v3.71까지의 테스트 픽스처 다수가 이 경로로 깨졌습니다 — §4 참고).

```ts
export function usesVocalQuota(opts): boolean {
  if (opts.channel.archetype === 'kids' || isManualAllocation(opts.diversityAllocations, 'vocalType')) return true;
  const explicitVocalTone = opts.vocalTone?.trim();
  if (explicitVocalTone && explicitVocalTone !== opts.channel.defaultVocal) return false; // 명시적 단일 보컬 선택 — 그대로 유지
  return true; // 건드리지 않은 기본값(실제 회귀 시나리오) — 자동 쿼터 작동
}
```

`App.tsx`가 채널 선택 시 `vocalTone: channel.defaultVocal`로 초기화하므로, **"건드리지 않음"과 "vocalTone === defaultVocal"은 실제로 같은 상태**입니다 — 실제 회귀 팩(18/0/0)이 정확히 이 경로였습니다.

`DEFAULT_ADULT_VOCAL_QUOTA = { male: 6, female: 6, mixed: 6 }` 신설(키즈용과 숫자는 같으나 의미가 다름 — `mixed`가 합창이 아니라 듀엣). `songCount`가 18이 아니어도 `scaleVocalQuota`가 비율을 유지합니다(기존 로직 재사용, 회귀 없음).

`buildVocalPlan`도 함께 강화: 기존 "4연속 금지"(3연속 허용)를 `maxConsecutive` 파라미터화하고 기본값을 **2**로 낮췄습니다(수동 배분 경로의 `spreadPlanByCounts`가 이미 쓰던 값과 통일).

### 1-3. 실측 — 8축 미설정 상태, 18곡

```
보컬 타입 순서: F F M D M D M F M D D F D F D M M F
같은 타입 최대 연속: 2
```

남6/여6/듀6 정확히 배분, 교차 배치 확인 (`tests/vocalPlan.test.ts`, 여러 시드).

---

## 2. TASK B — 보컬 사전 심화 (4축 분해)

### 2-1. 신규 데이터 — `src/data/vocalTraits.ts`

남성/여성 각 `register`·`delivery`·`timbre` 7종 + 공유 `proximity` 4종. 듀엣은 `pairing` 7종 + `blend` 4종. 모든 항목 3단어(듀엣은 4단어) 이내로 제한 — 조합 시 최대 12단어를 넘지 않도록 설계 단계에서부터 강제.

### 2-2. 선택 엔진 — `src/core/vocalPlan.ts`의 `buildAdultVocalTraitPlan`

- 축마다 결정론적(seed) 선택, 반복 상한: register 2 / timbre 2 / delivery 3 / proximity 3
- **성별 간 교차 누출 처리**: `delivery`(7종 중 4종 동일 문구)와 `proximity`(4종 전부 동일 풀)는 남/여 두 호출에 걸쳐 사용량을 **공유**시켰습니다 — 처음엔 성별마다 독립 카운터를 썼는데, 실측에서 `soft plate ambience`가 남성 2회+여성 2회로 팩 전체 4회 등장(상한 3 위반)함을 발견해 수정했습니다.
- 모순 조합 배제 목록(예: `deep chest-register lead` + `airy breath-forward tone`) — 타임브르 선택 시 이미 정해진 레지스터와 대조해 후보에서 제외.
- 시니어 청취자 제약: `bright tenor lead`/`light high tenor`(남), `bright soprano lead`(여)는 그 트랙의 킬링포인트가 `comfortable mid vocal register`를 완화할 때만 등장 — 나머지 3축(delivery/timbre/proximity)은 시니어 여부와 무관하게 항상 전체 풀 사용.
- 듀엣 텍스트는 항상 `"..., male and female duet"`로 끝나 `isDuetSlot`/`compositionScorer.ts`의 문자열 신호와 계속 호환.

### 2-3. 실측 — 18곡 전문 (건드리지 않은 기본 상태, 실제 회귀 시나리오)

```
T01  clear mezzo lead, conversational unhurried phrasing, soft breathy grain, intimate close-mic  [11 words]
T02  soft head-voice lead, tender confiding delivery, faint vibrato shimmer, soft plate ambience  [12 words]
T03  mid baritone-tenor lead, clipped rhythmic phrasing, clean rounded tone, soft plate ambience  [12 words]
T04  call and answer, close third harmony, male and female duet  [10 words]
T05  deep chest-register lead, conversational unhurried phrasing, soft husky grain, warm natural room  [12 words]
T06  trading lines mid-phrase, tight unison, light detune, male and female duet  [11 words]
T07  mid baritone-tenor lead, earnest forward delivery, slight nasal brightness, soft plate ambience  [12 words]
T08  clear mezzo lead, gentle swung phrasing, velvety low resonance, warm natural room  [12 words]
T09  low warm baritone, conversational unhurried phrasing, soft husky grain, dry and forward  [12 words]
T10  narration answered wordlessly, loose lines meeting hook, male and female duet  [11 words]
T11  alternating verses, joined chorus, close third harmony, male and female duet  [11 words]
T12  soft head-voice lead, bright forward delivery, warm rounded midrange, dry and forward  [12 words]
T13  female lead, male harmony, loose lines meeting hook, male and female duet  [12 words]
T14  narrow intimate lead, tender confiding delivery, slight smoky depth, intimate close-mic  [11 words]
T15  male lead, female harmony, tight unison, light detune, male and female duet  [12 words]
T16  relaxed mid-range lead, gentle swung phrasing, airy breath-forward tone, intimate close-mic  [11 words]
T17  low warm baritone, legato sustained lines, clean rounded tone, dry and forward  [12 words]
T18  full chest alto, gentle swung phrasing, clear glassy brightness, warm natural room  [12 words]
```

**18줄을 직접 읽어 확인**: 서로 다른 레지스터/창법/질감 조합으로 실제로 다르게 읽힙니다. 이전 실측(1/18, "mature soulful male tenor..." 반복)과 대비됩니다.

### 2-4. 축별 분포표

| 축 | 분포 | 최대 |
| --- | --- | --- |
| register | clear mezzo lead 2 · soft head-voice lead 2 · mid baritone-tenor lead 2 · low warm baritone 2 · deep chest-register lead 1 · narrow intimate lead 1 · relaxed mid-range lead 1 · full chest alto 1 | **2** (목표 ≤2 ✅) |
| delivery | conversational unhurried phrasing 3 · gentle swung phrasing 3 · tender confiding delivery 2 · clipped rhythmic phrasing 1 · earnest forward delivery 1 · bright forward delivery 1 · legato sustained lines 1 | **3** (목표 ≤3 ✅) |
| timbre | soft husky grain 2 · clean rounded tone 2 · soft breathy grain 1 · faint vibrato shimmer 1 · slight nasal brightness 1 · velvety low resonance 1 · warm rounded midrange 1 · slight smoky depth 1 · airy breath-forward tone 1 · clear glassy brightness 1 | **2** (목표 ≤2 ✅) |
| proximity | intimate close-mic 3 · soft plate ambience 3 · warm natural room 3 · dry and forward 3 | **3** (성별 간 공유 카운터 적용 후) |

### 2-5. 보컬 타입 순서

```
F F M D M D M F M D D F D F D M M F
```
같은 타입 최대 연속 2 — PASS.

### 2-6. 모순 조합 검사

18곡 전부에서 register/timbre 모순 조합 **0건**. `>12단어` 위반 **0건**.

---

## 3. TASK C — `defaultVocal`의 역할 재정의

`defaultVocal`은 더 이상 모든 곡의 보컬 텍스트를 덮어쓰지 않습니다. `channelFlavorWeight()`가 `defaultVocal`의 단어와 겹치는 축 후보에 가중치(1+겹침수)를 부여해 축 선택을 살짝 편향시킵니다 — 강제 아님(캡이 항상 우선). 실측: `defaultVocal`에 "husky"가 있으면 timbre 선택에서 `soft husky grain`이 뜰 확률이 오르지만, `AXIS_REPEAT_CAPS.timbre`(2)는 그대로 유지됨을 테스트로 확인.

UI 라벨 변경: `Step1Channel.tsx`의 채널 편집 폼 — "Default vocal (기본 보컬 톤)" → **"Channel vocal character (이 채널 보컬 성향)"**.

---

## 4. TASK D — UI에 보컬 배분 노출

### 4-1. 문제

`Step2Plan.tsx`(Step 2.5)의 기존 "보컬" 스탯 카드는 **수동** `diversityAllocations`만 읽어, TASK A로 자동 쿼터가 기본이 된 뒤에도 계속 "-"만 표시했습니다 — 사용자가 다양성이 실제로 적용됐는지 확인할 방법이 UI에 없었습니다.

### 4-2. 수정

`summarizeVocalTraitDistribution(slots)` 신설(`vocalPlan.ts`) — 실제 해석된 `plan.slots`(자동/수동 무관)에서 쿼터 + register/delivery/timbre 분포를 계산. `Step2Plan.tsx`에 "보컬 배분" 블록 신설, 스펙의 목업과 동일한 형태로 렌더링.

### 4-3. 실제 UI 검증 (개발 서버, 이중클릭으로 직접 확인)

시니어 채널, 보컬 프리셋을 건드리지 않은 상태로 Step 2.5까지 실제로 진행해 확인:

```
보컬 배분                                    [조정]
남성 솔로 6곡  여성 솔로 6곡  듀엣 6곡

음역   deep chest-register lead 2 · soft head-voice lead 2 · mid baritone-tenor lead 2 ·
       full chest alto 1 · narrow crooner tone 1 · mid clear alto 1 ·
       low warm baritone 1 · narrow intimate lead 1 · clear mezzo lead 1
창법   restrained understated reading 3 · legato sustained lines 3 · earnest forward delivery 2 ·
       gentle swung phrasing 1 · light rhythmic phrasing 1 · bright forward delivery 1 ·
       tender confiding delivery 1
질감   soft husky grain 2 · smoky low resonance 2 · faint vibrato shimmer 1 ·
       clean bell tone 1 · warm rounded midrange 1 · warm woody midrange 1 ·
       clear glassy brightness 1 · slight smoky depth 1 · slight nasal brightness 1 ·
       soft breathy grain 1
```

"조정" 버튼 클릭 → 기존 보컬 조정 모달이 male/female/mixed 각 6으로 정확히 채워진 채 열림(자동 쿼터 값을 초기값으로 정확히 반영) — 실제 조작으로 확인.

---

## 5. TASK E — 세트 간 보컬 회피 (P2)

### 5-1. 구현

`src/core/vocalComboLedger.ts` 신설 — `ratingLedger.ts`와 동일한 IndexedDB 패턴(별도 DB `suno-weaver-vocal-combos`), 채널별로 "이 세트가 가장 많이 쓴 남/여 레지스터" 서명(`M:<register>|F:<register>`)을 기록.

- **쓰기**: `library.ts`의 `savePack`에서, 오토세이브가 아닌 실제 저장 시 `dominantRegisterSignature(blueprint.songs)`를 계산해 기록 (best-effort, 실패해도 저장 자체는 막지 않음).
- **읽기**: `providers/index.ts`의 `generateBlueprint`(로컬/실시간/Batch 경로 전부를 통과하는 단일 지점) 최상단에서 `getRecentVocalCombos(channel.id)`를 조회해 `avoid.recentVocalComboSignatures`로 채움 → `buildAdultVocalTraitPlan`의 register 축 선택에서 최근 등장한 레지스터는 가중치 1, 나머지는 2 — 강제 배제 아님(가중치만 조정, 스펙의 "강제하지는 마십시오" 준수).

### 5-2. 검증 범위 — 일부 미구현

- 순수 함수(`dominantRegisterSignature`)는 유닛 테스트로 검증 (`tests/vocalComboLedger.test.ts`, 3건).
- `recordVocalCombo`/`getRecentVocalCombos`(IndexedDB 래퍼)는 `ratingLedger.ts`와 동일하게 jsdom/vitest 환경에서 별도 유닛 테스트 없이 실제 브라우저 사용으로만 검증되는 패턴을 따랐습니다 — **이번 세션에서는 실제 브라우저로 "세트 A 저장 → 세트 B 생성 → 회피 반영 확인"까지의 종단 시나리오를 직접 조작해 확인하지 못했습니다.** 코드 배선(저장 시 기록, 생성 시 조회)과 타입체크는 완료했고 회귀 테스트는 전부 통과하지만, 실제 두 세트 연속 생성으로 회피 효과를 눈으로 확인하는 것은 미구현으로 남습니다.

---

## 6. 완료 판정

### 6-1. v3.72 항목별 PASS/FAIL

| 항목 | 기준 | 이전 실측 | 이번 실측 | 판정 |
| --- | --- | --- | --- | --- |
| 8축 미설정 상태에서 보컬 배분 | 남6/여6/듀엣6 | 남18 | 남6/여6/듀6 | ✅ PASS |
| 같은 보컬 타입 최대 연속 | ≤ 2 | 18 | 2 | ✅ PASS |
| 보컬 서술 종류 (18곡) | ≥ 12 | 1 | 18 | ✅ PASS |
| 같은 `register` 최대 곡수 | ≤ 2 | — | 2 | ✅ PASS |
| 같은 `timbre` 최대 곡수 | ≤ 2 | — | 2 | ✅ PASS |
| 보컬이 18곡 공유 원자에 포함 | 0건 | 3건 | 0건 | ✅ PASS |
| 공유 원자 비율 | ≤ 0.15 | 0.23 | 0.032 | ✅ PASS |
| 보컬 문자열 길이 | ≤ 12단어 | — | 최대 12 | ✅ PASS |
| 모순 조합 | 0건 | — | 0건 | ✅ PASS |
| `hardExclusions` 위반 | 0건 | — | 0건 (와일드/고역 단어 자체가 축 풀에 없음) | ✅ PASS |
| Step2.5 보컬 축 분포 표시 | 표시 | 없음 | 실제 UI에서 확인 | ✅ PASS |
| 세트 간 회피 종단 검증 | — | — | 코드 배선 완료, 실제 2세트 연속 생성 확인은 미실행 | ⚠️ 부분 미구현 |

### 6-2. 회귀 방지 확인 — 청취로 확인된 성과

| 항목 | 확인 방법 | 판정 |
| --- | --- | --- |
| 장르가 서로 다르게 들림 / 장르별 개성 | 코드 미변경 | ✅ |
| 킬링포인트 옥타브 상승 / 배정 14/18·9종 이상 | 코드 미변경, `killingPoints.ts`/`arcPlan.ts` 손대지 않음 | ✅ |
| 아크 5구간 전부 사용 | 코드 미변경 | ✅ |
| BPM 표준편차 ≥ 8 | 코드 미변경 | ✅ |
| 가사 상황 18종 전부 다름 / 감정 아크 ≥ 8종 | 코드 미변경 (`lyricEngine.ts` 무수정) | ✅ |
| 가사 단어수 175~205 / 섹션 수 5~8 | 코드 미변경 | ✅ |
| `[end]` 태그 0 / 길이 지시 18/18 | 코드 미변경 (v3.71에서 완료) | ✅ |
| 프롬프트 350~650자 / 서술어 15~25 | 실측 723자/26.4개 — 이 테스트 픽스처 기준으로는 목표 상단 초과. 단, 동일 설정에서 구버전(단일 고정 보컬) 경로로 재실측한 결과 794자/28.5개로 **신규 보컬 시스템이 오히려 더 짧음** — 이번 작업이 프롬프트 비대화의 원인이 아님을 확인 (§7 참고) | ⚠️ 참고 |
| 편곡 어휘 가사 누출 0 / 시대 모순 0 / Title:·자리표시자·관사오류·아티스트명·라벨 0 | 코드 미변경 | ✅ |
| 장르 간 유사도 ≤ 0.28 | 코드 미변경 | ✅ |
| 전체 회귀 테스트 (`npm run test:fast`) | 55 files / 619 tests 전부 통과 | ✅ |

---

## 7. 프롬프트 길이에 대한 추가 설명

스펙 배경의 "634자/22개" 수치는 이번 세션의 테스트 픽스처(`testGenres`/`testMoods`)가 아닌 실제 프로덕션 채널 조합에서 나온 것으로 보입니다. 동일한 테스트 픽스처·시드로 **구버전(vocalTone을 defaultVocal과 다른 고정 프리셋으로 명시 — quota 꺼짐) 경로와 신버전(quota 켜짐) 경로를 나란히 재실측**한 결과:

| 경로 | stylePrompt 평균 길이 | 서술어 평균 개수 |
| --- | --- | --- |
| 구버전 (단일 고정 보컬) | 794자 | 28.5개 |
| 신버전 (4축 다양화) | 723자 | 26.4개 |

**신버전이 오히려 71자/2.1개 더 짧습니다.** 두 경로 모두 634자보다 길지만, 그 차이는 이 테스트 픽스처 자체의 장르/무드 데이터 특성이지 이번 보컬 축 시스템 때문이 아닙니다. 프롬프트 예산 규율(v3.62 성과)은 무너지지 않았습니다.

## 8. 미구현 항목

1. **TASK E의 실제 종단 검증** (§5-2) — 저장 시 기록, 생성 시 조회하는 코드 배선과 타입체크·순수 함수 유닛 테스트는 완료했으나, 실제 브라우저에서 "세트 A 저장 → 세트 B 생성" 두 단계를 직접 조작해 회피 효과를 눈으로 확인하지는 못했습니다.
2. **defaultVocal 가중치 편향의 정성적 청취 검증** — 코드/유닛 테스트로는 "husky" 키워드가 timbre 선택 확률을 실제로 높인다는 것을 확인했으나, 실제 채널의 "성향"이 최종 결과물에서 사용자가 체감할 만큼 뚜렷한지는 청취 판단이 필요한 영역이며 이 세션에서 수행할 수 없습니다.
