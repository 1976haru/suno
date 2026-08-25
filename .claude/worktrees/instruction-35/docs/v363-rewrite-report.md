# v3.63 (재작성) 완료 보고 — SetDirector: 2단계 해석과 세그먼트

기준: v3.65(장르 특성 분해/매칭 엔진, 커밋 완료) 이후 진행. 이 문서는 이전 두 개의 v3.63 초안을 대체하는 "재작성" 스펙 전체(TASK A~D)의 완료 보고입니다.
변경 파일: `src/core/setDirector.ts`(+602/-3), `src/core/bridgeInstruction.ts`(+69), `src/components/steps/Step2Plan.tsx`(+72), `tests/bridgeSetPlanHandoff.test.ts`(+63), 신규 `tests/setDirectorSegments.test.ts`(16개 테스트), 신규 `tests/step2PlanSegmentOrder.test.ts`(2개 테스트).

---

## 0. TASK A — oldpop-lounge 아키타입 (검증만)

코드를 직접 읽어 확인한 결과 `oldpop-lounge` 아키타입, `archetypeChoices`/`ChannelArchetype` 등록, 60종 이상 핵심 장르, `applyArchetype`의 확인-후-리셋 안전장치, `senior-morning`의 40종 노출, `searchExtendedGenres` UI가 **이미 이전 v3.63 작업에서 구현되어 있었습니다.** 이번 재작성에서 추가로 손댄 부분은 없습니다(§2에 `getVisibleGenresForArchetype('oldpop-lounge')` 실측 전문 첨부).

---

## 1. TASK B — 5개 테스트 입력 실측 (2단계 해석 + SetPlan 전문)

모두 `directSetLocal`(로컬 규칙 경로)로 실제 실행한 결과이며, 조작하거나 손으로 작성한 값이 아닙니다. (`directSet`의 실제 LLM 왕복은 §7에서 별도로 다룹니다.)

### 입력 A — 멀티 아티스트 세그먼트: `"카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘"`

```json
{
  "intentKo": "카펜터스풍 + 아바풍 18곡 세트로 해석했습니다.",
  "eraFocus": ["early-1970s soft adult-contemporary pop", "late-1970s European disco pop"],
  "reasoningKo": [
    "자유 입력에서 서로 다른 참조 2개(카펜터스, 아바)를 감지해 세그먼트로 분리했습니다.",
    "곡 수는 9+9로 배분했습니다(입력에 곡 수 표현이 없으면 균등 분배).",
    "별도 청취 상황 지정은 없었습니다.",
    "아티스트명은 프롬프트에 넣지 않고 음악 특성으로만 분해했습니다."
  ],
  "unknownTermsKo": [],
  "listeningContext": { "settingKo": "특별한 청취 상황 지정 없음", "dynamicCeiling": "wide", "extraExclusions": [] }
}
```

세그먼트(2개, 9+9):
- **카펜터스풍** (9곡): `oldpop-soft-rock-am`, `oldpop-hearth-acoustic`, `adult-contemporary`, `oldpop-warm-morning-glow` — descriptors: lush orchestral strings / soft electric piano / rich extended major-seventh chords / gentle key change into the final chorus
- **아바풍** (9곡): `oldpop-europop-glow`, `oldpop-light-synth-pop-warm`, `oldpop-brill-building`, `oldpop-motown-pop-soul` — descriptors: bright analog synth pad / four-on-the-floor bass / major-key anthemic chorus lift / minor-to-major verse-to-chorus shift

8축 allocations (실측):
| 축 | 값 |
|---|---|
| genre | soft-rock-am 3, europop-glow 3, hearth-acoustic 2, light-synth-pop-warm 2, adult-contemporary 2, brill-building 2, warm-morning-glow 2, motown-pop-soul 2 (합 18) |
| vocalType | male 6 / female 6 / mixed 6 |
| introTexture | 14개 서로 다른 텍스처, 각 1~2곡 |
| hookDevice | 10개 장치, 각 1~2곡 |
| arrangementDensity | sparse 6 / medium 6 / full 6 |
| structureTemplate | T1 4 / T2 4 / T3 4 / T4 3 / T5 3 |
| lyricTheme | 18개 서로 다른 장면, 각 1곡 |
| pov | firstPerson 15 / secondPerson 2 / thirdPerson 1 |

**세그먼트 배치 순서 (실측, 트랙 1~18의 세그먼트 라벨):**
```
1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0
최대 연속 동일 세그먼트 트랙 수: 1
```
완전 교차 배치입니다(≤2 기준을 충족하고도 남습니다). 이 결과는 **§6에서 설명하는 실제 버그를 고친 뒤**의 값입니다 — 최초 구현은 이 지점에서 연속 4트랙 블록이 발생했습니다.

### 입력 B — 시드 테이블에 없는 아티스트 + 청취 상황 + 미지 용어: `"오늘 같은 날씨에 사이먼과 가펑클 느낌으로 커피숍에서 잔잔한 음악"`

사이먼과 가펑클은 28종 `artistReferenceSeeds`에 없어 `artistReferences: []`로 감지 실패 — 스펙이 명시한 대로("로컬 폴백은 품질이 낮아도 됨") 로컬 경로는 아티스트를 인식하지 못하고 **키워드 기반 카페/잔잔 장르**로 대체 해석했습니다:

```json
{
  "intentKo": "\"오늘 같은 날씨에 사이먼과 가펑클 느낌으로 커피숍에서 잔잔한 음악\" 입력을 채널 기본 올드팝/성인 팝 중심의 Lo-fi Cafe Pop, Bossa Cafe Pop, Acoustic Jazz Pop, Acoustic Pop 세트로 해석했습니다.",
  "unknownTermsKo": ["\"날씨\" — 앱은 실시간 날씨를 알 수 없습니다. \"비 오는\", \"맑은\"처럼 직접 적어주시면 반영됩니다."],
  "listeningContext": {
    "settingKo": "커피숍 배경음, 잔잔한 배경음",
    "dynamicCeiling": "low",
    "tempoHint": [62, 92],
    "extraExclusions": ["대화를 방해하는 큰 다이내믹"]
  }
}
```
genre: `lofi-cafe 5 / bossa-cafe 5 / jazz-pop 5 / acoustic-pop 3`. 나머지 7축도 전부 채워짐(18곡, 빈 화면 없음). "날씨"는 침묵 처리되지 않고 `unknownTermsKo`에 명시적으로 노출됩니다.
**이 케이스가 바로 `directSet`(LLM 경로)이 존재하는 이유입니다** — 시드 테이블에 없는 아티스트를 실제로 이해하려면 LLM이 필요하고, 로컬 폴백은 "화면을 비우지 않는" 역할만 정직하게 수행합니다.

### 입력 C — 장르 블렌드: `"7080 올드팝 채널에 샹송 느낌이 나는 올드팝 만들어줘"`

```json
{
  "intentKo": "\"샹송 느낌이 나는 올드팝 만들어줘\" 장르 합성으로 해석했습니다.",
  "eraFocus": ["1970s AM-gold soft rock"],
  "reasoningKo": ["... 70s Soft Rock AM Gold을(를) 뼈대(구조/리듬/시대), Chanson Cafe을(를) 색(악기/화성)으로 사용했습니다.", "별도 청취 상황 지정은 없었습니다."]
}
```
단일 세그먼트, `blendedTraits` 확인:
- instrumentation: musette accordion, nylon guitar, clean electric guitar arpeggios, soft kick drum
- harmonyTraits: minor-key melancholy, chromatic inner voice movement, circular progression that resists resolution
- genreIds: `oldpop-soft-rock-am, chanson, soft-rock, oldpop-yacht-west-coast, oldpop-light-synth-pop-warm, oldpop-hearth-acoustic`

앵커(70s soft rock)의 구조/리듬/시대 + 플레이버(샹송)의 악기/화성이 실제로 섞여 있음을 확인했습니다(아코디언이 실제로 등장).

### 입력 D — 애매한 유행 표현: `"요즘 인기 있는 샹송풍으로"`

```json
{
  "unknownTermsKo": ["\"요즘 인기/유행\" — 앱은 실시간 인기 순위를 알 수 없습니다. 원하는 장르나 분위기를 직접 적어주시면 반영됩니다."],
  "genre": { "chanson": 5, "jazz-pop": 5, "acoustic-pop": 5, "adult-contemporary": 3 }
}
```
**이 항목은 실측 중 발견한 실제 결함이었습니다** — 최초 구현은 "요즘 인기 있는"을 아무 표시 없이 무시했습니다(§6-2). `UNKNOWABLE_PATTERNS`에 트렌드 패턴을 추가해 지금은 "날씨"와 동일하게 명시적으로 노출됩니다.

### 입력 E — 기존 단일 경로 베이스라인: `"비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝"`

세그먼트 1개("전체"), 비틀즈 artistReferences 정상 인식(28종 시드 테이블에 있음), genre `oldpop-british-beat 5 / folk-pop 5 / acoustic-pop 4 / oldpop-soft-rock-am 3 / oldpop-warm-morning-glow 1`. 이 입력은 **§5의 하위호환 회귀 검증**에서 재작성 전/후 바이트 단위로 동일함을 확인한 그 입력입니다.

---

## 2. `getVisibleGenresForArchetype('oldpop-lounge')` 전체 출력 (63개, 실측)

```
adult-contemporary, acoustic-pop, jazz-pop, healing-ballad, folk-pop, bossa-cafe, soft-rock,
piano-ballad, retro-soul-pop, chanson, smooth-jazz-lounge, oldpop-doowop-harmony,
oldpop-brill-building, oldpop-girl-group-wall, oldpop-sunshine-pop, oldpop-baroque-pop,
oldpop-british-beat, oldpop-soft-rock-am, oldpop-orchestral-easy, oldpop-close-harmony-duo,
oldpop-folk-rock-70s, oldpop-motown-pop-soul, oldpop-philly-soul-sweet, oldpop-countrypolitan,
oldpop-europop-glow, oldpop-yacht-west-coast, oldpop-piano-ballad-70s, oldpop-adult-contemporary-80s,
oldpop-quiet-storm-warm, oldpop-orchestral-ballad-80s, oldpop-light-synth-pop-warm,
oldpop-soft-duet-80s, oldpop-standards-torch, oldpop-warm-morning-glow, oldpop-gentle-lullaby-pop,
oldpop-hearth-acoustic, oldpop-sunlit-strings-pop, oldpop-slow-waltz-memory, oldpop-evening-lamp-ballad,
alt-rnb, neo-soul, contemporary-rnb, jazz-classic-vocal-lounge, jazz-soft-vocal-trio,
jazz-jazz-ballad-vocal, jazz-smooth-sax-vocal, jazz-bossa-vocal-jazz, jazz-torch-vocal-jazz,
jazz-contemporary-vocal-jazz, jazz-swing-crooner-ballroom, jazz-hotel-lounge-jazz, jazz-cabaret-jazz,
rnb-quiet-storm-baritone, rnb-soulful-gospel-warmth, rnb-silky-studio-rnb, rnb-gospel-soul-lift,
rnb-old-school-romance-rnb, rnb-soul-infused-female, rnb-soulful-male-rnb, rnb-emotional-female-rnb,
rnb-romantic-rnb, rnb-smooth-clean-rnb, rnb-velvet-baritone-rnb
```
39개 oldpop-* + 24개 인접 장르(재즈/알앤비/네오소울) 조합, 60종 이상 기준을 충족합니다.

---

## 3. 생성된 브릿지 인스트럭션 전문 (입력 A, 세그먼트 섹션 포함)

`buildClaudeCodeInstruction`에 `setDirectorInterpretation: { segments: plan.segments, listeningContext: plan.interpretation.listeningContext }`를 실제로 넘겨 생성한 결과에서, 이번에 추가된 부분만 발췌합니다(전문은 트랙 표/장르팩 JSON 등을 포함해 500줄이 넘어 발췌만 남깁니다):

```
[Diversity groups] - constraints, not wording to copy:
introTexture A:1,7  B:2,8  C:3,10  D:4,13  E:5  F:6  G:9  H:11  I:12  J:14  K:15  L:16  M:17  N:18
hookDevice A:1,9  B:2,10  C:3,11  D:4,13  E:5,15  F:6,16  G:7,17  H:8,18  I:12  J:14
arrangementDensity sparse A:1,4,7,10,13  sparse B:16  full C:2,5,8,11,14  full D:17  medium E:3,6,9,12,15  medium F:18
Tracks in the same group may share a similar approach; tracks in different groups must feel clearly different. Choose the concrete musical wording yourself.

[세그먼트 해석]
  카펜터스풍 (9곡): lush orchestral strings, soft electric piano, rich extended major-seventh chords, gentle key change into the final chorus
  아바풍 (9곡): bright analog synth pad, four-on-the-floor bass, major-key anthemic chorus lift, minor-to-major verse-to-chorus shift
  ※ 이 서술어를 그대로 쓸 필요 없습니다. 이 사운드를 이해하고 작곡하십시오.

CRITICAL — tempo: use each track's own "BPM" value from the table above exactly, in every song's stylePrompt. ...
```
- `[세그먼트 해석]`은 v3.62가 이미 고친 introTexture/hookDevice/arrangementDensity의 "[Diversity groups] 제약" 방식을 되돌리지 않고, 그 **뒤**에 별도 섹션으로 추가됩니다.
- 아티스트명("carpenters"/"abba"/"카펜터스"/"아바")은 섹션 어디에도 없음을 실측으로 확인했습니다(테스트 `bridgeSetPlanHandoff.test.ts`에서 정규식으로 검증).
- `청취 상황(listeningContext)`이 중립값("특별한 청취 상황 지정 없음")일 때는 이 하위 블록 자체가 생략됩니다(입력 B처럼 실제 청취 상황이 있을 때만 노출) — 침묵 규칙과 별개로 불필요한 노이즈를 만들지 않기 위함입니다.
- **다중 세트(`buildMultiSetClaudeCodeMasterInstruction`, 마스터 모드)에는 이 섹션을 연결하지 않았습니다.** §8-1 참고.

---

## 4. Step2.5 화면 (`Step2Plan.tsx`) 반영 결과

코드 기준 실제 렌더 결과를 서술합니다(브라우저 스크린샷은 §8-2에서 밝히듯 실행하지 않았습니다):

- **상단 블록**: "이렇게 해석했습니다" 제목 아래 `intentKo` 문장, family/era/audience/artist-refs 칩, **(신규)** 세그먼트가 2개 이상이면 `카펜터스풍 9곡` / `아바풍 9곡` 칩 행 추가, reasoning 문장들, 기존 경고(`warnings`), **(신규)** `unknownTermsKo`가 있으면 "이해하지 못한 표현" 박스에 각 항목을 별도 문단으로 노출(조용히 숨기지 않음).
- **장르 배분/조정 모달 등 기존 UI**: 전혀 삭제하지 않았습니다. 축 조정 모달, 대안 칩, "다시 설계"/"설계 적용" 버튼 모두 그대로입니다.
- **"18곡 계획 펼치기" 안**: 세그먼트가 2개 이상일 때만 **(신규)** "● 섞기 (권장) / ○ 전반부·후반부로 나누기" 라디오 토글이 표 위에 나타납니다. "섞기"는 엔진이 실제로 생성한 순서(§1의 완전 교차 순서) 그대로 보여주고, "전반부·후반부로 나누기"는 `reorderSlotsBySegment`(미리보기 전용, `Step2Plan.tsx`에서 export)로 트랙을 세그먼트별로 재그룹핑해 보여줍니다.
- 단일 세그먼트 입력(B/C/D/E)에서는 토글도, 세그먼트 칩도 나타나지 않습니다(불필요한 UI 노이즈 없음) — `reorderSlotsBySegment`/토글 렌더 조건 모두 `plan.segments.length > 1`.

---

## 5. 하위호환 회귀 검증 (git stash 기반)

이번 세션에서 수정한 6개 파일만 선택적으로 스태시(`git stash push -u -- <6 files>`)해 순수 HEAD(v3.63-재작성 이전) 코드로 되돌린 뒤, 입력 E와 또 다른 순수 키워드 입력(둘 다 세그먼트/블렌드 힌트가 없는 **구 경로**)에 대해 `directSetLocal`의 interpretation/segments/allocations/warnings/slot 요약을 JSON으로 캡처하고, 스태시를 pop해 복원한 뒤 동일하게 재캡처해 `diff`했습니다.

```
$ diff regression_before.json regression_after.json && echo "IDENTICAL"
IDENTICAL
```

**완전히 동일합니다.** 구 경로(`artistReferences.length < 2` 이고 블렌드 힌트가 없는 모든 입력)는 이번 재작성으로 단 1비트도 달라지지 않습니다 — `directSetLocal`에 추가한 두 개의 신규 분기(세그먼트/블렌드)는 그 조건에 해당하지 않으면 조기 반환되지 않고 기존 코드로 그대로 낙하합니다.

---

## 6. 실측 중 발견해 직접 고친 실제 결함 2건

이 두 건은 "설계 문서에 없던 버그를 실측 검증 과정에서 발견해 즉시 고친" 사례이며, §1의 최종 수치는 이미 고친 뒤 값입니다.

### 6-1. 세그먼트가 인터리브되지 않고 4트랙씩 블록으로 뭉치는 버그 (P0, 스펙 핵심 요구사항 위반)

`buildSetPlanFromIntent`가 세그먼트별 genre-count를 병합할 때 "세그먼트 1의 장르 4개를 전부 넣고, 그다음 세그먼트 2의 장르 4개를 넣는" 순서로 `Map`을 만들었습니다. 이 맵의 키 순서가 그대로 `preallocateSongSlots`→`buildGenreCountRotationPlan`(재사용 중인 기존 함수, 손대지 않음)의 동률 타이브레이크 순서로 흘러가는데, 그 함수는 "바로 직전 트랙과 같은 **장르 하나**만" 반복을 막을 뿐 "세그먼트" 개념을 전혀 모릅니다. 그 결과 장르 하나하나는 연속 반복되지 않지만, 같은 세그먼트의 다른 장르로 계속 갈아타면서 세그먼트 단위로는 최대 4트랙 연속(예: 트랙 2~5가 전부 "카펜터스풍")이 발생했습니다 — 스펙이 명시한 "≤2 연속" 요구를 위반하고, v3.64-B가 지적한 "블록으로 뭉치면 청취 피로" 문제를 세그먼트 레벨에서 그대로 재현한 것입니다.

**수정**: genre-count 맵을 세그먼트별로 순차 삽입하는 대신, 세그먼트마다 한 개씩 라운드로빈으로 삽입하도록 바꿨습니다(기존 `buildGenreCountRotationPlan`/`preallocateSongSlots`는 전혀 수정하지 않음 — 이미 올바른 로직을 다시 만들지 말라는 지시를 지켰습니다). 5개 시드 × 2세그먼트에서 전부 최대 연속 1(완전 교차), 3세그먼트 테스트에서 최대 연속 2로 실측 확인했습니다. 회귀 테스트 추가(`setDirectorSegments.test.ts`).

### 6-2. "요즘 인기 있는" 이 무표시로 무시되던 버그

스펙 0장이 직접 든 4개 예시 입력 중 하나("요즘 인기 있는 샹송풍으로")를 실제로 돌려보니 `unknownTermsKo`가 비어 있었습니다 — "날씨"/"오늘 기분"과 똑같이 앱이 알 수 없는 실시간 정보(실시간 인기 순위)인데 `UNKNOWABLE_PATTERNS`에 패턴이 없었습니다. `요즘\s*(인기|유행)|최근\s*(인기|유행)` 패턴을 추가해 지금은 명시적으로 노출됩니다.

---

## 7. `directSet` (LLM 경로) — 실측 가능 범위와 한계

- 폴백 계약은 **실제** 네트워크 실패로 검증했습니다: `proxyEndpoint: 'http://127.0.0.1:1/nonexistent-endpoint-for-test'`(모킹이 아닌 진짜 연결 불가 주소)로 `directSet`을 호출해도 예외 없이 완결된 18곡 SetPlan을 반환함을 확인했습니다(`tests/setDirectorSegments.test.ts` 2건).
- **실제 Anthropic/OpenAI 엔드포인트로의 왕복은 이 세션에서 실행할 수 없습니다** (API 키/배포된 서버 없음) — §8-3에 미구현으로 명시합니다.
- `directSet`은 새 서버리스 엔드포인트를 만들지 않고 기존 `/api/generate`(범용 system+user→JSON 프록시, `conceptAgent.ts`가 이미 같은 패턴으로 사용 중)를 재사용합니다 — 스펙의 "API를 필수로 만들지 말 것"을 지키며, 실패 시 `directSetLocal`로 완전히 폴백합니다.

---

## 8. 완료 판정표 (실측)

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| TASK A: oldpop-lounge 존재/60+ 장르 | 존재 | 검증 완료(§0), 63종(§2) | PASS |
| InterpretedIntent/SetSegment 등 기존 타입 재사용 (신규 구조 없음) | 재사용만 | `AxisAllocation`/`PreassignedSongSlot`/`TraitProfile`/`DecomposedReference` 그대로 사용, 신규 struct 없음 | PASS |
| `directSet`(LLM) 이 primary, `directSetLocal`이 fallback | 순서/역할 | `directSet`이 `directSetLocal`을 내부에서 호출하는 구조로 구현 | PASS |
| 곡 수 문구 파싱 ("9곡씩" 등) | 정확히 분배 | 9+9 실측(§1-A), `parseQuantityPhrase` 4개 단위테스트 | PASS |
| 세그먼트 인터리브 (블록 금지) | ≤2 연속 | 2세그먼트 최대 연속 1, 3세그먼트 최대 연속 2 (§1-A, §6-1 버그 수정 후) | PASS |
| 장르 블렌드 합성 | 앵커+플레이버 혼합 확인 | 아코디언 등 실제 혼합 확인(§1-C) | PASS |
| 청취 상황 감지/반영 | 다이내믹 억제 | 커피숍/잔잔 → low + 62-92 BPM 확인(§1-B) | PASS |
| 미지 용어 명시 (침묵 금지) | 노출 | 날씨(§1-B), 인기/유행(§1-D, §6-2 버그 수정 후) | PASS |
| 시드 테이블 밖 아티스트 처리 | 빈 화면 없이 폴백 | 사이먼과 가펑클 → 18곡 완결(§1-B), 단 인식은 실패(§7에서 논의) | PASS (폴백 품질 저하는 스펙이 허용) |
| 브릿지 인스트럭션에 세그먼트/청취상황 반영 | 반영 + 문구 재사용 금지 | `[세그먼트 해석]` 섹션 확인, 아티스트명 누출 없음(§3) | PASS |
| v3.62 diversity-group 방식 되돌리지 않음 | 유지 | `[Diversity groups]` 섹션 그대로, 세그먼트 섹션은 별도 추가(§3) | PASS |
| Step2.5: unknownTerms 노출 | 노출 | §4 | PASS |
| Step2.5: 세그먼트 배치 토글 | 존재 | §4, 단일 세그먼트에선 비노출 | PASS |
| Step2.5: 기존 상세 설정 유지 | 삭제 없음 | §4 | PASS |
| `artistReferenceSeeds` 미확장 | 개수 불변 | 수정하지 않음(28종 유지) | PASS |
| `directSet` 실제 API 왕복 | 검증 | 미실행(§7, §8-3) | **미구현 — 정직하게 기록** |
| Step2.5 브라우저 렌더/스크린샷 | 검증 | 미실행(§4, §8-2) | **미구현 — 정직하게 기록** |
| 마스터 모드(`buildMultiSetClaudeCodeMasterInstruction`) 세그먼트 연결 | 연결 | 미연결(§8-1) | **미구현 — 정직하게 기록** |

### 회귀 방지

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| 구 경로(단일 세그먼트, 블렌드 힌트 없음) 산출물 불변 | 바이트 동일 | `diff` IDENTICAL(§5) | PASS |
| 기존 Step2 상세 설정 UI 보존 | 삭제 없음 | §4 | PASS |
| senior-morning 40종 노출 유지 | 유지 | 코드 미수정 | PASS |
| lyricEngine.ts/lyricVocabularyGuard.ts 미수정 | 미수정 | 손대지 않음 | PASS |
| v3.62 아티스트명 누출 방지 로직 유지 | 유지 | `findArtistReferenceLeaks` 그대로 사용, 신규 검증 통과 | PASS |
| 전체 테스트 | 통과 | **137개 파일 / 1534개 테스트, 전부 통과** | PASS |
| 타입체크 | 통과 | `tsc --noEmit` 에러 0건 | PASS |

---

## 9. 미구현 항목 (명시)

1. **마스터/멀티세트 모드(`buildMultiSetClaudeCodeMasterInstruction`)에는 세그먼트 해석 섹션을 연결하지 않았습니다.** 단일 팩 경로(`buildClaudeCodeInstruction`)만 지원합니다. 마스터 모드는 여러 팩을 한 번에 묶는 별도 경로라 이번 스펙의 실측 대상(단일 팩 SetPlan)과 직접 연결되지 않아 범위 밖으로 남겼습니다.
2. **Step2.5 화면의 실제 브라우저 렌더링/스크린샷은 실행하지 않았습니다.** 이 프로젝트에는 React 컴포넌트 렌더 테스트 인프라(`@testing-library/react`, jsdom 등)가 전혀 없어(기존 `tests/` 어디에도 `steps/*.test.tsx`가 없음), §4는 코드와 실제 SetPlan 데이터를 근거로 한 서술입니다. 순수 로직 함수(`reorderSlotsBySegment`)는 export해 별도 테스트로 검증했습니다.
3. **`directSet`(LLM 경로)의 실제 Anthropic/OpenAI 왕복은 이 세션에서 한 번도 실행되지 않았습니다.** API 키도 배포된 서버도 없는 샌드박스라 폴백 계약(실패 시 반드시 완결된 로컬 플랜)만 실제 연결 불가 주소로 검증했습니다. 라이브 응답의 스키마 적합성/아티스트명 누출 검증(`validateInterpretedIntent`)은 코드로는 존재하지만 실제 LLM 출력으로 트리거된 적은 없습니다.
4. **`applyListeningContextFilter`의 4종 미만 안전장치가 실제로 발동한 사례를 그대로 남겨뒀습니다.** 이전 세션에서 "비 오는 날 같은 잔잔한 올드팝"에 대해 후보 5개 중 `dynamicRange: 'low'`가 1개뿐이라 필터를 건너뛴 사례를 확인했습니다 — 안전장치가 의도대로 동작한 것이지만, 그 만큼 이 필터가 실제로 장르 선택을 좁히지 못하는 입력이 존재한다는 뜻이라 정직하게 남겨둡니다.
5. **동일 장르가 여러 세그먼트에 동시에 속하는 경우(교집합)는 `reorderSlotsBySegment`가 첫 번째로 매칭되는 세그먼트에 배정합니다.** 현재 멀티 아티스트 경로는 세그먼트 간 genreIds가 항상 서로소임을 실측으로 확인했지만(§1-A), 이 전제가 깨지는 입력에 대한 명시적 처리는 만들지 않았습니다.
