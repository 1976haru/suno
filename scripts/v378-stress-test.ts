/**
 * v3.78 TASK D — 단계별 스트레스 테스트 실행기. Runs real code (no reasoning
 * about it) against the app's own local/offline generation pipeline
 * (generateLocalBlueprint — the same free/no-API "로컬 템플릿" provider path
 * this app already ships) and the new 관문 1/2 (core/designGate.ts,
 * core/generationGate.ts). Prints one clearly delimited section per scenario
 * so the raw output can be pasted directly into docs/v378-report.md as
 * evidence, per this task's own §7 "실제 산출물 데이터를 붙일 것".
 *
 * Usage: npx tsx scripts/v378-stress-test.ts [stage]
 *   stage omitted -> runs every stage (1-6).
 *   stage in {1,2,3,4,5,6} -> runs only that stage.
 */
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { evaluateDesignGate, type DesignGateResult } from '../src/core/designGate';
import { evaluateGenerationGate } from '../src/core/generationGate';
import { runFullAudit } from '../src/core/fullAudit';
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { getGenreById, genreLibrary } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { audienceProfileForAgeGroup, GENERAL_AUDIENCE_PROFILE, KIDS_AUDIENCE_PROFILE, SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import { normalizeChannel } from '../src/utils/channelProfile';
import { vocalPresets } from '../src/data/vocalPresets';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES } from '../src/data/vocalTraits';
import type { ChannelProfile, GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

const SEASON = { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring'], visualDirection: '' };

function hr(title: string) {
  console.log('');
  console.log(`===== ${title} =====`);
}

function baseOptsFor(channel: ChannelProfile, concept: string, songCount: number, genreIds: string[], vocalTone?: string): GenerationOptions {
  return {
    channel,
    projectTitle: concept,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds,
    moodIds: channel.preferredMoods,
    seasonId: SEASON.id,
    vocalTone: vocalTone ?? channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: concept,
    avoidWords: '',
    personaMode: false
  };
}

/** Mirrors scripts/audit.ts's own generatePack, but returns both the plan (for the design gate) and the opts (for the generation gate/full audit) instead of only the blueprint. */
function planAndOpts(channel: ChannelProfile, concept: string, songCount: number, vocalTone?: string) {
  const plan = directSetLocal(concept, channel, songCount, { recentGenreIds: [], recentHooks: [] }, [], vocalTone);
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : channel.preferredGenres;
  const opts = { ...baseOptsFor(channel, concept, songCount, genreIds, vocalTone), diversityAllocations: plan.allocations };
  return { plan, opts };
}

function genresFor(genreIds: string[]) {
  return genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<ReturnType<typeof getGenreById>> => Boolean(g));
}

function runDesignGate(channel: ChannelProfile, concept: string, songCount: number, vocalTone?: string): { result: DesignGateResult; slots: PreassignedSongSlot[]; opts: GenerationOptions } {
  const { plan, opts } = planAndOpts(channel, concept, songCount, vocalTone);
  const genres = genresFor(opts.genreIds);
  const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: [] });
  const audienceProfile = audienceProfileForAgeGroup(opts.audience);
  const constraints = resolveConstraintsFromOptions(opts, audienceProfile, 'senior-oldpop');
  const result = evaluateDesignGate(slots, constraints, opts);
  void plan;
  return { result, slots, opts };
}

function printDesignGateResult(label: string, result: DesignGateResult) {
  console.log(`[${label}] passed=${result.passed} blocking=${result.blocking.length} advisory=${result.advisory.length}`);
  for (const issue of result.blocking) console.log(`  BLOCKING ${issue.id}: expected ${issue.expected} / actual ${issue.actual} (autoFix=${Boolean(issue.autoFix)})`);
  for (const issue of result.advisory) console.log(`  advisory ${issue.id}: expected ${issue.expected} / actual ${issue.actual}`);
}

function bpmStddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// STAGE 1 — 재발 시나리오 재현
// ---------------------------------------------------------------------------
function stage1() {
  hr('STAGE 1 — 재발 시나리오 재현');
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;

  // 1-A — vocal preset different from channel default.
  const lowCalmMale = vocalPresets.find(p => p.id === 'low-calm-male')!;
  console.log(`[1-A] channel default: "${channel.defaultVocal}"`);
  console.log(`[1-A] picked preset "낮고 차분한 남성" prompt: "${lowCalmMale.prompt}"`);
  const r1a = runDesignGate(channel, '아침 커피 한 잔과 함께', 18, lowCalmMale.prompt);
  const vocalTypeCounts1a: Record<string, number> = {};
  for (const s of r1a.slots) if (s.vocalType) vocalTypeCounts1a[s.vocalType] = (vocalTypeCounts1a[s.vocalType] ?? 0) + 1;
  console.log(`[1-A] vocalType counts: ${JSON.stringify(vocalTypeCounts1a)}`);
  printDesignGateResult('1-A', r1a.result);
  if (!r1a.result.passed) {
    console.log('[1-A] 자동 수정 적용 후 재검증:');
    let fixedOpts = r1a.opts;
    for (const issue of r1a.result.blocking) {
      if (issue.autoFix) fixedOpts = { ...fixedOpts, ...issue.autoFix() };
    }
    const fixedGenres = genresFor(fixedOpts.genreIds);
    const fixedSlots = preallocateSongSlots(fixedOpts, fixedGenres, { usedTitles: [], usedHooks: [] });
    const fixedConstraints = resolveConstraintsFromOptions(fixedOpts, audienceProfileForAgeGroup(fixedOpts.audience), 'senior-oldpop');
    const fixedResult = evaluateDesignGate(fixedSlots, fixedConstraints, fixedOpts);
    printDesignGateResult('1-A (자동 수정 후)', fixedResult);
  }

  // 1-B — custom channel, archetype not 'kids', audience not 'seniors'.
  const customChannel = normalizeChannel({ name: '커스텀 라운지', archetype: undefined, audience: 'general' as any, primaryLanguage: 'english', market: 'custom', preferredGenres: channel.preferredGenres, preferredMoods: channel.preferredMoods });
  const generalChannel: ChannelProfile = { ...customChannel, archetype: 'city-night', audience: 'general' as any };
  const r1b = runDesignGate(generalChannel, '도시의 밤, 잔잔한 드라이브', 18);
  const bpms1b = r1b.slots.map(s => s.tempo);
  console.log(`[1-B] audience=${generalChannel.audience} archetype=${generalChannel.archetype} BPM: [${bpms1b.join(', ')}] stddev=${bpmStddev(bpms1b).toFixed(2)}`);
  printDesignGateResult('1-B', r1b.result);

  // 1-C — diversityAllocations undefined (plain preallocateSongSlots call, no plan-derived manual axes).
  const { opts: opts1c } = planAndOpts(channel, '아침 커피 한 잔과 함께', 18);
  const opts1cNoAlloc: GenerationOptions = { ...opts1c, diversityAllocations: undefined };
  const genres1c = genresFor(opts1cNoAlloc.genreIds);
  const slots1c = preallocateSongSlots(opts1cNoAlloc, genres1c, { usedTitles: [], usedHooks: [] });
  const vocalTypeCounts1c: Record<string, number> = {};
  for (const s of slots1c) if (s.vocalType) vocalTypeCounts1c[s.vocalType] = (vocalTypeCounts1c[s.vocalType] ?? 0) + 1;
  const bpms1c = slots1c.map(s => s.tempo);
  console.log(`[1-C] diversityAllocations=undefined -> vocalType counts: ${JSON.stringify(vocalTypeCounts1c)}, BPM stddev=${bpmStddev(bpms1c).toFixed(2)}`);
  const constraints1c = resolveConstraintsFromOptions(opts1cNoAlloc, audienceProfileForAgeGroup(opts1cNoAlloc.audience), 'senior-oldpop');
  const result1c = evaluateDesignGate(slots1c, constraints1c, opts1cNoAlloc);
  printDesignGateResult('1-C', result1c);

  // 1-D — deliberately broken vocal plan: force every slot to the same vocalType.
  const { opts: opts1d } = planAndOpts(channel, '아침 커피 한 잔과 함께', 18);
  const genres1d = genresFor(opts1d.genreIds);
  const realSlots1d = preallocateSongSlots(opts1d, genres1d, { usedTitles: [], usedHooks: [] });
  const brokenSlots1d: PreassignedSongSlot[] = realSlots1d.map(slot => ({ ...slot, vocalType: 'male', vocalGender: 'male' }));
  const constraints1d = resolveConstraintsFromOptions(opts1d, audienceProfileForAgeGroup(opts1d.audience), 'senior-oldpop');
  const result1d = evaluateDesignGate(brokenSlots1d, constraints1d, opts1d);
  console.log('[1-D] 일부러 보컬 계획을 꺼서(18곡 전부 male) 관문 1을 실행합니다.');
  printDesignGateResult('1-D', result1d);
  console.log(`[1-D] EXPECT blocking (vocal-type-variety/min): ${!result1d.passed && result1d.blocking.some(i => i.id === 'vocal-type-variety') ? 'CONFIRMED BLOCKED' : 'NOT BLOCKED (FAIL)'}`);

  // 1-E — deliberately broken tempo bands: force every slot to the same BPM.
  const brokenSlots1e: PreassignedSongSlot[] = realSlots1d.map(slot => ({ ...slot, tempo: 96 }));
  const result1e = evaluateDesignGate(brokenSlots1e, constraints1d, opts1d);
  console.log('[1-E] 일부러 tempoBands를 무너뜨려(18곡 전부 96bpm) 관문 1을 실행합니다.');
  printDesignGateResult('1-E', result1e);
  console.log(`[1-E] EXPECT blocking (bpm-stddev/bpm-range): ${!result1e.passed && result1e.blocking.some(i => i.id === 'bpm-stddev' || i.id === 'bpm-range') ? 'CONFIRMED BLOCKED' : 'NOT BLOCKED (FAIL)'}`);
}

// ---------------------------------------------------------------------------
// STAGE 2 — 컨셉 다양성
// ---------------------------------------------------------------------------
const STAGE2_CONCEPTS: { id: string; concept: string; note: string }[] = [
  { id: '2-A', concept: '6070년대 향수가 느껴지는 올드팝', note: '복수 시대' },
  { id: '2-B', concept: '비틀즈 느낌의 밝은 60년대 팝', note: '단일 시대 + 참조' },
  { id: '2-C', concept: '샹송 느낌의 잔잔한 유럽풍 올드팝', note: '시대 미지정 + 장르 지정' },
  { id: '2-D', concept: '비 오는 날 창가에서 듣는 올드팝', note: '시대·장르 미지정' },
  { id: '2-E', concept: '80년대 초반 어덜트 컨템포러리 발라드', note: '다른 시대' },
  { id: '2-F', concept: '카펜터스와 아바 느낌 9곡씩 총 18곡', note: '세그먼트 + 수량' },
  { id: '2-G', concept: '사이먼과 가펑클 같은 담백한 포크 하모니', note: '시드 미수록 참조' },
  { id: '2-H', concept: '따뜻하고 잔잔한 노래', note: '모든 축 미지정' }
];

function stage2() {
  hr('STAGE 2 — 컨셉 다양성');
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  for (const { id, concept, note } of STAGE2_CONCEPTS) {
    try {
      const { plan, opts } = planAndOpts(channel, concept, 18);
      const genres = genresFor(opts.genreIds);
      const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: [] });
      const constraints = resolveConstraintsFromOptions(opts, audienceProfileForAgeGroup(opts.audience), 'senior-oldpop');
      const gate1 = evaluateDesignGate(slots, constraints, opts);
      console.log(`[${id}] "${concept}" (${note})`);
      console.log(`  era.unspecified=${constraints.era.unspecified} era.primary=${constraints.era.primary} coPrimary=${constraints.era.coPrimary ?? '-'}`);
      console.log(`  interpretation: ${plan.interpretation.intentKo}`);
      printDesignGateResult(id, gate1);
      const eraChecksRan = gate1.blocking.some(i => i.id.startsWith('era-')) || gate1.advisory.some(i => i.id.startsWith('era-'));
      if (constraints.era.unspecified && eraChecksRan) {
        console.log(`  [${id}] FAIL: era.unspecified인데 era-* 검사가 실행됨 (건너뛰어야 함)`);
      } else if (constraints.era.unspecified) {
        console.log(`  [${id}] OK: era.unspecified -> era-* 검사 건너뜀 확인`);
      }

      const blueprint = generateLocalBlueprint(opts, genres, [], SEASON);
      const gate2 = evaluateGenerationGate(blueprint.songs, { conceptLabel: concept, eraConstraint: constraints.era });
      console.log(`  [관문2] passed=${gate2.passed} failingTracks=${gate2.failingTrackNos.length} needsFullRegeneration=${gate2.needsFullRegeneration}`);
      if (!gate2.passed) {
        for (const t of gate2.tracks.filter(tr => !tr.passed).slice(0, 3)) {
          console.log(`    T${t.trackNo}: ${t.blocking.slice(0, 2).join(' | ')}`);
        }
      }
    } catch (err) {
      console.log(`[${id}] ERROR: ${String(err instanceof Error ? err.stack : err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// STAGE 3 — 경계값
// ---------------------------------------------------------------------------
function stage3() {
  hr('STAGE 3 — 경계값');
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const concept = '6070년대 향수가 느껴지는 올드팝';

  for (const songCount of [6, 12, 18, 24]) {
    try {
      const r = runDesignGate(channel, concept, songCount);
      const vocalCounts: Record<string, number> = {};
      for (const s of r.slots) if (s.vocalType) vocalCounts[s.vocalType] = (vocalCounts[s.vocalType] ?? 0) + 1;
      console.log(`[3-${songCount}] songCount=${songCount} vocalType=${JSON.stringify(vocalCounts)}`);
      printDesignGateResult(`3-songCount-${songCount}`, r.result);
    } catch (err) {
      console.log(`[3-songCount-${songCount}] ERROR: ${String(err instanceof Error ? err.stack : err)}`);
    }
  }

  // 3-E — a channel whose real candidate genre pool is <4.
  hr('STAGE 3-E — 장르 후보 3종뿐인 채널');
  const narrowChannel: ChannelProfile = { ...channel, id: 'narrow-genre-channel', preferredGenres: ['adult-contemporary', 'acoustic-pop', 'jazz-pop'] };
  try {
    const { opts } = planAndOpts(narrowChannel, '잔잔한 저녁', 18);
    console.log(`[3-E] resolved genreIds: ${JSON.stringify(opts.genreIds)}`);
    const r = runDesignGate(narrowChannel, '잔잔한 저녁', 18);
    printDesignGateResult('3-E', r.result);
  } catch (err) {
    console.log(`[3-E] ERROR: ${String(err instanceof Error ? err.stack : err)}`);
  }

  hr('STAGE 3-F/G/H — 컨셉 문자열 경계');
  for (const [id, concept2] of [
    ['3-F', ''],
    ['3-G', '따뜻하고 잔잔한 올드팝 '.repeat(100).slice(0, 2000)],
    ['3-H', '올드팝 😊🎵 & "특수문자" <테스트> 60~70년대!!']
  ] as const) {
    try {
      const r = runDesignGate(channel, concept2, 18);
      console.log(`[${id}] conceptLength=${concept2.length}`);
      printDesignGateResult(id, r.result);
    } catch (err) {
      console.log(`[${id}] ERROR: ${String(err instanceof Error ? err.stack : err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// STAGE 4 — 워크스페이스 독립성
// ---------------------------------------------------------------------------
function stage4() {
  hr('STAGE 4 — 워크스페이스 독립성');
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const concept = '6070년대 향수가 느껴지는 올드팝';

  // 4-A — audienceProfile forced to 'general'.
  const generalChannel: ChannelProfile = { ...channel, audience: 'general' as any };
  const r4a = runDesignGate(generalChannel, concept, 18);
  const constraints4a = resolveConstraintsFromOptions(r4a.opts, GENERAL_AUDIENCE_PROFILE, 'senior-oldpop');
  console.log(`[4-A] audienceProfile forced general -> tempoRange=${JSON.stringify(constraints4a.tempoRange)} (senior tempoRange=${JSON.stringify([SENIOR_AUDIENCE_PROFILE.tempoFloor, SENIOR_AUDIENCE_PROFILE.tempoCeiling])})`);
  const gate4a = evaluateDesignGate(r4a.slots, constraints4a, r4a.opts);
  printDesignGateResult('4-A', gate4a);

  // 4-B — audienceProfile forced to 'kids'.
  const kidsChannel: ChannelProfile = { ...channel, audience: 'kids' as any, archetype: 'kids' };
  const r4b = runDesignGate(kidsChannel, '신나는 동요', 18);
  const constraints4b = resolveConstraintsFromOptions(r4b.opts, KIDS_AUDIENCE_PROFILE, 'kr-kids');
  console.log(`[4-B] kids songLengthSecondsRange=${JSON.stringify(KIDS_AUDIENCE_PROFILE.songLengthSecondsRange)} (target 1:30~2:30 = 90~150s)`);
  const audioGateNote = KIDS_AUDIENCE_PROFILE.songLengthSecondsRange[0] === 90 && KIDS_AUDIENCE_PROFILE.songLengthSecondsRange[1] === 150
    ? 'kids 프로파일 값 90~150s와 정확히 일치 (audioGate.ts는 이 값을 audioReport.duration.targetRange로 받아 그대로 판정 — 하드코딩 없음)'
    : '불일치';
  console.log(`[4-B] ${audioGateNote}`);
  const gate4b = evaluateDesignGate(r4b.slots, constraints4b, r4b.opts);
  printDesignGateResult('4-B', gate4b);

  // 4-C — kr-2030 workspace (skeleton only).
  hr('STAGE 4-C — kr-2030 워크스페이스 (골격만)');
  try {
    const kr2030Channel: ChannelProfile = { ...channel, audience: 'twenties' as any };
    const r4c = runDesignGate(kr2030Channel, '설레는 이십대의 도시 밤', 18);
    const constraintsKr2030 = resolveConstraintsFromOptions(r4c.opts, audienceProfileForAgeGroup(kr2030Channel.audience), 'kr-2030');
    const gate4c = evaluateDesignGate(r4c.slots, constraintsKr2030, r4c.opts);
    console.log('[4-C] kr-2030 워크스페이스 id로 관문 1 실행 — 에러 없이 동작.');
    printDesignGateResult('4-C', gate4c);
  } catch (err) {
    console.log(`[4-C] ERROR: ${String(err instanceof Error ? err.stack : err)}`);
  }
}

// ---------------------------------------------------------------------------
// STAGE 5 — 회귀 확인
// ---------------------------------------------------------------------------
function stage5() {
  hr('STAGE 5 — 회귀 확인');
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const concept = '6070년대 향수가 느껴지는 올드팝';
  const { opts } = planAndOpts(channel, concept, 18);
  const genres = genresFor(opts.genreIds);

  const runA = generateLocalBlueprint(opts, genres, [], SEASON);
  const runB = generateLocalBlueprint(opts, genres, [], SEASON);
  const stylePromptsEqual = JSON.stringify(runA.songs.map(s => s.stylePrompt)) === JSON.stringify(runB.songs.map(s => s.stylePrompt));
  const lyricsEqual = JSON.stringify(runA.songs.map(s => s.lyrics)) === JSON.stringify(runB.songs.map(s => s.lyrics));
  console.log(`[5-A] 같은 시드·같은 컨셉 재실행(결정론성 확인): stylePrompt 동일=${stylePromptsEqual}, 가사 동일=${lyricsEqual}`);

  const report = runFullAudit(runA.songs, { conceptLabel: concept, songCount: 18, audienceProfile: SENIOR_AUDIENCE_PROFILE });
  console.log('[5-B] runFullAudit 실측값:');
  for (const item of report.items) {
    console.log(`  [${item.category}] ${item.labelKo}: 기준 ${item.targetKo} / 실측 ${item.actualKo} / ${item.status}`);
  }
}

// ---------------------------------------------------------------------------
// STAGE 6 — 실사용 시뮬레이션
// ---------------------------------------------------------------------------
function stage6() {
  hr('STAGE 6 — 실사용 시뮬레이션 (oldpoplounge 동등 채널: good-morning-memory-radio)');
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  console.log('[6-A] 채널: good-morning-memory-radio (archetype senior-morning — 이 저장소에는 literal id "oldpoplounge" 채널이 없어 가장 가까운 동등 채널을 사용, 보고서에 명시)');
  const concept = '6070년대 향수가 느껴지는 올드팝';
  console.log(`[6-B] 컨셉: "${concept}"`);

  const warmMatureMale = vocalPresets.find(p => p.id === 'warm-mature-male')!;
  console.log(`[6-C] 보컬 프리셋: "${warmMatureMale.label}" (${warmMatureMale.id}) prompt="${warmMatureMale.prompt}"`);
  console.log(`[6-C] 채널 defaultVocal과 동일한가? ${warmMatureMale.prompt === channel.defaultVocal ? '동일 (레이닝 미발동 — 기본 쿼터로 다양성 보장)' : '다름 (레이닝 발동 기대)'}`);

  const { opts, plan } = planAndOpts(channel, concept, 18, warmMatureMale.prompt);
  const genres = genresFor(opts.genreIds);
  let slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: [] });
  let constraints = resolveConstraintsFromOptions(opts, audienceProfileForAgeGroup(opts.audience), 'senior-oldpop');
  let gate1 = evaluateDesignGate(slots, constraints, opts);
  console.log('[6-D] 관문 1 (설계 확인):');
  printDesignGateResult('6-D', gate1);

  let finalOpts = opts;
  if (!gate1.passed) {
    console.log('[6-E] 관문 1 실패 -> 자동 수정 적용');
    for (const issue of gate1.blocking) {
      if (!issue.autoFix) continue;
      const fix = issue.autoFix();
      finalOpts = { ...finalOpts, ...fix };
      console.log(`  자동 수정 적용: ${issue.id}`);
    }
    const genres2 = genresFor(finalOpts.genreIds);
    slots = preallocateSongSlots(finalOpts, genres2, { usedTitles: [], usedHooks: [] });
    constraints = resolveConstraintsFromOptions(finalOpts, audienceProfileForAgeGroup(finalOpts.audience), 'senior-oldpop');
    gate1 = evaluateDesignGate(slots, constraints, finalOpts);
    console.log('[6-E] 재검증 결과:');
    printDesignGateResult('6-E', gate1);
  } else {
    console.log('[6-E] 관문 1이 이미 통과해 자동 수정이 필요하지 않았습니다.');
  }

  console.log(`[6-F] 브릿지 지시문 복사 — 관문 1 최종 상태: passed=${gate1.passed} (통과 시에만 정상적으로 활성화됨, Step3Generate.tsx의 disabled=bridgeGateBlocksCopy)`);

  console.log('[6-G] "Codex로 18곡 생성" — 이 스트레스 테스트에는 실제 Codex/외부 코딩 에이전트 실행 환경이 없어, 이 앱이 자체 제공하는 무료/오프라인 "로컬 템플릿" 생성 경로(generateLocalBlueprint, provider:\'local\')로 실제 실행을 대체합니다. 이는 앱의 실제 1급 생성 경로이며 목업이 아닙니다 — 이 대체에 대한 정직한 명시입니다.');
  const genresFinal = genresFor(finalOpts.genreIds);
  const blueprint = generateLocalBlueprint(finalOpts, genresFinal, [], SEASON);

  const gate2 = evaluateGenerationGate(blueprint.songs, { conceptLabel: concept, eraConstraint: constraints.era });
  console.log('[6-H] 관문 2 (생성 검증):');
  console.log(`  passed=${gate2.passed} failing=${gate2.failingTrackNos.length}/${blueprint.songs.length} needsFullRegeneration=${gate2.needsFullRegeneration}`);
  for (const t of gate2.tracks.filter(tr => !tr.passed)) {
    console.log(`  T${t.trackNo} blocking: ${t.blocking.join(' | ')}`);
  }
  if (gate2.packBlocking.length) console.log(`  pack-level blocking: ${gate2.packBlocking.join(' | ')}`);

  if (!gate2.passed) {
    console.log(`[6-I] 실패 곡 재작곡 지시문 대상: 트랙 ${gate2.failingTrackNos.join(', ')} (buildRecomposeInstruction으로 생성 가능 — 실제 Codex 재실행은 이 스트레스 테스트 범위 밖, §미구현에 명시)`);
  } else {
    console.log('[6-I] 실패 곡 없음 — 재작곡 불필요.');
  }

  console.log(`[6-J] 최종 판정: 관문1 passed=${gate1.passed}, 관문2 passed=${gate2.passed}`);

  // -------------------------------------------------------------------
  // §7-2 최종 18곡 실물 데이터
  // -------------------------------------------------------------------
  hr('STAGE 6 최종 18곡 실물 데이터 (§7-2)');
  const songs: SongIdea[] = blueprint.songs;
  const registerPool = [...MALE_VOCAL_TRAIT_AXES.register, ...FEMALE_VOCAL_TRAIT_AXES.register];

  console.log('-- 보컬 서술 18줄 (stylePrompt에서 매칭된 register 문구) --');
  for (const song of songs) {
    const matched = registerPool.filter(r => song.stylePrompt.toLowerCase().includes(r.toLowerCase()));
    console.log(`T${song.trackNo} [${song.vocalType}]: ${matched.join(' / ') || '(register 문구 미검출)'}`);
  }

  console.log('-- 보컬 타입 순서 --');
  console.log(songs.map(s => s.vocalType ?? '?').join(' '));

  const bpms = songs.map(s => s.bpm);
  console.log('-- BPM 18개 --');
  console.log(bpms.join(', '));
  console.log(`표준편차: ${bpmStddev(bpms).toFixed(2)}  범위: ${Math.min(...bpms)}~${Math.max(...bpms)} (폭 ${Math.max(...bpms) - Math.min(...bpms)})`);

  console.log('-- 장르별 시대 분포 --');
  const genreCounts: Record<string, number> = {};
  for (const song of songs) if (song.genreId) genreCounts[song.genreId] = (genreCounts[song.genreId] ?? 0) + 1;
  console.log(JSON.stringify(genreCounts, null, 2));

  console.log('-- 제목 18개와 훅 대조 --');
  for (const song of songs) console.log(`T${song.trackNo}: title="${song.title}" hook="${song.hookPhrase}"`);

  console.log('-- 어휘 빈도 상위 (본문 단어, 상위 15) --');
  const wordCounts = new Map<string, number>();
  for (const song of songs) {
    for (const rawLine of song.lyrics.split('\n')) {
      const line = rawLine.trim();
      if (!line || /^\[[^\]]*\]$/.test(line)) continue;
      for (const word of line.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean)) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }
  }
  const topWords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(topWords.map(([w, c]) => `${w}(${c})`).join(', '));

  console.log('-- 가사 3곡 전문 (장르가 서로 다른 3곡) --');
  const seenGenres = new Set<string>();
  const sampleSongs: SongIdea[] = [];
  for (const song of songs) {
    const key = song.genreId ?? 'none';
    if (seenGenres.has(key)) continue;
    seenGenres.add(key);
    sampleSongs.push(song);
    if (sampleSongs.length >= 3) break;
  }
  for (const song of sampleSongs) {
    console.log(`--- T${song.trackNo} "${song.title}" (genre=${song.genreId}) ---`);
    console.log(song.lyrics);
    console.log('');
  }

  console.log('-- stylePrompt 3곡 전문 (동일 3곡) --');
  for (const song of sampleSongs) {
    console.log(`--- T${song.trackNo} "${song.title}" ---`);
    console.log(song.stylePrompt);
    console.log('');
  }
}

// ---------------------------------------------------------------------------
function main() {
  const stageArg = process.argv[2];
  const stages: Record<string, () => void> = { '1': stage1, '2': stage2, '3': stage3, '4': stage4, '5': stage5, '6': stage6 };
  if (stageArg && stages[stageArg]) {
    stages[stageArg]();
    return;
  }
  for (const fn of Object.values(stages)) fn();
}

main();
