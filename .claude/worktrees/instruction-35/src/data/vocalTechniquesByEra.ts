import type { EraBucket } from './eraExclusions';

/**
 * v3.80 (TASK E) — era-specific vocal TECHNIQUES (how the voice is actually
 * used — harmony stacking, falsetto lifts, melisma), distinct from
 * data/vocalTraits.ts's register/delivery/timbre/proximity axes (WHAT the
 * voice sounds like) and data/vocalPresets.ts's whole-voice archetypes. A
 * real 1950s-60s doo-wop track and a 1980s adult-contemporary ballad
 * currently get the same 4-axis vocabulary regardless of era, even though
 * the actual singing technique of each era differs (four-part backing
 * harmony vs. a sustained power note): this file adds a small, era-matched
 * technique phrase on top of the existing axes, not a replacement for them.
 *
 * Each entry is capped at 8 words (this task's own explicit
 * "기법 서술은 8단어를 넘지 말 것") — core/vocalPlan.ts (or wherever this is
 * wired) enforces that as a real per-entry constraint, not just a
 * convention here; see this file's own test for the actual measured cap.
 */
export const VOCAL_TECHNIQUES_BY_ERA: Record<EraBucket, string[]> = {
  '1950s-60s': [
    'close four-part backing harmony',
    'nonsense-syllable backing vocals',
    'unison shout on the hook',
    // 지시문 21 (TASK C) — 'girl-group unison lead' -> gender-neutral로 수정.
    // 실측: 이 파일 자체는 "기법"(technique)만 다루는 성별 무관 어휘 표라고
    // 스스로 문서화하지만, 이 항목만 유일하게 성별 단어('girl')를 포함해
    // detectVocalGenderPresence가 male 단독 트랙에서도 female:true로
    // 오판정(core/vocalPlan.ts). 시니어 채널 장르 풀 확장(신규 6종 배선)이
    // 기존에 도달하지 못했던 seed 경로를 열면서 처음 실측 재현됨
    // (tests/promptContradictionsAllWorkspaces.test.ts). 기법 자체(유니즌
    // 앙상블 리드)는 그대로 두고 성별 단어만 제거 — 데이터 한 단어 교정,
    // 로직/시그니처 변경 없음.
    'ensemble unison lead'
  ],
  '1970s': [
    'falsetto lift on the chorus',
    'alternating chest and falsetto',
    'gospel-inflected melisma',
    'double-tracked lead vocal',
    'smooth crooning legato'
  ],
  '1980s': [
    'wide stacked backing harmony',
    'sustained belt-free power note',
    'breathy intimate verse into full chorus',
    'octave-doubled hook line'
  ],
  timeless: [
    'warm conversational lead delivery',
    'gentle unhurried phrasing throughout',
    'plain unadorned melodic delivery'
  ],
  // TASK B1 — kr2030-y2k-retro is the only '2000s'-tagged genre. Standard
  // Y2K-era R&B-pop vocal techniques, same ≤8-word cap as every entry above.
  '2000s': [
    'runs and melisma on the hook',
    'stacked ad-lib harmonies in the bridge',
    'bright unison group vocal on the chorus',
    'call-and-response vocal ad-libs'
  ]
};
