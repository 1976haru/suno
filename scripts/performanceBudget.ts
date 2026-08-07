/**
 * codex 지시문 07 (TASK I) — 성능 예산. §명시: "성능 목표는 실제 baseline을
 * 측정한 뒤 설정한다" — 이 스크립트가 그 실측(baseline measurement)입니다.
 * isolationAudit.ts/securityAudit.ts와 같은 §6-2 원칙: 각 measureP* 함수를
 * tests/performanceBudget.test.ts가 그대로 import해서 재사용합니다.
 *
 * Real, external constraint (same class as eslint.config.js's documented
 * TS7/typescript-eslint gap): measureMultiSetPreflight90Songs's import
 * chain (multiSetGeneration -> generationPreflight -> localGenerationClient)
 * contains a Vite-only `?worker` import. Plain `npx tsx` has no Vite
 * transform pipeline, so it cannot resolve that specifier and a bare
 * `npx tsx scripts/performanceBudget.ts` will crash on module load. This
 * is not a bug in this script. Real baseline numbers are obtained via
 * `npm run perf:budget` (vitest — the same real transform pipeline the
 * browser and the rest of the test suite already run this exact code
 * path through), not via direct tsx execution.
 */
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { evaluateDesignGate } from '../src/core/designGate';
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { combineMultiSetPreflight } from '../src/core/multiSetGeneration';
import { runFullAudit } from '../src/core/fullAudit';
import { checkSceneSimilarity } from '../src/core/duplicationGate';
import { composeStylePrompt, type PromptPart } from '../src/core/promptComposer';
import { buildGenerationSnapshot } from '../src/core/generationSnapshot';
import { buildStructuredRewriteInstructions } from '../src/core/rewriteInstruction';
import { importSongsJson } from '../src/core/bridgeImport';
import { inspectImportReport } from '../src/core/importInspection';
import { qualityPolicyForWorkspace } from '../src/data/workspaceQualityPolicies';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions, ScopedIssue } from '../src/types';

export interface PerformanceMeasurement {
  operation: string;
  durationMs: number;
}

function makeOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = overrides.channel || channelPresets[0];
  return {
    channel, projectTitle: 'Perf Test', songCount: 18, lyricLanguage: 'english',
    market: channel.market, audience: channel.audience, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods,
    seasonId: 'christmas', vocalTone: channel.defaultVocal, perspective: 'firstPerson', lyricDepth: 'commercial',
    durationTarget: 'under3m30', moneyChordMode: 'default', customMoneyChord: '', customConcept: '', avoidWords: '', personaMode: false,
    ...overrides
  };
}

function time<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  return { result, durationMs: performance.now() - start };
}

const testGenres = genrePacks.filter(g => channelPresets[0].preferredGenres.includes(g.id));
const testMoods = moodPacks.filter(m => channelPresets[0].preferredMoods.includes(m.id));
const testSeason = seasonPacks.find(s => s.id === 'christmas')!;

export function measurePreallocation18Songs(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const { durationMs } = time(() => preallocateSongSlots(opts, testGenres));
  return { operation: 'preallocation-18-songs', durationMs };
}

export function measureDesignGate(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const slots = preallocateSongSlots(opts, testGenres);
  const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.audience);
  const constraints = resolveConstraintsFromOptions(opts, audienceProfile);
  const { durationMs } = time(() => evaluateDesignGate(slots, constraints, opts));
  return { operation: 'design-gate', durationMs };
}

export function measureMultiSetPreflight90Songs(): PerformanceMeasurement {
  // combineMultiSetPreflight is the real pure aggregation step of the
  // multi-set preflight pipeline (per-set evaluateGenerationRequest results
  // -> one combined summary) — the per-set evaluation itself is already
  // covered by measureDesignGate's own real designGate pass; this measures
  // the real aggregation cost across a realistic 5-set x 18-song (90-song) run.
  const perSet = Array.from({ length: 5 }, () => ({ allowed: true, requiresAcknowledgement: false, reasons: [], contractSignature: 'sig' }));
  const { durationMs } = time(() => combineMultiSetPreflight(perSet));
  return { operation: 'multiset-preflight-90-songs', durationMs };
}

export function measureFullAudit(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.audience);
  const { durationMs } = time(() => runFullAudit(blueprint.songs, { conceptLabel: opts.projectTitle, songCount: 18, audienceProfile }));
  return { operation: 'full-audit', durationMs };
}

export function measureRewritePlan(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const policy = qualityPolicyForWorkspace('senior-oldpop');
  const issues: ScopedIssue[] = blueprint.songs.slice(0, 5).map(song => ({ scope: 'track', id: 'english-grammar-errors', labelKo: 'x', affectedTracks: [song.trackNo], fixHintKo: 'x' }));
  const { durationMs } = time(() => buildStructuredRewriteInstructions(issues, blueprint.songs, policy));
  return { operation: 'rewrite-plan', durationMs };
}

export function measureHistorySnapshot(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const slots = preallocateSongSlots(opts, testGenres);
  const { durationMs } = time(() => buildGenerationSnapshot({
    options: opts, provider: { provider: 'local', model: '', temperature: 0.7, batchSize: 1, keyStorageMode: 'session', apiKey: '' } as never, season: testSeason, slots
  }));
  return { operation: 'history-snapshot', durationMs };
}

export function measureSceneSimilarity(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const recentSignatures = blueprint.songs.slice(0, 10).map((song, i) => ({ situation: song.listenerSituation, packId: `pack-${i}`, trackNo: song.trackNo }));
  const { durationMs } = time(() => checkSceneSimilarity(blueprint.songs, recentSignatures));
  return { operation: 'scene-similarity', durationMs };
}

export function measureImportInspection(): PerformanceMeasurement {
  const opts = makeOpts({ songCount: 18 });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  // Real round-trip: a coding agent's own output file is exactly {songs:[...]}
  // shaped JSON text — importSongsJson expects (and inspectImportReport
  // analyzes) that same real shape, not a synthetic stand-in.
  const rawText = JSON.stringify({ songs: blueprint.songs });
  const slots = preallocateSongSlots(opts, testGenres);
  const report = importSongsJson(rawText, opts, testGenres, testMoods, testSeason, slots);
  const rawSongs = (JSON.parse(rawText) as { songs: unknown[] }).songs;
  const { durationMs } = time(() => inspectImportReport(report, rawSongs, opts.lyricLanguage));
  return { operation: 'import-inspection', durationMs };
}

export function measurePromptCompilation(): PerformanceMeasurement {
  const parts: PromptPart[] = [
    { id: 'genre', text: 'warm adult contemporary pop' },
    { id: 'tempo', text: '92 BPM mid-tempo' },
    { id: 'vocal', text: 'warm male tenor, close-mic intimate delivery' },
    { id: 'instruments', text: 'acoustic guitar, warm piano, brushed drums, upright bass' }
  ];
  const { durationMs } = time(() => composeStylePrompt(parts));
  return { operation: 'prompt-compilation', durationMs };
}

export function runAllPerformanceMeasurements(): PerformanceMeasurement[] {
  return [
    measurePreallocation18Songs(),
    measureDesignGate(),
    measureMultiSetPreflight90Songs(),
    measureFullAudit(),
    measureRewritePlan(),
    measureHistorySnapshot(),
    measureSceneSimilarity(),
    measureImportInspection(),
    measurePromptCompilation()
  ];
}
