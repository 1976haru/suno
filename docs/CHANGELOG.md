# CHANGELOG

지시문 18 (TASK B) — 버전 체계를 `0.NN.P`(NN = 완료된 지시문 번호, P = 같은
지시문 안의 후속 패치)로 전환한다. `package.json`의 `version`이 유일한
진실 — UI 표시·schema version·audit·CHANGELOG 전부 여기서 파생한다.
`npm run check:version`이 이 파일의 최상단 항목과 `package.json`의 버전이
어긋나면 실패한다.

지시문 12 이전(v3.x~v5.x대)의 이력은 이 파일로 소급 재작성하지 않는다 —
그 시절 커밋 메시지 자체가 그때그때의 버전 서술(v3.79, v5.23 등)을 이미
담고 있고, `git log`가 그 시점의 정확한 기록이다. 이 CHANGELOG는 지시문
12부터, 즉 이 새 버전 체계가 실제로 의미를 갖기 시작하는 지점부터 채운다.

## 0.18.0 — 지시문 18

- **TASK C (생성 에이전트 기록)**: 팩이 어느 코딩 에이전트(Claude Code·
  Codex·Fable 5·API 직접 호출·로컬 생성·기타)로 만들어졌는지 기록.
  `SavedPack.generatedBy`/`generatedByNote`/`bridgeVersion`, 가져오기
  화면의 선택 UI(직전 선택값 기억), "🎧 무엇이 잘 먹히나" 화면의 "생성
  에이전트별 실측" 집계(세트 3개 미만은 표본 부족으로만 표시, 앱이 우열을
  자동 판정하지 않음), `docs/AGENT_COMPARISON.md` 비교 절차.
- **TASK B (이 항목)**: 버전 체계 `0.NN.0` 전환, `npm run check:version`
  신설, 이 CHANGELOG 신설.
- **TASK A (제품명 변경)**: Suno Weaver Studio → 하루 스튜디오(Haru
  Studio). 저장소 키(`suno-weaver-*` IndexedDB/localStorage 접두)는
  전부 그대로 유지 — 바꾸면 기존 사용자 데이터가 소실된다.
- 수치 이동 없음: 이번 지시문은 이름·버전 체계·기록 필드 추가만 다뤘고
  가사/프롬프트 품질 관문은 건드리지 않았다 — 지시문 15·17이 만든 관문의
  실측값(distinctChoice 이행률, 작곡 지시 유출, 소품 상태 모순 등)은
  변하지 않았다.

## 0.17.0 — 지시문 17

- 작곡 지시 유출 어휘 5종 → 18종(`chord`/`refrain`/`verse`/`bridge`/
  `progression`/`harmony`/`tempo`/`beat`/`octave`/`register`/`take`/
  `mix`/`reverb` 등 추가), severity 도입 — 영어 매치는 warning → blocking
  으로 승격(verified 여부 무관), 한국어·일본어는 실측 없어 advisory로
  시작. 실제 20260808 팩 T8("One borrowed chord colours the whole
  refrain") 정확히 검출, 18곡 전수 스캔 과탐 0건.
- 소품 상태 추적(`core/narrativeState.ts`) 신설 — T10 "Before I Lose My
  Nerve"의 편지 발송 후 재독 모순을 letter kind로 검출. kind 단위로
  verified를 나눠, 같은 워크스페이스에 배정된 window/light/door/vehicle은
  실측 근거가 없어 advisory로 남긴다(letter만 blocking 가능).
- SemanticCritic(지시문 11) 연결용 golden case 5건 + 반대 케이스(오탐
  방지용 정상 문장) 5건 등록. SemanticCritic 자체는 아직 provider가
  연결되지 않아 재현 테스트는 대기 상태로 정직하게 남겼다.
- 수치 이동: `check:archetype` 실측 하드코딩 52→47곳(9파일).

## 0.16.0 — 지시문 16

- `core/promptAxisLexicon.ts` 신설 — stylePrompt의 각 절을 13개 축(시대·
  장르·템포·리드보컬·백킹보컬·악기·화성·구조·인트로·편곡밀도·믹스·훅장치·
  길이)으로 분류.
- `core/promptAxisMerge.ts`의 `mergeAtom`이 문자열 일치만 보던
  `appendVerbatimIfMissing` 호출 8곳을 축 인식 병합으로 전부 대체 —
  리드보컬 중복 선언·인트로 모순의 실제 원인 중 하나였던 값 불일치(`vocalFix`가
  주입한 값과 병합 로직이 비교하던 값이 서로 달랐던 것)를 함께 고쳤다.
  실제 파이프라인 배선 과정에서 축 판정 버그 2건(harpsichord의 chord
  부분일치 오분류, locked 값 내부 콤마로 인한 클로즈 분할 파괴) 발견·수정.
- `core/fullAudit.ts`에 인트로 모순·리드보컬 중복 선언·중복 토큰 3종
  측정 추가. 실측: 사람이 손으로 잰 13건 중 10건 일치, 검사기가 더
  정밀했던 3건, 사람이 놓쳤던 신규 위반 2건(T2 인트로 모순, T4 리드 중복)
  추가 검출.
- `data/promptAxisPolicy.ts` — 7 워크스페이스 정책. `mergeAtom`/
  `classifyClause` 안에 archetype 분기 0곳(지시문 15 TASK D 원칙 준수).
  senior-oldpop만 verified:true, 나머지 6개는 provisional(게이트는 돌되
  blocking 안 함) — 단 리드 중복·중복 토큰·인트로 모순 3종은 verified
  무관 항상 심각 오류로 "표시"(실제 blocking 게이트로는 배선하지 않음 —
  "새 관문을 만들지 말 것" 제약).
- `scripts/promptLengthTrial.ts` — stylePrompt short(35~45단어)/
  medium(55~65단어)/long 3버전 산출 실험 키트. 필수 6개 항목(시대·장르·
  BPM·리드보컬·핵심구조·길이)은 short에도 반드시 유지. 단위·임계값
  확정은 하루의 청취 결과 대기 중 — 이 버전은 산출까지만.

## 0.15.0 — 지시문 15

- `scripts/checkArchetypeHardcoding.ts` + 축소 전용 allowlist — `archetype
  === '리터럴'` 재발 방지. 실측 하드코딩 57→47곳(13→9파일) — quality.ts/
  designGate.ts/gateDataContract.ts/vocalPlan.ts/bridgeInstruction.ts 5개
  항목을 정책 registry로 이전해 제거.
- `distinctChoice`를 자유 문자열에서 구조화된 `DistinctChoiceRuleId`
  (14종)+`DistinctChoiceVerifiability`로 전환.
- `core/distinctChoiceGate.ts` — archetype 분기가 전혀 없는 공통 엔진.
  senior-oldpop만 verified:true(20260808 팩 18곡 실측), 나머지 6개는
  advisory 전용. 안전 제약(kids NO_CHORUS/FINAL_QUESTION, K-pop
  NO_CHORUS+동성 쿼터)은 verified 무관 항상 강제.
- 7개 워크스페이스 fixture + 필수 테스트 3개(78 tests) — senior-oldpop만
  실제로 blocking, 나머지 6개는 절대 blocking 안 함을 실측 증명.
- 실제 20260808 팩으로 손 실측 5건 위반(T8·T11·T12·T14·T15) 전부 재현,
  T1 stylePrompt 자기모순 검출, T2·T3 not-measured 확인.
- 부수 발견·수정: `bridgeImport.ts`의 실제 저장 경로가 `distinctChoice`
  필드를 저장하지 않던 결함, `distinctChoiceGate.ts`의 `/male/i`가
  "female" 안의 "male" 부분문자열에 오매칭하던 결함.

## 0.14.0 — 지시문 14

- **Phase 1 (TASK D)**: `core/historyBackfill.ts` 신설 — 과거
  songs-output.json을 라이브러리 저장 없이 회피 이력(장면·훅·가사 문장·
  구조 지문) 원장에만 등록. `DataManagementPanel.tsx`에 파일 다중선택/
  폴더 드래그 UI + 워크스페이스별 이력 규모 진단 추가.
- **Phase 1 (TASK C)**: 회피 이력 조회 범위를 channelId 단일 채널에서
  workspaceId 워크스페이스 전체로 전환 — 채널을 새로 만들면 이력이
  리셋되던 문제 해결. workspaceId 없는 옛 레코드는 channelId→archetype→
  workspace로 마이그레이션.
- **Phase 2 (TASK B)**: 13개 아키타입 중 11개 테마 풀 확장(예: kids
  14→42, senior-morning 40→70).
- **Phase 2 (TASK A)**: `lyricThemesForOptions`에 `avoid` 파라미터
  추가 — 실제 배정 단계(로컬·API·브릿지 전부)에 배선. 실측: 같은 채널
  다른 컨셉 2세트 비교 시 중복이 17/18 → 0/18로 감소.

## 0.13.0 — 지시문 13

- `core/bridgeImport.ts`의 `parseSongsJsonForViewer` + `SunoModeReadOnlyViewer.tsx`
  신설 — 구조가 깨진 파일만 차단하고, 장면·제목·가사 완전일치 중복은
  정보로만 표시(절대 차단하지 않음). 라이브러리 저장·자동저장·ledger
  기록을 전혀 호출하지 않는다(구조적으로 테스트가 증명).
  실측: 가사 문장 36개 완전일치로 정상 저장 경로에서는 blocked되는
  18곡 팩을 동일 조건 읽기 전용 경로로는 정상 오픈 확인.
- 뷰어 제목(h2) 표시가 `titleDisplay`를 채우지 않아 `titleLocalized`
  보유 팩에서도 항상 영어 title만 보이던 버그 수정. `SUNO_VIEWER_VERSION`
  1.0.0 → 1.1.0.

## 0.12.0 — 지시문 12

- `src/core/gateDataContract.ts` 신설 — "관문이 존재하지 않는 데이터를
  검사한다" 재발 유형 제거. `scripts/checkGateContract.ts`
  (`npm run check:gates`)로 25개 채널 실측 — CONTRACT VIOLATION 다수
  발견(era-primary-share/era-neutral-share 등).
- `src/core/verifiedSettingContract.ts` + `scripts/checkVerifiedSettings.ts`
  (`npm run check:settings`) — 검증된 품질 설정이 archetype/workspace에
  묶여 있는지 확인. SETTING LOST 다수 발견(ChannelSoundFloor 미등록 등).
- eraTag(자유 문자열, 44/354 보유)와 별도로 관리되던 `ERA_BUCKET_BY_GENRE_ID`
  (30/354만 커버)를 통합 — 354종 장르 전수에 `eraBuckets`/`eraNoteKo`
  재부여.
- `audienceProfileForChannelArchetype`을 워크스페이스 단위 예외 처리에서
  아키타입 단위 명시 테이블(`data/archetypeAudienceProfiles.ts`)로 전환
  — senior-oldpop 워크스페이스에 묶인 비-시니어 아키타입(j2000s/
  modern-chill/city-night/kids)이 실제로 쓰는 오디언스 프로필을 그대로
  고정.

---

## 1.0.0 승격 조건 (기록만 — 지금 확정하지 않는다)

지시문 18 §B-2. 아래 조건을 실제로 달성하는 날 `1.0.0`으로 올린다. 지금은
0.x를 유지한다 — 아직 이 중 어느 것도 달성했다고 실측으로 확인된 바 없다.

- 무검수 발매율 90%
- 7 워크스페이스 실증 인수 완료
- CI 전 job green · `continue-on-error` 0
- 사유 없는 도달 불가 0개 (`npm run check:reachability`)
