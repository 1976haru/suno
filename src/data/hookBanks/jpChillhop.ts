import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

const japanese: HookVocabularyOverride = {
  imperativeObjects: [
    'この雨',
    '次の駅',
    '窓ぎわ',
    '夜のホーム',
    '冷めたコーヒー',
    '濡れた袖',
    '帰り道',
    '既読のまま',
    '遠回り',
    '小さな返信',
    '明け方の信号',
    '助手席の沈黙'
  ],
  nounModifiers: [
    '雨粒まじりの',
    '遠い',
    '淡い',
    '少しだけ',
    '雨上がりの',
    '眠れない',
    '言えない',
    '低い',
    'やわらかな',
    '夜明け前の',
    'すれ違う',
    'ほどけない'
  ],
  nounObjects: [
    '雨の匂い',
    '次の駅',
    '窓ぎわ',
    '帰り道',
    '夜のホーム',
    '冷めたカップ',
    '濡れた袖',
    '既読の画面',
    '遠回り',
    '小さな返信',
    '助手席',
    '明け方の信号'
  ],
  vocativeLeads: [
    'もう少しだけ',
    '帰りたくない',
    'まだ起きてる',
    '遠回りしよう',
    '言えなかった',
    '次の駅まで',
    '傘を閉じないで',
    '改札で待って',
    '返信はいらない',
    '朝まで黙って'
  ],
  vocativeAddressees: [
    '雨の夜',
    '窓ぎわ',
    '帰り道',
    '次の駅',
    '冷めたコーヒー',
    '小さな声',
    '濡れた袖',
    'まだ言えない気持ち',
    '助手席の横顔',
    '明け方の街'
  ],
  declarativeStems: [
    'まだ覚えてる',
    '少しだけ近づく',
    '返信を待ってる',
    '言えないまま',
    '遠回りしてる',
    '雨を見てる',
    '次の駅で止まる',
    '心だけ戻る',
    '朝まで残る',
    '声だけ探してる'
  ]
};

export function jpChillhopOverride(_language: LyricLanguage): HookVocabularyOverride {
  return japanese;
}
