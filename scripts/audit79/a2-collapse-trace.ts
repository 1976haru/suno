/**
 * 지시문 79 TASK A — 15/15 붕괴가 실제로 어느 함수에서 일어나는지 추적한다.
 * 감사 스크립트 f3-genre-collapse.ts와 같은 경로(preallocateSongSlots)를 쓴다.
 * 읽기 전용.
 */
import { channelPresets, genrePacks } from '../../src/data/presets';
import { getGenreById } from '../../src/data/genreLibrary';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { extractEraConstraint } from '../../src/core/constraints';
import { applyWorkspaceEraFloor } from '../../src/core/constraints';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CASES: Array<[string, string]> = [
  ['showa-seventies', '60년대 올드팝'],
  ['showa-seventies', '1960년대 감성'],
  ['showa-seventies', '70년대 가요'],
  ['oldpop-lounge-main', '2000년대 감성'],
  ['millennium-jpop', '60년대 올드팝'],
];

const origWarn = console.warn;
console.warn = () => {};

for (const [channelId, concept] of CASES) {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const genreIds = channel.preferredGenres.slice(0, 5);
  const opts = makeOptions({ channel, projectTitle: 'Audit79 Collapse', songCount: 15, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;

  const raw = extractEraConstraint(concept);
  const era = applyWorkspaceEraFloor(raw, channel.archetype);

  const slots = preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as unknown as Array<{ effectiveGenreIds: string[] }>;
  const ids = slots.map(s => s.effectiveGenreIds[0]);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  console.log(`\n##### ${channelId} × "${concept}"`);
  console.log(`  선택 장르 ${genreIds.length}종: ${genreIds.join(', ')}`);
  console.log(`    각 장르의 eraTag: ${genreIds.map(id => `${id}=${getGenreById(id)?.eraTag ?? '-'}`).join(' | ')}`);
  console.log(`  extractEraConstraint : ${JSON.stringify(raw)}`);
  console.log(`  워크스페이스 바닥 적용 후: ${JSON.stringify(era)}`);
  console.log(`  실제 배정 ${counts.size}종: ${[...counts.entries()].map(([id, n]) => `${id}×${n}`).join(', ')}`);
}
console.warn = origWarn;
