/**
 * 지시문 46 긴급수정 (TASK C) — "입력·데이터는 있는데 소비가 없다" 유형의
 * 결함(지시문 24 사용자 장르 선택 · 지시문 30 언어 선택/청취 목적 preset ·
 * 지시문 45 보컬 추천 · 지시문 46 시대 바닥, 이번이 다섯 번째)이 반복됐다.
 * check:reachability는 "모듈이 임포트되는가"만 본다 — data/workspaceEraFloor.ts는
 * constraints.ts가 임포트하니 reachability는 통과하지만, 그 안의
 * applyWorkspaceEraFloor 함수를 아무도 호출하지 않는 결함은 잡지 못했다
 * (§실측: 지시문 46 본문). 이 스크립트는 그 한 단계 더 깊은 질문 —
 * "이 정책 데이터를 읽는 함수가 정말 호출되는가" — 를 grep 기반으로
 * 근사 검사한다. 진짜 콜그래프 분석(번들러의 tree-shaking 수준)은 이
 * 스크립트의 범위가 아니다 — "정의는 있는데 호출부가 0곳"이라는, 이번
 * 결함과 정확히 같은 모양의 구멍만 잡는 것이 목표다(오탐보다 누락이
 * 낫다는 원칙 — §"실측 없이 blocking 을 만들지 않는다"와 같은 결).
 *
 * 판정 3단계:
 *   1. 정의(defined)      — 정책 데이터 export가 데이터 파일에 실제로 있는가
 *   2. 읽는함수(reader)    — 그 데이터를 읽는 함수/상수가 실제로 export돼 있는가
 *   3. 실행경로(consumed)  — 그 함수가 자기 자신의 정의 파일 밖(src/, tests/·
 *      scripts/ 제외)에서 실제로 호출되는가
 *
 * 셋 중 하나라도 없으면 "끊긴 정책"으로 판정한다. 이 표는 수기로 유지한다
 * (자동 발견이 아니다) — 새 정책을 추가할 때마다 POLICIES 배열에 항목을
 * 하나 더 적어야 한다. 그 자체가 이 스크립트의 정직한 한계다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface PolicyCheck {
  name: string;
  dataFile: string;
  dataExport: string;
  readerFile: string;
  /** Function or const identifier that actually reads dataExport. Checked as `${readerSymbol}(` for a function, or `${readerSymbol}[` / `${readerSymbol}.` for a direct-lookup constant. */
  readerSymbol: string;
  readerKind: 'function' | 'const-lookup';
}

const POLICIES: PolicyCheck[] = [
  {
    name: 'WORKSPACE_ERA_FLOOR',
    dataFile: 'src/data/workspaceEraFloor.ts',
    dataExport: 'WORKSPACE_ERA_FLOOR',
    readerFile: 'src/core/constraints.ts',
    readerSymbol: 'applyWorkspaceEraFloor',
    readerKind: 'function'
  },
  {
    name: 'LISTENING_INTENT_POLICY',
    dataFile: 'src/data/listeningIntentPolicy.ts',
    dataExport: 'LISTENING_INTENT_POLICY',
    readerFile: 'src/core/listeningIntent.ts',
    readerSymbol: 'applyListeningIntentToOptions',
    readerKind: 'function'
  },
  {
    name: 'PERCEIVED_ENERGY_POLICY',
    dataFile: 'src/data/perceivedEnergyPolicy.ts',
    dataExport: 'PERCEIVED_ENERGY_POLICY',
    readerFile: 'src/data/perceivedEnergyPolicy.ts',
    readerSymbol: 'PERCEIVED_ENERGY_POLICY',
    readerKind: 'const-lookup'
  },
  {
    name: 'DISTINCT_CHOICE_POLICY',
    dataFile: 'src/data/distinctChoicePolicy.ts',
    dataExport: 'DISTINCT_CHOICE_POLICY',
    readerFile: 'src/data/distinctChoicePolicy.ts',
    readerSymbol: 'distinctChoicePolicyForWorkspace',
    readerKind: 'function'
  },
  {
    name: 'PROMPT_AXIS_POLICIES',
    dataFile: 'src/data/promptAxisPolicy.ts',
    dataExport: 'PROMPT_AXIS_POLICIES',
    readerFile: 'src/data/promptAxisPolicy.ts',
    readerSymbol: 'promptAxisPolicyFor',
    readerKind: 'function'
  },
  {
    name: 'CHANNEL_SOUND_FLOORS',
    dataFile: 'src/data/channelSoundFloor.ts',
    dataExport: 'CHANNEL_SOUND_FLOORS',
    readerFile: 'src/data/channelSoundFloor.ts',
    readerSymbol: 'channelSoundFloorForArchetype',
    readerKind: 'function'
  },
  {
    name: 'MONEY_CHORD_ROTATION_POOL',
    dataFile: 'src/data/moneyChords.ts',
    dataExport: 'moneyChordRotationPool',
    readerFile: 'src/data/moneyChords.ts',
    readerSymbol: 'moneyChordRotationPool',
    readerKind: 'function'
  },
  {
    name: 'GENRE_MONEY_CHORD_AFFINITY',
    dataFile: 'src/data/genreMoneyChordAffinity.ts',
    dataExport: 'GENRE_MONEY_CHORD_AFFINITY',
    readerFile: 'src/data/genreMoneyChordAffinity.ts',
    readerSymbol: 'moneyChordAffinityForGenre',
    readerKind: 'function'
  },
  {
    name: 'GENRE_VOCAL_AFFINITY',
    dataFile: 'src/data/genreVocalAffinity.ts',
    dataExport: 'GENRE_VOCAL_AFFINITY',
    readerFile: 'src/data/genreVocalAffinity.ts',
    readerSymbol: 'vocalAffinityForGenre',
    readerKind: 'function'
  },
  {
    name: 'GENRE_VOCAL_AVOID',
    dataFile: 'src/data/genreVocalAffinity.ts',
    dataExport: 'GENRE_VOCAL_AVOID',
    readerFile: 'src/data/genreVocalAffinity.ts',
    readerSymbol: 'vocalAvoidForGenre',
    readerKind: 'function'
  },
  {
    name: 'OBJECT_STATE_POLICY',
    dataFile: 'src/data/objectStatePolicy.ts',
    dataExport: 'OBJECT_STATE_POLICY',
    readerFile: 'src/data/objectStatePolicy.ts',
    readerSymbol: 'objectStatePolicyForWorkspace',
    readerKind: 'function'
  },
  {
    name: 'BPM_ENERGY_BANDS',
    dataFile: 'src/core/bpmLengthControl.ts',
    dataExport: 'BPM_ENERGY_BANDS',
    readerFile: 'src/core/bpmLengthControl.ts',
    readerSymbol: 'resolveBpmEnergyBand',
    readerKind: 'function'
  },
  {
    name: 'WORD_BUDGET',
    dataFile: 'src/core/bpmLengthControl.ts',
    dataExport: 'wordBudgetForTarget',
    readerFile: 'src/core/bpmLengthControl.ts',
    readerSymbol: 'wordBudgetForTarget',
    readerKind: 'function'
  }
];

function listSourceFiles(): string[] {
  const out: string[] = [];
  const skipDirs = new Set(['node_modules', 'dist', '.git', 'tests', 'scripts', 'docs']);
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
  walk(path.join(ROOT, 'src'));
  return out;
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/**
 * 실측으로 드러난 결함 — 순수 `\bname\s*\(` 정규식은 "core/constraints.ts's
 * applyWorkspaceEraFloor(단위 검증 완료..." 같은 주석 속 언급도 실제 호출로
 * 오판했다(이 지시문 자신의 지시문 46 원본 커밋에서 그 문구가 실제로
 * 존재했다 — applyWorkspaceEraFloor가 아직 한 곳도 호출되지 않았던
 * 시점에도 이 스크립트가 "호출됨"으로 오판할 뻔한 실측 사례). 줄 단위로
 * "//" 주석을 잘라내고 블록 주석(슬래시-별표...별표-슬래시)을 제거한 뒤에만 패턴 매칭한다 —
 * 완벽한 파서는 아니지만(문자열 리터럴 속 "//"까지는 못 가린다) 이
 * 결함의 실제 발생 형태(설명 주석 속 함수명 언급)는 확실히 걸러낸다.
 */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments
    .split('\n')
    .map(line => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

const allSrcFiles = listSourceFiles();

function isDefined(policy: PolicyCheck): boolean {
  let text: string;
  try { text = readFile(policy.dataFile); } catch { return false; }
  const pattern = new RegExp(`export\\s+(const|function)\\s+${policy.dataExport}\\b`);
  return pattern.test(text);
}

function readerExists(policy: PolicyCheck): boolean {
  let text: string;
  try { text = readFile(policy.readerFile); } catch { return false; }
  const pattern = policy.readerKind === 'function'
    ? new RegExp(`export\\s+function\\s+${policy.readerSymbol}\\b`)
    : new RegExp(`export\\s+const\\s+${policy.readerSymbol}\\b`);
  return pattern.test(text);
}

function consumedInExecutionPath(policy: PolicyCheck): { consumed: boolean; sites: string[] } {
  const readerFileAbs = path.join(ROOT, policy.readerFile);
  const callPattern = policy.readerKind === 'function'
    ? new RegExp(`\\b${policy.readerSymbol}\\s*\\(`)
    : new RegExp(`\\b${policy.readerSymbol}\\s*(\\[|\\.)`);
  const sites: string[] = [];
  for (const file of allSrcFiles) {
    if (file === readerFileAbs) continue; // the reader's own definition file doesn't count as a consumer
    let text: string;
    try { text = stripComments(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (callPattern.test(text)) {
      sites.push(path.relative(ROOT, file).replace(/\\/g, '/'));
    }
  }
  return { consumed: sites.length > 0, sites };
}

let brokenCount = 0;
const rows: string[] = [];
rows.push(`[check:consumption] 정책 ${POLICIES.length}종\n`);
rows.push('정책'.padEnd(28) + '정의'.padEnd(6) + '읽는함수'.padEnd(10) + '실행경로'.padEnd(10) + '판정');
rows.push('-'.repeat(80));

for (const policy of POLICIES) {
  const defined = isDefined(policy);
  const hasReader = readerExists(policy);
  const { consumed, sites } = hasReader ? consumedInExecutionPath(policy) : { consumed: false, sites: [] };
  const ok = defined && hasReader && consumed;
  if (!ok) brokenCount += 1;
  const mark = (b: boolean) => (b ? '○' : '✗');
  rows.push(
    policy.name.padEnd(28) + mark(defined).padEnd(6) + mark(hasReader).padEnd(10) + mark(consumed).padEnd(10) + (ok ? '✓' : '✗ 끊김')
  );
  if (!ok) {
    if (!defined) rows.push(`    → ${policy.dataFile}에 export const/function ${policy.dataExport}가 없습니다.`);
    else if (!hasReader) rows.push(`    → ${policy.readerFile}에 export ${policy.readerKind === 'function' ? 'function' : 'const'} ${policy.readerSymbol}가 없습니다.`);
    else rows.push(`    → ${policy.readerSymbol}가 정의 파일(${policy.readerFile}) 밖 실행 경로에서 호출되지 않습니다 — 임포트는 될 수 있어도(check:reachability는 통과) 실제로 불리지 않는 상태입니다.`);
  } else {
    rows.push(`    호출부: ${sites.slice(0, 3).join(', ')}${sites.length > 3 ? ` 외 ${sites.length - 3}곳` : ''}`);
  }
}

rows.push('-'.repeat(80));
rows.push(`끊긴 정책 ${brokenCount}종 / 전체 ${POLICIES.length}종`);

console.log(rows.join('\n'));

if (brokenCount > 0) {
  console.error(`\n[check:consumption] FAIL — ${brokenCount}개 정책이 정의만 있고 실제로 소비되지 않습니다.`);
  process.exit(1);
} else {
  console.log('\n[check:consumption] 통과 — 등록된 모든 정책이 실행 경로에서 실제로 호출됩니다.');
}
