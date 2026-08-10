/**
 * 지시문 28 (TASK A) — "아키타입별로 정의되어야 하는데 일부만 정의된" 데이터를
 * check:gates(지시문 27 TASK D-2, checkGateContract.ts's checkArchetypeDataCompleteness)
 * 보다 훨씬 넓은 축으로 전수 검사한다. 지시문 15의 check:archetype이 "하드코딩이
 * 있는 곳"을 세는 것의 반대 방향 — 이건 "정의가 빠진 곳"을 센다.
 *
 * 27 TASK D-2는 5개 축(moneyChordRotationPool/signatureMoneyChordId/arcModelId/
 * introTexturePool/killingPointPool·vocalPresetPool)만 봤다. 이 스크립트는 그
 * 결과를 출발점으로 삼되(§0-2), 지시문 28이 명시한 19개 축 전부를 본다 — 낡은
 * checkArchetypeDataCompleteness()는 이 스크립트로 대체되었으므로
 * checkGateContract.ts에서 제거했다(§규약 5 "낡은 경로를 남긴 채 새 경로를
 * 추가하지 않는다").
 *
 * 판정 기준(§A-4):
 *   ✗ 미정의    — 해당 축에 값이 없거나 기본값/폴백으로 조용히 대체됨 → CONTRACT VIOLATION
 *   ⚠ 편차 경고 — 정의는 있으나 검증되지 않았거나(advisory-only) 폭이 3배 이상 → 차단하지 않음
 *   ○ 정의됨    — 아키타입 전용 실측/설계값이 있음
 *   N/A        — 이 축 자체가 아키타입 단위로 설계되지 않음(구조적으로 무관) — 결함이 아니라 사실 기록
 *
 * 편차를 자동으로 균등화하지 않는다 — 동요와 시니어의 장르 수가 같아야 할
 * 이유가 없다. ⚠/편차는 목록으로 보여주고 하루가 판단한다(§하지 말 것).
 *
 * Usage: npx tsx scripts/checkArchetypeCoverage.ts
 */
import { channelPresets } from '../src/data/presets';
import { getGenreById } from '../src/data/genreLibrary';
import { moneyChordRotationPool, signatureMoneyChordId } from '../src/data/moneyChords';
import { AUDIENCE_PROFILE_ID_BY_ARCHETYPE } from '../src/data/archetypeAudienceProfiles';
import { audienceProfileById, tempoBandsForProfile } from '../src/data/audienceProfiles';
import { introTextures, introTexturesForArchetype } from '../src/data/introTextures';
import { adultLyricThemes, kidsLyricThemes, lyricThemesForOptions } from '../src/data/lyricThemes';
import { OPENING_HOOKS } from '../src/data/openingHooks';
import { paletteFamilyForGenreId } from '../src/data/paletteFamilies';
import { MOTIF_FAMILIES } from '../src/data/motifFamilies';
import { channelSoundFloorForArchetype } from '../src/data/channelSoundFloor';
import { workspaceForArchetype, workspaceDefinitions } from '../src/data/workspaces';
import { distinctChoicePolicyForWorkspace } from '../src/data/distinctChoicePolicy';
import { promotionEligibility, type MeasuredSongLedger } from '../src/core/measuredSongLedger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promptAxisPolicyFor } from '../src/data/promptAxisPolicy';
import { objectStatePolicyForWorkspace } from '../src/data/objectStatePolicy';
import { eraIntentForWorkspace } from '../src/data/workspaceEraIntent';
import { LISTENING_INTENT_POLICY } from '../src/data/listeningIntentPolicy';
import { isKidsArchetype } from '../src/utils/channelArchetype';
import type { ChannelArchetype } from '../src/types';

// 13개 정본 아키타입 — 지시문 27 TASK D-1의 CANONICAL_ARCHETYPES_FOR_MONEY_CHORD와
// 동일한 목록(christmas/kr-kids-song/jp-kids-song은 별도 실측 대상이라 제외).
const CANONICAL_ARCHETYPES: ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'showa-70s', 'j2000s', 'modern-chill', 'city-night',
  'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'lofi-study', 'kids'
];

const COL_LABEL: Record<ChannelArchetype, string> = {
  'senior-morning': 'srMorn', 'showa-cafe': 'showaC', 'showa-70s': 'showa7', j2000s: 'j2000s',
  'modern-chill': 'chill', 'city-night': 'cityNt', 'oldpop-lounge': 'oldpop', 'kr-2030-pop': 'kr2030',
  'jp-2030-pop': 'jp2030', 'kr-idol-male': 'idolM', 'kr-idol-female': 'idolF', 'lofi-study': 'lofi',
  kids: 'kids'
} as Record<ChannelArchetype, string>;

type Status = '✗' | '⚠' | '○' | 'N/A';
interface Cell { value: string; status: Status; }
interface AxisRow { label: string; cells: Partial<Record<ChannelArchetype, Cell>>; noteLines: string[]; }

const rows: AxisRow[] = [];
let violationCount = 0;
let advisoryCount = 0;

function pushRow(row: AxisRow) {
  for (const a of CANONICAL_ARCHETYPES) {
    const cell = row.cells[a];
    if (!cell) continue;
    if (cell.status === '✗') violationCount += 1;
    if (cell.status === '⚠') advisoryCount += 1;
  }
  rows.push(row);
}

function preferredGenrePool(a: ChannelArchetype): Set<string> {
  const ids = channelPresets.filter(c => c.archetype === a).flatMap(c => c.preferredGenres);
  return new Set(ids);
}

// ---------------------------------------------------------------------------
// 축 1 — preferredGenres (채널별 preferredGenres의 아키타입 합집합)
// ---------------------------------------------------------------------------
function axisPreferredGenres(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  const counts: number[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const pool = preferredGenrePool(a);
    counts.push(pool.size);
    cells[a] = { value: String(pool.size), status: pool.size === 0 ? '✗' : '○' };
    if (pool.size === 0) notes.push(`${a}: 프리셋 채널이 없어 장르 풀 자체가 0 — 커스텀 채널 생성 시 사용자가 직접 채워야 한다`);
  }
  const max = Math.max(...counts);
  const min = Math.min(...counts.filter(c => c > 0));
  if (max >= min * 3) notes.push(`편차 — 최대 ${max}종 vs 최소 ${min}종 (${(max / min).toFixed(1)}배). 지시문 20이 손댄 senior-morning/oldpop-lounge만 24~29종, 나머지는 3~22종.`);
  return { label: 'preferredGenres (채널 합집합)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 2 — lyricTheme 후보 (lyricThemesForOptions 실제 반환 개수, 폴백 포함)
//         + 폴백 이전 순수 archetype-suited 개수(참고)
// ---------------------------------------------------------------------------
function rawSuitedLyricThemeCount(a: ChannelArchetype): number {
  const source = isKidsArchetype(a) ? kidsLyricThemes : adultLyricThemes;
  return source.filter(t => t.suitedArchetypes?.includes(a)).length;
}

function axisLyricTheme(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  const counts: number[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const opts = { channel: { archetype: a, preferredMoods: [] } as any, customLyricThemeScene: undefined, lyricLanguage: undefined, customConcept: undefined };
    const effective = lyricThemesForOptions(opts).length;
    const raw = rawSuitedLyricThemeCount(a);
    counts.push(effective);
    const fellBack = raw < 12;
    cells[a] = { value: `${effective}${fellBack ? `(원본${raw})` : ''}`, status: effective === 0 ? '✗' : fellBack ? '⚠' : '○' };
    if (fellBack) notes.push(`${a}: 아키타입 전용 테마 ${raw}개 < 12 → 전체 풀(${effective}개)로 폴백 — lyricThemesForArchetype의 방어 로직`);
  }
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  if (max >= min * 3) notes.push(`편차 — 최대 ${max}개 vs 최소 ${min}개 (${(max / min).toFixed(1)}배).`);
  return { label: 'lyricTheme 후보 (실효/원본)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 3/4 — moneyChordRotationPool · signatureMoneyChordId (지시문 27 재확인)
// ---------------------------------------------------------------------------
function axisMoneyChordPool(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const pool = moneyChordRotationPool(a);
    cells[a] = { value: String(pool.length), status: pool.length >= 2 ? '○' : '✗' };
    if (pool.length < 2) notes.push(`${a}: 회전 풀 ${pool.length}종 — 18곡 전부 같은 화성이 된다 (지시문 27 이전 상태로 회귀)`);
  }
  return { label: 'moneyChordRotationPool', cells, noteLines: notes };
}

function axisSignatureMoneyChord(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const pool = moneyChordRotationPool(a);
    const sig = signatureMoneyChordId(a);
    const inPool = pool.includes(sig);
    const isGenericDefault = sig === 'default' && a !== 'kr-2030-pop';
    let status: Status = '○';
    if (!inPool) status = '✗';
    else if (isGenericDefault) status = '⚠';
    cells[a] = { value: sig, status };
    if (!inPool) notes.push(`${a}: 시그니처(${sig})가 자기 회전 풀에 없음`);
    if (isGenericDefault) notes.push(`${a}: 시그니처가 범용 'default' — 아키타입 전용 진행이 지정되지 않음`);
  }
  return { label: 'signatureMoneyChordId', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 5 — introTexture 풀 (폴백 이전 순수 suitedArchetypes 매칭 개수)
// ---------------------------------------------------------------------------
function axisIntroTexture(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const raw = introTextures.filter(t => t.suitedArchetypes?.includes(a)).length;
    const effective = introTexturesForArchetype(a).length;
    cells[a] = { value: `${raw}(전체${effective})`, status: raw === 0 ? '✗' : raw < 10 ? '⚠' : '○' };
    if (raw === 0) notes.push(`${a}: 전용 인트로 텍스처 0개 — 10개 미만 매칭 시 전체 풀(${effective}개)로 폴백해 표면적으로는 드러나지 않는다`);
    else if (raw < 10) notes.push(`${a}: 전용 인트로 텍스처 ${raw}개 (< 10, 폴백 임계선 아래)`);
  }
  return { label: 'introTexture 풀 (전용/전체폴백)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 6 — openingHooks (팔레트 계열이 적용되는 아키타입에서만 의미 있음)
// ---------------------------------------------------------------------------
function axisOpeningHooks(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const floor = channelSoundFloorForArchetype(a);
    if (!floor?.usesPaletteFamily) {
      cells[a] = { value: '—', status: 'N/A' };
      continue;
    }
    const genres = preferredGenrePool(a);
    const familyIds = new Set([...genres].map(g => paletteFamilyForGenreId(g)?.id).filter((id): id is string => Boolean(id)));
    const reachable = OPENING_HOOKS.filter(h => h.fitsFamilies.some(f => familyIds.has(f)));
    cells[a] = { value: String(reachable.length), status: reachable.length === 0 ? '✗' : '○' };
    if (reachable.length === 0) notes.push(`${a}: usesPaletteFamily=true인데 도달 가능한 openingHooks가 0개 — 등록된 PaletteFamily가 없음`);
  }
  notes.push('N/A — usesPaletteFamily=false인 아키타입(kr-2030-pop/jp-2030-pop/kr-idol-male/kr-idol-female): openingHooks는 팔레트 계열로만 매칭되므로 이 축 대상이 아니다(설계상 의도, §channelSoundFloor.ts).');
  return { label: 'openingHooks (팔레트 계열 매칭)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 7 — vocalPreset 풀 — N/A (suitedArchetypes는 추천 힌트일 뿐, 생성을 막지 않음)
// ---------------------------------------------------------------------------
function axisVocalPreset(): AxisRow {
  const cells: AxisRow['cells'] = {};
  for (const a of CANONICAL_ARCHETYPES) cells[a] = { value: '—', status: 'N/A' };
  return {
    label: 'vocalPreset 풀',
    cells,
    noteLines: ['N/A — vocalPresets.ts의 suitedArchetypes는 UI 정렬 힌트일 뿐(파일 자체 doc comment), matchVocalPreset은 자유 텍스트 매칭이라 아키타입별 필수 풀이라는 개념이 없다.']
  };
}

// ---------------------------------------------------------------------------
// 축 8 — killingPoint 풀 — N/A (kids/비-kids 이진 분기, 아키타입별이 아님)
// ---------------------------------------------------------------------------
function axisKillingPoint(): AxisRow {
  const cells: AxisRow['cells'] = {};
  for (const a of CANONICAL_ARCHETYPES) cells[a] = { value: isKidsArchetype(a) ? 'kids세트' : '공통세트', status: 'N/A' };
  return {
    label: 'killingPoint 풀',
    cells,
    noteLines: ['N/A — assignKillingPoints는 kids/비-kids 이진 분기로 세트를 고르고, 그 안에서는 era 텍스트 매칭(fitsEraTags)으로 필터링한다. "아키타입별 정의"라는 틀 자체가 안 맞는다.']
  };
}

// ---------------------------------------------------------------------------
// 축 9 — PaletteFamily 등록 여부
// ---------------------------------------------------------------------------
function axisPaletteFamily(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const floor = channelSoundFloorForArchetype(a);
    if (!floor?.usesPaletteFamily) {
      cells[a] = { value: '—', status: 'N/A' };
      continue;
    }
    const genres = [...preferredGenrePool(a)];
    const unregistered = genres.filter(g => !paletteFamilyForGenreId(g));
    cells[a] = { value: `${genres.length - unregistered.length}/${genres.length}`, status: unregistered.length > 0 ? '✗' : '○' };
    if (unregistered.length > 0) notes.push(`${a}: 미등록 장르 ${unregistered.length}개 — ${unregistered.join(', ')} (showa-seventies 결함과 같은 유형 — 이 장르만 든 세트는 18곡 전부 한 장르로 좁혀질 수 있다)`);
  }
  return { label: 'PaletteFamily 등록 (등록/전체 장르)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 10 — motifFamily 등록 (워크스페이스 스코프 적용 개수/전체)
// ---------------------------------------------------------------------------
function axisMotifFamily(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  const total = MOTIF_FAMILIES.length;
  for (const a of CANONICAL_ARCHETYPES) {
    const workspaceId = workspaceForArchetype(a)?.id;
    const applicable = MOTIF_FAMILIES.filter(f => !f.workspaces || (workspaceId && f.workspaces.includes(workspaceId)));
    cells[a] = { value: `${applicable.length}/${total}`, status: '○' };
  }
  notes.push('전부 ○ — 6개는 전 워크스페이스 공용, 2개(performance-stage/kids-interactive)는 워크스페이스 스코프. 정본 13개 중 kids(senior-oldpop 워크스페이스)는 kids-interactive(kr-kids/jp-kids 전용) 대상이 아니라 6/8만 적용됨 — 결함이 아니라 설계.');
  notes.push('실측하지 못한 것: 개별 lyricTheme의 frameId가 실제로 이 8개 family 중 하나에 매핑되는지(아키타입별 커버율)는 이 스크립트 범위 밖 — frameId 전수 대조가 필요하면 별도 축으로 분리할 것.');
  return { label: 'motifFamily 등록 (적용/전체 8종)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 11 — arcModelId
// ---------------------------------------------------------------------------
function axisArcModel(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const profileId = AUDIENCE_PROFILE_ID_BY_ARCHETYPE[a];
    const arcModelId = audienceProfileById(profileId)?.arcModelId;
    cells[a] = { value: arcModelId ?? '—', status: arcModelId ? '○' : '✗' };
    if (!arcModelId) notes.push(`${a}: audienceProfile(${profileId})에 arcModelId가 없음`);
  }
  notes.push('Record<ChannelArchetype,string> 타입이 AUDIENCE_PROFILE_ID_BY_ARCHETYPE의 16개 키를 강제하므로 구조적으로 13/13 완비.');
  return { label: 'arcModelId (audienceProfile 경유)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 12 — audienceProfile: 전용 vs general 폴백
// ---------------------------------------------------------------------------
function axisAudienceProfile(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const profileId = AUDIENCE_PROFILE_ID_BY_ARCHETYPE[a];
    const isGeneralFallback = profileId === 'general';
    cells[a] = { value: profileId, status: isGeneralFallback ? '⚠' : '○' };
    if (isGeneralFallback) notes.push(`${a}: 전용 오디언스 프로필 없음 — GENERAL_AUDIENCE_PROFILE(twenties/thirtiesForties/general 공용, 청취 미보정)로 폴백`);
  }
  return { label: 'audienceProfile (전용/general 폴백)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 13/14 — tempoCeiling·BPM 대역
// ---------------------------------------------------------------------------
function axisTempo(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const profileId = AUDIENCE_PROFILE_ID_BY_ARCHETYPE[a];
    const profile = audienceProfileById(profileId);
    if (!profile) { cells[a] = { value: '—', status: '✗' }; continue; }
    const bands = tempoBandsForProfile(profile);
    const handTuned = profile.id === 'senior';
    cells[a] = { value: `${profile.tempoFloor}-${profile.tempoCeiling}(${bands.length}대역)`, status: handTuned ? '○' : '⚠' };
    if (!handTuned) notes.push(`${a}: BPM 대역이 청취 검증된 senior 전용 분포가 아니라 [${profile.tempoFloor},${profile.tempoCeiling}]을 ${bands.length}등분한 자동 생성 대역`);
  }
  return { label: 'tempoCeiling·BPM 대역', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 15 — vocalQuotaOverride
// ---------------------------------------------------------------------------
function axisVocalQuota(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const channels = channelPresets.filter(c => c.archetype === a);
    const withOverride = channels.filter(c => c.vocalQuotaOverride);
    if (channels.length === 0) { cells[a] = { value: '—', status: 'N/A' }; continue; }
    if (withOverride.length === 0) { cells[a] = { value: '기본 6/6/6', status: '○' }; continue; }
    const q = withOverride[0].vocalQuotaOverride!;
    cells[a] = { value: `${q.male}/${q.female}/${q.mixed}`, status: '○' };
  }
  notes.push('전부 ○ — override가 없으면 DEFAULT_ADULT_VOCAL_QUOTA(6/6/6)로 명시적 폴백(core/vocalPlan.ts), 조용한 미정의가 아니다. kr-idol-male/female만 성비 쿼터를 의도적으로 override.');
  return { label: 'vocalQuotaOverride', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 16 — eraIntent 적용 여부 (워크스페이스 단위)
// ---------------------------------------------------------------------------
function axisEraIntent(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const workspaceId = workspaceForArchetype(a)?.id;
    if (!workspaceId) { cells[a] = { value: '—', status: '✗' }; continue; }
    const intent = eraIntentForWorkspace(workspaceId);
    cells[a] = { value: intent.mode, status: '○' };
  }
  notes.push('전부 ○ — WORKSPACE_ERA_INTENT는 7개 워크스페이스 전부 정의(Record 타입 강제). 단, 아키타입 단위 세분화는 없다 — 같은 워크스페이스를 공유하는 아키타입은 전부 같은 mode를 받는다(예: senior-oldpop 소속 10개 아키타입 전부 strict-decade).');
  return { label: 'eraIntent 모드 (워크스페이스 단위)', cells, noteLines: notes };
}

// ---------------------------------------------------------------------------
// 축 17/19/20 — DistinctChoicePolicy · PromptAxisPolicy · ObjectState (워크스페이스 verified 여부)
// ---------------------------------------------------------------------------
function axisDistinctChoice(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const workspaceId = workspaceForArchetype(a)?.id;
    if (!workspaceId) { cells[a] = { value: '—', status: '✗' }; continue; }
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    cells[a] = { value: policy.verified ? 'verified' : 'advisory', status: policy.verified ? '○' : '⚠' };
    if (!policy.verified) notes.push(`${a}(${workspaceId}): ${policy.sourceKo}`);
  }
  return { label: 'DistinctChoicePolicy (지시문15)', cells, noteLines: dedupe(notes) };
}

function axisPromptAxis(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const workspaceId = workspaceForArchetype(a)?.id;
    if (!workspaceId) { cells[a] = { value: '—', status: '✗' }; continue; }
    const policy = promptAxisPolicyFor(workspaceId);
    cells[a] = { value: policy.verified ? 'verified' : 'advisory', status: policy.verified ? '○' : '⚠' };
    if (!policy.verified) notes.push(`${a}(${workspaceId}): ${policy.sourceKo}`);
  }
  return { label: 'PromptAxisPolicy (지시문16)', cells, noteLines: dedupe(notes) };
}

function axisObjectState(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const workspaceId = workspaceForArchetype(a)?.id;
    if (!workspaceId) { cells[a] = { value: '—', status: '✗' }; continue; }
    const policy = objectStatePolicyForWorkspace(workspaceId);
    if (policy.kinds.length === 0) { cells[a] = { value: '적용없음', status: 'N/A' }; continue; }
    const status: Status = policy.verifiedKinds.length > 0 ? '○' : '⚠';
    cells[a] = { value: `${policy.verifiedKinds.length}/${policy.kinds.length} 검증`, status };
    if (status === '⚠') notes.push(`${a}(${workspaceId}): kind ${policy.kinds.join(',')} 정의됐으나 실측(verifiedKinds) 0개 — ${policy.sourceKo}`);
  }
  return { label: 'ObjectState 적용 kind (지시문17)', cells, noteLines: dedupe(notes) };
}

// ---------------------------------------------------------------------------
// 축 18 — ListeningIntentPolicy — N/A (ListeningIntent별 정책, 아키타입/워크스페이스와 무관)
// ---------------------------------------------------------------------------
function axisListeningIntent(): AxisRow {
  const cells: AxisRow['cells'] = {};
  for (const a of CANONICAL_ARCHETYPES) cells[a] = { value: '—', status: 'N/A' };
  const intents = Object.values(LISTENING_INTENT_POLICY);
  return {
    label: 'ListeningIntentPolicy (지시문23)',
    cells,
    noteLines: [`N/A — LISTENING_INTENT_POLICY는 ListeningIntent 3종(${intents.map(i => i.intent).join(', ')}) 전부 정의(verified:false 3/3)되어 있으나, 키가 아키타입도 워크스페이스도 아니라 이 매트릭스에 직접 대응하지 않는다.`]
  };
}

// ---------------------------------------------------------------------------
// 축 21 — eraBuckets 커버율 (채널 preferredGenres 중 era-neutral이 아닌 비율)
// ---------------------------------------------------------------------------
function axisEraBuckets(): AxisRow {
  const cells: AxisRow['cells'] = {};
  const notes: string[] = [];
  for (const a of CANONICAL_ARCHETYPES) {
    const genres = [...preferredGenrePool(a)];
    if (genres.length === 0) { cells[a] = { value: '—', status: 'N/A' }; continue; }
    const withEraColor = genres.filter(g => {
      const buckets = getGenreById(g)?.eraBuckets;
      return buckets && !(buckets.length === 1 && buckets[0] === 'era-neutral');
    });
    const ratio = Math.round((withEraColor.length / genres.length) * 100);
    cells[a] = { value: `${ratio}% (${withEraColor.length}/${genres.length})`, status: '○' };
  }
  notes.push('정보성 — era-neutral 비율이 높다고 결함은 아니다(kr-2030/kr-idol처럼 의도적으로 시대색을 주장하지 않는 아키타입이 있다). 시대색을 주장해야 하는데 낮은 경우만 하루가 판단할 문제.');
  return { label: 'eraBuckets 커버율 (시대색 비-neutral 비율)', cells, noteLines: notes };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ---------------------------------------------------------------------------
// 출력
// ---------------------------------------------------------------------------
// Korean 전각 문자가 터미널에서 2칸을 차지해 padStart/padEnd(코드 유닛 기준)로는
// 열이 절대 정렬되지 않는다 — 정렬을 포기하고 " | " 구분자로 각 셀의 경계를
// 명확히 하는 쪽을 택한다(§규약 8 "원문 그대로" — 표가 예쁜 것보다 각 셀이
// 어느 아키타입 것인지 명확한 것이 우선).
function printTable() {
  for (const row of rows) {
    console.log(`\n■ ${row.label}`);
    const line = CANONICAL_ARCHETYPES.map(a => {
      const cell = row.cells[a];
      if (!cell) return `${COL_LABEL[a]}=—`;
      return `${COL_LABEL[a]}=${cell.value}${cell.status === '✗' || cell.status === '⚠' ? cell.status : ''}`;
    }).join(' | ');
    console.log(`  ${line}`);
  }
}

// 지시문 32 (§4) — scripts/audit.ts --pack이 누적한 실측 곡 수를 여기서
// 노출한다. 이게 "UI"다 — 이 앱은 아직 verified 토글을 웹 UI에 두지 않고
// data/distinctChoicePolicy.ts를 지시문에서 손으로 고치는 방식이므로,
// 하루가 실제로 정기적으로 보는 이 CLI 출력이 승격 판단을 위한 진짜
// 알림 표면이다. 절대 여기서 verified를 바꾸지 않는다 — 조건 충족을
// "표시"만 한다(§ "하지 말 것": 자동 승격 금지).
const MEASURED_SONG_LEDGER_PATH = path.resolve(process.cwd(), 'measured-song-counts.json');

function loadMeasuredSongLedger(): MeasuredSongLedger {
  if (!fs.existsSync(MEASURED_SONG_LEDGER_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(MEASURED_SONG_LEDGER_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function printMeasuredSongLedger() {
  console.log('\n\n측정 곡 수 누적 (지시문 32 §4, scripts/audit.ts --pack 실행마다 누적) ────');
  const ledger = loadMeasuredSongLedger();
  for (const workspace of workspaceDefinitions) {
    const policy = distinctChoicePolicyForWorkspace(workspace.id);
    const entry = ledger[workspace.id];
    const { measuredSongs, eligible } = promotionEligibility(entry, policy.promoteAfterMeasuredSongs);
    const setCount = entry?.setCount ?? 0;
    if (policy.verified) {
      console.log(`  ${workspace.id.padEnd(16)} 측정 ${measuredSongs}곡 (${setCount}세트) — 이미 verified`);
      continue;
    }
    const statusKo = eligible
      ? `⚠ 승격 조건 충족(≥${policy.promoteAfterMeasuredSongs}곡) — 하루 승인 시 distinctChoicePolicy.ts에서 verified:true로 직접 전환 (자동 승격 아님)`
      : `미달 (기준 ${policy.promoteAfterMeasuredSongs}곡)`;
    console.log(`  ${workspace.id.padEnd(16)} 측정 ${measuredSongs}곡 (${setCount}세트) — ${statusKo}`);
  }
}

function main() {
  console.log(`[check:coverage] ${CANONICAL_ARCHETYPES.length} 아키타입 × ${21} 축\n`);

  pushRow(axisPreferredGenres());
  pushRow(axisLyricTheme());
  pushRow(axisMoneyChordPool());
  pushRow(axisSignatureMoneyChord());
  pushRow(axisIntroTexture());
  pushRow(axisOpeningHooks());
  pushRow(axisVocalPreset());
  pushRow(axisKillingPoint());
  pushRow(axisPaletteFamily());
  pushRow(axisMotifFamily());
  pushRow(axisArcModel());
  pushRow(axisAudienceProfile());
  pushRow(axisTempo());
  pushRow(axisVocalQuota());
  pushRow(axisEraIntent());
  pushRow(axisDistinctChoice());
  pushRow(axisPromptAxis());
  pushRow(axisObjectState());
  pushRow(axisListeningIntent());
  pushRow(axisEraBuckets());

  printTable();

  console.log('\n미정의(✗) 전체 목록 및 영향 ─────────────────────────────');
  let printedAny = false;
  for (const row of rows) {
    for (const a of CANONICAL_ARCHETYPES) {
      if (row.cells[a]?.status !== '✗') continue;
      printedAny = true;
    }
  }
  if (!printedAny) console.log('  (없음)');
  for (const row of rows) {
    const violated = CANONICAL_ARCHETYPES.filter(a => row.cells[a]?.status === '✗');
    if (!violated.length) continue;
    console.log(`\n✗ ${row.label} — ${violated.join(', ')}`);
    for (const note of row.noteLines) console.log(`    ${note}`);
  }

  console.log('\n\n편차 경고(⚠) 전체 목록 ─────────────────────────────────');
  for (const row of rows) {
    const advised = CANONICAL_ARCHETYPES.filter(a => row.cells[a]?.status === '⚠');
    if (!advised.length && !row.noteLines.some(n => n.startsWith('편차'))) continue;
    console.log(`\n⚠ ${row.label}${advised.length ? ` — ${advised.join(', ')}` : ''}`);
    for (const note of row.noteLines) console.log(`    ${note}`);
  }

  console.log(`\n\n[check:coverage] CONTRACT VIOLATION(✗) ${violationCount}건 / 편차 경고(⚠) ${advisoryCount}건 / 축 ${rows.length}개 × 아키타입 ${CANONICAL_ARCHETYPES.length}개`);

  printMeasuredSongLedger();

  if (violationCount > 0) process.exitCode = 1;
}

main();
