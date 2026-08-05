# v5.7 — 4개 워크스페이스 실사용 복구 (kr-2030 / jp-2030 / kr-idol-male / kr-idol-female)

**원칙 준수 확인**: 이 문서의 모든 수치는 실제로 `npx tsx`로 로컬 생성 파이프라인을 실행하고, 실제로 생성된 가사/스타일 프롬프트를 직접 읽어서 얻은 값입니다. 시니어 워크스페이스(senior-oldpop)는 이 작업 전체에서 데이터/로직을 전혀 수정하지 않았고, 그 사실을 §9에서 실측으로 재확인했습니다.

- 배경: v5.6 감사(`docs/v56-report.md`)가 kr-2030/jp-2030/kr-idol-male/kr-idol-female 4개 워크스페이스는 `ready: true`였지만 실제로는 시니어와 100% 동일한 가사 문장 템플릿·시니어 전용 어휘 폴백·미연결 AudienceProfile로 생성되고 있었다는 것을 실측으로 확인. 사용자 지시: "시니어 워크스페이스 건드리지 말고 4개 워크스페이스부터 고쳐줘."
- kr-kids/jp-kids는 이 작업 범위에서 명시적으로 제외(사용자 지시).
- TASK A(채널 피커 워크스페이스 스코핑)는 이 세션 앞부분에서 이미 완료됨 — 이 보고서는 TASK B-J.

---

## 0. 핵심 요약

| TASK | 내용 | 상태 |
|---|---|---|
| A | 채널 피커가 워크스페이스로 필터링되지 않던 버그 수정 (`useChannelManager.ts`) | 완료 |
| B | 실제 워크스페이스별 AudienceProfile 연결 (`audienceProfileForChannelArchetype`, 9개 호출부) | 완료 |
| C | ChannelSoundFloor 4개 워크스페이스 신규 작성 + `usesPaletteFamily` 아키텍처 버그 수정 | 완료 |
| D | kr-2030 전용 한국어 가사 문장 템플릿 (7 카테고리 × 8-10개) | 완료 |
| E | kr-idol-male/female 공용 한국어 가사 문장 템플릿 | 완료 |
| F | jp-2030 전용 일본어 가사 문장 템플릿 | 완료 |
| G | 4개 워크스페이스 전용 모티프/상황/어휘 뱅크 (실제 오염 원인 특정 후 수정) | 완료 |
| H | GenreTraits — 이미 5축 전부 채워져 있었음(선행 세션에서 완료). 실제 발견한 문제는 kr-idol 공유 장르팩의 `vocal` 필드에 "male"이 하드코딩되어 kr-idol-female에도 새는 버그 — 수정 | 완료 |
| I | idolExpressionLint를 `auditAlbum`의 실제 차단 게이트로 연결 | 완료 |
| J | 전체 재검증 + `ready` 플래그 재전환 + 본 보고서 | 완료 |

**작업 중 발견·수정한 실제 회귀/버그 5건** (전부 실행 중 발견, 코드 읽기만으로는 못 잡았을 것들):

1. **시니어 채널 오염 회귀**: TASK B의 첫 구현이 senior-oldpop 전체를 워크스페이스 기본 프로파일로 라우팅하려 해서, senior-oldpop 자체 보유 다중 오디언스 채널(modern-chill/city-night 등, 자체 `audience` 필드로 세부 타겟팅)에 시니어 전용 exclusion이 강제로 씌워지는 회귀를 만들 뻔함 — 기존 테스트(`audienceProfile.test.ts`)가 즉시 잡음. `audienceProfileForChannelArchetype`이 senior-oldpop을 명시적으로 제외하도록 수정.
2. **팔레트 패밀리 시스템이 신규 워크스페이스의 곡 수를 몰래 깎는 버그**: `ChannelSoundFloor` 존재만으로 `setDirector.ts`의 `capCompatibleFamilySongs`가 발동해, 팔레트 데이터가 전혀 없는 kr-2030 등에서 18곡짜리 팩을 5곡 상당으로 잘라버릴 뻔함(회수처가 없어 곡이 사라짐). `usesPaletteFamily` 플래그를 신설해 senior-oldpop만 이 경로를 타도록 분리.
3. **JSDoc 주석 안의 `*/`가 컴파일 자체를 깨뜨림**: `lyricEngine.ts` 주석에 "kr-idol-*/jp-2030's"라고 쓰면서 우연히 `*/`(주석 종료 토큰)가 생겨, 이후 코드 전체가 오파싱되어 대량의 무관한 컴파일 에러 발생. 원인을 바이트 단위로 추적해 수정.
4. **`vocabularyBankForScene` 크래시**: 워크스페이스 스코핑을 추가하면서, 뱅크가 아예 없는 워크스페이스(kr-kids/jp-kids, 이번 작업 범위 밖)에서 빈 배열의 `[0]`을 읽어 `undefined.id`로 실제 테스트 크래시. 스코핑 결과가 비면 전체 뱅크로 폴백하도록 방어 로직 추가.
5. **kr-idol-female이 kr-idol-male 전용 "male" 보컬 서술어를 물려받는 버그**: 7개 kridol-* 장르팩이 두 워크스페이스에 의도적으로 공유되는데, 그 `vocal` 필드에 "male"이 하드코딩되어 있어 `sectionGenrePlan.ts`를 거쳐 실제 kr-idol-female 스타일 프롬프트 5/18곡에 "male lead" 텍스트가 그대로 노출됨. 장르팩의 `vocal` 필드를 성별 대신 전달 스타일(confident/breathy/belted 등)만 서술하도록 수정 — 성별 자체는 이미 올바르게 동작하는 별도의 곡별 vocalType/vocalPlan 시스템이 담당.

---

## 1. TASK B — AudienceProfile 실연결

`data/audienceProfiles.ts`에 `audienceProfileForChannelArchetype(archetype, audienceFallback)` 신설. `data/workspaces/index.ts`의 `defaultAudienceProfileId`를 4개 워크스페이스 모두 `'general'` → 실제 전용 프로파일로 변경:

| 워크스페이스 | 이전 | 이후 |
|---|---|---|
| kr-2030 | `general` | `kr-2030-emotional` (신규 값 채움: tempo 68-120, lyricWordRange [190,260]) |
| jp-2030 | `general` | `jp-2030-melodic` (tempo 65-125, lyricWordRange [185,255]) |
| kr-idol-male | `general` | `kr-idol-male` (신규 프로파일, tempo 92-138, lyricWordRange [140,210]) |
| kr-idol-female | `general` | `kr-idol-female` (신규 프로파일, kr-idol-male과 동일 수치 — 아이돌 에너지는 워크스페이스-장르 특성이지 성별 특성이 아니라는 판단, §11-2 근거) |

호출부 9곳 전환: `localGenerator.ts`(×2), `batchPreallocation.ts`, `promptComposer.ts`(×2), `bridgeInstruction.ts`, `albumAudit.ts`, `Step2Plan.tsx`, `Step3Generate.tsx`, `Step4Result.tsx`(×5). senior-oldpop은 §0-1의 회귀를 잡은 뒤 명시적으로 이 경로에서 제외해 기존 동작 100% 보존.

## 2. TASK C — ChannelSoundFloor

4개 워크스페이스에 `requiredAtoms`/`forbiddenAtoms`/`productionEraTags` 신규 작성(각 2-4개 항목). `usesPaletteFamily` 아키텍처 발견 및 수정(§0-2 참조) — `setDirector.ts`/`designGate.ts`/`multiSetGeneration.ts`/`Step2Plan.tsx` 4곳의 게이팅 조건을 "floor 존재"에서 "floor.usesPaletteFamily"로 교체.

## 3. TASK D/E/F — 전용 가사 문장 템플릿

`lyricEngine.ts`의 `poolsFor(language, archetype)`가 이제 archetype으로 분기:
- `kr-2030-pop` → `kr2030Pools` (거리·불빛·골목·이어폰·지하철·편의점 — 시니어의 라디오·커튼·창가·아침 이미지와 완전히 다른 원본 문장 7카테고리)
- `kr-idol-male`/`kr-idol-female` → `krIdolPools` (무대·조명·함성·카운트다운·앙코르, 두 워크스페이스 공용 — §0의 "성별이 아니라 워크스페이스 특성" 판단과 일치)
- `jp-2030-pop` → `jp2030Pools` (帰り道·夜の街·イヤホン·ネオン·街灯·コンビニ)
- 그 외 모든 archetype(senior-oldpop 포함)은 기존 `koPools`/`jaPools`/`enPools` 그대로 — strict no-op.

## 4. TASK G — 실제 오염 원인 특정 및 수정

v5.6 감사는 `vocabularyBankForScene()`을 오염의 원인으로 지목했으나, 실제 18곡 생성 후 오염된 문자열을 역추적한 결과 진짜 1차 원인은 `core/localGenerator.ts`의 `recurringMotifs`/`listenerSituations` — 모든 워크스페이스가 공유하던 전역 풀(`{english:'old radio light', korean:'오래된 라디오 불빛',...}`, `{english:'a warm shop window at dusk', korean:'따뜻한 가게 창가',...}` 등)이었습니다. `vocabularyBankForScene`은 최대 2개 보조 단어만 공급하는 2차 메커니즘이었습니다.

두 메커니즘 모두 워크스페이스별로 분리:
- `motifsForArchetype`/`situationsForArchetype` 신규 (kr2030Motifs/Situations, jp2030Motifs/Situations, krIdolMotifs/Situations 각 10-15개 원본 항목)
- `vocabularyBankForScene`에 실제 `workspaceId` 인자를 넘기도록 호출부 2곳 수정, 4개 워크스페이스 전용 뱅크(총 18개) 신규 작성
- 뱅크가 없는 워크스페이스(kr-kids/jp-kids)에서 크래시하던 버그(§0-2) 수정

**실측**: 4개 워크스페이스 각 18곡 생성, 시니어 전용 단어(라디오/커튼/창가 및 영·일 대응어) 검색 — **0/18 전부** (§9 최종 재검증 표 참조). senior-oldpop 자체 채널은 동일 검색에서 18/18 검출 — 정상(자기 정체성이 "추억라디오"이므로).

## 5. TASK H — GenreTraits 및 성별 누출 수정

kr-2030(6)/jp-2030(7)/kr-idol(7, male·female 공유) 총 20개 장르 전부 `GENRE_TRAIT_OVERRIDES`에 이미 5축이 완전히 채워져 있었음을 확인(선행 세션에서 이미 완료된 작업으로 판단) — 신규 작성 불필요.

대신 실제 남아있던 문제를 발견: `data/genreLibrary/index.ts`의 kridol-* 7개 장르팩(kr-idol-male/female 공유)의 `vocal` 필드에 "male"이 하드코딩되어 있어, `sectionGenrePlan.ts`를 거쳐 실제 style prompt에 노출됨. 실측: 수정 전 kr-idol-female 18곡 중 5곡에 "male" 노출 → 수정 후 0곡 노출(남은 3건은 "male and female duet" 등 정당한 듀엣 서술, 오염 아님— 실제 확인 완료). 7개 장르 전부 `vocal` 필드를 성별 무관 전달-스타일 서술로 교체.

## 6. TASK I — idolExpressionLint 게이트화

`core/idolExpressionLint.ts`(K3 §7, 성적 대상화/미성년 코딩 어휘 스캔)는 자체 모듈 밖에서 실제 호출부가 0개였음(수동 스캔만 존재). `core/albumAudit.ts`에 kr-idol-male/female 전용 하드 차단 게이트로 연결 — 위반 시 `errors`(차단)에 추가, 다른 워크스페이스는 조건 자체가 거짓이라 strict no-op. `tests/idolExpressionLintGate.test.ts` 신규(5개 테스트): 금지어 포함 시 실제 차단 확인, 클린 팩은 통과 확인, 비-아이돌 워크스페이스는 동일 금지어로도 무영향 확인, 실제 18곡 생성 2회 모두 0 위반 확인.

## 7. 신규 테스트

- `tests/audienceProfileForWorkspace.test.ts` (7개) — 4개 워크스페이스가 각자 다른 프로파일로, senior-oldpop은 정확히 no-op으로 해석되는지.
- `tests/idolExpressionLintGate.test.ts` (5개) — §6 참조.
- `tests/kridolGenderNeutralVocal.test.ts` (1개) — §5의 성별 누출 회귀 방지.
- `tests/workspaces.test.ts` — 4개 워크스페이스의 `ready` 기대값을 실제 상태(v5.7 재검증 후 `true`)로 갱신.

## 8. 알려진 범위 밖 항목 (고치지 않음)

- **kr-idol-male/female의 장르 공유(`archetypes: ['kr-idol-male','kr-idol-female']`)**: `isolationAudit.ts` L1에서 "외부 장르 노출"로 FAIL 표시되지만, 이는 K2/K3 자체 설계("genre layer shares K2's own 7 kridol-* genres, no new genres")이자 의도된 것 — 버그 아님.
- **senior-oldpop 자체의 기존 L4 FAIL 3건** (modern-chill/city-night/oldpop-lounge가 senior-morning override와 완전 동일 — hookBanks.ts의 switch에 case 없음): 이번 세션에서 `hookBanks.ts`를 전혀 건드리지 않았으므로 기존 상태 그대로. 시니어 워크스페이스 자체 개선은 이번 작업 범위 밖("시니어 건드리지 말 것").
- **`getRecurringMotifWords`/`getRecurringMotifPhrases`** (썸네일 텍스트용, `thumbnailSpec.ts` 소비): 여전히 워크스페이스 미분리 — 가사 본문이 아니라 썸네일 표시 텍스트 소비처라 이번 작업(가사 오염 제거)의 실측 범위 밖으로 판단, 고치지 않음.
- **era-canon-palette/paletteFamilies 실제 데이터**: 4개 워크스페이스 모두 여전히 0(설계상 시니어 전용 체계) — `usesPaletteFamily: false`로 명시적으로 비활성 처리했으므로 버그는 아니지만, 4개 워크스페이스 자체의 시대 팔레트 시스템은 존재하지 않음(별도 향후 과제).

## 9. 최종 재검증 (실측)

각 워크스페이스 18곡 실생성 (로컬 파이프라인, `generateLocalBlueprint`):

| 워크스페이스/채널 | 곡 수 | 중복 제목/훅 | 시니어 어휘 오염 | BPM 범위 | 가사 길이 범위 | auditAlbum |
|---|---|---|---|---|---|---|
| kr-2030 / after-work-band-pop | 18/18 | 0/0 | 0/18 | 68-116 | 어절 114-159 | PASS (0 errors) |
| jp-2030 / reiwa-way-home-jpop | 18/18 | 0/0 | 0/18* | 70-125 | 글자 434-641 | PASS (0 errors) |
| kr-idol-male / stage-night | 18/18 | 0/0 | 0/18 | 95-132 | 어절 120-159 | PASS (0 errors, 0 idol-lint 위반) |
| kr-idol-female / daylight-city-kpop | 18/18 | 0/0 | 0/18 | 95-138 | 어절 115-159 | PASS (0 errors, 0 idol-lint 위반) |
| senior-oldpop / good-morning-memory-radio (회귀 확인용) | 18/18 | 0/0 | 해당 없음(자기 정체성) | 64-100 | 영단어 166-238 | PASS |

\* jp-2030에서 "radio"가 1건 검출됐으나 문맥 확인 결과 `jp2030-heisei-nostalgia` 장르 자체의 정당한 프로덕션 서술어("warm 2000s-style radio mix" — 2000년대 라디오 믹스 스타일이라는 음향 용어, 시니어의 "오래된 라디오" 사물 모티프와 무관)로 확인 — 오염 아님.

**isolationAudit.ts**: PASS 46 / FAIL 4 / SKIP 17 — FAIL 4건 전부 §8에서 설명한 범위 밖/기존 항목, 이번 작업이 만든 회귀 없음.

**전체 테스트 스위트**: `npx vitest run` 185개 파일 전부 PASS(2173 테스트). 세션 전체에 걸쳐 간헐적으로 실패한 `S1`(타이밍 임계값)/`S4`(30초 타임아웃)는 격리 재실행 시 매번 통과 — 실행 부하에 따른 기존 타이밍 플레이키니스로 확인, 이번 작업의 회귀 아님.

**`npx tsc --noEmit`**: clean.

## 10. `ready` 플래그

kr-2030/jp-2030/kr-idol-male/kr-idol-female 4개 워크스페이스 모두 `ready: true`로 재전환(§9 실측 근거). senior-oldpop/kr-kids/jp-kids는 변경 없음.
