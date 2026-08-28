/** 유형 D — id 참조 무결성 전수 조사 (읽기 전용) */
import { channelPresets, genrePacks, moodPacks } from '../../src/data/presets';
import { genreLibrary } from '../../src/data/genreLibrary';
import { vocalPresets } from '../../src/data/vocalPresets';
import { CONCEPT_KEYWORD_RULES } from '../../src/data/conceptKeywords';
import { VOCAL_FAMILIES, VOCAL_FAMILY_BY_PRESET_ID } from '../../src/core/conceptVocalPlan';

const genreIds = new Set(genreLibrary.map(g => g.id));
const packIds = new Set(genrePacks.map(g => g.id));
const presetIds = new Set(vocalPresets.map(p => p.id));
const moodIds = new Set(moodPacks.map(m => m.id));
const problems: string[] = [];

// 1. channel.preferredGenres / preferredMoods
for (const c of channelPresets) {
  for (const g of c.preferredGenres) if (!genreIds.has(g) && !packIds.has(g)) problems.push(`channel ${c.id}.preferredGenres: 없는 장르 id "${g}"`);
  for (const m of c.preferredMoods) if (!moodIds.has(m)) problems.push(`channel ${c.id}.preferredMoods: 없는 무드 id "${m}"`);
}

// 2. vocalPreset.suitedArchetypes 존재 여부 + 하드필터 커버리지
const archetypes = [...new Set(channelPresets.map(c => c.archetype))];
for (const p of vocalPresets) {
  for (const a of p.suitedArchetypes ?? []) if (!archetypes.includes(a as never)) problems.push(`vocalPreset ${p.id}.suitedArchetypes: 실제 채널이 없는 아키타입 "${a}"`);
}

// 3. 지시문 77/78 CONCEPT_VOCAL_RULES가 지목하는 프리셋 id
for (const rule of CONCEPT_KEYWORD_RULES as any[]) {
  for (const id of Object.keys(rule.vocalPresetWeights ?? {})) if (!presetIds.has(id)) problems.push(`conceptKeywords rule ${rule.id}: 없는 프리셋 id "${id}"`);
  for (const id of Object.keys(rule.genreWeights ?? {})) if (!genreIds.has(id)) problems.push(`conceptKeywords rule ${rule.id}: 없는 장르 id "${id}"`);
}

// 4. 발성 계열별 매핑 프리셋이 실제로 존재하는가 + 아키타입별 도달성
const famMap: Record<string, string[]> = {};
for (const [pid, fam] of Object.entries(VOCAL_FAMILY_BY_PRESET_ID)) {
  if (!presetIds.has(pid)) problems.push(`VOCAL_FAMILY_BY_PRESET_ID: 없는 프리셋 id "${pid}"`);
  (famMap[fam] ??= []).push(pid);
}

console.log('=== id 참조 무결성 ===');
console.log(problems.length ? problems.join('\n') : '문제 없음');

console.log('\n=== 발성 계열 5종 × 아키타입 도달성 (그 계열의 프리셋이 그 아키타입에 하나라도 등록돼 있는가) ===');
const fams = Object.keys(VOCAL_FAMILIES);
console.log('archetype'.padEnd(18) + fams.map(f => f.padEnd(9)).join(''));
let holes = 0;
for (const a of archetypes) {
  const row = fams.map(f => {
    const n = (famMap[f] ?? []).filter(pid => {
      const p = vocalPresets.find(v => v.id === pid)!;
      if (p.forKids) return false;
      return p.suitedArchetypes?.includes(a as never);
    }).length;
    if (n === 0) holes++;
    return (n === 0 ? '없음' : `${n}종`).padEnd(9);
  });
  console.log(a.padEnd(18) + row.join(''));
}
console.log(`\n계열-아키타입 빈칸 ${holes}개`);
