import type { LyricLanguage, SongIdea, WorkspaceId } from '../types';
import { auditPromises } from './promiseAudit';
import { lintEnglishLyrics } from './englishLint';
import { checkTranslationese } from './languageQuality';
import { checkLyricLanguageMatch } from './lyricMetrics';
import { qualityPolicyForWorkspace, type WorkspaceQualityPolicy } from '../data/workspaceQualityPolicies';
import type { ReleaseReadinessReport } from './releaseReadiness';

/**
 * codex 지시문 06 (TASK F) — "블라인드 A/B": real 5-axis scoring
 * (의도 반영 30/가사 자연스러움 25/프롬프트 정합성 20/독창성 15/실제 음원 10).
 * Investigation confirmed real, already-built bases for 4 of 5 axes:
 *  - intent (30): core/promiseAudit.ts's own auditPromises/overallFulfillment.
 *  - naturalness (25): core/englishLint.ts (English) / core/languageQuality.ts
 *    (KO/JA translationese markers — honestly narrower than English's real
 *    grammar checks, no morphological analysis exists for KO/JA).
 *  - originality (15): core/releaseReadiness.ts's own real 'novelty'
 *    category items (scene/title/line/fingerprint/arrangement/motif
 *    cross-history overlap checks).
 *  - real audio (10): honestly 'not-measured' until a real AudioTake exists
 *    for the pack (this app's real audio pipeline needs a human to render
 *    and upload the mp3 first — confirmed by investigation, never faked
 *    here as measured when it isn't).
 * "prompt consistency" (20) has no clean existing basis (investigation's own
 * finding — the closest candidates either overlap axis 1 or measure
 * something else entirely) — built here as a genuinely NEW, narrower
 * measure: does the pack's own real content conform to its workspace's own
 * real structural policy (language match + owned-genre membership,
 * data/workspaceQualityPolicies.ts) — deliberately distinct from axis 1
 * (which measures fulfillment of the CONCEPT's specific promises, not
 * structural workspace conformance).
 */

export interface BlindBenchmarkAxisScores {
  intent: number;
  naturalness: number;
  promptConsistency: number;
  originality: number;
  /** undefined when no real AudioTake data exists yet for this pack — never a fabricated 0 or a silent pass. */
  realAudio?: number;
}

export interface BlindBenchmarkScore {
  axes: BlindBenchmarkAxisScores;
  /** Sum of every MEASURED axis (realAudio excluded from both total and denominator when not-measured, so a text-only pack is scored fairly out of its own real 90-point ceiling, not artificially docked 10 points it never had a chance to earn). */
  total: number;
  maxPossible: number;
  realAudioMeasured: boolean;
}

const AXIS_MAX = { intent: 30, naturalness: 25, promptConsistency: 20, originality: 15, realAudio: 10 } as const;

// ---------------------------------------------------------------------------
// Axis 1 — intent (30)
// ---------------------------------------------------------------------------
function scoreIntent(songs: SongIdea[], conceptLabel: string): number {
  const report = auditPromises(songs, conceptLabel);
  if (!report.promises.length) return AXIS_MAX.intent; // no promise detected -> neutral full credit, same "no signal, don't penalize" convention applyConceptFitScore already uses.
  return Math.round(report.overallFulfillment * AXIS_MAX.intent);
}

// ---------------------------------------------------------------------------
// Axis 2 — naturalness (25)
// ---------------------------------------------------------------------------
function scoreNaturalness(songs: SongIdea[], lyricLanguage: LyricLanguage): number {
  if (lyricLanguage === 'english') {
    let blockingCount = 0;
    for (const song of songs) blockingCount += lintEnglishLyrics(song.lyrics, song.hookPhrase).issues.filter(i => i.severity === 'blocking').length;
    const perSongCap = 3; // beyond ~3 real issues per song, the pack reads as thoroughly unnatural — further issues don't need to keep dragging the score toward more negative territory.
    const ratio = songs.length ? Math.min(1, blockingCount / (songs.length * perSongCap)) : 0;
    return Math.round(AXIS_MAX.naturalness * (1 - ratio));
  }
  if (lyricLanguage === 'korean' || lyricLanguage === 'japanese') {
    const allLines = songs.flatMap(song => song.lyrics.split('\n'));
    const warnings = checkTranslationese(allLines, lyricLanguage);
    const ratio = allLines.length ? Math.min(1, warnings.length / Math.max(1, allLines.length * 0.1)) : 0;
    return Math.round(AXIS_MAX.naturalness * (1 - ratio));
  }
  return AXIS_MAX.naturalness; // bilingual: no real per-language naturalness check exists yet — neutral full credit, not a fabricated penalty.
}

// ---------------------------------------------------------------------------
// Axis 3 — prompt consistency (20, genuinely new)
// ---------------------------------------------------------------------------
function scorePromptConsistency(songs: SongIdea[], policy: WorkspaceQualityPolicy): number {
  if (!songs.length) return AXIS_MAX.promptConsistency;
  let violations = 0;
  let checks = 0;
  const { defaultLyricLanguage } = policy.languagePolicy;
  for (const song of songs) {
    if (defaultLyricLanguage !== 'bilingual') {
      checks += 1;
      const languageCheck = checkLyricLanguageMatch(song.lyrics, defaultLyricLanguage);
      if (languageCheck && !languageCheck.ok) violations += 1;
    }
    if (policy.ownedGenreIds.length && song.genreId) {
      checks += 1;
      if (!policy.ownedGenreIds.includes(song.genreId)) violations += 1;
    }
  }
  if (!checks) return AXIS_MAX.promptConsistency;
  return Math.round(AXIS_MAX.promptConsistency * (1 - violations / checks));
}

// ---------------------------------------------------------------------------
// Axis 4 — originality (15) — real reuse of releaseReadiness's own 'novelty' category
// ---------------------------------------------------------------------------
function scoreOriginality(releaseReadiness: ReleaseReadinessReport | undefined): number {
  if (!releaseReadiness) return AXIS_MAX.originality;
  const noveltyItems = releaseReadiness.items.filter(item => item.category === 'novelty' && !item.notImplemented);
  if (!noveltyItems.length) return AXIS_MAX.originality;
  const passed = noveltyItems.filter(item => item.status === 'pass').length;
  return Math.round(AXIS_MAX.originality * (passed / noveltyItems.length));
}

// ---------------------------------------------------------------------------
// Axis 5 — real audio (10, honestly optional)
// ---------------------------------------------------------------------------
export interface AudioComplianceSummary {
  overallStatus: 'pass' | 'warn' | 'fail';
}

function scoreRealAudio(summaries: AudioComplianceSummary[] | undefined): number | undefined {
  if (!summaries || !summaries.length) return undefined;
  const perTakeScore = { pass: AXIS_MAX.realAudio, warn: AXIS_MAX.realAudio / 2, fail: 0 } as const;
  const total = summaries.reduce((sum, s) => sum + perTakeScore[s.overallStatus], 0);
  return Math.round(total / summaries.length);
}

export interface BlindBenchmarkScoreInput {
  songs: SongIdea[];
  conceptLabel: string;
  lyricLanguage: LyricLanguage;
  workspaceId: WorkspaceId;
  releaseReadiness?: ReleaseReadinessReport;
  audioComplianceSummaries?: AudioComplianceSummary[];
}

export function scoreBlindBenchmarkEntry(input: BlindBenchmarkScoreInput): BlindBenchmarkScore {
  const policy = qualityPolicyForWorkspace(input.workspaceId);
  const intent = scoreIntent(input.songs, input.conceptLabel);
  const naturalness = scoreNaturalness(input.songs, input.lyricLanguage);
  const promptConsistency = scorePromptConsistency(input.songs, policy);
  const originality = scoreOriginality(input.releaseReadiness);
  const realAudio = scoreRealAudio(input.audioComplianceSummaries);

  const realAudioMeasured = realAudio !== undefined;
  const maxPossible = AXIS_MAX.intent + AXIS_MAX.naturalness + AXIS_MAX.promptConsistency + AXIS_MAX.originality + (realAudioMeasured ? AXIS_MAX.realAudio : 0);
  const total = intent + naturalness + promptConsistency + originality + (realAudio ?? 0);

  return {
    axes: { intent, naturalness, promptConsistency, originality, realAudio },
    total,
    maxPossible,
    realAudioMeasured
  };
}

// ---------------------------------------------------------------------------
// Blind wrapper — hides which system/provider produced each entry
// ---------------------------------------------------------------------------

export interface BlindBenchmarkSourceEntry {
  systemId: string;
  score: BlindBenchmarkScore;
}

/** What a real reviewer actually sees — deliberately has NO field that could carry a provider/system name. */
export interface BlindBenchmarkEntry {
  systemToken: string;
  score: BlindBenchmarkScore;
}

/**
 * Real, stable anonymization: every distinct real systemId maps to one
 * opaque "System A"/"System B"/... token, assigned in FIRST-SEEN order
 * (deterministic, not random — a re-run over the same entries always
 * produces the same mapping, so a human reviewer's own notes stay valid
 * across re-renders) — and the returned objects never carry the real
 * systemId field at all (not just blanked — structurally absent), which is
 * what makes 완료 기준 "source provider leaked in blind test = 0" checkable
 * by construction rather than by convention.
 */
export function anonymizeBlindBenchmarkEntries(entries: readonly BlindBenchmarkSourceEntry[]): BlindBenchmarkEntry[] {
  const tokenBySystemId = new Map<string, string>();
  let nextTokenIndex = 0;
  const tokenFor = (systemId: string): string => {
    if (!tokenBySystemId.has(systemId)) {
      tokenBySystemId.set(systemId, `System ${String.fromCharCode(65 + nextTokenIndex)}`);
      nextTokenIndex += 1;
    }
    return tokenBySystemId.get(systemId)!;
  };
  return entries.map(entry => ({ systemToken: tokenFor(entry.systemId), score: entry.score }));
}

/** Real, structural leak check — asserts no known real systemId substring survives into the blind view's own serialized form. */
export function assertNoProviderLeak(entries: readonly BlindBenchmarkEntry[], realSystemIds: readonly string[]): boolean {
  const serialized = JSON.stringify(entries);
  return !realSystemIds.some(id => id && serialized.includes(id));
}

// ---------------------------------------------------------------------------
// Per-workspace minimum concept counts + "각 콘셉트 시스템별 3회" plan
// ---------------------------------------------------------------------------

export const MINIMUM_CONCEPTS_PER_WORKSPACE: Record<WorkspaceId, number> = {
  'senior-oldpop': 2,
  'kr-2030': 2,
  'jp-2030': 2,
  'kr-kids': 1,
  'jp-kids': 1,
  'kr-idol-male': 1,
  'kr-idol-female': 1,
  // 지시문 71 (TASK A) — 신규 워크스페이스, 다른 성인 단일 아키타입
  // 워크스페이스(kr-2030/jp-2030)와 동일하게 2.
  'en-chillhop': 2
};

export function meetsMinimumConceptCount(workspaceId: WorkspaceId, conceptCount: number): boolean {
  return conceptCount >= MINIMUM_CONCEPTS_PER_WORKSPACE[workspaceId];
}

export interface BlindBenchmarkPlanEntry {
  concept: string;
  systemId: string;
  runIndex: number;
}

const RUNS_PER_CONCEPT_SYSTEM_PAIR = 3;

/** "각 콘셉트 시스템별 3회" — real, deterministic plan: every (concept, system) pair gets exactly RUNS_PER_CONCEPT_SYSTEM_PAIR entries. */
export function buildBlindBenchmarkPlan(concepts: readonly string[], systemIds: readonly string[]): BlindBenchmarkPlanEntry[] {
  const plan: BlindBenchmarkPlanEntry[] = [];
  for (const concept of concepts) {
    for (const systemId of systemIds) {
      for (let runIndex = 1; runIndex <= RUNS_PER_CONCEPT_SYSTEM_PAIR; runIndex++) {
        plan.push({ concept, systemId, runIndex });
      }
    }
  }
  return plan;
}
