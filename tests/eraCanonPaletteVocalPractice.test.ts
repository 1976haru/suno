import { describe, expect, it } from 'vitest';
import { ERA_CANON_PALETTES } from '../src/data/eraCanonPalettes';
import { detectVocalGender } from '../src/core/vocalPlan';

/**
 * 지시문 74 (TASK B-3) — 팔레트 vocalTraits는 "그 시대의 녹음 관행"을 담아야
 * 하고(§2.3-2: 음색·성숙도만으로는 현대 가수도 그대로 만족시킬 수 있다),
 * 동시에 성별 단어를 절대 담아서는 안 된다(§2.4-B3, data/eraCanonPalettes.ts
 * vocalTraits 주석에 기록된 실측 사고: 성별 단어가 섞이면 detectVocalGender()가
 * ambiguous로 판정해 실제 배정된 성별이 프롬프트에서 사라진다).
 */
describe('[지시문74 TASK B-3] 팔레트 vocalTraits — 시대 창법 어휘', () => {
  it('어떤 팔레트의 vocalTraits도 성별 판정을 흔들지 않는다', () => {
    for (const palette of ERA_CANON_PALETTES) {
      for (const trait of palette.vocalTraits) {
        // detectVocalGender는 성별 단어가 있으면 'male'/'female'을, 둘 다
        // 있으면 null(ambiguous)을 돌려준다. 성별 어휘가 없는 문구는 그대로
        // null이 나오므로, 여기서는 "이 문구 하나만으로 성별이 잡히는가"를
        // 본다 — 잡히면 그 자체가 사고다.
        expect(detectVocalGender(trait), `${palette.id}: ${trait}`).toBeNull();
      }
    }
  });

  it('모든 팔레트가 녹음 관행 어휘를 최소 1개 갖는다 — 음색만으로는 시대가 갈리지 않는다', () => {
    // 녹음 관행을 가리키는 표지 어휘. 음색(warm/husky/mature)이나 장식음
    // (vibrato/melisma)이 아니라, "어떻게 녹음됐는가"를 말하는 단어들이다.
    const PRACTICE_MARKERS = [
      'take', 'click', 'microphone', 'portamento', 'slid', 'slide', 'punch-in', 'punch-ins',
      'compressed', 'uncompressed', 'breaths', 'room', 'live', 'edits', 'edited', 'level',
      'levelled', 'louder', 'timing', 'sample', 'pass'
    ];
    for (const palette of ERA_CANON_PALETTES) {
      const hasPractice = palette.vocalTraits.some(trait =>
        PRACTICE_MARKERS.some(marker => new RegExp(`\\b${marker}\\b`, 'i').test(trait))
      );
      expect(hasPractice, palette.id).toBe(true);
    }
  });

  it('productionTraits는 모든 팔레트에서 2개 이상이다 — rotatingEraPaletteAtoms가 항상 2개를 뽑는다', () => {
    for (const palette of ERA_CANON_PALETTES) {
      expect(palette.productionTraits.length, palette.id).toBeGreaterThanOrEqual(2);
    }
  });
});
