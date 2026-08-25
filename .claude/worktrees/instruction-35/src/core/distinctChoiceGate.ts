import type { DistinctChoiceRuleId, DistinctChoiceVerifiability, SongIdea } from '../types';
import type { DistinctChoicePolicy } from '../data/distinctChoicePolicy';
import { parseLyricsSections, type LyricsSection } from './lyricsAst';
import { DISTINCT_CHOICE_VERIFIABILITY, DISTINCT_CHOICE_RULE_LABEL_KO } from './distinctChoiceTypes';

/**
 * 지시문 15 (TASK B-1) — distinctChoice 이행 관문의 공통 엔진. archetype을
 * 전혀 모른다 — 어떤 규칙을 허용할지, 최소 이행률이 얼마인지는 전부
 * 호출자가 넘기는 DistinctChoicePolicy(core/workspaceQualityPolicies.ts
 * 경유)가 결정한다. 이 파일 안에 `archetype === '...'`가 있으면 그 자체가
 * 이 지시문의 실패다(scripts/checkArchetypeHardcoding.ts가 신규 코드의
 * 하드코딩을 허용하지 않는다).
 *
 * §1의 실측(20260808 팩)에 맞춰 검증 로직을 校정했다 — T8·T11·T12·T14·T15가
 * 실제로 위반으로, T6이 정상으로, T2·T3가 not-measured로 나와야 한다
 * (지시문 자신의 인수 기준, TASK E §2 4번).
 */

export type DistinctChoiceTrackStatus = 'compliant' | 'violated' | 'not-measured' | 'missing';

export interface DistinctChoiceTrackResult {
  trackNo: number;
  ruleId?: DistinctChoiceRuleId;
  verifiability?: DistinctChoiceVerifiability;
  status: DistinctChoiceTrackStatus;
  reasonKo: string;
  /** 이 트랙이 안전 제약(kids NO_CHORUS/FINAL_QUESTION 금지, K-pop NO_CHORUS 금지 등)을 위반했는가 — verified와 무관하게 항상 blocking. */
  safetyViolation?: string;
}

export interface DistinctChoiceGateResult {
  trackResults: DistinctChoiceTrackResult[];
  assignedCount: number;
  compliantCount: number;
  violatedCount: number;
  notMeasuredCount: number;
  missingCount: number;
  /**
   * compliant / (compliant + violated) — not-measured·missing은 분모에서
   * 제외(§B-3 "not-measured 를 pass 로 세지 않는다"와 대칭: 분자에도
   * 분모에도 넣지 않는다). measured(=compliant+violated)가 0이면 계산
   * 자체가 불가능하므로 null — 지시문 32 (§3) 이전에는 이 경우를 1로
   * 반환해 "측정 곡 0개인데 이행률 100%"로 잘못 표시했다. null을 절대
   * 1이나 0으로 대체하지 말 것 — 호출자가 "미측정" 문구로 표시해야 한다.
   */
  complianceRate: number | null;
  policy: DistinctChoicePolicy;
  /** true면 이 결과가 실제로 blocking 판정에 쓰일 수 있다(policy.verified). false면 advisory 전용. */
  verified: boolean;
  /** verified && (assignedCount < policy.minAssignedTracks || complianceRate < policy.minComplianceRate || notMeasuredCount > policy.maxNotMeasured) 일 때만 true. */
  thresholdBlocking: boolean;
  /** safetyViolation이 하나라도 있으면 true — verified와 무관하게 항상 실제 차단. */
  safetyBlocking: boolean;
  thresholdReasonKo?: string;
}

type SongInput = Pick<SongIdea, 'trackNo' | 'lyrics' | 'stylePrompt' | 'distinctChoice' | 'distinctChoiceRuleId' | 'distinctChoiceParams'>;

function verseSections(sections: LyricsSection[]): LyricsSection[] {
  return sections.filter(s => s.type === 'verse');
}
function mainChorusSections(sections: LyricsSection[]): LyricsSection[] {
  return sections.filter(s => s.type === 'chorus' || s.type === 'final-chorus');
}
function anyChorusTypeSections(sections: LyricsSection[]): LyricsSection[] {
  return sections.filter(s => s.type === 'chorus' || s.type === 'final-chorus' || s.type === 'post-chorus');
}
function lastNonEmptyLine(sections: LyricsSection[]): string | undefined {
  for (let i = sections.length - 1; i >= 0; i--) {
    const lines = sections[i].lines.filter(l => l.trim());
    if (lines.length) return lines[lines.length - 1];
  }
  return undefined;
}
const STOPWORDS = new Set(['the', 'a', 'an', 'i', 'you', 'we', 'and', 'to', 'of', 'in', 'on', 'my', 'me', 'it', 'is', 'was', 'that', 'this', 'for', 'no', 'so', 'at', 'as']);
function significantWords(line: string): Set<string> {
  return new Set(line.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w)));
}

interface RuleCheckResult {
  violated: boolean;
  reasonKo: string;
}

/**
 * 지시문 15 (TASK B-1) — ruleId별 검증. lyrics-ast 규칙은 core/lyricsAst.ts의
 * parseLyricsSections만 읽는다(문자열 파싱을 여기서 새로 하지 않는다).
 * prompt-only 규칙은 stylePrompt 문자열의 자기모순만 본다.
 */
function checkRule(ruleId: DistinctChoiceRuleId, song: SongInput, sections: LyricsSection[]): RuleCheckResult {
  const params = song.distinctChoiceParams ?? {};
  switch (ruleId) {
    case 'NO_CHORUS': {
      const chorus = anyChorusTypeSections(sections);
      return chorus.length === 0
        ? { violated: false, reasonKo: 'chorus 계열 섹션 0개 — 이행됨' }
        : { violated: true, reasonKo: `chorus 계열 섹션 ${chorus.length}개 존재 (기대 0개)` };
    }
    case 'SINGLE_CHORUS': {
      const chorus = mainChorusSections(sections);
      return chorus.length <= 1
        ? { violated: false, reasonKo: `chorus 계열 섹션 ${chorus.length}개 — 이행됨` }
        : { violated: true, reasonKo: `chorus 계열 섹션 ${chorus.length}개 (기대 1개 이하)` };
    }
    case 'FINAL_QUESTION': {
      const last = lastNonEmptyLine(sections);
      const ends = Boolean(last?.trim().endsWith('?'));
      return ends
        ? { violated: false, reasonKo: `마지막 줄이 물음표로 끝남: "${last}"` }
        : { violated: true, reasonKo: `마지막 줄이 물음표로 끝나지 않음: "${last ?? '(없음)'}"` };
    }
    case 'VOCAL_TOGETHER': {
      const relevant = [...verseSections(sections), ...mainChorusSections(sections)];
      const singleVocalistTags = relevant
        .map(s => s.vocalist?.toLowerCase().trim())
        .filter((v): v is string => typeof v === 'string' && v.length > 0 && !/and|duet|together|unison|both/.test(v));
      const distinct = new Set(singleVocalistTags);
      return distinct.size < 2
        ? { violated: false, reasonKo: '단독 보컬 태그가 교대하지 않음 — "함께" 주장과 일치' }
        : { violated: true, reasonKo: `단독 보컬 태그가 교대함(${[...distinct].join(', ')}) — 번갈아 부른 것이지 함께 부른 게 아님` };
    }
    case 'VERSE2_HALF_LENGTH': {
      const verses = verseSections(sections);
      if (verses.length < 2) return { violated: true, reasonKo: `verse가 ${verses.length}개뿐 — 2절 비교 불가` };
      const ratio = verses[1].lines.length / Math.max(1, verses[0].lines.length);
      const inRange = ratio >= 0.4 && ratio <= 0.6;
      return inRange
        ? { violated: false, reasonKo: `2절 ${verses[1].lines.length}줄 / 1절 ${verses[0].lines.length}줄 = ${Math.round(ratio * 100)}% — 이행됨` }
        : { violated: true, reasonKo: `2절 ${verses[1].lines.length}줄 / 1절 ${verses[0].lines.length}줄 = ${Math.round(ratio * 100)}% (기대 40~60%)` };
    }
    case 'VERSE_TAIL_REPEAT': {
      const verses = verseSections(sections);
      const tails = verses.map(v => v.lines.filter(l => l.trim())).map(lines => lines[lines.length - 1]).filter((l): l is string => Boolean(l));
      if (tails.length < 2) return { violated: true, reasonKo: 'verse 끝줄을 2개 이상 비교할 수 없음' };
      const phrase = typeof params.phrase === 'string' ? params.phrase.toLowerCase() : undefined;
      if (phrase) {
        const allContain = tails.every(t => t.toLowerCase().includes(phrase));
        return allContain
          ? { violated: false, reasonKo: `모든 verse 끝줄이 "${phrase}"를 포함 — 이행됨` }
          : { violated: true, reasonKo: `일부 verse 끝줄이 "${phrase}"를 포함하지 않음` };
      }
      // params.phrase가 없으면(구형 응답 등) 대체 휴리스틱: verse 끝줄들이 유의어 수준이라도
      // 공통된 실질 단어를 공유하는지 본다 — 정확한 판정은 아니지만 "전혀 반복이 없다"는
      // 확실히 잡는다.
      const wordSets = tails.map(significantWords);
      const shared = [...wordSets[0]].filter(w => wordSets.every(ws => ws.has(w)));
      return shared.length > 0
        ? { violated: false, reasonKo: `verse 끝줄들이 공통 단어(${shared.join(', ')})를 공유 — 근사 이행` }
        : { violated: true, reasonKo: `params.phrase 없음 + verse 끝줄들이 공통 단어를 공유하지 않음 (근사 판정)` };
    }
    case 'WORD_ACCUMULATION': {
      const words = Array.isArray(params.words) ? (params.words as unknown as string[]) : undefined;
      const verses = verseSections(sections);
      if (!words || !words.length) return { violated: true, reasonKo: 'params.words 없음 — 검증 불가능한 구조로 응답함' };
      const countsPerVerse = verses.map(v => {
        const text = v.lines.join(' ').toLowerCase();
        return words.filter(w => text.includes(String(w).toLowerCase())).length;
      });
      const monotonic = countsPerVerse.every((c, i) => i === 0 || c >= countsPerVerse[i - 1]);
      const anyIncrease = countsPerVerse.some((c, i) => i > 0 && c > countsPerVerse[i - 1]);
      return monotonic && anyIncrease
        ? { violated: false, reasonKo: `절마다 어휘 누적 확인: ${countsPerVerse.join(' → ')}` }
        : { violated: true, reasonKo: `절마다 어휘가 누적되지 않음: ${countsPerVerse.join(' → ')}` };
    }
    case 'SCENE_PER_VERSE': {
      const verses = verseSections(sections);
      if (verses.length < 2) return { violated: true, reasonKo: 'verse가 2개 미만 — 장면 비교 불가' };
      const wordSets = verses.map(v => significantWords(v.lines.join(' ')));
      const inter = [...wordSets[0]].filter(w => wordSets[1].has(w)).length;
      const union = new Set([...wordSets[0], ...wordSets[1]]).size || 1;
      const similarity = inter / union;
      return similarity < 0.3
        ? { violated: false, reasonKo: `1·2절 어휘 유사도 ${Math.round(similarity * 100)}% — 장면이 바뀜` }
        : { violated: true, reasonKo: `1·2절 어휘 유사도 ${Math.round(similarity * 100)}% — 같은 장면 반복으로 보임` };
    }
    case 'HOOK_LAST_WORD_SHIFT': {
      const chorus = mainChorusSections(sections);
      const lastWords = chorus.map(c => c.lines.filter(l => l.trim())).map(lines => lines[lines.length - 1]?.trim().split(/\s+/).pop()?.toLowerCase()).filter(Boolean);
      if (lastWords.length < 2) return { violated: true, reasonKo: 'chorus가 2개 미만 — 마지막 단어 비교 불가' };
      const allSame = lastWords.every(w => w === lastWords[0]);
      return !allSame
        ? { violated: false, reasonKo: `후렴 마지막 단어가 반복마다 바뀜: ${lastWords.join(' / ')}` }
        : { violated: true, reasonKo: `후렴 마지막 단어가 매번 동일: "${lastWords[0]}"` };
    }
    case 'CALL_AND_RESPONSE': {
      const shortFragments = sections.filter(s => s.lines.filter(l => l.trim()).length > 0 && s.lines.filter(l => l.trim()).length <= 2);
      return shortFragments.length > 0
        ? { violated: false, reasonKo: `짧은 교환 구간(${shortFragments.length}개, ≤2줄) 존재 — 콜앤리스폰스 구조와 일치` }
        : { violated: true, reasonKo: '짧은 교환 구간(≤2줄)이 없음 — 일반적인 절 구조로 보임' };
    }
    case 'NO_INTRO': {
      const hasContradiction = /intro texture|short intro|instrumental intro/i.test(song.stylePrompt);
      return !hasContradiction
        ? { violated: false, reasonKo: 'stylePrompt에 인트로 존재를 암시하는 문구 없음' }
        : { violated: true, reasonKo: 'stylePrompt에 "intro texture"/"short intro" 등 인트로 존재를 암시하는 문구가 있음 — NO_INTRO와 자기모순' };
    }
    case 'KEY_LIFT': {
      const matches = song.stylePrompt.match(/key[\s-]?(lift|change|up)|modulat\w*/gi) ?? [];
      return matches.length === 1
        ? { violated: false, reasonKo: '전조 지시가 정확히 한 번 존재' }
        : { violated: true, reasonKo: `전조 지시가 ${matches.length}번 발견됨 (기대 정확히 1번)` };
    }
    case 'OCTAVE_DOWN_CHORUS': {
      const matches = song.stylePrompt.match(/octave[\s-]?(down|drop|lower)/gi) ?? [];
      return matches.length === 1
        ? { violated: false, reasonKo: '옥타브 하강 지시가 정확히 한 번 존재' }
        : { violated: true, reasonKo: `옥타브 하강 지시가 ${matches.length}번 발견됨 (기대 정확히 1번)` };
    }
    case 'MODE_SHIFT': {
      const hasShift = /minor[^.]{0,40}major|major[^.]{0,40}minor|mode shift|relative major/i.test(song.stylePrompt);
      return hasShift
        ? { violated: false, reasonKo: '조성 전환 지시 존재' }
        : { violated: true, reasonKo: 'stylePrompt에 단조→장조 전환을 암시하는 문구가 없음' };
    }
    case 'ARRANGEMENT_NUANCE':
    default:
      return { violated: false, reasonKo: '검증 불가 규칙' };
  }
}

/**
 * 지시문 15 (TASK B-2 안전 제약) — verified와 무관하게 항상 강제한다.
 * VOCAL_TOGETHER의 "같은 성별 안에서만"은 ruleId 하나로 표현되지 않아
 * sameGenderVocalOnly 플래그로 별도 전달받는다(K-pop 워크스페이스에서만
 * 호출자가 true로 넘긴다).
 */
function safetyViolationFor(ruleId: DistinctChoiceRuleId, sections: LyricsSection[], forbiddenRuleIds: DistinctChoiceRuleId[], sameGenderVocalOnly: boolean): string | undefined {
  if (forbiddenRuleIds.includes(ruleId)) {
    return `안전 제약 위반: ${DISTINCT_CHOICE_RULE_LABEL_KO[ruleId]}(${ruleId})은 이 워크스페이스에서 금지됨`;
  }
  if (ruleId === 'VOCAL_TOGETHER' && sameGenderVocalOnly) {
    // \b는 필수다 — 경계 없이 /male/i만 쓰면 "Female Vocal" 한 태그 자체가
    // "fe|male" 부분 문자열로 male도 female도 둘 다 매칭돼, 순수 여성 단독
    // 태그 하나만으로도 거짓 혼성 판정이 났다(지시문 15 TASK C 실증 중 발견).
    const mixed = [...verseSections(sections), ...mainChorusSections(sections)].some(s => s.vocalist && /\bmale\b/i.test(s.vocalist) && /\bfemale\b/i.test(s.vocalist));
    if (mixed) return '안전 제약 위반: VOCAL_TOGETHER가 혼성 보컬을 지시함 — 이 워크스페이스는 동일 성별 쿼터를 보존해야 함';
  }
  return undefined;
}

export function evaluateDistinctChoiceGate(
  songs: SongInput[],
  policy: DistinctChoicePolicy,
  opts: { safetyForbiddenRuleIds?: DistinctChoiceRuleId[]; sameGenderVocalOnly?: boolean } = {}
): DistinctChoiceGateResult {
  const forbidden = opts.safetyForbiddenRuleIds ?? [];
  const trackResults: DistinctChoiceTrackResult[] = songs.map(song => {
    if (!song.distinctChoiceRuleId) {
      return { trackNo: song.trackNo, status: song.distinctChoice ? 'not-measured' : 'missing', reasonKo: song.distinctChoice ? '구형 자유 문자열 응답 — ruleId 없음' : 'distinctChoice 없음' };
    }
    const ruleId = song.distinctChoiceRuleId;
    const verifiability = DISTINCT_CHOICE_VERIFIABILITY[ruleId];
    const sections = parseLyricsSections(song.lyrics);
    const safetyViolation = safetyViolationFor(ruleId, sections, forbidden, Boolean(opts.sameGenderVocalOnly));

    if (verifiability === 'not-measured') {
      return { trackNo: song.trackNo, ruleId, verifiability, status: 'not-measured', reasonKo: DISTINCT_CHOICE_RULE_LABEL_KO[ruleId], safetyViolation };
    }
    const { violated, reasonKo } = checkRule(ruleId, song, sections);
    return { trackNo: song.trackNo, ruleId, verifiability, status: violated ? 'violated' : 'compliant', reasonKo, safetyViolation };
  });

  const assignedCount = trackResults.filter(r => r.status !== 'missing').length;
  const compliantCount = trackResults.filter(r => r.status === 'compliant').length;
  const violatedCount = trackResults.filter(r => r.status === 'violated').length;
  const notMeasuredCount = trackResults.filter(r => r.status === 'not-measured').length;
  const missingCount = trackResults.filter(r => r.status === 'missing').length;
  const measured = compliantCount + violatedCount;
  // 지시문 32 (§3) — measured가 0이면 1도 0도 아닌 null. 분모 0을 1로
  // 대체하면 "측정 가능 곡 0개인데 이행률 100%"라는 거짓 보고가 된다.
  const complianceRate = measured > 0 ? compliantCount / measured : null;

  const safetyBlocking = trackResults.some(r => r.safetyViolation);
  const thresholdViolations: string[] = [];
  if (assignedCount < policy.minAssignedTracks) thresholdViolations.push(`assigned ${assignedCount} < 최소 ${policy.minAssignedTracks}`);
  if (measured > 0 && complianceRate !== null && complianceRate < policy.minComplianceRate) thresholdViolations.push(`이행률 ${Math.round(complianceRate * 100)}% < 최소 ${Math.round(policy.minComplianceRate * 100)}%`);
  if (notMeasuredCount > policy.maxNotMeasured) thresholdViolations.push(`not-measured ${notMeasuredCount} > 상한 ${policy.maxNotMeasured}`);
  const thresholdBlocking = policy.verified && thresholdViolations.length > 0;

  return {
    trackResults,
    assignedCount,
    compliantCount,
    violatedCount,
    notMeasuredCount,
    missingCount,
    complianceRate,
    policy,
    verified: policy.verified,
    thresholdBlocking,
    safetyBlocking,
    ...(thresholdViolations.length ? { thresholdReasonKo: thresholdViolations.join('; ') } : {})
  };
}
