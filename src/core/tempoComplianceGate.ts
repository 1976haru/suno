import type { AudienceProfile, GenrePack } from '../types';

/**
 * v5.22 (AXIS 2 §2-3) — real, verified gap this module fixes: a previous
 * task (v4.16) already instructed a 100 BPM ceiling for senior-oldpop, and
 * a real generated pack still delivered BPM 131 on 8 of 18 tracks — the
 * ceiling existed as a design-time GUIDELINE (core/designGate.ts's own
 * bpmIssues, which checks the audience profile's tempoRange against
 * PREASSIGNED SLOTS before generation) but nothing verified the ACTUAL
 * delivered BPM in the final song against it, and nothing checked a genre's
 * own tempoRange at all (core/tempoPlan.ts's resolveTempoWithBand
 * explicitly resolves BPM from the tempo BAND, not the genre's own
 * tempoRange, by design — see that function's own doc comment). This is
 * the missing POST-hoc verification layer, complementing (not replacing)
 * designGate.ts's own pre-generation check.
 */

export interface TempoComplianceIssue {
  id: 'tempo-over-ceiling' | 'tempo-under-floor' | 'tempo-outside-genre-range' | 'tempo-wording-contradiction';
  labelKo: string;
  detail: string;
}

/** Gate — BPM outside the audience profile's own [tempoFloor, tempoCeiling]. */
export function checkTempoAgainstAudienceProfile(bpm: number, profile: AudienceProfile): TempoComplianceIssue[] {
  const issues: TempoComplianceIssue[] = [];
  if (bpm > profile.tempoCeiling) {
    issues.push({ id: 'tempo-over-ceiling', labelKo: 'BPM이 청취자 프로파일 상한을 초과', detail: `BPM ${bpm} > 상한 ${profile.tempoCeiling}` });
  }
  if (bpm < profile.tempoFloor) {
    issues.push({ id: 'tempo-under-floor', labelKo: 'BPM이 청취자 프로파일 하한 미만', detail: `BPM ${bpm} < 하한 ${profile.tempoFloor}` });
  }
  return issues;
}

/** Gate — BPM outside the genre's OWN tempoRange (never checked anywhere else — see this module's own header doc comment). */
export function checkTempoAgainstGenreRange(bpm: number, genre: Pick<GenrePack, 'tempoRange' | 'label'>): TempoComplianceIssue[] {
  const [low, high] = genre.tempoRange;
  if (bpm < low || bpm > high) {
    return [{ id: 'tempo-outside-genre-range', labelKo: `BPM이 장르(${genre.label})의 템포 범위를 벗어남`, detail: `BPM ${bpm}, 장르 범위 ${low}-${high}` }];
  }
  return [];
}

// TASK spec's own §2-3 examples: 'unhurried' · 'slow' · 'gentle' + BPM > 100.
// Deliberately a curated list of unambiguous slow-tempo descriptors (not
// every word that COULD imply slowness) — kept narrow so this stays a real,
// low-false-positive contradiction check, matching this task's own explicit
// severity ("모순" — the wording and the number can't both be true).
const SLOW_TEMPO_WORDS = ['unhurried', 'slow', 'gentle', 'leisurely', 'languid', 'lulling', 'drowsy', 'sleepy', 'relaxed pace', 'laid-back tempo'];
const SLOW_TEMPO_BPM_THRESHOLD = 100;

/** Gate — a slow-tempo descriptor in the stylePrompt contradicting a BPM above the threshold that word can plausibly describe. */
export function checkTempoWordingContradiction(stylePrompt: string, bpm: number): TempoComplianceIssue[] {
  if (bpm <= SLOW_TEMPO_BPM_THRESHOLD) return [];
  const lower = stylePrompt.toLowerCase();
  const matched = SLOW_TEMPO_WORDS.find(word => lower.includes(word));
  if (!matched) return [];
  return [{
    id: 'tempo-wording-contradiction',
    labelKo: '템포 서술과 BPM 모순',
    detail: `스타일 프롬프트가 "${matched}"라고 서술하지만 BPM은 ${bpm} (기준 ${SLOW_TEMPO_BPM_THRESHOLD} 초과)`
  }];
}
