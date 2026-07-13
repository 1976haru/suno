import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * Bright, simple, repeatable imagery for family-safe content — explicitly
 * excludes breakup/longing/alcohol vocabulary (old heart, darling, wine,
 * missing someone) that the default and other archetype banks use freely.
 */
const english: HookVocabularyOverride = {
  imperativeObjects: [
    'the Balloon', 'the Kite', 'the Toy Box', 'the Puppy', 'the Bicycle',
    'the Sandbox', 'the Swing', 'the Bubble Wand', 'the Picture Book', 'the Teddy Bear', 'the Crayon', 'the Treehouse'
  ],
  nounModifiers: ['Sunny', 'Bright', 'Happy', 'Playful', 'Rainbow', 'Starry', 'Bouncy', 'Cheerful', 'Silly', 'Sparkly', 'Merry', 'Giggly'],
  nounObjects: ['Rainbow', 'Star', 'Playground', 'Balloon', 'Kite', 'Puppy', 'Bicycle', 'Swing', 'Bubble', 'Teddy Bear', 'Crayon', 'Treehouse'],
  // 'My Friend' dropped from this list — it's also in the default bank, which
  // would let senior-morning and kids draw the identical vocative hook.
  vocativeAddressees: ['Little One', 'Sunshine', 'Buddy', 'My Star', 'Small Friend', 'Bright Eyes', 'Little Star', 'Giggly Pal'],
  declarativeStems: ['We Found', 'I Love', "I'm Dreaming of", 'We Sing of', 'I See', 'We Remember', 'I Wish for', 'We Believe in']
};

const korean: HookVocabularyOverride = {
  imperativeObjects: ['풍선을', '연을', '장난감 상자를', '강아지를', '자전거를', '모래놀이를', '그네를', '비눗방울을', '그림책을', '곰인형을', '크레파스를', '나무집을'],
  nounModifiers: ['맑은', '밝은', '행복한', '신나는', '무지개빛', '반짝이는', '통통 튀는', '즐거운', '엉뚱한', '반짝반짝', '명랑한', '까르르'],
  nounObjects: ['무지개', '별', '놀이터', '풍선', '연', '강아지', '자전거', '그네', '비눗방울', '곰인형', '크레파스', '나무집'],
  // '내 친구' dropped — also in the default bank (same collision reason as English).
  vocativeAddressees: ['반짝 친구', '꼬마야', '햇살아', '친구야', '작은 별아', '우리 친구', '반짝이', '작은 친구'],
  declarativeStems: ['함께 찾았어요', '정말 좋아해요', '꿈꾸고 있어요', '함께 불러요', '기억하고 있어요', '함께 나눠요', '바라고 있어요', '함께 믿어요']
};

const japanese: HookVocabularyOverride = {
  imperativeObjects: ['風船を', '凧を', 'おもちゃ箱を', '子犬を', '自転車を', '砂場を', 'ブランコを', 'シャボン玉を', '絵本を', 'くまのぬいぐるみを', 'クレヨンを', 'ツリーハウスを'],
  nounModifiers: ['晴れた', '明るい', '幸せな', '楽しい', '虹色の', 'きらきらの', 'はずむ', 'ゆかいな', 'おちゃめな', 'ぴかぴかの', 'にぎやかな', 'くすくすの'],
  nounObjects: ['虹', '星', '遊び場', '風船', '凧', '子犬', '自転車', 'ブランコ', 'シャボン玉', 'くまのぬいぐるみ', 'クレヨン', 'ツリーハウス'],
  // '友よ' dropped — also in the default bank (same collision reason as English).
  vocativeAddressees: ['なかまよ', '小さな子', '陽だまりよ', '相棒よ', '星屑よ', '小さな友よ', 'きらきらの子', '小さな星よ'],
  declarativeStems: ['一緒に見つけた', 'ずっと好きでいる', '夢に見ている', '一緒に歌う', '覚えていたい', '一緒に分け合う', '願っている', '一緒に信じる']
};

export function kidsOverride(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
