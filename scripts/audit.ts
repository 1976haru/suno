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
import { SENIOR_AUDIENCE_PROFILE, audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { buildAudioSetReport } from '../src/core/audioSetReport';
import { runFullAudit, type AuditItem, type FullAuditReport } from '../src/core/fullAudit';
import { scoreSongs } from '../src/core/quality';
import { importSongsJson, extractBridgeImportMeta, extractRawImportedSongs } from '../src/core/bridgeImport';
import { topWordFrequencies } from '../src/core/lyricVocabularyRepetition';
import { lyricWordAndSectionCounts } from '../src/core/compositionScorer';
import { openingSixWords } from '../src/core/lyricsAst';
import { sceneSimilarity } from '../src/core/sceneSimilarity';
import { checkSeniorEraShare, SLOT_PLAN_LEDGER_POLICY } from '../src/core/seniorOldpopPolicy';
import { computeSlotPlanOverlap, type SlotPlanOverlapResult } from '../src/core/slotPlanOverlap';
import type { AudienceProfile, ChannelProfile, GenerationOptions, LyricLanguage, PlaylistBlueprint, PreassignedSongSlot, SongIdea } from '../src/types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASELINE_PATH = path.resolve(process.cwd(), 'audit-baseline.json');
// 지시문 09 (TASK B-2) — 실제 발매 경로(--pack)와 로컬 템플릿 경로는 산출
// 방식이 근본적으로 다르므로(외부 LLM 자유 작문 vs 결정론적 템플릿 채움) 같은
// baseline으로 비교하지 않는다. 별도 파일, 별도 경로.
const PACK_BASELINE_PATH = path.resolve(process.cwd(), 'audit-baseline.pack.json');

const DEFAULT_CONCEPT = '비틀즈 느낌의 밝은 60년대 팝';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  // TASK B-1 — `--concept`가 실제로 CLI에 있었는지(explicitConcept)를
  // `concept`(항상 값이 있는, 로컬 템플릿 경로용 기본값)과 분리해 둔다 —
  // --pack 모드가 "명시적 --concept 없으면 meta.conceptLabel로" 폴백할 때
  // DEFAULT_CONCEPT를 진짜 사용자 선택으로 오인하지 않기 위해서다.
  const explicitConcept = get('--concept');
  return {
    concept: explicitConcept ?? DEFAULT_CONCEPT,
    explicitConcept,
    count: Math.max(1, parseInt(get('--count') ?? '18', 10) || 18),
    channelId: get('--channel') ?? channelPresets.find(c => c.archetype === 'senior-morning')!.id,
    audioMetricsPath: get('--audio') ?? '',
    reportPath: get('--report') ?? '',
    saveBaseline: args.includes('--save-baseline'),
    packPath: get('--pack') ?? '',
    compareLocal: args.includes('--compare-local'),
    crossPath: get('--cross') ?? ''
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
  const season = defaultSeason();
  return generateLocalBlueprint(opts, genres, [], season);
}

function defaultSeason() {
  return { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring'], visualDirection: '' };
}

/**
 * 지시문 10 (TASK F) — real bug this closes, found while measuring TASK C/D
 * against a freshly-generated pack: loadPackBlueprint used to pass `[]` as
 * importSongsJson's preassignedSongs argument, so core/batchPreallocation.ts's
 * reconcileWithPreassignedSlot could never find a matching slot for ANY
 * track — every song silently took the "no slot" fallback path, meaning
 * this audit tool could never actually exercise normalizeProviderStylePrompt
 * (TASK D) or the excludePrompt genre-differentiation append (TASK C) at
 * all, regardless of whether those fixes work in the real app. Building a
 * minimal per-track slot from the file's OWN already-written genreId/tempo
 * (parsed from stylePrompt's own "N BPM" text — the same verbatim value the
 * bridge schema already asks the provider to write, not a second source of
 * truth) makes reconciliation exercise those real code paths the same way a
 * live import does, without needing a freshly-computed independent plan
 * (which could disagree with what the file actually contains — a mismatch
 * risk this deliberately avoids by deriving the shadow slot FROM the file).
 * Reuses core/bridgeImport.ts's own extractRawImportedSongs — not a second
 * parser.
 */
const STYLE_PROMPT_BPM_PATTERN = /(\d+)\s*BPM/i;

function buildShadowSlotsFromRawSongs(rawText: string): PreassignedSongSlot[] {
  const raw = extractRawImportedSongs(rawText);
  return raw.map((entry, index): PreassignedSongSlot | null => {
    if (!entry || typeof entry !== 'object') return null;
    const obj = entry as Record<string, unknown>;
    const trackNo = typeof obj.trackNo === 'number' ? obj.trackNo : index + 1;
    const genreId = typeof obj.genreId === 'string' ? obj.genreId : undefined;
    const stylePrompt = typeof obj.stylePrompt === 'string' ? obj.stylePrompt : '';
    const bpmMatch = stylePrompt.match(STYLE_PROMPT_BPM_PATTERN);
    const tempo = bpmMatch ? parseInt(bpmMatch[1], 10) : 0;
    return { trackNo, title: '', hookPhrase: '', songRole: '', tempo, emotionArc: '', moneyChordText: '', ...(genreId ? { genreId } : {}) };
  }).filter((slot): slot is PreassignedSongSlot => slot !== null);
}

// ---------------------------------------------------------------------------
// TASK B-1 — 실제 발매 경로 (--pack). bridgeImport.ts:408의 importSongsJson
// 을 그대로 통과시킨다 — 별도 파서를 만들지 않는다. 이 함수는 그 함수가
// 필요로 하는 opts/genres/moods/season을 파일의 meta 블록(이미 존재하는
// extractBridgeImportMeta로 읽음, 새 파서 아님)에서 구성할 뿐, songs 배열
// 자체는 절대 직접 파싱하지 않는다. 지시문 10 (TASK F) — preassignedSongs도
// 이제 buildShadowSlotsFromRawSongs(같은 extractRawImportedSongs 재사용)로
// 파일 자체에서 만든다 — 더 이상 빈 배열이 아니다.
// ---------------------------------------------------------------------------
export interface PackLoadOk {
  blocked: false;
  blueprint: PlaylistBlueprint;
  conceptLabel: string;
  channel: ChannelProfile;
  importReport: ReturnType<typeof importSongsJson>;
}
export interface PackLoadBlocked {
  blocked: true;
  reasons: string[];
}
export type PackLoadResult = PackLoadOk | PackLoadBlocked;

export function loadPackBlueprint(packPath: string, explicitConcept: string | undefined): PackLoadResult {
  if (!fs.existsSync(packPath)) {
    return { blocked: true, reasons: [`파일을 찾을 수 없습니다: ${packPath}`] };
  }
  const rawText = fs.readFileSync(packPath, 'utf-8');
  const meta = extractBridgeImportMeta(rawText);
  const channel = channelPresets.find(c => c.id === meta?.channelId)
    ?? channelPresets.find(c => c.archetype === 'senior-morning')!;
  const songCount = meta?.songCount ?? 18;
  const lyricLanguage: LyricLanguage = (meta?.lyricLanguage as LyricLanguage | undefined) ?? channel.primaryLanguage;
  // TASK B-1 — "--concept가 없으면 팩의 meta.conceptLabel에서 읽는다. 없으면
  // 감사는 실행하되 '약속 이행도'를 미측정으로 표시한다. 통과 처리하지 않는다."
  // conceptLabel이 빈 문자열이면 core/promiseAudit.ts's auditPromises가
  // 자연히 0개 약속을 찾아 pass:null(미측정)이 된다 — 별도 통과 처리 로직을
  // 추가하지 않는다 (허구 통과 방지).
  const conceptLabel = explicitConcept || meta?.conceptLabel || '';
  const genreIds = channel.preferredGenres;
  const genres = genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const opts: GenerationOptions = {
    channel,
    projectTitle: conceptLabel || meta?.setName || 'imported pack',
    songCount,
    lyricLanguage,
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
    customConcept: conceptLabel,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: []
  };
  const season = defaultSeason();
  const importReport = importSongsJson(rawText, opts, genres, [], season, buildShadowSlotsFromRawSongs(rawText));
  if (!importReport.blueprint) {
    return {
      blocked: true,
      reasons: importReport.skippedReasons.length ? importReport.skippedReasons : ['알 수 없는 이유로 가져오기가 차단되었습니다.']
    };
  }
  return { blocked: false, blueprint: importReport.blueprint, conceptLabel, channel, importReport };
}

// ---------------------------------------------------------------------------
// TASK B-3 — 로컬 템플릿 경로와 실제 팩 경로 대조. 로컬 템플릿 경로는
// generateLocalBlueprint가 scoreSongs를 호출하지 않으므로(기존
// generatePack()과 동일한 실제 동작 — qualityScore가 스키마 기본값 그대로),
// 공정한 비교를 위해 여기서 직접 채점한다.
// ---------------------------------------------------------------------------
function printCompareLocal(packBlueprint: PlaylistBlueprint, conceptLabel: string, songCount: number, channel: ChannelProfile, lyricLanguage: LyricLanguage) {
  const localRaw = generatePack(conceptLabel || DEFAULT_CONCEPT, songCount, channel.id);
  const localScored = scoreSongs(localRaw.songs, channel, lyricLanguage);

  const stats = (songs: SongIdea[]) => {
    const counts = songs.map(s => lyricWordAndSectionCounts(s.lyrics));
    const words = counts.map(c => c.words);
    const styleLens = songs.map(s => s.stylePrompt.length);
    const maxVocab = topWordFrequencies(songs, 1)[0]?.count ?? 0;
    const quality = songs.map(s => s.qualityScore);
    return {
      wordRange: words.length ? `${Math.min(...words)}~${Math.max(...words)}` : '(없음)',
      styleLenRange: styleLens.length ? `${Math.min(...styleLens)}~${Math.max(...styleLens)}` : '(없음)',
      maxVocab,
      qualityAvg: quality.length ? (quality.reduce((a, b) => a + b, 0) / quality.length).toFixed(1) : '(없음)'
    };
  };

  const packStats = stats(packBlueprint.songs);
  const localStats = stats(localScored);
  const packPromiseReport = runFullAudit(packBlueprint.songs, { conceptLabel, songCount, audienceProfile: SENIOR_AUDIENCE_PROFILE }).promiseAudit;
  const localPromiseReport = runFullAudit(localScored, { conceptLabel, songCount, audienceProfile: SENIOR_AUDIENCE_PROFILE }).promiseAudit;

  console.log('=== --compare-local: 로컬 템플릿 vs 실제 팩 ===');
  console.log('');
  console.log('항목                로컬 템플릿          실제 팩              차이');
  console.log(`어휘 최대 반복        ${String(localStats.maxVocab).padEnd(20)}${String(packStats.maxVocab).padEnd(20)}${packStats.maxVocab - localStats.maxVocab}`);
  console.log(`약속 이행도          ${(Math.round(localPromiseReport.overallFulfillment * 100) + '%').padEnd(20)}${(Math.round(packPromiseReport.overallFulfillment * 100) + '%').padEnd(20)}${Math.round((packPromiseReport.overallFulfillment - localPromiseReport.overallFulfillment) * 100)}%p`);
  console.log(`가사 단어수          ${localStats.wordRange.padEnd(20)}${packStats.wordRange.padEnd(20)}`);
  console.log(`stylePrompt 길이     ${localStats.styleLenRange.padEnd(20)}${packStats.styleLenRange.padEnd(20)}`);
  console.log(`qualityScore 평균    ${String(localStats.qualityAvg).padEnd(20)}${String(packStats.qualityAvg).padEnd(20)}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// TASK B-4 — 세트 간 대조. 위치 정보(trackNo)를 반드시 함께 출력한다.
// ---------------------------------------------------------------------------
function normalizedLyricLines(lyrics: string): string[] {
  return lyrics.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('['));
}

export interface CrossComparisonResult {
  titleDupTrackNos: number[];
  hookDupTrackNos: number[];
  situationDupAnyCount: number;
  situationDupSameTrackCount: number;
  themeDupAnyCount: number;
  themeDupSameTrackCount: number;
  exactSentenceMatchCount: number;
  openingSixWordDupCount: number;
  sceneSimilarity: { min: number; median: number; max: number };
  totalA: number;
  /** 지시문 10 (TASK B-4-2) — treats B as A's own "recent set" and asks core/slotPlanOverlap.ts whether A's per-trackNo (theme OR situation) assignment reuses B's wholesale. */
  slotPlanOverlap: SlotPlanOverlapResult;
}

/** Pure — B-4/B-5's real cross-pack comparison, position-aware (trackNo). Separated from printCross's own formatting so tests/audit.pack.test.ts can assert on real numbers instead of parsing console output. */
export function computeCross(a: SongIdea[], b: SongIdea[]): CrossComparisonResult {
  const byTrackB = new Map(b.map(s => [s.trackNo, s]));

  const titleDupTrackNos = a.filter(s => byTrackB.get(s.trackNo)?.title === s.title).map(s => s.trackNo);
  const hookDupTrackNos = a.filter(s => byTrackB.get(s.trackNo)?.hookPhrase === s.hookPhrase).map(s => s.trackNo);
  const situationDupAny = a.filter(sa => b.some(sb => sb.listenerSituation === sa.listenerSituation));
  const situationDupSameTrack = a.filter(sa => byTrackB.get(sa.trackNo)?.listenerSituation === sa.listenerSituation);
  const themeDupAny = a.filter(sa => b.some(sb => sb.lyricTheme && sb.lyricTheme === sa.lyricTheme));
  const themeDupSameTrack = a.filter(sa => sa.lyricTheme && byTrackB.get(sa.trackNo)?.lyricTheme === sa.lyricTheme);

  const linesA = a.flatMap(s => normalizedLyricLines(s.lyrics));
  const linesBSet = new Set(b.flatMap(s => normalizedLyricLines(s.lyrics)));
  const exactSentenceMatches = [...new Set(linesA.filter(l => linesBSet.has(l)))];

  const openingA = a.map(s => openingSixWords(s.lyrics));
  const openingBSet = new Set(b.map(s => openingSixWords(s.lyrics)));
  const openingDup = openingA.filter(o => o && openingBSet.has(o));

  const similarities: number[] = [];
  for (const songA of a) {
    const songB = byTrackB.get(songA.trackNo);
    if (!songB) continue;
    const sigA = { situation: songA.listenerSituation, packId: 'A', trackNo: songA.trackNo };
    const sigB = { situation: songB.listenerSituation, packId: 'B', trackNo: songB.trackNo };
    similarities.push(sceneSimilarity(sigA, sigB));
  }
  similarities.sort((x, y) => x - y);

  const slotPlanOverlap = computeSlotPlanOverlap(
    a.map(s => ({ trackNo: s.trackNo, lyricTheme: s.lyricTheme, situation: s.listenerSituation })),
    b.map(s => ({ situation: s.listenerSituation, packId: 'B', trackNo: s.trackNo, lyricTheme: s.lyricTheme }))
  );

  return {
    titleDupTrackNos,
    hookDupTrackNos,
    situationDupAnyCount: situationDupAny.length,
    situationDupSameTrackCount: situationDupSameTrack.length,
    themeDupAnyCount: themeDupAny.length,
    themeDupSameTrackCount: themeDupSameTrack.length,
    exactSentenceMatchCount: exactSentenceMatches.length,
    openingSixWordDupCount: openingDup.length,
    sceneSimilarity: {
      min: similarities[0] ?? 0,
      max: similarities[similarities.length - 1] ?? 0,
      median: similarities.length ? similarities[Math.floor(similarities.length / 2)] : 0
    },
    totalA: a.length,
    slotPlanOverlap
  };
}

function printCross(a: SongIdea[], b: SongIdea[], conceptLabelA: string, conceptLabelB: string) {
  const r = computeCross(a, b);

  console.log('=== --cross: 세트 간 대조 (위치 정보 포함) ===');
  console.log('');
  console.log(`제목 완전중복              ${r.titleDupTrackNos.length}개   trackNo: [${r.titleDupTrackNos.join(', ')}]`);
  console.log(`훅 완전중복                ${r.hookDupTrackNos.length}개   trackNo: [${r.hookDupTrackNos.join(', ')}]`);
  console.log(`listenerSituation 중복     ${r.situationDupAnyCount}/${r.totalA}  같은 trackNo: ${r.situationDupSameTrackCount}개`);
  console.log(`lyricTheme 중복            ${r.themeDupAnyCount}/${r.totalA}  같은 trackNo: ${r.themeDupSameTrackCount}개`);
  console.log(`가사 문장 완전일치          ${r.exactSentenceMatchCount}개`);
  console.log(`도입부 첫6단어 중복         ${r.openingSixWordDupCount}개`);
  console.log(`sceneSignature 유사도       최소 ${r.sceneSimilarity.min.toFixed(3)} / 중앙 ${r.sceneSimilarity.median.toFixed(3)} / 최대 ${r.sceneSimilarity.max.toFixed(3)}`);
  const overlapPct = (r.slotPlanOverlap.worstMatch?.overlapShare ?? 0) * 100;
  console.log(`배정표(slotPlan) 재사용     ${r.slotPlanOverlap.verdict.toUpperCase()} — ${overlapPct.toFixed(0)}% (trackNo: [${r.slotPlanOverlap.worstMatch?.matchedTrackNos.join(', ') ?? ''}], 임계값 warn ${SLOT_PLAN_LEDGER_POLICY.warnShare * 100}% / block ${SLOT_PLAN_LEDGER_POLICY.blockShare * 100}% — 추정치, 검증된 값 아님)`);
  console.log('');

  for (const [label, songs, concept] of [['A', a, conceptLabelA], ['B', b, conceptLabelB]] as const) {
    const eraShare = concept ? checkSeniorEraShare(songs, concept) : undefined;
    console.log(`시대 표기 분포 (${label}, 컨셉: "${concept || '(없음)'}")`);
    if (eraShare) {
      console.log(`  primary(컨셉 시대) ${(eraShare.primaryShare * 100).toFixed(0)}% · transition(전환) ${(eraShare.transitionShare * 100).toFixed(0)}% · other-era-pure(다른 시대) ${(eraShare.otherEraPureShare * 100).toFixed(0)}%`);
    } else {
      console.log('  (컨셉 미지정 또는 시대 신호 없음 — 판정 불가)');
    }
  }
  console.log('');
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
/**
 * v4.4 (TASK C) — "최고기록" per item: not just last-run pass/fail, but the
 * best metric value ever recorded for THIS concept, so a real improvement
 * that's still below target (e.g. lyric word count 137 -> 190, still short
 * of 215) shows as progress instead of being lumped in with "still failing,
 * no better than before". `pass`/`bestValue`/`bestAt` are all optional-ish
 * in spirit but always written for measured items — bestValue/bestAt are
 * only present for items that carry a `metric` (fullAudit.ts's own doc
 * comment on AuditItem.metric explains which ~10 items that is).
 */
interface ConceptBaselineItem {
  pass: boolean;
  bestValue?: number;
  bestAt?: string;
}
interface ConceptBaseline {
  savedAt: string;
  items: Record<string, ConceptBaselineItem>;
}
/**
 * v4.4 (TASK C) — was a single flat {savedAt, conceptLabel, items} object
 * covering exactly one concept; comparing ANY other concept against it
 * produced false "regressions" for every legitimate concept-to-concept
 * difference (v4.3's own audit found this — e.g. C5/C6's female-vocal-
 * explicit share read as a regression against a Beatles-concept baseline
 * that was never about those concepts at all). Now keyed by concept label
 * so each concept only ever gets compared against its own history.
 */
type Baseline = Record<string, ConceptBaseline>;

/** Not a real hash — the trimmed concept label itself is the key. Exact string match is all that's needed (comparing a concept's re-run against its own prior run), and it keeps the JSON file human-readable/diffable. */
function conceptKey(label: string): string {
  return label.trim();
}

function loadBaseline(baselinePath: string = BASELINE_PATH): Baseline {
  if (!fs.existsSync(baselinePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    // v4.4 (TASK C) — old-schema file (pre-dates the per-concept keying
    // above): detected structurally by its own top-level conceptLabel/
    // savedAt/items shape (the old file never had a schema-version field
    // to check instead). Treated as no baseline rather than migrated —
    // this task's own "재설정 시점" requirement is to re-save fresh after
    // TASK A/B/F land, not to carry the old single-concept numbers forward.
    if (parsed && typeof parsed.conceptLabel === 'string' && typeof parsed.savedAt === 'string' && parsed.items) {
      return {};
    }
    return parsed ?? {};
  } catch {
    return {};
  }
}

function saveBaseline(report: FullAuditReport, baselinePath: string = BASELINE_PATH): void {
  const baseline = loadBaseline(baselinePath);
  const key = conceptKey(report.conceptLabel);
  const prior = baseline[key];
  const now = new Date().toISOString();
  const items: Record<string, ConceptBaselineItem> = {};
  for (const it of report.items) {
    if (it.status === 'not-measured') continue;
    const priorItem = prior?.items[it.id];
    let bestValue = priorItem?.bestValue;
    let bestAt = priorItem?.bestAt;
    if (it.metric) {
      const improved = bestValue === undefined
        || (it.metric.direction === 'higherIsBetter' ? it.metric.value > bestValue : it.metric.value < bestValue);
      if (improved) {
        bestValue = it.metric.value;
        bestAt = now;
      }
    }
    items[it.id] = { pass: it.status === 'pass', bestValue, bestAt };
  }
  baseline[key] = { savedAt: now, items };
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  console.log(`[audit] 기준선을 저장했습니다 (컨셉: "${report.conceptLabel}"): ${baselinePath}`);
}

type Classification = 'pass' | 'regression' | 'below-target' | 'improving' | 'not-measured' | 'new';

/**
 * v4.4 (TASK C) — for items with a `metric` (fullAudit.ts), classification
 * is now based on the best value ever recorded for this concept, not just
 * "did it pass last time": current worse than best -> regression; current
 * better than best but still below target -> improving (new); current
 * equal to best and still below target -> below-target (unchanged meaning).
 * Items without a metric keep the original pass-history-only comparison.
 */
function classify(item: AuditItem, conceptBaseline: ConceptBaseline | undefined): Classification {
  if (item.status === 'not-measured') return 'not-measured';
  const prior = conceptBaseline?.items[item.id];
  if (!prior) return item.status === 'pass' ? 'pass' : 'new';
  if (item.status === 'pass') return 'pass';
  if (item.metric && prior.bestValue !== undefined) {
    const { value, direction } = item.metric;
    const worseThanBest = direction === 'higherIsBetter' ? value < prior.bestValue : value > prior.bestValue;
    const betterThanBest = direction === 'higherIsBetter' ? value > prior.bestValue : value < prior.bestValue;
    if (worseThanBest) return 'regression';
    if (betterThanBest) return 'improving';
    return 'below-target';
  }
  return prior.pass ? 'regression' : 'below-target';
}

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------
function printConsoleReport(report: FullAuditReport, baseline: Baseline): { regressionCount: number } {
  const conceptBaseline = baseline[conceptKey(report.conceptLabel)];
  const classified = report.items.map(it => ({ item: it, classification: classify(it, conceptBaseline) }));
  const regressions = classified.filter(c => c.classification === 'regression');
  const improving = classified.filter(c => c.classification === 'improving');
  const belowTarget = classified.filter(c => c.classification === 'below-target' || c.classification === 'new');
  const passed = classified.filter(c => c.classification === 'pass');
  const notMeasured = classified.filter(c => c.classification === 'not-measured');

  console.log('');
  console.log(`세트: ${report.conceptLabel} (${report.songCount}곡)`);
  console.log(conceptBaseline ? `기준선(이 컨셉): ${conceptBaseline.savedAt}` : '기준선 없음 (이 컨셉 최초 실행 — --save-baseline으로 저장하십시오)');
  console.log('');

  if (regressions.length) {
    console.log(`🔻 회귀 ${regressions.length}건 ─────────────────────────────`);
    for (const { item } of regressions) {
      console.log(`  [${item.category}] ${item.labelKo}  ${item.targetKo} 기준 | 지금 ${item.actualKo}  ← 회귀`);
    }
    console.log('');
  }

  if (improving.length) {
    console.log(`📈 개선 중 ${improving.length}건 (최고기록 대비 나아졌으나 아직 미달) ────────`);
    for (const { item } of improving) {
      console.log(`  [${item.category}] ${item.labelKo}  ${item.targetKo} 기준 | 지금 ${item.actualKo}`);
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
  console.log(`종합: ${report.items.length}개 항목 중 ${passed.length} 통과 / ${regressions.length} 회귀 / ${improving.length} 개선 중 / ${belowTarget.length} 미달 / ${notMeasured.length} 미측정`);
  console.log('');

  return { regressionCount: regressions.length };
}

// ---------------------------------------------------------------------------
// Markdown report (TASK D)
// ---------------------------------------------------------------------------
function buildMarkdownReport(report: FullAuditReport, baseline: Baseline): string {
  const conceptBaseline = baseline[conceptKey(report.conceptLabel)];
  const classified = report.items.map(it => ({ item: it, classification: classify(it, conceptBaseline) }));
  const lines: string[] = [];
  lines.push(`# 정합성 전수 검사 리포트`);
  lines.push('');
  lines.push(`- 컨셉: ${report.conceptLabel}`);
  lines.push(`- 곡 수: ${report.songCount}`);
  lines.push(`- 생성 시각: ${new Date().toISOString()}`);
  lines.push(`- 기준선(이 컨셉): ${conceptBaseline ? conceptBaseline.savedAt : '없음'}`);
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
  const statusLabel: Record<Classification, string> = { pass: '✅', regression: '🔻 회귀', improving: '📈 개선 중', 'below-target': '⚠ 미달', 'not-measured': '⬜ 미측정', new: '⚠ 신규' };
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
function runPackMode(args: ReturnType<typeof parseArgs>) {
  const startedAt = Date.now();
  const loaded = loadPackBlueprint(args.packPath, args.explicitConcept);
  if (loaded.blocked) {
    console.error('[audit] --pack 가져오기가 차단되었습니다 — 구조 검증 실패, 감사를 실행하지 않습니다.');
    for (const reason of loaded.reasons) console.error(`  - ${reason}`);
    process.exit(1);
  }

  const { blueprint, conceptLabel, channel } = loaded;
  const songCount = blueprint.songs.length;
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
  const lyricLanguage: LyricLanguage = blueprint.songs[0] ? (channel.primaryLanguage as LyricLanguage) : channel.primaryLanguage;

  const killingPointTrackNos = new Set(blueprint.songs.filter(song => song.killingPointId).map(song => song.trackNo));
  const audioReport = loadAudioReport(args.audioMetricsPath, songCount, audienceProfile, killingPointTrackNos);

  const report = runFullAudit(blueprint.songs, { conceptLabel, songCount, audienceProfile, audioReport });

  if (!conceptLabel) {
    console.log('[audit] --concept도 meta.conceptLabel도 없습니다 — 약속 이행도는 미측정으로 표시됩니다 (통과 처리하지 않음).');
    console.log('');
  }

  const baseline = loadBaseline(PACK_BASELINE_PATH);
  const { regressionCount } = printConsoleReport(report, baseline);

  // TASK B-1 — "지금까지 채점된 실제 발매물의 qualityScore를 아무도 본 적이
  // 없다": bridgeImport.ts의 importSongsJson이 내부에서 scoreSongs를 실행한
  // 결과이므로, 여기 나오는 값은 스키마 플레이스홀더(0)가 아니라 실측값이다.
  console.log('실제 발매물 qualityScore (채점 후, 스키마 플레이스홀더 아님):');
  for (const song of blueprint.songs) console.log(`  T${song.trackNo}: ${song.qualityScore}`);
  console.log('');

  if (args.compareLocal) {
    printCompareLocal(blueprint, conceptLabel, songCount, channel, lyricLanguage);
  }

  console.log(`실행 시간: ${((Date.now() - startedAt) / 1000).toFixed(1)}초`);

  if (args.reportPath) {
    fs.writeFileSync(args.reportPath, buildMarkdownReport(report, baseline), 'utf-8');
    console.log(`[audit] 마크다운 리포트를 저장했습니다: ${args.reportPath}`);
  }

  if (args.saveBaseline) {
    saveBaseline(report, PACK_BASELINE_PATH);
  }

  if (args.crossPath) {
    const loadedB = loadPackBlueprint(args.crossPath, undefined);
    if (loadedB.blocked) {
      console.error('[audit] --cross 대상 파일 가져오기가 차단되었습니다.');
      for (const reason of loadedB.reasons) console.error(`  - ${reason}`);
      process.exit(1);
    }
    printCross(blueprint.songs, loadedB.blueprint.songs, conceptLabel, loadedB.conceptLabel);
  }

  if (regressionCount > 0) {
    console.error(`[audit] 회귀 ${regressionCount}건 발견 — exit code 1`);
    process.exit(1);
  }
}

function runLocalTemplateMode(args: ReturnType<typeof parseArgs>) {
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

function main() {
  const args = parseArgs();
  if (args.packPath) {
    runPackMode(args);
  } else {
    runLocalTemplateMode(args);
  }
}

// TASK B-5 — direct-run guard (same convention as scripts/checkReachability.ts
// /checkNodeReachability.ts) so tests/audit.pack.test.ts can import this
// module's own real loadPackBlueprint/computeCross without triggering
// main()'s CLI behavior (process.exit, etc.) as an import side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
