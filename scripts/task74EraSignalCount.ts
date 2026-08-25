/**
 * 지시문 74 (§4/§7) — stylePrompt 중 시대/프로덕션 절의 개수와 자리, 보컬 성별
 * 판정, 단어 수를 잰다. §2.1의 실측(22개 절 중 3개, 18·19번 자리)과 같은 축이다.
 *
 * Usage: npx tsx scripts/task74EraSignalCount.ts <songs.json> [...]
 */
import * as fs from 'node:fs';
import { classifyClause } from '../src/data/promptAxisLexicon';
import { detectVocalGender } from '../src/core/vocalPlan';

const files = process.argv.slice(2);
let totalWords = 0;
let totalSongs = 0;

for (const file of files) {
  const songs = (JSON.parse(fs.readFileSync(file, 'utf-8')) as { songs: Record<string, string>[] }).songs;
  console.log(`\n=== ${file} ===`);
  for (const song of songs) {
    const clauses = song.stylePrompt.split(',').map(c => c.trim()).filter(Boolean);
    // classifyClause의 MIX_KEYWORDS는 ['mix','ambience','mono','studio','room tone',
    // 'coloration','room sound','echo'] 8개뿐이라 "narrow stereo image"/"analog tape
    // saturation" 같은 실제 프로덕션 절을 잡지 못한다. §2.1의 3/22도 손으로 센
    // 값이므로, 같은 기준(그 시대의 녹음/믹스를 말하는 절)을 명시적 어휘로 센다.
    const PRODUCTION_MARKERS = [
      'tape', 'reverb', 'stereo', 'mono', 'compress', 'compressed', 'uncompressed', 'room',
      'saturation', 'console', 'noise floor', 'low end', 'band-limited', 'pumps', 'take',
      'click', 'mic', 'microphone', 'portamento', 'ambience', 'grain', 'top end', 'echo', 'live band'
    ];
    const eraish: number[] = [];
    clauses.forEach((clause, i) => {
      const axis = classifyClause(clause, i === 0);
      const lower = clause.toLowerCase();
      const marked = PRODUCTION_MARKERS.some(m => lower.includes(m));
      if (axis === 'era' || axis === 'mix' || marked) eraish.push(i + 1);
    });
    const words = song.stylePrompt.split(/\s+/).filter(Boolean).length;
    totalWords += words;
    totalSongs += 1;
    console.log(
      `#${song.trackNo} "${song.title}" — era/production clauses: ${eraish.length}/${clauses.length} at positions [${eraish.join(', ')}] · ` +
      `prompt words ${words} · detectVocalGender(stylePrompt)=${detectVocalGender(song.stylePrompt) ?? 'null'}`
    );
  }
}
console.log(`\naverage stylePrompt words across ${totalSongs} songs: ${(totalWords / totalSongs).toFixed(1)}`);
