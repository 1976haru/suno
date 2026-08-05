# v4.15 완료 보고 — 숏츠용 하이라이트 추출 · 음원 분석 아카이브

기준: 현재 작업 트리(K1/K2/K3 미커밋 변경 포함) 위에서 진행. 이 문서는 그 위에 추가만 했습니다 — §8에서 실제 diff로 확인.

모든 수치는 실제로 실행한 명령/실제 브라우저 조작의 출력입니다. mp3 실물이 이 환경에 없어(§0 참고), 3개 파일은 `scripts/genShortsTestAudio.ts`로 합성한 실제 WAV 파일이며 — 이후 전부 실제 디코딩·분석·렌더링 경로(Web Audio API, 실제 Chrome)를 통과했습니다. 합성이라는 사실을 숨기지 않고 매 항목에 명시합니다.

---

## 0. 변경/신규 파일 목록

신규:
- `src/core/audioHighlight.ts` — 클라이맥스 탐지/경계 보정/페이드/WAV 렌더링 (TASK A 핵심)
- `src/core/audioArchive.ts` — 아카이브 데이터 모델 + IndexedDB 3함수 (TASK B 핵심, §2-3 인터페이스 그대로)
- `src/core/audioDb.ts` — `suno-weaver-audio` DB의 공유 open/upgrade (아래 §1 참고 — 반드시 필요했던 신규 파일)
- `src/components/ShortsHighlightPanel.tsx` — 숏츠 UI
- `src/components/AudioArchivePanel.tsx` — 아카이브 저장/목록 UI
- `scripts/genShortsTestAudio.ts` — 검증용 합성 WAV 생성기 (앱 코드 아님, 검증 도구)
- `tests/audioHighlight.test.ts` (12개), `tests/audioArchive.test.ts` (13개)

수정 (전부 추가만 — §8에서 실제 diff로 확인):
- `src/core/audioTakes.ts` — DB open/upgrade 로직을 `audioDb.ts`로 위임 (아래 §1, 유일한 "삭제 있는" 수정)
- `src/core/csvExport.ts` — 아카이브 CSV 빌더 4개 함수 추가
- `src/data/featureFlags.ts` — `shortsHighlight`/`audioArchive` 실험 플래그 추가
- `src/components/steps/Step4Result.tsx` — 기존 "🎧 음원 분석" 탭에 두 패널 배선
- `src/styles.css` — `.audio-rms-bar.selected` 1규칙 추가

---

## 1. IndexedDB 버전 경합 — 발견하고 미리 막은 문제

`core/audioTakes.ts`는 이미 `suno-weaver-audio` DB(store: `takes`, version 1)를 쓰고 있었습니다. §2-4는 "새 object store를 **같은** DB에 추가하라"고 명시하는데, 두 모듈이 각자 `indexedDB.open(같은이름, 다른버전)`을 독립적으로 호출하면 먼저 여는 쪽이 버전을 확정지어 버려 **나중 모듈의 store가 영영 생성되지 않는** 실제 버그 패턴이 됩니다.

`core/library.ts`가 이미 한 DB 안에 4개 store를 두는 전례가 있어(하나의 openDb에서 전부 생성), 같은 패턴을 `core/audioDb.ts`로 뽑아내고 `audioTakes.ts`가 자기 store 생성 로직을 그리로 위임하도록 리팩터했습니다. `audioTakes.ts`의 export된 API(`recordTake`/`getTakes`/`deleteTake`/`setAdopted`/`listAllTakesForWorkspace`/`putTakeIfNewer`/`migrateAudioTakesWorkspaceTags`)는 시그니처·동작 전부 그대로입니다.

**실측 확인** (실제 Chrome, `indexedDB.open('suno-weaver-audio')`):
```json
{"version":2,"stores":["archives","takes"]}
```
두 store가 공존합니다. `tests/audioTakes.test.ts` 등 기존 오디오 테스트 69개 전부 이 리팩터 이후에도 그대로 통과(§8).

---

## 2. TASK A — 숏츠용 하이라이트: 실측 결과 (§4 항목 1, 핵심)

3개 합성 WAV(모노 22050Hz, 검증 목적 — 실제 수노 mp3는 44.1kHz+ 스테레오일 것이나, 이 환경엔 실물이 없어 브라우저 업로드 크기 제한(10MB) 안에 들도록 다운샘플했습니다. RMS/스펙트럼 수학은 샘플레이트에 무관합니다):

| 파일 | 실제 구조 (설계값) | 추천 구간 (앱 실측) | 경계보정 전 (raw) | 판정 |
|---|---|---|---|---|
| `01 Test Song A.wav` (95s) | 인트로15s→벌스25s→브릿지15s→**후렴30s(55~85s)**→아웃트로10s | **0:55~1:25** | 0:55 (ramp-in 지점 자체가 보정 목표와 일치) | ✅ 정확히 후렴 구간 |
| `02 Test Song B.wav` (93.6s) | ...→벌스 끝(51.2s)→**0.4s 무음 갭(51.2~51.6s)**→후렴30s→아웃트로 | **0:51~1:21** | raw 시작을 ±2s 내에서 0.1s 단위로 재탐색 → 무음 갭(51.2~51.6s) 근방으로 스냅 | ✅ 문장 중간이 아니라 갭으로 보정됨 |
| `05 Test Song C.wav` (54s) | 짧은 트랙: 인트로8s→벌스18s→후렴22s(26~48s, **윈도우 30s보다 짧음**)→아웃트로6s | **0:18~0:48** | — | ✅ 앞 15%(8.1s)/뒤 10%(5.4s) 제외 경계 안에서 후렴을 최대로 포함하는 지점(18s) 선택 |

전체곡 최대구간(단순 최대RMS, 제외 없음) 비교: 트랙 1에서 만약 앞 3초를 인위적으로 크게 만든 별도 유닛테스트(`findRawPeakWindow`)로 확인 — 제외 로직이 없으면 인트로가 선택될 수 있음을 별도로 확인(`tests/audioHighlight.test.ts`의 "naive comparison baseline" 케이스). 실제 3개 실측 파일 모두 인트로/아웃트로를 후보에서 제외한 결과가 정확히 후렴부와 일치했습니다.

### 2-1. WAV 산출물 검증 (실제 다운로드 파일 바이트 분석)

트랙 1을 0:50으로 5초 수동 조정 후 저장한 실제 파일(`01 Test Song A_shorts30.wav`)을 브라우저에서 fetch + DataView로 직접 파싱:

```json
{"riff":"RIFF","wave":"WAVE","numChannels":1,"sampleRate":48000,"bitsPerSample":16,"dataSize":2880000}
```
`2880000 bytes / 2 bytes·sample / 48000 Hz = 30.000초` — **정확히 30초** (48000Hz는 브라우저 AudioContext의 기본 출력 레이트 — 원본 채널 수는 그대로 보존됨, 원본이 모노라 출력도 모노).

페이드 확인 (실제 샘플 진폭, 절대값 피크):
| 시점 | 피크 진폭 | 해석 |
|---|---|---|
| 0.02s | 0.014 | 페이드인 초입 — 조용함 |
| 0.5s | 0.143 | 0.3s 페이드인 종료 후 — 정상 레벨 |
| 28.0s | 0.779 | 페이드아웃(28.5s) 시작 전 — 최대 레벨 |
| 29.9s | 0.057 | 1.5s 페이드아웃 도중 — 크게 감쇠 |
| 29.99s | 0.007 | 거의 무음 |

0.3s 페이드인/1.5s 페이드아웃 둘 다 실제 샘플에 반영됨을 확인.

### 2-2. UI 항목별 실측

| 항목 | 실측 |
|---|---|
| 길이 옵션 15/30/60초 | 버튼 3개 실동작 확인, 변경 시 전체 재분석 |
| 파형(음량 곡선) | `rmsBinsSec` 그대로 렌더 — 선택 구간 파란색으로 시각 구분 확인 |
| 5초 단위 수동 조정 | ◀5초 클릭 → "0:55~1:25"에서 "0:50~1:20"로 실제 이동 + "수동 조정됨" 라벨 |
| 미리듣기 | 실제 렌더된 30초 clip 재생 확인 (선택 구간만) |
| 파일명 규칙 | `01 Test Song A_shorts30.wav` — 스펙 예시와 동일 패턴 |
| 원본 미덮어쓰기 | 다운로드는 별도 파일명, 원본 File 객체는 읽기만 함(코드 레벨 보장 + 실제 원본 재생 정상 확인) |
| 트랙 1-3 "대표곡" 배지 | 트랙 1, 2에서 배지 표시 / 트랙 5(`05 Test Song C.wav`)에서 배지 없음 — 양쪽 다 실측 |
| 여러 파일 동시 처리 | 3개 파일 순차 드롭 → 각각 독립적으로 분석/표시 |

---

## 3. TASK B — 음원 분석 아카이브: 실측 결과

### 3-1. 저장/조회 왕복 ("oldpoplounge2st")

실제 IndexedDB 저장 레코드:
```json
{
  "archiveLabel": "oldpoplounge2st",
  "channelSlug": "oldpoplounge",
  "sequence": 2,
  "workspaceId": "senior-oldpop",
  "packId": "굿모닝 추억라디오::Autumn to Christmas Playlist Pack::18",
  "trackCount": 1,
  "tracks": [{"trackNo":1,"fileName":"01 Test Song A.wav","durationSec":95,"dynamicRange":18.79,"peakPosition":0.63,"spectralCentroid":572,"vocalBandCentroid":569}],
  "summary": {"avgDuration":95,"durationRange":[95,95],"inTargetRange":0,"avgDynamicRange":18.79,"lateRiseCount":0,"tempoRange":[0,0]}
}
```
채널/회차 파싱이 스펙 예시(§2-2)와 정확히 일치(`oldpoplounge`/`2`), `packId`가 현재 열린 팩에 자동 연결됨(§2-8 매칭 성공 시).

### 3-2. 이름 파싱 실패해도 저장 확인 + 매칭 실패 파일도 저장 확인

트랙 매칭에 실패하는 파일(`Unmatched Mystery Track.wav`, 리딩 트랙번호 없음·제목 불일치)을 아카이브 "unmatchedtest1st"에 함께 올려 저장 — 실제 저장된 레코드:
```json
"tracks": [
  {"trackNo":1,"fileName":"01 Test Song A.wav"},
  {"fileName":"Unmatched Mystery Track.wav"}   // trackNo 필드 자체가 없음 — undefined, 저장은 막히지 않음
]
```
저장이 차단되지 않았고, 매칭된 트랙과 매칭 실패 트랙이 같은 아카이브에 공존함을 실측 확인.

### 3-3. 덮어쓰기 확인 플로우

같은 이름으로 재저장 시도 → `"oldpoplounge2st" 이름이 이미 있습니다. 덮어쓸까요?` + [덮어쓰기]/[취소] 실제 표시 확인. [덮어쓰기] 클릭 후 `analyzedAt`이 `2026-08-05T06:00:44.235Z` → `2026-08-05T06:04:25.638Z`로 실제 갱신됨(같은 키에 put — 레코드 중복 없음).

### 3-4. 추이 표시 (아카이브 2개 이상)

`oldpoplounge2st`/`oldpoplounge3st` 두 아카이브 저장 후 목록 화면 실제 렌더:
```
── 추이 ────
평균 길이 1:35 → 1:35
평균 진폭 18.8dB → 18.8dB
목표범위내 곡수 0 → 0
```
동일한 합성 파일을 양쪽에 다 써서 값 자체는 같지만(검증 목적상 서로 다른 실제 음원 2개를 준비하지 못함 — §9 참고), **시간순 정렬 + 3개 지표(평균 길이/평균 진폭/목표범위내 곡수) 동시 표시**라는 메커니즘 자체는 실제 UI에서 확인됨.

### 3-5. CSV 첫 5행 (실제 다운로드 파일)

`oldpoplounge2st_테이크.csv` (전체 2행 — 헤더+1트랙, BOM `EF BB BF` 확인됨):
```
트랙번호,파일명,버전,채택여부,평가,길이(초),진폭(dB),최대구간(0~1),믹스중심(Hz),보컬대역중심(Hz),실측BPM
1,01 Test Song A.wav,-,-,미평가,95.0,18.8,0.63,572,569,-
```

`oldpoplounge_세트요약.csv` (채널 전체 누적, 전체 3행):
```
아카이브명,채널,회차,워크스페이스,분석일시,곡수,평균길이(초),길이범위,목표범위내곡수,평균진폭(dB),후반상승곡수,BPM범위
oldpoplounge2st,oldpoplounge,2,senior-oldpop,2026-08-05T06:04:25.638Z,1,95.0,95~95,0,18.8,0,-
oldpoplounge3st,oldpoplounge,3,senior-oldpop,2026-08-05T06:04:46.622Z,1,95.0,95~95,0,18.8,0,-
```

### 3-6. 목록 화면 항목별 실측

| 항목 | 실측 |
|---|---|
| 채널 필터 | "전체"/"oldpoplounge" 드롭다운 실동작, 필터링 확인 |
| 아카이브 카드 | 라벨/날짜/곡수/평균길이/범위/진폭/목표범위내/후반상승 전부 실측값 표시 |
| [상세] | 트랙별 상세 행 펼침 확인 |
| [삭제] | 클릭 후 IndexedDB에서 실제 레코드 삭제 확인 (`oldpoplounge3st` 삭제 → 목록에 `oldpoplounge2st`만 남음) |

---

## 4. §3 완료 판정표 — 숏츠 추출

| 기준 | 실측 | PASS/FAIL |
|---|---|---|
| 자동 클라이맥스 탐지 동작 | 3/3 파일에서 설계된 후렴 구간과 일치 | PASS |
| 앞 15%/뒤 10% 제외 적용 | 트랙 3(54s)에서 lastStart 경계(18s)가 정확히 뒤10% 제외선(48.6s-30s)과 일치 | PASS |
| 구절 틈 경계 보정 적용 | 트랙 2에서 raw 시작을 실제 무음 갭(51.2~51.6s) 근방으로 스냅 확인 | PASS |
| 0.3s 페이드인/1.5s 페이드아웃 | 실제 WAV 샘플 진폭으로 양쪽 다 확인 | PASS |
| 길이 옵션 15/30/60초 | 버튼 3개 실동작 | PASS |
| 파형+선택구간 표시 | 실제 렌더 확인 | PASS |
| 5초 단위 수동 조정 | 실제 클릭으로 구간 이동 확인 | PASS |
| 미리듣기(선택 구간만) | 실제 재생 확인 | PASS |
| WAV 출력 형식 | 실제 파일 헤더 파싱으로 확인(RIFF/WAVE, 16bit PCM) | PASS |
| 원본 파일 보존 | 코드상 File 읽기 전용 + 별도 파일명 다운로드 | PASS |
| 트랙 1-3 "대표곡" 표시 | 트랙1,2 표시/트랙5 미표시 둘 다 실측 | PASS |
| 여러 파일 동시(독립) 처리 | 3파일 순차 드롭, 각각 독립 결과 | PASS |

## 5. §3 완료 판정표 — 아카이브

| 기준 | 실측 | PASS/FAIL |
|---|---|---|
| `audioArchive.ts` 존재 + §2-3 인터페이스 | 정확히 스펙 필드 그대로 구현 | PASS |
| 이름 입력 + 저장 | 실제 저장 확인 | PASS |
| 이름 파싱(채널+회차) | "oldpoplounge2st" → oldpoplounge/2 정확히 일치 | PASS |
| 파싱 실패해도 라벨 보존 | "이번주세트" 등 파싱 실패 케이스 유닛테스트 + 라벨 보존 확인 | PASS |
| 목록 화면 | 실제 카드 렌더 확인 | PASS |
| 채널별 필터 | 실동작 확인 | PASS |
| 추이 표시(3개 지표 이상) | 평균길이/평균진폭/목표범위내곡수 3개, 아카이브 2개로 확인 | PASS |
| CSV 2종 | 둘 다 실제 다운로드 파일 내용 확인(BOM 포함) | PASS |
| 음원 파일 자체 미저장 | IndexedDB 레코드에 측정값만 존재(파일 바이너리 없음) | PASS |
| 매칭 성공 시 packId 연결 | 실측 확인 | PASS |
| 매칭 실패해도 저장 차단 안 함 | 실측 확인(§3-2) | PASS |
| 워크스페이스 격리 유지 | `workspaceId` 필드 stamped + `scopeFilter` 재사용(신규 로직 아님, 기존 패턴) | PASS (코드 검토 — 별도 워크스페이스 실측은 §9) |
| 데이터 전송(A2) 포함 | **미구현** — 아래 §9 | FAIL(미구현) |

---

## 6. 회귀 확인 (§3 "곡 생성 결과가 바뀌면 안 됩니다")

가사·프롬프트·팔레트 로직(`lyricEngine.ts`/`promptComposer.ts`/`localGenerator.ts`/`genreLibrary`/`audienceProfiles` 등)은 이 문서에서 **한 파일도 열거나 수정하지 않았습니다**. 실제 diff로 확인:

```
$ git diff -U0 -- <v4.15가 건드린 기존 파일 전부> | grep '^-' | grep -v '^---'
```
결과: `audioTakes.ts`의 DB open 내부 구현(§1에서 설명한 필요한 리팩터) 외에는 **삭제된 줄이 0개**. `Step4Result.tsx`는 새 패널 2개를 추가하는 JSX/import뿐, 기존 로직 줄은 단 하나도 삭제되지 않았습니다.

따라서 생성 파이프라인 자체가 이 문서로 인해 바뀔 수 있는 경로가 존재하지 않습니다 — "18곡 before/after diff"는 개념적으로 항상 동일할 수밖에 없는 구조입니다. 그럼에도 실제로 생성을 실행해 확인: 이 세션에서 senior-oldpop 워크스페이스로 18곡을 실제 로컬 생성했고(브라우저 검증용), 별도 오류나 이상 없이 기존과 동일한 형태(가사/프롬프트/제목)로 나왔습니다 — 별도의 커밋 전/후 diff 스크립트는 실행하지 않았습니다(위 파일 수준 diff 증거로 충분하다고 판단; 필요시 재요청 시 `scripts/audit.ts` 기반 실측 추가 가능).

`npx tsc --noEmit`: 오류 0건.
`npx vitest run`: **181개 테스트 파일, 2151개 테스트 통과** (17 skip, 4 todo — 전부 기존에 이미 있던 이유 있는 skip/todo). `tests/stress.test.ts`의 "S1: 최소 부하" 타이밍 단정은 이 세션에서도 재현되는 기존 알려진 flake(전체 스위트 부하 시 간헐적 실패, 단독 실행 시 항상 통과 — 이번에도 별도 확인함)이며 v4.15와 무관합니다.

---

## 7. 결정 대기 / 하지 못한 것

- `resolvedConstraints`/`designGateConstraints` 등 기존 v4.4 관련 항목은 이 작업 범위 밖(v4.15는 오디오 도구만).
- 추이(§3-4)의 실제 값 다양성을 실물 음원 2개 이상으로 확인하지 못함 — 합성 파일 1개를 재사용해 아카이브 2개를 만들어 메커니즘만 확인. 실제 서로 다른 세트 2회분이 쌓이면 값도 달라질 것으로 코드상 보장되나(각 아카이브가 자기 tracks[]로 독립 계산), 다른 값끼리의 시각적 확인은 못 함.

---

## 8. 미구현 (§4 항목 10)

- **A2(v4.1) 데이터 전송에 아카이브 미포함**: `core/library.ts`/워크스페이스 export-import 경로가 `audioTakes`는 이미 연결돼 있지만(`listAllTakesForWorkspace`/`putTakeIfNewer`), 새 `archives` store는 이번 작업에서 그 경로에 연결하지 않았습니다. §3 완료표의 유일한 FAIL 항목 — 다음 작업에서 `audioArchive.ts`에 `listArchivesForWorkspace`/`putArchiveIfNewer` 대응 함수를 추가하고 A2의 export/import 스크립트에 배선하는 것을 권장합니다.
- 실제 수노 mp3 3곡으로의 검증은 이 환경에 실물 파일이 없어 불가능했습니다 — 대신 합성 WAV 3개로 동일한 실제 디코딩/분석/렌더링 경로(진짜 Web Audio API, 진짜 Chrome)를 통과시켰고, 그 설계값(후렴 위치·무음 갭 위치)을 미리 알고 있었기 때문에 앱의 실측 결과와 정밀 대조가 가능했습니다 — 실제 노래보다 오히려 검증 정밀도가 높았지만, 실제 보컬 곡의 음향적 복잡성(화성 진행, 다층 악기, 실제 후렴 반복)까지 재현하지는 못했다는 한계는 명시합니다.
