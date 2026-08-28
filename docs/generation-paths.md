# 생성 경로 지도

지시문 79 TASK C-1. **이 문서가 없어서 지시문 74·76·77·78이 각각 한 경로만
고치고 넘어갔다** — 2차 정합성 감사가 그 결과를 6건으로 확인했다(브릿지는
되는데 로컬은 안 되고, `setDirector`는 되는데 직접 경로는 안 되는 패턴).

기준 커밋: `20ebff5` + 지시문 79.

---

## 0. 요약 — 경로는 넷이다

| 경로 | 슬롯을 만드는 함수 | 곡 본문을 만드는 주체 | 실제 사용처 |
|---|---|---|---|
| **A. 로컬 경로** | `generateLocalBlueprint` 내부 | 저장소 코드(템플릿·가사 엔진) | 프로바이더 `local`, 워커, 미리보기 |
| **B. 브릿지 경로** | `preallocateSongSlots` | 외부 코딩 에이전트(Claude Code) | 지시문 붙여넣기 → JSON 임포트 |
| **C. API 경로** | `preallocateSongSlots` | 원격 모델(OpenAI / Anthropic) | 프로바이더 `openai` / `anthropic`, Batch |
| **D. 설계 미리보기 경로** | `directSetLocal` → 내부에서 `preallocateSongSlots` | 없음(화면 표시 전용) | Step2Plan "N곡 계획" 표 |

**D는 생성 경로가 아니다.** 화면에만 쓰이고, `[설계 적용]`을 눌러야
`opts.genreIds` / `opts.diversityAllocations`를 통해 A·B·C에 영향을 준다
(지시문 79 TASK B-1 참고).

---

## 1. 경로별 상세

### A. 로컬 경로

```
UI (Step3Generate)
  └─ hooks/useGenerationFlow.ts
       └─ core/localGenerationClient.ts:93        (워커 사용 가능하면 위임)
            └─ workers/localGenerationWorker.ts:75
       └─ providers/index.ts:377  settings.provider === 'local'
            └─ providers/index.ts:543             (단곡 재생성)
  ─────────────────────────────────────────────────────
  core/localGenerator.ts  generateLocalBlueprint
    · 슬롯 계획을 이 함수가 **자체적으로** 세운다
      (preallocateSongSlots를 부르지 않는다 — 같은 로직의 평행 구현)
    · 가사·stylePrompt·excludePrompt를 전부 이 파일이 조립
    · 끝에서 core/quality.ts scoreSongs 호출 (localGenerator.ts:2588)
```

**핵심**: A는 `preallocateSongSlots`를 **거치지 않는다.** B·C에만 붙인 정책은
A에 자동으로 오지 않는다. 지시문 74 TASK A(BPM 섹션 하한)가 이 경로만
빠졌던 이유다.

### B. 브릿지 경로

```
Step3Generate
  └─ core/batchPreallocation.ts  preallocateSongSlots      (Step3Generate.tsx:944)
  └─ core/bridgeInstruction.ts   buildClaudeCodeInstruction
       · 슬롯을 preassignedSongs로 지시문 텍스트에 실어 보낸다
       · 멀티세트: buildMultiSetClaudeCodeMasterInstruction (bridgeInstruction.ts:2227)
            └─ 내부에서 buildMultiSetClaudeCodeInstructions
                 └─ preallocateSongSlots (bridgeInstruction.ts:2173)
  ── 외부 에이전트가 songs.json 작성 ──
  └─ App.tsx:592  preallocateSongSlots (임포트 대조용으로 다시 계산)
  └─ core/bridgeImport.ts  importSongsJson
       · reconcileWithPreassignedSlot — 에이전트가 빠뜨린 필드를 슬롯에서 복구
       · scoreSongs (bridgeImport.ts:621, 1017)
```

### C. API 경로

```
Step3Generate
  └─ providers/index.ts:83   provider === 'openai'  → generateWithOpenAI
  └─ providers/index.ts:402  provider === 'anthropic'
  └─ hooks/useBatchGenerationFlow.ts (Batch API)
       └─ core/batchPreallocation.ts  preallocateSongSlots
       └─ buildBatchRequestSpecs / slotsForRange
       └─ scoreSongs (useBatchGenerationFlow.ts:121, 164)
  └─ providers/index.ts:468  scoreSongs
  └─ core/finalizeBlueprint.ts:161  scoreSongs
```

### D. 설계 미리보기 경로

```
Step2Plan.tsx:172  directSetLocal(freeText, channel, songCount, ...)
  └─ core/setDirector.ts
       · 자체 해석(장르군·시대·breadth) → makeAllocations
       · setDirector.ts:1524  preallocateSongSlots (표에 쓸 슬롯)
       · en-chillhop 전용 확장(지시문 76 TASK A)이 **이 파일에만** 있다
  └─ Step2Plan.tsx:307  preallocateSongSlots (관문 1 검사용, 별도 계산)
  ── [설계 적용] 클릭 ──
  └─ applyPlanToOptions (Step2Plan.tsx:111)
       · opts.genreIds ← 계획의 장르 배분 키
       · opts.diversityAllocations ← 계획의 8축 배분
  ── 이후 A·B·C가 그 opts를 읽는다 ──

멀티세트: core/multiSetGeneration.ts:115 directSetLocal → :202 preallocateSongSlots
```

---

## 2. 공통 관문 — 여기에 넣으면 네 경로 모두 통과한다

| 관문 | 위치 | 통과하는 경로 |
|---|---|---|
| `scoreSongs` / `scoreSong` | `core/quality.ts:404, 985` | **A · B · C 전부** |
| `preallocateSongSlots` | `core/batchPreallocation.ts:127` | **B · C · D** (A는 아님) |
| `resolveConstraintsFromOptions` | `core/constraints.ts` | A · B · C · D |
| `applyEraQuota` / `ensureEraNeutralFloor` | `core/constraints.ts:607, 972` | A · B · C · D |
| `evaluateConceptChannelFit` | `core/conceptChannelFit.ts` | A · B · C (지시문 79 TASK A-2) |
| `resolveBaseVocalQuota` | `core/vocalQuotaFromGenre.ts:175` | A · B · C |

**검사·경고 성격의 정책은 `scoreSong`에 둔다** — 네 경로가 반드시 통과하는
유일한 지점이다. 지시문 68 TASK B(인트로 모순), 74 TASK C(절 중복),
74 TASK A(섹션 하한 경고), 77 TASK D(장르↔발성 충돌)가 전부 여기 있다.

**산출물을 실제로 바꾸는 정책은 A와 B·C 양쪽에 배선해야 한다.** A가
`preallocateSongSlots`를 거치지 않기 때문이다. 공통 함수로 추출해 두 곳이
각자 호출하는 형태가 이 저장소의 기존 패턴이다(`resolveBaseVocalQuota`,
`buildVocalPlan`, `buildArcPlanForProfile` 등이 그렇게 되어 있다).

---

## 3. 지시문 74~78 정책의 경로별 적용 현황

지시문 79 TASK C-3 수정 **후** 기준. 측정은 `npm run check:path-coverage`.

| 정책 | 도입 | A 로컬 | B 브릿지 | C API | D 미리보기 |
|---|---|---|---|---|---|
| BPM 구간별 섹션 하한 | 74 TASK A | ✅ | ✅ | ✅ | — |
| 세트 내 대역 혼재 방지 | 76 TASK A | ✅ | ✅ | ✅ | ✅ |
| 컨셉 → 보컬 프리셋 라우팅 | 77 | ✅ | ✅ | ✅ | — |
| 발성 어휘의 stylePrompt 도달 | 78 TASK A | ✅ | ✅ | ✅ | — |
| 절 단위 중복 검사 | 74 TASK C | ✅ | ✅ | ✅ | — |
| 인트로 자기모순 검사 | 74 TASK C | ✅ | ✅ | ✅ | — |
| 컨셉↔채널 부적합 경고 | 79 TASK A-2 | ✅ | ✅ | ✅ | ✅(Step2) |

D 칸의 `—`는 "미리보기는 곡을 만들지 않으므로 해당 없음"이라는 뜻이지
누락이 아니다.

---

## 4. 이 문서를 갱신해야 하는 때

- 새 생성 경로를 만들 때(§1에 추가)
- 산출물을 바꾸는 정책을 새로 넣을 때(§3에 한 줄 추가 +
  `scripts/checkPathCoverage.ts`에 항목 추가)
- `preallocateSongSlots`를 새로 호출하는 곳이 생길 때(§1의 해당 경로에 추가)

§3의 표는 손으로 관리하지 않는다 — `check:path-coverage`가 실제로 세트를
생성해 측정한 결과가 정본이고, 이 표는 그 요약이다.
