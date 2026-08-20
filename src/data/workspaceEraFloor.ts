import type { ChannelArchetype } from '../types';
import type { EraBucket } from './eraBuckets';

/**
 * 지시문 46 (TASK B) — 하루: "카페에서 듣고 싶은 노래처럼 주제를 선택해도
 * 기본은 60·70 세대 감성 + 카페에서 듣고 싶은 노래여야 한다." §2-2 실측:
 * 컨셉 텍스트에 시대 키워드가 없으면 core/constraints.ts's
 * extractEraConstraint가 unspecified:true를 반환하고, 그 순간 기존 시대
 * 관문(genre era-quota·era-neutral-share 상한·하한 advisory)이 전부
 * 통째로 꺼진다 — data/workspaceEraIntent.ts의 eraNeutralPolicy(상한 6/18·
 * 하한 3/18)조차 이미 정의돼 있었지만 unspecified 게이트 뒤에 있어 무의미
 * 했다. 이 파일은 "컨셉이 시대를 말하지 않을 때" 대신 채워 넣을 기본
 * 시대를 채널(아키타입) 단위로 정의한다 — core/constraints.ts's
 * applyWorkspaceEraFloor가 era.unspecified일 때만, 그리고 이 레지스트리에
 * 실린 아키타입에서만 적용한다(컨셉이 실제로 시대를 말하면 항상 그것이
 * 이긴다 — §"컨셉 시대보다 바닥을 우선하지 말 것").
 *
 * WorkspaceId가 아니라 ChannelArchetype으로 키를 잡는다 — 실제 데이터 모델
 * 확인 결과 'senior-oldpop' 하나의 WorkspaceId 아래 senior-morning·
 * showa-cafe·showa-70s·j2000s·kids·christmas·lofi-study·modern-chill·
 * city-night·oldpop-lounge 10개 아키타입이 전부 묶여 있다(data/workspaces/
 * index.ts) — 워크스페이스 단위로 바닥을 걸면 kids/city-night/modern-chill
 * 같은 "시대가 정체성이 아닌" 아키타입까지 억지로 6070/7080을 강제하게 된다.
 * 그래서 이 표는 아키타입 단위로만 채운다 — 레지스트리에 없는 아키타입
 * (kr-2030-pop/jp-2030-pop/kr-idol-male/female/kr-kids-song/jp-kids-song/christmas/
 * lofi-study/modern-chill/city-night 포함)은 바닥 없음(기존 동작 그대로).
 */
export interface WorkspaceEraFloor {
  /** 컨셉이 시대를 말하지 않을 때 적용되는 기본 시대(data/eraBuckets.ts의 세분화 EraBucket). */
  defaultEraBuckets: EraBucket[];
  /** 그 시대(들)의 최소 합산 비중 — 추정치, verified:false. */
  minShare: number;
  verified: boolean;
  reasonKo: string;
}

export const WORKSPACE_ERA_FLOOR: Partial<Record<ChannelArchetype, WorkspaceEraFloor>> = {
  'senior-morning': {
    defaultEraBuckets: ['1960s', '1970s'],
    minShare: 0.6,
    verified: false,
    reasonKo: '시니어 채널의 정체성 — 컨셉이 시대를 말하지 않아도 6070이 기본이다(하루). 15곡 기준 9곡 이상. 추정치, 첫 세트 청취 후 조정.'
  },
  'oldpop-lounge': {
    defaultEraBuckets: ['1960s', '1970s'],
    minShare: 0.6,
    verified: false,
    reasonKo: 'senior-morning과 동일한 시니어 채널 정체성. 추정치.'
  },
  'showa-cafe': {
    defaultEraBuckets: ['1970s', '1980s'],
    minShare: 0.6,
    verified: false,
    reasonKo: '쇼와 카페 채널의 정체성 시대(70s-80s). 추정치.'
  },
  'showa-70s': {
    defaultEraBuckets: ['1970s', '1980s'],
    minShare: 0.6,
    verified: false,
    reasonKo: 'showa-cafe와 동일한 쇼와 시대 정체성. 추정치.'
  },
  j2000s: {
    defaultEraBuckets: ['2000s'],
    minShare: 0.6,
    verified: false,
    reasonKo: 'J-2000s 채널의 정체성 시대. 추정치.'
  }
  // kr-2030-pop/jp-2030-pop/kr-idol-male/kr-idol-female/kr-kids-song/
  // jp-kids-song/christmas/lofi-study/modern-chill/city-night — 의도적으로
  // 비워둠. 시대가 그 워크스페이스의 정체성이 아니다(§하지 말 것).
};

export function workspaceEraFloorForArchetype(archetype: ChannelArchetype | undefined): WorkspaceEraFloor | undefined {
  return archetype ? WORKSPACE_ERA_FLOOR[archetype] : undefined;
}
