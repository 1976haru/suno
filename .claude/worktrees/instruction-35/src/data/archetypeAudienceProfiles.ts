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

/**
 * 지시문 15 (TASK B) — bridgeInstruction.ts의 titleLocalizedInstructionLineFor가
 * `opts.channel.archetype === '...'`로 하드코딩하던 "레트로 톤 안내문" 분기를
 * 정책 테이블로 옮긴다. 동작은 바꾸지 않는다 — 기존에 실제로 레트로 톤 힌트를
 * 받던 정확히 그 3개 아키타입만 담는다. TITLE_LOCALIZED_REQUIRED_ARCHETYPES와는
 * 다른 축이다: 그건 "titleLocalized 필드 자체가 필요한가", 이건 "그 필드를
 * 어떤 톤으로 안내하는가".
 */
export const TITLE_ERA_HINT_RETRO_ARCHETYPES: ReadonlySet<ChannelArchetype> = new Set<ChannelArchetype>([
  'senior-morning',
  'showa-70s',
  'oldpop-lounge'
]);

/**
 * 지시문 15 (TASK B) — designGate.ts/gateDataContract.ts 둘 다
 * `channel.archetype === 'senior-morning'`으로 하드코딩하던 "genre-max
 * 자동 조정 예외" 분기를 정책 테이블로 옮긴다(두 파일이 반드시 같은 판정을
 * 내려야 하므로 값을 여기 하나로 공유 — 지금까지는 두 파일에 리터럴이
 * 따로 있어 하나만 바뀌면 조용히 어긋날 수 있었다). designGate.ts 자체의
 * 원래 주석(TASK F)이 설명하듯 senior-morning만 실측 검증된 고정 상한이
 * 필요하고, 다른 모든 아키타입은 후보 장르 풀 크기에 맞춰 자동 확장된다.
 */
export const FIXED_GENRE_MAX_PER_GENRE_ARCHETYPES: ReadonlySet<ChannelArchetype> = new Set<ChannelArchetype>([
  'senior-morning'
]);
