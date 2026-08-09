# 벤치마크 프롬프트 관행 기록 (지시문 20 TASK D)

지시문 20 §D — 구현하지 않고 관찰만 기록한다. 어느 쪽이 Suno에서 더 잘 먹히는지는
하루의 청취로 정한다. 이 문서는 결론을 내리지 않는다.

## 1. 관찰된 관행

출처: 벤치마크 프로그램(HotAIMusic)의 장르 프리셋 텍스트 (지시문 20 §1-2, §1-3).

### 1-1. 네거티브를 스타일 프롬프트 안에 직접 넣는다

별도 negative/exclude 필드가 아니라, 스타일 프롬프트 문장 자체에 "no X" 구문을
섞어 넣는다.

```
슬픈 빗속의 발라드블루스
  ... no humming, no ooh, no aah, no mmm

올드팝
  slow tempo 70 BPM, 6/8 slow ballad feel, 70s 80s old pop, classic ballad,
  no disco beat, no uptempo, no fast dance groove, no four-on-the-floor
```

### 1-2. 템포·박자를 텍스트로 명시한다

BPM 숫자와 박자(6/8 등)를 스타일 프롬프트 문장 안에 그대로 적는다.

```
"Around 100 BPM"   "slow tempo 70 BPM"   "6/8 slow ballad feel"
```

## 2. 하루 앱의 현재 방식과의 차이

### 2-1. 네거티브 — 다르다

하루 앱은 네거티브를 `excludePrompt`라는 별도 필드로 분리해서 관리한다
(`core/promptComposer.ts`의 `buildExcludePrompt`/`EXCLUDE_PROMPT_SAFE_TARGET`).
스타일 프롬프트 본문에는 "no X" 구문을 섞지 않는다.

이번 조사로 확인한 실측 근거: `checkStylePromptWordBudget`
(`core/stylePromptBudget.ts`)이 워크스페이스별로 stylePrompt 단어 수 상한을
엄격히 관리하고 있어(예: kids 45단어, 기본 55단어, K-pop 65단어), 네거티브
문구를 스타일 프롬프트 안에 추가로 섞으면 이 예산을 더 빠르게 소진시킨다.
현재 구조(분리)가 이 예산 관리와 직접 상충하지는 않는다는 뜻이지, 벤치마크
방식이 틀렸다는 뜻은 아니다 — 검증되지 않은 판단이므로 3절의 청취 실험으로
넘긴다.

### 2-2. 템포/박자 텍스트 명시 — 이미 공통점이 있다

하루 앱도 이미 stylePrompt 안에 BPM 숫자를 문자 그대로 적도록 지시하고 있다
(`core/promptComposer.ts`의 `tempoInstruction`: `Each entry also includes
"tempo" - use exactly that BPM number in that song's stylePrompt (e.g. "96
BPM"), verbatim.`). 이 부분은 벤치마크 관행과 이미 같은 방향이다.

다만 "6/8 slow ballad feel"처럼 박자(time signature)까지 텍스트로 명시하는
관행은 하루 앱에서 확인되지 않았다 — 구조화된 필드(`durationTarget` 등)로만
관리되고, 박자 자체를 텍스트로 못박는 지시는 없다. 이 차이는 실측만 하고
결론을 내리지 않는다.

## 3. 검증 방법

지시문 10 TASK E · 지시문 16 TASK A의 청취 실험에 아래 항목을 추가한다.

- **"네거티브를 스타일 프롬프트 안에 넣은 버전" 1종**을 기존 청취 세트에 더
  추가해서 뽑는다. `excludePrompt` 필드는 비우거나 최소화하고, 그 문구를
  stylePrompt 문장 안에 자연스럽게 섞어 넣은 실험용 버전.
- 기존 방식(분리형) 세트와 A/B로 나란히 청취한다.
- 판단 기준: Suno가 실제로 negative를 얼마나 잘 지키는지(가사/스타일 양쪽),
  stylePrompt 단어 예산 초과 여부, 결과물 체감 품질.

이 지시문에서는 실험을 설계만 하고 실행/구현하지 않는다 — 실행은 지시문 10/16의
청취 실험 절차에 편입되어야 한다.
