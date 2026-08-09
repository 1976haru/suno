import type { ChannelArchetype } from '../types';

/**
 * 지시문 12 (TASK C-1) — 검증된 품질 설정(오디언스 프로파일)이 채널의
 * `audience`(AgeGroup) 필드가 아니라 아키타입에 고정되게 하는 명시적 테이블.
 *
 * 실측 근거 (data/audienceProfiles.ts의 audienceProfileForChannelArchetype가
 * 기존에 `workspace.id !== 'senior-oldpop'`으로 senior-oldpop 전체를
 * 예외 처리하던 것을 대체한다):
 *
 *   senior-oldpop 워크스페이스는 10개 아키타입을 묶고 있는데, 그중 실제로는
 *   4개(j2000s/modern-chill/city-night/kids)가 시니어가 아니라 각자 다른
 *   오디언스를 의도적으로 쓴다 — 프리셋 채널로 실측 확인:
 *     millennium-jpop (archetype: j2000s)        audience: 'general'
 *     chill-hours (archetype: modern-chill)       audience: 'twenties'
 *     city-night-drive (archetype: city-night)    audience: 'thirtiesForties'
 *     little-singalong-radio (archetype: kids)    audience: 'kids'
 *   이 4개는 오늘도 AUDIENCE_PROFILE_BY_AGE_GROUP을 거쳐 전부
 *   GENERAL_AUDIENCE_PROFILE(twenties/thirtiesForties/general) 또는
 *   KIDS_AUDIENCE_PROFILE(kids)로 귀결된다 — 아래 값은 이 실측 결과를
 *   그대로 고정한 것이며, 동작을 바꾸지 않는다.
 *
 *   반면 oldpop-lounge/christmas/lofi-study는 presets.ts에 프리셋 채널이
 *   전혀 없다 — 순수 커스텀 채널 전용 아키타입이라, 사용자가 채널을 만들
 *   때 `audience` 필드를 무엇으로 두느냐에 따라 조용히 다른 프로필을
 *   받았다. 지시문 12가 지적한 oldpoplounge(실측 tempoCeiling 132, 기대
 *   100)가 정확히 이 경로 — oldpop-lounge는 아래에서 'senior'로 고정한다.
 *
 * christmas/lofi-study는 실측 근거(프리셋)가 없다 — 추정이다:
 *   christmas: 올드팝 계열과 같은 시니어 타깃으로 유추 ('senior').
 *   lofi-study: modern-chill과 같은 계열(로파이/집중)로 유추 ('general').
 *   근거 없는 추정이므로 여기에 그렇게 명시한다 — 실측 데이터가 생기면
 *   교체할 것.
 */
export const AUDIENCE_PROFILE_ID_BY_ARCHETYPE: Record<ChannelArchetype, string> = {
  'senior-morning': 'senior',
  'showa-cafe': 'senior',
  'showa-70s': 'senior',
  'oldpop-lounge': 'senior',
  // 추정 — 프리셋 채널 없음, 올드팝/시니어 계열과 같은 타깃으로 유추.
  christmas: 'senior',

  j2000s: 'general',
  'modern-chill': 'general',
  'city-night': 'general',
  // 추정 — 프리셋 채널 없음, modern-chill과 같은 계열로 유추.
  'lofi-study': 'general',

  kids: 'kids',

  'kr-2030-pop': 'kr-2030-emotional',
  'jp-2030-pop': 'jp-2030-melodic',
  'kr-kids-song': 'kr-kids',
  'jp-kids-song': 'jp-kids',
  'kr-idol-male': 'kr-idol-male',
  'kr-idol-female': 'kr-idol-female'
};

/**
 * 지시문 12 (TASK C-2) — titleLocalized가 packagingLanguage(결국
 * channel.market/packagingLanguage 오버라이드) 하나로 스키마에서 통째로
 * 사라지던 문제의 아키타입 단위 정책. 이 집합에 속한 아키타입은 market
 * 오버라이드로 packagingLanguage가 english가 되더라도 이중언어 제목이
 * 유지된다 — bridgeInstruction.ts의 titleLocalizedInstructionLineFor,
 * bridgeImport.ts의 결측 신고 로직 둘 다 이 집합을 참조한다.
 */
export const TITLE_LOCALIZED_REQUIRED_ARCHETYPES: ReadonlySet<ChannelArchetype> = new Set<ChannelArchetype>([
  'senior-morning',
  'showa-cafe',
  'showa-70s',
  'oldpop-lounge',
  'christmas',
  'j2000s'
]);
