import type { ChannelArchetype, MoneyChordSectionAssignment } from '../types';
import { moneyChordPresets } from '../data/moneyChords';
import { isKidsArchetype } from '../utils/channelArchetype';
import { scaleQuotaToSongCount } from './quotaScaling';
import { shuffle } from '../utils/prng';

/**
 * 지시문 39 (TASK B-4) — kids/senior/modern(2030)/kpop(아이돌) 4버킷 분류.
 * core/moneyChordRecommender.ts(TASK A)도 이 함수를 그대로 쓴다 — 순환
 * import를 피하려고 이 파일(TASK B)에 두고, recommender가 여기서
 * import한다(반대 방향은 안 된다: 이 파일은 recommender를 모른다).
 *
 * 지시문 43 (TASK B-3) — kr-idol-male/kr-idol-female을 'modern'에서 분리해
 * 'kpop' 전용 버킷으로 뺀다. 이전에는 kr-2030-pop/jp-2030-pop과 곡당 진행
 * 수 정책을 공유했는데, 이 지시문은 kr-idol만 "3개 7곡"으로 올리라고
 * 하고(§B-3) 2030 워크스페이스는 "건드리지 말 것"이라 같은 버킷을 계속
 * 쓰면 둘 다 바뀐다 — 버킷을 쪼개는 것 자체가 회귀 방지의 실제 구현이다.
 */
export function workspaceCountBucketFor(archetype: ChannelArchetype | undefined): 'kids' | 'senior' | 'modern' | 'kpop' | 'general' {
  if (isKidsArchetype(archetype)) return 'kids';
  const senior: ChannelArchetype[] = ['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge', 'christmas'];
  const modern: ChannelArchetype[] = ['kr-2030-pop', 'jp-2030-pop'];
  const kpop: ChannelArchetype[] = ['kr-idol-male', 'kr-idol-female'];
  if (archetype && senior.includes(archetype)) return 'senior';
  if (archetype && kpop.includes(archetype)) return 'kpop';
  if (archetype && modern.includes(archetype)) return 'modern';
  return 'general';
}

export interface MoneyChordSectionPlanEntry {
  /** 이 곡에 실제로 쓰이는 진행 id 전부 — chordIds[0]이 항상 주 진행(기존 progressionPlan이 고른 것 그대로). */
  chordIds: string[];
  /** chordIds.length가 1이면 빈 배열 — 섹션 구분 자체가 없는 단순 진행. */
  sectionMap: MoneyChordSectionAssignment[];
  /** sectionMap을 "Section: progression" verbatim 텍스트로 합친 것 — chordIds.length가 1이면 undefined. */
  text: string | undefined;
}

/**
 * 지시문 39 (TASK B-4) — 곡당 진행 수 분포. 지시문 본문이 직접 준 15곡
 * 예시(1개 4곡·2개 9곡·3개 2곡)를 "그 외" 워크스페이스의 기본값으로
 * 두고, 명시적으로 언급된 3개 그룹(동요/시니어/2030·아이돌)만 조정한다.
 * verified: false 추정치 — 하루의 실측 청취로 검증된 값이 아니다.
 *   동요    "1개 우세, 따라 부르기 쉬움이 우선" — 3개는 아예 배정하지
 *           않는다(§하지 말 것 "동요에 3개 진행을 강제하지 말 것"을
 *           가장 안전하게 해석: 강제도, 우연한 발생도 없앤다).
 *   시니어  "2개 우세" — 본문 예시보다 2 쪽으로 조금 더 옮김.
 *   2030      "2~3개" — 1개 비중을 크게 줄이고 3개 비중을 늘림.
 *   kpop(아이돌) 지시문 43 (TASK B-3) — "K-pop 은 구조 변화가 장르 특성"
 *           이라는 하루의 지적에 맞춰 modern보다 한 번 더 3개 쪽으로
 *           옮긴다(1개 2곡·2개 6곡·3개 7곡, 15곡 기준 — 하루의 후보 표
 *           그대로). verified: false, 2030과 분리된 kr-idol 전용 값.
 */
export const MONEY_CHORD_SECTION_COUNT_VERIFIED = false as const;
const COUNT_POLICY_BASE_SONG_COUNT = 15;
type ChordCountBucket = ReturnType<typeof workspaceCountBucketFor>;
// 지시문 62 (TASK E-3③) — "곡당 진행 2개 이상 13~14/15... 3개인 곡을
// 늘린다(지시문 39가 2~3회로 정함)". senior·general의 '3' 값을 소폭
// 올렸다('1'에서 옮겨 총합 15 유지) — modern(5)·kpop(7)은 이미 지시문
// 43·본문 예시가 명시적으로 정한 값이라 건드리지 않는다. kids는 0을
// 유지한다 — §하지 말 것 "동요에 3개 진행을 강제하지 말 것"(지시문39
// 자기 doc comment)이 이 지시문의 "3개인 곡을 늘린다"보다 우선한다
// (§공통규약 3 "하지 말 것이 본문과 충돌하면 하지 말 것이 우선").
const COUNT_POLICY_BY_BUCKET: Record<ChordCountBucket, Record<'1' | '2' | '3', number>> = {
  kids: { '1': 11, '2': 4, '3': 0 },
  senior: { '1': 2, '2': 10, '3': 3 },
  modern: { '1': 2, '2': 8, '3': 5 },
  kpop: { '1': 2, '2': 6, '3': 7 },
  general: { '1': 2, '2': 9, '3': 4 }
};

function chordCountPlan(bucket: ChordCountBucket, songCount: number, seed: number): number[] {
  const scaled = scaleQuotaToSongCount(COUNT_POLICY_BY_BUCKET[bucket], COUNT_POLICY_BASE_SONG_COUNT, songCount);
  const pool: number[] = [];
  for (const key of ['1', '2', '3'] as const) {
    for (let i = 0; i < (scaled[key] ?? 0); i += 1) pool.push(Number(key));
  }
  while (pool.length < songCount) pool.push(1);
  return shuffle(pool, seed).slice(0, songCount);
}

const SECTION_LABELS: Record<number, string[]> = {
  2: ['Verse', 'Chorus'],
  3: ['Verse', 'Chorus', 'Bridge']
};

/**
 * emotional/winterBallad는 프리셋 자체가 이미 절/후렴이 다른 2단 진행이다
 * (data/moneyChords.ts's own progressions/compactProgression — "I-V-vi-IV
 * verses, vi-IV-I-V chorus lift" 등). §하지 말 것 "emotional·winterBallad의
 * 기존 2단 진행을 되돌리지 말 것" — 이 함수가 그 위에 또 다른 진행을
 * 얹어 "Verse: <이미 2단인 emotional 텍스트> / Chorus: <이웃 진행>" 같은
 * 이중 서술을 만들지 않도록, 이 둘은 항상 단일 chordIds로 남긴다.
 */
const ALREADY_MULTI_STAGE_IDS = new Set(['emotional', 'winterBallad']);

/**
 * 지시문 39 (TASK B) — "머니코드가 노래당 꼭 하나가 아니라 2~3개 있어도
 * 되지 않아?" 기존 진행 배정(core/moneyChordPlan.ts's progressionPlan,
 * batchPreallocation.ts가 이미 계산한 것)은 절대 바꾸지 않는다 — 이 함수는
 * 그 위에 얹는 순수 추가 레이어다: 각 트랙의 주 진행(progressionPlan[idx])은
 * 그대로 두고, "이 곡은 몇 개 진행을 쓸까"(TASK B-4 정책)를 굴려 2개
 * 이상이면 주 진행의 compatibleWith(§B-3 "이 안에서만 조합") 중에서만
 * 이웃을 골라 섹션(Verse/Chorus/Bridge)에 배정한다.
 *
 * `progressionPlan`이 null이면(usesMoneyChordQuota가 false — 회전 자체가
 * 없는 채널) 이 함수도 아무것도 하지 않는다(빈 배열) — 낡은 단일-진행
 * 경로를 그대로 둔다(§규약 5).
 */
export function buildMoneyChordSectionPlan(
  progressionPlan: readonly (string | undefined)[] | null,
  archetype: ChannelArchetype | undefined,
  songCount: number,
  seed: number
): (MoneyChordSectionPlanEntry | undefined)[] {
  if (!progressionPlan || songCount <= 0) return [];
  const bucket = workspaceCountBucketFor(archetype);
  const counts = chordCountPlan(bucket, songCount, seed + 8801);

  return progressionPlan.map((primaryId, index) => {
    if (!primaryId) return undefined;
    const chordCount = counts[index] ?? 1;
    if (chordCount <= 1 || ALREADY_MULTI_STAGE_IDS.has(primaryId)) {
      return { chordIds: [primaryId], sectionMap: [], text: undefined };
    }
    const preset = moneyChordPresets[primaryId];
    const neighbors = (preset?.compatibleWith ?? []).filter(id => id !== primaryId && moneyChordPresets[id] && !ALREADY_MULTI_STAGE_IDS.has(id));
    if (!neighbors.length) {
      return { chordIds: [primaryId], sectionMap: [], text: undefined };
    }
    const shuffledNeighbors = shuffle(neighbors, seed + index * 97 + 4001);
    // 항상 primary 1개 + 이웃 최대 2개 = 최대 3개(§하지 말 것 "4개 이상 만들지 말 것").
    const extraCount = Math.min(chordCount - 1, shuffledNeighbors.length, 2);
    const chordIds = [primaryId, ...shuffledNeighbors.slice(0, extraCount)];
    const labels = SECTION_LABELS[chordIds.length] ?? SECTION_LABELS[2];
    const sectionMap: MoneyChordSectionAssignment[] = chordIds.map((id, i) => ({
      section: labels[i] ?? labels[labels.length - 1],
      chordId: id
    }));
    const text = sectionMap
      .map(assignment => `${assignment.section}: ${moneyChordPresets[assignment.chordId]?.compactProgression ?? assignment.chordId}`)
      .join(' / ');
    return { chordIds, sectionMap, text };
  });
}
