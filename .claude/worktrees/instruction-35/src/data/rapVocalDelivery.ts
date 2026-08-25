/**
 * 지시문 35 (TASK B) — 랩 딜리버리 어휘. 기존 vocalTraits.ts의 4축
 * (register/delivery/timbre/proximity)은 노래(가창) 기준 어휘라 랩 딜리버리를
 * 표현할 말이 없었다(실측: mumble/dragged/swallowed/sing-rap/triplet flow
 * 전부 0종, 지시문 35 §1-2). 이 파일은 그 공백을 메우는 랩 전용 4축이다 —
 * vocalTraits.ts를 대체하지 않고 나란히 존재한다(가창 축은 그대로 둔다).
 *
 * 네 축은 서로 다른 관심사라 조합해서 쓴다(예: flow + articulation + tone):
 *   flow          랩의 리듬적 올라타기 방식
 *   articulation  발음을 얼마나 뭉개는가 — 멈블 랩의 정체성 축
 *   tone          목소리 질감
 *   layering      보컬을 겹치는 방식(주로 ad-lib/훅 보강, 리드 자체는 아님)
 */

export interface RapVocalDeliveryAxes {
  flow: string[];
  articulation: string[];
  tone: string[];
  layering: string[];
}

export const RAP_VOCAL_DELIVERY_AXES: RapVocalDeliveryAxes = {
  flow: [
    'triplet flow',
    'double-time flow',
    'laid-back flow',
    'on-beat flow',
    'behind-the-beat flow',
    'staccato flow',
    'legato rap flow'
  ],
  articulation: [
    'crisp articulate delivery',
    'mumbled delivery',
    'slurred delivery',
    'dragged vowels',
    'swallowed consonants'
  ],
  tone: [
    'chesty intimate tone',
    'nasal bright tone',
    'whisper-close tone',
    'autotuned melodic tone',
    'raspy rap tone'
  ],
  layering: [
    'ad-lib stack',
    'doubled hook',
    'call-response ad-lib'
  ]
};

/**
 * leadVocal 클로즈로 쓸 때 promptAxisLexicon의 LEAD_VOCAL_PHRASES가 인식하는
 * 형태로 미리 조합한 예시 문구 — flow/articulation/tone 중 leadVocal 축(랩
 * 화자 본인의 딜리버리)에 해당하는 것만 포함한다. layering은 ad-lib/훅 보강
 * 성격이라 backingVocal에 더 가깝고, LEAD_VOCAL_PHRASES에 등록하지 않는다
 * (§하지 말 것 — 새 축을 만들지 않는다: leadVocal 축의 어휘만 넓힌다).
 */
export const RAP_LEAD_VOCAL_DELIVERY_PHRASES: string[] = [
  ...RAP_VOCAL_DELIVERY_AXES.flow,
  ...RAP_VOCAL_DELIVERY_AXES.articulation,
  ...RAP_VOCAL_DELIVERY_AXES.tone
];
