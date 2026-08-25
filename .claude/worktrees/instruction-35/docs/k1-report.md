# TASK K1 — 다장르 합성 엔진: 섹션별 장르 배정 + N-장르 블렌드 · 완료 보고

**성격**: 공유 엔진 확장 (K2/K3의 선행 조건) — 기존 경로 무변경, 새 파일 3개(타입 추가 1 + 신규 파일 2)로만 구현.
**기준 커밋**: `201a4c6` (v4.1 TASK A2) 기준 §0-2 실측, 현재 HEAD(`cf056a9` TASK G2) 이후 실행
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-05

---

## 11-1. 실물 출력

### [1] §8-18 결과 — 다섯 워크스페이스 × 18곡, K1 이전/이후 diff

`good-morning-memory-radio`(senior-oldpop) / `after-work-band-pop`(kr-2030) / `reiwa-way-home-jpop`(jp-2030) / `follow-along-action-song`(kr-kids) / `teasobi-hiroba`(jp-kids) 각 18곡, 총 90곡을 K1 작업 시작 직전과 완료 직후 두 번 생성해 텍스트로 diff했습니다(제목·훅·BPM·스타일 프롬프트·가사 전문 전부 포함).

```
diff k1_before.txt k1_after.txt
→ 출력 없음 (완전히 동일)
```

**"완전히 동일"을 확인했습니다.** `SectionGenrePlan`을 넘기지 않는 기존 다섯 워크스페이스는 K1 작업으로 단 한 글자도 바뀌지 않았습니다.

### [2] 5장르 계획의 구간별 traits 전문

§8의 5·6번 측정 스크립트를 실제 63개 traits 장르 중 5개(`adult-contemporary`/`jazz-pop`/`soft-rock`/`oldpop-motown-pop-soul`/`neo-soul`)로 실행한 결과:

```
검증: [] (§4-2 규칙 위반 없음)

구간 수 5
verse      (adult-contemporary)     harmony 2 ["simple diatonic harmony","gentle pre-chorus lift with no tension chords"]
                                     inst 3 ["clean electric guitar","sustained piano pads","clean strummed acoustic guitar"]
pre-chorus (jazz-pop)                harmony 2 ["ii-V-I turnarounds","maj7/9/13 extended voicings"]
                                     inst 3 ["clean electric guitar","Rhodes comping piano","walking upright bass"]
chorus     (soft-rock)               harmony 2 ["restrained chorus lift","simple I-IV-V-vi movement"]
                                     inst 3 ["clean electric guitar","acoustic guitar","piano"]
bridge     (oldpop-motown-pop-soul)  harmony 2 ["gospel-tinged pop-soul chord color","call-and-response verse-to-backing movement"]
                                     inst 3 ["clean electric guitar","tambourine on all four beats","melodic electric bass"]
outro      (neo-soul)                harmony 2 ["extended seventh and ninth chords","Rhodes voicing movement"]
                                     inst 3 ["clean electric guitar","Rhodes electric piano","live drums"]

spine (chorus="soft-rock"에서 소싱):
  eraTag            "1970s-80s soft rock radio"
  vocalTraits       ["clear adult vocal", "confident but never shouted delivery"]
  productionTraits  ["polished radio arrangement", "clean electric guitars layered evenly with the piano"]
  dynamicRange      "medium"   (5구간 중 최대값 — low/low/medium/medium/medium 중 widest)
  structureTraits   ["verse-chorus form with a guitar solo in the bridge", "chorus repeats the hook with no variation"]
  bpm               104        (soft-rock tempoRange [96,112]의 중앙값)
  sharedInstrument  "clean electric guitar"   (5구간 전부에 존재 확인)

dropped: 0, warnings: []
```

**5구간 각각 harmony 2 / instrumentation 3을 그대로 유지합니다.** §0-2 ②가 실측한 `blendGenreTraits` 체이닝의 "마지막 flavor만 남는" 붕괴가 재현되지 않습니다 — anchor/flavor 순차 덮어쓰기 자체를 쓰지 않고 구간마다 자신의 genre에서 직접 가져오기 때문입니다. `sharedInstrument`("clean electric guitar")가 5구간 인스트루멘테이션 전부에 포함돼 척추가 실제로 관통합니다.

**시대 필터 별도 검증** — 위 5개는 전부 현대 계열이라 필터가 걸리지 않으므로, `chorus`를 1950s-60s `oldpop-doowop-harmony`로 바꾼 별도 실행으로 필터 동작 자체를 확인했습니다:
```
dropped: 1, warnings: ['시대 필터로 악기 1개 제거됨 (chorus 장르 "oldpop-doowop-harmony"의 시대 기준)']
```
(`oldpop-light-synth-pop-warm`의 "soft arpeggiator"가 doo-wop 시대 기준 `synth pad` 금칙어에 걸려 제거됨 — 정상 동작.)

### [3] 수노 확인용 3종 비교안 (§6-3)

**같은 5장르 계획**(verse=adult-contemporary / pre-chorus=jazz-pop / chorus=soft-rock / bridge=oldpop-motown-pop-soul / outro=neo-soul, 그대로 [2]와 동일)을 실제 시니어 채널에서 방금 재생성한 곡 1곡(`good-morning-memory-radio` 1번 트랙 "Breathe with Me, Morning" — 새 가사를 짓지 않고 §0-1 원칙대로 이미 검증된 실제 출력을 그대로 재사용)에 적용해 세 가지 형태를 만들었습니다.

**형태 A — 스타일 프롬프트에 구간 서술**:
```
male falsetto-leaning tenor, gentle swung phrasing, airy breath-forward tone, chamber ambience,
warm conversational lead delivery, gentle unhurried phrasing throughout, clear unhurried diction,
straight 4/4 pop feel, simple diatonic harmony, clean strummed acoustic, almost no reverb on the
lead vocal, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed
acoustic, pre-chorus adds simple diatonic lift without swing or solo, I-vi-IV-V doo-wop progression,
no instrumental intro, hook heard immediately, 3:10-3:35, hook repeats 4x, doubled hook harmony,
warm adult contemporary pop, sustained piano pads, straight-pop drum kit, warm analog studio sound,
acoustic instruments carry the arrangement, narrow warm stereo image, balanced small-combo
arrangement, two voices enter in harmony immediately, full arrangement from the first bar,
nostalgic, 87 BPM, spine: clear adult vocal, confident but never shouted delivery, polished radio
arrangement, clean electric guitars layered evenly with the piano, 104 BPM, 1970s-80s soft rock
radio, section map: verse sustained piano pads; pre-chorus Rhodes comping piano; chorus acoustic
guitar; bridge tambourine on all four beats; outro returns to verse texture
```
가사는 원본 그대로(태그 미변경).

**형태 B — 가사 섹션 태그 확장** (스타일 프롬프트는 원본 그대로, 구간 서술 없음):
```
[verse 1 - sustained piano pads, simple diatonic harmony]
The Christmas light is resting
on the table by the door

[pre-chorus - Rhodes comping piano, ii-V-I turnarounds]
I feel it rising soft and slow
right before I say

[chorus - acoustic guitar, restrained chorus lift]
calm no matter what
...

[short bridge - tambourine on all four beats, gospel-tinged pop-soul chord color]
Some songs keep their color
...

[final chorus - returns to opening texture]
Breathe with Me, Morning
...
```
(verse 2와 반복되는 chorus도 동일 태그로 전부 주석됨 — 전문은 부록 스크립트 출력 참조.)

**형태 C** — A의 스타일 프롬프트 + B의 가사 태그를 동시에 사용.

세 형태의 전체 텍스트는 다음 위치에 저장돼 있고, 재생성하려면 스크립트를 다시 실행하면 됩니다(아래 [6] 참조):
`C:\Users\user\AppData\Local\Temp\claude\D--suno-suno-current\87615679-6f85-4964-be14-bd71d638bd4c\scratchpad\k1_formats_output.txt`

**하루 님이 세 형태를 그대로 복사해 수노에 넣고 비교해 주셔야 합니다** — §6-3이 명시한 대로 이건 코드로 검증할 수 없습니다. 확인할 것: (1) 실제로 구간마다 악기/화성이 달라지게 들리는가, (2) 아니면 전곡에 평균적으로 적용되는가, (3) 형태 A/B/C 중 어느 쪽이 더 잘 반영되는가.

### [4] 프롬프트 길이 측정 — 여유가 없다는 §2-1의 우려가 실측으로 확인됨

```
기존 시니어 스타일 프롬프트 (베이스, 변경 없음)   884자
구간 서술(section map) 부분                      152자 (목표 ≤200 충족 — 2단계 압축 중 1단계에서 이미 충족)
spine 서술 부분                                  약 97자
전체 프롬프트 (베이스 + spine + section map)      1,233자
```

**목표 650자는커녕 하드 리밋 1,000자도 넘습니다.** 원인은 K1이 만든 구간 서술 자체가 아니라 — 그쪽은 152자로 목표 이내입니다 — **베이스 스타일 프롬프트 자체가 이미 884자(하드 리밋 대비 여유 116자)이기 때문입니다.** §2-1이 우려한 "여유 157자"보다 실제로는 더 타이트한 상황(이 곡은 84자 더 김)이 실측으로 확인됐습니다.

**이건 K1이 고칠 수 없는 문제입니다** — 베이스 프롬프트는 기존 채널의 기존 조립 로직(promptComposer.ts, 손대지 않음) 산출물입니다. K2/K3가 실제로 이 엔진을 쓰려면 다음 중 하나가 필요합니다(결정 대기, §11-4[E]):
```
(a) 구간 서술을 넣는 대신 베이스 프롬프트 자체의 boilerplate 절(예: "hook repeats 4x, doubled hook harmony"
    같은 표준구)을 줄여 자리를 만든다
(b) 압축 단계를 하나 더 추가한다(section map을 1단계 더 축약 — instrument만 남기고 label도 약어화)
(c) 구간 서술을 스타일 프롬프트가 아니라 가사 섹션 태그(형태 B)로만 보낸다 — 이쪽은 베이스 프롬프트
    길이에 전혀 영향을 주지 않음
```
(c)가 자리 문제만 놓고 보면 가장 안전하지만, §6-3의 실제 청취 결과(수노가 어느 채널을 실제로 읽는지)가 나오기 전까지는 어느 쪽이 맞는지 판단할 수 없습니다.

### [5] 시니어 18곡 재생성 + §9-1 다섯 수치

`[1]`의 diff가 "완전히 동일"이므로 시니어 수치는 K1 이전(G2 종료 시점, `docs/g2-report.md` §11-1[1])과 정확히 같습니다:

```
프롬프트 길이 min/avg/max      667-797-982자
쌍별 유사도 avg/max            0.104 / 0.483
BPM 범위(표준편차)             63-112 (14.41)
고유 제목                      18/18
```

**K1 문서 §9-1 자체가 예시로 든 수치(0.202/0.594/11.50/560-732-843)와 다릅니다** — G1이 `tests/seniorBaseline.test.ts`를 만들 때 이미 §5-1 도입부에 남긴 것과 같은 종류의 사실입니다: "이 문서가 참고한 예시값이 아니라 이 커밋 시점에 실제로 measure한 값"이며, 예시값 자체가 이전 세션의 다른 생성 옵션(테스트 픽스처의 seed/시즌 조합이 다름)에서 나온 것으로 보입니다. **진짜 회귀 게이트는 예시 숫자가 아니라 `tests/seniorBaseline.test.ts`(14/14 PASS, 무변경)와 `[1]`의 완전 동일 diff입니다** — 둘 다 통과했습니다.

### [6] `git diff --stat` 전문

```
 docs/STRESS_TEST_REPORT.md | 50 ++++++++++++++++++++++++++++------------------
 src/types.ts               | 42 ++++++++++++++++++++++++++++++++++++++
 2 files changed, 73 insertions(+), 19 deletions(-)

신규 파일(untracked):
 src/core/sectionGenrePlan.ts          (157줄)
 src/core/sectionGenrePromptFormats.ts (128줄)
```

`src/types.ts`의 변경은 **전부 추가**입니다 — `git diff -U0 src/types.ts`에 삭제(`-`) 줄이 0건입니다(새 인터페이스 3개, `SectionGenrePlan`/`SectionGenreSlot`/`SpineTraits`, 기존 `MoodPack` 인터페이스 앞에 삽입). `docs/STRESS_TEST_REPORT.md`는 `tests/stress.test.ts` 실행이 매번 자동 재생성하는 파일입니다(파일 자체 주석에 명시) — F1/G2와 동일하게 `npx vitest run`의 부수 효과이며 수동 편집이 아닙니다.

**`core/genreBlend.ts` / `core/setDirector.ts` / `core/promptComposer.ts`는 git diff에 전혀 나타나지 않습니다** — 세 파일 모두 이번 작업에서 단 한 줄도 열지 않았습니다(읽기조차 §0-2 확인 목적으로만 했고 편집은 하지 않았습니다).

---

## 11-2. §8 완료 판정 수치표

| # | 항목 | 기준 | 현재값 | 완료값 |
|---|---|---|---|---|
| 1 | `SectionGenrePlan` / `SectionGenreSlot` 타입 신설 | 있음 | 없음 | **있음** (`src/types.ts`, `SpineTraits`도 함께 신설) |
| 2 | `core/sectionGenrePlan.ts` 신설 | 있음 | 없음 | **있음** (157줄, `composeSectionGenres`/`validateSectionGenrePlan`) |
| 3 | 지원하는 서로 다른 장르 수 | 3–6 | 2 | **3–6** (검증 함수로 강제, §11-1[2]에서 5개로 확인) |
| 4 | 구간 수 | 4–6 | 1 | **4–6** (검증 함수로 강제, §11-1[2]에서 5개로 확인) |
| 5 | 5장르 계획에서 살아남는 harmony 축 | 5구간 각각 | 1 | **5구간 각각 2개씩 (§11-1[2])** |
| 6 | 5장르 계획에서 살아남는 instrumentation | 구간당 3 | 4 (전곡 1개) | **구간당 3 (§11-1[2])** |
| 7 | 척추 축(BPM/보컬/프로덕션) 전 구간 동일 | 100% | — | **100% (spine 객체 자체가 전 구간 공유, §11-1[2])** |
| 8 | `dynamicRange` 선택 | 넓은 쪽 | 좁은 쪽 | **넓은 쪽 (`widerDynamicRange`, `lowerDynamicRange`와 별개 함수)** |
| 9 | 시대 필터 적용 | 적용됨 | — | **적용됨 (§11-1[2] doo-wop 예시로 실제 동작 확인, dropped=1)** |
| 10 | 구간 서술 길이 | ≤200자 | — | **152자 (§11-1[4], 2단계 압축 중 1단계로 충족)** |
| 11 | 전체 프롬프트 길이 | 목표 650 / 하드 1,000 | 560–843 | **1,233자 — 하드 리밋 초과 (§11-1[4], 원인은 베이스 프롬프트 자체가 이미 884자)** |
| 12 | 같은 장르 연속 3구간 | 0건 | — | **0건 (`validateSectionGenrePlan`이 검사, §11-1[2] 예시는 위반 없음)** |
| 13 | chorus `presence: 'primary'` | 100% | — | **100% (검증 함수가 강제)** |
| 14 | 18곡 세트 transition 분포 | §7 기준 | — | **미구현 — K1은 엔진만 만들었고, 실제 18곡 세트에 배분하는 것은 K2/K3의 몫(§11-3)** |
| 15 | `blendGenreTraits` 본문·시그니처 | 불변 | — | **불변 (git diff에 파일 자체가 없음)** |
| 16 | `lowerDynamicRange` | 불변 | — | **불변 (git diff에 파일 자체가 없음, 새 `widerDynamicRange` 별도 함수)** |
| 17 | `setDirector.ts` 호출부 | 불변 | — | **불변 (git diff에 파일 자체가 없음)** |
| 18 | 계획 미지정 시 기존 경로 동작 | 100% 동일 | — | **100% 동일 — 다섯 워크스페이스 90곡 전문 diff 결과 없음 (§11-1[1])** |
| 19 | 수노 형태 A/B/C 비교안 제시 | 3종 | 0 | **3종 제시, 하루 확인 대기 (§11-1[3], §11-4[A])** |
| 20 | 시니어 18곡 5개 수치 | 기준선 유지 | — | **유지 (§11-1[1] 동일 diff로 확인, §11-1[5])** |
| 21 | kr-2030/jp-2030/동요 18곡 | 완료값 유지 | — | **유지 (§11-1[1] 동일 diff로 확인)** |
| 22 | `npm run audit:isolation` | 변화 없음 | — | **변화 없음 (PASS 39/FAIL 3/SKIP 17, G2 종료 시점과 동일)** |
| 23 | `npm test` 전체 통과 | 통과 | — | **통과 (2117/2117, 0 flaky 발동)** |
| 24 | `git diff` 상 기존 행 수정·삭제 | 0건 | — | **0건 (`src/types.ts`는 전부 추가, `docs/STRESS_TEST_REPORT.md`는 자동 재생성 — §11-1[6])** |

---

## 11-3. 미구현 항목

- **§8-14 (transition 분포)**: `SectionGenrePlan.transition` 타입과 `composeSectionGenres`가 이 값을 받긴 하지만(현재는 스펙에만 존재하고 합성 로직에 실질적으로 사용되지 않음 — hard-cut/ramp/shared-spine에 따른 실제 텍스트 차이는 만들지 않았습니다), 18곡 세트 안에서 이 값을 어떻게 배분할지(§7의 10곡/4곡/4곡 분포)는 **K1의 몫이 아니라 실제 아이돌 채널이 세트를 만드는 K2/K3의 몫**입니다. K1은 엔진(단일 플랜을 traits로 바꾸는 함수)만 만들었습니다.
- **§8-19의 최종 판정**: 형태 A/B/C 비교안은 만들었지만, 하루 님의 실제 청취 결과가 아직 없습니다 — §11-4[A]에 남깁니다.
- **`transition`이 실제 프롬프트/가사 텍스트에 반영되는 로직**: 타입은 있지만 `sectionGenrePromptFormats.ts`의 렌더러가 아직 `hard-cut`과 `shared-spine`을 다르게 표현하지 않습니다(현재는 항상 shared-spine 스타일로 렌더링). 형태 A/B/C 비교 결과가 나오기 전에 §7 자체를 확정하지 말라는 §6-4의 지시에 따라 의도적으로 미룬 것입니다.

## 11-4. 결정 대기 항목

### [A] 수노 구간 지시 인식 여부 (§6-3) — **하루 님 실제 테스트 필요**

§11-1[3]의 형태 A/B/C를 실제로 수노에 넣어 비교해 주셔야 합니다. 결과에 따라:
- **반영됨** → §4~§5 그대로 K2/K3에서 사용.
- **무시됨** → "구간별 장르 배정" 대신 "대비가 큰 단일 서술"(예: `restrained verses that explode into a rock chorus`)로 K1의 접근 자체를 재설계해야 합니다.

### [B] 섹션 이름 정의의 소유권 (§3-1) — A3와 조율 필요

`SectionGenreSlot.sectionId`는 지금 자유 문자열입니다(`'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro'`를 주석으로만 권장). A3가 `structureTemplateSetId`로 섹션 목록/순서를 확정하면 K1의 `sectionId` 값이 거기 맞춰 바뀔 수 있습니다 — 지금은 A3 문서가 없어 임시로 K-pop 전형 5구간 이름을 그대로 썼습니다.

### [C] transition 분포 기준 (§7) — K1이 정한 값, 청취 후 조정 대상

`shared-spine ≥10 / ramp ≤4 / hard-cut ≤4`(18곡 기준)는 K1이 문서 §7에서 그대로 가져온 값입니다. 실제 구현·청취 없이는 검증 불가.

### [D] 구간 상한 6 (§4-2) — K1이 정한 값

`validateSectionGenrePlan`이 강제하는 상한입니다. §2-1의 "여유 157자"보다 더 타이트하다는 §11-1[4]의 실측을 고려하면, 실제로는 6개보다 훨씬 적은 구간 수(3-4개)만 프롬프트 예산 안에 들어갈 가능성이 있습니다 — §11-4[A]의 청취 결과가 나온 뒤 재검토가 필요합니다.

### [E] 프롬프트 자리 확보 방법 (§11-1[4]에서 새로 발견) — 하루 님 판단 필요

베이스 스타일 프롬프트 자체가 이미 884자라 구간 서술을 얹을 자리가 거의 없습니다. §11-1[4]가 제시한 세 가지 대안((a) 기존 boilerplate 절 축소 (b) 압축 단계 추가 (c) 가사 태그로만 전달) 중 어느 쪽으로 갈지는 §11-4[A]의 청취 결과와 함께 판단해야 합니다.

## 11-5. K2 / K3로 넘길 항목

```
아이돌 장르에 필요한 traits 축의 특징
  K1은 기존 63개 traits 장르로만 검증했습니다 — 아이돌 특유의 質감(트랩 하이햇,
  베이스드롭, 훵크 슬랩 베이스 등)은 K2/K3가 채워야 합니다.

구간 계획의 프리셋 (K-pop 전형 구조 몇 종)
  K1은 verse/pre-chorus/chorus/bridge/outro 5구간 1개 예시만 검증했습니다.
  실제 K-pop 곡 구조 프리셋(예: "덥스텝 브레이크 포함형", "랩 벌스형" 등) 몇 종을
  SectionGenrePlan 값으로 미리 만들어 두는 것은 K2/K3의 몫입니다.

실존 그룹 모방 위험 (§12 "실존 그룹 모방" 절)
  K1은 이 문제를 다루지 않았습니다 — 문서 자신의 지시대로입니다.
  K2/K3가 별도 절을 두어야 합니다.

transition 분포/구간 상한 실전 배선
  §11-3/§11-4[C][D] — K1은 값만 제안했고 실제 18곡 세트에 적용하지 않았습니다.
```

---

## 12. G1 / G2 재실행 필요성 — 이번엔 해당 없음

K1 문서 §12는 K2/K3 이후 "워크스페이스 7개"를 대상으로 G1/G2를 재실행하라고 안내합니다. **K1 자신은 워크스페이스를 추가하지 않았으므로**(§3-3: "K1이 만드는 것은 옵트인 경로"), 이번 문서에서는 전체 재실행 대신 `npm run audit:isolation`을 K1 종료 시점에 1회 확인(§9 판정표 22번, 변화 없음)하는 것으로 충분했습니다. K2/K3가 실제로 워크스페이스 2개(`WorkspaceId` 5→7, `ChannelArchetype` 14→16)를 추가할 때 G1/G2를 다시 돌려야 합니다.
