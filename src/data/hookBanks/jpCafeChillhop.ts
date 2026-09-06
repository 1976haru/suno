import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

const japanese: HookVocabularyOverride = {
  imperativeObjects: [
    '窓際の約束',
    '冷めない珈琲',
    '午後のため息',
    '雨のテラス',
    '小さな注文',
    '春のカップ',
    '最後のレシート',
    '言えない言葉',
    '帰り道の灯り',
    '次の待ち合わせ'
  ],
  nounModifiers: [
    'ほろ苦い',
    '焙煎香る',
    '雨上がりの',
    '窓に映る',
    '少し甘い',
    '季節外れの',
    '言いかけた',
    '夕暮れ色の',
    'ほどけない',
    'やわらかな'
  ],
  nounObjects: [
    'カフェラテ',
    'ブレンド',
    '窓際',
    'テラス席',
    '白いカップ',
    '読めないメッセージ',
    '二つのスプーン',
    '傘立て',
    '駅までの道',
    '海風の席'
  ],
  vocativeLeads: [
    'ねえ',
    'もしも',
    'もう一度',
    '今日だけ',
    '黙ったまま',
    '雨が止んだら',
    '席を立つ前に',
    '同じ香りで',
    '言葉にするなら',
    '次の季節も'
  ],
  vocativeAddressees: [
    '君',
    'あなた',
    '窓の向こう',
    'この席',
    '午後の二人',
    '冷めたカップ',
    '雨の街',
    'テラスの風',
    '帰り道',
    '次の約束'
  ],
  declarativeStems: [
    'まだここにいる',
    '言えないまま笑う',
    '香りだけが残る',
    '小さな音で近づく',
    '同じ沈黙を聴く',
    '窓に季節が映る',
    '席を立てずにいる',
    'レシートを折りたたむ',
    '雨上がりを待っている',
    '次の約束へ歩く'
  ]
};

export function jpCafeChillhopOverride(_language: LyricLanguage): HookVocabularyOverride {
  return japanese;
}
