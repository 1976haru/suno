import type { ChannelArchetype } from '../types';

export interface IntroTexture {
  id: string;
  labelKo: string;
  labelEn: string;
  tag: string;
  suitedArchetypes?: ChannelArchetype[];
}

export const introTextures: IntroTexture[] = [
  {
    id: 'ag_finger',
    labelKo: '손가락 핑거링',
    labelEn: 'Fingerpicking',
    tag: 'fingerpicked acoustic guitar intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'kids']
  },
  {
    id: 'ag_harmonics',
    labelKo: '하모닉스 반짝임',
    labelEn: 'Harmonic chimes',
    tag: 'soft acoustic guitar harmonics intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-cafe']
  },
  {
    id: 'ag_muted_strum',
    labelKo: '뮤트 스트럼',
    labelEn: 'Muted strum',
    tag: 'muted acoustic strum intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'kids']
  },
  {
    id: 'ag_nylon_waltz',
    labelKo: '나일론 왈츠',
    labelEn: 'Nylon waltz',
    tag: 'nylon-string acoustic waltz intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'eg_jazz_comp',
    labelKo: '재즈 컴핑',
    labelEn: 'Jazz comping',
    tag: 'clean jazz guitar comping intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'eg_tremolo',
    labelKo: '트레몰로 기타',
    labelEn: 'Tremolo guitar',
    tag: 'gentle tremolo electric guitar intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning']
  },
  {
    id: 'eg_clean_arp',
    labelKo: '클린 아르페지오',
    labelEn: 'Clean arpeggio',
    tag: 'clean electric guitar arpeggio intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning']
  },
  {
    id: 'eg_slide_swell',
    labelKo: '슬라이드 스웰',
    labelEn: 'Slide swell',
    tag: 'soft slide-guitar swell intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning']
  },
  {
    id: 'ep_rhodes_riff',
    labelKo: '로즈 리프',
    labelEn: 'Rhodes riff',
    tag: 'warm Rhodes electric piano riff intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning']
  },
  {
    id: 'ep_wurli_chop',
    labelKo: '월리처 찹',
    labelEn: 'Wurlitzer chop',
    tag: 'soft Wurlitzer chord chop intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'ep_glass_chords',
    labelKo: '유리빛 코드',
    labelEn: 'Glass chords',
    tag: 'glassy electric piano chord intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'kids']
  },
  {
    id: 'ep_vintage_trem',
    labelKo: '빈티지 트레몰로',
    labelEn: 'Vintage tremolo',
    tag: 'vintage electric piano tremolo intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'str_pizz',
    labelKo: '피치카토',
    labelEn: 'Pizzicato strings',
    tag: 'light pizzicato strings intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'kids', 'showa-cafe']
  },
  {
    id: 'str_warm_pad',
    labelKo: '따뜻한 스트링 패드',
    labelEn: 'Warm string pad',
    tag: 'warm string pad swell intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-cafe']
  },
  {
    id: 'str_counterline',
    labelKo: '카운터라인',
    labelEn: 'Counterline',
    tag: 'short melodic string counterline intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-cafe']
  },
  {
    id: 'str_spiccato',
    labelKo: '스피카토',
    labelEn: 'Spiccato strings',
    tag: 'bouncy spiccato strings intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'senior-morning']
  },
  {
    id: 'br_muted_trumpet',
    labelKo: '뮤트 트럼펫',
    labelEn: 'Muted trumpet',
    tag: 'muted trumpet answering phrase intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'br_soft_stabs',
    labelKo: '부드러운 브라스 스탭',
    labelEn: 'Soft brass stabs',
    tag: 'soft brass stabs intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'kids']
  },
  {
    id: 'br_trombone_swell',
    labelKo: '트롬본 스웰',
    labelEn: 'Trombone swell',
    tag: 'rounded trombone swell intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning']
  },
  {
    id: 'br_quartet_fall',
    labelKo: '브라스 폴',
    labelEn: 'Brass fall',
    tag: 'small brass fall-off intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'syn_bright_pluck',
    labelKo: '밝은 신스 플럭',
    labelEn: 'Bright synth pluck',
    tag: 'bright synth pluck intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'lofi-study']
  },
  {
    id: 'syn_soft_arp',
    labelKo: '부드러운 신스 아르페지오',
    labelEn: 'Soft synth arpeggio',
    tag: 'soft synth arpeggio intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'lofi-study', 'showa-cafe']
  },
  {
    id: 'syn_bell_glock',
    labelKo: '글로켄 벨',
    labelEn: 'Glockenspiel bell',
    tag: 'glockenspiel-like bell synth intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids']
  },
  {
    id: 'syn_chime_steps',
    labelKo: '차임 계단',
    labelEn: 'Chime steps',
    tag: 'small chime-step synth intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'lofi-study']
  }
];

export function getIntroTextureById(id: string | undefined): IntroTexture | undefined {
  return introTextures.find(texture => texture.id === id);
}

export function introTexturesForArchetype(archetype: ChannelArchetype | undefined): IntroTexture[] {
  const suited = introTextures.filter(texture => !archetype || texture.suitedArchetypes?.includes(archetype));
  return suited.length >= 10 ? suited : introTextures;
}
