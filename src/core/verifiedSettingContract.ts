import type { ChannelArchetype, ChannelProfile, WorkspaceId } from '../types';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { TITLE_LOCALIZED_REQUIRED_ARCHETYPES } from '../data/archetypeAudienceProfiles';
import { resolveTitleLocalizedLanguage } from './packagingLanguage';
import { CHANNEL_SOUND_FLOORS, channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { workspaceForArchetype } from '../data/workspaces';
import { killingPointSetForNonKidsArchetype } from '../data/killingPointWorkspaceSets';

/**
 * 지시문 12 (TASK C-3) — 청취/실측으로 검증된 품질 설정이 archetype/workspace가
 * 아니라 channel.audience/market 같은 개별 필드에 조용히 묶여 있다가 커스텀
 * 채널에서 빠지는 재발 유형을 잡는 계약. `check(channel)`은 실제 해석 함수를
 * 그대로 호출해 "이 채널에서 검증된 값이 실제로 적용되는가"를 판정한다.
 *
 * Fable5 2단계 §5 — check:settings이 "6채널 실패"로 보고하던 것 중 전부가
 * 실제 결함은 아니었다: channel-sound-floor는 data/channelSoundFloor.ts
 * 자신의 문서(ChannelSoundFloor.archetypeIds 주석)가 modern-chill·
 * city-night·lofi-study·kids에는 senior의 warm-analog floor를 "의도적으로"
 * 적용하지 않는다고 이미 밝히고 있었다 — checker가 그 설계 의도를 몰라서
 * 전부 LOST로 뭉뚱그렸다. status를 3단으로 나눈다: 'lost'(진짜 결함) ·
 * 'n/a'(설계상 적용 안 함, reasonKo 필수) — 무조건 6개를 채워 넣어 초록불로
 * 만드는 대신, checker 자체가 "적용 안 되는 게 정상"인 경우를 구분하게
 * 한다(§하지 말 것 "ChannelSoundFloor 6개를 무조건 추가하지 말 것").
 */
export type VerifiedSettingStatus = 'applied' | 'lost' | 'n/a';

export interface VerifiedSettingCheckResult {
  status: VerifiedSettingStatus;
  observed: string;
  expected: string;
  /** status: 'n/a'일 때만 채운다 — 왜 이 채널에는 이 설정이 적용되지 않는 것이 맞는지. */
  reasonKo?: string;
}

export interface VerifiedSettingContract {
  settingId: string;
  /** 이 설정이 검증된 근거 (하루 청취/실측). */
  verifiedByKo: string;
  /** 이 설정이 적용되어야 하는 범위. */
  scope: { archetypes: ChannelArchetype[] } | { workspaces: WorkspaceId[] };
  /** 현재 어떤 경로에서 값을 가져오는가. */
  resolvedFrom: string;
  check: (channel: ChannelProfile) => VerifiedSettingCheckResult;
}

const SENIOR_ARCHETYPES: ChannelArchetype[] = ['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge', 'christmas'];

function inScope(channel: ChannelProfile, contract: VerifiedSettingContract): boolean {
  if ('archetypes' in contract.scope) {
    return Boolean(channel.archetype) && contract.scope.archetypes.includes(channel.archetype!);
  }
  const workspaceId = workspaceForArchetype(channel.archetype)?.id;
  return Boolean(workspaceId) && contract.scope.workspaces.includes(workspaceId!);
}

export const VERIFIED_SETTING_CONTRACTS: VerifiedSettingContract[] = [
  {
    settingId: 'tempo-ceiling',
    verifiedByKo: '하루 청취 v4.16 — "중앙 96은 빠름, 82가 맞음" — tempoCeiling 112 → 100 하향',
    scope: { archetypes: SENIOR_ARCHETYPES },
    resolvedFrom: 'audienceProfileForChannelArchetype → AUDIENCE_PROFILE_ID_BY_ARCHETYPE (지시문 12 TASK C-1 이전엔 senior-oldpop 워크스페이스 전체가 channel.audience 폴백)',
    check(channel) {
      const profile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
      const applied = profile.tempoCeiling === 100;
      return { status: applied ? 'applied' : 'lost', observed: `tempoCeiling ${profile.tempoCeiling} (프로파일 ${profile.id})`, expected: 'tempoCeiling 100 (프로파일 senior)' };
    }
  },
  {
    settingId: 'tempo-band-plan',
    verifiedByKo: '하루 청취로 확정된 시니어 템포 대역 배분 62-72:4 · 73-84:6 · 85-94:5 · 95-100:3',
    scope: { archetypes: SENIOR_ARCHETYPES },
    resolvedFrom: 'tempoBandsForProfile(profile) — profile.id === "senior"일 때만 SENIOR_TEMPO_BANDS(수기 튜닝값)를 반환, 그 외엔 generateTempoBands 자동 생성',
    check(channel) {
      const profile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
      const applied = profile.id === 'senior';
      return { status: applied ? 'applied' : 'lost', observed: `프로파일 ${profile.id}`, expected: '프로파일 senior (SENIOR_TEMPO_BANDS 적용)' };
    }
  },
  {
    settingId: 'tempo-median-target',
    verifiedByKo: '하루 청취 v4.16 — BPM 중앙값 82',
    scope: { archetypes: SENIOR_ARCHETYPES },
    resolvedFrom: 'SENIOR_TEMPO_BANDS의 배분 비율 자체가 중앙값 82를 만들도록 튜닝됨 — tempo-band-plan과 같은 조건(profile.id === "senior")에 종속',
    check(channel) {
      const profile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
      const applied = profile.id === 'senior';
      return { status: applied ? 'applied' : 'lost', observed: `프로파일 ${profile.id}`, expected: '프로파일 senior (중앙값 82 튜닝 대역 적용)' };
    }
  },
  {
    settingId: 'killing-point-assignment',
    verifiedByKo: '하루 청취 — "킬링포인트 옥타브 상승이 들린다", 약 14/18곡 배정·9종 이상 (senior-oldpop만 청취 검증됨)',
    scope: { workspaces: ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'] },
    // 지시문 30 TASK C — AudienceProfile.killingPointSetId는 워크스페이스마다
    // 다른 문자열 값을 갖지만(예: 'kr-2030-emotional-default'),
    // assignKillingPoints를 호출하는 모든 실경로(batchPreallocation.ts/
    // localGenerator.ts 3곳)는 kids 티어 분기(kidsKillingPointsForTier)
    // 하나를 제외하면 전부 동일한 전역 KILLING_POINTS 배열을 그대로 썼다 —
    // killingPointSetId 자체는 문서화만 되고 실제로 배열을 바꾸지 않았다.
    // 이 지시문이 kr-2030/jp-2030/kr-idol-male/kr-idol-female 4개
    // 워크스페이스에 실제 배열(data/killingPointsKr2030.ts·killingPointsJp2030.ts·
    // killingPointsKpop.ts, 지시문 30 TASK C)을 연결했다 —
    // killingPointSetForNonKidsArchetype(data/killingPointWorkspaceSets.ts)가
    // 그 실제 배선이므로 이 체크도 하드코딩된 워크스페이스 이름 목록 대신
    // 그 함수를 직접 호출해 재확인한다(두 판정이 다시 따로 놀 수 없다).
    // 단, verified:false로 시작한 새 4풀 자체는 청취 검증되지 않았다 — 이
    // 체크는 "실제로 다른 배열을 쓰는가"만 확인하지 "그 배열이 좋은가"는
    // 확인하지 않는다(§공통 규약 7 "실측 없이 blocking을 만들지 않는다").
    resolvedFrom: 'killingPointSetForNonKidsArchetype(data/killingPointWorkspaceSets.ts) + kidsKillingPointsForTier(isKidsArchetype) — 지시문 30 TASK C로 4개 워크스페이스가 실제 배열에 연결됨',
    check(channel) {
      const workspaceId = workspaceForArchetype(channel.archetype)?.id;
      const isKids = workspaceId === 'kr-kids' || workspaceId === 'jp-kids';
      const hasOwnNonKidsSet = Boolean(killingPointSetForNonKidsArchetype(channel.archetype));
      const applied = workspaceId === 'senior-oldpop' || isKids || hasOwnNonKidsSet;
      return {
        status: applied ? 'applied' : 'lost',
        observed: applied
          ? `워크스페이스 ${workspaceId}는 자신에게 맞는 킬링포인트 집합을 실제로 사용함${hasOwnNonKidsSet ? ' (지시문 30 TASK C, verified:false)' : ''}`
          : `워크스페이스 ${workspaceId}는 killingPointSetId만 다르고 실제로는 senior용 KILLING_POINTS를 그대로 공유함`,
        expected: '워크스페이스별로 실제로 구분된 킬링포인트 집합'
      };
    }
  },
  {
    settingId: 'arc-phase-coverage',
    verifiedByKo: '하루 청취 — 아크 5구간(오프닝~클로징) 전부 사용',
    scope: { archetypes: SENIOR_ARCHETYPES },
    resolvedFrom: 'audienceProfileForChannelArchetype(...).arcModelId — "five-phase"여야 buildArcPlan(5구간 고정 테이블)이 적용됨',
    check(channel) {
      const profile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
      const applied = (profile.arcModelId ?? 'five-phase') === 'five-phase';
      return { status: applied ? 'applied' : 'lost', observed: `arcModelId ${profile.arcModelId ?? 'five-phase'}`, expected: 'arcModelId five-phase' };
    }
  },
  {
    settingId: 'title-localized',
    verifiedByKo: '수노모드 뷰어의 한글/일본어 제목 표시 근거 — packagingLanguage가 english여도 시니어/쇼와 계열은 이중언어 제목 유지',
    scope: { archetypes: [...TITLE_LOCALIZED_REQUIRED_ARCHETYPES] },
    resolvedFrom: 'resolveTitleLocalizedLanguage(opts) — packagingLanguage 오버라이드가 english일 때 channel.market으로 강제 (지시문 12 TASK C-2 이전엔 resolvePackagingLanguage(opts) 단독이라 english 오버라이드 하나로 필드 자체가 스키마에서 사라졌다)',
    check(channel) {
      // 실측 버그 시나리오 재현: packagingLanguage가 (오버라이드 등으로) english로
      // 강제된 최악의 경우에도 이 아키타입은 titleLocalized를 유지해야 한다.
      const forced = resolveTitleLocalizedLanguage({ market: channel.market, packagingLanguage: 'english', channel });
      const applied = forced !== 'english';
      return { status: applied ? 'applied' : 'lost', observed: `packagingLanguage=english 강제 시 titleLocalized 언어: ${forced}`, expected: 'english가 아닌 언어로 강제 복구됨 (market 기준)' };
    }
  },
  {
    settingId: 'channel-sound-floor',
    verifiedByKo: '하루 청취 — senior-oldpop 전 곡 필수 조건(warm analog, 금지 아톰)',
    scope: { workspaces: ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-idol-male', 'kr-idol-female'] },
    resolvedFrom: 'channelSoundFloorForArchetype(channel.archetype) — data/channelSoundFloor.ts',
    check(channel) {
      const floor = channelSoundFloorForArchetype(channel.archetype);
      if (floor) return { status: 'applied', observed: `floor: ${floor.id}`, expected: '이 워크스페이스에 등록된 ChannelSoundFloor 1개' };
      // data/channelSoundFloor.ts의 ChannelSoundFloor.archetypeIds 문서 그대로:
      // 이 워크스페이스에 floor가 있긴 하지만(다른 archetype용), 이 채널의
      // archetype은 그 floor의 archetypeIds에 의도적으로 빠져 있다 — 진짜
      // 유실이 아니라 설계상 미적용. 워크스페이스 자체에 floor가 아예 없으면
      // (아래 조건이 false) 그건 여전히 진짜 유실이다.
      const workspaceId = workspaceForArchetype(channel.archetype)?.id;
      const workspaceHasAnyFloor = CHANNEL_SOUND_FLOORS.some(f => f.workspaceId === workspaceId);
      if (workspaceHasAnyFloor) {
        return {
          status: 'n/a',
          observed: 'floor 없음',
          expected: '이 워크스페이스에 등록된 ChannelSoundFloor 1개',
          reasonKo: `${channel.archetype}는 이 워크스페이스의 다른 아키타입과 프로덕션 성격이 달라(모던/디지털 편성 또는 동요) ChannelSoundFloor.archetypeIds에서 의도적으로 제외됨 — data/channelSoundFloor.ts 자신의 문서 참조`
        };
      }
      return { status: 'lost', observed: 'floor 없음', expected: '이 워크스페이스에 등록된 ChannelSoundFloor 1개' };
    }
  },
  {
    settingId: 'palette-family-group',
    verifiedByKo: '하루 청취 — "일식·중식·한식이 같이 나온 느낌" 이후 시대 정전 팔레트 14종 · 팔레트 계열 그룹 4종으로 세트를 한 계열 안에 묶음',
    scope: { archetypes: SENIOR_ARCHETYPES },
    resolvedFrom: 'channelSoundFloorForArchetype(channel.archetype)?.usesPaletteFamily — true인 아키타입만 core/setDirector.ts의 계열-제한 장르 풀이 적용됨',
    check(channel) {
      const floor = channelSoundFloorForArchetype(channel.archetype);
      const applied = Boolean(floor?.usesPaletteFamily);
      return { status: applied ? 'applied' : 'lost', observed: `usesPaletteFamily=${Boolean(floor?.usesPaletteFamily)}`, expected: 'usesPaletteFamily=true' };
    }
  },
  {
    settingId: 'arrangement-density',
    verifiedByKo: '하루 청취 — 편곡 밀도 sparse 6 · medium 8 · full 4 (18곡 기준, full 상한 4곡)',
    scope: { archetypes: SENIOR_ARCHETYPES },
    resolvedFrom: 'audienceProfileForChannelArchetype(...).arrangementDensityLimits.fullMax',
    check(channel) {
      const profile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
      const applied = profile.arrangementDensityLimits.fullMax === 4;
      return { status: applied ? 'applied' : 'lost', observed: `fullMax ${profile.arrangementDensityLimits.fullMax}`, expected: 'fullMax 4' };
    }
  }
];

export { inScope };
