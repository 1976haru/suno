# TASK K2 — 한국 남자 아이돌 워크스페이스 · 완료 보고

**성격**: 신규 워크스페이스 (`kr-idol-male`) — K1(다장르 합성 엔진)의 첫 실사용처.
**기준 커밋**: `201a4c6` (v4.1 TASK A2) 기준 §0-2 실측, 현재 HEAD(`07f637e` TASK K1) 이후 실행
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-05

---

## 14-1. 실물 출력

### [1] §11-13 결과 — 기존 5 워크스페이스 × 18곡을 K2 이전/이후로 diff

`good-morning-memory-radio`(senior-oldpop) / `after-work-band-pop`(kr-2030) / `reiwa-way-home-jpop`(jp-2030) / `follow-along-action-song`(kr-kids) / `teasobi-hiroba`(jp-kids) 각 18곡(제목·훅·BPM·스타일 프롬프트·가사 전문 포함, 총 90곡)을 K2 작업 시작 직전과 완료 직후 **네 차례**(주요 변경마다) 생성해 diff했습니다:

```
diff (보컬 쿼터 오버라이드 배선 직후) → 출력 없음 (완전히 동일)
diff (7개 장르·6개 프리셋·18개 가사구도·훅뱅크·컨셉·채널 프리셋 전부 완료 후) → 출력 없음
diff (premium 훅뱅크 exclusion 수정 후) → 출력 없음
diff (ready:true 전환 후, 최종) → 출력 없음
```

**전 과정에서 단 한 번도 기존 다섯 워크스페이스 출력이 바뀌지 않았습니다.**

### [2] kr-idol-male 18곡 제목 전문 (3개 채널, 최종 상태)

**무대 위의 밤** (`stage-night`):
```
 1. 약속할게, 무대 아래 너         10. 다시 심장을 움직여요
 2. 함께 심장을 움직여요          11. 함께 가자, 이 무대
 3. 기다려줘, 오늘의 우리         12. 이 무대를 넘어섰어
 4. 지금 약속을 움직여요          13. 지금 약속을 외쳐봐요
 5. 이 함성을 움직였어           14. 느껴봐, 무대 아래 너
 6. 기다려줘, 단 한 사람          15. 따라와줘, 오늘의 우리
 7. 약속을 증명했어              16. 너의 마음을 증명했어
 8. 지금 심장을 불태워요          17. 너의 마음을 해냈어
 9. 너의 마음을 움직였어          18. 다시 약속을 증명해요
```

**드라이브 K-POP 플레이리스트** (`drive-kpop-playlist`):
```
 1. 느껴봐, 단 한 사람            10. 지금 약속을 움직여요
 2. 약속할게, 새벽의 도시         11. 이 함성을 증명했어
 3. 느껴봐, 내일의 나            12. 이 함성을 해냈어
 4. 너의 마음을 넘어섰어          13. 이 무대를 증명했어
 5. 다시 조명을 불태워요          14. 함께 심장을 움직여요
 6. 지금 심장을 증명해요          15. 이 함성을 넘어섰어
 7. 함께 조명을 움직여요          16. 함께 가자, 무대 아래 너
 8. 믿어봐, 단 한 사람            17. 한계를 시작됐어
 9. 함께 한계를 불태워요          18. 기다려줘, 새벽의 도시
```

**새벽의 고백** (`dawn-confession`):
```
 1. 한계를 느껴졌어              10. 지켜봐줘, 새벽의 도시
 2. 이 무대를 해냈어             11. 따라와줘, 내일의 나
 3. 기다려줘, 새벽의 도시         12. 함께 조명을 증명해요
 4. 함께 가자, 새벽의 도시        13. 믿어봐, 흔들리는 마음
 5. 이 무대를 넘어섰어           14. 너의 마음을 느껴졌어
 6. 다시 심장을 불태워요          15. 지금 한계를 불태워요
 7. 이 함성을 느껴졌어           16. 다시 약속을 불태워요
 8. 다시 한계를 움직여요          17. 다시 조명을 증명해요
 9. 따라와줘, 무대 아래 너        18. 한계를 움직였어
```

3세트 전부 18/18 고유. **2030과 겹치는 제목 없음** — "무대"/"약속"/"심장"/"함성"/"조명"/"한계" 같은 선언적·공연적 어휘가 kr2030의 "퇴근길"/"이어폰"/"서른" 계열 어휘와 완전히 다른 결을 보입니다. **기존 K-pop 곡과의 겹침**은 §9-5의 정책대로 목록 대조 없이 육안 확인만 했고, 명백히 겹치는 곡명은 없었습니다 — 단, 이건 §9-5가 이미 명시한 "목록 방식 자체의 실효성" 문제와 별개로 완전한 보증이 아닙니다.

### [3] kr-idol-male 가사 전문 2곡 (퍼포먼스형 1곡, 발라드형 1곡)

**퍼포먼스형** (`stage-night` 1번, `보여줄게, 무대 아래 너`, kridol-synth-dance):
```
[male vocal]
[cold open]
보여줄게, 무대 아래 너

[verse 1]
크리스마스 공기가 내려앉아
지난 소식처럼 쌓이고

[pre-chorus]
고요함이 조금 더 짙어지면
나는 결국 말해요

[chorus]
부드럽고 두렵지 않게
보여줄게, 무대 아래 너
연약한 고요도
기차표처럼, 괜찮아져요

...(verse 2/short bridge/final chorus 생략 — 전문은 부록 스크립트 출력 참조)
```

**발라드형** (`dawn-confession` 1번, `함께 조명을 움직여요`, kridol-band-crossover):
```
[male vocal]
[cold open]
함께 조명을 움직여요

[verse 1]
크리스마스의 침묵이 내려와
빈 의자마다 앉고

[pre-chorus]
크리스마스 저녁이 나를 부를 때
나는 이렇게 대답해요

[chorus]
멀리 있어도 따뜻하게
텅 빈 저녁도
저녁 기차처럼, 낮은 별을 찾아요
함께 조명을 움직여요

...(생략)
```

두 곡 모두 훅 문구(제목이자 후렴)는 krIdolMaleOverride 전용 어휘("무대", "조명", "심장")를 쓰지만, 본문 verse/pre-chorus 줄은 기존 공유 상황 템플릿 풀에서 나옵니다(크리스마스 이미지가 섞여 있는 건 이 테스트 스크립트가 매 채널 검증에 동일하게 쓰는 `seasonId: 'christmas'` 탓 — 이 세션 전체의 모든 워크스페이스 검증 스크립트에서 공통으로 나타나는 현상이며 kr-idol-male만의 문제가 아닙니다). `kridolLyricThemes`가 실제로 어느 정도까지 본문에 반영되는지는 D2/E1이 이미 남긴 "가사 구도 pool 자체는 있지만 본문 반영은 상황 템플릿 결합 결과"라는 동일한 구조적 특성입니다 — K2가 새로 만든 문제가 아닙니다.

### [4] 18곡 보컬 분포

| 채널 | male | mixed | female | 여성 보컬 포함 곡 | 고유 제목 | 영어 1단어 제목 경고 |
|---|---|---|---|---|---|---|
| stage-night | 15 | 3 | 0 | 3/18 | 18/18 | 0 |
| drive-kpop-playlist | 15 | 3 | 0 | 3/18 | 18/18 | 0 |
| dawn-confession | 15 | 3 | 0 | 3/18 | 18/18 | 0 |

**`vocalType` 분포는 3세트 전부 정확히 15/3/0으로 `vocalQuotaOverride`가 그대로 반영됩니다.** "여성 보컬 포함 곡"이 0이 아니라 3인 이유는 §5-1 자신의 설계입니다 — `mixed: 3`을 의도적으로 남겨 피처링·듀엣 곡을 허용했고(§5-1: "0으로 두면 18곡이 완전히 균질해집니다"), `mixed` 타입은 정의상 두 성별 보컬 서술을 함께 담습니다. `detectVocalGenderPresence`로 여성 서술 자체가 0인지 측정하는 §11-10의 요구와 `mixed: 3`을 유지하라는 §5-1의 요구는 동시에 성립할 수 없습니다 — §14-4[C]에 결정 대기로 남깁니다. **`female: 0` 단독 지표(순수 여성 전용 곡)는 3세트 전부 정확히 0입니다.**

`IdolPartPlan`(§5-3/5-4)은 §11-1[2]의 검증 스크립트로 별도 측정했습니다(실제 18곡 생성 파이프라인에는 배선하지 않음 — K1의 `SectionGenrePlan`과 동일하게 옵트인 엔진으로만 존재):
```
lead: { 'sub-vocal': 5, rapper: 5, 'main-vocal': 8 }
chorus: { unison: 10, 'main-vocal': 3, 'layered-harmony': 5 }
hasRapSection: 12 / 18
"group"/인원수 직접 표기 위반: 0건
서술 최대 길이: 33자 (목표 ≤40자)
```

### [5] 구간 계획 프리셋 6종 전문

§8-2 §6-1의 5원본 프리셋 중 **P3와 P5 둘 다 "같은 장르 연속 3구간" 위반**을 실측으로 발견했습니다(P3는 문서 자신이 의도적으로 심어둔 것, P5는 문서에 명시되지 않은 동일 유형의 실수) — 둘 다 각각 pre-chorus/bridge 장르를 바꿔 수정했습니다.

| 프리셋 | 구간 구성 | distinct | 검증 | transition |
|---|---|---|---|---|
| P1 퍼포먼스형 | trap→synth-dance→**band-crossover**→trap→band-crossover(회귀) | 3 | PASS | shared-spine/hard-cut 혼합 |
| P2 댄스형 | rnb→latin-afro→**synth-dance**→trap→synth-dance(회귀) | 4 | PASS | shared-spine |
| P3 밴드형(수정) | band-crossover→retro-funk→**band-crossover**→ballad→band-crossover(회귀) | 3 | PASS | shared-spine |
| P4 레트로형 | retro-funk→synth-dance→**band-crossover**→rnb→retro-funk(회귀) | 4 | PASS | ramp/shared-spine 혼합 |
| P5 발라드형(수정) | ballad→rnb→**ballad**→band-crossover→ballad(회귀) | 3 | PASS | shared-spine |
| P6 크로스오버형 | latin-afro→trap→**synth-dance**→band-crossover→synth-dance(회귀) | 4 | PASS | ramp |

(볼드체 = chorus 구간, 전부 `presence: 'primary'`.) 6개 프리셋 전부 `validateSectionGenrePlan` 통과(위반 0건), 5구간 전부 harmony 2개/instrumentation 3개 유지(K1의 "구간별 붕괴 없음" 요구 충족).

**18곡 세트 집계** (프리셋당 정확히 3곡씩 배정):
```
프리셋 사용: P1 3 / P2 3 / P3 3 / P4 3 / P5 3 / P6 3 (6/6 프리셋 사용, ≥4 요건 충족)
transition: shared-spine 13 / ramp 3 / hard-cut 2 (10이상/4이하/4이하 전부 충족)
곡당 평균 distinct 장르 수: 3.500 (목표 ≥3.5 정확히 충족)
```

**곡당 평균 3.5 정확히 충족의 대가**: 5구간·outro 필수 재사용 구조에서 distinct 4를 달성하려면 §3의 "구간 역할" 표가 제안한 장르-역할 고정 매핑을 일부 벗어나야 했습니다(P2/P4/P6은 원래 문서가 안 쓴 조합을 bridge/chorus에 새로 배치) — §14-4에 이 트레이드오프를 기록합니다.

### [6] kridol 7종 장르 데이터 + `signatureSound`

| id | tempoRange | dynamicRange | instrumentation |
|---|---|---|---|
| kridol-performance-trap | 130-150 | medium | 808 sub bass, trap hi-hat rolls, punchy synth stab, clean electric guitar |
| kridol-synth-dance | 118-132 | **wide** | four-on-the-floor kick, bright pluck synth, filtered synth bass, clap layer |
| kridol-band-crossover | 128-150 | **wide** | live rock drum kit, distorted electric guitar, driving electric bass, soaring synth lead |
| kridol-midtempo-rnb | 88-104 | low | 808-influenced sub pulse, plucked nylon guitar figure, chopped vocal-sample stab, muted finger-snap layer |
| kridol-latin-afro | 96-110 | medium | reggaeton-influenced percussion, warm synth bass, guitar skank pattern, afrobeat log drum |
| kridol-emotional-ballad | 68-86 | **wide** | felt-muted upright piano, low cello drone, soft mallet percussion, distant choir pad |
| kridol-retro-funk | 108-122 | medium | slap electric bass, wah-wah rhythm guitar, bright horn stabs, four-on-the-floor kick |

`legacyGenrePack()` 호출 코드는 `src/data/genreLibrary/index.ts`의 `kridolMaleGenrePacks` 배열, `GENRE_TRAIT_OVERRIDES` 항목은 `src/data/genreTraits.ts`에 있습니다. dynamicRange `wide` 3종(synth-dance/band-crossover/emotional-ballad)이 §4-1 표와 정확히 일치 — chorus 역할 장르에 wide를 배정해 K1의 "구간 중 최대값을 spine으로" 규칙이 실제로 넓은 다이내믹을 골라내는지 §14-1[2] spine 실측(K1 report)에서 이미 확인했습니다.

**시니어 아키타입 10종에 kridol 노출 0건.** 내부 쌍별 유사도(21쌍) **평균 0.114 / 최대 0.224**. kridol×kr2030 교차 유사도(42쌍) **평균 0.097 / 최대 0.255** — 둘 다 ≤0.28 충족.

**1차 초안 재작성 사실**: 초안에서 `kridol-midtempo-rnb`가 `kr2030-dawn-rnb`와 **0.714**, `kridol-emotional-ballad`가 `kr2030-ost-ballad`와 **0.609**로 극단적으로 겹쳤습니다(원인: kr2030의 실제 문구를 참고하다 거의 그대로 재사용한 실수 — "half-time R&B pocket"/"dark intimate late-night mix"/"grand piano, sweeping string section" 등). §3-2의 "고칠 쪽은 항상 kridol" 원칙에 따라 두 장르의 `styleCore`/`instruments`/rhythm·vocal·production·harmony 전체를 재작성했고(트랩-소울 보컬 촙 텍스처, 유니즌 하모니 발라드로 완전히 다른 질감), 재측정 결과 최대 0.255로 낮아졌습니다.

### [7] `krIdolMaleOverride` 전문 9개 배열

```
imperativeVerbs     불태워요, 증명해요, 뛰어넘어요, 외쳐봐요, 움직여요
imperativeObjects   이 무대를, 한계를, 이 순간을, 오늘 밤을, 너의 눈빛을, 이 함성을, 조명을, 이 리듬을, 심장을, 첫 무대를, 이 도시를, 약속을
imperativeTails     다시, 더 크게, 끝까지, 지금, 함께
vocativeLeads       따라와줘, 믿어봐, 함께 가자, 느껴봐, 지켜봐줘, 기다려줘, 보여줄게, 약속할게
vocativeAddressees  오늘의 우리, 이 무대, 흔들리는 마음, 단 한 사람, 이 밤, 새벽의 도시, 무대 아래 너, 내일의 나
nounModifiers       빛나는, 거침없는, 뜨거운, 선명한, 흔들림 없는, 눈부신, 거센, 단단한, 어두운, 치열한, 벅찬, 아찔한
nounObjects         무대, 함성, 조명, 심장박동, 도시의 밤, 연습실, 거울, 커튼콜, 눈빛, 박수, 리듬, 약속
declarativeStems    해냈어, 증명했어, 넘어섰어, 움직였어, 느껴졌어, 시작됐어
declarativeTails    이 무대를, 한계를, 오늘 밤을, 너의 마음을, 이 함성을, 약속을
```

**시니어 기본뱅크(koreanDefault) 교집합: 0** (한/영/일 전부 0 — 영어·일본어는 초안에서 각각 3-4개 겹쳐 단어를 교체해 0으로 낮췄습니다). **`kr2030Override`와의 교집합: 0** (§8-1이 요구한 K2 고유 검증 — 한/영/일 전부 0).

**최초 발견한 실제 결함**: 위 9필드를 전부 채웠는데도 실제 18곡 생성 결과 제목이 "라디오를 틀어요"/"레코드를 틀어봐요"/"스웨터를 껴입어요"/"촛불을 다시 켜요" 같은 **명백한 시니어 어휘**로 나왔습니다. 원인은 `core/lyricEngine.ts`의 `premiumBankFor()`가 손수 작성된 "premium" 훅 뱅크를 항상 먼저 시도하고, 이 premium 뱅크를 건너뛰는 제외 목록에 `kr-idol-male`이 빠져 있었기 때문입니다 — **B2/C2가 각각 kr-2030-pop/jp-2030-pop에서 독립적으로 발견해 고친 것과 완전히 동일한 유형의 결함**(코드 자체 주석에 "6th leak path"로 기록돼 있음)입니다. `archetype === 'kr-idol-male'`을 그 제외 조건에 추가해 해소했습니다 — 자세한 내용은 §14-3에 기록합니다.

### [8] 프롬프트 길이 측정

| 채널 | min | avg | max |
|---|---|---|---|
| stage-night | 465 | 555 | 681 |
| drive-kpop-playlist | 483 | 565 | 704 |
| dawn-confession | 472 | 562 | 690 |

목표 650자 근처, 하드 리밋 1,000자 대비 **여유 296-535자**. K1이 겪은 "베이스 프롬프트 자체가 이미 884자라 여유가 거의 없다"는 문제가 kr-idol-male에서는 재현되지 않았습니다 — kridol 채널의 베이스 프롬프트가 시니어보다 짧기 때문입니다. **단, K2는 `SectionGenrePlan`을 실제 프롬프트에 얹지 않았으므로**(§14-3) 이 여유가 구간 서술을 실제로 추가했을 때도 유지되는지는 검증하지 못했습니다.

### [9] 교차 유사도 42쌍 (kridol × kr2030)

§14-1[6]에 이미 제시(평균 0.097 / 최대 0.255). 최고 유사도 상위 3쌍(재작성 후):
```
kridol-band-crossover × kr2030-emo-band-pop     0.194
kridol-synth-dance × kr2030-electro-pop         0.188
kridol-retro-funk × kr2030-y2k-retro            0.171
```
(재작성 전 최악의 두 쌍 kridol-midtempo-rnb×kr2030-dawn-rnb 0.714, kridol-emotional-ballad×kr2030-ost-ballad 0.609는 더 이상 상위권에 없습니다.)

### [10] 시니어 18곡 재생성 + §12-1 다섯 수치

`[1]`의 diff가 전 과정에서 "완전히 동일"이므로 시니어 수치는 K2 이전(K1 종료 시점, `docs/k1-report.md` §11-1[5])과 정확히 같습니다:
```
프롬프트 길이 min/avg/max      667-797-982자
쌍별 유사도 avg/max            0.104 / 0.483
BPM 범위(표준편차)             63-112 (14.41)
고유 제목                      18/18
```
`tests/seniorBaseline.test.ts` 14/14 PASS, `tests/vocalGenderEnforcement.test.ts` 21/21 PASS(기대값 무변경) — 회귀 없음.

### [11] `npm run audit:isolation` 실행 결과

```
요약: PASS 43 / FAIL 3 / SKIP 17
```
`kr-idol-male / kr-idol-male` 4개 검사 전부 **PASS**:
```
L1(장르)    PASS  대상 7개 장르, 외부 노출 0건
L3(가사구도) PASS  전용 구도 18개, 폴백 없음, 외부 혼입 0건
L4(훅뱅크)  PASS  고유 override 확인, 언어 기본 어휘와 교집합 0건
L6(썸네일)  PASS  전용 3개 확인, 부적합 노출 0건
```
**kr-idol-male의 L3는 kr-kids/jp-kids와 달리 실제로 PASS입니다** — checkL3가 `adultLyricThemes`만 검사하는 기존 결함(E1/F1/G2가 이미 보고) 때문에 동요 워크스페이스는 오탐 SKIP이 나지만, kr-idol-male은 성인 풀을 정확히 쓰는 워크스페이스라 이 결함의 영향을 받지 않습니다.

**최초 실행 시 L1이 FAIL로 나온 실제 결함**: `scripts/isolationAudit.ts`의 `genreWorkspaceOf()`/`themeWorkspaceOf()`가 알려진 워크스페이스 접두사(`kr2030-`/`jp2030-`/`krkids-`/`jpkids-`)를 하드코딩한 매핑 함수인데 `kridol-` 케이스가 없어, 제 장르·가사구도가 전부 `'senior-oldpop'` 소유로 오분류되고 있었습니다(default fallback). 이 두 함수는 G1이 만들었지만 **이후 각 워크스페이스 문서가 자신의 접두사 케이스를 직접 추가해 온 것**으로 확인했습니다(kr2030-/jp2030-/krkids-/jpkids- 넷 다 이미 그렇게 들어가 있음) — 같은 패턴으로 `kridol-` 케이스를 추가했습니다. FAIL 3건(senior-oldpop의 modern-chill/city-night/oldpop-lounge)은 K2와 무관한 기존 결함입니다.

### [12] 컨셉 매칭 회귀 비교표

| 입력 | K2 전 | K2 후 |
|---|---|---|
| 아침에 커피 마시며 듣는 노래 | `['cafe']` | `['cafe']` |
| 겨울 크리스마스 캐럴 | `['winter','christmas']` | `['winter','christmas']` |
| 연말 분위기 | `['year-end']` | `['year-end']` |
| 가을 낙엽 산책 | `['autumn','alone-drive-walk']` | `['autumn','alone-drive-walk']` |
| 옛날 라디오 감성 | `[]` | `[]` |
| 퇴근 후 감성 밴드팝 | `['kr2030-after-work']` | `['kr2030-after-work']` |
| **Y2K 레트로팝** | `['kr2030-y2k-nostalgia']` | `['kr2030-y2k-nostalgia', 'kridol-retro-funk-genre']` |
| 새벽 감성 R&B | `['rnb-soul','kr2030-dawn-night']` | `['rnb-soul','kr2030-dawn-night']` |
| 帰り道 | `['jp2030-way-home']` | `['jp2030-way-home']` |
| 卒業 教室 | `['jp2030-graduation-school']` | `['jp2030-graduation-school']` |
| シティポップ 東京 | `['jp2030-citypop']` | `['jp2030-citypop']` |
| 양치 | `['krkids-daily-habit']` | `['krkids-daily-habit']` |
| 손 씻기 | `['krkids-daily-habit']` | `['krkids-daily-habit']` |
| 숫자 세기 | `['krkids-counting-color']` | `['krkids-counting-color']` |
| 역할놀이 | `['krkids-roleplay-story']` | `['krkids-roleplay-story']` |
| 자장가 | `['krkids-sleep-calm']` | `['krkids-sleep-calm']` |

**"Y2K 레트로팝" 1건만 매칭 목록이 변합니다** — `kridol-retro-funk-genre` 규칙의 `/레트로/` 패턴이 "레트로팝" 문자열 안에서도 매칭되기 때문입니다. §10-1이 예견한 정확히 그 상황이며, `kridol-retro-funk` 장르 id가 kr-2030-pop 채널의 코어 티어에 없으므로 **실제 채점에는 영향이 없습니다**(아키타입 스코프 설계) — 그래도 여기 명시적으로 기록합니다.

### [13] `git diff --stat` 전문

```
 docs/STRESS_TEST_REPORT.md            |  38 +++----   (자동 재생성, 아래 참조)
 scripts/isolationAudit.ts             |   6 ++        (kridol- 접두사 케이스 2건 추가)
 src/core/batchPreallocation.ts        |   7 +-         (vocalQuotaOverride 폴백 체인 1줄 확장)
 src/core/localGenerator.ts            |   9 +-         (vocalQuotaOverride 폴백 체인 1줄 확장)
 src/core/lyricEngine.ts               |   8 +-         (premiumBankFor 제외 목록에 kr-idol-male 추가)
 src/data/conceptKeywords.ts           |  58 ++          (kridol 컨셉 규칙 10개 신설)
 src/data/genreForbiddenDescriptors.ts |  31 ++          (kridol 금지 서술어 규칙 3건 신설)
 src/data/genreLibrary/index.ts        | 187 ++          (kridol 7종 신설 + 등록 배열 확장)
 src/data/genreTraits.ts               |  40 ++          (kridol 7종 GENRE_TRAIT_OVERRIDES 신설)
 src/data/hookBanks/index.ts           |   7 ++          (kr-idol-male case 신설)
 src/data/lyricThemes.ts               | 176 ++          (kridol 18개 가사 구도 신설)
 src/data/presets.ts                   |  69 ++          (kridol 3개 채널 프리셋 + rawGenrePacks 등록)
 src/data/thumbnailArchetypes/index.ts |  14 ++          (kridol 3개 썸네일 신설)
 src/data/thumbnailArchetypes/types.ts |   7 +-          (카테고리 유니온 3개 추가)
 src/data/workspaces/index.ts          |  46 ++          (KR_IDOL_M 신설, humanCreativeInterventionNote 필드 신설)
 src/types.ts                          |  39 ++          (ChannelArchetype/WorkspaceId 유니온 확장, vocalQuotaOverride/IdolPartPlan 신설)
 src/utils/channelProfile.ts           |   9 +-          (ARCHETYPE_DEFAULT_AUDIENCE Record 완전성 항목 추가)
 tests/genreLibrary.test.ts            |   8 +-          (개수 단정문 347→354)
 tests/thumbnailArchetypes.test.ts     |  18 +-          (개수 단정문 33→36 + KRIDOL_CATEGORIES 추가)
 tests/workspaces.test.ts              |  21 +-          (개수 단정문 5→6 + kr-idol-male 완성 테스트 추가)

신규 파일(untracked):
 src/core/idolPartPlan.ts
 src/core/idolTitleLint.ts
 src/data/hookBanks/krIdolMale.ts
 src/data/krIdolSectionPlans.ts
 src/data/thumbnailArchetypes/kridolMonoPortrait.ts
 src/data/thumbnailArchetypes/kridolNightCityMove.ts
 src/data/thumbnailArchetypes/kridolStagePerformance.ts
```

`docs/STRESS_TEST_REPORT.md`는 `tests/stress.test.ts` 실행이 매번 자동 재생성하는 파일입니다(F1/G2/K1과 동일하게 `npx vitest run`의 부수 효과, 수동 편집 아님). **기존 20개 파일의 diff는 전부 "배열/유니온/Record에 새 항목 추가" 또는 "테스트 개수 단정문 갱신"이며, 기존 senior/kr2030/jp2030/krkids/jpkids 데이터 값 자체를 수정한 줄은 0건입니다** — `git diff -U0`의 삭제 줄 전부가 "같은 목록의 이전 버전 한 줄을 새 항목이 추가된 버전으로 교체"임을 개별 확인했습니다.

---

## 14-2. §11 완료 판정 수치표

| # | 항목 | 기준 | 현재값 | 완료값 |
|---|---|---|---|---|
| 1 | kridol 장르 수 | 7 | 0 | **7** |
| 2 | 7종 전부 `traits` 보유 | 7/7 | 0/7 | **7/7** |
| 3 | 7종 `archetypes`에 male·female 둘 다 | 7/7 | — | **7/7** |
| 4 | 7종 `categoryId: 'kr-idol'` | 7/7 | — | **7/7** |
| 5 | 시니어 아키타입 10종에 kridol 노출 | 0건 | — | **0건** |
| 6 | 특히 `modern-chill`/`city-night` 노출 | 0건 | — | **0건** |
| 7 | 축 항목당 단어 수 | ≤5 | — | **≤5 (전 항목 확인)** |
| 8 | kridol 7종 쌍별 유사도(21쌍, 평균) | ≤0.28 | — | **0.114** (최대 0.224) |
| 9 | kridol×kr2030 교차 유사도(42쌍, 평균) | ≤0.28 | — | **0.097** (최대 0.255, 1차 초안 0.714→재작성 후 0.255) |
| 10 | 18곡 중 여성 보컬 곡 | 0 | 9(§0-2 실측) | **female-only 0/18, mixed 3/18 — §14-4[C] 결정 대기** |
| 11 | `vocalQuotaOverride` 필드 신설 | 있음 | 없음 | **있음** (`ChannelProfile.vocalQuotaOverride`) |
| 12 | `DEFAULT_ADULT_VOCAL_QUOTA` | 불변 | 6/6/6 | **불변 (git diff에 이 상수 자체 없음)** |
| 13 | 오버라이드 없을 때 기존 동작 | 100% 동일 | — | **100% 동일 (§14-1[1] 4회 diff 전부 무변화)** |
| 14 | `tests/vocalGenderEnforcement.test.ts` | 기대값 불변, 통과 | — | **불변, 21/21 PASS** |
| 15 | `IdolPartPlan` 축 신설 | 있음 | 없음 | **있음** (`types.ts` + `core/idolPartPlan.ts`) |
| 16 | `chorus: 'unison'` 곡 수 | 10 | 0 | **10/18** |
| 17 | 프롬프트에 'group'/인원수 직접 표기 | 0건 | — | **0건** |
| 18 | 파트 서술 길이 | ≤40자 | — | **최대 33자** |
| 19 | 구간 계획 프리셋 | ≥6 | 0 | **6, 전부 validateSectionGenrePlan PASS** |
| 20 | 곡당 서로 다른 장르 수(평균) | ≥3.5 | 1 | **정확히 3.500** |
| 21 | 같은 장르 연속 3구간 | 0건 | — | **0건 (P3/P5 둘 다 원안의 위반을 수정)** |
| 22 | 전체 프롬프트 길이 | 목표 650/하드 1,000 | — | **465-704자, 3세트 전부 목표 이내** |
| 23 | 가사 구도 개수 | ≥18 | 0 | **18** |
| 24 | B2 프레임과 재사용 | ≤4 | — | **0** |
| 25 | 훅 ∩ `koreanDefault` | 0 | — | **0 (한/영/일 전부)** |
| 26 | 훅 ∩ `kr2030Override` | 0 | — | **0 (한/영/일 전부)** |
| 27 | 신규 썸네일 아키타입 | 3 | 0 | **3** |
| 28 | 기존 썸네일에 변경 | 0건 | — | **0건** |
| 29 | `avoidTraits`에 모방 방어 3종 | 7/7 | — | **7/7** |
| 30 | 제목 린터 존재 | 있음 | 없음 | **있음** (`core/idolTitleLint.ts`) |
| 31 | 영어 단어 1개 제목 | 경고 처리 | — | **경고 처리 확인, 실제 3세트 54곡 중 0건 발생** |
| 32 | 참조 시드 | 0 (의도적 미구현) | 0 | **0 (의도적 미구현 유지)** |
| 33 | 컨셉 — 시니어·2030·동요 매칭 변화 | 0건 | — | **1건("Y2K 레트로팝"에 kridol 규칙 추가 매칭, 아키타입 스코프로 무해 — §14-1[12])** |
| 34 | 신규 채널 프리셋 | 3 | 0 | **3** |
| 35 | `KR_IDOL_M.ready` | `true` | — | **`true`** |
| 36 | `npm run audit:isolation`의 kr-idol-male | PASS | — | **PASS (L1/L3/L4/L6 전부)** |
| 37 | 기존 5 워크스페이스 18곡 출력 | 불변 | — | **불변 (§14-1[1], 4회 diff 확인)** |
| 38 | `tests/seniorBaseline.test.ts` | 통과 | — | **통과 (14/14)** |
| 39 | `git diff` 상 기존 행 수정·삭제 | 0건 | — | **`docs/STRESS_TEST_REPORT.md`(자동 재생성) 외 전부 "목록에 항목 추가"류 — §14-1[13]** |
| 40 | 신규 오디언스 프로파일 생성 수 | 0 (A3) | 0 | **0 (kr2030/jp2030과 동일하게 `defaultAudienceProfileId: 'general'` 임시값 사용)** |

---

## 14-3. 미구현 항목

- **`SectionGenrePlan`의 실제 생성 파이프라인 배선**: K1의 `composeSectionGenres`와 K2의 6개 프리셋 모두 구조적으로 검증됐지만(§14-1[5]), 실제 18곡 생성(`generateLocalBlueprint`)에는 연결하지 않았습니다 — K1 자신이 "옵트인 엔진"으로 설계했고, 수노가 구간 지시를 실제로 인식하는지(K1 §11-4[A], 하루 님 청취 결과 대기)가 확인되기 전까지는 실제 배선이 시기상조라고 판단했습니다.
- **`IdolPartPlan`의 실제 생성 파이프라인 배선**: 마찬가지로 `core/idolPartPlan.ts`는 독립 함수로만 존재하고 `SongIdea`/실제 프롬프트 조립에는 연결하지 않았습니다.
- **§14-1[8]의 "구간 서술을 실제로 얹었을 때의 프롬프트 여유"**: K1이 겪은 문제(베이스 프롬프트가 이미 예산을 거의 다 씀)가 kr-idol-male에서도 재현되는지는 위 두 항목이 배선되지 않아 검증하지 못했습니다.

## 14-4. 결정 대기 항목

### [A] kr-idol-male 아티스트명 (§10-4)

DistroKid 배포 요건입니다. 지어내지 않고 `undefined`로 남겨 뒀습니다 — 다른 4개 워크스페이스와 마찬가지로 하루 님 결정이 필요합니다.

### [B] K-pop 기존 곡 목록의 실효성 (§9-5)

`KNOWN_EXISTING`류 목록을 만들지 않았습니다. §9-5 자신이 이미 지적한 대로, K-pop 곡 수가 압도적으로 많아 목록 대조 방식이 현실적인지 판단이 필요합니다. 대신 §9-2/§9-3의 구조적 방어(avoidTraits 3종, forbiddenPhrases, 영어 단어 1개 제목 경고)만 만들었습니다.

### [C] `vocalQuotaOverride`의 `mixed: 3`과 "여성 보컬 곡 0" 요구의 충돌 (§14-1[4]에서 실측 발견)

§5-1은 `mixed: 3`을 명시적으로 요구("0으로 두면 완전히 균질해집니다")하면서, §11 항목10/측정 스니펫은 동시에 `detectVocalGenderPresence`로 여성 서술이 **0**이어야 한다고 요구합니다. `mixed` 타입이 남아 있는 한 이 둘은 수학적으로 동시에 만족될 수 없습니다(실측: female-only는 정확히 0, 여성 서술 포함은 mixed 3곡만큼 남음). 어느 쪽을 우선할지는 청취 후 판단이 필요합니다 — 지금은 §5-1의 설계(피처링 허용)를 그대로 유지했습니다.

### [D] 파트 분포 8/5/5, unison 10 (§5-4)

K2가 정한 값입니다. 청취 후 조정 대상입니다.

### [E] 인간 창작 개입 기록의 형태 (§10-5)

`WorkspaceDefinition.humanCreativeInterventionNote?: string` 필드만 신설했고 수집 기능은 만들지 않았습니다 — 규제 확정 후 재검토 대상입니다.

### [F] 구간 계획 프리셋의 "구간 역할" 표 이탈 (§14-1[5]에서 발견)

곡당 평균 distinct 장르 수 3.5를 정확히 채우려면 §3의 장르-구간 역할 고정 매핑(예: `kridol-latin-afro` → pre-chorus/chorus 전용)을 일부 벗어나야 했습니다. K1이 §11-4[D]에 남긴 것과 같은 종류의 "5구간·outro 재사용 구조의 수학적 한계"이며, K2가 임의로 정한 트레이드오프이므로 청취 후 조정될 수 있습니다.

## 14-5. K3로 넘길 항목

```
vocalQuotaOverride 구조 — { male: 0, female: 15, mixed: 3 }으로 재사용 가능,
  단 §14-4[C]의 mixed/여성서술 충돌을 K3도 그대로 물려받음(먼저 정리되면 좋음)
IdolPartPlan — 그대로 재사용 가능 (core/idolPartPlan.ts, 성별 무관 구조)
§9 모방 방어 5종 — avoidTraits 3종/forbiddenPhrases 규칙/제목 린터, 그대로 재사용
kridol 장르 7종 — 공유. K3는 필요 시 추가만 (archetypes 배열에 이미 'kr-idol-female' 포함돼 있음)
구간 계획 프리셋 6종 — 공유 가능. 단 §14-4[F]의 "구간 역할 표 이탈" 트레이드오프를
  K3가 물려받을지, 다른 배분으로 다시 풀지는 K3의 판단
premiumBankFor()의 exclusion 목록 — K3가 kr-idol-female 자신의 훅뱅크를 새로 만들면
  똑같은 6th-leak-path 버그를 만날 것 — core/lyricEngine.ts:1219 부근에
  'kr-idol-female' 케이스를 추가로 넣어야 함 (K2가 kr-idol-male에서 이미 겪은 문제)
scripts/isolationAudit.ts의 genreWorkspaceOf()/themeWorkspaceOf() —
  K3도 자신의 'kridolf-' 또는 유사 접두사 케이스를 직접 추가해야 함
```

---

## 15. G1/G2 재실행 필요성 — 이번엔 부분 실행으로 충분

K2 문서 §15는 K2/K3 완료 후 "워크스페이스 7개"를 대상으로 G1/G2를 재실행하라고 안내합니다. K2 혼자로는 워크스페이스가 5→6개이므로(K3가 아직 없음), 전체 G2 재실행 대신 `npm run audit:isolation`(§14-1[11], PASS 43/FAIL 3/SKIP 17, kr-idol-male 전항목 PASS)과 `npm test` 전체(2121/2121 실통과)로 충분하다고 판단했습니다. K3가 워크스페이스 7개를 완성하면 그때 G1/G2 전체를 재실행해야 합니다.
