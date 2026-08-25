# 지시문 35 — 랩 계열 채널 신설 (멈블 랩) 보고

브랜치: `feat/instruction-35` (기준: `feat/notion-genre-library`, 지시문 34 머지 완료 상태에서 분기)

---

## 순서별 완료 판정

```
TASK B  보컬 어휘 확장       구현 완료 · 수치 이동함   0축 → 4축
TASK A  신규 장르 8종        구현 완료 · 수치 이동함   0종 → 8종 (25필드 전부)
TASK D  안전 정책           구현 완료 · 수치 이동함   0종 → blocking 4종 · advisory 2종, 2개 실행 경로에 배선
TASK C  채널 신설           구현 완료 · 수치 이동함   채널 없음 → 존재, preferredGenres 12종, CONTRACT VIOLATION 0건 유지
  ㄴ lyricTheme 후보 110종   구현 완료 · 수치 이동 없음(원인 분석 필수) — 아래 E-2 항목 6 참고
  ㄴ 하프타임 BPM 실측       실측 완료 · 정책 변경 보류(의도적, §하지 말 것) — 아래 E-2 항목 6 참고
```

---

## E-1. 수치표

| 항목 | 기준 | 현재값 |
|---|---|---|
| 신규 랩 장르 | 8종 이상 | **8종** |
| 25필드 전부 채움 | 8/8 | **8/8** |
| eraBuckets 필수 | 8/8 | **8/8** (전부 `['2010s','2020s']`) |
| eraNoteKo 근거 기재 | 8/8 | **8/8** |
| genreTraits 등록 | 8종 | **8종** |
| genreFamilies 등록 | 8종 | **8종** (+ 기존 4종 포함 12종 family) |
| PaletteFamily 미등록 | 0종 | **0종** (EraCanonPalette 자체를 등록하지 않음 — 아래 근거) |
| 멈블 어휘 보유 (mumble/dragged/swallowed/sing-rap/triplet flow) | 전부 | **전부 보유** |
| 랩 딜리버리 어휘 축 | 4축 | **4축** (flow/articulation/tone/layering) |
| promptAxisLexicon leadVocal 확장 | 완료 | **완료** (17개 마커 추가) |
| 새 축 신설 | 0개 | **0개** |
| kr-2030-rap 채널 | 존재 | **존재** |
| preferredGenres | 12종 이상 | **12종** |
| 새 아키타입 추가 | 0개 | **0개** (`kr-2030-pop` 재사용) |
| check:coverage CONTRACT VIOLATION | 0건 | **0건** (변경 전과 동일) |
| 랩 안전 정책 blocking 항목 | 4종 이상 | **4종** (violence-weapons-drugs-crime · profanity-slurs · group-bias · real-person-brand) |
| 하프타임 BPM perceivedEnergy | 실측 보고 | **실측 완료 — 하프타임 인식 안 함 (아래 상세)** |
| verified: false 가 blocking | 0건 | **0건** |
| lyricTheme 후보 | 110종 목표 | **46종 (상속, 신규 미추가)** — 근거는 E-2 항목 6 |
| 첫 세트 전곡 사람 확인 | 완료 | **미실시** (이 지시문 범위 밖 — 하루가 직접) |

---

## E-2. 원문 보고

### 1. 신규 랩 장르 8종의 레코드 전문 (25필드) — 인수 기준

**아이디 네이밍 관련 결정 사항**: 지시문 원문은 각 장르 id를 `rap-*`(예: `rap-mumble-melodic`)로 예시했다. 실측 확인(2건):

- `src/data/genreWorkspaceOwnership.ts`의 `genreWorkspacesOf`는 genre id의 접두사(`kr2030-`/`jp2030-`/`krkids-`/`jpkids-`/`kridol-`)로 워크스페이스 소유를 자동 추론한다. `rap-*`는 이 추론에 안 걸려 기본값(`senior-oldpop`)으로 떨어지고, `tests/workspaceDataIsolation.test.ts`의 checkL1이 "외부 장르 8건 노출"로 FAIL했다(실측 확인).
- `tests/workspaceQualityPolicy.test.ts`는 "kr-2030 owns only kr2030- prefixed ids"를 명시적으로 단언한다(실측 확인, FAIL).

둘 다 이 저장소의 실제 실행 중인 회귀 테스트다. `EXPLICIT_MULTI_WORKSPACE_GENRE_IDS`에 8개를 우회 등록하는 방법도 가능했지만, 이미 존재하는 명명 규칙(`kr2030-band-emotional`류)을 따르는 쪽이 더 안전하고 낡은 경로를 남기지 않는다고 판단해 8개 id를 전부 `kr2030-rap-*`로 지었다. 기능·필드·내용은 지시문 원문과 동일하다.

전문 (`src/data/genreLibrary/index.ts`, `jazz-rap` 다음, `city-pop-modern` 이전):

```ts
  // 지시문 35 (TASK A) — 신규 랩·멈블랩 8종. 실측: 멈블 랩 핵심 어휘
  // (mumble/dragged/swallowed/sing-rap/triplet flow) 보유 0종이었다(§1-2).
  // 전부 archetypes: ['kr-2030-pop'] — kr-2030-rap 채널이 이 archetype을
  // 재사용하므로(새 archetype 미신설) 이 값 하나로 배정 가능해진다. vocal
  // 필드는 data/rapVocalDelivery.ts(TASK B)의 축 어휘를 그대로 가져다 쓴다
  // — 한 곳에서 관리되는 랩 딜리버리 어휘가 실제 실행 경로(장르 정의)에서
  // 소비되도록 한다.
  legacyGenrePack({
    id: 'kr2030-rap-mumble-melodic',
    label: 'Mumble Melodic Trap',
    styleCore: 'mumble melodic trap rap, dragged vowels and swallowed consonants riding a half-time trap groove, half-sung half-spoken delivery sitting behind the beat',
    instruments: ['deep 808 sub bass', 'airy pluck synth', 'ambient pad', 'trap hi-hat rolls', 'sparse kick pattern'],
    // 트랩은 하프타임 체감이라 BPM 표기가 높다(지시문 35 §A-2 ①) — 실제
    // 체감/생성 BPM 클램프 문제는 TASK C-5에서 별도 실측·보고.
    tempoRange: [130, 150],
    goodFor: ['2030 멈블 랩 플레이리스트', 'late-night trap', 'mumble rap'],
    vocalPreference: { male: 0.75, female: 0.1, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s mumble melodic trap'
  }, 'hiphop', {
    rhythm: ['half-time trap feel', 'sparse kick pattern under rolling hi-hat triplets'],
    vocal: [RAP_VOCAL_DELIVERY_AXES.articulation[3], RAP_VOCAL_DELIVERY_AXES.articulation[4], 'half-sung half-spoken delivery, behind-the-beat flow'],
    production: ['deep 808 sub bass anchor', 'airy pluck synth wash', 'ambient pad bed'],
    harmony: ['minor-key trap pad harmony', 'sparse dark chord stabs'],
    moods: ['hazy', 'intimate', 'nocturnal'],
    audiences: ['멈블 랩 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['aggressive battle-rap delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-whisper-trap',
    label: 'Whisper Trap',
    styleCore: 'whisper trap, close-mic breathy delivery over a dry sparse trap beat, low intimate tone that barely projects above a murmur',
    instruments: ['deep 808 sub bass', 'muted trap hi-hats', 'dry snare', 'wide ambient pad'],
    tempoRange: [128, 145],
    goodFor: ['속삭이는 랩 플레이리스트', 'whisper trap', 'late-night intimate rap'],
    vocalPreference: { male: 0.7, female: 0.15, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s whisper trap'
  }, 'hiphop', {
    rhythm: ['dry sparse trap pocket', 'muted hi-hat roll under a thin kick'],
    vocal: [RAP_VOCAL_DELIVERY_AXES.tone[2], 'low intimate tone, almost spoken', 'minimal vocal projection'],
    production: ['very close-mic vocal capture', 'dry vocal against a wide ambient bed'],
    harmony: ['suspended minor pad harmony', 'sparse dark chord color'],
    moods: ['intimate', 'hushed', 'nocturnal'],
    audiences: ['속삭이는 랩 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['loud belted delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-emo-sing-rap',
    label: 'Emo Sing-Rap',
    styleCore: 'emo sing-rap, autotuned melodic hooks over a nostalgic guitar melody and clean trap drums, emotional half-sung delivery',
    instruments: ['nostalgic guitar melody', 'clean trap drums', 'deep 808 sub bass', 'airy pluck synth pad'],
    tempoRange: [135, 155],
    goodFor: ['이모 싱랩 플레이리스트', 'emo trap', 'melodic trap hooks'],
    vocalPreference: { male: 0.65, female: 0.15, mixed: 0.2 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s emo sing-rap'
  }, 'hiphop', {
    rhythm: ['half-time emo-trap groove', 'clean trap drum pattern with rolling hi-hats'],
    vocal: [RAP_VOCAL_DELIVERY_AXES.tone[3], 'emotional half-sung half-rapped hook delivery'],
    production: ['nostalgic clean guitar layer', 'deep 808 low end', 'airy synth pad wash'],
    harmony: ['minor-key nostalgic guitar progression', 'emo trap chord color'],
    moods: ['emotional', 'nostalgic', 'melancholic'],
    audiences: ['이모 싱랩 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['aggressive battle-rap delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-laidback-alt-rnb',
    label: 'Laid-Back Alt-R&B Hip-Hop',
    styleCore: 'laid-back alt-R&B hip-hop, sticky lazy vocal phrasing, dragged vowels over an intimate chesty male voice, half-sung half-spoken delivery sitting behind the beat',
    instruments: ['warm sub bass', 'dusty laid-back drums', 'muted electric guitar chords', 'soft synth pad'],
    tempoRange: [72, 92],
    goodFor: ['흑인 감성힙합 플레이리스트', 'laid-back R&B rap', 'late-night alt-R&B'],
    vocalPreference: { male: 0.75, female: 0.1, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s laid-back alt-R&B hip-hop'
  }, 'hiphop', {
    rhythm: ['laid-back pocket', RAP_VOCAL_DELIVERY_AXES.flow[4]],
    vocal: ['sticky lazy vocal phrasing', 'intimate chesty male voice', RAP_VOCAL_DELIVERY_AXES.articulation[3]],
    production: ['warm intimate close-mic mix', 'dusty laid-back drum texture'],
    harmony: ['warm minor seventh alt-R&B harmony', 'suspended chord color'],
    moods: ['laid-back', 'intimate', 'warm'],
    audiences: ['흑인 감성힙합 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['aggressive battle-rap delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-drill-dark',
    label: 'Dark Drill',
    styleCore: 'dark drill, sliding 808 bass under a drill hi-hat pattern, tense minor-key atmosphere',
    instruments: ['sliding 808 bass', 'drill hi-hat pattern', 'dark synth stab', 'sparse minor-key pad'],
    tempoRange: [138, 148],
    goodFor: ['다크 드릴 플레이리스트', 'drill', 'tense night drive'],
    vocalPreference: { male: 0.8, female: 0.05, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s dark drill'
  }, 'hiphop', {
    rhythm: ['sliding 808 drill pattern', 'syncopated drill hi-hat pattern'],
    vocal: ['confident low-register rap delivery', RAP_VOCAL_DELIVERY_AXES.flow[4]],
    production: ['dark tense synth mix', 'sliding 808 low end'],
    harmony: ['minor-key tension riff', 'sparse dark chord stabs'],
    moods: ['tense', 'dark', 'nocturnal'],
    // TASK D(가사 안전 정책) 선반영 — drill은 소재 위험이 가장 큰
    // 서브장르라 avoidTraits에 명시적으로 못박는다(가사 안전 정책과
    // 별개로 장르 프롬프트 층위에서도 한 번 더 막는다, 이중 방어).
    audiences: ['다크 드릴 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['violent or weapon imagery', 'crime narrative content', 'explicit drug references', 'profanity or slurs', 'real gang or group references']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-boom-bap-modern',
    label: 'Modern Boom-Bap',
    styleCore: 'modern boom-bap revival, clear articulate rap flow with a punchy delivery over crisp contemporary boom-bap drums',
    instruments: ['crisp boom-bap drums', 'punchy sub bass', 'modern sample chop', 'clean vinyl-textured keys'],
    tempoRange: [85, 95],
    goodFor: ['모던 붐뱁 플레이리스트', 'boom-bap revival', 'lyrical rap'],
    vocalPreference: { male: 0.75, female: 0.1, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s modern boom-bap revival'
  }, 'hiphop', {
    rhythm: ['punchy modern boom-bap backbeat', 'crisp head-nod pocket'],
    vocal: ['clear articulate rap flow', 'punchy confident delivery'],
    production: ['clean modern boom-bap mix', 'punchy low end'],
    harmony: ['minor sample-chop harmony', 'warm dominant chord touch'],
    moods: ['confident', 'lyrical', 'street'],
    audiences: ['모던 붐뱁 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['aggressive battle-rap delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-cloud-hazy',
    label: 'Cloud Rap',
    styleCore: 'cloud rap, washed reverb and pitched vocal chops floating over a hazy ambient trap texture',
    instruments: ['washed reverb pad', 'pitched vocal chop sample', 'deep 808 sub bass', 'hazy ambient synth texture'],
    tempoRange: [120, 140],
    goodFor: ['클라우드 랩 플레이리스트', 'cloud rap', 'dreamy trap'],
    vocalPreference: { male: 0.65, female: 0.2, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s cloud rap'
  }, 'hiphop', {
    rhythm: ['hazy half-time trap pulse', 'sparse trap hi-hat roll'],
    vocal: [RAP_VOCAL_DELIVERY_AXES.tone[3], 'dreamy pitched vocal chop texture'],
    production: ['washed reverb texture', 'pitched vocal chop layering', 'hazy ambient synth wash'],
    harmony: ['suspended dreamy pad harmony', 'minor-key floating chord color'],
    moods: ['dreamy', 'hazy', 'floating'],
    audiences: ['클라우드 랩 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['aggressive battle-rap delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
  legacyGenrePack({
    id: 'kr2030-rap-female-melodic',
    label: 'Female Melodic Rap',
    // 하루가 지시한 "여성 랩 균형" 요구(지시문 35 §A-2 ⑧) — 위 7종이 남성
    // 기조라 vocalPreference로 여성 쪽을 명시적으로 끌어올린다.
    styleCore: 'female melodic rap, confident sing-rap hooks with autotuned melodic tone over a half-time trap groove',
    instruments: ['deep 808 sub bass', 'airy pluck synth', 'ambient pad', 'trap hi-hat rolls'],
    tempoRange: [125, 145],
    goodFor: ['여성 멜로딕 랩 플레이리스트', 'female rap', 'melodic trap hooks'],
    vocalPreference: { male: 0.05, female: 0.8, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s female melodic trap'
  }, 'hiphop', {
    rhythm: ['half-time trap feel', 'rolling hi-hat triplets'],
    vocal: ['confident female sing-rap hooks', RAP_VOCAL_DELIVERY_AXES.tone[3]],
    production: ['deep 808 sub bass anchor', 'airy pluck synth wash'],
    harmony: ['minor-key trap pad harmony', 'melodic hook chord lift'],
    moods: ['confident', 'bright', 'nocturnal'],
    audiences: ['여성 멜로딕 랩 리스너', '2030 힙합 플레이리스트'],
    avoidTraits: ['aggressive battle-rap delivery', 'violent or weapon imagery', 'explicit drug references', 'profanity or slurs']
  }),
```

`eraBuckets.ts`에 추가된 매핑(`ERA_BUCKETS_BY_GENRE_ID` · `ERA_NOTE_KO_BY_GENRE_ID`, 8종 전부 `['2010s','2020s']` + 근거 문장) — `genreTraits.ts`의 `GENRE_TRAIT_OVERRIDES` 8종(`dynamicRange` + `structureTraits`)도 실제 소스에 그대로 남아 있다(파일이 길어 이 보고서에는 발췌하지 않고 파일 경로만 명시: `src/data/eraBuckets.ts`, `src/data/genreTraits.ts`).

### 2. genreFamilies 등록 결과 — family-rap 신설 여부와 근거

**"family-rap"이라는 원문 예시 id를 그대로 쓰지 않았다.** 실측: `data/paletteFamilies.ts`의 `PaletteFamily.id`는 전부 `family-`로 시작하고(`family-acoustic-soft`, `family-showa-kayokyoku` 등), `data/genreFamilies.ts`의 `GenreFamily.id`는 이 파일 전체에서 단 하나도 `family-`로 시작하지 않는다(`chanson-continental`, `kr2030-band-emotional` 등). `family-rap`을 그대로 쓰면 서로 다른 두 레지스트리의 id 네임스페이스가 겹친다 — 이 워크스페이스의 기존 명명 규칙을 따라 `kr2030-rap-mumble`로 정했다. 기능은 동일(UI 노출용 advisory 그룹핑, `blendsWellWith`는 절대 차단하지 않음).

```ts
  {
    id: 'kr2030-rap-mumble',
    labelKo: '랩·멈블랩',
    descriptionKo: '멈블 랩·트랩·붐뱁 계열의 한국 2030 랩 팝',
    memberGenreIds: [
      'kr2030-rap-mumble-melodic', 'kr2030-rap-whisper-trap', 'kr2030-rap-emo-sing-rap', 'kr2030-rap-laidback-alt-rnb',
      'kr2030-rap-drill-dark', 'kr2030-rap-boom-bap-modern', 'kr2030-rap-cloud-hazy', 'kr2030-rap-female-melodic',
      'chill-rap', 'boom-bap-mellow', 'jazz-rap', 'trap-soul'
    ],
    commonTraitKo: '트랩 808·하프타임 그루브·랩 딜리버리 중심',
    blendsWellWith: ['kr2030-night-groove']
  }
```

**EraCanonPalette를 의도적으로 등록하지 않았다.** 지시문 21이 남긴 실측 결함(showa-seventies가 `EraCanonPalette`는 있는데 `PaletteFamily`에 등록을 빠뜨려 `paletteFamilyForGenreId`가 `undefined`를 반환, 세트가 단일 장르로 무너짐)의 재현을 피하는 가장 확실한 방법은 애초에 `EraCanonPalette` 자체를 만들지 않는 것이다 — 기존 hiphop 카테고리 5종(`chill-rap`/`boom-bap-mellow`/`jazz-rap`/`trap-soul`/`lofi-hiphop-study`)도 전부 `EraCanonPalette`가 없는 상태로 정상 동작 중이며(실측 확인, 코드베이스에 이미 선례가 있는 정당한 상태), 이 8종도 같은 패턴을 따른다. 그 결과 `PaletteFamily 미등록`은 애초에 발생할 수 없는 항목이 됐다(0종).

### 3. 랩 딜리버리 어휘 전문

`src/data/rapVocalDelivery.ts` (신규 파일):

```ts
export interface RapVocalDeliveryAxes {
  flow: string[];
  articulation: string[];
  tone: string[];
  layering: string[];
}

export const RAP_VOCAL_DELIVERY_AXES: RapVocalDeliveryAxes = {
  flow: [
    'triplet flow',
    'double-time flow',
    'laid-back flow',
    'on-beat flow',
    'behind-the-beat flow',
    'staccato flow',
    'legato rap flow'
  ],
  articulation: [
    'crisp articulate delivery',
    'mumbled delivery',
    'slurred delivery',
    'dragged vowels',
    'swallowed consonants'
  ],
  tone: [
    'chesty intimate tone',
    'nasal bright tone',
    'whisper-close tone',
    'autotuned melodic tone',
    'raspy rap tone'
  ],
  layering: [
    'ad-lib stack',
    'doubled hook',
    'call-response ad-lib'
  ]
};
```

`promptAxisLexicon.ts`의 `LEAD_VOCAL_PHRASES` 확장(실제 diff):

```diff
-const LEAD_VOCAL_PHRASES = ['lead', 'duet'];
+const LEAD_VOCAL_PHRASES = [
+  'lead', 'duet',
+  'triplet flow', 'double-time flow', 'laid-back flow', 'on-beat flow', 'behind-the-beat flow', 'staccato flow', 'legato rap flow',
+  'mumbled delivery', 'slurred delivery', 'dragged vowels', 'swallowed consonants', 'crisp articulate delivery',
+  'chesty intimate tone', 'nasal bright tone', 'whisper-close tone', 'autotuned melodic tone', 'raspy rap tone'
+];
```

`layering` 축(ad-lib stack 등)은 leadVocal에 넣지 않았다 — ad-lib류는 backing 성격이 강해 `BACKING_VOCAL_MARKERS`와 충돌 위험이 있고, 지시문 자체가 "새 축을 만들지 않는다 — leadVocal 축의 어휘를 넓힌다"만 요구했다.

새 축은 신설하지 않았다(0개) — `PromptAxis` union(`era`/`genre`/`tempo`/`leadVocal`/`backingVocal`/...)에 변경 없음.

### 4. kr-2030-rap 채널 정의 (audience · market · 전 정책)

`src/data/presets.ts`, `rainy-seoul-nightscape` 다음에 삽입:

```ts
  {
    id: 'kr-2030-rap',
    name: '밤을 걷는 멈블 랩',
    englishName: 'Walking the Night in Mumble Rap',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'twenties',
    promise: '멈블 랩·트랩·붐뱁 중심으로 도시의 밤과 일상 감정을 그리는 2030 랩 플레이리스트',
    visualIdentity: 'moody city night alley, neon haze, minimal streetwear-adjacent typography, no visible faces',
    defaultVocal: 'mumbled dragged-vowel rap delivery, half-sung half-spoken hook, close-mic intimate trap tone',
    preferredGenres: [
      'kr2030-rap-mumble-melodic', 'kr2030-rap-whisper-trap', 'kr2030-rap-emo-sing-rap', 'kr2030-rap-laidback-alt-rnb',
      'kr2030-rap-drill-dark', 'kr2030-rap-boom-bap-modern', 'kr2030-rap-cloud-hazy', 'kr2030-rap-female-melodic',
      'chill-rap', 'boom-bap-mellow', 'jazz-rap', 'trap-soul'
    ],
    preferredMoods: ['confident', 'bittersweet', 'intimate'],
    forbiddenCliches: [
      'too old-fashioned trot mood', 'childish lyrics', 'famous artist imitation', 'soundalike vocal',
      'overly nostalgic senior-radio imagery', 'violent or weapon imagery', 'crime narrative content',
      'explicit drug references', 'profanity or slurs', 'real brand or celebrity name-drop'
    ],
    seoKeywords: ['멈블 랩 플레이리스트', '트랩힙합 플레이리스트', '2030 랩 플레이리스트', '한국 힙합 플레이리스트', '밤 드라이브 랩', '감성 힙합'],
    archetype: 'kr-2030-pop'
  },
```

**11개 정책 전부 archetype(`kr-2030-pop`) 재사용을 통해 자동 상속받는다** — 개별 재정의 없이 이미 존재하는 값을 그대로 쓴다(실측, `npm run check:coverage`로 확인):

| 정책 | kr-2030-pop 상속값 | 실측 확인 방법 |
|---|---|---|
| moneyChordRotationPool | `['default','emotional','cityPop','popStandard','canon']` (5종, 요구 4종 이상 이미 충족) | `check:coverage` `kr2030=5` |
| signatureMoneyChordId | `default` | `check:coverage` |
| arcModelId | `five-phase` (audienceProfile 경유) | `check:coverage` |
| audienceProfile | `kr-2030-emotional` | `check:coverage` |
| DistinctChoicePolicy (지시문15) | `advisory`(verified:false, 하지 말 것 — 임의 verified 승격 안 함) | `check:coverage` |
| ListeningIntentPolicy (지시문23) | 워크스페이스 단위, 이 축 자체는 아키타입 단위 설계 아님(N/A) | `check:coverage` |
| PromptAxisPolicy (지시문16) | `advisory` | `check:coverage` |
| ObjectState 적용 kind (지시문17) | `message,vehicle` (실측 0, 추정치) | `check:coverage` |
| killingPointSetId → 실제 풀 | `KR_2030_KILLING_POINTS` (`killingPointSetForNonKidsArchetype`가 archetype으로 스위치) | `src/data/killingPointWorkspaceSets.ts` 직접 확인 |
| introTexture 전용 풀 | 6개(전체 30개로 폴백, 기존 3개 채널과 동일 상태 — 신규 채널로 악화되지 않음) | `check:coverage` |
| lyricTheme 후보 | 46개(12개 폴백 임계선 훨씬 위, 기존 3개 채널과 공유) | `check:coverage` — 아래 항목 6에서 "110종" 불일치 상세 |

이 표의 모든 값은 **채널을 신설하기 전부터 `kr-2030-pop` archetype에 이미 존재했다** — TASK C-1이 명시한 "새 아키타입을 만들지 않는다"의 실제 대가(payoff)다.

### 5. `npm run check:coverage` 전체 출력 (신설 후)

```
[check:coverage] 13 아키타입 × 21 축


■ preferredGenres (채널 합집합)
  srMorn=29 | showaC=3 | showa7=4 | j2000s=3 | chill=16 | cityNt=11 | oldpop=24 | kr2030=30 | jp2030=6 | idolM=7 | idolF=7 | lofi=14 | kids=3

■ lyricTheme 후보 (실효/원본)
  srMorn=70 | showaC=46 | showa7=36 | j2000s=36 | chill=370(원본0)⚠ | cityNt=370(원본0)⚠ | oldpop=18 | kr2030=46 | jp2030=46 | idolM=46 | idolF=46 | lofi=370(원본0)⚠ | kids=42

■ moneyChordRotationPool
  srMorn=5 | showaC=5 | showa7=5 | j2000s=5 | chill=5 | cityNt=5 | oldpop=6 | kr2030=5 | jp2030=5 | idolM=5 | idolF=5 | lofi=4 | kids=4

■ signatureMoneyChordId
  srMorn=doowop | showaC=royalRoad | showa7=showaModern | j2000s=komuro | chill=jazzColor | cityNt=cityPop | oldpop=doowop | kr2030=default | jp2030=cityPop | idolM=emotional | idolF=emotional | lofi=jazzColor | kids=kidsSimple

■ introTexture 풀 (전용/전체폴백)
  srMorn=14(전체14) | showaC=17(전체17) | showa7=17(전체17) | j2000s=11(전체11) | chill=9(전체30)⚠ | cityNt=10(전체10) | oldpop=13(전체13) | kr2030=6(전체30)⚠ | jp2030=6(전체30)⚠ | idolM=6(전체30)⚠ | idolF=6(전체30)⚠ | lofi=3(전체30)⚠ | kids=10(전체10)

■ openingHooks (팔레트 계열 매칭)
  srMorn=7 | showaC=7 | showa7=5 | j2000s=— | chill=— | cityNt=— | oldpop=7 | kr2030=— | jp2030=— | idolM=— | idolF=— | lofi=— | kids=—

■ vocalPreset 풀
  srMorn=— | showaC=— | showa7=— | j2000s=— | chill=— | cityNt=— | oldpop=— | kr2030=— | jp2030=— | idolM=— | idolF=— | lofi=— | kids=—

■ killingPoint 풀
  srMorn=공통세트 | showaC=공통세트 | showa7=공통세트 | j2000s=공통세트 | chill=공통세트 | cityNt=공통세트 | oldpop=공통세트 | kr2030=공통세트 | jp2030=공통세트 | idolM=공통세트 | idolF=공통세트 | lofi=공통세트 | kids=kids세트

■ PaletteFamily 등록 (등록/전체 장르)
  srMorn=29/29 | showaC=3/3 | showa7=4/4 | j2000s=— | chill=— | cityNt=— | oldpop=24/24 | kr2030=— | jp2030=— | idolM=— | idolF=— | lofi=— | kids=—

■ motifFamily 등록 (적용/전체 8종)
  srMorn=6/8 | showaC=6/8 | showa7=6/8 | j2000s=6/8 | chill=6/8 | cityNt=6/8 | oldpop=6/8 | kr2030=6/8 | jp2030=6/8 | idolM=7/8 | idolF=7/8 | lofi=6/8 | kids=6/8

■ arcModelId (audienceProfile 경유)
  srMorn=five-phase | showaC=five-phase | showa7=five-phase | j2000s=five-phase | chill=five-phase | cityNt=five-phase | oldpop=five-phase | kr2030=five-phase | jp2030=five-phase | idolM=five-phase | idolF=five-phase | lofi=five-phase | kids=repetition-cycle

■ audienceProfile (전용/general 폴백)
  srMorn=senior | showaC=senior | showa7=senior | j2000s=general⚠ | chill=general⚠ | cityNt=general⚠ | oldpop=senior | kr2030=kr-2030-emotional | jp2030=jp-2030-melodic | idolM=kr-idol-male | idolF=kr-idol-female | lofi=general⚠ | kids=kids

■ tempoCeiling·BPM 대역
  srMorn=62-100(4대역) | showaC=62-100(4대역) | showa7=62-100(4대역) | j2000s=60-132(4대역)⚠ | chill=60-132(4대역)⚠ | cityNt=60-132(4대역)⚠ | oldpop=62-100(4대역) | kr2030=68-120(4대역)⚠ | jp2030=65-125(4대역)⚠ | idolM=92-138(4대역)⚠ | idolF=92-138(4대역)⚠ | lofi=60-132(4대역)⚠ | kids=92-128(4대역)⚠

■ vocalQuotaOverride
  srMorn=기본 6/6/6 | showaC=기본 6/6/6 | showa7=기본 6/6/6 | j2000s=기본 6/6/6 | chill=기본 6/6/6 | cityNt=기본 6/6/6 | oldpop=기본 6/6/6 | kr2030=기본 6/6/6 | jp2030=기본 6/6/6 | idolM=15/0/3 | idolF=0/15/3 | lofi=기본 6/6/6 | kids=기본 6/6/6

■ eraIntent 모드 (워크스페이스 단위)
  srMorn=strict-decade | showaC=strict-decade | showa7=strict-decade | j2000s=strict-decade | chill=strict-decade | cityNt=strict-decade | oldpop=strict-decade | kr2030=current-implied | jp2030=current-implied | idolM=only-when-referenced | idolF=only-when-referenced | lofi=strict-decade | kids=strict-decade

■ DistinctChoicePolicy (지시문15)
  srMorn=verified | showaC=verified | showa7=verified | j2000s=verified | chill=verified | cityNt=verified | oldpop=verified | kr2030=advisory⚠ | jp2030=advisory⚠ | idolM=advisory⚠ | idolF=advisory⚠ | lofi=verified | kids=verified

■ PromptAxisPolicy (지시문16)
  srMorn=verified | showaC=verified | showa7=verified | j2000s=verified | chill=verified | cityNt=verified | oldpop=verified | kr2030=advisory⚠ | jp2030=advisory⚠ | idolM=advisory⚠ | idolF=advisory⚠ | lofi=verified | kids=verified

■ ObjectState 적용 kind (지시문17)
  srMorn=1/5 검증 | showaC=1/5 검증 | showa7=1/5 검증 | j2000s=1/5 검증 | chill=1/5 검증 | cityNt=1/5 검증 | oldpop=1/5 검증 | kr2030=0/2 검증⚠ | jp2030=0/2 검증⚠ | idolM=적용없음 | idolF=적용없음 | lofi=1/5 검증 | kids=1/5 검증

■ ListeningIntentPolicy (지시문23)
  srMorn=— | showaC=— | showa7=— | j2000s=— | chill=— | cityNt=— | oldpop=— | kr2030=— | jp2030=— | idolM=— | idolF=— | lofi=— | kids=—

■ eraBuckets 커버율 (시대색 비-neutral 비율)
  srMorn=76% (22/29) | showaC=67% (2/3) | showa7=100% (4/4) | j2000s=100% (3/3) | chill=0% (0/16) | cityNt=27% (3/11) | oldpop=67% (16/24) | kr2030=43% (13/30) | jp2030=17% (1/6) | idolM=14% (1/7) | idolF=14% (1/7) | lofi=0% (0/14) | kids=0% (0/3)

미정의(✗) 전체 목록 및 영향 ─────────────────────────────
  (없음)


편차 경고(⚠) 전체 목록 ─────────────────────────────────

⚠ preferredGenres (채널 합집합)
    편차 — 최대 30종 vs 최소 3종 (10.0배). 지시문 20이 손댄 senior-morning/oldpop-lounge만 24~29종, 나머지는 3~22종.

⚠ lyricTheme 후보 (실효/원본) — modern-chill, city-night, lofi-study
    modern-chill: 아키타입 전용 테마 0개 < 12 → 전체 풀(370개)로 폴백 — lyricThemesForArchetype의 방어 로직
    city-night: 아키타입 전용 테마 0개 < 12 → 전체 풀(370개)로 폴백 — lyricThemesForArchetype의 방어 로직
    lofi-study: 아키타입 전용 테마 0개 < 12 → 전체 풀(370개)로 폴백 — lyricThemesForArchetype의 방어 로직
    편차 — 최대 370개 vs 최소 18개 (20.6배).

⚠ introTexture 풀 (전용/전체폴백) — modern-chill, kr-2030-pop, jp-2030-pop, kr-idol-male, kr-idol-female, lofi-study
    modern-chill: 전용 인트로 텍스처 9개 (< 10, 폴백 임계선 아래)
    kr-2030-pop: 전용 인트로 텍스처 6개 (< 10, 폴백 임계선 아래)
    jp-2030-pop: 전용 인트로 텍스처 6개 (< 10, 폴백 임계선 아래)
    kr-idol-male: 전용 인트로 텍스처 6개 (< 10, 폴백 임계선 아래)
    kr-idol-female: 전용 인트로 텍스처 6개 (< 10, 폴백 임계선 아래)
    lofi-study: 전용 인트로 텍스처 3개 (< 10, 폴백 임계선 아래)

⚠ audienceProfile (전용/general 폴백) — j2000s, modern-chill, city-night, lofi-study
    j2000s: 전용 오디언스 프로필 없음 — GENERAL_AUDIENCE_PROFILE(twenties/thirtiesForties/general 공용, 청취 미보정)로 폴백
    modern-chill: 전용 오디언스 프로필 없음 — GENERAL_AUDIENCE_PROFILE(twenties/thirtiesForties/general 공용, 청취 미보정)로 폴백
    city-night: 전용 오디언스 프로필 없음 — GENERAL_AUDIENCE_PROFILE(twenties/thirtiesForties/general 공용, 청취 미보정)로 폴백
    lofi-study: 전용 오디언스 프로필 없음 — GENERAL_AUDIENCE_PROFILE(twenties/thirtiesForties/general 공용, 청취 미보정)로 폴백

⚠ tempoCeiling·BPM 대역 — j2000s, modern-chill, city-night, kr-2030-pop, jp-2030-pop, kr-idol-male, kr-idol-female, lofi-study, kids
    j2000s: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [60,132]을 4등분한 자동 생성 대역
    modern-chill: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [60,132]을 4등분한 자동 생성 대역
    city-night: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [60,132]을 4등분한 자동 생성 대역
    kr-2030-pop: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [68,120]을 4등분한 자동 생성 대역
    jp-2030-pop: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [65,125]을 4등분한 자동 생성 대역
    kr-idol-male: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [92,138]을 4등분한 자동 생성 대역
    kr-idol-female: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [92,138]을 4등분한 자동 생성 대역
    lofi-study: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [60,132]을 4등분한 자동 생성 대역
    kids: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [92,128]을 4등분한 자동 생성 대역

⚠ DistinctChoicePolicy (지시문15) — kr-2030-pop, jp-2030-pop, kr-idol-male, kr-idol-female
    kr-2030-pop(kr-2030): 추정치 — 실측 없음. 첫 세트 측정 후 재조정.
    jp-2030-pop(jp-2030): 추정치 — 실측 없음. 첫 세트 측정 후 재조정.
    kr-idol-male(kr-idol-male): 추정치 — 실측 없음. 첫 세트 측정 후 재조정.
    kr-idol-female(kr-idol-female): 추정치 — 실측 없음. 첫 세트 측정 후 재조정.

⚠ PromptAxisPolicy (지시문16) — kr-2030-pop, jp-2030-pop, kr-idol-male, kr-idol-female
    kr-2030-pop(kr-2030): 미실측 — provisional. 게이트는 돌되 blocking하지 않는다.
    jp-2030-pop(jp-2030): 미실측 — provisional. 게이트는 돌되 blocking하지 않는다.
    kr-idol-male(kr-idol-male): 미실측 — provisional. 게이트는 돌되 blocking하지 않는다.
    kr-idol-female(kr-idol-female): 미실측 — provisional. 게이트는 돌되 blocking하지 않는다.

⚠ ObjectState 적용 kind (지시문17) — kr-2030-pop, jp-2030-pop
    kr-2030-pop(kr-2030): kind message,vehicle 정의됐으나 실측(verifiedKinds) 0개 — 추정치 — 실측 없음. message는 core/relationshipContinuity.ts의 실측 unsent-then-reply를 위임하지만 워크스페이스 자체는 아직 verified가 아니다(§B-2 원칙: kind 실측과 워크스페이스 verified는 별개 축).
    jp-2030-pop(jp-2030): kind message,vehicle 정의됐으나 실측(verifiedKinds) 0개 — 추정치 — 실측 없음.


[check:coverage] CONTRACT VIOLATION(✗) 0건 / 편차 경고(⚠) 32건 / 축 20개 × 아키타입 13개


측정 곡 수 누적 (지시문 32 §4, scripts/audit.ts --pack 실행마다 누적) ────
  senior-oldpop    측정 54곡 (3세트) — 이미 verified
  kr-2030          측정 18곡 (1세트) — ⚠ 승격 조건 충족(≥18곡) — 하루 승인 시 distinctChoicePolicy.ts에서 verified:true로 직접 전환 (자동 승격 아님)
  jp-2030          측정 0곡 (0세트) — 미달 (기준 18곡)
  kr-kids          측정 18곡 (1세트) — ⚠ 승격 조건 충족(≥18곡) — 하루 승인 시 distinctChoicePolicy.ts에서 verified:true로 직접 전환 (자동 승격 아님)
  jp-kids          측정 0곡 (0세트) — 미달 (기준 18곡)
  kr-idol-male     측정 0곡 (0세트) — 미달 (기준 18곡)
  kr-idol-female   측정 0곡 (0세트) — 미달 (기준 18곡)
```

**CONTRACT VIOLATION 0건 — 신설 전과 완전히 동일.** kr-2030-rap은 archetype 단위가 아니라 preferredGenres/preferredMoods 같은 채널 단위 필드만 추가하므로, 이 스크립트가 아키타입 단위로만 순회하는 구조상 새 ✗을 만들 수 없다(실측 확인 — TASK C 연구 단계에서 코드 자체를 읽어 확인).

### 6. 130 BPM 트랩 곡의 perceivedEnergy 계산 결과 — 하프타임을 인식하는지, 인수 기준

**결론: `perceivedEnergy`는 하프타임을 전혀 인식하지 않는다.** `core/perceivedEnergy.ts`의 `tempoScore()`는 notated BPM(표기 BPM)을 그대로 `tempoAnchorLow`/`tempoAnchorHigh`에 선형 정규화할 뿐, 시간 체감(half-time/double-time)을 다루는 코드가 이 저장소 어디에도 없다(전수 grep 확인 — `halfTime`/`timeFeel`/`perceivedBpm` 등 0건, `hookDevices.ts`의 `'half-time-chorus'`는 스타일 프롬프트용 텍스트일 뿐 BPM 계산과 무관).

실측 스크립트(`kr2030-rap-drill-dark` 장르, `kr-2030` 워크스페이스 정책 anchors `[62,130]`):

```
policy anchors: 62 130
trap (notated 140 BPM, felt ~70): {
  "value": 4,
  "breakdown": { "tempo": 0.3, "rhythm": 0, "instrumentation": 0, "density": 0, "vocal": 0, "production": 0 },
  "reasonKo": "140 BPM (어휘 매치 없음, 템포 중심 판정) → 높음"
}
non-half-time reference (92 BPM): {
  "value": 3,
  "breakdown": { "tempo": -0.035..., "rhythm": 0, "instrumentation": 0, "density": 0, "vocal": 0, "production": 0 },
  "reasonKo": "92 BPM (어휘 매치 없음, 템포 중심 판정) → 중간"
}
```

**해석**: 실제로 ~70 BPM으로 느껴지는(하프타임) 140 BPM 트랩 트랙이 진짜로 92 BPM인 트랙보다 더 "높은" 에너지(4 vs 3)로 계산된다 — 실제 청감과 정반대다. 지시문이 예시로 든 "130 BPM 트랩 곡이 에너지 5로 계산되면 잘못"이라는 우려가 실측으로 확인됐다(이 케이스는 4).

**tempoCeiling 클램프도 함께 측정했다** (`kr-2030-emotional` audienceProfile, `tempoFloor:68`/`tempoCeiling:120`, `genreBoundedTempo: undefined`):

```
kr2030-rap-mumble-melodic:   tempoRange [130,150] -> 실제 생성 BPM 120 (ceiling 120)
kr2030-rap-whisper-trap:     tempoRange [128,145] -> 실제 생성 BPM 120 (ceiling 120)
kr2030-rap-emo-sing-rap:     tempoRange [135,155] -> 실제 생성 BPM 120 (ceiling 120)
kr2030-rap-drill-dark:       tempoRange [138,148] -> 실제 생성 BPM 120 (ceiling 120)
kr2030-rap-cloud-hazy:       tempoRange [120,140] -> 실제 생성 BPM 120 (ceiling 120)
kr2030-rap-boom-bap-modern:  tempoRange [85,95]   -> 실제 생성 BPM 89  (ceiling 120, 클램프 없음)
kr2030-rap-laidback-alt-rnb: tempoRange [72,92]   -> 실제 생성 BPM 89  (ceiling 120, 클램프 없음)
kr2030-rap-female-melodic:   tempoRange [125,145] -> 실제 생성 BPM 120 (ceiling 120)
```

`core/tempoPlan.ts`의 `resolveTempoWithBand`는 `genreBoundedTempo`가 꺼져 있으면(kr-kids/jp-kids만 켜져 있음, kr-2030은 꺼짐) 장르의 `tempoRange`를 지터 계산에만 쓰고 최종값은 `[audienceFloor, audienceCeiling]`으로 강하게 clamp한다. 그 결과 8종 중 6종(트랩 계열)은 실제 생성 BPM이 전부 120(ceiling)에 눌린다 — 장르가 요구하는 130~155 표기 BPM 관례가 실제 생성물에는 반영되지 않는다.

**정책 변경을 하지 않은 이유(§하지 말 것 준수)**: tempoCeiling(120)은 `kr-2030-emotional` 프로필 소속이고, 이 프로필은 kr-2030-pop archetype의 **4개 채널 전체**(기존 3개 밴드팝 채널 + kr-2030-rap)가 공유한다. archetype 재사용을 유지하는 한(§하지 말 것 "새 아키타입을 만들지 말 것") 이 채널만 별도 ceiling을 줄 방법이 없다 — 새 아키타입을 만들거나 기존 3개 채널까지 함께 흔드는 수밖에 없는데, 두 선택지 모두 "하지 말 것"과 정면충돌한다. 게다가 perceivedEnergy가 하프타임을 인식하지 못하는 상태에서 ceiling만 올리면, 실제로 느긋한 트랙의 raw BPM이 그대로 perceivedEnergy에 들어가 에너지 배분(§지시문 23) 자체가 더 왜곡된다 — "실측하고 보고한다, 임의로 조정하지 않는다"는 지시문 원문 그대로, 측정만 하고 값은 건드리지 않았다.

**후속 작업 필요(이 지시문 범위 밖)**: (1) `perceivedEnergy.ts`에 half-time 인식 축 추가, (2) 그 다음에야 kr-2030-emotional의 tempoCeiling(또는 kr-2030-rap 전용 audienceProfile 분리 — 이 경우 새 아키타입 없이 profile만 분리하는 방법이 있는지는 추가 조사 필요) 조정을 안전하게 검토할 수 있다.

### 7. 랩 안전 정책 전문과 브릿지 지시문 반영

`src/core/kr2030RapSafetyPolicy.ts` (신규 파일) — 카테고리 요약: blocking 4종(violence-weapons-drugs-crime · profanity-slurs · group-bias · real-person-brand), advisory 2종(conspicuous-consumption · aggressive-battle-framing). 전문은 저장소 파일 참고(파일이 짧아 위치만 명시, 전체 정규식 목록 포함).

**실행 경로 2곳에 실제로 배선**(rule 4 준수 — 새 모듈이 죽은 코드로 남지 않음):

1. **사후 검사** — `core/releaseReadiness.ts`, `channelId === 'kr-2030-rap'`로 스코프(archetype이 아님 — 같은 archetype을 쓰는 다른 3개 채널에는 적용 안 함):
   ```ts
   if (channelId === 'kr-2030-rap') {
     const safety = songs.map(song => ({ trackNo: song.trackNo, ...checkKr2030RapSafety(song.lyrics) }));
     const blockingIssues = safety.filter(s => s.blocking.length > 0);
     items.push({
       id: RELEASE_READINESS_ITEM_IDS.kr2030RapSafetyBlocking, categoryKo: '안전', labelKo: 'kr-2030-rap 안전 어휘(blocking) 위반 0건',
       status: blockingIssues.length === 0 ? 'pass' : 'fail', ...
     });
     const advisoryIssues = safety.filter(s => s.advisory.length > 0);
     items.push({
       id: RELEASE_READINESS_ITEM_IDS.kr2030RapSafetyAdvisory, categoryKo: '안전', labelKo: 'kr-2030-rap 안전 어휘(advisory) 없음', ...
     });
   }
   ```
   이를 위해 `ReleaseReadinessInput`에 `channelId?: string` 필드를 신설(archetype만으로는 같은 archetype 4개 채널을 구분 못함)하고, 두 호출부(`core/finalizeBlueprint.ts`, `components/SetCompletenessPanel.tsx`)에서 `channel.id`를 실제로 넘기도록 배선했다. 이 변경의 부수 효과로 **실제 회귀 하나를 잡았다**: 기존 `kr2030UnexpectedRap` 검사("랩 없는 채널에 랩 강제 금지")가 archetype 단위였기 때문에, channelId 스코프 없이 뒀다면 kr-2030-rap의 모든 곡이 "예상 밖 랩"으로 FAIL 처리될 뻔했다 — channelId로 kr-2030-rap만 이 검사에서 제외하고 나머지 3개 채널은 그대로 유지했다.

2. **생성 시점 브릿지 지시문** — `core/bridgeInstruction.ts`, `channel.id === 'kr-2030-rap'`일 때만 삽입, `buildSetIntentSection` 바로 다음(가장 먼저 읽히는 위치):
   ```ts
   function kr2030RapSafetyBridgeLines(opts: Pick<GenerationOptions, 'channel'>): string[] {
     if (opts.channel.id !== 'kr-2030-rap') return [];
     return [
       '',
       '[안전 — 이 채널은 유튜브 플레이리스트용입니다]',
       '이 채널은 유튜브 플레이리스트용입니다. 폭력·약물·범죄·욕설·비하 표현을 사용하지 마십시오. 랩의 리듬과 딜리버리는 유지하되 소재는 일상·감정·도시 풍경으로.',
       '- CRITICAL: no weapons, violence, or crime narrative content (guns, knives, stabbing, shooting, gang activity, robbery).',
       '- CRITICAL: no drug references (dealing, using, or naming specific drugs).',
       '- CRITICAL: no profanity or slurs of any kind.',
       '- CRITICAL: no group-bias or bigoted language (race, gender, region, religion).',
       '- CRITICAL: no real celebrity, artist, or brand names anywhere in the lyrics.',
       '- Keep the mumble/trap/sing-rap delivery and flow — only the SUBJECT MATTER is restricted, not the genre\'s rhythmic or vocal character.'
     ];
   }
   ```
   지시문 D-3가 요구한 문장("이 채널은 유튜브 플레이리스트용입니다...") 그대로 포함.

**테스트로 고정**: `tests/kr2030RapSafetyPolicy.test.ts`(7 케이스 — blocking 4종·advisory 2종·클린 텍스트), `tests/kr2030RapBridgeSafety.test.ts`(브릿지 지시문에 실제로 들어가는지 + 다른 채널로 새지 않는지).

### 8. E-1 수치표 현재값

위 "E-1. 수치표" 참고 — 전 항목 현재값 채움 완료.

---

## 검증 로그 (전체 통과)

```
npm test              → 362 test files passed, 4545 tests passed, 17 skipped, 0 failed
npm run lint           → 0 errors, 0 warnings
tsc --noEmit           → 0 errors
npm run check:coverage → CONTRACT VIOLATION 0건 (변경 전과 동일)
npm run check:gates    → CONTRACT VIOLATION 0건 (기존 cross-style advisory 4건, 미변경)
npm run check:settings → 적용 75/유실 6 (kr-2030-rap는 유실 목록에 없음 — 기존 6건과 무관)
npm run check:archetype→ 통과 (실측 29곳 ≤ allowlist 47곳)
npm run check:reachability → 사유 없는 도달 불가 파일 없음 (rapVocalDelivery.ts/kr2030RapSafetyPolicy.ts 둘 다 실제 실행 경로에서 import됨)
npm run check:node     → 통과
npm run check:version  → 통과
```

## 회귀 방지 목록 확인

- **after-work-band-pop 채널 유지**: 건드리지 않음. `preferredGenres`/정책 변경 없음.
- **지시문 33의 era-neutral 하한·장르 회전**: 건드리지 않음.
- **시니어 청취 검증값(BPM 대역·곡 길이·진폭 등)**: `audienceProfiles.ts`/`SENIOR_MUSIC_POLICY` 등 시니어 전용 파일 미수정.
- **kr2030UnexpectedRap 검사**: 나머지 3개 채널(after-work-band-pop, thirty-night-walk, rainy-seoul-nightscape)에서는 그대로 살아있음(channelId 스코프로 kr-2030-rap만 예외).

## 이 지시문이 하지 않은 것 (의도적)

- perceivedEnergy에 half-time 인식을 추가하지 않았다(측정만).
- kr-2030-emotional의 tempoCeiling을 조정하지 않았다(측정만, §하지 말 것).
- lyricTheme을 신규로 쓰지 않았다 — "110종 목표"가 코드베이스 어디에도 없는 수치라(전수 grep 확인, 지시문 14의 실제 CHANGELOG 기록은 "kids 14→42, senior-morning 40→70"뿐) 46개 상속값을 그대로 두고 이 불일치를 그대로 보고했다.
- 첫 세트 전곡 사람 확인은 하지 않았다 — "이후 (이 지시문 범위 아님)" 섹션에 명시된 하루의 몫이다.
