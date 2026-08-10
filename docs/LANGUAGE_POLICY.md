# 언어 정책 — 가사 언어를 세트마다 자유롭게 고를 수 있어야 하는 이유

지시문 34. 이 문서는 법적 판단이 아니다 — 아래 저작권 관련 서술은 전부 **"현재 하루가 파악한 운영 전제"**이지 확정된 사실관계가 아니다. 그 전제가 바뀌면 이 문서도 다시 쓴다.

## 왜 채널이 아니라 세트마다 골라야 하는가

하루의 말(지시문 34 §0):

> 한국어 동요, 한국어 2030 채널이어도 결과물이 한국어 / 영어가 나올 수 있도록 자유롭게 선택했으면 좋겠어. 한국 노래도 조만간 수노에서 생성한 노래도 저작권 인정된다는 이야기가 있거든.

하루가 파악한 운영 전제:

- 언어 선택이 취향이 아니라 **저작권 등록 가능 여부**라는 운영 요건에 걸려 있다.
- 이 요건은 **바뀔 수 있다** — "조만간 인정된다는 이야기가 있다"는 것은 지금 이 순간의 상태 판단이지, 영구히 고정된 규칙이 아니다.
- 요건이 바뀔 때마다 채널을 새로 만들 수는 없다 — 같은 채널(같은 시대색·같은 청중·같은 정체성)에서 세트마다 가사 언어만 바꿔 대응할 수 있어야 한다.

그래서 `lyricLanguage`는 채널의 `primaryLanguage`(그 채널의 **기본값**)와 별개로, 세트를 생성할 때마다 다시 고를 수 있는 축으로 남아 있어야 한다. 채널의 `primaryLanguage` 자체를 바꾸는 것은 이 요구와 다른 일이다 — 기본값은 그대로 두고, 그 기본값과 다르게 고를 수 있는 자유가 요구다.

## 현재 채널별 기본값

| 아키타입 | primaryLanguage(기본 가사 언어) | market |
|---|---|---|
| senior-morning | english | korea |
| oldpop-lounge | english | korea |
| showa-cafe | english | japan |
| showa-70s | japanese | japan |
| j2000s | japanese | japan |
| modern-chill | english | global |
| city-night | english | korea |
| kids(시니어 워크스페이스의 싱어롱 라디오) | english | korea |
| kr-2030-pop | korean | korea |
| jp-2030-pop | japanese | japan |
| kr-kids-song | korean | korea |
| jp-kids-song | japanese | japan |
| kr-idol-male | korean | korea |
| kr-idol-female | korean | korea |

**근거**: 시니어 계열(특히 showa-cafe/showa-70s/oldpop-lounge)의 영어 기본값은 60~70년대 서구 올드팝·쇼와 시대 재즈팝의 시대색이 원어(영어) 가사에서 나온다는 관찰에 근거한다 — 지시문 33이 확인한 "발라드가 시대색과 채널 톤을 잇는다"는 관찰과 같은 계열의 실측이다. kr-2030-pop/kr-kids-song/kr-idol-*의 한국어 기본값은 그 워크스페이스의 실제 청중(한국어 사용자)을 향한 자연스러운 언어라는 판단이다. 이 기본값들은 **바뀌지 않는다** — 이 지시문은 그 위에 "다르게 고를 자유"를 얹는다.

## 가사 언어와 표기 언어가 분리된 이유

`src/core/packagingLanguage.ts`의 원문 주석(TASK D5, v3.6):

> real senior-channel operation runs English lyrics under Korean or Japanese packaging (Suno itself sings fine in English; the audience-facing title/thumbnail is what needs to read as native).

Suno는 영어 가사를 문제없이 부른다 — 청중에게 보이는 것은 노래가 아니라 **제목·썸네일·설명**이고, 그 표기가 청중의 언어로 자연스럽게 읽혀야 한다는 것이 실제 운영에서 이미 확인된 필요다. 그래서 `lyricLanguage`(가사가 어느 언어로 쓰이는가)와 `packagingLanguage`(제목·설명이 어느 언어로 표기되는가)는 서로 다른 축으로 분리돼 있다:

- `packagingLanguage` 기본값은 `market`에서 파생된다(`defaultPackagingLanguage`) — korea→korean, japan→japanese, 그 외→english.
- kids 아키타입만 예외로 `primaryLanguage`를 따른다(`defaultPackagingLanguageForChannel`) — kids 채널은 시니어 채널의 "영어 가사 + 현지어 브랜딩" 관례를 공유하지 않는다는 실측 판단(v3.39.1 Part C3).
- 사용자가 명시적으로 override하면(`opts.packagingLanguage`) 그 값이 우선한다.
- 이중언어 제목(`titleLocalized`)이 구조적으로 필요한 아키타입(`TITLE_LOCALIZED_REQUIRED_ARCHETYPES`)은 `packagingLanguage`가 english로 override돼도 `channel.market`이 한국/일본을 가리키면 이중언어 안내문을 유지한다(`resolveTitleLocalizedLanguage`, 지시문 12 TASK C-2 — 이미 완료·배선 확인됨, 지시문 34 TASK C에서 재확인).

이 두 축(가사 언어 자유 선택 · 표기 언어 자유 선택)이 서로 독립적으로 존재해야, 저작권 요건이 바뀌어 가사 언어만 바꿔야 할 때 채널의 브랜딩(제목·썸네일 언어)까지 함께 흔들리지 않는다.

## 언어 전환 시 검사가 따라가지 않던 실제 결함 (지시문 34 TASK A에서 발견·수정)

`contentChecksPolicy.relationshipContinuityLanguage`(kr-2030/jp-2030)와 `contentChecksPolicy.kidsOutcomeLanguage`(kr-kids/jp-kids)는 워크스페이스 고정값인데, 이 값이 실제 세트의 `lyricLanguage`와 무관하게 그대로 검사 함수의 인자로 쓰이고 있었다. 그래서 kr-2030을 영어로 세트를 뽑으면 "관계 연속성" 검사가 (영어 가사에서 한국어 마커를 찾으므로) 조용히 아무것도 잡지 못한 채 무력화됐고, kr-kids를 영어로 뽑으면 "아동 서사 안전성" 검사도 같은 방식으로 무력화됐다. `src/core/quality.ts`에서 이 검사들이 **실제 세트의 언어와 정책 언어가 일치할 때만** 돌도록 고쳤다 — 영어로 고른 세트에는 이 두 축의 실제 커버리지가 없다는 뜻을 조용히 숨기지 않고 정직하게 드러낸다(빈 리스트가 "안전하다"가 아니라 "이 축을 이 언어로는 측정하지 않는다"는 뜻).

**이 두 검사는 한국어·일본어 마커 사전만 갖고 있다 — 영어 버전은 없다.** 영어로 고른 kr-2030/kr-kids 세트에는 이 두 축(관계 연속성·아동 서사 안전성)의 실제 검사가 없다는 뜻이다. 새 영어 마커 사전을 만드는 것은 이 지시문의 범위가 아니다(§ "하지 말 것" — 새 품질 기능 추가 금지, 실측 없이 blocking 금지) — 대신 이 사실을 사용자에게 안내한다(§TASK B).

## 다시 확인할 것

- 이 문서의 채널 기본값 표는 `src/data/presets.ts`가 바뀌면 다시 맞춰야 한다.
- 저작권 관련 서술은 "하루가 파악한 운영 전제"다 — 실제 법적 확인이 이뤄지면 이 문서를 그 결과로 다시 쓴다.
