/**
 * v3.76 (TASK B) — "정합성 전수 검사". Generates a pack locally (offline,
 * deterministic — no network call, no Suno render) and runs every check
 * this app's task history has asked for in one pass (core/fullAudit.ts),
 * plus the concept "promise fulfillment" measurement (core/promiseAudit.ts,
 * TASK A). Compares against audit-baseline.json and flags any item that
 * used to pass and now doesn't as a REGRESSION — the whole point (see this
 * task's own §0-2 "무한루프로 사소한 버그가 계속되는" complaint).
 *
 * Usage:
 *   npx tsx scripts/audit.ts
 *   npx tsx scripts/audit.ts --concept "80년대 초반 어덜트 컨템포러리 발라드" --count 18
 *   npx tsx scripts/audit.ts --save-baseline        (explicit only — never automatic)
 *   npx tsx scripts/audit.ts --report ./audit-report.md
 *   npx tsx scripts/audit.ts --audio ./audio-metrics.json   (see this file's
 *     own note below on what this flag actually accepts)
 *
 * "npm run audit" runs this with no flags (the Beatles-60s concept this
 * task's own §1 measured against).
 */
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import { buildAudioSetReport } from '../src/core/audioSetReport';
import { runFullAudit, type AuditItem, type FullAuditReport } from '../src/core/fullAudit';
import type { AudienceProfile, GenerationOptions } from '../src/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASELINE_PATH = path.resolve(process.cwd(), 'audit-baseline.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
  };
  return {
    concept: get('--concept', '비틀즈 느낌의 밝은 60년대 팝'),
    count: Math.max(1, parseInt(get('--count', '18'), 10) || 18),
    channelId: get('--channel', channelPresets.find(c => c.archetype === 'senior-morning')!.id),
    audioMetricsPath: get('--audio', ''),
    reportPath: get('--report', ''),
    saveBaseline: args.includes('--save-baseline')
  };
}

function generatePack(concept: string, songCount: number, channelId: string) {
  const channel = channelPresets.find(c => c.id === channelId) ?? channelPresets[0];
  const plan = directSetLocal(concept, channel, songCount, { recentGenreIds: [], recentHooks: [] });
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : channel.preferredGenres;
  const genres = genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const opts: GenerationOptions = {
    channel,
    projectTitle: concept,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds,
    moodIds: channel.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: concept,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: plan.allocations
  };
  const season = { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring'], visualDirection: '' };
  return generateLocalBlueprint(opts, genres, [], season);
}

// ---------------------------------------------------------------------------
// Audio metrics — v3.73/v3.74's real waveform analysis (core/audioAnalysis.ts)
// runs against the Web Audio API, which only exists in a browser (the app's
// own AudioAnalysisPanel.tsx is where a real mp3 actually gets measured).
// This CLI script can't decode audio itself without adding a new heavy
// dependency this task never asked for, so `--audio <path>` accepts a JSON
// file of already-computed SongAudioMetrics[] (exported from that panel),
// not a raw mp3/directory — documented here rather than silently pretending
// to support raw audio files.
// ---------------------------------------------------------------------------
function loadAudioReport(audioMetricsPath: string, songCount: number, audienceProfile: AudienceProfile, killingPointTrackNos: Set<number>) {
  if (!audioMetricsPath) return undefined;
  if (!fs.existsSync(audioMetricsPath)) {
    console.warn(`[audit] --audio 파일을 찾을 수 없습니다: ${audioMetricsPath} — 음원 항목은 "미측정"으로 처리합니다.`);
    return undefined;
  }
  try {
    const metrics = JSON.parse(fs.readFileSync(audioMetricsPath, 'utf-8'));
    return buildAudioSetReport(metrics, songCount, audienceProfile, killingPointTrackNos);
  } catch (err) {
    console.warn(`[audit] --audio 파일을 읽는 중 오류가 발생했습니다: ${String(err)} — 음원 항목은 "미측정"으로 처리합니다.`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------
interface Baseline {
  savedAt: string;
  conceptLabel: string;
  items: Record<string, boolean>;
}

function loadBaseline(): Baseline | undefined {
  if (!fs.existsSync(BASELINE_PATH)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
  } catch {
    return undefined;
  }
}

function saveBaseline(report: FullAuditReport): void {
  const items: Record<string, boolean> = {};
  for (const it of report.items) {
    if (it.status === 'not-measured') continue;
    items[it.id] = it.status === 'pass';
  }
  const baseline: Baseline = { savedAt: new Date().toISOString(), conceptLabel: report.conceptLabel, items };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  console.log(`[audit] 기준선을 저장했습니다: ${BASELINE_PATH}`);
}

type Classification = 'pass' | 'regression' | 'below-target' | 'not-measured' | 'new';

function classify(item: AuditItem, baseline: Baseline | undefined): Classification {
  if (item.status === 'not-measured') return 'not-measured';
  const prior = baseline?.items[item.id];
  if (prior === undefined) return item.status === 'pass' ? 'pass' : 'new';
  if (prior === true && item.status === 'fail') return 'regression';
  if (prior === false && item.status === 'fail') return 'below-target';
  return 'pass';
}

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------
function printConsoleReport(report: FullAuditReport, baseline: Baseline | undefined): { regressionCount: number } {
  const classified = report.items.map(it => ({ item: it, classification: classify(it, baseline) }));
  const regressions = classified.filter(c => c.classification === 'regression');
  const belowTarget = classified.filter(c => c.classification === 'below-target' || c.classification === 'new');
  const passed = classified.filter(c => c.classification === 'pass');
  const notMeasured = classified.filter(c => c.classification === 'not-measured');

  console.log('');
  console.log(`세트: ${report.conceptLabel} (${report.songCount}곡)`);
  console.log(baseline ? `기준선: ${baseline.savedAt}` : '기준선 없음 (최초 실행 — --save-baseline으로 저장하십시오)');
  console.log('');

  if (regressions.length) {
    console.log(`🔻 회귀 ${regressions.length}건 ─────────────────────────────`);
    for (const { item } of regressions) {
      console.log(`  [${item.category}] ${item.labelKo}  ${item.targetKo} 기준 | 지금 ${item.actualKo}  ← 회귀`);
    }
    console.log('');
  }

  if (belowTarget.length) {
    console.log(`⚠ 미달 ${belowTarget.length}건 (이전에도 실패했거나 신규 항목) ────────────────`);
    for (const { item } of belowTarget) {
      console.log(`  [${item.category}] ${item.labelKo}  ${item.targetKo} 기준 | 지금 ${item.actualKo}`);
    }
    console.log('');
  }

  console.log(`✅ 통과 ${passed.length}건`);
  if (notMeasured.length) console.log(`⬜ 미측정 ${notMeasured.length}건 (${notMeasured.filter(c => c.item.requiresAudio).length}건 음원 필요, ${notMeasured.filter(c => c.item.notImplemented).length}건 미구현)`);
  console.log('');
  console.log(`종합: ${report.items.length}개 항목 중 ${passed.length} 통과 / ${regressions.length} 회귀 / ${belowTarget.length} 미달 / ${notMeasured.length} 미측정`);
  console.log('');

  return { regressionCount: regressions.length };
}

// ---------------------------------------------------------------------------
// Markdown report (TASK D)
// ---------------------------------------------------------------------------
function buildMarkdownReport(report: FullAuditReport, baseline: Baseline | undefined): string {
  const classified = report.items.map(it => ({ item: it, classification: classify(it, baseline) }));
  const lines: string[] = [];
  lines.push(`# 정합성 전수 검사 리포트`);
  lines.push('');
  lines.push(`- 컨셉: ${report.conceptLabel}`);
  lines.push(`- 곡 수: ${report.songCount}`);
  lines.push(`- 생성 시각: ${new Date().toISOString()}`);
  lines.push(`- 기준선: ${baseline ? baseline.savedAt : '없음'}`);
  lines.push('');

  lines.push('## 1. 약속 이행도 상세');
  lines.push('');
  lines.push(`종합 이행도: **${Math.round(report.promiseAudit.overallFulfillment * 100)}%** (가장 약한 약속: ${report.promiseAudit.weakestPromise || '-'})`);
  lines.push('');
  lines.push('| 약속 | 종류 | 이행률 | 실패 곡 | 설명 |');
  lines.push('|---|---|---:|---|---|');
  for (const result of report.promiseAudit.promises) {
    lines.push(`| ${result.promise.labelKo} | ${result.promise.kind} | ${Math.round(result.fulfillment * 100)}% | ${result.failedTracks.join(', ') || '-'} | ${result.explanationKo} |`);
  }
  for (const warning of report.promiseAudit.warnings) lines.push(`> ${warning}`);
  lines.push('');
  lines.push(`제목 정합성: 훅 연결 제목 ${report.titleConsistency.hookConnectedCount}곡, 시대 패턴 일치 ${Math.round(report.titleConsistency.eraPatternMatchShare * 100)}%, 컨셉 무관 제목 ${report.titleConsistency.offConceptTitleCount}곡 (트랙 ${report.titleConsistency.failedTracks.join(', ') || '-'})`);
  lines.push('');

  lines.push('## 2. 전수 결과');
  lines.push('');
  lines.push('| 분류 | 항목 | 기준 | 실측 | 상태 | 지시문 이력 |');
  lines.push('|---|---|---|---|---|---|');
  const statusLabel: Record<Classification, string> = { pass: '✅', regression: '🔻 회귀', 'below-target': '⚠ 미달', 'not-measured': '⬜ 미측정', new: '⚠ 신규' };
  for (const { item, classification } of classified) {
    lines.push(`| ${item.category} | ${item.labelKo} | ${item.targetKo} | ${item.actualKo} | ${statusLabel[classification]} | ${item.specifiedBy.join(', ') || '-'} |`);
  }
  lines.push('');

  const regressions = classified.filter(c => c.classification === 'regression');
  lines.push('## 3. 회귀 이력 (baseline 대비)');
  lines.push('');
  if (regressions.length) {
    for (const { item } of regressions) lines.push(`- **${item.labelKo}**: 기준선에서는 통과였으나 지금 실패 (${item.targetKo} 기준, 실측 ${item.actualKo})`);
  } else {
    lines.push('회귀 없음.');
  }
  lines.push('');

  lines.push('## 4. 실패 항목의 실제 샘플');
  lines.push('');
  const eraPromise = report.promiseAudit.promises.find(p => p.promise.kind === 'era');
  if (eraPromise?.failedTracks.length) lines.push(`- 시대 미지정/불일치 장르 트랙: ${eraPromise.failedTracks.join(', ')}`);
  if (report.titleConsistency.failedTracks.length) lines.push(`- 컨셉 무관 제목 트랙: ${report.titleConsistency.failedTracks.join(', ')}`);
  const vocabItem = report.items.find(it => it.id === 'vocab_repeat_advisory');
  if (vocabItem) lines.push(`- 반복 어휘 상위: ${vocabItem.actualKo}`);
  lines.push('');

  lines.push('## 5. 관련 지시문 번호');
  lines.push('');
  lines.push('같은 항목이 여러 지시문에서 반복 지시된 경우, 지시문끼리 모순되거나 근본 원인을 못 잡았을 가능성이 있습니다.');
  lines.push('');
  const specifiedByMultiple = report.items.filter(it => it.specifiedBy.length > 1);
  if (specifiedByMultiple.length) {
    for (const it of specifiedByMultiple) lines.push(`- **${it.labelKo}**: ${it.specifiedBy.join(' → ')}`);
  } else {
    lines.push('2회 이상 재지시된 항목 없음.');
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs();
  const startedAt = Date.now();

  const blueprint = generatePack(args.concept, args.count, args.channelId);
  const killingPointTrackNos = new Set(blueprint.songs.filter(song => song.killingPointId).map(song => song.trackNo));
  const audioReport = loadAudioReport(args.audioMetricsPath, args.count, SENIOR_AUDIENCE_PROFILE, killingPointTrackNos);

  const report = runFullAudit(blueprint.songs, {
    conceptLabel: args.concept,
    songCount: args.count,
    audienceProfile: SENIOR_AUDIENCE_PROFILE,
    audioReport
  });

  const baseline = loadBaseline();
  const { regressionCount } = printConsoleReport(report, baseline);

  console.log(`실행 시간: ${((Date.now() - startedAt) / 1000).toFixed(1)}초`);

  if (args.reportPath) {
    fs.writeFileSync(args.reportPath, buildMarkdownReport(report, baseline), 'utf-8');
    console.log(`[audit] 마크다운 리포트를 저장했습니다: ${args.reportPath}`);
  }

  if (args.saveBaseline) {
    saveBaseline(report);
  }

  if (regressionCount > 0) {
    console.error(`[audit] 회귀 ${regressionCount}건 발견 — exit code 1`);
    process.exit(1);
  }
}

main();
