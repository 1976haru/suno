/**
 * 지시문 77 (TASK A) — 컨셉→발성 축의 실측 검사.
 *
 * ① vocalPresetWeights를 가진 규칙 수와, 그 규칙들이 지목한 프리셋 id가
 *    vocalPresets.ts에 실존하는지(지시문 72에서 확인된 "존재하지 않는 id는
 *    필터에서 조용히 버려진다" 패턴의 방지).
 * ② 지시문 §1.1의 7개 질의가 실제로 매칭되는지.
 * ③ 프리셋 → 발성 계열 매핑표(미매핑 프리셋 포함).
 *
 * advisory 전용 — 항상 exit 0이다(§10 "새 검사로 생성을 차단하지 말 것").
 *
 * Usage: npx tsx scripts/checkConceptVocalAxis.ts [--json]
 */
import { matchConceptRules } from '../src/data/conceptKeywords';
import { vocalPresets } from '../src/data/vocalPresets';
import { suitablePresetsForArchetype } from '../src/core/vocalRecommender';
import {
  conceptVocalRules, resolveConceptVocalIntent, unknownVocalPresetIdsInRules,
  VOCAL_FAMILY_BY_PRESET_ID
} from '../src/core/conceptVocalPlan';

const PROBE_QUERIES = [
  '숨소리 섞인 목소리로 부르는 칠 딥하우스',
  '공기 반 소리 반',
  '숨소리 나는 보컬',
  '속삭이는 목소리',
  'breathy vocal',
  'airy whisper',
  '에어리한 보컬'
];

function main() {
  const jsonMode = process.argv.includes('--json');
  const rules = conceptVocalRules();
  const unknown = unknownVocalPresetIdsInRules();
  const probes = PROBE_QUERIES.map(text => {
    const matched = matchConceptRules(text, 'en-chillhop').filter(rule => rule.vocalPresetWeights);
    const intent = resolveConceptVocalIntent(text, 'en-chillhop');
    return {
      text,
      matchedRuleIds: matched.map(rule => rule.id),
      familyId: intent?.familyId,
      availablePresetIds: intent?.availablePresets.map(preset => preset.id) ?? [],
      unavailablePresetIds: intent?.unavailablePresetIds ?? []
    };
  });
  const adultPresets = vocalPresets.filter(preset => !preset.forKids);
  const unmapped = adultPresets.filter(preset => !VOCAL_FAMILY_BY_PRESET_ID[preset.id]).map(preset => preset.id);
  const chillhopPool = new Set(suitablePresetsForArchetype('en-chillhop').map(preset => preset.id));

  if (jsonMode) {
    console.log(JSON.stringify({ ruleCount: rules.length, unknown, probes, unmapped }, null, 2));
    return;
  }

  console.log('=== 지시문 77 — 컨셉→발성 축 ===\n');
  console.log(`vocalPresetWeights를 가진 규칙: ${rules.length}개 (목표 6개 이상)`);
  for (const rule of rules) {
    console.log(`  ${rule.id.padEnd(28)} ${JSON.stringify(rule.vocalPresetWeights)}`);
  }
  console.log(`\n실존하지 않는 프리셋 id: ${unknown.length}건${unknown.length ? ' — ' + unknown.map(u => `${u.ruleId}/${u.presetId}`).join(', ') : ''}`);

  console.log('\n--- §1.1 질의 재실행 (archetype=en-chillhop) ---');
  for (const probe of probes) {
    const status = probe.matchedRuleIds.length ? '' : '  ⚠️ 매칭 0개';
    console.log(`"${probe.text}" → ${probe.matchedRuleIds.length}개 [${probe.matchedRuleIds.join(', ')}] family=${probe.familyId ?? '—'}${status}`);
    if (probe.unavailablePresetIds.length) {
      console.log(`   ⚠️ 이 채널에 미등록이라 무시: ${probe.unavailablePresetIds.join(', ')}`);
    }
  }

  console.log('\n--- 프리셋 → 발성 계열 매핑 ---');
  for (const preset of adultPresets) {
    const family = VOCAL_FAMILY_BY_PRESET_ID[preset.id] ?? '(미매핑)';
    console.log(`  ${preset.id.padEnd(22)} ${String(family).padEnd(10)} en-chillhop=${chillhopPool.has(preset.id) ? 'Y' : 'N'}`);
  }
  console.log(`\n미매핑 ${unmapped.length}종: ${unmapped.join(', ')}`);
  console.log('  (근거가 애매한 프리셋은 어느 계열에도 넣지 않는다 — core/conceptVocalPlan.ts의 VOCAL_FAMILY_BY_PRESET_ID 주석 참고)');
}

main();
