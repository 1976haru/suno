# v5.8 — kr-kids / jp-kids 실행 전 감사 (v5.6과 동일 방식)

**원칙 준수 확인**: 이 문서의 모든 수치는 실제로 `npx tsx`로 로컬 생성 파이프라인을 실행하고, 실제로 생성된 가사/스타일 프롬프트를 직접 읽어서 얻은 값입니다. "코드를 읽고 이렇게 동작할 것이다"라고 추정한 항목은 전부 실행/측정으로 검증했습니다. **이 문서는 감사 전용입니다 — 발견한 문제를 이 세션에서 임의로 고치지 않았습니다** (v5.6과 동일한 원칙).

- 실행 커밋: `9977b73`(v5.7 직후), 작업 트리 clean.
- 이 감사는 v5.6/v5.7과 무관하게 kr-kids/jp-kids만 대상으로 새로 수행했습니다. `ready: true` 상태는 그대로 두었습니다(이 문서는 판정만 하고, 플래그는 건드리지 않음 — 필요 시 후속 작업에서 결정).

---

## 0. 가장 중요한 발견 3가지 (요약)

1. **"자장가/취침 전" 채널이 실제로는 액션송과 사실상 동일한 콘텐츠를 생성합니다 (§4, 실측).** kr-kids의 `bedtime-lullaby-radio`(잠들기 전 자장가) 채널은 `follow-along-action-song`(율동 동요) 채널과 `defaultVocal`("bright cheerful boy and girl duet singalong...") 및 `preferredMoods`(`['bright-playful']`)가 **토씨 하나 다르지 않게 동일**합니다. 카탈로그에는 정확히 이 용도의 `calm-focus` 무드(`calm/steady/light concentration`)가 이미 존재하는데도 쓰이지 않았습니다. jp-kids의 `oyasumi-mae-no-uta`(취침 전)는 `defaultVocal`은 `minna-de-taiso`(체조)와 다르게 잘 분리했지만 `preferredMoods`는 똑같이 `bright-playful`을 그대로 씁니다. 실제로 "자기 전 편안한 자장가"/"ねむる前のやさしい子守唄" 컨셉으로 생성해 보면 가사 내용은 비눗방울 불기, 숫자 세기, 히라가나 배우기처럼 **활기찬 놀이 콘텐츠**가 나옵니다 — 장르 레벨(`krkids-sleep-calm`, 템포 62-84 BPM)은 정확히 자장가답게 설계돼 있지만, preferredGenres 3개 중 1개일 뿐이고 가사 본문·보컬 지시·무드 태그는 전혀 반영하지 않습니다.
2. **`customConcept` 텍스트가 동요 워크스페이스의 가사 주제 선택에 사실상 영향을 주지 못합니다 (§4, 실측).** 성인 워크스페이스에 이미 존재하는 `frameIdForConceptText()`(컨셉 문장에서 장면을 추론해 그 장면 쪽으로 배정을 편향시키는 메커니즘)가 동요 파이프라인에도 연결은 돼 있지만, 이 함수가 인식하는 신호 어휘가 성인 워크스페이스 어휘(퇴근길/재회/드라이브 등) 기준이라 "자장가"/"체조"/"子守唄" 같은 동요 컨셉 문구에는 반응하지 않습니다. 결과적으로 어떤 컨셉을 넣어도 8개 주제(animal/season/family/friend/play/school/counting/hangul)에 걸쳐 다양성 위주로 고르게 배정될 뿐이고, 애초에 8개 주제 자체에 "차분함/졸림" 같은 무드 축이 없어 자장가에 맞는 주제 버킷 자체가 존재하지 않습니다.
3. **동요 안전 검증기가 여전히 실제 파이프라인에 연결돼 있지 않습니다 (§3, v5.6과 동일 확인, 이번에 실측 재확인).** `kidsLyricSafetyIssues`/`isKidsLyricSafe`/`referencesExistingKidsSong`는 자기 모듈과 자기 단위 테스트 밖에서 호출부가 0개입니다. 다만 이번 감사에서 블랙리스트 자체(공포/폭력/외모 평가/성인 로맨스/브랜드)는 6개 채널 실제 108곡을 직접 검사한 결과 **위반 0건**으로 확인했습니다 — 콘텐츠 자체는 손수 작성된 풀이 안전해서 지금은 괜찮지만, 파이프라인이 그걸 보장하는 게 아니라는 v5.6의 결론이 그대로 유효합니다. 추가로 새로 발견한 것: 화이트리스트(연령대별 어휘 제한) 쪽은 설계와 실제 콘텐츠가 서로 검증된 적이 없어서, 지금 상태로 그냥 연결하면 정상적인 콘텐츠까지 거의 전부(테스트한 108곡 중 108곡, 100%) 걸러버립니다 — "차단 게이트가 존재하지 않는다"와 "존재해도 지금 그대로는 못 쓴다"는 서로 다른 문제이고, 후자는 이번에 처음 확인했습니다.

---

## 1. TASK A — 스캐폴딩 인벤토리 (실측/직접 코드 확인)

| 구성요소 | kr-kids | jp-kids | 비고 |
|---|---|---|---|
| defaultAudienceProfileId | `kids`(연령 무관 단일 프로파일) | `kids`(동일) | v5.7에서 4개 성인 워크스페이스만 고쳤고 kids는 범위 밖 — 그대로 |
| ChannelSoundFloor | 없음 | 없음 | v5.7에서도 kids는 범위 밖 |
| VocabularyBank(`vocabularyBankForScene`) | 없음(이 시스템 자체를 안 씀) | 없음 | 동요는 `kidsLyricEngine.ts`의 별도 커스텀 본문 조립기 사용, 성인용 모티프/뱅크 시스템과 무관 — 그 자체는 정상 설계 |
| 가사 본문 소스 | `composeKidsLyrics`(자체 완결형, 손수 작성된 8주제 풀) | 동일(일본어 풀) | 성인 엔진의 상황/모티프 풀 재사용 안 함 — 의도된 격리, 정상 |
| kidsLyricSafetyIssues 실제 호출부 | **0개**(자기 모듈/테스트 제외) | **0개** | v5.6과 동일, 이번에 재확인 |
| whitelistViolations 실사용 시 결과 | 108곡 중 108곡(100%) "위반" — §0-3 | 동일 | 이번에 신규 발견 |
| referencesExistingKidsSong 실제 호출부 | 0개 | 0개 | 동일 |
| ageTier(`KidsAgeTierId`) 파이프라인 연결 | **없음** — `GenerationOptions`에 필드 자체가 없음(`hookStyleDirectives`의 자체 주석이 명시) | 동일 | v5.6과 동일 확인 |
| KIDS_KILLING_POINTS 연결 | **있음, 실제 사용됨** — `localGenerator.ts:643,974`/`batchPreallocation.ts:203`가 `isKidsArchetype` 체크 후 실제로 넘김 | 동일 | v5.6 요약과 다른 부분 — 이번에 직접 코드 추적으로 재확인, 실제로 연결돼 있음 |
| kidsLyricThemes 전용 씬 수 | 22개(`krkids-*`, `suitedArchetypes: ['kr-kids-song']`, frameId/ageTier 필드 보유) | 23개(`jpkids-*`) | 실재하고 정상 스코핑됨(§0-2에서 지목한 "0개" 추정은 틀렸음 — 실제로 있음, 다만 컨셉 매칭이 안 될 뿐) |
| 채널 프리셋 defaultVocal/mood 채널간 분화 | **부분 실패** — bedtime-lullaby-radio가 action-song과 완전 동일(§0-1) | **부분 성공** — defaultVocal은 분화, preferredMoods는 미분화 | 이번에 신규 발견 |
| 격리(L1/L3/L4/L6) | 전부 PASS(L3만 "가사 세계 미구축"으로 SKIP — 아래 §5 참조, 실제로는 다른 이유) | 전부 PASS | §5 참조 |

---

## 2. TASK B/E — 실측 생성 결과 (18곡 × 6채널 + 스케일 테스트)

로컬 파이프라인(`generateLocalBlueprint`) 6개 채널(kr-kids 3개: action/habit/lullaby, jp-kids 3개: teasobi/taiso/oyasumi) × 18곡 실행.

| 채널 | 곡 수 | 중복 제목/훅 | 블랙리스트 위반 | 화이트리스트 "위반"(참고용, 미연결) |
|---|---|---|---|---|
| kr-kids / follow-along-action-song | 18/18 | 0/0 | 0/18 | 18/18(t2 기준) |
| kr-kids / daily-habit-learning-song | 18/18 | 0/0 | 0/18 | 18/18(t1 기준) |
| kr-kids / bedtime-lullaby-radio | 18/18 | 0/0 | 0/18 | 18/18(t3 기준) |
| jp-kids / teasobi-hiroba | 18/18 | 0/0 | 0/18 | 18/18(t2 기준) |
| jp-kids / minna-de-taiso | 18/18 | 0/0 | 0/18 | 18/18(t1 기준) |
| jp-kids / oyasumi-mae-no-uta | 18/18 | 0/0 | 0/18 | 18/18(t3 기준) |

**스케일 테스트**(songCount 1/6/12/18/24/30, kr-kids action + jp-kids teasobi): 전 구간 크래시 없음, 매 실행마다 제목/훅 100% 유니크. **10회 연속 생성 연속성**(kr-kids action, 12곡×10회=120곡, 회차 간 avoid-list 공유 없음): 회차 간 중복 제목 41/120, 훅 41/120 — 회차 간 상태 공유가 원래 없는 설계이므로 예상된 정상 범위(성인 워크스페이스와 동일 패턴).

---

## 3. TASK C — 안전 검증기 실배선 확인

`core/kidsLyricEngine.ts`의 `kidsLyricSafetyIssues`/`isKidsLyricSafe`/`referencesExistingKidsSong`, `data/kidsVocabularyWhitelist.ts`의 `whitelistViolations` — grep 기준 실제 생성 파이프라인(`localGenerator.ts`, `batchPreallocation.ts`, `composeKidsLyrics` 자신) 어디에서도 호출되지 않음. `composeKidsLyrics` 함수 본문을 직접 읽어 확인 — 반환 직전 안전성 자체 점검 없음.

**블랙리스트 자체 품질(실측)**: 108곡(6채널×18곡) 전체 텍스트(제목+훅+가사)에 `kidsLyricSafetyIssues(text)`(화이트리스트 없이, 블랙리스트만)를 직접 실행 — **위반 0건**. 공포/폭력/외모 평가/성인 로맨스/브랜드 패턴 전부 클린. 손수 작성된 콘텐츠 풀 자체는 안전합니다.

**화이트리스트 실사용 시뮬레이션(신규 발견)**: 같은 108곡에 각 채널의 그럴듯한 연령대(t1/t2/t3)를 하나씩 배정해 `kidsLyricSafetyIssues(text, whitelist)`를 실행 — **108/108(100%) "위반"**. 원인을 직접 추적한 결과:
- `composeKidsLyrics`가 만드는 도입부 문장 자체("○○ 노래를 시작해요" / "○○ の うたを はじめよう")가 어느 티어의 화이트리스트에도 없는 단어를 포함합니다.
- 각 티어의 whitelist(`data/kidsVocabularyWhitelist.ts`)는 티어별로 다른 어휘를 담고 있는데(T1=자장가/가족, T2=색깔/탈것, T3=학교/계절), `composeKidsLyrics`의 8주제 콘텐츠 풀은 **어느 티어를 겨냥한 것인지 애초에 구분돼 있지 않습니다**(§1의 ageTier 미연결과 같은 근본 원인) — 그래서 어느 티어로 검사해도 "그 티어 것이 아닌" 단어가 섞여 나옵니다.
- 이 발견의 의미: "화이트리스트가 연결 안 됐다"와 "화이트리스트를 그냥 연결하면 된다"는 다른 이야기입니다. 지금 상태로 연결하면 정상적인 동요까지 전부 차단하는 게이트가 되므로, 실제로 쓰려면 (a) 콘텐츠 풀을 티어별로 나누거나 (b) 화이트리스트 자체를 콘텐츠 풀 실측 어휘에 맞게 다시 만드는 선행 작업이 필요합니다.

---

## 4. TASK F — 실제 가사 읽기 (의도 반영도)

4개 컨셉으로 직접 생성해 가사 전문을 읽었습니다: "자기 전 편안한 자장가"(kr-kids lullaby), "친구와 사이좋게 지내는 법"(kr-kids habit), "ねむる前のやさしい子守唄"(jp-kids oyasumi), "げんきに体を動かす体操の歌"(jp-kids taiso).

**결과**: 4개 컨셉 모두 실제 생성된 가사 주제가 컨셉과 무관했습니다 — "자장가" 컨셉에서 비눗방울/그네/숫자 세기(활기찬 놀이) 가사가, "체조" 컨셉에서 블록 쌓기/가족 사랑/히라가나 배우기 가사가 나왔습니다. §0-2에서 설명한 대로 `frameIdForConceptText`가 동요 컨셉 어휘를 인식하지 못하고, 애초에 8주제 자체에 무드 축이 없어서 발생하는 구조적 문제입니다.

**안전성 자체는 문제없음**: 읽은 15곡(각 컨셉 3곡×4+α) 전부 아동에게 부적절한 내용 없음 — 가족애("엄마 아빠 사랑해요"/"おかあさん おとうさん だいすきだよ"), 숫자 놀이, 놀이터 활동 등 전부 무난하고 안전한 내용. 문제는 안전성이 아니라 **채널이 약속한 것(차분한 자장가)과 실제로 나오는 것(활기찬 놀이송)이 다르다**는 정합성 문제입니다.

---

## 5. TASK D — 워크스페이스 격리 재확인

`npx tsx scripts/isolationAudit.ts` 실행, kr-kids/jp-kids 행만 발췌:

- L1(장르 격리): PASS, 외부 노출 0건 (양쪽 다)
- L3(가사 구도 격리): **SKIP** — "이 아키타입 전용 가사 구도 0개"라는 스크립트 메시지가 뜨지만, 원인을 `scripts/isolationAudit.ts:135`에서 직접 확인했습니다: `checkL3()`가 `suitedCount`를 셀 때 **`adultLyricThemes` 배열만** 검사하고 `kidsLyricThemes`(kr-kids/jp-kids의 실제 22/23개 전용 씬이 있는 배열)는 아예 보지 않습니다 — kids 아키타입은 `adultLyricThemes`에 하나도 없으니 항상 0으로 집계되어 SKIP이 뜹니다. **이건 실제 콘텐츠 격차가 아니라 감사 스크립트 자체의 사각지대입니다** — §1에서 확인했듯 22/23개의 전용 씬이 실제로 존재하고 정상 스코핑돼 있습니다. `isolationAudit.ts`를 고치는 것은 이번 감사 범위 밖이라 손대지 않았습니다.
- L4(어휘 격리): PASS, 언어 기본 어휘와 교집합 0건
- L6(썸네일 아키타입): PASS, 전용 4개 확인

## 6. 하지 않은 것 / 확실히 안 고친 것

- kr-kids/jp-kids의 `defaultAudienceProfileId`/ChannelSoundFloor/AudienceProfile 실연결 — v5.7에서 명시적으로 범위 밖이었고 이번에도 건드리지 않음.
- 채널 프리셋(`defaultVocal`/`preferredMoods`)의 §0-1 문제, 컨셉-주제 매칭 §0-2 문제, 화이트리스트 §0-3 문제 — **전부 보고만 하고 고치지 않았습니다.**
- senior-oldpop, kr-2030, jp-2030, kr-idol-male/female — 이번 감사 대상 아님, 건드리지 않음.

## 7. 미검증 항목

- 실제 Suno 렌더링(음원)은 로컬/스크립트로 검증 불가 — 텍스트/메타데이터 레벨 검증만 수행했습니다.
- 브라우저를 통한 UI 단(채널 선택, 관문1/2 등) 실측은 이번 감사에서 수행하지 않았습니다 — 로컬 생성 파이프라인 실행 결과만 확인했습니다.
- 25개 이상 컨셉/시드 조합에 대한 전수 조사는 하지 않았습니다 — 각 채널당 대표 컨셉 1-2개, 총 6채널 × 18곡(108곡) + 스케일 테스트 표본으로 검증했습니다.
