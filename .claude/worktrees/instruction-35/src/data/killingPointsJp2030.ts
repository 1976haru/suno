/**
 * 지시문 30 TASK C — jp-2030 워크스페이스(멜로딕/애니송 두 오디언스
 * 프로파일 모두)의 실제 킬링포인트 풀. data/killingPointsKr2030.ts와 같은
 * 결함·같은 수정이다 — 그 파일의 자기 doc comment 참고. §C-4가 "kr-2030 ·
 * jp-2030"을 같은 성격으로 묶었기 때문에 디바이스 개념은 그 파일과
 * 동일하다(프리코러스 열림 · 포스트코러스 훅 · 브레이크다운 후 재진입 ·
 * 드롭 직전 정지 · 보컬 레이어 추가, 옥타브 상승·전조 배제) — 파일을 분리한
 * 이유는 jp-2030이 kr-2030과 다른 killingPointSetId(jp-2030-melodic-default/
 * jp-2030-anime-default)를 가져야 하고, "실제 배열"도 그만큼 분리돼 있어야
 * §C-3의 "ID만 다르고 배열은 공유" 결함을 재현하지 않기 때문이다.
 *
 * verified: false — 실측 0세트. seniorKillingPoints(data/killingPoints.ts)는
 * 건드리지 않는다.
 */
import type { KillingPoint } from './killingPoints';

export const JP_2030_KILLING_POINTS: KillingPoint[] = [
  {
    id: 'KP-JP2030-01',
    labelKo: '프리코러스 열림',
    descriptor: 'pre-chorus opens up and lifts into the hook',
    placement: 'pre-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-02',
    labelKo: '포스트코러스 훅',
    descriptor: 'short vocal hook tag right after the chorus',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-03',
    labelKo: '브레이크다운 후 재진입',
    descriptor: 'arrangement thins out then re-enters full for the last chorus',
    placement: 'bridge',
    relaxes: ['abrupt dynamic jumps'],
    verified: false
  },
  {
    id: 'KP-JP2030-04',
    labelKo: '드롭 직전 정지',
    descriptor: 'a brief full stop right before the beat drops back in',
    placement: 'mid-instrumental',
    relaxes: ['abrupt dynamic jumps'],
    verified: false
  },
  {
    id: 'KP-JP2030-05',
    labelKo: '보컬 레이어 추가',
    descriptor: 'a second vocal layer stacks in on the final chorus',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  }
];
