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
  {
    id: 'warm-mature-male',
    label: '따뜻한 중년 남성',
    sublabel: 'Warm mature male',
    description: '추억 라디오 DJ 같은 편안한 목소리예요.',
    prompt: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    gender: 'male',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'low-calm-male',
    label: '낮고 차분한 남성',
    sublabel: 'Low calm male',
    description: '늦은 밤 어울리는 깊은 목소리예요.',
    prompt: 'low calm male baritone, restrained emotional delivery, warm late-night tone',
    gender: 'male'
  },
  {
    id: 'clear-light-male',
    label: '맑고 담백한 남성',
    sublabel: 'Clear light male',
    description: '깨끗하고 편안하게 들리는 목소리예요.',
    prompt: 'clear light male tenor, clean simple delivery, youthful and sincere',
    gender: 'male'
  },
  {
    id: 'airy-falsetto-male',
    label: '에어리 팔세토 남성',
    sublabel: 'Airy falsetto male',
    description: '시티팝에 어울리는 부드러운 가성이에요.',
    prompt: 'soft male falsetto, airy head voice, smooth city-pop phrasing, light and floating',
    gender: 'male',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'smoky-jazz-male',
    label: '스모키 재즈 남성',
    sublabel: 'Smoky jazz male',
    description: '재즈 라운지 분위기의 허스키한 목소리예요.',
    prompt: 'smoky male baritone, relaxed jazz phrasing, lounge microphone warmth, slight rasp',
    gender: 'male',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'bright-young-male',
    label: '밝은 청년 남성',
    sublabel: 'Bright young male',
    description: '산뜻하고 젊은 느낌의 목소리예요.',
    prompt: 'bright young male voice, clean modern pop delivery, fresh and open tone',
    gender: 'male'
  },
  {
    id: 'whisper-male',
    label: '속삭이는 남성',
    sublabel: 'Whisper male',
    description: '수면·집중 콘텐츠에 어울리는 낮은 속삭임이에요.',
    prompt: 'soft male voice just above a whisper, intimate close-mic breath, very gentle and slow',
    gender: 'male',
    suitedArchetypes: ['lofi-study']
  },
  {
    id: 'soft-female',
    label: '부드러운 여성',
    sublabel: 'Soft female',
    description: '찻집에서 흐르는 잔잔한 목소리예요.',
    prompt: 'soft warm female alto, gentle breathy delivery, intimate and calm',
    gender: 'female',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'mature-female',
    label: '성숙한 여성',
    sublabel: 'Mature female',
    description: '우아하고 안정적인 목소리예요.',
    prompt: 'mature elegant female mezzo-soprano, warm restrained delivery, sophisticated tone',
    gender: 'female'
  },
  {
    id: 'bright-clear-female',
    label: '맑고 밝은 여성',
    sublabel: 'Bright clear female',
    description: '종소리처럼 또렷하고 밝은 목소리예요.',
    prompt: 'bright clear female soprano, bell-like clarity, light and uplifting delivery',
    gender: 'female'
  },
  {
    id: 'husky-jazz-female',
    label: '허스키 재즈 여성',
    sublabel: 'Husky jazz female',
    description: '쇼와 카페·시티팝에 어울리는 음색이에요.',
    prompt: 'husky female alto, smoky jazz phrasing, laid-back swing feel, warm lower register',
    gender: 'female',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'airy-whisper-female',
    label: '속삭이는 여성',
    sublabel: 'Airy whisper female',
    description: '수면·휴식 콘텐츠용 에어리한 목소리예요.',
    prompt: 'soft female voice just above a whisper, airy breath tone, slow intimate delivery',
    gender: 'female',
    suitedArchetypes: ['lofi-study']
  },
  {
    id: 'bright-young-female',
    label: '밝은 청년 여성',
    sublabel: 'Bright young female',
    description: '산뜻하고 젊은 느낌의 목소리예요.',
    prompt: 'bright young female voice, clean modern pop delivery, fresh and open tone',
    gender: 'female'
  },
  {
    id: 'soulful-female',
    label: '소울풀 여성',
    sublabel: 'Soulful female',
    description: '감정을 실어 부르는 따뜻한 목소리예요.',
    prompt: 'soulful female voice, warm gospel-tinged phrasing, expressive but controlled runs',
    gender: 'female',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'male-female-duet',
    label: '남녀 듀엣',
    sublabel: 'Male-female duet',
    description: '절을 주고받고 후렴에서 화음을 쌓아요.',
    prompt: 'male and female duet, alternating verses, close harmony on the chorus, warm blended tone',
    gender: 'duet',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'mixed-harmony-group',
    label: '혼성 화음 그룹',
    sublabel: 'Mixed harmony group',
    description: '작은 그룹이 부드럽게 화음을 넣어요.',
    prompt: 'small mixed vocal group, close three-part harmony, soft blended backing, retro group feel',
    gender: 'mixed'
  }
];

export function matchVocalPreset(vocalTone: string): VocalPreset | undefined {
  return vocalPresets.find(preset => preset.prompt === vocalTone);
}
