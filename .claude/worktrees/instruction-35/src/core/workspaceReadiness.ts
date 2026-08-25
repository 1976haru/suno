import { channelPresets } from '../data/presets';
import { moneyChordRotationPool } from '../data/moneyChords';
import { lyricThemesForOptions } from '../data/lyricThemes';
import { AUDIENCE_PROFILE_ID_BY_ARCHETYPE } from '../data/archetypeAudienceProfiles';
import type { WorkspaceDefinition } from '../data/workspaces';
import type { ChannelArchetype, LyricLanguage } from '../types';

/**
 * 지시문 28 (TASK B) — 워크스페이스 열기 전 사전 점검. 하루의 지적("굿모닝
 * 추억라디오, oldpoplounge 등 채널 선택할 때마다 기능이 작동 안 하고 그러는
 * 게 자주 있는 것 같다... 2030·동요·K-pop도 마찬가지 아닌가")에 대한 답 —
 * check:coverage(scripts/checkArchetypeCoverage.ts)가 CI/로컬에서만 보이던
 * 것을 실제 워크스페이스 선택 화면에 얹는다. 생성에 직접 영향을 주는 축만
 * 고른다(§B-3): 장르 풀·머니코드 회전 풀·lyricTheme 풀·audienceProfile
 * 전용 여부·실전 검증 세트 수. 차단하지 않는다 — 열 수는 있되 무엇이
 * 부족한지 미리 알려준다.
 *
 * 워크스페이스가 여러 아키타입을 묶고 있으면(senior-oldpop은 10개) 그중
 * 최악값(가장 부족한 아키타입)을 기준으로 판정한다 — "이 워크스페이스를
 * 열면 가장 취약한 채널에서 부딪힐 수 있다"는 게 실제로 하루가 겪은
 * 패턴이었다(§0-1 인용 결함 목록 참고).
 *
 * 단, 프리셋 채널이 아예 없는 아키타입(christmas/lofi-study — 문서 자체가
 * "커스텀 채널 전용, 프리셋 없음"이라고 명시하는, 애초에 목록에서 고를 수
 * 없는 아키타입)은 이 최악값 계산에서 뺀다. 넣으면 senior-oldpop처럼 8/10
 * 아키타입이 실전 검증된 성숙한 워크스페이스가 단 2개의 의도적 미제공
 * 아키타입 때문에 "1/5 ⚠"로 나와 — 기술적으로는 맞지만 사용자에게는 틀린
 * 신호를 준다(멀쩡한 워크스페이스를 고장난 것처럼 보이게 함). 프리셋이
 * 없는 아키타입 자체의 결함은 이미 `npm run check:coverage`가 별도로
 * 보고한다(§TASK A) — 이 배지는 "이 워크스페이스를 지금 열면 실제로
 * 고를 수 있는 채널들"만 판정한다.
 */

const MIN_GENRE_POOL = 4; // ≤5곡/장르 규칙으로 18곡을 채우려면 최소 ceil(18/5)=4종 필요 (data/presets.ts 자체 주석 근거)
const MIN_MONEY_CHORD_POOL = 2;
const MIN_LYRIC_THEME_POOL = 18; // songCount 기본값

export interface WorkspaceReadinessItem {
  id: string;
  labelKo: string;
  ok: boolean;
  detailKo: string;
}

export interface WorkspaceReadiness {
  items: WorkspaceReadinessItem[];
  passCount: number;
  total: number;
}

function genrePoolSizeForArchetype(archetype: ChannelArchetype): number {
  const ids = new Set(channelPresets.filter(c => c.archetype === archetype).flatMap(c => c.preferredGenres));
  return ids.size;
}

function lyricThemePoolSizeForArchetype(archetype: ChannelArchetype, lyricLanguage: LyricLanguage): number {
  const opts = { channel: { archetype, preferredMoods: [] } as never, customLyricThemeScene: undefined, lyricLanguage, customConcept: '' };
  return lyricThemesForOptions(opts).length;
}

function isDedicatedAudienceProfile(archetype: ChannelArchetype): boolean {
  return AUDIENCE_PROFILE_ID_BY_ARCHETYPE[archetype] !== 'general';
}

function hasPresetChannel(archetype: ChannelArchetype): boolean {
  return channelPresets.some(c => c.archetype === archetype);
}

/** verifiedPackCount는 호출자가 이미 가진 실측(listPacks 결과 등)을 그대로 넘긴다 — 여기서 IndexedDB에 다시 접근하지 않는다(순수 함수 유지). */
export function computeWorkspaceReadiness(workspace: WorkspaceDefinition, verifiedPackCount: number): WorkspaceReadiness {
  // 프리셋 채널이 하나도 없는 아키타입(christmas/lofi-study 등, 순수 커스텀
  // 전용)은 빼고 판정한다 — 전부 빠지면(이론상 불가능하지만) 전체 목록으로
  // 안전하게 되돌아간다.
  const pickable = workspace.archetypeIds.filter(hasPresetChannel);
  const archetypes = pickable.length ? pickable : workspace.archetypeIds;
  const genreMin = archetypes.length ? Math.min(...archetypes.map(genrePoolSizeForArchetype)) : 0;
  const moneyChordMin = archetypes.length ? Math.min(...archetypes.map(a => moneyChordRotationPool(a).length)) : 0;
  const lyricThemeMin = archetypes.length ? Math.min(...archetypes.map(a => lyricThemePoolSizeForArchetype(a, workspace.defaultLyricLanguage))) : 0;
  const allDedicated = archetypes.length > 0 && archetypes.every(isDedicatedAudienceProfile);

  const items: WorkspaceReadinessItem[] = [
    { id: 'genre-pool', labelKo: '장르 풀', ok: genreMin >= MIN_GENRE_POOL, detailKo: `${genreMin}종 (기준 ≥${MIN_GENRE_POOL})` },
    { id: 'money-chord-pool', labelKo: '머니코드 회전 풀', ok: moneyChordMin >= MIN_MONEY_CHORD_POOL, detailKo: `${moneyChordMin}종 (기준 ≥${MIN_MONEY_CHORD_POOL})` },
    { id: 'lyric-theme-pool', labelKo: 'lyricTheme 풀', ok: lyricThemeMin >= MIN_LYRIC_THEME_POOL, detailKo: `${lyricThemeMin}종 (기준 ≥${MIN_LYRIC_THEME_POOL})` },
    { id: 'audience-profile', labelKo: 'audienceProfile 전용', ok: allDedicated, detailKo: allDedicated ? '전용' : 'general 폴백 포함' },
    { id: 'verified-packs', labelKo: '실전 검증', ok: verifiedPackCount > 0, detailKo: `${verifiedPackCount}세트` }
  ];

  return { items, passCount: items.filter(i => i.ok).length, total: items.length };
}
