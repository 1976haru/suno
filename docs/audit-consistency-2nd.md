# 정합성 스트레스 테스트 2차 — UI 표시값과 실제 생성값의 괴리 중심 전수 감사

- 기준 커밋: `20ebff5` (main, 지시문 78 머지)
- 작업 브랜치: `audit/consistency-stress-2nd`
- 조사 스크립트: `scripts/audit2/` (전부 커밋됨 · `src/` 는 한 줄도 수정하지 않았다)
- 검사 원본 출력: `scripts/audit2/out/`
- `npm run typecheck` 통과 (2026-08-28 실행)

---

## 0. 1차 감사 보고서에 대하여 — 읽을 수 없었다

지시문이 먼저 읽으라고 지정한 `docs/audit-consistency-20260823.md`는 **이 저장소에 존재하지 않는다.**

```
$ find . -path ./node_modules -prune -o -name "*audit-consistency*" -print
(출력 없음)
$ git log --all --oneline --diff-filter=A -- '*audit-consistency*'
(출력 없음)
```

`896b2ec restore: .git 유실 복구 — 정합성 감사 수정 및 이후 작업 재커밋` 시점에 유실된 것으로 보인다. 보고서 본문이 없으므로, 1차가 무엇을 조사했는지는 **수정 커밋 `d9ff331`의 커밋 메시지**로만 복원했다. 그 메시지가 명시한 1차 높음 3건은 다음과 같고, 2차에서는 이 3건과 그 주변(가사 본문 생성, 어휘뱅크 번역, perspective 치환)을 다시 다루지 않았다.

1. `avoidWords`가 `excludePrompt`에만 반영되고 가사 본문에는 반영되지 않던 결함
2. `vocabularyBanks.ts` 명사가 번역 없이 한국어/일본어 가사에 삽입되던 결함
3. `perspective` 선택이 로컬 생성 가사 텍스트에 반영되지 않던 결함

**한계로 남긴다:** 1차가 "조사했으나 문제를 찾지 못한 영역"을 어디로 적었는지 알 수 없으므로, 2차가 그 영역을 중복 조사했을 가능성을 배제할 수 없다. 다만 2차의 발견 항목은 전부 지시문 74~78(2026-08-25~08-27, 1차 이후) 작업 또는 UI↔생성 대조 축이며, 1차 3건과 겹치는 것은 없다.

---

## 1. 요약

### 1.1 유형 × 심각도 교차표

| 유형 | 높음 | 중간 | 낮음 | 없음 | 계 |
|---|---|---|---|---|---|
| A — 계산하고 버림 | 0 | 2 | 0 | 0 | 2 |
| B — 상류 덮어쓰기 | 0 | 1 | 0 | 0 | 1 |
| C — 주석·커밋 단언이 코드와 다름 | 0 | 1 | 2 | 0 | 3 |
| D — 도달 경로 없음 | 1 | 0 | 2 | 1 | 4 |
| E — 조용한 실패 | 0 | 0 | 1 | 0 | 1 |
| F — UI ↔ 실제 괴리 | 1 | 3 | 3 | 0 | 7 |
| **계** | **2** | **7** | **8** | **1** | **18** |

유형이 둘에 걸치는 항목은 주 유형 한 곳에만 계상했다(제목에 둘 다 표기).

### 1.2 심각도 높음·중간 전체 목록

| # | 심각도 | 유형 | 제목 |
|---|---|---|---|
| 1 | 높음 | F | Step2Plan의 "18곡 계획" 표가 `[설계 적용]` 없이는 생성에 전혀 반영되지 않는다 — 트랙별 장르 82.1% 불일치 |
| 2 | 높음 | D/F | 시대 컨셉이 장르 구성을 최대 1종까지 붕괴시키는데 Step2는 붕괴 전 구성을 보여준다 |
| 3 | 중간 | F | "장르에 맞춰 배정" 카드 문구가 성별 쏠림을 반영하지 않는다 — **지시문 §1 확정 사례의 실제 원인** |
| 4 | 중간 | B/D | 채널 `defaultVocal`이 프리셋과 일치하는 3개 채널에서 지시문 77 컨셉 발성 라우팅이 항상 무력화된다 |
| 5 | 중간 | A | 지시문 78 TASK A가 프리셋 `prompt`에 넣은 발성 어휘가 최종 stylePrompt에 한 번도 도달하지 않는다 (408곡 0건) |
| 6 | 중간 | A/F | 지시문 74 TASK A의 BPM 섹션 하한이 로컬 생성 경로에 적용되지 않아, 앱 자신의 채점기가 로컬 생성물 58.3%를 감점한다 |
| 7 | 중간 | C | 지시문 78 신설 프리셋에서 onset 절이 중복 삽입돼, 지시문 74 TASK C의 중복 경고가 30.6%의 곡에 자동으로 걸린다 |
| 8 | 중간 | F | Step2Plan을 건너뛰면 en-chillhop 2개 채널이 지시문 76이 막으려던 대역 혼재(64 BPM + 127 BPM)를 그대로 낸다 |
| 9 | 중간 | F | Step2Plan 미방문 시 실제 장르 종류가 계획표보다 줄거나(8→4) 늘어난다(4→12) |

### 1.3 지시문 §1의 확정 사례에 대한 정정

지시문 §1.2는 원인을 **"장르 풀(`opts.genreIds` vs `genrePool`)도 시드(`vocalRecommendationSeed` vs `seed`)도 다르다"**로 적었다. 실행으로 확인한 결과 **시드는 같고**, 기본 조건에서는 **장르 플랜과 쿼터도 완전히 일치한다.**

```
$ npx tsx scripts/audit2/f1-vocal-quota-divergence.ts
previewSeed        : 2225154794
generationSeed     : 2225154794 (미리보기 시드와 같은가: true )
genreDerivedQuota  : {"m":6,"f":5,"x":4}
실제 배분(slots)    : {"male":6,"female":5,"mixed":4}
```

시드가 같은 이유는 `core/lyricEngine.ts:2188`의 `seedForBlueprint(opts) = ${opts.channel.id}:${opts.projectTitle}` 가 `Step2Concept.tsx:208`의 `hashSeed(\`${opts.channel.id}:${opts.projectTitle}\`)`와 **같은 공식**이기 때문이다.

실제 원인은 두 개이고, 각각 아래 **#3**(성별 쏠림 미반영 — 남 6·여 5·혼성 4 → 남 8·여 3·듀엣 4를 정확히 재현)과 **#2**(시대 쿼터가 장르 풀을 바꿔 역산 쿼터 자체가 달라짐)로 보고한다.

---

## 2. 심각도 높음

### [F] 1. Step2Plan의 "18곡 계획" 표가 `[설계 적용]`을 누르지 않으면 생성에 전혀 반영되지 않는다

- 위치
  - `src/components/steps/Step2Plan.tsx:111-123` — `applyPlanToOptions`(계획을 `opts.genreIds` / `opts.diversityAllocations`에 쓰는 유일한 함수)
  - `src/components/steps/Step2Plan.tsx:446` — 이 함수를 부르는 유일한 사용자 경로 `<button>설계 적용</button>`
  - `src/components/steps/Step2Plan.tsx:408` — 축 편집 모달의 `applyDraft`(두 번째 호출부, 역시 클릭 필요)
  - `src/components/steps/Step2Plan.tsx:642-693` — 트랙별 Genre / BPM / Vocal / Structure / Role을 표로 보여주는 "18곡 계획 펼치기"
  - `src/components/steps/Step3Generate.tsx:943-946` — 실제 생성이 쓰는 `preallocateSongSlots(opts, genres, bridgeAvoid)`. `opts.genreIds`만 읽고 `plan`은 존재조차 모른다.

- 증상
  Step2Plan 화면은 "이렇게 해석했습니다"라는 제목 아래 12(또는 18)개 트랙 각각의 장르·BPM·보컬·구조·역할을 확정형 표로 보여준다. 이 표는 `directSetLocal(...)`의 결과(`plan.slots`)이고, 실제 생성은 `preallocateSongSlots(opts, ...)`이다. `[설계 적용]`을 누르지 않으면 두 값이 이어지지 않는다. 화면 어디에도 "아직 적용되지 않았다"는 표시가 없다(`grep "적용됨|미적용" src/components/steps/Step2Plan.tsx` → 계획 표 근처에 해당 문자열 0건).

- 검증

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/f4-plan-vs-generated.audit.ts --reporter=verbose

good-morning-memory-radio    장르 불일치 10/12  BPM 12/12  보컬  5/12   표의 장르 4종 → 실제 4종
oldpop-lounge-main           장르 불일치  9/12  BPM  5/12  보컬  3/12   표의 장르 4종 → 실제 4종
...
harbour-line-house           장르 불일치 12/12  BPM 12/12  보컬  5/12   표의 장르 8종 → 실제 5종

채널 34개 / 트랙 408개
  표의 장르와 실제 배정이 다른 트랙 : 335 (82.1%)
  표의 BPM과 실제가 다른 트랙       : 294 (72.1%)
  표의 보컬과 실제가 다른 트랙      : 182 (44.6%)
```

버튼을 눌렀을 때와 안 눌렀을 때를 같은 조건에서 분리 측정했다 — 버튼 하나가 전부다.

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/f5-plan-applied.audit.ts --reporter=verbose

harbour-line-house           장르 불일치 미적용 12/12 → 적용  0/12    BPM 미적용 12/12 → 적용  0/12

트랙 408개
  장르: [설계 적용] 안 누름 335 (82.1%)  →  누름 2 (0.5%)
  BPM : [설계 적용] 안 누름 294 (72.1%)  →  누름 2 (0.5%)
```

즉 계획 표 자체는 정확하다(적용 시 0.5% 오차). 문제는 그 정확한 표가 기본 상태에서는 **아무 데도 연결되지 않는다**는 것이다.

- 사용자 영향: **높음** — 사용자가 화면에서 트랙 단위로 확인한 세트 구성(장르·BPM·보컬)과 실제로 받는 세트가 대부분의 트랙에서 다르다. 지시문 §7에서 언급한 "지시문 23/30의 '선택했는데 적용 버튼을 안 누르면 반영 안 됨'"의 새 사례다.
- 재현 조건: 전 34개 채널. Step2Plan에 들어가 계획을 보고 `[설계 적용]`을 누르지 않은 채 Step3로 진행하면 항상 발생한다.
- 미확인 사항: 실제 브라우저 UI에서 Step2Plan을 거치지 않고 Step3로 갈 수 있는지(라우팅상 강제 통과인지)는 확인하지 못했다. 다만 통과하더라도 버튼 클릭은 자동이 아니므로 결론은 같다.

---

### [D/F] 2. 시대 컨셉이 장르 구성을 최대 1종까지 붕괴시키는데 Step2는 붕괴 전 구성을 보여준다

- 위치
  - `src/core/batchPreallocation.ts:296-322` — `eraQuotaCounts`(시대 제약이 있을 때만 도는 `applyEraQuota` + `ensureEraNeutralFloor`)
  - `src/core/batchPreallocation.ts:330-332` — `autoGenrePlan = eraQuotaCounts ? buildGenreCountRotationPlan(...) : buildGenreRotationPlan(genrePool, ...)`
  - `src/components/steps/Step2Concept.tsx:290-293` — 미리보기는 **항상** `buildGenreRotationPlan(opts.genreIds, ...)`. 시대 쿼터 분기가 없다.
  - `src/core/vocalQuotaFromGenre.ts:93-138` — 역산 쿼터는 이 genrePlan을 그대로 읽으므로 쿼터 숫자까지 함께 어긋난다.

- 증상
  컨셉 자유 텍스트에 연대 표현("70년대 …", "2000년대 …")이 들어가면 생성 경로만 `applyEraQuota`를 태워 장르 배분을 재작성한다. Step2 화면(장르 칩 · 보컬 비율 역산 문구)은 재작성 전 구성을 그대로 보여준다.

- 검증

```
$ npx tsx scripts/audit2/f3-genre-collapse.ts
oldpop-lounge-main         oldpop-lounge    concept="2000년대 감성"   화면 5종 → 실제 1종 (최다 장르 15/15곡)
showa-seventies            showa-70s        concept="60년대 올드팝"   화면 4종 → 실제 1종 (최다 장르 15/15곡)
showa-seventies            showa-70s        concept="80년대 시티팝"   화면 4종 → 실제 1종 (최다 장르 15/15곡)
showa-seventies            showa-70s        concept="2000년대 감성"   화면 4종 → 실제 1종 (최다 장르 15/15곡)
morning-showa-cafe         showa-cafe       concept="2000년대 감성"   화면 3종 → 실제 1종 (최다 장르 15/15곡)
millennium-jpop            j2000s           concept="60년대 올드팝"   화면 3종 → 실제 1종 (최다 장르 15/15곡)
...
총 238건 중 장르 종류 축소 28건
```

쿼터 숫자까지 어긋나는 사례(같은 스윕의 다른 스크립트):

```
$ npx tsx scripts/audit2/f2-sweep-quota.ts
Q!! G!! oldpop-lounge-main/oldpop-lounge concept="70년대 추억이 느껴지는 올드팝"
      화면 {"male":4,"female":8,"mixed":3}  실제 {"male":6,"female":6,"mixed":3}  카드문구 남4·여8·혼3
      미리보기 장르 jazz-classic-vocal-lounge,chanson,smooth-jazz-lounge,adult-contemporary,bossa-cafe,(반복)
      실제     장르 adult-contemporary,adult-contemporary,adult-contemporary,smooth-jazz-lounge,jazz-classic-vocal-lounge,adult-contemporary,...

Q!! G!! millennium-jpop/j2000s concept="70년대 추억이 느껴지는 올드팝"
      화면 {"male":6,"female":6,"mixed":3}  실제 {"male":5,"female":5,"mixed":5}  카드문구 남6·여6·혼3
      미리보기 장르 jpop-2000s-ballad,jpop-2000s-band,jpop-2000s-rnb,(반복)
      실제     장르 jpop-2000s-ballad ×15
```

- 사용자 영향: **높음** — 5종 장르를 골라 화면에서 5종을 확인했는데 15곡 전부가 한 장르로 나온다. `showa-seventies` × "60년대 올드팝"은 `check:gates`가 지원(supported)으로 판정한 조합인데도 15/15 단일 장르가 된다(비지원 조합만의 문제가 아니다).
- 재현 조건: 컨셉 자유 텍스트에 연대 표현이 있고 채널이 시대 태그를 가진 장르 풀을 쓰는 모든 경우. 시니어·쇼와·J2000s 계열에서 특히 강하게 나타난다. `check:gates` 기준 지원 조합에서도 발생.
- 미확인 사항: 이 붕괴가 "시대 충실도를 위한 의도된 축소"인지, 아니면 `applyEraQuota`의 배분 결함인지는 판정하지 않았다. 어느 쪽이든 **Step2가 그 사실을 표시하지 않는 것**은 결함이다. `Step2Plan` 경로(`directSetLocal`)에서도 같은 붕괴가 나는지는 별도로 재지 않았다.

---

## 3. 심각도 중간

### [F] 3. "장르에 맞춰 배정" 카드 문구가 성별 쏠림을 반영하지 않는다 — 지시문 §1 확정 사례의 실제 원인

- 위치
  - `src/components/steps/Step2Concept.tsx:1248` — `description: genreDerivedQuota.reasonKo`
  - `src/core/vocalQuotaFromGenre.ts:133-135` — `reasonKo`는 `floored`(쏠림 적용 **전**) 값으로 문장을 만든다
  - `src/components/steps/Step2Concept.tsx:330-332` — 실제 표시 쿼터 `resolvedVocalQuotaPreview`는 `leaningAdultVocalQuota(...)`로 쏠림을 적용한다
  - `src/components/steps/Step2Concept.tsx:1401` — "성별 배정: 남성 N곡 …"은 쏠림 적용값을 쓴다

- 증상
  같은 화면 안에서 두 숫자가 다르다. 카드 설명은 "…에서 계산했습니다 — 남 6 · 여 5 · 혼성 4"라고 **확정형**으로 말하고, 그 아래 "성별 배정" 줄과 실제 생성은 남 8 · 여 3 · 듀엣 4다.

- 검증 (지시문 §1.1의 숫자를 그대로 재현)

```
$ npx tsx scripts/audit2/f1b-lean-divergence.ts

########## A. 보컬 톤 미선택 (채널 기본값 그대로)
카드 문구(reasonKo)   : 선택하신 장르 구성(...)에서 계산했습니다 — 남 6 · 여 5 · 혼성 4.
화면 표시 쿼터(resolved): {"male":6,"female":5,"mixed":4}
실제 생성 배분        : {"male":6,"female":5,"mixed":4}
일치 여부(카드문구 vs 실제): OK

########## B. 사용자가 남성 프리셋 선택 (다시 추천 결과 반영과 동일)
카드 문구(reasonKo)   : 선택하신 장르 구성(...)에서 계산했습니다 — 남 6 · 여 5 · 혼성 4.
화면 표시 쿼터(resolved): {"male":8,"female":3,"mixed":4}
실제 생성 배분        : {"male":8,"female":3,"mixed":4}
일치 여부(카드문구 vs 실제): *** 불일치 ***

########## C. 사용자가 여성 프리셋 선택
카드 문구(reasonKo)   : ... 남 6 · 여 5 · 혼성 4.
화면 표시 쿼터(resolved): {"male":3,"female":8,"mixed":4}
실제 생성 배분        : {"male":3,"female":8,"mixed":4}
일치 여부(카드문구 vs 실제): *** 불일치 ***
```

`headphones-down-low` · 15곡 · `chill-rap/lofi-hiphop-study/jazz-rap/boom-bap-mellow` — 지시문 §1.1이 인용한 그 세트다. 남 8·여 3·듀엣 4는 `leaningAdultVocalQuota(quota, 15, 'male')`의 정확한 출력이다(`LEADING_SHARE 0.55` → `round(15×0.55)=8`, 나머지 7을 3/4로, `minEach=2`).

- 사용자 영향: **중간** — 생성 결과 자체는 유효하고, 사용자가 화면에서 본 숫자와 다르다. 다만 화면 안에서 두 숫자가 동시에 보이므로 신뢰를 직접 깎는다.
- 재현 조건: `vocalQuotaOverride`가 없는 모든 채널에서, 사용자가 보컬 프리셋을 고르거나 `[다시 추천]`을 눌러 `opts.vocalTone`이 채널 기본값에서 바뀐 순간부터. `[다시 추천]`은 `Step2Concept.tsx:456`에서 `vocalTone`을 지배 프리셋의 `prompt`로 설정하므로, 그 버튼 한 번이면 조건이 성립한다.
- 미확인 사항: 실제 사용자가 §1.1 화면을 볼 때 `[다시 추천]`을 눌렀는지 프리셋 카드를 골랐는지는 알 수 없다(둘 다 같은 결과).

부수 확인 — `Step2Concept.tsx:399-405`의 `vocalPresetPlanMismatchWarning`(이 발산을 화면에 알리기 위해 지시문 48이 만든 가드)은 `opts.vocalPresetPlan`을 **`resolvedVocalQuotaPreview`(미리보기 쪽)**와만 비교한다. 카드 문구와의 불일치는 이 가드의 검사 축이 아니므로 절대 발화하지 않는다.

---

### [B/D] 4. 채널 `defaultVocal`이 프리셋과 일치하는 3개 채널에서 지시문 77 컨셉 발성 라우팅이 항상 무력화된다

- 위치
  - `src/core/batchPreallocation.ts:510` — `wholePackMatchedVocalPreset = matchVocalPreset(opts.vocalTone?.trim() ?? '')` — `opts.vocalTone`이 **채널 기본값 그대로**여도 매칭된다(사용자가 고른 적 없음)
  - `src/core/batchPreallocation.ts:1241` — 우선순위 `vocalPresetOverride ?? wholePackMatchedVocalPreset ?? conceptPresetForTrack ?? kidsPresetForTrack`
  - `src/core/localGenerator.ts:2522` — 같은 우선순위 체인
  - `src/data/vocalPresets.ts:480-497` — `LEGACY_PRESET_PROMPTS` 별칭이 있어 지시문 78로 `prompt`가 바뀐 뒤에도 채널 기본값이 계속 매칭된다

- 증상
  `good-morning-memory-radio` / `chill-hours` / `city-night-drive` 3개 채널은 `channel.defaultVocal`이 프리셋과 정확히 매칭된다. 그래서 사용자가 보컬을 건드리지 않아도 팩 전체가 `vocalPresetSource='tone-match'`로 고정되고, 지시문 77의 컨셉 발성 지목(`'concept'`)은 우선순위상 **절대 이길 수 없다.**

- 검증

```
$ npx tsx scripts/audit2/g2-tonematch-blocks-concept.ts
good-morning-memory-radio    senior-morning   *** warm-mature-male ***
chill-hours                  modern-chill     *** airy-whisper-female ***
city-night-drive             city-night       *** bright-young-female ***
일치 채널 3/34
```

전 채널 × 5개 발성 계열 도달성 실측 — 이 3채널만 5개 계열 전부 `지목만`(컨셉은 매칭됐는데 프리셋 배정 0건):

```
$ npx tsx scripts/audit2/d3-concept-vocal-reach.ts
npx tsx scripts/audit2/d4-family-by-archetype.ts
채널                          archetype        breathy   belted    husky     dark      clean
good-morning-memory-radio   senior-morning   지목만12   지목만12   지목만12   지목만12   지목만12
chill-hours                 modern-chill     지목만12   지목만12   지목만12   지목만12   지목만12
city-night-drive            city-night       지목만12   지목만12   지목만12   지목만12   지목만12
(그 외 채널은 대부분 8/12~10/12로 정상 배정)
지목은 됐으나 프리셋이 하나도 배정되지 않은 칸: 22 / 170
```

A/B 대조 — 컨셉이 있든 없든 프리셋 분포가 완전히 동일하다:

```
$ npx tsx scripts/audit2/g1-concept-vocal.ts
##### good-morning-memory-radio
컨셉A "힘차게 내지르는 목소리의 올드팝"
  presets: warm-mature-male ×15
  source : tone-match ×15
컨셉B "올드팝"
  presets: warm-mature-male ×15
  => 두 컨셉의 프리셋 분포 동일: *** 동일 (컨셉이 배정을 바꾸지 못함) ***
```

부수 확인 — `effectiveVocalPresetId`가 그 트랙의 `vocalType`과 성별이 어긋난다(같은 3채널):

```
$ npx tsx scripts/audit2/g3-tonematch-gender.ts
### good-morning-memory-radio   성별 불일치 9/15
### chill-hours                 성별 불일치 10/15
### city-night-drive            성별 불일치 7/15
```

`vocalText`(실제 프롬프트 문구)는 트랙 성별에 맞게 정상 생성되므로 **생성물 자체는 틀리지 않는다.** 다만 `core/fullAudit.ts:264`의 `vocal_preset_variety` 항목(목표 5종)이 이 3채널에서는 언제나 `distinct=1`이 되어 영구 실패로 표시되고, `core/csvExport.ts:208`의 CSV도 잘못된 성별의 프리셋 id를 싣는다.

- 사용자 영향: **중간** — 3개 채널에서 지시문 77 기능 전체가 동작하지 않고, 정합성 검사 패널이 고칠 수 없는 실패 항목을 상시 표시한다.
- 재현 조건: `matchVocalPreset(channel.defaultVocal)`이 매칭되는 채널(현재 34개 중 3개). 채널 데이터에 의존하므로 새 채널을 추가할 때마다 재발할 수 있다.
- 미확인 사항: `vocalPresetSource` 우선순위가 `tone-match > concept`인 것이 의도인지(`types.ts:1550` 주석은 "사용자의 명시적 선택이 항상 컨셉 추론을 이긴다"고 적었다). 문제는 **채널 기본값이 "사용자의 명시적 선택"으로 취급된다**는 점이다.

---

### [A] 5. 지시문 78 TASK A가 프리셋 `prompt`에 넣은 발성 어휘가 최종 stylePrompt에 한 번도 도달하지 않는다

- 위치
  - `src/data/vocalPresets.ts:151, 160, 173, 198, 207, 218, 243, 252, …` — 지시문 78 TASK A(`1a9bb53`)가 성인 16종의 `prompt`에 추가한 `soft glottal onset` / `clean fold closure` / `forward mask resonance` / `audible fold rasp` / `low breath pressure` 등
  - 소비부 없음 — 이 문자열이 stylePrompt로 가는 경로가 존재하지 않는다. 사용자가 프리셋을 고르면 `buildAdultVocalTraitPlan`이 프리셋의 `register`/`timbre` 축으로 **새 문구를 조립**하고, 프리셋의 `prompt` 문자열 자체는 버려진다.

- 증상
  커밋 `1a9bb53`의 메시지는 "16종 전부에 성대 폐쇄 / 호흡 압력 / 공명 위치 축의 표현을 1개씩 넣었다"고 하며, 목적은 "Suno가 전부 기본 발성으로 부른다"의 해소다. 그 어휘가 Suno로 나가는 프롬프트에 실리지 않는다.

- 검증 — 전 34채널 × (기본 톤 / 프리셋 선택) × 6곡 = 408곡, 적중 0건

```
$ npx tsx scripts/audit2/g4-vocab-in-prompt.ts
good-morning-memory-radio  기본     6곡  적중: (없음)
good-morning-memory-radio  프리셋선택  6곡  적중: (없음)
... (전 채널 동일)
총 408곡 | 어휘별 총 적중:
  forward mask resonance   0
  clean fold closure       0
  soft glottal onset       0
  firm glottal closure     0
```

경로별 대조 — 컨셉 지목(지시문 77) 경로만 살아 있고, 프리셋 선택 경로는 죽어 있다:

```
$ npx tsx scripts/audit2/g6-vocab-paths.ts
A. 프리셋 선택(clear-light-male) · 컨셉 없음    8곡 중 적중 0회  (없음)
   vocalText[0]: male mid baritone-tenor lead, earnest forward delivery, worn weathered edge, intimate close-mic
B. 컨셉 지목(숨소리) · 톤 기본                  8곡 중 적중 6회  soft glottal onset
C. 컨셉 지목(허스키) · 톤 기본                  8곡 중 적중 6회  audible fold rasp
D. 자유 텍스트(프리셋 아님)                     8곡 중 적중 0회  (없음)
```

단일 곡 덤프 — 프리셋은 배정됐는데(`effectiveVocalPresetId: clear-light-male`, `vocalPresetSource: tone-match`) `vocalText`는 완전히 다른 문구다:

```
$ npx tsx scripts/audit2/g5-dump-song.ts
선택 프리셋 prompt: clear light male tenor, clean simple delivery, forward mask resonance, youthful
vocalText: female clear mezzo lead, restrained understated reading, clear glassy brightness, tape slap echo
effectiveVocalPresetId: clear-light-male
vocalPresetSource: tone-match
--- 프리셋 문구가 어느 필드에 실렸는가 ---
(적중 없음)
```

- 사용자 영향: **중간** — 지시문 78 TASK A가 해결하려던 청취 문제("음역대만 다른 같은 사람처럼 들린다")가 프리셋 선택 경로에서는 그대로 남아 있다. 컨셉 자유 텍스트로 발성을 지목한 경우에만 실제로 반영된다.
- 재현 조건: Step2의 보컬 프리셋 카드를 골라 생성하는 모든 경우(= 기본 흐름).
- 미확인 사항: `prompt` 필드가 UI 표시·매칭 전용이고 실제 문구 조립은 `register`/`timbre` 축이 담당하는 것이 원래 설계인지, 78 TASK A가 그 설계를 오인한 것인지는 판정하지 않았다. 어느 쪽이든 커밋 메시지의 기대 효과는 발생하지 않는다.

---

### [A/F] 6. 지시문 74 TASK A의 BPM 섹션 하한이 로컬 생성 경로에 적용되지 않아, 앱 자신의 채점기가 로컬 생성물 58.3%를 감점한다

- 위치
  - `src/core/bpmLengthControl.ts:133-142` — `MIN_TOTAL_SECTION_BANDS`(96–110→9 / 111–125→11 / 126+→13)
  - 적용부: `src/core/batchPreallocation.ts:1113`(슬롯의 `sectionRange`) · `src/core/bridgeInstruction.ts:585-594`(브릿지 지시문) · `src/core/quality.ts:629-633`(채점 + 감점 12)
  - **미적용부**: `src/core/localGenerator.ts` — 로컬 가사의 섹션 수를 정하는 경로가 이 하한을 읽지 않는다
  - `src/core/quality.ts:618-620` 주석: *"scoreSong에 두는 이유: **모든 생성 경로(로컬/Batch/브릿지 임포트)가 반드시 통과하는 단일 관문**이라서다"* — 채점은 로컬을 포함한다고 명시하지만, 생성 쪽은 로컬을 포함하지 않는다.

- 증상
  로컬 생성물의 절반 이상이 앱 자신의 채점기에서 "이 템포에서는 최소 N개가 필요합니다" 경고와 −12점을 받는다. 사용자가 취할 수 있는 조치가 없다(BPM도 섹션 수도 사용자가 정하지 않는다).

- 검증

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/c2-bpm-sections.audit.ts --reporter=verbose
BPM 96 이상 곡 246개 중 섹션 하한 미달 232개
  96-110(>=9)     104곡  미달 90  실측 섹션 4~10
  111-125(>=11)   97곡  미달 97  실측 섹션 4~10
  126+(>=13)      45곡  미달 45  실측 섹션 4~8
```

111 BPM 이상 대역은 **142곡 전부**(97+45) 미달이다 — 로컬 경로가 만들 수 있는 섹션 수의 최댓값(10, 8)이 하한(11, 13)보다 작아 구조적으로 도달 불가능하다.

자기 채점기의 경고 발생률:

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/c3-local-section-warning.audit.ts --reporter=verbose
로컬 생성 408곡 중 자기 채점기의 섹션 하한 경고를 받은 곡: 238 (58.3%)
  little-singalong-radio       12/12곡
  minna-de-taiso               12/12곡
  oyasumi-mae-no-uta           12/12곡
  harbour-line-house           12/12곡
  follow-along-action-song     12/12곡
  stage-night / drive-kpop-playlist / dawn-confession / daylight-city-kpop / nonstop-playlist / songs-for-after-its-over  각 11/12곡
표본:
  good-morning-memory-radio 트랙 4 (100 BPM, 점수 54) — 100 BPM에서 섹션이 7개뿐입니다 — 이 템포에서는 최소 9개가 필요합니다(...)
```

- 사용자 영향: **중간** — 지시문 74 TASK A가 고치려던 "딥하우스가 2분 이하로 끝난다"가 로컬 생성 경로에서는 그대로 남아 있고, 동시에 품질 점수가 곡당 12점씩 상시 낮아진다(예: 54점, 44점). 브릿지·Batch 경로에는 적용된다.
- 재현 조건: `generateLocalBlueprint`로 만든 96 BPM 이상 곡 전부. 아이돌·동요·en-chillhop 채널에서 12곡 중 11~12곡.
- 미확인 사항: 로컬 경로를 74 TASK A의 대상에서 의도적으로 뺀 것인지 확인하지 못했다. 커밋 메시지는 로컬 제외를 명시하지 않았고 `quality.ts` 주석은 로컬을 포함한다고 적었다.

---

### [C] 7. 지시문 78 신설 프리셋에서 onset 절이 중복 삽입돼, 지시문 74 TASK C의 중복 경고가 30.6%의 곡에 자동으로 걸린다

- 위치
  - `src/core/conceptVocalPlan.ts:294` — `alreadyHasOnset`이 **완전 일치**(`part.toLowerCase() === clause.toLowerCase()`)로만 판정한다
  - `src/core/conceptVocalPlan.ts:103` — husky의 `redundantClausePattern: /^(?:.*(?:husky|smoky|slight rasp|grainy).*)$/i` — `audible fold rasp`를 잡지 못한다
  - `src/core/conceptVocalPlan.ts:111` — dark의 `redundantClausePattern: /^(?:.*(?:dark cavernous|dark velvet|late-night tone).*)$/i` — `lowered larynx`를 잡지 못한다
  - `src/data/vocalPresets.ts:363, 377, 392, 405` — 지시문 78 TASK B 신설 프리셋의 anchor 절이 각각 `male baritone with lowered larynx` / `female alto with lowered larynx` / `male voice with audible fold rasp` / `female voice with audible fold rasp`
  - `src/core/conceptVocalPlan.ts:50-53` 주석: *"**절 개수를 늘리지 않는다**: applyVocalOnsetPhrasing이 아래 redundantClausePattern에 걸리는 기존 절을 먼저 빼고 그 자리에 넣는다"* — 신설 프리셋에 대해서는 성립하지 않는다.

- 증상
  `male voice with audible fold rasp, audible fold rasp, …` 처럼 같은 표현이 연속 두 번 나간다. 지시문 74 TASK C가 감시하도록 만든 바로 그 낭비다.

- 검증

```
$ npx tsx scripts/audit2/g7-dup-and-reach.ts
① vocalText 안에 동일 절이 두 번 나오는 곡: 187/1020
   oldpop-lounge-main "허스키한 목소리로" → female voice with audible fold rasp, audible fold rasp, conversational unhurried phrasing, clear glassy brightness
   oldpop-lounge-main "어두운 목소리로" → male baritone with lowered larynx, lowered larynx, clipped rhythmic phrasing, soft husky grain
```

최종 stylePrompt까지 살아남고, 그 전부가 지시문 74의 중복 경고를 받는다:

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/g8-dup-in-styleprompt.audit.ts --reporter=verbose
곡 612개
  vocalText에 onset 절이 2회 이상   : 187
  최종 stylePrompt에 2회 이상 살아남음: 187 (그중 중복 경고를 받은 곡 187)
     vocalText : female voice with audible fold rasp, audible fold rasp, light rhythmic phrasing, slight smoky depth
     경고 있음 : true
```

`findRedundantClauses`(경고를 내는 판정)와 `dedupeTerms`(조립 시 제거)가 같은 로직을 공유한다고 `quality.ts:559` 주석이 적었는데, **경고는 나가면서 제거는 되지 않는다** — 187/187.

- 사용자 영향: **중간** — Suno로 나가는 프롬프트에 무의미한 반복이 실리고(지시문 74가 "낭비"로 규정한 것), 동시에 곡당 −4~−8점을 받는다. 30.6%의 곡.
- 재현 조건: 컨셉 자유 텍스트로 husky 또는 dark 계열을 지목하고, 그 트랙에 지시문 78 신설 프리셋(`husky-grain-*`, `dark-resonant-*`)이 배정될 때. 즉 78 TASK B가 만든 프리셋이 77 라우팅에 연결된(커밋 `7d2e6ec`) 조합에서만 발생한다.
- 미확인 사항: `dedupeTerms`가 왜 이 절을 제거하지 못하는지(원자 분할 경계 문제로 보이나) 코드 수준에서 추적하지 않았다.

---

### [F] 8. Step2Plan을 건너뛰면 en-chillhop 2개 채널이 지시문 76이 막으려던 대역 혼재를 그대로 낸다

- 위치
  - `src/core/setDirector.ts` — 지시문 76 TASK A의 세 수정(브리지 합집합 / `targetCount` 상향 / `evenSpread`·`keepSingletons`)이 전부 여기에 있다
  - `src/components/steps/Step3Generate.tsx:943-946` — 실제 생성은 `setDirector`를 거치지 않는다(#1 참고)

- 증상
  커밋 `6fd5c11`(지시문 76)은 *"실측 3세트 전부 고유 장르 8종·최대 반복 2곡·평균 1.5회. 대역 혼재 0건, BPM 폭 70~108 / 70~106 / 99~122로 62와 128이 함께 나오지 않는다"*고 적었다. 이 결과는 `setDirector` 경로에서만 재현된다.

- 검증

`setDirector` 경로(= `[설계 적용]`을 누른 경우) — 커밋의 단언 그대로:

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/c5-band-mix-setdirector.audit.ts --reporter=verbose
OK headphones-down-low      "늦은 밤 헤드폰"  BPM 68~106 (폭 38)  고유 장르 8종  최대 반복 2곡
OK after-hours-deep-house   "비 오는 저녁"  BPM 68~111 (폭 43)  고유 장르 8종  최대 반복 2곡
...
세트 25개 중 대역 혼재(<=70 & >=120) 0개
```

직접 생성 경로 — 같은 채널에서 62/128에 준하는 혼재가 나온다:

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/c4-band-mix.audit.ts --reporter=verbose
XX after-hours-deep-house   "세트 A"  BPM 68~127 (폭 59)  고유 장르 4종  최대 반복 3곡
XX city-lights-crossfade    "세트 C"  BPM 64~127 (폭 63)  고유 장르 4종  최대 반복 3곡
XX city-lights-crossfade    "세트 D"  BPM 64~127 (폭 63)  고유 장르 4종  최대 반복 3곡
...
세트 25개 중 "저속(<=70)과 고속(>=120)이 한 세트에 공존" 9개
```

- 사용자 영향: **중간** — 12곡 한 세트에 64 BPM 로파이와 127 BPM 딥하우스가 섞이고, 고유 장르가 8종이 아니라 4종이 된다. 지시문 76이 해결한 것으로 보고된 병목이 기본 경로에서 그대로 남아 있다.
- 재현 조건: `after-hours-deep-house` / `city-lights-crossfade`에서 `[설계 적용]` 없이 생성. 25세트 중 9세트(36%).
- 미확인 사항: `headphones-down-low` / `tokyo-night-headphones` / `harbour-line-house`는 직접 경로에서도 혼재가 없다 — `preferredGenres` 구성이 이미 한쪽 대역에 치우쳐 있기 때문으로 보이나 확인하지 않았다.

---

### [F] 9. Step2Plan 미방문 시 실제 장르 종류가 계획표보다 줄거나 늘어난다

#1의 하위 축이지만 방향이 양쪽이라 따로 적는다.

- 위치: #1과 동일
- 증상: 계획표가 4종이라 했는데 실제 12종이 나오거나(`lofi-focus-main`, `lofi-study-main`), 8종이라 했는데 4종이 나온다(`after-hours-deep-house`, `city-lights-crossfade`).
- 검증

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/f4-plan-vs-generated.audit.ts --reporter=verbose
lofi-focus-main   ... 표의 장르 4종 → 실제 12종
lofi-study-main   ... 표의 장르 4종 → 실제 12종
city-night-drive  ... 표의 장르 4종 → 실제 11종
after-hours-deep-house ... 표의 장르 8종 → 실제 4종
city-lights-crossfade  ... 표의 장르 8종 → 실제 4종
bedtime-lullaby-radio  ... 표의 장르 4종 → 실제 2종
```

- 사용자 영향: **중간** — "다양성" 축이 화면 표시와 반대 방향으로 움직인다. 12종은 12곡 세트에서 곡마다 다른 장르라는 뜻이고, 2종은 6곡씩 같은 장르라는 뜻이다.
- 재현 조건: #1과 동일.
- 미확인 사항: `lofi-*` 채널의 `preferredGenres`가 12~14종으로 넓어 배분기가 그대로 다 쓴 것으로 보이나, 그것이 의도인지는 확인하지 않았다.

---

## 4. 심각도 낮음

### [D] 10. 5개 아키타입에서 컨셉이 지목한 발성 계열에 프리셋이 0종이다

- 위치: `src/data/vocalPresets.ts`의 `suitedArchetypes` 배정 / `src/core/vocalRecommender.ts:18` `suitablePresetsForArchetype`(하드 필터)
- 증상: 컨셉이 발성 계열을 정확히 인식하고도 그 채널에 등록된 프리셋이 없어 조용히 배정을 포기한다(`console.warn`만 남는다 — 사용자에게 보이지 않는다).
- 검증

`suitablePresetsForArchetype`(픽커·추천기·컨셉 라우팅이 공유하는 실제 하드 필터)로 잰 결과:

```
$ npx tsx scripts/audit2/d4-family-by-archetype.ts
archetype         breathy   belted    husky     dark      clean
senior-morning    1종        1종        없음        없음        2종
oldpop-lounge     1종        2종        2종        2종        2종
showa-cafe        1종        없음        3종        1종        1종
showa-70s         없음        2종        1종        1종        2종
j2000s            1종        1종        없음        없음        4종
modern-chill      2종        없음        1종        1종        3종
lofi-study        3종        없음        없음        1종        2종
city-night        1종        1종        4종        2종        3종
kids              없음        없음        없음        없음        없음      (kids는 컨셉 라우팅 대상 밖 — 정상)
kr-2030-pop       2종        2종        2종        2종        5종
jp-2030-pop       1종        2종        2종        2종        4종
kr-kids-song      없음        없음        없음        없음        없음      (동일)
jp-kids-song      없음        없음        없음        없음        없음      (동일)
kr-idol-male      1종        1종        1종        1종        3종
kr-idol-female    1종        1종        2종        1종        2종
en-chillhop       4종        2종        3종        2종        5종
```

비-kids 13개 아키타입 중 6개(`senior-morning` 2칸 · `showa-cafe` 1칸 · `showa-70s` 1칸 · `j2000s` 2칸 · `modern-chill` 1칸 · `lofi-study` 2칸 — 합계 9칸)에 공백이 남아 있다. 그중 `showa-70s`는 지시문 78 TASK C가 "0종 축 0개"로 단언한 7개 채널에 포함된다(#14).

```
$ npx tsx scripts/audit2/d3-concept-vocal-reach.ts   (경고 발췌)
[conceptVocal] 컨셉이 지목한 발성 프리셋이 이 채널(senior-morning)에 등록돼 있지 않아 무시했습니다: husky-grain-male, husky-grain-female, husky-jazz-female, smoky-jazz-male
[conceptVocal] ... (j2000s) ... dark-resonant-male, dark-resonant-female
```

- 사용자 영향: **낮음** — 컨셉에 쓴 발성 요구가 조용히 무시되지만 생성물은 유효하다. `d3` 실측 22칸 중 7칸이 이 원인이다(나머지 15칸 = 3채널 × 5계열은 #4의 `tone-match` 차단). `senior-morning`의 2칸은 #4와 원인이 겹쳐 15칸 쪽에 포함돼 있다.
- 재현 조건: 위 표의 `없음` 칸에 해당하는 아키타입 × 계열 조합.
- 미확인 사항: 각 채널의 `channelVocalFloor`가 그 계열을 실제로 금지하는지(= 의도된 공백인지) 대조하지 않았다. `7a20628` 커밋은 senior-oldpop의 belting 관련 검토만 기록했다.

### [D] 11. `kr-2030-rap` 채널의 `preferredMoods` 3개 중 2개가 존재하지 않는 id다

- 위치: `src/data/presets.ts`의 `kr-2030-rap` 채널 정의
- 검증

```
$ npx tsx scripts/audit2/d3-concept-vocal-reach.ts
npx tsx scripts/audit2/d4-family-by-archetype.ts
--- channel.preferredMoods 무결성 ---
kr-2030-rap: 존재하지 않는 무드 ["relaxed","hazy"] — 실제 사용 가능 무드 1/3
```

- 사용자 영향: **낮음** — 이 채널의 무드 선택지가 1개로 줄어든다. 34개 채널 중 1개.
- 재현 조건: `kr-2030-rap` 채널.
- 미확인 사항: 무드 칩 UI가 이 채널에서 실제로 1개만 보여주는지 브라우저로 확인하지 않았다.

### [F] 12. 같은 필드(`VocalQuota.mixed`)를 화면마다 네 가지 다른 한국어로 부른다

지시문 §1.4가 지목한 항목의 전수 결과다.

| 표기 | 위치 |
|---|---|
| `혼성` | `src/core/vocalQuotaFromGenre.ts:134`("장르에 맞춰 배정" 카드 설명) · `Step2Concept.tsx:403` · `core/designGate.ts:350` · `core/fullAudit.ts:296` |
| `듀엣` | `Step2Concept.tsx:1237, 1255, 1262, 1280, 1284, 1289, 1351, 1357, 1401` · `Step2Plan.tsx:318, 603` · `SetCompletenessPanel.tsx:327` · `ConceptRecommendationPanel.tsx:11` |
| `혼성/듀엣` | `Step3Generate.tsx:305` |
| `듀엣·혼성` | `core/vocalPlan.ts:251` |

- 증상: `Step2Concept.tsx` **한 화면 안에서** 카드 설명은 `혼성`, 그 아래 세 곳은 `듀엣`이다. Step3의 계약 화면은 `혼성/듀엣`, Step4의 완성도 패널은 `듀엣`이다.
- 사용자 영향: **낮음** — 산출물은 정상. 두 화면의 숫자를 비교하기 어렵게 만든다.
- 재현 조건: 항상.
- 미확인 사항: `혼성 화음 그룹`(`vocalPresets.ts:449`)은 프리셋 이름이지 쿼터 필드가 아니므로 이 목록에서 제외했다. 다른 필드(예: `vocalType`의 한국어 라벨)에도 같은 문제가 있는지는 전수 조사하지 않았다.

### [C] 13. 지시문 76 커밋의 "대역 혼재 0건" 단언은 `setDirector` 경로에서만 성립한다

- 위치: 커밋 `6fd5c11` 메시지 TASK A
- 내용: *"실측 3세트 전부 고유 장르 8종 … 대역 혼재 0건"* — 3세트만 측정했고, 그 3세트가 전부 `setDirector` 경로였다. 25세트 × 2경로로 재측정한 결과는 #8에 있다.
- 사용자 영향: **낮음**(문서 정확도) — 실제 영향은 #8로 보고했다.
- 미확인 사항: 커밋이 어느 함수로 측정했는지 스크립트가 남아 있지 않아 추정이다.

### [C] 14. 지시문 78 TASK C의 "성인 7개 아키타입" 표현이 비-kids 11개 중 5개를 제외한다

- 위치: 커밋 `7a20628` 메시지 — *"축 커버리지 (성인 7개 아키타입, breathy/husky/belted/clear/dark)"*
- 내용: 나열된 7개(`oldpop-lounge` / `showa-70s` / `kr-2030-pop` / `jp-2030-pop` / `kr-idol-male` / `kr-idol-female` / `en-chillhop`) 중 6개는 실측 결과 **단언대로 0종 축이 없다.** `showa-70s`만 breathy가 0종이어서 커밋 표(`showa-70s 0종 축 3개 → 0개`)와 직접 어긋난다(#10 표). 다만 kids가 아닌 아키타입은 실제로 13개이고, 나머지 6개(`senior-morning` / `showa-cafe` / `showa-70s` / `j2000s` / `modern-chill` / `lofi-study`)에는 0종 축이 남아 있다.
- 사용자 영향: **낮음**(문서 정확도) — 실제 영향은 #10으로 보고했다.
- 미확인 사항: 커밋이 "성인 7개"를 워크스페이스 기준으로 셌는지 아키타입 기준으로 셌는지. `showa-70s`의 breathy가 0종인 것은 커밋 표(`showa-70s 0종 축 3개 → 0개`)와 직접 모순되므로 재확인이 필요하다.

### [F] 15. `check:gates` 요약줄의 "위반 1"과 "CONTRACT VIOLATION 2건"이 다르다

- 위치: `scripts/checkGateContract.ts`의 요약 출력
- 검증

```
$ cat scripts/audit2/out/gates.txt
✗ CONTRACT VIOLATION  morning-showa-cafe / "70년대 추억이 느껴지는 올드팝"   (bpm-stddev)
✗ CONTRACT VIOLATION  morning-showa-cafe / "70년대 추억이 느껴지는 올드팝"   (bpm-range)
통과 81 / 위반 1  (총 102쌍, ... CONTRACT VIOLATION 2건, ...)
```

"위반 1"은 채널×컨셉 쌍 수, "2건"은 관문 수다. 같은 줄에서 두 단위를 같은 이름으로 쓴다.
- 사용자 영향: **낮음** — CI 로그 판독만 영향. 22종 검사 중 유일하게 exit 1인 검사다.
- 미확인 사항: 없음.

### [E] 16. `.catch(() => 기본값)` 중 사용자에게 잘못된 상태를 보이는 2곳

- 위치
  - `src/components/steps/Step3Generate.tsx:778` — 실패 시 `setReservedSiblingAvoid({ titles: [], hooks: [] })`. 형제 세트가 이미 쓴 제목·훅을 못 읽으면 "회피할 것이 없다"로 진행해 중복 제목이 나올 수 있다. 화면에는 아무 표시가 없다.
  - `src/components/steps/Step2Plan.tsx:275` / `src/components/steps/Step3Generate.tsx:890` — 실패 시 `verifiedCombos = []`. 검증 조합(v3.82의 flagship 오버라이드)이 조용히 비활성화되고 `VerifiedComboPanel`의 "적용됨" 표시와도 어긋날 수 있다.
- 전체 개수: `src/` 전체에서 `.catch(() =>` 42건. 나머지 40건은 목록 로딩 실패 시 빈 목록 표시로, 화면에 "0건"이 그대로 보이므로 조용한 실패로 분류하지 않았다.
- 사용자 영향: **낮음** — IndexedDB 읽기 실패라는 전제 조건을 재현하지 못했다. 코드 경로만 확인했다.
- 미확인 사항: 실제로 이 catch가 발동하는 빈도. 실패를 주입해 검증하지 않았다.

### [F] 17. `senior-oldpop` 워크스페이스의 준비 상태 배지가 상시 `⚠ 2/5`다

- 위치: `src/core/workspaceReadiness.ts:76` — `genreMin = Math.min(...archetypes.map(genrePoolSizeForArchetype))`
- 검증

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts scripts/audit2/f6-readiness-badge.audit.ts --reporter=verbose
senior-oldpop      2/5  X 장르 풀(3종 (기준 ≥4))  O 머니코드 회전 풀(6종)  O lyricTheme 풀(42종)  X audienceProfile 전용(general 폴백 포함)  X 실전 검증(0세트)
   실제 12곡 세트가 쓰는 고유 장르: good-morning-memory-radio=4종, oldpop-lounge-main=4종, lofi-focus-main=12종, city-night-drive=11종, ...
```

`senior-oldpop`은 아키타입 10개(senior-morning ~ kids)를 한 워크스페이스에 묶고 있어 최솟값이 3(showa-cafe/kids/j2000s/modern-chill의 `preferredGenres` 길이)으로 떨어진다. 실제로는 어느 채널도 막히지 않는다.
- 사용자 영향: **낮음** — Step1에서 이 워크스페이스만 경고색으로 보인다. 배지를 눌러 내역을 보면 이유는 정확히 나온다(지시문 12의 원래 요구사항은 충족).
- 미확인 사항: `audienceProfile 전용` 항목이 X인 이유(어느 아키타입이 general 폴백인지)는 추적하지 않았다.

---

## 5. 심각도 없음 (코드상 이상하나 실사용 경로에서 발생하지 않음)

### [D] 18. `suitedArchetypes: 'christmas'` 7건이 채널이 없는 아키타입을 가리킨다

```
$ npx tsx scripts/audit2/d2-id-integrity.ts
vocalPreset warm-mature-male.suitedArchetypes: 실제 채널이 없는 아키타입 "christmas"
vocalPreset soft-female / mature-female / soulful-female / belted-female / male-female-duet / mixed-harmony-group  (동일)
```

`ChannelArchetype` union에는 `'christmas'`가 있지만 `channelPresets`에 해당 채널이 없다. `workspaceReadiness.ts:71-74` 주석이 "프리셋 채널이 하나도 없는 아키타입은 빼고 판정한다"고 명시적으로 다루고 있으므로 의도된 상태로 보인다. 커스텀 채널로 `archetype: 'christmas'`를 만들면 이 태그가 살아난다.

---

## 6. 기존 검사 22종 — 각 검사가 못 보는 것

전부 실행했다(`scripts/audit2/run-checks.sh`, 원본 출력 `scripts/audit2/out/`). `check:gates`만 exit 1, 나머지 21종 exit 0. **어떤 검사도 UI 표시값과 생성값을 대조하지 않는다** — 그래서 §1과 이 보고서의 #1·#2·#3이 전부 남아 있었다.

| # | 검사 | 이 검사가 못 보는 것 |
|---|---|---|
| 1 | `check:node` | node 실행 가능성만 본다. 임포트가 성공한 뒤 그 함수가 실제로 불리는지, 값이 화면과 맞는지는 축이 아니다. 중괄호 없는 화살표 함수는 자기 주석이 인정한 알려진 한계다. |
| 2 | `check:reachability` | "파일이 임포트되는가"만 본다. 임포트된 파일 안의 함수가 호출되지 않는 경우(#5의 프리셋 `prompt`)는 전부 통과한다. |
| 3 | `check:gates` | 관문 통과 가능성만 본다. 통과한 슬롯 배정이 Step2가 보여준 것과 같은지는 대조하지 않는다(#1·#2). 요약줄의 단위 혼용은 #15. |
| 4 | `check:settings` | `VERIFIED_SETTING_CONTRACTS`에 등록된 9종만 본다. 등록되지 않은 설정(보컬 프리셋 우선순위 등)의 유실은 검사 항목 자체가 없다. |
| 5 | `check:archetype` | `archetype === '리터럴'` 하드코딩 개수만 센다. 하드코딩 없이도 생기는 데이터 공백(#10)은 축이 아니다. |
| 6 | `check:coverage` | 19개 축의 "정의가 있는가"만 본다. 정의된 값이 실제 배정에 도달하는지(#4의 `tone-match` 차단)는 보지 않는다. |
| 7 | `check:workspace-registration` | **검사 항목 목록에 없는 파일의 누락을 못 본다**(자기 주석이 지시문 72에서 확인한 한계로 명시). `conceptKeywords.ts`의 `vocalPresetWeights`가 아키타입별로 도달하는지는 항목에 없다. |
| 8 | `check:choices` | 13개 `UserExplicitChoices` 축만 본다. `vocalTone`이 "사용자가 고른 적 없는 채널 기본값"인데 명시적 선택으로 취급되는 경로(#4)는 이 13축의 판정 기준 밖이다. |
| 9 | `check:version` | `package.json` / `CHANGELOG.md` 버전만 본다. 코드와 무관. |
| 10 | `check:budget` | 제약을 나열·집계만 한다(자기 주석: "판정하지 않는다"). 제약끼리의 우선순위 충돌(#4)은 축이 아니다. |
| 11 | `check:genre-overlap` | senior-morning·oldpop-lounge 두 채널의 장르 유사도만 잰다. 다른 채널·다른 축은 범위 밖. |
| 12 | `check:consumption` | "정책 데이터를 읽는 함수의 호출부가 0곳인가"를 grep으로 근사한다. 호출은 되는데 결과가 버려지는 경우(#5)는 잡지 못한다 — 자기 주석이 "진짜 콜그래프 분석은 범위가 아니다"라고 명시. |
| 13 | `check:genre-completeness` | 장르 하나의 필드가 채워졌는지만 본다. 그 장르가 세트에서 몇 곡을 받는지(#2의 15/15 붕괴)는 축이 아니다. |
| 14 | `check:vocal-floor` | 워크스페이스별 대표 채널 1곳에서 `requiredTraits`가 **최소 1곡**에 나타나면 통과다. 나머지 곡이나 다른 채널은 보지 않는다. |
| 15 | `check:vocal-genre-fit` | 장르가 원하는 **성별**과 실제 `vocalType`의 일치율만 잰다. 발성(onset) 축(#4·#5)은 명시적으로 다른 축이라고 자기 주석이 적었다. |
| 16 | `check:concept-coverage` | 한국어 표본 50개만 잰다(1차에서 일본어 0%를 놓친 것과 같은 한계). 매칭 결과가 실제 배정으로 이어지는지는 보지 않는다. |
| 17 | `check:concept-language` | 규칙에 3개 언어 패턴이 있는지만 센다. 그 규칙이 지목한 프리셋이 그 아키타입에 등록됐는지(#10)는 축이 아니다. |
| 18 | `check:genre-fidelity` | export된 팩 JSON 파일 하나를 검사한다. 파일을 넘기지 않으면 아무것도 재지 않는다(이번 실행: 출력 1줄). |
| 19 | `check:genre-utilization` | 컨셉 표본 10개로 **추천이 쓴 장르**를 센다. 추천을 적용하지 않았을 때 실제로 쓰이는 장르(#9)는 축이 아니다. |
| 20 | `check:option-utilization` | 축별로 "①슬롯 ②텍스트 ③관문 ④브릿지" 중 어디에 반영되는지 분류한다. 반영 위치가 화면 표시와 같은 값인지는 보지 않는다. |
| 21 | `check:vocal-technique` | **장르 라이브러리의 `vocal` 필드만** 본다. `vocalPresets.ts`의 `prompt`도, 최종 stylePrompt도 보지 않는다 — #5(408곡 0건)가 이 검사를 통과한 채로 존재한 이유다. |
| 22 | `check:era-palette-conflict` | 팔레트 원자와 exclude 어휘의 모순만 본다. 시대 제약이 장르 배분을 붕괴시키는 것(#2)은 축이 아니다. |

추가로 실행한 2종(package.json에 있으나 지시문 목록에 없음):

| 검사 | 못 보는 것 |
|---|---|
| `check:concept-vocal-axis` | **`en-chillhop` 하나에 대해서만** 프리셋 등록 여부를 출력한다(출력의 `en-chillhop=Y/N` 열). 나머지 15개 아키타입의 공백(#10)과 `tone-match` 차단(#4)은 보이지 않는다. |
| `check:vocal-articulation` | 발성 축의 어휘 정의만 본다. 그 어휘가 프롬프트에 실리는지는 보지 않는다. |

---

## 7. 지시문 §10의 개별 질문에 대한 답

**1. §1과 같은 구조가 다른 값에도 있는가** — 있다. #1(Step2Plan 계획표, 최대 규모), #2(시대 컨셉 장르 구성), #3(§1 본체의 실제 원인), #8·#9. §1.3이 지정한 화면·값별 결과는 §8에 표로 정리했다.

**2. `혼성`/`듀엣` 외 라벨 불일치** — 같은 필드에 네 가지 표기가 있다(#12). 다른 필드의 전수 조사는 하지 못했다.

**3. `vocalPresetWeights`가 `effectiveVocalPresetId`에 도달하는가** — **31개 채널에서는 도달한다.** `after-hours-deep-house`에서 `숨소리 섞인 목소리로 부르는 칠 딥하우스` vs `칠 딥하우스`를 대조한 결과 프리셋 분포가 완전히 다르다(전자 12/15가 `source=concept`, 후자 0/15). 3개 채널에서는 도달하지 않는다(#4).

**4. 지시문 78의 발성 어휘가 stylePrompt에 실리는가** — **경로에 따라 갈린다.** 컨셉 지목(77) 경로에서는 실린다(8곡 중 6회). 프리셋 선택 경로에서는 408곡 0건(#5).

**5. 지시문 74 TASK A의 BPM 섹션 하한이 실제 생성물에 적용되는가** — 브릿지·Batch 경로는 적용된다(`batchPreallocation.ts:1113`). **로컬 생성 경로는 적용되지 않는다.** 111~125 BPM 곡 97개 전부가 하한 11 미달(실측 최대 10섹션)이다(#6).

**6. 지시문 76의 2대역 브리지가 실제 세트에서 동작하는가** — `setDirector` 경로에서는 25세트 전부 동작(혼재 0건, 고유 8종). 직접 생성 경로에서는 25세트 중 9세트가 64~68 BPM과 124~127 BPM을 함께 낸다(#8).

**7. `fixed-pool` vs `concept-generated`** — **주석과 코드는 모순되지 않는다.** `buildMultiSetClaudeCodeMasterInstruction`(`bridgeInstruction.ts:2227-2238`)의 시그니처에는 `conceptSceneContext` 파라미터가 없고 내부에서 만들지도 않는다. 따라서 `bridgeInstruction.ts:297`의 *"master mode … never passes a conceptSceneContext at all today"*는 정확하다. `Step3Generate.tsx:1132`의 `conceptSceneContext: bridgeConceptSceneContext`는 마스터 호출부가 아니라 **preflight/관문 memo의 인자**다(마스터 호출부는 `Step3Generate.tsx:1412-1422`이고 인자 9개에 `conceptSceneContext`가 없다). 남는 실제 사실: 멀티세트 마스터 모드는 컨셉이 있어도 항상 `fixed-pool`로 해석되어, 같은 컨셉이 단일세트와 멀티세트에서 다른 장면 계획을 쓴다. 이것은 문서화된 의도이며 결함으로 보고하지 않는다.

**8. `securityAudit.test.ts` / `finalizeBlueprintPersistGate.test.ts`가 왜 실패하는가** — **지금은 둘 다 통과한다.**

```
$ npx vitest run tests/securityAudit.test.ts tests/finalizeBlueprintPersistGate.test.ts
 Test Files  2 passed (2)
      Tests  31 passed (31)
```

`d9ff331` 커밋 메시지가 남긴 원인("nanoid 빌드도구 취약점 1건")은 `a67448a fix: npm audit high 1건 해소 — nanoid 3.3.17 → 3.3.18`에서 해소됐다. 실패는 더 이상 존재하지 않는다.

**9. 원격 브랜치** — 현재 56개이고 **`origin/main`에 머지되지 않은 것은 5개**다.

```
$ git branch -r --no-merged origin/main
origin/agent/hotaimusic-media-hardening    (앞선 커밋 11개)
origin/backup/instruction-18-pre-rebase    (3개)
origin/feat/instruction-18                 (3개)
origin/feat/instruction-25                 (1개)
origin/fix/ui-freeze-generation-import     (6개)
```

내용이 `main`에 실제로 있는지 파일 단위로 확인했다:

| 브랜치 | 판정 |
|---|---|
| `feat/instruction-18` / `backup/instruction-18-pre-rebase` | **내용 있음** — `scripts/checkVersion.ts` · `tests/checkVersion.test.ts` · `tests/agentComparison.test.ts` · "하루 스튜디오" 문자열 모두 `main`에 존재. 리베이스로 SHA만 다르다. |
| `fix/ui-freeze-generation-import` | **내용 있음** — `src/workers/localGenerationWorker.ts` · `src/core/localGenerationClient.ts` 모두 `main`에 존재. |
| `feat/instruction-25` | **미머지 작업 있음** — `src/data/musicGlossary.ts` · `src/data/genrePhraseKo.ts` 가 `main`에 없다(장르·조합 설명 카드, 14파일 +1595줄). |
| `agent/hotaimusic-media-hardening` | **미머지 작업 있음** — `desktop/` 디렉터리 전체와 `src/components/MediaPipelinePanel.tsx`가 `main`에 없다(11커밋, +1083줄). |

지시문이 명시한 5개 중 `fix/valid-archetypes-en-chillhop`(`e97be22`) · `fix/npm-audit-nanoid`(`a58feeb`) · `chore/start-studio-branch-main`(`bf1447a`) · `audit/stress-test-20260723`은 전부 머지 완료다. `agent/hotaimusic-media-hardening`만 미머지다.

---

## 8. §1.3이 지정한 화면·값별 조사 결과

| 화면 | 값 | 미리보기와 생성이 같은 함수·인자를 쓰는가 | `opts`에 저장되는가 | 결과 |
|---|---|---|---|---|
| Step1 | 준비 상태 배지 n/5 | 해당 없음(생성값이 아니라 데이터 가용성) | — | #17(낮음) |
| Step2 | 보컬 비율 미리보기(숫자) | 예 — 같은 시드·같은 `deriveVocalQuotaFromGenrePlan` | 아니오(하류 재계산) | 기본 조건 일치. 시대 컨셉에서 어긋남 → #2 |
| Step2 | 보컬 비율 카드 문구(reasonKo) | **아니오** — 쏠림 미반영 | 아니오 | **#3** |
| Step2 | AI 보컬 추천 목록 | 예 | **예** — `vocalPresetPlan`으로 저장 | 문제 없음(§9 참고) |
| Step2 | 장르 구성 표시 | 예(장르 칩 자체는 `opts.genreIds`) | 예 | 시대 컨셉에서 붕괴 → #2 |
| Step2 | 컨셉 매칭 결과 | 예 — `recommendConceptLocal` 동일 | 적용 버튼 필요 | 미확인(§10) |
| Step2 | 계절/무드 표시 | — | 예 | 문제 없음. `kr-2030-rap`만 id 결함 → #11 |
| Step2 | 다양성 축 패널 | Step2Plan의 `plan.allocations` | **`[설계 적용]` 필요** | **#1** |
| Step2Plan | "18곡 계획" 표 | **아니오** — `directSetLocal` vs `preallocateSongSlots` | **`[설계 적용]` 필요** | **#1 · #8 · #9** |
| Step3 | 보컬 배분 | 예 — `bridgePreassignedSongs` 그대로 집계 | — | 문제 없음(Step2와 어긋나는 것은 Step2 쪽 원인) |
| Step3 | 음역/창법 요약 | 예 | — | 문제 없음 |
| Step3 | 장르 후보 수 | 예 | — | 문제 없음 |
| Step3 | 생성 진행률 | 미확인 | — | 미확인(§10) |
| Step4 | SetCompletenessPanel | 실제 산출물 집계 | — | 라벨만 불일치 → #12 |
| Step4 | PromiseAuditPanel | 실제 산출물 집계(`fullAudit`) | — | 분류 로직 정상. `vocal_preset_variety`가 3채널에서 영구 실패 → #4 |

---

## 9. 조사했으나 문제를 찾지 못한 영역

명시적으로 재고, 문제가 없었던 것들이다.

1. **`opts.vocalPresetPlan`의 왕복** — Step2가 저장한 추천 프리셋 계획이 생성에 실제로 적용된다. 15/15 트랙에서 `vocalPresetSource='plan'`, `effectiveVocalPresetId`가 계획 순서와 완전히 일치.
   ```
   $ npx tsx scripts/audit2/f1b-lean-divergence.ts
   vocalPresetSource 분포: {"plan":15}
   추천 plan이 그대로 실린 트랙: 15/15
   ```
   지시문 49 TASK C가 고친 "다시 추천을 눌러야만 저장되던" 결함은 재발하지 않았다.

2. **타입 union ↔ 런타임 화이트리스트 8쌍 전수** — 불일치 0건. `VALID_ARCHETYPES`(17) · `VALID_MARKETS`(4) · `VALID_LYRIC_LANGUAGES`(4, 3개 파일에 중복 정의) · `VALID_AGE_GROUPS`(7) · `VALID_KIDS_AGE_TIER_IDS`(3) · `VALID_RATINGS`(3).
   ```
   $ npx tsx scripts/audit2/d1-union-vs-runtime.ts
   OK  ChannelArchetype(17) vs VALID_ARCHETYPES@src/utils/channelProfile.ts(17)
   ... 문제 0건
   ```

3. **보컬 프리셋 33종의 픽커 도달성** — 어떤 아키타입 픽커에도 노출되지 않는 프리셋 0종. `suitedArchetypes` 하드 필터가 프리셋을 통째로 가두는 경우는 없다.
   ```
   $ npx tsx scripts/audit2/g7-dup-and-reach.ts
   ② 프리셋 총 33종
      어떤 아키타입 픽커에도 노출되지 않는 프리셋: 0종
   ```

4. **`conceptKeywords.ts`의 id 참조 무결성** — `vocalPresetWeights` / `genreWeights`가 가리키는 프리셋·장르 id 중 존재하지 않는 것 0건. `VOCAL_FAMILY_BY_PRESET_ID`도 0건. (`check:concept-vocal-axis`의 "실존하지 않는 프리셋 id: 0건"과 일치.)

5. **`securityAudit.test.ts` / `finalizeBlueprintPersistGate.test.ts`** — 31개 테스트 전부 통과(§7-8).

6. **`bridgeInstruction.ts:297` 주석의 사실 여부** — 정확하다(§7-7). 지시문이 모순으로 지목한 것은 서로 다른 호출부였다.

7. **무한 루프** — `src/`의 `while` 루프 중 상한이 명시되지 않은 20곳을 표본으로 읽었다. 모두 감소 변수(`remainingToPlace -= 1`) 또는 `break` 탈출로 종료가 보장된다(`constraints.ts:914`, `generationGate.ts:183` 등). 결함을 찾지 못했다.

8. **`PromiseAuditPanel`의 분류 로직** — `classify()`(`PromiseAuditPanel.tsx:49-56`)가 기준선 없는 실패를 `'new'`로 처리하고, 그것이 `belowTarget`에 합산되어 `⚠ 신규`로 표시된다. 실패가 통과로 보이는 경로 없음.

9. **`applyVocalOnsetPhrasing`의 절 개수 유지** — 신설 프리셋의 중복(#7)을 제외하면 `budget` 컷이 정상 동작해 절 개수가 늘지 않는다.

10. **`vocalText`의 성별 정합성** — `tone-match` 채널에서 `effectiveVocalPresetId`가 어긋나도(#4) `vocalText` 자체는 그 트랙의 `vocalType`과 일치한다. 프롬프트 본문은 틀리지 않는다.

---

## 10. 조사하지 못한 영역

시간·도구 제약으로 남긴 것이다.

1. **실제 브라우저 UI로 화면을 띄워 대조하지 못했다.** 이 감사의 대조는 전부 `Step2Concept.tsx` / `Step2Plan.tsx`가 부르는 것과 **같은 함수를 같은 인자로** 스크립트에서 재현하는 방식이다. React 상태 타이밍(예: `vocalRecommendationSeed`가 `useState` 초기값으로 한 번만 계산되므로 `projectTitle`을 Step2에서 바꾸면 미리보기 시드가 낡는다 — 코드상 확인했으나 실행으로 재현하지 못했다)은 이 방식으로 잡히지 않는다.
2. **§8.4의 "워크스페이스별 세트 1건씩 실제 생성 후 UI 대조"를 CLI로만 수행했다.** 브라우저를 띄우지 않았으므로 화면에 실제로 렌더된 문자열이 아니라 그 문자열을 만드는 표현식을 재현했다.
3. **Step3의 생성 진행률**은 조사하지 못했다(비동기 진행 상태라 스크립트 재현 경로를 만들지 못했다).
4. **Step2의 컨셉 매칭 결과 패널**은 `recommendConceptLocal`이 미리보기·적용 모두 같은 함수임을 확인했으나, 적용 버튼 경로(#1과 같은 구조인지)는 확인하지 못했다.
5. **유형 A(계산하고 버림)의 74~78 전수**를 다 보지 못했다. `parseSongsJsonForViewer` 계열(지시문 68 TASK C의 원형)을 다시 훑지 않았고, 74~78 중 "섹션 수 검사"(#6) · "중복 절 검사"(정상 배선 확인) · "발성 라우팅"(#4·#5) · "프리셋 축 배정"(#10)만 봤다. **"인트로 부정형 판정"은 조사하지 못했다.**
6. **`.catch(() => …)` 42건 중 40건**은 코드만 읽고 실패를 주입해 검증하지 않았다.
7. **라벨 일관성**은 `VocalQuota.mixed` 한 필드만 전수 조사했다. 다른 필드(장르 라벨, 구조 템플릿 이름, 아키타입 한국어명 등)는 보지 않았다.
8. **1차 감사가 "문제를 찾지 못했다"고 적은 영역을 알 수 없어** 중복 조사를 피하지 못했을 가능성이 있다(§0).
9. **`applyEraQuota`가 만드는 장르 붕괴(#2)가 `directSetLocal` 경로에서도 일어나는지** 재지 않았다.
10. **`en-chillhop` 외 워크스페이스의 대역 혼재**는 재지 않았다(지시문 76이 en-chillhop 전용이므로 범위를 그렇게 잡았다).

---

## 11. 재현 방법

```bash
git checkout audit/consistency-stress-2nd
npm ci
npm run typecheck

# 기존 검사 22종 (+2종) 전부
sh scripts/audit2/run-checks.sh          # 출력은 scripts/audit2/out/ 아래

# tsx로 바로 도는 스크립트 (Vite 전용 임포트를 타지 않는 것들)
npx tsx scripts/audit2/f1-vocal-quota-divergence.ts
npx tsx scripts/audit2/f1b-lean-divergence.ts
npx tsx scripts/audit2/f2-sweep-quota.ts
npx tsx scripts/audit2/f3-genre-collapse.ts
npx tsx scripts/audit2/g1-concept-vocal.ts
npx tsx scripts/audit2/g2-tonematch-blocks-concept.ts
npx tsx scripts/audit2/g3-tonematch-gender.ts
npx tsx scripts/audit2/g4-vocab-in-prompt.ts
npx tsx scripts/audit2/g5-dump-song.ts
npx tsx scripts/audit2/g6-vocab-paths.ts
npx tsx scripts/audit2/g7-dup-and-reach.ts
npx tsx scripts/audit2/d1-union-vs-runtime.ts
npx tsx scripts/audit2/d2-id-integrity.ts
npx tsx scripts/audit2/d3-concept-vocal-reach.ts
npx tsx scripts/audit2/d4-family-by-archetype.ts

# vitest가 필요한 것 (setDirector/bridgeInstruction이 Vite `?worker` 임포트를 끌어온다)
npx vitest run --config scripts/audit2/vitest.audit2.config.ts --reporter=verbose
```

`scripts/audit2/` 아래 스크립트는 전부 읽기 전용이다. `git diff main --name-only -- src/` 는 비어 있다.
