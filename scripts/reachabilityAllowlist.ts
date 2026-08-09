/**
 * 지시문 09 TASK C-1 — checkReachability.ts의 허용 목록(allowlist).
 * "의도적으로 도달 불가인 파일은 사유를 적어 목록에 넣는다. 사유 없는 도달
 * 불가는 실패다." 이 파일에 없는 도달 불가 파일이 있으면 check:reachability
 * 는 실패한다 — 새로 추가된 미배선 모듈을 조용히 지나치지 않기 위해서다.
 *
 * 각 항목을 지울 때는 그 파일을 실제로 배선한 커밋에서 지운다 — 여기서
 * 먼저 지우고 나중에 배선하지 않는다.
 */
export const REACHABILITY_ALLOWLIST: Record<string, string> = {
  // 다른 "지시문 08"(finalize choke point) 범위 — 지시문 09 TASK C-2 자신의
  // 스코프 노트: "finalizeBlueprint · artifactStage · finalExport ※ 지시문
  // 08 TASK 3의 범위다. 09에서는 도달성만 확인한다."
  'src/core/finalizeBlueprint.ts': '지시문 08(다른 문서) TASK 3 "finalize choke point"의 범위 — 09는 도달성만 확인, 배선은 그 지시문에서',
  'src/core/artifactStage.ts': '위와 동일 — finalizeBlueprint의 하위 단계',
  'src/core/finalExport.ts': '위와 동일 — finalizeBlueprint의 하위 단계',

  // 지시문 11(음원·번들) 범위 — 지시문 09 TASK C-2 자신의 스코프 노트:
  // "audio* · blindBenchmark · productionBundle · musicGenerationProvider
  // ※ 지시문 11의 범위다. 09에서는 allowlist에 사유를 적는다."
  'src/core/audioGate.ts': '지시문 11 범위(음원·번들) — 이 환경에 실제 음원 파일이 없어 검증 불가, 09에서는 사유만 기록',
  'src/core/blindBenchmark.ts': '위와 동일 — 지시문 11 §0에서 HotAIMusic 블라인드 A/B 요건 자체가 명시적으로 폐기됨, 실측 대체 완료',
  'src/core/musicGenerationProvider.ts': '위와 동일',
  'src/core/semanticCritic.ts': '지시문 11 TASK C — musicGenerationProvider.ts와 동일한 이유·동일한 패턴(계약 + 정직한 UnavailableSemanticCritic 기본 구현). 이 앱에는 임의 LLM을 호출하는 실제 연결이 없어, 지금 억지로 호출부를 만들면 미승인 엔드포인트를 부르거나 성공을 지어내는 것 중 하나가 된다 — "optional/provider-gated"라는 지시문 자신의 표현대로 실제 공급자가 연결되기 전까지는 의도적으로 미배선.',
  'src/core/lyricsAlignment.ts': '지시문 09 §2-3 "음원·번들" 목록에 명시 — 위와 동일 사유(지시문 11 범위, 실제 음원 필요)',

  // 재작성 4종 — GenerationGatePanel.tsx에서 도달 가능하게 하려면 그 패널이
  // importSongsJson(붙여넣은 재작성 결과를 다시 파싱)에 필요한 genres/moods/
  // season 컨텍스트를 받아야 하는데, 그 패널의 부모(Step4Result.tsx)조차
  // 이 3개를 직접 들고 있지 않다(opts.genreIds만 있음, 실제 GenrePack[] 객체
  // 아님) — 이 프롭 체인을 새로 뚫는 건 "4개 모듈 배선"보다 훨씬 큰 리팩터링.
  // 별도 파서를 만드는 것도 이 세션 전체가 반복해서 금지한 패턴이라 선택지에서
  // 제외했다. 실측 확인된 진짜 아키텍처 갭이며, 지시문 09가 스스로 "새 기능을
  // 추가하지 말 것"이라 못 박은 것과도 상충한다(파스백 검증 UI는 새 기능).
  'src/core/rewriteInstruction.ts': 'GenerationGatePanel.tsx가 재작성 응답 파스백에 필요한 genres/moods/season 컨텍스트를 갖고 있지 않음 — 실측 확인된 아키텍처 갭, 프롭 체인 리팩터링 필요 (이 지시문 범위 밖)',
  'src/core/rewriteVerification.ts': '위와 동일',
  'src/core/rewriteWorkspaceRules.ts': '위와 동일',
  'src/core/rewriteStageDashboard.ts': '위와 동일',

  // 생성(감사 아님) 모듈 — 실제 per-song 생성 루프(localGenerator.ts)를
  // 수정해야 배선 가능하다. 감사/체크 모듈 배선과는 리스크 차원이 다르다
  // (생성된 실제 가사·프롬프트 내용이 바뀜) — 별도 세션에서 신중히 다룰 것.
  'src/core/idolPartPlan.ts': '생성(감사 아님) 모듈 — kr-idol-male 실제 per-song 생성 루프 수정 필요, 리스크가 검사 모듈 배선과 다른 차원이라 이 세션에서 의도적으로 보류',
  'src/core/idolFemalePartPlan.ts': '위와 동일 — kr-idol-female',
  'src/core/sectionGenrePlan.ts': '생성 모듈 — 섹션별 장르 블렌딩을 실제 곡 조립에 넣으려면 localGenerator.ts 수정 필요, 위와 동일 이유로 보류',
  'src/core/sectionGenrePromptFormats.ts': '위와 동일 — sectionGenrePlan의 렌더링 단계',
  'src/data/krIdolSectionPlans.ts': 'sectionGenrePlan이 소비할 데이터 — 소비하는 쪽이 아직 배선되지 않아 함께 보류',

  // 의도적 비배선 — 낡은 경로가 이미 다른 이름으로 실제 라이브 배선돼 있다.
  'src/data/kidsArcModel.ts': '의도적 미배선(지시문 08에서 이미 판단) — core/arcModels.ts가 동일 개념(아이 아크 단계)을 실제 배선된 다른 이름 체계(kids-familiar/kids-learning/kids-moving/kids-calm/kids-closing)로 이미 구현 중. 배선하면 두 시스템이 공존하게 되어 "낡은 경로를 남기지 말 것"을 위반함',

  // 미착수 — 실제 사용처를 아직 찾지 못함.
  'src/core/lyricBudget.ts': '미착수 — 가사 단어수 목표(BPM별 타깃)는 이미 core/compositionScorer.ts의 targetWordRangeFor/core/fullAudit.ts가 실제 배선된 경로로 처리 중이라, 이 모듈이 배선될 자리가 중복 없이 어디인지 아직 확정하지 못함',

  // 지시문 12 (TASK B/C) — 관문/설정 계약 CLI 체커 전용 모듈. 이 계약
  // 레지스트리는 scripts/checkGateContract.ts · scripts/checkVerifiedSettings.ts
  // (npm run check:gates / check:settings)와 각각의 드리프트 테스트에서만
  // 소비된다 — check:node/check:reachability 자신을 구성하는 다른 CLI 전용
  // 모듈들과 같은 성격으로, 브라우저 3개 진입점(src/main.tsx/App.tsx/
  // localGenerationWorker.ts) 그래프 밖에 의도적으로 존재한다. UI 패널에서
  // 이 계약 결과를 직접 보여줘야 할 실제 요구가 생기면 그때 배선한다.
  'src/core/gateDataContract.ts': 'CLI 전용 계약 모듈 — scripts/checkGateContract.ts(npm run check:gates)와 tests/gateDataContract.test.ts만 소비, 브라우저 진입점 그래프 밖 (지시문 12 TASK B)',
  'src/core/verifiedSettingContract.ts': 'CLI 전용 계약 모듈 — scripts/checkVerifiedSettings.ts(npm run check:settings)와 tests/verifiedSettingContract.test.ts만 소비, 브라우저 진입점 그래프 밖 (지시문 12 TASK C)',

  // 지시문 11 (TASK E) — 테스트 전용 회귀 잠금 데이터. tests/goldenCases.test.ts가
  // 유일한 실제 소비자다(main.tsx/App.tsx/localGenerationWorker.ts 진입점
  // 그래프 밖) — tests/fixtures/*.json 같은 다른 순수 테스트 자산과 같은
  // 성격이라 앱 자체에 배선할 대상이 없다. UI에 "골든 케이스 현황" 패널이
  // 실제로 필요해지면 그때 배선한다(지금은 없는 요구를 미리 만들지 않는다).
  'src/data/goldenCases.ts': '테스트 전용 회귀 잠금 데이터 — tests/goldenCases.test.ts가 유일한 실제 소비자, tests/fixtures/*.json과 같은 성격'
};
