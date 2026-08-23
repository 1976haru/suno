import type { HookVocabularyOverride } from '../hookParts';

/**
 * 지시문 71 (TASK A) — en-chillhop workspace's own hook vocabulary bank.
 * 워크스페이스가 항상 영어 가사(defaultLyricLanguage: 'english')만 쓰므로
 * kr2030Override/jp2030Override처럼 언어별 함수가 아니라 modernChillOverride/
 * cityNightOverride와 같은 plain-constant 형태를 따른다 — 다만 그 둘과
 * 달리 실제 어휘를 채운다(비워두면 seniorMorningOverride로 조용히 떨어지는
 * 위험을 피하기 위해서다, hookBanks/index.ts의 case 자체는 명시하되).
 *
 * 칠랩·힙합·딥하우스의 나이트 시티 이미지 — 헤드폰, 스트리트라이트, 옥상,
 * 지하철, 베이스라인, 네온 등. 시니어(coffee/radio/letter/sweater/record/
 * candle)·kr-2030(earbuds/subway/office 성인 직장 이미지)와 어휘가 겹치지
 * 않도록 새로 썼다.
 */
const english: HookVocabularyOverride = {
  imperativeObjects: [
    'the Headphones', 'the Bassline', 'the Beat', 'the Rooftop', 'the Streetlight', 'the Vinyl',
    'the Skyline', 'the Subway Car', 'the Neon Sign', 'the Turntable', 'the Night Drive', 'the Afterparty'
  ],
  nounModifiers: ['Hazy', 'Restless', 'Smooth', 'Low', 'Amber', 'Late', 'Steady', 'Rolling', 'Hushed', 'Electric', 'Slow-Burning', 'Wide-Open'],
  nounObjects: [
    'Rooftop Skyline', 'Streetlight Glow', 'Subway Platform', 'Bassline Groove', 'Turntable Spin', 'Neon Reflection',
    'Back Alley', 'Night Drive', 'Corner Booth', 'Studio Speaker', 'Vinyl Crackle', 'Fire Escape'
  ],
  vocativeLeads: ['Keep It Low', 'Let It Roll', 'Ride This Out', 'Stay in the Pocket', 'Turn It Up Slow', 'Hold the Groove', 'Ease Into It', 'Take the Long Way'],
  vocativeAddressees: ['City Nights', 'Rooftop Mind', 'Late-Night Self', 'Restless Heart', 'Steady Hands', 'Open Road', 'Quiet Hour', 'Neon Glow'],
  declarativeStems: [
    "I'm Riding Out", "I'm Sliding Into", 'I Keep Chasing', 'I Slowly Build',
    'I Quietly Own', 'I Still Ride for', "I'm Settling Into", 'I Still Move to'
  ]
};

export const enChillhopOverride: HookVocabularyOverride = english;
