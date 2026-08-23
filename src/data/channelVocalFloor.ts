import type { ChannelArchetype, WorkspaceId } from '../types';

/**
 * 지시문 62 (TASK C) — 하루의 두 번째 지적: "시니어다움이 작아. 시니어
 * 채널다운 목소리 느낌이 없어." (2030·K-pop·동요 동일). TASK B의
 * vocalPreference는 "이 장르에 어떤 성별·음역이 맞는가"를 정하지만, 그것과
 * 별개로 "이 워크스페이스의 목소리는 무엇이 와도 이렇다"는 층이 없었다 —
 * data/channelSoundFloor.ts(사운드 바닥)와 같은 자리인데 보컬 전용 버전이
 * 빠져 있었다. 이 파일이 그 자리를 채운다 — 구조·소비 경로 모두
 * channelSoundFloor.ts를 그대로 미러링한다(workspaceId 키, exit-when-
 * undefined lookup, requiredAtoms/forbiddenAtoms와 같은 두 목록).
 *
 * "7 워크스페이스"(§F-2 완료 판정)는 WorkspaceId 유니언(7개: senior-oldpop·
 * kr-2030·jp-2030·kr-kids·jp-kids·kr-idol-male·kr-idol-female)과 정확히
 * 대응한다 — CHANNEL_SOUND_FLOORS처럼 archetypeIds로 워크스페이스 내부를
 * 다시 좁힐 수 있지만(예: senior-oldpop 워크스페이스 안에도 kids/modern-chill/
 * city-night/lofi-study/j2000s처럼 성격이 다른 아키타입이 섞여 있다 —
 * channelSoundFloor.ts가 이미 이 다섯을 의도적으로 커버 밖에 둔 전례를
 * 그대로 따른다), 엔트리 개수 자체는 7을 유지한다.
 */
export interface ChannelVocalFloor {
  id: string;
  workspaceId: WorkspaceId;
  labelKo: string;
  /** channelSoundFloor.ts의 동일 필드와 같은 의미 — undefined면 워크스페이스 전체에 적용. */
  archetypeIds?: ChannelArchetype[];
  /** 어떤 장르가 와도 유지되는 보컬 성격. core/localGenerator.ts의 'vocal' PromptPart(ESSENTIAL_TERM_IDS)에 1개가 실린다. */
  requiredTraits: string[];
  /** 이 채널에서 쓰지 않는 보컬 성격. core/negativePromptSpec.ts의 NegativePromptSpec.vocal로 나간다(그 필드 자신의 doc comment: "no vocal-specific negative-term source exists... kept for a future real source" — 이 파일이 그 자리를 채운다). */
  forbiddenTraits: string[];
  reasonKo: string;
}

export const CHANNEL_VOCAL_FLOORS: ChannelVocalFloor[] = [
  {
    id: 'senior-oldpop-vocal-floor',
    workspaceId: 'senior-oldpop',
    labelKo: '시니어 보컬 바닥',
    // channelSoundFloor.ts의 senior-oldpop-floor와 같은 archetypeIds 범위 —
    // 같은 워크스페이스에 있어도 modern-chill/city-night/lofi-study/j2000s/kids는
    // 성격이 다른 아키타입이라 제외한다(그 파일 자기 doc comment 그대로).
    archetypeIds: ['senior-morning', 'showa-cafe', 'oldpop-lounge', 'showa-70s'],
    requiredTraits: [
      'warm mature timbre',
      'unforced natural delivery',
      'clear diction without modern processing'
    ],
    forbiddenTraits: [
      'autotuned pitch correction',
      'aggressive belting',
      'breathy whisper-pop delivery',
      'very young bright tone'
    ],
    reasonKo: '시니어 채널의 정체성 — 하루의 청취 검증: "시니어다움이 작아. 시니어 채널다운 목소리 느낌이 없어."'
  },
  {
    id: 'kr-2030-vocal-floor',
    workspaceId: 'kr-2030',
    labelKo: '한국 2030 보컬 바닥',
    archetypeIds: ['kr-2030-pop'],
    requiredTraits: [
      'contemporary Korean pop vocal placement',
      'natural conversational phrasing'
    ],
    forbiddenTraits: [
      'vintage crooner vibrato',
      'operatic projection',
      'nostalgic senior-radio announcer tone'
    ],
    reasonKo: '2030 채널다움 — 젊고 도시적인 톤. 빈티지 크루너/오페라틱 발성으로 흘러가지 않게 막는 바닥.'
  },
  {
    id: 'jp-2030-vocal-floor',
    workspaceId: 'jp-2030',
    labelKo: '일본 2030 보컬 바닥',
    archetypeIds: ['jp-2030-pop'],
    requiredTraits: [
      'contemporary Japanese pop vocal placement',
      'natural conversational phrasing'
    ],
    forbiddenTraits: [
      'vintage crooner vibrato',
      'operatic projection',
      'showa-era announcer tone'
    ],
    reasonKo: 'kr-2030-vocal-floor와 같은 근거 — 언어만 다르고 채널 성격(젊고 도시적)은 같다.'
  },
  {
    id: 'kr-idol-male-vocal-floor',
    workspaceId: 'kr-idol-male',
    labelKo: '한국 남자 아이돌 보컬 바닥',
    archetypeIds: ['kr-idol-male'],
    requiredTraits: [
      'polished idol vocal production',
      'distinct member-to-member contrast'
    ],
    forbiddenTraits: [
      'vintage tape-era vocal tone',
      'nostalgic senior-radio announcer tone'
    ],
    reasonKo: 'K-pop 채널다움 — 파워풀·멤버별 대비. 성별 쿼터(male 15·female 0·mixed 3)는 vocalPreference/vocalQuota가 별도로 관리하며 이 바닥은 건드리지 않는다.'
  },
  {
    id: 'kr-idol-female-vocal-floor',
    workspaceId: 'kr-idol-female',
    labelKo: '한국 여자 아이돌 보컬 바닥',
    archetypeIds: ['kr-idol-female'],
    requiredTraits: [
      'polished idol vocal production',
      'distinct member-to-member contrast'
    ],
    forbiddenTraits: [
      'vintage tape-era vocal tone',
      'nostalgic senior-radio announcer tone'
    ],
    reasonKo: 'kr-idol-male-vocal-floor와 동일 근거 — 아이돌 프로덕션 성격은 같고 성별만 반대(male 0·female 15·mixed 3).'
  },
  {
    id: 'en-chillhop-vocal-floor',
    workspaceId: 'en-chillhop',
    labelKo: '영어 칠랩·딥하우스 보컬 바닥',
    archetypeIds: ['en-chillhop'],
    requiredTraits: [
      'natural conversational English vocal delivery',
      'contemporary urban vocal placement'
    ],
    forbiddenTraits: [
      'vintage crooner vibrato',
      'operatic projection',
      'nostalgic senior-radio announcer tone'
    ],
    reasonKo: 'kr-2030-vocal-floor와 같은 근거 — 젊고 도시적인 톤. 빈티지 크루너/오페라틱 발성으로 흘러가지 않게 막는 바닥.'
  },
  {
    id: 'kr-kids-vocal-floor',
    workspaceId: 'kr-kids',
    labelKo: '한국 동요 보컬 바닥',
    archetypeIds: ['kr-kids-song'],
    requiredTraits: [
      'bright clear childlike tone',
      'simple diction'
    ],
    forbiddenTraits: [
      'adult chest belting',
      'husky or smoky texture'
    ],
    reasonKo: '동요 채널다움 — 밝고 또렷한 아이 톤. kidsAgeTier 음색 정책(vocalPresets.ts forKids)과 같은 방향이라 충돌하지 않는다 — 이 바닥은 forKids 프리셋이 이미 만족하는 성격을 재확인할 뿐, 새 제약을 얹지 않는다.'
  },
  {
    id: 'jp-kids-vocal-floor',
    workspaceId: 'jp-kids',
    labelKo: '일본 동요 보컬 바닥',
    archetypeIds: ['jp-kids-song'],
    requiredTraits: [
      'bright clear childlike tone',
      'simple diction'
    ],
    forbiddenTraits: [
      'adult chest belting',
      'husky or smoky texture'
    ],
    reasonKo: 'kr-kids-vocal-floor와 동일 근거 — 언어만 다르고 동요 채널 성격은 같다.'
  }
];

export function channelVocalFloorForArchetype(archetype: ChannelArchetype | undefined): ChannelVocalFloor | undefined {
  if (!archetype) return undefined;
  return CHANNEL_VOCAL_FLOORS.find(floor => !floor.archetypeIds || floor.archetypeIds.includes(archetype));
}
