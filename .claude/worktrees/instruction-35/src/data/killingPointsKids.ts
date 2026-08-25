/**
 * TASK D2 §4 — a completely separate killing-point set for kids content.
 * §0-2 measured all 12 senior KILLING_POINTS being assigned to kids songs
 * (15/18 in this session's own re-measurement), directly contradicting the
 * age-tier instrument constraints D1 recorded ("타악 과다 금지 / 급격한
 * 다이내믹 금지 / 고음 자극 금지"). §4-1 judged each of the 12 senior
 * entries individually (kept verbatim below); §4-2 adds new kid-safe
 * "fun moments" the research material calls out as the actual draw of
 * children's music (call-and-response, sound imitation, counting, name
 * insertion). Per §4-5, none of this touches KILLING_POINTS — kids
 * workspaces draw from KIDS_KILLING_POINTS via assignKillingPoints()'s
 * new optional 4th argument instead.
 */
import type { KillingPoint } from './killingPoints';
import type { KidsAgeTierId } from './kidsVocabularyWhitelist';

export const KP_SET_KIDS_ID = 'KP-SET-kids';

const ALL_KIDS_TIERS: KidsAgeTierId[] = ['kids-t1', 'kids-t2', 'kids-t3'];

/**
 * §4-1 judgment table — reused 4 of the senior 12:
 *   KP-02 하모니 3성 스택   → 완화: 3성 하모니 대신 유니즌 + 1성
 *   KP-06 무반주 2마디      → 그대로: 콜앤리스폰스 응답 자리로 적합
 *   KP-08 무반주 훅 반복    → 그대로: 이미 little-singalong-radio에서 잘 동작 중 (§0-2[6])
 *   KP-11 유니즌 재진입     → 그대로: "다같이" 구조로 자연스러움
 * The other 8 (KP-01/03/04/05/07/09/10/12) are excluded — see §4-1's table
 * for each one's specific reason (semitone lift/8-bar solo/hard stop/long
 * tone/minor key/low register/borrowed chord/obbligato all conflict with
 * the 3 forbidden-trait categories or a small child's own vocal range).
 */
export const KIDS_KILLING_POINTS: KillingPoint[] = [
  {
    id: 'KKP-02',
    labelKo: '하모니 완화 — 유니즌 제창',
    descriptor: 'unison group vocal on the last chorus, no harmony stack',
    placement: 'final-chorus',
    relaxes: [],
    eligibleKidsTiers: ['kids-t2', 'kids-t3']
  },
  {
    id: 'KKP-06',
    labelKo: '무반주 2마디 — 응답 자리',
    descriptor: 'two unaccompanied bars for the children to answer',
    placement: 'call-response',
    relaxes: [],
    eligibleKidsTiers: ALL_KIDS_TIERS
  },
  {
    id: 'KKP-08',
    labelKo: '무반주 훅 반복',
    descriptor: 'final repeat of the hook sung almost a cappella as the outro tag',
    placement: 'outro',
    relaxes: [],
    eligibleKidsTiers: ALL_KIDS_TIERS
  },
  {
    id: 'KKP-11',
    labelKo: '다같이 유니즌 재진입',
    descriptor: 'everyone joins in together on the final hook',
    placement: 'final-chorus',
    relaxes: [],
    eligibleKidsTiers: ALL_KIDS_TIERS
  },
  // §4-2 신설 — 전 항목 "급격하지 않게": 박수는 2회로 짧게, 다이내믹은 무반주
  // 전환뿐(볼륨 급증 없음), 음역은 요구하지 않음(의성어/숫자는 대사조로도 가능).
  {
    id: 'KKP-CLAP',
    labelKo: '손뼉 브레이크 (짧게, 2회)',
    descriptor: 'two light claps right before the chorus, nothing more',
    placement: 'pre-chorus',
    relaxes: [],
    eligibleKidsTiers: ['kids-t2', 'kids-t3']
  },
  {
    id: 'KKP-QA',
    labelKo: '질문-응답 (예: "무슨 색일까요?" → "빨강!")',
    descriptor: 'a short spoken question answered by the children in one word',
    placement: 'call-response',
    relaxes: [],
    eligibleKidsTiers: ['kids-t2', 'kids-t3']
  },
  {
    id: 'KKP-SOUND',
    labelKo: '동물·탈것 소리 흉내 (멍멍 / ぶーぶー / がたんごとん)',
    descriptor: 'a playful animal or vehicle sound imitation, spoken not sung loud',
    placement: 'call-response',
    relaxes: [],
    eligibleKidsTiers: ALL_KIDS_TIERS
  },
  {
    id: 'KKP-COUNT',
    labelKo: '숫자 세기 구간 (하나 둘 셋 / いち に さん)',
    descriptor: 'a short counting sequence chanted together',
    placement: 'call-response',
    relaxes: [],
    eligibleKidsTiers: ['kids-t2', 'kids-t3']
  },
  {
    id: 'KKP-NAME',
    labelKo: '이름 부르기 자리',
    descriptor: "a spot in the lyric where the child's own name can be sung in",
    placement: 'bridge',
    relaxes: [],
    eligibleKidsTiers: ['kids-t3']
  },
  {
    id: 'KKP-TEMPO',
    labelKo: '살짝 느려졌다 빨라짐 (급격하지 않게 — 기준 BPM ±10% 이내, 한 곡 1회, T1 적용 금지)',
    descriptor: 'a gentle, brief tempo lift into the final chorus, never abrupt',
    placement: 'pre-chorus',
    relaxes: [],
    eligibleKidsTiers: ['kids-t2', 'kids-t3']
  },
  {
    id: 'KKP-VOICES',
    labelKo: '다같이 큰 소리 (볼륨이 아니라 인원이 늘어나는 느낌)',
    descriptor: 'more voices join in, not more volume, on the final hook',
    placement: 'final-chorus',
    relaxes: [],
    eligibleKidsTiers: ['kids-t2', 'kids-t3']
  }
];

/**
 * TASK D2 §4-4 — per-tier eligibility filter (data only; nothing in the
 * generation pipeline currently threads an ageTier through to this point —
 * see §5's identical "ageTier 없을 때 기본값" boundary. Omitting tierId
 * returns the full set, which is what today's 3 real call sites use since
 * they only know `archetype`, not a specific age tier).
 */
export function kidsKillingPointsForTier(tierId?: KidsAgeTierId): KillingPoint[] {
  if (!tierId) return KIDS_KILLING_POINTS;
  return KIDS_KILLING_POINTS.filter(kp => kp.eligibleKidsTiers?.includes(tierId));
}
