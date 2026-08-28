# 지시문 79 완료 보고 — 2차 감사 대응

- 브랜치: `feat/instruction-79` (기준 `20ebff5`)
- 커밋 6개 (TASK별 분리)
- `npx vitest run`: **4720 passed / 8 skipped / 0 failed**
- `npm run typecheck` 통과

| 커밋 | TASK |
|---|---|
| `8b77f5b` | A — 장르 붕괴 + 컨셉↔채널 부적합 경고 |
| `3368251` | B-1 — Step2Plan 미적용 표시 |
| `48912c1` | C-1/C-2 — 생성 경로 지도 + 경로 커버리지 검사 |
| `8caba24` | C-3 (1/2) — 발성 어휘 도달 · onset 중복 · reasonKo |
| `fc9f39a` | C-3 (2/2 일부) — tone-match 우선순위 판정 |
| `e68abe8` | C-3 (2/2) — 섹션 하한 로컬 배선 · 대역 잠금 공통화 |

---

## 0. 먼저 — 지시문 §1.2의 원인 진단을 정정합니다

지시문 §1.2는 붕괴의 원인을 `core/conceptAgent.ts:716·730`의 단일 폴백
(`genreCandidates = rotate([fallbackGenreId], ...)`)으로 지목했습니다.
**그 경로는 원인이 아닙니다.** 실행해 보면 `recommendConceptLocal`은 이미
4종을 돌려줍니다.

```
$ npx tsx scripts/audit79/a1-core-intersection.ts
##### showa-70s × "60년대 올드팝"
  코어 장르 4종: kayokyoku-70s, japanese-folk-70s, new-music-70s, showa-groove-70s
  매칭 규칙 2개: oldpop-60s, oldpop
  지목 장르 12종
  코어 교집합 0종
  → recommendConceptLocal의 genreAllocation: 4종
```

§1.2의 ①②(코어 4종, 교집합 0)는 **정확합니다**. ③(폴백이 단일 후보가 된다)만
다릅니다 — `buildGenreAllocation`의 padding이 이미 코어 전체로 채웁니다.

실제 원인은 `core/constraints.ts`의 `applyEraQuota`였고, 세 단계였습니다.

1. `trimBucket`(585행)이 상한 초과 버킷에서 **앞쪽 장르를 통째로 삭제**합니다
   (`if (count - cut > 0) kept.push(...)` — 0이면 안 넣습니다). showa-70s의
   코어 4종은 전부 1970s 버킷이고 "60년대" 컨셉에서 1970s는 인접 상한 25%
   (15곡 중 3곡)라, 4종 중 3종이 사라지고 1종만 3곡으로 남습니다.
2. 주 시대(1950s-60s) 후보가 이 채널에 0종이라 `distributeInto`가 12곡을
   한 곡도 놓지 못합니다.
3. 마지막 안전망(908행)이 **살아남은 목록만** 보고 라운드로빈하므로 그
   1종에 12곡을 전부 되돌립니다 → 15/15.

지시문이 요구한 수정 방향(A-1 "폴백이 단일 후보가 되지 않게 한다")은 옳고,
적용 지점만 다릅니다. 그 지점에 적용했습니다.

---

## 1. §7-1 — §1.2 재현 재실행 (수정 전후)

세 컨셉의 코어 교집합은 데이터 사실이라 수정 전후가 같습니다(지시문 §1.3
A-3에 따라 `showa-70s`의 코어 4종을 늘리지 않았습니다). 바뀐 것은 **실제
후보 종수**입니다.

| 컨셉 | 코어 교집합 | `recommendConceptLocal` | 실제 배정 (수정 전) | 실제 배정 (수정 후) |
|---|---|---|---|---|
| `60년대 올드팝` | 0종 | 4종 | **1종** (`showa-groove-70s`×15) | **4종** |
| `1960년대 감성` | 0종 | 4종 | **1종** (`showa-groove-70s`×15) | **4종** |
| `70년대 가요` | 0종 | 4종 | 4종 | 4종 (변화 없음) |

```
$ npx tsx scripts/audit79/a2-collapse-trace.ts     # 수정 후
##### showa-seventies × "60년대 올드팝"
  extractEraConstraint : {"primary":"1950s-60s","adjacent":[{"era":"1970s","maxShare":0.25}],"forbidden":["1980s"]}
  실제 배정 4종: japanese-folk-70s×4, new-music-70s×4, kayokyoku-70s×4, showa-groove-70s×3
##### oldpop-lounge-main × "2000년대 감성"
  실제 배정 4종: smooth-jazz-lounge×3, adult-contemporary×6, chanson×3, bossa-cafe×3   (수정 전 1종)
##### millennium-jpop × "60년대 올드팝"
  실제 배정 3종: jpop-2000s-ballad×7, jpop-2000s-rnb×4, jpop-2000s-band×4   (수정 전 1종)
```

---

## 2. §7-2 — 15곡 세트 실제 생성 3건 (곡별 장르 id 전부)

`generateLocalBlueprint`로 끝까지 생성한 결과입니다. 예상값이 아니라 산출물입니다.

```
$ npx vitest run --config scripts/audit79/vitest.audit79.config.ts \
    scripts/audit79/a4-real-sets.audit.ts --reporter=verbose
```

**① `showa-seventies` × `"60년대 올드팝"` — 고유 4종**

```
 1. new-music-70s        6. japanese-folk-70s   11. kayokyoku-70s
 2. japanese-folk-70s    7. kayokyoku-70s       12. showa-groove-70s
 3. kayokyoku-70s        8. showa-groove-70s    13. new-music-70s
 4. showa-groove-70s     9. new-music-70s       14. japanese-folk-70s
 5. new-music-70s       10. japanese-folk-70s   15. kayokyoku-70s
→ new-music-70s×4, japanese-folk-70s×4, kayokyoku-70s×4, showa-groove-70s×3
```

**② `showa-seventies` × `"1960년대 감성"` — 고유 4종** (곡별 id 동일, 위와 같은 배열)

**③ `showa-seventies` × `"70년대 가요"` — 고유 4종** (곡별 id 동일, 위와 같은 배열)

세 세트 모두 **4종** — 목표(3종 이상) 충족. 1번 곡에 실린 경고:

```
① ② 이 채널에는 1950s-60s 장르가 하나도 없습니다 — 컨셉이 요청한 시대를 이
     채널의 장르로는 표현할 수 없어, 시대 배분을 적용하지 않고 선택하신 장르
     구성을 그대로 씁니다. 컨셉이 지목한 장르(Doo-Wop Close Harmony · Brill
     Building Pop · Girl Group Wall of Sound 외 9종)가 이 채널의 장르 목록에
     하나도 없습니다 — 채널이 원래 쓰는 장르로 대신 배분합니다.
③   컨셉이 지목한 장르(70s Soft Rock AM Gold · Motown Pop Soul · 70s Piano
     Pop Ballad 외 7종)가 이 채널의 장르 목록에 하나도 없습니다 — 채널이
     원래 쓰는 장르로 대신 배분합니다.
```

③은 시대 축은 맞고(1970s 후보 4종) 장르 축만 어긋나므로 경고도 한 줄입니다.

---

## 3. §7-3 — 34채널 재측정

두 방식으로 쟀습니다. 스크립트 경로를 명시합니다.

**(a) 2차 감사의 측정 방식 그대로** — `scripts/audit2/f3-genre-collapse.ts`
(감사 브랜치에서 한 글자도 바꾸지 않고 가져왔습니다)

```
$ npx tsx scripts/audit2/f3-genre-collapse.ts
총 238건 중 장르 종류 축소 21건      (수정 전 28건)
```

축소 21건이 남지만 **1종 붕괴는 0건**입니다(최다 12/15, 그 채널의 선택 장르가
3종인 경우). "축소"는 시대 제약이 정상 동작해 장르 수가 줄어든 경우를 포함합니다.

**(b) 목표 지표 전용 측정** — `scripts/audit79/a5-collapse-metric.audit.ts`
(컨셉 표본을 10개로 넓힘)

```
$ npx vitest run --config scripts/audit79/vitest.audit79.config.ts \
    scripts/audit79/a5-collapse-metric.audit.ts --reporter=verbose
  (단일 장르 붕괴 없음)

세트 340개 (채널 34 × 컨셉 10)
  단일 장르 붕괴(1종)          : 0
  2종 (선택 장르가 3종 이상인데): 11
```

**340세트 중 단일 장르 붕괴 0건** — 목표 충족.

---

## 4. §7-4 — `check:concept-channel-fit` 출력

전체 교차표(아키타입 16 × 컨셉 1994 = 31,904쌍)와, 실제로 조치가 필요한
**본래 대상 대각선**을 함께 냅니다. 동요 컨셉을 아이돌 채널에 넣었을 때
안 맞는 것은 결함이 아니므로 대각선이 판단 근거입니다.

```
$ npm run check:concept-channel-fit

  컨셉500_시니어올드팝.md       498개  본래 대상: senior-morning, oldpop-lounge
  컨셉500_일본시니어.md        497개  본래 대상: showa-cafe, showa-70s, j2000s
  컨셉500_2030케이팝.md       500개  본래 대상: kr-2030-pop, kr-idol-male, kr-idol-female
  컨셉500_동요.md            499개  본래 대상: kr-kids-song, jp-kids-song
  합계                    1994개

① 시대 축 — 컨셉이 명시한 연대의 장르가 이 아키타입에 0종
  archetype        workspace         건수     비율   시대별 내역
  lofi-study       senior-oldpop      101    5.1%   1950s-60s×39, 1980s×30, 1970s×26, 2000s×6
  kr-kids-song     kr-kids            101    5.1%   (동일)
  jp-kids-song     jp-kids            101    5.1%   (동일)
  en-chillhop      en-chillhop        101    5.1%   (동일)
  j2000s           senior-oldpop       95    4.8%   1950s-60s×39, 1980s×30, 1970s×26
  kr-2030-pop      kr-2030             95    4.8%   (동일)
  jp-2030-pop      jp-2030             95    4.8%   (동일)
  showa-70s        senior-oldpop       75    3.8%   1950s-60s×39, 1980s×30, 2000s×6
  kr-idol-male     kr-idol-male        75    3.8%   (동일)
  kr-idol-female   kr-idol-female      75    3.8%   (동일)
  kids             senior-oldpop       62    3.1%   1980s×30, 1970s×26, 2000s×6
  modern-chill     senior-oldpop       56    2.8%   1980s×30, 1970s×26
  city-night       senior-oldpop       45    2.3%   1950s-60s×39, 2000s×6
  oldpop-lounge    senior-oldpop        6    0.3%   2000s×6
  showa-cafe       senior-oldpop        6    0.3%   2000s×6
  senior-morning   senior-oldpop        0    0.0%   -

③ 본래 대상 대각선 (조치 대상)
  컨셉 파일                   archetype          시대축   장르축    표본
  컨셉500_시니어올드팝.md      senior-morning         0       1     498
  컨셉500_시니어올드팝.md      oldpop-lounge          0       0     498
  컨셉500_일본시니어.md       showa-cafe             0     157     497
  컨셉500_일본시니어.md       showa-70s              0     286     497
  컨셉500_일본시니어.md       j2000s                 0     286     497
  컨셉500_2030케이팝.md      kr-2030-pop           16     184     500
  컨셉500_2030케이팝.md      kr-idol-male          22     207     500
  컨셉500_2030케이팝.md      kr-idol-female        22     203     500
  컨셉500_동요.md            kr-kids-song           0      63     499
  컨셉500_동요.md            jp-kids-song           0      83     499
  합계                                          60    1470    4985

총 31904쌍 — 시대 축 어긋남 1089건, 장르 축 어긋남 12653건
[check:concept-channel-fit] advisory — 통과 처리(exit 0).
```

**읽는 법**: 시대 축 60건은 그 워크스페이스에 해당 연대 장르가 아예 없는
경우이고, 장르 축 1470건은 컨셉이 지목한 장르가 그 채널 코어에 없는
경우입니다. `showa-70s`/`j2000s`의 286건(57%)이 가장 크고, `senior-morning`은
1건뿐입니다 — 장르 확충 우선순위가 이 숫자로 정해집니다(다음 지시문 판단 근거).

---

## 5. §7-5 — `docs/generation-paths.md` 전문

파일 전문은 `docs/generation-paths.md`에 있습니다. 핵심만 옮깁니다.

**경로는 넷입니다.**

| 경로 | 슬롯을 만드는 함수 | 곡 본문 | 사용처 |
|---|---|---|---|
| A 로컬 | `generateLocalBlueprint` 내부 | 저장소 코드 | 프로바이더 `local`, 워커 |
| B 브릿지 | `preallocateSongSlots` | 외부 에이전트 | 지시문 → JSON 임포트 |
| C API | `preallocateSongSlots` | 원격 모델 | `openai`/`anthropic`, Batch |
| D 미리보기 | `directSetLocal` | 없음 | Step2Plan 표 전용 |

**가장 중요한 사실**: A는 `preallocateSongSlots`를 **거치지 않습니다.** B·C에만
붙인 정책은 A에 자동으로 오지 않습니다 — 지시문 74 TASK A가 로컬만 빠졌던
이유이고, 이번 §3.1 6건 중 3건이 같은 모양이었습니다.

**네 경로가 모두 통과하는 유일한 관문은 `core/quality.ts`의 `scoreSongs`**
입니다. 검사·경고 성격의 정책은 거기 두고, 산출물을 바꾸는 정책은 공통 함수로
추출해 각 경로가 호출합니다(이번에 `conceptChannelFit.ts` /
`enChillhopBand.ts` / `instrumentalSectionFill.ts` 셋을 그렇게 만들었습니다).

문서에는 각 경로의 호출 사슬(파일:행), 공통 관문 표, 정책별 경로 적용 현황표,
갱신 시점 규칙이 함께 있습니다.

---

## 6. §7-6 — `check:path-coverage` 수정 전후

**수정 전 코드(`20ebff5`)에서 §3.1의 6건을 실제로 잡아내는지 먼저 확인했습니다.**
전문은 `scripts/audit79/out/path-coverage-BEFORE.txt`에 보관했습니다.

```
검사 9칸 (정책 6종 × 경로) — 미적용 7건
  · BPM 섹션 하한 / A-로컬        246곡 중 230곡 미달 (93.5%)
  · 대역 혼재 방지 / B/C-슬롯      25세트 중 9세트 공존
  · 컨셉 발성 라우팅 / B/C-슬롯    135칸 중 22칸 배정 0건
  · 컨셉 발성 라우팅 / A-로컬      135칸 중 22칸 배정 0건
  · 발성 어휘 도달 / A-로컬        324곡 중 0곡 (0.0%)
  · 절 중복 검사 / A-로컬          2448곡 중 694곡 경고 (28.3%)
  · 인트로 모순 검사 / A-로컬      2448곡 중 282곡 경고 (11.5%)
```

감사가 보고한 6건을 **전부 재현**했고, 감사가 재지 않았던 **인트로 자기모순
11.5%를 추가로** 찾았습니다.

**수정 후** (`scripts/audit79/out/path-coverage-AFTER.txt`)

```
검사 9칸 — 미적용 4건
  · 컨셉 발성 라우팅 / B/C-슬롯   135칸 중 10칸 배정 0건   (22 → 10)
  · 컨셉 발성 라우팅 / A-로컬     135칸 중 10칸 배정 0건   (22 → 10)
  · 절 중복 검사 / A-로컬         2448곡 중 360곡 (14.7%)  (28.3% → 14.7%)
  · 인트로 모순 검사 / A-로컬     2448곡 중 282곡 (11.5%)  (변화 없음)

  적용됨  BPM 섹션 하한 / A-로컬     236곡 중 미달 0곡 (0.0%)
  적용됨  대역 혼재 방지 / B/C-슬롯  25세트 중 0세트
  적용됨  발성 어휘 도달 / A-로컬    324곡 중 318곡 (98.1%)
```

---

## 7. §7-7 — §3.1의 6건, 각각의 처리와 실측

### ① 지시문 78 발성 어휘 — 408곡 중 0곡 → **324곡 중 318곡(98.1%)**

**원인**: `presetVariantVocalText`는 프리셋 `prompt`의 **첫 절만** anchor로
쓰고 나머지를 버리며, `adultVocalTraitPlan` 경로는 `prompt`를 아예 읽지
않습니다. 78 TASK A가 넣은 어휘는 3번째 절이라 항상 사라졌습니다.

**처리**: `conceptVocalPlan.ts`에 `articulationFamilyForPreset` 신설 →
`withPresetArticulation`이 보컬 원자의 **전달 방식 절 하나를 교체**합니다
(추가가 아니라 교체이므로 절 개수 불변).

**판단이 필요했던 지점**: 계열 매핑(`VOCAL_FAMILY_BY_PRESET_ID`)을 쓸지
프리셋 자신의 `prompt` 절을 쓸지. **프리셋 자신을 우선**했습니다 — 계열
대표 표현을 쓰면 `clear-light-male`에 `even unforced onset`이 들어가고
78이 그 프리셋에 실제로 써 넣은 `forward mask resonance`는 여전히 도달하지
않습니다. 78의 핵심이 "프리셋마다 다른 발성"이므로 고유 문구가 이겨야
합니다. 계열은 `prompt`에 발성 절이 없는 프리셋의 폴백으로만 씁니다.
(계열 우선으로 먼저 구현해 10.5%에 머물렀고, 뒤집자 98.1%가 됐습니다.)

### ② 지시문 77 라우팅 — 22칸 → **10칸**, 차단 채널 3 → **0**

**판단 근거 (§3.3이 요구한 tone-match 우선순위 판정)**:
tone-match가 컨셉보다 우선하는 것 **자체는 옳습니다**. `types.ts`의
`vocalPresetSource` 자기 doc comment가 "사용자의 명시적 선택이 항상 컨셉
추론을 이긴다"로 근거를 적어 뒀고 이견이 없습니다.

틀린 것은 **"명시적 선택"의 판정**이었습니다. `wholePackMatchedVocalPreset`은
`opts.vocalTone`을 프리셋과 대조하는데, `createInitialOptions`가 `vocalTone`을
**항상 `channel.defaultVocal`로 초기화**합니다. 그래서 채널 기본값이 어떤
프리셋과 일치하는 3개 채널에서는 사용자가 보컬을 한 번도 건드리지 않아도
tone-match가 성립했습니다.

**우선순위는 그대로 두고 판정만 고쳤습니다** — 이 저장소가 이미 그 목적으로
만든 `core/vocalPlan.ts`의 `isVocalToneBalanced`를 씁니다(Step2Plan.tsx에서
발견된 같은 유형의 결함 `!opts.vocalTone`을 고치며 만들어진 함수입니다).
문구 조립에는 계속 `wholePackMatchedVocalPreset`을 씁니다 — 그쪽은 "누가
골랐는가"가 아니라 "어떻게 들리는가"의 문제입니다.

함께: 벨팅 키워드 `내지르`를 `vocal-belted-power`에 추가했습니다. "힘차게
내지르는 목소리"가 어느 규칙에도 걸리지 않았습니다(이 축에서 가장 흔한
한국어 표현인데 없었습니다).

```
$ npx tsx scripts/audit2/g1-concept-vocal.ts
##### good-morning-memory-radio          (수정 전: 두 컨셉의 프리셋 분포 동일)
컨셉A "힘차게 내지르는 목소리의 올드팝"
  source : auto,auto,auto,concept,auto,auto,auto,concept,auto,auto,auto,concept,auto,auto,auto
컨셉B "올드팝"
  source : auto ×15
  => 두 컨셉의 프리셋 분포 동일: 다름 (컨셉이 반영됨)
```

남은 10칸은 tone-match 차단이 **아니라** 그 아키타입에 해당 계열 프리셋이
0종인 데이터 공백입니다 → §10에서 미조치 사유를 적습니다.

### ③ 지시문 74 섹션 하한 (로컬) — 93.5% 미달 → **0%**

`core/instrumentalSectionFill.ts` 신설. 브릿지 지시문이 에이전트에게 요구하는
것과 **같은 방식**으로 채웁니다 — 보컬 섹션은 한 글자도 건드리지 않고 간주
전용 섹션만 덧붙입니다. 95 BPM 이하는 무변경입니다.

실측 회귀 2건을 거쳐 정확해졌습니다.
- 섹션 수를 자체 정규식으로 세다가 `[verse 1: male vocal]` 듀엣 태그를 보컬
  지시 태그로 오인(`vocal$`)해 과소 집계 → 채점기가 쓰는
  `parseLyricsSections`를 그대로 씁니다.
- 후행 `[end]`를 세다가 **매번 정확히 1개씩** 모자랐습니다 —
  `songPostProcess.ts`가 그 태그를 제거하기 때문 → 최종 산출물 기준으로
  셉니다. 같은 이유로 아웃트로 자리에는 넣지 않습니다.

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts \
    scripts/audit2/c3-local-section-warning.audit.ts --reporter=verbose
로컬 생성 408곡 중 자기 채점기의 섹션 하한 경고를 받은 곡: 0 (0.0%)   (수정 전 238곡 = 58.3%)
```

### ④ 지시문 76 대역 브리지 (직접 경로) — 9/25세트 → **0/25세트**

`core/enChillhopBand.ts`로 공통 함수를 추출해 두 경로가 함께 부릅니다.
규칙은 한 글자도 바꾸지 않았습니다.

실측 회귀 1건: 텍스트 신호만 보면 `after-hours-deep-house`(하우스 3종 +
`alt-rnb`)에 컨셉 없이 생성할 때 기본값인 랩 대역이 걸려 `alt-rnb` 한 종만
남았습니다(`tests/bpmSectionFloor.test.ts`가 잡았습니다). **사용자가 고른
장르 풀 자체**를 두 번째 신호로 넣어 해소했습니다 — 풀이 이미 한쪽 대역으로
기울어 있으면 그것이 사용자의 실제 선택입니다.

### ⑤ 지시문 78 신설 프리셋 onset 절 중복 — 30.6% → **0%**

`applyVocalOnsetPhrasing`의 `alreadyHasOnset`이 **완전 일치**로만 검사해,
78 TASK B 신설 프리셋의 정체성 절이 발성 표현을 이미 품고 있어도
(`male voice with audible fold rasp`) 같은 표현을 한 번 더 붙였습니다.
포함 관계로 바꿨습니다.

```
$ npx vitest run --config scripts/audit2/vitest.audit2.config.ts \
    scripts/audit2/g8-dup-in-styleprompt.audit.ts --reporter=verbose
곡 612개
  vocalText에 onset 절이 2회 이상   : 0      (수정 전 187)
  최종 stylePrompt에 2회 이상 살아남음: 0      (수정 전 187, 전부 중복 경고를 받았다)
```

### ⑥ §1 보컬 쿼터 `reasonKo` — 불일치 → **일치** (§7-9에 상세)

---

## 8. §7-8 — Step2Plan 미적용 표시

`src/components/steps/Step2Plan.tsx` — `[설계 적용]` 버튼 바로 아래.

**미적용일 때**
> ⚠ 이 설계는 아직 적용되지 않았습니다 — **[설계 적용]**을 누르지 않으면
> 아래 "12곡 계획" 표의 장르·BPM·보컬은 실제 생성에 반영되지 않고, 채널 기본
> 구성으로 생성됩니다.

**적용됐을 때**
> ✅ 이 설계가 지금 세트에 적용되어 있습니다 — 아래 표대로 생성됩니다.

**표시 조건** (`planIsApplied`): `applyPlanToOptions`가 실제로 쓰는 **두
필드만** 봅니다 — 화면과 배선이 다른 기준을 들지 않게 하기 위해서입니다.
1. 계획의 장르 배분 키 집합 == `opts.genreIds` 집합
2. `opts.diversityAllocations`가 존재하고, 계획의 각 축 counts와 축별로 동일

막지 않습니다 — 그대로 생성해도 되고, 다른 세트가 나온다는 사실만 알립니다.

---

## 9. §7-9 — `reasonKo` 수정 전후 + 일치 확인 세트

**원인**: 카드가 쓰던 `genreDerivedQuota.reasonKo`의 숫자는
`deriveVocalQuotaFromGenrePlan` 안에서 **성별 쏠림 적용 전** 값(`floored`)으로
만들어집니다. 사용자가 프리셋을 고르거나 `[다시 추천]`을 누르면
`opts.vocalTone`이 채널 기본값에서 바뀌어 쏠림이 켜지고, 그때부터 이 문장과
같은 화면의 "성별 배정" 줄·실제 생성이 갈립니다.

**처리**: **계산 로직을 건드리지 않았습니다.** `DerivedVocalQuota`에
`genreSummaryKo`(장르 요약 문구)만 노출하고, 화면이
`resolvedVocalQuotaPreview`(생성 경로의 `resolvedVocalQuota`와 같은 계산)로
문장을 다시 조립합니다. 용어도 이 화면의 나머지와 같은 **듀엣**으로
통일했습니다(감사 유형 F의 라벨 불일치 일부 해소).

| | 수정 전 문구 | 수정 후 문구 | 실제 생성 |
|---|---|---|---|
| 톤 미선택 | 남 6 · 여 5 · 혼성 4 | 남성 6 · 여성 5 · 듀엣 4 | 6/5/4 |
| `belted-male` 선택 | 남 6 · 여 5 · 혼성 4 | **남성 8 · 여성 3 · 듀엣 4** | 8/3/4 |
| `bright-clear-female` 선택 | 남 6 · 여 5 · 혼성 4 | **남성 3 · 여성 8 · 듀엣 4** | 3/8/4 |

**일치를 보인 세트 1건** — 2차 감사 §1이 인용한 그 세트
(`headphones-down-low` · 15곡 · chill-rap/lofi-hiphop-study/jazz-rap/boom-bap-mellow):

```
$ npx vitest run --config scripts/audit79/vitest.audit79.config.ts \
    scripts/audit79/c1-reason-ko.audit.ts --reporter=verbose

##### B. 남성 프리셋 선택 (belted-male)
  카드 문구 : 선택하신 장르 구성(Mellow Boom-Bap 4곡 · Jazz Rap 4곡 ·
              Lo-fi Hip-Hop Study 4곡 · Chill Rap 3곡)에서 계산했습니다 —
              남성 8곡 · 여성 3곡 · 듀엣 4곡.
  실제 생성 : 남성 8곡 · 여성 3곡 · 듀엣 4곡
  일치 여부 : OK
```

세 케이스 전부 OK입니다.

---

## 10. §7-12 — 하지 않은 것과 사유

### B-2 (계획표 자동 배선) — **하지 않았습니다**

지시문이 요구한 두 가지를 먼저 확인했습니다.

**(1) 버튼이 추가된 커밋과 주석** — `481d285` (v3.63):
> "Every axis, its reasoning, and adjustable alternatives are shown before
> generation **and can be overridden**."

이 화면은 축을 **보고 고친 뒤 확정하는** 검토 화면으로 설계됐습니다. 버튼은
그 확정 지점입니다.

**(2) 되먹임 위험** — 가설을 세웠다가 **실측으로 기각했습니다.**
`plan`은 `opts`의 함수이고 `applyPlanToOptions`는 `opts`를 바꾸므로 자동
적용이 무한 갱신이 될 수 있다고 보았으나, 34채널 전부 1회 적용 후 계획이
고정점이었습니다.

```
$ npx vitest run --config scripts/audit79/vitest.audit79.config.ts \
    scripts/audit79/b2-autoapply-risk.audit.ts --reporter=verbose
적용 후 계획이 다시 바뀌는가 (되먹임 위험):
  (없음)
채널 34개 — 계획 고정 34 / 적용 후 계획이 달라짐 0
```

**결정 근거는 §8의 명시적 금지였습니다** — "사용자가 명시적으로 선택한
장르·보컬을 자동 적용으로 덮어쓰지 말 것". 자동 적용이 실제로 무엇을
덮어쓰는지 쟀습니다.

```
자동 적용이 사용자의 장르 선택을 바꾸는가:
  good-morning-memory-radio    사용자 선택 29종 → 계획 4종 (빠짐 25종, 새로 들어옴 0종)
  oldpop-lounge-main           사용자 선택 24종 → 계획 4종 (빠짐 20종, 새로 들어옴 0종)
  morning-showa-cafe           사용자 선택 3종 → 계획 4종 (빠짐 3종, 새로 들어옴 4종)
  showa-seventies              사용자 선택 4종 → 계획 1종 (빠짐 3종, 새로 들어옴 0종)
  lofi-focus-main              사용자 선택 14종 → 계획 4종 (빠짐 10종, 새로 들어옴 0종)
  ...
채널 34개 — 그대로 1 / 선택이 바뀜 33
```

**34채널 중 33채널**에서 사용자의 장르 선택이 바뀝니다. `morning-showa-cafe`는
고른 3종이 **전부 빠지고** 다른 4종이 들어옵니다. 자동 적용은 §8이 금지한
바로 그 동작이므로 **배선하지 않았습니다.** B-1(미적용 표시)이 이번 조치이며,
사용자는 표를 보고 원할 때 버튼을 누릅니다.

### `check:path-coverage` 미적용 4건

**(a) 컨셉 발성 라우팅 10칸** — tone-match 차단은 해소됐고, 남은 것은
`senior-morning`의 husky/dark, `showa-cafe`의 belted, `showa-70s`의 breathy,
`j2000s`의 husky/dark, `modern-chill`의 belted, `lofi-study`의 belted/husky처럼
**그 아키타입에 해당 계열 프리셋이 0종**인 데이터 공백입니다.
`suitedArchetypes` 배정은 지시문 78 TASK C가 `channelVocalFloor` 충돌을 하나씩
검토하며 한 작업이라, 같은 검토 없이 넓히지 않았습니다 — §8의 A-3(장르 확충을
이번에 하지 말 것)과 같은 이유입니다. `check:path-coverage` 출력이 다음
지시문의 판단 근거로 남습니다.

**(b) 절 단위 중복 14.7%** — 목표(5% 이하) **미달**입니다. 남은 중복은 이번
작업과 무관한, 조립기 원자끼리의 포함 관계입니다.

```
$ npx vitest run --config scripts/audit79/vitest.audit79.config.ts \
    scripts/audit79/c3-dup-debug.audit.ts --reporter=verbose
    66  "full arrangement" ⊂ "full arrangement from the first bar"
     9  "straight 4/4 pop feel" ⊂ "Verse stays in a straight 4/4 pop feel with ..."
     6  "acoustic guitar" ⊂ "Verse stays plainspoken with acoustic guitar and piano"
```

`promptBudget.ts`의 포함 제거 통과가 **비필수 원자끼리만** 비교하기 때문인데,
비교 대상을 전체 원자로 넓히고 필수 원자도 제거하도록 두 단계로 고쳐 봤더니
**0.2%까지 떨어지는 대신** `tests/v380.test.ts`(트랙 2-3 앰비언스 대비),
`tests/v353Diversity.test.ts`(시작 문구 다양성), `tests/seniorBaseline.test.ts`
(프롬프트 길이 대역) 셋이 깨졌습니다. 검증된 동작 셋을 깨면서까지 경고율을
낮출 근거가 없다고 판단해 **되돌렸습니다**. 제대로 고치려면 충돌하는 원자
문구 자체를 다시 써야 하고, 그건 청취 검증이 필요한 별도 작업입니다.

**(c) 인트로 자기모순 11.5%** — 감사가 재지 않았고 이번 검사가 새로 찾은
항목입니다. 원인 조사에 착수하지 못했습니다. 지시문 §3.1의 6건에 포함되지
않아 이번 범위 밖으로 두고, 검사 항목으로 남겨 다음 지시문이 볼 수 있게
했습니다.

### 그 밖에 하지 않은 것

- **`showa-70s` 코어 장르 4종 확충** — §1.3 A-3의 지시대로 하지 않았습니다.
- **컨셉 교집합 0에 감점** — §8대로 걸지 않았습니다(경고만).
- **`forKids` 프리셋·동요 두 아키타입** — 건드리지 않았습니다.
- **브라우저 UI 확인** — Step2Plan/Step2Concept의 새 문구는 코드 수준으로만
  확인했고 실제 브라우저로 렌더해 보지는 못했습니다.

---

## 11. §7-10 — 회귀 항목 전부

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| 컨셉500 매칭률 4종 | 79.6 / 67.4 / 58.8 / 45.0 유지 | **79.9 / 68.0 / 63.8 / 45.7** (수정 전과 동일) | OK |
| `check:concept-coverage` ① | 70/70 (100%) | 70/70 (100%) | OK |
| `check:concept-coverage` ③ | 계절 오배정 0건 | 0건 | OK |
| `check:concept-coverage` ②④ | — | 70/70 · 20/20 | OK |
| `suitablePresetsForArchetype` 성인 7 | 각 8종 이상 | 12 / 10 / 16 / 13 / 8 / 9 / 19 | OK |
| `kr-kids-song` / `jp-kids-song` | 각 10종 무변경 | 10 / 10 | OK |
| `forKids` 프리셋 | 10종 무변경 | 10종 (전체 33종) | OK |
| en-chillhop 코어 장르 | 15종 | 15종 | OK |
| en-chillhop 채널 | 5개 | 5개 | OK |
| en-chillhop 테마 | 70개 | 70개 | OK |
| stylePrompt 평균 단어 수 | 증가 없음 | **104.3 → 104.2** (408곡) | OK |
| 성별 쿼터 (12곡×34채널) | 크게 변하지 않을 것 | 156/171/81 → **157/171/80** (408곡 중 1곡 이동) | OK |
| `check:gates` | — | 통과 81 / 위반 1 (기준선과 동일) | OK |
| 사용자 명시 선택 장르·보컬 | 덮어쓰지 말 것 | B-2 미배선 (§10) | OK |
| 1차 감사 수정 3건 | 되돌리지 말 것 | 건드리지 않음 | OK |

컨셉500 매칭률의 기준값(79.6/67.4/58.8/45.0)과 실측(79.9/68.0/63.8/45.7)이
다른 것은 이번 변경 때문이 아닙니다 — `20ebff5`에서 잰 값이 이미 실측치와
같고, 지시문에 적힌 숫자가 이전 시점의 것입니다. **수정 전후로는 한 자리도
움직이지 않았습니다.**

---

## 12. §7-11 — `npm test` 전체 결과

```
$ npx vitest run
 Test Files  374 passed | 1 skipped (375)
      Tests  4720 passed | 8 skipped (4728)
   Duration  56.97s
```

작업 중 **직접 깨뜨린 테스트 7건**을 전부 원인까지 추적해 처리했습니다.

| 테스트 | 원인 | 처리 |
|---|---|---|
| `v343` | era 바닥 경로까지 건너뛰게 만들어 장르 배정이 바뀜 | 바닥 경로를 A-1 분기에서 제외 |
| `v380` · `v353Diversity` | `applyVocalOnsetPhrasing`이 절 수를 맞추려 **맨 뒤**(공간감 절·듀엣 태그)를 자름 | 프리셋 경로는 정체성 절·마지막 절을 건드리지 않는 교체로 변경 |
| `seniorBaseline` | 교체한 발성 절이 더 짧아 글자 수 감소 | 기준선 재조정(기존 관례대로 사유 명시). 단어 수는 불변 |
| `earwormVariation` | 팩 전체가 프리셋 하나를 쓰면 그 발성도 전 곡 공유 | 기존 "vocal descriptor text" 예외와 같은 범주로 예외 추가 |
| `bpmSectionFloor` ×4 · `promptWasteChecks` ×2 | 대역 잠금이 텍스트 신호만 봐서 하우스 채널이 랩 대역으로 잠김 | 장르 풀을 두 번째 신호로 추가 |
| `v342` | 간주 채우기 태그가 "6-8 섹션" 판정에 함께 셈 | 뼈대와 간주를 구분(74가 명시한 구분), 판정 함수 공유 |

기준선을 고친 2건(`seniorBaseline`, `earwormVariation`)과 판정 범위를 고친
1건(`v342`)은 전부 **의도한 동작 변화의 직접 결과**이며, 사유를 테스트 파일
주석에 남겼습니다(지시문 20·21·65가 같은 기준선을 재조정한 관례 그대로).

---

## 13. 신설·변경 파일

**신설 (src)**
- `core/conceptChannelFit.ts` — 컨셉↔채널 부적합 판정 (A-2)
- `core/enChillhopBand.ts` — en-chillhop 대역 잠금 공통 함수 (C-3)
- `core/instrumentalSectionFill.ts` — BPM 섹션 하한 채우기 (C-3)

**신설 (검사·문서)**
- `docs/generation-paths.md` (C-1)
- `scripts/checkConceptChannelFit.ts` → `check:concept-channel-fit` (A-2)
- `scripts/checkPathCoverage.ts` → `check:path-coverage` (C-2)
- `scripts/audit79/` — 재현 스크립트 10개 + `out/` 전후 출력

**변경 (src)**
- `core/constraints.ts` — A-1 (안전망 후보 복원 · 주 시대 후보 0종 시 건너뜀)
- `core/conceptVocalPlan.ts` — onset 중복 판정, `articulationFamilyForPreset`
- `core/vocalQuotaFromGenre.ts` — `genreSummaryKo` 노출 (계산 불변)
- `core/batchPreallocation.ts` · `core/localGenerator.ts` — 세 공통 함수 배선,
  `explicitWholePackVocalPreset`, `withPresetArticulation`
- `data/conceptKeywords.ts` — 벨팅 키워드 `내지르`
- `components/steps/Step2Concept.tsx` — 부적합 경고 표시, 카드 문구 재조립
- `components/steps/Step2Plan.tsx` — 미적용 표시 (B-1)

`scripts/audit2/`(2차 감사 재현 기준)는 한 글자도 바꾸지 않았고, 재측정에
그대로 재사용했습니다.
