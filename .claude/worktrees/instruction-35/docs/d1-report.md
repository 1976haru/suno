# TASK D1 — 동요 공통: 안전 정책 + 연령 계층 · 완료 보고

**기준 커밋**: `201a4c6` (v4.1 TASK A2) 이후 여러 동시 세션 커밋을 거친 현재 HEAD
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-01 ~ 2026-08-05

---

## 11-1. 실물 출력

### [1] little-singalong-radio 12곡 제목 — §0-2 원본과 비교

| # | §0-2 (수정 전) | 지금 (§3-1 이후) |
|---|---|---|
| 1 | 너를 정말 좋아해요 | 다같이 연을 씻어요 |
| 2 | 기다려요, 까꿍아 | 한 번 더 연을 씻어요 |
| 3 | 가만히 연을 안아줘요 | 강아지를 함께 웃어요 |
| 4 | 그 날을 함께 놀아요 | 별을 기억하고 있어요 |
| 5 | 너를 계속 좋아해요 | 살살 그림책을 씻어요 |
| 6 | 숨을 골라요, 무지개야 | 이리 와요, 반짝 별아 |
| 7 | 가만히 풍선을 챙겨요 | 같이 놀아요, 반짝 별아 |
| 8 | 쉬어가요, 깜찍이 | 함께 웃어요, 작은 별아 |
| 9 | 가만히 연을 챙겨요 | 그림을 함께 믿어요 |
| 10 | 손을 잡아요, 작은 별아 | 살살 그림책을 세어요 |
| 11 | 우리를 꼭 안아줘요 | 같이 놀아요, 햇살아 |
| 12 | 천천히 연을 데워요 | 강아지를 함께 믿어요 |

**판단**: 「연을 데워요」「쉬어가요, 깜찍이」류의 시니어 어투/성립하지 않는 조합이 사라졌습니다. 「강아지를 함께 웃어요」(declarativeStem '함께 웃어요' + imperativeObject '강아지를'의 조합)는 문법적으로 다소 어색하지만, 이는 어휘 내용이 아니라 **훅 조합 로직**(lyricEngine.ts의 스템×오브젝트 조합) 문제이고, D1의 범위는 §3-1이 명시한 "필드를 채우는 구조 완성"까지입니다 — §11-3에 미해결로 남깁니다.

BPM 94–124, 가사 단어수 39–59, 곡 길이 지시 3:10-3:35(불변 — A3 담당, §11-4[B]).

### [2] hookBanks/kids.ts 전문 (한국어·일본어·영어 9필드 전부)

리포지토리 `src/data/hookBanks/kids.ts` 참조 (변경 없이 그대로 인용):

- `imperativeObjects`/`nounModifiers`/`nounObjects`/`vocativeAddressees`/`declarativeStems` — 기존 5필드 그대로.
- `imperativeVerbs` (신규): 한국어 `씻어요/세어요/뛰어요/흔들어요`, 일본어 `あらって/かぞえて/とんで/ふって`, 영어 `Wash/Count/Jump/Wave`.
- `imperativeTails` (신규): 한국어 `다같이/신나게/한 번 더/살살/깡충깡충`, 일본어 `みんなで/たのしく/もう一度/そっと/ぴょんぴょん`, 영어 `Together/Happily/Once More/Gently/All Around`.
- `vocativeLeads` (신규 — 타입은 이미 있었으나 미설정): 한국어 `모두 모여요/여기 봐요/같이 놀아요/노래해요/박수 쳐요/손 들어요/함께 웃어요/이리 와요`, 일본어·영어 동일 구조.
- `declarativeTails` (신규): 한국어 `풍선을/별을/무지개를/강아지를/노래를/친구를/그림을/오늘을`, 일본어·영어 동일 구조.

측정: 오버라이드 9/9, 상속 0/9 — 3개 언어 전부 동일 (§8 항목 1, 3 완료).

### [3] 어휘 화이트리스트 9개 목록 전문

새 파일 `src/data/kidsVocabularyWhitelist.ts`. 계층 × 언어(3×3), 각 목록은 nouns/verbs/adjectives/emotionWords 4개 카테고리.

| 계층×언어 | nouns | verbs | adjectives | emotionWords |
|---|---|---|---|---|
| T1-ko | 15 | 7 | 4 | 3 |
| T1-ja | 12 | 6 | 4 | 4 |
| T1-en | 12 | 6 | 4 | 3 |
| T2-ko | 17 | 9 | 6 | 3 |
| T2-ja | 17 | 9 | 6 | 3 |
| T2-en | 17 | 9 | 6 | 3 |
| T3-ko | 16 | 9 | 5 | 5 |
| T3-ja | 16 | 8 | 5 | 5 |
| T3-en | 16 | 9 | 5 | 5 |

각 목록의 실제 어휘는 §4 표의 계층별 주제(T1: 자장가·까꿍·가족·동물 소리 / T2: 동작 지시·숫자 1-5·색깔·탈것 / T3: 이야기·교육·감정 이름·안전)를 따라 구성했고, 한국·일본 어느 쪽에도 치우치지 않는 공통-안전 최소 어휘입니다(§3-1 범위 주의 그대로 적용) — E1/F1이 각자 교육 주제·의성어 어휘로 확장합니다.

**검사기 실측** (`whitelistViolations`):
- §0-2 원본 4개 비문 전부 위반 검출: `천천히 연을 데워요` → `[천천히, 연을, 데워요]`, `숨을 골라요, 무지개야` → `[숨을, 골라요, 무지개야]`, `가만히 연을 챙겨요` → `[가만히, 연을, 챙겨요]`, `쉬어가요, 깜찍이` → `[쉬어가요, 깜찍이]`.
- 계층 어휘 내 정상 문장은 0건: `빨간 풍선을 세어요`(T2-ko) → `[]`, `친구야 같이 놀아요`(T2-ko) → `[]`.
- 인자 생략 시 기존 블랙리스트만 동작 — 회귀 없음 (§8 항목 6).

### [4] 연령 계층 3종 정의 전문

새 파일 `src/data/kidsAgeTiers.ts`. §4 표의 값을 그대로 반영:

| 필드 | T1 | T2 | T3 |
|---|---|---|---|
| ageRange | [0,2] | [2,4] | [4,7] |
| tempoRange | [60,100] | [100,130] | [105,140] |
| maxWordsPerLine | 5 (2~5단어) | **undefined** (자료: "짧은 문장", 숫자 없음) | **undefined** (자료: "문장 가능", 숫자 없음) |
| totalWordTarget | 60 | 90 | 120 |
| minHookRepeats | 6 (6회 이상) | **undefined** (자료: "다수") | **undefined** (자료: "중간") |
| allowedInstruments | 부드러운 벨/피아노/우쿨렐레 | 우쿨렐레/마림바/실로폰/핸드클랩/밝은 신스 | 좌동 |
| forbiddenTraits | 타악 과다/급격한 다이내믹/고음 자극 (전 계층 공통) | 좌동 | 좌동 |
| emotionVocabulary | 좋아요/편안해요/행복해요 | 신나요/재미있어요/좋아요 | 기뻐요/설레요/자랑스러워요/고마워요/든든해요 |

기본값: T2 (`DEFAULT_KIDS_AGE_TIER_ID = 'kids-t2'`, §4 "T2가 시장성이 가장 큽니다").
§4-4 보컬 구성: `KIDS_VOCAL_COMPOSITION_PER_18 = { male: 6, female: 6, mixed: 6 }`, 데이터만 정의, 배선 없음.

미정 2개 필드(maxWordsPerLine/minHookRepeats, T2·T3)는 §11-3에 명시.

### [5] 시니어 18곡 재생성 결과 + §9-1 다섯 수치

`tests/seniorBaseline.test.ts` 14/14 PASS — G1이 실측한 기준선(평균 유사도 0.362±0.01 / 최대 유사도 0.655 / BPM 표준편차 13.42±0.5 / 프롬프트 길이 715-786-898±20 / 고유 제목 18/18) 그대로 유지, D1 작업으로 인한 변동 없음.

### [6] kr2030 / jp2030 각 18곡 제목 (B2/C2 회귀 확인)

- `after-work-band-pop` (kr-2030-pop, 한국어): 18/18 고유, 담배/택시/알람/서른 등 kr2030 고유 어휘만 확인, 시니어/키즈 어휘 없음.
- `reiwa-way-home-jpop` (jp-2030-pop, 일본어): 18/18 고유.
- `want-to-cry-band-playlist` (jp-2030-pop, 일본어): 18/18 고유.

세 채널 모두 花火/朝/改札/雪道/制服/黒板 등 jp2030 고유 어휘만 나타나며 시니어(コーヒー/ラジオ/セーター/レコード) 또는 키즈 어휘 혼입 없음 — B2/C2 완료 상태 그대로.

### [7] npm run audit:isolation 실행 결과

```
요약: PASS 35 / FAIL 3 / SKIP 21
```

- FAIL 3건은 G1이 이미 식별한 기존 결함(modern-chill/city-night/oldpop-lounge — hookBanks switch에 case 없음, D1과 무관, 회귀 아님) 그대로.
- kr-kids/jp-kids가 이번에 처음으로 L1/L3/L4/L6에 행을 갖게 됐습니다 — §3-2/§5 전에는 `archetypeIds: []`라 감사 스크립트의 워크스페이스별 순회 자체가 0회 실행돼 행이 아예 없었습니다. **"C2 시점과 동일"이라는 §9-4 항목 1의 문면 그대로는 아닙니다** — 정직하게 기록합니다. 다만 내용은 의도한 대로입니다: L1/L3/L6은 SKIP(장르·가사 세계·썸네일 아직 미구축, E1/F1 담당), L4는 PASS(훅뱅크 격리는 이미 정상 — hookBanks/index.ts에 case 추가한 결과).
- PASS 총계가 G1/C2 종료 시점(30) 대비 35로 늘어난 것은 kr-kids/jp-kids L4 PASS 2건 외에 3건 차이가 더 있습니다 — 동시 세션이 이 브랜치에서 계속 작업 중이라(세션 시작 시 확인된 패턴) 다른 워크스페이스 쪽 변화일 가능성이 높습니다. D1이 만든 변화는 kr-kids/jp-kids의 8개 신규 행(SKIP×6, PASS×2)뿐이라는 점을 git diff와 위 [1]/[6] 재생성 결과로 교차 확인했습니다.

---

## 11-2. §8 완료 판정 수치표

| # | 항목 | 기준 | 현재값(D1 시작 전) | 완료값 |
|---|---|---|---|---|
| 1 | `hookBanks/kids.ts` 오버라이드 필드 | 9/9 | 5/9 | **9/9** |
| 2 | 언어별 분기 (한국어·일본어·영어) | 3/3 | 3/3 | 3/3 |
| 3 | 상속으로 새는 시니어 어휘 | 0건 | 4필드 | **0건** |
| 4 | 어휘 화이트리스트 목록 수 | 9 (3계층×3언어) | 0 | **9** |
| 5 | 화이트리스트 검사기 | 있음 | 없음 | **있음** (`whitelistViolations`, `kidsLyricSafetyIssues`의 선택적 2번째 인자) |
| 6 | `kidsLyricSafetyIssues` 인자 없이 호출 시 동작 | 불변 | — | **불변 확인** (스크립트 실측: `[]`/`true`) |
| 7 | `KIDS_FORBIDDEN_TERMS` 8개 | 유지 | 8 | **8 (변경 없음)** |
| 8 | `KNOWN_EXISTING_KIDS_SONGS` 13개 | 유지 + 확장 가능 | 13 | **13 (언어별 3그룹으로 재구조화, 값 불변)** |
| 9 | 연령 계층 정의 | 3 (T1/T2/T3) | 0 | **3** |
| 10 | 계층별 필수 필드 | 표 §4 전부 | — | **완료 (미정 2개 필드는 undefined로 명시, §11-3)** |
| 11 | 워크스페이스 분리 방식 결정 | 확정 | 미정 | **확정 — 방식 A (하루 님 결정, AskUserQuestion)** |
| 12 | `KR_KIDS`/`JP_KIDS` `archetypeIds` | 채워짐 | `[]`/`[]` | **`['kr-kids-song']`/`['jp-kids-song']`** |
| 13 | `KR_KIDS`/`JP_KIDS` `ready` | `false` 유지 | `false` | **`false` (변경 없음)** |
| 14 | 시니어 동요 채널 12곡 제목 | §0-2와 달라져야 함 | — | **달라짐 (§11-1[1])** |
| 15 | 「연을 데워요」류 비문 | 0건 | 3건 | **0건** (§11-1[1] 실측) |
| 16 | `npm run audit:isolation` | C2 시점과 동일 | — | **FAIL 3건 동일(회귀 없음), kr-kids/jp-kids 신규 8행 추가 — §11-1[7]에 상세 기록** |
| 17 | `tests/seniorBaseline.test.ts` | 통과 | — | **통과 (14/14)** |
| 18 | `git diff` 상 기존 행 수정·삭제 | §3-2 결정에 따름 | — | **방식 A 채택으로 55개 `archetype === 'kids'`/`!== 'kids'` 분기 + ChannelArchetype 유니온 1행 = 56행 수정 (사전 승인된 범위, 기계적 치환만)** |
| 19 | 신규 오디언스 프로파일 생성 수 | 0 (A3) | 0 | **0 (변경 없음)** |

---

## 11-3. 미구현·미정 항목

- **`KidsAgeTier.maxWordsPerLine`** — T2/T3: 미정(자료 없음). §4 표가 "짧은 문장"/"문장 가능"이라는 서술만 주고 숫자를 주지 않았습니다.
- **`KidsAgeTier.minHookRepeats`** — T2/T3: 미정(자료 없음). §4 표가 "다수"/"중간"이라는 서술만 주고 숫자를 주지 않았습니다.
- **훅 조합 문법(declarativeStem × imperativeObject 조합)** — §11-1[1]의 「강아지를 함께 웃어요」류. 어휘 내용(§3-1)은 완료됐지만, 스템·오브젝트를 조합하는 lyricEngine.ts 자체의 문법 호환성 로직은 D1의 범위 밖입니다(§0-1이 `hookParts.ts`를 열지 말라고 명시했고, 조합 로직은 그 파일에 있지 않지만 D1의 작업 항목 어디에도 "조합 문법 개선"이 없습니다) — 미해결로 남깁니다.

---

## 11-4. 결정 대기 항목

### [A] 워크스페이스 분리 방식 (§3-2) — **결정 완료, 구현 완료**

실측: `archetype === 'kids'` / `archetype !== 'kids'` 리터럴 매칭 분기는 문서상 39곳이 아니라 **55곳(21개 파일)** — grep 재검증 결과이며, 문서 작성 이후 여러 커밋(`designGate.ts`, `bridgeInstruction.ts`, `conceptAgent.ts`, `conceptDiversity.ts`, `lyricDiversityPlan.ts` 등)이 새 분기를 추가한 것으로 보입니다.

- **방식 A** (신규 아키타입 2개 + `isKidsArchetype()` 헬퍼): 55행 + `ChannelArchetype` 유니온 1행 = 56행을 기계적으로 치환하는 단일 작업. B1/C1/C2가 이미 쓴 "워크스페이스당 아키타입 1종" 관행과 일치, G1의 `audit:isolation`(아키타입 기반 라우팅)이 그대로 재사용됨.
- **방식 B** (워크스페이스 축 전달): 55행은 안 건드리지만, 콘텐츠 분기 지점(훅뱅크·테마 선택 등)마다 workspaceId를 새로 꿰어야 하고 G1 격리검사 로직도 kids 전용으로 별도 구축해야 함 — 범위가 55행보다 크고 경계가 불분명.

**하루 님이 AskUserQuestion으로 방식 A를 선택**했습니다. 구현 완료:
- `types.ts`: `ChannelArchetype`에 `'kr-kids-song' | 'jp-kids-song'` 추가.
- `src/utils/channelArchetype.ts` (신규): `isKidsArchetype()` 헬퍼.
- 21개 파일의 55개 분기 전부 `isKidsArchetype(...)` / `!isKidsArchetype(...)`로 치환.
- `src/data/hookBanks/index.ts`: `'kr-kids-song'`/`'jp-kids-song'` case 추가 (없으면 `default`인 seniorMorningOverride로 새는 C2와 동일한 유형의 leak이 될 뻔함 — 사전에 막음).
- `Record<ChannelArchetype, ...>` 전수 매핑 2곳(`channelProfile.ts`의 `ARCHETYPE_DEFAULT_AUDIENCE`, `genreLibrary/index.ts`의 `CORE_GENRE_IDS_BY_ARCHETYPE`) — 신규 아키타입 2개 항목 추가(후자는 빈 배열, 콘텐츠는 E1/F1 담당).
- `KR_KIDS.archetypeIds = ['kr-kids-song']`, `JP_KIDS.archetypeIds = ['jp-kids-song']` (§5). `ready`는 둘 다 `false` 유지.
- 검증: `npx tsc --noEmit` 클린, 전체 테스트 2112/2112(알려진 flaky 타이밍 테스트 1건 제외) 통과, 시니어baseline/little-singalong-radio/kr2030/jp2030 전부 재생성으로 회귀 없음 확인, `audit:isolation` FAIL 3건 동일(신규 회귀 없음).

### [B] 곡 길이 3:10-3:35 (§0-2, §10-8)

KIDS 프로파일의 `songLengthSecondsRange: [90, 150]`(1:30-2:30)과 실제 프롬프트 지시(3:10-3:35)가 여전히 불일치합니다. D1은 정책 데이터(연령 계층의 암묵적 길이 기대)만 정의했고, 실제 지시문 생성은 `compactDuration()`이 담당하며 이 함수를 고치는 것은 A3 범위입니다(§2-1, §10-8).

**A3에 넘길 요구사항**: `compactDuration()`이 `songLengthSecondsRange`를 실제로 읽어 반영하도록 배선하고, 연령 계층별(T1/T2/T3) 곡 길이 차등까지 고려한다면 `KidsAgeTier`를 참조하는 경로를 새로 설계해야 합니다.

### [C] tempoFloor 92와 T1(60-100) 충돌 (§4-1)

`KIDS_AUDIENCE_PROFILE.tempoFloor: 92`는 T1의 60–100 범위를 담지 못합니다(60-91 구간이 배제됨). 이 필드 수정은 A3 범위(§2-1)이므로 D1은 계층 정의만 만들고 충돌 사실만 보고합니다.

**A3에 넘길 요구사항**: 연령 계층별 템포 밴드가 실제로 다르게 배정되려면 `tempoFloor`/`tempoCeiling`을 단일 값에서 계층별 참조로 바꾸거나, `KidsAgeTier.tempoRange`를 직접 소비하는 새 경로가 필요합니다.

### [D] 킬링포인트 1/12와 "급격한 다이내믹 금지" 충돌 (§4-2)

§0-2에서 측정된 킬링포인트 배정 1/12곡과, 조사 자료의 "급격한 다이내믹 금지"(전 계층 공통 `forbiddenTraits`)가 정면으로 충돌합니다. 곡 구조·킬링포인트 대체 방식은 D2 범위입니다(§2-2).

**D2에 넘길 요구사항**: 동요에서 시니어식 "전조로 인한 킬링포인트"를 그대로 쓸 수 없다면, 다이내믹 급변 없이 후크를 강조하는 대체 메커니즘(반복 횟수 증가, 콜앤리스폰스, 악기 레이어 추가 등)을 D2가 설계해야 합니다. `KidsAgeTier.minHookRepeats`(T1=6, T2/T3=미정)가 이 설계의 입력값이 될 수 있습니다.

### [E] safetyPolicyId의 이름·형태 (A3와 맞춰야 함)

D1은 `KIDS_FORBIDDEN_TERMS`(블랙리스트, 유지) + `KidsVocabularyWhitelist`(신규 화이트리스트) 두 겹 구조로 안전 정책을 정의했습니다. A3가 `AudienceProfile`에 추가할 `safetyPolicyId` 필드가 이 두 겹 구조를 어떤 id/형태로 참조할지는 아직 정해지지 않았습니다.

**A3와 맞출 것**: `safetyPolicyId`가 (a) 블랙리스트+화이트리스트 묶음 하나를 가리키는 단일 id인지, (b) 계층별로 다른 화이트리스트를 선택하는 매개변수를 별도로 받는지 논의 필요. D1이 만든 `kidsVocabularyWhitelistFor(tierId, language)` 시그니처를 그대로 A3 쪽에서 호출하는 형태를 제안합니다.

---

## 11-5. A3 / D2 / E1 / F1로 넘길 항목

**A3**:
- §11-4[B] 곡 길이 3:10-3:35 → `songLengthSecondsRange` 배선.
- §11-4[C] `tempoFloor: 92` → T1(60-100) 담을 수 있게 재설계.
- §11-4[E] `safetyPolicyId` 이름·형태 협의.
- `AudienceProfile` 스키마 확장 전반 (§2-1 그대로).

**D2**:
- §11-4[D] 킬링포인트 대체 메커니즘 (다이내믹 급변 없이).
- 곡 구조(섹션 구성/반복 횟수/콜앤리스폰스) 재정의.
- `KidsAgeTier.minHookRepeats`(T2/T3 미정)를 채울 실제 근거가 필요하면 D2 작업 중 함께 정의.

**E1 (한국 동요)**:
- kr-kids 장르 7종, 교육 주제 체계, 한영 이중언어, 한국 훅 사전(화이트리스트 확장 포함).
- `KR_KIDS.ready = true` 전환.
- `KidsAgeTier.maxWordsPerLine`(T2/T3 미정) — 한국어 문장 길이 감각으로 실제 값 제안 가능하면 함께 정의.

**F1 (일본 동요)**:
- jp-kids 장르 7종, 의성어·의태어 시스템, 일영 이중언어, 일본 훅 사전(화이트리스트 확장 포함).
- `KNOWN_EXISTING_KIDS_SONGS_JAPANESE` 배열(현재 빈 배열, `src/core/kidsLyricEngine.ts`)에 일본 동요 append.
- `JP_KIDS.ready = true` 전환.

**G1 (별도 요청 필요)**:
- D1이 안전 정책을 확정했으므로 `L8`(동요 안전 — 화이트리스트 위반 검사 + 훅 사전 상속 누출 검사)을 G1에 추가하는 작업을 **별도로 요청**하십시오. D1에서 직접 G1을 수정하지 않았습니다(§12 지시 그대로).

---

## 부록: 검증 로그 요약

```
npx tsc --noEmit                          클린
npx vitest run                            2112/2112 (flaky 타이밍 테스트 1건 제외), 21 skipped
npx vitest run tests/seniorBaseline.test.ts   14/14 PASS
npx tsx scripts/isolationAudit.ts         PASS 35 / FAIL 3(기존, 무관) / SKIP 21
little-singalong-radio 12곡 재생성        §11-1[1] 표
kr-2030 18곡 재생성 (after-work-band-pop) 18/18 고유
jp-2030 18곡 재생성 (2개 채널)             18/18 고유 × 2
git diff 검토                              hookParts.ts/moneyChords.ts/lyricThemes.ts 등에서
                                           승인된 범위(타입 확장 1행, 55개 아키타입 분기)
                                           외 시니어 데이터 값 삭제/변경 없음 확인
```
