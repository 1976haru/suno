/**
 * codex 지시문 07 (TASK E) — 보안 감사. isolationAudit.ts와 같은 원칙: 이
 * 스크립트는 찾아서 보고만 합니다 — 발견된 문제를 직접 고치지 않습니다.
 * 각 checkS* 함수는 tests/securityAudit.test.ts가 그대로 import해서
 * 재사용합니다 (검사 로직을 두 벌 쓰지 않음, isolationAudit.ts의 §6-2 원칙과 동일).
 *
 * Usage: npx tsx scripts/securityAudit.ts (또는 npm run security:audit)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

export type CheckStatus = 'PASS' | 'FAIL' | 'SKIP';
export interface SecurityCheckResult {
  id: string;
  status: CheckStatus;
  detail: string;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(repoRoot, 'src');

function readAllSourceFiles(dir: string, exts = ['.ts', '.tsx']): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readAllSourceFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      files.push({ path: full, content: fs.readFileSync(full, 'utf8') });
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// 1. Dependency audit — real `npm audit` policy: 0 high/critical.
// ---------------------------------------------------------------------------
export interface DependencyAuditSummary {
  high: number;
  critical: number;
}

/** Real CI policy this task's own §명시 asks for: high/critical = 0, moderate/low reported but never blocking (dependency churn at that level is too noisy to gate on). */
export function checkDependencyAudit(): { result: SecurityCheckResult; summary: DependencyAuditSummary | null } {
  try {
    const raw = execSync('npm audit --json', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const parsed = JSON.parse(raw) as { metadata: { vulnerabilities: DependencyAuditSummary } };
    const { high, critical } = parsed.metadata.vulnerabilities;
    return {
      result: { id: 'dependency-audit', status: high + critical === 0 ? 'PASS' : 'FAIL', detail: `high=${high} critical=${critical}` },
      summary: { high, critical }
    };
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities ARE found — its stdout still has the real JSON report.
    const stdout = (err as { stdout?: string }).stdout;
    if (!stdout) return { result: { id: 'dependency-audit', status: 'FAIL', detail: `npm audit failed to run: ${String(err)}` }, summary: null };
    try {
      const parsed = JSON.parse(stdout) as { metadata: { vulnerabilities: DependencyAuditSummary } };
      const { high, critical } = parsed.metadata.vulnerabilities;
      return {
        result: { id: 'dependency-audit', status: high + critical === 0 ? 'PASS' : 'FAIL', detail: `high=${high} critical=${critical}` },
        summary: { high, critical }
      };
    } catch {
      return { result: { id: 'dependency-audit', status: 'FAIL', detail: 'could not parse npm audit output' }, summary: null };
    }
  }
}

// ---------------------------------------------------------------------------
// 2. API key never exposed to the renderer beyond the disclosed BYOK path.
// ---------------------------------------------------------------------------
/**
 * Real, already-established discipline (confirmed by investigation):
 * providers/proxyFetch.ts's buildProxyHeaders only ever sends the raw
 * apiKey when `keyStorageMode === 'local'` (the user's own explicit BYOK
 * choice, disclosed) — 'server' mode never puts the key in a header at
 * all. This check confirms that gate is still real: no OTHER real source
 * file sends `settings.apiKey`/`.accessToken` in a request without the
 * same keyStorageMode check.
 */
export function checkApiKeyExposure(): SecurityCheckResult {
  const files = readAllSourceFiles(srcDir);
  const offenders: string[] = [];
  for (const file of files) {
    if (file.path.includes('proxyFetch.ts') || file.path.includes('providerSettingsPersistence.ts')) continue; // the one real, disclosed, already-gated source
    // A real send of a raw key OUTSIDE the one disclosed gate would look like directly interpolating .apiKey/.accessToken into a header/URL without a nearby keyStorageMode check in the same file.
    if (/headers\[.*\]\s*=\s*.*\.(apiKey|accessToken)\b/.test(file.content) && !file.content.includes('keyStorageMode')) {
      offenders.push(file.path);
    }
  }
  return { id: 'api-key-renderer-exposure', status: offenders.length === 0 ? 'PASS' : 'FAIL', detail: offenders.length ? offenders.join(', ') : '0건' };
}

// ---------------------------------------------------------------------------
// 3. localStorage never receives a raw secret unconditionally.
// ---------------------------------------------------------------------------
export function checkLocalStorageSecrets(): SecurityCheckResult {
  const files = readAllSourceFiles(srcDir);
  const offenders: string[] = [];
  for (const file of files) {
    const matches = [...file.content.matchAll(/localStorage\.setItem\([^)]*\.(apiKey|accessToken)\b/g)];
    if (matches.length) offenders.push(`${file.path} (${matches.length})`);
  }
  return { id: 'localstorage-secrets', status: offenders.length === 0 ? 'PASS' : 'FAIL', detail: offenders.length ? offenders.join(', ') : '0건 — 직접 localStorage.setItem에 apiKey/accessToken을 넘기는 코드 없음' };
}

// ---------------------------------------------------------------------------
// 4/5. Snapshot / export never carries a raw secret — reuses the REAL
// existing runtime guarantees (core/generationSnapshot.ts's
// toSnapshotProviderInfo/scrubBlueprintSnapshotSecrets, core/exportMeta.ts)
// rather than re-deriving a static check; this is exercised for REAL by
// tests/securityAudit.test.ts (imports and calls the actual functions).
// ---------------------------------------------------------------------------
export const SNAPSHOT_SECRET_FIELDS = ['apiKey', 'accessToken', 'proxyEndpoint'] as const;

// ---------------------------------------------------------------------------
// 6. Logs never interpolate a raw secret.
// ---------------------------------------------------------------------------
export function checkLogSecretLeaks(): SecurityCheckResult {
  const files = readAllSourceFiles(srcDir);
  const offenders: string[] = [];
  for (const file of files) {
    const matches = [...file.content.matchAll(/console\.(log|warn|error|info|debug)\([^)]*\.(apiKey|accessToken)\b/g)];
    if (matches.length) offenders.push(`${file.path} (${matches.length})`);
  }
  return { id: 'log-secret-leak', status: offenders.length === 0 ? 'PASS' : 'FAIL', detail: offenders.length ? offenders.join(', ') : '0건' };
}

// ---------------------------------------------------------------------------
// 7. Error stacks/messages shown to the user never echo a raw secret.
// ---------------------------------------------------------------------------
export function checkErrorMessageSecretLeaks(): SecurityCheckResult {
  const files = readAllSourceFiles(srcDir);
  const offenders: string[] = [];
  for (const file of files) {
    // A thrown/rendered Error whose own message template literally interpolates .apiKey/.accessToken.
    const matches = [...file.content.matchAll(/new Error\(`[^`]*\$\{[^}]*\.(apiKey|accessToken)\b/g)];
    if (matches.length) offenders.push(`${file.path} (${matches.length})`);
  }
  return { id: 'error-message-secret-leak', status: offenders.length === 0 ? 'PASS' : 'FAIL', detail: offenders.length ? offenders.join(', ') : '0건' };
}

// ---------------------------------------------------------------------------
// 8. Uploaded file path — browsers never expose a File's real local
// filesystem path (`File.path` doesn't exist in the standard File API);
// this checks the codebase never assumes/reads one anyway.
// ---------------------------------------------------------------------------
export function checkUploadedFilePathLeak(): SecurityCheckResult {
  const files = readAllSourceFiles(srcDir);
  const offenders: string[] = [];
  for (const file of files) {
    // A real webkitRelativePath/path read on a File object being logged or sent anywhere.
    if (/\bfile\.(path|webkitRelativePath)\b/.test(file.content) && /console\.|fetch\(|body:/.test(file.content)) {
      offenders.push(file.path);
    }
  }
  return { id: 'uploaded-file-path-leak', status: offenders.length === 0 ? 'PASS' : 'FAIL', detail: offenders.length ? offenders.join(', ') : '0건 — 업로드된 파일의 로컬 경로를 읽거나 전송하는 코드 없음 (브라우저 File API 자체가 실제 경로를 노출하지 않음)' };
}

export function runSecurityAudit(): SecurityCheckResult[] {
  const { result: dependencyResult } = checkDependencyAudit();
  return [
    dependencyResult,
    checkApiKeyExposure(),
    checkLocalStorageSecrets(),
    checkLogSecretLeaks(),
    checkErrorMessageSecretLeaks(),
    checkUploadedFilePathLeak()
  ];
}

// eslint/CJS-free direct-run check (mirrors scripts/isolationAudit.ts's own convention).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const results = runSecurityAudit();
  for (const r of results) console.log(`[${r.status}] ${r.id} — ${r.detail}`);
  const failed = results.filter(r => r.status === 'FAIL');
  if (failed.length) {
    console.error(`\n${failed.length}개 보안 검사 실패.`);
    process.exit(1);
  }
  console.log('\n모든 보안 검사 통과.');
}
