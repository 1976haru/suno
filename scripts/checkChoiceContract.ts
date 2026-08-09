/**
 * 지시문 24 TASK C — 13개 정본 UserExplicitChoices/GenerationChoiceProvenance
 * 축(types.ts:695-708) 전체를 "입력 경로(a) / 실제 소비 지점(b) / 가드 체크(c)"
 * 3가지로 감사한다. genreIds가 정확히 이 모양의 결함이었다 — 입력은 있고
 * (choices.source.genreIds가 정상적으로 채워짐), 소비는 없고(directSetLocal이
 * choices.genreIds를 한 번도 읽지 않음), 가드는 있었다(checkUserChoicesPreservation)
 * — "입력 있음·소비 없음·가드 있음"의 조합이 실제 프로덕션 차단 오류로
 * 이어졌다. 나머지 12축도 같은 3중 결함이 있는지 실측했다(Explore 서브에이전트가
 * 파일:라인 단위로 추적, 이 스크립트가 그 결과를 실행 가능한 회귀 방지 계약으로
 * 고정한다).
 *
 * (c) 가드 체크는 기계적으로 검증 가능하다 — computeStructuredViolations의
 * 실제 소스 텍스트에서 `choices.source.<axis>` 패턴이 등장하는지 스캔한다.
 * (a) 입력 경로 (b) 실제 소비 지점은 정적 분석만으로 신뢰성 있게 판정하기
 * 어렵다(§9 실측 원칙 — 의미론적 판단은 매크로가 아니라 사람이 코드를 읽고
 * 확인해야 한다) — 이 스크립트는 방금 완료한 실측 감사 결과를 파일:라인
 * 인용과 함께 테이블로 고정한다. 두 신호가 어긋나면(예: 스캔이 가드 있음을
 * 발견했는데 테이블은 없음으로 기록돼 있으면) 이 스크립트 자체가 실패해
 * 테이블이 소스와 따로 놀지 않도록 강제한다.
 *
 * Usage: npx tsx scripts/checkChoiceContract.ts (또는 npm run check:choices)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const userChoicesPath = path.join(repoRoot, 'src', 'core', 'userChoices.ts');

type ConsumptionKind = 'via-choices' | 'via-opts-only' | 'missing';

interface AxisAudit {
  axis: string;
  /** (a) — Step2Concept.tsx(또는 다른 Step 컴포넌트)에서 사용자 조작이 choiceProvenance.<axis>='user'와 실제 값을 설정하는 지점. */
  inputKo: string;
  /** (b) — 실제 생성 로직이 opts.<axis>가 아니라 choices.<axis>(그리고 choices.source.<axis>==='user' 체크)를 읽어 결과에 반영하는지. */
  consumption: ConsumptionKind;
  consumptionKo: string;
  /** (c) — computeStructuredViolations에 이 축의 분기가 있는지는 아래서 기계적으로 재검증한다. 여기 값은 사람이 읽은 실측 결과(스캔과 반드시 일치해야 함). */
  guardExpected: boolean;
  guardKo: string;
}

// 지시문 24 TASK C 실측 — Explore 서브에이전트가 Step2*.tsx/setDirector.ts/
// localGenerator.ts/batchPreallocation.ts/constraints.ts/genreRotation.ts/
// packagingLanguage.ts/lyricDiversityPlan.ts를 전수 조사(파일:라인 인용 포함),
// 이어서 vocalToneApplied 배선 결함을 직접 재검증했다(setDirector.ts:1160-1166).
const AXIS_AUDIT: AxisAudit[] = [
  {
    axis: 'moneyChordMode',
    inputKo: 'Step2Concept.tsx:963-973(ChoiceGrid), :1314-1317(커스텀 입력)',
    consumption: 'via-choices',
    consumptionKo: 'setDirector.ts:720,743 buildBaseOptions가 choices 기반으로 반영; 실제 생성기(batchPreallocation.ts/localGenerator.ts)는 그 결과인 opts.moneyChordMode를 읽음',
    guardExpected: true,
    guardKo: 'userChoices.ts:415-428'
  },
  {
    axis: 'vocalTone',
    inputKo: 'Step2Concept.tsx:907,913,950',
    consumption: 'via-choices',
    consumptionKo: 'setDirector.ts:731 buildBaseOptions',
    guardExpected: true,
    guardKo: 'userChoices.ts:430-438 — 단, checkUserChoicesPreservation(setDirector.ts:1154-1170)이 resolved.vocalToneApplied를 전달하지 않아 SetPlan 생성 단계에서는 이 분기가 절대 발동하지 않는다(undefined !== false). buildResolvedGenerationContract 쪽 호출에서만 실제로 발동 — 부분 배선 결함.'
  },
  {
    axis: 'genreIds',
    inputKo: '(이미 수정됨 — 지시문 24 TASK A)',
    consumption: 'via-choices',
    consumptionKo: 'setDirector.ts:1502-1609 — 이번 세션에 수정',
    guardExpected: true,
    guardKo: 'userChoices.ts:440-464 — 이번 세션에 부분 누락도 잡도록 강화(TASK B)'
  },
  {
    axis: 'lyricLanguage',
    inputKo: 'Step2Concept.tsx:1208',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:725는 미리보기(SetPlan)만 보호; 실제 생성기(localGenerator.ts:1296-2264)는 opts.lyricLanguage를 직접 읽어 choices 보호를 거치지 않음',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'packagingLanguage',
    inputKo: 'Step2Concept.tsx:1222',
    consumption: 'via-opts-only',
    consumptionKo: 'core/packagingLanguage.ts:20-21 resolvePackagingLanguage가 opts.packagingLanguage만 읽음 — choices.packagingLanguage를 읽는 곳이 src/core 어디에도 없음',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'perspective',
    inputKo: 'Step2Concept.tsx:1257-1258',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:732,816은 미리보기만; 실제 생성기(lyricDiversityPlan.ts:402, promptComposer.ts:1323,1406)는 opts.perspective 직접 사용',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'perspectiveMode',
    inputKo: 'Step2Concept.tsx:1262-1298',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:738-739은 미리보기만; resolvePerspectiveMode(lyricDiversityPlan.ts:403)는 opts.perspectiveMode/opts.perspectiveModeIsExplicitChoice 직접 사용',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'genreBlendMode',
    inputKo: 'Step2Concept.tsx:750-786',
    consumption: 'via-opts-only',
    consumptionKo: 'core/genreRotation.ts:61-62 resolveGenreBlendMode가 opts.genreBlendMode만 읽음(?? \'shared-primary\' 무경고 폴백 포함) — buildBaseOptions는 genreBlendMode 필드 자체를 반환하지 않음',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'seasonId',
    inputKo: 'Step2Concept.tsx:599-601',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:730은 미리보기만 보호; 실제 생성 경로는 opts.seasonId를 choices 우회로 직접 소비',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'songCount',
    inputKo: 'Step3Generate.tsx:1422-1439',
    consumption: 'via-opts-only',
    consumptionKo: '실제 생성 전 구간에서 opts.songCount 직접 사용. 추가로 App.tsx:503,646이 choiceProvenance 갱신 없이 opts.songCount를 사후 재작성 — user 출처 태그가 남은 채 값만 바뀔 수 있음(가장 심각한 사례)',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'breadth',
    inputKo: 'Step2Plan.tsx:492-500 (breadthOverride)',
    consumption: 'via-opts-only',
    consumptionKo: 'constraints.ts:935-936 detectConceptBreadth가 opts.breadthOverride 직접 사용; buildBaseOptions는 breadth/breadthOverride 필드를 아예 반환하지 않음',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'paletteFamilyId',
    inputKo: 'Step2Plan.tsx:400,521 (paletteFamilyOverride)',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:1501 resolveMainFamilyId·Step2Plan.tsx:198 모두 opts.paletteFamilyOverride 원본을 직접 사용',
    guardExpected: false,
    guardKo: '없음'
  },
  {
    axis: 'kidsAgeTierId',
    inputKo: 'App.tsx:237,258 — 실제로는 항상 source:\'channel\'만 생성됨(Step1Channel.tsx:559-560의 채널 편집기 draft 경유). \'user\' 출처는 설계상 존재하지 않음',
    consumption: 'via-opts-only',
    consumptionKo: 'localGenerator.ts:133-135 resolveKidsAgeTierId가 opts.kidsAgeTierId ?? opts.channel.kidsAgeTierId 직접 사용',
    guardExpected: false,
    guardKo: '없음'
  }
];

function extractFunctionBody(source: string, functionName: string): string {
  const startMatch = source.match(new RegExp(`function\\s+${functionName}\\s*\\(`));
  if (!startMatch || startMatch.index === undefined) {
    throw new Error(`[check:choices] ${functionName} 함수를 찾지 못했습니다 — userChoices.ts 구조가 바뀌었는지 확인하십시오.`);
  }
  const openBraceIndex = source.indexOf('{', startMatch.index);
  let depth = 0;
  let i = openBraceIndex;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(openBraceIndex, i + 1);
}

function main() {
  const source = fs.readFileSync(userChoicesPath, 'utf8');
  const guardBody = extractFunctionBody(source, 'computeStructuredViolations');

  let mismatchCount = 0;
  let violationCount = 0;
  const rows: { axis: string; a: boolean; b: ConsumptionKind; c: boolean; verdict: string }[] = [];

  console.log('[check:choices] 지시문 24 TASK C — 13개 정본 축 계약 감사\n');

  for (const entry of AXIS_AUDIT) {
    // (c) 기계적 재검증 — choices.source.<axis> 패턴이 실제로 computeStructuredViolations
    // 안에 있는지 소스에서 다시 스캔한다. 위 테이블의 guardExpected와 다르면
    // 테이블이 소스와 따로 논다는 뜻이라 즉시 실패시킨다.
    const guardPattern = new RegExp(`choices\\.source\\.${entry.axis}\\b`);
    const guardFoundInSource = guardPattern.test(guardBody);
    if (guardFoundInSource !== entry.guardExpected) {
      console.log(`✗ AUDIT TABLE DRIFT  ${entry.axis} — 테이블은 guardExpected=${entry.guardExpected}인데 실제 소스 스캔 결과는 ${guardFoundInSource}입니다. AXIS_AUDIT 테이블을 재실측해 갱신하십시오.`);
      mismatchCount++;
    }

    const hasInput = true; // 12축 전부 실측으로 입력 경로 확인됨(위 inputKo 인용) — genreIds는 이미 수정 완료.
    const hasConsumption = entry.consumption === 'via-choices';
    const hasGuard = entry.guardExpected;
    const isViolation = !hasInput || !hasConsumption || !hasGuard;

    const verdict = isViolation ? 'CONTRACT VIOLATION' : 'OK';
    if (isViolation) violationCount++;

    rows.push({ axis: entry.axis, a: hasInput, b: entry.consumption, c: hasGuard, verdict });

    const mark = isViolation ? '✗' : '✓';
    console.log(`${mark} ${entry.axis.padEnd(18)} 입력:${hasInput ? 'O' : 'X'}  소비:${entry.consumption.padEnd(13)}  가드:${hasGuard ? 'O' : 'X'}  → ${verdict}`);
    if (isViolation) {
      console.log(`    입력: ${entry.inputKo}`);
      console.log(`    소비: ${entry.consumptionKo}`);
      console.log(`    가드: ${entry.guardKo}\n`);
    }
  }

  console.log(`\n통과(OK) ${rows.length - violationCount} / CONTRACT VIOLATION ${violationCount}  (총 ${rows.length}축, 감사표-소스 불일치 ${mismatchCount}건)`);

  if (violationCount > 0 || mismatchCount > 0) {
    process.exitCode = 1;
  }
}

main();
