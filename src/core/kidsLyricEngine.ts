import type { LyricLanguage } from '../types';

/**
 * TASK v3.38 Part B3 — a self-contained kids-song lyric body composer,
 * deliberately NOT reusing core/lyricEngine.ts's composeLyrics: that
 * engine's situation/motif pools (coffee, cafe, commute, quiet longing) are
 * adult-lifestyle imagery, unsafe to reuse verbatim for a children's
 * channel. Title/hook generation is NOT reimplemented here — hookBanks/
 * kids.ts already gives core/lyricEngine.ts's composeHook/createTitleGenerator
 * a dedicated kid-safe vocabulary bank (imperativeObjects/nounModifiers/
 * vocativeAddressees/declarativeStems, no breakup/alcohol/longing terms),
 * wired in automatically whenever `archetype: 'kids'` is passed through — so
 * localGenerator.ts's existing nextTitle()/nextContestedTitle() calls
 * already produce safe titles/hooks for this channel. This module only
 * supplies the verse/chorus body content around that hook.
 */

export type KidsLyricTheme = 'animal' | 'season' | 'family' | 'friend' | 'play' | 'school' | 'counting' | 'hangul';

export const KIDS_LYRIC_THEMES: KidsLyricTheme[] = ['animal', 'season', 'family', 'friend', 'play', 'school', 'counting', 'hangul'];

export interface KidsLyricInput {
  language: LyricLanguage;
  title: string;
  hook: string;
  seed: number;
}

export interface ComposedKidsLyrics {
  lyrics: string;
  hookPhrase: string;
}

function pick<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length];
}

export function themeForSeed(seed: number): KidsLyricTheme {
  return KIDS_LYRIC_THEMES[Math.abs(seed) % KIDS_LYRIC_THEMES.length];
}

// TASK v3.38 Part B3 — hand-written, original content only (see B3's "기존
// 동요 창작 금지" rule and referencesExistingKidsSong() below). Short
// sentences, easy vocabulary, one clear image per line, no forbidden topics.
const koreanVersePairs: Record<KidsLyricTheme, [string, string][]> = {
  animal: [
    ['멍멍이가 꼬리를 흔들어요', '야옹이는 기지개를 켜요'],
    ['토끼는 깡충깡충 뛰어가요', '오리는 뒤뚱뒤뚱 걸어가요'],
    ['병아리는 삐약삐약 노래해요', '다같이 손잡고 걸어가요']
  ],
  season: [
    ['봄에는 꽃들이 활짝 피어요', '나비가 훨훨 날아다녀요'],
    ['여름엔 시원한 바람이 불어요', '매미가 맴맴 노래해요'],
    ['가을엔 낙엽이 우수수 떨어져요', '겨울엔 하얀 눈이 내려요']
  ],
  family: [
    ['엄마 아빠 사랑해요', '우리 가족 최고예요'],
    ['할머니 할아버지 안녕하세요', '손잡고 걸어가요'],
    ['동생이랑 사이좋게 지내요', '함께 있어 행복해요']
  ],
  friend: [
    ['친구야 같이 놀자', '손잡고 뛰어가자'],
    ['함께 웃고 함께 나눠요', '사이좋게 지내봐요'],
    ['넘어져도 괜찮아 친구야', '다시 일어나면 돼요']
  ],
  play: [
    ['공을 굴리며 놀아요', '그네를 타고 놀아요'],
    ['블록을 쌓아 올려요', '숨바꼭질 해봐요'],
    ['비눗방울 날려봐요', '풍선을 불어봐요']
  ],
  school: [
    ['학교 가는 길 즐거워요', '친구들과 인사해요'],
    ['선생님이 반겨주세요', '새로운 걸 배워요'],
    ['글씨도 쓰고 그림도 그려요', '노래도 함께 불러요']
  ],
  counting: [
    ['하나 둘 셋 넷 세어봐요', '다섯 여섯 일곱 여덟'],
    ['손가락을 하나씩 세어요', '발가락도 세어봐요'],
    ['숫자놀이 참 재미있어요', '다 같이 세어봐요']
  ],
  hangul: [
    ['가나다라 배워봐요', '마바사아 읽어봐요'],
    ['글자들이 모여모여', '예쁜 말이 되어요'],
    ['한글 노래 불러봐요', '다 같이 읽어봐요']
  ]
};

const koreanBridge: Record<KidsLyricTheme, string[]> = {
  animal: ['동물 친구들 모두 모여서', '즐겁게 노래해요'],
  season: ['봄 여름 가을 겨울', '계절이 바뀌어요'],
  family: ['우리 가족 모두 모여서', '웃음꽃이 피어나요'],
  friend: ['친구들과 함께라면', '무엇이든 즐거워요'],
  play: ['신나게 뛰어놀아요', '오늘도 즐거운 하루'],
  school: ['오늘도 배우는 하루', '즐거운 학교 생활'],
  counting: ['하나부터 열까지', '다 같이 세어봐요'],
  hangul: ['가나다라 마바사', '한글은 참 재미있어']
};

const koreanChorusSupport: Record<KidsLyricTheme, string> = {
  animal: '다 같이 신나게 놀아요',
  season: '즐거운 계절 노래해요',
  family: '사랑해요 우리 가족',
  friend: '우리 우정 최고야',
  play: '신나게 놀아봐요',
  school: '매일매일 신나요',
  counting: '숫자놀이 재미있어',
  hangul: '한글 노래 즐거워요'
};

// TASK v3.38 Part B3 — lighter fallback for lyricLanguage overridden to
// English/Japanese on a kids channel (Korean is the default and primary use
// case per B0 — this is a smaller, single-theme pool, a disclosed scope
// decision, not a stub: it's real, safe, functional content).
const englishFallback = {
  versePairs: [
    ['The sun says hello, a bright new day', "Let's smile and sing and go out to play"],
    ['A little bird sings up in the tree', 'Clap your hands and sing with me'],
    ['We count our steps, one two three', 'Come along and sing with me']
  ] as [string, string][],
  bridge: ['All together now,', "let's sing out loud"],
  chorusSupport: "Sing along, it's a happy day"
};

const japaneseFallback = {
  versePairs: [
    ['おひさま にっこり あさが きた', 'わらって うたって あそぼうよ'],
    ['ことりが きの うえ うたってる', 'てを たたいて いっしょに うたおう'],
    ['いち に さん と かぞえよう', 'みんなで いっしょに うたおう']
  ] as [string, string][],
  bridge: ['みんなで いっしょに', 'うたおうよ'],
  chorusSupport: 'たのしいな みんなで うたおう'
};

function tags() {
  return { intro: '[short intro]', verse1: '[verse 1]', chorus: '[chorus]', verse2: '[verse 2]', bridge: '[short bridge]', finalChorus: '[final chorus]', end: '[end]' };
}

function buildChorusBlock(tag: string, hook: string, support: string): string {
  return `${tag}\n${hook}\n${support}`;
}

/**
 * TASK v3.38 Part B3 — chorus (hook + one support line) repeats 4 times
 * total (verse1->chorus, verse2->chorus, one extra repeat, final chorus),
 * identical text every time, matching the spec's "후렴 반복 3~4회" and the
 * genre convention that a children's song's hook line never varies once
 * introduced.
 */
export function composeKidsLyrics(input: KidsLyricInput): ComposedKidsLyrics {
  const { language, title, hook, seed } = input;
  const t = tags();
  const hookPhrase = hook.trim();
  const introLine = language === 'korean'
    ? `${title} 노래를 시작해요`
    : language === 'japanese'
      ? `${title} の うたを はじめよう`
      : `Let's sing "${title}" together`;

  if (language === 'korean') {
    const theme = themeForSeed(seed);
    const [verse1, verse2] = pick(koreanVersePairs[theme], seed + 3);
    const [verse1b, verse2b] = pick(koreanVersePairs[theme], seed + 7);
    const [bridgeLine1, bridgeLine2] = koreanBridge[theme];
    const support = koreanChorusSupport[theme];
    const chorusBlock = buildChorusBlock(t.chorus, hookPhrase, support);
    const finalChorusBlock = buildChorusBlock(t.finalChorus, hookPhrase, support);
    const lyrics = [
      `${t.intro}\n${introLine}`,
      `${t.verse1}\n${verse1}\n${verse2}`,
      chorusBlock,
      `${t.verse2}\n${verse1b}\n${verse2b}`,
      chorusBlock,
      chorusBlock,
      `${t.bridge}\n${bridgeLine1}\n${bridgeLine2}`,
      finalChorusBlock,
      t.end
    ].join('\n\n');
    return { lyrics, hookPhrase };
  }

  const fallback = language === 'japanese' ? japaneseFallback : englishFallback;
  const [verse1, verse2] = pick(fallback.versePairs, seed + 3);
  const [verse1b, verse2b] = pick(fallback.versePairs, seed + 7);
  const chorusBlock = buildChorusBlock(t.chorus, hookPhrase, fallback.chorusSupport);
  const finalChorusBlock = buildChorusBlock(t.finalChorus, hookPhrase, fallback.chorusSupport);
  const lyrics = [
    `${t.intro}\n${introLine}`,
    `${t.verse1}\n${verse1}\n${verse2}`,
    chorusBlock,
    `${t.verse2}\n${verse1b}\n${verse2b}`,
    chorusBlock,
    chorusBlock,
    `${t.bridge}\n${fallback.bridge[0]}\n${fallback.bridge[1]}`,
    finalChorusBlock,
    t.end
  ].join('\n\n');
  return { lyrics, hookPhrase };
}

// ---------------------------------------------------------------------------
// TASK v3.38 Part B3 — safety validators. Defense in depth: the hand-curated
// pools above never contain any of these terms, but this gives a testable,
// programmatic guarantee rather than relying purely on manual review, and
// catches anything injected via a future pool edit.
// ---------------------------------------------------------------------------

const KIDS_FORBIDDEN_TERMS: RegExp[] = [
  // Korean — fear/violence/death
  /무섭|공포|귀신|괴물|피가|죽|전쟁|총|칼로|폭력/,
  // Korean — excessive sadness / adult romance-pain
  /눈물이 멈추지|헤어지|이별|실연|그리워서 죽|외로워서 힘들/,
  // Korean — slang/trendy internet terms (representative sample)
  /ㅋㅋ|ㅇㅈ|존잘|헐대박|인싸|아싸/,
  // Korean — appearance judgment / competition framing
  /못생|뚱뚱|1등만|꼴찌는|이겨야만/,
  // English — fear/violence/death
  /\b(scary|frightening|monster|ghost|blood|kill|gun|war|violence|die|death)\b/i,
  // English — adult romance-pain / excessive sadness
  /\b(heartbreak|breakup|broken heart|crying forever|so lonely I could die)\b/i,
  // Japanese — fear/violence/death
  /怖い|幽霊|化け物|血が|殺|戦争|銃/,
  // Brand/commercial references (kids content must stay generic, no product placement)
  /\b(brand|sponsor|advertisement)\b/i
];

export function kidsLyricSafetyIssues(text: string): string[] {
  const issues: string[] = [];
  for (const pattern of KIDS_FORBIDDEN_TERMS) {
    if (pattern.test(text)) issues.push(`forbidden kids-content pattern: ${pattern.source}`);
  }
  return issues;
}

export function isKidsLyricSafe(text: string): boolean {
  return kidsLyricSafetyIssues(text).length === 0;
}

/**
 * TASK v3.38 Part B3 ("기존 동요 창작 금지") — a real, well-known nursery
 * rhyme's title/melody/lyric-opening must never be reproduced, even
 * inadvertently. Checked against generated titles and hook phrases.
 */
const KNOWN_EXISTING_KIDS_SONGS: RegExp[] = [
  /곰\s*세\s*마리/,
  /아기\s*상어/i,
  /baby\s*shark/i,
  /학교\s*종이?\s*땡땡땡/,
  /나비야/,
  /반짝반짝\s*작은\s*별/,
  /twinkle\s*twinkle\s*little\s*star/i,
  /산토끼/,
  /고향의\s*봄/,
  /뽀롱뽀롱\s*뽀로로/,
  /핑크퐁/i,
  /pinkfong/i,
  /cocomelon/i
];

export function referencesExistingKidsSong(text: string): boolean {
  return KNOWN_EXISTING_KIDS_SONGS.some(pattern => pattern.test(text));
}
