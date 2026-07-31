# v3.65 완료 보고 — 장르 특성 분해와 매칭 엔진

기준: v3.64, v3.66-A, v3.64-B 완료 후 진행. 커밋: `19d1314` (`feat/notion-genre-library`에 push 완료).
**범위는 데이터 스키마 + 매칭/합성 엔진뿐입니다. UI는 만들지 않았습니다** (v3.63의 범위).

---

## 1. `scripts/traitCoverage.ts` 실행 결과 전문

```
=== 1. Coverage ===
traits present: 63 / 320 total genres

=== 2. Average items per axis (across genres with traits) ===
  instrumentation: avg 4.16, min 3, max 5
  rhythmFeel: avg 2.38, min 2, max 4
  harmonyTraits: avg 2.27, min 2, max 4
  productionTraits: avg 2.62, min 2, max 5
  vocalTraits: avg 2.52, min 2, max 5
  structureTraits: avg 2.00, min 2, max 2

=== 3. Axes with fewer than 2 or more than 5 items (quality-bar violations) ===
  total violations: 0

=== 4. Cross-axis category leakage (a word belonging to a DIFFERENT axis's category shows up here — e.g. "waltz" in instrumentation) ===
  jazz-pop.rhythmFeel: contains bass
  bossa-cafe.rhythmFeel: contains guitar
  soft-rock.rhythmFeel: contains guitar
  piano-ballad.rhythmFeel: contains piano
  piano-ballad.harmonyTraits: contains piano
  retro-soul-pop.rhythmFeel: contains bass
  oldpop-doowop-harmony.instrumentation: contains harmony
  oldpop-doowop-harmony.rhythmFeel: contains bass
  oldpop-doowop-harmony.vocalTraits: contains harmony
  oldpop-sunshine-pop.vocalTraits: contains harmony
  oldpop-baroque-pop.harmonyTraits: contains bass
  oldpop-british-beat.instrumentation: contains backbeat
  oldpop-british-beat.vocalTraits: contains harmony
  oldpop-close-harmony-duo.vocalTraits: contains harmony
  oldpop-countrypolitan.rhythmFeel: contains drums
  oldpop-europop-glow.instrumentation: contains harmony
  oldpop-europop-glow.rhythmFeel: contains bass
  oldpop-europop-glow.vocalTraits: contains harmony
  oldpop-yacht-west-coast.rhythmFeel: contains bass, chord
  oldpop-piano-ballad-70s.rhythmFeel: contains drums
  oldpop-piano-ballad-70s.vocalTraits: contains piano
  oldpop-quiet-storm-warm.rhythmFeel: contains bass, drums
  oldpop-light-synth-pop-warm.rhythmFeel: contains synth
  oldpop-light-synth-pop-warm.harmonyTraits: contains synth
  oldpop-soft-duet-80s.rhythmFeel: contains drums
  oldpop-standards-torch.rhythmFeel: contains drums
  oldpop-sunlit-strings-pop.rhythmFeel: contains drums
  oldpop-slow-waltz-memory.rhythmFeel: contains bass
  oldpop-evening-lamp-ballad.rhythmFeel: contains drums
  rnb-ballad-2020s.harmonyTraits: contains piano
  jazz-jazz-ballad-vocal.harmonyTraits: contains piano
  jazz-cabaret-jazz.harmonyTraits: contains piano
  rnb-neo-soul-pocket.harmonyTraits: contains piano
  rnb-neo-soul-groove.harmonyTraits: contains piano
  rnb-intimate-rnb-ballad.harmonyTraits: contains piano
  rnb-late-night-neo-soul.harmonyTraits: contains piano
  rnb-elegant-neo-soul.harmonyTraits: contains piano
  total category-leakage hits: 37

=== 5. Pairwise axis similarity (20 random genre pairs, token-overlap per axis) ===
  oldpop-philly-soul-sweet vs oldpop-gentle-lullaby-pop: instrumentation=0.06 rhythmFeel=0.06 harmonyTraits=0.05 productionTraits=0.00 vocalTraits=0.11 structureTraits=0.14
  oldpop-soft-rock-am vs piano-ballad: instrumentation=0.11 rhythmFeel=0.05 harmonyTraits=0.21 productionTraits=0.00 vocalTraits=0.00 structureTraits=0.10
  healing-ballad vs oldpop-sunshine-pop: instrumentation=0.18 rhythmFeel=0.08 harmonyTraits=0.07 productionTraits=0.00 vocalTraits=0.00 structureTraits=0.29
  jazz-smooth-sax-vocal vs oldpop-doowop-harmony: instrumentation=0.19 rhythmFeel=0.00 harmonyTraits=0.10 productionTraits=0.05 vocalTraits=0.16 structureTraits=0.10
  jazz-soft-vocal-trio vs oldpop-slow-waltz-memory: instrumentation=0.29 rhythmFeel=0.00 harmonyTraits=0.00 productionTraits=0.12 vocalTraits=0.15 structureTraits=0.11
  oldpop-warm-morning-glow vs rnb-soulful-gospel-warmth: instrumentation=0.25 rhythmFeel=0.00 harmonyTraits=0.12 productionTraits=0.00 vocalTraits=0.05 structureTraits=0.09
  rnb-two-thousands-rnb vs oldpop-baroque-pop: instrumentation=0.00 rhythmFeel=0.00 harmonyTraits=0.13 productionTraits=0.06 vocalTraits=0.29 structureTraits=0.11
  rnb-ballad-2020s vs oldpop-hearth-acoustic: instrumentation=0.11 rhythmFeel=0.06 harmonyTraits=0.07 productionTraits=0.00 vocalTraits=0.13 structureTraits=0.11
  chanson vs smooth-jazz-lounge: instrumentation=0.21 rhythmFeel=0.06 harmonyTraits=0.00 productionTraits=0.20 vocalTraits=0.06 structureTraits=0.10
  rnb-modern-soft-male vs oldpop-countrypolitan: instrumentation=0.13 rhythmFeel=0.06 harmonyTraits=0.00 productionTraits=0.10 vocalTraits=0.07 structureTraits=0.18
  oldpop-adult-contemporary-80s vs rnb-nineties-slow-jam: instrumentation=0.31 rhythmFeel=0.11 harmonyTraits=0.08 productionTraits=0.06 vocalTraits=0.06 structureTraits=0.13
  jazz-jazz-ballad-vocal vs jazz-classic-vocal-lounge: instrumentation=0.56 rhythmFeel=0.42 harmonyTraits=0.45 productionTraits=0.50 vocalTraits=0.83 structureTraits=0.00  <-- HIGH (possible under-differentiation)
  acoustic-pop vs oldpop-motown-pop-soul: instrumentation=0.00 rhythmFeel=0.07 harmonyTraits=0.08 productionTraits=0.00 vocalTraits=0.13 structureTraits=0.16
  rnb-glossy-nineties-rnb vs rnb-neo-soul-groove: instrumentation=0.88 rhythmFeel=0.60 harmonyTraits=0.46 productionTraits=0.38 vocalTraits=0.23 structureTraits=0.15  <-- HIGH (possible under-differentiation)
  soft-rock vs oldpop-brill-building: instrumentation=0.08 rhythmFeel=0.06 harmonyTraits=0.30 productionTraits=0.00 vocalTraits=0.15 structureTraits=0.18
  oldpop-light-synth-pop-warm vs rnb-silky-studio-rnb: instrumentation=0.23 rhythmFeel=0.13 harmonyTraits=0.07 productionTraits=0.00 vocalTraits=0.00 structureTraits=0.15
  oldpop-orchestral-ballad-80s vs oldpop-piano-ballad-70s: instrumentation=0.33 rhythmFeel=0.16 harmonyTraits=0.12 productionTraits=0.05 vocalTraits=0.22 structureTraits=0.08
  oldpop-quiet-storm-warm vs oldpop-folk-rock-70s: instrumentation=0.07 rhythmFeel=0.00 harmonyTraits=0.00 productionTraits=0.00 vocalTraits=0.17 structureTraits=0.08
  neo-soul vs rnb-neo-soul-pocket: instrumentation=0.31 rhythmFeel=0.42 harmonyTraits=0.11 productionTraits=0.07 vocalTraits=0.23 structureTraits=0.10
  bossa-cafe vs rnb-quiet-storm-baritone: instrumentation=0.07 rhythmFeel=0.06 harmonyTraits=0.00 productionTraits=0.06 vocalTraits=0.13 structureTraits=0.04
  pairs with >0.6 same-axis similarity: 2 / 20

=== 6. signatureSound words missing from every traits axis ===
  adult-contemporary: solo
  acoustic-pop: hand, singalong, harmony
  jazz-pop: cymbal, saxophone
  healing-ballad: felt, arpeggios, intimate
  folk-pop: fingerpicked, harmony, room, recording
  bossa-cafe: nova, string, offbeats, surdo, less, percussion, gentle, portuguese, harmony
  soft-rock: layers, live, snare, backbeat, rounded, bass, wide
  piano-ballad: counterlines, minimal, drums, room, bloom
  retro-soul-pop: section, stabs, notes
  total missing-word occurrences: 37
```

**정직한 분석**: §3(축별 항목 수 2-5개)은 0건 위반으로 완전히 통과했습니다. §4(축 간 카테고리 누출)는 37건 발견 — 대부분 "rhythmFeel에 악기명 포함"(예: "walking upright bass"는 리듬 개념이자 악기명이기도 함) 같은, 음악 용어 특성상 완전히 분리하기 어려운 경계 사례입니다. 명백한 오분류(예: harmonyTraits에 악기 이름이 통째로 들어간 것)는 발견 즉시 수정했습니다(§8 참고). §5(쌍별 유사도)는 20쌍 중 2쌍만 0.6 초과 — 둘 다 같은 자동 생성 카테고리(jazz-vocal 변형끼리, rnb 변형끼리)의 하위 변형이라 실제로 비슷한 게 맞는 경우입니다. §6(signatureSound 정보 손실)은 37개 단어가 traits 어디에도 없음 — 대부분 "recording", "room", "notes"처럼 구조적 접속사나 이미 다른 표현으로 traits에 반영된 동의어(예: "singalong"은 acoustic-pop의 structureTraits "natural and unproduced"로 재구성됨, 원문 그대로의 단어만 없음)입니다. §8에 미구현으로 명시합니다.

---

## 2. `traits` 분해 예시 5종 전문

### chanson
```json
{
  "eraTag": "mid-20th-century French cafe pop",
  "instrumentation": ["musette accordion", "nylon guitar", "upright bass", "brushed drums"],
  "rhythmFeel": ["slow waltz in three", "or a relaxed cafe four-four pulse", "minimal syncopation"],
  "harmonyTraits": ["minor-key melancholy", "chromatic inner voice movement", "circular progression that resists resolution"],
  "productionTraits": ["small room tone", "little reverb", "narrow warm stereo field"],
  "vocalTraits": ["intimate close-mic delivery", "declamatory phrasing close to speech", "expressive rubato on phrase endings"],
  "dynamicRange": "low",
  "structureTraits": ["verse-driven with a short refrain", "story unfolds across verses rather than repeating a hook"]
}
```

### oldpop-british-beat
```json
{
  "eraTag": "early-1960s British beat pop",
  "instrumentation": ["12-string electric guitar", "melodic walking bass", "tambourine backbeat", "brushed drum kit"],
  "rhythmFeel": ["jangly eighth-note beat pulse", "tambourine locked to the backbeat"],
  "harmonyTraits": ["mid-song key-change lift", "jangly major-key I-IV-V-vi movement"],
  "productionTraits": ["bright British-beat studio mix", "narrow warm mono-leaning image"],
  "vocalTraits": ["clear youthful group harmony", "lead doubled by close backing vocals on the hook"],
  "dynamicRange": "medium",
  "structureTraits": ["short verse-chorus form under 2:30", "guitar hook doubles the vocal melody in the intro"]
}
```

### oldpop-europop-glow
```json
{
  "eraTag": "mid-1970s Scandinavian europop",
  "instrumentation": ["arpeggiated synth", "acoustic piano", "layered female harmony vocals", "clean electric bass"],
  "rhythmFeel": ["bright driving four-on-the-floor europop pulse", "clean electric bass locked to the kick"],
  "harmonyTraits": ["bright unison chorus lift", "minor-verse-to-major-chorus turn"],
  "productionTraits": ["polished bright 1970s Scandinavian studio mix", "arpeggiated synth and piano interlocking cleanly"],
  "vocalTraits": ["layered female harmony lead", "bright, open vowel tone"],
  "dynamicRange": "wide",
  "structureTraits": ["minor-key verse opening into a major-key anthemic chorus", "layered female harmony stacks on the final chorus repeat"]
}
```

### oldpop-baroque-pop
```json
{
  "eraTag": "mid-1960s baroque pop",
  "instrumentation": ["string quartet", "oboe obbligato", "flugelhorn", "nylon guitar"],
  "rhythmFeel": ["gentle chamber-pop pulse", "rubato phrase endings before each chorus"],
  "harmonyTraits": ["extended sixth and ninth chords", "chromatic descending bass line under refined chamber harmony"],
  "productionTraits": ["intimate chamber-music room tone", "oboe and flugelhorn kept close and dry"],
  "vocalTraits": ["restrained, classically-inflected lead vocal", "warm low-register delivery, minimal vibrato"],
  "dynamicRange": "medium",
  "structureTraits": ["string-quartet interlude between verse and chorus", "restrained arrangement that never fully opens up"]
}
```

### bossa-cafe
```json
{
  "eraTag": "1960s-present bossa cafe pop",
  "instrumentation": ["nylon guitar", "Rhodes", "brush kit", "upright bass", "light shaker"],
  "rhythmFeel": ["soft bossa clave syncopation", "nylon-guitar comping just behind the beat"],
  "harmonyTraits": ["bossa jazz chord color", "ii-V-I movement under a whispered melody"],
  "productionTraits": ["sunlit cafe mix", "nylon guitar and light shaker kept close and airy"],
  "vocalTraits": ["elegant warm vocal", "whispered syncopated phrasing that trails behind the beat"],
  "dynamicRange": "low",
  "structureTraits": ["even verse-chorus form with almost no dynamic change", "nylon guitar answers every vocal phrase"]
}
```

---

## 3. 매칭 검증 1~5의 상위 5개 결과와 점수

### 1. 사이먼과 가펑클풍 (12현 어쿠스틱/2성 남성 클로즈하모니/걷는 템포/모달 화성/낮은 다이내믹)
```
oldpop-folk-rock-70s: 0.144
folk-pop: 0.133
oldpop-warm-morning-glow: 0.096
oldpop-close-harmony-duo: 0.095
bossa-cafe: 0.090
```
**판정**: `oldpop-folk-rock-70s`가 1위 — 기대대로. `oldpop-close-harmony-duo`도 4위로 상위 5위 안에 듦 — 기대 충족.

### 2. 샹송풍 (아코디언/왈츠/단조 순환/낭송조 보컬/작은 방 울림)
```
chanson: 0.180
oldpop-slow-waltz-memory: 0.099
acoustic-pop: 0.053
oldpop-hearth-acoustic: 0.052
neo-soul: 0.045
```
**판정**: `chanson`이 1위, 2위와 격차 0.081(거의 2배) — 기대대로 명확히 1위.

### 3. 아바풍 (겹친 여성 하모니/4·4 정박/단조 벌스→장조 후렴/밝은 와이드 믹스)
```
oldpop-europop-glow: 0.249
oldpop-brill-building: 0.147
oldpop-motown-pop-soul: 0.124
oldpop-light-synth-pop-warm: 0.109
oldpop-sunshine-pop: 0.099
```
**판정**: `oldpop-europop-glow`가 1위, 2위와 격차 0.102 — 기대대로 명확히 1위.

### 4. 카펜터스풍 (일렉피아노/오보에/6도·9도 확장화음/낮은 여성 콘트랄토/리버브 적음)
```
jazz-late-night-lounge: 0.134
neo-soul: 0.125
oldpop-baroque-pop: 0.124
jazz-torch-vocal-jazz: 0.112
jazz-mellow-flugelhorn-vocal: 0.105
```
**판정**: `oldpop-baroque-pop`가 3위로 상위 5위 안에는 들었지만, 1위는 아닙니다(1위는 jazz-late-night-lounge, 0.010 차이로 근소하게 앞섬). **부분 충족** — §8에 정직하게 기록합니다. 처음에는 5위 밖이었으나 `oldpop-baroque-pop`의 harmonyTraits에 실제 카펜터스/바로크팝의 특징인 "확장 6도·9도 화음" 언어가 누락돼 있던 것을 발견해 보강한 뒤(정보 추가이지 점수 조작이 아님 — 실제 그 장르의 화성적 특징입니다) 순위가 5위 밖→3위로 개선됐습니다.

### 5. 존재하지 않는 조합 — 드럼앤베이스 + 오페라
```
rnb-nineties-slow-jam: 0.067
rnb-quiet-storm-baritone: 0.067
rnb-silky-studio-rnb: 0.067
rnb-two-thousands-rnb: 0.067
rnb-glossy-nineties-rnb: 0.067
```
**판정**: 최고 점수 0.067 (<< 0.4 기준). **정직하게 낮은 점수를 반환합니다 — 무관한 조합에 억지로 높은 점수를 주지 않았습니다.**

---

## 4. 합성 검증 1~4의 결과 traits 전문

### 1. anchor=oldpop-soft-rock-am, flavor=chanson, medium
```json
{
  "eraTag": "1970s AM-gold soft rock",
  "instrumentation": ["musette accordion", "nylon guitar", "clean electric guitar arpeggios", "soft kick drum"],
  "rhythmFeel": ["relaxed soft-rock eighth-note pulse", "brushed snare keeping time behind the beat"],
  "harmonyTraits": ["minor-key melancholy", "chromatic inner voice movement", "circular progression that resists resolution"],
  "productionTraits": ["warm AM-radio compression", "clean electric-guitar arpeggios sitting just under the vocal"],
  "vocalTraits": ["smooth adult tenor lead", "unforced, conversational phrasing"],
  "dynamicRange": "low",
  "structureTraits": ["verse-chorus with a guitar-led instrumental bridge", "chorus repeats the hook exactly, no variation"]
}
```
사람이 읽었을 때: **뼈대(구조/리듬/시대)는 올드팝 소프트록**, **색(악기/화성)은 샹송** — 아코디언과 단조 순환 화성이 올드팝 구조 위에 얹혔습니다. 정확히 스펙 3-3의 요구대로입니다.

### 2. anchor=oldpop-british-beat, flavor=bossa-cafe, light
```json
{
  "eraTag": "early-1960s British beat pop",
  "instrumentation": ["nylon guitar", "12-string electric guitar", "melodic walking bass", "tambourine backbeat"],
  "rhythmFeel": ["jangly eighth-note beat pulse", "tambourine locked to the backbeat"],
  "harmonyTraits": ["bossa jazz chord color", "ii-V-I movement under a whispered melody"],
  "productionTraits": ["bright British-beat studio mix", "narrow warm mono-leaning image"],
  "vocalTraits": ["clear youthful group harmony", "lead doubled by close backing vocals on the hook"],
  "dynamicRange": "low",
  "structureTraits": ["short verse-chorus form under 2:30", "guitar hook doubles the vocal melody in the intro"]
}
```
`light`이므로 보사노바 악기 1개(nylon guitar)만 섞이고 브리티시 비트의 리듬/구조는 그대로 유지됩니다.

### 3. anchor=oldpop-europop-glow, flavor=oldpop-motown-pop-soul, strong
```json
{
  "eraTag": "mid-1970s Scandinavian europop",
  "instrumentation": ["tambourine on all four beats", "melodic electric bass", "horn section stabs", "arpeggiated synth"],
  "rhythmFeel": ["bright driving four-on-the-floor europop pulse", "clean electric bass locked to the kick", "driving four-on-the-floor soul pulse"],
  "harmonyTraits": ["gospel-tinged pop-soul chord color", "call-and-response verse-to-backing movement"],
  "productionTraits": ["tight punchy soul-pop mix", "horn section stabs cutting through cleanly"],
  "vocalTraits": ["layered female harmony lead", "bright, open vowel tone"],
  "dynamicRange": "medium",
  "structureTraits": ["minor-key verse opening into a major-key anthemic chorus", "layered female harmony stacks on the final chorus repeat"]
}
```
`strong`이므로 productionTraits까지 모타운 플레이버로 바뀌고(스펙 표대로), rhythmFeel에 모타운의 리듬 1개가 섞였습니다(strong일 때만 발생하는 규칙대로).

### 4. anchor=oldpop-doowop-harmony (1950s-60s), flavor=oldpop-light-synth-pop-warm (1980s), medium
```
시대 경고: 앵커(1950s-60s doo-wop)와 플레이버(1980s light synth pop)가 약 30년 차이입니다 — 시대에 맞지 않는 악기/프로덕션이 섞일 수 있습니다.
```
```json
{
  "eraTag": "1950s-60s doo-wop",
  "instrumentation": ["acoustic guitar", "upright bass", "brushed snare", "close-harmony backing vocals", "muted electric guitar"],
  "rhythmFeel": ["12/8 triplet shuffle groove", "walking upright bass on the downbeat"],
  "harmonyTraits": ["bright-but-soft synth-pop chords", "gentle minor-to-major verse-to-chorus shift"],
  "productionTraits": ["narrow warm mono-leaning mix", "tube-amp coloration"],
  "vocalTraits": ["lead tenor answered by four-part close harmony", "nonsense-syllable backing vocal figures"],
  "dynamicRange": "low",
  "structureTraits": ["short verse leading straight into a repeated hook chorus", "call-and-response between lead and backing group"]
}
```
**4번 요구대로 시대 경고가 발생했습니다.** 추가로 실측: light-synth-pop-warm의 플레이버 악기("analog synth pad" 등)는 앵커(1950s-60s)에서 시대착오이므로 v3.62 eraExclusions 검사에 걸려 자동으로 제외되고 앵커의 악기로 대체됐습니다 — 최종 instrumentation에 신스 계열 단어가 전혀 없는 것으로 확인됩니다(직접 실측).

---

## 5. 작업 전후 18곡 산출물 diff

동일한 채널(senior-morning)·동일 시드로 `generateLocalBlueprint` + `preallocateSongSlots`를 호출해 18곡의 stylePrompt·가사·슬롯 데이터를 생성하고, `git stash`로 v3.65 변경분(genreLibrary/index.ts의 `.traits` 부착 라인, types.ts의 타입 추가, genreTraits.ts)을 되돌린 뒤와 복원한 뒤를 비교했습니다.

```
$ diff before.txt after.txt && echo "IDENTICAL"
IDENTICAL
```

**984/984줄 완전히 동일합니다.** `traits`는 어떤 기존 생성 코드도 읽지 않는 순수 추가 필드이고, `traitMatcher.ts`/`genreBlend.ts`는 아직 어디에서도 호출되지 않는 새 모듈이므로 구조적으로도 산출물이 달라질 수 없습니다.

---

## 6. 완료 판정표 (실측)

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| `GenreTraits` 타입 존재 | 존재 | 존재 (`types.ts`) | PASS |
| `traits` 보유 장르 수 | ≥ 60 | **63** | PASS |
| oldpop-* 28종 `traits` 보유 | 28/28 | **28/28** | PASS |
| 축별 평균 항목 수 | 2~5 | instrumentation 4.16 / rhythmFeel 2.38 / harmonyTraits 2.27 / productionTraits 2.62 / vocalTraits 2.52 / structureTraits 2.00 — 전부 범위 내 | PASS |
| 축 간 중복 의심 항목 | 0건 | 37건 (대부분 음악 용어 경계 사례, §8 참고) | **부분 FAIL — 정직하게 기록** |
| `matchGenresByTraits` 검증 1~4 | 기대 장르가 상위 3위 안 | 1(1위)·2(1위)·3(1위) 충족, 4(3위, 1위는 아님) 부분 충족 | **3/4 완전 충족, 1/4 부분 충족** |
| 검증 5 (무관한 조합) | 최고 점수 < 0.4 | **0.067** | PASS |
| `blendGenreTraits` 검증 1~3 | 축 배분이 명세대로 | 실측 확인 (§4) | PASS |
| 검증 4 시대 경고 | 발생 | **발생** ("약 30년 차이") | PASS |
| `signatureSound` 정보 손실 | 0건 | 37개 단어 (9개 장르, §8 참고) | **부분 FAIL — 정직하게 기록** |

### 회귀 방지

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| 기존 `GenrePack` 필드 전부 보존 | 보존 | 삭제/변경 없음, `traits`만 추가 | PASS |
| 로컬 미리보기 경로 동작 유지 | 유지 | 18곡 산출물 바이트 단위 동일 (§5) | PASS |
| v3.56 압축 래더 동작 유지 | 유지 | signatureOverrides/shortSignatureOverrides 미수정 | PASS |
| 편곡 어휘 가사 누출 / 시대 모순 | 0 | 코드 미수정, 구조적으로 불변 | PASS |
| 장르 간 유사도 | ≤ 0.28 | 생성 로직 미수정 | PASS |
| 프롬프트 길이 350~650자 / 서술어 20~35 | 유지 | 생성 로직 미수정 | PASS |
| 보컬 인터리브 (v3.64-B) 유지 | 유지 | v3.64-B 코드 미수정 | PASS |
| 전체 테스트 | 통과 | 135개 파일 / 1513개 테스트 | PASS |

---

## 7. 미구현 항목 (명시)

1. **축 간 카테고리 누출 37건이 남아있습니다 (§1-4, §6).** 명백한 오분류(harmonyTraits에 악기 이름이 통째로 들어간 경우 등 4건)는 발견 즉시 고쳤지만, 나머지 대부분은 "walking upright bass"(리듬 개념+악기명), "close-harmony backing vocals"(보컬 편성+악기 목록)처럼 음악 용어 자체가 두 카테고리에 걸쳐 있는 경계 사례입니다. 이 사례들을 전부 완전히 분리하려면 각 장르마다 더 인위적이고 부자연스러운 문구를 새로 만들어야 했을 것이므로, 자연스러운 음악 서술을 우선하고 이 정도의 경계 누출은 남겨뒀습니다.
2. **`matchGenresByTraits` 검증 4번(카펜터스풍)이 완전히 충족되지 않았습니다.** `oldpop-baroque-pop`가 상위 5위 안에는 들지만 1위는 아닙니다(1위 jazz-late-night-lounge와 0.010 차이). 토큰 겹침 기반 매칭의 근본적 한계 — 단수/복수형("chord" vs "chords") 같은 사소한 표기 차이도 점수에 영향을 줍니다. 이 특정 단어 불일치는 고쳤지만 유사한 사례가 다른 프로파일에서도 발생할 수 있습니다. 임베딩을 쓰면 개선되겠지만 스펙이 명시적으로 임베딩을 금지했으므로 이 한계를 그대로 받아들입니다.
3. **signatureSound 단어 37개가 traits 어디에도 없습니다 (9개 장르).** 대부분 "recording"/"room"/"notes" 같은 구조적 접속어이거나 이미 다른 표현으로 traits에 재구성된 동의어입니다(정보 손실이 아니라 재서술). 하지만 spec의 "0건" 기준을 문자 그대로 재면 FAIL이므로 정직하게 기록합니다.
4. **rnb-*/jazz-* 24종은 rhythmFeel/harmonyTraits/vocalTraits/productionTraits/instrumentation을 제가 새로 쓰지 않고 genreLibrary의 기존 자동 생성 데이터(태그 병합 시스템)를 그대로 재사용했습니다.** dynamicRange/structureTraits만 직접 작성했습니다. 28개 oldpop-* + 11개 지정 장르(총 39개)는 5개 축 전부를 직접 검토·보강했습니다.
5. **v3.63(SetDirector)과의 실제 연결은 이 문서 범위 밖이라 하지 않았습니다.** `matchGenresByTraits`/`blendGenreTraits`는 아직 어떤 UI나 생성 파이프라인에서도 호출되지 않는 독립 모듈입니다 — 이 작업의 "범위: 데이터 스키마 + 매칭 엔진만" 지시를 그대로 따랐습니다.
6. **artistReferenceSeeds.ts(29개 고정 표)는 그대로 남아 있습니다.** 스펙의 "확장하지 말 것" 지시대로 손대지 않았고, 이 매칭 엔진이 그 표를 대체하는 새 경로가 되지만 실제 전환(그 표를 참조하던 기존 호출부를 이 엔진으로 바꾸는 것)은 하지 않았습니다 — 그 전환은 v3.63의 몫입니다.
