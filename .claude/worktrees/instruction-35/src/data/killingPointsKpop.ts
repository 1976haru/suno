/**
 * 지시문 30 TASK C — kr-idol-male/kr-idol-female 두 워크스페이스의 실제
 * 킬링포인트 풀. 이전에는 killingPointSetId만
 * ('kr-idol-male-default'/'kr-idol-female-default') 다르고 실제 배열은
 * senior KILLING_POINTS를 그대로 공유해, K-pop 세트에도
 * `final chorus octave lift`·key-up 같은 올드팝 장치가 배정되고 있었다.
 *
 * §C-4가 명시한 K-pop 성격 — 포스트코러스 챈트 · 랩 브릿지 진입 ·
 * 비트 스위치 · 댄스 브레이크 · 파트 교대 전환. §C-4 "NO_CHORUS 계열 장치
 * 금지 — 지시문 15와 동일"과 겹치지 않는다: 그 규칙은
 * data/distinctChoicePolicy.ts의 SetPlan 전체 구조 희소성 장치(후렴 자체를
 * 아예 제거)를 막는 것이고, 여기 5종은 후렴을 보존한 채 붙는 국소 강조
 * 장치라 애초에 충돌 대상이 아니다.
 *
 * 남/여 분기 — §C-4 "남/여 공용 + 성별 전용 분기"의 "분기"는 구조로만
 * 존재한다(kpopKillingPointsForGender). 실제 내용을 성별로 다르게 만들지는
 * 않았다 — data/audienceProfiles.ts의 KR_IDOL_MALE_AUDIENCE_PROFILE/
 * KR_IDOL_FEMALE_AUDIENCE_PROFILE 자신이 이미 "idol energy/tempo/structure는
 * 워크스페이스-장르 특성이지 성별 특성이 아니다, 성별 보컬 음역 차이는 아직
 * 만들지 않은 별도 레이어(idolExpressionLint)의 몫"이라고 명시적으로
 * 판단해뒀다 — 그 판단을 뒤집을 실측 근거가 이 세션에는 없다. 함수 자체는
 * 남겨둔다 — 실제 성별 차이가 실측되면 그때 이 함수 안에서만 분기를 채우면
 * 되고, 호출부(localGenerator.ts)는 바뀔 필요가 없다.
 *
 * §C-4 "성별 쿼터를 깨지 않는다(vocalQuotaOverride)" — 아래 5종 중 어느
 * descriptor도 보컬 타입/성별을 지정하지 않는다(예: "male vocal takes
 * over" 같은 표현 없음) — ChannelProfile.vocalQuotaOverride가 이미 고정한
 * male/female/mixed 비율과 절대 충돌하지 않도록 순수 편곡/구조 장치만
 * 담았다.
 *
 * verified: false — 실측 0세트. seniorKillingPoints(data/killingPoints.ts)는
 * 건드리지 않는다.
 */
import type { KillingPoint } from './killingPoints';

export const KPOP_KILLING_POINTS: KillingPoint[] = [
  {
    id: 'KP-KPOP-01',
    labelKo: '포스트코러스 챈트',
    descriptor: 'a short group chant tag right after the chorus',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-KPOP-02',
    labelKo: '랩 브릿지 진입',
    descriptor: 'the bridge shifts into a rap-delivery section',
    placement: 'bridge',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-KPOP-03',
    labelKo: '비트 스위치',
    descriptor: 'the beat pattern switches for the second half',
    placement: 'mid-instrumental',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-KPOP-04',
    labelKo: '댄스 브레이크',
    descriptor: 'a wordless instrumental break built for a choreography moment',
    placement: 'mid-instrumental',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-KPOP-05',
    labelKo: '파트 교대 전환',
    descriptor: 'a quick handoff between vocal parts into the last chorus',
    placement: 'pre-chorus',
    relaxes: [],
    verified: false
  }
];

/**
 * §C-4 "남/여 공용 + 성별 전용 분기"의 분기 지점 — 이 세션에는 실제로 남/여를
 * 다르게 만들 실측 근거가 없어 둘 다 KPOP_KILLING_POINTS 전체를 그대로
 * 반환한다(위 doc comment 참고). 호출부(localGenerator.ts)가 이미
 * gender-aware 형태로 부르도록 배선해 두면, 나중에 실제 성별 차이가
 * 실측됐을 때 이 함수 내부만 고치면 된다.
 */
export function kpopKillingPointsForGender(_gender?: 'male' | 'female'): KillingPoint[] {
  return KPOP_KILLING_POINTS;
}
