import type { SectionStyleShift } from '../types';

/**
 * 지시문 37 (TASK B) — "K-pop 아이돌 특징 ② 한 음악에 여러 장르가 있다"가
 * 미구현이었다(실측: 18곡 전부 곡당 한 장르 고정). 절은 R&B, 후렴은 EDM,
 * 브릿지는 랩처럼 섹션마다 편곡 밀도/질감이 바뀌는 실제 K-pop 관행을
 * 프롬프트 지시문으로 명시한다.
 *
 * 지시문 52 (TASK C) — 하루: "장르 안에서도 세세하게 나누면 여러 개 있잖아."
 * 기존 2~3회(Verse/Chorus[/Bridge] 2~3종)에서 3~4회·4종 이상으로 넓힌다.
 * 모든 프리셋에 Pre-Chorus를 추가하고(2회 프리셋은 3회로), 원래 3회였던
 * "-rap-bridge" 3종은 4회가 된다. Pre-Chorus 클로즈는 §C-4 "다른 장르의
 * styleAtoms를 섞는다"에 따라 이 프리셋 계열이 아닌 다른 kridol-* 계열의
 * 질감 단어를 일부러 빌려 쓴다(genreId는 그대로 하나 — 배열화하지 않는다).
 * SECTION_SCOPED_LABEL_PATTERN(data/promptAxisLexicon.ts)이 Pre-Chorus도
 * 이미 인식하므로 정규화 축 판정에 새 라벨을 추가할 필요는 없었다(실측
 * 확인 — 별도 코드 변경 없음).
 */
export const SECTION_STYLE_SHIFT_MAX_TRANSITIONS = 4;
export const SECTION_STYLE_SHIFT_MIN_TRANSITIONS = 3;
export const SECTION_STYLE_SHIFT_VERIFIED = false;

export interface SectionStyleShiftPreset {
  id: string;
  labelKo: string;
  shifts: SectionStyleShift[];
}

// verified: false — 각 프리셋의 styleAtoms는 하루/챗지피티가 손으로 고른
// 장르-내 대비 조합이다(§B-1의 "Verse laid-back R&B sparse / Chorus EDM
// drop dense synth / Bridge rap minimal beat" 예시를 출발점으로 K-pop
// 서브장르 3종(kridol-synth-dance/kridol-retro-funk/kridol-latin-afro)에
// 맞춰 확장). 실측 검증은 아직 없다.
export const SECTION_STYLE_SHIFT_PRESETS: SectionStyleShiftPreset[] = [
  {
    id: 'rnb-verse-edm-chorus',
    labelKo: '벌스 R&B, 프리코러스 라틴 빌드, 후렴 EDM',
    shifts: [
      { section: 'Verse', styleAtoms: ['laid-back R&B groove', 'sparse arrangement'] },
      // §C-4 — 라틴 계열(kridol-latin-afro)의 퍼커션 질감을 빌려온 빌드업.
      { section: 'Pre-Chorus', styleAtoms: ['building latin-tinged percussion lift', 'rising vocal stack into the drop'] },
      { section: 'Chorus', styleAtoms: ['EDM-influenced drop', 'dense synth stack'] }
    ]
  },
  {
    id: 'rnb-verse-edm-chorus-rap-bridge',
    labelKo: '벌스 R&B, 프리코러스 라틴 빌드, 후렴 EDM, 브릿지 랩',
    shifts: [
      { section: 'Verse', styleAtoms: ['laid-back R&B groove', 'sparse arrangement'] },
      { section: 'Pre-Chorus', styleAtoms: ['building latin-tinged percussion lift', 'rising vocal stack into the drop'] },
      { section: 'Chorus', styleAtoms: ['EDM-influenced drop', 'dense synth stack'] },
      { section: 'Bridge', styleAtoms: ['rap section', 'minimal beat'] }
    ]
  },
  {
    id: 'funk-verse-disco-chorus',
    labelKo: '벌스 펑크, 프리코러스 신스 빌드, 후렴 디스코',
    shifts: [
      { section: 'Verse', styleAtoms: ['sparse funk guitar groove', 'voice-forward'] },
      // §C-4 — 신스댄스(kridol-synth-dance) 계열의 신스 라이저를 빌려온 빌드업.
      { section: 'Pre-Chorus', styleAtoms: ['rising synth riser build', 'filtered high-pass tension'] },
      { section: 'Chorus', styleAtoms: ['four-on-the-floor disco pulse', 'full horn stack'] }
    ]
  },
  {
    id: 'funk-verse-disco-chorus-rap-bridge',
    labelKo: '벌스 펑크, 프리코러스 신스 빌드, 후렴 디스코, 브릿지 랩',
    shifts: [
      { section: 'Verse', styleAtoms: ['sparse funk guitar groove', 'voice-forward'] },
      { section: 'Pre-Chorus', styleAtoms: ['rising synth riser build', 'filtered high-pass tension'] },
      { section: 'Chorus', styleAtoms: ['four-on-the-floor disco pulse', 'full horn stack'] },
      { section: 'Bridge', styleAtoms: ['half-time rap delivery', 'stripped-back beat'] }
    ]
  },
  {
    id: 'latin-verse-pop-chorus',
    labelKo: '벌스 라틴 그루브, 프리코러스 펑크 빌드, 후렴 팝 훅',
    shifts: [
      { section: 'Verse', styleAtoms: ['intimate reggaeton-lite percussion', 'sparse voice-forward mix'] },
      // §C-4 — 레트로 펑크(kridol-retro-funk) 계열의 기타 스탭을 빌려온 빌드업.
      { section: 'Pre-Chorus', styleAtoms: ['sparse funk guitar stab build', 'syncopated pre-drop tension'] },
      { section: 'Chorus', styleAtoms: ['full pop chorus lift', 'layered vocal harmony'] }
    ]
  },
  {
    id: 'latin-verse-pop-chorus-rap-bridge',
    labelKo: '벌스 라틴 그루브, 프리코러스 펑크 빌드, 후렴 팝 훅, 브릿지 랩',
    shifts: [
      { section: 'Verse', styleAtoms: ['intimate reggaeton-lite percussion', 'sparse voice-forward mix'] },
      { section: 'Pre-Chorus', styleAtoms: ['sparse funk guitar stab build', 'syncopated pre-drop tension'] },
      { section: 'Chorus', styleAtoms: ['full pop chorus lift', 'layered vocal harmony'] },
      { section: 'Bridge', styleAtoms: ['rap-delivery bridge', 'minimal percussion-only backing'] }
    ]
  }
];

export function sectionStyleShiftPresetById(id: string): SectionStyleShiftPreset | undefined {
  return SECTION_STYLE_SHIFT_PRESETS.find(preset => preset.id === id);
}

/** "Verse: laid-back R&B groove, sparse arrangement / Chorus: EDM-influenced drop, dense synth stack" — bridgeInstruction의 verbatim weave 지시에 그대로 쓰인다. 각 섹션 라벨을 유지해야 promptAxisLexicon의 SECTION_SCOPED_LABEL_PATTERN이 축 중복 오판을 피할 수 있다. */
export function sectionStyleShiftInstructionText(preset: SectionStyleShiftPreset): string {
  return preset.shifts.map(shift => `${shift.section}: ${shift.styleAtoms.join(', ')}`).join(' / ');
}
