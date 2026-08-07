# TASK H — senior-oldpop 텍스트 품질 성공률 실측 (지시문 11)

## 0. 측정 방법과 정직한 범위 축소

지시문 05/06이 원래 설계한 선택적 재작성 루프의 진짜 revise/reject 판정은
실시간 Claude/ChatGPT API 평가(`agents/evaluator.ts`)를 필요로 한다 —
`tests/e2e/resultsFlow.spec.ts` 자신의 doc comment가 이미 "requires a live
Claude/ChatGPT API call — genuinely unreachable in a zero-cost E2E suite"라고
명시하고 있다. 이 세션에는 그 API 접근이 없다.

그래서 이 리포트의 "성공/실패"는 지시문 05/06의 원래 AI 평가 기준이 **아니라**,
이 앱이 이미 갖고 있는 결정적(API 불필요) 코드 레벨 텍스트 품질 신호 두 가지를
조합한 것이다:

1. `core/quality.ts` `scoreSong`의 `song.warnings` — 단, 그 자체 doc comment가
   "advisory only, never blocking"이라고 명시한 항목(English syllable-density,
   consonant-cluster)은 실패로 세지 않았다.
2. `core/albumAudit.ts` `auditAlbum`의 `errors`(Track별 접두사로 구분된 차단
   오류 — 중복 제목/훅, 아티스트명 유출, 글자수 초과 등).

**이 정의는 지시문 05/06의 원래 기준과 다르다** — 정직하게 밝힌다. 실제 코드
(`scripts/scoreTaskHSet.ts`)로 재현 가능하다.

곡 54개(3세트 × 18곡)는 실제 `preallocateSongSlots()`(브릿지 배포 경로가 쓰는
바로 그 함수, `scripts/dumpSlotPlanForTaskH.ts`)가 만든 진짜 slot plan을
기반으로, Claude Code가 실제 브릿지 송라이터 역할을 맡아 직접 작성했다
(지시문 10 TASK F와 동일한 방식 — 로컬 조합형 생성기는 "가사가 단조롭다"고
이 앱 자신이 명시하므로 대표성이 없어 채택하지 않음, 하루가 직접 선택).

## 1. 결과 — 세트별 (평균으로 숨기지 않음)

| 세트 | 1차(첫 작성) | 재작성 1회 후 | 재작성 2회 후 |
|---|---|---|---|
| set1 | **0/18 (0.0%)** | 18/18 (100.0%) | 불필요 (이미 100%) |
| set2 | **14/18 (77.8%)** | 18/18 (100.0%) | 불필요 (이미 100%) |
| set3 | **18/18 (100.0%)** | 불필요 (이미 100%) | 불필요 |
| **합계(54곡)** | **32/54 (59.3%)** | **54/54 (100.0%)** | 불필요 |

목표(지시문 05/06 승계): 1차 ≥80%, 재작성 1회 후 ≥95%, 재작성 2회 후 ≥98%.

- **1차 완성률 59.3% — 목표(80%) 미달, 정직하게 보고**. set1(0%)이 합계를
  강하게 끌어내렸다.
- **재작성 1회 후 100% — 목표(95%) 초과 달성**. 세 세트 모두 재작성 2회까지
  갈 필요가 없었다.

## 2. set1이 0%였던 진짜 이유 (재현 가능한 5가지 원인)

set1은 "처음 이 체커의 정확한 요구사항을 모르는 상태"로 작성했다. 실제로
`scoreSong`을 돌려서 나온 원인은 다음과 같았고, 전부 18곡에 걸쳐 체계적으로
반복됐다:

1. **hookPhrase 대소문자 불일치** — `Hook appears only 0x`. 훅 문구를 가사에
   그대로(정확한 대소문자로) 쓰지 않으면 이 앱은 그 훅이 아예 등장하지 않은
   것으로 센다(`countOccurrences`가 대소문자 구분).
2. **훅이 아닌 코러스 문장의 곡 내 반복** — `한 곡 내 문장 반복 (blocking)`.
   `core/englishLint.ts`의 `findInSongLineRepetition`은 **hookPhrase 그 줄
   하나만** 반복을 허용하고, 코러스의 나머지 줄(2번째, 3번째 줄)이 반복되면
   차단한다 — 일반적인 팝송 관습(코러스 전체를 그대로 반복)과 정면으로
   충돌한다. 실측 확인: 이건 이 앱의 실제 동작이며, 이번 지시문 범위에서
   바꾸지 않았다(정직하게 "발견"으로만 남김 — 아래 §4).
3. **stylePrompt 길이 초과** — 목표 35단어인데 실제로 60~80단어를 썼다
   (`STYLE_WORD_TARGET_MAX`).
4. **stylePrompt에 "chorus" 리터럴 단어 누락** — `prompt.includes('chorus')`
   하드 체크.
5. **hookDeviceText 재서술이 정규식과 어긋남** — `hookDeviceDisclosurePattern`
   (stop-time/breakdown/octave/swell 등 고정 어휘 목록)에 맞는 문구를 쓰지
   않으면 실패.

set2/set3는 이 5가지를 알고 쓴 두 번째·세 번째 시도라 1차부터 77.8%/100%로
훨씬 높았다 — **이 자체가 하나의 발견**이다: 현재 브릿지 지시문
(`core/bridgeInstruction.ts`)이 이 5가지 기계적 요구사항을 명시적으로 알려
주지 않는다면, 실제 사용자 세션도 set1과 같은 낮은 1차 성공률을 겪을 가능성이
높다. 이 지시문 범위에서는 브릿지 지시문 문구를 고치지 않았다 — 실측만
정직하게 남긴다(§4).

## 3. set2에서 발견한 실제 slot-planning 버그

set2(`여름밤 야외에서 듣던 재즈 페스티벌 회상` 컨셉)의 실제
`preallocateSongSlots()` 출력에서 18곡 중 **10곡**이 정확히 동일한
`lyricTheme: "senior-convertible-radio-night"`을 배정받았다(트랙
1,3,5,7,9,11,13,15,17,18). 지시문 10 TASK B가 이미 문서화한
"customConcept 시드가 lyricTheme 배정 다양성을 무너뜨릴 수 있다"는 알려진
gap과 같은 계열의 실제 재현 사례다. 이 지시문(11) 범위에서 고치지 않았다 —
직접 원인은 `core/lyricDiversityPlan.ts`의 프레임 스킵 예외(지시문 10 TASK B
보고서에 이미 기록됨)로 추정되나, 그 파일을 다시 건드리는 건 이 지시문의
범위 밖이다. 10곡 모두 같은 브리프였음에도 서로 다른 구체적 장면(주유소,
드라이브인, 편지, 별 보기 등)으로 실제로 분화해서 썼다 — 텍스트 자체의
다양성은 유지했지만, 상위 slot plan의 다양성 실패는 그대로 남아 있다.

## 4. 하지 않은 것 (정직하게 남김)

- **AI 평가 기반 revise/reject 재현 안 함** — 실시간 API가 없어 §0에서 설명한
  대체 기준만 썼다.
- **`findInSongLineRepetition`의 "코러스 반복 허용 안 함" 규칙을 고치지
  않음** — 일반적인 팝송 관습과 충돌하는 실제 동작이지만, 이 지시문(TASK H)
  범위는 "측정"이지 "체커 로직 변경"이 아니다. 별도 지시문에서 다룰 문제로
  남긴다.
- **브릿지 지시문 문구에 위 5가지 기계적 요구사항을 명시적으로 추가하지
  않음** — 실제로 1차 성공률을 크게 올릴 수 있는 변경이지만, 이번 지시문
  범위(측정)를 넘는 새 기능 추가라 하지 않았다.
- **lyricTheme 배정 다양성 버그를 고치지 않음** — 지시문 10 TASK B가 이미
  같은 근본 원인을 문서화했고, 그 코드를 다시 건드리는 건 이 지시문 범위
  밖이다.

## 5. 재현 방법

```
npx tsx scripts/dumpSlotPlanForTaskH.ts          # 3세트 slot plan 재생성
npx tsx scripts/scoreTaskHSet.ts set1 set1-songs.json
npx tsx scripts/scoreTaskHSet.ts set2 set2-songs.json
npx tsx scripts/scoreTaskHSet.ts set3 set3-songs.json
```

원본 1차 시도(set1의 0% 상태)는 `lyrics/taskH/set1-songs.json`에, 재작성
1회 후 100% 상태는 `lyrics/taskH/set1-songs-rewrite1.json`에 그대로 보존
했다 — 재현 가능하도록.
