export interface VocalPreset {
  id: string;
  label: string;
  sublabel: string;
  description: string;
  prompt: string;
}

export const vocalPresets: VocalPreset[] = [
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
