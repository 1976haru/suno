/**
 * 지시문 18 (TASK B-3) — 버전 문자열 단일 출처 검사. 인수인계 문서 §3-1의
 * 실제 사고 재발 방지: "package.json 5.14.0 / 실제 작업 v5.24 ← 불일치".
 * `package.json`의 `version`이 유일한 진실이고, `src/core/buildInfo.ts`의
 * `APP_VERSION`이 (Vite define을 통해) 이미 여기서 파생한다 — 이 스크립트가
 * 실제로 검사하는 건 그 파생이 조용히 어긋나는 두 가지 경우다:
 *
 *   1) package.json의 version이 이 지시문이 도입한 0.NN.P 체계(0.x, 아직
 *      1.0.0 승격 조건을 달성하지 못함)를 벗어났다.
 *   2) docs/CHANGELOG.md의 최상단 항목 버전이 package.json과 어긋난다 —
 *      "문서와 package.json이 따로 논다"는 원래 사고를 그대로 재현하는
 *      가장 직접적인 경로이므로, 최상단 항목이 항상 지금 버전과 일치해야
 *      한다고 강제한다.
 *
 * Usage: npx tsx scripts/checkVersion.ts (또는 npm run check:version)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ZERO_X_VERSION_PATTERN = /^0\.\d+\.\d+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const CHANGELOG_HEADING_PATTERN = /^##\s+(\d+\.\d+\.\d+)\s+—/m;

export interface VersionCheckResult {
  packageVersion: string;
  isValidSemver: boolean;
  isZeroXScheme: boolean;
  changelogTopVersion: string | null;
  changelogMatches: boolean;
  passed: boolean;
  reasonsKo: string[];
}

export function checkVersion(): VersionCheckResult {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')) as { version: string };
  const packageVersion = packageJson.version;
  const isValidSemver = SEMVER_PATTERN.test(packageVersion);
  const isZeroXScheme = ZERO_X_VERSION_PATTERN.test(packageVersion);

  const changelogPath = path.join(repoRoot, 'docs', 'CHANGELOG.md');
  const changelogText = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf-8') : '';
  const headingMatch = changelogText.match(CHANGELOG_HEADING_PATTERN);
  const changelogTopVersion = headingMatch ? headingMatch[1] : null;
  const changelogMatches = changelogTopVersion === packageVersion;

  const reasonsKo: string[] = [];
  if (!isValidSemver) reasonsKo.push(`package.json version "${packageVersion}"이 유효한 semver(x.y.z)가 아닙니다.`);
  // 1.0.0 승격 조건(§B-2)을 실제로 달성했다는 실측 근거가 이 저장소 어디에도
  // 없다 — 그래서 0.x 밖으로 나가면 항상 실패다(1.0.0 조건 달성 시 이
  // 스크립트도 함께 갱신해야 한다, 조용히 통과시키지 않는다).
  if (isValidSemver && !isZeroXScheme) reasonsKo.push(`package.json version "${packageVersion}"이 0.NN.P 체계를 벗어났습니다 — 1.0.0 승격 조건(docs/CHANGELOG.md 하단)을 실제로 달성했는지 먼저 확인하십시오.`);
  if (!changelogTopVersion) reasonsKo.push('docs/CHANGELOG.md에서 "## X.Y.Z — ..." 형태의 최상단 항목을 찾지 못했습니다.');
  else if (!changelogMatches) reasonsKo.push(`docs/CHANGELOG.md 최상단 항목(${changelogTopVersion})이 package.json version(${packageVersion})과 어긋납니다.`);

  return {
    packageVersion,
    isValidSemver,
    isZeroXScheme,
    changelogTopVersion,
    changelogMatches,
    passed: reasonsKo.length === 0,
    reasonsKo
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = checkVersion();
  console.log(`[check:version] package.json version=${result.packageVersion} · CHANGELOG 최상단=${result.changelogTopVersion ?? '(없음)'}`);
  if (result.passed) {
    console.log('✅ 통과 — 버전 문자열이 단일 출처(package.json)와 일치합니다.');
  } else {
    console.error('❌ 실패:');
    for (const reason of result.reasonsKo) console.error(`  - ${reason}`);
    process.exit(1);
  }
}
