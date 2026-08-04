/**
 * TASK D1 §3-3/§3-4 — age-tier vocabulary whitelists for kids content.
 *
 * The existing kids safety check (core/kidsLyricEngine.ts's
 * KIDS_FORBIDDEN_TERMS) is blacklist-only: anything not explicitly matched
 * passes. §0-2 measured this directly — 12/12 real little-singalong-radio
 * songs passed the blacklist while still containing senior-register leaks
 * ("그 마음을", "이 순간을") that a blacklist can never catch because they
 * aren't forbidden, just outside a small child's vocabulary. This file adds
 * the "only allow what's on this tier's list" half of the two-layer defense
 * kidsLyricSafetyIssues() applies (whitelist first, blacklist as the
 * unchanged last line of defense — see kidsLyricEngine.ts).
 *
 * Scope: this is deliberately the "common-safe minimum" the D1 doc asks
 * for, not Korean- or Japanese-specific content (that's E1/F1's job — see
 * D1 §7). Every list here is generic enough to be safe content for either
 * workspace; E1/F1 extend per-tier lists with their own education/onomatopoeia
 * vocabulary rather than replacing these.
 */
import type { LyricLanguage } from '../types';

export type KidsAgeTierId = 'kids-t1' | 'kids-t2' | 'kids-t3';
export type KidsWhitelistLanguage = Extract<LyricLanguage, 'korean' | 'japanese' | 'english'>;

export interface KidsVocabularyWhitelist {
  tierId: KidsAgeTierId;
  language: KidsWhitelistLanguage;
  /** Concrete nouns a child at this tier knows first-hand (animals, family, colors, vehicles, ...). */
  nouns: string[];
  /** Actions a child at this tier actually performs themselves. */
  verbs: string[];
  /** Sensory/concrete descriptors only — no abstract qualities. */
  adjectives: string[];
  /** Named emotions appropriate to this tier — see D1 §4's per-tier topic column. */
  emotionWords: string[];
}

// T1 (0-2세) — 자장가 / 까꿍 / 가족 / 동물 소리
const koreanT1: KidsVocabularyWhitelist = {
  tierId: 'kids-t1',
  language: 'korean',
  nouns: ['엄마', '아빠', '아기', '우리', '달', '별', '토끼', '강아지', '고양이', '자장가', '이불', '베개', '눈', '손', '까꿍', '친구'],
  verbs: ['자요', '웃어요', '안아요', '봐요', '만나요', '불러요', '놀아요'],
  adjectives: ['포근한', '따뜻한', '예쁜', '작은'],
  emotionWords: ['좋아요', '편안해요', '행복해요']
};

const japaneseT1: KidsVocabularyWhitelist = {
  tierId: 'kids-t1',
  language: 'japanese',
  nouns: ['おかあさん', 'おとうさん', 'あかちゃん', 'つき', 'ほし', 'うさぎ', 'わんわん', 'にゃんにゃん', 'ふとん', 'まくら', 'て', 'いないいない'],
  verbs: ['ねんね', 'わらう', 'だっこ', 'みる', 'あう', 'あそぶ'],
  adjectives: ['ぽかぽか', 'あたたかい', 'かわいい', 'ちいさい'],
  emotionWords: ['すき', 'だいすき', 'あんしん', 'しあわせ']
};

const englishT1: KidsVocabularyWhitelist = {
  tierId: 'kids-t1',
  language: 'english',
  nouns: ['mommy', 'daddy', 'baby', 'moon', 'star', 'bunny', 'puppy', 'kitty', 'blanket', 'pillow', 'hand', 'peekaboo'],
  verbs: ['sleep', 'smile', 'hug', 'look', 'meet', 'play'],
  adjectives: ['cozy', 'warm', 'pretty', 'little'],
  emotionWords: ['happy', 'safe', 'glad']
};

// T2 (2-4세) — 동작 지시 / 숫자 1~5 / 색깔 / 탈것
const koreanT2: KidsVocabularyWhitelist = {
  tierId: 'kids-t2',
  language: 'korean',
  nouns: ['하나', '둘', '셋', '넷', '다섯', '빨강', '노랑', '파랑', '초록', '자동차', '버스', '기차', '비행기', '풍선', '공', '장난감', '친구'],
  verbs: ['씻어요', '세어요', '뛰어요', '걸어요', '흔들어요', '만져요', '던져요', '굴려요', '놀아요'],
  adjectives: ['빨간', '노란', '파란', '큰', '작은', '빠른'],
  emotionWords: ['신나요', '재미있어요', '좋아요']
};

const japaneseT2: KidsVocabularyWhitelist = {
  tierId: 'kids-t2',
  language: 'japanese',
  nouns: ['いち', 'に', 'さん', 'し', 'ご', 'あか', 'きいろ', 'あお', 'みどり', 'くるま', 'バス', 'でんしゃ', 'ひこうき', 'ふうせん', 'ボール', 'おもちゃ', 'ともだち'],
  verbs: ['あらう', 'かぞえる', 'とぶ', 'あるく', 'ふる', 'さわる', 'なげる', 'ころがす', 'あそぶ'],
  adjectives: ['あかい', 'きいろい', 'あおい', 'おおきい', 'ちいさい', 'はやい'],
  emotionWords: ['たのしい', 'うれしい', 'すき']
};

const englishT2: KidsVocabularyWhitelist = {
  tierId: 'kids-t2',
  language: 'english',
  nouns: ['one', 'two', 'three', 'four', 'five', 'red', 'yellow', 'blue', 'green', 'car', 'bus', 'train', 'airplane', 'balloon', 'ball', 'toy', 'friend'],
  verbs: ['wash', 'count', 'jump', 'walk', 'wave', 'touch', 'throw', 'roll', 'play'],
  adjectives: ['red', 'yellow', 'blue', 'big', 'little', 'fast'],
  emotionWords: ['excited', 'fun', 'happy']
};

// T3 (4-7세) — 이야기 / 교육 / 감정 이름 / 안전
const koreanT3: KidsVocabularyWhitelist = {
  tierId: 'kids-t3',
  language: 'korean',
  nouns: ['학교', '선생님', '책', '그림', '글자', '숫자', '계절', '봄', '여름', '가을', '겨울', '안전', '신호등', '우산', '가족', '이웃'],
  verbs: ['배워요', '읽어요', '써요', '그려요', '도와줘요', '기다려요', '인사해요', '지켜요', '놀아요'],
  adjectives: ['즐거운', '신나는', '재미있는', '씩씩한', '조심스러운'],
  emotionWords: ['기뻐요', '설레요', '자랑스러워요', '고마워요', '든든해요']
};

const japaneseT3: KidsVocabularyWhitelist = {
  tierId: 'kids-t3',
  language: 'japanese',
  nouns: ['がっこう', 'せんせい', 'ほん', 'え', 'もじ', 'かず', 'きせつ', 'はる', 'なつ', 'あき', 'ふゆ', 'あんぜん', 'しんごう', 'かさ', 'かぞく', 'となり'],
  verbs: ['まなぶ', 'よむ', 'かく', 'てつだう', 'まつ', 'あいさつする', 'まもる', 'あそぶ'],
  adjectives: ['たのしい', 'うれしい', 'げんきな', 'ゆうきある', 'ちゅういぶかい'],
  emotionWords: ['うれしい', 'わくわく', 'ほこらしい', 'ありがたい', 'あんしんする']
};

const englishT3: KidsVocabularyWhitelist = {
  tierId: 'kids-t3',
  language: 'english',
  nouns: ['school', 'teacher', 'book', 'picture', 'letter', 'number', 'season', 'spring', 'summer', 'autumn', 'winter', 'safety', 'traffic light', 'umbrella', 'family', 'neighbor'],
  verbs: ['learn', 'read', 'write', 'draw', 'help', 'wait', 'greet', 'protect', 'play'],
  adjectives: ['fun', 'exciting', 'brave', 'careful', 'cheerful'],
  emotionWords: ['glad', 'excited', 'proud', 'thankful', 'confident']
};

const WHITELISTS: Record<KidsAgeTierId, Record<KidsWhitelistLanguage, KidsVocabularyWhitelist>> = {
  'kids-t1': { korean: koreanT1, japanese: japaneseT1, english: englishT1 },
  'kids-t2': { korean: koreanT2, japanese: japaneseT2, english: englishT2 },
  'kids-t3': { korean: koreanT3, japanese: japaneseT3, english: englishT3 }
};

export function kidsVocabularyWhitelistFor(tierId: KidsAgeTierId, language: KidsWhitelistLanguage): KidsVocabularyWhitelist {
  return WHITELISTS[tierId][language];
}

function flattenWhitelist(whitelist: KidsVocabularyWhitelist): string[] {
  return [...whitelist.nouns, ...whitelist.verbs, ...whitelist.adjectives, ...whitelist.emotionWords];
}

/**
 * Trailing grammatical particles, longest-first so "에서" isn't mis-stripped
 * as "에" + leftover "서". Whitelist entries are stored in their bare
 * (noun) or already-inflected (verb/adjective, e.g. "씻어요") form, so a
 * token only needs particle-stripping when checking against nouns.
 */
const KOREAN_PARTICLES = ['에서', '에게', '한테', '까지', '부터', '처럼', '같이', '보다', '밖에', '마다', '조차', '으로', '이랑', '과', '와', '랑', '을', '를', '이', '가', '은', '는', '에', '도', '만', '의', '로', '아', '야']
  .sort((a, b) => b.length - a.length);
const JAPANESE_PARTICLES = ['から', 'まで', 'より', 'では', 'には', 'とも', 'でも', 'けど', 'を', 'に', 'が', 'は', 'も', 'と', 'で', 'へ', 'の']
  .sort((a, b) => b.length - a.length);

function stripParticle(token: string, language: KidsWhitelistLanguage): string {
  const particles = language === 'korean' ? KOREAN_PARTICLES : language === 'japanese' ? JAPANESE_PARTICLES : [];
  for (const particle of particles) {
    if (token.length > particle.length && token.endsWith(particle)) return token.slice(0, -particle.length);
  }
  return token;
}

/**
 * Closed-class connective/pronoun words that carry no content meaning of
 * their own (unlike, say, "오늘 밤" which IS exactly the kind of senior-
 * register leak this whitelist exists to catch — so this list stays small
 * and deliberately excludes anything with independent semantic content).
 */
const ALWAYS_ALLOWED: Record<KidsWhitelistLanguage, string[]> = {
  korean: ['우리', '다같이', '같이', '함께', '모두', '다시', '또'],
  japanese: ['みんな', 'いっしょに', 'もう'],
  english: ['we', 'to', 'at', 'in', 'on', 'is', 'are', 'and', 'the', 'together', 'all', 'again']
};

function tokenize(text: string): string[] {
  return text
    .split('\n')
    .filter(line => !/^\s*\[.*\]\s*$/.test(line)) // structural tags like [chorus]
    .join(' ')
    .split(/[\s,.!?"'"'·、。]+/)
    .map(token => token.trim())
    .filter(Boolean);
}

/**
 * Returns the raw tokens in `text` that are outside `whitelist` — nouns
 * checked after particle-stripping, verbs/adjectives/emotion words and the
 * small always-allowed connective set checked as exact matches (they're
 * already stored pre-inflected). Deliberately simple substring/suffix
 * matching rather than full morphological analysis — a "common-safe
 * minimum" per D1 §3-1's own scoping note; E1/F1 extend the underlying
 * word lists rather than this matching logic.
 */
export function whitelistViolations(text: string, whitelist: KidsVocabularyWhitelist): string[] {
  const normalize = (s: string) => (whitelist.language === 'english' ? s.toLowerCase() : s);
  const allowedExact = new Set(flattenWhitelist(whitelist).concat(ALWAYS_ALLOWED[whitelist.language]).map(normalize));
  const allowedNouns = new Set(whitelist.nouns.map(normalize));
  const violations: string[] = [];
  for (const rawToken of tokenize(text)) {
    const token = normalize(rawToken);
    if (allowedExact.has(token)) continue;
    const stripped = stripParticle(token, whitelist.language);
    if (stripped !== token && allowedNouns.has(stripped)) continue;
    if (/^\d+$/.test(token)) continue;
    violations.push(rawToken);
  }
  return violations;
}
