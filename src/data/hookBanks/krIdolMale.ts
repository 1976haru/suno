import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * TASK K2 §8-1 — kr-idol-male's own hook vocabulary, all 9
 * HookVocabularyOverride fields set (resolveHookParts, hookParts.ts, merges
 * `{...base, ...override}` per field — any field left unset silently falls
 * back to defaultHookParts's senior vocabulary, exactly the E1/F1-established
 * gap this task's own §8-1 warns about). Stage/performance/declaration
 * imagery throughout — deliberately disjoint from BOTH koreanDefault
 * (hookParts.ts's senior bank: coffee/radio/letter/sweater/record/candle)
 * AND kr2030Override (hookBanks/kr2030.ts: earbuds/commute/studio-apartment/
 * subway — B2's own everyday-life register), verified 0 intersection with
 * both — see K2's own report for the actual measured counts.
 */
const korean: HookVocabularyOverride = {
  imperativeVerbs: ['불태워요', '증명해요', '뛰어넘어요', '외쳐봐요', '움직여요'],
  imperativeObjects: ['이 무대를', '한계를', '이 순간을', '오늘 밤을', '너의 눈빛을', '이 함성을', '조명을', '이 리듬을', '심장을', '첫 무대를', '이 도시를', '약속을'],
  imperativeTails: ['다시', '더 크게', '끝까지', '지금', '함께'],
  vocativeLeads: ['따라와줘', '믿어봐', '함께 가자', '느껴봐', '지켜봐줘', '기다려줘', '보여줄게', '약속할게'],
  vocativeAddressees: ['오늘의 우리', '이 무대', '흔들리는 마음', '단 한 사람', '이 밤', '새벽의 도시', '무대 아래 너', '내일의 나'],
  nounModifiers: ['빛나는', '거침없는', '뜨거운', '선명한', '흔들림 없는', '눈부신', '거센', '단단한', '어두운', '치열한', '벅찬', '아찔한'],
  nounObjects: ['무대', '함성', '조명', '심장박동', '도시의 밤', '연습실', '거울', '커튼콜', '눈빛', '박수', '리듬', '약속'],
  declarativeStems: ['해냈어', '증명했어', '넘어섰어', '움직였어', '느껴졌어', '시작됐어'],
  declarativeTails: ['이 무대를', '한계를', '오늘 밤을', '너의 마음을', '이 함성을', '약속을']
};

const english: HookVocabularyOverride = {
  imperativeVerbs: ['Ignite', 'Prove', 'Break', 'Shout', 'Move'],
  imperativeObjects: ['This Stage', 'the Limit', 'This Moment', 'Tonight', 'Your Eyes', 'This Roar', 'the Spotlight', 'This Rhythm', 'the Heartbeat', 'the First Stage', 'This City', 'the Promise'],
  imperativeTails: ['Higher', 'Louder', 'To the End', 'Right Now', 'Together'],
  vocativeLeads: ['Follow Me', 'Believe in Me', "Let's Go Together", 'Feel This', 'Watch Me Now', 'Wait for Me', "I'll Show You", 'I Promise You'],
  vocativeAddressees: ['Tonight Us', 'This Stage', 'This Restless Heart', 'The Only One', 'This Night', 'Dawn City', 'You Down There', 'Tomorrow Me'],
  nounModifiers: ['Blazing', 'Fearless', 'Burning', 'Vivid', 'Unshaken', 'Dazzling', 'Fierce', 'Unbreakable', 'Feverish', 'Relentless', 'Overwhelming', 'Breathless'],
  nounObjects: ['Stage', 'Roar', 'Spotlight', 'Heartbeat', 'City Night', 'Practice Room', 'Mirror', 'Encore', 'Eyes', 'Applause', 'Rhythm', 'Promise'],
  declarativeStems: ['We Did It', 'We Proved It', 'We Broke Through', 'We Moved', 'We Felt It', 'It Began'],
  declarativeTails: ['This Stage', 'The Limit', 'The Encore', 'Your Heart', 'This Roar', 'The Promise']
};

const japanese: HookVocabularyOverride = {
  imperativeVerbs: ['燃やそう', '証明しよう', '超えよう', '叫ぼう', '動かそう'],
  imperativeObjects: ['この舞台を', '限界を', 'この瞬間を', '今夜を', '君の瞳を', 'この歓声を', 'スポットライトを', 'このリズムを', '鼓動を', '初舞台を', 'この街を', '約束を'],
  imperativeTails: ['さらに', 'もっと大きく', '最後まで', '今', '一緒に'],
  vocativeLeads: ['ついてきて', '信じて', '一緒に行こう', '感じてみて', '見ていて', '感じ取って', '見せてあげる', '約束するよ'],
  vocativeAddressees: ['今夜の僕たち', 'この舞台へ', '燃える心へ', 'ただ一人へ', 'この夜へ', '夜明けの街へ', '舞台の下の君へ', '明日の僕へ'],
  nounModifiers: ['輝く', '恐れ知らずの', '燃える', '鮮やかな', '揺るがない', 'まぶしい', '激しい', '揺るぎない', '灼熱の', '止まらない', '溢れる', '息をのむ'],
  nounObjects: ['舞台', '歓声', 'スポットライト', '鼓動', '街の夜', '練習室', '鏡', 'アンコール', '瞳', '拍手', 'リズム', '約束'],
  declarativeStems: ['やり遂げた', '証明した', '超えた', '動いた', '感じた', '始まった'],
  declarativeTails: ['この舞台を', '限界を', '今夜を', '君の心を', 'この歓声を', '約束を']
};

export function krIdolMaleOverride(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
