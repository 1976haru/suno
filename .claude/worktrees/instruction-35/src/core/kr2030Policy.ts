import type { SongIdea } from '../types';
import { parseLyricsSections } from './lyricsAst';
import { type TextMotifOverrideResult, checkTextMotifQuotasWithConceptOverride } from './textMotifQuota';
import { modern2030PolicyFor } from './modern2030Policy';
import { koreanTranslationeseWarning } from './languageQuality';

/**
 * codex 지시문 04 (§2) — real, dedicated kr-2030 policy adapter.
 * 번역체 차단은 core/languageQuality.ts's koreanTranslationeseWarning
 * (지시문 03 TASK J)를 그대로 재사용한다 (같은 검사를 두 번 만들지 않음).
 * bilingualPair(en-ko) 기본값은 core/localGenerator.ts's resolveBilingualPair
 * (지시문 02 TASK F)에서 이미 실제로 처리된다.
 */

/**
 * "동일한 `오늘도`, `너 없는`, `이 밤` 도입 과다 감지" — real gap confirmed
 * absent (core/lyricVocabularyRepetition.ts's own WORD_PATTERN is ASCII-only
 * and cannot see Hangul at all). This is a POSITIONAL check (the song's own
 * OPENING line), not a whole-lyrics scan — reuses core/lyricsAst.ts's
 * parseLyricsSections (지시문 03 TASK E) to find each song's real first sung
 * line, then checks it against this task's own 3 named phrases.
 */
const KR_2030_OPENING_CLICHE_PATTERNS: { id: string; labelKo: string; pattern: RegExp }[] = [
  { id: 'opening-oneuldo', labelKo: '"오늘도" 도입', pattern: /^\s*오늘도/ },
  { id: 'opening-neo-eobsneun', labelKo: '"너 없는" 도입', pattern: /^\s*너\s*없는/ },
  { id: 'opening-i-bam', labelKo: '"이 밤" 도입', pattern: /^\s*이\s*밤/ }
];

const OPENING_CLICHE_MAX_PER_PACK = 2;

export interface OpeningClicheFinding {
  id: string;
  labelKo: string;
  count: number;
  trackNos: number[];
}

function firstSungLine(lyrics: string): string | undefined {
  const sections = parseLyricsSections(lyrics);
  for (const section of sections) {
    const line = section.lines.find(l => l.trim());
    if (line) return line.trim();
  }
  return undefined;
}

export function checkKr2030OpeningClicheOveruse(songs: { trackNo: number; lyrics: string }[]): OpeningClicheFinding[] {
  const findings: OpeningClicheFinding[] = [];
  for (const { id, labelKo, pattern } of KR_2030_OPENING_CLICHE_PATTERNS) {
    const trackNos = songs
      .map(song => ({ trackNo: song.trackNo, opener: firstSungLine(song.lyrics) }))
      .filter(({ opener }) => opener && pattern.test(opener))
      .map(({ trackNo }) => trackNo);
    if (trackNos.length > OPENING_CLICHE_MAX_PER_PACK) {
      findings.push({ id, labelKo, count: trackNos.length, trackNos });
    }
  }
  return findings;
}

export function checkKr2030ModernMotifQuotas(
  songs: { trackNo: number; lyrics: string; listenerSituation?: string }[],
  conceptLabel?: string
): TextMotifOverrideResult[] {
  const policy = modern2030PolicyFor('kr-2030');
  if (!policy) return [];
  return checkTextMotifQuotasWithConceptOverride(songs, policy.modernSceneFamilies, conceptLabel);
}

/**
 * "18곡 중 최소 4개 구조 형태" — real, bounded structure-diversity check
 * reusing the existing real StructureTemplateId (T1-T5) system (confirmed
 * by investigation: no genre-keyed structure selection exists, so this
 * checks the same T1-T5 axis every workspace already resolves through,
 * not a fabricated genre-specific one).
 */
export const KR_2030_MIN_STRUCTURE_SHAPES = 4;

export function checkKr2030StructureVariety(songs: Pick<SongIdea, 'structureTemplate'>[]): { distinctCount: number; belowTarget: boolean } {
  const distinct = new Set(songs.map(s => s.structureTemplate).filter(Boolean));
  return { distinctCount: distinct.size, belowTarget: distinct.size < KR_2030_MIN_STRUCTURE_SHAPES };
}

/**
 * "랩 없는 채널에 랩 강제 금지" — confirmed by investigation that rap
 * section assignment (core/idolPartPlan.ts) is entirely self-contained to
 * kr-idol-male/kr-idol-female today (never wired into kr-2030 generation
 * at all) — so this is currently a structural impossibility, not a live
 * bug. Kept as a real regression guard (never trust an absence of wiring
 * to stay true forever) rather than skipped, matching this whole
 * session's own "regression-lock, not just a bug fix" precedent (see
 * 지시문 02 TASK B's BPM dedup tests for the same shape).
 */
export function findUnexpectedRapSections(songs: { trackNo: number; lyrics: string }[]): number[] {
  return songs.filter(song => parseLyricsSections(song.lyrics).some(s => s.type === 'rap')).map(song => song.trackNo);
}

export function checkKr2030Translationese(songs: { trackNo: number; lyrics: string }[]): string[] {
  const warnings: string[] = [];
  for (const song of songs) {
    for (const rawLine of song.lyrics.split('\n')) {
      const line = rawLine.trim();
      if (!line || /^\[[^\]]*\]$/.test(line)) continue;
      const warning = koreanTranslationeseWarning(line);
      if (warning) warnings.push(`Track ${song.trackNo}: ${warning}`);
    }
  }
  return warnings;
}
