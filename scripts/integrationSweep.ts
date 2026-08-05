/**
 * TASK G2 §3 — 전 워크스페이스 파이프라인 통합 회귀. §0-2 "고치는 문서가 아닙니다":
 * 이 스크립트는 실패를 찾아 보고만 합니다 — 발견된 문제를 이 파일이 직접 고치지 않습니다.
 *
 * G1(scripts/isolationAudit.ts)은 "경계"(워크스페이스 A의 데이터가 B로 새는가)를
 * 봅니다. 이 스크립트는 "전체"(다섯 워크스페이스가 함께 있는 상태에서 생성
 * 파이프라인이 예외 없이 동작하고, 산출물이 워크스페이스별 기준을 충족하는가)를
 * 봅니다. §3-1 지시대로 워크스페이스 정의(data/workspaces)를 읽어서 순회하며,
 * 프리셋 목록을 하드코딩하지 않습니다.
 *
 * Usage: npx tsx scripts/integrationSweep.ts  (또는 npm run sweep)
 */
import { workspaceDefinitions } from '../src/data/workspaces';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { getGenreById } from '../src/data/genreLibrary';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { auditAlbum } from '../src/core/albumAudit';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { isKidsArchetype } from '../src/utils/channelArchetype';
import type { ChannelPreset, GenerationOptions, SongIdea } from '../src/types';

const SONG_COUNT = 18;

// §3-3 판정 기준표 — 성인/동요 워크스페이스에 같은 기준을 적용하지 말 것.
const ADULT_WORKSPACE_IDS = new Set(['senior-oldpop', 'kr-2030', 'jp-2030']);
const THRESHOLDS = {
  adult: { promptMin: 350, promptMax: 650, avgSimilarityMax: 0.28, bpmStddevMin: 8 },
  kids: { promptMin: 350, promptMax: 650, avgSimilarityMax: 0.35, bpmStddevMin: 8 }
};

function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function duplicates<T>(values: T[]): T[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function sectionCount(lyrics: string): number {
  return (lyrics.match(/^\s*\[[^\]]+\]\s*$/gm) || []).length;
}

function buildOptions(channel: ChannelPreset): GenerationOptions {
  const presetMoods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  return {
    channel,
    projectTitle: 'G2 Integration Sweep',
    songCount: SONG_COUNT,
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

interface SweepResult {
  workspaceId: string;
  presetId: string;
  archetype: string;
  category: 'adult' | 'kids';
  ok: boolean;
  error?: string;
  errors: string[];
  warnings: string[];
  promptLen: { min: number; avg: number; max: number };
  avgSimilarity: number;
  maxSimilarity: number;
  bpmRange: [number, number];
  bpmStddev: number;
  uniqueTitles: number;
  songCount: number;
  sectionCounts: { min: number; max: number };
  killingPointIds: string[];
  seniorKpOnKidsCount: number;
  placeholderLeaks: string[];
}

function runOne(workspaceId: string, preset: ChannelPreset): SweepResult {
  const category: 'adult' | 'kids' = isKidsArchetype(preset.archetype) ? 'kids' : 'adult';
  const base: Omit<SweepResult, 'ok' | 'error'> = {
    workspaceId,
    presetId: preset.id,
    archetype: preset.archetype,
    category,
    errors: [],
    warnings: [],
    promptLen: { min: 0, avg: 0, max: 0 },
    avgSimilarity: 0,
    maxSimilarity: 0,
    bpmRange: [0, 0],
    bpmStddev: 0,
    uniqueTitles: 0,
    songCount: 0,
    sectionCounts: { min: 0, max: 0 },
    killingPointIds: [],
    seniorKpOnKidsCount: 0,
    placeholderLeaks: []
  };

  let songs: SongIdea[];
  try {
    const genres = preset.preferredGenres.map(id => getGenreById(id) ?? genrePacks.find(g => g.id === id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const moods = moodPacks.filter(m => preset.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === 'christmas') ?? seasonPacks[0];
    const opts = buildOptions(preset);
    const blueprint = generateLocalBlueprint(opts, genres, moods.length ? moods : moodPacks, season, { usedTitles: [], usedHooks: [] });
    songs = blueprint.songs;
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const report = auditAlbum(songs, { audience: preset.audience });
  const simReport = lintInPackStyleSimilarity(songs.map(s => ({ trackNo: s.trackNo, stylePrompt: s.stylePrompt })));
  const promptLens = songs.map(s => s.stylePrompt.length);
  const bpms = songs.map(s => s.bpm).filter((v): v is number => typeof v === 'number');
  const titles = songs.map(s => s.title);
  const kpIds = songs.map(s => s.killingPointId).filter((v): v is string => Boolean(v));
  const seniorKpOnKids = category === 'kids' ? kpIds.filter(id => id.startsWith('KP-')).length : 0;

  const placeholderLeaks: string[] = [];
  for (const song of songs) {
    if (!song.title.trim()) placeholderLeaks.push(`트랙 ${song.trackNo}: title 빈 문자열`);
    if (!song.hookPhrase?.trim()) placeholderLeaks.push(`트랙 ${song.trackNo}: hookPhrase 빈 문자열`);
    if (!song.lyrics?.trim()) placeholderLeaks.push(`트랙 ${song.trackNo}: lyrics 빈 문자열`);
    if (/^title:/i.test(song.title.trim())) placeholderLeaks.push(`트랙 ${song.trackNo}: title에 "Title:" 접두사 잔존`);
    if (/\{\{|TODO|PLACEHOLDER|undefined|\[object Object\]/i.test(song.title + song.hookPhrase + song.lyrics + song.stylePrompt)) {
      placeholderLeaks.push(`트랙 ${song.trackNo}: 자리표시자/undefined 잔존 의심 문자열`);
    }
  }

  return {
    ...base,
    ok: true,
    errors: report.errors,
    warnings: report.warnings,
    promptLen: {
      min: Math.min(...promptLens),
      avg: Math.round(promptLens.reduce((a, b) => a + b, 0) / promptLens.length),
      max: Math.max(...promptLens)
    },
    avgSimilarity: simReport.averageSimilarity,
    maxSimilarity: simReport.maxSimilarity,
    bpmRange: bpms.length ? [Math.min(...bpms), Math.max(...bpms)] : [0, 0],
    bpmStddev: stddev(bpms),
    uniqueTitles: new Set(titles).size,
    songCount: songs.length,
    sectionCounts: (() => {
      const counts = songs.map(s => sectionCount(s.lyrics));
      return { min: Math.min(...counts), max: Math.max(...counts) };
    })(),
    killingPointIds: [...new Set(kpIds)],
    seniorKpOnKidsCount: seniorKpOnKids,
    placeholderLeaks
  };
}

function main() {
  const results: SweepResult[] = [];

  for (const workspace of workspaceDefinitions) {
    const presets = channelPresets.filter(p => workspace.archetypeIds.includes(p.archetype));
    console.log(`\n=== ${workspace.id} (${presets.length}개 프리셋) ===`);
    for (const preset of presets) {
      const result = runOne(workspace.id, preset);
      results.push(result);
      if (!result.ok) {
        console.log(`  [FAIL-EXCEPTION] ${preset.id} (${preset.archetype}) — ${result.error}`);
        continue;
      }
      const threshold = THRESHOLDS[result.category];
      const issues: string[] = [];
      if (result.errors.length) issues.push(`auditAlbum errors ${result.errors.length}`);
      if (result.promptLen.min < threshold.promptMin || result.promptLen.max > threshold.promptMax) issues.push(`prompt length out of [${threshold.promptMin},${threshold.promptMax}]: [${result.promptLen.min},${result.promptLen.max}]`);
      if (result.avgSimilarity > threshold.avgSimilarityMax) issues.push(`avgSimilarity ${result.avgSimilarity.toFixed(3)} > ${threshold.avgSimilarityMax}`);
      if (result.uniqueTitles !== result.songCount) issues.push(`unique titles ${result.uniqueTitles}/${result.songCount}`);
      if (result.seniorKpOnKidsCount > 0) issues.push(`동요에 시니어 전용 KP ${result.seniorKpOnKidsCount}건`);
      if (result.placeholderLeaks.length) issues.push(`placeholder leaks ${result.placeholderLeaks.length}`);

      const status = issues.length ? 'ISSUES' : 'OK';
      console.log(`  [${status}] ${preset.id} (${preset.archetype}, ${result.category}) — prompt ${result.promptLen.min}-${result.promptLen.avg}-${result.promptLen.max}자, sim avg/max ${result.avgSimilarity.toFixed(3)}/${result.maxSimilarity.toFixed(3)}, BPM ${result.bpmRange[0]}-${result.bpmRange[1]}(sd ${result.bpmStddev.toFixed(2)}), 고유제목 ${result.uniqueTitles}/${result.songCount}, 섹션 ${result.sectionCounts.min}-${result.sectionCounts.max}, KP종류 ${result.killingPointIds.length}, errors ${result.errors.length}, warnings ${result.warnings.length}`);
      if (issues.length) console.log(`    ISSUES: ${issues.join(' | ')}`);
      if (result.placeholderLeaks.length) console.log(`    ${result.placeholderLeaks.join(' / ')}`);
    }
  }

  console.log('\n\n=== 요약 ===');
  const totalSongs = results.reduce((sum, r) => sum + (r.songCount || 0), 0);
  const failedSets = results.filter(r => !r.ok);
  const adultResults = results.filter(r => r.ok && r.category === 'adult');
  const kidsResults = results.filter(r => r.ok && r.category === 'kids');
  console.log(`프리셋 ${results.length}개, 곡 ${totalSongs}개 생성`);
  console.log(`생성 실패(예외) 세트: ${failedSets.length}${failedSets.length ? ' — ' + failedSets.map(r => r.presetId).join(', ') : ''}`);
  console.log(`auditAlbum errors 합계: ${results.reduce((s, r) => s + r.errors.length, 0)}`);
  console.log(`auditAlbum warnings 합계: ${results.reduce((s, r) => s + r.warnings.length, 0)}`);
  console.log(`고유 제목 미달 세트: ${results.filter(r => r.ok && r.uniqueTitles !== r.songCount).length}`);
  console.log(`동요에 시니어 전용 KP 배정된 세트: ${kidsResults.filter(r => r.seniorKpOnKidsCount > 0).length}`);
  console.log(`placeholder/빈 문자열 잔존 세트: ${results.filter(r => r.placeholderLeaks.length > 0).length}`);
  if (adultResults.length) {
    const avg = adultResults.reduce((s, r) => s + r.avgSimilarity, 0) / adultResults.length;
    console.log(`성인 3종 쌍별 유사도 평균(세트 평균의 평균): ${avg.toFixed(3)} (기준 ≤0.28)`);
  }
  if (kidsResults.length) {
    const avg = kidsResults.reduce((s, r) => s + r.avgSimilarity, 0) / kidsResults.length;
    console.log(`동요 2종 쌍별 유사도 평균(세트 평균의 평균): ${avg.toFixed(3)} (기준 ≤0.35)`);
  }
  const allBpmStddevs = results.filter(r => r.ok).map(r => r.bpmStddev);
  console.log(`BPM 표준편차 평균: ${(allBpmStddevs.reduce((a, b) => a + b, 0) / allBpmStddevs.length).toFixed(2)} (기준 ≥8, 세트별)`);
}

main();
