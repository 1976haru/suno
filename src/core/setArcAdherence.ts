import type { SongIdea, WorkspaceId } from '../types';
import { SEASON_ARC_VOCAB, TIME_OF_DAY_ARC_VOCAB, type SetArcVocabEntry } from '../data/setArcLexicon';
import { extractEraConstraint } from './constraints';

/**
 * 지시문 29 (TASK B) — 실측: 컨셉 "Autumn to Christmas Playlist Pack"이
 * 크리스마스 어휘 0곡·늦여름 4곡으로 나왔다. 감사의 "약속 이행도 0%"는
 * 정확했지만 advisory라 생성이 그대로 진행됐다 — 이 모듈은 "컨셉이 A→B
 * 진행을 명시했을 때 18곡이 실제로 그렇게 흐르는가"를 판정한다.
 */
export type SetArcKind = 'season' | 'time-of-day' | 'era' | 'none';

export interface SetArcSpec {
  kind: SetArcKind;
  from: string;
  to: string;
  /** 컨셉 텍스트에서 파싱한 근거 — UI/보고에 그대로 노출해도 되는 설명. */
  sourceKo: string;
}

const ARC_POOLS: { kind: Exclude<SetArcKind, 'none' | 'era'>; pool: Record<string, SetArcVocabEntry> }[] = [
  { kind: 'season', pool: SEASON_ARC_VOCAB },
  { kind: 'time-of-day', pool: TIME_OF_DAY_ARC_VOCAB }
];

function findInPool(pool: Record<string, SetArcVocabEntry>, phrase: string): SetArcVocabEntry | undefined {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) return undefined;
  return Object.values(pool).find(entry => entry.keywords.some(k => normalized.includes(k.toLowerCase())));
}

/**
 * "A to B"(영문) / "A에서 B로"·"A부터 B까지"(한글) 패턴을 찾아 두 조각으로
 * 쪼갠다. 매치가 없으면 undefined — 억지로 아무 텍스트나 쪼개지 않는다.
 */
function splitArcPhrase(freeText: string): [string, string] | undefined {
  const enMatch = freeText.match(/\b([A-Za-z][A-Za-z\s]*?)\s+to\s+([A-Za-z][A-Za-z\s]*?)(?:\s+(?:playlist|pack|mix|set|list)\b.*)?$/i);
  if (enMatch && enMatch[1].trim() && enMatch[2].trim()) return [enMatch[1].trim(), enMatch[2].trim()];
  const koMatch = freeText.match(/([가-힣]+)\s*(?:에서|부터)\s*([가-힣]+)\s*(?:로|까지)/);
  if (koMatch) return [koMatch[1].trim(), koMatch[2].trim()];
  return undefined;
}

/**
 * 컨셉 자유 텍스트에서 "시간·계절 진행" 명시를 찾는다. season/time-of-day는
 * data/setArcLexicon.ts 어휘 매칭, era는 core/constraints.ts의 기존 명시-연대
 * 검출(지시문 29 TASK E가 방금 정리한 "숫자로 못박은 연대"만)을 재사용한다 —
 * 새 연대 파서를 만들지 않는다. 못 찾으면 undefined — 억지로 아크가 있다고
 * 지어내지 않는다.
 */
export function parseSetArcSpec(freeText: string): SetArcSpec | undefined {
  const text = String(freeText || '');
  if (!text.trim()) return undefined;

  const halves = splitArcPhrase(text);
  if (halves) {
    const [fromPhrase, toPhrase] = halves;
    for (const { kind, pool } of ARC_POOLS) {
      const fromEntry = findInPool(pool, fromPhrase);
      const toEntry = findInPool(pool, toPhrase);
      if (fromEntry && toEntry && fromEntry.id !== toEntry.id) {
        return { kind, from: fromEntry.id, to: toEntry.id, sourceKo: `"${fromPhrase} → ${toPhrase}" (${kind === 'season' ? '계절' : '시간대'} 진행)` };
      }
    }
  }

  // era: "60년대 → 70년대"류 — core/constraints.ts가 이미 두 연대를 co-primary로
  // 판정했다면(지시문 29 TASK E가 정리한 명시-연대 로직) 그 순서를 아크로 본다.
  const era = extractEraConstraint(text);
  if (era.coPrimary) {
    return { kind: 'era', from: era.primary, to: era.coPrimary, sourceKo: `"${text.trim()}" 안의 두 연대 명시 (${era.primary} → ${era.coPrimary})` };
  }

  return undefined;
}

export interface SetArcFinding {
  trackNo: number;
  kind: 'missing-from' | 'missing-to';
  detailKo: string;
}

export interface SetArcAdherenceResult {
  adherence: number;
  findings: SetArcFinding[];
}

const EDGE_WINDOW = 3; // "1~3곡", "16~18곡" — 정책값(추정, §B-2 원문 그대로)

function songText(song: SongIdea): string {
  return [song.seasonMoment, song.lyricThemeText, song.lyrics, song.title].filter(Boolean).join(' ').toLowerCase();
}

function hasVocab(text: string, entryId: string, pool: Record<string, SetArcVocabEntry>): boolean {
  const entry = pool[entryId];
  if (!entry) return false;
  return entry.keywords.some(k => text.includes(k.toLowerCase()));
}

/**
 * 판정(§B-2): 1~3번 트랙에 from 어휘가 있는가, 16~18번 트랙(마지막 EDGE_WINDOW)에
 * to 어휘가 있는가, 전체적으로 from→to 단조 진행인가(트랙 번호가 늦을수록
 * to 어휘 등장 비율이 from 어휘 등장 비율보다 높아지는가를 4구간으로 나눠
 * 대략 확인). era kind는 season/time-of-day 어휘집이 없으므로 core/
 * constraints.ts의 eraBucketForGenreId로 genreId를 직접 본다.
 */
export function checkSetArcAdherence(songs: SongIdea[], spec: SetArcSpec): SetArcAdherenceResult {
  if (!songs.length) return { adherence: 0, findings: [] };
  const ordered = [...songs].sort((a, b) => a.trackNo - b.trackNo);
  const findings: SetArcFinding[] = [];

  const pool = spec.kind === 'season' ? SEASON_ARC_VOCAB : spec.kind === 'time-of-day' ? TIME_OF_DAY_ARC_VOCAB : undefined;

  const matchesFrom = (song: SongIdea): boolean =>
    pool ? hasVocab(songText(song), spec.from, pool) : (song.genreId ?? '').includes(spec.from.replace(/s$/, ''));
  const matchesTo = (song: SongIdea): boolean =>
    pool ? hasVocab(songText(song), spec.to, pool) : (song.genreId ?? '').includes(spec.to.replace(/s$/, ''));

  const openingTracks = ordered.slice(0, Math.min(EDGE_WINDOW, ordered.length));
  const closingTracks = ordered.slice(Math.max(0, ordered.length - EDGE_WINDOW));

  let openingHasFrom = false;
  for (const song of openingTracks) if (matchesFrom(song)) openingHasFrom = true;
  if (!openingHasFrom) {
    findings.push({ trackNo: openingTracks[0]?.trackNo ?? 1, kind: 'missing-from', detailKo: `1~${openingTracks.length}번 트랙 어디에도 "${spec.from}" 어휘가 없음` });
  }

  let closingHasTo = false;
  for (const song of closingTracks) if (matchesTo(song)) closingHasTo = true;
  if (!closingHasTo) {
    findings.push({ trackNo: closingTracks[0]?.trackNo ?? ordered.length, kind: 'missing-to', detailKo: `마지막 ${closingTracks.length}곡 어디에도 "${spec.to}" 어휘가 없음` });
  }

  // 단조 진행 점수: 트랙을 4등분해 각 구간의 "to 어휘 비율 - from 어휘 비율"이
  // 뒤로 갈수록 커지는지 본다. 완전한 단조는 아니어도 대체로 늘어나면 인정한다.
  const quarters = 4;
  const quarterSize = Math.max(1, Math.ceil(ordered.length / quarters));
  const quarterScores: number[] = [];
  for (let i = 0; i < quarters; i++) {
    const chunk = ordered.slice(i * quarterSize, (i + 1) * quarterSize);
    if (!chunk.length) continue;
    const fromCount = chunk.filter(matchesFrom).length;
    const toCount = chunk.filter(matchesTo).length;
    quarterScores.push(toCount - fromCount);
  }
  let monotonicPairs = 0;
  let totalPairs = 0;
  for (let i = 1; i < quarterScores.length; i++) {
    totalPairs += 1;
    if (quarterScores[i] >= quarterScores[i - 1]) monotonicPairs += 1;
  }
  const monotonicRatio = totalPairs ? monotonicPairs / totalPairs : 1;

  // adherence: 시작 어휘(가중치 0.35) + 종료 어휘(0.35) + 단조 진행(0.3)
  const adherence = (openingHasFrom ? 0.35 : 0) + (closingHasTo ? 0.35 : 0) + monotonicRatio * 0.3;

  return { adherence, findings };
}

export const SET_ARC_ADHERENCE_BLOCKING_THRESHOLD = 0.5; // 정책값(추정) — §B-2 원문 "adherence < 50% → blocking" 그대로. 청취 검증 안 됨.

/**
 * 지시문 29 (TASK B-2) — "adherence < 50% → blocking (senior-oldpop만 ·
 * verified: true), 나머지 워크스페이스는 advisory (verified: false)". 이
 * 프로젝트의 기존 관례(data/distinctChoicePolicy.ts, data/objectStatePolicy.ts
 * 등)와 동일하게 "실전 검증된 워크스페이스에만 차단 권한을 준다"를 따른다 —
 * senior-oldpop 외 6개 워크스페이스는 이 검사 자체가 실측 없이 만든 어휘집
 * 기반이라 blocking하면 §하지 말 것 "verified: false인 값으로 세트를
 * 차단하지 말 것"을 어긴다.
 */
const SET_ARC_VERIFIED_WORKSPACES: ReadonlySet<WorkspaceId> = new Set<WorkspaceId>(['senior-oldpop']);

export function setArcAdherenceIsBlocking(workspaceId: WorkspaceId | undefined): boolean {
  return Boolean(workspaceId && SET_ARC_VERIFIED_WORKSPACES.has(workspaceId));
}
