/**
 * 지시문 66 — 장르 vocal 필드의 창법이 부족할 때 보충하는 계열 단위 풀.
 * 39개 팩 실측에서 장르당 창법 1~3개로는 4곡 이상 배정 시 반복이
 * 발생함이 확인됐다(예: kr2030-noir-deep-house 15곡에 창법 3개).
 * 계열 정규식은 genreId 에 대해 순서대로 평가하고 첫 일치를 쓴다.
 * verified: false — 장르 관행에 근거한 추정값이며 하루의 청취로 조정한다.
 *
 * data/vocalTechniqueByGenre.ts(지시문 65)가 이미 367종 전부에 대해
 * genreId -> family -> 창법 풀 하나를 결정론적으로 배정하고 있다(그 파일
 * 자기 doc comment 참고) — 이 파일은 그 시스템을 대체하지 않는다(§하지
 * 말 것 "계열 풀이 장르 vocal 필드를 대체하지 말 것"). 65의 일부 계열
 * (electronicVocal 2종·jazzCrooner/jazzScat/jazzBossa 4종·doowop 4종·
 * britishBeat 4종·sunshinePop 3종·seasonalWarm 1종 등)은 §1 실측이 지적한
 * "4곡 이상 배정되면 반복" 그 자체다 — core/vocalPlan.ts의
 * buildVocalTechniquePlanByGenre가 65의 풀이 소진됐을 때 이 파일의
 * vocalTechniquesForGenre(genreId) 결과를 보충 풀로 합친다(TASK B).
 */

export interface VocalTechniqueFamily {
  /** genreId 매칭 패턴 — 위에서부터 첫 일치를 쓴다 */
  pattern: RegExp;
  /** 이 계열의 창법 어휘 */
  techniques: readonly string[];
  reasonKo: string;
}

/**
 * 순서가 중요하다 — 정규식이 겹치는 genreId(예: jazz-classic-vocal-lounge는
 * 2번 jazz 계열, oldpop-piano-ballad-70s는 3번 ballad 계열)는 위에서부터
 * 첫 일치를 쓴다. 39개 팩 실측에서 검증된 순서이므로 바꾸지 말 것(§하지
 * 말 것).
 */
export const VOCAL_TECHNIQUE_FAMILIES: readonly VocalTechniqueFamily[] = [
  {
    pattern: /rnb|soul|motown|philly|quiet-storm|neo-soul/i,
    techniques: [
      'gospel-run melisma on phrase ends',
      'falsetto lift into the chorus',
      'behind-the-beat phrasing',
      'call-and-response with the backing group',
      'breathy ad-lib over the outro',
      'chest-to-falsetto shift on the hook',
    ],
    reasonKo: '소울·R&B 는 멜리스마와 뒤로 끄는 프레이징이 정체성이다',
  },
  {
    pattern: /jazz|lounge|bossa|swing|crooner/i,
    techniques: [
      'scat phrase in the instrumental break',
      'laid-back behind-the-beat timing',
      'controlled vibrato on held notes',
      'blue-note bend into the resolution',
      'conversational swing phrasing',
    ],
    reasonKo: '재즈 보컬은 스캣·레이드백 타이밍·블루노트가 핵심이다',
  },
  {
    pattern: /ballad|piano|orchestral|healing|chanson/i,
    techniques: [
      'sustained legato lines',
      'head-voice lift on the peak',
      'dynamic swell into the chorus',
      'final note held and tapering into silence',
      'breath-audible intimacy in the verse',
    ],
    reasonKo: '발라드는 레가토와 다이내믹 변화로 감정을 만든다',
  },
  {
    pattern: /doowop|harmony|close-harmony/i,
    techniques: [
      'close four-part harmony stack',
      'nonsense-syllable backing figure',
      'bass vocal line under the hook',
      'block-chord backing swell',
    ],
    reasonKo: '두왑은 무의미 음절 백킹과 베이스 보컬 라인이 정체성이다',
  },
  {
    pattern: /beat|british|sunshine|brill|girl-group/i,
    techniques: [
      'unison hook line',
      'clipped consonants on the verse',
      'two-part harmony on the chorus',
      'nasal-edged lead attack',
    ],
    reasonKo: '브리티시 비트는 유니즌 훅과 또렷한 자음 처리가 특징이다',
  },
  {
    pattern: /deep-house|house|electro|edm|noir|synth-pop|dance/i,
    techniques: [
      'vocoder-smooth legato glide across the hook',
      'sparse atmospheric vocal hook',
      'processed vocal chops used sparingly',
      'breathy half-whispered verse',
      'airy falsetto floating over the drop',
      'filtered vocal rising into the chorus',
      'repeated one-line hook chanted low',
      'wordless vocal pad under the groove',
    ],
    reasonKo: '하우스·일렉트로는 보컬을 질감으로 다룬다',
  },
  {
    pattern: /band-pop|emo-band|indie|rock|crossover/i,
    techniques: [
      'husky crack on the emotional peak',
      'occasional falsetto lift on the hook',
      'strained belt held at the climax',
      'half-spoken verse opening into a sung chorus',
      'raw unpolished edge on the final chorus',
      'layered gang-vocal shout on the last hook',
    ],
    reasonKo: '감성 밴드팝은 목이 갈라지는 지점과 버티는 벨팅이 정체성이다',
  },
  {
    pattern: /kayokyoku|enka|showa|japanese-folk|new-music/i,
    techniques: [
      'kobushi-style vocal ornament on sustained notes',
      'vibrato held into the final syllable',
      'restrained delivery never oversung',
      'plainspoken storyteller phrasing',
      'legato line easing into the chorus',
      'soulful rasp on the emotional peak',
    ],
    reasonKo: '일본 가요는 코부시(こぶし)와 절제된 딜리버리가 핵심이다',
  },
  {
    pattern: /soft-rock|adult-contemporary|easy-listening|sunlit|morning-glow|hearth/i,
    techniques: [
      'smooth crooning legato through the verse',
      'gentle head-voice lift on the chorus',
      'close two-part harmony on the hook',
      'restrained vibrato on held notes',
      'warm conversational phrasing',
    ],
    reasonKo: '소프트록·AC 는 매끄러운 크루닝과 절제된 다이내믹이다',
  },
  {
    pattern: /folk|acoustic|country/i,
    techniques: [
      'plainspoken storyteller delivery',
      'natural unpolished phrasing',
      'gentle vibrato on line ends',
    ],
    reasonKo: '포크는 다듬지 않은 이야기꾼 톤이 정체성이다',
  },
  {
    pattern: /kids|krkids|jpkids/i,
    techniques: [
      'clear syllable articulation',
      'call-and-response with children',
      'clap-along chant delivery',
    ],
    reasonKo: '동요는 또박또박한 발음과 따라 부르기 구조가 우선이다',
  },
  {
    pattern: /rap|hiphop|trap|lofi/i,
    techniques: [
      'behind-the-beat drawl',
      'half-whispered close-mic delivery',
      'melodic sing-rap phrasing',
    ],
    reasonKo: '랩·로파이는 박자 뒤로 끄는 딜리버리가 특징이다',
  },
  {
    pattern: /idol|kridol|dance|disco|city-pop|electro/i,
    techniques: [
      'layered unison hook',
      'bright forward belt on the chorus',
      'staccato rhythmic attack',
      'ad-lib stack over the final chorus',
    ],
    reasonKo: '아이돌·댄스는 레이어드 유니즌과 애드립 스택이 정체성이다',
  },
];

/** genreId 하나에 대응하는 계열 창법 풀 — 위에서부터 첫 일치. 매칭 실패 시 빈 배열. */
export function vocalTechniquesForGenre(genreId: string): readonly string[] {
  const family = VOCAL_TECHNIQUE_FAMILIES.find(entry => entry.pattern.test(genreId));
  return family ? family.techniques : [];
}
