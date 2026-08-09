/**
 * TASK v3.63 (TASK B) — a real user asked for "18곡을 선택하면 큰 틀에서
 * 샹송+pop, pop이나 r&b 등 유사한 장르는 조합하면 좋겠어": the app had genre ids
 * as a flat list with no "similar to each other" axis at all. A GenreFamily
 * is a named, musically-coherent cluster a user can pick as a single unit
 * instead of hand-picking individual genre ids — see setDirector.ts's
 * chooseGenreIdsFromFamilies and components/steps/Step2Plan.tsx's family
 * checkboxes for how a selection turns into an actual genre allocation.
 */
export interface GenreFamily {
  id: string;
  labelKo: string;
  descriptionKo: string;
  memberGenreIds: string[];
  /** The musical trait tying this family together — shown in the UI, not sent to the LLM. */
  commonTraitKo: string;
  /** Other families that blend well with this one — advisory only, never blocks a selection (see spec's own "막지 마십시오" instruction). */
  blendsWellWith: string[];
}

export const GENRE_FAMILIES: GenreFamily[] = [
  {
    id: 'chanson-continental',
    labelKo: '샹송·콘티넨탈',
    descriptionKo: '아코디언과 현악, 낭송조 보컬의 유럽풍 올드팝',
    // 지시문 21 (TASK B) — oldpop-night-chanson(밤 샹송)은 프랑스 샹송
    // 계열이라는 정체성 자체가 이 families의 핵심 근거(labelKo가 "샹송")와
    // 직접 일치해 추가. 기존 chanson과는 장르 id가 다르지만(보컬 성별
    // 중립 vs 남성 인티메이트) 같은 계열로 묶이는 것 자체는 타당 — 한
    // family 안에서도 세부 캐릭터가 갈리는 것은 abba-carpenters/warm-melody
    // 등 다른 family에도 이미 있는 정상 패턴.
    // 지시문 21 (TASK A) — oldpop-italian-canzone(이탈리안 칸초네)도 같은
    // "유럽풍 올드팝" 정체성(labelKo·descriptionKo와 직접 일치)이라 추가.
    // 프랑스 샹송과는 국가·오페라풍 남성 리드라는 세부 캐릭터가 다르지만
    // night-chanson과 동일한 논리로 이 family에 속한다.
    memberGenreIds: ['chanson', 'oldpop-orchestral-easy', 'oldpop-standards-torch', 'oldpop-slow-waltz-memory', 'oldpop-evening-lamp-ballad', 'oldpop-night-chanson', 'oldpop-italian-canzone'],
    commonTraitKo: '아코디언·현악·왈츠 박자·낭송조 보컬',
    blendsWellWith: ['warm-melody', 'vocal-jazz']
  },
  {
    id: 'rnb-soul',
    labelKo: 'R&B·소울',
    descriptionKo: '그루브와 가스펠 화음이 있는 따뜻한 소울',
    memberGenreIds: ['oldpop-motown-pop-soul', 'oldpop-philly-soul-sweet', 'retro-soul-pop', 'oldpop-quiet-storm-warm', 'neo-soul'],
    commonTraitKo: '그루브 베이스·가스펠 화음·혼 섹션',
    blendsWellWith: ['sixties-pop', 'eighties-warm']
  },
  {
    id: 'abba-carpenters',
    labelKo: '유로팝·소프트팝',
    descriptionKo: '아바·카펜터스 계열의 겹친 하모니와 확장 화음',
    memberGenreIds: ['oldpop-europop-glow', 'oldpop-baroque-pop', 'oldpop-close-harmony-duo', 'oldpop-soft-rock-am', 'oldpop-sunshine-pop'],
    commonTraitKo: '겹친 하모니·확장 화음·밝은 어쿠스틱 편성',
    blendsWellWith: ['warm-melody', 'sixties-pop']
  },
  {
    id: 'warm-melody',
    labelKo: '따뜻한 멜로디',
    descriptionKo: '어쿠스틱 중심의 느리고 편안한 멜로디',
    // 지시문 21 (TASK B) — oldpop-rainy-ballad-blues는 기존 8개 family
    // 중 어느 것에도 완벽히 들어맞지 않는다(전기 기타·트레몰로·스프링
    // 리버브는 다른 family의 아코디언/신스/브라스 팔레트와 다름). 가장
    // 가까운 근거: 느린 템포·절제된 다이내믹·인티메이트 보컬이라는
    // 이 family의 정의(commonTraitKo "느린 템포·최소 퍼커션")와 가장
    // 잘 맞고, 이 family는 이미 chanson-continental/vocal-jazz 등
    // 멜랑콜릭 계열과 blendsWellWith로 연결돼 있어 발라드블루스의
    // 무드와 자연스럽게 어울린다. 새 family를 만들지 않고 근거를 남겨
    // 기존 8개 중 하나로 편입.
    // 지시문 21 (TASK A) — oldpop-six-eight-slow-ballad(6/8 슬로우 발라드)도
    // "느린 템포·최소 퍼커션"이라는 이 family의 정의와 직접 일치(6/8
    // 트리플렛 스윙 자체가 퍼커션이 절제된 느린 발라드 피트)해 추가.
    memberGenreIds: ['oldpop-warm-morning-glow', 'oldpop-hearth-acoustic', 'oldpop-sunlit-strings-pop', 'oldpop-gentle-lullaby-pop', 'oldpop-piano-ballad-70s', 'oldpop-rainy-ballad-blues', 'oldpop-six-eight-slow-ballad'],
    commonTraitKo: '어쿠스틱 중심·느린 템포·최소 퍼커션',
    blendsWellWith: ['chanson-continental', 'rnb-soul', 'abba-carpenters', 'sixties-pop', 'vocal-jazz', 'seventies-soft', 'eighties-warm']
  },
  {
    id: 'sixties-pop',
    labelKo: '60년대 팝',
    descriptionKo: '두왑·브릴빌딩·비트팝의 짧고 단순한 훅',
    // 지시문 21 (TASK B) — 두왑 분화 2종은 oldpop-doowop-harmony의 직계
    // 형제 장르(같은 화성·같은 시대, 템포/무드만 다름)라 같은 family에
    // 넣는 것이 자연스럽다.
    memberGenreIds: ['oldpop-doowop-harmony', 'oldpop-brill-building', 'oldpop-girl-group-wall', 'oldpop-sunshine-pop', 'oldpop-british-beat', 'oldpop-doowop-ballad', 'oldpop-doowop-uptempo'],
    commonTraitKo: '짧은 구성·단순 다이어토닉 훅·클로즈하모니',
    blendsWellWith: ['abba-carpenters', 'rnb-soul', 'warm-melody']
  },
  {
    id: 'vocal-jazz',
    labelKo: '보컬 재즈·라운지',
    descriptionKo: '확장 화음과 브러시 드럼의 라운지 재즈',
    memberGenreIds: ['smooth-jazz-lounge', 'bossa-cafe', 'jazz-pop', 'oldpop-standards-torch', 'oldpop-yacht-west-coast'],
    commonTraitKo: '확장 화음·브러시 드럼·콘트라베이스',
    blendsWellWith: ['chanson-continental', 'warm-melody']
  },
  {
    id: 'seventies-soft',
    labelKo: '70년대 소프트',
    descriptionKo: '70년대 소프트록·포크록의 따뜻한 편성',
    memberGenreIds: ['oldpop-soft-rock-am', 'oldpop-folk-rock-70s', 'oldpop-countrypolitan', 'oldpop-piano-ballad-70s', 'oldpop-close-harmony-duo'],
    commonTraitKo: '어쿠스틱과 일렉트릭의 균형·라디오 프렌들리 코러스',
    blendsWellWith: ['warm-melody', 'abba-carpenters']
  },
  {
    id: 'eighties-warm',
    labelKo: '80년대 따뜻함',
    descriptionKo: '80년대 어덜트 컨템포러리의 부드러운 신스와 오케스트라',
    memberGenreIds: ['oldpop-adult-contemporary-80s', 'oldpop-orchestral-ballad-80s', 'oldpop-light-synth-pop-warm', 'oldpop-soft-duet-80s'],
    commonTraitKo: '부드러운 신스 패드·오케스트라 스트링·듀엣 보컬',
    blendsWellWith: ['rnb-soul', 'warm-melody']
  },
  // TASK B1 — kr-2030 workspace families. blendsWellWith only links to other
  // kr2030 families (never an oldpop/senior family) so a set built from
  // these two never pulls in olpop-* genres.
  {
    id: 'kr2030-band-emotional',
    labelKo: '밴드·감성',
    descriptionKo: '라이브 밴드 사운드와 어쿠스틱 질감의 한국 2030 감성 팝',
    memberGenreIds: ['kr2030-emo-band-pop', 'kr2030-ost-ballad', 'kr2030-acoustic-folk'],
    commonTraitKo: '라이브 밴드 사운드·선명한 후렴·어쿠스틱 질감',
    blendsWellWith: ['kr2030-night-groove']
  },
  {
    id: 'kr2030-night-groove',
    labelKo: '나이트·그루브',
    descriptionKo: '단단한 베이스와 야간 도시 무드의 한국 2030 팝',
    // 지시문 21 (TASK A) — 신규 2종 모두 밴드형(kr2030-band-emotional)보다
    // 그루브 중심 정체성이라 이 family에 편입. kr2030-noir-deep-house는
    // "야간 도시" 정체성이 직접 일치. kr2030-lofi-swing-hiphop은 라이브
    // 밴드 사운드가 아니라 스윙 붐뱁 그루브·따뜻한 베이스가 핵심이라
    // (band-emotional보다) 이 family와 더 가깝다 — 근거를 남겨 편입.
    memberGenreIds: ['kr2030-electro-pop', 'kr2030-dawn-rnb', 'kr2030-y2k-retro', 'kr2030-noir-deep-house', 'kr2030-lofi-swing-hiphop'],
    commonTraitKo: '단단한 베이스·야간 도시·짧고 강한 훅',
    blendsWellWith: ['kr2030-band-emotional']
  },
  // TASK C1 — jp-2030 workspace families. blendsWellWith only links to
  // other jp2030 families (never a kr2030 or senior/oldpop family) so a set
  // built from these two never pulls in another workspace's genres.
  {
    id: 'jp2030-band-cinematic',
    labelKo: '밴드·시네마틱',
    descriptionKo: '밴드 사운드와 극적인 사비 전개의 일본 2030 팝',
    memberGenreIds: ['jp2030-melodic-jrock', 'jp2030-anime-cinematic', 'jp2030-heisei-nostalgia'],
    commonTraitKo: '밴드 사운드·극적 사비·서사적 전개',
    blendsWellWith: ['jp2030-groove-urban']
  },
  {
    id: 'jp2030-groove-urban',
    labelKo: '그루브·어반',
    descriptionKo: '퍼포먼스 비트와 세련된 도시적 질감의 일본 2030 팝',
    memberGenreIds: ['jp2030-dance-vocal', 'jp2030-kawaii-idol', 'jp2030-neo-citypop', 'jp2030-chill-neosoul'],
    commonTraitKo: '퍼포먼스 비트·도시적 화성·세련된 질감',
    blendsWellWith: ['jp2030-band-cinematic']
  }
];

export function getGenreFamilyById(id: string): GenreFamily | undefined {
  return GENRE_FAMILIES.find(family => family.id === id);
}

/**
 * TASK B-3 — family → genre-count allocation rule: 1 family uses all 5(ish)
 * of its own members; 2 uses 3-4 each; 3+ uses 2-3 each — always keeping
 * total genre variety at 4-9 so an 18-song pack is neither monotonous (<=2
 * genres) nor scattered (>=10). Callers pass in each family's own
 * memberGenreIds (already deduplicated across families by the caller, since
 * families intentionally share members — see e.g. oldpop-sunshine-pop in
 * both abba-carpenters and sixties-pop).
 */
export function membersPerFamilyForSelection(familyCount: number): number {
  if (familyCount <= 1) return 5;
  if (familyCount === 2) return 4;
  return 3;
}

/** True when family `a` lists `b` (or vice versa) as a good blend — advisory only, never used to block a selection. */
export function familiesBlendWell(aId: string, bId: string): boolean {
  const a = getGenreFamilyById(aId);
  const b = getGenreFamilyById(bId);
  if (!a || !b) return false;
  return a.blendsWellWith.includes(bId) || b.blendsWellWith.includes(aId);
}
