/**
 * codex 지시문 07 (TASK C) — generates real, schema-correct songs-output.json
 * fixtures for the Playwright import scenarios (valid/repairable/blocked).
 * Reuses the same real generateLocalBlueprint() pipeline scripts/audit.ts
 * and scripts/performanceBudget.ts already run via tsx — no hand-guessed
 * fixture shape. `{ songs: [...] }` is the same real import shape
 * scripts/performanceBudget.ts's measureImportInspection() already
 * verified works against the real importSongsJson()/inspectImportReport().
 *
 * 지시문 11 (TASK G) — 이전에는 senior-oldpop(channelPresets[0]) 하나만
 * 만들었다. 7-워크스페이스 × 9-시나리오 실제 인수 매트릭스를 위해 나머지
 * 6개 워크스페이스도 각자 실제 대표 채널로 동일한 3종(valid/repairable/
 * blocked) 픽스처를 생성한다 — data/workspaces/index.ts의 실제
 * archetypeIds가 각 워크스페이스의 진짜 대표 archetype이다.
 *
 * Usage: npx tsx scripts/genE2eFixtures.ts (re-run only if the SongIdea
 * shape or channel presets change enough to make the checked-in fixtures
 * stale).
 */
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { getWorkspace } from '../src/data/workspaces/index';
import type { ChannelArchetype, ChannelProfile, GenerationOptions, WorkspaceId } from '../src/types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'tests', 'e2e', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });

/** data/workspaces/index.ts의 실제 archetypeIds[0] — 각 워크스페이스의 진짜 대표 archetype. */
const REPRESENTATIVE_ARCHETYPE_BY_WORKSPACE: Record<WorkspaceId, ChannelArchetype> = {
  'senior-oldpop': 'senior-morning',
  'kr-2030': 'kr-2030-pop',
  'jp-2030': 'jp-2030-pop',
  'kr-kids': 'kr-kids-song',
  'jp-kids': 'jp-kids-song',
  'kr-idol-male': 'kr-idol-male',
  'kr-idol-female': 'kr-idol-female'
};

function buildFixtureSet(workspaceId: WorkspaceId, channel: ChannelProfile, suffix: string) {
  // 지시문 11 (TASK G) — 첫 버전은 모든 워크스페이스에 'english'를 강제해
  // jp-2030/kr-2030 등 실제 언어 정책과 어긋나는 가짜 fixture를 만들었다
  // (실제 E2E 실행에서 "언어 불일치 의심" 경고 18/18로 실측 발견). 각
  // 워크스페이스의 진짜 언어 정책(data/workspaces/index.ts의
  // defaultLyricLanguage)을 그대로 쓴다.
  const lyricLanguage = getWorkspace(workspaceId).defaultLyricLanguage;
  const opts: GenerationOptions = {
    channel, projectTitle: 'E2E Fixture', songCount: 18, lyricLanguage,
    market: channel.market, audience: channel.audience, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods,
    seasonId: 'christmas', vocalTone: channel.defaultVocal, perspective: 'firstPerson', lyricDepth: 'commercial',
    durationTarget: 'under3m30', moneyChordMode: 'default', customMoneyChord: '', customConcept: '', avoidWords: '', personaMode: false
  };
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks.find(s => s.id === 'christmas')!;

  const blueprint = generateLocalBlueprint(opts, genres, moods, season);

  // (a) valid — full 18-song import.
  fs.writeFileSync(path.join(outDir, `valid-songs-output${suffix}.json`), JSON.stringify({ songs: blueprint.songs }, null, 2));

  // (b) repairable — drop 3 tracks (missing-track warning, still importable/confirmable).
  const repairableSongs = blueprint.songs.filter(s => ![4, 9, 15].includes(s.trackNo));
  fs.writeFileSync(path.join(outDir, `repairable-songs-output${suffix}.json`), JSON.stringify({ songs: repairableSongs }, null, 2));

  // (c) blocked — structurally malformed: every trackNo collapsed to 1 (real
  // duplicate-trackNo hard-block, core/importValidation.ts's
  // validateProviderTrackSet -> describeTrackSetValidation, consumed by
  // core/importInspection.ts's own 'structure' check).
  const blockedSongs = blueprint.songs.map(s => ({ ...s, trackNo: 1 }));
  fs.writeFileSync(path.join(outDir, `blocked-songs-output${suffix}.json`), JSON.stringify({ songs: blockedSongs }, null, 2));

  console.log(`[${workspaceId}] wrote valid/repairable/blocked-songs-output${suffix}.json (channel: ${channel.id})`);
}

// senior-oldpop keeps its original, un-suffixed filenames — existing specs
// (import.spec.ts/resultsFlow.spec.ts) reference those paths directly and
// this task deliberately doesn't rename them (no reason to touch a working
// reference for the one workspace that already had real E2E coverage).
buildFixtureSet('senior-oldpop', channelPresets[0], '');

for (const [workspaceId, archetype] of Object.entries(REPRESENTATIVE_ARCHETYPE_BY_WORKSPACE) as [WorkspaceId, ChannelArchetype][]) {
  if (workspaceId === 'senior-oldpop') continue;
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) {
    console.error(`[genE2eFixtures] ${workspaceId}: archetype "${archetype}"에 맞는 channelPresets 항목을 찾지 못했습니다.`);
    continue;
  }
  buildFixtureSet(workspaceId, channel, `-${workspaceId}`);
}

console.log(`\n모든 픽스처를 ${outDir}에 썼습니다.`);
