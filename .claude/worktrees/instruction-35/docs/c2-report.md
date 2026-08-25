# TASK C2 — 일본 2030 워크스페이스: 가사 세계 · 훅 · 일본어 처리 · UI (보고서)

- 대상 워크스페이스: `jp-2030`
- 기준 커밋: `201a4c6` (v4.1 TASK A2)
- 의존: C1(완료), A3
- 검증 방식: 이 문서의 모든 수치·목록은 실제 `generateLocalBlueprint`/`matchConceptRules`/`npx vitest run`/`npx tsc --noEmit` 실행 결과입니다. 코드를 읽고 추론한 값이 아닙니다.

## 요약

| 층 | 상태 |
|---|---|
| ⑥ 가사 구도 (§3) | **완료** — 18종, 폴백 없음, 외부 혼입 0건 |
| ⑧-1 훅 뱅크 (§4) | **완료** — 신규 파일 + **§0-3에 없던 6번째 누출 경로(premium 훅뱅크) 추가 발견 및 수정** |
| ⑧-2 제목 (§5) | **완료, 코드 변경 0줄** — 일본어는 §4의 결과, 영어는 v4.2에서 이미 아키타입-무관 구조로 대체돼 있었음 |
| ⑧-3 썸네일 (§6) | **완료** — 신규 3종, 기존 19종 무변경 |
| ⑦ 컨셉 키워드 (§7) | **완료** — 신규 9개 규칙, 회귀 발견 즉시 수정(§7-5) |
| 일본어 처리 (§8) | **조사·보고만** — 코드 변경 없음 (지시대로) |
| 채널 프리셋 · UI (§9) | **완료** — 신규 3종, `ready: true` |

**§0-2의 18개 제목과 겹침: 0/18.**

---

## [1] jp-2030 18곡 제목 전문 (§0-2 형식)

채널: 「帰り道に聴く令和J-POP」, 아키타입 `jp-2030-pop`, 가사 언어 일본어.

```
 1. 花火をそっと温めて          10. 自分を信じて、青春へ
 2. 朝をまだ間に合う            11. 朝をここから始める
 3. 朝をまだ探している          12. 前を向いて、青春へ
 4. 走り出して、青春へ          13. 顔を上げて、青春へ
 5. 改札をそっとつけて          14. 雪道をここまで来た
 6. 声を上げて、青春へ          15. 制服をそっと持って
 7. 諦めないで、青春へ          16. 黒板をそっとつけて
 8. 雪道をまだ間に合う          17. 黒板をそっと温めて
 9. 改札をそっと持って          18. 朝をここまで来た
```

**§0-2의 18개(ラジオをつけて/レコードをかけて/セーターを着て/待っていて、友よ 등)와 한 개도 겹치지 않습니다.** 花火(불꽃놀이)/改札(개찰구)/制服(교복)/黒板(칠판)/青春(청춘) 등 §4에서 새로 만든 jp2030 전용 어휘가 제목에 그대로 반영됐습니다.

고유 제목 18/18, 고유 훅 18/18.

---

## [2] jp-2030 가사 전문 2곡 (1번, 18번 트랙)

**1번 트랙** (구조: cold-open, 듀엣):
```
[duet vocal]
[cold open]
花火をそっと温めて

[verse 1: male vocal]
このクリスマスの角で
世界はゆっくりやさしく動き

[pre-chorus: female vocal]
長く抱えていた気持ちを
今こそ伝えよう

[chorus: male and female duet]
どんな時も落ち着いて
花火をそっと温めて
散らばった気持ちさえ
夕方のように、止まった場所へ戻る
...(중략, 전체 8섹션)
```

**18번 트랙**:
```
[male vocal]
[instrumental hook]
(instrumental hook, band plays the melody, no lyrics, 2 bars)

[verse 1]
クリスマス色の下で
街全体が目を覚まし
...(중략)

[chorus]
前よりも明るく
折りたたまれた瞬間さえ
静かな戸口のように、扉のように開く
朝をここまで来た
```

**주의 — 미리 알려드립니다**: 두 곡 모두 "クリスマス"(크리스마스) 이미지가 등장합니다. jp2030 훅/가사 구도가 아니라 검증 스크립트가 쓴 `tests/fixtures.ts`의 **`testSeason` 고정값이 'christmas'**이기 때문입니다(B2/시니어 등 이 저장소의 모든 테스트가 공유하는 값 — jp2030 고유 문제 아님). 실제 채널에서는 사용자가 고른 시즌이 반영됩니다.

---

## [3] 가사 구도 18종 전문

| id | labelKo | frameId | scene(요약) |
|---|---|---|---|
| jp2030-graduation-farewell | 졸업식 이별 | school-memory | 졸업식, 우는 친구들, 현실이 된 미래 |
| jp2030-summer-festival-crowd | 여름 축제의 인파 | festival-crowd | 유카타, 불꽃놀이, 인파 속에서 친구를 놓침 |
| jp2030-cherry-blossom-goodbye | 벚꽃 아래의 작별 | seasonal-marker | 이사 전날, 벚꽃길, 조용한 친구 |
| jp2030-autumn-leaves-solo-walk | 단풍길 혼자 걷기 | seasonal-marker | 힘든 한 주 뒤 혼자 걷는 단풍길 |
| jp2030-first-snow-wish | 첫눈에 비는 소원 | seasonal-marker | 기차 창밖 첫눈, 작은 소원 |
| jp2030-unreachable-voice | 닿지 않는 목소리 | parallel-world | 멀어지는 사람을 부르지만 닿지 않음 |
| jp2030-parallel-life-what-if | 평행세계의 나 | parallel-world | 다른 선택을 한 평행세계 상상 |
| jp2030-inner-monologue-midnight | 한밤의 혼잣말 | inner-monologue | 자정, 못다 한 말을 혼자 되뇜 |
| jp2030-confession-to-the-mirror | 거울 앞의 고백 연습 | inner-monologue | 내일 할 말을 거울 앞에서 연습 |
| jp2030-diary-page-unsent | 부치지 못한 마음의 페이지 | inner-monologue | 보여주지 못할 일기장에 마음을 씀 |
| jp2030-determined-stage-entrance | 무대로 향하는 결심 | narrative-arc | 무대 오르기 직전, 전부 쏟기로 결심 |
| jp2030-getting-back-up | 다시 일어서는 순간 | narrative-arc | 공개 실패 후 다시 신발끈을 묶음 |
| jp2030-forward-to-tomorrow | 내일을 향해 걷기 | narrative-arc | 새벽 역으로, 캐리어를 끌고 떠남 |
| jp2030-just-as-i-am | 있는 그대로의 나 | self-affirmation | 어색한 웃음을 숨기지 않기로 함 |
| jp2030-okay-to-mess-up | 실수해도 괜찮아 | self-affirmation | 발표 중 말이 꼬여도 함께 웃어넘김 |
| jp2030-todays-main-character | 오늘은 내가 주인공 | self-affirmation | 평범한 토요일을 주인공처럼 걷기 |
| jp2030-late-night-convenience-store | 새벽 편의점 | solitary-room | 새벽 3시 편의점, 고요한 마을 |
| jp2030-coastal-highway-drive | 바닷가 국도 드라이브 | night-drive | 동트기 전 해안도로, 창문을 내리고 |

**빈도**: seasonal-marker 3 / inner-monologue 3 / narrative-arc 3 / self-affirmation 3 / parallel-world 2 / school-memory 1 / festival-crowd 1 / solitary-room 1 / night-drive 1 — **9종 (기준 ≥8 충족)**, 최대 3개(기준 ≤4 충족).

### B2 한국 18종과 frameId 비교

| 한국(B2) frameId | 개수 | 일본(C2) frameId | 개수 | 공유 여부 |
|---|---|---|---|---|
| commute-transit | 3 | seasonal-marker | 3 | 고유 |
| solitary-room | 4 | inner-monologue | 3 | — |
| threshold-decision | 3 | narrative-arc | 3 | — |
| two-people-talk | 3 | self-affirmation | 3 | 고유 |
| night-drive | 1 | parallel-world | 2 | — |
| reunion-passing | 2 | school-memory | 1 | 고유 |
| screen-memory | 1 | festival-crowd | 1 | 고유 |
| crowd-alone | 1 | **solitary-room (공유)** | 1 | 공유 |
| — | — | **night-drive (공유)** | 1 | 공유 |

**공유 2종(solitary-room, night-drive) / 기준 ≤4 충족.** 한국이 "통근·원룸·둘의 대화" 축인 반면 일본은 "계절·내면 독백·서사·자기긍정" 축으로 실측 대비됩니다 — §3-3이 요구한 대립축이 실제로 나타났습니다.

---

## [4] jp2030Override 전문 6개 배열

```ts
imperativeObjects: ['改札を', '自転車を', '目覚ましを', '上履きを', '部室の鍵を', '花火を', '制服を', '自動販売機を', '通学バッグを', '自転車の鍵を', '教室の窓を', '黒板を']
nounModifiers: ['夏の終わりの', '放課後の', 'まぶしい', '汗ばんだ', '制服姿の', '帰り道の', '教室の', '部活帰りの', '陽だまりの', '通学路の', '夏祭りの', '卒業間際の']
nounObjects: ['改札口', '自転車のカゴ', '教室の窓', '部室', '夏祭りの灯り', '通学路', 'ホームの端', '黒板', '自販機の灯り', '花火の音', '制服のリボン', '校庭']
vocativeLeads: ['前を向いて', '一歩踏み出して', '諦めないで', '顔を上げて', '走り出して', 'まっすぐ進んで', '声を上げて', '自分を信じて']
vocativeAddressees: ['青春へ', '未来の私へ', 'まだ迷う私へ', '明日の自分へ', 'あの日の私へ', '今日の主人公へ', '十代の私へ', '走り続ける君へ']
declarativeStems: ['まだ諦めていない', 'ここから始める', '前だけを見ている', 'きっと変えてみせる', 'まだ探している', 'ここまで来た', 'まだ間に合う', 'きっと届くと思う']
```

표기 판단: 상용 학교/청춘 어휘(改札/自転車/教室/制服/黒板/部室) 위주, 한자·히라가나 비율이 令和 J-POP 가사 관행과 부합합니다. 후리가나가 필요할 만큼 어려운 한자는 없습니다. 유행어(SNS 신조어 등)는 넣지 않았습니다.

`overrideForArchetype('jp-2030-pop', 'japanese')` ∩ `japaneseDefault`(시니어) 6개 필드 전부 **교집합 0**. ∩ `showaCafeOverride('japanese')` 6개 필드 전부 **교집합 0** (실측, 스크립트로 확인 — §10 표 참고).

---

## [5] 시니어 재생성 결과

### 시니어 18곡 (`tests/seniorBaseline.test.ts`)
**14/14 통과, C2 착수 전과 동일한 값** (평균 유사도 0.362, 최대 0.655, BPM 표준편차 13.42, 프롬프트 길이 715/786/898, 고유 제목 18/18 — G1이 저장한 그 기준선 그대로).

### showa-cafe (朝の昭和喫茶) 18곡 제목
```
1. 茶碗をそっと温めて       10. 朝を今も思い出す
2. ゆっくり数えて、友よ     11. 朝をまだ漂っている
3. 私と漂って、あなたへ     12. 時を戻して、古い友へ
4. 朝を深く刻んでいる       13. 時を戻して、朝よ
5. 雪道を今も思い出す       14. あの頃にいて、朝よ
6. 雪道を今も巻き戻す       15. 電蓄をそっと温めて
7. 茶碗をそっと持って       16. 街灯をそっとつけて
8. 朝を今も巻き戻す         17. 時を戻して、愛しい人
9. 街灯をそっと持って       18. 街灯をそっと温めて
```
쇼와 어휘(茶碗/電蓄/街灯/時を戻して) 정상 유지.

### showa-70s (昭和セブンティーズ) / j2000s (ミレニアムJ-POP)
각 18곡 실측 완료 — showa-70s는 showa-cafe와 동일 사전(電蓄/街灯/雪道), j2000s는 시니어 기본 사전(手紙/写真/傘/窓) 그대로 유지. **premiumBankFor 수정이 세 채널 모두에 영향을 주지 않았음을 실측으로 확인** (전문은 §13 첨부 파일 참고, 지면상 요약).

---

## [6] kr2030 18곡 재생성 결과 (B2 회귀 확인)

```
1. 너를 조금씩 알아가요        10. 한숨 돌려요, 서른의 나
2. 한숨 돌려요, 지친 나        11. 너를 견뎌내고 있어요
3. 한숨 돌려요, 오늘의 나      12. 잠깐 멈춰서요, 지친 나
4. 천천히 알람을 데워요        13. 너를 버텨내고 있어요
5. 조금 더 담배를 데워요       14. 천천히 알람을 켜둬요
6. 가만히 담배를 챙겨요        15. 한 번 더 알람을 켜둬요
7. 우리를 다시 마주해요        16. 그 날을 다시 마주해요
8. 눈길을 다시 마주해요        17. 한 번 더 알람을 챙겨요
9. 조금만 버텨요, 지친 나      18. 오늘만 버텨요, 지친 나
```
B2 고유 어휘(알람/담배/서른의 나/지친 나) 그대로 유지. **회귀 없음.**

---

## [7] 컨셉 매칭 회귀 비교표

| 컨셉 | C2 이전(기대) | C2 이후(실측) | 회귀 |
|---|---|---|---|
| 아침 카페 | [cafe] | [cafe] | 없음 |
| 추억의 라디오 | [] | [] | 없음 |
| 첫눈 | [winter] | [winter] | 없음 |
| 오래된 우정 | [] | [] | 없음 |
| 비 오는 밤 | [rain] | [rain] | 없음 |
| 퇴근 후 감성 밴드팝 | [kr2030-after-work] | [kr2030-after-work] | 없음 |
| 서른의 밤, 다시 걷게 하는 노래 | [kr2030-thirty-something] | [kr2030-thirty-something] | 없음 |
| 비 오는 서울 야경 플레이리스트 | [kr2030-studio-seoul, rain] | [kr2030-studio-seoul, rain] | 없음 |

**§7-5 (개발 중 발견 및 즉시 수정)**: 최초 설계한 `jp2030-band-emotional` 규칙이 `/밴드/`(맨 한글) 패턴을 썼는데, 이게 "퇴근 후 감성 밴드팝"(kr2030 컨셉)에도 매칭돼 실제로 회귀가 발생했습니다. 일본어 스크립트 전용 패턴(`/バンド/`, `/泣きたい/`)으로 좁혀 수정 — 위 표는 수정 후 최종 결과입니다.

| jp2030 채널 프리셋 문구 | 매칭 규칙 |
|---|---|
| 帰り道に聴く令和J-POP | [jp2030-reiwa-youth, jp2030-way-home] |
| 夜の東京メロディックポップ | [jp2030-citypop] |
| 少し泣きたい日のバンドプレイリスト | [jp2030-band-emotional] |

3/3 매칭 확인.

---

## [8] `npx tsx scripts/isolationAudit.ts` 실행 결과 전문

```
[L1] jp-2030 / jp-2030-pop  PASS  대상 7개 장르, 외부 노출 0건
[L3] jp-2030 / jp-2030-pop  PASS  전용 구도 18개, 폴백 없음, 외부 혼입 0건
[L4] jp-2030 / jp-2030-pop  PASS  고유 override 확인, 언어 기본 어휘와 교집합 0건
[L6] jp-2030 / jp-2030-pop  PASS  전용 3개 확인, 부적합 노출 0건(기존 무제한 19종 별도)
[L7] senior-oldpop          PASS  시니어 컨셉 5개 매칭 결과 스냅샷과 동일

요약: PASS 33 / FAIL 3 / SKIP 15
```

FAIL 3건은 전부 `senior-oldpop` 내부(modern-chill/city-night/oldpop-lounge 훅뱅크 미비) — G1 문서가 이미 "이 워크스페이스 격리 작업 범위 밖"으로 판정한 **기존(C2 이전) 이슈**이며 jp-2030과 무관합니다. **jp-2030은 L1/L3/L4/L6 전부 SKIP→PASS로 전환**(C1 직후엔 전부 SKIP이었음, §14의 목표 그대로).

---

## [9] TASK B2(kr-2030) 대비 새로 발견한 것 — §0-3에 없던 6번째 누출 경로

§4 작업 중, jp2030Override를 0-교집합으로 완전히 구현하고 switch에 case까지 추가했는데도 **18/18 제목이 여전히 시니어 어휘**였습니다(ラジオをつけて/レコードをかけて 등, §0-2와 완전히 동일). 원인 추적 결과 `lyricEngine.ts`의 `premiumBankFor()` — 손으로 쓴 프리미엄 훅이 조합형 어휘보다 항상 먼저 시도되는 함수 — 의 제외 목록에 **`kr-2030-pop`은 있는데 `jp-2030-pop`이 빠져 있었습니다.** 이건 B2가 실측으로 찾아 고친 바로 그 메커니즘("premium first, then archetype-scoped combinatorial layer")인데, B2 본인이 `kr-2030-pop`만 추가하고 `jp-2030-pop`은 (당시 존재하지 않았으므로) 추가하지 못했던 것입니다. `kr-2030-pop`과 동일한 방식으로 `jp-2030-pop`을 추가해 해결했습니다(§10의 9번 항목).

---

## [10] 완료 판정 수치표 (§10, 27개 항목)

| # | 항목 | 기준 | 현재값 | 완료값 |
|---|---|---|---|---|
| 1 | jp2030 가사 구도 개수 | ≥18 | 0 | **18** |
| 2 | 구도 전부 suitedArchetypes | 18/18 | 0 | **18/18** |
| 3 | 풀에 시니어 테마 혼입 | 0 | 80 | **0** |
| 4 | 서로 다른 frameId | ≥8 | 0 | **9** |
| 5 | B2 프레임과 재사용 | ≤4 | — | **2** (solitary-room, night-drive) |
| 6 | ∩ japaneseDefault | 0 | 전부 동일 | **0** (전 필드) |
| 7 | ∩ showaCafe override | 0 | — | **0** (전 필드) |
| 8 | 오버라이드 필드 수 | 6/6 | 0 | **6/6** |
| 9 | vocativeAddressees 오버라이드 | 있음 | 없음 | **있음** |
| 10 | 18곡 훅/제목 중복 | 0/0 | — | **0/0** |
| 11 | §0-2 18개와 겹침 | 0 | 18 | **0** |
| 12 | 신규 썸네일 아키타입 | 3 | 0 | **3** |
| 13 | 신규 3종 suitedArchetypes | 3/3 | — | **3/3** |
| 14 | 기존 19종에 suitedArchetypes 추가 | 0건 | 0 | **0건** |
| 15 | 컨셉 프리셋 3종 매칭 | 3/3 | 0/3 | **3/3** |
| 16 | 시니어 컨셉 5종 매칭 변화 | 0건 | — | **0건** |
| 17 | B2 한국 컨셉 3종 매칭 변화 | 0건 | — | **0건**(1건 발견 즉시 수정, §7-5) |
| 18 | 신규 채널 프리셋 | 3 | 0 | **3** |
| 19 | 신규 프리셋 archetype/market | 3/3 | — | **3/3** |
| 20 | j2000s 풀 크기 | 12(불변) | 12 | **12** |
| 21 | showa-cafe 풀 크기 | 18(불변) | 18 | **18** |
| 22 | JP_2030.ready | true | false | **true** |
| 23 | audit:isolation의 jp-2030 | PASS | SKIP | **PASS**(L1/L3/L4/L6 전부) |
| 24 | seniorBaseline.test.ts | 통과 | — | **통과**(14/14) |
| 25 | git diff 기존 행 수정·삭제 | 0건 | — | **실질 0건**(§11 참고 — 배열/유니온 확장 시 마지막 줄이 diff상 -/+로 표시되는 형식적 케이스 3건 + jp-2030 자신의 워크스페이스 정의 갱신 1건, 전부 §0-1 허용 범위) |
| 26 | MIN/MAX_LYRIC_WORDS | 175/205 불변 | 175/205 | **175/205 (불변, 미수정)** |
| 27 | 신규 오디언스 프로파일 | 0 (A3) | 0 | **0** |

---

## [11] `git diff --stat` 및 실질 변경 설명

```
$ git status --short
 M src/core/lyricEngine.ts
 M src/data/conceptKeywords.ts
 M src/data/hookBanks/index.ts
 M src/data/lyricThemes.ts
 M src/data/presets.ts
 M src/data/thumbnailArchetypes/index.ts
 M src/data/thumbnailArchetypes/types.ts
 M src/data/workspaces/index.ts
 M tests/thumbnailArchetypes.test.ts
 M tests/workspaces.test.ts
?? src/data/hookBanks/jp2030.ts
?? src/data/thumbnailArchetypes/jp2030CityNight.ts
?? src/data/thumbnailArchetypes/jp2030Seasonal.ts
?? src/data/thumbnailArchetypes/jp2030StationPlatform.ts
```

`git diff -U0 | grep '^-' | grep -v '^---'` 결과, 진짜 "삭제/변경"은 다음 4가지뿐입니다 — 전부 정직하게 설명합니다:

1. **`lyricEngine.ts`**: `premiumBankFor`의 제외 조건 한 줄이 `|| archetype === 'jp-2030-pop'`가 추가되며 통째로 재작성된 것으로 표시됩니다. §9에서 설명한 실제 필요 수정(B2가 kr-2030-pop에 한 것과 동일 패턴) — 다른 어떤 아키타입의 동작도 바뀌지 않았음을 실측 확인(§5의 시니어 일본 채널 3종 + 시니어 18곡 재생성).
2. **`thumbnailArchetypes/index.ts`**: 배열의 마지막 원소가 `...kr2030ThumbnailArchetypes` 하나였다가 그 뒤에 `...jp2030ThumbnailArchetypes`가 추가되며 그 줄이 diff상 재작성으로 표시됩니다. 순수 추가.
3. **`thumbnailArchetypes/types.ts`**: 유니온 타입의 마지막 멤버(세미콜론 위치)가 새 멤버 추가로 이동하며 재작성으로 표시됩니다. 순수 추가.
4. **`workspaces/index.ts`**: `JP_2030`은 **이 워크스페이스 자신의 정의**이므로 `descriptionKo`/주석/`ready`를 갱신하는 것 자체가 이 문서의 본연의 작업입니다(§9-2 명시적 요구). 시니어(`SENIOR_OLDPOP`)나 한국(`KR_2030`) 정의는 손대지 않았습니다.

`tests/thumbnailArchetypes.test.ts`/`tests/workspaces.test.ts`는 **기존 테스트의 기댓값을 "실제 값에 맞춰" 조정**한 게 아니라, 이 문서가 실제로 완료한 새 상태(썸네일 25종, jp-2030 ready=true)를 반영한 것입니다 — B2가 처음 kr-2030을 완료했을 때도 정확히 같은 이유로 같은 테스트들을 갱신했습니다(주석에 남아있는 "TASK B2" 표시가 그 증거).

---

## [12] 미구현 항목

**명시적으로 미구현입니다:**
- 일본어 가나·한자·후리가나 자동 변환/검증 엔진 — §8-1 지시대로 만들지 않았습니다. 사전에 최종 표기를 직접 넣는 방식으로 대체.
- 일본어 SRT 개행(禁則処理) 처리 — §8-3 지시대로 손대지 않았습니다.
- A3 담당 항목 전부 (오디언스 프로파일, 킬링포인트 사전, 구조 템플릿 엔진, songLengthRange/arcModelId/템포 밴드) — §2-2 명시대로 미착수.

---

## [13] 결정 대기 항목 (§13-4)

| 항목 | 실측값 | 비고 |
|---|---|---|
| 가사 길이 지표 (§8-2) | 로컬 생성 실측: 33-50 단어(공백분리) / 352-506자(공백제외). `MIN_LYRIC_WORDS=175`/`MAX_LYRIC_WORDS=205`는 이 값과 무관한 영어 기준 상수로, 원격 AI 프롬프트에 그대로 "175-205 words" 문구로 들어감. | 시니어 일본 채널 3종도 동일한 상수를 공유하므로, 고치면 그 세 채널의 원격 생성 결과가 바뀝니다. **하루 님 결정 필요**: (1) 그대로 둔다 (2) 언어별 분기를 만든다 — 후자는 시니어 일본 채널 재검증 필요. |
| SRT 일본어 금칙 처리 (§8-3) | `srtExport.ts`는 `/\r?\n/` 단순 분할, 금칙 처리 0건. 시니어 일본 채널과 공유하는 기능. | 미결정 |
| 애니풍 썸네일 IP 판단 (§6-4) | 신규 3종(seasonal/station-platform/city-night)에 "애니풍"을 넣지 않았습니다 — 특정 작품·화풍 연상 판단이 어려워 §6-4 지시대로 만들지 않음. | 미구현(IP 판단 필요) |
| artistName (§9-3) | B2가 kr-2030 3개 프리셋 전부에서 미설정(undefined)으로 남겼으므로, jp-2030도 동일하게 undefined 유지. | 미결정, B2와 동일 상태 |

---

## [14] A3로 넘길 항목

- `jp-2030-*` 오디언스 프로파일 신설
- `AudienceProfile` 스키마가 jp-2030 특화 축(songLengthRange/arcModelId/템포 밴드)을 필요로 하는지 판단
- `KP-SET-jp2030` 킬링포인트 사전
- A메로·B메로·사비 구조 템플릿 엔진 (C1/C2는 장르 서술로만 다룸, 실제 구조 생성 로직은 미착수)
- `matchConceptRules()`에 workspace 인자를 추가하는 것 (§7의 genreWeights 필터링만으로 현재는 충분했음 — 실제로 회귀 없이 동작 확인됐으므로 시급하지 않으나, A3가 판단할 사안)
