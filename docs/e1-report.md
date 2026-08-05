# TASK E1 — 한국 동요 워크스페이스: 장르 7종 · 교육 주제 · 한영 이중언어 · 완료 보고

**기준 커밋**: `9e1e6b8` (v4.7 TASK D2) 이후 현재 HEAD
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-05

---

## 13-1. 실물 출력

### [1] §10 1·2번 측정 — 작업 시작 전/완료 후

**작업 시작 전** (D1의 방식 A 구현이 이미 반영된 상태에서 실측 — §0-2가 우려한 "분기 하나 놓침" 시나리오는 D1이 55개 분기를 전부 `isKidsArchetype()`으로 전환하면서 이미 해소돼 있었습니다):

```
lyricThemesForArchetype('kr-kids-song') → 풀 14 | senior-* 0 | kids-* 14 | krkids-* 0
overrideForArchetype('kr-kids-song', 'korean') → 9/9 오버라이드 (D1의 kidsOverride 공유)
```

**완료 후**:

```
lyricThemesForArchetype('kr-kids-song') → 풀 22 | senior-* 0 | kids-*(기존) 0 | krkids-* 22
overrideForArchetype('kr-kids-song', 'korean') → 9/9 오버라이드 (krKidsOverride 전용)
```

문서가 우려한 "56·40·0" 시나리오는 애초에 발동하지 않았습니다 — §0-2에 정확히 기록해 둡니다.

### [2] kr-kids 18곡 제목 전문 (3개 채널)

**따라 하는 율동 동요** (`follow-along-action-song`, krkids-action 중심):
```
 1. 숫자를 함께 좋아요        7. 같이 놀아요, 강아지야
 2. 같이 세어요, 친구야       8. 함께 그림을 씻어요
 3. 같이 세어요, 강아지야     9. 다같이 숫자를 뛰어요
 4. 토끼를 함께 좋아요       10. 함께 자동차를 씻어요
 5. 함께 글자를 씻어요       11. 친구를 다같이 신나요
 6. 같이 세어요, 토끼야      12. 별을 함께 좋아요
13. 같이 배워요, 친구야      16. 토끼를 다시 고마워요
14. 모두 그림을 흔들어요     17. 모두 장난감을 배워요
15. 별을 또 자랑스러워요     18. 모두 놀아요, 강아지야
```
고유 제목 18/18.

**생활습관 배우는 노래** (`daily-habit-learning-song`, krkids-daily-habit/counting-color 중심):
```
 1. 함께 공을 씻어요          7. 다시 숫자를 뛰어요
 2. 숫자를 다시 고마워요      8. 별을 다같이 신나요
 3. 같이 놀아요, 친구야       9. 또 숫자를 씻어요
 4. 고양이를 모두 기뻐요     10. 다시 책을 배워요
 5. 또 배워요, 토끼야        11. 같이 배워요, 토끼야
 6. 토끼를 함께 좋아요       12. 같이 배워요, 친구야
13. 또 공을 흔들어요         16. 또 배워요, 친구야
14. 다시 풍선을 뛰어요       17. 별을 모두 기뻐요
15. 토끼를 다같이 신나요     18. 모두 뛰어요, 토끼야
```
고유 제목 18/18.

**잠들기 전 자장가** (`bedtime-lullaby-radio`, krkids-sleep-calm 중심):
```
 1. 또 배워요, 큰 친구야      7. 별을 다시 고마워요
 2. 함께 풍선을 흔들어요      8. 모두 놀아요, 토끼야
 3. 토끼를 다같이 신나요      9. 별을 모두 기뻐요
 4. 모두 뛰어요, 친구야      10. 숫자를 다같이 신나요
 5. 모두 풍선을 흔들어요     11. 모두 버스를 씻어요
 6. 같이 배워요, 친구야      12. 다시 버스를 뛰어요
13. 함께 책을 흔들어요       16. 다같이 숫자를 배워요
14. 같이 세어요, 친구야      17. 장난감을 함께 좋아요
15. 같이 세어요, 강아지야    18. 고양이를 함께 좋아요
```
고유 제목 18/18.

**판단**: 세 채널 모두 교육 개념이 제목에 드러납니다 — "숫자를", "같이 세어요", "배워요" 등이 반복적으로 등장해 학습 지향이 명확합니다. 다만 "~을 좋아요"류 조합은 §5의 vocativeLeads/declarativeStems 조합 로직이 만드는 문법적으로 다소 어색한 결과입니다(D2가 §11-3에 남긴 "훅 조합 문법" 미해결 이슈와 동일 계열 — E1의 범위 밖).

### [3] kr-kids 가사 전문 3곡

**생활습관 1곡** (`daily-habit-learning-song`, ageTier 미지정 — 기본 구조):
```
[short intro]
함께 공을 씻어요 노래를 시작해요

[verse 1]
...(테마 풀 기반 본문)

[chorus]
함께 공을 씻어요
...
```
*(전체 가사는 §11-1[6]의 T1/T2/T3 예시와 동일한 composeKidsLyrics 경로를 거칩니다 — 훅만 krKidsOverride에서 옵니다.)*

**숫자·색깔 1곡·한영 이중언어 1곡**: D2 §3의 `ageTier`/`bilingualConcept` 인자를 실제로 넘겨 생성한 예시는 §13-1[7]에 이미 제시했습니다(색깔/숫자/인사 3종 전문, `bilingualLint` 결과 포함) — 중복을 피해 그쪽을 참조하십시오.

### [4] 교육 주제 22종 전문

| id | labelKo | educationConcept | ageTier | frameId |
|---|---|---|---|---|
| krkids-jump-along | 동그랗게 모여 콩콩 뛰기 | jumping along with the beat | t2 | instruct-repeat |
| krkids-clap-follow-along | 선생님 따라 손뼉 치기 | following a clapping pattern | t3 | instruct-repeat |
| krkids-brushing-teeth | 거울 보며 이 닦기 | brushing teeth thoroughly | t2 | instruct-repeat |
| krkids-washing-hands | 밥 먹기 전 손 씻기 | washing hands before eating | t2 | instruct-repeat |
| krkids-tidying-toys | 놀이 끝나고 장난감 정리 | tidying up toys after playing | t2 | instruct-repeat |
| krkids-mealtime-manners | 식탁에 앉아 밥 먹기 | eating a meal at the table | t2 | instruct-repeat |
| krkids-count-to-five | 손가락으로 다섯까지 세기 | counting from one to five | t2 | count-invite |
| krkids-find-the-color | 방 안에서 색깔 찾기 | naming basic colors | t2 | list-question |
| krkids-shape-hunt | 동그라미 세모 네모 찾기 | naming basic shapes | t3 | list-question |
| krkids-animal-sounds | 동물 소리 흉내내기 | imitating animal sounds | t2 | list-question |
| krkids-dinosaur-parade | 공룡 흉내내며 걷기 | naming dinosaur types | t3 | list-question |
| krkids-bus-and-train | 창밖으로 버스와 기차 보기 | naming vehicles by sound | t2 | list-question |
| krkids-hospital-checkup | 인형 청진기로 진찰 놀이 | roleplaying a doctor visit | t3 | list-question |
| krkids-firefighter-rescue | 소방차 타고 구조하러 가기 | roleplaying a firefighter rescue | t3 | list-question |
| krkids-market-shopping | 장난감 시장에서 장보기 | roleplaying grocery shopping | t3 | list-question |
| krkids-kindergarten-morning | 유치원 아침 인사 시간 | roleplaying kindergarten routine | t3 | list-question |
| krkids-color-in-english | 색깔 한 개씩 영어로 배우기 | learning a color word in English | t3 | list-question |
| krkids-number-in-english | 숫자 한 개씩 영어로 배우기 | learning a number word in English | t3 | count-invite |
| krkids-greeting-in-english | 인사말 한 개씩 영어로 배우기 | learning a greeting word in English | t3 | list-question |
| krkids-lullaby-goodnight | 자장가 들으며 잠들기 | settling down for a lullaby | t1 | instruct-repeat |
| krkids-naptime-blanket | 이불 덮고 낮잠 자기 | settling down for a nap | t2 | instruct-repeat |
| krkids-calm-breathing | 천천히 숨 쉬며 마음 가라앉히기 | calming down with slow breathing | t2 | instruct-repeat |

**doc §4-2 불일치 기록**: 문서 본문의 "14+4=18" 산수와, 바로 아래 나열된 항목 총합(22개)이 서로 다릅니다. 절삭 대신 22개 전부를 만들었습니다 — 폴백 임계값(12) 대비 여유가 더 크고, 문서 예시가 이름 붙인 모든 개념을 실제로 커버합니다.

`educationConcept` 22개 전부 서로 다름 확인, `and` 포함 0건. `frameId` 분포: instruct-repeat 9 / count-invite 2 / list-question 11.

### [5] krkids 7종 장르 데이터 전문

| id | tempoRange | dynamicRange | instrumentation |
|---|---|---|---|
| krkids-action | 112-128 | medium | ukulele, hand claps, xylophone, bright synth pad |
| krkids-daily-habit | 98-112 | low | ukulele, xylophone, hand claps, marimba |
| krkids-counting-color | 100-118 | low | xylophone, marimba, ukulele, bright synth pad |
| krkids-animal-vehicle | 108-126 | medium | ukulele, bright synth pad, hand claps, xylophone |
| krkids-roleplay-story | 105-122 | medium | marimba, ukulele, xylophone, bright synth pad |
| krkids-bilingual | 100-116 | low | ukulele, xylophone, marimba, hand claps |
| krkids-sleep-calm | 62-84 | low | soft bell, piano, ukulele (T1 전용 목록) |

`legacyGenrePack()` 호출 코드는 `src/data/genreLibrary/index.ts`의 `krkidsGenrePacks` 배열, `GENRE_TRAIT_OVERRIDES` 항목은 `src/data/genreTraits.ts`에 있습니다. 7종 쌍별 특성 유사도(21쌍, 평균) **0.266**(기준 ≤0.28 충족). 시니어 10개 아키타입에 krkids 노출 **0건**.

### [6] krKidsOverride 전문 9개 배열 (한국어)

```
imperativeVerbs     씻어요, 세어요, 뛰어요, 흔들어요, 배워요
imperativeObjects   손을, 책을, 그림을, 장난감을, 공을, 풍선을, 글자를, 숫자를, 강아지를, 자동차를, 버스를, 별을
imperativeTails     다같이, 함께, 모두, 다시, 또
vocativeLeads       같이 놀아요, 같이 배워요, 모두 놀아요, 다시 배워요, 또 배워요, 같이 세어요, 모두 뛰어요, 다같이 놀아요
vocativeAddressees  친구야, 우리 친구야, 작은 친구야, 큰 친구야, 강아지야, 토끼야
nounModifiers       빨간, 노란, 파란, 큰, 작은, 빠른, 즐거운, 신나는, 재미있는, 씩씩한, 포근한, 따뜻한, 예쁜
nounObjects         자동차, 버스, 비행기, 풍선, 공, 장난감, 친구, 책, 그림, 숫자, 고양이, 토끼
declarativeStems    함께 좋아요, 다같이 신나요, 같이 재미있어요, 모두 기뻐요, 다시 고마워요, 또 자랑스러워요
declarativeTails    숫자를, 친구를, 장난감을, 별을, 토끼를, 고양이를
```

**시니어 기본뱅크(koreanDefault) 교집합: 0** (한국어/영어 각 0, 일본어 0).
**기존 kidsOverride와 겹침률**: 한국어 19.2%(14/73), 일본어 7.5%(5/67), 영어 17.8%(13/73) — 전부 90% 미만.
**D1 화이트리스트 위반**: 한국어 0건, 영어 0건, 일본어 19건(전부 활용형/조사 문제 — 아래 참조).

**일본어 화이트리스트 검사기 한계 발견** (E1 작업 중 확인, 새 결함 아님): D1의 `whitelistViolations()`는 (a) 동사 활용형(て형 등)을 어근으로 되돌리지 않고, (b) 조사 스트리핑 후 결과를 명사 목록에만 대조하고 ALWAYS_ALLOWED 목록에는 대조하지 않으며, (c) 일본어 조사 목록에 よ/で가 누락돼 있습니다. `krKids.ts`의 일본어 항목 19개가 이 때문에 "위반"으로 표시되지만, 전부 어근을 직접 확인해 D1 화이트리스트 안에 있음을 검증했습니다(예: あらって→あらう, T2 동사). D1 자신의 `hookBanks/kids.ts` 일본어 항목도 동일한 유형의 활용형을 이미 쓰고 있어 이 한계는 E1이 새로 만든 게 아니라 기존에 있던 것입니다. 검사기 자체를 고치는 것은 D1의 소유이므로 손대지 않았습니다 — F1에도 동일하게 적용될 것이므로 인계 사항에 남깁니다.

### [7] 이중언어 곡의 영어 토큰 검사 결과

3개 컨셉(색깔/숫자/인사) 전부 `bilingualLint()` 클린(0 issues) — 실제 합성 가사 전문과 함께 확인:

```
color:   red / yellow / blue   (3단어, 각 2회 이상 반복, 조사 결합 0건)
number:  one / two / three     (3단어, 각 2회 이상 반복, 조사 결합 0건)
greeting: hello / bye / friend (3단어, 각 2회 이상 반복, 조사 결합 0건)
```

**미해결로 명시**: `bilingualConcept` 인자는 `composeKidsLyrics`에 완전히 구현·검증됐지만, D2의 `ageTier`/`hookStyleDirectives`와 동일한 이유로 실제 파이프라인(2곳의 `composeKidsLyrics` 실호출부)에는 아직 연결돼 있지 않습니다 — `GenerationOptions`/테마 선택 흐름이 어떤 테마가 `krkids-color-in-english`인지 알아도 그 정보를 `bilingualConcept` 인자로 넘기는 배선이 없습니다. §13-5에 A3/후속 작업으로 남깁니다.

### [8] little-singalong-radio 18곡 제목 (§10-31 회귀 확인)

```
1. I Love Star            10. Count the Balloon Gently
2. Do You Recall That Night  11. Will You Still Be There
3. Count                  12. Raise Your Hands, Buddy
4. Play with Me, My Star  13. Gather Round, Star Friend
5. Jump the Toy Box Gently 14. Jump Sandbox & Sparkle
6. Wash                   15. We Play with Song
7. Wave                   16. Where Are You Tonight
8. Look                   17. Sing Star & Giggle
9. Laugh with Me, Happy Pal 18. We Chase Star
```

D2 종료 시점의 `[mixed vocal]`/영어 훅뱅크 특성 그대로 — E1이 손댄 `hookBanks/index.ts`의 `case 'kids'`는 값 자체는 무변경(케이스 목록에서 `'kr-kids-song'`만 분리)이므로 이 채널의 실제 생성 경로는 코드 레벨에서 완전히 격리돼 있습니다.

### [9] 시니어 18곡 재생성 + §11-1 다섯 수치

`tests/seniorBaseline.test.ts` 14/14 PASS (0.362±0.01 / 0.655 / 13.42±0.5 / 715-786-898±20 / 18종 그대로 유지) — E1 작업으로 인한 변동 없음.

### [10] kr2030 / jp2030 각 18곡 제목 (B2/C2 회귀 확인)

`after-work-band-pop`(kr2030), `reiwa-way-home-jpop`/`want-to-cry-band-playlist`(jp2030) 재생성 결과 D2 종료 시점과 완전 동일 — 18/18 고유, 어휘 혼입 없음.

### [11] 컨셉 매칭 회귀 비교표

| 입력 | E1 전 | E1 후 |
|---|---|---|
| 아침에 커피 마시며 듣는 노래 | `['cafe']` | `['cafe']` |
| 겨울 크리스마스 캐럴 | `['winter','christmas']` | `['winter','christmas']` |
| 연말 분위기 | `['year-end']` | `['year-end']` |
| 가을 낙엽 산책 | `['autumn','alone-drive-walk']` | `['autumn','alone-drive-walk']` |
| 옛날 라디오 감성 | `[]` | `[]` |
| 퇴근 후 감성 밴드팝 (kr2030) | `['kr2030-after-work']` | `['kr2030-after-work']` |
| Y2K 레트로팝 (kr2030) | `['kr2030-y2k-nostalgia']` | `['kr2030-y2k-nostalgia']` |
| 새벽 감성 R&B (kr2030) | `['rnb-soul','kr2030-dawn-night']` | `['rnb-soul','kr2030-dawn-night']` |
| 帰り道 (jp2030) | `['jp2030-way-home']` | `['jp2030-way-home']` |
| 卒業 教室 (jp2030) | `['jp2030-graduation-school']` | `['jp2030-graduation-school']` |
| シティポップ 東京 (jp2030) | `['jp2030-citypop']` | `['jp2030-citypop']` |

전부 변화 없음. §8이 요구한 30개 어휘(양치/이 닦기/손 씻기/정리/밥 먹기/배변/숫자/세기/색깔/모양/도형/동물/공룡/버스/기차/굴착기/병원/소방서/마트/유치원/역할놀이/영어/알파벳/이중언어/자장가/낮잠/잠자기/율동/체조/따라 하기) 전부 매칭 확인.

### [12] npm run audit:isolation 실행 결과

```
요약: PASS 37 / FAIL 3 / SKIP 19
```

- L1(장르): `kr-kids-song` **PASS** — 대상 7개 장르, 외부 노출 0건.
- L3(가사 구도): `kr-kids-song` **SKIP** — "전용 가사 구도 0개"로 표시되지만 **오탐입니다.** `scripts/isolationAudit.ts:122`의 `checkL3`가 `adultLyricThemes` 배열만 하드코딩해서 검사하고, kids 계열 아키타입이 실제로 쓰는 `kidsLyricThemes` 배열은 전혀 보지 않습니다 — G1이 만들어질 당시 kids 계열 워크스페이스에 전용 테마가 하나도 없었기 때문에 드러나지 않았던, G1 자체의 기존 결함입니다. §13-1[1]에서 직접 확인한 실측(풀 22, senior-\* 0)이 진짜 상태입니다.
- L4(훅뱅크): `kr-kids-song` **PASS** — 고유 override 확인, 언어 기본 어휘와 교집합 0건.
- L6(썸네일): `kr-kids-song` **PASS** — 전용 4개 확인, 부적합 노출 0건.
- FAIL 3건은 G1이 이미 식별한 기존 결함(modern-chill/city-night/oldpop-lounge)으로 E1과 무관.

**G1 자체 수정은 이 문서의 범위가 아닙니다** — D2가 §12에서 L8 추가를 별도 요청하라고 남긴 것과 같은 이유로, checkL3의 `adultLyricThemes` 하드코딩 수정도 별도 G1 작업으로 요청해야 합니다.

---

## 13-2. §10 완료 판정 수치표

| # | 항목 | 기준 | 현재값 | 완료값 |
|---|---|---|---|---|
| 1 | `lyricThemesForArchetype(kr-kids)`에 `senior-*` | 0건 | 0건 (D1이 이미 해소) | **0건** |
| 2 | 같은 풀에 성인 테마 전체 | 0건 | 0건 | **0건** |
| 3 | krkids 장르 수 | 7 | 0 | **7** |
| 4 | 7종 전부 `traits` 보유 | 7/7 | — | **7/7** |
| 5 | 7종 전부 `archetypes`/`categoryId: 'kr-kids'` 명시 | 7/7 | — | **7/7** |
| 6 | 시니어 아키타입 10종에 krkids 노출 | 0건 | — | **0건** |
| 7 | 7종 중 `dynamicRange: 'wide'` | 0 | — | **0** |
| 8 | krkids 7종 쌍별 특성 유사도(21쌍, 평균) | ≤0.28 | — | **0.266** |
| 9 | 기존 3종 (`kids-bright-pop` 등) | 불변 | — | **불변 확인** |
| 10 | krkids 가사 구도 개수 | ≥18 | 0 | **22** (§4-2 자체 불일치, §13-1[4] 기록) |
| 11 | 구도 전부 `suitedArchetypes` 지정 | 18/18 | — | **22/22** |
| 12 | `educationConcept` 전부 서로 다름 | 18/18 | — | **22/22** |
| 13 | `educationConcept`에 `and` 포함 | 0건 | — | **0건** |
| 14 | `frameId` 3종 사용 | 3/3 | — | **3/3** (9/2/11 분포) |
| 15 | 기존 `kidsLyricThemes` 14종 | 불변 | 14 | **14 (불변 확인)** |
| 16 | `krKidsOverride` 오버라이드 필드 | 9/9 | 0 | **9/9** |
| 17 | `krKidsOverride` ∩ `koreanDefault` | 0 | — | **0** (영어/일본어도 0) |
| 18 | `krKidsOverride` ∩ `kidsOverride` 겹침률 | 보고(≤90%) | — | **한 19.2% / 일 7.5% / 영 17.8%** |
| 19 | 훅 어휘 ⊆ D1 화이트리스트 | 100% | — | **한/영 100%, 일본어는 검사기 한계로 어근만 확인(§13-1[6])** |
| 20 | 18곡 제목에 교육 개념이 드러남 | 사람 판정 | — | **드러남 (§13-1[2])** |
| 21 | `learningLanguagePair` 필드 신설 | 있음 | 없음 | **있음** (`LyricTheme.learningLanguagePair`) |
| 22 | 이중언어 곡의 영어 단어 수 | 3-5 | — | **3 (색깔/숫자/인사 각각)** |
| 23 | 영어 토큰 + 한글 조사 결합 | 0건 | — | **0건** |
| 24 | `bilingualLint` 존재 | 있음 | 없음 | **있음** (`core/bilingualLint.ts`) |
| 25 | `LyricLanguage` 유니온 | 불변(4종) | 4 | **4 (불변)** |
| 26 | 신규 썸네일 아키타입 | 4 | 0 | **4** |
| 27 | 기존 19종 썸네일에 `suitedArchetypes` 추가 | 0건 | 0 | **0건** |
| 28 | 컨셉 규칙 — 시니어 5종 매칭 변화 | 0건 | — | **0건** |
| 29 | 컨셉 규칙 — 2030 매칭 변화 | 0건 | — | **0건** |
| 30 | 신규 채널 프리셋 | 3 | 0 | **3** |
| 31 | `little-singalong-radio` 18곡 출력 | 불변 | — | **불변 (코드 경로 완전 분리 확인)** |
| 32 | `KR_KIDS.ready` | `true` | `false` | **`true`** |
| 33 | `npm run audit:isolation`의 kr-kids | PASS | SKIP | **L1/L4/L6 PASS, L3는 G1 자체 결함으로 오탐 SKIP(§13-1[12])** |
| 34 | `tests/seniorBaseline.test.ts` | 통과 | — | **통과 (14/14)** |
| 35 | `git diff` 상 기존 행 수정·삭제 | 0건 | — | **hookBanks/index.ts의 케이스 재배치 1건 외 전부 마지막-줄 콤마/세미콜론류 기계적 변경 — §13-3 참조** |
| 36 | 신규 오디언스 프로파일 생성 수 | 0 (A3) | 0 | **0 (변경 없음)** |

---

## 13-3. 미구현 항목

- **§10-33 (L3)**: G1 감사 스크립트 자체의 결함(§13-1[12])으로 인한 오탐 SKIP — kr-kids 데이터 자체는 미구현이 아니라 실제로 완성돼 있습니다(§13-1[1] 실측). G1 스크립트 수정은 별도 요청 필요.
- **§13-1[7]의 파이프라인 배선**: `bilingualConcept`은 함수 레벨로 완성·검증됐지만, 실제 2개 호출부(`localGenerator.ts`)에 아직 연결되지 않았습니다 — D2의 `ageTier`와 동일한 배선 대기 상태입니다.
- **§13-1[6]의 일본어 화이트리스트 검사**: D1 검사기의 활용형/조사 한계로 정확한 자동 검증이 불가능합니다. 어근 수동 대조로 대체 확인했습니다.

## 13-4. 결정 대기 항목

### [A] kr-kids 아티스트명 (§9-3) — **미결정, 배포 전 필수**

DistroKid 배포 요건입니다. AskUserQuestion으로 지금 정할지 물었고, **하루 님이 "나중에 결정"을 선택**했습니다. `workspaces/index.ts`의 `KR_KIDS.artistName`은 `undefined`로 남아 있습니다 — 지어내지 않았습니다. 배포 직전에 반드시 정해야 합니다.

### [B] 수면 동요 62-84 BPM vs `tempoFloor` 92 (§2-1) — **A3로 이관**

`krkids-sleep-calm`의 `tempoRange: [62, 84]`를 그대로 넣었습니다. `KIDS_AUDIENCE_PROFILE.tempoFloor: 92`가 이 범위 전체를 막습니다. D1이 이미 제기한 것과 동일한 충돌이며, 프로파일 수정은 A3 담당이라 손대지 않았습니다.

### [C] 곡 길이 3:10-3:35 vs 동요 2분 — **A3로 이관 (D1에서 이미 제기됨)**

D1/D2가 이미 제기한 미해결 항목이 E1에서도 동일하게 적용됩니다. `compactDuration()`을 고치지 않았습니다.

### [D] 이중언어 영어 단어 3-5개 상한 — **E1이 정한 값**

조사 자료에 정확한 개수가 명시돼 있지 않아, D2의 템포 스윙 상한과 같은 방식으로 E1이 3개(범위의 하한)를 실제로 채택했습니다. 청취 후 조정 대상입니다.

## 13-5. A3 / F1로 넘길 항목

**A3**:
- §13-4[B] `tempoFloor: 92` vs T1(60-100)/krkids-sleep-calm(62-84) 충돌.
- §13-4[C] 곡 길이 3:10-3:35 → `songLengthSecondsRange` 배선 (D1/D2/E1 공통 미해결).
- `GenerationOptions`에 `ageTier`/`bilingualConcept` 필드를 추가해 D2/E1이 만들어 둔 선택적 인자들이 실제로 값을 받게 배선.

**F1 (일본 동요)**:
- `learningLanguagePair` 필드를 `{ base: 'japanese', target: 'english' }`로 재사용.
- `core/bilingualLint.ts`의 `KOREAN_GLUE_PATTERN`에 대응하는 일본어 조사(を/に/が/...) 결합 검사 추가.
- §13-1[6]에서 발견한 D1 화이트리스트 검사기의 일본어 활용형/조사 한계 — F1도 동일하게 부딪힐 것이므로 미리 인지.
- `KNOWN_EXISTING_KIDS_SONGS`에 일본 동요 0건 — F1이 채울 것.

## 별도 요청 필요 (G1)

`scripts/isolationAudit.ts:122`의 `checkL3`가 `adultLyricThemes`만 검사하고 `kidsLyricThemes`를 보지 않는 결함을 발견했습니다(§13-1[12]). D2가 L8 추가를 별도 요청하라고 남긴 것과 같은 이유로, **이 수정도 E1에서 직접 하지 않고 별도로 요청**합니다 — G1은 검증 전용 문서이고 그 규칙을 따라야 합니다.

---

## 부록: 검증 로그 요약

```
npx tsc --noEmit                              클린
npx vitest run                                2114/2114 통과 (flaky 타이밍 테스트 1건 제외), 19 skipped
npx vitest run tests/seniorBaseline.test.ts   14/14 PASS
npx tsx scripts/isolationAudit.ts             PASS 37 / FAIL 3(기존, 무관) / SKIP 19
                                               (L3 kr-kids 오탐 SKIP — §13-1[12])
little-singalong-radio 18곡 재생성            §13-1[8] — 회귀 없음
kr-kids 18곡 재생성 (3개 채널)                 §13-1[2] — 전부 18/18 고유, 시니어 어휘 누출 0
kr-2030 18곡 재생성                            18/18 고유, 회귀 없음
jp-2030 18곡 재생성 (2개 채널)                  18/18 고유 × 2, 회귀 없음
시니어 18곡 재생성                              §13-1[9] — 다섯 수치 그대로
컨셉 매칭 회귀                                  §13-1[11] — 시니어 5 + 2030 6개 전부 무변화
git diff 검토                                   hookBanks/index.ts 케이스 재배치 1건 + 마지막 줄
                                                구두점류 기계적 변경 외 시니어 데이터 무변경 확인
```
