import type { VocalGender } from './vocalPlan';
import { countBpmTextMentions } from './bpmDedupe';
import { detectVocalGenderPresence } from './vocalPlan';
import { classifyClause, AXES_THAT_MUST_FOLLOW_GENRE } from '../data/promptAxisLexicon';

/**
 * codex 지시문 03 (TASK A) — real investigation finding (4 parallel research
 * agents, before writing any of this): stylePrompt text is built/mutated by
 * THREE structurally different subsystems today, not one —
 * core/promptComposer.ts (an atom-priority compiler, used by both local
 * generation and the Batch API path), core/bridgeInstruction.ts (free-text
 * instructions that ask an EXTERNAL LLM to write its own prose), and
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot (a post-hoc
 * fix-up chain that runs on all three paths' output afterward). Unifying
 * those into one compiler would be a multi-week rewrite touching ~3200
 * passing tests, explicitly out of scope for that task.
 *
 * 정합성 점검 §3 (dual-authority cleanup) — this file originally also shipped
 * a full PromptSpec contract + promptSpecFromSlot + compilePromptSpec as
 * proof that the type wasn't merely decorative. Real measurement found
 * neither was ever wired into any of the 3 live generation paths — a
 * second, parallel stylePrompt-compilation authority that existed only in
 * tests. Removed rather than left half-wired (checkReachability.ts's own
 * file-level granularity missed this exact gap: auditStylePromptAgainstSpec
 * below kept the file "reachable" while the other two functions were
 * genuinely dead code). What remains is the one real, live consumer.
 */

export interface VocalSpec {
  gender?: VocalGender;
  text: string;
}

export interface PromptSpecViolation {
  // 지시문 59 (TASK B) — 'instrumentPosition'/'vocalCount'는 이
  // 함수(auditStylePromptAgainstSpec) 안에서는 만들어지지 않는다(quality.ts/
  // fullAudit.ts가 이미 이 함수를 스코어링·집계에 쓰고 있어, 여기서 새
  // 위반을 추가하면 그 두 경로에 실측 없이 -8점/집계 변화를 만든다). 대신
  // finalPromptNormalizer.ts의 단일 정규화 관문이 core/promptElementOrder.ts의
  // 같은 순수 함수를 직접 불러 findings에 추가한다 — 타입만 여기서 공유한다.
  field: 'vocal' | 'tempo' | 'genre' | 'instrumentPosition' | 'vocalCount';
  detail: string;
}

/**
 * The bridge between a resolved vocal choice and the string-level reality
 * every real generation path still works in — scans an ALREADY-PRODUCED
 * stylePrompt string (from any of the 3 live paths, after
 * core/batchPreallocation.ts's reconciliation) for two concrete violations
 * (dual BPM claims, dual lead-vocal gender declarations), reusing the real
 * detectors those existing fixes already rely on rather than
 * re-implementing them.
 */
export function auditStylePromptAgainstSpec(stylePrompt: string, spec: { vocal: VocalSpec }): PromptSpecViolation[] {
  const violations: PromptSpecViolation[] = [];
  const bpmMentions = countBpmTextMentions(stylePrompt);
  if (bpmMentions > 1) {
    violations.push({ field: 'tempo', detail: `stylePrompt declares BPM ${bpmMentions} times, expected exactly 1` });
  }
  if (spec.vocal.gender === 'male' || spec.vocal.gender === 'female') {
    const presence = detectVocalGenderPresence(stylePrompt);
    if (presence.male && presence.female) {
      violations.push({ field: 'vocal', detail: `stylePrompt declares both male and female lead-vocal words for a single-gender (${spec.vocal.gender}) resolution` });
    }
  }
  // 지시문 58 (TASK A) — finalPromptNormalizer.ts의 enforceGenreOpensPrompt가
  // 앵커(genreText/signatureSound)를 못 찾아 재배열에 실패했을 때만 여기
  // 남는다(정규화가 100% 보장은 아니라는 신호 — 이 파일 자기 doc comment의
  // 기존 원칙 그대로).
  const firstClause = stylePrompt.split(',')[0]?.trim();
  if (firstClause) {
    const firstAxis = classifyClause(firstClause, false);
    if (firstAxis && AXES_THAT_MUST_FOLLOW_GENRE.has(firstAxis)) {
      violations.push({ field: 'genre', detail: `stylePrompt opens with a "${firstAxis}" clause ("${firstClause}") instead of genre identity` });
    }
  }
  return violations;
}
