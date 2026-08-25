/**
 * 지시문 16 (TASK B) — appendVerbatimIfMissing(문자열 일치만 봄)을 대체하는
 * 축 인식(axis-aware) 병합. 실측 근본 원인(§2): "LLM 이 cold open straight
 * into the hook 이라고 썼는데 슬롯의 introTextureText 가 warm string ensemble
 * swell intro texture 면, 글자가 다르므로 둘 다 남는다." mergeAtom은 문자열이
 * 아니라 축(data/promptAxisLexicon.ts's classifyClause)으로 "이미 선언돼
 * 있는가"를 판정한다.
 */
import { classifyClause, SINGLE_DECLARATION_AXES, type PromptAtom } from '../data/promptAxisLexicon';

interface ClassifiedClause {
  text: string;
  axis: ReturnType<typeof classifyClause>;
}

function classifyClauses(stylePrompt: string): ClassifiedClause[] {
  return stylePrompt.split(',').map(c => c.trim()).filter(Boolean).map((text, index) => ({
    text,
    axis: classifyClause(text, index === 0)
  }));
}

function appendClause(stylePrompt: string, text: string): string {
  const trimmed = stylePrompt.trim().replace(/,\s*$/, '');
  return trimmed ? `${trimmed}, ${text}` : text;
}

/**
 * 지시문 16 §B-3 — mergeAtom 동작:
 *  1. atom.axis 가 프롬프트에 이미 선언돼 있는지 축 사전으로 판정
 *  2. 단일 선언 축이고 이미 있으면: locked 면 그 자리에서 replace(중복이면
 *     전부 제거하고 하나만 남김), creative 면 skip(LLM 표현 존중)
 *  3. 단일 선언 축이고 없으면 append
 *  4. 복수 허용 축이면 (동일 텍스트) 중복 제거 후 append
 *
 * No-op when atom.text is empty/whitespace-only — mirrors
 * appendVerbatimIfMissing's own `if (!verbatim) return stylePrompt` guard
 * (a slot with no hookDeviceText, e.g., must not inject an empty clause).
 */
export function mergeAtom(stylePrompt: string, atom: PromptAtom): string {
  if (!atom.text?.trim()) return stylePrompt;
  const clauses = classifyClauses(stylePrompt);
  const isSingleDeclaration = SINGLE_DECLARATION_AXES.includes(atom.axis);
  const existingSameAxis = clauses.filter(c => c.axis === atom.axis);

  if (isSingleDeclaration) {
    if (!existingSameAxis.length) return appendClause(stylePrompt, atom.text);
    if (!atom.locked) return stylePrompt; // creative: LLM이 이미 이 축을 선언했고, 그 표현을 존중한다
    // locked: 첫 등장 위치에서 replace, 그 뒤에 남아 있는 같은 축 중복은 전부 제거
    // (실측 §1-3 T5 "male relaxed mid-range lead" + "sustained lead" 같은,
    // 두 개 이상 겹쳐 있던 경우도 하나로 정리된다).
    let replaced = false;
    const kept: string[] = [];
    for (const clause of clauses) {
      if (clause.axis === atom.axis) {
        if (!replaced) { kept.push(atom.text); replaced = true; }
        continue;
      }
      kept.push(clause.text);
    }
    return kept.join(', ');
  }

  // 복수 허용 축 — 대소문자 무시 완전일치 중복만 제거(appendVerbatimIfMissing
  // 이 이미 이렇게 동작했다 — genre/instrument/harmony/mix/hookDevice/
  // backingVocal은 실측 버그가 없는 축이라 기존 동작을 유지).
  const normalizedAtom = atom.text.trim().toLowerCase();
  const alreadyPresent = clauses.some(c => c.text.trim().toLowerCase() === normalizedAtom);
  if (alreadyPresent) return stylePrompt;
  return appendClause(stylePrompt, atom.text);
}
