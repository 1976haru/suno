import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/** Showa-modern kissaten imagery — vinyl, rotary phones, neon, jazz tape — deliberately disjoint from senior-morning's coffee/radio/letter vocabulary. */
const english: HookVocabularyOverride = {
  imperativeObjects: [
    'the Record Player', 'the Rotary Phone', 'the Neon Sign', 'the Streetlamp', 'the Typewriter',
    'the Film Reel', 'the Teacup', 'the Chandelier', 'the Piano', 'the Vinyl Sleeve', 'the Matchbox', 'the Jazz Tape'
  ],
  nounModifiers: ['Showa', 'Retro', 'Sepia', 'Neon-Lit', 'Old Tokyo', 'Vinyl-Era', 'Smoky', 'Rainy Ginza', 'Late-Night', 'Amber', 'Dim', 'Faded'],
  nounObjects: [
    'Record Player', 'Rotary Phone', 'Neon Sign', 'Streetlamp', 'Typewriter', 'Film Reel',
    'Teacup', 'Chandelier', 'Piano Keys', 'Vinyl Sleeve', 'Matchbox', 'Jazz Tape'
  ],
  // Overrides the vocative lead (not the addressee) and the declarative stem
  // — either half of a pair being archetype-exclusive is enough to make the
  // full joined string disjoint from senior-morning's, regardless of join order.
  vocativeLeads: ['Turn Back Time', 'Stay This Hour', 'Linger a While', 'Drift with Me', 'Hold This Moment', 'Wait in Smoke', 'Fade with Me', 'Circle Back'],
  declarativeStems: ['I Still Recall', 'I Keep Returning to', 'I Replay', 'I Still Hear', 'I Still Picture', 'I Keep Chasing', 'I Still Taste', 'I Live in']
};

const korean: HookVocabularyOverride = {
  imperativeObjects: ['전축을', '다이얼 전화를', '네온사인을', '가로등을', '타자기를', '필름을', '찻잔을', '샹들리에를', '피아노를', '레코드판을', '성냥갑을', '재즈테이프를'],
  nounModifiers: ['쇼와의', '레트로', '세피아빛', '네온이 켜진', '오래된 도쿄의', '바이닐 시대의', '자욱한', '비 오는 긴자의', '늦은 밤의', '호박빛', '어스름한', '빛바랜'],
  nounObjects: ['전축', '다이얼 전화', '네온사인', '가로등', '타자기', '필름', '찻잔', '샹들리에', '피아노 건반', '레코드판', '성냥갑', '재즈테이프'],
  vocativeLeads: ['시간을 되돌려요', '이 순간에 머물러요', '조금 더 머물러요', '나와 함께 흘러가요', '이 순간을 붙잡아요', '연기 속에서 기다려요', '나와 함께 사라져요', '다시 그때로 가요'],
  declarativeStems: ['아직도 떠올려요', '다시 재생해요', '아직도 들어요', '아직도 그려봐요', '계속 쫓고 있어요', '아직도 맛봐요', '깊이 간직해요', '오래 붙잡아요']
};

const japanese: HookVocabularyOverride = {
  imperativeObjects: ['電蓄を', 'ダイヤル電話を', 'ネオンサインを', '街灯を', 'タイプライターを', 'フィルムを', '茶碗を', 'シャンデリアを', 'ピアノを', 'レコード盤を', 'マッチ箱を', 'ジャズテープを'],
  nounModifiers: ['昭和の', 'レトロな', 'セピア色の', 'ネオンの灯る', '古い東京の', 'ビニール時代の', '煙る', '雨の銀座の', '深夜の', '琥珀色の', '薄暗い', '色あせた'],
  nounObjects: ['電蓄', 'ダイヤル電話', 'ネオンサイン', '街灯', 'タイプライター', 'フィルム', '茶碗', 'シャンデリア', 'ピアノの鍵盤', 'レコード盤', 'マッチ箱', 'ジャズテープ'],
  vocativeLeads: ['時を戻して', 'この時間にいて', 'もう少し留まって', '私と漂って', 'この瞬間を抱いて', '煙の中で待って', '私と消えて', 'また巡り会って'],
  declarativeStems: ['今も思い出す', 'もう一度再生する', 'まだ聴いている', 'まだ描いている', 'ずっと追いかけている', 'まだ味わっている', '深く刻んでいる', '長く抱えている']
};

export function showaCafeOverride(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
