/**
 * 지시문 74 (TASK A) — 검증용 임시 프로브. 실제 브릿지 경로가 쓰는
 * preallocateSongSlots를 그대로 호출해 BPM별 sectionCountRange /
 * maxInstrumentalSections / structureTemplate을 표로 찍는다.
 *
 * Usage: npx tsx scripts/task74SlotProbe.ts [channelId] [songCount]
 */
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks } from '../src/data/presets';
import { instrumentalExtensionForBpm, minTotalSectionsForBpm } from '../src/core/bpmLengthControl';
import type { GenerationOptions } from '../src/types';

const channelId = process.argv[2] || 'after-hours-deep-house';
const songCount = Number(process.argv[3] || 12);
const channel = channelPresets.find(c => c.id === channelId);
if (!channel) throw new Error(`unknown channel ${channelId}`);

const opts = {
  channel,
  projectTitle: `지시문74 probe ${channelId}`,
  lyricLanguage: 'english',
  songCount,
  genreIds: channel.preferredGenres,
  moodIds: channel.preferredMoods,
  moneyChordMode: 'default',
  moneyChordModeIsExplicitChoice: false,
  customMoneyChord: '',
  earwormMode: false,
  vocalTone: channel.defaultVocal,
  avoidWords: '',
  negativeStyle: '',
  introUniqueness: false,
  perspective: 'firstPerson',
  customConcept: '',
  audience: channel.audience
} as unknown as GenerationOptions;

const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
const slots = preallocateSongSlots(opts, genres);
console.log(`# ${channelId} — ${slots.length} slots`);
console.log('| # | BPM | genre | template | sectionCountRange | maxInstr | floor | instrumental ext |');
console.log('|---|-----|-------|----------|-------------------|----------|-------|------------------|');
for (const slot of slots) {
  const [sMin, sMax] = slot.sectionCountRange ?? [0, 0];
  console.log(
    `| ${slot.trackNo} | ${slot.tempo} | ${slot.genreId ?? '-'} | ${slot.structureTemplate ?? '-'} | ${sMin}-${sMax} | ${slot.maxInstrumentalSections ?? '-'} | ${minTotalSectionsForBpm(slot.tempo) || '-'} | ${instrumentalExtensionForBpm(slot.tempo, slot.structureTemplate) || '-'} |`
  );
}
