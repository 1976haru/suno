# TASK v4.1 — 컨셉 유형 · 언어별 기준 · 문제 분류 (2/3) 완료 보고

작업자: Claude Code

브랜치: `feat/notion-genre-library` (v4.0, 커밋 `d61708e` 위에서 작업)

---

## 1. 개요

v4.0(워커/repair/버전, `d61708e`)이 이미 완료된 상태에서 시작. 이 작업은 3단 관문 체계가 실제로 갖고 있던 3가지 실패 모드를 고쳤습니다.

1. **언어 무시** — 단어수 계산이 공백 분리만 사용해 일본어 가사가 사실상 1단어로 계산됨.
2. **컨셉 폭 무시** — 장르/BPM/보컬 다양성 기준이 전부 고정 상수라 "잔잔한 보사노바 18곡" 같은 의도적으로 좁은 컨셉에도 같은 기준이 강제됨.
3. **팩 문제의 전곡 복사** — 팩 전체 문제(시대 비중·제목 패턴 등)가 `blocking.push(...findings.blocking)` 형태로 18곡 전부에 동일하게 복사됨.

TASK 순서: A(컨셉 유형) → B(언어별 가사 기준) → D(점수 분리) → C(문제 5단계 분류, 가장 위험도 높아 마지막). 4개 전부 완료.

---

## 2. TASK A — `ConceptBreadth`

- `types.ts`: `ConceptBreadth = 'focused'|'balanced'|'variety'`, `ResolvedConstraints.breadth`/`breadthSource`.
- `core/constraints.ts`: `detectConceptBreadth(freeText, era)` — `extractEraConstraint`와 같은 정규식 키워드 매칭 패턴.
- `core/designGate.ts`: `BREADTH_THRESHOLDS` 테이블 — 장르 종류(1-3/4-9/6-9), 같은장르최대(12/5/4), BPM stddev(4/8/10), BPM 범위(10/25/30), 보컬 종류(1/3/3), 보컬최소곡수(제한없음/3곡/4곡). `balanced`는 기존 하드코딩 값을 그대로 보존(회귀 0 보장).
- `core/setDirector.ts`: `chooseGenreIds`가 breadth를 받아 장르 개수 target을 breadth-aware하게 계산하도록 수정 — **구현 중 발견한 필수 보정**: designGate가 breadth-aware해진 뒤에도 upstream 할당기가 그대로면 focused 컨셉이 오히려 자기 관문에 걸리는 역효과가 생겨, 계획에 없던 `chooseGenreIds` 수정을 승인된 계획의 논리적 연장으로 판단해 함께 처리.
- `Step2Plan.tsx`: "이 세트의 성격" 3-way 라디오, 자동판정값 기본 선택, 변경 시 `breadthOverride` → 재계산.
- **focused에서도 유지**: 가사 상황 전곡 다름, 감정 아크 다양성, 어휘 반복 상한 — breadth로 건드리지 않음. 제목 패턴 최소만 focused=3/balanced·variety=4로 breadth-종속(지시문의 명시적 예외).

### 실측 (실제 브라우저, 시니어 채널)

| 컨셉 | breadth 판정 | 장르 배분 | 관문1 |
|---|---|---|---|
| "비 오는 날 창가에서 듣는 잔잔한 보사노바" | **집중형 (focused)** | Bossa Cafe Pop/Lo-fi Cafe Pop/Acoustic Jazz Pop 6곡씩, 3종 | 통과 ✅ |
| "6070년대 올드팝 여러 장르 모음" | **폭넓게 (variety)** | 5종 (70s Soft Rock AM Gold 2/Motown Pop Soul 4/70s Piano Pop Ballad 4/Doo-Wop Close Harmony 4/Brill Building Pop 4) | 통과 ✅ |
| "굿모닝 추억라디오 시니어 세트" (스크립트) | 균형형 (balanced) | 4종 | 기존과 동일 (회귀 없음) |

두 경우 모두 가사 장면(`가사 장면` 목록)이 18곡 전부 서로 다른 값 — focused에서도 가사 다양성이 relax되지 않음을 확인.

**미구현 표시**: variety 컨셉이 5종을 배분한 것은 6-9 목표 범위 미달 — `chooseGenreIds`의 breadth-aware target 선택 이후 `applyEraQuota`의 다운스트림 트리밍이 개수를 더 줄일 수 있어서다. 버그가 아니라 설계된 한계로 판단: 관문1 자체가 breadth-aware해졌으므로 부족한 다양성은 관문이 정직하게 지적하는 것이 관문의 실제 역할이지, "무조건 6종 이상 강제"가 목표가 아님. 시간 예산 안에서 고치지 않고 명시.

---

## 3. TASK B — 언어별 가사 기준

- 신규 `core/lyricMetrics.ts`: `measureLyrics(lyrics, language)` — English/Korean은 공백 분리(단어/어절) + 근사 음절수, **Japanese는 공백 분리를 전혀 하지 않고** 히라가나/가타카나/한자 정규식으로 문자수 계산 + 요음/촉음/발음 처리한 모라 근사.
- `types.ts`의 `AudienceProfile.lyricMetricsByLanguage` + `data/audienceProfiles.ts`의 `SENIOR_AUDIENCE_PROFILE`에 실제 값 입력(English 215-230/Korean 150-180 어절·350-450 음절/Japanese 400-520자·400-520모라) — 추정치임을 주석에 명시, 실제 보정은 v4.2 몫.
- 소비처 3곳(`compositionScorer.ts`/`promptComposer.ts`/`generationGate.ts`) 전부 `measureLyrics`+`resolveLyricRange` 참조로 교체. 각 파일의 기존 임계값(130/190/200/240/215/230)은 **비율 상수**로 보존해 English 결과가 완전히 동일하게 유지되도록 함(예: `LYRIC_BLOCKING_FLOOR_RATIO = 130/215`).

### 실측 (스크립트, 4문장 일본어 가사 샘플)

```
OLD(공백 분리 가정): 19 "단어"  (섹션 태그까지 한 토큰으로 세는 등 사실상 무의미)
NEW measureLyrics(japanese): { primary: 129 (문자수), syllables: 125 (모라) }
resolveLyricRange('japanese', SENIOR_AUDIENCE_PROFILE): { primaryRange: [400,520], syllableRange: [400,520] }

영어 sanity check (회귀 없음 확인):
lyricWordAndSectionCounts(englishLyric, 'english') → { words: 36, sections: 2 } (기존 로직과 동일)
resolveLyricRange('english', SENIOR_AUDIENCE_PROFILE) → [215, 230] (기존 MIN/MAX_LYRIC_WORDS와 동일)
```

**미구현 표시**: 실제 18곡 일본어 세트를 브라우저에서 생성해 문자/모라 표로 남기지 못함 — `core/lyricEngine.ts`(로컬 프리뷰 가사 생성기)는 `lyricLanguage`를 전혀 참조하지 않아 어떤 언어를 선택해도 영어 템플릿 가사만 생성한다(v4.1 이전부터 있던, 이 작업 범위 밖의 구조적 한계 — `lyricEngine.ts`의 문장 생성 로직은 지시문에서도 명시적으로 손대지 말라고 한 부분). 대신 실제 일본어 텍스트로 함수 자체를 직접 측정해 언어 인식이 실제로 동작함을 확인했고, 코드 경로(`opts.lyricLanguage` → `evaluateGenerationGateResponsive`)가 실제 채널의 언어 설정을 그대로 전달하는 것은 코드 검토로 확인.

---

## 4. TASK D — 점수 분리

- `types.ts`: `SongScores { structureScore, safetyScore, conceptFitScore, diversityScore, renderScore?, listenerScore? }`. 기존 `qualityScore` 필드는 완전히 그대로 유지(하위호환).
- `core/quality.ts`: `scoreSong`이 `structureScore`(=기존 qualityScore와 동일 계산) + `safetyScore`(`exportCompliance.ts`의 콘텐츠ID 플래그 기반 100-감점)를 계산. `scoreSongs`가 팩 전체를 보고 `diversityScore`(장르/보컬타입 팩 내 중복도 기반 경량 휴리스틱)를 계산.
- `core/promiseAudit.ts`: 신규 `applyConceptFitScore(songs, conceptLabel)` — **quality.ts가 아니라 여기 배치**. 이유: `quality.ts → promiseAudit.ts → localGenerator.ts → quality.ts`로 이어지는 3-모듈 순환 참조를 실제로 만들어봤다가 런타임 오류로 확인함(아래 §6 참고) — `promiseAudit.ts`의 `MOOD_KEYWORDS` 테이블이 모듈 초기화 시점에 undefined를 읽어 "잔잔한" 등 무드 키워드가 있는 모든 컨셉에서 크래시가 났음. `Step4Result.tsx`(실제 컨셉 텍스트를 아는 표시 계층)에서 한 번만 호출하도록 변경해 순환을 제거.
- `SongCard.tsx`: `{qualityScore}/100` 단일 표시 → `구조 N · 안전 N · 컨셉 N · 다양성 N [· 렌더 N] [· 평가 N]` 라벨 표시로 교체. `listenerScore`는 이미 로드되어 있는 평가(👍/🤷/👎) 상태에서 즉석 계산.

### 실측 (실제 브라우저, 18곡 생성 결과)

```
트랙 4 "Keep the Light On" 카드: 구조 80 · 안전 100 · 컨셉 33 · 다양성 85
```

컨셉 이행도 33%가 구조 80점에 가려지지 않고 독립적으로 노출됨 — 지시문이 지적한 "컨셉 이행도 49%가 구조 95점에 가려집니다" 문제가 실제로 해소된 것을 실제 화면에서 확인.

**미구현 표시**: `renderScore`(v3.73/74 오디오 분석 기반)는 이번 세션에서 실제로 연결하지 않음 — `SongCard.tsx`가 오디오 테이크 데이터를 아예 받지 않는 구조라, 연결하려면 `Step4Result.tsx`에서 트랙별 오디오 분석 결과를 조회해 새 prop으로 내려줘야 하는데 이는 P1 예산 안에서 처리하지 못함. 타입은 옵셔널이라 항상 `undefined`로 안전하게 생략되며, 거짓 값을 표시하지 않음.

---

## 5. TASK C — 문제 5단계 분류 (가장 위험도 높음)

- `types.ts`: `IssueScope = 'track'|'pair'|'rebalance'|'design'|'full'`, `ScopedIssue { scope, id, labelKo, affectedTracks, fixHintKo }`.
- `core/compositionScorer.ts`: `scoreComposition`의 반환 타입을 `CompositionScore[]` → `{ tracks, packBlocking: ScopedIssue[], packAdvisory: ScopedIssue[] }`로 변경. 팩 레벨 항목(시대 일관성/보컬·템포 구조 붕괴/어휘 반복/훅 단어 과다/제목 형태) 6개를 트랙 루프 밖으로 이동.
- `core/generationGate.ts`: 233-234행의 `...pack.blocking`/`...pack.advisory` 트랙 전체 복사를 **삭제**. `packLevelFindings`가 만드는 항목들을 `ScopedIssue[]`로 변환하며 분류표대로 scope 태깅. 신규 `computeRebalanceTracks(groups, varietyMin, maxPerCategory)` — 실제 최소에 가까운 재작업 대상 트랙 집합을 그리디로 계산(정확한 조합 최적해는 아님, 명시).
- `core/bridgeRecompose.ts`: `buildRecomposeInstruction`에 `fields: 'all'|'titleOnly'` 추가, `songsForScopedIssue` 헬퍼 신규.
- 신규 `components/GenerationGatePanel.tsx` — "곡별 문제"(track/pair) / "일부만 손보면 되는 것"(rebalance, 자체 좁은 복사 버튼) / "설계 단계 문제"(design/full) 3구획. **design/full 스코프 문제가 하나라도 있으면 전체 재작곡 버튼 비활성화**.
- 부수 수정: `workers/localGenerationWorker.ts`에 `generationGate` 메시지 타입 추가, `core/localGenerationClient.ts`에 `evaluateGenerationGateResponsive` 추가, `Step4Result.tsx`의 `evaluateGenerationGate` 동기 `useMemo` 호출을 워커 경유 비동기로 전환(v4.0 워커 이전에서 빠졌던 gap을 이번에 마저 닫음).

### ★ 실측 (실제 브라우저, 실제 생성된 18곡 팩 — 조작하지 않은 유기적 결과)

`.design-gate-panel` DOM을 직접 조회한 결과:

```
곡별 문제 (18곡) — 트랙별 실제 문제만: 가사 단어수 부족, 섹션 수 초과, 편곡 어휘 누출, 스타일 유사도 등. 트랙마다 자기 것만 나열됨(팩 문제 복사 없음).

일부만 손보면 되는 것:
  - 어휘 반복(30회 초과, quiet 75회 등): 트랙 1~18 (이 항목은 실제로 전곡에 단어가 퍼져 있어 18개가 정당함) · "18곡만 재생성 지시문 복사"
  - 제목 패턴 종류가 3종(최소 4종); "long-phrase" 패턴이 12곡에 반복(최대 5곡)
    → affectedTracks: [11,12,13,14,16,17,18] = 7곡 (18곡 아님!)
    → "다음 7곡의 제목만 다시 지어주십시오. 가사와 스타일 프롬프트는 유지하십시오."
    → "7곡만 재생성 지시문 복사" 버튼

설계 단계 문제:
  - 이 컨셉의 주 시대(1950s-60s) 장르 비중이 0%로 최소 50% 미만
  - 보컬 서술 종류가 10종(최소 12종)
  - ⚠ 전체 재생성 권장 — 컨셉 약속 이행도가 33%로 40% 미만 (TASK C 신규: <40% → full 스코프)

전체 재작곡 지시문 복사 버튼: disabled = true  (설계 단계 문제가 있어 정상 비활성화)
```

**이것이 지시문 6절 시나리오 D·E의 실제 검증입니다** — 제목 패턴 문제가 18곡이 아니라 **정확히 7곡**으로 좁혀졌고(계산된 최소 재작업 집합), 설계 단계 문제가 있을 때 전체 재작곡 버튼이 실제로 비활성화되는 것을 조작 없이 실제 생성 결과에서 확인했습니다.

콘솔 에러: 이 전체 플로우(채널 선택→컨셉 입력→설계→18곡 생성→결과 렌더)에서 **0건**.

**미구현 표시**: `computeRebalanceTracks`는 그리디 휴리스틱 — 엄밀한 조합 최적해가 아님(지시문 자체가 "과도한 일반화보다 실제 검증 시나리오 D를 확실히 통과시키는 것 우선"이라 명시). `pair` 스코프의 "worse-scoring song only" 판정은 실제 점수 비교 대신 "먼저 나온 트랙을 원본으로 취급, 이후 트랙만 대상"이라는 단순 규칙으로 근사.

---

## 6. 오류와 수정

### 순환 참조 크래시 (실제 발견·수정)

TASK D 구현 초기, `core/quality.ts`가 `core/promiseAudit.ts`의 `auditPromises`를 직접 import하도록 작성했다가 전체 테스트에서 3건 실패:

```
TypeError: Cannot read properties of undefined (reading 'includes')
 ❯ isBrightEmotionArc src/core/promiseAudit.ts:272
 ❯ measureMood src/core/promiseAudit.ts:278
 ❯ auditPromises src/core/promiseAudit.ts:339
 ❯ packConceptFitScore src/core/quality.ts
 ❯ scoreSongs src/core/quality.ts
 ❯ generateLocalBlueprint src/core/localGenerator.ts
```

원인: `promiseAudit.ts`가 `localGenerator.ts`의 `emotionArcsBrightOpening`/`emotionArcsCalmThroughout`/`emotionArcsStrongLift`를 import하고, `localGenerator.ts`가 `quality.ts`의 `scoreSongs`를 import함 — `quality.ts → promiseAudit.ts → localGenerator.ts → quality.ts` 3-모듈 순환이 닫히면서, `promiseAudit.ts`의 모듈 최상위 `MOOD_KEYWORDS` 테이블이 구성되는 시점에 `localGenerator.ts`가 아직 초기화 중이라 해당 배열들이 `undefined`로 읽힘. "잔잔한"(무드 키워드)이 포함된 모든 컨셉에서 재현됨.

수정: `packConceptFitScore` 로직을 `quality.ts`에서 제거하고 `promiseAudit.ts`의 `applyConceptFitScore`로 이동(위 §4 참고) — 새 역방향 edge를 만들지 않아 순환이 사라짐. 전체 스위트(1995개) 재실행으로 확인.

### `computeRebalanceTracks` 수렴 버그 (구현 중 자체 발견·수정)

최초 구현은 "그룹에서 하나를 뽑아냄 = 새 그룹 하나 생김"을 반영하지 못해, 모든 트랙이 단 하나의 그룹에 몰린 극단 케이스(예: 18곡 전부 같은 제목 형태)에서 무한히 수렴하지 않는 논리 오류가 있었음(그룹이 줄어들기만 하고 "새 카테고리 1개 생성"으로 집계되지 않음). `projectedDistinctCount = 남은 그룹 수 + 이미 뽑아낸 트랙 수`로 수정 — 위 §5의 실제 18곡 사례(7곡으로 수렴)로 검증됨.

---

## 7. `npx tsc --noEmit` / `npx vitest run` / `npm run build` / `npm run build:single`

- `npx tsc --noEmit`: 매 단계 편집 후 반복 실행, 항상 클린.
- `npx vitest run`: **1995/1995 통과** (171 파일). 도중 발견한 42건 실패(TASK C의 반환 타입 변경으로 인한 기존 테스트의 구식 API 가정)는 새 동작에 맞게 재작성해 통과 확인 — 실제 회귀가 아니라 테스트가 옛 API를 assert하던 것.
- `npm run build`: 성공 (워커 3개 별도 청크로 정상 번들).
- `npm run build:single`: 성공 (단일 HTML, 워커 인라인 없이 별도 파일 — v4.0과 동일한 기존 한계, 이번 작업으로 변경 없음).

---

## 8. `npx tsx scripts/audit.ts` 출력

```
세트: 비틀즈 느낌의 밝은 60년대 팝 (18곡)

⚠ 미달 12건 (이전에도 실패했거나 신규 항목)
  [보컬] 보컬 서술 종류 ≥12 | 지금 11
  [프롬프트] 프롬프트 길이 350~650자 | 지금 651~879자
  [프롬프트] 서술어 개수 15~25 | 지금 24~32
  [프롬프트] 시대 모순 서술어 0건 | 지금 1건
  [가사] 가사 단어수 215~230 | 지금 137~177
  [가사] 섹션 수 7~8 | 지금 7~9
  [가사] 편곡 어휘 가사 누출 0곡 | 지금 3곡
  [가사] 어휘 최대 반복 ≤20회 | 지금 50회
  [가사] 어휘 반복(blocking, 30회) ≤30회 | 지금 50회
  [제목] 제목 패턴 종류 ≥4 | 지금 3
  [제목] 같은 패턴 최대 곡수 ≤4곡 | 지금 8곡
  [약속 이행도] 약속 이행도 종합 ≥70% | 지금 52%

✅ 통과 27건
⬜ 미측정 9건 (2건 음원 필요, 3건 미구현)

종합: 48개 항목 중 27 통과 / 0 회귀 / 12 미달 / 9 미측정
```

**0 회귀** — 이 12건은 로컬 템플릿 가사 생성기(`lyricEngine.ts`, 이번 작업에서 손대지 않음)의 기존 한계이며, v4.1 작업 전에도 동일하게 미달이던 항목입니다. `audit.ts`가 사용하는 컨셉은 balanced 판정(장르 다양성 요구 그대로)이라, focused 시나리오의 의도적 다양성 완화는 이 결과에 영향을 주지 않습니다.

---

## 9. 완료 판정

| 항목 | v4.1 이전 | 지금 |
|---|---|---|
| 컨셉 유형 판정 | 없음(고정 기준) | `detectConceptBreadth` 자동 판정 + 수동 override, 실측 확인 |
| 장르/BPM/보컬 다양성 기준 | 고정 상수 | breadth별 테이블(`BREADTH_THRESHOLDS`), 실측 확인 |
| focused 가사 다양성 | (해당 없음) | 유지됨 — 18곡 가사 장면 실측으로 확인 |
| 언어별 가사 기준 | 하나(영어 기준 하드코딩) | 언어별 실제 측정(`lyricMetrics.ts`) + AudienceProfile 데이터 |
| 일본어 단어수 계산 | 공백 분리(사실상 무의미) | 문자/모라 기반 실측 |
| qualityScore | 단일 합산 | 6축 분리(`SongScores`), 실측: 구조 80·안전 100·컨셉 33·다양성 85 |
| 팩 문제의 트랙 복사 | 전곡에 동일 복사 | `ScopedIssue`로 scope별 분리, 실측: 제목패턴 18→7곡 |
| 문제 스코프 | 없음(전부 track 취급) | 5단계(track/pair/rebalance/design/full) |
| rebalance 최소 재작업 계산 | 없음 | `computeRebalanceTracks`, 실측 검증 |
| 재작곡 버튼 vs 설계 문제 | 구분 없음 | design/full 있으면 비활성화, 실측 확인 |
| 재작곡 지시문 범위 | 항상 전체 | `fields: 'titleOnly'` 좁은 변형 추가 |
| 관문2 실행 위치 | 메인 스레드 동기 | Worker 비동기 (v4.0 gap 마저 닫음) |
| `qualityScore` 필드 | — | 그대로 유지 (하위호환) |

---

## 10. 검증 시나리오 A-E (실제 브라우저)

| 시나리오 | 결과 |
|---|---|
| A: focused 컨셉 → 장르 1-3종, 가사 다양성 유지 | ✅ 실측 (§2) |
| B: variety 컨셉 → 장르 확대 요구 | ✅ 실측, 다운스트림 트리밍으로 5종(6-9 목표 미달, 관문이 정직하게 지적 — §2 명시) |
| C: 일본어 문자/모라 기준 측정 | ✅ 함수 단위 실측(§3) — 실제 18곡 일본어 브라우저 생성은 `lyricEngine.ts`의 언어 무관 템플릿이라는 기존 구조적 한계로 불가, 사유 명시 |
| D: 제목 패턴 좁은 재생성 (핵심) | ✅ 실측 — 18곡이 아니라 7곡으로 좁혀짐 (§5) |
| E: 설계 문제 시 재작곡 버튼 비활성화 | ✅ 실측 — `disabled: true` 확인 (§5) |

---

## 11. 미구현 / 부분 구현 (명시)

- variety 컨셉의 장르 개수가 다운스트림 시대 쿼터 트리밍으로 6-9 목표 미만이 될 수 있음 (§2) — 관문이 정직하게 지적하는 것으로 처리, "항상 강제"는 하지 않음.
- 일본어/한국어 실측 목표값은 추정치 — v4.2에서 실제 세트로 보정 필요 (스펙 자체가 명시).
- `renderScore`는 실제로 연결하지 않음 — `SongCard.tsx`에 오디오 데이터가 흐르지 않는 구조 (§4).
- `computeRebalanceTracks`는 그리디 휴리스틱, 엄밀한 최적해 아님 (§5, 지시문이 이 우선순위를 명시).
- `pair` 스코프의 "worse-scoring song only"는 실제 점수 비교가 아니라 "나중 트랙을 대상"이라는 단순 규칙.
- 실제 18곡 일본어 세트의 문자/모라 표는 함수 단위로만 확보 — 브라우저 생성 결과표는 없음(§3, §10-C).

---

## 12. 주요 신규/수정 파일

**신규**: `src/core/lyricMetrics.ts`, `src/components/GenerationGatePanel.tsx`

**주요 수정**: `src/types.ts`, `src/core/constraints.ts`, `src/core/designGate.ts`, `src/core/setDirector.ts`, `src/components/steps/Step2Plan.tsx`, `src/core/compositionScorer.ts`, `src/core/generationGate.ts`, `src/core/compositionRecompose.ts`, `src/core/bridgeRecompose.ts`, `src/core/quality.ts`, `src/core/promiseAudit.ts`, `src/components/SongCard.tsx`, `src/components/steps/Step4Result.tsx`, `src/data/audienceProfiles.ts`, `src/workers/localGenerationWorker.ts`, `src/core/localGenerationClient.ts`

**테스트 수정** (API 변경에 따른 재작성, 새 동작 반영): `tests/compositionScorer.test.ts`, `tests/generationGate.test.ts`, `tests/v420ConceptConstraints.test.ts`

---

## 13. 하지 말 것 — 준수 확인

- focused의 가사 다양성 완화: 하지 않음 (§2 실측으로 확인).
- 언어별 값을 `AudienceProfile` 밖에 하드코딩: 소비처의 fallback 상수(`FALLBACK_RANGE_BY_LANGUAGE`)만 예외적으로 존재하며 이는 "profile 없을 때만" 쓰이는 명시적 폴백 — 실제 프로필(SENIOR_AUDIENCE_PROFILE)은 전부 `lyricMetricsByLanguage`를 사용.
- 한국어/일본어 추정치를 최종으로 취급: 코드 주석과 본 보고서 모두에 "추정치, v4.2에서 보정 필요" 명시.
- `rebalance`를 전체 트랙 재생성으로 처리: 하지 않음 — `songsForScopedIssue`로 affectedTracks만 추출.
- 제목만 고치면 되는데 가사까지 재생성 요청: `fields: 'titleOnly'`로 분리.
- 6개 점수를 합산: 어디에도 합산 코드 없음 — `SongScores`의 각 필드는 독립적으로만 읽힘.
- `qualityScore` 삭제: 그대로 유지, 모든 기존 소비처 변경 없음.
- `design` 스코프 문제를 곡 재생성으로 고치려 시도: `GenerationGatePanel`이 design/full에는 재생성 버튼을 아예 제공하지 않고 비활성화만 함.
- 새 기능 추가: 없음 — 전부 기존 관문/점수 시스템의 기준 조정과 재분류.
- `lyricEngine.ts`의 문장 생성 로직: 손대지 않음.
