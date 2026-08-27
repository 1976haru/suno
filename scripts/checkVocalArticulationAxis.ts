/**
 * 지시문 78 — 보컬 프리셋의 **발성 축** 커버리지 실측.
 *
 * 지시문 77이 컨셉 → 프리셋 라우팅 축을 만들었고, 이 검사는 그 축이 실제로
 * 고를 수 있는 목소리가 워크스페이스마다 몇 종인지 잰다. §1 실측의 근본
 * 원인은 프리셋 prompt가 **음역대(mezzo-soprano/tenor)와 인상(warm/youthful)**
 * 으로만 정의돼 있어 성대·공명강·호흡을 어떻게 쓰는지가 어디에도 없다는
 * 것이었다 — 그래서 Suno가 전부 기본 발성으로 부른다.
 *
 * advisory 전용, 항상 exit 0(§9 "새 검사로 생성을 차단하지 말 것").
 *
 * Usage: npx tsx scripts/checkVocalArticulationAxis.ts [--json]
 */
import type { ChannelArchetype } from '../src/types';
import { vocalPresets } from '../src/data/vocalPresets';
import { suitablePresetsForArchetype } from '../src/core/vocalRecommender';
import { detectVocalGender } from '../src/core/vocalPlan';

/**
 * 축 판정 어휘. **프리셋 prompt 문구에 실제로 있는 표현만** 센다 — 인상어
 * (warm/gentle/sophisticated)는 발성 정보가 아니므로 어느 축에도 넣지 않는다.
 */
export const ARTICULATION_AXES: Record<string, RegExp> = {
  breathy: /\b(?:breathy|breath tone|close-mic breath|airy|whisper|soft glottal onset|low breath pressure)\b/i,
  husky: /\b(?:husky|rasp|smoky|grainy|grain\b)/i,
  belted: /\b(?:full-voiced|chest projection|chest-driven projection|firm glottal closure|sustained chest)\b/i,
  clear: /\b(?:clean simple delivery|clean modern pop|clean fold closure|forward mask resonance|bell-like clarity|clear diction)\b/i,
  dark: /\b(?:lowered larynx|pharyngeal resonance|cavernous|dark velvet)\b/i,
  falsetto: /\b(?:falsetto|head voice|head-voice)\b/i
};

/**
 * "발성 정보를 가졌는가"의 판정 — 위 6개 축 어디에도 안 잡히더라도
 * 성대·공명강·호흡의 사용 방식을 말하고 있으면 발성 정보다(예: soulful-female의
 * 'flexible chest-to-head mix'는 레지스터 전환 축이라 6축 표에는 안 들어가지만
 * 분명히 발성 정보다). 음역대(tenor/alto)와 인상어(warm/youthful)는 제외.
 */
export const ARTICULATION_ANY = /\b(?:onsets?|fold closure|fold contact|fold rasp|resonance|breath pressure|breath support|larynx|passaggio|chest-to-head|chest projection|chest-driven|head voice|head-voice|falsetto|breathy|airy|whisper|rasp|husky|smoky|grainy|bell-like clarity|clean simple delivery|clean modern pop)\b/i;

const ADULT_ARCHETYPES: ChannelArchetype[] = [
  'oldpop-lounge', 'showa-70s', 'kr-2030-pop', 'jp-2030-pop',
  'kr-idol-male', 'kr-idol-female', 'en-chillhop'
];

const OTHER_ADULT: ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'christmas', 'lofi-study', 'j2000s', 'modern-chill', 'city-night'
];

export function axesOf(prompt: string): string[] {
  return Object.entries(ARTICULATION_AXES).filter(([, re]) => re.test(prompt)).map(([axis]) => axis);
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const axisNames = Object.keys(ARTICULATION_AXES);
  const rows = [...ADULT_ARCHETYPES, ...OTHER_ADULT].map(archetype => {
    const pool = suitablePresetsForArchetype(archetype);
    const counts: Record<string, number> = {};
    for (const axis of axisNames) counts[axis] = pool.filter(p => ARTICULATION_AXES[axis].test(p.prompt)).length;
    return { archetype, total: pool.length, counts, target: ADULT_ARCHETYPES.includes(archetype) };
  });
  const adultPresets = vocalPresets.filter(p => !p.forKids);
  const noArticulation = adultPresets.filter(p => !ARTICULATION_ANY.test(p.prompt)).map(p => p.id);
  const genderUndetectable = adultPresets.filter(p => detectVocalGender(p.prompt) === null).map(p => p.id);
  const kids = vocalPresets.filter(p => p.forKids);

  if (jsonMode) {
    console.log(JSON.stringify({ rows, noArticulation, genderUndetectable, adultCount: adultPresets.length, kidsCount: kids.length }, null, 2));
    return;
  }

  console.log('=== 지시문 78 — 발성 축 커버리지 ===\n');
  console.log(`아키타입          총  ${axisNames.map(a => a.padEnd(8)).join('')}`);
  console.log('─'.repeat(78));
  for (const row of rows) {
    if (row.archetype === 'senior-morning') console.log('--- (참고: §1 표 밖의 성인 아키타입) ---');
    const cells = axisNames.map(a => String(row.counts[a]).padEnd(8)).join('');
    const gap = row.target && axisNames.filter(a => a !== 'falsetto').some(a => row.counts[a] === 0) ? '  ⚠ 0종 축 있음' : '';
    console.log(`${row.archetype.padEnd(17)} ${String(row.total).padStart(2)}  ${cells}${gap}`);
  }
  console.log(`\n성인 프리셋 ${adultPresets.length}종 · forKids ${kids.length}종`);
  console.log(`발성 정보 없는 성인 프리셋: ${noArticulation.length}종${noArticulation.length ? ' — ' + noArticulation.join(', ') : ''}`);
  console.log(`detectVocalGender 판정 불가: ${genderUndetectable.length}종${genderUndetectable.length ? ' — ' + genderUndetectable.join(', ') : ''} (듀엣 1종은 의도된 예외)`);

  console.log('\n--- 프리셋별 축 / prompt 단어 수 ---');
  for (const p of adultPresets) {
    console.log(`  ${p.id.padEnd(22)} ${String(p.prompt.split(/\s+/).length).padStart(2)}w  [${axesOf(p.prompt).join(', ') || '(없음)'}]`);
  }
}

main();
