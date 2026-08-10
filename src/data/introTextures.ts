import type { ChannelArchetype } from '../types';

export interface IntroTexture {
  id: string;
  labelKo: string;
  labelEn: string;
  tag: string;
  suitedArchetypes?: ChannelArchetype[];
}

// 지시문 28 (TASK A) — check:coverage 실측: oldpop-lounge/kr-2030-pop/
// jp-2030-pop/kr-idol-male/kr-idol-female 5개 아키타입이 introTextures 원본
// 매칭 0개였다 — introTexturesForArchetype의 "10개 미만이면 전체 풀로 폴백"
// 방어 로직 때문에 겉으로는 항상 10개 이상이 나와 드러나지 않았을 뿐, 실제로는
// 이 5개 모두 아키타입 전용 텍스처가 하나도 없었다. 아래 3개(oldpop-lounge/
// kr-2030-pop/jp-2030-pop)는 근거 있는 태그를 추가해 채운다:
//   oldpop-lounge — senior-morning과 같은 1950~60년대 팝 라운지 청각적
//     세계(모타운/두왑 인접)이므로 senior-morning이 이미 태그된 항목과
//     동일 집합에 추가했다.
//   kr-2030-pop/jp-2030-pop — audienceProfile(kr-2030-emotional/
//     jp-2030-melodic)의 constraints("contemporary ... band-pop/R&B",
//     "clean modern mix")가 j2000s/modern-chill/city-night와 같은 현대
//     프로덕션 성격이라 j2000s가 이미 태그된 항목과 동일 집합에 추가했다.
// kr-idol-male/kr-idol-female은 의도적으로 비워둔다 — 이 풀 24종은 전부
// 어쿠스틱·빈티지·앰비언트 성격이고, 아이돌 오디언스 프로필이 요구하는
// "punchy contemporary production built for choreography, high-energy
// performance-ready mix"에 근거 있게 맞는 항목이 하나도 없다. 없는 근거를
// 지어내 태그를 붙이느니 결함으로 정직하게 남긴다(§하지 말 것 "빈칸을
// 임의값으로 채워 ✗를 없애지 말 것") — 아이돌 전용 인트로 텍스처 콘텐츠를
// 새로 설계하는 것은 데이터 배선이 아니라 창작 작업이라 이 지시문 범위 밖.
// 전부 verified: false(청취 미검증) — 아래 태그는 장르 관습 기반 추정이다.
export const introTextures: IntroTexture[] = [
  {
    id: 'ag_finger',
    labelKo: '손가락 핑거링',
    labelEn: 'Fingerpicking',
    tag: 'fingerpicked acoustic guitar intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'kids', 'showa-70s', 'oldpop-lounge']
  },
  {
    id: 'ag_harmonics',
    labelKo: '하모닉스 반짝임',
    labelEn: 'Harmonic chimes',
    tag: 'soft acoustic guitar harmonics intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge']
  },
  {
    id: 'ag_muted_strum',
    labelKo: '뮤트 스트럼',
    labelEn: 'Muted strum',
    tag: 'muted acoustic strum intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'kids', 'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop']
  },
  {
    id: 'ag_nylon_waltz',
    labelKo: '나일론 왈츠',
    labelEn: 'Nylon waltz',
    tag: 'nylon-string acoustic waltz intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-70s', 'oldpop-lounge']
  },
  {
    id: 'eg_jazz_comp',
    labelKo: '재즈 컴핑',
    labelEn: 'Jazz comping',
    tag: 'clean jazz guitar comping intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'showa-70s']
  },
  {
    id: 'eg_tremolo',
    labelKo: '트레몰로 기타',
    labelEn: 'Tremolo guitar',
    tag: 'gentle tremolo electric guitar intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'showa-70s', 'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop']
  },
  {
    id: 'eg_clean_arp',
    labelKo: '클린 아르페지오',
    labelEn: 'Clean arpeggio',
    tag: 'clean electric guitar arpeggio intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'showa-70s', 'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop']
  },
  {
    id: 'eg_slide_swell',
    labelKo: '슬라이드 스웰',
    labelEn: 'Slide swell',
    tag: 'soft slide-guitar swell intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'showa-70s', 'oldpop-lounge']
  },
  {
    id: 'ep_rhodes_riff',
    labelKo: '로즈 리프',
    labelEn: 'Rhodes riff',
    tag: 'warm Rhodes riff intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'showa-70s', 'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop']
  },
  {
    id: 'ep_wurli_chop',
    labelKo: '월리처 찹',
    labelEn: 'Wurlitzer chop',
    tag: 'soft Wurlitzer chord chop intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'showa-70s']
  },
  {
    id: 'ep_glass_chords',
    labelKo: '유리빛 코드',
    labelEn: 'Glass chords',
    tag: 'glassy electric piano chord intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'kids', 'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop']
  },
  {
    id: 'ep_vintage_trem',
    labelKo: '빈티지 트레몰로',
    labelEn: 'Vintage tremolo',
    tag: 'vintage electric piano tremolo intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'showa-70s']
  },
  {
    id: 'str_pizz',
    labelKo: '피치카토',
    labelEn: 'Pizzicato strings',
    tag: 'light pizzicato strings intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'kids', 'showa-cafe', 'showa-70s', 'oldpop-lounge']
  },
  {
    id: 'str_warm_pad',
    labelKo: '따뜻한 스트링 패드',
    labelEn: 'Warm string pad',
    tag: 'warm string pad swell intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-cafe', 'showa-70s', 'j2000s', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop']
  },
  {
    id: 'str_counterline',
    labelKo: '카운터라인',
    labelEn: 'Counterline',
    tag: 'short melodic string counterline intro texture (INTRO ONLY)',
    suitedArchetypes: ['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge']
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
    suitedArchetypes: ['showa-cafe', 'showa-70s']
  },
  {
    id: 'br_soft_stabs',
    labelKo: '부드러운 브라스 스탭',
    labelEn: 'Soft brass stabs',
    tag: 'soft brass stabs intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'kids', 'showa-70s', 'j2000s', 'city-night']
  },
  {
    id: 'br_trombone_swell',
    labelKo: '트롬본 스웰',
    labelEn: 'Trombone swell',
    tag: 'rounded trombone swell intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'senior-morning', 'showa-70s', 'oldpop-lounge']
  },
  {
    id: 'br_quartet_fall',
    labelKo: '브라스 폴',
    labelEn: 'Brass fall',
    tag: 'small brass fall-off intro texture (INTRO ONLY)',
    suitedArchetypes: ['showa-cafe', 'showa-70s']
  },
  {
    id: 'syn_bright_pluck',
    labelKo: '밝은 신스 플럭',
    labelEn: 'Bright synth pluck',
    tag: 'bright synth pluck intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'lofi-study', 'j2000s', 'modern-chill', 'city-night']
  },
  {
    id: 'syn_soft_arp',
    labelKo: '부드러운 신스 아르페지오',
    labelEn: 'Soft synth arpeggio',
    tag: 'soft synth arpeggio intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'lofi-study', 'showa-cafe', 'j2000s', 'modern-chill', 'city-night']
  },
  {
    id: 'syn_bell_glock',
    labelKo: '글로켄 벨',
    labelEn: 'Glockenspiel bell',
    tag: 'glockenspiel-like bell synth intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'j2000s', 'modern-chill']
  },
  {
    id: 'syn_chime_steps',
    labelKo: '차임 계단',
    labelEn: 'Chime steps',
    tag: 'small chime-step synth intro texture (INTRO ONLY)',
    suitedArchetypes: ['kids', 'lofi-study', 'j2000s', 'modern-chill', 'city-night']
  }
];

export function getIntroTextureById(id: string | undefined): IntroTexture | undefined {
  return introTextures.find(texture => texture.id === id);
}

export function introTexturesForArchetype(archetype: ChannelArchetype | undefined): IntroTexture[] {
  const suited = introTextures.filter(texture => !archetype || texture.suitedArchetypes?.includes(archetype));
  return suited.length >= 10 ? suited : introTextures;
}
