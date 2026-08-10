import type { SectionStyleShift } from '../types';

/**
 * 지시문 37 (TASK B) — "K-pop 아이돌 특징 ② 한 음악에 여러 장르가 있다"가
 * 미구현이었다(실측: 18곡 전부 곡당 한 장르 고정). 절은 R&B, 후렴은 EDM,
 * 브릿지는 랩처럼 섹션마다 편곡 밀도/질감이 바뀌는 실제 K-pop 관행을
 * 프롬프트 지시문으로 명시한다.
 *
 * SECTION_STYLE_SHIFT_MAX_TRANSITIONS(2~3) — 지시문 37 본문이 직접 제시한
 * 값이지만 그 근거 자체가 "너무 많으면 산만해진다"는 하루의 감이라
 * verified:false 추정치다(§B-3 "※ 추정치. 정책 필드 · verified: false").
 */
export const SECTION_STYLE_SHIFT_MAX_TRANSITIONS = 3;
export const SECTION_STYLE_SHIFT_MIN_TRANSITIONS = 2;
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
    labelKo: '벌스 R&B, 후렴 EDM',
    shifts: [
      { section: 'Verse', styleAtoms: ['laid-back R&B groove', 'sparse arrangement'] },
      { section: 'Chorus', styleAtoms: ['EDM-influenced drop', 'dense synth stack'] }
    ]
  },
  {
    id: 'rnb-verse-edm-chorus-rap-bridge',
    labelKo: '벌스 R&B, 후렴 EDM, 브릿지 랩',
    shifts: [
      { section: 'Verse', styleAtoms: ['laid-back R&B groove', 'sparse arrangement'] },
      { section: 'Chorus', styleAtoms: ['EDM-influenced drop', 'dense synth stack'] },
      { section: 'Bridge', styleAtoms: ['rap section', 'minimal beat'] }
    ]
  },
  {
    id: 'funk-verse-disco-chorus',
    labelKo: '벌스 펑크, 후렴 디스코',
    shifts: [
      { section: 'Verse', styleAtoms: ['sparse funk guitar groove', 'voice-forward'] },
      { section: 'Chorus', styleAtoms: ['four-on-the-floor disco pulse', 'full horn stack'] }
    ]
  },
  {
    id: 'funk-verse-disco-chorus-rap-bridge',
    labelKo: '벌스 펑크, 후렴 디스코, 브릿지 랩',
    shifts: [
      { section: 'Verse', styleAtoms: ['sparse funk guitar groove', 'voice-forward'] },
      { section: 'Chorus', styleAtoms: ['four-on-the-floor disco pulse', 'full horn stack'] },
      { section: 'Bridge', styleAtoms: ['half-time rap delivery', 'stripped-back beat'] }
    ]
  },
  {
    id: 'latin-verse-pop-chorus',
    labelKo: '벌스 라틴 그루브, 후렴 팝 훅',
    shifts: [
      { section: 'Verse', styleAtoms: ['intimate reggaeton-lite percussion', 'sparse voice-forward mix'] },
      { section: 'Chorus', styleAtoms: ['full pop chorus lift', 'layered vocal harmony'] }
    ]
  },
  {
    id: 'latin-verse-pop-chorus-rap-bridge',
    labelKo: '벌스 라틴 그루브, 후렴 팝 훅, 브릿지 랩',
    shifts: [
      { section: 'Verse', styleAtoms: ['intimate reggaeton-lite percussion', 'sparse voice-forward mix'] },
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
