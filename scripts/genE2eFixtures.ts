/**
 * codex 지시문 07 (TASK C) — generates real, schema-correct songs-output.json
 * fixtures for the Playwright import scenarios (valid/repairable/blocked).
 * Reuses the same real generateLocalBlueprint() pipeline scripts/audit.ts
 * and scripts/performanceBudget.ts already run via tsx — no hand-guessed
 * fixture shape. `{ songs: [...] }` is the same real import shape
 * scripts/performanceBudget.ts's measureImportInspection() already
 * verified works against the real importSongsJson()/inspectImportReport().
 *
 * Usage: npx tsx scripts/genE2eFixtures.ts (re-run only if the SongIdea
 * shape or channel presets change enough to make the checked-in fixtures
 * stale).
 */
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions } from '../src/types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const channel = channelPresets[0];
const opts: GenerationOptions = {
  channel, projectTitle: 'E2E Fixture', songCount: 18, lyricLanguage: 'english',
  market: channel.market, audience: channel.audience, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods,
  seasonId: 'christmas', vocalTone: channel.defaultVocal, perspective: 'firstPerson', lyricDepth: 'commercial',
  durationTarget: 'under3m30', moneyChordMode: 'default', customMoneyChord: '', customConcept: '', avoidWords: '', personaMode: false
};
const testGenres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
const testMoods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
const testSeason = seasonPacks.find(s => s.id === 'christmas')!;

const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
const outDir = path.join(__dirname, '..', 'tests', 'e2e', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });

// (a) valid — full 18-song import.
fs.writeFileSync(path.join(outDir, 'valid-songs-output.json'), JSON.stringify({ songs: blueprint.songs }, null, 2));

// (b) repairable — drop 3 tracks (missing-track warning, still importable/confirmable).
const repairableSongs = blueprint.songs.filter(s => ![4, 9, 15].includes(s.trackNo));
fs.writeFileSync(path.join(outDir, 'repairable-songs-output.json'), JSON.stringify({ songs: repairableSongs }, null, 2));

// (c) blocked — structurally malformed: every trackNo collapsed to 1 (real
// duplicate-trackNo hard-block, core/importValidation.ts's
// validateProviderTrackSet -> describeTrackSetValidation, consumed by
// core/importInspection.ts's own 'structure' check).
const blockedSongs = blueprint.songs.map(s => ({ ...s, trackNo: 1 }));
fs.writeFileSync(path.join(outDir, 'blocked-songs-output.json'), JSON.stringify({ songs: blockedSongs }, null, 2));

console.log(`Wrote 3 fixtures to ${outDir}`);
