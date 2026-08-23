/**
 * 지시문 71 (TASK A) — 신규 워크스페이스 등록 시 §2.2가 나열한 16개 파일 중
 * 하나라도 빠지면 예외가 나지 않고 조용히 기본값(시니어 훅뱅크·시니어
 * 킬링포인트·전체 테마 폴백 등)으로 떨어진다 — 지시문 68에서 확인한 패턴.
 * 이 스크립트는 모든 WorkspaceId에 대해 그 16개 파일 각각이 실제 값을
 * 갖고 있는지 실측하고 누락을 출력한다.
 *
 * advisory 전용 — 절대 생성을 막지 않는다(항상 exit 0). 기존 7개
 * 워크스페이스에서 누락이 발견돼도 이 스크립트가 고치지 않는다 — 발견만
 * 하고 보고에 남긴다(§하지 말 것 "이번에 고치지는 말 것").
 *
 * Usage: npx tsx scripts/checkWorkspaceRegistration.ts
 */
import { workspaceDefinitions, workspaceForArchetype } from '../src/data/workspaces';
import { channelPresets } from '../src/data/presets';
import { getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';
import { GENRE_WORKSPACE_OWNERSHIP } from '../src/data/genreWorkspaceOwnership';
import { CHANNEL_VOCAL_FLOORS } from '../src/data/channelVocalFloor';
import { CHANNEL_SOUND_FLOORS } from '../src/data/channelSoundFloor';
import { WORKSPACE_ERA_FLOOR } from '../src/data/workspaceEraFloor';
import { qualityPolicyForWorkspace } from '../src/data/workspaceQualityPolicies';
import { AUDIENCE_PROFILE_ID_BY_ARCHETYPE } from '../src/data/archetypeAudienceProfiles';
import { audienceProfileById } from '../src/data/audienceProfiles';
import { moneyChordRotationPool, signatureMoneyChordId } from '../src/data/moneyChords';
import { overrideForArchetype } from '../src/data/hookBanks';
import { seniorMorningOverride } from '../src/data/hookBanks/seniorMorning';
import { introTextures, introTexturesForArchetype } from '../src/data/introTextures';
import { killingPointSetForNonKidsArchetype } from '../src/data/killingPointWorkspaceSets';
import { adultLyricThemes, kidsLyricThemes } from '../src/data/lyricThemes';
import { CONCEPT_KEYWORD_RULES } from '../src/data/conceptKeywords';
import { isKidsArchetype } from '../src/utils/channelArchetype';
import type { ChannelArchetype, WorkspaceId } from '../src/types';

// 워크스페이스와 senior-oldpop이 공유하기로 이미 문서화된 경우(j2000s/
// oldpop-lounge가 seniorMorningOverride를 그대로 쓰는 것 등) — hookBanks
// 시니어 폴백 일치를 "누락"으로 오판하지 않기 위한 예외 목록.
const INTENTIONAL_SENIOR_HOOKBANK_SHARE: ReadonlySet<ChannelArchetype> = new Set(['senior-morning', 'j2000s', 'oldpop-lounge']);

interface AxisResult { ok: boolean; detail: string; }
interface WorkspaceReport { workspaceId: WorkspaceId; primaryArchetype: ChannelArchetype; axes: Record<string, AxisResult>; }

function primaryArchetypeFor(workspaceId: WorkspaceId): ChannelArchetype {
  const ws = workspaceDefinitions.find(w => w.id === workspaceId)!;
  return ws.archetypeIds[0];
}

function checkWorkspaceDefinition(workspaceId: WorkspaceId): AxisResult {
  const ws = workspaceDefinitions.find(w => w.id === workspaceId);
  return ws
    ? { ok: true, detail: `archetypeIds=[${ws.archetypeIds.join(', ')}] ready=${ws.ready}` }
    : { ok: false, detail: 'workspaceDefinitions에 없음' };
}

function checkPresets(archetype: ChannelArchetype): AxisResult {
  const count = channelPresets.filter(c => c.archetype === archetype).length;
  return { ok: count >= 1, detail: `${count}개 채널 프리셋 (archetype=${archetype})` };
}

function checkCoreGenres(archetype: ChannelArchetype): AxisResult {
  const ids = getCoreGenreIdsForArchetype(archetype);
  return { ok: ids.length > 0, detail: `코어 장르 ${ids.length}종` };
}

function checkGenreOwnership(workspaceId: WorkspaceId): AxisResult {
  const owned = Object.entries(GENRE_WORKSPACE_OWNERSHIP).filter(([, workspaces]) => workspaces.includes(workspaceId));
  return { ok: owned.length > 0, detail: `소유/참조 장르 ${owned.length}종` };
}

function checkVocalFloor(workspaceId: WorkspaceId): AxisResult {
  const found = CHANNEL_VOCAL_FLOORS.some(f => f.workspaceId === workspaceId);
  return { ok: found, detail: found ? '있음' : '없음' };
}

function checkSoundFloor(workspaceId: WorkspaceId): AxisResult {
  const found = CHANNEL_SOUND_FLOORS.some(f => f.workspaceId === workspaceId);
  return { ok: found, detail: found ? '있음' : '없음' };
}

function checkEraFloor(archetype: ChannelArchetype): AxisResult {
  // Partial<Record> — 값이 없어도 정상(시대가 정체성이 아닌 아키타입, 이
  // 파일 자기 doc comment 참고). 정보성으로만 보고, ok는 항상 true.
  const has = Boolean(WORKSPACE_ERA_FLOOR[archetype]);
  return { ok: true, detail: has ? '바닥 있음' : '바닥 없음(의도적일 수 있음, N/A)' };
}

function checkQualityPolicy(workspaceId: WorkspaceId): AxisResult {
  try {
    const policy = qualityPolicyForWorkspace(workspaceId);
    return { ok: Boolean(policy), detail: policy ? '있음' : '없음' };
  } catch (e) {
    return { ok: false, detail: `예외: ${(e as Error).message}` };
  }
}

function checkAudienceProfile(archetype: ChannelArchetype): AxisResult {
  const profileId = AUDIENCE_PROFILE_ID_BY_ARCHETYPE[archetype];
  const profile = audienceProfileById(profileId);
  const isGenericFallback = profileId === 'general';
  return { ok: Boolean(profile) && !isGenericFallback, detail: `${profileId}${isGenericFallback ? ' (general 폴백)' : ''}` };
}

function checkMoneyChords(archetype: ChannelArchetype): AxisResult {
  const pool = moneyChordRotationPool(archetype);
  const sig = signatureMoneyChordId(archetype);
  const isGenericDefault = sig === 'default' && archetype !== 'kr-2030-pop';
  return { ok: pool.length >= 2 && !isGenericDefault, detail: `풀 ${pool.length}종, 시그니처=${sig}` };
}

function checkHookBank(archetype: ChannelArchetype): AxisResult {
  const own = overrideForArchetype(archetype, 'english');
  const senior = seniorMorningOverride;
  const matchesSenior = JSON.stringify(own) === JSON.stringify(senior);
  const intentional = INTENTIONAL_SENIOR_HOOKBANK_SHARE.has(archetype);
  const ok = !matchesSenior || intentional;
  return { ok, detail: matchesSenior ? (intentional ? '시니어와 동일(의도된 공유)' : '시니어와 동일(등록 누락 의심)') : '전용 어휘 있음' };
}

function checkIntroTextures(archetype: ChannelArchetype): AxisResult {
  const raw = introTextures.filter(t => t.suitedArchetypes?.includes(archetype)).length;
  const effective = introTexturesForArchetype(archetype).length;
  return { ok: raw >= 10, detail: `전용 ${raw}개 (전체 폴백 시 ${effective}개)` };
}

function checkKillingPoints(archetype: ChannelArchetype): AxisResult {
  if (isKidsArchetype(archetype)) return { ok: true, detail: 'kids 전용 세트 경로 (N/A)' };
  const set = killingPointSetForNonKidsArchetype(archetype);
  const isSeniorArchetype = archetype === 'senior-morning' || archetype === 'showa-cafe' || archetype === 'showa-70s' ||
    archetype === 'j2000s' || archetype === 'modern-chill' || archetype === 'city-night' || archetype === 'oldpop-lounge' ||
    archetype === 'christmas' || archetype === 'lofi-study';
  const ok = set !== undefined || isSeniorArchetype;
  return { ok, detail: set !== undefined ? `전용 세트 ${set.length}종` : (isSeniorArchetype ? '시니어 기본 세트(의도됨)' : '미등록 — 시니어 기본 세트로 폴백') };
}

function checkLyricThemes(archetype: ChannelArchetype): AxisResult {
  const source = isKidsArchetype(archetype) ? kidsLyricThemes : adultLyricThemes;
  const raw = source.filter(t => t.suitedArchetypes?.includes(archetype)).length;
  return { ok: raw >= 12, detail: `전용 테마 ${raw}개` };
}

function checkConceptKeywords(archetype: ChannelArchetype): AxisResult {
  const scoped = CONCEPT_KEYWORD_RULES.filter(r => r.archetypeScope?.includes(archetype));
  return { ok: scoped.length > 0, detail: `archetypeScope 포함 규칙 ${scoped.length}개` };
}

function buildReport(workspaceId: WorkspaceId): WorkspaceReport {
  const primaryArchetype = primaryArchetypeFor(workspaceId);
  return {
    workspaceId,
    primaryArchetype,
    axes: {
      'workspaces/index.ts (WorkspaceDefinition)': checkWorkspaceDefinition(workspaceId),
      'presets.ts (채널 프리셋)': checkPresets(primaryArchetype),
      'genreLibrary/index.ts (코어 장르)': checkCoreGenres(primaryArchetype),
      'genreWorkspaceOwnership.ts (장르 소유권)': checkGenreOwnership(workspaceId),
      'channelVocalFloor.ts': checkVocalFloor(workspaceId),
      'channelSoundFloor.ts': checkSoundFloor(workspaceId),
      'workspaceEraFloor.ts (N/A 허용)': checkEraFloor(primaryArchetype),
      'workspaceQualityPolicies.ts': checkQualityPolicy(workspaceId),
      'archetypeAudienceProfiles.ts + audienceProfiles.ts': checkAudienceProfile(primaryArchetype),
      'moneyChords.ts': checkMoneyChords(primaryArchetype),
      'hookBanks/index.ts': checkHookBank(primaryArchetype),
      'introTextures.ts': checkIntroTextures(primaryArchetype),
      'killingPointWorkspaceSets.ts': checkKillingPoints(primaryArchetype),
      'lyricThemes.ts (테마 풀)': checkLyricThemes(primaryArchetype),
      'conceptKeywords.ts (archetypeScope 규칙)': checkConceptKeywords(primaryArchetype)
    }
  };
}

function main() {
  const workspaceIds = workspaceDefinitions.map(w => w.id);
  console.log(`[check:workspace-registration] ${workspaceIds.length}개 워크스페이스 × 15개 등록축 (advisory, 항상 exit 0)\n`);

  let totalMissing = 0;
  const missingByWorkspace: Record<string, string[]> = {};

  for (const workspaceId of workspaceIds) {
    const report = buildReport(workspaceId);
    console.log(`\n■ ${workspaceId} (primary archetype: ${report.primaryArchetype}, workspaceForArchetype 역참조: ${workspaceForArchetype(report.primaryArchetype)?.id ?? '없음'})`);
    const missing: string[] = [];
    for (const [axis, result] of Object.entries(report.axes)) {
      const mark = result.ok ? '○' : '✗';
      console.log(`  ${mark} ${axis} — ${result.detail}`);
      if (!result.ok) missing.push(`${axis} (${result.detail})`);
    }
    if (missing.length) {
      missingByWorkspace[workspaceId] = missing;
      totalMissing += missing.length;
    }
  }

  console.log('\n\n누락 요약 ─────────────────────────────────────────');
  if (totalMissing === 0) {
    console.log('  (없음) — 모든 워크스페이스가 15개 등록축을 전부 충족합니다.');
  } else {
    for (const [workspaceId, items] of Object.entries(missingByWorkspace)) {
      console.log(`\n  ${workspaceId}: ${items.length}건`);
      for (const item of items) console.log(`    - ${item}`);
    }
  }

  const enChillhopMissing = missingByWorkspace['en-chillhop']?.length ?? 0;
  console.log(`\n[check:workspace-registration] en-chillhop 누락 ${enChillhopMissing}건 / 전체 누락 ${totalMissing}건 (advisory — 생성을 막지 않습니다)`);

  // advisory 전용 — 항상 성공 종료. 새 검사로 생성을 차단하지 않는다(§하지 말 것).
  process.exitCode = 0;
}

main();
