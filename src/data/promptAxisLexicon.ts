/**
 * 지시문 16 (TASK B-4) — "축 판정을 자유 정규식으로 하지 말 것 —
 * promptAxisLexicon 데이터로 한다. eraTag 자유 문자열 문제가 재발한다." This
 * file is the ONE place every stylePrompt clause's axis is decided from —
 * core/promptAxisMerge.ts's mergeAtom (TASK B) and scripts/promptLengthTrial.ts
 * (TASK A-2) both classify clauses through classifyClause below, never their
 * own ad-hoc regex.
 *
 * A "clause" is one comma-separated fragment of a real stylePrompt string
 * (e.g. "female soft head-voice lead", "3:10-3:35", "I-vi-IV-V doo-wop
 * progression") — real fixture text (20260808_oldpoplounge pack) drove every
 * pattern below; nothing here is speculative.
 */

export type PromptAxis =
  | 'era' | 'genre' | 'tempo' | 'leadVocal' | 'backingVocal'
  | 'instrument' | 'harmony' | 'structure' | 'intro'
  | 'arrangementDensity' | 'mix' | 'hookDevice' | 'duration';

export interface PromptAtom {
  axis: PromptAxis;
  text: string;
  /** locked = LLM이 바꿀 수 없음 (batchPreallocation.ts가 슬롯에서 직접 채운 값). creative = LLM 자유 (원문 프로즈에서 그대로 옮겨온 값). */
  locked: boolean;
}

/** 지시문 16 §B-2 — 프롬프트 안에 정확히 하나만 존재해야 하는 축. */
export const SINGLE_DECLARATION_AXES: readonly PromptAxis[] = ['era', 'tempo', 'leadVocal', 'intro', 'duration', 'arrangementDensity'];

/** 지시문 16 §B-2 — 여러 개 존재해도 되는 축. */
export const MULTIPLE_ALLOWED_AXES: readonly PromptAxis[] = ['genre', 'instrument', 'harmony', 'mix', 'hookDevice', 'backingVocal', 'structure'];

/**
 * intro 축 — 지시문 16 §B-4의 두 하위 그룹. 같은 프롬프트 안에 "즉시시작"과
 * "인트로 있음" 어휘가 함께 나오면 모순(실측 T1/T3/T8/T9/T10/T13/T16, 지시문
 * 16 §1-2) — introSubcategory가 이 판정에 쓰인다.
 */
export type IntroSubcategory = 'immediate' | 'has-intro';

// 지시문 68 (TASK B) — 'no instrumental intro'/'vocal enters immediately'/
// 'vocal starts immediately'가 이 목록에 없어서 브릿지(에이전트가 직접 쓴
// 프로즈)가 만든 실제 세 곡의 인트로 자기모순을 검사가 놓쳤다(§2.1
// 실측). 'no instrumental intro'는 INTRO_HAS_INTRO_PHRASES의 'instrumental
// intro'를 부분 문자열로 포함하지만(localGenerator.ts 966·2344행이 이미
// 기록한 함정), introSubcategory가 이 목록을 HAS_INTRO보다 먼저 검사하므로
// 여기 넣는 것만으로 그 절 자체는 올바르게 'immediate'로 분류된다.
const INTRO_IMMEDIATE_PHRASES = [
  'cold open', 'a cappella', 'singing starts immediately', 'straight into the hook',
  'no intro', 'no quiet fade-in', 'vocal-first opening', 'instrumental hook opens the song',
  'spoken-close a cappella hook opens the song', 'no instrumental intro',
  'vocal enters immediately', 'vocal starts immediately'
];

const INTRO_HAS_INTRO_PHRASES = [
  'short intro', 'intro texture', 'instrumental intro', 'intro swell', 'hook intro',
  'bar intro', 'intro opens', 'strum intro', 'chord intro', 'ensemble swell intro'
];

// 지시문 68 (TASK B) — 위 literal 추가는 이 세 표현"만" 고친다. 같은 함정의
// 일반형(HAS_INTRO 어휘 앞에 부정 접두어가 붙어 의미가 반대가 되는 경우,
// 예: "without a chord intro")을 전부 막으려면 판정 자체가 부정 접두어를
// 먼저 소거해야 한다 — introSubcategory에서 사용.
const NEGATION_PREFIX_WORDS = ['no', 'without', 'never'];

function includesNegatedHasIntroPhrase(lower: string): boolean {
  return INTRO_HAS_INTRO_PHRASES.some(phrase =>
    NEGATION_PREFIX_WORDS.some(negation => lower.includes(`${negation} ${phrase}`))
  );
}

const LEAD_VOCAL_PHRASES = ['lead', 'duet'];
/** leadVocal처럼 "lead"를 포함하지만 실제로는 backing 역할인 어휘 — 지시문 16 §1-3 실측(girl-group unison lead가 T2/T6/T7에서 진짜 리드와 중복). */
const BACKING_VOCAL_MARKERS = ['backing', 'responses', 'chorus vocals', 'unison lead'];

const INSTRUMENT_KEYWORDS = [
  'guitar', 'bass', 'drum', 'piano', 'organ', 'synth', 'string', 'violin', 'cello', 'brass',
  'horn', 'sax', 'flute', 'clarinet', 'harpsichord', 'glockenspiel', 'tambourine', 'mandolin',
  'banjo', 'woodwind', 'kit', 'snare', 'percussion', 'keys', 'harmonica', 'accordion', 'vibraphone'
];

const HARMONY_KEYWORDS = ['progression', 'movement', 'chord', 'maj7', 'harmony color'];
const HARMONY_ROMAN_NUMERAL_PATTERN = /\b[iIvV]+-[iIvV]+-[iIvV]+/;

const STRUCTURE_KEYWORDS = [
  'chorus', 'bridge', 'verse', 'opens the song', 'returns', 'stop-time', 'fill', 'drops out', 'strips to'
];

const MIX_KEYWORDS = ['mix', 'ambience', 'mono', 'studio', 'room tone', 'coloration', 'room sound', 'echo'];

const HOOK_DEVICE_KEYWORDS = ['hook'];

/**
 * 실측 버그(tests/v343.test.ts 회귀) — bare "arrangement" 키워드만으로 판정
 * 하면 "then the full arrangement returns for the final chorus" 같은
 * 서술형(구조 축) 클로즈까지 arrangementDensity로 오분류돼, 그 뒤 단일
 * 선언 축 replace-in-place가 hookDeviceText의 일부를 통째로 지워버렸다
 * (hookDeviceText 값 자체가 콤마를 포함해, 재분류 시 두 클로즈로 쪼개지는
 * 게 원인). "이 클로즈가 밀도 선언 그 자체인가"를 실제로 판정하도록 좁힌다
 * — 밀도 형용사로 시작하고 6단어 이하인 짧은 클로즈만 인정한다
 * (ARRANGEMENT_DENSITY_TEXT_BY_LEVEL의 세 값 모두 이 형태를 만족한다).
 */
const ARRANGEMENT_DENSITY_START_WORDS = ['full', 'sparse', 'medium', 'moderate', 'spare', 'minimal', 'dense', 'light', 'thin', 'layered', 'voice-forward'];
// 지시문 33 (§3) — measure:checks 실측이 classifyClause를 반복 호출 경로의
// 실제 비용 지점으로 지목했다. 이 배열은 정적(런타임 변경 없음)이라 매
// 호출마다 new RegExp를 다시 만들 이유가 없다 — 모듈 로드 시 한 번만
// 컴파일한다. 결과는 완전히 동일(같은 패턴), 반복 생성만 없앤다.
const ARRANGEMENT_DENSITY_START_PATTERNS = ARRANGEMENT_DENSITY_START_WORDS.map(word => new RegExp(`^${word}\\b`));
function looksLikeArrangementDensityDeclaration(lower: string): boolean {
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6) return false;
  return ARRANGEMENT_DENSITY_START_PATTERNS.some(pattern => pattern.test(lower));
}

const TEMPO_PATTERN = /\b\d{2,3}\s*bpm\b/i;
const DURATION_PATTERN = /\b\d:\d{2}\s*-\s*\d:\d{2}\b/;
const ERA_PATTERN = /\b(early|mid|late)-\d{4}s\b|\b(19|20)\d0s\b/i;

/**
 * 지시문 37 (TASK B-2) — "섹션 한정" 개념. core/kpopSectionStyleShift.ts가
 * 넣는 "Verse: laid-back R&B, sparse arrangement" / "Chorus: EDM-influenced
 * drop, dense synth stack" 같은 클로즈는 벌스의 sparse와 후렴의 dense가
 * 서로 "모순되는 같은 축 중복 선언"이 아니라 애초에 다른 섹션을 향한
 * 서술이다 — SINGLE_DECLARATION_AXES(예: arrangementDensity)의 "프롬프트
 * 전체에 정확히 하나"라는 전제가 섹션 한정 클로즈에는 적용되지 않는다.
 * "Verse:"/"Chorus:" 같은 섹션 라벨로 시작하는 클로즈는 축 자체를 매기지
 * 않는다(undefined) — collapseSingleDeclarationDuplicates는 axis가 있는
 * 클로즈만 중복 제거 대상으로 삼으므로, 이렇게 하면 섹션이 다른 두
 * sparse/dense 클로즈가 같은 축 중복으로 오판되어 하나가 삭제되는 일이
 * 없다.
 */
export const SECTION_SCOPED_LABEL_PATTERN = /^(intro|verse\s*\d*|pre-chorus|chorus|post-chorus|bridge|final\s*chorus|outro|breakdown|dance\s*break|rap(?:\s*verse)?)\s*:/i;

/**
 * Word-boundary match, not a bare substring `.includes()` — real bug this
 * caught: "harpsichord" contains "chord" as a raw substring, which would
 * misclassify it as the harmony axis under naive `.includes()`. `\b` on a
 * multi-word phrase still only anchors the phrase's own start/end, so "opens
 * the song" etc. keep matching as whole phrases, not just as loose word sets.
 */
// 지시문 33 (§3) — includesAny는 classifyClause 안에서 클로즈 하나당 최대
// 9번(INSTRUMENT_KEYWORDS 등 정적 배열들) 불리고, 그때마다 배열의 모든
// phrase를 새 RegExp로 다시 컴파일했다 — 이 배열들은 전부 모듈 상수라 절대
// 안 바뀐다. phrases 배열 자체를 키로 쓰는 WeakMap으로 컴파일 결과를
// 캐시한다(같은 배열 참조 → 같은 컴파일된 RegExp[]) — 판정 로직·정규식
// 자체는 한 글자도 바뀌지 않는다, 반복 컴파일만 없앤다.
const compiledPhrasePatterns = new WeakMap<readonly string[], RegExp[]>();
function patternsFor(phrases: readonly string[]): RegExp[] {
  let compiled = compiledPhrasePatterns.get(phrases);
  if (!compiled) {
    compiled = phrases.map(phrase => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
    compiledPhrasePatterns.set(phrases, compiled);
  }
  return compiled;
}
function includesAny(lower: string, phrases: readonly string[]): boolean {
  return patternsFor(phrases).some(pattern => pattern.test(lower));
}

/**
 * Pure — classifies one already-trimmed clause. `isFirstClause` matters
 * because every real stylePrompt observed in this codebase's fixtures opens
 * with the genre name as its very first clause with no other reliable
 * marker (genre names are free text — "Sunshine Pop", "British Beat Pop",
 * "Doo-Wop Close Harmony" — there is no shared keyword to lexicon-match on,
 * unlike every other axis here). Order matters: era/tempo/duration/harmony
 * patterns are checked before the generic keyword scans since they're the
 * least ambiguous (a BPM number can never also look like an instrument
 * name).
 */
export function classifyClause(clause: string, isFirstClause: boolean): PromptAxis | undefined {
  const trimmed = clause.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();

  if (isFirstClause) return 'genre';
  // 지시문 37 (TASK B-2) — 섹션 한정 클로즈는 축 판정 자체를 건너뛴다(§ 위
  // SECTION_SCOPED_LABEL_PATTERN 문서 참고). isFirstClause 다음, 다른 모든
  // 판정보다 먼저 — "Chorus: ..." 클로즈가 STRUCTURE_KEYWORDS의 "chorus"에
  // 걸려 structure 축으로 잘못 분류되는 것도 함께 막는다.
  if (SECTION_SCOPED_LABEL_PATTERN.test(trimmed)) return undefined;
  if (TEMPO_PATTERN.test(lower)) return 'tempo';
  if (DURATION_PATTERN.test(lower)) return 'duration';
  if (ERA_PATTERN.test(lower)) return 'era';
  // 실측 버그(지시문 16, tests/v343.test.ts 회귀) — "final repeat of the hook
  // sung almost a cappella as the OUTRO tag"는 "a cappella"를 포함하지만
  // 실제로는 아웃트로/훅 묘사이지 인트로가 아니다. "outro"/"final"이 같은
  // 클로즈에 있으면 intro 어휘가 우연히 겹쳐도 intro로 판정하지 않는다 —
  // 그래야 hookDevice 축으로 정상 분류되어 mergeAtom이 intro replace-in-place
  // 대상으로 잘못 집어삼키지 않는다.
  const looksLikeOutro = /\boutro\b|\bfinal\b/.test(lower);
  if (!looksLikeOutro && (includesAny(lower, INTRO_IMMEDIATE_PHRASES) || includesAny(lower, INTRO_HAS_INTRO_PHRASES))) return 'intro';
  if (includesAny(lower, BACKING_VOCAL_MARKERS)) return 'backingVocal';
  if (includesAny(lower, LEAD_VOCAL_PHRASES)) return 'leadVocal';
  if (looksLikeArrangementDensityDeclaration(lower)) return 'arrangementDensity';
  if (HARMONY_ROMAN_NUMERAL_PATTERN.test(trimmed) || includesAny(lower, HARMONY_KEYWORDS)) return 'harmony';
  if (includesAny(lower, HOOK_DEVICE_KEYWORDS)) return 'hookDevice';
  if (includesAny(lower, MIX_KEYWORDS)) return 'mix';
  if (includesAny(lower, STRUCTURE_KEYWORDS)) return 'structure';
  if (includesAny(lower, INSTRUMENT_KEYWORDS)) return 'instrument';
  return undefined;
}

/** intro 축 클로즈 하나가 즉시시작/인트로있음 중 어느 하위 그룹인지 — 모순 판정(§B-5)에 쓰인다. classifyClause가 'intro'를 반환한 클로즈에만 의미 있음. */
export function introSubcategory(clause: string): IntroSubcategory | undefined {
  const lower = clause.trim().toLowerCase();
  if (includesAny(lower, INTRO_IMMEDIATE_PHRASES)) return 'immediate';
  // 지시문 68 (TASK B) — 부정 접두어(no/without/never) 뒤에 오는 HAS_INTRO
  // 어휘는 의미가 반대다("no instrumental intro" = 인트로가 없다는 선언).
  // literal 목록에 없는 조합도 여기서 일반적으로 막는다.
  if (includesNegatedHasIntroPhrase(lower)) return 'immediate';
  if (includesAny(lower, INTRO_HAS_INTRO_PHRASES)) return 'has-intro';
  return undefined;
}

/** 지시문 16 §A-2 — 삭제 금지 8종(TASK A-3/03 TASK C) 중 이 축 판정 시스템이 다루는 6개(장르·시대·BPM·리드보컬·핵심구조·길이). "핵심 악기"와 "사용자 선택"은 instrument/harmony 축에서 clause 위치(첫 번째)로 별도 결정한다 — 이 축 목록만으로는 "몇 번째 instrument/harmony 클로즈가 핵심인지"를 알 수 없기 때문. */
export const REQUIRED_AXES_BY_POSITION: readonly PromptAxis[] = ['genre', 'era', 'tempo', 'leadVocal', 'arrangementDensity', 'duration'];

/**
 * 지시문 58 (TASK A) — REQUIRED_AXES_BY_POSITION의 'genre' 뒤 축(era/tempo/
 * leadVocal/arrangementDensity/duration) 그대로를 misplaced 판정에 쓰면
 * 실측과 충돌한다: tests/promptSpecAllWorkspaces.test.ts가 이미 "warm male
 * baritone lead vocal, acoustic guitar, 92 BPM"(leadVocal이 첫 클로즈)을
 * "위반 없음"으로 검증하고 있고, promptBudget.ts's PROMPT_PRIORITY 자기
 * 히스토리(TASK v3.39 Part H)도 "vocal을 genre 바로 다음(때로 그 이전)으로
 * 옮긴다"는 기존 결정을 담고 있다 — vocal-먼저는 이 앱의 기존 관행이지
 * 결함이 아니다. 8/14에서 실측된 진짜 회귀는 시대·박자·길이·밀도가 장르보다
 * 앞에 오는 경우뿐("late-1950s memory through 1970s piano pop ballad
 * lens...")이라, REQUIRED_AXES_BY_POSITION 전체를 재사용하지 않고
 * leadVocal을 뺀 부분집합만 misplaced 판정에 쓴다(하지만
 * REQUIRED_AXES_BY_POSITION 자체는 그 문서화된 의도를 그대로 보존 —
 * 이 상수를 고치지 않는다).
 */
export const AXES_THAT_MUST_FOLLOW_GENRE: ReadonlySet<PromptAxis> = new Set(['era', 'tempo', 'arrangementDensity', 'duration']);
