/** 지시문 79 TASK A-2 — 컨셉↔채널 부적합 경고가 실제 산출물에 실리는지 왕복 확인. */
import { channelPresets, genrePacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { evaluateConceptChannelFit } from '../../src/core/conceptChannelFit';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CASES: Array<[string, string]> = [
  ['showa-seventies', '60년대 올드팝'],
  ['showa-seventies', '70년대 가요'],
  ['oldpop-lounge-main', '2000년대 감성'],
  ['millennium-jpop', '60년대 올드팝'],
  ['headphones-down-low', '늦은 밤 헤드폰'],
  ['good-morning-memory-radio', '60년대 올드팝'],
];

const origWarn = console.warn;
console.warn = () => {};
for (const [channelId, concept] of CASES) {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const genreIds = channel.preferredGenres.slice(0, 5);
  const fit = evaluateConceptChannelFit(concept, channel.archetype, genreIds);
  const opts = makeOptions({ channel, projectTitle: 'Audit79 Fit', songCount: 15, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
  const slots = preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as unknown as Array<{ genreWarning?: string }>;
  console.log(`\n##### ${channelId} × "${concept}"`);
  console.log(`  fits=${fit.fits}  시대=${fit.eraPrimary ?? '-'} 후보 ${fit.eraCandidateCount}종  지목장르 ${fit.pointedGenreIds.length}종 / 코어교집합 ${fit.coreIntersection.length}종`);
  console.log(`  슬롯0 genreWarning: ${slots[0]?.genreWarning ?? '(없음)'}`);
}
console.warn = origWarn;
