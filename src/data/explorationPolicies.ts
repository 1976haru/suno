import type { WorkspaceId } from '../types';

/**
 * v5.24 (TASK A) — "워크스페이스마다 좋은 노래가 나오는 조건이 다릅니다": v5.23's
 * exploration engine (core/explorationSlots.ts) was built and tuned for
 * exactly one workspace (senior-oldpop, gated in
 * EXPLORATION_ENABLED_WORKSPACES) with one axis set, one slot-count rule,
 * and one instruction tone ("실패해도 됩니다"). This file is pure data for
 * the other six workspaces' own exploration policy — it does NOT touch or
 * replace core/explorationSlots.ts (senior-oldpop keeps its existing,
 * already-tuned code path unchanged; see this file's own §11 "회귀 방지").
 * core/explorationPolicyEngine.ts is the parallel engine that reads this
 * data for every workspace EXCEPT senior-oldpop.
 */

export interface ExplorationAxis {
  id: string;
  labelKo: string;
  /** The sentence(s) injected into the instruction when this axis is chosen. */
  promptKo: string;
  examplesKo: string[];
}

export interface WorkspaceExplorationPolicy {
  workspaceId: WorkspaceId;
  enabled: boolean;
  slotCount: number;
  axes: ExplorationAxis[];
  /** Bulleted "단, 다음은 지키십시오" lines — never relaxed by exploration, ever. */
  frozen: string[];
  /** Short label for the instruction's own tone/closing line; see closingLineKo below for the literal text. */
  toneKo: string;
  /**
   * v5.24 addition beyond the spec's own literal interface (§1) — proportional
   * (0..1) track positions the slots should land near, the same
   * "scaled proportionally, never in the 1~3 opening" approach
   * core/explorationSlots.ts's own selectExplorationTrackNos already uses for
   * senior-oldpop. Needed to actually place slots; not itself a spec field.
   */
  slotPositionFractions: number[];
  /**
   * §2-4 "'실패해도 됩니다' 를 쓰지 마십시오" — kids is the only workspace where this
   * literal framing is prohibited. Every other workspace keeps some form of
   * "one good song out of N is a success" closing line (§3-4/§4 "가장
   * 자유로워야").
   */
  noFailureFraming: boolean;
  /** The literal closing line used instead of/alongside the failure framing. */
  closingLineKo: string;
  /** Below this songCount, no slots are placed at all (mirrors explorationSlots.ts's own "set-too-small" floor). */
  minSongCount: number;
  /**
   * true only for senior-oldpop — this policy entry exists for §8's own
   * "워크스페이스별 정책 7종" completeness, but core/explorationPolicyEngine.ts
   * skips any policy with this flag set: senior-oldpop keeps running through
   * core/explorationSlots.ts's own dedicated, already-tuned engine, never
   * this generic one.
   */
  legacyEngine?: boolean;
}

const KIDS_AXES: ExplorationAxis[] = [
  {
    id: 'axis-onomatopoeia',
    labelKo: '의성어·의태어 조합',
    promptKo: '이 곡의 의성어를 새롭게 조합해 보십시오. 아이가 소리를 내며 따라 할 수 있어야 합니다.',
    examplesKo: [
      '두 의성어를 번갈아 (예: 퐁당퐁당 → 살랑살랑 → 퐁당퐁당)',
      '의성어가 점점 빨라지기',
      '의성어로만 이루어진 후렴',
      '조용한 의성어와 큰 의성어의 대비'
    ]
  },
  {
    id: 'axis-call-response',
    labelKo: '콜앤리스폰스',
    promptKo: '어른과 아이가 주고받는 방식을 새롭게 해보십시오.',
    examplesKo: [
      '어른이 묻고 아이가 답하기',
      '아이가 먼저 시작하기',
      '세 번 묻고 한 번 답하기',
      '마지막에 함께 부르기',
      '답이 점점 커지기'
    ]
  },
  {
    id: 'axis-instrument',
    labelKo: '악기 편성',
    promptKo: '악기를 하나씩 더하거나 빼면서 곡을 만들어 보십시오.',
    examplesKo: ['악기 하나로 시작해 하나씩 추가', '후렴에서 악기가 전부 멈추고 목소리만', '타악기만으로 한 구간', '실로폰이 멜로디를 따라 부르기']
  },
  {
    id: 'axis-narrator',
    labelKo: '화자',
    promptKo: '누가 부르는지를 바꿔 보십시오.',
    examplesKo: ['동물이 화자', '사물이 화자 (칫솔·버스 등)', '아이가 어른에게 가르쳐주기', '둘이 대화하듯']
  }
];

const KIDS_FROZEN: string[] = [
  '가사 안전 정책 전부 — 무서움·슬픔·이별·죽음·어둠·복잡한 정서 금지',
  '곡당 개념 1개',
  '반복률 (연령별 최소치)',
  '어휘 난이도 (연령별 화이트리스트)',
  '연령별 BPM 범위',
  '곡 길이 (연령별 audienceProfile 기준, 대략 1:30~2:30)',
  '금지 악기 (왜곡 기타·서브베이스·거친 타악 금지)'
];

const KPOP_AXES: ExplorationAxis[] = [
  {
    id: 'axis-part-split',
    labelKo: '파트 배분',
    promptKo: '파트를 나누는 방식을 새롭게 해보십시오.',
    examplesKo: ['한 문장을 세 명이 나눠 부르기', '후렴에서 파트가 겹치기', '브리지를 한 명이 통째로', '벌스마다 다른 사람이 시작']
  },
  {
    id: 'axis-buildup',
    labelKo: '빌드업',
    promptKo: '후렴으로 가는 길을 다르게 만들어 보십시오.',
    examplesKo: ['프리코러스에서 반주가 사라지기', '한 박자 쉬고 후렴', '후렴 직전에 템포가 반으로', '빌드업 없이 갑자기 후렴']
  },
  {
    id: 'axis-hook',
    labelKo: '후렴 훅',
    promptKo: '후렴에서 가장 기억에 남을 지점을 설계하십시오.',
    examplesKo: ['같은 단어를 세 번', '후렴 첫 소절이 제목', '후렴 끝에 무반주 한 줄', '후렴이 두 부분으로 나뉘기']
  },
  {
    id: 'axis-break',
    labelKo: '전환 구간',
    promptKo: '곡 중간에 예상 밖의 구간을 넣어 보십시오.',
    examplesKo: ['댄스 브레이크 (가사 없음)', '랩 구간', '아카펠라 8마디', '템포 전환']
  },
  {
    id: 'axis-timbre',
    labelKo: '음색',
    promptKo: '같은 성별 안에서 목소리 질감을 다르게 해보십시오.',
    examplesKo: ['벌스는 낮게, 후렴은 높게', '속삭임에서 파워로', '거친 톤과 맑은 톤의 대비', '한 곡에서 화자가 성숙해지기']
  },
  {
    id: 'axis-lyric-voice',
    labelKo: '가사 화법',
    promptKo: '가사를 말하는 방식을 다르게 해보십시오.',
    examplesKo: ['자기 대화', '미래의 나에게', '반복되는 질문', '장면만 나열하고 감정은 안 쓰기']
  }
];

const KPOP_FROZEN: string[] = [
  '성별 쿼터 — 보컬 탐색은 이 채널의 고정 성별 안에서만 (반대 성별로 바꾸지 않음)',
  '아이돌 부적절 표현 금지 — 성적 대상화·미성년 암시·신체 묘사·특정 그룹 모방·실명 언급',
  '곡 길이 (audienceProfile.songLengthSecondsRange 기준, 아이돌 표준 범위)'
];

const AGE2030_AXES: ExplorationAxis[] = [
  {
    id: 'axis-genre-blend',
    labelKo: '장르 합성',
    promptKo: '두 장르를 섞어 보십시오.',
    examplesKo: ['시티팝 + 알앤비', '포크 + 일렉트로닉', '발라드 + 로파이', '재즈 코드 + 신스팝']
  },
  {
    id: 'axis-structure',
    labelKo: '구조',
    promptKo: '일반적인 벌스-후렴 구조를 벗어나 보십시오.',
    examplesKo: ['후렴 없는 곡', '후렴이 마지막에만', '벌스가 점점 짧아지기']
  },
  {
    id: 'axis-production',
    labelKo: '프로덕션',
    promptKo: '사운드의 질감 자체를 다르게 만들어 보십시오.',
    examplesKo: ['로파이', '과장된 리버브', '의도적 왜곡', '무반주 구간']
  },
  {
    id: 'axis-tempo',
    labelKo: '템포',
    promptKo: '곡 안에서 템포 자체를 변화시켜 보십시오.',
    examplesKo: ['곡 중간 템포 전환', '하프타임 후렴', '더블타임 브리지']
  },
  {
    id: 'axis-lyric-form',
    labelKo: '가사 형식',
    promptKo: '가사를 쓰는 형식 자체를 바꿔 보십시오.',
    examplesKo: ['대화체', '일기체', '메시지', '나열형', '반복형']
  },
  {
    id: 'axis-vocal',
    labelKo: '보컬',
    promptKo: '보컬을 쓰는 방식을 다르게 해보십시오.',
    examplesKo: ['이중창', '화자 전환', '속삭임', '말하듯 부르기']
  },
  {
    id: 'axis-harmony',
    labelKo: '화성',
    promptKo: '안 쓰던 화성 진행을 시도해 보십시오.',
    examplesKo: ['평소 안 쓰던 진행', '모달', '갑작스러운 전조']
  },
  {
    id: 'axis-sound',
    labelKo: '사운드 소스',
    promptKo: '악기가 아닌 소리를 사운드 소스로 써 보십시오.',
    examplesKo: ['환경음', '일상 소리', '악기 아닌 것으로 리듬 만들기']
  }
];

const AGE2030_FROZEN: string[] = [
  'audienceProfile 안전 제약',
  '아티스트명·저작권',
  '곡 길이 (audienceProfile.songLengthSecondsRange 기준, 대략 2:30~3:40)',
  '언어 순도 (v5.22 AXIS 3)'
];

export const EXPLORATION_POLICIES: Record<WorkspaceId, WorkspaceExplorationPolicy> = {
  'senior-oldpop': {
    workspaceId: 'senior-oldpop',
    enabled: true,
    slotCount: 4,
    axes: [],
    frozen: [],
    toneKo: '재현 안의 변주 — core/explorationSlots.ts 참고',
    slotPositionFractions: [0.35, 0.44, 0.67, 0.78],
    noFailureFraming: false,
    closingLineKo: '실패해도 됩니다. 이 슬롯 중 하나만 좋아도 성공입니다.',
    minSongCount: 8,
    legacyEngine: true
  },
  'kr-kids': {
    workspaceId: 'kr-kids',
    enabled: true,
    slotCount: 2,
    axes: KIDS_AXES,
    frozen: KIDS_FROZEN,
    toneKo: '안전 안에서만 — "실패해도" 금지, 아이가 듣는 노래',
    slotPositionFractions: [0.39, 0.72],
    noFailureFraming: true,
    closingLineKo: '이 조건 안에서만 실험하십시오. 아이가 듣는 노래입니다.',
    minSongCount: 8
  },
  'jp-kids': {
    workspaceId: 'jp-kids',
    enabled: true,
    slotCount: 2,
    axes: KIDS_AXES,
    frozen: KIDS_FROZEN,
    toneKo: '안전 안에서만 — "실패해도" 금지, 아이가 듣는 노래',
    slotPositionFractions: [0.39, 0.72],
    noFailureFraming: true,
    closingLineKo: 'この条件の中でだけ実験してください。子どもが聴く歌です。',
    minSongCount: 8
  },
  'kr-idol-male': {
    workspaceId: 'kr-idol-male',
    enabled: true,
    slotCount: 3,
    axes: KPOP_AXES,
    frozen: KPOP_FROZEN,
    toneKo: '구조적 쾌감 — 파트·빌드업·후렴 설계',
    slotPositionFractions: [0.28, 0.5, 0.78],
    noFailureFraming: false,
    closingLineKo: '세 곡 중 하나만 좋아도 성공입니다.',
    minSongCount: 8
  },
  'kr-idol-female': {
    workspaceId: 'kr-idol-female',
    enabled: true,
    slotCount: 3,
    axes: KPOP_AXES,
    frozen: KPOP_FROZEN,
    toneKo: '구조적 쾌감 — 파트·빌드업·후렴 설계',
    slotPositionFractions: [0.28, 0.5, 0.78],
    noFailureFraming: false,
    closingLineKo: '세 곡 중 하나만 좋아도 성공입니다.',
    minSongCount: 8
  },
  'kr-2030': {
    workspaceId: 'kr-2030',
    enabled: true,
    slotCount: 4,
    axes: AGE2030_AXES,
    frozen: AGE2030_FROZEN,
    toneKo: '가장 자유로움 — 정전 없음, 새로움이 강점',
    slotPositionFractions: [0.33, 0.61, 0.83, 0.89],
    noFailureFraming: false,
    closingLineKo: '이 네 곡 중 새롭게 들리는 곡이 있다면 성공입니다.',
    minSongCount: 8
  },
  'jp-2030': {
    workspaceId: 'jp-2030',
    enabled: true,
    slotCount: 4,
    axes: AGE2030_AXES,
    frozen: AGE2030_FROZEN,
    toneKo: '가장 자유로움 — 정전 없음, 새로움이 강점',
    slotPositionFractions: [0.33, 0.61, 0.83, 0.89],
    noFailureFraming: false,
    closingLineKo: 'この4曲のうち新しく聴こえる曲があれば成功です。',
    minSongCount: 8
  },
  // 지시문 71 (TASK A) — kr-2030/jp-2030과 같은 "가장 자유로움" 성인 도시
  // 워크스페이스 성격 — 같은 AGE2030_AXES/AGE2030_FROZEN 재사용.
  'en-chillhop': {
    workspaceId: 'en-chillhop',
    enabled: true,
    slotCount: 4,
    axes: AGE2030_AXES,
    frozen: AGE2030_FROZEN,
    toneKo: '가장 자유로움 — 정전 없음, 새로움이 강점',
    slotPositionFractions: [0.33, 0.61, 0.83, 0.89],
    noFailureFraming: false,
    closingLineKo: 'If even one of these four tracks sounds fresh, call it a win.',
    minSongCount: 8
  }
};

export function explorationPolicyFor(workspaceId: WorkspaceId): WorkspaceExplorationPolicy {
  return EXPLORATION_POLICIES[workspaceId];
}
