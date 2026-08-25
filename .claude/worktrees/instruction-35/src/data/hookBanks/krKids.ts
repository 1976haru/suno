import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * TASK E1 §5 — kr-kids workspace's own hook vocabulary, covering all 9
 * HookVocabularyOverride fields (leaving even one unset falls through to
 * hookBanks/kids.ts's shared bank, or worse — see §0-2's own measured
 * senior-leak risk). Every word below is drawn only from D1's own age-tier
 * vocabulary whitelist (data/kidsVocabularyWhitelist.ts) — kr-kids spans
 * all 3 tiers (T1's lullaby genre through T3's roleplay/bilingual genres),
 * so this pools words from all three rather than picking one tier.
 *
 * Verified programmatically against kidsVocabularyWhitelist.ts's own
 * whitelistViolations() checker (union of T1-T3, see docs/e1-report.md
 * §13-1[6]) — Korean and English are 0 violations. Japanese keeps a few
 * conjugated verb forms (あらって/かぞえて/...) matching hookBanks/kids.ts's
 * own established Japanese convention (D1's kids.ts does the same); the
 * checker only strips Korean/Japanese PARTICLES, not verb/adjective
 * conjugation, and its Japanese particle list doesn't include よ/で — a
 * pre-existing checker limitation (documented in that file's own doc
 * comment as a "common-safe minimum"), not a new whitelist violation. Every
 * Japanese word's dictionary root is confirmed present in the T1-T3 pools.
 */
const korean: HookVocabularyOverride = {
  imperativeVerbs: ['씻어요', '세어요', '뛰어요', '흔들어요', '배워요'],
  imperativeObjects: ['손을', '책을', '그림을', '장난감을', '공을', '풍선을', '글자를', '숫자를', '강아지를', '자동차를', '버스를', '별을'],
  imperativeTails: ['다같이', '함께', '모두', '다시', '또'],
  vocativeLeads: ['같이 놀아요', '같이 배워요', '모두 놀아요', '다시 배워요', '또 배워요', '같이 세어요', '모두 뛰어요', '다같이 놀아요'],
  vocativeAddressees: ['친구야', '우리 친구야', '작은 친구야', '큰 친구야', '강아지야', '토끼야'],
  nounModifiers: ['빨간', '노란', '파란', '큰', '작은', '빠른', '즐거운', '신나는', '재미있는', '씩씩한', '포근한', '따뜻한', '예쁜'],
  nounObjects: ['자동차', '버스', '비행기', '풍선', '공', '장난감', '친구', '책', '그림', '숫자', '고양이', '토끼'],
  declarativeStems: ['함께 좋아요', '다같이 신나요', '같이 재미있어요', '모두 기뻐요', '다시 고마워요', '또 자랑스러워요'],
  declarativeTails: ['숫자를', '친구를', '장난감을', '별을', '토끼를', '고양이를']
};

const english: HookVocabularyOverride = {
  imperativeVerbs: ['Wash', 'Count', 'Jump', 'Wave', 'Learn'],
  imperativeObjects: ['the Hand', 'the Book', 'the Picture', 'the Toy', 'the Ball', 'the Balloon', 'the Number', 'the Puppy', 'the Car', 'the Bus', 'the Bunny', 'the Friend'],
  imperativeTails: ['Together', 'All Together', 'All', 'We Together', 'We All'],
  vocativeLeads: ['We Play Together', 'We Learn Together', 'We Count Together', 'We Jump Together', 'We Wave Together', 'Play Again', 'Learn Again', 'We Meet Again'],
  vocativeAddressees: ['Little Friend', 'Big Friend', 'Little One', 'Little Bunny', 'Little Puppy', 'Little Kitty'],
  nounModifiers: ['Red', 'Yellow', 'Blue', 'Big', 'Little', 'Fast', 'Happy', 'Excited', 'Fun', 'Brave', 'Cozy', 'Warm', 'Pretty'],
  nounObjects: ['Car', 'Bus', 'Airplane', 'Balloon', 'Ball', 'Toy', 'Friend', 'Book', 'Picture', 'Number', 'Puppy', 'Bunny'],
  declarativeStems: ['We Play', 'We Learn', 'We Count', 'We Meet Again', 'We Play Again', 'Together We Learn'],
  declarativeTails: ['Number', 'Friend', 'Toy', 'Picture', 'Ball', 'Book']
};

const japanese: HookVocabularyOverride = {
  // Conjugated forms (て-form) — dictionary roots あらう/かぞえる/とぶ/ふる/まなぶ are confirmed whitelist verbs; see file doc comment on the checker's conjugation-blindness.
  imperativeVerbs: ['あらって', 'かぞえて', 'とんで', 'ふって', 'まなんで'],
  imperativeObjects: ['てを', 'ほんを', 'えを', 'おもちゃを', 'ボールを', 'ふうせんを', 'もじを', 'かずを', 'くるまを', 'バスを', 'でんしゃを', 'ともだちを'],
  imperativeTails: ['みんな', 'いっしょに', 'もう'],
  vocativeLeads: ['みんな遊ぼう', 'いっしょに学ぼう', 'いっしょに遊ぼう', 'みんな数えよう', 'いっしょに数えよう', 'もう遊ぼう'],
  vocativeAddressees: ['ともだち', '小さなともだち', '大きなともだち', 'わんわん', 'にゃんにゃん'],
  nounModifiers: ['あかい', 'きいろい', 'あおい', 'おおきい', 'ちいさい', 'はやい', 'たのしい', 'うれしい', 'げんきな', 'ゆうきある', 'あたたかい', 'かわいい'],
  nounObjects: ['くるま', 'バス', 'でんしゃ', 'ひこうき', 'ふうせん', 'ボール', 'おもちゃ', 'ともだち', 'ほん', 'え', 'かず', 'かさ'],
  // Dictionary-root stems (あそぶ/まなぶ/かぞえる/あう), same conjugation-blindness note as imperativeVerbs above.
  declarativeStems: ['みんなであそぶ', 'いっしょにまなぶ', 'いっしょにかぞえる', 'また会う', 'また遊ぶ', 'もう一度あう'],
  declarativeTails: ['かずを', 'ともだちを', 'おもちゃを', 'えを', 'ほんを', 'かさを']
};

export function krKidsOverride(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
