import type { ChannelArchetype } from '../types';

export interface VocalPreset {
  id: string;
  label: string;
  sublabel: string;
  description: string;
  prompt: string;
  /**
   * TASK v3.41 Part A1 — single source of truth for this preset's gender,
   * replacing prose-regex inference (core/vocalPlan.ts's detectVocalGender)
   * as the primary signal wherever a preset is known. Prose sniffing breaks
   * on a duet ("male and female duet, ...") — both words present means
   * detectVocalGender always returns null, which previously disabled
   * gender enforcement entirely for a duet selection. Prose detection still
   * exists as a fallback for free-text vocalTone that doesn't match any
   * preset here.
   */
  gender: 'male' | 'female' | 'mixed' | 'duet';
  /** TASK v3.39 Part D — true for the kids-channel childlike presets below; Step2Concept.tsx shows only these for a 'kids' archetype channel (and only the plain adult presets otherwise), instead of mixing an adult voice picker into a children's channel. */
  forKids?: boolean;
  /** TASK v3.41 — optional channel-fit hint for sorting the picker (e.g. showa-cafe surfaces husky-jazz-female first); purely a UI ordering aid, never filters a preset out. */
  suitedArchetypes?: ChannelArchetype[];
}

export const vocalPresets: VocalPreset[] = [
  // TASK v3.39 Part D — kids-channel presets, wording matches
  // core/vocalPlan.ts's VOCAL_DESCRIPTIONS exactly (childlike/youthful,
  // never "adult", per that module's own real-listening-feedback rewrite).
  // Kept first in the array so a kids channel's ChoiceGrid (filtered to
  // forKids in Step2Concept.tsx) always lists boy/girl/choir in this order.
  {
    id: 'kid-boy',
    label: '남자아이',
    sublabel: 'Young boy',
    description: '밝고 씩씩한 아이 목소리예요.',
    prompt: 'bright childlike boy voice, playful and youthful, kindergarten-age tone',
    gender: 'male',
    forKids: true
  },
  {
    id: 'kid-girl',
    label: '여자아이',
    sublabel: 'Young girl',
    description: '맑고 다정한 아이 목소리예요.',
    prompt: 'bright childlike girl voice, sweet and clear, kindergarten-age tone',
    gender: 'female',
    forKids: true
  },
  {
    id: 'kid-choir',
    label: '아이 합창',
    sublabel: 'Kids choir',
    description: '다 함께 부르는 동요 합창이에요.',
    prompt: "children's choir of childlike, youthful voices singing together, cheerful call-and-response group singalong",
    gender: 'mixed',
    forKids: true
  },
  // TASK v3.41 Part C — kids pool expansion (3 -> 10).
  {
    id: 'kid-boy-elementary',
    label: '남자아이(초등)',
    sublabel: 'Young boy, elementary',
    description: '조금 더 또렷하고 씩씩한 아이 목소리예요.',
    prompt: 'clear childlike boy voice, confident singalong delivery, young elementary-age tone',
    gender: 'male',
    forKids: true
  },
  {
    id: 'kid-girl-elementary',
    label: '여자아이(초등)',
    sublabel: 'Young girl, elementary',
    description: '또렷하고 자신감 있는 아이 목소리예요.',
    prompt: 'clear childlike girl voice, confident singalong delivery, young elementary-age tone',
    gender: 'female',
    forKids: true
  },
  {
    id: 'kid-duet',
    label: '남녀 아이 듀엣',
    sublabel: 'Boy & girl duet',
    description: '두 아이가 주고받으며 불러요.',
    prompt: 'childlike boy and girl duet, trading lines back and forth, playful call-and-response',
    gender: 'duet',
    forKids: true
  },
  {
    id: 'kid-choir-unison',
    label: '아이 합창(제창)',
    sublabel: 'Kids choir, unison',
    description: '다 함께 같은 멜로디로 부르는 쉬운 합창이에요.',
    prompt: "children's choir singing in simple unison, bright easy singalong, no harmony",
    gender: 'mixed',
    forKids: true
  },
  {
    id: 'kid-choir-round',
    label: '아이 합창(돌림노래)',
    sublabel: 'Kids choir, round',
    description: '돌림노래처럼 겹쳐 부르는 합창이에요.',
    prompt: "children's choir singing a simple round, overlapping entries, cheerful canon feel",
    gender: 'mixed',
    forKids: true
  },
  {
    id: 'kid-lead-with-choir',
    label: '아이 솔로 + 합창',
    sublabel: 'Kid lead + choir',
    description: '한 아이가 부르고 후렴에서 다 같이 합쳐요.',
    prompt: "childlike solo lead voice on verses, full children's choir joining on the chorus",
    gender: 'mixed',
    forKids: true
  },
  {
    id: 'kid-chant-clap',
    label: '아이 손뼉 챈트',
    sublabel: 'Kids clapping chant',
    description: '손뼉치기 놀이처럼 리듬을 타요.',
    prompt: 'children chanting in a clapping-game rhythm, rhythmic speak-singing, playful group energy',
    gender: 'mixed',
    forKids: true
  },
  // TASK v3.41 Part B — adult pool expansion (5 -> 16). Existing 5 keep
  // their id/prompt byte-identical (only `gender` is new) so a saved pack
  // referencing one of these ids by matched prompt text keeps resolving.
  //
  // 지시문 38 (TASK D2) — 13개 비-kids 아키타입 × 16개 성인 프리셋 적합성
  // 표. 실제 버그: suitedArchetypes가 지금까지 정렬/배지에만 쓰이고
  // Step2Concept.tsx의 그리드를 실제로 걸러내지 않았고(하드 필터 아님),
  // 그나마 있던 태그도 전부 'senior-morning'을 가리켜 하루의 실제 채널
  // archetype인 'oldpop-lounge'(및 showa-70s/christmas 등 7개 아키타입)는
  // 태그가 하나도 없어 사실상 모든 프리셋에 무방비로 노출됐다 — "시니어
  // 채널인데 로리 계열(밝고 앳된) 목소리도 많이 나온다"는 하루의 청취
  // 피드백이 바로 이 경로. data/archetypeAudienceProfiles.ts의
  // AUDIENCE_PROFILE_ID_BY_ARCHETYPE가 이미 실측/추정으로 분류해 둔
  // audience 그룹(시니어 5·일반 4·kr-2030·jp-2030·kids 3·idol 2)을 그대로
  // 근거로 삼아 아래처럼 배정한다 — 시니어 5종(senior-morning/showa-cafe/
  // showa-70s/oldpop-lounge/christmas)에는 젊고 밝은 음색(bright-young-*,
  // clear-light-male, bright-clear-female, airy-whisper-female,
  // husky-jazz-female)을 배정하지 않는다(그게 바로 이 버그였다). 13개
  // 아키타입 전부 최소 4개 이상(대부분 5개 이상) 프리셋을 확보했다 —
  // lofi-study가 4→5(soft-female 추가)로 가장 적다; 강제로 안 맞는
  // 프리셋을 채우기보다 실제 결이 맞는 것만 골랐다. 아래 각 프리셋 정의의
  // suitedArchetypes 배열이 이 표의 실제 데이터다(별도 표 파일 없이 이
  // 주석 + 배열 자체가 원본).
  {
    id: 'warm-mature-male',
    label: '따뜻한 중년 남성',
    sublabel: 'Warm mature male',
    description: '음을 부드럽게 열고 들어가는, 살짝 쉰 듯한 라디오 DJ 목소리예요.',
    prompt: 'mature soulful male tenor, soft slightly husky close-mic delivery, soft glottal onset, gentle',
    gender: 'male',
    suitedArchetypes: ['senior-morning', 'showa-70s', 'oldpop-lounge', 'christmas']
  },
  {
    id: 'low-calm-male',
    label: '낮고 차분한 남성',
    sublabel: 'Low calm male',
    description: '성대를 깔끔하게 붙여 흔들림 없이 부르는, 늦은 밤의 낮은 목소리예요.',
    prompt: 'low calm male baritone, restrained emotional delivery, clean fold closure, warm late-night tone',
    gender: 'male',
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: en-chillhop-vocal-floor의
    // requiredTraits(natural conversational English delivery, contemporary
    // urban placement) 충족, forbiddenTraits(빈티지 크루너·오페라틱·시니어
    // 라디오 톤) 없음 — 늦은 밤 도시 톤이라 chill-rap/lofi-hiphop-study와 잘 맞는다.
    suitedArchetypes: ['senior-morning', 'showa-70s', 'oldpop-lounge', 'lofi-study', 'city-night', 'modern-chill', 'kr-idol-male', 'en-chillhop']
  },
  {
    id: 'clear-light-male',
    label: '맑고 담백한 남성',
    sublabel: 'Clear light male',
    description: '울림이 얼굴 앞쪽에 맺혀 또렷하게 들리는, 담백한 목소리예요.',
    prompt: 'clear light male tenor, clean simple delivery, forward mask resonance, youthful',
    gender: 'male',
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: 자연스러운 대화체 전달이라
    // en-chillhop-vocal-floor의 requiredTraits와 직접 일치, forbiddenTraits 없음.
    suitedArchetypes: ['lofi-study', 'j2000s', 'modern-chill', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'en-chillhop']
  },
  {
    id: 'airy-falsetto-male',
    label: '에어리 팔세토 남성',
    sublabel: 'Airy falsetto male',
    description: '호흡을 세게 밀지 않는, 시티팝에 어울리는 부드러운 가성이에요.',
    prompt: 'soft male falsetto, airy head voice, low breath pressure, smooth city-pop phrasing',
    gender: 'male',
    // 지시문 76 (TASK B) — alt-rnb·trap-soul이 이 워크스페이스의 코어라 가성 리드가
    // 장르 정의 안에 이미 있다. 프롬프트에 빈티지 크루너/오페라틱/아나운서
    // 어휘가 없어 en-chillhop-vocal-floor의 forbiddenTraits와 충돌하지 않는다.
    // 지시문 78 (TASK C) — 'kr-2030-pop' 추가: breathy 축 보강(soft-female과
    // 함께 남녀 양쪽을 채운다). 바닥 충돌 없음.
    suitedArchetypes: ['showa-cafe', 'j2000s', 'jp-2030-pop', 'kr-idol-male', 'en-chillhop', 'kr-2030-pop']
  },
  {
    id: 'smoky-jazz-male',
    label: '스모키 재즈 남성',
    sublabel: 'Smoky jazz male',
    description: '성대 마찰이 그대로 들리는, 재즈 라운지의 허스키한 목소리예요.',
    prompt: 'smoky male baritone, relaxed jazz phrasing, lounge microphone warmth, audible fold rasp',
    gender: 'male',
    suitedArchetypes: ['showa-cafe', 'city-night']
  },
  {
    id: 'bright-young-male',
    label: '밝은 청년 남성',
    sublabel: 'Bright young male',
    description: '앞쪽 공명으로 산뜻하게 뻗는, 젊은 느낌의 목소리예요.',
    prompt: 'bright young male voice, clean modern pop delivery, forward mask resonance, open',
    gender: 'male',
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: "clean modern pop delivery"가
    // 바닥의 contemporary urban vocal placement와 직접 일치.
    suitedArchetypes: ['city-night', 'j2000s', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'en-chillhop']
  },
  {
    id: 'whisper-male',
    label: '속삭이는 남성',
    sublabel: 'Whisper male',
    description: '성대를 다 닫지 않고 공기를 섞어 내는, 수면·집중용 낮은 속삭임이에요.',
    prompt: 'soft male voice just above a whisper, intimate close-mic breath, soft glottal onset',
    gender: 'male',
    // 지시문 76 (TASK B) — lofi-study·modern-chill이 이미 붙은 현대 친밀형 목소리로,
    // 이 워크스페이스의 lofi-hiphop-study·chill-rap과 같은 결이다.
    suitedArchetypes: ['lofi-study', 'modern-chill', 'en-chillhop']
  },
  {
    id: 'soft-female',
    label: '부드러운 여성',
    sublabel: 'Soft female',
    description: '공기 반 소리 반으로 낮게 내려놓는, 찻집에 흐르는 잔잔한 목소리예요.',
    prompt: 'soft warm female alto, gentle breathy delivery, low breath pressure, calm',
    gender: 'female',
    // 지시문 76 (TASK B) — 이미 lofi-study에 붙어 있는 현대 침착형 음색이고,
    // 프롬프트에 시대 표지(크루너·아나운서)가 없다.
    // 지시문 78 (TASK C) — 'kr-2030-pop' 추가: 이 아키타입의 breathy 축이
    // 0종이었다(§1 실측). kr-2030-vocal-floor의 requiredTraits(natural
    // conversational phrasing)와 직접 맞고 forbiddenTraits에 걸리지 않는다.
    suitedArchetypes: ['senior-morning', 'oldpop-lounge', 'christmas', 'lofi-study', 'en-chillhop', 'kr-2030-pop']
  },
  {
    id: 'mature-female',
    label: '성숙한 여성',
    sublabel: 'Mature female',
    description: '성대를 정확히 붙여 흔들림이 없는, 우아하고 안정적인 목소리예요.',
    prompt: 'mature elegant female mezzo-soprano, warm restrained delivery, clean fold closure',
    gender: 'female',
    suitedArchetypes: ['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge', 'christmas', 'kr-2030-pop']
  },
  {
    id: 'bright-clear-female',
    label: '맑고 밝은 여성',
    sublabel: 'Bright clear female',
    description: '울림이 앞쪽에 맺혀 종소리처럼 또렷한, 밝은 목소리예요.',
    prompt: 'bright clear female soprano, bell-like clarity, forward mask resonance, uplifting',
    gender: 'female',
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: "light and uplifting delivery"가
    // en-deep-house-melodic 등 보컬 훅이 분명한 하우스 장르와 잘 맞는다.
    // 오페라틱 발성이 아니라 클래리티 중심이라 바닥의 forbiddenTraits에 걸리지 않음.
    suitedArchetypes: ['j2000s', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-female', 'en-chillhop']
  },
  {
    id: 'husky-jazz-female',
    label: '허스키 재즈 여성',
    sublabel: 'Husky jazz female',
    description: '성대 마찰이 섞여 거친, 쇼와 카페·시티팝에 어울리는 음색이에요.',
    prompt: 'husky female alto, audible fold rasp, smoky jazz phrasing, laid-back swing feel',
    gender: 'female',
    // 지시문 76 (TASK B) — §3.2가 "넣으려면 근거를 명시하라"고 지목한 둘 중 하나.
    // 프롬프트는 'husky female alto, smoky jazz phrasing, laid-back swing feel'로,
    // 이 워크스페이스 코어 장르인 jazz-rap의 'laid-back jazz-rap swing'과 같은
    // 어휘다. 짝인 smoky-jazz-male은 반대로 **붙이지 않았다** — 그쪽은
    // 'lounge microphone warmth'라는 크루너 라운지 표지가 프롬프트에 직접 있어
    // forbiddenTraits('vintage crooner vibrato')와 부딪힌다. 또 현재 8종에
    // 허스키 여성 음색이 하나도 없어 음색 축을 실제로 벌리는 항목이다(§3.2).
    suitedArchetypes: ['showa-cafe', 'city-night', 'kr-idol-female', 'en-chillhop']
  },
  {
    id: 'airy-whisper-female',
    label: '속삭이는 여성',
    sublabel: 'Airy whisper female',
    description: '음 시작을 공기로 여는, 수면·휴식 콘텐츠용 에어리한 목소리예요.',
    prompt: 'soft female voice just above a whisper, airy breath tone, soft glottal onset',
    gender: 'female',
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: trap-soul("sparse... doubled
    // intimate vocal")/lofi-hiphop-study("optional soft hook vocal kept low")의
    // 창법 결과 잘 맞는 음색.
    // 지시문 78 (TASK C) — 'city-night' 추가: 이 아키타입의 breathy 축이
    // 0종이었다. 야간 드라이브 결과 직접 맞는 음색이다.
    suitedArchetypes: ['lofi-study', 'modern-chill', 'kr-idol-female', 'en-chillhop', 'city-night']
  },
  {
    id: 'bright-young-female',
    label: '밝은 청년 여성',
    sublabel: 'Bright young female',
    description: '성대가 깔끔하게 붙어 잡음 없이 뻗는, 산뜻한 목소리예요.',
    prompt: 'bright young female voice, clean modern pop delivery, clean fold closure, open',
    gender: 'female',
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: bright-young-male과 대칭되는
    // "clean modern pop delivery"로 바닥의 contemporary urban placement와 일치.
    suitedArchetypes: ['city-night', 'modern-chill', 'j2000s', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-female', 'en-chillhop']
  },
  {
    id: 'soulful-female',
    label: '소울풀 여성',
    sublabel: 'Soulful female',
    description: '흉성과 두성을 유연하게 오가며 감정을 싣는 목소리예요.',
    prompt: 'soulful female voice, gospel-tinged phrasing, controlled runs, flexible chest-to-head mix',
    gender: 'female',
    suitedArchetypes: ['senior-morning', 'showa-70s', 'christmas', 'kr-2030-pop']
  },
  // ---------------------------------------------------------------------------
  // 지시문 78 (TASK B) — 신설 7종. §1 실측에서 belted/dark가 성인 7개
  // 아키타입 **전부 0종**이었고 husky는 채널당 0~1종에 기존 3종이 전부
  // smoky jazz 문맥에 묶여 있었다. 여성 falsetto는 남성만 있었다.
  //
  // suitedArchetypes는 TASK C에서 채운다 — 그때까지 이 7종은
  // suitablePresetsForArchetype 어디에도 나타나지 않는다(빈 배열 =
  // 하드 필터에서 전부 제외, 기존 동작 완전 무변경).
  // ---------------------------------------------------------------------------
  {
    // §3.2 — 기존 soulful-female의 'controlled runs, flexible chest-to-head mix'
    // (절제·레지스터 유연성)와 명확히 구분된다: 이쪽은 성대 폐쇄와 흉성 투사다.
    // senior-oldpop-vocal-floor의 forbiddenTraits 'aggressive belting'에 걸리지
    // 않도록 'aggressive'/'belting' 어휘를 쓰지 않고, kr-2030/jp-2030/en-chillhop
    // 바닥의 'operatic projection'과도 다른 흉성 기반 표현으로 썼다.
    id: 'belted-male',
    label: '힘 있게 뻗는 남성',
    sublabel: 'Full-voiced male',
    description: '후렴에서 성대를 단단히 닫고 시원하게 뻗어 올리는 목소리예요.',
    prompt: 'full-voiced male tenor, firm glottal closure, sustained chest projection into the chorus',
    gender: 'male',
    // 지시문 78 (TASK C) — senior-oldpop-vocal-floor의 forbiddenTraits는
    // 'aggressive belting'이지 흉성 투사 자체가 아니다. 이 prompt에는
    // aggressive/belting 어휘가 없고 'unforced natural delivery'(같은 바닥의
    // requiredTraits)와도 부딪히지 않아 showa-70s/oldpop-lounge에 붙인다.
    // kr-2030/jp-2030/en-chillhop 바닥의 'operatic projection'과도 다르다 —
    // 오페라 발성이 아니라 흉성 지지 기반 투사다.
    // senior-morning/christmas에는 붙이지 않았다 — 그 두 채널은 아침·연말의
    // 잔잔한 결이라 남성 풀보이스가 채널 정체성과 어긋난다(대신 같은 축의
    // belted-female을 붙였다 — 그쪽은 이미 soulful-female이 있는 자리다).
    suitedArchetypes: ['showa-70s', 'oldpop-lounge', 'city-night', 'j2000s', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'en-chillhop']
  },
  {
    id: 'belted-female',
    label: '힘 있게 뻗는 여성',
    sublabel: 'Full-voiced female',
    description: '후렴에서 흉성으로 밀어 올려 음량이 실제로 커지는 목소리예요.',
    prompt: 'full-voiced female alto, firm glottal closure, chest-driven projection lifting the chorus',
    gender: 'female',
    // 지시문 78 (TASK C) — belted-male과 같은 바닥 판정. senior-morning/
    // christmas에도 붙인다: 이미 soulful-female(가스펠 결)이 있는 자리라
    // 흉성 투사가 채널 정체성 밖이 아니다. en-chillhop은 코어에
    // en-deep-house-soulful/en-deep-house-vocal-anthem이 있어 'full sung
    // chorus hook carrying the emotional peak'가 장르 정의 안에 이미 있다.
    suitedArchetypes: ['senior-morning', 'showa-70s', 'oldpop-lounge', 'christmas', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-female', 'en-chillhop']
  },
  {
    // §3.2 — 기존 low-calm-male은 **음역이 낮을 뿐** 공명은 warm/clean이다
    // ('low calm male baritone, ... clean fold closure, warm late-night tone').
    // 이쪽은 후두 위치와 인두 공명강을 지목한다 — 한국어로 흔히 "동굴 소리".
    id: 'dark-resonant-male',
    label: '동굴 소리 남성',
    sublabel: 'Dark resonant male',
    description: '후두를 낮춰 동굴처럼 울리는 어두운 목소리예요.',
    prompt: 'male baritone with lowered larynx, deep pharyngeal resonance, dark cavernous tone',
    gender: 'male',
    // 지시문 78 (TASK C) — 어느 바닥의 forbiddenTraits에도 해당 어휘가 없다.
    // 야간·저조도 결의 아키타입 위주로 붙였다(city-night/lofi-study/
    // modern-chill/en-chillhop의 trap-soul·deep house).
    suitedArchetypes: ['showa-70s', 'oldpop-lounge', 'city-night', 'lofi-study', 'modern-chill', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'en-chillhop']
  },
  {
    // §3.2 "저음과 어두움은 다른 축이다" — alto(저음역이 아님)인데 공명이
    // 어둡다. 이 조합이 없으면 dark 축이 남성 저음의 다른 이름으로 축소된다.
    id: 'dark-resonant-female',
    label: '동굴 소리 여성',
    sublabel: 'Dark resonant female',
    description: '음역은 높아도 공명이 낮게 깔려 어둡게 울리는 목소리예요.',
    prompt: 'female alto with lowered larynx, deep pharyngeal resonance, dark velvet tone',
    gender: 'female',
    // 지시문 78 (TASK C) — showa-70s는 dark-resonant-male이 이미 축을
    // 채우므로 중복 배정하지 않았다. showa-cafe는 husky-jazz-female의
    // 어두운 대응이 없던 자리다.
    suitedArchetypes: ['showa-cafe', 'oldpop-lounge', 'city-night', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-female', 'en-chillhop']
  },
  {
    // §3.2 — 기존 허스키 3종(warm-mature-male / smoky-jazz-male /
    // husky-jazz-female)이 전부 재즈·라운지 문맥에 묶여 있어 2030·아이돌·
    // 칠랩에 붙일 수 없었다. 이 2종에는 jazz/lounge/smoky 어휘를 쓰지 않는다.
    id: 'husky-grain-male',
    label: '거친 결 남성',
    sublabel: 'Husky grain male',
    description: '성대 마찰이 섞인 거친 결의 목소리예요 — 장르를 가리지 않아요.',
    prompt: 'male voice with audible fold rasp, dry grainy texture, plainspoken and direct',
    gender: 'male',
    // 지시문 78 (TASK C) — 장르 중립 허스키. 기존 3종이 전부 재즈·라운지
    // 문맥이라 붙일 수 없던 kr-2030-pop/jp-2030-pop/kr-idol-male에 이 축을
    // 처음으로 넣는다. kids 바닥의 'husky or smoky texture'에 걸리므로
    // 동요 2종에는 절대 붙이지 않는다.
    suitedArchetypes: ['showa-70s', 'oldpop-lounge', 'city-night', 'modern-chill', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'en-chillhop']
  },
  {
    id: 'husky-grain-female',
    label: '거친 결 여성',
    sublabel: 'Husky grain female',
    description: '다듬지 않은 거친 결이 그대로 남은 목소리예요 — 장르를 가리지 않아요.',
    prompt: 'female voice with audible fold rasp, worn grainy edge, direct and unpolished',
    gender: 'female',
    // 지시문 78 (TASK C) — husky-grain-male과 같은 판정. showa-70s는
    // husky-grain-male이 축을 채운다.
    suitedArchetypes: ['showa-cafe', 'oldpop-lounge', 'city-night', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-female', 'en-chillhop']
  },
  {
    // §3.2 "여성 falsetto는 남성과 생리적으로 다르므로 같은 문구를 성별만
    // 바꿔 쓰지 말 것" — airy-falsetto-male은 두성의 공기감(airy head voice,
    // low breath pressure)을 말하고, 이쪽은 파사지오 위에서의 얇은 성대
    // 접촉을 말한다. 겹치는 단어는 'falsetto' 하나뿐이다.
    id: 'light-falsetto-female',
    label: '가벼운 가성 여성',
    sublabel: 'Light falsetto female',
    description: '파사지오 위에서 성대를 얇게 붙여 내는 가볍고 투명한 가성이에요.',
    prompt: 'light female falsetto above the passaggio, thin fold contact, weightless clarity',
    gender: 'female',
    // 지시문 78 (TASK C) — senior-oldpop 바닥의 'very young bright tone'과
    // 인접하게 읽힐 여지가 있어 senior-morning/showa-cafe/showa-70s/
    // oldpop-lounge/christmas에는 **붙이지 않았다**(§4.2 '걸리면 붙이지 말고
    // 보고할 것'). falsetto는 §6.1의 5개 필수 축이 아니라 이 제외가
    // 커버리지 목표를 깨지 않는다.
    suitedArchetypes: ['j2000s', 'city-night', 'modern-chill', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-female', 'en-chillhop']
  },
  {
    id: 'male-female-duet',
    label: '남녀 듀엣',
    sublabel: 'Male-female duet',
    description: '두 사람이 음 시작을 맞춰, 절을 주고받고 후렴에서 화음을 쌓아요.',
    prompt: 'male and female duet, alternating verses, close harmony on the chorus, matched onsets',
    gender: 'duet',
    // 지시문 38 (TASK D2) — j2000s/city-night/kr-2030-pop/jp-2030-pop 4개는
    // 태그를 하나도 안 채우면 이 4개 아키타입에 duet/mixed 계열 프리셋이
    // 하나도 없어서(전부 male-female-duet/mixed-harmony-group 둘 중
    // 하나는 있어야 함) 균등배정(6/6/6) 중 '혼성' 슬롯을 추천할 후보가
    // 아예 없어진다 — Y2K J-pop/night-drive/모던 K발라드 모두 실제로
    // 듀엣 곡이 흔한 장르라 억지 배정이 아니다.
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: 절을 주고받는 형태가 duet
    // 보컬 쿼터 슬롯을 채운다. 바닥의 forbiddenTraits(빈티지 크루너 등)와
    // 무관한 딜리버리.
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'showa-70s', 'oldpop-lounge', 'christmas', 'kr-idol-male', 'kr-idol-female', 'j2000s', 'city-night', 'kr-2030-pop', 'jp-2030-pop', 'en-chillhop']
  },
  {
    id: 'mixed-harmony-group',
    label: '혼성 화음 그룹',
    sublabel: 'Mixed harmony group',
    description: '음 시작을 하나로 맞춘 작은 그룹이 부드럽게 화음을 넣어요.',
    prompt: 'small mixed vocal group, close three-part harmony, unified soft onsets, retro group feel',
    gender: 'mixed',
    // 지시문 38 (TASK D2) — lofi-study/modern-chill도 male-female-duet과
    // 같은 이유로 혼성 후보가 필요하다: 두 아키타입 모두 보컬이 전면에
    // 나서지 않는 배경음적 성격이라 "잔잔하게 화음만 얹는 작은 그룹"이
    // male-female-duet(주고받는 절)보다 실제 결에 더 맞는다.
    // 지시문 72 (TASK A) — 'en-chillhop' 추가: 'mixed' 보컬 쿼터 슬롯용.
    // "small mixed vocal group, close three-part harmony" 자체는 바닥의
    // forbiddenTraits(빈티지 크루너 발성·오페라틱 발성·시니어 라디오 톤)
    // 어디에도 해당하지 않는다 — "retro group feel" 문구를 검토했으나 이미
    // modern-chill/lofi-study(둘 다 현대적 정체성)에서도 같은 문구로 쓰이고
    // 있어 실제로는 작은 그룹 화음 배치를 뜻하지, 빈티지 발성 기법을
    // 가리키지 않는다고 판단했다.
    suitedArchetypes: ['senior-morning', 'showa-70s', 'oldpop-lounge', 'christmas', 'showa-cafe', 'lofi-study', 'modern-chill', 'en-chillhop']
  }
];

export function matchVocalPreset(vocalTone: string): VocalPreset | undefined {
  return vocalPresets.find(preset => preset.prompt === vocalTone);
}
