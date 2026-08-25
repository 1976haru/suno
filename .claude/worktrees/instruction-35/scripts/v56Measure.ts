/**
 * v5.6 audit — real local-generation measurement across the 6 new
 * workspaces (kr-2030/jp-2030/kr-kids/jp-kids/kr-idol-male/kr-idol-female).
 * Follows scripts/audit.ts's own generatePack pattern (directSetLocal ->
 * generateLocalBlueprint), the same real offline pipeline this app's own
 * audits already trust. Report-only — writes JSON to scratch, never touches
 * production code/data.
 *
 * Usage: npx tsx scripts/v56Measure.ts > v56-measure-out.json
 */
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { measureLyrics } from '../src/core/lyricMetrics';
import { kidsLyricSafetyIssues } from '../src/core/kidsLyricEngine';
import { lintIdolExpression } from '../src/core/idolExpressionLint';
import type { ChannelProfile, GenerationOptions, WorkspaceId } from '../src/types';
import * as fs from 'node:fs';

interface RunSpec {
  workspaceId: WorkspaceId;
  channelId: string;
  concept: string;
  songCount: number;
}

function generatePack(concept: string, songCount: number, channel: ChannelProfile) {
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

const KOREAN_RE = /[가-힣]/;
const JAPANESE_RE = /[぀-ゟ゠-ヿ]/; // hiragana/katakana (kanji shared with Chinese so excluded from this check)
const ENGLISH_WORD_RE = /[a-zA-Z]{3,}/;

const SENIOR_CONTAMINATION_TERMS = [
  'warm analog studio sound', 'acoustic instruments carry the arrangement', 'narrow warm stereo image',
  '창가', '주전자', '회상', 'window sill', 'kettle', 'reminiscence'
];
const KR_ADULT_EMOTION_TERMS = ['그리움', '후회', '이별', '외로움', '헤어짐'];
const KIDS_FORBIDDEN_EN = ['death', 'farewell', 'loss', 'longing', 'regret', 'lonel', 'dark', 'scary'];
const KIDS_FORBIDDEN_JA = ['死', '別れ', '寂しい', '怖い', '悲しい'];
const KIDS_FORBIDDEN_KO = ['죽음', '이별', '상실', '그리움', '후회', '외로움', '어둠', '무서움'];

function scanContamination(text: string, workspaceId: WorkspaceId): string[] {
  const hits: string[] = [];
  for (const term of SENIOR_CONTAMINATION_TERMS) {
    if (text.includes(term)) hits.push(`senior-term:"${term}"`);
  }
  if (/\boldpop-/.test(text)) hits.push('oldpop-genre-id-literal');
  if (workspaceId === 'kr-kids') {
    for (const term of KR_ADULT_EMOTION_TERMS) {
      if (text.includes(term)) hits.push(`adult-emotion:"${term}"`);
    }
  }
  return hits;
}

function scanKidsForbidden(text: string): string[] {
  const hits: string[] = [];
  for (const t of KIDS_FORBIDDEN_EN) if (new RegExp(t, 'i').test(text)) hits.push(`en:${t}`);
  for (const t of KIDS_FORBIDDEN_JA) if (text.includes(t)) hits.push(`ja:${t}`);
  for (const t of KIDS_FORBIDDEN_KO) if (text.includes(t)) hits.push(`ko:${t}`);
  return hits;
}

const ONOMATOPOEIA_JA = ['ぴょんぴょん', 'くるくる', 'ぱちぱち', 'もぐもぐ', 'ごしごし', 'わんわん', 'にゃんにゃん', 'よちよち', 'ぴよぴよ', 'みんみん'];

function mean(nums: number[]): number { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; }
function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(mean(nums.map(n => (n - m) ** 2)));
}

const RUNS: RunSpec[] = [
  { workspaceId: 'kr-2030', channelId: 'after-work-band-pop', concept: '퇴근 후 듣는 감성 밴드팝', songCount: 18 },
  { workspaceId: 'kr-2030', channelId: 'rainy-seoul-nightscape', concept: '새벽 서울 R&B', songCount: 18 },
  { workspaceId: 'jp-2030', channelId: 'reiwa-way-home-jpop', concept: '帰り道に聴く令和J-POP', songCount: 18 },
  { workspaceId: 'jp-2030', channelId: 'tokyo-night-melodic-pop', concept: '夜の東京メロディックポップ', songCount: 18 },
  { workspaceId: 'kr-kids', channelId: 'daily-habit-learning-song', concept: '손 씻기 생활습관 동요', songCount: 18 },
  { workspaceId: 'kr-kids', channelId: 'follow-along-action-song', concept: '숫자 세기 율동송', songCount: 18 },
  { workspaceId: 'jp-kids', channelId: 'teasobi-hiroba', concept: '手遊び歌 ぴょんぴょんウサギ', songCount: 18 },
  { workspaceId: 'jp-kids', channelId: 'oyasumi-mae-no-uta', concept: '生活習慣 はみがきのうた', songCount: 18 },
  { workspaceId: 'kr-idol-male', channelId: 'stage-night', concept: '청량한 여름 보이그룹 곡', songCount: 18 },
  { workspaceId: 'kr-idol-female', channelId: channelPresets.find(c => c.archetype === 'kr-idol-female')!.id, concept: '밝고 상큼한 걸그룹 곡', songCount: 18 }
];

function main() {
  const results: any[] = [];
  for (const spec of RUNS) {
    const channel = channelPresets.find(c => c.id === spec.channelId);
    if (!channel) {
      results.push({ ...spec, error: `channel not found: ${spec.channelId}` });
      continue;
    }
    let blueprint;
    try {
      blueprint = generatePack(spec.concept, spec.songCount, channel);
    } catch (err) {
      results.push({ ...spec, error: String(err) });
      continue;
    }
    const songs = blueprint.songs;
    const lang = channel.primaryLanguage;
    const bpms = songs.map(s => s.bpm).filter((b): b is number => typeof b === 'number');
    const genreIds = songs.map(s => s.genreId).filter(Boolean) as string[];
    const uniqueGenres = [...new Set(genreIds)];
    const foreignGenres = uniqueGenres.filter(id => {
      const prefix = spec.workspaceId === 'kr-2030' ? 'kr2030-'
        : spec.workspaceId === 'jp-2030' ? 'jp2030-'
        : spec.workspaceId === 'kr-kids' ? 'krkids-'
        : spec.workspaceId === 'jp-kids' ? 'jpkids-'
        : 'kridol-';
      return !id.startsWith(prefix);
    });
    const langMismatch: number[] = [];
    songs.forEach(s => {
      const body = s.lyrics || '';
      if (lang === 'korean' && !KOREAN_RE.test(body)) langMismatch.push(s.trackNo);
      if (lang === 'japanese' && !JAPANESE_RE.test(body)) langMismatch.push(s.trackNo);
    });
    const englishLeakInJapanese = lang === 'japanese' ? songs.filter(s => {
      const body = (s.lyrics || '').replace(/\[[^\]]*\]/g, ''); // strip section tags
      const enMatches = body.match(new RegExp(ENGLISH_WORD_RE, 'g')) || [];
      return enMatches.length > 3;
    }).map(s => s.trackNo) : [];

    const lyricMetrics = songs.map(s => measureLyrics(s.lyrics || '', lang));
    const primaryCounts = lyricMetrics.map(m => m.primary);

    const contamination: Record<number, string[]> = {};
    songs.forEach(s => {
      const hits = scanContamination((s.lyrics || '') + ' ' + (s.stylePrompt || '') + ' ' + (s.title || ''), spec.workspaceId);
      if (hits.length) contamination[s.trackNo] = hits;
    });

    const isKids = spec.workspaceId === 'kr-kids' || spec.workspaceId === 'jp-kids';
    const kidsSafety: Record<number, string[]> = {};
    if (isKids) {
      songs.forEach(s => {
        const blacklistIssues = kidsLyricSafetyIssues(s.lyrics || '');
        const manualForbidden = scanKidsForbidden(s.lyrics || '');
        const all = [...blacklistIssues, ...manualForbidden];
        if (all.length) kidsSafety[s.trackNo] = all;
      });
    }

    const isIdol = spec.workspaceId === 'kr-idol-male' || spec.workspaceId === 'kr-idol-female';
    const idolLintViolations: Record<number, any[]> = {};
    if (isIdol) {
      songs.forEach(s => {
        const v = lintIdolExpression({ title: s.title, hookPhrase: s.hookPhrase, lyrics: s.lyrics || '', stylePrompt: s.stylePrompt || '' });
        if (v.length) idolLintViolations[s.trackNo] = v;
      });
    }

    let onomatopoeiaHits = 0;
    if (spec.workspaceId === 'jp-kids') {
      songs.forEach(s => {
        if (ONOMATOPOEIA_JA.some(o => (s.lyrics || '').includes(o))) onomatopoeiaHits++;
      });
    }

    const promptLens = songs.map(s => (s.stylePrompt || '').length);
    const promptWordCounts = songs.map(s => (s.stylePrompt || '').split(',').map(x => x.trim()).filter(Boolean).length);
    const vocalTypeDist: Record<string, number> = {};
    songs.forEach(s => { if (s.vocalType) vocalTypeDist[s.vocalType] = (vocalTypeDist[s.vocalType] || 0) + 1; });
    const titles = songs.map(s => s.title);
    const uniqueTitles = new Set(titles).size;
    const titleLocalizedCount = songs.filter(s => s.titleLocalized).length;

    results.push({
      workspaceId: spec.workspaceId,
      channelId: spec.channelId,
      concept: spec.concept,
      songCount: songs.length,
      genreCount: uniqueGenres.length,
      genreIds: uniqueGenres,
      foreignGenreLeak: foreignGenres,
      bpm: { min: Math.min(...bpms), max: Math.max(...bpms), mean: +mean(bpms).toFixed(1), stddev: +stddev(bpms).toFixed(1) },
      lyricLanguageMismatchTracks: langMismatch,
      englishLeakInJapaneseTracks: englishLeakInJapanese,
      lyricPrimaryMetric: { unit: lang === 'japanese' ? 'char' : (lang === 'korean' ? 'eojeol' : 'word'), min: Math.min(...primaryCounts), max: Math.max(...primaryCounts), mean: +mean(primaryCounts).toFixed(1) },
      contaminationHits: contamination,
      contaminationCount: Object.keys(contamination).length,
      kidsSafetyViolations: kidsSafety,
      kidsSafetyViolationCount: Object.keys(kidsSafety).length,
      idolLintViolations,
      idolLintViolationCount: Object.keys(idolLintViolations).length,
      onomatopoeiaHits,
      promptLen: { min: Math.min(...promptLens), max: Math.max(...promptLens), mean: +mean(promptLens).toFixed(0) },
      promptWordCount: { min: Math.min(...promptWordCounts), max: Math.max(...promptWordCounts), mean: +mean(promptWordCounts).toFixed(1) },
      vocalTypeDist,
      uniqueTitles,
      titleLocalizedCount,
      allSongs: songs.map(s => ({
        trackNo: s.trackNo, title: s.title, titleLocalized: s.titleLocalized, genreId: s.genreId, bpm: s.bpm,
        vocalType: s.vocalType, lyrics: s.lyrics, stylePrompt: s.stylePrompt, excludePrompt: s.excludePrompt
      }))
    });
  }
  fs.writeFileSync('v56-measure-out.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log(JSON.stringify(results.map(r => ({
    ws: r.workspaceId, ch: r.channelId, ok: !r.error, songCount: r.songCount, genreCount: r.genreCount,
    foreignLeak: r.foreignGenreLeak, bpm: r.bpm, langMismatch: r.lyricLanguageMismatchTracks,
    enLeak: r.englishLeakInJapaneseTracks, primary: r.lyricPrimaryMetric, contamination: r.contaminationCount,
    kidsViol: r.kidsSafetyViolationCount, idolViol: r.idolLintViolationCount, onomatopoeia: r.onomatopoeiaHits,
    promptLen: r.promptLen, uniqueTitles: r.uniqueTitles, titleLocalized: r.titleLocalizedCount
  })), null, 2));
}

main();
