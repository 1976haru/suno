# v3.75 완료 보고 — 곡 길이 복원 · 후반 진폭 · 보컬 분산

기준: v4.2 TASK A3(`3d620b6`) 위에서 진행. 지시대로 A3보다 먼저 처리해야 할 실측 결함 수정입니다.

**중요 — 이 문서는 완료 선언이 아닙니다.** §6-2/§6-3이 요구하는 "수노 실측 길이/진폭 3곡"은 이 세션에서 실제로 Suno에 가사를 붙여넣고 렌더링해 들어볼 방법이 없어 **제공하지 못했습니다.** 아래는 전부 코드 수준 수정과 로컬(오프라인) 검증이며, §7 "수노 실측 없이 완료 보고하지 말 것"을 그대로 지켜 **"코드 수정 완료, 실측 검증 대기"로 보고합니다.** 실제 검증은 하루님이 이 브랜치로 다음 세트를 만들어 들어보셔야 합니다.

변경 파일:
- `src/core/introModePlan.ts` (신규: `reconcileIntroModeWithStructureTemplate` — 실제 버그 수정)
- `src/core/batchPreallocation.ts` (introMode 정합화 연결)
- `src/core/promptComposer.ts` (단어수 밴드 상향, 섹션 분량·인스트루멘털 지시 추가, 킬링포인트 지시 강화)
- `src/core/bridgeInstruction.ts` (킬링포인트 지시 강화, 제목 지시 재작성)
- `src/core/vocalPlan.ts` (`buildVocalPlan` 균등 분산 재작성, 여성/남성 명시 추가)
- `src/core/compositionScorer.ts` (길이 하한 차단, 보컬 구간 분산 advisory)
- `src/core/audioSetReport.ts` (킬링포인트 곡만 진폭 검사하도록 보정)
- `src/components/AudioAnalysisPanel.tsx` (위 보정 연결)
- 테스트: `tests/v375DurationDynamicsVocal.test.ts`(신규), 기존 4개 파일 갱신(구조 변경에 맞춰)

---

## 1. 길이 원인 조사 결과 (수정 전에 먼저 조사)

### 1-1. `[end]` 태그 제거의 영향

v3.71에서 `[end]` 태그를 제거한 이유는 코드 자체의 설명대로 **"Suno에서 아무 효과가 없는 태그"** 였기 때문입니다(`promptComposer.ts`의 CRITICAL 규칙: "Neither does anything in Suno"). 즉 이 태그 제거 자체가 실제 렌더링 길이를 줄였을 가능성은 낮습니다 — 태그가 있어도 없어도 Suno가 그 자리에서 추가로 노래하지 않았다는 것이 이 태그를 제거한 근거였습니다.

**그러나** 같은 v3.70/v3.71에서 `[end]` 제거와 **함께** 일어난 변화가 진짜 원인일 가능성이 큽니다: `STRUCTURE_TEMPLATE_SECTION_NOTES`(섹션 구성 자체)를 "9-11 섹션 → 6-8 섹션"으로 줄였고, 단어수 밴드를 200-260에서 175-205로 낮췄습니다. `[end]` 하나만 뺀 게 아니라 **섹션 수 자체를 줄이는 김에 같이 정리**한 것입니다.

### 1-2. 인스트루멘털 구간 유무 비교 — 실제 버그 발견

가장 중요한 발견입니다. 이 앱은 두 개의 **독립적으로 시드된** 플랜을 갖고 있습니다.

```
structureTemplate (T1-T5)   섹션 순서. T2="cold hook intro, no instrumental lead-in",
                             T5="a cappella hook intro" — 이 둘은 정의상 인스트루멘털 인트로가 없습니다.
introModePlan                18곡 중 8곡을 'instrumental'로 배정 (44%, v3.64 설계값)
```

**이 둘은 서로를 확인하지 않습니다.** 한 트랙이 `structureTemplate=T2`(인스트루멘털 인트로 없음)이면서 동시에 `introMode='instrumental'`(인스트루멘털 인트로 있음)로 배정될 수 있었습니다. 브릿지 지시문의 같은 표(per-track plan table)에 두 개의 서로 모순된 지시가 한 트랙에 동시에 들어간 것입니다.

**실측** (`tests/v375DurationDynamicsVocal.test.ts`, seed 기반 재현):

```
structureTemplatePlan: T1,T4,T2,T5,T1,T3,T4,T5,T3,T1,T2,T5,T2,T1,T3,T4,T5,T4
introModePlan(수정 전): vocal-immediate,instrumental,vocal-after-texture,instrumental,
                         vocal-after-texture,instrumental,vocal-after-texture,instrumental,
                         vocal-immediate,instrumental,vocal-after-texture,instrumental,
                         vocal-immediate,vocal-after-texture,instrumental,vocal-immediate,
                         vocal-after-texture,instrumental

충돌(instrumental인데 템플릿이 T2/T5): 3곡
```

**18곡 중 3곡이 실제로 모순된 지시를 받고 있었습니다.** 에이전트가 이 모순을 만났을 때 어느 쪽을 따랐을지는 알 수 없지만, T2/T5 템플릿 자체의 문구("no instrumental lead-in", "a cappella")가 더 구체적이라 그쪽을 따랐을 가능성이 높고, 이는 인스트루멘털 지시가 조용히 무시되는 정확한 메커니즘입니다.

**수정**: `core/introModePlan.ts`의 `reconcileIntroModeWithStructureTemplate()` — 충돌하는 트랙의 introMode를 템플릿이 인스트루멘털을 허용하는 다른 트랙과 맞바꿉니다(전체 인스트루멘털 트랙 수는 8곡으로 그대로 유지, 트랙 1/콜드오픈은 절대 건드리지 않음). 수정 후 같은 시드로 재실행하면 충돌 0건, 인스트루멘털 총량은 여전히 8곡입니다.

### 1-3. 섹션당 행 수 비교

**실제 버그**: 브릿지/배치 지시문 어디에도 섹션당 줄 수 지시가 전혀 없었습니다(1절 문두에서 `promptComposer.ts` 전체를 확인). 단어수 총합(175-205)만 지시했을 뿐, "벌스는 몇 줄, 후렴은 몇 줄"이라는 지시가 없어 에이전트가 총 단어수를 맞추기 위해 **섹션 수는 유지하되 섹션당 줄 수를 압축**하는 선택을 할 수 있었습니다 — 이것이 "섹션 7개는 이전과 같은데 짧다"는 이번 세트의 증상과 정확히 일치합니다.

**수정**: `promptComposer.ts`의 `buildSystemInstruction`에 다음을 추가했습니다.

```
- Give each section room to breathe rather than compressing it to hit the
  word count with fewer, shorter sections: a verse should run 5-6 lines,
  a pre-chorus or bridge 2-4 lines, a chorus 3-4 lines including its
  repeated hook line. A 2-3 line verse undercuts both the word-count
  floor above and the target render length even when the section TAGS
  match the assigned structure template.
- Every song should include at least one genuinely wordless instrumental
  moment somewhere ...
```

### 1-4. 결론 — 우선순위 ①②③④ 그대로 적용

```
① 인스트루멘털 구간 복원   → introMode/structureTemplate 정합화 버그 수정 (실제 원인)
② 섹션당 행 수 지시 추가   → 신규 지시문 (기존에 전혀 없었음)
③ 브릿지 확보              → 손대지 않음 (T1/T3/T5는 이미 bridge 보유, T2/T4는 설계상 없음 — 그대로 유지)
④ 단어수 215~230           → MIN/MAX_LYRIC_WORDS 상향 (마지막 수단으로만)
```

**정직한 한계**: 단어수만으로는 65초 차이가 설명되지 않는다는 것을 실측으로 이미 확인했습니다(191단어→3:39, 194단어→2:34). ①②가 진짜 원인일 가능성이 높지만, Suno 자체의 렌더링 페이싱(가사 텍스트로는 보이지 않는 요소)이 어느 정도 작용했을 가능성도 배제할 수 없습니다 — 이는 텍스트 수정만으로 100% 통제할 수 없는 영역입니다.

---

## 2. ★ 수노 실측 길이 3곡 — 미실측

**이 세션에서 제공할 수 없습니다.** Suno에 실제로 가사/스타일 프롬프트를 붙여넣고 렌더링해서 mp3 길이를 재는 작업은 이 코딩 환경 밖에서만 가능합니다. 대신 제공하는 것:

- 위 §1-2/§1-3의 실제 버그 수정(인스트루멘털 정합화, 섹션 분량 지시)
- §5 완료 판정 표에 "미실측" 항목으로 명시

**하루님이 확인해 주셔야 하는 것**: 이 브랜치로 18곡 세트를 다시 만들어 Suno에서 렌더링한 뒤, 평균 길이가 3:15~3:35 범위에 들어오는지, 2:50 미만 곡이 있는지 실제로 재봐 주십시오.

## 3. ★ 수노 실측 진폭 3곡 — 미실측

같은 이유로 미실측입니다. 대신 제공하는 것:

- §1-2와 같은 성격의 실제 개선: 킬링포인트 지시문 강화(§4)
- 사후 분석 도구(`core/audioSetReport.ts`)를 킬링포인트 유무를 구분하도록 수정 — 이전에는 킬링포인트가 없는 곡도 "진폭 부족"으로 잘못 flag될 수 있었습니다. 이제 킬링포인트가 있는 곡만 진폭/후반 상승 기준으로 평가합니다(§4-2).

**하루님이 확인해 주셔야 하는 것**: 새로 만든 세트를 파형으로 재보고, 킬링포인트가 배정된 곡들의 진폭이 이전(3.3dB 평균)보다 나아졌는지, 그리고 6dB가 시니어 채널에 과하게 들리지 않는지 들어봐 주십시오.

---

## 4. TASK B — 킬링포인트 지시 강화 (코드 수정 완료)

`promptComposer.ts`의 `buildBatchSystemNote`와 `bridgeInstruction.ts`의 `killingPointSection` 양쪽에 동일한 취지로 강화했습니다(두 경로 모두 실제 생성에 쓰이므로 동기화).

**실제 텍스트** (`tests/v375DurationDynamicsVocal.test.ts`에서 실측):

```
[Killing points] - each track's one designed peak moment, an idea to
realize in your own words, never a phrase to quote verbatim. This should
be the loudest, fullest, most energetic point of the ENTIRE song —
clearly audible as a lift, not a small nudge — and the section right
before it should stay noticeably more restrained (thinner arrangement,
lower energy) so the peak has something real to rise from, instead of
the whole song sitting at one constant level. Build this through
arrangement fullness and dynamics, never through belting or harsh top
end — the audience's vocal-register/production exclusions elsewhere in
this instruction still apply in full at the peak. A track not listed
here has no designed peak moment — keep it comfortably at its usual
level throughout, do not invent one.
```

`hardExclusions`(벨팅 고음, 거친 고역)는 전혀 건드리지 않았습니다 — "다이내믹 폭"과 "고음 지르기"를 명시적으로 구분하는 문장을 넣었습니다.

### 4-2. `audioSetReport.ts` — 킬링포인트 유무 구분

`buildAudioSetReport()`에 `killingPointTrackNos` 인자를 추가했습니다. 이제:

- 킬링포인트가 있는 곡만 "후반 상승 60% 이상", "진폭 6dB 이상" 기준으로 평가됩니다.
- 킬링포인트가 없는 곡은 이 두 검사에서 완전히 제외됩니다(§2-3 "진폭 제한 없음, 평평해도 됩니다" 그대로 구현).
- `AudioAnalysisPanel.tsx`가 `song.killingPointId`로 이 집합을 넘기도록 연결했습니다.

기존 호출부(인자 생략 시)는 예전과 똑같이 전체 트랙을 검사합니다 — 하위 호환.

---

## 5. TASK C — 보컬 분산 (코드 수정 완료, 실측 확인됨)

### 5-1. 원인 — largest remainder 스케줄링으로 교체

`vocalPlan.ts`의 `buildVocalPlan`이 예전에는 "전체를 섞고 3연속만 없으면 통과"였습니다. 이를 **largest remainder scheduling**(비례 배분에 쓰이는 표준 알고리즘, Bresenham 직선 알고리즘과 같은 계열)으로 교체했습니다 — 매 위치마다 "자기 비중 대비 가장 오래 기다린" 타입을 배정하므로, 전체 시퀀스뿐 아니라 **어떤 연속 구간을 잘라도** 고르게 분산됩니다.

### 5-2. 실측 — 18곡 보컬 타입 순서 (여러 시드)

```
seed=1     1~6: mixed female male female mixed male
           7~12: mixed male female female male mixed
           13~18: female male mixed female mixed male
           → 구간별 mixed 2 / female 2 / male 2 (전부 정확히 2/2/2)

seed=42    1~6: female male mixed male female mixed
           7~12: female mixed male female male mixed
           13~18: female male mixed mixed female male
           → 구간별 전부 2/2/2

seed=12345 1~6: male mixed female female mixed male
           7~12: female mixed male mixed female male
           13~18: mixed female male female mixed male
           → 구간별 전부 2/2/2

실측(하루님 보고 수치와 동일한 6/7/5 쿼터, seed=777):
1~6:  female male mixed male mixed female
7~12: male mixed female male mixed male
13~18: female mixed male female mixed male
→ 1구간 2/2/2, 2구간 male 3·mixed 2·female 1, 3구간 2/2/2
  (7이 3으로 나눠떨어지지 않아 한 구간에 male 3이 배정된 것 — "최대한 고르게"의 자연스러운 결과)
```

**"3연속 금지" 위반도 3개 시드 전부에서 0건**이었습니다(run 검사를 테스트에 포함).

### 5-3. 여성 곡의 `female` 명시 — 실제 버그 수정

`buildAdultVocalTraitPlan`이 `register` 텍스트(`'full chest alto'`, `'low warm contralto'` 등)를 그대로 반환했고, 이 register 풀에는 **"female"이라는 단어가 단 한 번도 등장하지 않습니다**(데이터 파일 자체를 확인). 성별은 오직 성부 어휘(alto/contralto vs tenor/baritone)로만 전달되고 있었고, 이는 Suno에 성별을 확실히 전달하는 유일한 신호가 아니었습니다.

**수정**: 합성 단계에서 성별 단어를 접두어로 붙였습니다.

```
// 여성 곡 실제 출력 (실측)
"female full chest alto, legato sustained lines, soft breathy grain, intimate close-mic"

// 남성 곡 실제 출력 (실측, 대조용)
"male low warm baritone, restrained understated reading, worn weathered edge, warm natural room"
```

단어 예산(기존 "4축 합쳐 12단어 이하")은 13단어로 1단어 늘었습니다 — 데이터 파일(`vocalTraits.ts`)의 3단어 축 캡 자체는 건드리지 않고, 합성 시점에 성별 단어 1개를 추가한 것이므로 축별 반복 상한(register 2회 등)에는 영향이 없습니다.

**보컬 배분 비율은 건드리지 않았습니다** — `DEFAULT_ADULT_VOCAL_QUOTA`(6/6/6)와 `scaleVocalQuota` 로직은 그대로이고, `buildVocalPlan`의 시퀀싱 알고리즘만 교체했습니다.

---

## 6. TASK D — 잔여 항목 (최소 조치)

### 6-1. 시대 미지정 장르 비중 (최소 조치, 이미 A3에서 구현됨)

A3의 `applyEraQuota`(범용 장르 20% 캡)와 `compositionScorer.ts`의 `eraConsistencyFindings`(20% 초과 시 advisory)가 이미 존재합니다. `Step2Plan.tsx`가 `setDirector`의 `plan.allocations`(시대 쿼터 적용된 장르 축)를 `opts.genreIds`/`diversityAllocations`에 그대로 반영하는 것도 코드로 확인했습니다. **이번 세트의 44% 수치가 A3 적용 이전 데이터인지, 아니면 다른 경로(가족 선택기 등)로 생성된 것인지는 이 세션에서 재현하지 못했습니다** — 새 코드 수정 없이, 기존 A3 메커니즘이 이미 이 요구사항을 다룬다는 것만 재확인했습니다.

### 6-2. 어휘 반복 상한 (이미 충족됨)

`GENERIC_WORD_CAP = 12`(v3.64부터 기존)가 이미 이번 요구사항의 20회보다 엄격합니다 — 20회를 넘는 단어는 반드시 12회 advisory에도 걸립니다. 새 코드가 필요하지 않았습니다.

### 6-3. 훅에서 가져온 제목 ≥ 6/18 (코드 수정 완료)

**핵심 발견**: A3에서 만든 로컬 `titleFromHook`/8종 패턴 시스템은 **실제 생성 경로에서 전혀 사용되지 않습니다.** 실제 곡(Claude Code 브릿지·Anthropic/OpenAI 경로)은 `titleMode`/`hookMode` 기본값이 `'ai-creative'`라 제목·훅을 원격 에이전트가 직접 씁니다 — `core/lyricEngine.ts`의 로컬 생성기는 `provider:'local'`(오프라인 미리보기)에서만 돌아갑니다. 즉 A3의 제목 프레임워크는 구조적으로는 맞지만 **실제 Suno 출력에는 영향이 없었습니다.**

진짜 원인은 `bridgeInstruction.ts`의 `titleInstructionLineFor` 자체 문구였습니다: `"never a restatement of the hook"` — 훅과 같은 제목을 **명시적으로 금지**하고 있었습니다. 60년대 팝은 제목이 곧 훅인 경우가 흔한데, 지시문이 정반대로 말하고 있었습니다.

**수정**: 이 문구를 재작성해, 세트의 최소 1/3은 훅에서 그대로/거의 그대로 가져오도록, 나머지는 독립적인 이미지형으로 쓰도록 명시했습니다(§9-6 원문 참고, `tests/v375DurationDynamicsVocal.test.ts`/`tests/claudeCodeBridge.test.ts`로 실측 확인).

**미실측**: 실제 에이전트가 이 새 지시를 어떻게 따를지는(정말 6/18 이상 훅 제목을 쓸지) 이 세션에서 검증할 수 없습니다 — 다음 실제 생성에서 확인이 필요합니다.

---

## 7. 완료 판정

| 항목 | 기준 | 현재 | 판정 |
|---|---|---|---|
| 수노 실측 평균 길이 | 3:15~3:35 | **미실측** | ⬜ 대기 (§2) |
| 최단 곡 길이 | ≥ 2:50 | **미실측** | ⬜ 대기 (§2) |
| 가사 단어수 지시 | 215~230 | 215~230 (코드 반영) | ✅ PASS |
| 섹션당 행 수 지시 | 존재 | 신규 추가됨 (기존엔 전혀 없었음) | ✅ PASS |
| 인스트루멘털 구간 지시 정합성 | 곡당 ≥1, 모순 없음 | 18곡 중 3곡 모순 발견·수정, 충돌 0건 확인 | ✅ PASS (구조) |
| 킬링포인트 곡 진폭 | ≥ 6dB | **미실측** (지시 강화만 완료) | ⬜ 대기 (§3) |
| 최대 구간 위치(킬링포인트 곡) | ≥ 7/10 | **미실측** | ⬜ 대기 (§3) |
| 한 구간(6곡) 내 같은 보컬 타입 | ≤ 3 | 실측 3/3/3 시드 전부 통과 (6/7/5 쿼터는 한 구간 3까지 자연 발생, 기준 이내) | ✅ PASS |
| 같은 보컬 타입 연속 | ≤ 2 | 실측 3개 시드 전부 위반 0건 | ✅ PASS |
| 여성 곡의 `female` 명시 | 100% | 실측 100% ("female " 접두어 항상 포함) | ✅ PASS |
| 시대 미지정 장르 비중 | ≤ 20% | A3 메커니즘 존재 확인 (재현 미실측) | ⚠️ 확인 필요 |
| 같은 단어 최대 반복 | ≤ 20회 | 기존 12회 캡이 이미 더 엄격 | ✅ PASS (기존) |
| 훅에서 가져온 제목 | ≥ 6곡 | 지시문 수정 완료, 실제 에이전트 준수 여부 **미실측** | ⚠️ 코드만 완료 |

### 회귀 방지 — 재확인

전체 테스트 스위트 실행: **157개 파일, 1848개 테스트 전부 PASS** (작업 전 156/1841 → 신규 7개 추가). 보컬 서술 다양성(v3.72의 4축), 보컬 배분 비율(6/6/6), 가사 상황/감정 다양성(v3.64), 워크스페이스 격리(A1)/데이터 이동(A2) 관련 기존 테스트는 전부 그대로 유지되며 통과합니다 — `lyricEngine.ts`의 장면 생성 로직(`composeVerse`/`composeChorus`)은 건드리지 않았고, `git diff`로 확인 가능한 lyricEngine.ts 관련 변경은 없습니다.

---

## 8. 하지 말 것 — 준수 확인

- 단어수부터 늘리지 않음 — ①인스트루멘털 정합화 버그 수정, ②섹션 분량 지시 추가를 먼저 하고 ④단어수 상향은 마지막에 적용.
- 2:50 미만/4:00 초과에 대한 판단 기준은 완료 판정 표에 명시했으나, 실제 그 범위 안에 들어오는지는 §2에서 밝힌 대로 미실측 — 하드 게이트(코드 차단)는 `compositionScorer.ts`가 아직 텍스트 기반 duration이 아니라 length-adjacent 신호(단어수/섹션수)만 보므로 붙이지 않았습니다(§1의 "단어수만으로는 65초 차이가 설명 안 됨" 실측과 모순되는 정밀 예측 로직을 만들지 않기 위한 의도적 선택 — TASK A3 스타일의 "미구현" 명시).
- `hardExclusions`(벨팅 고음, 거친 고역) 완화하지 않음 — §4에서 확인.
- 보컬 서술을 단순화하지 않음 — v3.72의 4축(register/delivery/timbre/proximity) 그대로, `buildVocalPlan`은 순서만 바꿨습니다.
- 보컬 배분 비율(6/6/6 등)을 바꾸지 않음 — `scaleVocalQuota`/`DEFAULT_ADULT_VOCAL_QUOTA` 미수정.
- 4절(시대·어휘·제목) 근본 해결을 시도하지 않음 — 최소 조치만(§6).
- `lyricEngine.ts`의 장면 생성 로직 미수정 — 이번 커밋에서 `lyricEngine.ts` 변경 없음.
- 컨셉을 되돌리지 않음 — 장르/컨셉 선택 로직은 건드리지 않았습니다.
- **수노 실측 없이 완료 보고하지 않음** — §2/§3/§5(진폭)/§6-3(제목) 모두 "미실측"으로 명시적으로 표기했습니다.

## 9. 미구현/미실측 목록 (재정리)

1. **수노 실측 길이 3곡** — 미실측. 다음 실제 생성 후 하루님 확인 필요.
2. **수노 실측 진폭 3곡** — 미실측. 다음 실제 생성 후 하루님 확인 필요.
3. **6dB 다이내믹이 시니어 채널에 과하지 않은지** — 미검증(§3, 원 스펙 §8의 "미검증" 언급과 동일).
4. **훅에서 가져온 제목이 실제로 6/18 이상 나오는지** — 지시문만 수정, 실제 에이전트 준수 여부 미실측.
5. **시대 미지정 장르 44% 재현** — 이 세션에서 재현하지 못함; A3 메커니즘 존재만 재확인.
6. **정밀 duration 예측(초 단위) 차단 로직** — 의도적으로 만들지 않음(§8 참고, 단어수만으로 예측 불가능함을 이미 실측으로 확인).
