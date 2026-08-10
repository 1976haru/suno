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
 * 지시문 30 TASK D — 이 스크립트가 실측한 대로 lyricLanguage는 처음부터
 * CONTRACT VIOLATION으로 잡혀 있었다(consumption via-opts-only, guard 없음).
 * 문제는 이 스크립트가 한 번도 CI에 배선되지 않았다는 것 — `npm run
 * check:choices`가 package.json에는 있지만 .github/workflows/ci.yml 어디에도
 * 없었다(grep 확인). 지시문 24 TASK C의 "13축 전수 점검"은 이미 구현돼
 * 있었고 정확했는데, 아무도 그 결과를 보지 못했다. 지시문 30이 하는 일:
 *  1. CI에 실제로 배선한다(ci.yml에 새 job 추가).
 *  2. 그 사이 늘어난 7개 확장 축(moodIds/durationTarget/lyricDepth/hookMode/
 *     referenceMood/negativeStyle/avoidWords, GenerationChoiceProvenance
 *     types.ts:711-738 참고)을 표에 추가해 13→20축으로 넓힌다.
 *  3. "강등추적(d)" 열을 추가한다 — (c) 가드가 "값이 살아남았는가"만 보는
 *     반면, 이건 "'user' 출처 자체가 조용히 다른 값으로 바뀌었는가"를 본다.
 *     lyricLanguage가 정확히 이 유형이었다(App.tsx의 applyChannelToOptions가
 *     provenance를 'channel'로 재기록 — 지시문 30 TASK A/D-2).
 *  4. listeningIntent를 별도 행으로 추가한다 — GenerationChoiceProvenance의
 *     정식 축은 아니지만(20개에 안 낌), 같은 "입력 있음·소비 없음" 결함
 *     유형이었다(지시문 30 TASK B) — 이 표가 놓치면 안 되는 이유가 여기 있다.
 *
 * (c)/(d) 가드·강등추적 체크는 기계적으로 검증 가능하다 — (c)는
 * computeStructuredViolations의 실제 소스 텍스트에서 `choices.source.<axis>`
 * 패턴이 등장하는지 스캔하고, (d)는 core/userChoices.ts가 export하는
 * GUARDED_PROVENANCE_FIELDS/DEMOTION_TRACKED_PROVENANCE_FIELDS를 실제로
 * import해서 대조한다(두 코드 다 "실제로 뭘 하는지"를 읽는 것이지, 이 표의
 * 손으로 쓴 값을 그대로 믿지 않는다). (a) 입력 경로 (b) 실제 소비 지점은
 * 정적 분석만으로 신뢰성 있게 판정하기 어렵다(§9 실측 원칙 — 의미론적
 * 판단은 매크로가 아니라 사람이 코드를 읽고 확인해야 한다) — 이 스크립트는
 * 실측 감사 결과를 파일:라인 인용과 함께 테이블로 고정한다. 신호가
 * 어긋나면(예: 스캔이 가드 있음을 발견했는데 테이블은 없음으로 기록돼
 * 있으면) 이 스크립트 자체가 실패해 테이블이 소스와 따로 놀지 않도록
 * 강제한다.
 *
 * Usage: npx tsx scripts/checkChoiceContract.ts (또는 npm run check:choices)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMOTION_TRACKED_PROVENANCE_FIELDS, GUARDED_PROVENANCE_FIELDS } from '../src/core/userChoices';
import type { GenerationChoiceProvenance } from '../src/types';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const userChoicesPath = path.join(repoRoot, 'src', 'core', 'userChoices.ts');

type ConsumptionKind = 'via-choices' | 'via-opts-only' | 'missing';

interface AxisAudit {
  axis: keyof GenerationChoiceProvenance;
  /** (a) — Step2Concept.tsx(또는 다른 Step 컴포넌트)에서 사용자 조작이 choiceProvenance.<axis>='user'와 실제 값을 설정하는 지점. */
  inputKo: string;
  /** (b) — 실제 생성 로직이 opts.<axis>가 아니라 choices.<axis>(그리고 choices.source.<axis>==='user' 체크)를 읽어 결과에 반영하는지. */
  consumption: ConsumptionKind;
  consumptionKo: string;
  /** (c) — computeStructuredViolations에 이 축의 분기가 있는지는 아래서 기계적으로 재검증한다. 여기 값은 사람이 읽은 실측 결과(스캔과 반드시 일치해야 함). */
  guardExpected: boolean;
  /** (d) 지시문 30 TASK D-2 — App.tsx의 applyChannelToOptions 같은 실경로가 이 축의 'user' provenance를 조용히 다른 값으로 낮추는 것 자체를 탐지하는 코드가 실제로 있는가. DEMOTION_TRACKED_PROVENANCE_FIELDS(core/userChoices.ts)와 아래서 기계적으로 대조한다. */
  demotionTrackedExpected: boolean;
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
    guardKo: 'userChoices.ts:415-428',
    demotionTrackedExpected: false
  },
  {
    axis: 'vocalTone',
    inputKo: 'Step2Concept.tsx:907,913,950',
    consumption: 'via-choices',
    consumptionKo: 'setDirector.ts:731 buildBaseOptions',
    guardExpected: true,
    guardKo: 'userChoices.ts:430-438 — 단, checkUserChoicesPreservation(setDirector.ts:1154-1170)이 resolved.vocalToneApplied를 전달하지 않아 SetPlan 생성 단계에서는 이 분기가 절대 발동하지 않는다(undefined !== false). buildResolvedGenerationContract 쪽 호출에서만 실제로 발동 — 부분 배선 결함.',
    demotionTrackedExpected: true // 지시문 30 TASK D-2 — App.tsx의 applyChannelToOptions가 채널 전환 시 조용히 'channel'로 되돌리는 것을 detectProvenanceDowngrades로 경고
  },
  {
    axis: 'genreIds',
    inputKo: '(이미 수정됨 — 지시문 24 TASK A)',
    consumption: 'via-choices',
    consumptionKo: 'setDirector.ts:1502-1609 — 이번 세션에 수정',
    guardExpected: true,
    guardKo: 'userChoices.ts:440-464 — 이번 세션에 부분 누락도 잡도록 강화(TASK B)',
    demotionTrackedExpected: false // 지시문 30 §하지 말 것 — "지시문 24의 사용자 장르 선택 로직을 건드리지 말 것", applyChannelToOptions는 여전히 무조건 덮음(의도적 미배선)
  },
  {
    axis: 'lyricLanguage',
    inputKo: 'Step2Concept.tsx:1208',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:725는 미리보기(SetPlan)만 보호; 실제 생성기(localGenerator.ts:1296-2264)는 opts.lyricLanguage를 직접 읽어 choices 보호를 거치지 않음. 지시문 30 TASK A: consumption 경로 자체는 안 바꿨지만, App.tsx의 applyChannelToOptions가 더 이상 \'user\' provenance를 조용히 덮지 않는다(shouldConfirmLanguageOverride — 값이 애초에 오염되지 않으므로 이 opts-직접-읽기 경로도 안전해짐).',
    guardExpected: false,
    guardKo: '없음 — 지시문 30 TASK A는 소비 시점 가드 대신 오염 자체를 원천 차단(App.tsx)하는 다른 층위에서 고쳤다',
    demotionTrackedExpected: true // 지시문 30 TASK A/D-2 — 이번 세션의 실제 수정 지점
  },
  {
    axis: 'packagingLanguage',
    inputKo: 'Step2Concept.tsx:1222',
    consumption: 'via-opts-only',
    consumptionKo: 'core/packagingLanguage.ts:20-21 resolvePackagingLanguage가 opts.packagingLanguage만 읽음 — choices.packagingLanguage를 읽는 곳이 src/core 어디에도 없음',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: true // 지시문 30 TASK D-2 — 값 자체는 안 지키고 경고만(informational), §하지 말 것 범위 밖 필드라 blocking 추가 안 함
  },
  {
    axis: 'perspective',
    inputKo: 'Step2Concept.tsx:1257-1258',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:732,816은 미리보기만; 실제 생성기(lyricDiversityPlan.ts:402, promptComposer.ts:1323,1406)는 opts.perspective 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'perspectiveMode',
    inputKo: 'Step2Concept.tsx:1262-1298',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:738-739은 미리보기만; resolvePerspectiveMode(lyricDiversityPlan.ts:403)는 opts.perspectiveMode/opts.perspectiveModeIsExplicitChoice 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'genreBlendMode',
    inputKo: 'Step2Concept.tsx:750-786',
    consumption: 'via-opts-only',
    consumptionKo: 'core/genreRotation.ts:61-62 resolveGenreBlendMode가 opts.genreBlendMode만 읽음(?? \'shared-primary\' 무경고 폴백 포함) — buildBaseOptions는 genreBlendMode 필드 자체를 반환하지 않음',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'seasonId',
    inputKo: 'Step2Concept.tsx:599-601',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:730은 미리보기만 보호; 실제 생성 경로는 opts.seasonId를 choices 우회로 직접 소비',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false // App.tsx의 applyChannelToOptions는 seasonId를 건드리지 않음 — 강등 실경로 자체가 없음
  },
  {
    axis: 'songCount',
    inputKo: 'Step3Generate.tsx:1422-1439',
    consumption: 'via-opts-only',
    consumptionKo: '실제 생성 전 구간에서 opts.songCount 직접 사용. 추가로 App.tsx:503,646이 choiceProvenance 갱신 없이 opts.songCount를 사후 재작성 — user 출처 태그가 남은 채 값만 바뀔 수 있음(가장 심각한 사례)',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'breadth',
    inputKo: 'Step2Plan.tsx:492-500 (breadthOverride)',
    consumption: 'via-opts-only',
    consumptionKo: 'constraints.ts:935-936 detectConceptBreadth가 opts.breadthOverride 직접 사용; buildBaseOptions는 breadth/breadthOverride 필드를 아예 반환하지 않음',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'paletteFamilyId',
    inputKo: 'Step2Plan.tsx:400,521 (paletteFamilyOverride)',
    consumption: 'via-opts-only',
    consumptionKo: 'setDirector.ts:1501 resolveMainFamilyId·Step2Plan.tsx:198 모두 opts.paletteFamilyOverride 원본을 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'kidsAgeTierId',
    inputKo: 'App.tsx:237,258 — 실제로는 항상 source:\'channel\'만 생성됨(Step1Channel.tsx:559-560의 채널 편집기 draft 경유). \'user\' 출처는 설계상 존재하지 않음',
    consumption: 'via-opts-only',
    consumptionKo: 'localGenerator.ts:133-135 resolveKidsAgeTierId가 opts.kidsAgeTierId ?? opts.channel.kidsAgeTierId 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: true // 지시문 30 TASK D-2 — 'user' 출처가 설계상 없다는 위 인용은 오래됐다(App.tsx가 여전히 매 채널 전환마다 'channel'로 씀); informational 경고만 추가
  },
  // 지시문 30 TASK D — 아래 7축은 types.ts의 "provenance extension" 확장분
  // (GenerationChoiceProvenance 13→20축, types.ts:711-738)으로 지시문 24
  // 이후 추가됐지만 이 감사표에는 한 번도 실리지 않았다. moodIds/durationTarget/
  // lyricDepth/hookMode/referenceMood/avoidWords는 grep 확인상 setDirector.ts의
  // buildBaseOptions가 choices 경유로 구성하지 않고(SetPlan 미리보기 자체가
  // 이 필드들을 별도로 하드코딩/추론) 실제 생성기가 opts.<axis>를 직접
  // 읽는다 — 기존 12축과 같은 via-opts-only 패턴. negativeStyle만 예외로
  // 가드가 있다(computeStructuredViolations의 negativeStyleApplied 체크,
  // resolved.negativeStyleApplied는 실제 per-song 텍스트로 검증) — 그래도
  // consumption 자체는 resolveNegativeStyleText(opts)가 choices를 거치지
  // 않고 opts.negativeStyle을 직접 읽으므로 via-opts-only로 분류한다(이
  // 스크립트의 (b) 정의를 엄격하게 지킨다 — 가드가 있다고 소비 경로 분류를
  // 봐주지 않는다).
  {
    axis: 'moodIds',
    inputKo: 'Step2Concept.tsx의 무드 칩 그리드(toggleArray(\'moodIds\', ...))',
    consumption: 'via-opts-only',
    consumptionKo: 'localGenerator.ts:1312 openingPackContext(dominantMoodIds: opts.moodIds) 등 7개 파일이 opts.moodIds 직접 사용; setDirector.ts:734는 미리보기용 inferMoodIds(freeText, channel)로 별도 추론, choices를 거치지 않음',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: true // 지시문 30 TASK D-2
  },
  {
    axis: 'durationTarget',
    inputKo: 'Step2Concept.tsx의 "곡 길이" ChoiceGrid',
    consumption: 'via-opts-only',
    consumptionKo: 'localGenerator.ts·openingOverride.ts·promptComposer.ts·soundSignature.ts·videoExport.ts가 opts.durationTarget 직접 사용; setDirector.ts:746은 미리보기용 고정값 \'under3m30\'',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false // App.tsx의 applyChannelToOptions는 durationTarget을 건드리지 않음
  },
  {
    axis: 'lyricDepth',
    inputKo: 'Step2Concept.tsx의 "가사 깊이" ChoiceGrid',
    consumption: 'via-opts-only',
    consumptionKo: 'localGenerator.ts·promptComposer.ts·soundSignature.ts가 opts.lyricDepth 직접 사용; setDirector.ts:745는 미리보기용 고정값 \'commercial\'',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'hookMode',
    inputKo: 'Step2Concept.tsx의 훅 생성 방식 chip pair',
    consumption: 'via-opts-only',
    consumptionKo: 'batchPreallocation.ts·batchStitcher.ts·hookDedup.ts·hookLedger.ts·multiSetGeneration.ts·promptComposer.ts·quality.ts가 opts.hookMode 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'referenceMood',
    inputKo: 'Step2Concept.tsx의 Reference mood textarea',
    consumption: 'via-opts-only',
    consumptionKo: 'promptComposer.ts:646 buildReferenceMoodStyleClause(opts.referenceMood) 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  },
  {
    axis: 'negativeStyle',
    inputKo: 'Step2Concept.tsx의 Music Exclude styles 프리셋 칩/textarea',
    consumption: 'via-opts-only',
    consumptionKo: 'data/negativeStyles.ts의 resolveNegativeStyleText(opts)가 opts.negativeStyle을 직접 읽음(promptComposer.ts:1336 경유) — choices 객체를 거치지 않음',
    guardExpected: true, // computeStructuredViolations가 resolved.negativeStyleApplied(실제 per-song 텍스트 검증)로 소실을 잡는다 — (b) 분류와는 별개
    guardKo: 'userChoices.ts:476-484',
    demotionTrackedExpected: false
  },
  {
    axis: 'avoidWords',
    inputKo: 'Step2Concept.tsx의 "가사에서 피할 것들" 프리셋/커스텀 입력',
    consumption: 'via-opts-only',
    consumptionKo: 'negativePromptSpec.ts:89 parseNegativeStyleTerms(opts.avoidWords) 직접 사용',
    guardExpected: false,
    guardKo: '없음',
    demotionTrackedExpected: false
  }
];

/**
 * 지시문 30 TASK B — listeningIntent는 GenerationChoiceProvenance의 정식
 * 20축에 속하지 않는다(types.ts:953, provenance map 밖) — 그래서 위
 * AXIS_AUDIT 배열(키 타입이 keyof GenerationChoiceProvenance)에는 넣을 수
 * 없다. 그런데도 정확히 같은 "입력 있음·소비 없음" 결함이었다(지시문 30 TASK
 * B-2: 생성 경로 어디도 opts.listeningIntent가 세팅된 뒤의 배분을 다시
 * 확인하지 않음) — 이 표가 20축짜리 GenerationChoiceProvenance 하나에만
 * 갇히면 놓치는 이유가 여기 있다. 별도 행으로 고정한다.
 */
const LISTENING_INTENT_ROW = {
  axis: 'listeningIntent' as const,
  inputKo: 'Step2Concept.tsx의 "청취 목적" ChoiceGrid(opts.listeningIntent)',
  consumptionBefore: 'core/setDirector.ts·batchPreallocation.ts·localGenerator.ts grep 결과 0곳 — 클릭 시 1회성으로 genreIds/diversityAllocations를 기록할 뿐, 생성 경로 어디도 opts.listeningIntent 자체를 다시 읽지 않았음',
  fixKo: '지시문 30 TASK B-4 — core/listeningIntent.ts의 applyListeningIntentToOptions로 로직 추출, App.tsx의 requestGeneration(생성 시작 시점)이 applyListeningIntentIfPending으로 재적용 여부를 실제로 확인하는 새 호출 지점이 됨'
};

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
  const rows: { axis: string; a: boolean; b: ConsumptionKind; c: boolean; d: boolean; verdict: string }[] = [];

  console.log(`[check:choices] 지시문 24 TASK C(13축) + 지시문 30 TASK D(20축+강등추적+listeningIntent) — 정본 축 계약 감사\n`);

  for (const entry of AXIS_AUDIT) {
    // (c) 기계적 재검증 — choices.source.<axis> 패턴이 실제로 computeStructuredViolations
    // 안에 있는지 소스에서 다시 스캔하고, 이 파일이 그 자체를 재수출하는
    // GUARDED_PROVENANCE_FIELDS와도 대조한다. 위 테이블의 guardExpected와
    // 셋 중 하나라도 다르면 테이블이 소스와 따로 논다는 뜻이라 즉시 실패시킨다.
    const guardPattern = new RegExp(`choices\\.source\\.${entry.axis}\\b`);
    const guardFoundInSource = guardPattern.test(guardBody);
    const guardFoundInExport = (GUARDED_PROVENANCE_FIELDS as readonly string[]).includes(entry.axis);
    if (guardFoundInSource !== entry.guardExpected || guardFoundInExport !== entry.guardExpected) {
      console.log(`✗ AUDIT TABLE DRIFT (가드)  ${entry.axis} — 테이블 guardExpected=${entry.guardExpected}, 소스 스캔=${guardFoundInSource}, GUARDED_PROVENANCE_FIELDS export=${guardFoundInExport}. AXIS_AUDIT 테이블을 재실측해 갱신하십시오.`);
      mismatchCount++;
    }

    // (d) 지시문 30 TASK D-2 — core/userChoices.ts가 실제로 export하는
    // DEMOTION_TRACKED_PROVENANCE_FIELDS와 대조한다(테이블의 손으로 쓴 값이
    // 아니라 실제 export를 신뢰의 기준으로 삼는다).
    const demotionTrackedInExport = (DEMOTION_TRACKED_PROVENANCE_FIELDS as readonly string[]).includes(entry.axis);
    if (demotionTrackedInExport !== entry.demotionTrackedExpected) {
      console.log(`✗ AUDIT TABLE DRIFT (강등추적)  ${entry.axis} — 테이블 demotionTrackedExpected=${entry.demotionTrackedExpected}인데 DEMOTION_TRACKED_PROVENANCE_FIELDS export=${demotionTrackedInExport}입니다.`);
      mismatchCount++;
    }

    const hasInput = true; // 20축 전부 실측으로 입력 경로 확인됨(위 inputKo 인용) — genreIds는 이미 수정 완료.
    const hasConsumption = entry.consumption === 'via-choices';
    const hasGuard = entry.guardExpected;
    const hasDemotionTracking = entry.demotionTrackedExpected;
    // (b) consumption(엄격한 choices-경유 여부)이 이 계약의 핵심 판정 기준이다
    // — 지시문 24 이전 그대로 유지. (d) 강등추적은 지시문 30이 새로 추가한
    // 보조 신호일 뿐, 이 판정식에는 넣지 않는다 — 20축 중 상당수가 원래부터
    // 아키텍처상 via-opts-only(이 지시문 범위 밖의 기존 사실)라 (d)까지
    // 판정에 넣으면 이 스크립트가 다루지 않은 이슈까지 실패로 만든다.
    const isViolation = !hasInput || !hasConsumption || !hasGuard;

    const verdict = isViolation ? 'CONTRACT VIOLATION' : 'OK';
    if (isViolation) violationCount++;

    rows.push({ axis: entry.axis, a: hasInput, b: entry.consumption, c: hasGuard, d: hasDemotionTracking, verdict });

    const mark = isViolation ? '✗' : '✓';
    console.log(`${mark} ${entry.axis.padEnd(18)} 입력:${hasInput ? 'O' : 'X'}  소비:${entry.consumption.padEnd(13)}  가드:${hasGuard ? 'O' : 'X'}  강등추적:${hasDemotionTracking ? 'O' : 'X'}  → ${verdict}`);
    if (isViolation) {
      console.log(`    입력: ${entry.inputKo}`);
      console.log(`    소비: ${entry.consumptionKo}`);
      console.log(`    가드: ${entry.guardKo}\n`);
    }
  }

  console.log(`○ ${LISTENING_INTENT_ROW.axis.padEnd(18)} (provenance 축 아님 — 별도 트랙, 지시문 30 TASK B)`);
  console.log(`    입력: ${LISTENING_INTENT_ROW.inputKo}`);
  console.log(`    TASK B 이전 소비: ${LISTENING_INTENT_ROW.consumptionBefore}`);
  console.log(`    TASK B 수정: ${LISTENING_INTENT_ROW.fixKo}\n`);

  console.log(`통과(OK) ${rows.length - violationCount} / CONTRACT VIOLATION ${violationCount}  (총 ${rows.length}축 + listeningIntent 1, 감사표-소스 불일치 ${mismatchCount}건)`);
  console.log(
    '\n[참고] CONTRACT VIOLATION(위 17건)은 CI 실패 사유가 아니다 — 대부분(perspective/' +
    'seasonId/songCount/breadth 등)이 지시문 30 범위 밖의 기존 아키텍처 사실이라, 그대로' +
    ' CI 게이트로 걸면 이 지시문이 다루지 않은 이슈까지 막아선다(§하지 말 것 "새 관문·새' +
    ' 품질 기능을 추가하지 말 것", 공통 규약 7 "실측 없이 blocking을 만들지 않는다"). CI는' +
    ' AUDIT TABLE DRIFT(위 테이블이 실제 소스/export와 어긋남)만 실패시킨다 — 그건 이 표' +
    ' 자체가 거짓말을 하고 있다는 뜻이라 언제나 실측 가능한 회귀다. 지시문 30이 실제로 고친' +
    ' 3건(lyricLanguage 강등 차단, listeningIntent 소비, 강등추적 인프라)의 동작 회귀 방지는' +
    ' tests/generationChoiceProvenance.test.ts·tests/listeningIntent.test.ts가 맡는다' +
    '(둘 다 npm run test 경유로 CI에 이미 있음).'
  );

  if (mismatchCount > 0) {
    process.exitCode = 1;
  }
}

main();
