# TASK F1 — 일본 동요 워크스페이스: 장르 7종 · 의성어 시스템 · 일영 이중언어 · 완료 보고

**기준 커밋**: `721bc7f` (v4.9 TASK E1) 이후 현재 HEAD
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-05

---

## 13-1. 실물 출력

### [1] §0-2 실측 — 작업 시작 전/완료 후

**작업 시작 전** (18곡 baseline, `little-singalong-radio`와 동일한 훅 조합 로직을 jp-kids-song이 그대로 물려받던 상태):

```
lyricThemesForArchetype('jp-kids-song') → 풀 0 (전용 테마 없음, kidsLyricThemes 공용 폴백)
overrideForArchetype('jp-kids-song', 'japanese') → hookBanks/index.ts의 case 'kids'로 폴백
  (jp-kids-song 전용 case가 없어 D1의 공용 kidsOverride()를 사용 — senior-morning으로
  떨어지지는 않았지만, 일본 동요만의 어휘가 전혀 없는 상태)
18곡 재생성 시 시니어 일본어 어휘("行かないで" 이별 문구 등, D2/C2 기준선의 흔적) 노출 확인
```

**완료 후**:

```
lyricThemesForArchetype('jp-kids-song') → 풀 23 | senior-* 0 | kids-*(old) 0 | krkids-* 0 | jpkids-* 23
overrideForArchetype('jp-kids-song', 'japanese') → 9/9 오버라이드 (jpKidsOverride 전용)
```

§0-2가 우려한 시나리오는 실제로 발동했었습니다 — jp-kids-song은 D1 이후에도 전용 hookBanks 분기가 없어 공용 `kids` 뱅크로 폴백 중이었고, 이번 작업으로 처음 전용화됐습니다.

### [2] jp-kids 18곡 제목 전문 (3개 채널, 최종 상태)

**손놀이 놀이터** (`teasobi-hiroba`):
```
 1. ぴょんぴょんをかるくたべよう        10. あそぼう、ちいさいこ
 2. ぴょんぴょんをかるくあそぼう        11. たのしく、ちいさいこ
 3. おどろう、ちいさいこ               12. かずをみつけたよ
 4. うたおう、ちいさいこ               13. かたちをたのしいね
 5. おとをじょうずだね                14. おとをたのしいね
 6. げんきに、ちいさいこ               15. やってみよう、ちいさいこ
 7. かずをたのしいね                  16. くるくるをげんきにあそぼう
 8. ぶーぶーをかるくまねよう           17. もぐもぐをげんきにのろう
 9. うたをできたよ                   18. ぶーぶーをかるくあそぼう
```
고유 제목 18/18. 훅 형태 분포: imperative(擬音語+の) 6 / vocative 6 / declarative 6.

**みんなで体操** (`minna-de-taiso`):
```
 1. たのしく、ちいさいこ               10. がたごとをもっとのろう
 2. かずをがんばったね                11. うたをうれしいね
 3. うたをじょうずだね                12. うたおう、ちいさいこ
 4. もぐもぐをすこしのろう             13. いろをがんばったね
 5. あそぼう、ちいさいこ               14. がたごとをげんきにみつけよう
 6. ぴょんぴょんをすこしまねよう       15. かたちをうれしいね
 7. げんきに、ちいさいこ               16. おどろう、ちいさいこ
 8. もぐもぐをかるくまねよう           17. まねしよう、ちいさいこ
 9. がたんごとんをもっとたべよう       18. いろをじょうずだね
```
고유 제목 18/18. 훅 형태 분포: imperative 6 / vocative 6 / declarative 6.

**おやすみ前のうた** (`oyasumi-mae-no-uta`):
```
 1. ぴょんぴょんをすこしあそぼう       10. おとをみつけたよ
 2. もぐもぐをげんきにみつけよう       11. もぐもぐをすこしのろう
 3. がたんごとんをもっとまねよう       12. あそぼう、ちいさいこ
 4. たのしく、ちいさいこ              13. かずをうれしいね
 5. うたおう、ちいさいこ              14. がたんごとんをかるくのろう
 6. げんきに、ちいさいこ              15. かずをじょうずだね
 7. もぐもぐをたのしくのろう           16. いろをみつけたよ
 8. おとをうれしいね                 17. おどろう、ちいさいこ
 9. うたをがんばったね                18. まねしよう、もぐもぐたこやき
```
고유 제목 18/18. 훅 형태 분포: imperative 6 / vocative 6 / declarative 6.

**판단**: 3개 채널 모두 세 가지 훅 형태(imperative/vocative/declarative)가 정확히 6:6:6으로 고르게 분포합니다(`core/lyricEngine.ts`의 `buildShapeSequence()`가 균등 순환시키는 결과) — §10의 "단일 패턴이 12/18을 넘지 않을 것" 기준을 넉넉히 충족합니다(최대 6). imperative 형태는 54곡 중 18곡 전부 의성어(擬音語)를 포함해 §5-4의 "擬音語+対象" 제목 패턴이 실제로 동작함을 확인했습니다.

### [3] 의성어 제목 반영 — 원본 문제와 해결 과정 (실측 기반)

최초 설계는 의성어를 `nounModifiers`/`nounObjects`(명사구 훅 전용 필드)에 넣었으나, `core/lyricEngine.ts`의 `SungHookShape = Exclude<HookShape, 'nounPhrase'>`로 인해 명사구 형태는 애초에 실제 훅 선택 대상에서 제외된다는 사실을 재생성 스크립트로 직접 확인했습니다(54곡 중 1곡만 의성어 포함). 이 발견에 따라 의성어를 실제로 사용되는 `imperativeObjects`/`vocativeAddressees` 필드로 옮겨 담았습니다.

1차 재설계(의성어+명사+조사 결합, 예: `ぴょんぴょんうさぎを`)는 길이 상한(`HOOK_LENGTH_BOUNDS.japanese.max = 14`자)을 넘겨 훅 풀이 소진되는 런타임 에러(`훅 풀이 소진되었습니다`)를 실제로 발생시켰습니다 — 필드 개수 점검만으로는 잡히지 않고 실제 18곡 재생성에서만 드러난 문제입니다. 명사를 제거하고 의성어+조사만 남기는 형태(`ぴょんぴょんを`)로 재조정해 해결했습니다. 최종본은 §13-1[2]의 3개 채널 재생성으로 검증했습니다: 훅 풀 소진 0건, 의성어 12종+ 포함 제목 19/54(35%), imperative 형태 18/18 전부 의성어 포함.

### [4] jp-kids 가사 전문 1곡 (이중언어, japanese base)

`bilingualConcept: 'color'`, `ageTier: 'kids-t3'`:
```
[short intro]
テスト の うたを はじめよう

[verse 1]
きいろは yellow だよ
また見ても yellow だよ

[chorus]
あかは red だよ
ともだち さいこう だいすきだよ

[verse 2]
あおは blue だよ
そらも blue だよ

[chorus]
あかは red だよ
ともだち さいこう だいすきだよ

[short bridge]
ともだちと いっしょなら
なんでも たのしいね

[final chorus]
あかは red だよ
ともだち さいこう だいすきだよ

[end]
```
`bilingualLint(lyrics, { baseLanguage: 'japanese' })` → **NONE (clean)**. `number`/`greeting` 컨셉도 동일 구조로 확인, 전부 clean(§13-1[7] 참조).

### [5] 의성어 시스템 26종 전문 (`src/data/onomatopoeia.ts`)

| category | id | word | motionEn (스타일 프롬프트용) | ageTiers |
|---|---|---|---|---|
| motion | motion-jump | ぴょんぴょん | playful jumping-motion rhythm cue | 전체 |
| motion | motion-spin | くるくる | gentle spinning-motion rhythm cue | t2/t3 |
| motion | motion-clap | ぱちぱち | light clapping rhythm cue | 전체 |
| motion | motion-scrub | ごしごし | scrubbing-motion rhythm cue | 전체 |
| motion | motion-wipe | しゅっしゅっ | wiping-motion rhythm cue | 전체 |
| motion | motion-wave | ふりふり | gentle waving-motion rhythm cue | 전체 |
| motion | motion-stomp | どんどん | light stomping-motion rhythm cue | t2/t3 |
| motion | motion-tiptoe | そろそろ | soft tiptoeing-motion rhythm cue | 전체 |
| eat | eat-chew | もぐもぐ | playful chewing-motion rhythm cue | 전체 |
| eat | eat-bite | ぱくぱく | playful biting-motion rhythm cue | 전체 |
| eat | eat-slurp | ずるずる | playful slurping-motion rhythm cue | t2/t3 |
| eat | eat-crunch | ぽりぽり | light crunching-motion rhythm cue | t2/t3 |
| eat | eat-lick | ぺろぺろ | playful licking-motion rhythm cue | 전체 |
| eat | eat-sizzle | じゅうじゅう | cheerful sizzling-cooking rhythm cue | t2/t3 |
| vehicle | vehicle-car | ぶーぶー | playful car-engine rhythm cue | 전체 |
| vehicle | vehicle-train | がたんごとん | playful train-clatter rhythm cue | 전체 |
| vehicle | vehicle-bus | ぶんぶん | cheerful buzzing-drive rhythm cue | 전체 |
| vehicle | vehicle-boat | ぷかぷか | gentle floating-boat rhythm cue | 전체 |
| vehicle | vehicle-plane | ぶーん | soft airplane-flying rhythm cue | t2/t3 |
| vehicle | vehicle-bike | しゅーしゅー | light bicycle-gliding rhythm cue | t2/t3 |
| emotion | emotion-excited | わくわく | bright excited-anticipation mood cue | t2/t3 |
| emotion | emotion-nervous | どきどき | gentle happy-heartbeat mood cue | **t3만** |
| emotion | emotion-smile | にこにこ | warm smiling mood cue | 전체 |
| emotion | emotion-happy | るんるん | light skipping-happiness mood cue | 전체 |
| emotion | emotion-sleepy | すやすや | soft peaceful-sleep mood cue | 전체 |
| emotion | emotion-proud | えへん | playful proud-puff mood cue | t2/t3 |

`どきどき`는 §0-2의 "부정적 감정의 지속" 경고에 따라 T1을 제외하고 T3에만 열어 뒀습니다. `motionKo`(하루 님 전용 설명)는 스타일 프롬프트에 절대 노출되지 않고, `motionEn`만 노출됩니다 — 원본 일본어 의성어 자체를 스타일 프롬프트에 직접 삽입하지 않는다는 §5-5 규칙을 그대로 지켰습니다(가사/제목에는 원본 의성어가 직접 등장하지만, 스타일 프롬프트는 항상 영어 서술로 우회).

### [6] jp-kids 7종 장르 데이터 전문

| id | tempoRange | dynamicRange | instrumentation |
|---|---|---|---|
| jpkids-teasobi | 108-122 | low | ukulele, hand claps, xylophone, marimba |
| jpkids-taiso-dance | 116-132 | medium | bright synth pad, hand claps, ukulele, xylophone |
| jpkids-onomatopoeia | 104-120 | medium | xylophone, marimba, ukulele, hand claps |
| jpkids-food-vehicle | 106-124 | medium | ukulele, bright synth pad, xylophone, hand claps |
| jpkids-daily-habit | 98-112 | low | ukulele, xylophone, marimba, hand claps |
| jpkids-seasonal | 96-118 | low | marimba, xylophone, ukulele, bright synth pad |
| jpkids-english-learning | 100-116 | low | ukulele, xylophone, marimba, hand claps |

`legacyGenrePack()` 호출 코드는 `src/data/genreLibrary/index.ts`의 `jpkidsGenrePacks` 배열, `GENRE_TRAIT_OVERRIDES` 항목은 `src/data/genreTraits.ts`에 있습니다.

- jpkids 내부 쌍별 유사도(21쌍): **평균 0.120 / 최대 0.184** (기준 각각 ≤0.28 충족)
- jpkids × krkids 교차 유사도(49쌍): **평균 0.081 / 최대 0.208** (기준 평균≤0.28, 최대≤0.40 충족)
- 최고 유사도 상위 3쌍: `jpkids-food-vehicle`×`krkids-animal-vehicle` 0.208, `jpkids-taiso-dance`×`krkids-action` 0.190, `jpkids-onomatopoeia`×`krkids-counting-color` 0.157 — 전부 기준 이내
- 시니어 10개 아키타입에 jpkids 노출 **0건**
- `structureTraits`에 call-and-response(question/echo/answer류) 서술 포함: **7/7**
- `styleCore`/`goodFor`에 onomatopoeia/hand-motion 언급: **5/7**
- 기존 3종(`kids-bright-pop` 등) `traits` 필드 없음, 무변경 확인

**1차 시도 재작성 사실**: 초안은 rhythm/vocal/production/harmony 문구가 장르 간·워크스페이스 간(E1과) 거의 동일한 상용구를 재사용해 내부 평균 0.397/최대 0.543, 교차 평균 0.342/최대 0.914로 기준을 크게 초과했습니다. §2-1의 "고칠 쪽은 항상 일본" 원칙에 따라 jpkids 쪽 어휘만 전면 재작성해 위 최종 수치로 낮췄습니다.

### [7] jpKidsOverride 전문 9개 배열 (일본어, 최종본)

```
imperativeVerbs     みつけよう、たべよう、のろう、まねよう、あそぼう
imperativeObjects   ぴょんぴょんを、くるくるを、ぶーぶーを、がたんごとんを、もぐもぐを
imperativeTails     げんきに、たのしく、かるく、もっと、すこし
vocativeLeads       やってみよう、できるかな、あそぼう、まねしよう、うたおう、おどろう、げんきに、たのしく
vocativeAddressees  ぴょんぴょんさん、ぶーぶーくるま、もぐもぐたこやき、がたんごとんさん、にこにこさん、わくわくみんな、きらきらにじ、ちいさいこ
nounModifiers       ぴょんぴょんの、くるくるの、ぶーぶーの、ぱちぱちの、もぐもぐの、わくわくの、にこにこの、きらきらの
nounObjects         かに、たこやき、バス、でんしゃ、にじ、ちょう、うさぎ、ひよこ
declarativeStems    できたよ、みつけたよ、たのしいね、がんばったね、じょうずだね、うれしいね
declarativeTails    おとを、いろを、かたちを、うたを、かずを
```

**시니어 기본뱅크(japaneseDefault) 교집합: 0** (9개 필드 전부). **showaCafeOverride 교집합: 0** (9개 필드 전부, 2가지 시니어 일본어 사전 모두 확인). **기존 D1 kidsOverride와 겹침률: 5.2%(3/58)**.

**`nounModifiers`/`nounObjects`는 실제 제목에 나타나지 않음(9/9 요구 충족 위해 채움)**: `core/lyricEngine.ts`의 `SungHookShape`가 `nounPhrase` 형태를 훅 선택 대상에서 제외하기 때문입니다(§13-1[3] 참조). D1이 만든 이 9필드 관행 자체가 2개 필드는 실제 출력에 영향을 주지 않는다는 사실을 F1 작업 중 처음 발견했습니다 — D1/E1 모두 이 사실을 모른 채 필드를 채웠습니다. `lyricEngine.ts`의 `SungHookShape` 정의를 바꾸는 것은 모든 아키타입에 영향을 주는 공유 로직 변경이라 F1 범위를 벗어나므로 손대지 않았고, F1 자신의 문제(의성어가 제목에 안 보임)만 필드 재배치로 해결했습니다. §13-5에 인계 항목으로 남깁니다.

**D1 일본어 화이트리스트 검사**: `whitelistViolations()`로 훅 어휘 58개 전량 검사 시 kids-t1/t2/t3 전부 56-57건 "위반"으로 표시되지만, **오탐입니다** — E1이 §13-1[6]에서 이미 발견한 것과 같은 유형의 검사기 한계(활용형을 어근으로 되돌리지 않음)에 더해, F1의 훅 필드는 단어가 아니라 조사·접미사가 결합된 구(句) 문자열(예: `ぴょんぴょんを`, `やってみよう`)이라 `tokenize()`가 이를 통째로 한 토큰으로 보고 화이트리스트의 단일 단어 목록과 대조하는 자체가 성립하지 않습니다. 의성어 자체(ぴょんぴょん/もぐもぐ 등)도 D1 화이트리스트 파일이 자신의 주석에서 "E1/F1이 자신의 교육/의성어 어휘로 이 목록을 확장할 것"이라고 명시적으로 예정해 둔 신규 어휘라 애초에 화이트리스트에 없는 것이 정상입니다. 어근 수동 대조 결과: `あそぼう`(あそぶ, T1 whitelist 등재 동사)를 제외하면 나머지는 D1 화이트리스트 "공통 안전 최소" 범위 밖의 신규 동작 동사(みつける/たべる/のる/まねる)이며, 전부 D1 §4의 나이 단계 설명과 어긋나지 않는 구체적·직접 동작 동사입니다.

### [8] 썸네일 4종 격리 확인

```
senior/kids 아키타입에 jpkids 썸네일 노출: 0건
kr-kids-song에 jpkids 썸네일 노출: 0건
jp-kids-song에 jpkids 썸네일 노출: 4/4
```

4종: `jpkids-teasobi-hands`(손놀이, 얼굴 미노출 문구 포함), `jpkids-food-character`, `jpkids-vehicle-parade`, `jpkids-seasonal-matsuri` — 전부 `forbiddenElements`에 캐릭터화/애니메 IP 참조 금지 포함.

### [9] 컨셉 키워드 필수 어휘 27개 전량 매칭 확인

한국어/일본어 스크립트 양쪽 표기(手遊び/てあそび, 体操/たいそう, オノマトペ/의성어, たこやき/타코야키, 電車/버스, 生活習慣/생활습관, 夏祭り/여름축제, 桜/벚꽃, 雪/눈, 英語/知育) 전부 올바른 jpkids-* 규칙에 매칭됨을 확인했습니다(§13-1 상세 목록은 부록 검증 로그 참조).

### [10] 컨셉 매칭 회귀 비교표 (시니어 5 + 2030 6 + krkids 5, 총 16개)

| 입력 | F1 전 | F1 후 |
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
| 양치 (krkids) | `['krkids-daily-habit']` | `['krkids-daily-habit']` |
| 손 씻기 (krkids) | `['krkids-daily-habit']` | `['krkids-daily-habit']` |
| 숫자 세기 (krkids) | `['krkids-counting-color']` | `['krkids-counting-color']` |
| 역할놀이 (krkids) | `['krkids-roleplay-story']` | `['krkids-roleplay-story']` |
| 자장가 (krkids) | `['krkids-sleep-calm']` | `['krkids-sleep-calm']` |

전부 변화 없음. G1 감사 스크립트가 직접 검사하는 `L7_SENIOR_CONCEPTS`(아침 카페/추억의 라디오/**첫눈**/오래된 우정/비 오는 밤) 스냅샷도 PASS — `jpkids-seasonal`의 `/눈/` 패턴이 "첫눈"까지 잘못 매칭하던 실회귀를 `/(?<!첫)눈(?!치)/`로 수정해 해소했습니다(§13-3 오류 이력 참조).

### [11] npm run audit:isolation 실행 결과 (최종)

```
요약: PASS 39 / FAIL 3 / SKIP 17
```

- L1(장르): `jp-kids-song` **PASS** — 대상 7개 장르, 외부 노출 0건.
- L3(가사 구도): `jp-kids-song` **SKIP** — E1 때와 동일한 G1 자체 결함(`checkL3`가 `adultLyricThemes`만 하드코딩 검사, `kidsLyricThemes`는 안 봄)으로 인한 오탐입니다. 실측(§13-1[1], 풀 23·senior-\* 0)이 진짜 상태입니다.
- L4(훅뱅크): `jp-kids-song` **PASS** — 고유 override 확인, 언어 기본 어휘와 교집합 0건.
- L6(썸네일): `jp-kids-song` **PASS** — 전용 4개 확인, 부적합 노출 0건.
- L7(시니어 컨셉 스냅샷): **PASS** — §13-1[10] 회귀 없음.
- FAIL 3건은 senior-oldpop의 modern-chill/city-night/oldpop-lounge(G1이 이미 식별한 기존 결함, E1 보고서에도 동일 기록됨) — F1과 무관.

### [12] 5개 워크스페이스 전체 재생성 회귀 없음 확인

```
little-singalong-radio (시니어) 18곡     — D2 종료 시점과 완전 동일, 회귀 없음
follow-along-action-song (kr-kids) 18곡  — E1 종료 시점과 완전 동일, 18/18 고유
after-work-band-pop (kr2030) 18곡        — 18/18 고유, 회귀 없음
reiwa-way-home-jpop (jp2030) 18곡        — 18/18 고유, 회귀 없음
want-to-cry-band-playlist (jp2030) 18곡  — 18/18 고유, 회귀 없음
jp-kids 3개 채널 54곡 (§13-1[2])         — 18/18×3 고유, §0-2 원본 18개와 겹침 0, 시니어 어휘 누출 0
```

---

## 13-2. §10 완료 판정 수치표

| # | 항목 | 기준 | 현재값 | 완료값 |
|---|---|---|---|---|
| 1 | `lyricThemesForArchetype(jp-kids)`에 `senior-*` | 0건 | 0건(폴백 자체가 없어 발동 안 함) | **0건** |
| 2 | 작업 시작 전 jp-kids-song 훅뱅크 상태 | 실측 | `case 'kids'`로 폴백(전용 case 없음) | **전용 case 신설로 해소** |
| 3 | jpkids 장르 수 | 7 | 0 | **7** |
| 4 | 7종 전부 `traits` 보유 | 7/7 | — | **7/7** |
| 5 | 7종 전부 `archetypes`/`tier: 'core'` 명시 | 7/7 | — | **7/7** |
| 6 | 시니어 아키타입 10종에 jpkids 노출 | 0건 | — | **0건** |
| 7 | 7종 중 `dynamicRange: 'wide'` | 0 | — | **0** |
| 8 | jpkids 7종 내부 쌍별 유사도(21쌍, 평균/최대) | ≤0.28 / — | — | **0.120 / 0.184** |
| 9 | jpkids×krkids 교차 유사도(49쌍, 평균/최대) | ≤0.28 / ≤0.40 | — | **0.081 / 0.208** |
| 10 | `structureTraits` call-and-response 서술 | ≥5/7 | — | **7/7** |
| 11 | `styleCore`/`goodFor` 의성어·手遊び 언급 | ≥5/7 | — | **5/7** |
| 12 | 기존 3종(`kids-bright-pop` 등) | 불변 | — | **불변 확인** |
| 13 | jpkids 가사 구도 개수 | ≥18 | 0 | **23** |
| 14 | 구도 전부 `suitedArchetypes` 지정 | 23/23 | — | **23/23** |
| 15 | `educationConcept` 사용 | 0건(E1 전용 필드, 재사용 금지) | — | **0건** |
| 16 | `onomatopoeiaGroup` 필드 신설·사용 | 있음 | 없음 | **있음 (20/23)** |
| 17 | 기존 `kidsLyricThemes` 14종 + krkids 22종 | 불변 | 14/22 | **14/22 (불변 확인)** |
| 18 | 의성어 데이터 구조(`onomatopoeia.ts`) 신설 | 있음 | 없음 | **있음 (26종, 4 카테고리)** |
| 19 | 의성어 예시 12종 커버 | 12/12 | — | **12/12 (26종 중 포함)** |
| 20 | どきどき 등 부정적 감정 지속 어휘 T1 노출 | 0건 | — | **0건 (t3 전용 제한)** |
| 21 | `motionEn`만 스타일 프롬프트 노출, 원본 의성어 미노출 | 확인 | — | **확인** |
| 22 | 제목에 의성어 반영 (18곡 표본) | 사람 판정 | 1/54(초기 결함) | **19/54, imperative 18/18** |
| 23 | 훅 형태 A/B/C 분포, 단일 패턴 12/18 초과 | 0건 | — | **0건 (6:6:6 균등)** |
| 24 | `jpKidsOverride` 오버라이드 필드 | 9/9 | 0 | **9/9** |
| 25 | `jpKidsOverride` ∩ `japaneseDefault` | 0 | — | **0** |
| 26 | `jpKidsOverride` ∩ `showaCafeOverride` | 0 | — | **0** |
| 27 | `jpKidsOverride` ∩ 기존 D1 `kidsOverride` 겹침률 | 보고(≤90%) | — | **5.2%(3/58)** |
| 28 | 훅 어휘 ⊆ D1 화이트리스트 | 가능한 만큼 확인 | — | **검사기 한계로 자동검증 불가, 어근 수동 대조로 대체(§13-1[7])** |
| 29 | `learningLanguagePair`/`bilingualLint` 일본어 재사용 | 있음 | E1 전용(한국어만) | **있음 (`baseLanguage: 'japanese'` 옵션)** |
| 30 | 일본어 조사 결합 검사(を/に/が/...) | 있음 | 없음 | **있음, 공백 있어도 검출** |
| 31 | 가타카나 표기 검사(レッド 등) | 있음 | 없음 | **있음 (`KATAKANA_TARGET_WORDS`)** |
| 32 | `jpBilingualContentFor`/`jpKidsBilingual.ts` 신설 | 있음 | 없음 | **있음** |
| 33 | 이중언어 곡 영어 단어 수 | 3-5 | — | **3 (색깔/숫자/인사 각각)** |
| 34 | 영어 토큰 + 일본어 조사 결합 | 0건 | — | **0건 (실제 3개 컨셉 lint clean)** |
| 35 | E1 한국어 경로 무변경(`baseLanguage` 기본값) | 불변 | — | **불변 확인 (기본 인자 생략 시 byte-identical)** |
| 36 | 신규 썸네일 아키타입 | 4 | 0 | **4** |
| 37 | 신규 채널 프리셋 | 3 | 0 | **3** |
| 38 | 컨셉 규칙 — 시니어 5 + 2030 6 + krkids 5 매칭 변화 | 0건 | — | **0건** |
| 39 | `JP_KIDS.ready` | `true` | `false` | **`true`** |
| 40 | `npm run audit:isolation`의 jp-kids | PASS | SKIP | **L1/L4/L6/L7 PASS, L3는 G1 자체 결함으로 오탐 SKIP** |
| 41 | 5개 워크스페이스 전체 재생성 회귀 | 0건 | — | **0건 (§13-1[12])** |
| 42 | `npx tsc --noEmit` / `npx vitest run` | 클린 / 전부 통과 | — | **클린 / 2117 통과, 17 skip, 3 todo** |

---

## 13-3. 미구현 항목 및 오류 이력

- **§10-28 (D1 화이트리스트 자동 검증)**: E1이 이미 발견한 검사기 한계(활용형 미환원)에 더해, F1의 훅 필드는 구(句) 단위라 `whitelistViolations()`의 단어 단위 검사와 구조적으로 맞지 않습니다. 자동 검증 대신 어근 수동 대조로 대체했습니다(§13-1[7]).
- **§10-40 (L3)**: G1 감사 스크립트 자체의 결함(`checkL3`가 `adultLyricThemes`만 검사)으로 인한 오탐 SKIP — jp-kids 데이터는 실제로 완성돼 있습니다(§13-1[1] 실측).
- **의성어-제목 반영 설계 오류와 수정**: 최초 설계(의성어를 `nounModifiers`/`nounObjects`에 담는 방식)는 `SungHookShape`가 명사구 형태를 애초에 선택 대상에서 제외한다는 사실을 몰랐던 상태로 만들어졌고, 재생성 스크립트로만 발견됐습니다(§13-1[3]). 1차 재설계(의성어+명사+조사 결합)는 일본어 훅 길이 상한을 초과해 런타임 에러(훅 풀 소진)를 실제로 냈습니다. 최종적으로 의성어+조사만 남기는 형태로 안정화했습니다.
- **jpkids-seasonal 컨셉 규칙 실회귀와 수정**: `/눈/` 패턴이 G1의 `L7_SENIOR_CONCEPTS` 스냅샷 중 "첫눈"까지 잘못 매칭해 `tests/workspaceDataIsolation.test.ts`가 실패했습니다. `/(?<!첫)눈(?!치)/`로 수정해 해소, 재실행으로 확인했습니다.

## 13-4. 결정 대기 항목

### [A] jp-kids 아티스트명 (§9-4) — **미결정, 배포 전 필수**

DistroKid 배포 요건입니다. AskUserQuestion으로 물었고, **하루 님이 "나중에 결정"을 선택**했습니다. `workspaces/index.ts`의 `JP_KIDS.artistName`은 `undefined`로 남아 있습니다. 배포 직전 반드시 정해야 합니다.

### [B] `KNOWN_EXISTING_KIDS_SONGS`의 일본 동요 목록 — **미결정, 시장 조사 필요**

§8의 명시적 지시("지어내지 마십시오")에 따라 실제 존재하는 일본 동요 목록을 임의로 만들지 않았습니다. 0건으로 남겨 두었으며, 실제 데이터가 필요하면 하루 님의 조사 또는 별도 확인이 필요합니다.

### [C] 의성어 26종(원본 예시 12종 대비 확장분) 및 T1/T2/T3 배정 — **F1 자체 선택값, 청취 후 조정 가능**

원본 문서가 예시로 든 12종을 모두 포함했고, 카테고리 균형(motion/eat/vehicle/emotion 각 6-8개)을 위해 14종을 추가했습니다. `どきどき`의 T3 전용 제한을 포함해 나이 단계 배정은 F1이 §0-2의 경고를 참고해 직접 정한 값입니다.

### [D] 훅 형태 A/B/C 제목 패턴 비율 — **F1 자체 선택값**

`buildShapeSequence()`의 기존 균등 순환 로직을 그대로 사용해 6:6:6이 나왔습니다. 의도적으로 조정하지 않았고, 실제 청취 후 특정 패턴 비중을 높이고 싶다면 `imperativeVerbs`/`imperativeObjects` 등 어휘 배열의 상대적 크기를 조정하는 방식으로 가능합니다(D1/E1 관행과 동일).

## 13-5. A3 / G1로 넘길 항목

**A3**:
- (E1이 이미 제기한 항목과 동일) `tempoFloor`/`songLengthSecondsRange` 배선 미해결이 jp-kids에도 동일 적용.
- `bilingualConcept` 파이프라인 배선(§13-1[4]는 함수 레벨 검증, 실제 `GenerationOptions` 경로 배선은 A3 소관 — E1의 동일 인계와 병합 가능).

**공통 (모든 향후 kids 워크스페이스 문서용)**:
- **`HookVocabularyOverride`의 `nounModifiers`/`nounObjects` 2개 필드가 실제 훅 생성에 구조적으로 사용되지 않는다는 사실**(§13-1[7]) — D1이 만든 9필드 관행 자체에 걸친 발견으로, D1/E1도 이를 모른 채 필드를 채웠습니다. `core/lyricEngine.ts`의 `SungHookShape`가 `nounPhrase`를 제외하기 때문입니다. 이 필드들을 실제로 활용하려면 `SungHookShape`/`buildShapeSequence()` 자체를 수정해야 하며, 이는 시니어를 포함한 모든 아키타입에 영향을 주는 공유 로직 변경이라 F1 범위 밖입니다 — 별도 검토가 필요합니다.

## 별도 요청 필요 (G1)

`scripts/isolationAudit.ts`의 `checkL3`가 `adultLyricThemes`만 검사하고 `kidsLyricThemes`를 보지 않는 결함(E1이 이미 발견, F1에서 재확인)에 더해 다음을 G1 L8 추가 항목으로 요청합니다(F1 §12 자체 지시):

- **의성어 `ageTiers` 위반 검사**: `どきどき` 등 부정적 감정 지속 의성어가 T1에 노출되지 않는지 자동 검사.
- **스타일 프롬프트에 일본어 의성어 원문이 직접 삽입되는지 검사**: `motionEn`이 아닌 원본 가나 문자열이 스타일 프롬프트에 섞이지 않는지.
- **가타카나 표기 위반 검사**: `KATAKANA_TARGET_WORDS`에 등재된 단어가 이중언어 가사에서 가타카나로 표기되지 않는지.

---

## 부록: 검증 로그 요약

```
npx tsc --noEmit                              클린
npx vitest run                                2117/2117 통과, 17 skipped, 3 todo (flaky 타이밍 테스트
                                               tests/stress.test.ts 1건 전체 실행 시 간헐적 실패 —
                                               단독 실행 시 15/15 PASS로 재확인, 기존에도 있던 결함)
tests/workspaces.test.ts 갱신                 jp-kids ready=false 하드코딩 단정문을 true로 갱신
                                               (E1의 kr-kids 전환 때와 동일한 패턴)
npx vitest run tests/hookBanks.test.ts
  tests/hook.test.ts tests/seniorBaseline.test.ts   59/59 PASS
npx tsx scripts/isolationAudit.ts             PASS 39 / FAIL 3(기존, 무관) / SKIP 17
                                               (L3 jp-kids 오탐 SKIP — §13-1[11])
jp-kids 18곡 재생성 (3개 채널, 54곡)            §13-1[2] — 전부 18/18 고유, §0-2 원본 18개와 겹침 0,
                                               시니어 일본어 어휘 누출 0, 의성어 포함 19/54
little-singalong-radio 18곡 재생성            §13-1[12] — 회귀 없음
kr-kids 18곡 재생성                            §13-1[12] — 회귀 없음, 18/18 고유
kr2030/jp2030 18곡×3 재생성                    §13-1[12] — 전부 18/18 고유, 회귀 없음
컨셉 매칭 회귀 (시니어5+2030 6+krkids 5)         §13-1[10] — 전부 무변화
G1 L7 시니어 컨셉 스냅샷(첫눈 포함)              §13-1[10] — PASS (jpkids-seasonal 패턴 수정 후)
이중언어 3개 컨셉(색깔/숫자/인사) lint            §13-1[4],[7] — 전부 clean
가타카나/조사결합 위반 탐지 유닛 테스트           §13-1[7] — 두 사례 모두 정상 탐지 확인
D1 일본어 화이트리스트 대조                     §13-1[7] — 자동검증 불가(검사기 구조적 한계), 어근 수동 대조로 대체
git diff -U0 검토                              hookBanks/index.ts 케이스 재배치 1건, workspaces/index.ts
                                               JP_KIDS 블록 갱신, 카운트 어서션 340→347 갱신 외 시니어/
                                               krkids 등 기존 데이터 무변경 확인
```
