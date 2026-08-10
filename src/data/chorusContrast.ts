/**
 * 지시문 36 (TASK C) — "후렴 대비, 전조 아닌 편곡으로". 하루의 청취 관찰:
 * 현재 후렴 차별화는 거의 전적으로 키 전조(핸드오프 §4-⑧, 11/18곡)에
 * 의존한다. 전조는 킬링포인트(data/killingPoints.ts KP-01/KP-07)가 이미
 * 다루는 영역이자 하루가 직접 "옥타브 상승이 들린다"고 확인한 축이라
 * 대체하면 안 된다(§C-4) — 이 파일은 그와 별개로, 벌스→후렴 사이의
 * "편곡 밀도" 대비(보컬 하모니 폭·베이스 존재감·드럼 선명도·멜로디 range·
 * 리듬 밀도·악기 추가)를 프롬프트 지시문으로 명시한다. 킬링포인트/훅
 * 디바이스와 동시에 배정될 수 있다(서로 다른 축) — 하나가 다른 하나를
 * 끄지 않는다.
 *
 * ChorusContrastScore의 여섯 축과 목표 범위(45~70)는 챗지피티 제안값을
 * 출발점으로 한 추정치다(verified:false) — "너무 낮으면 처지고 너무
 * 높으면 피곤하다"는 하루의 감(§C-1)을 숫자로 옮긴 것일 뿐, 실측 검증은
 * 아직 없다. data/listeningIntentPolicy.ts/data/perceivedEnergyPolicy.ts와
 * 같은 "estimate, 첫 세트 청취 후 조정" 관례를 그대로 따른다.
 */

export interface ChorusContrastScore {
  /** 벌스 대비 후렴에서 보컬 하모니가 얼마나 넓어지는가 (0~100). */
  vocalHarmonyWidth: number;
  /** 벌스 대비 후렴에서 베이스가 얼마나 두드러지는가 (0~100). */
  bassPresence: number;
  /** 벌스 대비 후렴에서 드럼 프레이즈가 얼마나 또렷해지는가 (0~100). */
  drumDefinition: number;
  /** 벌스 대비 후렴에서 멜로디 음역이 얼마나 넓어지는가 (0~100). */
  melodyRange: number;
  /** 벌스 대비 후렴에서 리듬 밀도가 얼마나 촘촘해지는가 (0~100). */
  rhythmDensity: number;
  /** 벌스 대비 후렴에서 악기가 몇 겹이나 더해지는가 (0~100). */
  instrumentAddition: number;
  /** 여섯 축의 평균, 0~100. 목표 범위 45~70(추정치, §C-1). */
  total: number;
}

export interface ChorusContrastPlan {
  id: string;
  labelKo: string;
  /** 벌스 편곡 — 브릿지 지시문에 그대로 전달되는 참고 텍스트. */
  verseText: string;
  /** 후렴 편곡 — 벌스 대비 무엇이 더해지는지. */
  chorusText: string;
  /** hookDevices.ts의 HookDevice.shortForm과 같은 역할 — 로컬 생성 경로가 stylePrompt 원자 하나로 쓰는 압축형(chorusText에서 "+ " 접두만 뗀 형태). */
  shortForm: string;
  score: ChorusContrastScore;
}

function scoreOf(parts: Omit<ChorusContrastScore, 'total'>): ChorusContrastScore {
  const total = Math.round(
    (parts.vocalHarmonyWidth + parts.bassPresence + parts.drumDefinition + parts.melodyRange + parts.rhythmDensity + parts.instrumentAddition) / 6
  );
  return { ...parts, total };
}

// verified: false — 여섯 축 숫자는 각 플랜의 verseText/chorusText가 실제로
// 묘사하는 편곡 대비를 하루/챗지피티가 손으로 어림한 값이다(§C-1). 6개
// 플랜 평균 total은 54.5 — 목표 범위(45~70) 중앙 근처가 되도록 의도적으로
// 배치했다(§C-5 "평균 ChorusContrast 45~70").
export const CHORUS_CONTRAST_PLANS: ChorusContrastPlan[] = [
  {
    id: 'harmony-lift',
    labelKo: '하모니 + 스네어 강조',
    verseText: 'acoustic guitar + bass + light drums',
    chorusText: '+ piano + vocal harmony + firmer snare + wider stereo',
    shortForm: 'chorus adds piano, harmony and a firmer snare',
    score: scoreOf({ vocalHarmonyWidth: 70, bassPresence: 55, drumDefinition: 60, melodyRange: 40, rhythmDensity: 45, instrumentAddition: 65 })
  },
  {
    id: 'full-band-swell',
    labelKo: '풀 밴드 진입',
    verseText: 'sparse verse — guitar and voice only',
    chorusText: 'full band enters — bass, drums, string pad, doubled vocal',
    shortForm: 'full band enters on the chorus',
    score: scoreOf({ vocalHarmonyWidth: 60, bassPresence: 75, drumDefinition: 70, melodyRange: 55, rhythmDensity: 65, instrumentAddition: 80 })
  },
  {
    id: 'unison-doubling',
    labelKo: '유니즌 더블링',
    verseText: 'verse carried by piano and soft brushes',
    chorusText: 'chorus doubles the lead vocal in unison, adds tambourine and organ pad',
    shortForm: 'chorus vocal doubled in unison with tambourine',
    score: scoreOf({ vocalHarmonyWidth: 50, bassPresence: 45, drumDefinition: 50, melodyRange: 35, rhythmDensity: 55, instrumentAddition: 60 })
  },
  {
    id: 'strings-swell',
    labelKo: '스트링 스웰',
    verseText: 'verse stays intimate — guitar, upright bass, soft kick',
    chorusText: 'string section swells in, backing harmony stacks, fuller low end',
    shortForm: 'string section swells in on the chorus',
    score: scoreOf({ vocalHarmonyWidth: 65, bassPresence: 60, drumDefinition: 45, melodyRange: 50, rhythmDensity: 40, instrumentAddition: 70 })
  },
  {
    id: 'call-response-texture',
    labelKo: '콜앤리스폰스 타악기',
    verseText: 'verse — lead vocal alone over a light rhythm section',
    chorusText: 'backing vocals answer each line, a percussion layer widens the groove',
    shortForm: 'backing vocals answer each chorus line',
    score: scoreOf({ vocalHarmonyWidth: 55, bassPresence: 50, drumDefinition: 60, melodyRange: 30, rhythmDensity: 70, instrumentAddition: 50 })
  },
  {
    id: 'gentle-second-voice',
    labelKo: '보컬 하모니 한 겹만',
    verseText: 'verse — acoustic guitar and voice',
    chorusText: 'chorus adds only a second vocal harmony line, everything else holds steady',
    shortForm: 'chorus adds a second vocal harmony line',
    score: scoreOf({ vocalHarmonyWidth: 55, bassPresence: 40, drumDefinition: 45, melodyRange: 40, rhythmDensity: 45, instrumentAddition: 50 })
  }
];

export function chorusContrastPlanById(id: string): ChorusContrastPlan | undefined {
  return CHORUS_CONTRAST_PLANS.find(plan => plan.id === id);
}

export function chorusContrastInstructionText(plan: ChorusContrastPlan): string {
  return `Verse: ${plan.verseText} / Chorus: ${plan.chorusText}`;
}
