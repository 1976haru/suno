# v5.6 — 6개 신규 워크스페이스 실행 전 감사 (Pre-Flight Audit)

**원칙 준수 확인**: 이 문서의 모든 수치는 실제로 `npx tsx`로 로컬 생성 파이프라인을 실행하고, 실제로 생성된 가사/스타일 프롬프트를 직접 읽어서 얻은 값입니다. "코드를 읽고 이렇게 동작할 것이다"라고 추정한 항목은 전부 실행/측정으로 검증했고, 검증하지 못한 항목은 §13에 "미검증"으로 명시했습니다.

- 실행 커밋: `201a4c6` (branch `feat/notion-genre-library`), 작업 트리 clean (지시대로 `lyrics/`, 한국어 md 파일은 건드리지 않음)
- 측정 스크립트: `scripts/v56Measure.ts` (신규, 재사용 가능하도록 남겨둠), 원본 출력: `v56-measure-out.json` (repo root, gitignore 대상 아님 — 필요시 삭제 가능)
- 기존 스크립트 재사용: `scripts/audit.ts`(수정 없음), `scripts/isolationAudit.ts`(수정 없음)
- 프로덕션 코드/데이터는 전혀 수정하지 않았습니다. 이 문서는 보고 전용입니다.

---

## 0. 이 감사에서 발견한 가장 중요한 3가지 (요약)

실제 실행이 아니었다면 못 잡았을 것들입니다. 세부 근거는 각 섹션 참조.

1. **채널 선택 UI가 워크스페이스로 전혀 필터링되지 않습니다 (브라우저 실측, §10).** `kr-2030`/`kr-kids`/`jp-kids` 워크스페이스로 전환해도 "채널 프로필 에디터"와 채널 드롭다운은 시니어 워크스페이스를 포함한 **전체 25개 채널**을 그대로 보여주고, 기본 선택 채널도 시니어의 "굿모닝 추억라디오"로 고정됩니다. 워크스페이스 선택 화면 자체의 안내문("다른 워크스페이스의 채널·팩·훅·평가는 여기서 보이지 않습니다")과 정면으로 모순됩니다. 원인: `src/hooks/useChannelManager.ts:6,10` — `channels = [...channelPresets, ...customChannels]`, 워크스페이스 필터 없음.
2. **성인 비-시니어 워크스페이스(kr-2030/jp-2030/kr-idol-male/kr-idol-female) 4개는 실제 가사 본문을 시니어와 100% 동일한 공용 문장 템플릿에서 생성합니다 (§3, §7).** `lyricThemes.ts`의 18개 "전용 장면"은 격리 검사(L3)에서 PASS로 나오지만, 이건 메타데이터일 뿐이고 실제로 불려지는 가사 문장은 `src/core/lyricEngine.ts:236-299`의 단일 `koOpening`/`koSituation`/`koChorusDev`/`koBridge` 풀입니다 — "봄 빛이 문가에 내려, 오래된 잔 위에 머물고" 같은 문장이 kr-2030, kr-idol-male, kr-idol-female 세 워크스페이스에서 토씨 하나 안 틀리고 반복 출현했습니다. jp-2030도 같은 내용을 일본어로 번역한 문장을 씁니다. `motif`(명사)만 워크스페이스별로 바뀌고 감성/어조/문장 구조는 전부 동일 — 즉 "20대 퇴근길"도 "아이돌 무대"도 "레이와 J-POP"도 문장 수준에서는 사실상 같은 노래입니다.
3. **동요 안전 검증기가 실제 생성 파이프라인에 연결돼 있지 않습니다 (§6, §7).** `kidsLyricEngine.ts`의 `kidsLyricSafetyIssues`/`isKidsLyricSafe`/`referencesExistingKidsSong` — 금지어 블랙리스트, 연령대 화이트리스트, 기존 동요 표절 검사 — 는 `localGenerator.ts`/`generationGate.ts`/`quality.ts` 어디에서도 호출되지 않습니다. 호출부는 `tests/kidsLyricEngine.test.ts`(단위 테스트)와 이번에 새로 만든 `scripts/v56Measure.ts`뿐입니다. 지금 산출물이 안전한 건 손수 작성된 콘텐츠 풀 자체가 깨끗하기 때문이지, 파이프라인이 그걸 보장해서가 아닙니다 — 실제 배포된 앱에서 동요를 생성해도 이 검증기는 한 번도 돌지 않습니다.

---

## 1. TASK A — 워크스페이스 × 구성요소 실측 매트릭스

| 구성요소 | senior-oldpop | kr-2030 | jp-2030 | kr-kids | jp-kids | kr-idol-male | kr-idol-female |
|---|---|---|---|---|---|---|---|
| channelSoundFloor requiredAtoms | **3** (`senior-oldpop-floor`) | **0** | **0** | **0** | **0** | **0** | **0** |
| 실제 적용되는 AudienceProfile | `senior` (전용, 실측정) | `general`(placeholder) | `general`(placeholder) | `kids`(generic, 연령무관) | `kids`(generic, 연령무관) | `general`(placeholder) | `general`(placeholder) |
| tempoFloor–Ceiling (실제 적용) | 62–100 | 60–132 | 60–132 | 92–128 | 92–128 | 60–132 | 60–132 |
| lyricWordRange (실제 적용) | [200,250] | [180,260] | [180,260] | [120,220] | [120,220] | [180,260] | [180,260] |
| hardExclusions 개수 (실제 적용) | **8** | **0** | **0** | **0** | **0** | **0** | **0** |
| 워크스페이스 전용 AudienceProfile (`kr-2030-emotional` 등) | N/A | **작성됐지만 미연결(dead)** | **작성됐지만 미연결** | **작성됐지만 미연결**(`kids-0to2/2to4/4to7`) | **작성됐지만 미연결** | 아예 없음 | 아예 없음 |
| 가시 장르 수 (`archetypes` 기준) | 217 (senior-morning 아키타입 기준, 워크스페이스 전체 10개 아키타입 합산 시 더 많음) | **6** | **7** | **7** | **7** | **7** | **7**(male과 공유, 의도적) |
| 5축 GenreTraits 실채움 비율 | ~60-80개/320개 전체 카탈로그 중 senior 계열 집중(전체의 약 20%) | **0%** | **0%** | **0%** | **0%** | **0%** | **0%** |
| era-canon-palette 또는 동급 체계 | 7개 팔레트(`ERA_CANON_PALETTES`, 실작동) | 없음(N/A, 설계상 시니어 전용) | 없음(N/A) | 없음(N/A) | 없음(N/A) | 없음(N/A) | 없음(N/A) |
| paletteFamilies 그룹핑 | 있음 | **0**(미포함) | **0** | **0** | **0** | **0** | **0** |
| titlePatterns 워크스페이스 스코핑 | 8개 패턴 전부 공용(`fitsWorkspaces` 필드 존재하나 **한 번도 채워지지 않음**) | 0(공용 8개 그대로 사용) | 0 | 0 | 0 | 0 | 0 |
| vocabularyBank 실제 스코핑 | 11개 전용 뱅크(`SENIOR_VOCABULARY_BANKS`) | **0** — `vocabularyBankForScene()`가 항상 시니어의 `quiet-morning` 뱅크로 폴백 (`src/data/vocabularyBanks.ts:187-193`) | 0(동일 폴백) | 0(kids는 이 시스템 자체를 안 씀, 별도 경로) | 0(동일) | 0(동일 폴백) | 0(동일 폴백) |
| lyricThemes (`suitedArchetypes`) 스코핑 개수 | 40(senior-morning)+18+12+12+18 | **18**(전용, L3 PASS) | **18**(전용, L3 PASS) | 0 — **별도 시스템**(`kidsLyricEngine.ts`, 8테마×3언어) | 0 — 별도 시스템(동일) | **18**(전용, L3 PASS) | **18**(전용, L3 PASS) |
| 실제 가사 본문 소스 | `lyricEngine.ts` 공용 템플릿 (시니어 어조가 곧 이 템플릿의 원 설계 대상) | **동일 공용 템플릿**(시니어와 100% 동일 함수, §0-2 참조) | 동일(일본어 버전) | `kidsLyricEngine.ts` 전용 손수 작성 콘텐츠(안전) | 동일(전용) | **동일 공용 템플릿** | **동일 공용 템플릿** |
| hook bank 분리(언어/아키타입) | 기준 자체 | PASS(교집합 0) | PASS | PASS | PASS | PASS | PASS |
| bpmLengthControl 커버리지 | 62–100 BPM 전 구간 커버(전용 설계) | **부분**: 실측 BPM 최대 125, 100 초과분은 최상단 tier(95-100용, 200-220단어)로 clamp — 미검증 구간 | 부분(실측 최대 130, 동일 clamp) | 부분(실측 92-128, 100 초과분 clamp) | 부분(동일) | 부분(실측 최대 128) | 부분(실측 최대 130) |
| 연령대별(T1/T2/T3) 세분화 | N/A | N/A | N/A | **데이터는 존재(`kidsAgeTiers.ts`)하나 생성 파이프라인 어디에서도 `ageTier` 파라미터를 넘기지 않음 — 완전 미연결** | 동일(미연결) | N/A | N/A |
| killing point set 실제 해석 | `KILLING_POINTS`(시니어 전용) 실제 사용 | id만 선언(`kr-2030-emotional-default`), `killingPointById()`는 항상 시니어 풀만 검색 → **실질적으로 시니어 킬링포인트 재사용** | 동일 | `KIDS_KILLING_POINTS` 데이터는 존재하나 `killingPointById()`가 그 배열을 아예 조회하지 않음 → **미연결** | 동일(미연결) | 동일(시니어 재사용) | 동일 |
| arc 모델 | `five-phase`(구현됨, 실제 사용) | `five-phase` | `five-phase` | 프로파일엔 `repetition-cycle` 선언돼 있으나 **`arcPlan.ts`에 해당 로직이 전혀 없음(0줄)** → 실제로는 five-phase 그대로 적용 | 동일(미구현) | `five-phase` | `five-phase` |
| 동요 안전 정책 실제 룰 | N/A | N/A | N/A | **연결 안 됨** — `kidsLyricSafetyIssues` 등 실호출 0건(§0-2, §6) | 동일 | N/A | N/A |
| 채널 프리셋 수 | 7 | **3** | **3** | **3** | **3** | **3** | **3** |
| idolExpressionLint 실제 적용 | N/A | N/A | N/A | N/A | N/A | 함수는 있으나 자동 게이트로 호출되는 곳 없음(수동 스캔만 확인, §1-2) | 동일 |

**핵심 해석**: "AudienceProfile을 신규 워크스페이스별로 만들었다"는 이전 작업 커밋 메시지들의 주장은 데이터 레벨에서는 사실이지만(`PROVISIONAL_AUDIENCE_PROFILES` 7개가 실제로 파일에 존재), **런타임 연결이 전혀 없습니다.** 실제 생성 경로는 `src/core/localGenerator.ts:494,789`, `batchPreallocation.ts:142` 등 전부 `audienceProfileForAgeGroup(opts.audience)`만 호출하고, 이 함수는 `AgeGroup`('kids'|'twenties'|...) 값만 보고 `SENIOR_AUDIENCE_PROFILE`/`KIDS_AUDIENCE_PROFILE`/`GENERAL_AUDIENCE_PROFILE` 셋 중 하나만 반환합니다(`src/data/audienceProfiles.ts:372-384`). `WorkspaceDefinition.defaultAudienceProfileId`, `audienceProfileById()`, `PROVISIONAL_AUDIENCE_PROFILES` 전체가 grep 기준 **자기 자신 외에는 호출자가 0개**입니다. 즉 kr-2030/jp-2030/kr-idol-male/kr-idol-female의 실제 생성은 전부 `general` 프로파일(제약·배제어 0개, 넓은 템포/단어 범위)로 이뤄지고, kr-kids/jp-kids는 연령 구분 없는 단일 `kids` 프로파일로 이뤄집니다.

---

## 2. TASK B — 18곡 실측 생성 결과 (워크스페이스별)

로컬 생성 파이프라인(`directSetLocal` → `generateLocalBlueprint`, `scripts/audit.ts`와 동일 실경로) 실행. 전 10런 모두 예외 없이 완료.

| 워크스페이스/채널 | 성공 | 장르 수 | 외부장르 누출 | BPM 범위(평균/표준편차) | 가사 언어 | 단어/글자수(단위, 평균) | 오염 카운트 |
|---|---|---|---|---|---|---|---|
| kr-2030 / after-work-band-pop | ✅ 18/18 | 4 | 0 | 63–125 (96.8/19.5) | 한국어 확인 | 어절 149–198 (166.2) | **6** (§7) |
| kr-2030 / rainy-seoul-nightscape | ✅ 18/18 | 3 | 0 | 63–119 (94.3/19.5) | 한국어 확인 | 어절 120–178 (161.2) | **7** |
| jp-2030 / reiwa-way-home-jpop | ✅ 18/18 | 4 | 0 | 65–130 (92.9/22.2) | 일본어 확인(가나·한자) | 글자 320–469 (431.7) | 0 (단, "J-POP" 반복 관련 §0-2/§7 참조) |
| jp-2030 / tokyo-night-melodic-pop | ✅ 18/18 | 4 | 0 | 63–130 (93.4/22.1) | 일본어 확인 | 글자 352–443 (425.3) | 0 |
| kr-kids / daily-habit-learning-song | ✅ 18/18 | 4 | 0 | 92–128 (107.9/12.0) | 한국어 확인 | 어절 **54–66 (59.8)** | 0 |
| kr-kids / follow-along-action-song | ✅ 18/18 | 4 | 0 | 92–128 (107.5/11.9) | 한국어 확인 | 어절 **54–66 (59.6)** | 0 |
| jp-kids / teasobi-hiroba | ✅ 18/18 | 4 | 0 | 97–124 (109.2/8.9) | 일본어 확인 | 글자 **159–210 (179.3)** | 0 |
| jp-kids / oyasumi-mae-no-uta | ✅ 18/18 | 4 | 0 | 92–126 (108.7/11.0) | 일본어 확인 | 글자 **152–205 (180.9)** | 0 |
| kr-idol-male / stage-night | ✅ 18/18 | 4 | 0 | 69–128 (96.4/19.8) | 한국어 확인 | 어절 147–186 (162.4) | **7** |
| kr-idol-female / daylight-city-kpop | ✅ 18/18 | 4 | 0 | 69–130 (96.0/17.6) | 한국어 확인 | 어절 131–184 (164.3) | **6** |

부가 실측(§7과 함께 읽을 것):
- 제목 유일성: 전 10런 18/18 유일 (중복 0)
- 이중언어 제목(`titleLocalized`): kr-2030/jp-2030/kr-idol-* = 18/18; **kr-kids = 16/18** (2곡 누락, `titleLocalized` 필드가 undefined로 남음 — 원인 미조사, §13)
- 보컬 타입 분배: 전 10런 모두 6/6/6(남/여/믹스) 정확히 유지
- 스타일 프롬프트 길이: 전 워크스페이스 464–765자 (요구 350-700자 범위 대체로 충족, jp-2030이 580-765로 상단 초과 다수)
- 서술어(콤마 구분 단어) 개수: 전 워크스페이스 20-30개 (15-25 타깃 살짝 초과 — 시니어도 동일 경향, §11)
- **아이돌 표현 린트(`lintIdolExpression`) 위반**: kr-idol-male 0/18, kr-idol-female 0/18 — 성적 대상화/미성년 코딩 어휘 실측 0건. (단, 이 린터가 실제 생성 파이프라인의 자동 게이트로 호출되는 지점은 찾지 못함 — 별도 수동 스캔 스크립트로만 확인)

**Korean/Japanese 단어·글자수 측정 방식**: 앱 자체의 `src/core/lyricMetrics.ts`의 `measureLyrics()`를 그대로 import해 사용 — 한국어는 공백 분리 어절 수, 일본어는 공백이 아닌 문자 스크립트 정규식(`가-힣`/`぀-ヿ 一-鿿`) 카운트, 임의로 다른 방식을 쓰지 않았습니다.

**kr-kids/jp-kids 단어수 이상 실측치**: kr-kids 실측 어절수(54-66)는 실제 적용되는 `KIDS_AUDIENCE_PROFILE.lyricWordRange` [120,220]의 하한에도 못 미칩니다(하한의 약 45-55%). jp-kids 실측 글자수(152-210)는 `resolveLyricRange()`가 폴백하는 `FALLBACK_RANGE_BY_LANGUAGE.japanese` [400,520](시니어와 동일 수치, 동요용으로 검증된 적 없음)의 절반에도 못 미칩니다. `generationGate.ts:450-457`가 이 range를 기준으로 track별 word-count 게이트를 실제로 계산하는 코드가 있어(`resolveLyricRange(lyricLanguage, opts.audienceProfile)`), 이 게이트가 실제 생성 흐름에서 kids 콘텐츠에도 그대로 적용된다면 **동요 18곡 전부가 "단어수 부족"으로 blocking 처리될 가능성이 높습니다** — 이 게이트 호출부까지 완전히 추적하지는 못했으므로 §13에 미검증으로 남깁니다.

---

## 3. ★ 21개 전체 가사 전문 + 의도 부합 판단 (7 워크스페이스 × 3곡)

전문은 감사 스크립트 원본 출력(`v56-measure-out.json`)에서 그대로 발췌했습니다(재구성/요약 아님). 지면상 각 워크스페이스 1곡만 이 문서에 전문을 남기고, 나머지 2곡은 트랙 번호와 판단만 기록합니다(전문은 `v56-measure-out.json`의 `allSongs`에서 동일하게 확인 가능).

### 3-1. senior-oldpop — 실행 안 함(지시대로 시니어 코드/데이터 미터치, 이미 검증된 워크스페이스)

### 3-2. kr-2030 (퇴근 후 듣는 감성 밴드팝) — 트랙 3, "한 번 더 택시를 켜둬요"

```
[verse 1]
봄의 침묵이 내려와
빈 의자마다 앉고
종이 달력은 여전히 머금고 있어요
더 부드러운 공기를
봄 거리 저편에서
작은 종소리가 울리고
저녁을 가만히 만지면
시간이 잠시 멈춰요

여전히 이 창가 옆 늦은 카페 자리 안에서
세상이 작고 가깝게 느껴져요
...
[chorus]
매 시간 다정하게
한 번 더 택시를 켜둬요
바래가는 색도
종이 달력처럼, 작은 힘을 찾아요
```

**판단**: 이건 "퇴근 후 지하철과 원룸으로 이어지는 하루의 끝"이라는 kr-2030 자체 채널 프로미스와도, "퇴근길/서른 즈음/새벽 카페" 같은 2030 세대 도시 정서와도 거리가 멉니다. "빈 의자", "종이 달력", "창가 옆 늦은 카페 자리" — 이건 시니어 올드팝의 "아침 카페" 회상 어휘와 사실상 동일한 톤입니다. 콘셉트가 "택시를 켜둬요"라는 낯선 관용구를 만들어낼 만큼 구체적 장면(퇴근길 지하철)에 도달하지 못했습니다. **의도 부합: 실패.** 원인은 §0-2/§7의 공용 템플릿 문제입니다.

트랙 7("조금 더 담배를 켜둬요")·트랙 14("잠깐 멈춰서요, 지친 나")도 동일 패턴 — "오래된 라디오 불빛", "작은 라디오 소리", "고요한 시간" 등 동일 모티프 반복.

### 3-3. jp-2030 (帰り道に聴く令和J-POP) — 트랙 1, "顔を上げて、青春へ"

```
[verse 2: female vocal]
通り過ぎた道も
今は音楽になり
言えなかった気持ちまで
窓辺にそっと座る
...
[chorus]
毎時間やさしく
顔を上げて、青春へ
色あせてゆくものさえ
帰り道に聴く令和J-POPのように、小さな力を見つける
```

**판단**: 언어는 정확히 일본어입니다(문자셋 실측 확인, 영어 문장 없음). 그러나 내용은 kr-2030의 "봄빛/오래된 잔/작은 라디오 소리/아침을 깨워요"와 구조적으로 동일한 내용을 일본어로 옮긴 것에 가깝습니다("春の光がそっと 古いカップに落ちて 小さなラジオの音が 朝をゆっくり起こす" — 트랙 6). 청춘/계절/내적 독백이라는 jp-2030 고유 정서가 아니라 시니어풍 정서를 일본어로 번역한 느낌입니다. 또한 콘셉트 문구 "帰り道に聴く令和J-POP"가 코러스/브릿지에 그대로, 반복적으로("〜のように" 직유 표현으로) 삽입되어 부자연스럽습니다 — 18곡 전곡에서 이 현상 확인. **의도 부합: 실패(§6-2에서 kr-2030과 직접 비교).**

### 3-4. kr-kids (손 씻기 생활습관 동요) — 트랙 5, "숫자를 다같이 신나요"

```
[verse 1]
손가락을 하나씩 세어요
발가락도 세어봐요

[chorus]
숫자를 다같이 신나요
숫자놀이 재미있어
```

**판단**: 문장이 짧고 직접적이며("손가락을 하나씩 세어요") 실제 부모가 쓸 법한 지시문 톤에 가깝습니다. 다만 채널 콘셉트가 "손 씻기 생활습관"인데 생성된 트랙 5는 숫자 세기 주제(genreId `krkids-daily-habit`인데 내용은 counting)로, **하나의 세트 안에서 콘셉트-주제 일치가 느슨합니다.** 안전 측면(§6)에서는 문제 없음. **의도 부합: 부분 성공** — 직접성/한 곡 한 개념 원칙은 지켜지나, 콘셉트(손씻기)와 실제 가사 주제(숫자 세기)가 어긋난 트랙이 섞여 있음.

### 3-5. jp-kids (手遊び歌 ぴょんぴょんウサギ) — 트랙 1, "ぶーぶーをかるくあそぼう"

```
[verse 1]
ひらがなの うたを うたおうよ
みんなで よんで みようよ

[chorus]
ぶーぶーをかるくあそぼう
もじのうた たのしいね
```

**판단**: 안전함, 짧고 반복적, 히라가나 중심. 그러나 콘셉트("手遊び歌 ぴょんぴょんウサギ" — 손유희요·토끼 의성어)와 달리 실제 채택된 장르(`jpkids-teasobi`)는 맞지만 가사 내용은 문자 학습(あいうえお)으로, "ぴょんぴょん"(토끼 의성어) 자체는 이 트랙엔 없습니다(다른 트랙엔 있음, §6 참조). 온전한 손유희 동작 지시(뛰기/짝짝 등)가 이 트랙에는 약합니다. **의도 부합: 부분 성공.**

### 3-6. kr-idol-male (청량한 여름 보이그룹 곡) — 트랙 6, "이 함성을 증명했어"

```
[verse 1]
또 하루의 봄 아침이
벽 위로 부드럽게 내려와
촛불의 빛은 그 색을 지키며
모든 걸 다 품어줘요
...
[chorus]
오늘도 천천히 걸어요
외로운 그림자도
촛불의 빛처럼, 조금씩 옅어져요
이 함성을 증명했어
```

**판단**: 스타일 프롬프트는 "confident male rap-sung lead, live rock drum kit, distorted electric guitar, driving four-on-the-floor pulse opening into a bright unison hook"로 아이돌/퍼포먼스 곡답게 잘 구성돼 있습니다. 그러나 **가사 자체는 아이돌 무대곡의 에너지가 전혀 없습니다** — "촛불의 빛", "외로운 그림자", "오늘도 천천히 걸어요"는 잔잔한 발라드/시니어풍 문장이며, "청량한 여름"이라는 콘셉트도 반영되지 않았습니다. 훅 라인("이 함성을 증명했어")만 아이돌스럽고 벌스는 공용 템플릿 그대로입니다. **의도 부합: 실패.**

### 3-7. kr-idol-female (밝고 상큼한 걸그룹 곡) — 트랙 1, "그냥 이 오후를 해봐요"

```
[verse 1]
봄 바람이 지나가며
하루의 페이지를 넘기고
...
[final chorus]
그냥 이 오후를 해봐요
어디에 있든 집처럼
조용한 거리도
카페의 창처럼, 가까움으로 바뀌어요
```

**판단**: "밝고 상큼한"과는 거리가 먼 잔잔한 톤이고, 마지막 줄의 "카페의 창처럼"은 시니어 오염 리스트에 걸리는 표현(§7)입니다. 스타일 프롬프트는 "punchy Korean idol retro funk disco pop, playful confident male lead, dembow-influenced groove"로 밝은 편이나, 가사가 이를 뒷받침하지 못합니다. **의도 부합: 실패.**

**종합**: 7개 워크스페이스 중 스타일 프롬프트(장르/BPM/보컬 지시어) 레벨에서는 워크스페이스별 차별화가 실제로 존재합니다(§4). 그러나 **가사 본문 레벨의 차별화는 kr-kids/jp-kids(전용 콘텐츠 엔진)를 제외하면 사실상 없습니다.** senior-oldpop이 실사용 검증된 것은 이 공용 템플릿의 원래 설계 대상이 정확히 시니어의 잔잔한 회상 톤이었기 때문이지, 신규 워크스페이스에도 맞기 때문이 아닙니다.

---

## 4. ★ 21개 스타일 프롬프트 전문 (7 워크스페이스 × 3곡)

전 10런에서 워크스페이스별 대표 3개씩 발췌(전문은 `v56-measure-out.json` 동일):

**kr-2030** (`after-work-band-pop`, 트랙 1/7/14):
- "trading lines mid-phrase, loose lines meeting hook, narrow mono-leaning room, male and female duet, warm conversational lead delivery, gentle unhurried phrasing throughout, I-V-vi-IV progression, no instrumental intro, hook heard immediately, 3:10-3:35, hook repeats 4x, octave-lift final chorus, intimate Seoul dawn R&B, emotionally direct Korean lead vocal, late-night vocal closeness, deep round bass, driving electric bass, moderate arrangement, a few instruments at a time, a short memorable instrumental riff opens the song, full arrangement from the first bar, city life, 75 BPM" (472자, 서술어 24개)
- "male lead with female harmony, tight unison with light detune, tape slap echo, ... sleek modern K-pop electro pop, short addictive hook, driving straight-eighth band pulse, punchy synth bass, ... city life, 95 BPM"
- "melodic Korean acoustic folk pop, warm fingerpicked guitar, dark intimate late-night mix, ... final chorus lifts a semitone, city life, 125 BPM"

**jp-2030** (`reiwa-way-home-jpop`, 트랙 1/6/12): "unison splitting to thirds, ... custom concept focus, 帰り道に聴く令和J-POP, piano-led opening, ... modern melodic J-rock, unhurried Heisei-pop ballad pulse, warm 2000s-style radio mix, bright clean-picked electric guitar, ..., city life, 65 BPM" — **참고**: 콘셉트 원문이 스타일 프롬프트에도 "custom concept focus, 帰り道に聴く令和J-POP" 형태로 그대로 삽입됨(가사뿐 아니라 프롬프트에도).

**kr-kids** (`daily-habit-learning-song`, 트랙 1/5/10): "sparkling young girl voice, bright airy tone, playful childlike delivery, clear Korean diction, bright and friendly, I-IV-V-I progression, no instrumental intro, hook heard immediately, 3:10-3:35, hook repeats 4x, ... clear Korean-English learning song, clean bell-forward mix, clear instructive childlike vocal, ukulele, marimba, ... bright, 92 BPM" — 악기(우쿨렐레/마림바)와 톤(밝고 친근함)이 D1 문서의 kids-t2 허용 악기 목록과 실제로 일치합니다. 금지 악기(디스토션 기타/서브베이스 등) 언급 없음 확인.

**jp-kids** (`teasobi-hiroba`, 트랙 1/4/9): "sweet childlike boy voice, gentle and warm, kindergarten-age tone, clear Japanese diction, ... cheerful Japanese hand-play song (手遊び歌), punchy toy-bright clarity, simple onomatopoeia, ukulele, hand claps, ... bright, 97 BPM" — `simple onomatopoeia`가 스타일 프롬프트 지시어로 명시돼 있고 실제 가사에도 일부 반영(§2, onomatopoeia 5/18, 3/18).

**kr-idol-male** (`stage-night`, 트랙 1/6/11): "alternating verses into joined chorus, close third harmony, ... anthemic Korean idol band crossover, live rock drive building into a soaring unison chorus, confident male rap-sung lead, live rock drum kit, distorted electric guitar, ..., city life, 69 BPM" / "... sleek Korean idol synth dance pop, driving four-on-the-floor pulse opening into a bright unison hook, big arena-ready mix, confident male rap-sung lead, four-on-the-floor kick, clap layer, ..., 95 BPM"

**kr-idol-female** (`daylight-city-kpop`, 트랙 1/6/11): "female full chest alto, ... punchy Korean idol retro funk disco pop, playful confident male lead, dembow-influenced groove, slap electric bass, bright horn stabs, ..., city life, 75 BPM" — **참고**: `daylight-city-kpop` 트랙 6/11의 리드 보컬 지시어가 "playful confident **male** lead"인데 `vocalType`은 male(트랙6)/mixed(트랙11)로 실제 일치 — 정상. 다만 "female full chest alto"(트랙1)와 "playful confident male lead"(트랙6 스타일 텍스트 내 장르 고유 표현)가 혼재하는 것은 `kridol-retro-funk` 장르 자체의 `vocal` 필드가 "playful confident male lead"로 고정 서술돼 있어서(장르 프리셋 자체 문구, §13에서 확인 필요 — kr-idol-female 전용 장르 vocal 표현이 아직 성별 중립화되지 않았을 가능성).

**공통 관찰**: 모든 워크스페이스에서 "city life"라는 고정 배경 어휘가 스타일 프롬프트 말미에 등장합니다 — 동요 2곡을 제외한 8곡 전부. 아이돌/2030 워크스페이스뿐 아니라 시니어 감사(§11)에서도 확인된 공용 문구로 보이며, 워크스페이스 차별화 항목이 아니라 전역 상수로 추정됩니다(코드 위치 미추적, §13).

---

## 5. §6-2 — 한국어 vs 일본어 직접 비교

- kr-2030 "퇴근 후 듣는 감성 밴드팝" vs jp-2030 "帰り道に聴く令和J-POP" (둘 다 "퇴근길/하교길에 듣는 노래"라는 사실상 동일 콘셉트로 설계된 채널 프리셋)
- 장르: kr-2030은 밴드팝/R&B/Y2K/일렉트로팝/OST발라드/포크(6종, 베이스·드럼 중심 서술), jp-2030은 멜로딕 J-rock/아니메 시네마틱/헤이세이 노스탤지어/댄스보컬/카와이아이돌/네오시티팝/칠 네오소울(7종, 기타·피아노 중심 서술) — **장르 서술어 축(베이스/드럼 vs 기타/피아노)은 실제로 다릅니다.** 이 축만큼은 설계 의도대로 분화돼 있습니다.
- 가사 정서: §3-2/§3-3에서 보듯 **거의 동일한 내용을 언어만 바꿔 부른 것에 가깝습니다.** "오래된 라디오/작은 라디오 소리/아침을 깨워요" 모티프가 두 언어 모두에서 나타나며, 콘셉트 문구 자체("帰り道に聴く令和J-POP")가 가사·프롬프트에 그대로 삽입되는 패턴은 jp-2030에서 더 두드러집니다.
- 구조: 두 워크스페이스 다 동일한 T1~T5 구조 템플릿 세트(`adult-t1-t5`)를 공유 — A-멜로/B-멜로/사비 같은 일본 특유의 구조 구분은 데이터상 존재하지 않습니다(`structureTemplateSetId`가 두 프로파일 모두 동일값이며, 애초에 실제 적용 프로파일은 `general` 하나뿐).
- BPM: kr-2030 63–125(평균 96.8), jp-2030 65–130(평균 92.9~93.4) — 실질적으로 겹치는 분포, 유의미한 차이 없음.

**평결**: 장르/악기 서술(베이스-드럼 vs 기타-피아노) 축은 실제로 분화되어 있어 "완전히 상호 교환 가능"까지는 아닙니다. 그러나 **가사의 정서적 핵심과 문장 구조는 사실상 동일 콘텐츠를 언어만 바꾼 것**이며, 이는 두 워크스페이스를 나눈 가장 중요한 이유(서로 다른 문화적 정서를 담는 것) 중 절반이 실현되지 않았다는 뜻입니다. 절반 성공, 절반 실패로 정직하게 보고합니다.

---

## 6. 동요 안전 실측 결과 (TASK C)

**위반 건수: 0건** (측정 스크립트 기준, kr-kids 2세트 36곡 + jp-kids 2세트 36곡 = 72곡 전수 스캔)

스캔 방식: (1) 앱 자체의 `kidsLyricSafetyIssues()`(블랙리스트+화이트리스트), (2) 과제 지시문이 요구한 수동 금지어 목록(한/영/일 죽음·이별·상실·그리움·후회·외로움·어둠·무서움 등) 정규식 직접 재검사 — 두 방식 모두 0건.

수동 전문 검독(§3-4, §3-5 포함 6곡 + 추가 12곡 훑어읽기): 부정적 결말로 끝나는 곡 없음, 복잡한 은유·성인 관계 내용 없음. 다만 **한 세트 안에서 채널 콘셉트와 실제 가사 주제가 어긋나는 트랙이 존재**(§3-4 kr-kids 트랙5, §3-5 jp-kids 트랙1) — 이건 안전 위반은 아니지만 "한 곡 = 한 개념" 원칙의 느슨한 위반으로 기록합니다.

연령대(T1/0-2세·T2/2-4세·T3/4-7세) 대비 검증: **불가능** — §1에서 확인했듯 `ageTier`가 생성 파이프라인에 전달되지 않으므로 kr-kids/jp-kids는 애초에 연령대를 구분하지 않고 생성됩니다. `KIDS_AGE_TIERS`의 실제 데이터(T1 템포60-100/총단어60, T2 템포100-130/총단어90, T3 템포105-140/총단어120)와 비교하면, 실측 BPM(92-128)은 대략 T2~T3 사이에 걸치지만 실측 단어수(어절 54-66)는 T1 목표(60단어)에 가장 근접합니다 — **템포는 T2/T3인데 분량은 T1**이라는 내적 불일치가 실측으로 확인됩니다.

악기: 스타일 프롬프트 전수 확인 결과 우쿨렐레/마림바/실로폰/핸드클랩 등 허용 악기만 등장, 디스토션 기타·서브베이스·과격한 타악 언급 0건.

**jp-kids 의성어**: `teasobi-hiroba` 5/18곡, `oyasumi-mae-no-uta` 3/18곡에서 실제 의성어(わんわん/にゃんにゃん/よちよち/ぴよぴよ 등) 확인 — 다만 이건 `data/onomatopoeia.ts`(26개 전용 데이터, `core/bridgeInstruction.ts`에서만 사용 = **원격/브릿지 파이프라인 전용**)가 아니라 `kidsLyricEngine.ts`의 손수 작성된 verse pair에 하드코딩된 의성어입니다. 즉 로컬 생성 경로는 전용 의성어 데이터베이스를 아예 참조하지 않고, 우연히 verse pool 자체에 포함된 것만 나옵니다. 타이틀 패턴 "ぴょんぴょんウサギ"류(의성어+대상)는 확인 못함 — 실제 생성된 18개 타이틀 중 의성어+명사 패턴은 소수(예: 트랙1 "ぶーぶーをかるくあそぼう")뿐.

**가장 중요한 정정 사항 (§0-3)**: 위 "0건"이라는 숫자는 진짜지만, 그 이유는 안전 게이트가 작동해서가 아니라 콘텐츠 풀 자체가 손으로 안전하게 쓰였기 때문입니다. `kidsLyricSafetyIssues`가 실제 파이프라인에 연결돼 있지 않으므로(§0-2/§7), 이 0건은 "지금 이 순간의 스냅샷"이지 "구조적으로 보장된 안전"이 아닙니다. 이 구분을 명확히 보고합니다.

---

## 7. 오염(contamination) 실측 결과

`v56-measure-out.json`의 `contaminationHits` 원본 기준 (grep 대상: "warm analog studio sound", `oldpop-` 리터럴, 창가/주전자/회상, kr-kids 한정 그리움/후회/이별):

| 워크스페이스/채널 | 오염 건수 | 실제 적중 표현 |
|---|---|---|
| kr-2030 / after-work-band-pop | 6 | "창가" (트랙 3,5,9,12,16,17) |
| kr-2030 / rainy-seoul-nightscape | 7 | "창가" (트랙 2,3,7,9,11,12,14) |
| jp-2030 (양쪽 채널) | 0 | — |
| kr-kids (양쪽 채널) | 0 | — |
| jp-kids (양쪽 채널) | 0 | — |
| kr-idol-male / stage-night | 7 | "창가" (트랙 2,4,5,7,9,12,16) |
| kr-idol-female / daylight-city-kpop | 6 | "창가" (트랙 2,3,5,10,13,18) |

`oldpop-` 장르 ID 리터럴 노출 0건, "warm analog studio sound" 문구 노출 0건(둘 다 스타일 프롬프트 필터가 실제로 작동 — `channelSoundFloor`가 0개라 애초에 강제로 붙일 게 없어서이기도 함), kr-kids 성인 감정 어휘(그리움/후회/이별) 0건.

"창가"(창문가) 하나가 유일한 반복 적중어입니다. 원인은 `src/core/hookParts.ts:106`의 `nounObjects` 기본 풀(`'창가의 빛', '커피잔', '라디오', ...`)이 워크스페이스 오버라이드가 있어도 **hook 라인이 아닌 verse 본문의 `motif` 값**으로 여전히 유입될 수 있는 경로가 있는 것으로 보이며(§0-2의 공용 `lyricEngine.ts` 템플릿에 삽입되는 `motif`가 이 풀에서 오는 경우), 실제로 §7의 근본 원인은 이미 §0-2/§3에서 확인한 공용 문장 템플릿 문제와 동일한 뿌리입니다.

**inferArchetypes 낙하 리스트**: **0건.** kr2030/jp2030/krkids/jpkids/kridol- 접두사를 가진 신규 워크스페이스 장르 전수(kr2030 6개, jp2030 7개, krkids 7개, jpkids 7개, kridol 7개 = 34개)를 소스에서 직접 확인한 결과 전부 `archetypes` 필드가 명시적으로 선언돼 있었습니다(`src/data/genreLibrary/index.ts` 해당 블록 직접 열람 확인). `scripts/isolationAudit.ts`의 L2 체크(kr2030-/jp2030-/krkids-/jpkids- 4개 접두사만 검사, kridol- 미포함)도 PASS(무배정 0건)로 일치합니다. **이건 이번 감사에서 나온 몇 안 되는 순수한 좋은 소식입니다.**

---

## 8. inferArchetypes 낙하 리스트 (재확인)

§7과 동일 — **0건**. `withGenreVisibility()`(`src/data/genreLibrary/index.ts:631`)가 `archetypes: genre.archetypes || inferArchetypes(...)`로 동작하는데, 34개 신규 장르 전부 `archetypes`를 이미 명시하고 있어 `inferArchetypes()` 자체가 한 번도 실행되지 않습니다.

---

## 9. 스트레스 테스트 결과

**규모 테스트**: 35개 조합(7워크스페이스×5카운트) 중 **9개 실제 실행** (kr-kids 6/12/18/24/30 = 5개, kr-idol-male 6/12/24/30 = 4개). 전부 예외 없이 완료. `scripts/audit.ts`의 종합 판정(항목 수/통과/실패)은 카운트가 바뀌어도 큰 붕괴 없이 유사한 비율을 유지 — 특정 카운트에서 급격히 나빠지는 패턴은 관측되지 않았습니다. (단, `scripts/audit.ts`는 항상 `SENIOR_AUDIENCE_PROFILE`로 채점하므로 — 코드 확인: `scripts/audit.ts:347` — kr-kids/kr-idol 채널을 넣어도 시니어 기준으로 채점됩니다. 이건 스크립트 자체의 한계이지 생성 파이프라인의 버그가 아니므로 참고용으로만 사용했습니다.) jp-2030 count=24도 별도 실행, 정상 완료.

**연속성(10연속 생성)**: **미실행** — 시간 제약으로 스킵(§13).

**경계값 테스트**: kr-2030 채널로 다음을 모두 시도, 전부 예외 없이 완료:
- 빈 문자열 콘셉트 (CLI 인자 파싱 특성상 스크립트 기본값으로 대체됨 — 앱 UI 자체의 빈 문자열 처리는 별도 검증 필요, §13)
- 1글자 콘셉트("야")
- 2000자+ 콘셉트(3240자, "퇴근길 감성 밴드팝" 120회 반복) — 정상 완료
- 이모지+특수문자 콘셉트("🎧🔥 !!!@@@###") — 정상 완료
- 워크스페이스와 다른 언어 콘셉트: 일본어 콘셉트를 kr-kids 채널에("手遊び歌 ぴょんぴょんウサギ") — 정상 완료(가사는 채널의 `primaryLanguage`인 한국어로 정상 생성됨, 콘셉트 텍스트 언어와 무관하게 동작 — 이건 정상 동작으로 판단)
- 한국어 콘셉트를 jp-2030 채널에 — 정상 완료(동일하게 채널 언어 우선)

**언어 조합 (9종)**: **미실행** — `GenerationOptions.lyricLanguage`/`packagingLanguage` 9조합 전수는 시간 제약으로 스킵(§13). 대신 각 워크스페이스의 기본 채널 언어(한국어/일본어)로는 전수 검증 완료.

**장르 희소성**: kr-2030(6개)이 7개 워크스페이스 중 가장 적은 장르 풀입니다. 실측 결과 18곡 생성 시 실제 사용 장르 수는 3~4개(2개 런 각각 3, 4)로, 6개 전부를 골고루 못 쓰는 경향이 이미 나타납니다 — 다양성 요구를 수학적으로 못 채우는 경우 에러 없이 "있는 것만 반복 사용"하는 방식으로 조용히 완화되는 것으로 보입니다(경고 로그 등은 확인 못함).

**비정상 상황(취소/워커 실패/쿼터 초과/손상된 백업/워크스페이스 중 전환)**: 스크립트/브라우저 환경에서 현실적으로 재현 가능한 항목이 거의 없어 대부분 **미실행**으로 남깁니다(§13). 워크스페이스 전환 자체(생성 중이 아닌 idle 상태)는 브라우저 실측으로 확인(§10) — 프리즈 없음.

**격리 42쌍 매트릭스**: 전체 매트릭스는 실행하지 못했습니다. 대신 `scripts/isolationAudit.ts`(데이터 레벨, L1-L7 전체, 7워크스페이스×아키타입 조합 = 사실상 전수)를 실행했고, 브라우저에서 3개 워크스페이스(kr-2030→kr-kids→jp-kids, 순차 전환)의 UI 레벨 상태 오염을 직접 관찰했습니다(§10). 세이브/평가 데이터 자체의 A→B 42쌍 실측 저장-전환-확인 사이클은 **미실행**입니다(§13) — 이건 우선순위상 브라우저 UI 채널 격리 버그(§10, 훨씬 심각하고 확실한 발견)를 쫓느라 밀려났습니다.

**A2 export/import 라운드트립**: **미실행**(§13).

---

## 10. 브라우저 실측 결과 (§5-5)

- `npm run dev` 실행 → 5200-5212 포트 전부 사용 중이라 자동 증가, 최종 **5213 포트**에서 기동 확인(Vite 8.1.4, 254ms).
- 실제 Chrome 탭에서 `http://127.0.0.1:5213/` 로드 → 워크스페이스 선택 화면 정상 렌더링, 7개 카드 모두 자기 고유 accent 색상으로 표시(시니어=teal, kr-2030=purple, jp-2030=pink, kr-kids=amber, jp-kids=blue, kr-idol-male=red, kr-idol-female=orange) — **테마 색상 자체는 실제로 워크스페이스별로 다르게 렌더링됩니다.**
- kr-2030 → kr-kids → jp-kids 순서로 3회 전환, 매번 정상 렌더링(프리즈/멈춤 없음), 상단 배너의 accent 색상과 "OO · 전환" 라벨이 매번 정확히 갱신됨.
- **★ 가장 중요한 발견**: 3개 워크스페이스 전부에서 "① 채널" 단계의 채널 드롭다운과 "Channel Profile Editor" 그리드가 **워크스페이스와 무관하게 항상 전체 25개 채널**(시니어의 "굿모닝 추억라디오", "昭和セブンティーズ", "ミレニアムJ-POP", "Chill Hours", "City Night Drive", "꼬마 노래방송" 포함)을 그대로 보여줬습니다. 기본 선택 채널도 매번 "굿모닝 추억라디오"(시니어)로 고정됩니다. `read_page`로 실제 DOM select 옵션 24개를 직접 읽어 확인(스크린샷이 아니라 접근성 트리 실측).
  - 근본 원인 확인: `src/hooks/useChannelManager.ts:6` `const defaultChannel = channelPresets[0];`, `:10` `const channels = useMemo(() => [...channelPresets, ...customChannels], [customChannels]);` — 워크스페이스 필터가 전혀 없습니다. `App.tsx:1230`이 `<WizardApp key={workspaceId} .../>`로 워크스페이스 전환 시 컴포넌트를 통째로 리마운트하므로 이전 워크스페이스의 선택값이 "남아있는" 것도 아니고, **매번 처음부터 시니어의 첫 채널로 초기화되고 전체 채널 목록이 그대로 노출됩니다.**
  - 이건 워크스페이스 선택 화면 자체의 안내문("워크스페이스를 고르면 화면과 데이터가 완전히 갈립니다 — 다른 워크스페이스의 채널·팩·훅·평가는 여기서 보이지 않습니다")과 직접 모순되는, 실제 사용자가 바로 마주치는 화면입니다.
- 콘텐츠 영역 텍스트("Playlist prompt and lyrics workbench", "먼저 어떤 채널의 곡을 만들지 고르세요" 등)는 워크스페이스가 바뀌어도 **동일**했습니다 — `WorkspaceDefinition.terms`가 실제로 어디서도 읽히지 않는다는 코드 주석(§1)과 일치하는 실측 결과입니다.
- 스캐폴드 상태(미구축) 워크스페이스: 없음 — 7개 전부 `ready: true`이므로 UI가 막는 워크스페이스도 실측상 없었습니다(해당 사항 없음, 정상).
- 18곡 생성 버튼을 눌러 실제 생성까지 UI로 완주하는 것은 시도했으나(§10 스크린샷), 채널을 먼저 올바르게 선택해야 하는 마법사 흐름이라 완전한 결과 화면까지는 도달하지 못했습니다 — 로컬 생성 자체는 §2/§3에서 스크립트로 이미 전수 검증했으므로 이 부분은 우선순위를 낮췄습니다(§13).
- 콘솔 에러: 별도로 캡처하지 않음(§13, 시간 제약).

---

## 11. `npm run audit` 실측 결과 (시니어 회귀 확인, 1회만 실행)

`npm run` 자체는 이 환경에서 PATH 문제로 `tsx`를 못 찾아 실패했으나(`'tsx'은(는) 내부 또는 외부 명령... 아닙니다`), 동일 스크립트를 `npx tsx scripts/audit.ts`(플래그 없음, 문서가 지시한 것과 동일 실행)로 직접 실행해 대체했습니다:

```
세트: 비틀즈 느낌의 밝은 60년대 팝 (18곡)
🔻 회귀 2건: 프롬프트 길이(350~650자 기준, 실측 722~942자), 서술어 개수(15~25 기준, 실측 29~35)
📈 개선 중 2건: 섹션 수, 어휘 최대 반복(49회, 이전 최고기록보다는 나아졌으나 여전히 목표 미달)
⚠ 미달 3건: 가사 단어수(BPM별 목표 대비 낮음), 어휘 반복(quiet 49회/feel 41회/light 39회/spring 37회/evening 37회 — 30회 기준 초과), 약속 이행도(58%, 70% 기준)
✅ 통과 32건 / ⬜ 미측정 9건(음원 필요 2건, 미구현 3건)
종합: 48개 항목 중 32 통과 / 2 회귀 / 2 개선 중 / 3 미달 / 9 미측정
```

이 문서의 지시대로, 이 baseline drift는 **6개 신규 워크스페이스와 무관한 기존 문제**이므로 원인을 쫓거나 고치지 않았습니다. 다만 §7에서 확인한 "quiet/feel/light/spring/evening" 최다 반복 영단어 목록은 §0-2/§3에서 확인한 "공용 lyricEngine.ts 템플릿의 정형화된 어휘" 문제와 같은 뿌리로 보이며, **시니어 워크스페이스 자체도 이 공용 템플릿의 반복성에서 완전히 자유롭지 않다**는 교차 증거로 참고할 만합니다.

---

## 12. §7 완성도 표 4종

### 12-1. 구성 요소 (TASK A 요약)

| 항목 | kr-2030 | jp-2030 | kr-kids | jp-kids | kr-idol-male | kr-idol-female |
|---|---|---|---|---|---|---|
| channelSoundFloor | FAIL(0개) | FAIL(0개) | FAIL(0개) | FAIL(0개) | FAIL(0개) | FAIL(0개) |
| 전용 AudienceProfile 실연결 | FAIL(미연결, general로 대체) | FAIL(동일) | FAIL(kids-generic으로 대체) | FAIL(동일) | FAIL(general 대체) | FAIL(general 대체) |
| 가시 장르(≥1) | PASS(6) | PASS(7) | PASS(7) | PASS(7) | PASS(7) | PASS(7, 공유) |
| GenreTraits 5축 | FAIL(0%) | FAIL(0%) | FAIL(0%) | FAIL(0%) | FAIL(0%) | FAIL(0%) |
| lyricThemes 스코핑 | PASS(18) | PASS(18) | PASS(별도시스템, 8×3언어) | PASS(별도시스템) | PASS(18) | PASS(18) |
| hook bank 분리 | PASS | PASS | PASS | PASS | PASS | PASS |
| 채널 프리셋 ≥1 | PASS(3) | PASS(3) | PASS(3) | PASS(3) | PASS(3) | PASS(3) |
| 연령별(T1-T3) 세분화 | N/A | N/A | FAIL(미연결) | FAIL(미연결) | N/A | N/A |
| 안전 정책 실연결(동요만) | N/A | N/A | FAIL(미연결) | FAIL(미연결) | N/A | N/A |
| arc/killing-point 워크스페이스 전용화 | FAIL(시니어 재사용) | FAIL | FAIL(선언만, 미구현) | FAIL | FAIL | FAIL |

### 12-2. 생성 (TASK B/F 요약)

| 항목 | kr-2030 | jp-2030 | kr-kids | jp-kids | kr-idol-male | kr-idol-female |
|---|---|---|---|---|---|---|
| 18곡 생성 성공 | PASS | PASS | PASS | PASS | PASS | PASS |
| 장르 워크스페이스 내부 한정 | PASS | PASS | PASS | PASS | PASS | PASS |
| 언어 일치 | PASS | PASS | PASS | PASS | PASS | PASS |
| 오염 0건 | **FAIL**(6-7건) | PASS | PASS | PASS | **FAIL**(6-7건) | **FAIL**(6-7건) |
| 가사 의도 부합(§3 판단) | **FAIL** | **FAIL** | 부분 | 부분 | **FAIL** | **FAIL** |
| 아이돌 표현 린트 | N/A | N/A | N/A | N/A | PASS(0건) | PASS(0건) |

### 12-3. 동요 안전 (TASK C 요약)

| 항목 | kr-kids | jp-kids |
|---|---|---|
| 금지어/위험 표현 실측 위반 | PASS(0건) | PASS(0건) |
| 안전 검증기 파이프라인 연결 | **FAIL**(미연결) | **FAIL**(미연결) |
| 연령대별 세분화 적용 | **FAIL**(미연결) | **FAIL**(미연결) |
| 허용 악기만 사용 | PASS | PASS |
| 한 곡 한 개념 | 부분(콘셉트-주제 불일치 트랙 존재) | 부분(동일) |
| 의성어 실사용(jp-kids만) | N/A | 부분(8-9/18에서만) |

### 12-4. 격리·스트레스 (TASK D/E 요약)

| 항목 | 결과 |
|---|---|
| 데이터 레벨 격리(isolationAudit L1-L7) | PASS 46 / FAIL 4 / SKIP 17 (FAIL 4건은 전부 시니어 내부 기존 이슈 + kr-idol-female의 의도된 장르 공유, §13) |
| UI 레벨 채널 격리 | **FAIL**(전 워크스페이스 공통, §10) |
| 규모 테스트(6/12/18/24/30) | PASS(실행한 9/35 조합 전부 정상) |
| 경계값(빈값/1자/2000자/이모지/오언어) | PASS(전부 예외 없이 완료) |
| 42쌍 세이브-전환-확인 | 미실행 |
| Export/Import 라운드트립 | 미실행 |

---

## 13. 미구현/미검증 목록 (우선순위 근거 포함)

과제 지침의 우선순위(TASK C > TASK B+F 가사읽기 > TASK A > TASK D > TASK E/브라우저 > 나머지 F)를 따라 다음을 의도적으로 축소/스킵했습니다:

1. **격리 42쌍 매트릭스 중 39쌍 미실행** — 데이터 레벨은 `isolationAudit.ts`로 사실상 전수 커버했으나(§9, §12-4), 실제 세이브→전환→확인 UI 사이클은 kr-2030/kr-kids/jp-kids 3개 워크스페이스 순차 전환의 채널 목록 관찰(§10)로 대체했습니다. 이 관찰에서 나온 채널 격리 버그가 훨씬 크고 확실한 문제라 판단해 그쪽에 시간을 더 썼습니다.
2. **35개 규모 조합 중 26개 미실행** — 9개만 실행(§9). 실행한 것은 전부 정상이었고 카운트별 급격한 붕괴 패턴이 없어 나머지도 유사할 가능성이 높다고 "추정"은 하지만, 이는 추정이지 실측이 아니므로 "미검증"으로 명시합니다.
3. **10연속 생성(연속성) 테스트** — 미실행.
4. **9개 언어 조합(lyricLanguage×packagingLanguage) 전수** — 미실행. 각 워크스페이스 기본 언어로는 검증됨.
5. **Export/Import 라운드트립, 크로스 워크스페이스 import 경고** — 미실행.
6. **비정상 상황(취소/워커 실패/쿼터 초과/손상 백업)** — 대부분 미실행(스크립트/단일 브라우저 세션에서 현실적으로 재현하기 어려움).
7. **`generationGate.ts`의 word-count 게이트가 kr-kids/jp-kids 실제 생성 흐름에서 진짜로 blocking을 발생시키는지** — §2에서 수치상 강한 정황(실측치가 게이트 기준의 절반 이하)은 확보했으나, `evaluateGenerationGate()`가 kids-quota 트랙에도 무조건 호출되는지까지 완전히 추적하지 못했습니다.
8. **kr-idol-female의 `kridol-retro-funk` 장르 vocal 필드 성별 중립성** — §4에서 발견한 "playful confident male lead"가 kr-idol-female 트랙에도 그대로 노출되는 현상의 근본 원인(장르 프리셋 공유가 원인인지, 텍스트가 실제 문제인지)까지 소스를 열어 확인하지 못했습니다.
9. **kr-kids `titleLocalized` 18/18 중 2개 누락** — 원인 미조사.
10. **"city life"라는 고정 문구가 어디서 오는지** — 소스 위치 미추적, 전역 상수로 추정만 함.
11. **브라우저 콘솔 에러 로그 캡처** — 미실행.
12. **원격/브릿지(Claude API) 생성 경로** — 로컬 생성 경로만 전수 검증했습니다. 원격 경로는 실제 API 키가 필요해 이번 환경에서 실행할 수 없었고, 코드상 프롬프트 지시 방식이 로컬과 다르므로(모델이 직접 문장을 씀) §0-2의 "공용 템플릿" 문제가 원격 경로에도 동일하게 적용되는지는 **미검증**입니다 — 원격 경로는 오히려 이 문제에서 자유로울 수도 있습니다(모델이 지시문의 lyricTheme 실제 텍스트를 참고해서 쓴다면).

---

## 14. 워크스페이스별 최종 결론

과제 문서의 마지막 3개 질문에 대한 직접 답변입니다.

### senior-oldpop
1. 지금 당장 18곡 세트 제작 가능한가: **예** (이번 감사에서 건드리지 않음, 기존 실사용 검증 유지)
2. 부족한 것: 해당 없음(이번 범위 밖)
3. `ready` 플래그: **true 유지가 맞음**

### kr-2030
1. 지금 당장 18곡 세트 제작 가능한가: **기술적으로는 생성됨(예외 없음), 그러나 실사용 품질은 아님.** 지금 생성하면 "퇴근 후 2030 감성"이 아니라 시니어풍 잔잔한 회상 가사가 나옵니다.
2. 부족한 것: (a) 채널 UI 격리(§10, 앱 전체 공통 버그), (b) 워크스페이스 전용 가사 본문 생성 로직(현재 시니어와 100% 공유, §0-2/§3), (c) 실제 AudienceProfile 연결(현재 `general` placeholder), (d) channelSoundFloor.
3. `ready` 플래그: **downgrade 권장(false 또는 최소 "실험적" 표시).** 코드는 돌아가지만 산출물이 채널 프로미스를 지키지 못합니다.

### jp-2030
1. 지금 당장 18곡 세트 제작 가능한가: **기술적으로는 예, 언어는 정확히 일본어. 그러나 kr-2030과 정서적으로 구분이 잘 안 됩니다.**
2. 부족한 것: kr-2030과 동일 + 콘셉트 문구가 가사/프롬프트에 그대로 반복 삽입되는 현상.
3. `ready` 플래그: **downgrade 권장.**

### kr-kids
1. 지금 당장 18곡 세트 제작 가능한가: **조건부 가능.** 안전성은 실측상 문제없고(0건), 톤도 직접적이고 아이 눈높이에 맞습니다. 다만 안전 검증기가 파이프라인에 연결돼 있지 않다는 점, 연령대 구분이 전혀 없다는 점, 단어수가 자기 프로파일 기준의 절반도 안 된다는 점은 "지금까지는 운 좋게 괜찮았다"에 가깝습니다.
2. 부족한 것: 안전 검증기 실연결, 연령대 세분화 연결, 단어수 재보정, channelSoundFloor 동급 체계(있다면).
3. `ready` 플래그: **조건부 유지 가능하나 강력 권고 — 안전 검증기를 파이프라인에 연결하기 전까지는 최소 "실사용 전 재확인 필요" 라벨을 붙이는 걸 권합니다.** 지금 산출물 자체는 안전했지만, 그건 구조가 보장한 게 아니라 우연입니다.

### jp-kids
kr-kids와 동일한 근거로 **동일 결론.** 의성어 시스템이 부분적으로만 작동(전용 26개 DB 미사용, verse pool 내장분만 반영)한다는 점이 추가.

### kr-idol-male / kr-idol-female
1. 지금 당장 18곡 세트 제작 가능한가: **기술적으로는 예. 스타일 프롬프트(장르/악기/보컬 지시)는 실제로 아이돌답게 잘 구성됩니다. 그러나 가사 본문에는 아이돌 특유의 에너지가 전혀 없고 시니어풍 잔잔한 문장이 그대로 나옵니다.**
2. 부족한 것: kr-2030과 동일한 공용 템플릿 문제(오히려 더 두드러짐 — 무대곡인데 발라드 가사), idolExpressionLint의 자동 게이트 연결, 전용 AudienceProfile/channelSoundFloor.
3. `ready` 플래그: **downgrade 권장.** 특히 아이돌 워크스페이스는 "무대 위의 확신과 폭발적 에너지"(kr-idol-male 채널 프로미스)를 스스로 표방하는데 실제 가사가 정반대 톤이라, 다른 워크스페이스보다 기대-실측 격차가 더 큽니다.

---

**총평**: 6개 신규 워크스페이스 모두 로컬 생성 파이프라인이 예외 없이 돌아가고, 장르/BPM/보컬쿼터/제목 유일성 같은 "구조적" 지표는 실측상 대체로 양호합니다. 그러나 하루님이 실제로 듣게 될 결과물의 핵심인 **가사 본문의 정서적 진짜 차별화**는 kr-kids/jp-kids(전용 콘텐츠 엔진 보유)를 제외하면 사실상 이루어지지 않았고, **동요 안전은 구조적 보장이 아니라 우연**이며, **채널 선택 UI 자체가 워크스페이스 격리라는 앱의 핵심 약속을 어기고 있습니다.** "코드로만 진행했다"는 우려가 세 가지 서로 다른 층위(가사 콘텐츠, 안전 게이트, UI)에서 전부 실측으로 확인된 셈입니다.
