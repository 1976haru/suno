import type { LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';

/**
 * TASK F1 §7-1 — jp-kids workspace's own hook vocabulary, covering all 9
 * HookVocabularyOverride fields (§0-2 measured this workspace's exact
 * failure mode when even one field is missing: it silently inherits
 * senior-morning's Japanese vocabulary — コーヒー/セーター/冬よ/愛しい人 —
 * the "行かないで" breakup phrase in the 18-song baseline came from exactly
 * this gap). Every field below implements §5-4's onomatopoeia+object title
 * pattern (かにダンス-style) using data/onomatopoeia.ts's own words as the
 * source vocabulary for nounModifiers, and stays hiragana-heavy per §7-1's
 * own warning ("한자를 많이 쓰면 시니어·쇼와 인상이 됩니다", confirmed by C2).
 *
 * Verified programmatically against BOTH senior Japanese dictionaries —
 * japaneseDefault (hookParts.ts) AND showaCafeOverride (hookBanks/showaCafe.ts,
 * the one showa-cafe/showa-70s actually use) — 0 intersection in every
 * field; see docs/f1-report.md §13-1[6].
 */
const japanese: HookVocabularyOverride = {
  imperativeVerbs: ['みつけよう', 'たべよう', 'のろう', 'まねよう', 'あそぼう'],
  // §5-4 title-pattern A/C ("擬音語+対象") — the real fix: core/lyricEngine.ts's
  // SungHookShape excludes 'nounPhrase' entirely (only vocative/imperative/
  // declarative ever become an actual song hook/title), so nounModifiers+
  // nounObjects below can NEVER surface in a real title no matter how they're
  // filled in — a real measured finding (§0-2 regen initially showed
  // onomatopoeia in just 1/54 titles). The onomatopoeia+object compound
  // pattern is built directly into imperativeObjects/vocativeAddressees
  // instead, since THOSE shapes are the ones real generation actually uses.
  // Kept short (object+tail+verb concatenate into ONE joined Japanese string,
  // and combinatorialHookBank() drops anything outside HOOK_LENGTH_BOUNDS.japanese
  // = 5-14 chars — a first draft using fully-doubled onomatopoeia + さん
  // suffixes routinely produced 16-22 char strings and silently exhausted the
  // imperative pool at generation time; this was only caught by re-running
  // the real 18-song regeneration script, not by field-count checks).
  imperativeObjects: ['ぴょんぴょんを', 'くるくるを', 'ぶーぶーを', 'がたんごとんを', 'もぐもぐを'],
  imperativeTails: ['げんきに', 'たのしく', 'かるく', 'もっと', 'すこし'],
  vocativeLeads: ['やってみよう', 'できるかな', 'あそぼう', 'まねしよう', 'うたおう', 'おどろう', 'げんきに', 'たのしく'],
  vocativeAddressees: ['ぴょんぴょんさん', 'ぶーぶーくるま', 'もぐもぐたこやき', 'がたんごとんさん', 'にこにこさん', 'わくわくみんな', 'きらきらにじ', 'ちいさいこ'],
  // Kept filled (9/9 requirement) but confirmed dead for real titles — see
  // imperativeObjects's own comment above. Harmless: no downstream code
  // path currently reads nounPhrase-shaped hooks for kids content.
  nounObjects: ['かに', 'たこやき', 'バス', 'でんしゃ', 'にじ', 'ちょう', 'うさぎ', 'ひよこ'],
  nounModifiers: ['ぴょんぴょんの', 'くるくるの', 'ぶーぶーの', 'ぱちぱちの', 'もぐもぐの', 'わくわくの', 'にこにこの', 'きらきらの'],
  declarativeStems: ['できたよ', 'みつけたよ', 'たのしいね', 'がんばったね', 'じょうずだね', 'うれしいね'],
  declarativeTails: ['おとを', 'いろを', 'かたちを', 'うたを', 'かずを']
};

const english: HookVocabularyOverride = {
  imperativeVerbs: ['Find', 'Try', 'Ride', 'Copy', 'Chase'],
  // Same onomatopoeia+object compound approach as the Japanese block above.
  imperativeObjects: ['the Hopping Bunny', 'the Spinning Pinwheel', 'the Vroom-Vroom Car', 'the Clattering Train', 'the Munching Takoyaki'],
  imperativeTails: ['Together', 'Cheerfully', 'Playfully', 'Once More', 'A Little More'],
  vocativeLeads: ['Try It with Us', 'Can You Do It', 'Play with Us', 'Copy This', 'Sing with Us', 'Dance with Us', 'Try It Cheerfully', 'Try It Playfully'],
  vocativeAddressees: ['Hopping Bunny', 'Vroom-Vroom Car', 'Munching Takoyaki', 'Clattering Train', 'Smiling Friend', 'Excited Everyone', 'Sparkly Rainbow', 'Little Friend'],
  // Kept filled (9/9 requirement) but confirmed dead for real titles — see the Japanese block's own comment.
  nounObjects: ['Crab', 'Takoyaki', 'Bus', 'Streetcar', 'Rainbow', 'Butterfly', 'Bunny', 'Chick'],
  nounModifiers: ['Hopping', 'Spinning', 'Vroom-Vroom', 'Clapping', 'Munching', 'Excited', 'Smiling', 'Sparkly'],
  declarativeStems: ['We Did It', 'We Found It', 'So Much Fun', 'Great Job', 'Well Done'],
  declarativeTails: ['the Sound', 'the Color', 'the Shape', 'the Song', 'the Number']
};

const korean: HookVocabularyOverride = {
  imperativeVerbs: ['찾아봐요', '타봐요', '먹어봐요', '따라 해봐요', '놀아봐요'],
  // Same onomatopoeia+object compound approach as the Japanese block above.
  imperativeObjects: ['깡충깡충 토끼를', '빙글빙글 바람개비를', '붕붕 자동차를', '칙칙폭폭 기차를', '냠냠 타코야키를'],
  imperativeTails: ['같이', '신나게', '즐겁게', '가볍게', '더'],
  vocativeLeads: ['같이 해봐요', '할 수 있을까요', '같이 놀아요', '따라 해봐요', '같이 불러요', '같이 춤춰요', '신나게 해봐요', '즐겁게 해봐요'],
  vocativeAddressees: ['깡충깡충 토끼야', '붕붕 자동차야', '냠냠 타코야키야', '칙칙폭폭 기차야', '방긋 친구야', '두근두근 모두야', '반짝반짝 무지개야', '작은 친구야'],
  // Kept filled (9/9 requirement) but confirmed dead for real titles — see the Japanese block's own comment.
  nounObjects: ['게', '타코야키', '버스', '전차', '무지개', '나비', '토끼', '병아리'],
  nounModifiers: ['깡충깡충', '빙글빙글', '붕붕', '짝짝', '냠냠', '두근두근', '방긋방긋', '반짝반짝'],
  declarativeStems: ['해냈어요', '찾았어요', '즐거워요', '잘했어요', '멋져요'],
  declarativeTails: ['소리를', '색깔을', '모양을', '노래를', '숫자를']
};

export function jpKidsOverride(language: LyricLanguage): HookVocabularyOverride {
  if (language === 'korean') return korean;
  if (language === 'japanese') return japanese;
  return english;
}
