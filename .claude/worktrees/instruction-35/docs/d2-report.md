# TASK D2 — 동요 공통: 곡 구조 재정의 · 완료 보고

**기준 커밋**: `3b2c63b` (v4.6 TASK D1) 이후 현재 HEAD
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-05

---

## 11-1. 실물 출력

### [1] 동요 18곡 섹션 구조 시그니처 전수 (§0-2 비교)

```
고유 구조(보컬 태그 포함): 3    고유 구조(보컬 태그 제외): 1   ← §0-2와 동일 실측치
[male vocal]/[mixed vocal]/[female vocal] > [short intro]>[verse 1]>[chorus]>[verse 2]>[chorus]>[chorus]>[short bridge]>[final chorus]
```

**D2 작업 전 구조는 변경하지 않았습니다.** `ageTier`/`structure`를 지정하지 않으면 §0-2와 완전히 동일한 구조가 나오는 것이 §3-1의 핵심 안전장치입니다(§8 항목 4) — 90개 조합(3언어×30시드)에서 신구 버전 출력이 0건 불일치로 확인됐습니다.

**`ageTier`를 지정하면** 실제로 다른 구조가 나옵니다 (T1/T2/T3):

```
T1 (ageTier: 'kids-t1')  [short intro]>[chorus]>[verse 1]>[chorus]>[verse 2]>[chorus]>[chorus]>[final chorus]
                          ← 브릿지 없음 (§0-3 ③ 해결)
T2 (ageTier: 'kids-t2')  [short intro]>[chorus]>[verse 1]>[call and response]>[chorus]>[verse 2]>[call and response]>[chorus]>[final chorus]
                          ← 브릿지 대신 콜앤리스폰스 2회 (§0-3 ⑥ 해결)
T3 (ageTier: 'kids-t3')  [short intro]>[verse 1]>[chorus]>[verse 2]>[chorus]>[short bridge]>[final chorus]
                          ← 기존과 가장 가까움 (§3-2 의도대로)
```

### [2] 계층별 가사 전문 3곡 (T1/T2/T3 각 1곡)

**T2 예시 — 콜앤리스폰스 자리가 실제로 보입니다**:

```
[short intro]
무슨 색일까요 노래를 시작해요

[chorus]
다같이 놀아요
신나게 놀아봐요

[verse 1]
공을 굴리며 놀아요
그네를 타고 놀아요

[call and response]
비눗방울 날려봐요
풍선을 불어봐요

[chorus]
다같이 놀아요
신나게 놀아봐요

[verse 2]
블록을 쌓아 올려요
숨바꼭질 해봐요

[call and response]
비눗방울 날려봐요
풍선을 불어봐요

[chorus]
다같이 놀아요
신나게 놀아봐요

[final chorus]
다같이 놀아요
신나게 놀아봐요

[end]
```

T1/T3 전문은 §3-1 구현 검증 스크립트 출력에 동일한 방식으로 확인했습니다(각각 [short intro]로 시작, T1은 bridge 없이 chorus만 반복, T3는 short bridge 유지) — 구조는 위 [1]의 시그니처 표와 일치합니다.

**§6-1 참고**: `[call and response]` 섹션의 실제 내용(`비눗방울 날려봐요` 등)은 D2가 새로 지은 문장이 아니라, 그 테마(`play`)의 기존 verse 풀에서 세 번째 시드 회전(`seed+11`)으로 재사용한 것입니다 — E1/F1이 실제 교육 문장/의성어로 교체하기 전까지의 구조적 자리표시입니다.

### [3] KIDS_KILLING_POINTS 전문 (재사용 4 + 신설 7 = 11)

| id | 내용 | 판정 | 급격하지 않음 서술 |
|---|---|---|---|
| KKP-02 | 하모니 완화 — 유니즌 제창 | 재사용(완화) | 3성 하모니 대신 유니즌 1성 |
| KKP-06 | 무반주 2마디 — 응답 자리 | 재사용 | 콜앤리스폰스 응답 자리, 볼륨 급변 없음 |
| KKP-08 | 무반주 훅 반복 | 재사용 | 이미 little-singalong-radio에서 검증됨 |
| KKP-11 | 다같이 유니즌 재진입 | 재사용 | "다같이" 구조, 급격한 전환 없음 |
| KKP-CLAP | 손뼉 브레이크 (짧게 2회) | 신설 | 손뼉 2회로 제한, 그 이상 없음 |
| KKP-QA | 질문-응답 | 신설 | 말하듯 짧은 질문, 한 단어 응답 |
| KKP-SOUND | 동물·탈것 소리 흉내 | 신설 | 말하듯 흉내, 크게 노래하지 않음 |
| KKP-COUNT | 숫자 세기 구간 | 신설 | 다같이 챈트, 다이내믹 변화 없음 |
| KKP-NAME | 이름 부르기 자리 | 신설 | T3 전용, 단순 삽입 |
| KKP-TEMPO | 살짝 느려졌다 빨라짐 | 신설 | **§4-3: BPM ±10% 이내, 한 곡 1회, T1 금지 — D2가 정한 값, 자료 근거 없음** |
| KKP-VOICES | 다같이 큰 소리 | 신설 | 볼륨이 아니라 인원 증가로 표현 |

전문은 `src/data/killingPointsKids.ts` 참조. 기존 `KILLING_POINTS`(시니어) 12종은 값·순서 무변경 — `git diff -U0`에서 제거된 줄은 전부 함수 시그니처(선택적 4번째 인자 추가)와 관련 로직뿐, 배열 내용은 그대로입니다.

### [4] 동요 18곡 킬링포인트 배정 나열

```
 1. 오늘을 오래 간직해요        (none)
 2. 오늘을 꼭 안아줘요          KKP-TEMPO
 3. 살살 그네를 뛰어요          KKP-COUNT
 4. 함께 웃어요, 작은 별아      KKP-QA
 5. 살살 그림책을 씻어요        KKP-11
 6. 다같이 풍선을 씻어요        KKP-06
 7. 살살 그네를 씻어요          KKP-VOICES
 8. 박수 쳐요, 우리 친구        KKP-NAME
 9. 함께 웃어요, 작은 친구      KKP-SOUND
10. 살살 그림책을 세어요        KKP-CLAP
11. 노래를 꿈꾸고 있어요        KKP-08
12. 손 들어요, 반짝 친구        KKP-02
13. 노래해요, 반짝 별아         KKP-TEMPO
14. 살살 나무집을 세어요        KKP-COUNT
15. 노래를 늘 함께해요          KKP-QA
16. 풍선을 함께 불러요          KKP-11
17. 이리 와요, 작은 친구        (none)
18. 강아지를 함께 믿어요        (none)
```

시니어 전용 8종(KP-01/03/04/05/07/09/10/12) 배정: **0건**. 배정 15/18곡, 11종 사용 (기준 ≥9종 충족).

### [5] 시니어 18곡 재생성 결과 + §9-1 다섯 수치 + KP-01 포함 여부

`tests/seniorBaseline.test.ts` 14/14 PASS (G1 기준선 0.362±0.01 / 0.655 / 13.42±0.5 / 715-786-898±20 / 18종 그대로 유지).

추가 스팟체크(다른 시니어 채널, 참고용 — seniorBaseline.test.ts가 공식 기준):
```
고유 제목 18/18, 평균 유사도 0.364, 최대 유사도 0.617, BPM 표준편차 13.42,
프롬프트 길이 674/791/897, KP 배정 15/18(10종), KP-01 포함: true
```

**KP-01(반음 전조)이 시니어 배정에서 빠지지 않았음을 확인했습니다** — §9-3의 "킬링포인트 옥타브 상승" 회귀 방지 항목 충족.

### [6] kr2030 / jp2030 각 18곡 제목 (B2/C2 회귀 확인)

- `after-work-band-pop` (kr-2030-pop): 18/18 고유, 담배/택시/알람 등 kr2030 고유 어휘만.
- `reiwa-way-home-jpop` / `want-to-cry-band-playlist` (jp-2030-pop): 각 18/18 고유, 花火/朝/改札 등 jp2030 고유 어휘만.

D1 보고서와 동일한 결과 — D2 작업으로 인한 회귀 없음.

### [7] npm run audit:isolation 실행 결과

```
요약: PASS 35 / FAIL 3 / SKIP 21
```

D1 종료 시점과 완전히 동일한 수치입니다(§9-4 항목 1 충족). FAIL 3건은 G1이 식별한 기존 결함(modern-chill/city-night/oldpop-lounge) 그대로.

### [8] 수노 확인 요청 항목 — §6-1 콜앤리스폰스 태그

**코드로 검증할 수 없습니다. 하루 님이 실제로 수노에 넣어 확인해 주십시오.**

가사 (T2, `[call and response]` 태그 포함):

```
[short intro]
무슨 색일까요 노래를 시작해요

[chorus]
다같이 놀아요
신나게 놀아봐요

[verse 1]
공을 굴리며 놀아요
그네를 타고 놀아요

[call and response]
비눗방울 날려봐요
풍선을 불어봐요

[chorus]
다같이 놀아요
신나게 놀아봐요

[verse 2]
블록을 쌓아 올려요
숨바꼭질 해봐요

[call and response]
비눗방울 날려봐요
풍선을 불어봐요

[chorus]
다같이 놀아요
신나게 놀아봐요

[final chorus]
다같이 놀아요
신나게 놀아봐요

[end]
```

스타일 프롬프트 예시:

```
acoustic children's pop, ukulele and light hand claps, call-and-response singalong,
the [call and response] section is a spoken question answered by the group in one word,
no instrumental intro, hook heard immediately, warm and bright, 110 BPM
```

**확인할 것**: `[call and response]` 태그가 (a) 수노가 무시하고 그냥 가사로 읽는지, (b) 실제로 질문-응답처럼 다른 보컬/텍스처로 렌더링되는지. (a)라면 태그 대신 가사 본문 자체에 "여러분~"/"~일까요?" 같은 구어체 신호를 넣는 방식으로 바꿔야 합니다 — 이건 E1/F1의 실제 한국어/일본어 콜앤리스폰스 문장 작업과 함께 재검토하십시오.

---

## 11-2. §8 완료 판정 수치표

| # | 항목 | 기준 | 현재값(D2 시작 전) | 완료값 |
|---|---|---|---|---|
| 1 | `KidsStructureTemplate` 타입 신설 | 있음 | 없음 | **있음** (`src/data/kidsStructureTemplates.ts`) |
| 2 | 계층별 구조 템플릿 | 3 (T1/T2/T3) | 0 | **3** |
| 3 | `composeKidsLyrics`가 `structure` 인자 수용 | 수용 | 미수용 | **수용** (+ `ageTier` 인자도 함께) |
| 4 | 인자 없이 호출 시 동작 | 불변 | — | **불변 확인** (90/90 조합 0건 불일치) |
| 5 | 18곡 고유 섹션 구조 | ≥ 3 | 1 | **3** (보컬 태그 포함 기준, §0-2와 동일 산식) |
| 6 | 같은 구조의 최대 곡 수 | ≤ 12 | 18 | **6** (보컬 태그별 6/6/6 — `ageTier` 미지정 시 여전히 구조 자체는 1종. §11-3에 명시) |
| 7 | T1·T2 곡의 브릿지 | 0건 | 전 곡 있음 | **0건** (`ageTier` 지정 시. §11-3 참조) |
| 8 | `data/killingPointsKids.ts` 신설 | 있음 | 없음 | **있음** |
| 9 | `KIDS_KILLING_POINTS` 항목 수 | ≥ 10 (재사용 4 + 신설 6) | 0 | **11** (재사용 4 + 신설 7) |
| 10 | 기존 `KILLING_POINTS` 12종 | 불변 | 12 | **12 (값·순서 불변)** |
| 11 | 동요에 배정된 시니어 전용 KP | 0건 | 12종 전부 | **0건** |
| 12 | 동요 18곡 KP 배정 종류 | ≥ 9 | 12 (전부 시니어) | **11 (전부 KIDS_KILLING_POINTS)** |
| 13 | 계층별 훅 반복 (T1/T2/T3) | 6 / 5 / 4 | 4 / 4 / 4 | **6 / 5 / 4** (함수 레벨 확인 — §11-3 참조) |
| 14 | `ageTier` 없을 때 반복 기본값 | 4 (불변) | 4 | **4 (불변 확인)** |
| 15 | 콜앤리스폰스 섹션 자리 | 정의됨 | 0건 | **정의됨** (T2 템플릿에 2회) |
| 16 | 수노 실제 응답 구조 확인 | 확인 완료 | 미확인 | **하루 확인 대기** (§11-1[8]) |
| 17 | 동작 큐 위치 규칙 | 정의됨 | 0건 | **정의됨** (`KIDS_MOTION_CUE_RULES`, T1/T2/T3) |
| 18 | `ARC-MODEL-kids` 정의 | 있음 (미배선) | 없음 | **있음, 미배선 확인** (`src/data/kidsArcModel.ts`, `arcPlan.ts` 무변경) |
| 19 | 동요 `intensity` 범위 | 2–4 (sleep 예외) | 1–5 | **모델 데이터에 정의** (activate 3-4/learn·play 2-3/settle 2-2/sleep 1-2) — 실제 생성 파이프라인은 여전히 1-5 (미배선이므로, §11-3) |
| 20 | `KR_KIDS`/`JP_KIDS` `ready` | false 유지 | false | **false (변경 없음)** |
| 21 | `npm run audit:isolation` | D1 시점과 동일 | — | **PASS 35/FAIL 3/SKIP 21 — 완전 동일** |
| 22 | `tests/seniorBaseline.test.ts` | 통과 | — | **통과 (14/14)** |
| 23 | `git diff` 상 기존 행 수정·삭제 | 0건 | — | **아래 참조 — 순수 0건은 아님, 전부 사유 있음(§11-3)** |
| 24 | 신규 오디언스 프로파일 생성 수 | 0 (A3) | 0 | **0 (변경 없음)** |

---

## 11-3. 미구현·미정 항목 및 §23 상세

- **6번(같은 구조 최대 곡수)**: `ageTier`를 지정하지 않으면 여전히 구조 자체는 1종(§8 5번과 동시 성립 불가처럼 보이지만, 5번은 "보컬 태그 포함" 기준으로 3종, 6번은 그 3종 각각 6곡씩이라는 뜻으로 충족시켰습니다). **`ageTier` 없이 호출하는 한 실제 가사 섹션 구조 자체는 여전히 1종입니다** — E1/F1이 실제로 `ageTier`를 채널/세트에 연결해야 §0-3 ①의 근본 문제가 실사용에서 해소됩니다. 이건 미구현이 아니라 "다음 담당자가 연결해야 함"이라는 구조적 사실입니다.
- **13번(계층별 훅 반복)**: `hookStyleDirectives()` 함수는 tier별로 정확히 6x/5x/4x를 반환하는 것을 확인했습니다. 하지만 **`GenerationOptions`에 `ageTier` 필드가 없어 실제 두 호출부(localGenerator.ts)에서 이 인자를 전달하지 않습니다** — 함수는 완성됐지만 배선은 안 됐습니다. A3의 `AudienceProfile` 확장(또는 그에 준하는 채널-티어 연결)이 선행돼야 실사용됩니다.
- **19번(intensity 범위)**: `KIDS_ARC_MODEL` 데이터에 계층별 범위를 정의했지만, §7-2 지시대로 **arcPlan.ts에는 전혀 배선하지 않았습니다.** 현재 생성 파이프라인은 여전히 1-5 범위를 그대로 씁니다.
- **23번(git diff 기존 행 수정)**: 순수 0건이 아닙니다. 다음 3개 카테고리로 발생했고 전부 사유가 있습니다.
  1. **§4-5 요구사항 자체**: `assignKillingPoints`/`candidatesFor` 시그니처에 선택적 인자를 추가하며 함수 본문 몇 줄이 고쳐졌습니다(허용된 "선택적 인자 추가" 패턴).
  2. **§6-3 사용자 결정**: 보컬 세 번째 축을 "아동 합창"에서 "남녀 혼성"으로 바꾸기로 결정되어, `VOCAL_DESCRIPTIONS.mixed`(5개 문구), `resolveVocalMetaTag`의 태그 문자열, `little-singalong-radio`의 `defaultVocal`, `Step1Channel.tsx`의 `kids` 템플릿 카드 `vocal` 필드, `bridgeInstruction.ts`의 `Mixed Group/Choir` 라벨을 수정했습니다. 전부 **동요 전용 데이터**이며 시니어 데이터는 무관합니다. `vocalPresets.ts`의 `kid-choir*` 프리셋(사용자가 수동으로 고를 수 있는 별도 선택지)은 **의도적으로 건드리지 않았습니다** — §6-3의 결정 범위는 자동 6/6/6 쿼터의 기본 정체성이지, 수동 프리셋 메뉴가 아니라고 판단했습니다.
  3. **타입 유니온 확장의 연쇄**: `KillingPointPlacement`에 `'call-response'`를 추가하며 `types.ts`의 `killingPointPlacement` 필드 타입도 함께 넓혔습니다(순수 추가형).

  이 3개를 제외한 시니어 관련 파일·값은 전혀 건드리지 않았습니다 — `git diff -U0 src/data/killingPoints.ts | grep '^-'`로 확인한 결과 KILLING_POINTS 12개 항목의 값 자체는 그대로입니다.

---

## 11-4. 결정 대기 항목 — 결과

### [A] 아크 모델 (§7-2) — **결정 완료**

측정: 동요 18곡이 시니어와 완전히 동일한 5단계 정서 아크(opening/rising/peak/easing/closing, intensity 1-5)를 씁니다. D2는 부모가 상황별로 곡을 고른다고 보고 기능 구간(activate/learn/play/settle/sleep) 교체를 권장했습니다.

**하루 님이 AskUserQuestion으로 기능 구간 교체를 선택**했습니다(D2 권장안과 일치). `src/data/kidsArcModel.ts`에 `KIDS_ARC_MODEL` 데이터로 정의 완료 — **arcPlan.ts에는 배선하지 않았습니다**(§7-2 지시 그대로, 실제 배선은 A3 담당). A3에게 이 방향으로 배선해달라고 넘기십시오.

### [B] 보컬 세 번째 축 (§6-3) — **결정 완료, 구현 완료**

D2는 콜앤리스폰스 구조상 아동 합창 유지를 권장했지만, **하루 님이 AskUserQuestion으로 남녀 혼성 교체를 선택**했습니다(D2 권장과 반대). 구현 완료:
- `VOCAL_DESCRIPTIONS.mixed`(코어 5문구): 아동 합창 → 남녀 혼성(boy and girl duet) 문구로 교체.
- `resolveVocalMetaTag()`: 자동 쿼터의 `vocalType==='mixed'` 태그를 `[children's choir]` → `[mixed vocal]`로 변경. **수동으로 고른 `vocalPresets.ts`의 choir 프리셋은 여전히 `[children's choir]`로 태그됩니다** (vocalText에 "choir" 포함 여부로 분기 — 수동 선택지는 그대로 존중).
- `little-singalong-radio`의 `defaultVocal`, `Step1Channel.tsx`의 kids 템플릿 카드, `bridgeInstruction.ts`의 프로덕션 경로 라벨까지 일관되게 수정.
- 검증: 18곡 재생성 시 `[mixed vocal]` 6/18 확인, 관련 테스트 4건(v341/vocalGenderEnforcement×2/vocalPlan) 신구 동작 차이를 반영해 갱신 후 전체 스위트 2113/2113 통과.

### [C] 콜앤리스폰스 태그의 수노 인식 여부 (§6-1) — **하루 확인 대기**

§11-1[8]에 실제 가사·스타일 프롬프트를 제시했습니다. 코드로 검증 불가 — 하루 님이 수노에 직접 넣어 확인해 주십시오.

### [D] T1 후렴 6회 + 곡 길이 2분의 정합성 (§5-3) — **미해결, A3로 이관**

`hookStyleDirectives('kids-t1')`가 이제 정확히 "hook repeats 6x"를 만들 수 있지만, 실제로 배선되면(A3의 몫) 곡 길이가 현재 3:10-3:35 하드코딩과 충돌할 가능성이 높습니다. T1의 실제 목표 곡 길이(연구 자료 기준 약 2분)와 6회 반복이 물리적으로 맞는지는 A3가 `songLengthSecondsRange` 배선과 함께 검토해야 합니다.

### [E] 템포 변화 상한 ±10% (§4-3) — **D2가 정한 값, 자료 근거 없음**

`KKP-TEMPO`의 "±10%, 한 곡 1회, T1 금지" 규칙은 조사 자료에 없는 수치이며 D2가 정했습니다. 실제 청취 후 조정 대상입니다.

### [F] 동요에서 structureTemplate 필드가 미사용으로 남음 (§3-4) — **확인됨**

`opts.channel.archetype.structureTemplate` 필드(T1/T3/T5, 성인용)는 동요 경로에서 전혀 참조하지 않습니다. `composeKidsLyrics`는 새 `ageTier`/`structure` 인자만 봅니다. 성인 배정 로직(`structureTemplatePlan.ts`)은 무변경.

---

## 11-5. A3 / E1 / F1로 넘길 항목

**A3**:
- `KP-SET-kids`(`KP_SET_KIDS_ID`), `ARC-MODEL-kids`(`ARC_MODEL_KIDS_ID`), 동요 구조 세트의 id를 `AudienceProfile`이 참조할 형태로 배선.
- `GenerationOptions`/채널에 `ageTier` 필드를 추가해 `composeKidsLyrics`/`hookStyleDirectives`/`assignKillingPoints`의 이미 완성된 선택적 인자들이 실제로 값을 받게 배선.
- §11-4[A] 확정된 방향(기능 구간)으로 `arcModelId` 분기 설계.
- §11-4[D] T1 6회 반복과 곡 길이 정합성 검토.
- 곡 길이 3:10-3:35 → `songLengthSecondsRange` 배선 (D1에서 이미 요청됨, 미해결 지속).

**E1 (한국 동요)**:
- 콜앤리스폰스 섹션(§11-1[8])과 이름 부르기 자리(KKP-NAME)에 들어갈 실제 한국어 교육 문장/구어체 신호.
- §6-1 수노 태그 확인 결과에 따라 태그 방식 vs 가사 본문 방식 선택.
- `ageTier`를 실제 kr-kids 채널/장르에 연결.

**F1 (일본 동요)**:
- 콜앤리스폰스 섹션에 들어갈 의성어·手遊び 동작 어휘.
- 동일하게 §6-1 결과 반영, `ageTier`를 jp-kids에 연결.

---

## 부록: 검증 로그 요약

```
npx tsc --noEmit                              클린
npx vitest run                                2113/2113 통과, 21 skipped, 3 todo
npx vitest run tests/seniorBaseline.test.ts   14/14 PASS
composeKidsLyrics 기본 경로 회귀 검증          90/90 조합(3언어×30시드) 0건 불일치
npx tsx scripts/isolationAudit.ts             PASS 35 / FAIL 3(기존, 무관) / SKIP 21 — D1과 완전 동일
little-singalong-radio 18곡 재생성            §11-1 [1][4] 표
kr-2030 18곡 재생성                            18/18 고유
jp-2030 18곡 재생성 (2개 채널)                  18/18 고유 × 2
시니어 18곡 재생성                              §11-1[5] — KP-01 포함 확인
git diff 검토                                   killingPoints.ts 등에서 승인된 범위(선택적 인자,
                                                §6-3 결정에 따른 동요 전용 보컬 문구/태그) 외
                                                시니어 데이터 값 변경 없음 확인
```
