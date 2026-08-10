/**
 * 지시문 30 TASK C — killingPointSetId(문서화만 됐던 값)를 실제 배열에
 * 연결하는 단일 지점. core/localGenerator.ts의 두 assignKillingPoints 호출부
 * (v3.67 최초 생성 경로·v5.9 페르소나 재작성 경로)가 이전에는 isKidsArchetype
 * 하나만 보고 그 외 전부(kr-2030-pop·jp-2030-pop·kr-idol-male·kr-idol-female
 * 포함)를 undefined로 넘겨 assignKillingPoints의 기본 인자(KILLING_POINTS,
 * 시니어용)로 조용히 떨어뜨렸다 — 이 함수가 그 자리를 대신한다.
 *
 * 동요(kids) 분기는 건드리지 않는다 — 이미 되어 있다(§하지 말 것 "동요
 * 킬링포인트 분리를 되돌리지 말 것"). 이 함수는 kids가 아닐 때만 새 분기를
 * 추가한다.
 */
import type { ChannelArchetype } from '../types';
import type { KillingPoint } from './killingPoints';
import { KR_2030_KILLING_POINTS } from './killingPointsKr2030';
import { JP_2030_KILLING_POINTS } from './killingPointsJp2030';
import { kpopKillingPointsForGender } from './killingPointsKpop';

/**
 * undefined를 반환하면 호출부(assignKillingPoints)가 자기 기본값인 senior
 * KILLING_POINTS로 떨어진다 — senior-oldpop 계열 아키타입(및 앞으로 추가될
 * 미분류 아키타입)은 지금처럼 그대로 시니어 풀을 쓴다는 뜻이다. 이 자리에
 * 없는 아키타입을 위해 새 풀을 만들 필요가 생기면, 이 switch에 분기만
 * 추가하면 된다 — 호출부는 바뀔 필요가 없다.
 */
export function killingPointSetForNonKidsArchetype(archetype: ChannelArchetype | undefined): readonly KillingPoint[] | undefined {
  switch (archetype) {
    case 'kr-2030-pop':
      return KR_2030_KILLING_POINTS;
    case 'jp-2030-pop':
      return JP_2030_KILLING_POINTS;
    case 'kr-idol-male':
      return kpopKillingPointsForGender('male');
    case 'kr-idol-female':
      return kpopKillingPointsForGender('female');
    default:
      return undefined;
  }
}
