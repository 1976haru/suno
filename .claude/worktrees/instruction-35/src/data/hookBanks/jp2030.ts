import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * TASK C2 — jp-2030 workspace's own hook vocabulary: Reiwa-era school/youth
 * imagery (turnstile, bicycle, festival, classroom, graduation), disjoint
 * from BOTH of the two senior Japanese dictionaries this workspace shares a
 * language with — `japaneseDefault` (hookParts.ts, senior-morning's coffee/
 * radio/letter/candle/sweater/record vocabulary) AND `showaCafeOverride`
 * (hookBanks/showaCafe.ts, the showa kissaten's vinyl/rotary-phone/neon/
 * typewriter vocabulary). All 6 overridable fields are set on every
 * language variant, including `vocativeAddressees` — showaCafe itself does
 * NOT override that field (see its own doc comment), so leaving it out here
 * too would inherit senior-morning's 友よ/あなたへ/愛しい人/冬よ directly into
 * a Reiwa J-pop channel. Deliberately no internet slang — a title needs to
 * still read naturally years after this pack ships.
 */
const english: HookVocabularyOverride = {
  imperativeObjects: [
    'the Turnstile', 'the Bicycle', 'the Alarm Clock', 'the Indoor Shoes', 'the Clubroom Key', 'the Fireworks',
    'the School Uniform', 'the Vending Machine', 'the Backpack', 'the Bicycle Lock', 'the Classroom Window', 'the Chalkboard'
  ],
  nounModifiers: ['End-of-Summer', 'After-School', 'Dazzling', 'Sweat-Damp', 'Uniformed', 'Homebound', 'Classroom', 'Practice-Worn', 'Sunlit', 'Schoolbound', 'Festival-Night', 'Graduation-Eve'],
  nounObjects: [
    'Turnstile Gate', 'Bicycle Basket', 'Classroom Window', 'Clubroom', 'Festival Lantern Glow', 'School Path',
    'Platform Edge', 'Chalkboard', 'Vending Machine Glow', 'Firework Echo', 'Uniform Ribbon', 'School Yard'
  ],
  vocativeLeads: ['Face Forward', 'Take the First Step', "Don't Give Up", 'Lift Your Chin', 'Start Running', 'Keep Walking Straight', 'Raise Your Voice', 'Believe in Yourself'],
  vocativeAddressees: ['My Youth', 'Future Me', 'Still-Lost Me', "Tomorrow's Self", 'That Day\'s Me', "Today's Main Character", 'Teenage Me', 'The One Still Running'],
  declarativeStems: [
    "I Haven't Given Up on", 'I Start Again from', 'I Only Look Forward to', "I'll Surely Change",
    "I'm Still Searching for", "I've Made It This Far With", "There's Still Time for", "I Believe It'll Reach"
  ]
};

const korean: HookVocabularyOverride = {
  imperativeObjects: ['개찰구를', '자전거를', '알람을', '실내화를', '부실 열쇠를', '불꽃놀이를', '교복을', '자판기를', '책가방을', '자전거 자물쇠를', '교실 창문을', '칠판을'],
  nounModifiers: ['여름 끝의', '방과 후의', '눈부신', '땀에 젖은', '교복 차림의', '집으로 가는', '교실의', '연습으로 지친', '햇살 가득한', '등굣길의', '축제 밤의', '졸업 직전의'],
  nounObjects: ['개찰구', '자전거 바구니', '교실 창문', '부실', '축제 등불', '등굣길', '플랫폼 끝', '칠판', '자판기 불빛', '불꽃놀이 소리', '교복 리본', '운동장'],
  vocativeLeads: ['앞을 봐요', '한 걸음 내디뎌요', '포기하지 말아요', '고개를 들어요', '달려나가요', '똑바로 걸어가요', '목소리를 내요', '자신을 믿어요'],
  vocativeAddressees: ['나의 청춘에게', '미래의 나에게', '아직 헤매는 나에게', '내일의 나에게', '그날의 나에게', '오늘의 주인공에게', '십대의 나에게', '계속 달리는 너에게'],
  declarativeStems: ['아직 포기하지 않았어요', '다시 시작해요', '앞만 보고 있어요', '분명 바꿔낼 거예요', '아직 찾고 있어요', '여기까지 왔어요', '아직 늦지 않았어요', '분명 닿을 거라 믿어요']
};

const japanese: HookVocabularyOverride = {
  imperativeObjects: ['改札を', '自転車を', '目覚ましを', '上履きを', '部室の鍵を', '花火を', '制服を', '自動販売機を', '通学バッグを', '自転車の鍵を', '教室の窓を', '黒板を'],
  nounModifiers: ['夏の終わりの', '放課後の', 'まぶしい', '汗ばんだ', '制服姿の', '帰り道の', '教室の', '部活帰りの', '陽だまりの', '通学路の', '夏祭りの', '卒業間際の'],
  nounObjects: ['改札口', '自転車のカゴ', '教室の窓', '部室', '夏祭りの灯り', '通学路', 'ホームの端', '黒板', '自販機の灯り', '花火の音', '制服のリボン', '校庭'],
  vocativeLeads: ['前を向いて', '一歩踏み出して', '諦めないで', '顔を上げて', '走り出して', 'まっすぐ進んで', '声を上げて', '自分を信じて'],
  vocativeAddressees: ['青春へ', '未来の私へ', 'まだ迷う私へ', '明日の自分へ', 'あの日の私へ', '今日の主人公へ', '十代の私へ', '走り続ける君へ'],
  declarativeStems: ['まだ諦めていない', 'ここから始める', '前だけを見ている', 'きっと変えてみせる', 'まだ探している', 'ここまで来た', 'まだ間に合う', 'きっと届くと思う']
};

export function jp2030Override(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
