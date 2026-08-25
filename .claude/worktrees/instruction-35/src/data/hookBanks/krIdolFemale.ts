import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * TASK K3 §6-1 — kr-idol-female's own hook vocabulary, all 9
 * HookVocabularyOverride fields set. Self-direction/choice/friendship/
 * direct-emotion/daylight imagery (§5-2's own axes) — deliberately NOT the
 * gender-swapped version of K2's krIdolMaleOverride (§4-3/§6-1's own
 * warning: swapping only the gender word would pass the cross-similarity
 * check while still being the same underlying world). Verified 0
 * intersection with koreanDefault (senior), kr2030Override (B2), AND
 * krIdolMaleOverride (K2, the K3-specific 3-way check §6-1 requires) — see
 * K3's own report for the measured counts.
 */
const korean: HookVocabularyOverride = {
  imperativeVerbs: ['선택해요', '나아가요', '웃어넘겨요', '털어내요', '해봐요'],
  imperativeObjects: ['내 방향을', '이 길을', '오늘 하루를', '내 마음대로', '이 흐름을', '우리 사이를', '그 시선을', '이 오후를', '낮의 도시를', '내 선택을', '이 계절을', '오늘의 나를'],
  imperativeTails: ['그냥', '가볍게', '내 맘대로', '있는 그대로', '나답게'],
  vocativeLeads: ['따라와', '웃어봐', '괜찮아', '가볍게 가자', '나답게 가자', '털어버려', '눈치 보지 마', '지나쳐버려'],
  vocativeAddressees: ['지금의 나', '옆에 있는 너', '흔들리지 않는 나', '같이 걷는 우리', '이 낮', '내 편', '지나가는 시선', '다가올 나'],
  nounModifiers: ['가벼운', '산뜻한', '야무진', '당당한', '또렷한', '자유로운', '통쾌한', '나다운', '밝은', '단호한', '싱그러운', '반짝이는'],
  nounObjects: ['방향', '선택', '오후', '골목', '옥상', '계절', '웃음', '발걸음', '우리', '거리', '오늘', '색'],
  declarativeStems: ['정했어', '나아갔어', '웃어넘겼어', '털어냈어', '지나쳤어', '가벼워졌어'],
  declarativeTails: ['내 방향을', '이 길을', '그 시선을', '오늘 하루를', '내 선택을', '이 계절을']
};

const english: HookVocabularyOverride = {
  imperativeVerbs: ['Choose', 'Press On', 'Laugh It Off', 'Shake Off', 'Try It'],
  imperativeObjects: ['My Own Direction', 'This Path', 'Today', 'My Own Way', 'This Flow', 'What We Have', 'That Stare', 'This Afternoon', 'The Daylight City', 'My Choice', 'This Season', 'Today Me'],
  imperativeTails: ['Just Like That', 'Lightly', 'My Way', 'As I Am', 'Like Myself'],
  vocativeLeads: ['Come With Me', 'Just Smile', "It's Fine", "Let's Go Light", "Let's Go My Way", 'Shake It Off', "Don't Mind Them", 'Walk On Past'],
  vocativeAddressees: ['Today Me', 'You Beside Me', 'Unshaken Me', 'Us Walking Together', 'This Daylight', 'My Own Side', 'That Passing Stare', 'Future Me'],
  nounModifiers: ['Light', 'Fresh', 'Bold', 'Confident', 'Clear-Cut', 'Free', 'Satisfying', 'True to Myself', 'Bright', 'Decisive', 'Crisp', 'Sparkling'],
  nounObjects: ['Direction', 'Choice', 'Afternoon', 'Alley', 'Rooftop', 'Season', 'Laughter', 'Footsteps', 'Us', 'Street', 'Today', 'Color'],
  declarativeStems: ['I Decided', 'I Moved Forward', 'I Laughed It Off', 'I Shook It Off', 'I Walked Past It', 'It Got Lighter'],
  declarativeTails: ['My Own Direction', 'This Path', 'That Stare', 'Today', 'My Choice', 'This Season']
};

const japanese: HookVocabularyOverride = {
  imperativeVerbs: ['選ぼう', '進もう', '笑い飛ばそう', '振り払おう', 'やってみよう'],
  imperativeObjects: ['自分の方向を', 'この道を', '今日を', '自分のやり方で', 'この流れを', '私たちの関係を', 'あの視線を', 'この午後を', '昼の街を', '自分の選択を', 'この季節を', '今日の私を'],
  imperativeTails: ['そのまま', '軽やかに', '自分のペースで', 'ありのままに', '私らしく'],
  vocativeLeads: ['隣にいて', '笑ってみて', '大丈夫だよ', '軽やかに行こう', '私らしく行こう', '振り払って', '気にしないで', '通り過ぎて'],
  vocativeAddressees: ['今この私へ', '隣の君へ', '揺るがない私へ', '一緒に歩く私たちへ', 'この昼へ', '私の味方へ', '通り過ぎる視線へ', '明日の私へ'],
  nounModifiers: ['軽やかな', 'さわやかな', '大胆な', '堂々とした', 'くっきりした', '自由な', '爽快な', '私らしい', '明るい', '迷いのない', 'みずみずしい', 'きらめく'],
  nounObjects: ['方向', '選択', '午後', '路地', '屋上', '季節', '笑い', '足取り', '私たち', '通り', '今日', '色'],
  declarativeStems: ['決めた', '進んだ', '笑い飛ばした', '振り払った', '通り過ぎた', '軽くなった'],
  declarativeTails: ['自分の方向を', 'この道を', 'あの視線を', '今日を', '自分の選択を', 'この季節を']
};

export function krIdolFemaleOverride(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
