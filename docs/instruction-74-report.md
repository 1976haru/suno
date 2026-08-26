# 지시문 74 완료 보고 — BPM 대비 섹션 부족 · 시대/장르 고유색 도달

브랜치 `feat/instruction-74` (기준 `bf1447a`, `763582c`의 후손 — 확인함)
커밋 8건. `npm test` 371 파일 4629건 통과.

---

## 0. 먼저 — 실제 Suno 재생 시간은 재지 못했습니다

§7의 2번·3번은 **Suno에서 실제로 뽑은 곡의 재생 시간**을 요구합니다. 이
환경에서는 Suno에 접근할 수 없어 측정하지 못했습니다. §7이 지시한 대로,
하루가 직접 확인할 수 있게 생성용 파일을 남깁니다.

| 용도 | 파일 |
|---|---|
| 세트1 딥하우스 — 작곡 완료 3곡 (TASK A 검증) | `lyrics/task74/set1-deep-house-songs.json` |
| 세트2 쇼와 70s — 작곡 완료 3곡 (TASK B 검증) | `lyrics/task74/set2-showa-70s-songs.json` |
| 세트3 칠랩 — 작곡 완료 3곡 (랩 대역 회귀 확인) | `lyrics/task74/set3-chill-rap-songs.json` |
| 각 세트의 브릿지 지시문 전문 (12곡 전체를 새로 뽑고 싶을 때) | `lyrics/task74/set*-instruction.md` |
| 각 세트의 슬롯 계획 | `lyrics/task74/set*-slots.json` |

각 JSON의 `stylePrompt` / `lyrics`를 Suno에 그대로 넣으면 됩니다. 재생
시간만 재서 알려주시면 §4의 두 목표(111~125 BPM → 3:00 이상, 95 이하 →
3:00 이상 유지)를 바로 판정할 수 있습니다.

---

## 1. BPM별 섹션 수 표

### 세트1 (딥하우스) 슬롯 계획 12곡 — 새 하한 적용 결과

| # | BPM | 장르 | 템플릿 | 섹션 범위 | 간주 상한 | 하한 |
|---|---|---|---|---|---|---|
| 1 | 68 | alt-rnb | T1 | 5-6 | 1 | — |
| 2 | 122 | garage-swing | T2 | 11-13 | 5 | 11 |
| 3 | 111 | deep-house-organic | T5 | 11-13 | 5 | 11 |
| 4 | 119 | deep-house-melodic | T2 | 11-13 | 5 | 11 |
| 5 | 76 | alt-rnb | T3 | 5-6 | 1 | — |
| 6 | 127 | garage-swing | T5 | 13-15 | 7 | 13 |
| 7 | 116 | deep-house-organic | T4 | 11-13 | 6 | 11 |
| 8 | 119 | deep-house-melodic | T4 | 11-13 | 6 | 11 |
| 9 | 77 | alt-rnb | T4 | 5-6 | 1 | — |
| 10 | 109 | deep-house-organic | T4 | 9-11 | 4 | 9 |
| 11 | 127 | garage-swing | T4 | 13-15 | 8 | 13 |
| 12 | 114 | deep-house-melodic | T4 | 11-13 | 6 | 11 |

95 BPM 이하 3곡(68·76·77)은 5-6섹션·간주 1로 **지시문 74 이전과 완전히
동일**합니다.

### 실제 작곡한 9곡의 섹션 구성

| 세트 | # | BPM | 섹션 수 | 구성 |
|---|---|---|---|---|
| 1 | 2 | 122 | 11 | intro > hook intro > verse 1 > chorus > breakdown > verse 2 > chorus > instrumental break > bridge > final chorus > outro |
| 1 | 7 | 127 | 13 | intro > hook intro > verse 1 > pre-chorus > chorus > breakdown > verse 2 > chorus > instrumental break > bridge > build > final chorus > outro |
| 1 | 12 | 114 | 11 | intro > verse 1 > chorus > breakdown > verse 2 > chorus > instrumental break > build > final chorus > drop reprise > outro |
| 2 | 1 | 63 | 6 | verse 1 > pre-chorus > chorus > verse 2 > instrumental break > final chorus |
| 2 | 2 | 76 | 6 | intro > verse 1 > chorus > verse 2 > chorus > final chorus |
| 2 | 3 | 82 | 6 | intro > verse 1 > chorus > verse 2 > chorus > final chorus |
| 3 | 1 | 64 | 6 | verse 1 > pre-chorus > chorus > verse 2 > instrumental break > final chorus |
| 3 | 2 | 84 | 6 | intro > verse 1 > chorus > verse 2 > chorus > final chorus |
| 3 | 3 | 76 | 6 | hook intro > verse 1 > chorus > verse 2 > breakdown > final chorus |

빠른 3곡의 늘어난 섹션은 전부 간주(intro/breakdown/instrumental break/
build/drop reprise/outro)입니다 — 보컬 섹션은 늘리지 않았습니다(§1.2).

---

## 2·3. Suno 실제 재생 시간

**측정 불가 — 위 0번 참조.** 파일 경로를 남겼습니다.

참고로 이 지시문은 duration 텍스트로 길이를 맞추려는 접근을 금지하므로
(§1.2), 코드가 계산한 예상 길이는 이 판정의 근거가 될 수 없습니다.
`estimateSongLengthSec`의 회귀식(0.80×단어 + 0.20×명목마디)은 62~100 BPM
35곡으로 적합된 것이라 114 BPM 구간에서는 3:34를 예측하지만 실측은
1:58이었습니다 — 이 지시문 자체가 그 괴리에서 출발했습니다.

---

## 4. 팔레트↔exclude 모순 쌍 전체 목록

`npm run check:era-palette-conflict` 신설 (advisory, 항상 exit 0).

### 정적 표 대조 — **0쌍**

17개 팔레트 270개 원자를, 각 팔레트의 `fitsGenreIds` 장르마다 네 곳과
전수 대조했습니다.

1. `ERA_FORBIDDEN_DESCRIPTORS[그 장르의 시대]`
2. 그 장르의 `avoidTraits`
3. `GENRE_FORBIDDEN_DESCRIPTORS`의 해당 규칙
4. 그 장르를 소유한 워크스페이스의 `channelSoundFloor.forbiddenAtoms`

§2.2가 지목한 `funk clavinet groove` / `wah guitar accents`는 **이 네 곳
어디에도 없습니다.** 그 두 문구는 `showa-groove-70s` 장르의 *긍정* rhythm
서술("clavinet comping driving the groove" / "wah guitar accents on the
offbeat")이며, 곡별 `excludePrompt`는 브릿지 에이전트가 작곡 시점에 직접
씁니다.

### 실제 산출물 대조 (`--pack`) — 재현됨

```
lyrics/lyrics/20260816_昭和セブンティーズ_아침커피한잔...json
  #4  Needle Dust — canon-showa-kayokyoku.instrumentation "clavinet"
        vs excludePrompt "crowded clavinet comping" (showa-groove-70s)
  #12 By the Gate  — 동일
```

**처리:** §2.4-B2의 "exclude 쪽을 좁힌다"를 발생 지점에 적용했습니다.
`promptComposer.ts`의 `excludePrompt` 규약에 다음을 추가했습니다 —
"이 트랙 자신의 시대/장르 시그니처 악기·주법·질감은 수식어를 붙여서도
배제하지 말 것. Suno에는 'crowded clavinet comping'도 'no clavinet'으로
읽힌다. 파트가 과밀해지는 것이 걱정이면 stylePrompt에 긍정 절로 써라."

새로 작곡한 9곡은 `--pack` 대조에서 **0쌍**입니다.

**보류한 쌍: 없음.** 정적 표에 모순이 0쌍이라 판단이 애매한 쌍 자체가
나오지 않았습니다.

---

## 5. `canon-showa-kayokyoku` 적용 곡의 stylePrompt 전후

### 수정 전 — 실제 산출물 (`20260816_昭和セブンティーズ` 트랙 1 "First Steam")

```
 1 1970s Kayokyoku          ← 시대 신호
 2 69 BPM
 3 electric piano
 4 live strings
 5 brushed drums
 6 round electric bass
 7 restrained kayokyoku ballad pulse
 8 Verse: IVmaj7-iii7-vi7 movement / Chorus: IV-V-iii-vi royal road progression
 9 mature elegant female mezzo-soprano
10 tender confiding delivery
11 soft breathy grain
12 stepwise three-note hook
13 no intro tag
14 vocal starts immediately
15 full level from first bar
16 analog tape warmth        ← 시대 신호
17 spring plate ambience     ← 시대 신호
18 narrow stereo             ← 시대 신호
19 medium arrangement
20 half-time-weighted chorus entrance
21 old radio and morning coffee mood
22 short intro
23 3:10-3:35
24 full arrangement
25 not a short cut
```

시대/프로덕션 절 **4개 / 25절**, 자리는 **1 · 16 · 17 · 18**.
(지시문 본문의 "3/22"는 같은 곡을 조금 다르게 센 값입니다.)

### 수정 후 — 새 규칙으로 작곡한 세트2 트랙 1 (new-music-70s, canon-showa-kayokyoku)

```
 1 1970s Japanese new music                    ← 장르 = 시대
 2 narrow stereo image                         ← 시대 프로덕션
 3 analog tape saturation                      ← 시대 프로덕션
 4 upright piano
 5 hand-played singer-songwriter band pulse
 6 light kit with soft snare
 7 warm bass
 8 Verse: IVmaj7-iii7-vi7 movement
 9 Chorus: IVM7-III7-vi-I7 marusa progression
10 Bridge: I-vi-IV-V doo-wop progression
11 uncompressed dynamics so the climax rises   ← 시대 프로덕션
12 female narrow intimate lead
13 tender confiding delivery
14 enka-inflected bend on long tones
15 melismatic slide into the chorus
16 sung to a live band take                    ← 시대 창법(녹음 관행)
17 timing drifting by a hair                   ← 시대 창법(녹음 관행)
18 spring reverb on the voice                  ← 시대 프로덕션
19 hook once per early chorus
20 bookended in the last
21 final chorus up an octave
22 brighter and more open
23 muted trumpet answers once in the opening bars
24 singing starts immediately with no intro tag
25 63 BPM                                      ← 뒤로 이동
26 short intro
27 3:10-3:35
28 full arrangement
29 not a short cut
```

시대/프로덕션 절 **6개 / 29절**, 자리는 **1 · 2 · 3 · 11 · 16 · 17 · 18**.
BPM은 2번 → 25번으로 이동. 단어 수는 133 → 117로 **줄었습니다**.

세트2 세 곡: 6/29 · 6/29 · 7/26 (목표 6절 이상 — 달성).

---

## 6. 신설 팔레트 2종

```ts
{
  id: 'canon-chill-rap-boombap',
  labelKo: '칠랩·멜로우 붐뱁',
  eraTag: 'sample-era mellow hip-hop / jazz rap',
  fitsGenreIds: ['chill-rap', 'boom-bap-mellow', 'jazz-rap', 'lofi-hiphop-study'],
  instrumentation: [
    'dusty sampled drum break with a soft kick',
    'filtered upright bass sitting under the beat',
    'electric piano loop chopped from a longer phrase',
    'muted horn stab answering the phrase ends'
  ],
  harmonyTraits: [
    'four-bar minor seventh loop that never fully resolves',
    'jazz turnaround repeating under the whole verse',
    'one borrowed dominant chord marking the hook'
  ],
  vocalTraits: [
    'conversational flow sitting slightly behind the beat',
    'sung hook doubled an octave apart over the same loop',
    'phrases ending early and leaving the loop exposed',
    'recorded in one pass with the loop running underneath',   // B-3
    'punch-ins left audible rather than smoothed away'          // B-3
  ],
  productionTraits: [
    'sampler-era band-limited top end, nothing sparkling above it',
    'drums compressed until the room between hits pumps',
    'vocal mixed close and low, sitting inside the beat rather than on top'
  ],
  percussionStyle: 'brushed',
  koreanReferenceNote: '샘플 기반 멜로우 힙합·재즈랩 계열 — 느슨한 포켓과 먼지 낀 드럼 질감'
}

{
  id: 'canon-deep-house-club',
  labelKo: '딥하우스 클럽',
  eraTag: 'warm analog-leaning deep house / UK garage swing',
  fitsGenreIds: [
    'en-deep-house-melodic', 'en-deep-house-organic', 'en-deep-house-vocal-anthem',
    'en-deep-house-soulful', 'en-deep-house-tech-groove', 'en-house-garage-swing'
  ],
  instrumentation: [
    'four-on-the-floor kick with a long rolling sub under it',
    'filtered analog pad opening across eight bars',
    'plucked chord stab landing on the off-beat',
    'hand percussion layered against the closed hi-hat'
  ],
  harmonyTraits: [
    'two-chord vamp held for the whole groove',
    'minor-to-major lift arriving only at the drop',
    'suspended pad chord resolving late over the bassline'
  ],
  vocalTraits: [
    'hook phrase repeated as a chopped sample rather than sung through',
    'breathy texture used as another layer in the groove',
    'spoken stab placed percussively on the off-beat',
    'hook sung once and reused as a sample, not re-performed',   // B-3
    'phrase clipped short so the groove carries the gap'         // B-3
  ],
  productionTraits: [
    'long filter sweeps doing the arranging instead of new parts',
    'dry tight club low end with the kick and sub locked together',
    'sixteen-bar build and drop shaping the whole track'
  ],
  percussionStyle: 'driving',
  koreanReferenceNote: '따뜻한 아날로그 계열 딥하우스·UK 개러지 스윙 — 필터 스윕과 롱 빌드 중심'
}
```

실측 확인: en-chillhop 12개 장르 중 **10개**가 이제 팔레트를 받습니다
(이전 0개).

**`trap-soul` / `alt-rnb`는 커버하지 않았습니다.** §2.4-B5의 "기존
`canon-soulful-rnb`에 추가하는 것으로 충분한지 먼저 확인"을 확인한 결과,
그 팔레트는 이 두 장르를 **의도적으로 제외**하고 있습니다 — 자기 주석에
"none of them mention digital synths or sub bass, unlike alt-rnb/
contemporary-rnb (excluded)"라고 이유가 기록돼 있습니다. 재사용이
부적절하므로 그대로 두고 보고합니다. 이 두 장르가 필요하면 현대 R&B용
팔레트를 따로 만드는 것이 맞습니다(이 지시문이 요구한 2종에는 포함되지
않아 임의로 늘리지 않았습니다).

---

## 7. B-3에서 추가한 시대 창법 어휘 전체 (35개, 17개 팔레트)

| 팔레트 | 추가 문구 |
|---|---|
| canon-folk-duo | sung live to the guitar with no click reference / breaths and pick noise left in rather than edited out |
| canon-soft-pop-duo | phrases carried across the bar line by portamento / peaks allowed to grow louder instead of being levelled |
| canon-europop-glow | lead tracked in one pass with the players in the room / consonants softened the way a live take leaves them |
| canon-british-beat | lead and harmony captured together in one take / entrances landing a hair early against the drums |
| canon-country-folk | notes slid into rather than struck dead centre / sung at conversational volume with the room left audible |
| canon-crooner-standard | phrase endings tapered away from the microphone / timing sitting a hair behind the orchestra |
| canon-soft-rock-band | lead doubled by singing the line twice, not copied / held notes swelling instead of sitting at one level |
| canon-motown-soul | cut live with the rhythm section in the same room / ad-libs answered across the take, not punched in later |
| canon-doowop-girlgroup | backing parts sung around one shared microphone / entrances slightly ragged the way a live group lands them |
| canon-piano-orchestral-ballad | phrases stretched against the orchestra with no click / the loudest line genuinely louder, not compressed flat |
| canon-warm-gentle-acoustic | sung a step back from the microphone, room included / breaths left in place of edits |
| canon-quiet-storm-synth | held notes carried by breath rather than by the fader / lines connected with a slow slide between pitches |
| canon-showa-kayokyoku | notes connected by portamento rather than struck apart / sung to a live band take, timing drifting by a hair / dynamics left uncompressed so the climax actually rises |
| canon-soulful-rnb | ad-libs sung against the take, not stacked afterwards / phrases landing late and catching up by the bar end |
| canon-tremolo-blues-ballad | notes bent into place rather than hit dead centre / one fixed distance from the microphone, level unridden |
| canon-chill-rap-boombap | recorded in one pass with the loop running underneath / punch-ins left audible rather than smoothed away |
| canon-deep-house-club | hook sung once and reused as a sample, not re-performed / phrase clipped short so the groove carries the gap |

### 성별 단어가 섞이지 않았음을 확인한 방법

세 겹으로 확인했습니다.

1. **삽입 전 스크립트 차단** — 삽입 스크립트가 `core/vocalPlan.ts`의
   `FEMALE_VOICE_TERMS`/`MALE_VOICE_TERMS` 정규식(`\b`로 감싼
   female|girl|woman|women|she|her|soprano|mezzo|contralto|chanteuse|
   diva|alto, male|boy|man|men|he|his|tenor|baritone)을 그대로 복사해
   35개 문구를 전수 검사한 뒤에만 파일을 씁니다.
2. **영구 회귀 테스트** — `tests/eraCanonPaletteVocalPractice.test.ts`가
   17개 팔레트의 모든 `vocalTraits` 문구를 실제
   `detectVocalGender(trait)`에 넣어 `null`인지 확인합니다(문구 하나만으로
   성별이 잡히면 실패).
3. **기존 결함 1건 발견·수정** — 그 테스트가 바로
   `canon-tremolo-blues-ballad`의 `'restrained sung baritone lead'`를
   잡았습니다. v4.9가 금지 범위를 tenor/baritone까지 넓혔을 때 이 팔레트만
   함께 정리되지 않은 것으로, `detectVocalGender`가 이 문구 하나로
   `'male'`을 반환하고 있었습니다. 편곡 성격(낮은 음역, 절제된 발성)은
   유지하고 성별 단어만 걷어냈습니다.

### 새 파일을 만들지 않은 이유 (§2.4-B3 "기존 구조 재사용 먼저")

`data/vocalTechniqueByGenre.ts`를 먼저 읽었습니다. 이 파일은
`familyForGenre(genre)`로 **장르 계열**에만 키가 잡혀 있어 시대 입력이
없습니다. 그 짝인 `data/vocalTechniquesByEra.ts`(시대 5버킷)의
`buildVocalTechniquePlan`은 지시문 65 이후 **호출부가 하나도 없는 사문**
입니다. 거기에 시대 축을 되살리면 곡마다 창법 절이 하나 더 붙어 §4의
"stylePrompt 단어 수를 늘리지 말 것"과 충돌합니다. 그래서 §2.4-B3이
명시적으로 성별 금지사항까지 언급한 `eraCanonPalettes.ts`의 `vocalTraits`를
확장하는 쪽을 택했습니다. 뽑히는 원자 수는 그대로이고 풀만 넓어지므로
**길이 비용이 0**입니다.

---

## 8. `detectVocalGender()` 판정 결과 — 생성한 세트 전곡

| 세트 | # | 슬롯 vocalType | detectVocalGender(stylePrompt) |
|---|---|---|---|
| 1 | 2 | male | male |
| 1 | 7 | male | male |
| 1 | 12 | female | female |
| 2 | 1 | female | female |
| 2 | 2 | mixed (듀엣) | null |
| 2 | 3 | male | male |
| 3 | 1 | male | male |
| 3 | 2 | mixed (듀엣) | null |
| 3 | 3 | female | female |

**단독 성별 7곡은 7곡 모두 정확히 판정됩니다.** 듀엣 2곡의 `null`은
male/female이 둘 다 있을 때의 정상 반환값입니다(듀엣 판정은
`detectVocalGenderPresence`가 담당). **판정 불가 0곡.**

작곡 도중 실측된 사고 하나를 기록합니다: 초안에서 female 3곡의 프롬프트가
`null`이었습니다. 팔레트의 성별 무관 보컬 문구를 쓰다 보니 슬롯이 배정한
`female`이라는 단어 자체가 빠진 것으로, 브릿지 지시문이 "vocalText의 첫
절(성별·음역 정체성)은 항상 유지하라"고 요구하는 바로 그 지점입니다.
세 곡 모두 첫 절을 복원해 고쳤습니다.

---

## 9. stylePrompt 단어 수 전후

| | 값 |
|---|---|
| 기준선(§4가 명시한 현행) | 90~129 단어 |
| 실측 기준선 — `20260816_昭和セブンティーズ` 트랙 1 | 133 단어 / 25절 |
| 새로 작곡한 9곡 평균 | **114.2 단어** |
| 새로 작곡한 9곡 범위 | 101~127 단어 |
| 같은 곡 직접 비교(쇼와 트랙 1) | 133 → 117 단어 |

**증가하지 않았습니다.** B-1이 프로덕션 원자를 2개로 고정하고 B-3가 창법
어휘를 넣었는데도 총량이 준 이유는 두 가지입니다.

- B-1에서 팔레트 원자 총량을 오히려 줄였습니다(평균 3.5 → 3). 5개로
  뽑아 본 실측에서 `tests/seniorBaseline.test.ts`의 프롬프트 길이 하한이
  725 → 794로 깨졌습니다 — 원자를 늘리는 방향 자체가 이 회귀선과 정면으로
  부딪힌다는 확인입니다.
- B-4에서 BPM을 뒤로 보내고, 중복 표현("full arrangement" 이중 등장)과
  길게 늘어지던 킬링포인트/편곡 절을 정리해 자리를 만들었습니다.

`tests/seniorBaseline.test.ts`(프롬프트 길이 min/avg/max 725/844/949 ±20)는
그대로 통과합니다.

---

## 10. 컨셉 500선 4종 매칭률 (회귀 확인)

`scripts/task74ConceptMatchRate.ts`로 브랜치와 `main`을 **같은 방법으로**
측정했습니다.

| 파일 | main | feat/instruction-74 |
|---|---|---|
| 컨셉500_시니어올드팝.md | 398/498 = 79.9% | 398/498 = 79.9% |
| 컨셉500_일본시니어.md | 338/497 = 68.0% | 338/497 = 68.0% |
| 컨셉500_2030케이팝.md | 319/500 = 63.8% | 319/500 = 63.8% |
| 컨셉500_동요.md | 228/499 = 45.7% | 228/499 = 45.7% |

**완전히 동일 — 회귀 없음.** (지시문 본문의 79.6/67.4/58.8/45.0과 소수점
차이가 나는 것은 항목 추출 방식이 조금 다르기 때문이며, 두 실행이 같은
방법을 쓰므로 비교에는 영향이 없습니다.)

### 그 밖의 회귀 확인선

| 검사 | main | 브랜치 |
|---|---|---|
| `check:concept-coverage` ① 매칭률 | 70/70 (100%) | 70/70 (100%) |
| `check:concept-coverage` ③ 계절 오배정 | 0건 | 0건 |
| `check:vocal-technique` ①②③④ | 0/373 · 0건 · 18/373 · 6/373 | 동일 |
| `check:gates` | 통과 13 / 위반 0 | 통과 13 / 위반 0 |
| `check:genre-fidelity` ④ 첫 악기 100자 이내 | 15/15 (25~29자) | 9/9 (37~96자) |

`check:genre-fidelity` ④가 이 작업의 최대 회귀 위험이었습니다(B-4가 악기를
뒤로 밀 수 있음). 앞자리 프로덕션 절을 2개·45자 이내로 묶는 규칙을 넣어
9곡 전부 통과합니다.

---

## 11. `npm test` 전체 결과

```
Test Files  371 passed | 1 skipped (372)
     Tests  4629 passed | 8 skipped (4637)
  Duration  50.76s
```

`npm run typecheck` / `lint` 무오류.

작업 중 건드린 테스트 3건과 사유:

1. `tests/bpmLengthControl.test.ts` — `BPM_ENERGY_BANDS`의 >95 대역 경계를
   섹션 표와 같게 맞추면서 인덱스 기반 단언을 갱신. **95 이하 값은 하나도
   바꾸지 않았고**, 그 사실을 고정하는 단언을 오히려 추가했습니다.
2. `tests/oldpopGenreFamily.test.ts` — 장르쌍 유사도 상한 0.56 → 0.59.
   한 팔레트를 공유하는 자매 장르가 좁은 프로덕션 어휘 풀을 나눠 쓰는
   구조적 결과이며, 이 파일 자신의 0.45/0.55/0.56 재조정과 정확히 같은
   사유입니다(근거 주석 추가). 진짜 감시선인 평균 0.28은 그대로입니다.
3. `tests/hybridRefine.test.ts` — 스텁 곡의 템포 96 → 88 BPM. 새 섹션 하한
   검사가 3섹션짜리 스텁의 점수를 72 → 60으로 낮춰
   `REGENERATE_QUALITY_BAR`(70) 아래로 떨어뜨리면서, `regenerateTrack`이
   트랙당 3회 재시도해 API 호출 수가 2 → 6이 됐습니다. 이 테스트가 재는
   것은 "선택한 트랙마다 정확히 한 번 호출되는가"이므로 스텁을 하한 정책
   비적용 대역으로 내렸습니다.

> **여기서 하나 알려드릴 것이 있습니다.** 위 3번은 테스트 픽스처 문제만이
> 아닙니다. 실제 운용에서도 **96 BPM 이상 곡이 섹션 하한에 못 미치면
> 재생성 경로에서 API를 최대 3배 호출**하게 됩니다. 하한을 못 채운 곡을
> 다시 만들려는 시도이므로 의도한 동작이긴 하지만, 재시도 프롬프트에
> "왜 거절됐는지"가 전달되지는 않아 같은 결함이 3번 반복될 수 있습니다.
> 이 연결(경고 → 재시도 피드백)은 이 지시문의 범위 밖이라 손대지
> 않았습니다. 비용이 신경 쓰이시면 감점 폭(현재 12점)을 낮추거나
> 경고만 남기는 쪽으로 조정할 수 있습니다.

---

## 부록 A — 이 작업이 발견한 것들 (지시문에 없던 사실)

1. **팔레트는 정식 경로에 도달한 적이 없었습니다.** §2.4-B1은
   `rotatingEraPaletteAtoms`가 2~3개만 뽑는 것을 문제로 지목했지만, 실제로
   그 함수를 읽는 코드는 `core/localGenerator.ts`(AGENTS.md가 "미리보기
   전용"으로 규정한 경로) **하나뿐**이었습니다. AGENTS.md가 정식/운영
   경로로 규정한 브릿지에는 팔레트 원자가 **0개** 도달하고 있었고, 남아
   있던 시대 신호 3개는 전부 `genreLibrary`의 `production` 배열에서 온
   것이었습니다. `PreassignedSongSlot.eraPaletteText`를 신설해 도달 경로를
   만들었습니다.

2. **시니어 워크스페이스도 이 정책의 영향을 받습니다.** `senior-morning`의
   `tempoCeiling`이 100이라 18곡 중 3곡이 100 BPM으로 나옵니다. 이 3곡은
   6-7섹션 → 9-11섹션으로 바뀝니다. §8은 "95 BPM 이하"를 보호하므로
   규칙상 위반은 아니지만, 시니어 발라드가 길어질 수 있습니다 — 청취
   확인 대상으로 올려 둡니다. 워크스페이스로 게이트를 걸어야 한다면
   `minTotalSectionsForBpm` 한 곳만 고치면 됩니다.

3. **§4의 "시대 절 6개 이상"과 지시문 59의 "첫 악기 100자 이내"는 정면으로
   부딪힙니다.** 앞자리에 프로덕션 절을 3개 이상 두면 첫 악기가 101~114자로
   밀립니다(실측). 앞자리는 짧은 캡처 절 2개까지, 나머지 캡처 세부는 악기
   블록 바로 뒤(7~9번 자리)로 두는 배치로 둘 다 만족시켰습니다.

4. **`check:genre-fidelity` ①은 일본 계열 장르에서 항상 실패합니다.**
   "1970s Japanese new music"처럼 장르명이 연대로 시작하면
   `classifyClause`가 그 절을 `era`로 분류해 "장르로 시작하지 않는다"고
   판정합니다. 기존 산출물(`20260816` 팩)도 **0/15**로 같은 상태이므로
   이 작업이 만든 회귀가 아닙니다 — 별도 지시문 대상으로 남겨 둡니다.

## 부록 B — 저장소 상태 이상 (작업과 무관, 보고만)

`D:\00suno-current`의 `.git` 디렉터리가 저장소 루트가 아니라
`D:\00suno-current\api\.git`에 있습니다. 그래서 루트에서 `git status`를
치면 "not a git repository"가 나오고, `api` 안에서 치면 추적 파일 전부가
삭제된 것으로 보입니다. 이번 작업은 매 명령에
`--git-dir`/`--work-tree`를 명시해 저장소 배치를 건드리지 않고 진행했습니다.

정상화하려면 `api/.git`을 루트로 옮기고 연결된 워크트리를 복구하면
됩니다(`C:/suno/suno-14`가 `feat/instruction-16`으로 연결돼 있습니다).
되돌릴 수 있는 작업이지만 하루의 환경이므로 임의로 하지 않았습니다.

---

# 지시문 74 — 후속 보고 (재발행분)

지시문 74가 다시 들어와 **현재 main 상태를 먼저 대조**했습니다. TASK A·B는
위 보고대로 `f8718e5`로 이미 병합돼 있고, `git diff f8718e5 HEAD -- src/
scripts/ tests/`가 비어 있어 `.git` 유실 복구(`896b2ec`)로도 유실된 것이
없습니다. 그 커밋은 `.claude/worktrees/**`만 추가했습니다.

대조 결과 **도달하지 않은 항목 4개**를 찾아 이번에 처리했습니다. 위 보고서
본문은 그대로 두고 이 절만 덧붙입니다.

## 이번에 채운 것

| § | 항목 | 이전 상태 |
|---|---|---|
| 3.3 | `scoreSong` 절 단위 중복 검사 | **없었음** |
| 3.3 | 인트로 모순 — 부정 접두어 일반형 | 부정어와 어휘가 맞붙은 경우만 |
| 3.3 | 브릿지 금지 3종(구조 재기술·`LOCK:`·화성 기호) | **없었음** |
| 1.2 | 간주 태그에 마디 수 명시 지시 | **없었음** (섹션 하한만 있었음) |

커밋 2건: `139c483`(TASK C) · `58e1192`(TASK A §1.2).

## §8-5 중복 절 검사 출력 — 수정 전 저장분에서 실제로 검출됨

| 대상 | 곡 수 | 검출된 곡 | 건수 |
|---|---|---|---|
| `lyrics/` | 1,110 | 177 (16.0%) | 241 |
| `lyrics/lyrics/` | 813 | 142 (17.5%) | 199 |

실제 검출 예:

```
taskH/set1-songs.json #3 "Rest Here, My Love"
   [exact]     "soft kick drum"                  가 두 번 (절 3, 절 13)
   [contained] "clean electric guitar arpeggios" ⊂ "instruments: clean electric guitar arpeggios"

20260816_따라하는율동동요_… #13 "Sort It Happy"
   [contained] "I-IV-I-V progression"            ⊂ "Verse: I-IV-I-V progression"

20260826_AfterHoursDeepHouse_봄을기다리며_02.json #2   ← 이번 주 생성분도 걸립니다
   [contained] "filtered bass"                   ⊂ "filtered bass warmth"
```

오검출 방지로 확인한 것: 섹션 한정 머니코드("maj7 color" vs "maj7 add9
color")는 부분 문자열이 아니라 걸리지 않고, 한 단어짜리 절("bright" ⊂
"bright synth pluck")은 애초에 제외합니다. 둘 다 테스트로 고정했습니다.

## §8-6 인트로 모순 검사 출력 — 세 표현 전부

| 절 | classifyClause | introSubcategory |
|---|---|---|
| `no intro tag` | intro | immediate |
| `no instrumental intro` | intro | immediate |
| `vocal enters immediately` | intro | immediate |
| `without an intro` | intro | immediate ← **이번에 고친 것** |
| `no long instrumental intro` | intro | immediate |
| `without a chord intro` | intro | immediate |
| `short intro` | intro | has-intro |
| `no strings until the intro ends` | — | — (인트로 부정 아님, 뒤집지 않음) |

§8-6이 이름으로 지목한 세 표현은 지시문 68 이후 **이미 전부 잡히고
있었습니다.** 실제로 새던 것은 부정어와 어휘 사이에 단어가 끼는 경우로,
`without an intro`가 통과했습니다.

## 아직 달성하지 못한 것

**§5의 "stylePrompt 평균 60단어 이하"는 달성하지 못했습니다.** 현재 검증
세트 9곡 실측:

| 세트 | 곡별 단어 수 | 평균 |
|---|---|---|
| 세트1 딥하우스 | 118 / 127 / 115 | 120.0 |
| 세트2 쇼와 70s | 117 / 122 / 108 | 115.7 |
| 세트3 칠랩 | 107 / 101 / 113 | 107.0 |

기준선(133단어)보다는 줄었지만 60단어와는 거리가 멉니다. 이번에 넣은 금지
3종은 **앞으로 쓰이는 프롬프트**에만 작용하므로 이 수치를 바꾸지 못합니다.
60단어에 닿으려면 §3.2가 열거한 낭비를 없애는 것만으로는 부족하고, 지금
25~29개인 절 자체를 줄여야 합니다 — 그건 지시문 59의 요소 순서·필수 축
규약과 정면으로 걸리는 별도 작업이라 임의로 손대지 않았습니다.

**§7 청취 검증은 여전히 불가**합니다(위 0번과 같은 사유). 생성용 파일
경로도 그대로입니다.
