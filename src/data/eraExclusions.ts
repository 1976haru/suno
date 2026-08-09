/**
 * TASK v3.62 (TASK 1/2) — the oldpop-* family (TASK v3.61) spans four real
 * eras (1950s-60s through 1980s, plus a deliberately timeless "warmth"
 * sub-family with no decade). A real bridge pack put "warm string pad
 * swell" and "layered backing" into a 1962-flavored British-beat track —
 * production textures that didn't exist yet. An LLM composing this song
 * already knows that; the old template-dictation approach never gave it
 * the chance to apply that knowledge, because it forced verbatim
 * introTextureText/instrumentSet regardless of era. This table is the
 * shared source both the bridge instruction (prevention) and
 * compositionScorer.ts (detection) read from, so the two stay in sync by
 * construction — same pattern as data/arrangementVocabulary.ts.
 */
// TASK B1 — '2000s' added for kr-2030's Y2K retro genre (kr2030-y2k-retro).
// Additive only: the existing 3 real decades + 'timeless' keep their exact
// prior meaning and membership below.
export type EraBucket = '1950s-60s' | '1970s' | '1980s' | 'timeless' | '2000s';

// 지시문 12 (TASK A-2) — 354종 전수 세분화 버킷(신) 소스. eraBucketForGenreId
// 아래에서만 쓴다 — genreLibrary/index.ts의 eraTag 표시 파생은 여전히 이
// 파일 자신의 (구) 30종 ERA_BUCKET_BY_GENRE_ID를 그대로 읽는다(표시용 텍스트
// 의도적 무변경).
import { ERA_BUCKETS_BY_GENRE_ID } from './eraBuckets';

/** Hardcoded from the oldpop-* family's own 1-A/1-B/1-C/1-D grouping (see genreLibrary/index.ts's oldpopGenrePacks comment) — the era each of the 28 genres was authored for. Genres not listed here (every non-oldpop genre) have no era restriction. */
export const ERA_BUCKET_BY_GENRE_ID: Record<string, EraBucket> = {
  'oldpop-doowop-harmony': '1950s-60s',
  'oldpop-brill-building': '1950s-60s',
  'oldpop-girl-group-wall': '1950s-60s',
  'oldpop-sunshine-pop': '1950s-60s',
  'oldpop-baroque-pop': '1950s-60s',
  'oldpop-british-beat': '1950s-60s',
  'oldpop-soft-rock-am': '1970s',
  'oldpop-orchestral-easy': '1970s',
  'oldpop-close-harmony-duo': '1970s',
  'oldpop-folk-rock-70s': '1970s',
  'oldpop-motown-pop-soul': '1970s',
  'oldpop-philly-soul-sweet': '1970s',
  'oldpop-countrypolitan': '1970s',
  'oldpop-europop-glow': '1970s',
  'oldpop-yacht-west-coast': '1970s',
  'oldpop-piano-ballad-70s': '1970s',
  'oldpop-adult-contemporary-80s': '1980s',
  'oldpop-quiet-storm-warm': '1980s',
  'oldpop-orchestral-ballad-80s': '1980s',
  'oldpop-light-synth-pop-warm': '1980s',
  'oldpop-soft-duet-80s': '1980s',
  'oldpop-standards-torch': '1980s',
  'oldpop-warm-morning-glow': 'timeless',
  'oldpop-gentle-lullaby-pop': 'timeless',
  'oldpop-hearth-acoustic': 'timeless',
  'oldpop-sunlit-strings-pop': 'timeless',
  'oldpop-slow-waltz-memory': 'timeless',
  'oldpop-evening-lamp-ballad': 'timeless',
  // TASK B1 — only kr2030-y2k-retro is era-mapped; the other 5 kr-2030
  // genres are deliberately left unmapped (no era restriction), same as
  // every non-oldpop genre in this file.
  'kr2030-y2k-retro': '2000s',
  // TASK C1 — reuses B1's '2000s' bucket (not a new EraBucket member) for
  // jp-2030's own Heisei-nostalgia genre; the other 6 jp-2030 genres are
  // deliberately left unmapped, same reasoning as kr2030 above.
  'jp2030-heisei-nostalgia': '2000s'
};

export const ERA_LABEL: Record<EraBucket, string> = {
  '1950s-60s': '1950s-60s',
  '1970s': '1970s',
  '1980s': '1980s',
  timeless: 'timeless (no specific decade)',
  '2000s': '2000s'
};

/**
 * Anachronistic-for-this-era production/instrumentation terms — the task's
 * own explicit list. 1950s-60s forbids things that arrived LATER (string
 * pads/synth pads/gated reverb/wide stereo are 70s-80s production); 1970s
 * forbids things that arrived even later still (gated reverb/digital synth/
 * sidechain are 80s+); 1980s forbids things that are too EARLY/narrow for
 * it (a mono-leaning mix or tape-only production reads as 1950s-60s, not
 * 1980s). Deliberately short and literal (not a broad vocabulary) — this is
 * a blocking check, so false positives here would stall the recomposition
 * loop (TASK 3) on a song that's actually fine.
 */
export const ERA_FORBIDDEN_DESCRIPTORS: Record<EraBucket, string[]> = {
  '1950s-60s': ['string pad', 'synth pad', 'gated reverb', 'wide stereo'],
  '1970s': ['gated reverb', 'digital synth', 'sidechain'],
  '1980s': ['mono-leaning mix', 'mono mix', 'tape-only production'],
  timeless: [],
  // TASK B1 — no anachronism list specified by the source market research
  // (§3-3's own "없는 조건을 지어내지 마십시오"); left empty like `timeless`
  // rather than inventing one.
  '2000s': []
};

// 지시문 12 (TASK A-2) — REAL_ERA_BUCKETS와 같은 순서(가장 이른 시대부터)로
// 이 파일의 (구) 5분류 EraBucket을 data/eraBuckets.ts의 (신) 세분화
// EraBucket(연 단위 10년 단위 + era-neutral, 354종 전수 부여) 쪽으로 매핑한다.
const COARSE_BUCKET_PRIORITY: { coarse: EraBucket; fineMembers: string[] }[] = [
  { coarse: '1950s-60s', fineMembers: ['1950s', '1960s'] },
  { coarse: '1970s', fineMembers: ['1970s'] },
  { coarse: '1980s', fineMembers: ['1980s'] },
  { coarse: '2000s', fineMembers: ['2000s'] }
];

// 지시문 12 (TASK A-2) — 이 6종은 (구) 시스템에서 이미 명시적으로
// 'timeless'(= "특정 연대 없음"이라는 의미 있는 값, null/"데이터 없음"과는
// 다른 상태)였다. 새 세분화 데이터에서는 이 6종도 다른 era-neutral 장르와
// 마찬가지로 ['era-neutral']을 받았지만, (구) 반환값 계약에서는 구분을
// 유지해야 한다 — tests/eraIdentityLeakage.test.ts가 이 정확한 계약을
// 고정한다. 아래 목록은 data/eraBuckets.ts 생성 시점의 oldpop-* 1-D
// 그룹(§A-4)과 정확히 동일하다.
const LEGACY_TIMELESS_GENRE_IDS = new Set([
  'oldpop-warm-morning-glow',
  'oldpop-gentle-lullaby-pop',
  'oldpop-hearth-acoustic',
  'oldpop-sunlit-strings-pop',
  'oldpop-slow-waltz-memory',
  'oldpop-evening-lamp-ballad'
]);

/**
 * 지시문 12 (TASK A-2) — 근본 수정: 이 함수는 더 이상 위의 수기 관리
 * `ERA_BUCKET_BY_GENRE_ID`(30/354만 커버, eraTag 표시용으로만 남김)를 읽지
 * 않는다. 대신 genreLibrary 354종 전수에 부여된 data/eraBuckets.ts의
 * `ERA_BUCKETS_BY_GENRE_ID`(세분화 버킷, 354/354 커버)를 읽어, 그 장르의
 * 세분화 버킷들이 이 파일의 (구) 5분류 중 어느 것과 겹치는지로 판정한다 —
 * 함수의 반환 타입·시그니처·"찾지 못하면 null(=시대 미지정)" 계약은 그대로라
 * 이 함수를 호출하는 17개 이상 파일은 전혀 수정하지 않아도 된다.
 *
 * 실측 효과: showa-modern/city-pop-soft(쇼와카페 채널)·kayokyoku-70s 등
 * 쇼와70년대 4종(showa-seventies 채널)처럼 예전에는 eraTag 자유문자열만
 * 있고 이 함수에서는 전부 null(미지정)로 잡히던 장르들이 이제 정확한
 * 버킷을 반환한다. oldpop-motown-pop-soul도 (신) 버킷이 ['1960s','1970s']로
 * 정정되어 있어 '1950s-60s'가 우선 매칭된다(모타운 전성기 정정, §A-4).
 * 장르가 여러 (구) 버킷에 걸치면 이 우선순위(이른 시대 먼저)의 첫 매칭을
 * 반환한다 — Record<EraBucket, number> 단일 카운트 계약(eraSharesOf)과의
 * 호환을 위한 결정적 규칙이다.
 *
 * era-neutral(신)이면서 LEGACY_TIMELESS_GENRE_IDS에도 없는 나머지 ~298종은
 * (구) 시스템과 동일하게 null(=제너릭/generic)을 반환한다 — 이번 지시문의
 * 스코프는 "관문이 읽는 커버리지를 30->354로 넓히고 오류 2건을 정정"하는
 * 것이지, applyEraQuota의 generic 버킷 재분배 알고리즘 자체(실제 발매 팩의
 * 장르 분포에 영향)를 재설계하는 것이 아니다 — 그건 이 지시문이 명시적으로
 * 요구한 TASK A-3(era-neutral 정책 필드·분모 제외)의 몫이며, 이번 세션에서는
 * 완료하지 못했다(TASK E 보고에 명시).
 */
export function eraBucketForGenreId(genreId: string | undefined): EraBucket | null {
  if (!genreId) return null;
  if (LEGACY_TIMELESS_GENRE_IDS.has(genreId)) return 'timeless';
  const fineBuckets = ERA_BUCKETS_BY_GENRE_ID[genreId];
  if (!fineBuckets || !fineBuckets.length) return null;
  const match = COARSE_BUCKET_PRIORITY.find(({ fineMembers }) => fineBuckets.some(fine => fineMembers.includes(fine)));
  return match?.coarse ?? null;
}
