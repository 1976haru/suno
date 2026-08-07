/**
 * 지시문 08 TASK C-2/C-3 — 앱이 실제로 도달하는 소스 파일 집합을 계산합니다.
 * 진입점 3개(src/main.tsx, src/App.tsx, src/workers/localGenerationWorker.ts)에서
 * 정적 임포트(`import ... from`, `export ... from`)와 동적 임포트(`import(...)`)를
 * 모두 따라가, src/**\/*.ts(x) 전체 목록과 대조해 도달 불가 파일을 나열합니다.
 * 지시문 01~06이 만든 신규 모듈이 "존재하지만 앱 어디에서도 실제로 불리지
 * 않는" 상태(새 오케스트레이터 파일 하나가 그 모듈을 부르지만 그 오케스트레이터
 * 자체가 도달 불가한 경우 포함)를 잡아내는 것이 목적입니다. 찾아서 보고만
 * 합니다 — 발견된 문제를 이 파일이 직접 고치지 않습니다.
 *
 * Usage: npx tsx scripts/checkReachability.ts (또는 npm run check:reachability)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(repoRoot, 'src');

const ENTRY_POINTS = ['src/main.tsx', 'src/App.tsx', 'src/workers/localGenerationWorker.ts'];

/** Every real source file in src/ — the universe this check partitions into reachable/unreachable. Test files and .d.ts declaration files aren't part of the app's own reachability graph. */
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

/** Static import/re-export specifiers plus dynamic import() specifiers — both count toward real reachability here (unlike checkNodeReachability.ts, this script isn't distinguishing load-time-eager from lazy, only "does anything in the app's own graph ever reference this file at all"). */
function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /\bimport\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  const exportFromRe = /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [importRe, exportFromRe, dynamicImportRe]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const clean = specifier.split('?')[0]; // strip Vite query suffixes (?worker/?url) before resolving the underlying file
  const base = path.resolve(path.dirname(fromFile), clean);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export interface ReachabilityReport {
  reachable: string[];
  unreachable: string[];
  totalFiles: number;
}

export function checkReachability(entryPoints: string[] = ENTRY_POINTS): ReachabilityReport {
  const allFiles = listAllSourceFiles(srcDir).map(f => path.resolve(f));
  const visited = new Set<string>();
  const queue: string[] = entryPoints.map(entry => path.resolve(repoRoot, entry));

  while (queue.length) {
    const file = queue.shift()!;
    if (visited.has(file) || !fs.existsSync(file)) continue;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveRelative(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }

  const reachable = allFiles.filter(f => visited.has(f)).map(f => path.relative(repoRoot, f).replace(/\\/g, '/')).sort();
  const unreachable = allFiles.filter(f => !visited.has(f)).map(f => path.relative(repoRoot, f).replace(/\\/g, '/')).sort();
  return { reachable, unreachable, totalFiles: allFiles.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = checkReachability();
  console.log(`[check:reachability] 진입점: ${ENTRY_POINTS.join(', ')}`);
  console.log(`[check:reachability] 전체 소스 파일 ${report.totalFiles}개 중 도달 가능 ${report.reachable.length}개 / 도달 불가 ${report.unreachable.length}개\n`);
  if (report.unreachable.length) {
    console.error('도달 불가 파일:');
    for (const f of report.unreachable) console.error(`  ${f}`);
    process.exit(1);
  } else {
    console.log('도달 불가 파일 없음.');
  }
}
