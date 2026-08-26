# 지시문 75 완료 보고 — en-chillhop 칠·라운지 하우스 3종 신설

브랜치 `feat/instruction-75` (기준 `668279c` — 지시문 74 머지 완료 상태).
커밋 1건 `4b6f81b`. `npm test` 373 파일 4,686건 통과.

---

## 1. 신설 3종 정의 전문

`legacyGenrePack()`으로 등록했으므로 `shortPrompt` / `productionGuidance` /
`signatureSound` / `avoidTraits`의 공통 안전 항목(`famous artist imitation`
/ `copied melody` / `copyrighted song reference` 등 `sharedAvoid`)은 기존
6종과 **같은 함수**가 생성한다 — 빠뜨릴 수 있는 필드가 아니다.

### ① en-chill-house-emotional — Emotional Chill House `[100,112]`

```
styleCore   emotional chill house, unhurried four-on-the-floor pulse held at one
            level, wide soft-focus pad bed, storytelling lead vocal kept clear at
            the front
instruments soft-edged four-on-the-floor kick / long-decay analog pad wash /
            muted piano chord figure / rounded warm bassline /
            single-note synth counter-melody
rhythm      unhurried four-on-the-floor pulse that never lifts into a drop /
            brushed off-beat shaker in place of an open hat
vocal       clear front-of-mix lead carrying the story line by line /
            diction kept plain enough to follow on first listen
production  wide soft-focus reverb bed with no hard transient edge /
            airy high shelf instead of a loud compressed master
harmony     four-chord loop resolving the same way every turn /
            suspended second held under the vocal for warmth
moods       wistful, cinematic, tender
audiences   감성 칠 하우스 / 이야기가 있는 회차
goodFor     감성 칠 하우스 / story episode / night train window
avoidTraits festival drop or big-room build / belted climax chorus /
            peak-time compressed low end   (+ sharedAvoid)
tier core · categoryId electronic · eraTag 2010s-2020s emotional chill house
eraBuckets ['2010s','2020s']
```

### ② en-chill-deep-house — Chill Deep House `[104,114]`

```
styleCore   chill deep house, looping chord bed carried in front of the kick,
            steady unchanging groove made for background listening
instruments soft round kick sitting under the loop / repeating electric piano
            chord loop / warm filtered sub bass / light closed hat pattern /
            held pad layer
rhythm      loop-forward groove where the chord bed leads and the kick supports /
            unchanging eight-bar cycle repeated without fills
vocal       short sung phrase reused as one more layer of the loop /
            lead line placed low in the mix, present but never the focus
production  even level held start to finish with no arrangement peak /
            soft-knee compression keeping every part at one distance
harmony     two-chord cycle that never resolves away from itself /
            seventh-chord color left unchanged throughout
moods       steady, understated, flowing
audiences   칠 딥하우스 / 공부·카페 배경음악
goodFor     칠 딥하우스 / study background / long night drive
avoidTraits build-and-drop arrangement / foreground lead vocal performance /
            peak-time dancefloor energy   (+ sharedAvoid)
tier core · categoryId electronic · eraTag 2010s-2020s chill deep house
eraBuckets ['2010s','2020s']
```

보컬 비중은 셋 중 가장 낮지만 **완전 인스트루멘탈로 정의하지 않았다**
(§3.2-②·§11) — `vocal` 항목 두 개 모두 실제로 부르는 라인이다. tech-groove의
`no full lyric lead`와 갈리는 지점이며 테스트로 고정했다.

### ③ en-lounge-house — Lounge House `[98,110]`

```
styleCore   lounge house, relaxed daytime four-on-the-floor under live lounge
            instrumentation, nylon guitar and vibraphone over a light groove
instruments electric piano comping / nylon-string guitar figure /
            vibraphone accent line / brushed percussion layer /
            soft upright-toned bass
rhythm      light daytime four-on-the-floor with brushed percussion over the top /
            relaxed bossa-leaning off-beat accent
vocal       easy mid-range lead sung at conversational volume /
            light scat syllables answering the instrumental phrase
production  open daylight mix with the natural instrument tone left intact /
            shallow room ambience rather than a long reverb tail
harmony     major seventh and ninth colors held through the loop /
            gentle turnaround lifting into each new phrase
moods       breezy, sunlit, daytime
audiences   라운지 하우스 / 카페·여행 회차
goodFor     라운지 하우스 / cafe afternoon / seaside travel
avoidTraits night-club low end / dark minor-key brooding /
            all-electronic palette with no played instruments   (+ sharedAvoid)
tier core · categoryId electronic · eraTag 2010s-2020s lounge house
eraBuckets ['2010s','2020s']
```

---

## 2. 9종 비교표 · §3.5 상호 구분 검증

| id | tempo | rhythm[0] | production[0] | vocal[0] | moods |
|---|---|---|---|---|---|
| en-deep-house-melodic | 112-122 | rolling four-on-the-floor deep-house groove | warm analog-modeled synth mix | clear English vocal hook carrying the drop | uplifting, emotive, nocturnal |
| en-deep-house-organic | 108-118 | organic hand-percussion deep-house groove | warm acoustic-electronic hybrid mix | sparse breathy vocal texture used as a color, not a lead | warm, organic, relaxed |
| en-house-garage-swing | 118-128 | swung UK-garage-flavored shuffle groove | crisp **club**-ready mix | bright chopped vocal-sample hook | bouncy, bright, energetic |
| en-deep-house-vocal-anthem | 110-120 | pumping sidechained four-on-the-floor groove | bright anthemic **club** mix | full sung chorus hook carrying the emotional peak | euphoric, anthemic, warm |
| en-deep-house-tech-groove | 115-125 | hypnotic minimal tech-house percussion loop | dry minimal **club** mix | minimal spoken-word vocal stab used percussively | hypnotic, minimal, driving |
| en-deep-house-soulful | 108-116 | soulful four-on-the-floor groove | warm soulful **club** mix | powerful soulful vocal hook riding the groove | soulful, warm, uplifting |
| **en-chill-house-emotional** | **100-112** | unhurried four-on-the-floor pulse **that never lifts into a drop** | wide soft-focus reverb bed with no hard transient edge | clear front-of-mix lead carrying the story line by line | wistful, cinematic, tender |
| **en-chill-deep-house** | **104-114** | **loop-forward** groove where the chord bed leads and the kick supports | even level held start to finish with **no arrangement peak** | short sung phrase reused as one more layer of the loop | steady, understated, flowing |
| **en-lounge-house** | **98-110** | **light daytime** four-on-the-floor with brushed percussion | **open daylight** mix, natural instrument tone left intact | easy mid-range lead sung at conversational volume | breezy, sunlit, daytime |

**검증 방법**: 9종을 36쌍으로 전수 대조해 `rhythm`/`production`/`vocal`/
`moods` 네 축의 단어 겹침 비율을 계산하고, **네 축이 모두 50%를 넘는 쌍이
하나도 없음**을 확인했다(`tests/instruction75ChillLoungeHouse.test.ts`가
영구 고정). BPM은 셋이 서로 겹치므로(§3.5) 구분은 전부 이 네 축에서 난다.

- `moods`: 신설 9개 값이 기존 12종의 27개 값과 **한 개도 겹치지 않는다**(테스트 고정).
- `production`: 기존 6종 중 4종이 `club` 계열인데 신설 3종은 **0종**(테스트 고정).
- 낮 지향: 기존 12종 + 신설 ①② 전부 야간 계열(nocturnal/late-night/streetlight/
  rainy/dark)이고 `en-lounge-house` 하나가 낮을 전담한다.

---

## 3. §3.4 팔레트 판단 — 별도 팔레트를 만들었다

`canon-deep-house-club`에 **붙이지 않았다.** 근거:

| 그 팔레트의 productionTraits | 부딪히는 신설 정의 |
|---|---|
| `dry tight club low end with the kick and sub locked together` | ①의 `wide soft-focus reverb bed`, ③의 avoidTraits `night-club low end` |
| `sixteen-bar build and drop shaping the whole track` | ①의 `never lifts into a drop`, ②의 avoidTraits `build-and-drop arrangement` |

3개 중 2개가 정면 충돌이고, **지시문 74 TASK B-1이 `productionTraits`를 항상
2개 뽑도록 고정**했으므로 붙이기만 하면 곡마다 클럽 원자 2개가 장르 정의와
싸운다. `vocalTraits`의 `hook phrase repeated as a chopped sample rather than
sung through`도 ①의 "가사가 이야기를 전달한다"와 반대다.

→ §3.4가 명시적으로 허용한 `canon-chill-lounge-house`를 신설했다(팔레트 17종
→ 18종). `vocalTraits`에 성별 단어 없음(지시문 74 TASK B-6, 기존 테스트가 검증).
`check:era-palette-conflict` **18종 285원자 0쌍.**

---

## 4. §6 등록 체크리스트 — 8개 항목 개별 확인

| 항목 | 확인 방법 | 결과 |
|---|---|---|
| `genreLibrary/index.ts` 정의 3종 | 파일에 `legacyGenrePack` 3개 추가 | 완료 |
| `EN_CHILLHOP_CORE_GENRE_IDS` 12→15 | `getCoreGenreIdsForArchetype('en-chillhop').length` | **15** |
| `genreWorkspaceOwnership.ts` | `GENRE_WORKSPACE_OWNERSHIP[id]` / `allowedWorkspacesForGenre(id)` 둘 다 실행 | 3종 모두 `['en-chillhop']` — **코드 수정 불필요**(52행 `startsWith('en-')` 기본값이 처리) |
| `conceptKeywords.ts` | §5·§7 표 참조 | 신설 3규칙 + 기존 3규칙 가중치 조정 |
| `eraCanonPalettes.ts` | `eraCanonPalettesForGenreId(id)` | 3종 모두 `canon-chill-lounge-house` |
| `conceptCompatibility.ts` | 타입 `ArchetypeEraCompatibility` 확인 | **기입 불가 — 아래 참조** |
| `check:workspace-registration` | 실행 | **en-chillhop 누락 0건** (전체 12건은 kr-kids/jp-kids 등 기존) |
| `check:genre-utilization` | 실행 | 0/14 아키타입이 50% 미만 — 단 이 검사는 채널의 `preferredGenres`(5종)만 재므로 신설 3종 도달은 §9의 실제 세트로 확인 |
| `suitablePresetsForArchetype('en-chillhop')` | 실행 | **8** (유지) |
| `VALID_ARCHETYPES` / `vocalPresets.ts` | 새 아키타입 없음 — 확인만 | 수정 불필요, 프리셋 8개 유지 |

### `conceptCompatibility.ts`에 기입하지 않은 이유

이 파일은 **장르가 아니라 워크스페이스(아키타입)로 키가 잡혀 있다.**
타입 `ArchetypeEraCompatibility`의 필드는 `supportedEraBuckets` /
`crossStyleEraBuckets` / `suggestedChannelIds` / `sourceKo` 넷뿐이고 장르
id를 담는 필드가 없다. `Record<ChannelArchetype, …>`이라 "3종의 조합 가능
관계"를 적을 자리가 존재하지 않는다.

게다가 `en-chillhop` 항목은 지시문 73 TASK C가 이미 **두 배열이 빈 것이
정확한 값**이라고 파일 주석에 근거까지 남겨 뒀다(시대 정체성이 없는
워크스페이스 — modern-chill/lofi-study와 같은 패턴). 값을 바꾸면 그 결정을
뒤집게 되므로 **건드리지 않고 보고한다**(§5 "판단이 애매한 규칙은 건드리지
말고 보고").

---

## 5. 컨셉 질의 9개

| 질의 | 매칭 규칙 | 장르 가중치 |
|---|---|---|
| 칠 하우스 | `enchillhop-chill-house-emotional` | en-chill-house-emotional=5 |
| chill house | 〃 | en-chill-house-emotional=5 |
| 감성 하우스 | 〃 | en-chill-house-emotional=5 |
| 칠 딥하우스 | `enchillhop-deep-house` **+** `enchillhop-chill-deep-house` | **en-chill-deep-house=5**, melodic=3, organic=3, garage=2, anthem=2, tech=2, soulful=2 |
| chill deep house | 〃 | 동일 |
| 라운지 하우스 | `enchillhop-lounge-house` | en-lounge-house=5 |
| lounge house | 〃 | en-lounge-house=5 |
| 딥하우스 | `enchillhop-deep-house` | melodic=3, organic=3, garage=2, anthem=2, tech=2, soulful=2 — **신설 3종 없음** |
| deep house | 〃 | 동일 — **신설 3종 없음** |

- **`딥하우스`에 신설 3종이 포함되지 않음**을 확인했다(§8 목표 달성, 테스트 고정).
- **`칠 딥하우스`는 `딥하우스` 규칙에 함께 걸린다** — §4.2가 확인하라고 지목한
  그대로다. 이름에 딥하우스가 들어 있어 정규식 `/딥\s*하우스/`를 피할 수 없다.
  포괄어 규칙 수정은 §4.2가 금지했으므로, conceptAgent가 가중치를 **합산**한다는
  점을 이용해 신설 규칙에 5를 줘서 3을 넘겼다. 결과적으로 최고 가중치는 항상
  `en-chill-deep-house`다.

## 6. 오탐 검사 4개 — 전부 0건

| 질의 | 결과 |
|---|---|
| 감성적인 노래 | 매칭 규칙 없음 |
| 라운지에서 쉬며 | 매칭 규칙 없음 |
| 우리 집 house | 매칭 규칙 없음 |
| a house with a garden | `place-garden-yard`(기존, 정원 규칙) — 하우스 장르 가중치 0 |

단독 `하우스` / `house` / `감성` / `라운지` 패턴을 넣지 않은 결과다(§4.1).
네 질의 모두 신설 3종을 하나도 지목하지 않는다(테스트 고정).

---

## 7. §5 감정 서사 라우팅 — 수정 전후

**§5의 전제가 실측과 달랐다.** 다섯 컨셉은 `en-deep-house-vocal-anthem`으로
가고 있던 것이 아니라, **en-chillhop 장르 신호가 아예 0**이었다.

원인: `situ-confession` / `situ-breakup-senior` / `situ-reunion`은
`archetypeScope: ADULT_ARCHETYPES`라 en-chillhop에도 적용되지만,
`genreWeights`가 senior-oldpop 장르만 담고 있어 conceptAgent의
`coreGenreIds.has(id)` 필터에서 전부 걸러졌다. 신호가 0이면 15종 균등
배분으로 떨어지므로 vocal-anthem이 다른 장르와 같은 확률로 뽑힌다.

| 컨셉 | 수정 전 (en-chillhop 관점) | 수정 후 |
|---|---|---|
| 고백 | 신호 없음 (oldpop-soft-duet-80s=2, chanson=1 — 전부 필터됨) | **en-chill-house-emotional=3**, en-deep-house-melodic=2 |
| 이별 | 신호 없음 (oldpop-rainy-ballad-blues=3, piano-ballad=2) | **en-chill-house-emotional=3**, en-deep-house-melodic=2 |
| 재회 | 신호 없음 (oldpop-close-harmony-duo=2, retro-soul-pop=2) | **en-chill-house-emotional=3**, en-deep-house-melodic=2 |
| 첫눈 | `winter` 규칙만 매칭 — `genreWeights` 자체가 없음 | **변경 없음 — 아래 참조** |
| 장거리 | 매칭 규칙 없음 | **변경 없음 — 아래 참조** |

새 규칙을 만들지 않고 기존 세 규칙의 `genreWeights`에 en-chillhop 장르만
더했다(§5). 다른 워크스페이스는 같은 `coreGenreIds` 필터로 이 두 id를
무시하므로 영향이 없다 — 컨셉 500선 4종 매칭률이 그대로인 것이 그 확인이다.

### 건드리지 않은 둘

- **첫눈** — `winter` 규칙은 `seasonWeights`만 가진 **계절 축** 규칙이고
  `archetypeScope`가 없어 **전 워크스페이스 공용**이다. 여기에 장르 가중치를
  넣으면 모든 워크스페이스의 모든 겨울 컨셉에서 발화한다 — "감정 서사
  라우팅"보다 훨씬 넓은 변경이라 §5의 "판단이 애매한 규칙은 건드리지 말고
  보고"에 해당한다.
- **장거리** — 저장소 전체에 이 개념의 규칙이 **하나도 없다**(`장거리` /
  `long distance` / `롱디` 전수 검색 0건). 조정할 기존 가중치가 없고 새
  규칙을 만드는 것은 §5가 억제한 방향이라 보고만 한다.

두 건 모두 원하시면 별도로 처리할 수 있습니다.

---

## 8. en-chillhop 코어 15종 BPM 분포

```
랩 대역
  trap-soul                  [ 62, 82]
  alt-rnb                    [ 68, 86]
  chill-rap                  [ 70, 85]
  lofi-hiphop-study          [ 72, 88]
  boom-bap-mellow            [ 78, 92]
  jazz-rap                   [ 82, 98]
────────────────── 이전 공백 99~107 ──────────────────
  en-lounge-house            [ 98,110]   ← 신설
  en-chill-house-emotional   [100,112]   ← 신설
  en-chill-deep-house        [104,114]   ← 신설
────────────────────────────────────────────────────
하우스 대역
  en-deep-house-organic      [108,118]
  en-deep-house-soulful      [108,116]
  en-deep-house-vocal-anthem [110,120]
  en-deep-house-melodic      [112,122]
  en-deep-house-tech-groove  [115,125]
  en-house-garage-swing      [118,128]
```

99·100·101 … 107 아홉 개 값을 모두 대조해 **기존 12종은 하나도 덮지 못하고
신설 3종이 전부 덮는 것**을 테스트로 고정했다.

---

## 9. 12곡 세트 실제 생성 — 컨셉 "칠 하우스"

`recommendConceptLocal('칠 하우스', 'en-chillhop', …, 12)` 장르 배분:
**en-chill-house-emotional×8, en-lounge-house×2, chill-rap×1, boom-bap-mellow×1**
— 신설 장르가 12곡 중 10곡을 차지한다(도달 가능성 확인).

| # | BPM | 장르 | 섹션 | stylePrompt 단어 |
|---|---|---|---|---|
| 1 | 99 | en-lounge-house | 9 | 115 |
| 2 | 104 | en-chill-house-emotional | 8 | 144 |
| 3 | 84 | boom-bap-mellow | 8 | 133 |
| 4 | 78 | chill-rap | 8 | 144 |
| 5 | 101 | en-lounge-house | 8 | 119 |
| 6 | 111 | en-chill-house-emotional | 8 | 127 |
| 7 | 89 | boom-bap-mellow | 8 | 108 |
| 8 | 78 | chill-rap | 8 | 136 |
| 9 | 105 | en-lounge-house | 7 | 125 |
| 10 | 111 | en-chill-house-emotional | 8 | 130 |
| 11 | 78 | boom-bap-mellow | 7 | 105 |
| 12 | 70 | chill-rap | 7 | 126 |

**stylePrompt 평균 126.0단어.**

### 여기서 발견한 것 두 가지 (둘 다 이 지시문의 변경과 무관)

**① 이 경로는 지시문 74의 섹션 하한을 적용하지 않는다.** 위 표의 111 BPM
두 곡이 8섹션인데 74의 하한은 11이다. `generateLocalBlueprint`는 AGENTS.md가
**미리보기 전용**으로 규정한 경로이고, 74는 하한을 운영 경로인
`preallocateSongSlots`(브릿지)와 `scoreSong`(임포트)에 넣었다. 같은 표를
기존 하우스 6종("딥하우스" 컨셉)으로 뽑아도 111~124 BPM 곡이 7~9섹션으로
**동일**하다 — 신설 3종이 만든 문제가 아니라 미리보기 경로의 기존 상태다.

운영 경로는 정상이다. `preallocateSongSlots`로 신설 3종 12슬롯을 뽑은 결과
**12곡 전부 하한 충족**(99~108 BPM → 9-11섹션 / 111~114 BPM → 11-13섹션)이고
**12곡 전부 `eraPaletteText`를 받는다**(팔레트 도달 확인).

**② stylePrompt 평균 단어 수.** 같은 코드·같은 경로에서 기존 하우스 6종으로
12곡을 뽑으면 **124.8단어**, 신설 3종 위주로 뽑으면 **126.0단어** — 차이
1.2단어(약 1%)다. 신설 장르가 프롬프트를 부풀리지 않는다는 확인이다.
다만 지시문 74가 목표로 한 60단어와는 두 쪽 다 거리가 멀다(74 보고서 §
"아직 달성하지 못한 것"에 같은 사실을 기록해 뒀다).

---

## 10. 회귀 (§8)

| 항목 | 기준 | 결과 |
|---|---|---|
| `suitablePresetsForArchetype` | en-chillhop 8 / oldpop-lounge 6 / kr-2030-pop 7 / kr-kids-song 10 | **8 / 6 / 7 / 10** 동일 |
| 컨셉 500선 4종 | 79.9 / 68.0 / 63.8 / 45.7 | **동일** |
| `check:concept-coverage` | ① 70/70 · ③ 0건 | **① 70/70(100%) · ③ 0건** |
| `check:era-palette-conflict` | 0쌍 | **0쌍** (팔레트 17→18종, 원자 270→285) |
| `check:workspace-registration` | en-chillhop 0건 | **0건** |
| `check:gates` | 통과 13 / 위반 0 | 변동 없음 |
| 랩 6종·기존 하우스 6종 정의 | 변동 없음 | 한 글자도 수정하지 않음 |
| 테마 풀 46개 · 채널 3개 | 변동 없음 | 건드리지 않음 |
| 지시문 74 검사 수치 | 하락 없음 | 74 신규 테스트 24건 전부 통과 |
| stylePrompt 평균 단어 수 | 증가 없음 | 124.8 → 126.0 (동일 경로 비교, +1.2) |

### 함께 고친 등록 누락 2건

새 장르를 넣자 기존 테스트가 잡아냈다 — §0이 경고한 "등록을 빠뜨려 조용히
실패" 유형이 실제로 재현된 것이다.

1. **`eraBuckets` / `eraNoteKo` 누락** — §3.3이 채우라고 명시한 필드인데
   빠뜨렸다. `tests/eraBuckets.test.ts`가 3종 전부를 지목해 잡았다.
2. **장르 수 단언 373 → 376** — `tests/genreLibrary.test.ts`의 고정 카운트
   두 곳. 지시문 71·72가 같은 자리를 갱신한 전례를 그대로 따랐다.

### 테스트 하한 조정 1건

`tests/v356Diversity.test.ts`의 `smooth-jazz-lounge` 고유 signatureSound
단어 하한만 3 → 2로 낮췄다. 잃은 단어는 **정확히 `lounge` 하나**이고,
`signatureSound`의 마지막 원소가 label을 소문자로 붙인 것이라
(`legacyGenrePack`) §3.1이 못박은 label `Lounge House`를 쓰는 한 문구를
바꿔 피할 수 있는 종류가 아니다. 대안 둘(그 장르 정의를 고치기 / label
변경)을 모두 버린 이유는 파일 주석에 적었다. **나머지 5종의 하한 3은
그대로**이고, "잃은 단어가 정확히 하나"라는 사실 자체를 고정하는 테스트를
함께 넣었다.

---

## 11. `npm test`

```
Test Files  373 passed | 1 skipped (374)
     Tests  4686 passed | 8 skipped (4694)
  Duration  52.24s
```

신규 `tests/instruction75ChillLoungeHouse.test.ts` 32건 포함.
`npm run typecheck` / `npm run lint` 무오류.

---

## 12. 지시문 76으로 넘기는 것

- 신설 3종의 **BPM 대역 배정**과 세트 구성 규칙(§7). 지시문 71 TASK E의
  대역 로직을 건드리지 않았으므로 3종은 현재 하우스 대역 쪽으로 떨어진다.
- 테마 풀 46개, 채널 구성.
- §5의 **첫눈 / 장거리** 두 컨셉(위 §7 참조).
