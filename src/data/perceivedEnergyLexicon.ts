/**
 * 지시문 23 (TASK A-3) — "정규식을 코드에 흩뿌리지 않는다. promptAxisLexicon.ts
 * 와 같은 방식이다." 체감 에너지 판정에 쓰는 어휘를 전부 여기 데이터로 모은다.
 * core/perceivedEnergy.ts는 이 배열들만 읽는다 — 자체 하드코딩 어휘 없음.
 *
 * 출처: 지시문 23 §A-3 원문 목록(20260808_oldpoplounge 팩 18곡·genreLibrary의
 * oldpop-british-beat/oldpop-doowop-harmony/oldpop-sunshine-pop/
 * oldpop-brill-building 실제 rhythm/instruments/vocal/production 필드와
 * 대조해 채택 — 예: 'jangly eighth-note' → oldpop-british-beat.rhythm[0]
 * "jangly eighth-note beat pulse"와 실제로 일치, '12/8 triplet' →
 * oldpop-doowop-harmony.rhythm[0] "12/8 triplet shuffle groove"와 일치).
 */

export type PerceivedEnergyLexiconAxis = 'rhythm' | 'instrument' | 'vocal' | 'production';

/** 에너지를 올리는 어휘 — §A-3 "에너지를 올리는 어휘". */
export const ENERGY_UP_PHRASES: Record<PerceivedEnergyLexiconAxis, string[]> = {
  rhythm: ['jangly eighth-note', 'driving', 'four-on-the-floor', 'shuffle backbeat', 'staccato', 'marching', 'bouncy', 'bouncing'],
  instrument: ['tambourine', 'handclap', 'harpsichord', 'glockenspiel', '12-string', 'sleigh bells', 'horn stab', 'castanets'],
  vocal: ['bright soprano', 'head voice', 'unison shout', 'dense backing stack', 'belted', 'group harmony'],
  production: ['sharp attack', 'bright top end', 'compressed punch', 'bright']
};

/** 에너지를 내리는 어휘 — §A-3 "에너지를 내리는 어휘". */
export const ENERGY_DOWN_PHRASES: Record<PerceivedEnergyLexiconAxis, string[]> = {
  rhythm: ['12/8 triplet', '6/8', 'slow ballad feel', 'brushed', 'walking bass', 'waltz'],
  instrument: ['brushed snare', 'upright bass', 'nylon guitar', 'wurlitzer', 'woodwind', 'mellow strings'],
  vocal: ['legato sustained', 'warm baritone', 'alto', 'breathy', 'intimate', 'restrained delivery', 'close harmony'],
  production: ['soft attack', 'warm mono-leaning', 'tape character', 'narrow']
};

// 지시문 33 (§3) — measure:checks 실측이 core/perceivedEnergy.ts's
// computePerceivedEnergy(4축 × up/down 매치를 곡마다 반복 호출)를 비용
// 지점으로 지목했다. ENERGY_UP_PHRASES/ENERGY_DOWN_PHRASES는 모듈 상수라
// 매 호출마다 phrase마다 new RegExp를 다시 만들 이유가 없다 —
// promptAxisLexicon.ts's includesAny와 같은 WeakMap-by-array-reference
// 캐시. 매치 판정 자체(어떤 phrase가 어떻게 매칭되는지)는 전혀 바뀌지
// 않는다, 컴파일만 한 번만 한다.
const compiledLexiconPatterns = new WeakMap<readonly string[], RegExp[]>();
function lexiconPatternsFor(phrases: readonly string[]): RegExp[] {
  let compiled = compiledLexiconPatterns.get(phrases);
  if (!compiled) {
    compiled = phrases.map(phrase => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    compiledLexiconPatterns.set(phrases, compiled);
  }
  return compiled;
}

/**
 * Word/phrase-boundary match, not a bare substring — mirrors
 * promptAxisLexicon.ts's own `includesAny` (같은 실측 버그 클래스를 피한다:
 * 예를 들어 'alto' 부분문자열이 'altogether' 안에서 오매칭하는 걸 막는다).
 */
export function countLexiconMatches(text: string, phrases: readonly string[]): number {
  const lower = text.toLowerCase();
  return lexiconPatternsFor(phrases).filter(pattern => pattern.test(lower)).length;
}

/** 이 축 텍스트에서 (올림 매치 수 - 내림 매치 수)를 반환 — 부호 있는 raw diff, 정규화는 호출자(core/perceivedEnergy.ts)가 한다. */
export function lexiconAxisDiff(text: string, axis: PerceivedEnergyLexiconAxis): number {
  return countLexiconMatches(text, ENERGY_UP_PHRASES[axis]) - countLexiconMatches(text, ENERGY_DOWN_PHRASES[axis]);
}

/** reasonKo 조립용 — 이 축 텍스트에서 실제로 매치된 어휘(최대 2개, 절대값 기여도 큰 쪽 우선 없이 발견 순서)를 돌려준다. 판정에는 쓰이지 않는다(§A-2 "reasonKo를 판정에 쓰지 않는다") — 오직 사람이 읽는 표시용. */
export function matchedLexiconPhrases(text: string, axis: PerceivedEnergyLexiconAxis): { up: string[]; down: string[] } {
  const lower = text.toLowerCase();
  const matchOf = (phrases: readonly string[]) => phrases.filter((_, i) => lexiconPatternsFor(phrases)[i].test(lower));
  return { up: matchOf(ENERGY_UP_PHRASES[axis]).slice(0, 2), down: matchOf(ENERGY_DOWN_PHRASES[axis]).slice(0, 2) };
}
