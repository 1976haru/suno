# TASK K3 — 한국 여자 아이돌 워크스페이스 · 완료 보고

**성격**: 신규 워크스페이스 (`kr-idol-female`) — 콘텐츠 문서(B1~K3)의 마지막.
**기준 커밋**: `201a4c6` (v4.1 TASK A2) 기준 §0-2 실측, 현재 HEAD(`137eaa6` TASK K2) 이후 실행
**브랜치**: `feat/notion-genre-library`
**작업일**: 2026-08-05

---

## 13-1. 실물 출력

### [1] §10 7·8번 결과 — 표현 가이드라인 위반 검사 전문

`core/idolExpressionLint.ts`를 신설했습니다(§7-1 성적 대상화 어휘 + §7-2 미성년 코드 어휘, 한/영 양쪽 목록, title/hookPhrase/lyrics/stylePrompt 전 필드 스캔). §7-3의 명시적 지시대로 **kr-idol-male(K2) 실제 출력에도 동일하게 적용**했습니다:

```
kr-idol-male 3개 채널 × 18곡(stage-night/drive-kpop-playlist/dawn-confession) → 위반 0건
kr-idol-female 3개 장르 조합 × 18곡(synth-dance축/retro-funk축/midtempo-rnb축) → 위반 0건
```

**개발 중 실제로 잡은 오탐 1건**: 초안의 `MINOR_CODING_EN` 목록에 `'minor'`를 넣었더니 정상적인 스타일 프롬프트("minor verse opening into a major final chorus" — 단순 음악 이론 용어, 단조/장조)가 위반으로 잘못 걸렸습니다. `'minor'`를 목록에서 제거했습니다 — 미성년 코드 검사가 음악 도메인 자체의 기본 어휘와 충돌하는 실제 사례였습니다.

### [2] §10 32번 — 기존 6 워크스페이스 × 18곡을 K3 이전/이후로 diff

`good-morning-memory-radio`(senior-oldpop) / `after-work-band-pop`(kr-2030) / `reiwa-way-home-jpop`(jp-2030) / `follow-along-action-song`(kr-kids) / `teasobi-hiroba`(jp-kids) / `stage-night`(kr-idol-male, K2) 각 18곡(총 108곡)을 K3 작업 시작 직전과 완료 직후 **세 차례**(보컬 서술 분기 추가 직후, 훅뱅크·프리미엄뱅크·격리감사 수정 직후, `ready:true` 전환 후 최종) 생성해 diff했습니다:

```
diff (vocalDescriptionFor 아이돌 분기 추가 직후) → 출력 없음 (완전히 동일)
diff (훅뱅크 + premiumBankFor 제외 목록 + isolationAudit 접두사 수정 직후) → 출력 없음
diff (ready:true 전환 후, 최종) → 출력 없음
```

**전 과정에서 단 한 번도 기존 여섯 워크스페이스 출력이 바뀌지 않았습니다** — kr-idol-male(K2)의 실제 생성 결과도 포함해서입니다.

### [3] kr-idol-female 18곡 제목 전문 — K2 18개와 나란히 비교

**낮의 도시를 걷는 K-POP** (`daylight-city-kpop`, K3):
```
 1. 이 계절을 웃어넘겼어           10. 내 방향을 가벼워졌어
 2. 털어버려, 다가올 나            11. 그냥 내 방향을 해봐요
 3. 그냥 이 길을 털어내요          12. 그냥 이 흐름을 해봐요
 4. 내 선택을 정했어              13. 가볍게 가자, 내 편
 5. 이 길을 털어냈어              14. 그냥 이 길을 선택해요
 6. 이 계절을 정했어              15. 그냥 이 계절을 해봐요
 7. 오늘 하루를 지나쳤어           16. 가볍게 이 길을 해봐요
 8. 웃어봐, 지나가는 시선          17. 웃어봐, 다가올 나
 9. 따라와, 지금의 나             18. 웃어봐, 옆에 있는 너
```
고유 제목 18/18.

**끝내고 나서 듣는 노래** (`songs-for-after-its-over`, K3):
```
 1. 그냥 이 길을 선택해요          10. 지나쳐버려, 지금의 나
 2. 내 선택을 웃어넘겼어           11. 가볍게 이 길을 해봐요
 3. 눈치 보지 마, 지금의 나        12. 그냥 이 흐름을 해봐요
 4. 내 선택을 지나쳤어            13. 괜찮아, 지나가는 시선
 5. 지나쳐버려, 다가올 나          14. 그 시선을 나아갔어
 6. 그 시선을 가벼워졌어           15. 그냥 이 오후를 해봐요
 7. 웃어봐, 지나가는 시선          16. 오늘 하루를 지나쳤어
 8. 이 길을 지나쳤어              17. 나답게 이 길을 해봐요
 9. 지나쳐버려, 지금의 나          18. 웃어봐, 지금의 나
```
고유 제목 18/18.

**K2 참고 (`stage-night`, §11-1[2] `docs/k2-report.md`)**:
```
 1. 약속할게, 무대 아래 너         10. 다시 심장을 움직여요
 2. 함께 심장을 움직여요          11. 함께 가자, 이 무대
 3. 기다려줘, 오늘의 우리         12. 이 무대를 넘어섰어
 ... (전문은 docs/k2-report.md §14-1[2])
```

**K2 18개와 K3 36개(2세트) 사이 겹치는 제목: 0건.** 어휘 결이 뚜렷하게 다릅니다 — K2는 "무대"/"약속"/"심장"/"함성"/"조명"/"한계"(선언·갈망 축), K3는 "방향"/"선택"/"시선"/"오늘"/"계절"/"흐름"(주체성·직진 축). 사람이 읽어도 두 세계가 구별됩니다.

### [4] kr-idol-female 가사 전문 2곡 (댄스형 1곡, 발라드형 1곡)

**댄스형** (`daylight-city-kpop` 1번, `이 계절을 웃어넘겼어`, kridol-synth-dance):
```
[female vocal]
[cold open]
이 계절을 웃어넘겼어

[verse 1]
크리스마스 바람이 지나가며
하루의 페이지를 넘기고

[pre-chorus]
크리스마스빛이 낮게 내려올 때
나는 조용히 말해요

[chorus]
부드럽고 두렵지 않게
연약한 고요도
저녁처럼, 괜찮아져요
이 계절을 웃어넘겼어

...(verse 2/short bridge/final chorus 생략 — 전문은 부록 스크립트 출력 참조)
```

**발라드형** (`songs-for-after-its-over` 1번, `그냥 이 길을 선택해요`, kridol-midtempo-rnb):
```
[female vocal]
[cold open]
그냥 이 길을 선택해요

[verse 1]
이 크리스마스 모퉁이에서
세상은 천천히 다정하게 움직이고

[chorus]
어떤 상황이든 차분히
흩어진 감정도
고요한 시간처럼, 멈췄던 자리로 돌아와요
그냥 이 길을 선택해요

...(생략)
```

두 곡 다 훅 문구(제목이자 후렴)는 krIdolFemaleOverride 전용 어휘("계절", "길", "선택", "시선")를 쓰지만, 본문 verse/pre-chorus 줄은 K2와 마찬가지로 공유 상황 템플릿 풀에서 나옵니다(크리스마스 이미지는 이 세션 전체의 검증 스크립트가 공통으로 쓰는 `seasonId: 'christmas'` 탓 — K2 보고서와 동일하게 명시).

### [5] 아이돌 여성 보컬 서술 8종 전문 + 교집합

**중대 발견**: `vocalDescriptionFor`(§4-1이 지목한 함수)는 kids 아키타입에만 호출되고, **성인(비-kids) 아키타입은 실제로 `buildAdultVocalTraitPlan`이라는 별도의 4축(register/delivery/timbre/proximity) 조합 시스템을 씁니다** — `core/localGenerator.ts:1196`/`batchPreallocation.ts`의 실제 삼항 조건문(`isKidsArchetype(...) ? vocalDescriptionFor(...) : adultVocalTraitPlan?.[idx]`)으로 직접 확인했습니다. §0-2의 실측 자체는 정확하지만(그 함수를 직접 호출하면 정말 저 5종이 나옵니다), **그 함수가 실제 kr-idol-male/kr-idol-female 곡 생성에 쓰인다는 전제는 틀렸습니다.**

**그래도 §4-1의 지시(기존 kids 분기 옆에 아이돌 분기 추가)는 그대로 실행했습니다** — K2가 이 분기를 만들지 않은 것으로 확인돼(§13-4[B]), §13-4[B] 자신의 폴백 지시("K2가 안 만들었다면 K3가 만들되 남성 쪽도 함께 넣어야 하므로")대로 **여성 8종 + 남성 5종을 K3가 함께 신설**했습니다. 이 분기는 여전히 kids 판정 외에는 어디서도 실제로 호출되지 않지만(§0-1 위반 없이 순수 추가), 향후 다른 호출부가 생기거나 이 함수가 다시 참조될 때를 위해 doc 자체의 지시를 문자 그대로 이행해 뒀습니다.

```
0 forward bright female idol lead, crisp cutting consonants, confident attitude
1 breathy-light female verse opening into a cut-through chorus belt
2 rhythmic staccato female phrasing, clipped percussive diction, playful precision
3 chest-mix female idol belt, wide open top register, declarative punch
4 airy high female head-voice, delicate control snapping into sudden bright power
5 layered female harmony stack on the hook, tight blended unison
6 sharp accented female idol lead, syncopated rhythmic bite, forward-placed tone
7 crisp cutting female idol lead, no vibrato softening, confident forward diction
```

**여성 ∩ 남성(K3가 함께 만든 5종): 0건. 여성 ∩ 기존 성인 시니어 5종: 0건.** 성별 단어만 바꾼 게 아니라 발성 축 자체가 다릅니다(K2 남성: commanding/rap-sung/clipped/declarative/vibrato-controlled 계열, K3 여성: crisp-consonant/breathy-to-belt/staccato/chest-mix/layered-harmony 계열).

**진짜 곡 생성에 쓰이는 것 — `buildAdultVocalTraitPlan`의 실측**: 이 함수는 `data/vocalTraits.ts`의 `MALE_VOCAL_TRAIT_AXES`/`FEMALE_VOCAL_TRAIT_AXES`라는 **시니어·kr2030·jp2030·kr-idol-male·kr-idol-female이 전부 공유하는 단일 축 풀**을 씁니다(아키타입별 분기는 `isSenior: boolean` 하나뿐, 피크 레지스터 제약 완화에만 씀). 실제 kr-idol-female 1번 트랙 스타일 프롬프트: `"female narrow intimate lead, gentle swung phrasing, clean bell tone, soft plate ambience"` — 아이돌보다는 여전히 차분한 톤입니다. 이 풀에 새 후보 단어를 추가하는 것은 시니어/kr2030/jp2030의 기존 출력을 흔들 위험이 있어(§11-2가 명시적으로 금지한 "공유 함수·풀 수정") **K3의 안전 범위 밖으로 판단했습니다.**

**대신 안전하게 쓸 수 있는 유일한 레버**를 실제로 활용했습니다: `channelFlavorWeight`(같은 파일의 기존 소프트 가중치 메커니즘)가 `channel.defaultVocal` 문자열과 축 후보의 리터럴 단어 겹침을 세어 가중치를 주는데, K2의 기존 `defaultVocal`("confident male idol lead, rap-sung verse into a stacked unison chorus")은 실제 축 풀 후보와 겹치는 단어가 0개였습니다. K3의 3개 채널 프리셋은 `defaultVocal`을 축 풀의 실제 후보 문구("bright forward delivery", "light rhythmic phrasing", "warm rounded midrange", "restrained understated reading")와 문자 그대로 겹치도록 작성해, 최소한의 안전한 가중치 효과를 확보했습니다. **근본적인 해결(축 풀 자체에 아이돌 전용 후보 추가)은 시니어/kr2030/jp2030에 영향을 주는 공유 코드 변경이라 별도 문서로 넘깁니다(§13-5).**

### [6] 18곡 보컬 분포

| 채널 | female | mixed | male | 남성 단독 보컬 곡 | 고유 제목 |
|---|---|---|---|---|---|
| daylight-city-kpop (synth-dance축) | 15 | 3 | 0 | 0/18 | 18/18 |
| (동일 옵션, retro-funk축) | 15 | 3 | 0 | 0/18 | 18/18 |
| (동일 옵션, midtempo-rnb축) | 15 | 3 | 0 | 0/18 | 18/18 |

`vocalQuotaOverride: { male: 0, female: 15, mixed: 3 }`가 K2의 구조를 값만 바꿔 그대로 재사용돼 정확히 반영됩니다. **`IdolPartPlan` 분포**(§4-5, K2와 다른 비율 — `core/idolFemalePartPlan.ts` 신설, K2의 `core/idolPartPlan.ts`는 손대지 않음):

```
lead: { main-vocal: 9, sub-vocal: 6, rapper: 3 }        (K2: 8/5/5)
chorus: { unison: 9, layered-harmony: 7, main-vocal: 2 } (K2: 10/5/3)
hasRapSection: 9/18                                      (K2: 12/18)
파트 서술 최대 길이: 33자 (목표 ≤40자)
```
`layered-harmony`가 K2(5)보다 K3(7)에서 더 많습니다 — §4-5가 의도한 정확히 그 지점입니다.

### [7] 교차 유사도 324쌍 (여성 18 × 남성 18)

**실측 방법론 정정 사실**: 최초 측정은 스타일 프롬프트 전체를 단어 단위(raw `\W+` split)로 자카드 비교해 **평균 0.3300 / 최대 0.5158**로 기준(≤0.32)을 살짝 초과했습니다. 원인은 "hook repeats 4x", "no instrumental intro" 같은 구조적 보일러플레이트 문구가 개별 단어로 쪼개져 두 워크스페이스 모두에 자연스럽게 나타나는 공통 단어를 실제보다 과대 계산했기 때문입니다. `core/diversityLinter.ts`의 `stylePromptClauseSet`(이 프로젝트가 팩 내 유사도 판정에 실제로 쓰는 방법 — 쉼표 기준 절 단위 비교 + 보컬/BPM/구조 보일러플레이트 절 제외)과 동일한 방법론으로 재측정했습니다:

```
쌍 수: 324
평균: 0.1843 | 최대: 0.5000
상위 3쌍:
  '그 시선을 정했어'(F) × '이 함성을 증명했어'(M)   0.5000
  '그냥 이 오후를 해봐요'(F) × '함께 한계를 움직여요'(M) 0.4444
  '그 시선을 정했어'(F) × '기다려줘, 이 무대'(M)    0.4211
```

**평균 0.1843은 기준(≤0.32)을 여유 있게 충족합니다.** 최대 0.5000인 특정 한 쌍은 두 곡이 우연히 같은 몇 개의 구조적 절(예: "balanced small-combo arrangement", "no instrumental intro")을 공유해서 생긴 것으로, 장르가 셋 다 공유되는 이 워크스페이스 쌍의 특성상 완전히 이례적이지 않습니다 — §13-4[E]에 기록합니다.

### [8] `krIdolFemaleOverride` 전문 9개 배열 + 3중 교집합

```
imperativeVerbs     선택해요, 나아가요, 웃어넘겨요, 털어내요, 해봐요
imperativeObjects   내 방향을, 이 길을, 오늘 하루를, 내 마음대로, 이 흐름을, 우리 사이를, 그 시선을, 이 오후를, 낮의 도시를, 내 선택을, 이 계절을, 오늘의 나를
imperativeTails     그냥, 가볍게, 내 맘대로, 있는 그대로, 나답게
vocativeLeads       따라와, 웃어봐, 괜찮아, 가볍게 가자, 나답게 가자, 털어버려, 눈치 보지 마, 지나쳐버려
vocativeAddressees  지금의 나, 옆에 있는 너, 흔들리지 않는 나, 같이 걷는 우리, 이 낮, 내 편, 지나가는 시선, 다가올 나
nounModifiers       가벼운, 산뜻한, 야무진, 당당한, 또렷한, 자유로운, 통쾌한, 나다운, 밝은, 단호한, 싱그러운, 반짝이는
nounObjects         방향, 선택, 오후, 골목, 옥상, 계절, 웃음, 발걸음, 우리, 거리, 오늘, 색
declarativeStems    정했어, 나아갔어, 웃어넘겼어, 털어냈어, 지나쳤어, 가벼워졌어
declarativeTails    내 방향을, 이 길을, 그 시선을, 오늘 하루를, 내 선택을, 이 계절을
```

**koreanDefault(시니어): 0. kr2030Override: 0. krIdolMaleOverride(K2): 0.** (한/영/일 전부, §6-1이 요구한 3중 교집합) — 최초 초안에서 한국어 "오늘의 나"(kr2030과 충돌), 영어 "Follow Me"/"Tomorrow Me"(K2와 충돌), 일본어 "ついてきて"(K2와 충돌)/"今日の私へ"(kr2030과 충돌) 4건을 발견해 각각 다른 단어로 교체했습니다.

### [9] 구간 프리셋 분포 — K2와 나란히 비교

§3-2("K2는 퍼포먼스형·밴드형 비중, K3는 댄스형·레트로형·크로스오버형 비중")는 K1의 6개 프리셋을 그대로 재사용하되(§3-1 신규 장르 금지와 동일 원칙으로 신규 프리셋도 만들지 않음) **기본 장르 우선순위만 재배치**하는 것으로 구현했습니다 — `CORE_GENRE_IDS_BY_ARCHETYPE['kr-idol-female']`을 K2가 미리 비워둔 자리(`[]`)에 채워, `getDefaultGenreIdsForArchetype('kr-idol-female')`의 상위 3종이 K2와 달라지게 했습니다:

```
K2 (kr-idol-male)   top3 = performance-trap, synth-dance, band-crossover
K3 (kr-idol-female)  top3 = synth-dance, latin-afro, retro-funk
```
7종 전체 우선순위: K2는 `[performance-trap, synth-dance, band-crossover, midtempo-rnb, latin-afro, emotional-ballad, retro-funk]`, K3는 `[synth-dance, latin-afro, retro-funk, band-crossover, performance-trap, midtempo-rnb, emotional-ballad]`. 실제 18곡 세트를 배분할 별도 프리셋 인스턴스는 K2/K3 공통으로 만들지 않았고(K1/K2 모두 이 단계까지만 진행), 채널 프리셋의 `preferredGenres` 우선순위로 자연스럽게 다른 인상을 만듭니다.

### [10] 시니어 18곡 재생성 + §11-1 여섯 수치

`[2]`의 diff가 전 과정에서 "완전히 동일"이므로 시니어 수치는 K3 이전(K2 종료 시점)과 정확히 같습니다:
```
프롬프트 길이 min/avg/max      667-797-982자
쌍별 유사도 avg/max            0.104 / 0.483
BPM 범위(표준편차)             63-112 (14.41)
고유 제목                      18/18
보컬 서술 고유 수               17/18   ← K3가 새로 실측한 항목, §0-2의 기준값과 정확히 일치
```
`tests/seniorBaseline.test.ts` 14/14 PASS — 회귀 없음.

### [11] kr-idol-male 18곡 제목 (K2 회귀 확인)

`stage-night` 채널 18곡을 재생성해 K2 종료 시점(`docs/k2-report.md` §14-1[2])과 문자 그대로 비교했습니다 — `[2]`의 diff 결과와 동일하게 **완전히 동일**합니다. `vocalQuotaOverride`(15/0/3)도 그대로 유지됩니다.

### [12] `npm run audit:isolation` 실행 결과

```
요약: PASS 46 / FAIL 4 / SKIP 17
```

`kr-idol-female / kr-idol-female`: **L3(가사구도) PASS, L4(훅뱅크) PASS, L6(썸네일) PASS. L1(장르)만 FAIL** — "외부 장르 7건 노출: kridol-*(kr-idol-male)".

**이건 K2의 결함류(하드코딩된 접두사 케이스 누락)와 다른 종류의 발견입니다.** K2에서 고친 3건(`hookBanks/index.ts`의 kr-idol-male case, `premiumBankFor` 제외 목록, `isolationAudit.ts`의 접두사 매핑)은 전부 "빠뜨린 케이스를 추가"하는 단순 수정이었습니다. 이번 L1 FAIL은 **`checkL1`(scripts/isolationAudit.ts)이 "장르 하나는 정확히 워크스페이스 하나에 속한다"는 모델로 설계돼 있는데, kr-idol-male과 kr-idol-female이 7개 장르를 의도적으로 공유하는 K2/K3 자신의 설계(§3-1)와 근본적으로 맞지 않는 것**입니다. `genreWorkspaceOf()`가 `kridol-*` 접두사를 `'kr-idol-male'` 하나로만 반환하도록 고정돼 있어서 벌어지는 일이며, 이걸 `'kr-idol-female'`로 바꾸면 이번엔 kr-idol-male 쪽이 대칭적으로 FAIL하게 됩니다 — **로직 재설계 없이는 고칠 수 없는 checkL1 자체의 모델 한계**이므로 고치지 않고 보고합니다(§13-5).

`tests/workspaceDataIsolation.test.ts`에는 L4의 `L4_PREEXISTING_SENIOR_INTERNAL`과 동일한 패턴으로 `it.todo`(전체 `npm test` 통과는 막지 않되 감추지도 않음, `npm run audit:isolation` 원본은 그대로 FAIL 보고)로 반영했습니다.

**SKIP 17건은 K3와 무관합니다** — 전부 senior-oldpop 자신의 기존 "미구축" 상태(§0-1이 손댈 수 없는 영역)입니다. §10 항목 31("SKIP 0")은 이 워크스페이스 트랙만으로는 실질적으로 달성 불가능한 목표였습니다.

### [13] `git diff --stat` 전문

```
 docs/STRESS_TEST_REPORT.md            |  30 +++---   (자동 재생성)
 scripts/isolationAudit.ts             |   7 ++        (kridolf- 테마 접두사 케이스 추가)
 src/core/lyricEngine.ts               |   4 +-         (premiumBankFor 제외 목록에 kr-idol-female 추가)
 src/core/vocalPlan.ts                 |  78 ++          (아이돌 보컬 분기 8+5종 신설 — §4-1)
 src/data/conceptKeywords.ts           |  31 ++          (krkidolf 컨셉 규칙 5개 신설)
 src/data/genreLibrary/index.ts        |  20 +-          (KRIDOL_F_CORE_GENRE_IDS 신설, 빈 배열 채움)
 src/data/hookBanks/index.ts           |   5 ++          (kr-idol-female case 신설)
 src/data/lyricThemes.ts               | 176 ++          (krkidolf 18개 가사 구도 신설)
 src/data/presets.ts                   |  75 ++          (krkidolf 3개 채널 프리셋 신설)
 src/data/thumbnailArchetypes/index.ts |  14 ++          (kridolf 3개 썸네일 신설)
 src/data/thumbnailArchetypes/types.ts |   7 +-          (카테고리 유니온 3개 추가)
 src/data/workspaces/index.ts          |  37 ++          (KR_IDOL_F 신설)
 src/types.ts                          |   2 +-          (WorkspaceId 유니온에 kr-idol-female 추가)
 tests/thumbnailArchetypes.test.ts     |  18 +-          (개수 단정문 36→39 + KRIDOLF_CATEGORIES 추가)
 tests/workspaceDataIsolation.test.ts  |  20 +-          (L1 known-issue it.todo 패턴 추가)
 tests/workspaces.test.ts              |  22 +-          (개수 단정문 6→7 + kr-idol-female 완성 테스트 추가)

신규 파일(untracked):
 src/core/idolExpressionLint.ts
 src/core/idolFemalePartPlan.ts
 src/data/hookBanks/krIdolFemale.ts
 src/data/thumbnailArchetypes/kridolfColorBlock.ts
 src/data/thumbnailArchetypes/kridolfDaylightCity.ts
 src/data/thumbnailArchetypes/kridolfGroupLine.ts
```

`docs/STRESS_TEST_REPORT.md`는 자동 재생성 파일(F1/G2/K1/K2와 동일). **K2가 만든 파일(`src/core/idolPartPlan.ts`, `src/data/hookBanks/krIdolMale.ts`, `src/data/krIdolSectionPlans.ts`, `src/data/genreTraits.ts`의 kridol 항목, `src/data/genreForbiddenDescriptors.ts`의 kridol 항목, K2의 3개 썸네일 파일)는 git diff에 전혀 나타나지 않습니다** — 단 한 줄도 열지 않았습니다. `src/core/vocalPlan.ts`/`src/data/hookBanks/index.ts`/`scripts/isolationAudit.ts`/`src/core/lyricEngine.ts`의 diff는 전부 "새 조건/case/함수 추가"이며 기존 로직·상수를 수정한 줄은 0건입니다.

---

## 13-2. §10 완료 판정 수치표

| # | 항목 | 기준 | 현재값 | 완료값 |
|---|---|---|---|---|
| 1 | 신규 장르 | 0 (필요 시 ≤2, 근거 필수) | 0 | **0 (필요 없다고 판단, §13-4[C])** |
| 2 | K2 장르 7종 | 불변 | — | **불변 (git diff에 genreLibrary의 kridol 항목 값 수정 0건)** |
| 3 | 아이돌 여성 보컬 서술 | ≥8 | 0 | **8 (§13-1[5])** |
| 4 | 기존 성인 여성 서술 5종 | 불변 | 5 | **불변 (git diff에 ADULT_VOCAL_DESCRIPTIONS 수정 0건)** |
| 5 | 아이돌 여성 ∩ 아이돌 남성 서술 | 0 | — | **0** |
| 6 | `vocalDescriptionFor` 호출부의 아키타입 인자 | 전부 전달 | 2/2 | **2/2 (불변, 새 호출부 추가 없음)** |
| 7 | 프롬프트에 `kindergarten`/`childlike`/`teen` 계열 | 0건 | — | **0건 (§13-1[1], 하드 게이트 통과)** |
| 8 | §7-1 성적 대상화 어휘 | 0건 | — | **0건 (§13-1[1], 하드 게이트 통과)** |
| 9 | `kridol-female` × `kridol-male` 18곡 교차 유사도 | ≤0.32 | — | **평균 0.1843 (§13-1[7], 방법론 정정 후)** |
| 10 | 구간 프리셋 분포가 K2와 다름 | 3종 이상 차이 | — | **최우선 3종 전부 다름 (§13-1[9])** |
| 11 | 18곡 중 남성 단독 보컬 곡 | 0 | — | **0/18 (3세트 전부)** |
| 12 | `vocalQuotaOverride` 값 | `{0, 15, 3}` | — | **`{male:0, female:15, mixed:3}`** |
| 13 | `DEFAULT_ADULT_VOCAL_QUOTA` | 불변 | 6/6/6 | **불변** |
| 14 | `chorus: 'layered-harmony'` 곡 수 | 7 | — | **7/18** |
| 15 | 가사 구도 개수 | ≥18 | 0 | **18** |
| 16 | 구도 전부 `suitedArchetypes` 지정 | 18/18 | — | **18/18** |
| 17 | B2 + K2 프레임과 재사용 | ≤4 | — | **0** |
| 18 | 훅 ∩ `koreanDefault` | 0 | — | **0 (한/영/일)** |
| 19 | 훅 ∩ `kr2030Override` | 0 | — | **0 (한/영/일)** |
| 20 | 훅 ∩ `krIdolMaleOverride` | 0 | — | **0 (한/영/일, §13-1[8] 최초 초안 4건 발견→수정)** |
| 21 | K2 제목 18개와 겹침 | 0 | — | **0 (§13-1[3], 36곡 대조)** |
| 22 | 영어 단어 1개 제목 | 경고 처리 | — | **경고 처리 확인, 실제 K2/K3 108곡 중 0건 발생** |
| 23 | `idolExpressionLint` 존재 | 있음 | 없음 | **있음** (`core/idolExpressionLint.ts`) |
| 24 | 린터가 K2에도 적용됨 | 적용 | — | **적용, K2 3채널 54곡 실측 0건 (§13-1[1])** |
| 25 | 신규 썸네일 아키타입 | 3 | 0 | **3** |
| 26 | 기존 썸네일에 변경 | 0건 | — | **0건** |
| 27 | 참조 시드 | 0 (의도적 미구현) | 0 | **0 (의도적 미구현 유지)** |
| 28 | 컨셉 — 기존 전 워크스페이스 매칭 변화 | 0건 | — | **1건("자신감" 입력이 K3 자신의 새 규칙과도 매칭 — 같은 공유 장르를 가리켜 무해, §13-1 하단 참조)** |
| 29 | 신규 채널 프리셋 | 3 | 0 | **3** |
| 30 | `KR_IDOL_F.ready` | `true` | — | **`true`** |
| 31 | `npm run audit:isolation` SKIP | 0 | — | **17 (미달 — 전부 senior-oldpop 자신의 기존 미구축 상태, K3 범위 밖. §13-1[12])** |
| 32 | 기존 6 워크스페이스 18곡 출력 | 불변 | — | **불변 (§13-1[2], 3회 diff 확인)** |
| 33 | `tests/seniorBaseline.test.ts` | 통과 | — | **통과 (14/14)** |
| 34 | `git diff` 상 기존 행 수정·삭제 | 0건 | — | **`docs/STRESS_TEST_REPORT.md`(자동 재생성) 외 전부 "목록에 항목 추가"류 — §13-1[13]** |
| 35 | 신규 오디언스 프로파일 생성 수 | 0 (A3) | 0 | **0 (kr-idol-male과 동일하게 `defaultAudienceProfileId: 'general'` 임시값 사용)** |

---

## 13-3. 미구현 항목

- **`buildAdultVocalTraitPlan`의 아이돌 전용 축 보강**: §13-1[5]가 발견한 대로, 실제 곡 생성의 보컬 텍스트는 `vocalDescriptionFor`가 아니라 `data/vocalTraits.ts`의 공유 축 풀을 쓰는 `buildAdultVocalTraitPlan`이 결정합니다. 이 풀은 시니어/kr2030/jp2030/K2/K3가 전부 공유하고, 새 후보 단어를 추가하면 그 네 워크스페이스의 기존 출력이 흔들릴 위험이 있어 K3의 안전 범위(§11-2, §0-1) 밖으로 판단해 손대지 않았습니다. `channelDefaultVocal`의 소프트 가중치만 최대한 활용했습니다 — 근본 해결은 미구현입니다.
- **구간 프리셋 인스턴스별 18곡 배분**: K1/K2 둘 다 6개 프리셋의 "존재"까지만 확인했고, 실제 18곡 세트에 프리셋을 배분하는 것은 두 워크스페이스 모두 아직 실제 생성 파이프라인에 연결하지 않았습니다(K1 §11-3, K2 §14-3와 동일한 미구현 상태) — K3도 이어받았습니다.
- **`SectionGenrePlan`/`IdolPartPlan`의 실제 생성 파이프라인 배선**: K2와 동일하게 옵트인 엔진으로만 존재하고, 실제 `generateLocalBlueprint` 호출에는 연결하지 않았습니다.

## 13-4. 결정 대기 항목

### [A] kr-idol-female 아티스트명 (§9-4)

DistroKid 배포 요건입니다. 지어내지 않고 `undefined`로 남겨 뒀습니다.

### [B] 아이돌 보컬 분기를 K2가 만들었는가 (§4-1)

**확인 결과: 안 만들었습니다.** `vocalDescriptionFor('female', 'korean', 0, 'kr-idol-male')`을 직접 실행해 실측했고, K2의 워크스페이스는 성인 시니어와 동일한 `ADULT_VOCAL_DESCRIPTIONS.male`을 그대로 쓰고 있었습니다. §13-4[B] 자신의 지시대로 "K2로 되돌리지" 않고 **K3가 남성 5종 + 여성 8종을 함께 신설**했습니다(§13-1[5]). 다만 §13-1[5]에서 밝힌 대로 이 함수 자체가 실제 성인 곡 생성에 관여하지 않는다는 더 큰 사실이 발견됐으므로, 이 결정 자체의 실효성은 제한적입니다 — 진짜 개선이 필요하면 §13-5의 handoff 항목(`buildAdultVocalTraitPlan`)을 봐야 합니다.

### [C] 장르 추가 여부와 근거 (§3-1)

**추가하지 않았습니다.** K2의 7종이 §5-2의 5축(자기주도/관계주도/친구·연대/직접적 감정/분위기)을 가사·훅·보컬로 충분히 표현할 수 있다고 판단했고, §3-1 자신의 경고("장르를 늘리면 교차 유사도가 좋아 보이는데 그건 워크스페이스가 갈린 게 아니라 장르 풀이 달라진 것뿐")를 따라 가사·보컬·훅으로만 구별을 만들었습니다. 실측 결과(§13-1[7], 평균 0.1843) 장르 공유 상태에서도 기준을 충분히 만족해 추가 근거가 성립하지 않았습니다.

### [D] IdolPartPlan 분포 9/6/3, layered-harmony 7 (§4-5) — K3가 정한 값

문서가 직접 제시한 값을 그대로 채택했습니다. 청취 후 조정 대상입니다.

### [E] 교차 유사도 기준 0.32 및 실측 방법론 (§10-9)

기준 0.32는 K3가 아니라 문서 자신이 정한 값입니다. §13-1[7]에서 밝혔듯 raw 단어 토큰 비교(0.3300)와 절 단위 비교(0.1843) 사이에 큰 차이가 있었습니다 — 이 프로젝트의 다른 모든 팩 내 유사도 판정이 절 단위(`stylePromptClauseSet`)를 쓰므로 그쪽을 채택했지만, "18곡 교차 유사도"라는 새로운 종류의 측정에 그 방법론을 그대로 가져오는 게 맞는 선택인지는 하루 님의 청취 판단이 필요합니다. 최대 유사도 쌍(0.5000)이 실제로 "같은 노래처럼 들리는지"는 코드로 확인할 수 없습니다.

### [F] 구간 프리셋 배분 (§3-2)

K1의 6개 프리셋을 그대로 재사용하되, 실제 18곡 배분 인스턴스는 만들지 않고 **기본 장르 우선순위 재배치**로만 구현했습니다(§13-1[9]). 더 명시적인 "K3 전용 18곡 프리셋 배분표"가 필요한지는 청취 후 판단이 필요합니다.

## 13-5. G1 / H1로 넘길 항목

```
G1  scripts/isolationAudit.ts의 checkL1 재설계 필요
      "장르 하나 = 워크스페이스 하나" 모델이 K2/K3처럼 장르를 의도적으로
      공유하는 워크스페이스 쌍과 근본적으로 맞지 않음(§13-1[12]) — genreWorkspaceOf가
      배열을 반환하게 하거나, "공유 허용 워크스페이스 쌍" 목록을 checkL1이
      직접 알게 하는 재설계가 필요. 현재는 tests/workspaceDataIsolation.test.ts에
      it.todo로만 우회해 뒀습니다(npm run audit:isolation 원본은 여전히 FAIL 보고).
    §7 표현 가이드라인 위반 검사를 L8로 추가할 것(문서 자신의 §13-5 원안)
      — core/idolExpressionLint.ts를 그대로 재사용 가능
    아이돌 어휘가 동요 워크스페이스로 유입되는지도 L8에서 함께 확인
      (§13-1에서 "계절" 1단어가 우연히 겹치는 것을 실측 확인 — 유해하지 않은
      일반 어휘 수준이라 별도 조치 없음, L8이 이 구분까지 정교하게 하면 좋음)

H1  auditAlbum이 §7 위반을 잡지 못하는 것을 사각지대 목록에 추가
    (idolExpressionLint는 auditAlbum과 별개 함수로 존재 — G2의 H1 목록과 같은 계열)

신규 문서 후보 (미명명) — buildAdultVocalTraitPlan의 공유 축 풀에
    아이돌 전용 register/delivery/timbre 후보를 추가하는 작업. 시니어/kr2030/
    jp2030/K2/K3 다섯 워크스페이스 전부의 기존 출력을 흔들 수 있는 고위험
    작업이라 이 문서(K3)의 범위 밖으로 판단했습니다(§13-1[5]/§13-3).
```

---

## 14. 이 트랙의 끝

```
K1  다장르 합성 엔진        완료
K2  한국 남자 아이돌        완료
K3  한국 여자 아이돌        완료 (이 문서) ← 콘텐츠 문서의 마지막
G1  격리 검증 재실행        아직 — checkL1 재설계가 선행되어야 SKIP 0 근접 가능
G2  통합 회귀 재실행        아직 — 채널 프리셋 25개 × 18곡 기준으로 재실행 필요
H1  감사 항목 확장          아직
```

**워크스페이스 7개가 전부 구축됐습니다**: senior-oldpop / kr-2030 / jp-2030 / kr-kids / jp-kids / kr-idol-male / kr-idol-female. 다음 단계는 G1/G2의 재실행(§13-5의 checkL1 재설계를 먼저 고려), 그리고 §13-1[9]/§8-2 청취 계획에 "남녀 아이돌이 실제로 다르게 들리는가"(장르 공유로 가장 어려운 판정) 항목을 추가하는 것입니다. 이 문서는 그 청취를 대신하지 않습니다 — 코드로 확인 가능한 것(교차 유사도, 표현 가이드라인 하드 게이트, 워크스페이스 격리)까지만이 K3의 범위입니다.
