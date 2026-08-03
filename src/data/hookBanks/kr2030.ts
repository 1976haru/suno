import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * TASK B2 — modern Korean 20s-30s everyday-life imagery: commute, work,
 * studio apartments, old friends, dating uncertainty. Deliberately disjoint
 * from the shared default bank's coffee/radio/letter/sweater/record/candle
 * vocabulary (that bank was written with senior-morning's own "굿모닝
 * 추억라디오" imagery in mind — see hookParts.ts's own doc comment). All 6
 * overridable fields are set (not just one side of a pair) for full string
 * separation, per this task's own §4-4 "완전 분리".
 */
const english: HookVocabularyOverride = {
  imperativeObjects: [
    'the Earbuds', 'the Alarm', 'the Phone', 'the Elevator', 'the ID Badge', 'the Resume',
    'the Taxi', 'the Beer Can', 'the Laptop', 'the Subway Pass', 'the Convenience Bag', 'the Overtime'
  ],
  nounModifiers: ['Tired', 'Restless', 'Familiar', 'Empty', 'Crowded', 'Awkward', 'Uncertain', 'Indifferent', 'Hurried', 'Unspoken', 'Overwhelmed', 'Ordinary'],
  nounObjects: [
    'Subway Window', 'Earbud Wire', 'Streetlight Glow', 'Crosswalk Signal', 'Elevator Ride', 'Rooftop Room',
    'Back Alley', 'Last Train', 'ID Badge', 'Taxi Meter', 'Office Sign', 'Vending Machine'
  ],
  vocativeLeads: ['Hang In There', 'Just for Today', 'Catch Your Breath', 'Pause a Moment', 'You Made It Here', "It's Okay Now", 'Take Your Time', 'Stay As You Are'],
  vocativeAddressees: ['Today Self', 'Tired Heart', 'Thirty-Something', 'Late Night', 'Restless Mind', 'This Long Day', 'Still-Here Self', 'Twenty-Nine'],
  declarativeStems: [
    "I'm Getting Through", "I'm Holding On to", 'I Still Reach for', 'I Slowly Learn',
    'I Quietly Face', 'I Still Lean on', "I'm Finding My Way to", 'I Still Hold On to'
  ]
};

const korean: HookVocabularyOverride = {
  imperativeObjects: ['이어폰을', '알람을', '핸드폰을', '담배를', '맥주캔을', '택시를', '엘리베이터를', '신용카드를', '노트북을', '사원증을', '이력서를', '편의점 봉투를'],
  nounModifiers: ['피곤한', '흔들리는', '낯익은', '텅 빈', '붐비는', '서툰', '아슬아슬한', '무심한', '조급한', '어색한', '막막한', '담담한'],
  nounObjects: ['지하철 창밖', '이어폰 선', '편의점 불빛', '신호등', '엘리베이터', '옥탑방', '골목길', '막차', '사원증', '택시 미터기', '회사 로고', '자판기'],
  vocativeLeads: ['조금만 버텨요', '오늘만 버텨요', '한숨 돌려요', '잠깐 멈춰서요', '여기까지 왔어요', '이제 괜찮아요', '조금 늦어도 돼요', '그대로 있어도 돼요'],
  vocativeAddressees: ['오늘의 나', '지친 나', '서른의 나', '늦은 밤아', '흔들리는 마음아', '애쓴 하루야', '아직 여기 있는 나', '스물아홉아'],
  declarativeStems: ['견뎌내고 있어요', '버텨내고 있어요', '다시 붙잡고 있어요', '여전히 그리워해요', '가만히 안아봐요', '조금씩 알아가요', '다시 마주해요', '여전히 기대봐요']
};

const japanese: HookVocabularyOverride = {
  imperativeObjects: ['イヤホンを', '目覚ましを', 'スマホを', 'エレベーターを', '社員証を', '履歴書を', 'タクシーを', '缶ビールを', 'ノートパソコンを', '定期券を', 'コンビニ袋を', '残業を'],
  nounModifiers: ['疲れた', '落ち着かない', '見慣れた', '空っぽの', '混み合う', 'ぎこちない', '心もとない', '素っ気ない', 'せわしない', '言葉にならない', 'いっぱいいっぱいの', 'ありふれた'],
  nounObjects: ['地下鉄の窓', 'イヤホンのコード', '街灯の明かり', '横断歩道の信号', 'エレベーターの中', '屋上部屋', '裏路地', '終電', '社員証', 'タクシーメーター', '会社の看板', '自動販売機'],
  vocativeLeads: ['今日だけ頑張って', 'もう少し耐えて', '一息ついて', 'ここまで来たね', 'もう大丈夫だよ', 'ゆっくりでいいよ', 'そのままでいいよ', '少し休んでいいよ'],
  vocativeAddressees: ['今日の私へ', '疲れた心へ', '三十路の私へ', '深夜よ', '揺れる心へ', '長い一日へ', 'まだここにいる私へ', '二十九の私へ'],
  declarativeStems: ['乗り越えている', '耐えている', 'また掴んでいる', 'まだ恋しく思う', 'そっと抱きしめる', '少しずつ知っていく', 'また向き合う', 'まだ寄りかかっている']
};

export function kr2030Override(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
