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
  },
  // 지시문 62 (TASK D-2①) — "jp-2030 5 → 12개 이상". kr-2030과 같은 성격
  // 공유(§C-4 원 판단, killingPointsKr2030.ts 자기 doc comment)라 같은
  // 7종을 그대로 추가한다 — 파일을 분리한 이유(§C-3 서로 다른
  // killingPointSetId)는 그대로 유지된다.
  {
    id: 'KP-JP2030-06',
    labelKo: '백킹보컬 애드립 콜백',
    descriptor: 'backing vocal ad-lib answers the hook',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-07',
    labelKo: '신스 필터 스윕',
    descriptor: 'rising synth filter sweep into the chorus',
    placement: 'pre-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-08',
    labelKo: '드럼 씬닝 — 킥만 두 마디',
    descriptor: 'drums thin to just the kick for two bars',
    placement: 'bridge',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-09',
    labelKo: '하프타임 필 전환',
    descriptor: 'the groove shifts into a half-time feel for the bridge',
    placement: 'bridge',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-10',
    labelKo: '보컬 초프 스터터',
    descriptor: 'a stuttered vocal chop punctuates the pre-chorus',
    placement: 'pre-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-11',
    labelKo: '아르페지오 신스 빌드업',
    descriptor: 'rising synth arpeggio builds into the final chorus',
    placement: 'pre-chorus',
    relaxes: [],
    verified: false
  },
  {
    id: 'KP-JP2030-12',
    labelKo: '사이드체인 펌핑 강조',
    descriptor: 'sidechain pump under the final chorus',
    placement: 'final-chorus',
    relaxes: [],
    verified: false
  }
];
