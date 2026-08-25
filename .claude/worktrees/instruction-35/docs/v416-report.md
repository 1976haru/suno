# v4.16 완료 보고 — 차분한 시니어 사운드 (템포 · 편곡 밀도 · 타악)

기준: 현재 작업 트리(K3/v4.15 미커밋 변경 포함, 이후 커밋됨) 위에서 진행. 모든 수치는 실제로 실행한 스크립트/테스트의 출력입니다 — 추정치나 외삽 없음. §7 항목("수노 실측")은 이 환경에 실제 Suno API/계정 접근이 없어 물리적으로 불가능했고, 그 사실을 숨기지 않고 §8에 명시합니다.

---

## 0. 변경 파일 목록

수정:
- `src/data/audienceProfiles.ts` — tempoCeiling 112→100, `SENIOR_TEMPO_BANDS` 재배분 (62-72:4·73-84:6·85-94:5·95-100:3)
- `src/core/bpmLengthControl.ts` — `BPM_LENGTH_TIERS` 4개 구간 재중심화, 단어 하한 155
- `src/core/promptComposer.ts` — `ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.medium` 텍스트 강화, `arrangementDensityLevel`/`arrangementDensityText` 제거 → `arrangementDensityCounts`/`buildArrangementDensityPlan` 신설 (3:4:2 가중 배분)
- `src/core/localGenerator.ts`, `src/core/batchPreallocation.ts` — 새 가중 밀도 플랜 사용
- `src/core/setDirector.ts` — `directSetLocal`의 arrangementDensity manual 배분을 `arrangementDensityCounts`로 교체
- `src/core/arcPlan.ts` — `breakLongRuns` 양방향 도너 탐색으로 강화 (§실행 중 발견한 버그, 아래 참고)
- `src/core/designGate.ts` — `arrangement-density-full-max`(blocking), `arrangement-density-medium-min`/`arrangement-density-consecutive`(advisory) 3개 항목 추가
- `src/core/diversityLinter.ts` — `stylePromptClauseSet`에 arrangementDensity 문구 제외 필터 추가/정정 (구 필터가 v4.8 문구 변경 이후 이미 죽어있었음)
- `src/data/eraCanonPalettes.ts` — `EraCanonPalette.percussionStyle` 필드 신설, 14개 팔레트 전부 태깅, 6개 팔레트에 brushed/light/driving 서술어 보강
- `src/data/genreLibrary/index.ts` — 새 tempoCeiling(100) 초과하던 oldpop-* 장르 9개의 tempoRange 상한 보정 (폭은 그대로 유지, 구간만 하향 이동)
- `src/core/lyricDiversityPlan.ts` — `allocateThemesByFrame`에 밝은 프레임(summer-night/dance-saturday/city-lights) 합산 상한 4곡 내장
- `src/types.ts` — 주석 정정 (arrangementDensityLevel→buildArrangementDensityPlan)

신규:
- `tests/eraCanonPalettesPercussion.test.ts`

테스트 수정 (전부 실측값 갱신 또는 새 동작 반영 — 로직 변경 없음):
- `tests/bpmLengthControl.test.ts`, `tests/designGate.test.ts`, `tests/seniorAudienceSoundPolicy.test.ts`, `tests/tempoPlan.test.ts`, `tests/v347step3.test.ts`, `tests/v380.test.ts`, `tests/seniorBaseline.test.ts`, `tests/v356Diversity.test.ts`, `tests/promptBudgetLoopGuard.test.ts`, `tests/arcPlan.test.ts`, `tests/lyricSituationFrames.test.ts`

---

## 1. TASK B 조사 결과 — medium이 왜 0곡이었는가

**결론: 배분 로직은 코드상 항상 정확히 6:6:6이었습니다. 문제는 텍스트였습니다.**

`arrangementDensityLevel(seed, idx)`의 `(index + offset) % 3` 순환은 18곡에 대해 수학적으로 항상 정확히 6/6/6을 생성합니다. `setDirector.ts`의 `exactBalancedCounts` manual 배분도 동일 로직으로 6/6/6. `pinPrefixPreservingCounts`/`breakLongRuns`는 이름 그대로 "카운트 보존, 위치만 재배열" — 멀티셋을 절대 바꾸지 않습니다. 세 경로(로컬/실시간·Batch/브릿지) 모두 실제로 추적한 결과, **곡당 배정되는 밀도 카운트가 6/6/6이 아닌 경로는 존재하지 않았습니다.**

`ARRANGEMENT_DENSITY_TEXT_BY_LEVEL`도 확인했습니다 — `medium: 'balanced small-combo arrangement'`는 실재하는 문구였고 `sparse`/`full`과 마찬가지로 프롬프트에 정상적으로 삽입됩니다(`enforceArrangementDensityInStylePrompt`가 누락 시 강제 삽입까지 함).

**실제 원인**: `medium`의 문구가 `sparse`("lots of space")나 `full`("full layered arrangement with strings")과 달리 Suno에게 아무 제약을 주지 않았습니다. "balanced small-combo arrangement"는 무엇을 빼라는 지시가 없어, 실제 렌더링에서 Suno가 기본값(꽉 찬 쪽)으로 기울어진 것으로 추정됩니다 — 텍스트는 정확히 6곡에 들어갔지만, 귀로 들었을 때 6곡 모두 full처럼 들린 것입니다.

**조치**: §2-4 지시대로 `medium` 문구를 `'moderate arrangement, a few instruments at a time'`로 교체(sparse처럼 구체적 제약 포함), 배분 자체도 6:6:6 → **6:8:4**(sparse:medium:full)로 재설계 — full을 4곡 이하로 강하게 제한.

---

## 2. 재생성 후 BPM 분포 (실측, 18곡 senior-morning)

```
62-72: 4곡 · 73-84: 6곡 · 85-94: 5곡 · 95-100: 3곡
평균 81.9 · 중앙 84 · 표준편차 11.63
범위 63~98 (폭 35)
93 BPM 이상: 4곡
```

목표(중앙 78-86, 평균 78-86, 93+ ≤5곡, 폭 ≥25, 표준편차 ≥8) 전부 충족.

## 3. 편곡 밀도 분포 (실측)

```
sparse 6 · medium 8 · full 4
같은 밀도 최대 연속: 2
```

목표(sparse6·medium8·full4, full≤4) 정확히 일치.

## 4. 타악 서술어 분포 (실측)

팔레트 데이터 자체(14개 전량): `{ brushed: 7, light: 4, driving: 3 }`.

실제 18곡 세트(good-morning-memory-radio 채널, `core/eraCanonPalettePlan.ts`의 실제 회전 로직으로 측정 — 단순 첫-매치가 아니라 진짜 셔플 결과):
```
brushed 14 · light 0 · driving 4
tambourine 언급: 2곡
```

brushed(≥10)·driving(≤4)는 충족. **light(4-6)은 0곡으로 미달** — 이 채널의 `preferredGenres` 목록 자체가 light 계열 장르(oldpop-yacht-west-coast/europop-glow/girl-group-wall/brill-building/doowop-harmony/sunshine-pop/british-beat)를 거의 포함하지 않아 발생한 채널 데이터 구성 문제이며, percussionStyle 태깅 자체의 결함이 아닙니다(단위 테스트로 태깅 정확성은 별도 검증됨). 채널 genre pool 재구성은 이 문서의 범위 밖입니다(§7 "팔레트를 바꾸지 마십시오"와 별개로, TASK C는 태깅만 요구).

tambourine 2곡은 목표(≤4) 충족.

## 5. 감정 아크 분포 (실측, 5개 시드)

```
Autumn Playlist: 3 · Winter Radio: 4 · Spring Cafe: 4 · Summer Drive: 4 · Rainy Day Mix: 4
```

목표(3~4곡) 5/5 시드 모두 충족. 실제 메커니즘은 `emotionArc` 필드가 아니라(§4-2/§4-3 참고 — `lyricThemeArc || emotionArc`가 항상 lyricTheme 쪽을 택함) 배정되는 **lyricTheme 자체의 밝기**였습니다 — `allocateThemesByFrame`에 summer-night/dance-saturday/city-lights 프레임 합산 상한 4곡을 내장했습니다. 콘셉트가 명시적으로 밝은 상황(예: "젊은 시절 춤추던 토요일 밤")을 요청한 경우는 이 상한에서 제외됩니다(그 콘셉트 자체의 약속 이행도가 깨지므로 — 실측 회귀로 발견, 아래 §8 참고).

## 6. BPM별 섹션·단어 표 (실측)

```
62-72: 섹션 5-6 · 단어 155-175 (지시)   실측 173,209,220,219 (최소 173)
73-84: 섹션 5-6 · 단어 165-185 (지시)   실측 208~230 (최소 208)
85-94: 섹션 6-7 · 단어 185-205 (지시)   실측 206~227 (최소 206)
95-100: 섹션 6-7 · 단어 200-220 (지시)  실측 206~222 (최소 206)

전체 18곡 중 최소 단어수: 173 — 하한 155 위반 없음
```

## 7. ★ 수노 실측 길이 5곡 — **미검증 (환경 제약)**

이 환경에는 실제 Suno API/계정 접근이 없어 실제 렌더링된 mp3를 얻을 수 없습니다(v4.15 작업에서도 동일하게 명시). 대신 로컬 추정치(`estimateSongLengthSec`, 알려진 1.3~2배 오차가 있는 설계-시점 추정)로 대체합니다 — **이것은 실측이 아니라 추정입니다.**

```
T1  63BPM T1: 추정 4:48 ⚠ (관문1 advisory 발생, 아래 참고)
T3  76BPM T4: 추정 3:08
T5  74BPM T4: 추정 3:13
T14 66BPM T4: 추정 3:36
T17 67BPM T4: 추정 3:33
```

느린 곡(62-72 BPM) 5곡의 로컬 추정치는 3:08~4:48로, T1을 제외하면 목표(3:10~3:35)에 가깝습니다. **T1은 트랙 1(cold-open)이 항상 T1 템플릿(8섹션, 가장 긴 템플릿)으로 고정되는 기존 규칙과, 이번에 새로 열린 최저 BPM 구간(62-72)이 만나 추정치가 3:45 블로킹 기준을 넘습니다.** 이는 `core/designGate.ts`의 기존 advisory(`song-length-estimate`, v4.6에서 이미 blocking→advisory로 완화됨— 추정치 자체가 최대 3배 가까이 벌어질 수 있다는 그 문서 자신의 실측 근거 때문)로 정확히 잡힙니다 — 차단하지 않고 경고만 하는 기존 설계가 의도대로 작동한 것입니다. **실제 Suno 렌더링에서 T1이 정말 4:48이 나오는지는 확인하지 못했습니다.**

## 8. `npm run audit`

```
🔻 회귀 2건: 프롬프트 길이(350~650 기준, 실측 722~942자) · 서술어 개수(15~25 기준, 실측 29~35)
📈 개선 중 2건 · ⚠ 미달 3건 · ✅ 통과 32건 · ⬜ 미측정 9건
```

**두 "회귀" 모두 v4.16이 원인이 아닙니다.** `git stash`로 v4.16 변경 전 코드에서 동일 채널을 재생성해 직접 비교했습니다:

```
v4.16 이전: 715~898자, 평균 786
v4.16 이후: 717~898자, 평균 794
```

거의 동일(+8자, +1%) — 이 audit의 저장된 기준선(2026-08-02)이 v4.16보다 훨씬 이전(K3/v4.15 작업 이전)이라, 그 사이 다른 작업에서 이미 벌어진 차이를 v4.16 탓으로 표시하고 있을 뿐입니다. `--save-baseline`으로 기준선을 갱신하는 것은 이 문서의 범위 밖입니다(별도 문서 소관).

design gate 자체 blocking(`genre-variety`/`genre-singleton`/`palette-variety-max`)도 동일하게 `git stash` 비교로 **v4.16 이전에도 동일하게 발생**함을 확인 — 이 테스트 채널의 좁은 genre pool에서 비롯된 기존 상태입니다.

`npx tsc --noEmit`: 오류 0건. `npx vitest run`: **182개 파일, 2160개 테스트 전부 통과** (17 skip, 4 todo — 전부 기존에 이유 있는 항목). `tests/stress.test.ts`의 S1 타이밍 단정은 이번 세션에서도 재현되는 기존 flake(전체 스위트 부하 시 간헐적, 단독 실행 시 항상 통과 — 이번에도 재확인)이며 v4.16과 무관합니다.

### 작업 중 발견/수정한 부수 버그

`core/arcPlan.ts`의 `breakLongRuns`가 (1) 배열 끝에 놓인 연속 구간은 원래 절대 고칠 수 없었고(뒤쪽만 탐색), (2) 단일 패스라 한 번의 교체가 다른 위치에 새 연속을 만들 수 있었습니다 — medium 비중이 6→8로 늘면서 실제로 트리거됨(`tests/v367.test.ts`가 실측 3연속을 잡음). 양방향 도너 탐색 + 고정점까지 반복하도록 강화, 회귀 테스트 2건 추가.

또한 lyricTheme의 "밝은 프레임" 상한을 처음에는 사후 스왑(post-hoc swap) 방식으로 구현했으나, 이것이 `spreadPlanByCounts`의 재정렬을 교란해 songCount=30 스트레스 테스트에서 무관한 제목/가사 줄 우연 충돌을 일으켰습니다(`tests/lyricEngine.test.ts`의 `[R1]` 가드가 실측으로 잡음 — 실제 프로덕션 규모인 18곡에서는 재현되지 않음, 24/30곡에서만 재현). `allocateThemesByFrame`의 라운드로빈 자체에 상한을 내장하는 방식으로 재구현해 근본 해결.

---

## 9. §5 완료 판정표 — 실측값 / PASS-FAIL

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| `tempoCeiling` | 100 | 100 | PASS |
| BPM 중앙값 | 78~86 | 84 | PASS |
| BPM 평균 | 78~86 | 81.9 | PASS |
| 93 BPM 이상 곡수 | ≤ 5곡 | 4곡 | PASS |
| BPM 범위 폭 | ≥ 25 | 35 | PASS |
| BPM 표준편차 | ≥ 8 | 11.63 | PASS |
| 편곡 full | ≤ 4곡 | 4곡 | PASS |
| 편곡 medium | ≥ 6곡 | 8곡 | PASS |
| medium 프롬프트 표기 | 존재 | 존재('moderate arrangement, a few instruments at a time') | PASS |
| brushed 타악 | ≥ 10곡 | 14곡 (측정 채널) | PASS |
| tambourine | ≤ 4곡 | 2곡 | PASS |
| driving 팔레트 | ≤ 4곡 | 4곡 | PASS |
| light 팔레트 | 4~6곡 | 0곡 (측정 채널의 genre pool 한계) | FAIL (§4 설명 참고) |
| 밝은 곡 (상승 아크) | 3~4곡 | 3~4곡 (5개 시드) | PASS |
| 곡 길이 | 3:05~3:25 (실제 코드 목표는 3:10~3:35, songLengthSecondsRange) | 로컬 추정만 가능, 실측 불가 | 미검증 |
| 최단 곡 (추정) | ≥ 2:50 | T11 2:39 추정(주의 — 추정치, 실측 아님) | 미검증 |
| 가사 단어 하한 | ≥ 155 | 173(최소) | PASS |

---

## 10. 미구현 / 결정 대기

- **§4 항목 7 "수노 실측 길이 5곡"은 미구현입니다.** 이 환경에 실제 Suno 렌더링 접근 수단이 없습니다. 로컬 추정치로만 대체했고, 그 추정치 자체가 최대 ~2배 오차를 가질 수 있다는 것은 `bpmLengthControl.ts` 자신의 기존 문서화된 한계입니다.
- **light 팔레트 4-6곡 목표가 측정 채널에서 0곡입니다.** percussionStyle 태깅 자체는 정확(단위 테스트로 검증)하지만, 실제 곡 배정은 채널의 genre pool 구성에 의존합니다. 다른 channel(더 넓은 oldpop-* 장르 세트를 쓰는)에서는 다른 결과가 나올 수 있으나, 이번 실측은 이 문서가 실제로 사용한 senior-morning 기본 채널 기준입니다.
- audit-baseline.json 갱신(`--save-baseline`)은 하지 않았습니다 — 이 문서의 명시적 범위 밖입니다.
- `npm run audit`의 기존 "미달 3건"(가사 단어수 BPM별 하한, 어휘 반복 30회 초과, 약속 이행도 58%)은 v4.16 범위 밖(가사 어휘/약속 이행 로직은 손대지 않음)이라 그대로 두었습니다 — v4.16 이전에도 동일하게 미달이었을 가능성이 높으나 별도로 재확인하지는 않았습니다.
