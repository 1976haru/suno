/**
 * 지시문 62 (TASK F-2) — "channelVocalFloor가 7 워크스페이스에 정의됐는가,
 * forbiddenTraits가 프롬프트에 나타나는가"를 실제로 검사한다.
 * check:genre-completeness/check:settings 등 기존 check: 스크립트와 같은
 * advisory 원칙(exit 0, 목록만 낸다) — TASK C가 신설한 지 얼마 안 된
 * 데이터라 아직 어느 필드가 "필수"인지 실측된 정책이 없다(§공통규약 7).
 *
 * 두 축을 검사한다:
 *   ① CHANNEL_VOCAL_FLOORS가 WorkspaceId 7종 전부를 커버하는가
 *   ② 각 워크스페이스의 대표 채널로 실제 로컬 생성을 돌려, floor가 있는
 *      워크스페이스에서 requiredTraits가 최소 1곡의 stylePrompt에,
 *      forbiddenTraits가 최소 1곡의 excludePrompt에 실제로 나타나는가
 *      (core/localGenerator.ts/core/negativePromptSpec.ts 배선의 왕복 확인 —
 *      지시문 26이 킬링포인트에서 겪은 "왕복 미확인" 재발 방지와 같은 이유)
 *
 * Usage: npx tsx scripts/checkVocalFloor.ts
 */
import { channelPresets, moodPacks, seasonPacks } from '../src/data/presets';
import { CHANNEL_VOCAL_FLOORS, channelVocalFloorForArchetype } from '../src/data/channelVocalFloor';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildNegativePromptSpec, compileNegativePromptSpec } from '../src/core/negativePromptSpec';
import { getGenreById } from '../src/data/genreLibrary';
import type { ChannelProfile, GenerationOptions, WorkspaceId } from '../src/types';

const ALL_WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

// 각 워크스페이스를 대표하는 실제 채널 프리셋 하나 — checkGateContract.ts의
// "워크스페이스당 대표"와 같은 패턴.
const REPRESENTATIVE_CHANNEL_BY_WORKSPACE: Record<WorkspaceId, string> = {
  'senior-oldpop': 'good-morning-memory-radio',
  'kr-2030': 'after-work-band-pop',
  'jp-2030': 'reiwa-way-home-jpop',
  'kr-kids': 'follow-along-action-song',
  'jp-kids': 'teasobi-hiroba',
  'kr-idol-male': 'stage-night',
  'kr-idol-female': 'daylight-city-kpop'
};

function buildOptions(channel: ChannelProfile): GenerationOptions {
  const presetMoods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  return {
    channel,
    projectTitle: 'check:vocal-floor',
    songCount: 6,
    lyricLanguage: channel.primaryLanguage ?? 'english',
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: presetMoods.length ? channel.preferredMoods : moodPacks.map(m => m.id).slice(0, 1),
    seasonId: seasonPacks.some(s => s.id === 'christmas') ? 'christmas' : seasonPacks[0].id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    personaMode: false
  };
}

function main() {
  console.log('[check:vocal-floor] 지시문 62 TASK F-2\n');

  // ① 7 워크스페이스 커버리지
  const coveredWorkspaceIds = new Set(CHANNEL_VOCAL_FLOORS.map(f => f.workspaceId));
  const missingWorkspaces = ALL_WORKSPACE_IDS.filter(id => !coveredWorkspaceIds.has(id));
  console.log(`① 워크스페이스 커버리지: ${coveredWorkspaceIds.size}/${ALL_WORKSPACE_IDS.length}`);
  if (missingWorkspaces.length) {
    console.log(`  누락: ${missingWorkspaces.join(', ')}`);
  } else {
    console.log('  전 워크스페이스 정의됨.');
  }

  // ② 왕복 확인 — 실제 생성 결과에 requiredTraits/forbiddenTraits가 실리는가
  console.log('\n② 왕복 확인 (requiredTraits → stylePrompt, forbiddenTraits → excludePrompt)');
  let roundTripPass = 0;
  let roundTripTotal = 0;
  for (const workspaceId of ALL_WORKSPACE_IDS) {
    const channelId = REPRESENTATIVE_CHANNEL_BY_WORKSPACE[workspaceId];
    const channel = channelPresets.find(c => c.id === channelId);
    if (!channel) {
      console.log(`  ${workspaceId}: 채널 프리셋 "${channelId}" 없음 — 건너뜀`);
      continue;
    }
    const floor = channelVocalFloorForArchetype(channel.archetype);
    if (!floor) {
      console.log(`  ${workspaceId} (${channel.archetype}): floor 없음 — archetypeIds 범위 밖(의도적, channelSoundFloor.ts와 같은 전례)`);
      continue;
    }
    roundTripTotal++;
    const opts = buildOptions(channel);
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === opts.seasonId) ?? seasonPacks[0];
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    const requiredHit = blueprint.songs.some(song => floor.requiredTraits.some(trait => song.stylePrompt?.includes(trait)));
    const negSpec = buildNegativePromptSpec(opts, genres);
    const excludeText = compileNegativePromptSpec(negSpec);
    const forbiddenHit = floor.forbiddenTraits.some(trait => excludeText.includes(trait));
    const ok = requiredHit && forbiddenHit;
    if (ok) roundTripPass++;
    console.log(`  ${workspaceId} (${channel.archetype}): requiredTraits→stylePrompt ${requiredHit ? 'O' : 'X'} · forbiddenTraits→excludePrompt ${forbiddenHit ? 'O' : 'X'}`);
  }
  console.log(`\n왕복 확인 통과: ${roundTripPass}/${roundTripTotal}`);

  console.log('\n[check:vocal-floor] advisory — 통과 처리(exit 0).');
}

main();
