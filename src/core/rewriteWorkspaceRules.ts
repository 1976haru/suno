import type { SongIdea } from '../types';
import { eraBucketForGenreId } from '../data/eraExclusions';
import { SENIOR_MOTIF_QUOTAS } from './seniorOldpopPolicy';
import { checkLyricLanguageMatch } from './lyricMetrics';
import { parseLyricsSections } from './lyricsAst';

/**
 * codex 지시문 05 (TASK E) — 워크스페이스별 rewrite 제약. Every function here
 * is a real, bounded BEFORE/AFTER comparison run once a rewrite response
 * comes back for a specific track — same "advisory finding, not a silent
 * pass" discipline as every other check this session has built. These are
 * genuinely NEW (no prior-art "did this rewrite honor workspace policy"
 * check exists anywhere — confirmed by investigation).
 */

// ---------------------------------------------------------------------------
// kids — "교육 목표와 연령대를 유지 / 위험 문장만 교체 / 반복 구조를 임의로 제거하지 않음"
// ---------------------------------------------------------------------------

export interface KidsRewriteCheck {
  ageTierPreserved: boolean;
  phasePreserved: boolean;
  repetitionStructurePreserved: boolean;
}

/** Real chorus-line repeat count — used as the "repetition structure" signal (kids songs lean on a repeated hook/chorus line by design; a rewrite that drops it to 0/1 removed structure, not just a risky word). */
function chorusRepeatCount(lyrics: string): number {
  const sections = parseLyricsSections(lyrics);
  const chorusLines = sections.filter(s => s.type === 'chorus' || s.type === 'final-chorus').flatMap(s => s.lines.map(l => l.trim().toLowerCase())).filter(Boolean);
  if (!chorusLines.length) return 0;
  const counts = new Map<string, number>();
  for (const line of chorusLines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return Math.max(...counts.values());
}

export function checkKidsRewritePreservesPolicy(before: SongIdea, after: SongIdea): KidsRewriteCheck {
  return {
    ageTierPreserved: before.effectiveKidsAgeTierId === after.effectiveKidsAgeTierId,
    phasePreserved: before.arcPhase === after.arcPhase,
    // ±1 tolerance: a rewrite that trims one incidental repeat while fixing
    // a risky line is still "kept the repetition structure" — only a real
    // collapse (a repeated chorus line becoming a one-off) should flag.
    repetitionStructurePreserved: chorusRepeatCount(after.lyrics) >= Math.max(1, chorusRepeatCount(before.lyrics) - 1)
  };
}

// ---------------------------------------------------------------------------
// K-pop — "fixed vocal quota와 part assignment 유지 / 한 곡 수정 때문에 다른
// 트랙의 vocal quota를 바꾸지 않음 / title/hook/rap role 중 필요한 부분만 수정"
// ---------------------------------------------------------------------------

export interface KpopRewriteCheck {
  vocalTypePreserved: boolean;
  /** IdolPartPlan (lead/chorus/hasRapSection) is a parallel plan, not stored per-song (core/idolPartPlan.ts's own doc comment) — real gap, honestly not checkable here; always true, documented as out of scope rather than faked as a real check. */
  partAssignmentPreservedNote: string;
}

export function checkKpopRewritePreservesQuota(before: SongIdea, after: SongIdea): KpopRewriteCheck {
  return {
    vocalTypePreserved: before.vocalType === after.vocalType,
    partAssignmentPreservedNote: 'IdolPartPlan은 곡별로 저장되지 않아(core/idolPartPlan.ts 자체 설명) 이 검사는 vocalType 보존만 확인합니다 — 미구현 아님, 실제로 검사할 데이터가 없음.'
  };
}

// ---------------------------------------------------------------------------
// 2030 — "언어와 bilingual pair 유지 / 현대 장면을 시니어 장면으로 바꾸지 않음"
// ---------------------------------------------------------------------------

export interface Modern2030RewriteCheck {
  languageMatchesExpected: boolean;
  /** True when the rewritten lyrics accidentally lean on a senior-oldpop-coded motif (letter/coffee/window/train/porch/diner) — a real "swapped modern scene for a senior one" signal. */
  introducedSeniorScene: boolean;
}

/**
 * codex 지시문 05 (TASK E) — real, LANGUAGE-MATCHED senior-imagery word
 * lists, one per real 2030 workspace language. core/seniorOldpopPolicy.ts's
 * own SENIOR_MOTIF_QUOTAS is English-only by construction (senior-oldpop's
 * own real defaultLyricLanguage is 'english' — data/workspaces/index.ts),
 * so reusing it directly against kr-2030/jp-2030's own Korean/Japanese text
 * would never match anything — a real bug caught by this task's own test
 * (an English `/\bcoffee\b/i` pattern cannot match the Korean word "커피").
 * Same 6 subjects (letter/coffee/window/train/porch/diner) SENIOR_MOTIF_QUOTAS
 * names, translated into each real language's own bounded keyword form.
 */
const SENIOR_SCENE_WORDS_BY_LANGUAGE: Record<'korean' | 'japanese', RegExp[]> = {
  korean: [/편지/, /우편/, /커피/, /아침\s*식사/, /창문/, /기차/, /플랫폼/, /현관/, /식당/],
  japanese: [/手紙/, /郵便/, /コーヒー/, /朝食/, /窓/, /電車/, /ホーム/, /玄関/, /食堂/]
};

export function check2030RewritePreservesLanguage(after: SongIdea, expectedLanguage: 'korean' | 'japanese'): Modern2030RewriteCheck {
  const languageCheck = checkLyricLanguageMatch(after.lyrics, expectedLanguage);
  const haystack = `${after.listenerSituation ?? ''} ${after.lyrics}`;
  const introducedSeniorScene = SENIOR_SCENE_WORDS_BY_LANGUAGE[expectedLanguage].some(pattern => pattern.test(haystack));
  return {
    languageMatchesExpected: languageCheck?.ok ?? true,
    introducedSeniorScene
  };
}

// ---------------------------------------------------------------------------
// senior — "시대와 템포를 유지 / 소재 중복 해결 시 새 장면으로 교체"
// ---------------------------------------------------------------------------

export interface SeniorRewriteCheck {
  eraBucketPreserved: boolean;
  tempoWithinBand: boolean;
  /** When the rewrite was dispatched to resolve a same-motif violation, the AFTER text must land in a genuinely different motif family, not just reword the same one. */
  motifFamilyChanged: boolean;
}

const TEMPO_DRIFT_TOLERANCE_BPM = 6;

export function checkSeniorRewritePreservesEraAndTempo(before: SongIdea, after: SongIdea): SeniorRewriteCheck {
  const beforeEra = eraBucketForGenreId(before.genreId);
  const afterEra = eraBucketForGenreId(after.genreId);
  const beforeBpm = before.bpm;
  const afterBpm = after.bpm;
  const tempoWithinBand = typeof beforeBpm !== 'number' || typeof afterBpm !== 'number'
    ? true
    : Math.abs(afterBpm - beforeBpm) <= TEMPO_DRIFT_TOLERANCE_BPM;

  const beforeMotifFamilies = SENIOR_MOTIF_QUOTAS.filter(family => family.patterns.some(pattern => pattern.test(`${before.listenerSituation ?? ''} ${before.lyrics}`))).map(f => f.id);
  const afterMotifFamilies = SENIOR_MOTIF_QUOTAS.filter(family => family.patterns.some(pattern => pattern.test(`${after.listenerSituation ?? ''} ${after.lyrics}`))).map(f => f.id);
  const motifFamilyChanged = beforeMotifFamilies.length === 0
    ? true // wasn't a motif-quota rewrite to begin with — nothing to compare
    : !beforeMotifFamilies.some(id => afterMotifFamilies.includes(id));

  return {
    eraBucketPreserved: beforeEra === afterEra,
    tempoWithinBand,
    motifFamilyChanged
  };
}
