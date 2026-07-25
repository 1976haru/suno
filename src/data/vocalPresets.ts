export interface VocalPreset {
  id: string;
  label: string;
  sublabel: string;
  description: string;
  prompt: string;
  /** TASK v3.39 Part D — true for the kids-channel childlike presets below; Step2Concept.tsx shows only these for a 'kids' archetype channel (and only the plain adult presets otherwise), instead of mixing an adult voice picker into a children's channel. */
  forKids?: boolean;
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
    forKids: true
  },
  {
    id: 'kid-girl',
    label: '여자아이',
    sublabel: 'Young girl',
    description: '맑고 다정한 아이 목소리예요.',
    prompt: 'bright childlike girl voice, sweet and clear, kindergarten-age tone',
    forKids: true
  },
  {
    id: 'kid-choir',
    label: '아이 합창',
    sublabel: 'Kids choir',
    description: '다 함께 부르는 동요 합창이에요.',
    prompt: "children's choir of childlike, youthful voices singing together, cheerful call-and-response group singalong",
    forKids: true
  },
  {
    id: 'warm-mature-male',
    label: '따뜻한 중년 남성',
    sublabel: 'Warm mature male',
    description: '추억 라디오 DJ 같은 편안한 목소리예요.',
    prompt: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere'
  },
  {
    id: 'soft-female',
    label: '부드러운 여성',
    sublabel: 'Soft female',
    description: '찻집에서 흐르는 잔잔한 목소리예요.',
    prompt: 'soft warm female alto, gentle breathy delivery, intimate and calm'
  },
  {
    id: 'low-calm-male',
    label: '낮고 차분한 남성',
    sublabel: 'Low calm male',
    description: '늦은 밤 어울리는 깊은 목소리예요.',
    prompt: 'low calm male baritone, restrained emotional delivery, warm late-night tone'
  },
  {
    id: 'clear-light-male',
    label: '맑고 담백한 남성',
    sublabel: 'Clear light male',
    description: '깨끗하고 편안하게 들리는 목소리예요.',
    prompt: 'clear light male tenor, clean simple delivery, youthful and sincere'
  },
  {
    id: 'mature-female',
    label: '성숙한 여성',
    sublabel: 'Mature female',
    description: '우아하고 안정적인 목소리예요.',
    prompt: 'mature elegant female mezzo-soprano, warm restrained delivery, sophisticated tone'
  }
];

export function matchVocalPreset(vocalTone: string): VocalPreset | undefined {
  return vocalPresets.find(preset => preset.prompt === vocalTone);
}
