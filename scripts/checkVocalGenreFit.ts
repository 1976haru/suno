/**
 * 지시문 63 (TASK C) — "장르-보컬 부합률"을 아키타입별로 실측한다: 이
 * 표본 세트(각 워크스페이스의 대표 채널, 15곡)의 실제 lead 장르가 원하는
 * 성별(core/vocalQuotaFromGenre.ts의 dominantVocalTypeForGenre)과 실제
 * 배정된 vocalType이 맞는 비율을 곡 단위로 잰다 — TASK A(genre-derived
 * 쿼터)가 총량뿐 아니라 트랙별 매칭까지 실제로 개선했는지 확인하는 것이
 * 이 스크립트의 목적이다. core/fullAudit.ts의 vocal_genre_fit/
 * vocal_preset_variety 두 항목과 완전히 같은 판정 함수를 재사용한다 —
 * 감사 화면과 이 CLI가 서로 다른 숫자를 낼 수 없다.
 *
 * 12/15 미만이면 경고만 낸다(차단하지 않는다) — checkVocalFloor.ts/
 * checkGenreFidelity.ts와 같은 advisory 원칙(§공통규약 7 "실측 없이
 * blocking을 만들지 않는다").
 *
 * Usage: npx tsx scripts/checkVocalGenreFit.ts [--json]
 */
import { channelPresets, moodPacks, seasonPacks } from '../src/data/presets';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { dominantVocalTypeForGenre } from '../src/core/vocalQuotaFromGenre';
import type { ChannelProfile, GenerationOptions, SongIdea, WorkspaceId } from '../src/types';

const ALL_WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

// checkVocalFloor.ts와 같은 "워크스페이스당 대표 채널" 패턴.
const REPRESENTATIVE_CHANNEL_BY_WORKSPACE: Record<WorkspaceId, string> = {
  'senior-oldpop': 'good-morning-memory-radio',
  'kr-2030': 'after-work-band-pop',
  'jp-2030': 'reiwa-way-home-jpop',
  'kr-kids': 'follow-along-action-song',
  'jp-kids': 'teasobi-hiroba',
  'kr-idol-male': 'stage-night',
  'kr-idol-female': 'daylight-city-kpop'
};

const SAMPLE_SONG_COUNT = 15;
// 지시문 63 (TASK C-1) — "12/15 미만이면 경고" 그대로.
const WARN_THRESHOLD_RATIO = 12 / 15;
const PRESET_VARIETY_TARGET = 5;

function buildOptions(channel: ChannelProfile): GenerationOptions {
  const presetMoods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  return {
    channel,
    projectTitle: 'check:vocal-genre-fit',
    songCount: SAMPLE_SONG_COUNT,
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

interface WorkspaceResult {
  workspaceId: WorkspaceId;
  archetype: string;
  fitMatches: number;
  fitTracked: number;
  totalSongs: number;
  presetVariety: number;
  mismatches: { trackNo: number; genreId: string | undefined; wanted: string; assigned: string | undefined }[];
}

function measureWorkspace(workspaceId: WorkspaceId): WorkspaceResult | undefined {
  const channelId = REPRESENTATIVE_CHANNEL_BY_WORKSPACE[workspaceId];
  const channel = channelPresets.find(c => c.id === channelId);
  if (!channel) return undefined;

  const opts = buildOptions(channel);
  const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks.find(s => s.id === opts.seasonId) ?? seasonPacks[0];
  const blueprint = generateLocalBlueprint(opts, genres, moods, season);
  const songs: SongIdea[] = blueprint.songs;

  const tracked = songs.filter(song => song.genreId && song.vocalType);
  const mismatches: WorkspaceResult['mismatches'] = [];
  let fitMatches = 0;
  for (const song of tracked) {
    const dominant = dominantVocalTypeForGenre(getGenreById(song.genreId!)?.vocalPreference);
    if (dominant === null || dominant === song.vocalType) {
      fitMatches += 1;
    } else {
      mismatches.push({ trackNo: song.trackNo, genreId: song.genreId, wanted: dominant, assigned: song.vocalType });
    }
  }

  const presetVariety = new Set(songs.map(song => song.effectiveVocalPresetId).filter(Boolean)).size;

  return { workspaceId, archetype: channel.archetype, fitMatches, fitTracked: tracked.length, totalSongs: songs.length, presetVariety, mismatches };
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const results = ALL_WORKSPACE_IDS.map(measureWorkspace).filter((r): r is WorkspaceResult => Boolean(r));

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('[check:vocal-genre-fit] 지시문 63 TASK C\n');
  console.log(`표본: 워크스페이스당 대표 채널 1개 · ${SAMPLE_SONG_COUNT}곡\n`);

  let warnedAny = false;
  for (const result of results) {
    const ratio = result.fitTracked ? result.fitMatches / result.totalSongs : 0;
    const warn = result.fitTracked > 0 && ratio < WARN_THRESHOLD_RATIO;
    const presetWarn = result.presetVariety < PRESET_VARIETY_TARGET;
    if (warn || presetWarn) warnedAny = true;
    console.log(`${result.workspaceId} (${result.archetype})`);
    console.log(`  장르-보컬 부합률: ${result.fitMatches}/${result.totalSongs}${warn ? `  ⚠ 12/15 미만` : ''}`);
    console.log(`  보컬 프리셋 종류: ${result.presetVariety}종${presetWarn ? `  ⚠ 5종 미만` : ''}`);
    if (result.mismatches.length) {
      for (const m of result.mismatches) {
        console.log(`    트랙 ${m.trackNo}: 장르 ${m.genreId ?? '(없음)'}가 원하는 성별 ${m.wanted} ≠ 실제 배정 ${m.assigned ?? '(없음)'}`);
      }
    }
    console.log('');
  }

  const totalFit = results.reduce((sum, r) => sum + r.fitMatches, 0);
  const totalSongs = results.reduce((sum, r) => sum + r.totalSongs, 0);
  console.log(`전체 부합률: ${totalFit}/${totalSongs} (${totalSongs ? Math.round((totalFit / totalSongs) * 100) : 0}%)`);
  console.log(`\n[check:vocal-genre-fit] advisory — 12/15 미만은 경고만 남기고 통과 처리(exit 0).${warnedAny ? ' 위 ⚠ 항목을 확인하십시오.' : ' 경고 없음.'}`);
}

main();
