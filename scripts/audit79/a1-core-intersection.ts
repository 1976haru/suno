/**
 * 지시문 79 TASK A — §1.2 재현. 컨셉이 지목한 장르 가중치와 아키타입 코어 장르의
 * 교집합, 그리고 recommendConceptLocal이 실제로 쓰는 후보 종수를 잰다.
 * 읽기 전용.
 */
import { getCoreGenresForArchetype } from '../../src/data/genreLibrary';
import { recommendConceptLocal } from '../../src/core/conceptAgent';
import { matchConceptRules } from '../../src/data/conceptKeywords';
import { channelPresets } from '../../src/data/presets';
import type { ChannelArchetype } from '../../src/types';

const CASES: Array<[ChannelArchetype, string]> = [
  ['showa-70s', '60년대 올드팝'],
  ['showa-70s', '1960년대 감성'],
  ['showa-70s', '70년대 가요'],
];

for (const [archetype, concept] of CASES) {
  const core = getCoreGenresForArchetype(archetype);
  const coreIds = new Set(core.map(g => g.id));
  const rules = matchConceptRules(concept, archetype);
  const pointed = new Map<string, number>();
  for (const rule of rules) {
    for (const [id, w] of Object.entries((rule as { genreWeights?: Record<string, number> }).genreWeights ?? {})) {
      pointed.set(id, (pointed.get(id) ?? 0) + w);
    }
  }
  const inter = [...pointed.keys()].filter(id => coreIds.has(id));

  const channel = channelPresets.find(c => c.archetype === archetype);
  const rec = recommendConceptLocal(concept, archetype, channel ? { genreId: channel.preferredGenres[0] } : undefined, 0, 15);
  const alloc = rec.recommendations[0]?.genreAllocation ?? [];
  const allocIds = [...new Set(alloc.map(s2 => s2.genreId))];

  console.log(`\n##### ${archetype} × "${concept}"`);
  console.log(`  코어 장르 ${core.length}종: ${core.map(g => g.id).join(', ')}`);
  console.log(`  매칭 규칙 ${rules.length}개: ${rules.map(r => (r as { id: string }).id).join(', ')}`);
  console.log(`  지목 장르 ${pointed.size}종`);
  console.log(`  코어 교집합 ${inter.length}종${inter.length ? `: ${inter.join(', ')}` : ''}`);
  console.log(`  → recommendConceptLocal의 genreAllocation: ${allocIds.length}종  ${alloc.map(s2 => `${s2.genreId}×${s2.count}`).join(', ')}`);
}
