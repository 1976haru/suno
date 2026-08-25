# concept 원자 누락 결함 실측 보고 (지시문 21 TASK D)

지시문 21 §D — TASK C(신규 6종 채널 배선) 작업 중 발견한 기존 결함을 실측만
하고 문서로 남긴다. `core/promptBudget.ts`는 전 채널이 공유하는 인프라라
이 지시문 범위 밖 — 여기서는 고치지 않는다.

## 1. 발견 경위

TASK C에서 `good-morning-memory-radio`(senior-morning) 채널에 신규 6종 중
`oldpop-italian-canzone`을 제외하고 5종만 배선하면서, 최초 작업 메모에
"italian-canzone까지 추가하면(풀 30종) `concept` 카테고리가 `stylePrompt`에서
통째로 잘려 `customConcept` 매핑 문구가 사라지는 결함이 재현된다"고 적었다.
이 문서는 그 주장을 재실측으로 검증한 결과를 담는다 — 결론은 **정정**이다.

## 2. 원인 (코드 레벨)

`core/promptBudget.ts`의 `composeStylePrompt`는 두 단계로 원자를 채운다.

1. **초기 greedy `safeTarget` 채움 루프** (라인 788-804): 우선순위 순서대로
   원자를 추가하다 누적 길이가 `safeTarget`을 넘으면, `essential`이거나
   `GUARANTEED_FLOOR_BY_ID`에 등록된 카테고리가 아닌 한 그 원자를 통째로
   버린다.
2. **이후 보호 단계** (`compressHardLimitWithGuard`의 stage 2.5, 소프트
   단어예산 패스): `GUARANTEED_MINIMUM_TERM_IDS`에 속한 카테고리(`concept`
   포함)를 floor 개수까지는 지켜준다.

문제는 `'concept'`이 `GUARANTEED_MINIMUM_TERM_IDS`(2단계 보호 대상)에는
있지만 `GUARANTEED_FLOOR_BY_ID`(1단계 보호 대상, 라인 635-640: `earworm`·
`killingPoint`·`openingHook`·`openingLoudness`만 등록)에는 없다는 것이다.
`concept`은 `PROMPT_PRIORITY`에서 4번째로 이르게 등장하지만(라인 200),
그 앞의 `vocal`/`genreSignature`/`genreNarrative`만으로 이미 `safeTarget`을
넘기면 1단계에서 통째로 버려지고, 2단계는 이미 사라진 원자를 되살리지
못한다 — `customConcept`으로 매핑된 스타일 문구(`'morning light'` 등)가
`stylePrompt`에서 완전히 빠진다.

## 3. 실측 (§9 원칙 — 추정 아님)

`good-morning-memory-radio` 채널, `preferredGenres` 풀 크기 3종(24 / 29 /
30)에 대해, `v352ConceptDiversity.test.ts`가 쓰는 4개 concept 매핑
(`아침 카페`→`morning light`, `비 오는 밤`→`rain on window`, `도시의 불빛`→
`city neon`, `청춘과 꿈`→`open road`) 각각으로 18곡 블루프린트를 생성해
`stylePrompt`에 매핑 문구가 있는지 전수 검사(4 concept × 18곡 = 72곡/풀
크기).

| 풀 크기 | 구성 | 누락 | 비율 |
|---|---|---|---|
| 24 (TASK C 이전) | 지시문 20까지의 기존 장르만 | 43/72 | 59.7% |
| 29 (TASK C, 현재) | +두왑 발라드/업템포·밤 샹송·비 오는 날 발라드 블루스·6/8 슬로우 발라드 | 45/72 | 62.5% |
| 30 (+italian-canzone) | 29 + 이탈리안 칸초네 | 47/72 | 65.3% |

**결론**: 결함은 italian-canzone 추가로 새로 생기는 게 아니라 24종
시점(지시문 21 이전)에도 이미 60% 비율로 존재했다. 풀이 커질수록 소폭
(24→29→30에서 약 3%p씩) 나빠지는 경향은 있지만, italian-canzone 하나가
임계값을 넘기는 급격한 원인이 아니다 — 장르 다양성이 늘수록 `genreSignature`/
`genreNarrative` 원자가 더 자주 길어져 `safeTarget`을 더 일찍 소진시키는
누적 효과로 보인다(개별 원인 원자까지는 이 조사에서 분리하지 않았다).

기존 회귀 테스트(`v352ConceptDiversity.test.ts`)가 이 문제를 못 잡는 이유:
`songCount: 6`으로 song[0] 하나만 확인하거나(`toContain`), 18곡 중 "적어도
한 곡"만 통과하면 되는 `.some()` assertion이라 — 대다수 곡에서 사라져도
소수만 살아있으면 그린이다.

## 4. 조치

- `good-morning-memory-radio`는 italian-canzone 배선을 제외한 채 유지한다
  (tier:'extended'라 이 채널에 꼭 필요하지 않고, 배제해도 결함이 사라지는
  건 아니지만 완만한 악화 방향은 막아준다).
- `oldpop-lounge-main`은 6종 전부 배선을 유지한다 — 이 결함은 그 채널에도
  동일하게 존재할 가능성이 높지만(미측정), 이 지시문 범위에서 채널별로
  개별 대응할 문제가 아니라 `core/promptBudget.ts` 자체의 결함이다.
- **수정하지 않는다**: `core/promptBudget.ts`는 전 채널 공유 인프라이고,
  진짜 수정(`concept`을 `GUARANTEED_FLOOR_BY_ID`에 추가)은 모든 워크스페이스의
  스타일 프롬프트 출력에 영향을 준다 — 이 지시문(채널 배선 확장) 범위를
  벗어난다.

## 5. 후속 지시문에 넘기는 것

`concept`을 `GUARANTEED_FLOOR_BY_ID`에 추가하는 수정 자체와, 그 수정이
`v352ConceptDiversity.test.ts`를 포함한 기존 스냅샷/회귀 테스트에 미치는
영향(전 워크스페이스 재측정 필요)을 다음 지시문에서 다룰 것을 제안한다.
