import { shuffle } from '../utils/prng';

/**
 * v4.3 (TASK A) — 이중언어 제목의 로컬(오프라인 프리뷰) 생성 경로용 데이터.
 *
 * 하루님의 요구: "그냥 직역하지 말고 올드팝 채널이면 올드팝 채널 감성에 맞는
 * 제목으로 해줘야 돼." 실전 경로(브릿지 지시문 -> 외부 코딩 에이전트)에서는
 * 그 에이전트가 emotionArc/listenerSituation을 읽고 직접 재해석해서 짓는다
 * (core/bridgeInstruction.ts의 titleLocalizedInstructionLineFor 참고) —
 * 이것이 진짜 창작이 일어나는 지점이다.
 *
 * 이 파일은 로컬 프리뷰 경로(core/titleLocalization.ts)가 쓰는 것으로, 영어
 * title의 단어를 옮기는 대신, 곡의 무드 카테고리 + 시대 감성에 맞는 완성된
 * 한국어/일본어 구절 풀에서 골라 조합한다 (영어 hook/title 텍스트를 전혀
 * 참조하지 않으므로 구조적으로 직역이 될 수 없다). data/titlePatterns.ts의
 * enTimeWords/enImagePairWords 조합 패턴과 같은 방식.
 */

export type TitleMoodCategory = 'longing' | 'warmth' | 'nostalgia' | 'hope' | 'farewell' | 'joy';

/** 영어 emotionArc/listenerSituation 텍스트에서 무드 카테고리를 추정하기 위한 키워드. 못 찾으면 arcPhase 기반 기본값으로 대체된다(항상 카테고리 하나로 귀결). */
const MOOD_KEYWORDS: Record<TitleMoodCategory, string[]> = {
  longing: ['miss', 'longing', 'yearn', 'wait', 'waiting', 'apart', 'distance', 'alone', 'reach'],
  warmth: ['warm', 'comfort', 'gentle', 'soft', 'cozy', 'embrace', 'hold', 'shelter', 'tender'],
  nostalgia: ['remember', 'memory', 'memories', 'old', 'faded', 'used to', 'back then', 'young', 'childhood', 'photograph'],
  hope: ['hope', 'new', 'morning', 'begin', 'bright', 'dawn', 'ahead', 'tomorrow', 'rise', 'again'],
  farewell: ['goodbye', 'leave', 'leaving', 'farewell', 'gone', 'empty', 'last', 'apart', 'letting go', 'end'],
  joy: ['dance', 'celebrate', 'laugh', 'sparkle', 'joy', 'saturday', 'party', 'bright night', 'shine', 'smile']
};

/** arcPlan.ts의 ArcPhase -> 기본 무드 카테고리. 키워드 매칭이 아무것도 못 찾았을 때만 쓰인다. */
export const MOOD_CATEGORY_BY_ARC_PHASE: Record<'opening' | 'rising' | 'peak' | 'easing' | 'closing', TitleMoodCategory> = {
  opening: 'hope',
  rising: 'warmth',
  peak: 'joy',
  easing: 'longing',
  closing: 'farewell'
};

export function detectMoodCategory(text: string, fallback: TitleMoodCategory): TitleMoodCategory {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(MOOD_KEYWORDS) as [TitleMoodCategory, string[]][]) {
    if (keywords.some(keyword => lower.includes(keyword))) return category;
  }
  return fallback;
}

/** 로컬 제목 뱅크가 구분하는 시대 어투 3종 + 키즈. genreTraits.eraTag(EraBucket)를 이 축으로 접는다. */
export type TitleEraFlavor = '7080' | '8090' | 'modern' | 'kids';

/** `eraTag` is GenrePack.eraTag — a plain string in practice populated from data/eraExclusions.ts's EraBucket values, but typed loosely (not the EraBucket union) at its source, so this accepts any string and only pattern-matches the buckets it recognizes. */
export function eraFlavorFor(eraTag: string | undefined, isKids: boolean): TitleEraFlavor {
  if (isKids) return 'kids';
  if (eraTag === '1950s-60s' || eraTag === '1970s') return '7080';
  if (eraTag === '1980s') return '8090';
  return 'modern';
}

interface KoreanPool {
  prefixes: string[];
  nounsByCategory: Record<TitleMoodCategory, string[]>;
}

// ---------------------------------------------------------------------------
// 한국어 뱅크 — 하루님이 준 예시 어투를 그대로 반영: "그 시절", "~하던 날",
// "잊지 못할", "다시 만나면" (7080), 2030/키즈는 별도 어투.
// ---------------------------------------------------------------------------
const KOREAN_POOLS: Record<TitleEraFlavor, KoreanPool> = {
  '7080': {
    prefixes: ['그 시절', '오래된', '잊지 못할', '다시 만나면', '저물어가는', '흘러간', '빛바랜', '아직도 남은', '돌아보면', '그리운'],
    nounsByCategory: {
      longing: ['그리움', '기다림', '그대 생각', '먼 하늘', '못다 한 말'],
      warmth: ['따뜻한 손길', '작은 위로', '포근한 밤', '다정한 목소리', '어깨 위 온기'],
      nostalgia: ['옛 노래', '추억', '골목길', '낡은 사진', '그날의 라디오'],
      hope: ['새 아침', '작은 소망', '내일의 문', '봄바람', '다시 뜨는 해'],
      farewell: ['마지막 인사', '뒷모습', '빈 자리', '떠난 자리', '못다 부른 노래'],
      joy: ['설렘', '웃음소리', '축제의 밤', '반짝이는 순간', '춤추던 밤']
    }
  },
  '8090': {
    prefixes: ['빛바랜 나날', '그 여름날', '지나온 길', '어느새', '멀어진', '가끔은', '문득 떠오른'],
    nounsByCategory: {
      longing: ['그대라는 계절', '보고픈 얼굴', '기다림의 끝'],
      warmth: ['너의 온도', '작은 쉼표', '어깨를 감싸는 밤'],
      nostalgia: ['테이프 속 노래', '옛 편지', '낡은 앨범'],
      hope: ['새로운 시작', '내일의 약속', '떠오르는 태양'],
      farewell: ['마지막 페이지', '남겨진 자리', '어긋난 계절'],
      joy: ['들뜬 밤', '거리의 불빛', '흥겨운 리듬']
    }
  },
  modern: {
    prefixes: ['오늘의', '지금 이 순간', '나만의', '조용한', '어느 날의', '작은', '요즘'],
    nounsByCategory: {
      longing: ['네 생각', '기다리는 마음', '멀어진 거리'],
      warmth: ['다정한 하루', '작은 온기', '포근한 순간'],
      nostalgia: ['지난 계절', '추억 한 조각', '옛 플레이리스트'],
      hope: ['새로운 하루', '설레는 아침', '작은 시작'],
      farewell: ['안녕이라는 말', '남겨진 밤', '엇갈린 걸음'],
      joy: ['반짝이는 밤', '들뜬 마음', '오늘의 기분']
    }
  },
  kids: {
    prefixes: ['깡충깡충', '반짝반짝', '두근두근', '살금살금', '데굴데굴', '뭉게뭉게'],
    nounsByCategory: {
      longing: ['엄마 생각', '친구를 기다려요'],
      warmth: ['포근한 이불', '따뜻한 품'],
      nostalgia: ['어제의 놀이터', '작은 추억'],
      hope: ['새로운 하루', '내일의 모험'],
      farewell: ['안녕 인사', '잘 자요'],
      joy: ['무지개길', '신나는 하루', '토끼의 소풍']
    }
  }
};

interface JapanesePool {
  prefixes: string[];
  nounsByCategory: Record<TitleMoodCategory, string[]>;
}

// ---------------------------------------------------------------------------
// 일본어 뱅크 — 가타카나(외来語) 음차를 피하기 위해 한자/히라가나 어휘만 사용.
// ---------------------------------------------------------------------------
const JAPANESE_POOLS: Record<TitleEraFlavor, JapanesePool> = {
  '7080': {
    prefixes: ['あの日の', '遠い', '忘れられない', '静かな', '色あせた', '懐かしい'],
    nounsByCategory: {
      longing: ['面影', '待ちわびる夜', '遠い声'],
      warmth: ['温もり', 'やさしい灯', '寄り添う夜'],
      nostalgia: ['思い出', '古い写真', '路地裏'],
      hope: ['朝の光', '小さな願い', '明日への扉'],
      farewell: ['さよなら', '空いた席', '別れの坂道'],
      joy: ['胸の高鳴り', '笑い声', '煌めく夜']
    }
  },
  '8090': {
    prefixes: ['過ぎ去った', 'あの夏の', '色あせぬ', 'ふとした'],
    nounsByCategory: {
      longing: ['遠い季節', '恋しい影'],
      warmth: ['優しい体温', '肩を寄せる夜'],
      nostalgia: ['古いテープ', '手紙の記憶'],
      hope: ['明日への一歩', '昇る朝日'],
      farewell: ['最後の頁', '残された椅子'],
      joy: ['浮かれた夜', '街の灯り']
    }
  },
  modern: {
    prefixes: ['今日の', 'この瞬間の', '静かな', '小さな'],
    nounsByCategory: {
      longing: ['君のこと', '待つ気持ち'],
      warmth: ['優しい一日', '小さな温もり'],
      nostalgia: ['過ぎた季節', '記憶の欠片'],
      hope: ['新しい朝', '小さな始まり'],
      farewell: ['さよならの言葉', '残された夜'],
      joy: ['煌めく夜', '弾む心']
    }
  },
  kids: {
    prefixes: ['ぴょんぴょん', 'きらきら', 'どきどき', 'そよそよ'],
    nounsByCategory: {
      longing: ['ママの匂い', '友だちを待つ'],
      warmth: ['あたたかい布団', 'やさしい腕'],
      nostalgia: ['きのうの公園', '小さな思い出'],
      hope: ['あたらしい一日', '明日の冒険'],
      farewell: ['おやすみの合図', 'またねの日'],
      joy: ['にじの道', 'たのしい一日']
    }
  }
};

export interface LocalizedTitleCandidate {
  text: string;
  /** true if only the noun (no time prefix) was used — kept short for the length cap. */
  nounOnly: boolean;
}

/** A prefix word repeated inside its own noun ("작은" + "작은 시작") reads as a stutter, not a phrase — skip that combination rather than let the caller filter it out downstream. Substring check (not word-split) so it also catches Japanese, which has no spaces. */
function hasWordOverlap(prefix: string, noun: string): boolean {
  const prefixWords = prefix.split(/\s+/).filter(Boolean);
  return prefixWords.some(word => word.length >= 2 && noun.includes(word));
}

/** Builds the ordered, seed-shuffled candidate pool for one song — the caller (core/titleLocalization.ts) walks this and takes the first that passes length/dedup checks. */
export function localizedTitleCandidates(
  language: 'korean' | 'japanese',
  category: TitleMoodCategory,
  eraFlavor: TitleEraFlavor,
  seed: number
): LocalizedTitleCandidate[] {
  const pool = language === 'korean' ? KOREAN_POOLS[eraFlavor] : JAPANESE_POOLS[eraFlavor];
  const nouns = shuffle(pool.nounsByCategory[category], seed + 401);
  const prefixes = shuffle(pool.prefixes, seed + 907);
  const joiner = language === 'korean' ? ' ' : '';
  const combined: LocalizedTitleCandidate[] = [];
  for (const noun of nouns) {
    for (const prefix of prefixes) {
      if (hasWordOverlap(prefix, noun)) continue;
      combined.push({ text: `${prefix}${joiner}${noun}`, nounOnly: false });
    }
  }
  // noun-only fallbacks last, in case every prefixed combo is already used or too long
  for (const noun of nouns) {
    combined.push({ text: noun, nounOnly: true });
  }
  return combined;
}
