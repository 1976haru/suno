/**
 * 지시문 11 (TASK H) — senior-oldpop 3세트(18곡×3=54곡) 텍스트 품질 성공률
 * 측정을 위한 실제 slot plan 덤프. preallocateSongSlots는 실제 브릿지
 * 배포 경로(core/bridgeInstruction.ts)가 그대로 쓰는 함수 — 하루가 직접
 * 작성하는 54곡의 잠긴 필드(genre/tempo/vocalGender/structureTemplate/
 * lyricTheme/hookPhrase 등)를 실제 앱 로직 그대로 얻기 위해 사용한다.
 *
 * Usage: npx tsx scripts/dumpSlotPlanForTaskH.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks } from '../src/data/presets';
import type { GenerationOptions } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'lyrics', 'taskH');
fs.mkdirSync(outDir, { recursive: true });

const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));

const SETS: { setId: string; customConcept: string }[] = [
  { setId: 'set1', customConcept: '' },
  { setId: 'set2', customConcept: '여름밤 야외에서 듣던 재즈 페스티벌 회상' },
  { setId: 'set3', customConcept: '크리스마스 캐롤과 함께한 겨울밤' }
];

for (const { setId, customConcept } of SETS) {
  const opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount' | 'genreIds' | 'moodIds' | 'moneyChordMode' | 'moneyChordModeIsExplicitChoice' | 'customMoneyChord' | 'earwormMode' | 'vocalQuota' | 'vocalTone' | 'avoidWords' | 'negativeStyle' | 'introUniqueness' | 'diversityAllocations' | 'perspective' | 'customLyricThemeScene' | 'customConcept' | 'genreBlendWeights' | 'genreBlendMode' | 'audience' | 'ratingInsights'> = {
    channel,
    projectTitle: `TASK H ${setId}`,
    lyricLanguage: 'english',
    songCount: 18,
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
    customConcept,
    audience: channel.audience
  };

  const slots = preallocateSongSlots(opts, genres);
  fs.writeFileSync(path.join(outDir, `${setId}-slots.json`), JSON.stringify(slots, null, 2));
  console.log(`[dumpSlotPlanForTaskH] ${setId}: ${slots.length}개 슬롯 -> ${path.join(outDir, `${setId}-slots.json`)}`);
}
