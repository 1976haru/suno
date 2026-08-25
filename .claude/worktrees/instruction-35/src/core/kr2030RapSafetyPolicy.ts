/**
 * 지시문 35 (TASK D) — kr-2030-rap 채널 전용 가사 안전 정책. core/krKidsPolicy.ts의
 * 패턴(카테고리 라벨이 붙은 정규식 블랙리스트, checkKrKidsSafety 하나로 합쳐
 * 노출)을 그대로 따르되, 위험 유형이 다르다 — 동요는 공포·따돌림·위험행동,
 * 랩은 폭력·무기·약물·범죄, 욕설·비속어, 집단 비하, 실존 인물·브랜드 실명이다
 * (§D-1). 유튜브 수익화 정책과 직결되므로 blocking 카테고리는 실제로 발매를
 * 막는다 — releaseReadiness.ts의 다른 모든 항목과 동일하게 status:'fail'이면
 * releaseReady:false다(§공통 규약 7의 "실측 없이 blocking 을 만들지 않는다"에
 * 대한 답: 이 blocking은 추정 어휘 목록이 아니라 유튜브 커뮤니티 가이드라인
 * 자체가 근거인 카테고리라 실측 대기 없이 막는 것이 맞다고 판단 — 대신 D-4의
 * "첫 세트 전곡 사람 확인"으로 오탐/누락을 보완한다).
 *
 * advisory 카테고리는 englishLint.ts의 EnglishLintSeverity('blocking'|'advisory')
 * 명명을 그대로 따르지만, releaseReadiness.ts의 기존 관례(예:
 * krKidsPolicy.ts의 didacticToneAdvisory — labelKo에 "advisory"라고 적혀
 * 있어도 status는 여전히 fail/pass로 계산되고 releaseReady 산식은 라벨을
 * 구분하지 않는다)와 동일하게 다룬다 — 새 코드 경로를 만들지 않는다.
 *
 * 이 파일의 어휘 목록은 시작점이다(실측 0세트) — D-4가 요구하는 "첫 세트
 * 전곡 사람 확인"으로 오탐/누락을 실측해 넓혀간다. 동요 정책의 own doc
 * comment와 같은 정직한 한계: 어휘 수준 블랙리스트지 서사적 판단이 아니다.
 */

export type Kr2030RapSafetySeverity = 'blocking' | 'advisory';

export interface Kr2030RapSafetyIssue {
  category: string;
  severity: Kr2030RapSafetySeverity;
}

interface CategorizedPattern {
  category: string;
  pattern: RegExp;
}

// ---------------------------------------------------------------------------
// blocking — §D-2. 유튜브 수익화 정책과 직결.
// ---------------------------------------------------------------------------
const BLOCKING_PATTERNS: CategorizedPattern[] = [
  {
    category: 'violence-weapons-drugs-crime',
    pattern: /\b(gun|pistol|rifle|knife|stab(?:bing)?|shoot(?:ing)?|shot\s*him|kill(?:ing|er)?|murder|gang\s*war|robbery|robbing|assault|cocaine|heroin|meth(?:amphetamine)?|drug\s*deal(?:er|ing)?)\b|총|칼로\s*찌|살인|마약\s*거래|코카인|필로폰|강도질|폭행/i
  },
  {
    category: 'profanity-slurs',
    // 실측 없는 시작 목록 — 명백한 욕설·비속어 대표 어휘. D-4 실측으로 확장.
    pattern: /\b(fuck(?:ing|er|ed)?|shit(?:ty)?|bitch(?:es)?|whore|slut)\b|씨발|개새끼|병신|좆같|썅/i
  },
  {
    category: 'group-bias',
    // 인종·성별·지역·종교 비하 — 실측 없는 시작 목록, D-4 실측으로 확장.
    pattern: /\bretard(?:ed)?\b|김치녀|한남충|틀딱|맘충/i
  },
  {
    category: 'real-person-brand',
    // src/../genreLibrary.test.ts의 famousArtistNames(가공의 아티스트 모방
    // 금지) 목록과 같은 취지 — 여기서는 가사 "안에" 실명이 등장하는 것을
    // 막는다(스타일 프롬프트의 avoidTraits 문구와 별개 레이어).
    pattern: /\b(adele|beatles|beyonce|bts|bruno mars|celine dion|ed sheeran|taylor swift|the weeknd|drake|kanye|nike|adidas|gucci|rolex|instagram|tiktok)\b/i
  }
];

// ---------------------------------------------------------------------------
// advisory — §D-2.
// ---------------------------------------------------------------------------
const ADVISORY_PATTERNS: CategorizedPattern[] = [
  {
    category: 'conspicuous-consumption',
    pattern: /\b(lambo(?:rghini)?|private\s*jet|louis\s*vuitton|bentley|stack(?:s|ing)?\s*(?:of\s*)?cash|diamond\s*chain)\b|명품\s*자랑|현금\s*다발/i
  },
  {
    category: 'aggressive-battle-framing',
    pattern: /\b(diss\s*track|smoke\s*(?:you|him|her|them)|catch\s*(?:these\s*)?hands|body(?:ing)?\s*(?:you|him))\b|디스전|맞짱/i
  }
];

function matchCategories(text: string, patterns: CategorizedPattern[]): string[] {
  return patterns.filter(({ pattern }) => pattern.test(text)).map(({ category }) => category);
}

/** 이 텍스트(한 곡의 가사 전체)에서 발견된 blocking/advisory 이슈 카테고리. */
export function checkKr2030RapSafety(text: string): { blocking: string[]; advisory: string[] } {
  return {
    blocking: matchCategories(text, BLOCKING_PATTERNS),
    advisory: matchCategories(text, ADVISORY_PATTERNS)
  };
}
