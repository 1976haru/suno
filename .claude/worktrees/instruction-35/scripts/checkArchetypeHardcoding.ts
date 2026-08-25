/**
 * 지시문 15 TASK D-1 — "archetype === '리터럴'" 하드코딩 재발 방지 검사.
 * 지시문 02 TASK A가 명시적으로 금지한 `if (senior) ... else if (kids) ...`
 * 패턴이 어댑터(policy registry)를 만든 뒤에도 13개 파일에 남아 있었다는
 * 실측(§0-2)에서 시작한다 — 어댑터를 만드는 것만으로는 재발을 막지
 * 못한다. "지금 있는 걸 한 번에 지울 수는 없다. 줄어드는 것을 강제한다."
 *
 * scripts/archetypeHardcodingAllowlist.ts에 없는 파일에서 하드코딩이
 * 발견되면 무조건 실패 — 이 지시문이 만드는 신규 코드(distinctChoiceGate.ts
 * 등)의 하드코딩은 allowlist에 올릴 수 없다는 원칙을 이 스크립트 자신이
 * 강제한다. allowlist에 있는 파일도 선언된 count를 초과하면 실패 — 새로
 * 늘릴 수는 없고 줄이는 것만 가능하다.
 *
 * Usage: npx tsx scripts/checkArchetypeHardcoding.ts (또는 npm run check:archetype)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ARCHETYPE_HARDCODING_ALLOWLIST } from './archetypeHardcodingAllowlist';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(repoRoot, 'src');

// archetype === '리터럴' 또는 '리터럴' === archetype 형태의 하드코딩된 아키타입
// 비교. 변수/프로퍼티 비교(예: guard.archetype === archetype, archetype === choice.id)는
// 매칭하지 않는다 — 그런 코드는 데이터 테이블 조회·UI 상태 비교라 이 검사의
// 대상이 아니다(정책 registry로 옮길 대상은 "이 리터럴이면 이 값" 분기다).
const HARDCODE_PATTERN = /\barchetype\s*===\s*'[a-z0-9-]+'|'[a-z0-9-]+'\s*===\s*[\w.?]*\barchetype\b/gi;

function listAllSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listAllSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      files.push(full);
    }
  }
  return files;
}

/** 줄 단위로 하드코딩 존재 여부를 센다(한 줄에 ||로 여러 리터럴을 비교해도 "한 곳") — 지시문 원문의 실측 방식과 일치시킨 것. 주석 줄(트림 후 //, *, /** 로 시작)은 제외한다. */
function countHardcodedLines(filePath: string): { line: number; text: string }[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const hits: { line: number; text: string }[] = [];
  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**')) return;
    HARDCODE_PATTERN.lastIndex = 0;
    if (HARDCODE_PATTERN.test(rawLine)) {
      hits.push({ line: idx + 1, text: trimmed });
    }
  });
  return hits;
}

export interface ArchetypeHardcodingReport {
  byFile: { file: string; hits: { line: number; text: string }[] }[];
  totalCount: number;
}

export function scanArchetypeHardcoding(): ArchetypeHardcodingReport {
  const allFiles = listAllSourceFiles(srcDir);
  const byFile: { file: string; hits: { line: number; text: string }[] }[] = [];
  let totalCount = 0;
  for (const absFile of allFiles) {
    const hits = countHardcodedLines(absFile);
    if (!hits.length) continue;
    const relFile = path.relative(repoRoot, absFile).replace(/\\/g, '/');
    byFile.push({ file: relFile, hits });
    totalCount += hits.length;
  }
  return { byFile: byFile.sort((a, b) => a.file.localeCompare(b.file)), totalCount };
}

export interface ArchetypeHardcodingCheckResult {
  report: ArchetypeHardcodingReport;
  /** allowlist에 없는 파일에서 하드코딩이 발견됨 — 즉시 실패 사유. */
  undeclaredFiles: { file: string; count: number }[];
  /** allowlist 선언 count보다 실제 개수가 많은 파일 — 즉시 실패 사유. */
  overBudgetFiles: { file: string; declared: number; actual: number }[];
  /** allowlist 선언 count보다 실제 개수가 적은(개선된) 파일 — 실패 아님, allowlist 갱신 권장. */
  underBudgetFiles: { file: string; declared: number; actual: number }[];
  allowlistTotal: number;
  actualTotal: number;
  passed: boolean;
}

export function checkArchetypeHardcoding(): ArchetypeHardcodingCheckResult {
  const report = scanArchetypeHardcoding();
  const allowlistByFile = new Map(ARCHETYPE_HARDCODING_ALLOWLIST.map(e => [e.file, e]));
  const actualByFile = new Map(report.byFile.map(f => [f.file, f.hits.length]));

  const undeclaredFiles: { file: string; count: number }[] = [];
  const overBudgetFiles: { file: string; declared: number; actual: number }[] = [];
  const underBudgetFiles: { file: string; declared: number; actual: number }[] = [];

  for (const [file, actual] of actualByFile) {
    const entry = allowlistByFile.get(file);
    if (!entry) {
      undeclaredFiles.push({ file, count: actual });
    } else if (actual > entry.count) {
      overBudgetFiles.push({ file, declared: entry.count, actual });
    } else if (actual < entry.count) {
      underBudgetFiles.push({ file, declared: entry.count, actual });
    }
  }

  const allowlistTotal = ARCHETYPE_HARDCODING_ALLOWLIST.reduce((sum, e) => sum + e.count, 0);
  const actualTotal = report.totalCount;
  const passed = undeclaredFiles.length === 0 && overBudgetFiles.length === 0 && actualTotal <= allowlistTotal;

  return { report, undeclaredFiles, overBudgetFiles, underBudgetFiles, allowlistTotal, actualTotal, passed };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = checkArchetypeHardcoding();
  console.log(`[check:archetype] 실측 ${result.actualTotal}곳 / allowlist 총계 ${result.allowlistTotal}곳\n`);

  for (const { file, hits } of result.report.byFile) {
    const entry = ARCHETYPE_HARDCODING_ALLOWLIST.find(e => e.file === file);
    const tag = entry ? `allowlist(${entry.count}, ${entry.plannedRemovalIn})` : '✗ 미등록';
    console.log(`  ${file} — ${hits.length}곳 [${tag}]`);
    for (const hit of hits) console.log(`    L${hit.line}: ${hit.text.slice(0, 100)}`);
  }
  console.log('');

  if (result.underBudgetFiles.length) {
    console.log('⚠ allowlist 선언보다 실제가 적음 (개선됨 — allowlist count를 낮추십시오):');
    for (const f of result.underBudgetFiles) console.log(`  ${f.file}: 선언 ${f.declared} → 실측 ${f.actual}`);
    console.log('');
  }

  if (result.undeclaredFiles.length) {
    console.error('❌ allowlist에 없는 파일에서 하드코딩 발견 (scripts/archetypeHardcodingAllowlist.ts에 사유를 추가하거나 제거하십시오 — 이 지시문이 만든 신규 코드는 추가할 수 없습니다):');
    for (const f of result.undeclaredFiles) console.error(`  ${f.file}: ${f.count}곳`);
  }
  if (result.overBudgetFiles.length) {
    console.error('❌ allowlist 선언보다 실제가 많음 (새로 늘어난 하드코딩):');
    for (const f of result.overBudgetFiles) console.error(`  ${f.file}: 선언 ${f.declared} → 실측 ${f.actual}`);
  }
  if (result.actualTotal > result.allowlistTotal) {
    console.error(`❌ 전체 총계 초과: 실측 ${result.actualTotal} > allowlist 총계 ${result.allowlistTotal}`);
  }

  if (result.passed) {
    console.log(`✅ 통과 — 실측 ${result.actualTotal}곳 ≤ allowlist 총계 ${result.allowlistTotal}곳, 미등록 0개`);
  } else {
    process.exit(1);
  }
}
