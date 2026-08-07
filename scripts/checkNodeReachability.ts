/**
 * 지시문 08 TASK A-2 — 회귀 방지: scripts/audit.ts(및 다른 node/tsx 진입점)가
 * 정적 임포트로 도달하는 모든 파일 중, node에서 해석할 수 없는 Vite 전용
 * 임포트(`?worker`, `?url`)나 브라우저 전용 전역(`document.` / `window.` /
 * `import.meta.env`)을 최상단 스코프에서 쓰는 파일이 있으면 실패합니다.
 * generationPreflight.ts가 localGenerationClient.ts(`?worker` 최상단 임포트)를
 * 정적으로 끌어들여 `npm run audit`이 SyntaxError로 죽었던 사고(지시문 08
 * §0-1)의 재발을 막는 것이 유일한 목적입니다 — 이 스크립트는 찾아서 보고만
 * 합니다, 발견된 문제를 직접 고치지 않습니다.
 *
 * "최상단 스코프"는 함수/화살표 함수 본문 바깥, 즉 import 직후 모듈이 로드되는
 * 즉시 실행되는 코드를 뜻합니다. 문자열·주석·템플릿 리터럴 내부를 지운 뒤 중괄호
 * 깊이를 세어 근사합니다 — 중괄호 없는 단일 표현식 화살표 함수
 * (`const f = () => window.x`) 는 이 근사가 놓칠 수 있는 알려진 한계입니다.
 *
 * Usage: npx tsx scripts/checkNodeReachability.ts (또는 npm run check:node)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ENTRY_POINTS = ['scripts/audit.ts'];

const FORBIDDEN_TOP_LEVEL = ['document.', 'window.', 'import.meta.env'];
const FORBIDDEN_IMPORT_SUFFIXES = ['?worker', '?url'];

export interface ReachabilityFinding {
  file: string;
  reason: string;
}

/** Import/re-export specifiers this file references (only relative ones matter for graph-walking; bare package specifiers are ignored). */
function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /\bimport\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  const exportFromRe = /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
  for (const re of [importRe, exportFromRe]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolves a relative import specifier to a real file on disk, trying the extensions/index forms TS/Vite would. Returns null for specifiers that carry a Vite query suffix (?worker/?url) — those are recorded as violations, not followed. */
function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null; // bare package specifier — not part of this repo's graph
  if (FORBIDDEN_IMPORT_SUFFIXES.some(suffix => specifier.endsWith(suffix))) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Strips string/template-literal/comment contents (replacing with spaces so offsets and brace-count are unaffected) so brace-depth tracking and text search below don't false-positive on braces or forbidden-looking text inside quotes/comments. */
function stripNoise(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const two = source.slice(i, i + 2);
    if (two === '//') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (c === '`' || c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      while (j < n && source[j] !== quote) {
        if (source[j] === '\\') j += 2;
        else j++;
      }
      const stop = Math.min(j + 1, n);
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Reports forbidden Vite/browser-only usages that execute at module-load time (brace depth 0 in the noise-stripped source), plus any `?worker`/`?url` import specifier (always top-level by ES module syntax, so always a violation regardless of depth). */
function findTopLevelViolations(file: string, source: string): string[] {
  const violations: string[] = [];

  for (const specifier of extractImportSpecifiers(source)) {
    if (FORBIDDEN_IMPORT_SUFFIXES.some(suffix => specifier.endsWith(suffix))) {
      violations.push(`최상단 임포트가 Vite 전용 문법을 사용함: '${specifier}' (node/tsx에서 해석 불가)`);
    }
  }

  const stripped = stripNoise(source);
  let depth = 0;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth !== 0) continue;
    for (const needle of FORBIDDEN_TOP_LEVEL) {
      if (stripped.startsWith(needle, i)) {
        const lineNo = stripped.slice(0, i).split('\n').length;
        violations.push(`최상단 스코프(중괄호 깊이 0)에서 '${needle}' 사용 (${path.relative(repoRoot, file)}:${lineNo})`);
      }
    }
  }

  return violations;
}

export function checkNodeReachability(entryPoints: string[] = ENTRY_POINTS): ReachabilityFinding[] {
  const findings: ReachabilityFinding[] = [];
  const visited = new Set<string>();
  const queue: string[] = entryPoints.map(entry => path.resolve(repoRoot, entry));

  while (queue.length) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    if (!fs.existsSync(file)) continue;

    const source = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(repoRoot, file);

    for (const violation of findTopLevelViolations(file, source)) {
      findings.push({ file: relPath, reason: violation });
    }

    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveRelative(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }

  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const findings = checkNodeReachability();
  if (findings.length === 0) {
    console.log(`[check:node] 통과 — ${ENTRY_POINTS.join(', ')} 에서 정적으로 도달하는 파일 중 node에서 해석 불가한 파일 없음.`);
  } else {
    console.error(`[check:node] 실패 — ${findings.length}건:\n`);
    for (const f of findings) console.error(`  ${f.file}\n    ${f.reason}`);
    process.exit(1);
  }
}
