/**
 * 지시문 31 (§2) — "세 시스템이 stylePrompt를 만든다": ① core/promptComposer.ts
 * (앱이 슬롯/원자에서 조립), ② bridge external LLM(외부 모델 자유 창작),
 * ③ core/batchPreallocation.ts의 normalizeProviderStylePrompt(사후 보정).
 * data/promptAxisLexicon.ts(지시문 16 TASK B-4, 축 사전)와
 * core/promptAxisMerge.ts의 mergeAtom(지시문 16 TASK B, 축 인식 병합)은 이미
 * 있었지만 실제로 호출되는 곳은 ③(normalizeProviderStylePrompt) 하나뿐이었다
 * — ①은 이 정규화를 아예 거치지 않았다(로컬 경로의 인트로 자기모순 2곡·
 * 리드 보컬 중복 6곡·중복 토큰 1곡의 실제 원인). 이 파일이 "raw
 * stylePrompt가 어느 경로에서 왔든 이 함수 하나를 거친다"는 단일 관문이다.
 *
 * normalizeProviderStylePrompt의 본문(축 오버레이 로직, 지시문 10 TASK D·
 * 지시문 16 TASK B-3)을 그대로 옮겼다 — 로직을 다시 짜지 않았다(§하지 말 것
 * "PromptSpec 컴파일러 전체를 재작성하지 말 것"). batchPreallocation.ts의
 * normalizeProviderStylePrompt는 이제 이 함수를 호출만 하는 얇은 래퍼다
 * (§하지 말 것 "normalizeProviderStylePrompt를 남겨둔 채 새 함수를 추가하지
 * 말 것" — 옛 이름을 지우지 않고 시그니처를 유지해 기존 유일한 실호출부
 * batchPreallocation.ts:reconcileWithPreassignedSlot가 안 바뀌게 한다).
 *
 * 옮긴 것 위에 새로 추가한 것 — mergeAtom의 오버레이는 "locked atom.text가
 * 실제로 존재할 때"만 기존 중복을 정리한다(atom.text가 비어 있으면 no-op).
 * bridge 임포트처럼 슬롯에 vocalVariantText가 없는 경우(예:
 * scripts/audit.ts의 --pack 재구성용 shadow slot), LLM이 자기 프로즈 안에서
 * 스스로 만든 중복(§0 실측: T8 "female lead with male harmony" + "male and
 * female duet")은 기존 오버레이만으로는 못 잡는다 — collapseSingleDeclarationDuplicates가
 * 그 안전망이다: 축 사전으로 이미 분류된 클로즈 목록에서, 단일 선언 축마다
 * 슬롯 데이터 유무와 무관하게 "첫 등장만 남기고 나머지 제거"를 기계적으로
 * 강제한다. classifyClause/SINGLE_DECLARATION_AXES를 그대로 재사용한다 —
 * 새 어휘 사전이 아니다.
 */
import type { PreassignedSongSlot } from '../types';
import type { PromptAxisPolicy } from '../data/promptAxisPolicy';
import { classifyClause, SINGLE_DECLARATION_AXES, AXES_THAT_MUST_FOLLOW_GENRE, type PromptAxis } from '../data/promptAxisLexicon';
import { getGenreById } from '../data/genreLibrary';
import { mergeAtom } from './promptAxisMerge';
import {
  enforceVocalTextInStylePrompt,
  stripConflictingGenreVocalGender
} from './vocalPlan';
import { stripNegativeStyleFromStylePrompt } from '../data/negativeStyles';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL } from './promptComposer';
import { enforceSingleBpmText } from './bpmDedupe';
import { auditStylePromptAgainstSpec, type PromptSpecViolation } from './promptSpec';
import { descriptorCount } from './compositionScorer';
import {
  firstInstrumentPosition,
  vocalDescriptorClauseCount,
  INSTRUMENT_POSITION_MAX_CHARS,
  VOCAL_DESCRIPTOR_MIN,
  VOCAL_DESCRIPTOR_MAX
} from './promptElementOrder';

export type Finding = PromptSpecViolation;

// ---------------------------------------------------------------------------
// batchPreallocation.ts에서 그대로 옮긴 5개 private 헬퍼 (지시문 10 TASK D·
// 지시문 16 TASK B-3) — 로직 변경 없음.
// ---------------------------------------------------------------------------

function enforceInstrumentSetInStylePrompt(stylePrompt: string, instrumentSet: string[] | undefined): string {
  if (!instrumentSet?.length) return stylePrompt;
  const promptLower = stylePrompt.toLowerCase();
  const missing = instrumentSet.filter(instrument => !promptLower.includes(instrument.trim().toLowerCase()));
  if (!missing.length) return stylePrompt;
  const trimmed = stylePrompt.trim().replace(/,\s*$/, '');
  return trimmed ? `${trimmed}, ${missing.join(', ')}` : missing.join(', ');
}

function enforceArrangementDensityInStylePrompt(stylePrompt: string, density: PreassignedSongSlot['arrangementDensity']): string {
  if (!density) return stylePrompt;
  return mergeAtom(stylePrompt, { axis: 'arrangementDensity', text: ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[density], locked: true });
}

function enforceTempoInStylePrompt(stylePrompt: string, tempo: number): string {
  return enforceSingleBpmText(stylePrompt, tempo);
}

function diversifyVocalLedOpening(stylePrompt: string, slot: PreassignedSongSlot): string {
  const trimmed = stylePrompt.trim();
  const lower = trimmed.toLowerCase();
  const vocalStarts = [slot.vocalText, slot.vocalVariantText].filter(Boolean).map(value => value!.trim().toLowerCase());
  if (!vocalStarts.some(start => start && lower.startsWith(start))) return stylePrompt;

  const instrument = slot.instrumentSet?.[0] || 'the small ensemble';
  const openings = [
    slot.genreText,
    slot.signatureSound,
    `${instrument} leads the opening`,
    slot.conceptText,
    slot.introTextureText,
    'a restrained cafe groove opens before the vocal',
    'brushed rhythm establishes the room before the vocal',
    `${instrument} and close room tone frame the first phrase`,
    'the bass pocket arrives before the lead voice',
    'a soft answering phrase opens the arrangement',
    'the harmony color arrives before the vocal enters',
    'a quiet instrumental breath starts the track',
    'the intimate room sound leads into the first line'
  ];
  const opening = openings[(Math.max(1, slot.trackNo) - 1) % openings.length];
  if (!opening || lower.startsWith(opening.toLowerCase())) return stylePrompt;
  return `${opening}, ${trimmed}`;
}

function removeRepeatedInstrumentMentions(stylePrompt: string, instrumentSet: string[] | undefined): string {
  if (!instrumentSet?.length) return stylePrompt;
  const seen = new Set<string>();
  return stylePrompt.split(',').map(clause => {
    let next = clause.trim();
    for (const instrument of instrumentSet) {
      const value = instrument.trim();
      const key = value.toLowerCase();
      const expression = new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig');
      if (!expression.test(next)) continue;
      if (seen.has(key)) next = next.replace(expression, '').replace(/\s{2,}/g, ' ').trim();
      else seen.add(key);
    }
    return next;
  }).filter(Boolean).join(', ');
}

// ---------------------------------------------------------------------------
// 지시문 31 (§2-3) — 새로 추가한 안전망 패스 3종. classifyClause/
// SINGLE_DECLARATION_AXES를 그대로 재사용한다(새 어휘 사전 아님).
// ---------------------------------------------------------------------------

/**
 * 슬롯에 locked 값이 없어 mergeAtom 오버레이가 no-op이었던 경우(예:
 * scripts/audit.ts --pack의 shadow slot)까지 잡는 마지막 안전망 — 단일
 * 선언 축으로 분류된 클로즈가 2개 이상 남아 있으면 첫 번째만 남기고
 * 나머지를 버린다. mergeAtom의 locked-replace(§B-3)와 동일한 "첫 등장
 * 유지" 규칙이라 동작이 갈리지 않는다.
 *
 * `protectedAxes` — 실측 회귀(tests/vocalGenderEnforcement.test.ts "is a
 * no-op on an already-correct stylePrompt/lyrics pair"): slot.vocalText가
 * 이미 "male lead with female harmony, ..., male and female duet"처럼 콤마로
 * 여러 클로즈를 포함한 하나의 duet 서술을 담고 있을 때, 이 함수가 그 안의
 * 두 번째 leadVocal 유사 클로즈를 "중복"으로 오인해 지워버렸다 — 하지만
 * 그건 하나의 locked atom.text 안에 있던 의도된 복수 어구였지 서로 다른
 * 두 선언이 아니었다. mergeAtom이 이미 그 축을 locked 값으로 정리한
 * 경우(normalizeFinalStylePrompt가 호출부에서 판단해 넘김)는 이 함수가
 * 다시 손대지 않는다 — mergeAtom 오버레이가 no-op이었던 축만 이 안전망의
 * 대상이라는 원래 취지 그대로.
 */
export function collapseSingleDeclarationDuplicates(stylePrompt: string, protectedAxes: readonly PromptAxis[] = []): string {
  const clauses = stylePrompt.split(',').map(c => c.trim()).filter(Boolean);
  const seenAxis = new Set<PromptAxis>();
  const kept: string[] = [];
  clauses.forEach((text, index) => {
    const axis = classifyClause(text, index === 0);
    if (axis && SINGLE_DECLARATION_AXES.includes(axis) && !protectedAxes.includes(axis)) {
      if (seenAxis.has(axis)) return;
      seenAxis.add(axis);
    }
    kept.push(text);
  });
  return kept.join(', ');
}

/** 지시문 16 §1-4 실측("male male head-voice lead") 재사용 — fullAudit.ts의 duplicateTokenSongs와 같은 패턴으로 검출, 여기서는 실제로 제거한다. */
const DUPLICATE_TOKEN_PATTERN = /\b(\w+)(\s+\1\b)+/gi;
export function collapseAdjacentDuplicateWords(stylePrompt: string): string {
  return stylePrompt.replace(DUPLICATE_TOKEN_PATTERN, '$1');
}

/**
 * 지시문 31 (§2-6) — "정규화가 중복 atom을 제거하면 자연히 줄어든다. 그래도
 * 넘으면 지시문 03 TASK C의 축약 우선순위를 따른다." 4단계 중 1단계(중복
 * 믹스 표현)만 구현한다 — 2단계(장식적 형용사)는 일반화된 판정 근거가
 * 없어(새 사전을 만들어야 함, §하지 말 것) 건너뛰고, 3·4단계(보조 악기·
 * 세부 훅 설명)는 실제로 구현했다가 뺐다(아래 enforceLengthPolicy 자기
 * doc comment의 tests/v343.test.ts 실측 회귀 — "보조"와 "방금 슬롯이 채운
 * 필수" 클로즈를 문자열만으로 구분할 수 없어 핵심 악기까지 잘라내는
 * 위험이 실제로 있었다). 정직하게 부분 구현으로 문서화한다. 삭제 금지
 * 8종(시대·장르·BPM·리드 보컬·핵심 악기·핵심 구조·사용자 선택·길이)은
 * 그래서 전부 이 함수가 아예 건드리지 않는 것으로 지켜진다.
 *
 * 길이 상한은 policy.maxLength(문자, data/promptAxisPolicy.ts — 지시문 16
 * TASK A-4가 청취로 확정하기 전까지 잠정 650)와 MAX_DESCRIPTOR_COUNT(클로즈
 * 개수, core/generationGate.ts의 PROMPT_ATOMS_MAX=25와 동일 값 — 그 상수
 * 자체는 export되지 않아 값만 재사용하고 출처를 주석에 명시한다, §공통
 * 규약 6) 둘 다 확인한다 — "단위는 문자와 단어 둘 다 남아 있다... 두 기준
 * 모두에서 초과하지 않게만 한다"(§하지 말 것).
 */
const MAX_DESCRIPTOR_COUNT = 25; // core/generationGate.ts의 PROMPT_ATOMS_MAX와 동일 값(그 상수는 export 안 됨) — 지시문 16 §1의 서술어 개수 상한과 같은 기준.

function withinLengthPolicy(stylePrompt: string, policy: PromptAxisPolicy): boolean {
  return stylePrompt.length <= policy.maxLength && descriptorCount(stylePrompt) <= MAX_DESCRIPTOR_COUNT;
}

/** 한 축의 클로즈들 중 처음 `keep`개만 남기고 나머지를 제거 — 다른 클로즈 순서/내용은 그대로 둔다. */
function trimAxisClauses(stylePrompt: string, axis: PromptAxis, keep: number): string {
  const clauses = stylePrompt.split(',').map(c => c.trim()).filter(Boolean);
  let seen = 0;
  const kept = clauses.filter((text, index) => {
    if (classifyClause(text, index === 0) !== axis) return true;
    seen += 1;
    return seen <= keep;
  });
  return kept.join(', ');
}

/**
 * 지시문 31 (§2-5 실측) — reconcileWithPreassignedSlot(batchPreallocation.ts)
 * 안에 "이미 완성된 것처럼 보이는 stylePrompt"를 통째로 건너뛰는 별도 fast
 * path가 있다(completeFields && !startsWithVocal && BPM 일치 — LLM이 슬롯이
 * 요구하는 모든 것을 이미 프로즈에 자연스럽게 녹였을 때 걸린다). scripts/audit.ts
 * --pack의 shadow slot(vocalText 등 대부분 필드가 없음)은 빈 배열
 * `.every()`가 항상 true라 이 fast path가 사실상 매번 걸려, 실제 발매물
 * 3세트 재감사에서 리드 보컬 중복(5·7·1)이 이 지시문 적용 후에도 그대로
 * 남아 있었다 — normalizeFinalStylePrompt 자체가 아예 호출되지 않았기
 * 때문(실측: 이 함수를 fast path에도 연결하고서야 실제로 줄었다). fast
 * path는 "이미 완성됐다"고 판단한 텍스트를 재작성하지 않는다는 성능/신뢰
 * 취지 자체는 유효하므로, locked 오버레이(값을 주입/치환하는 부분)는 그대로
 * 건너뛰고 이 안전망(제거만 하는 패스, 새 값을 주입하지 않음)만 별도로
 * 노출해 그 fast path에도 연결한다 — "호출하지 않는 경로가 남으면 이번
 * 결함이 반복된다"(§2-5)를 이 지점까지 실제로 지킨다.
 */
export function applyNormalizationSafetyNet(stylePrompt: string, policy: PromptAxisPolicy, protectedAxes: readonly PromptAxis[] = []): string {
  let result = collapseSingleDeclarationDuplicates(stylePrompt, protectedAxes);
  result = collapseAdjacentDuplicateWords(result);
  result = enforceLengthPolicy(result, policy);
  return result;
}

/**
 * 지시문 31 (§2-6) 실측 회귀 — 3단계(보조 악기 trimAxisClauses('instrument', ...))를
 * 원래 구현했다가 뺐다: tests/v343.test.ts가 "enforceInstrumentSetInStylePrompt가
 * 방금 슬롯 필수 악기(locked, 누락이라 주입한 것)로 채운 것"까지 이 함수가
 * 다시 잘라내는 실제 회귀를 냈다 — 축약 우선순위의 "장식(creative)" 클로즈와
 * "방금 주입한 필수(locked)" 클로즈를 문자열만으로는 구분할 수 없어서다.
 * 삭제 금지 8종의 "핵심 악기"를 실수로 어기느니 이 단계 자체를 하지 않는다
 * (§공통 규약 7 "실측 없이 blocking을 만들지 않는다"의 반대 방향 위험도
 * 마찬가지로 피한다). 1단계(mix 중복)만 남긴다 — mix는 어떤 locked 오버레이도
 * 채우는 축이 아니라 이런 충돌이 없다.
 */
function enforceLengthPolicy(stylePrompt: string, policy: PromptAxisPolicy): string {
  let current = stylePrompt;
  if (withinLengthPolicy(current, policy)) return current;
  // 1단계 — 중복 믹스 표현: mix 축은 여러 개 허용(MULTIPLE_ALLOWED_AXES)이지만
  // 첫 번째만 남기고 나머지는 장식으로 취급해 줄인다.
  current = trimAxisClauses(current, 'mix', 1);
  return current; // 그래도 넘으면 그대로 둔다 — 삭제 금지 축(genre/era/tempo/leadVocal/핵심 악기/구조 첫 클로즈/길이)은 이 함수가 건드리지 않는다.
}

/** "mid-1960s baroque pop" -> "baroque pop" — a leading era token only, never touches the rest of the phrase. */
const LEADING_ERA_PREFIX = /^\s*(?:(?:early|mid|late)-\d{4}s|(?:19|20)\d0s)\s+/i;
function stripLeadingEraPrefix(text: string): string {
  return text.replace(LEADING_ERA_PREFIX, '').trim();
}

/**
 * 지시문 58 (TASK A) — 실측: genreLibrary/index.ts의 여러 oldpop-* 장르는
 * styleCore 자체가 시대로 시작한다(예: oldpop-baroque-pop의 styleCore
 * "mid-1960s baroque pop, ..."). slot.genreText/signatureSound가 이
 * styleCore에서 파생되므로, 그 앵커 자체가 이미 시대로 시작하는 경우
 * enforceGenreOpensPrompt의 앵커-이동만으로는 해결되지 않는다(실측:
 * 8/14 굿모닝추억라디오 팩 15/15곡 재현 — oldpop-baroque-pop/
 * oldpop-orchestral-easy 등). genre.label(예: "Baroque Pop")은 시대가
 * 섞이지 않은 순수 장르명이라 이 폴백의 앵커로 쓴다. styleCore/genreText
 * 원문은 전혀 고치지 않는다 — 첫 클로즈로 label 하나만 추가할 뿐, 뒤따르는
 * 시대·서술 클로즈는 그대로 남는다.
 */
function genreIdentityFallback(slot: PreassignedSongSlot): string | undefined {
  const label = slot.genreId ? getGenreById(slot.genreId)?.label : undefined;
  if (label?.trim()) return label.trim();
  const firstFragment = slot.genreText?.split(',')[0]?.trim();
  if (!firstFragment) return undefined;
  const stripped = stripLeadingEraPrefix(firstFragment);
  return stripped || undefined;
}

/**
 * 지시문 58 (TASK A) — 실측 회귀: promptAxisLexicon.ts의 classifyClause는
 * "모든 실제 stylePrompt는 첫 클로즈가 장르명"이라는 전제로 설계됐다(그
 * 파일 자기 doc comment) — isFirstClause=true면 무조건 'genre'로 판정한다.
 * 지시문 46의 시대 바닥(eraGuardrailLines) 반영 이후 그 전제가 실제로
 * 깨졌다(8/14 세트: "late-1950s memory through 1970s piano pop ballad
 * lens..."). 첫 클로즈를 위치 특혜 없이(isFirstClause=false) 재판정해
 * AXES_THAT_MUST_FOLLOW_GENRE(REQUIRED_AXES_BY_POSITION에서 'genre' 뒤에
 * 오는 축들)에 속하면 장르가 밀려난 것으로 본다. 우선 slot.genreText/
 * signatureSound와 정확히 일치하는 기존 클로즈를 찾아 맨 앞으로 옮긴다(LLM이
 * 이미 쓴 문구를 재배치할 뿐, 새로 쓰지 않는다). genreText 자체가 여러
 * 클로즈로 이루어져 있어(예: "mid-1960s baroque pop, string quartet, oboe
 * obbligato") 정확히 일치하는 단일 클로즈가 없으면, genre.label을 새
 * 클로즈로 맨 앞에 추가한다(§genreIdentityFallback) — 기존 클로즈는 전혀
 * 지우거나 고치지 않는다. 그마저 없으면(레이블도 못 구하면) 손대지 않고
 * 그대로 둔다 — normalizeFinalStylePrompt의 findings가 그 잔여 상태를
 * 알린다(§2-3 "정규화가 100% 보장은 아니라는 신호").
 */
export function enforceGenreOpensPrompt(stylePrompt: string, slot: PreassignedSongSlot): string {
  const clauses = stylePrompt.split(',').map(c => c.trim()).filter(Boolean);
  if (clauses.length < 2) return stylePrompt;
  const firstAxis = classifyClause(clauses[0], false);
  if (!firstAxis || !AXES_THAT_MUST_FOLLOW_GENRE.has(firstAxis)) return stylePrompt;

  const anchors = [slot.genreText, slot.signatureSound].filter((v): v is string => Boolean(v?.trim()));
  for (const anchor of anchors) {
    const anchorLower = anchor.trim().toLowerCase();
    const idx = clauses.findIndex((c, i) => i > 0 && c.toLowerCase() === anchorLower);
    if (idx > 0) {
      const [genreClause] = clauses.splice(idx, 1);
      clauses.unshift(genreClause);
      return clauses.join(', ');
    }
  }

  const fallback = genreIdentityFallback(slot);
  if (fallback && clauses[0].toLowerCase() !== fallback.toLowerCase()) {
    return [fallback, ...clauses].join(', ');
  }
  return stylePrompt;
}

/**
 * 지시문 31 (§2-3) — 단일 관문. raw stylePrompt(어느 경로에서 왔든), slot
 * (locked 오버레이용 — 필드가 비어 있으면 해당 축은 그냥 no-op, 안전망
 * 패스는 그와 무관하게 항상 돈다), policy(길이 상한 등 워크스페이스별 정책,
 * data/promptAxisPolicy.ts 재사용)를 받아 { prompt, findings }를 낸다.
 * findings는 core/promptSpec.ts의 auditStylePromptAgainstSpec(기존 유일한
 * export, §2-1 인용)을 정규화 "이후" 텍스트에 재실행한 결과 — 정규화가
 * 못 없앤 잔여 위반이 있으면 여기 남는다(정규화가 100% 보장은 아니라는
 * 신호를 호출자에게 정직하게 전달). 지시문 59 (TASK B) — core/promptElementOrder.ts의
 * 악기 위치·보컬 서술 개수 체크도 여기서 같은 findings 배열에 추가된다(아래
 * 참고) — auditStylePromptAgainstSpec 자체에는 넣지 않는다: 그 함수는
 * quality.ts/fullAudit.ts도 스코어링·집계에 그대로 쓰고 있어, 거기에 넣으면
 * 실측 없이 -8점/집계 변화가 생긴다(§공통 규약 7). 이 정규화 관문의
 * findings만 소비하는 곳(아직 UI에 노출되지 않음, TASK E/F가 원문으로
 * 보고)에만 추가한다.
 */
export function normalizeFinalStylePrompt(
  raw: string,
  slot: PreassignedSongSlot,
  policy: PromptAxisPolicy
): { prompt: string; findings: Finding[] } {
  const vocalFix = enforceVocalTextInStylePrompt(raw, slot.vocalVariantText || slot.vocalText, slot.vocalGender);
  const conflictFreeGenreText = stripConflictingGenreVocalGender(slot.genreText, slot.vocalGender);
  const slotForStylePrompt: PreassignedSongSlot = conflictFreeGenreText === slot.genreText ? slot : { ...slot, genreText: conflictFreeGenreText };

  let stylePrompt = vocalFix.text;
  stylePrompt = mergeAtom(stylePrompt, { axis: 'leadVocal', text: slot.vocalVariantText || slot.vocalText || '', locked: true });
  stylePrompt = mergeAtom(stylePrompt, { axis: 'genre', text: slot.conceptText || '', locked: true });
  stylePrompt = mergeAtom(stylePrompt, { axis: 'harmony', text: slot.moneyChordText || '', locked: true });
  stylePrompt = mergeAtom(stylePrompt, { axis: 'genre', text: slot.signatureSound || '', locked: true });
  const existingPromptLower = stylePrompt.toLowerCase();
  const genreTextToAppend = conflictFreeGenreText
    && !existingPromptLower.includes(conflictFreeGenreText.trim().toLowerCase())
    && slot.instrumentSet?.some(instrument => existingPromptLower.includes(instrument.trim().toLowerCase()))
    ? conflictFreeGenreText.split(',').map(atom => atom.trim()).filter(atom =>
      !slot.instrumentSet!.some(instrument => atom.toLowerCase() === instrument.trim().toLowerCase())
    ).join(', ')
    : conflictFreeGenreText;
  stylePrompt = mergeAtom(stylePrompt, { axis: 'genre', text: genreTextToAppend || '', locked: true });
  stylePrompt = mergeAtom(stylePrompt, { axis: 'hookDevice', text: slot.hookDeviceText || '', locked: true });
  stylePrompt = mergeAtom(stylePrompt, { axis: 'intro', text: slot.introTextureText || '', locked: true });
  stylePrompt = enforceInstrumentSetInStylePrompt(stylePrompt, slot.instrumentSet);
  stylePrompt = enforceArrangementDensityInStylePrompt(stylePrompt, slot.arrangementDensity);
  stylePrompt = stripNegativeStyleFromStylePrompt(stylePrompt, slot.negativeStyleText);
  stylePrompt = enforceTempoInStylePrompt(stylePrompt, slot.tempo);
  stylePrompt = diversifyVocalLedOpening(stylePrompt, slotForStylePrompt);
  stylePrompt = removeRepeatedInstrumentMentions(stylePrompt, slot.instrumentSet);

  // 지시문 31 (§2-3) 실측 회귀(tests/vocalGenderEnforcement.test.ts) — 슬롯에
  // 실제 vocalVariantText/vocalText가 있으면 위 mergeAtom(:258)이 이미 그
  // 축을 locked 값(콤마로 여러 어구를 담은 하나의 의도된 duet 서술일 수
  // 있음)으로 정리했다 — 안전망이 그 안의 클로즈를 다시 손대면 의도된
  // 복수 어구를 "중복"으로 오인해 지운다. 그런 실제 슬롯 값이 없을 때만
  // (예: scripts/audit.ts --pack의 shadow slot) leadVocal을 안전망 대상에
  // 넣는다 — 그때는 mergeAtom의 leadVocal 오버레이 자체가 no-op이라 그
  // 축을 이 안전망 말고는 아무도 정리하지 않았다.
  const leadVocalAlreadyOverlaid = Boolean((slot.vocalVariantText || slot.vocalText)?.trim());
  stylePrompt = applyNormalizationSafetyNet(stylePrompt, policy, leadVocalAlreadyOverlaid ? ['leadVocal'] : []);
  // 지시문 58 (TASK A) — 안전망(중복 제거·길이 축약) 이후, 최종 문자열이
  // 확정된 다음에 어순을 확인한다. 안전망이 클로즈를 지우거나 합칠 수
  // 있으므로 그 전에 옮기면 앵커 위치가 어긋날 수 있다.
  stylePrompt = enforceGenreOpensPrompt(stylePrompt, slotForStylePrompt);

  const findings = auditStylePromptAgainstSpec(stylePrompt, {
    vocal: { gender: slot.vocalGender, text: slot.vocalVariantText || slot.vocalText || '' }
  });
  // 지시문 59 (TASK B) — "가져오기 시 stylePrompt를 파싱해 악기가 150자
  // 이내에 나오는가·보컬 서술이 2~3개인가 확인한다. 미달이면 재배열하거나
  // warning을 남긴다." 재배열(자동 이동)은 하지 않는다 — 악기는 genre.instruments
  // 중 어느 표현이 살아남았는지조차 자유 프로즈라 안전하게 이동시킬 앵커가
  // 없고(§하지 말 것 "PromptSpec 컴파일러 전체를 재작성하지 말 것"과 같은
  // 위험), 보컬은 없는 클로즈를 새로 만들어낼 수 없다. warning만 남긴다
  // (§공통 규약 7 "실측 없이 blocking을 만들지 않는다" — 여기서 쓰는
  // INSTRUMENT_POSITION_MAX_CHARS(100자)/VOCAL_DESCRIPTOR_MAX(3개)는 아직
  // 하루의 청취로 확정되지 않은 정책 임계값, promptElementOrder.ts 자기
  // 주석 참고).
  const instrumentPosition = firstInstrumentPosition(slotForStylePrompt.genreId, stylePrompt);
  if (instrumentPosition !== null && instrumentPosition > INSTRUMENT_POSITION_MAX_CHARS) {
    findings.push({
      field: 'instrumentPosition',
      detail: `genre instrument first appears at char ${instrumentPosition}, expected <= ${INSTRUMENT_POSITION_MAX_CHARS} (genre reads weakly when instruments arrive this late)`
    });
  }
  const vocalDescriptorCount = vocalDescriptorClauseCount(stylePrompt);
  if (vocalDescriptorCount !== null && vocalDescriptorCount > VOCAL_DESCRIPTOR_MAX) {
    findings.push({
      field: 'vocalCount',
      detail: `stylePrompt has ${vocalDescriptorCount} consecutive vocal descriptor clauses, expected ${VOCAL_DESCRIPTOR_MIN}-${VOCAL_DESCRIPTOR_MAX}`
    });
  }

  return { prompt: stylePrompt, findings };
}
