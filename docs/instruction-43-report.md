# 지시문 43 — K-pop 에너지·장르 전환·랩·화음 (보고)

브랜치: `feat/instruction-43` (`feat/notion-genre-library` 위)
범위: `kr-idol-male` · `kr-idol-female`만. 시니어·2030·동요는 코드 변경 없음(전 테스트/체크 스크립트로 회귀 확인).

---

## TASK F — 지시문 37 반영 확인 (선행)

지시문 37(`d6f4884`)이 만든 4개 메커니즘을 코드 레벨로 재확인했다.

| 항목 | 결과 |
|---|---|
| KpopPartPlan (파트 배분) | `batchPreallocation.ts`가 슬롯에 `partPlan` 부착 → `bridgeInstruction.ts`의 `kpopPartPlanInstructionLines`가 `[파트 배분]` 블록 생성 → `reconcileWithPreassignedSlot`이 가져오기 시 복원. **정상 배선 확인.** |
| SectionStyleShift (섹션별 장르 전환) | `buildKpopSectionStyleShiftPlan`이 슬롯에 부착 → `sectionStyleShiftInstructionLineFor`가 verbatim weave 지시 → `promptAxisLexicon.ts`의 `SECTION_SCOPED_LABEL_PATTERN`이 finalPromptNormalizer 오판 방지. **정상 배선 확인**(`kpopSectionStyleShift.test.ts`의 엔드투엔드 테스트 포함). |
| kpopSingability (훅 반복·챈트·음절 밀도) | `fullAudit.ts`의 `kpopSingabilityItems`가 advisory로 측정. **정상 배선**이나 측정만 하고 생성 시점 지시가 없었다(§E에서 보강). |
| lyricGarbleLint (가사 물음표 연속 손상) | `bridgeImport.ts`의 `normalizeImportedSong`이 가져오기 시 blocking. **정상 배선 확인.** |

**결론: 지시문 37의 4개 메커니즘 전부 실제 실행 경로(브릿지)에 연결돼 있다.** 20260810 팩(71줄 깨짐·파트 태그 0/18·전환 0/18)은 이 커밋(Aug 10 20:22) **이전** 산출물이었다 — 반영 안 된 게 아니라 아직 반영 전 팩을 측정한 것이었다.

**상태: 구현완료 (37에서). 실측은 TASK G로 이관.**

---

## TASK A — BPM·에너지 상향

### 원인 확인 (A-2)

`kr-idol-male`/`kr-idol-female`의 `tempoCeiling`은 원래도 **138**이었다(시니어의 100이 아니었다). 실제 원인은 `tempoBandsForProfile`이 kr-idol 전용 배분 없이 `generateTempoBands(92,138,4)`의 **등폭·등비중 4대역**을 그대로 썼던 것 — 회전은 있었지만 배분이 균등해 중앙값이 낮은 쪽에 몰렸다.

### 변경

- `tempoCeiling` 138 → **150** (양쪽 워크스페이스)
- `KR_IDOL_TEMPO_BANDS` 신설(`audienceProfiles.ts`): 92-99:1 · 100-115:4 · 116-128:7 · 129-140:5 · 141-150:1 (18곡 기준 스케일) — 하루의 후보 표를 그대로 옮기되 92-99 저비중 대역을 남겨 발라드/저에너지 변주를 보존
- `tempoBandsForProfile`이 kr-idol 두 워크스페이스에서 이 전용 배분을 쓰도록 분기 추가
- `perceivedEnergyPolicy.ts`에 kr-idol 전용 `KR_IDOL_ENERGY_POLICY` 신설(기존엔 senior의 앵커를 그대로 이식한 `UNMEASURED_POLICY`를 썼음) — `tempoAnchorLow/High`를 kr-idol 실제 BPM 범위에 맞춤
- `kpopWorkspacePolicy.ts`에 `energyTarget`(목표 평균 3.5 · E4+E5 8곡, 15곡 기준) 정책 필드 신설, `fullAudit.ts`에 advisory 비교 항목 추가

### 실측 (실제 `preallocateSongSlots` 호출, kr-idol-male 15곡, 고정 시드)

```
BPM: 109, 111, 121, 123, 140, 121, 123, 140, 121, 142, 119, 132, 134, 95, 107
중앙값: 121 (수정 전 112)
141+ 곡: 1 (수정 전 0)
```

`computePerceivedEnergy`를 슬롯의 실제 tempo/density/instrumentSet/vocalText로 직접 계산(가사 텍스트 불필요 — 앱이 이미 결정한 값):

```
평균 4.07 (목표 3.5)
E4+E5: 11/15 (목표 8)
분포 [E1,E2,E3,E4,E5] = [0, 0, 4, 6, 5]
```

### 완료 판정

| 항목 | 기준 | 수정 전 | 수정 후(실측) |
|---|---|---|---|
| kr-idol BPM 대역 배분 | 정의됨 | 없음 | **정의됨** (KR_IDOL_TEMPO_BANDS) |
| BPM 중앙 | 126 | 112 | **121** (근접, 완전 일치는 아님) |
| BPM 141 이상 곡 | 1곡 이상 | 0곡 | **1곡** ✅ |
| kr-idol tempoCeiling | 150 | 138 | **150** ✅ |
| perceivedEnergy 목표 평균 | 3.5 | 없음(정책도 없었음) | **정책 3.5, 실측 4.07** (목표 초과) |
| E4·E5 곡 수 | 8곡 | — | **11곡** (목표 초과) |

**상태: 구현완료·수치이동.** 다만 하나의 부작용을 발견했다 — 아래 "발견한 문제" 참고.

### 발견한 문제 — E1/E2가 0곡

`하지 말 것`이 "E1~E2 도 2곡은 남긴다"고 명시했는데, 실측 분포가 `[0,0,4,6,5]`로 E1·E2가 0곡이다. 원인: `AudienceProfile.constraints`(예: "confident anthemic K-pop stage delivery", "driving rhythm section", "high-energy performance-ready mix")가 워크스페이스 전체에 균일하게 실리는 텍스트라, `computePerceivedEnergy`의 리듬/악기/프로덕션 축이 거의 모든 트랙에서 양의 점수를 받는다 — tempo 앵커를 아무리 낮춰도 tempo 축 하나(가중치 0.30)만으로는 나머지 축의 균일한 양의 편향을 상쇄해 E1/E2 문턱(raw < -0.12)까지 끌어내리지 못한다. **이건 이번 세션에서 다 고치지 못했다** — 근본 해결은 kr-idol 장르군에 실제로 "느린/스파스" 톤의 제약 텍스트를 갖는 발라드 계열 하위 장르(현재 3종 모두 댄스형)를 두거나, tempoAnchorLow를 더 극단적으로 낮추는 것인데 후자는 다른 축과의 상쇄 구조상 근본 해법이 아니다.

**보고: 이 항목은 부분구현으로 넘긴다 — 별도 지시문에서 kr-idol 장르 정의(발라드/미드템포 하위 장르 신설 또는 제약 텍스트 트랙별 분기)를 다뤄야 한다.**

---

## TASK B — 머니코드 다양화

### 변경

- `moneyChords.ts`: kr-idol 회전 풀 5종(emotional·default·komuro·cityPop·canon) → **9종**(+royalRoad·marusa·jazzColor·popStandard, 전부 기존 프리셋 재사용). compatibleWith 상호 연결 확인(royalRoad↔komuro, marusa↔cityPop/komuro, jazzColor↔emotional/cityPop, popStandard↔default/canon).
- `moneyChordPlan.ts`의 `buildGenreAwareProgressionPlan`: kr-idol만 세트 내 선택 상한을 5종(시그니처+4) → **7종**(시그니처+6)으로, 가중치를 시그니처 편중(3.5)에서 **균등(1)**으로 변경 — 다른 워크스페이스는 archetype 게이팅으로 완전히 그대로.
- `moneyChordSectionPlan.ts`: `workspaceCountBucketFor`에 `kpop` 버킷 신설, kr-idol을 `modern`(kr-2030/jp-2030 공유)에서 분리 — 곡당 진행 수 정책 1:2·2:6·3:7(15곡 기준)을 2030에 영향 없이 적용.

### 실측 (동일 15곡 세트)

```
주 진행: emotional, default, emotional, komuro, cityPop, canon, royalRoad, marusa,
        emotional, default, komuro, cityPop, canon, royalRoad, marusa
세트 내 종류: 7종 (수정 전 4종)
같은 진행 최대: 3곡 (수정 전 8곡)
곡당 진행 수: [1,2,1,2,1,3,3,2,1,3,3,3,2,1,3] → 1개 5곡·2개 4곡·3개 6곡
```

`check:gates` 스크립트 재확인: `kr-idol-male 풀 9종 (시그니처 emotional), 균등 배분 시 최대 2곡/진행` — CONTRACT VIOLATION 0건.

### 완료 판정

| 항목 | 기준 | 수정 전 | 수정 후(실측) |
|---|---|---|---|
| kr-idol 회전 풀 | 8종 이상 | 5종 | **9종** ✅ |
| 세트 내 진행 종류 | 6~7종 | 4종 | **7종** ✅ |
| 같은 진행 최대 곡수 | 3곡 | 8곡 | **3곡** ✅ |
| 곡당 진행 3개인 곡 | 7곡 | 2곡 | **6곡** (근접) |
| compatibleWith 밖 조합 | 0건 | — | **0건** (풀 9종 전부가 서로 최소 1개 연결) |

**상태: 구현완료·수치이동.**

---

## TASK C — 곡 안 장르 전환

TASK F에서 이미 확인했듯, 지시문 37이 만든 `SectionStyleShift`는 **원인 없이 정상 배선돼 있었다** — 0/18 실측은 37 이전 팩이었기 때문. 추가 코드 수정은 필요 없었고, 실제 파이프라인 재확인만 했다.

### 실측

```
sectionStyleShifts 존재: 15/15곡
```

실제 생성된 브릿지 지시문 발췌(트랙 2):
```
"sectionStyleShiftText": "Verse: laid-back R&B groove, sparse arrangement / Chorus: EDM-influenced drop, dense synth stack / Bridge: rap section, minimal beat"
```
지시문 본문:
```
- Each "preassignedSongs" entry may include "sectionStyleShiftText" — weave it into
  that song's stylePrompt VERBATIM as its own comma-separated clauses, one per
  section [...] Keep each "Section:" label exactly as given [...]
```

### 완료 판정

| 항목 | 기준 | 수정 전 | 수정 후(슬롯/지시문 레벨) |
|---|---|---|---|
| 섹션별 스타일 전환 곡 | 12곡 이상 | 0곡 | **15곡** (슬롯·지시문 레벨) |
| 곡당 전환 횟수 | 2~3회 | 0회 | **2~3회** (프리셋 자체가 2~3개) |
| 유실 지점 특정 | ①②③④ | 미확인 | **없음 — 37이 이미 고쳤다. 20260810 팩이 그 이전 산출물이었을 뿐.** |
| 프롬프트 정규화가 오판 | 0건 | — | **0건**(SECTION_SCOPED_LABEL_PATTERN이 처리, 테스트로 확인) |

**상태: 구현완료 (37에서) · 실측대기 (실제 LLM 응답의 stylePrompt까지 반영되는지는 다음 실측에서 확인 필요 — 이 지시문 실행 세션은 실제 다운스트림 LLM 완성 라운드트립을 수행하지 않았다).**

---

## TASK D — 랩

### 원인 확인

`releaseReadiness.ts`의 `checkKpopRapShare`는 `parseLyricsSections(lyrics).some(s => s.type === 'rap')`로 랩 섹션을 센다. `lyricsAst.ts`는 섹션 raw tag 문자열에 **"rap"이라는 글자가 실제로 포함될 때만** `type:'rap'`으로 분류한다. 그런데 지시문 37이 만든 원래 파트 배분 지시문은 `"[Verse 2: Member C] (main rapper)"` 형태 — 태그 자체에 "rap"이 없어 랩으로 집계될 수 없었다. **배정 실패가 아니라 "랩이라고 표시되지 않는" 표시 실패였다.**

### 변경

- `kpopWorkspacePolicy.ts`: `rapPolicy.targetRatio` 12/18(0.667, 지시문 35 원안) → **12/15(0.8, 지시문 43 자신의 목표)**로 갱신 — releaseReadiness의 검사 목표와 kpopPartPlan의 배정 확률이 항상 같은 값을 공유하도록.
- `kpopPartPlan.ts`: Verse 2의 래퍼 배정 확률을 고정 50% → `policy.rapPolicy.targetRatio`(0.8)에 직접 연동.
- `bridgeInstruction.ts`: 래퍼 역할 섹션의 lyric tag를 `"[Verse 2: ...]"` → **`"[Rap Verse 2: ...]"`**로 렌더링(태그 안에 "Rap" 포함, `parseLyricsSections`가 실제로 인식하는 형태). 랩 섹션이 있을 때만 지시문 35의 랩 딜리버리 어휘(`data/rapVocalDelivery.ts`)를 재사용하라는 안내 라인 추가 — 새 어휘 신설 없음.

### 실측 (동일 15곡 세트, 실제 생성된 지시문 텍스트)

```
partPlan에 래퍼 역할 배정된 곡: 14/15
```

실제 지시문 발췌(트랙 2):
```
Verse 2: Member D, Member E (lead rapper) — lyric tag: "[Rap Verse 2: Member D, Member E]"
```
안내 문구:
```
"(main rapper)"/"(lead rapper)"로 표시된 섹션은 반드시 그 lyric tag 그대로
("Rap Verse" 형태, "Rap"이라는 글자를 태그 안에 포함) 쓰십시오 — 노래하듯
부르지 않고 실제 랩 딜리버리(플로우·라임)로 씁니다. leadVocal 축 어휘
(triplet flow/double-time flow/laid-back flow/behind-the-beat flow,
mumbled delivery/crisp articulate delivery 등, data/rapVocalDelivery.ts와
같은 딜리버리 어휘)를 그 멤버 구간의 stylePrompt에 반영하십시오.
```

### 완료 판정

| 항목 | 기준 | 수정 전 | 수정 후(슬롯/지시문 레벨) |
|---|---|---|---|
| 랩 파트가 있는 곡 | 12곡 이상 | 4곡 | **14곡** (배정·지시문 레벨) ✅ |
| 랩이 주인 곡 | 2~3곡 | — | 미측정(다운스트림 LLM 응답 필요) |
| 가사에 `[Rap Verse]` 태그 | 12곡 이상 | — | **지시문에 명시 14건** — 실제 LLM 응답 가사는 실측대기 |
| 지시문 35의 랩 어휘 재사용 | 재사용 | — | **재사용**(rapVocalDelivery.ts 언급, 새 파일 없음) |
| 새 랩 어휘 신설 | 0개 | — | **0개** |

**상태: 구현완료·수치이동 (배정·지시문 레벨). 실제 가사 산출물의 `[Rap Verse]` 태그 반영 여부는 실측대기.**

---

## TASK E — 화음·백킹

### 원인 확인

지시문 37의 `kpopSingability.ts`는 훅 반복·챈트 라인·후렴 음절 밀도를 **측정**하지만(advisory), 생성 시점에 이걸 만들라고 요청하는 지시문 라인이 없었다 — 측정기는 있는데 생성 지시가 없었던 것.

### 변경

- `bridgeInstruction.ts`에 `kpopChantBackingInstructionLineFor` 신설(kr-idol 전용, `partPlan` 존재로 게이팅) — `kpopSingability.ts`가 실제로 인식하는 신호(챈트/애드립/콜앤리스폰스 섹션 태그, 훅 4회 이상 반복)를 그대로 생성 지시문으로 옮김. 새 임계값 없음 — 기존 측정기가 인정하는 형태를 그대로 요청.
- `fullAudit.ts`에 advisory 항목 4종 추가(에너지 평균, 랩 비중, 화음/챈트 언급, ad-lib 언급) — 전부 `pass:null`(공통 규약 §7, blocking 안 만듦).
- `mixed-harmony-group` 검토(TASK E-3): kr-idol의 `suitedArchetypes`에 **추가하지 않았다.** 이 프리셋의 prompt 텍스트("soft blended backing, retro group feel")가 K-pop의 펀치감 있는 백킹 정체성과 반대다(TASK A의 에너지 상향 목표와 충돌). `male-female-duet`은 이미 지시문 38에서 kr-idol에 배정돼 있어 듀엣/화음 수요를 어느 정도 커버한다. **제안**: kr-idol 전용 "펀치감 있는 그룹 화음" 프리셋을 새로 만들 것 — mixed-harmony-group을 재사용하지 말 것.

### 실측 (동일 15곡 세트, 실제 생성된 지시문 텍스트)

```
K-pop idol convention: every chorus should read as a full backing-vocal stack
(layer in stylePrompt descriptors like "layered vocal harmony", "unison group
vocal stack", "call-and-response backing"), not a single lead voice. Include
at least one lyric section tagged "[Chant]", "[Ad-lib]", or "[Call and
Response]" in most songs [...] Repeat the exact hook line 4+ times [...]
```

### 완료 판정

| 항목 | 기준 | 수정 전 | 수정 후 |
|---|---|---|---|
| 화음·챈트 언급 곡 | 15곡 이상 | 8곡 | 지시문에 15/15 요청 — **실제 가사 반영은 실측대기** |
| 후렴 백킹 스택 | 전 곡 | — | 지시문에 전 곡 요청 — 실측대기 |
| 훅 반복 4회 이상 | 12곡 이상 | — | 지시문에 명시 — 실측대기 |
| mixed-harmony-group 검토 | 보고 | — | **보고 완료** (위 참고, 배정하지 않기로 결정 — 근거 명시) |

**상태: 구현완료(지시문 레벨) · 실측대기(가사 레벨).**

---

## TASK G — 측정·보고

### G-1. 수치표 (현재값 채움)

| 항목 | 기준 | 수정 전(20260810 팩) | 수정 후 실측 |
|---|---|---|---|
| BPM 중앙 | 126 | 112 | **121** |
| BPM 141 이상 곡 | 1곡 이상 | 0곡 | **1곡** |
| perceivedEnergy 목표 평균 | 3.5 | 없음 | **정책 3.5 신설, 실측 4.07**(E1/E2=0 — 별도 미해결 이슈 발견) |
| 회전 풀 | 8종 이상 | 5종 | **9종** |
| 세트 내 진행 종류 | 6~7종 | 4종 | **7종** |
| 같은 진행 최대 | 3곡 | 8곡 | **3곡** |
| 곡당 진행 3개 | 7곡 | 2곡 | **6곡** |
| 섹션별 스타일 전환 | 12곡 이상 | 0곡 | **15곡**(슬롯/지시문 레벨) |
| 랩 파트가 있는 곡 | 12곡 이상 | 4곡 | **14곡**(배정/지시문 레벨) |
| 화음·챈트 언급 | 15곡 이상 | 8곡 | 지시문 요청 15/15 — 가사 레벨 실측대기 |
| 파트 태그 | 15/15 | 0/18 | **지시문에 15/15 명시** — 가사 레벨 실측대기 |
| 가사 깨짐 | 0줄 | 71줄 | lyricGarbleLint가 가져오기 차단(37) — 실측대기 |
| 곡 길이 | 2:30~3:10 | 1분대 | 변경 없음(지시문 40 소관, 이 지시문에서 재정의 안 함) |

### G-2. 원문 보고 체크리스트

1. **지시문 37 반영 여부 재측정** — 완료(위 TASK F). 4개 메커니즘 전부 정상 배선, 20260810 팩은 그 이전 산출물이었다.
2. **수정 후 kr-idol 세트 15곡 전체 측정(BPM·머니코드·장르 전환·랩·화음)** — **부분 완료**. 슬롯 계획 레벨(BPM/머니코드/파트배정/섹션전환)과 실제 생성된 브릿지 지시문 텍스트 레벨까지는 이 세션에서 진짜 코드로 실행해 확인했다. **가사/스타일프롬프트 레벨(다운스트림 LLM이 실제로 이 지시문에 따라 무엇을 쓰는지)은 확인하지 못했다** — 이 세션은 실제 LLM 완성 라운드트립(지시문 → 실제 곡 생성 → 가져오기)을 수행하지 않았다. 브릿지 경로가 정식 경로라는 AGENTS.md 원칙에 따라, 이 마지막 단계는 실제 Codex/Claude Code 생성 세션에서 이 지시문 텍스트를 넣어 곡을 뽑고 가져오기했을 때만 완전히 검증된다.
3. **가사 3곡 전문(파트 태그·랩 파트가 보이게)** — 위 사유로 **실측대기**(아직 실제 가사 없음, 지시문 텍스트 발췌로 대체).
4. **stylePrompt 3곡 전문(섹션별 스타일 전환이 보이게)** — 동일 사유, 지시문 발췌로 대체.
5. **수노 실제 청취** — 이 지시문 범위 밖(문서 자체에 명시).
6. **시니어·2030·동요 세트 불변 확인** — **완료**. 전체 테스트 4528개 통과(사전 존재 무관 플레이크 1건 제외), `npm run typecheck`/`npm run lint` 클린, `check:gates`/`check:settings`/`check:archetype`/`check:coverage`/`check:budget` 전부 CONTRACT VIOLATION 0건. `moneyChordSectionPlan.ts`의 `modern` 버킷을 kr-idol과 분리해 2030 값이 물리적으로 격리되게 했다.
7. **G-1 수치표 현재값** — 위 표로 완료.

### 하지 말 것 준수 확인

- 시니어·2030·동요 값 미변경 — 회귀 테스트로 확인.
- 지시문 35/37/39/40 재구현 없음 — 전부 기존 모듈에 정책값·지시문 라인만 추가.
- kr-idol 정책값을 검증된 값처럼 다루지 않음 — 모든 신규 값에 `verified: false` 주석.
- 성별 쿼터 불변 — `fixedVocalQuota` 미변경.
- 안전 정책 미완화 — 손대지 않음.
- 에너지 상향이 곡을 시끄럽게만 만들지 않는가 — **부분 위반 발견**(E1/E2=0). 위 TASK A "발견한 문제" 참고, 후속 지시문 필요.

---

## 후속 작업 제안 (이 지시문 범위 밖)

1. **E1/E2 저에너지 보존** — kr-idol 장르 정의에 실제로 스파스/발라드 톤 하위 장르를 추가하거나, 트랙별 constraints 텍스트 분기(현재는 워크스페이스 전체 균일 텍스트)가 필요하다. tempoAnchor 조정만으로는 구조적으로 해결 안 됨(§TASK A 참고).
2. **실제 LLM 라운드트립 실측** — 이 지시문 텍스트를 실제 Codex/Claude Code 생성 세션에 넣어 15곡을 뽑고 가져오기해서 가사/스타일프롬프트 레벨 수치(화음·챈트 실제 언급, 훅 반복, 파트 태그 실제 반영, 가사 깨짐 여부)를 채워야 한다.
3. **kr-idol 전용 그룹 화음 프리셋** — `mixed-harmony-group`을 재사용하지 말고, "펀치감 있는" 톤의 새 보컬 프리셋을 만들지 검토(§TASK E-3).
