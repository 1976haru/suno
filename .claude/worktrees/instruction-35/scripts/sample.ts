/**
 * Prints a full local-provider playlist pack to stdout for manual read-through.
 * Automated tests check structural properties (no duplicate titles, motif
 * counts, etc.) but can't judge whether the lyrics actually read as coherent
 * sentences a person could sing — that needs a human to read the output.
 *
 * Usage: npx tsx scripts/sample.ts --count 30 --lang english [--channel <id>] [--season <id>]
 */
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs } from '../src/core/quality';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions, LyricLanguage } from '../src/types';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
  };
  const count = Math.min(30, Math.max(1, parseInt(get('--count', '12'), 10) || 12));
  const lang = get('--lang', 'english') as LyricLanguage;
  return { count, lang, channelId: get('--channel', channelPresets[0].id), seasonId: get('--season', 'christmas') };
}

const { count, lang, channelId, seasonId } = parseArgs();
const channel = channelPresets.find(c => c.id === channelId) ?? channelPresets[0];
const season = seasonPacks.find(s => s.id === seasonId) ?? seasonPacks[0];
const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));

const opts: GenerationOptions = {
  channel,
  projectTitle: `Sample Pack (${lang})`,
  songCount: count,
  lyricLanguage: lang,
  market: channel.market,
  audience: channel.audience,
  genreIds: channel.preferredGenres,
  moodIds: channel.preferredMoods,
  seasonId: season.id,
  vocalTone: channel.defaultVocal,
  perspective: 'firstPerson',
  lyricDepth: 'commercial',
  durationTarget: 'under3m30',
  moneyChordMode: 'default',
  customMoneyChord: '',
  customConcept: '',
  avoidWords: ''
};

const rawBlueprint = generateLocalBlueprint(opts, genres, moods, season);
const blueprint = { ...rawBlueprint, songs: scoreSongs(rawBlueprint.songs, opts.channel) };

console.log(`# ${blueprint.projectTitle}`);
console.log(`Channel: ${blueprint.channelName}`);
console.log(`Concept: ${blueprint.oneLineConcept}`);
console.log(`Sonic: ${blueprint.sonicSignature}`);
console.log(`Vocal: ${blueprint.vocalSignature}`);
console.log('');

const titles = blueprint.songs.map(song => song.title);
console.log(`Titles (${titles.length}, ${new Set(titles).size} unique):`);
titles.forEach((title, i) => console.log(`  ${i + 1}. ${title}`));
console.log('');

for (const song of blueprint.songs) {
  console.log('='.repeat(72));
  console.log(`${song.trackNo}. ${song.title}  (quality: ${song.qualityScore}/100)`);
  if (song.warnings.length) console.log(`  warnings: ${song.warnings.join(' / ')}`);
  console.log('-'.repeat(72));
  console.log(song.lyrics);
  console.log('');
}
