/**
 * 지시문 30 TASK C — kr-2030 워크스페이스(감성/일렉트로 두 오디언스 프로파일
 * 모두)의 실제 킬링포인트 풀. 이전에는 killingPointSetId
 * ('kr-2030-emotional-default'/'kr-2030-electro-default')만 문서화돼 있고
 * assignKillingPoints()의 기본 인자가 항상 senior KILLING_POINTS로 떨어져,
 * kr-2030 세트에도 시니어용 장치(반음 전조·key-up 등)가 배정되고 있었다
 * (core/verifiedSettingContract.ts:81/92가 스스로 인정한 갭).
 *
 * 여기 5종은 §C-4가 명시한 "kr-2030 · jp-2030" 공통 성격
 * (프리코러스 열림 · 포스트코러스 훅 · 브레이크다운 후 재진입 · 드롭 직전
 * 정지 · 보컬 레이어 추가) — 2020년대 팝 관행에 근거한 판단이며, 옥타브
 * 상승·전조는 의도적으로 배제했다(§C-4 "옥타브 상승·전조는 최소화. 2020년대
 * 팝에서는 흔치 않다"). data/killingPointsJp2030.ts와 디바이스 개념은
 * 동일하다 — 두 워크스페이스가 같은 "성격"을 공유한다는 §C-4 자체의 판단을
 * 반영한 것이지 실수로 중복 생성한 게 아니다. 파일을 분리한 이유는 두
 * 워크스페이스가 서로 다른 killingPointSetId(따라서 서로 다른 실제 배열)를
 * 가져야 한다는 §C-3의 요구 때문 — ID/라벨만 워크스페이스별로 다르고
 * "실제 배열은 공유"하는 지금까지의 결함 패턴을 그대로 반복하지 않기
 * 위함이다.
 *
 * verified: false 로 시작한다 — 실측 0세트(§C-4 "비시니어 워크스페이스는
 * 실측 0세트다"). seniorKillingPoints(data/killingPoints.ts)는 건드리지
 * 않는다.
 */
import type { KillingPoint } from './killingPoints';

export const KR_2030_KILLING_POINTS: KillingPoint[] = [
  {
    id: 'KP-KR2030-01',
    labelKo: '프리코러스 열림',
    descriptor: 'pre-chorus opens up and lifts into the hook',
    placement: 'pre-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-KR2030-02',
    labelKo: '포스트코러스 훅',
    descriptor: 'short vocal hook tag right after the chorus',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-KR2030-03',
    labelKo: '브레이크다운 후 재진입',
    descriptor: 'arrangement thins out then re-enters full for the last chorus',
    placement: 'bridge',
    relaxes: ['abrupt dynamic jumps'],
    verified: false
  },
  {
    id: 'KP-KR2030-04',
    labelKo: '드롭 직전 정지',
    descriptor: 'a brief full stop right before the beat drops back in',
    placement: 'mid-instrumental',
    relaxes: ['abrupt dynamic jumps'],
    verified: false
  },
  {
    id: 'KP-KR2030-05',
    labelKo: '보컬 레이어 추가',
    descriptor: 'a second vocal layer stacks in on the final chorus',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  }
];
