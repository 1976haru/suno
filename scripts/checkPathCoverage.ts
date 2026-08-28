/**
 * 지시문 79 (TASK C-2) — "정책이 모든 생성 경로에 적용되는가" 전수 검사.
 *
 * 왜 필요한가: 2차 정합성 감사가 확인한 6건이 전부 같은 모양이었다 —
 * 정책은 만들어졌는데 **한 경로에만** 붙었다.
 *
 *   지시문 74 TASK A 섹션 하한   브릿지 ○ / 로컬 ✗ (111~125 BPM 97곡 전부 미달)
 *   지시문 76 TASK A 대역 브리지  setDirector ○ / 직접 경로 ✗ (25세트 중 9세트)
 *   지시문 77 컨셉 발성 라우팅    31채널 ○ / 3채널 ✗ (tone-match가 차단)
 *   지시문 78 TASK A 발성 어휘    컨셉 경로 ○ / 프리셋 선택 경로 ✗ (408곡 0곡)
 *   지시문 78 신설 프리셋 중복    30.6%에서 74 TASK C 경고 자동 발생
 *   §1 보컬 쿼터 reasonKo         계산 ○ / 표시 문구 ✗
 *
 * 개별 패치로는 다음 지시문에서 또 재발한다. 이 스크립트는 각 정책을
 * **실제로 세트를 생성해** 경로별로 재고, 어느 경로가 빠졌는지 이름을
 * 찍는다. 경로 정의와 관문 목록은 docs/generation-paths.md에 있다.
 *
 * §"새 검사로 생성을 차단하지 말 것" — advisory. 항상 exit 0.
 *
 * Usage: npx tsx scripts/checkPathCoverage.ts (또는 npm run check:path-coverage)
 */
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { directSetLocal } from '../src/core/setDirector';
import { minTotalSectionsForBpm } from '../src/core/bpmLengthControl';
// 섹션 수는 core/quality.ts의 하한 검사가 쓰는 것과 **같은 파서**로 센다 —
// 자체 정규식을 쓰면 `[verse 1: male vocal]` 같은 듀엣 태그를 보컬 지시
// 태그로 오인해 과소 집계한다(실측으로 걸렸다).
import { countLyricSections } from '../src/core/instrumentalSectionFill';
import { vocalPresets } from '../src/data/vocalPresets';
import { makeOptions } from '../tests/fixtures';
import type { ChannelProfile, GenerationOptions, SongIdea } from '../src/types';

/** 경로 이름 — docs/generation-paths.md §0과 같은 표기. */
type PathId = 'A-로컬' | 'B/C-슬롯' | 'D-미리보기';

interface Finding {
  policy: string;
  introducedBy: string;
  path: PathId;
  ok: boolean;
  measuredKo: string;
}

const findings: Finding[] = [];
function record(policy: string, introducedBy: string, path: PathId, ok: boolean, measuredKo: string) {
  findings.push({ policy, introducedBy, path, ok, measuredKo });
}

const SONG_COUNT = 12;
const origWarn = console.warn;
function quiet<T>(fn: () => T): T {
  console.warn = () => {};
  try { return fn(); } finally { console.warn = origWarn; }
}

function optionsFor(channel: ChannelProfile, extra: Partial<GenerationOptions> = {}): GenerationOptions {
  return makeOptions({
    channel,
    projectTitle: 'check:path-coverage',
    songCount: SONG_COUNT,
    genreIds: channel.preferredGenres.slice(0, 5),
    ...extra
  } as Partial<GenerationOptions>) as GenerationOptions;
}

function localSongs(channel: ChannelProfile, extra: Partial<GenerationOptions> = {}): SongIdea[] {
  const opts = optionsFor(channel, extra);
  const genreIds = opts.genreIds ?? [];
  return quiet(() => {
    try {
      const bp = generateLocalBlueprint(
        opts,
        genrePacks.filter(g => genreIds.includes(g.id)),
        moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
        seasonPacks.find(s => s.id === opts.seasonId)
      ) as unknown as { songs: SongIdea[] };
      return bp.songs;
    } catch { return []; }
  });
}

function slotsFor(channel: ChannelProfile, extra: Partial<GenerationOptions> = {}) {
  const opts = optionsFor(channel, extra);
  const genreIds = opts.genreIds ?? [];
  return quiet(() => {
    try {
      return preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as unknown as Array<Record<string, unknown>>;
    } catch { return []; }
  });
}

// ─────────────────────────────────────────────────────────────────
// ① 지시문 74 TASK A — BPM 구간별 섹션 하한
// ─────────────────────────────────────────────────────────────────
function checkSectionFloor() {
  const POLICY = 'BPM 구간별 섹션 하한';
  const BY = '지시문 74 TASK A';

  // A 로컬 — 실제 가사의 섹션 마커 수를 하한과 대조한다.
  let total = 0;
  let below = 0;
  for (const channel of channelPresets) {
    for (const song of localSongs(channel)) {
      const bpm = Number((song as unknown as { bpm?: number }).bpm ?? 0);
      const floor = minTotalSectionsForBpm(bpm);
      if (!floor) continue;
      const sections = countLyricSections(String(song.lyrics ?? ''));
      total += 1;
      if (sections < floor) below += 1;
    }
  }
  record(POLICY, BY, 'A-로컬', total > 0 && below === 0,
    total ? `96 BPM 이상 ${total}곡 중 하한 미달 ${below}곡 (${((below / total) * 100).toFixed(1)}%)` : '해당 곡 없음');

  // B/C 슬롯 — 슬롯의 sectionCountRange 하한이 정책 하한 이상인가.
  let slotTotal = 0;
  let slotBelow = 0;
  for (const channel of channelPresets) {
    for (const slot of slotsFor(channel)) {
      const bpm = Number(slot.tempo ?? 0);
      const floor = minTotalSectionsForBpm(bpm);
      if (!floor) continue;
      const range = slot.sectionCountRange as [number, number] | undefined;
      slotTotal += 1;
      if (!range || range[1] < floor) slotBelow += 1;
    }
  }
  record(POLICY, BY, 'B/C-슬롯', slotTotal > 0 && slotBelow === 0,
    slotTotal ? `96 BPM 이상 슬롯 ${slotTotal}개 중 sectionCountRange가 하한을 담지 못함 ${slotBelow}개` : '해당 슬롯 없음');
}

// ─────────────────────────────────────────────────────────────────
// ② 지시문 76 TASK A — 세트 내 대역 혼재 방지
// ─────────────────────────────────────────────────────────────────
function checkBandMix() {
  const POLICY = '세트 내 대역 혼재 방지';
  const BY = '지시문 76 TASK A';
  const TITLES = ['세트 A', '세트 B', '세트 C', '세트 D', '세트 E'];
  const targets = channelPresets.filter(c => c.archetype === 'en-chillhop');
  const mixed = (tempos: number[]) => tempos.length > 0 && Math.min(...tempos) <= 70 && Math.max(...tempos) >= 120;

  let directSets = 0;
  let directBad = 0;
  for (const channel of targets) {
    for (const title of TITLES) {
      const slots = slotsFor(channel, { projectTitle: title, genreIds: channel.preferredGenres });
      if (!slots.length) continue;
      directSets += 1;
      if (mixed(slots.map(s => Number(s.tempo ?? 0)))) directBad += 1;
    }
  }
  record(POLICY, BY, 'B/C-슬롯', directSets > 0 && directBad === 0,
    `en-chillhop ${directSets}세트 중 저속(<=70)+고속(>=120) 공존 ${directBad}세트`);

  let planSets = 0;
  let planBad = 0;
  for (const channel of targets) {
    for (const freeText of ['늦은 밤 헤드폰', '비 오는 저녁', '주말 오후 드라이브', '창밖의 불빛', '조용한 새벽']) {
      const plan = quiet(() => {
        try { return directSetLocal(freeText, channel, SONG_COUNT, { recentGenreIds: [], recentHooks: [] }) as unknown as { slots: Array<{ tempo: number }> }; } catch { return undefined; }
      });
      if (!plan) continue;
      planSets += 1;
      if (mixed(plan.slots.map(s => s.tempo))) planBad += 1;
    }
  }
  record(POLICY, BY, 'D-미리보기', planSets > 0 && planBad === 0,
    `en-chillhop ${planSets}세트 중 공존 ${planBad}세트`);
}

// ─────────────────────────────────────────────────────────────────
// ③ 지시문 77 — 컨셉 → 보컬 프리셋 라우팅
// ─────────────────────────────────────────────────────────────────
const FAMILY_CONCEPTS: Record<string, string> = {
  breathy: '숨소리 섞인 목소리로 부르는 노래',
  belted: '파워풀한 보컬로 부르는 노래',
  husky: '허스키한 목소리로 부르는 노래',
  dark: '어두운 목소리로 부르는 노래',
  clean: '담백한 목소리로 부르는 노래'
};

function checkConceptVocalRouting() {
  const POLICY = '컨셉 → 보컬 프리셋 라우팅';
  const BY = '지시문 77';
  // "컨셉이 계열을 지목했는데(conceptVocalFamilyId 있음) 프리셋이 한 곡도
  // 배정되지 않은(vocalPresetSource==='concept' 0곡)" 칸을 센다.
  const measure = (getRows: (channel: ChannelProfile, concept: string) => Array<{ family?: string; source?: string }>) => {
    let dead = 0;
    let cells = 0;
    const deadChannels = new Set<string>();
    for (const channel of channelPresets) {
      for (const concept of Object.values(FAMILY_CONCEPTS)) {
        const rows = getRows(channel, concept);
        if (!rows.length) continue;
        const flagged = rows.filter(r => r.family).length;
        if (!flagged) continue; // 지목 자체가 없음(kids 등) — 검사 대상 아님
        cells += 1;
        if (!rows.some(r => r.source === 'concept')) { dead += 1; deadChannels.add(channel.id); }
      }
    }
    return { dead, cells, deadChannels };
  };

  const slotResult = measure((channel, concept) =>
    slotsFor(channel, { customConcept: concept }).map(s => ({
      family: s.conceptVocalFamilyId as string | undefined,
      source: s.vocalPresetSource as string | undefined
    })));
  record(POLICY, BY, 'B/C-슬롯', slotResult.dead === 0,
    `지목된 ${slotResult.cells}칸 중 프리셋 배정 0건 ${slotResult.dead}칸${slotResult.deadChannels.size ? ` (${[...slotResult.deadChannels].join(', ')})` : ''}`);

  const localResult = measure((channel, concept) =>
    localSongs(channel, { customConcept: concept }).map(s => ({
      family: (s as unknown as { conceptVocalFamilyId?: string }).conceptVocalFamilyId,
      source: (s as unknown as { vocalPresetSource?: string }).vocalPresetSource
    })));
  record(POLICY, BY, 'A-로컬', localResult.dead === 0,
    `지목된 ${localResult.cells}칸 중 프리셋 배정 0건 ${localResult.dead}칸${localResult.deadChannels.size ? ` (${[...localResult.deadChannels].join(', ')})` : ''}`);
}

// ─────────────────────────────────────────────────────────────────
// ④ 지시문 78 TASK A — 발성 어휘의 stylePrompt 도달
// ─────────────────────────────────────────────────────────────────
/** 지시문 78 TASK A가 성인 프리셋 prompt에 넣은 발성 어휘. */
const ARTICULATION_TERMS = [
  'soft glottal onset', 'clean fold closure', 'forward mask resonance', 'audible fold rasp',
  'low breath pressure', 'firm glottal closure', 'lowered larynx', 'deep pharyngeal resonance',
  'even unforced onset', 'sustained chest projection', 'dry grain'
];

function checkArticulationReach() {
  const POLICY = '발성 어휘의 stylePrompt 도달';
  const BY = '지시문 78 TASK A';
  // "사용자가 프리셋을 골랐을 때" 그 프리셋의 발성 어휘가 최종
  // stylePrompt에 실리는가. 컨셉 경로는 이미 되므로 프리셋 선택 경로만 본다.
  let songs = 0;
  let hits = 0;
  for (const channel of channelPresets) {
    const preset = vocalPresets.find(p => !p.forKids && p.suitedArchetypes?.includes(channel.archetype));
    if (!preset) continue;
    const term = ARTICULATION_TERMS.find(t => preset.prompt.includes(t));
    if (!term) continue;
    for (const song of localSongs(channel, { vocalTone: preset.prompt })) {
      songs += 1;
      if (String(song.stylePrompt ?? '').includes(term)) hits += 1;
    }
  }
  const rate = songs ? (hits / songs) * 100 : 0;
  record(POLICY, BY, 'A-로컬', songs > 0 && rate >= 50,
    songs ? `프리셋 선택 ${songs}곡 중 그 프리셋의 발성 어휘가 stylePrompt에 도달 ${hits}곡 (${rate.toFixed(1)}%, 기준 50% 이상)` : '측정 대상 없음');
}

// ─────────────────────────────────────────────────────────────────
// ⑤⑥ 지시문 74 TASK C — 절 단위 중복 · 인트로 자기모순
// ─────────────────────────────────────────────────────────────────
function checkQualityGateNoise() {
  const CONCEPTS = ['', ...Object.values(FAMILY_CONCEPTS)];
  let songs = 0;
  let dup = 0;
  let intro = 0;
  for (const channel of channelPresets) {
    for (const concept of CONCEPTS) {
      for (const song of localSongs(channel, { customConcept: concept })) {
        songs += 1;
        const warnings = song.warnings ?? [];
        if (warnings.some(w => w.includes('중복된 절'))) dup += 1;
        if (warnings.some(w => w.includes('인트로 지시가 서로 모순'))) intro += 1;
      }
    }
  }
  const dupRate = songs ? (dup / songs) * 100 : 0;
  const introRate = songs ? (intro / songs) * 100 : 0;
  // 이 두 검사는 "관문이 붙었는가"가 아니라 "관문이 자기 생성물을 계속
  // 때리고 있지 않은가"를 본다 — 자기 파이프라인이 만든 프롬프트가
  // 자기 검사에 걸리면 그건 검사가 아니라 결함이다(지시문 79 §3.1).
  record('절 단위 중복 검사', '지시문 74 TASK C', 'A-로컬', dupRate <= 5,
    `${songs}곡 중 중복 절 경고 ${dup}곡 (${dupRate.toFixed(1)}%, 기준 5% 이하)`);
  record('인트로 자기모순 검사', '지시문 74 TASK C', 'A-로컬', introRate <= 5,
    `${songs}곡 중 인트로 모순 경고 ${intro}곡 (${introRate.toFixed(1)}%, 기준 5% 이하)`);
}

// ─────────────────────────────────────────────────────────────────
function main() {
  console.log('[check:path-coverage] 지시문 79 TASK C-2 — 정책 × 생성 경로 적용 현황');
  console.log('경로 정의: docs/generation-paths.md\n');

  checkSectionFloor();
  checkBandMix();
  checkConceptVocalRouting();
  checkArticulationReach();
  checkQualityGateNoise();

  const width = Math.max(...findings.map(f => f.policy.length)) + 2;
  let current = '';
  for (const f of findings) {
    if (f.policy !== current) {
      current = f.policy;
      console.log(`\n${f.policy}  (${f.introducedBy})`);
    }
    console.log(`  ${f.ok ? '적용됨 ' : '미적용 '} ${f.path.padEnd(12)} ${f.measuredKo}`);
  }
  void width;

  const missing = findings.filter(f => !f.ok);
  console.log(`\n검사 ${findings.length}칸 (정책 ${new Set(findings.map(f => f.policy)).size}종 × 경로) — 미적용 ${missing.length}건`);
  for (const f of missing) console.log(`  · ${f.policy} / ${f.path} — ${f.measuredKo}`);
  console.log('\n[check:path-coverage] advisory — 통과 처리(exit 0).');
}

main();
