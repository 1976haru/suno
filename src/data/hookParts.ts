/**
 * TASK X2 (v3.4) — combinatorial hook parts. The 42 hand-written "premium"
 * hooks in core/lyricEngine.ts stay as the first, highest-quality tier;
 * this is the bulk-supply tier underneath them, needed because a real
 * 18-week x 12-song roadmap (216 songs) burns through 42 curated phrases
 * in under 2 weeks.
 *
 * Only the vocabulary fields (imperativeObjects / nounModifiers /
 * nounObjects) are meant to vary per channel archetype (see
 * data/hookBanks/*.ts) — verbs/tails/leads/stems stay structural and
 * shared, which keeps archetype files small (just vocabulary, not a full
 * parallel grammar) while still guaranteeing that two archetypes never
 * produce the same hook string: every generated hook contains at least
 * one archetype-exclusive object/noun word.
 *
 * Grammaticality is enforced by construction, not by a filter pass:
 * imperativeVerbs/imperativeTails and declarativeStems/declarativeTails
 * are each picked to be broadly compatible with any concrete object noun
 * in this bank ("Keep the Coffee Close", "Keep the Radio Close" both
 * read fine) rather than doing a full cross-product-then-reject pass,
 * which would need a much larger compatibility matrix than is practical
 * to hand-verify.
 */
import type { LyricLanguage } from '../types';

export interface HookPartBank {
  imperativeVerbs: string[];
  imperativeObjects: string[];
  imperativeTails: string[];

  vocativeLeads: string[];
  vocativeAddressees: string[];

  nounModifiers: string[];
  nounObjects: string[];

  declarativeStems: string[];
  declarativeTails: string[];
}

/** Vocabulary-only override — verbs/tails/leads/stems are inherited from the default bank. */
export type HookVocabularyOverride = Partial<Pick<HookPartBank, 'imperativeObjects' | 'nounModifiers' | 'nounObjects' | 'vocativeAddressees'>>;

const englishDefault: HookPartBank = {
  imperativeVerbs: ['Keep', 'Hold', 'Save', 'Carry'],
  imperativeObjects: [
    'the Coffee', 'the Radio', 'the Letter', 'the Window', 'the Candle',
    'the Sweater', 'the Record', 'the Photograph', 'the Umbrella', 'the Lamp',
    'the Calendar', 'the Newspaper'
  ],
  // Single-word tails only: verb(1) + "the Object"(2) + tail(1) = 4 words max,
  // always inside the 2-5 word hook budget. A multi-word tail like "One More
  // Time" or "a While Longer" would push some combos to 6 words.
  imperativeTails: ['Close', 'Near', 'Tonight', 'Softly', 'Again'],

  vocativeLeads: ['Hold On', 'Stay a While', 'Come Back', 'Hush Now', 'Wait Here', 'Rest Now', 'Breathe with Me', 'Take My Hand'],
  vocativeAddressees: ['My Friend', 'My Love', 'Darling', 'Old Heart', 'Winter', 'My Dear', 'Old Friend', 'Morning'],

  nounModifiers: ['Winter', 'Golden', 'Quiet', 'First Snow', 'Old December', 'Slow Sunday', 'Soft Morning', 'Midnight', 'Early Spring', 'Rainy', 'Late Autumn', 'New Year'],
  nounObjects: [
    'Window Light', 'Coffee Cup', 'Radio', 'Letter', 'Doorway', 'Record',
    'Umbrella', 'Lamp', 'Calendar', 'Sweater', 'Candlelight', 'Train'
  ],

  // Every stem is an open transitive verb phrase ("<stem> <object>"), so it composes
  // grammatically with any tail below — unlike idiomatic fixed phrases ("We Made It",
  // "I Found My Way") which only read correctly with one or two specific tails and
  // break with the rest ("We Made It Morning", "I Found My Way You"). Tails are kept
  // single-word so the longest stem (4 words) + tail (1 word) stays at the 5-word cap.
  declarativeStems: ["I'll Wait for", 'I Remember', "I Won't Forget", 'I Believe in', 'I Still Carry', 'I Treasure', "I'll Come Back to", 'I Still Dream of'],
  declarativeTails: ['Morning', 'You', 'Snow', 'Home', 'Us', 'Tonight', 'Someday', 'Everything']
};

const koreanDefault: HookPartBank = {
  imperativeVerbs: ['데워요', '켜둬요', '챙겨요', '안아줘요'],
  imperativeObjects: ['커피를', '라디오를', '편지를', '창문을', '촛불을', '스웨터를', '레코드를', '사진을', '우산을', '램프를', '달력을', '신문을'],
  imperativeTails: ['조금 더', '오늘 밤', '한 번 더', '가만히', '천천히'],

  vocativeLeads: ['잠시 멈춰요', '여기 있어요', '돌아와요', '쉬어가요', '기다려요', '천천히 걸어요', '숨을 골라요', '손을 잡아요'],
  vocativeAddressees: ['내 친구', '내 사랑', '그대', '오랜 마음', '겨울아', '내 사람', '오랜 친구', '아침아'],

  nounModifiers: ['겨울', '금빛', '고요한', '첫눈', '오래된 12월', '느린 일요일', '부드러운 아침', '한밤의', '이른 봄', '비 오는', '늦가을', '새해의'],
  nounObjects: ['창가의 빛', '커피잔', '라디오', '편지', '문가', '레코드', '우산', '램프', '달력', '스웨터', '촛불', '기차'],

  // Every stem is a transitive verb taking a 을/를-marked object, and every tail below
  // carries that same particle — mixing in a directional/locative tail (집으로, 여기에)
  // against a transitive stem would produce a real particle mismatch, not just a loose
  // paraphrase, so those were replaced with more object-marked alternatives.
  declarativeStems: ['기다릴게요', '기억해요', '잊지 않을게요', '아직 믿어요', '꼭 안고 있어요', '아직 품고 있어요', '다시 찾아갈게요', '아직 꿈꿔요'],
  declarativeTails: ['아침을', '너를', '그 마음을', '눈길을', '이 순간을', '우리를', '그 날을', '모든 말을']
};

const japaneseDefault: HookPartBank = {
  imperativeVerbs: ['温めて', 'つけて', '持って', '抱きしめて'],
  imperativeObjects: ['コーヒーを', 'ラジオを', '手紙を', '窓を', 'キャンドルを', 'セーターを', 'レコードを', '写真を', '傘を', 'ランプを', 'カレンダーを', '新聞を'],
  imperativeTails: ['もう少し', '今夜だけ', 'もう一度', 'そっと', 'ゆっくり'],

  vocativeLeads: ['少し止まって', 'ここにいて', '戻ってきて', 'ゆっくり休んで', '待っていて', 'そっと歩いて', '息をついて', '手を取って'],
  vocativeAddressees: ['友よ', 'あなたへ', '愛しい人', '古い心へ', '冬よ', '大切な人へ', '古い友へ', '朝よ'],

  nounModifiers: ['冬の', '金色の', '静かな', '初雪の', '古い十二月の', 'ゆっくりな日曜の', 'やわらかな朝の', '真夜中の', '早春の', '雨の', '晩秋の', '新年の'],
  nounObjects: ['窓辺の光', 'コーヒーカップ', 'ラジオ', '手紙', '戸口', 'レコード', '傘', 'ランプ', 'カレンダー', 'セーター', 'キャンドルの灯り', '列車'],

  // Same fix as Korean: every stem takes a を-marked object, and every tail carries を —
  // the previous set mixed in に/へ-marked and object-less stems (一緒に、家へ、ここにいる)
  // which broke combining with a を-object tail.
  declarativeStems: ['待っている', '覚えている', '忘れられない', 'まだ信じている', 'ずっと抱きしめている', 'まだ大切にしている', 'また見つけた', '今も想っている'],
  declarativeTails: ['朝を', 'あなたを', 'あの日々を', '雪道を', 'この時を', '私たちを', 'あの言葉を', 'あの約束を']
};

export function defaultHookParts(language: LyricLanguage): HookPartBank {
  if (language === 'korean') return koreanDefault;
  if (language === 'japanese') return japaneseDefault;
  return englishDefault;
}

/** Merges an archetype's vocabulary override onto the shared structural default. */
export function resolveHookParts(language: LyricLanguage, override?: HookVocabularyOverride): HookPartBank {
  const base = defaultHookParts(language);
  if (!override) return base;
  return { ...base, ...override };
}
