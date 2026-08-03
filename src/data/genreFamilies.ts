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
    memberGenreIds: ['chanson', 'oldpop-orchestral-easy', 'oldpop-standards-torch', 'oldpop-slow-waltz-memory', 'oldpop-evening-lamp-ballad'],
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
    memberGenreIds: ['oldpop-warm-morning-glow', 'oldpop-hearth-acoustic', 'oldpop-sunlit-strings-pop', 'oldpop-gentle-lullaby-pop', 'oldpop-piano-ballad-70s'],
    commonTraitKo: '어쿠스틱 중심·느린 템포·최소 퍼커션',
    blendsWellWith: ['chanson-continental', 'rnb-soul', 'abba-carpenters', 'sixties-pop', 'vocal-jazz', 'seventies-soft', 'eighties-warm']
  },
  {
    id: 'sixties-pop',
    labelKo: '60년대 팝',
    descriptionKo: '두왑·브릴빌딩·비트팝의 짧고 단순한 훅',
    memberGenreIds: ['oldpop-doowop-harmony', 'oldpop-brill-building', 'oldpop-girl-group-wall', 'oldpop-sunshine-pop', 'oldpop-british-beat'],
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
    memberGenreIds: ['kr2030-electro-pop', 'kr2030-dawn-rnb', 'kr2030-y2k-retro'],
    commonTraitKo: '단단한 베이스·야간 도시·짧고 강한 훅',
    blendsWellWith: ['kr2030-band-emotional']
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
