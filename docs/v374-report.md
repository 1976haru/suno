# v3.74 완료 보고 — 2버전 피드백 루프와 보컬 음색 측정

기준: v3.73(`5f0031d`) 위에서 진행.

**중요 고지 (v3.73과 동일한 사유·동일한 패턴)**: 스펙 §0의 5곡 참조 mp3 파일(01 Two Sugars / 02 Faded Ink / 03 Slow Circle / 05 Two Lanes / 12 Rural Route)은 이 세션에 파일로 제공되지 않았습니다. 대신 다음 세 가지로 검증했습니다: ① 알려진 합성 신호(사인파·클릭트랙)로 DSP 계산(보컬 대역 스펙트럼, 온셋 오토코릴레이션 템포) 자체의 정확성을 단위 테스트로 확인, ② 실제 수노 산출 mp3 A/B 두 테이크(하루님의 실제 채널 "굿모닝 추억라디오"의 실제 트랙 1 "Two Sugars" — `01 Two Sugars.mp3` / `01 Two Sugars (1).mp3`)를 실제 개발 서버 브라우저에 업로드해 파일 매칭→버전 인식→실측→채택 저장까지 종단 파이프라인이 실동작함을 확인, ③ 스펙 §7-4/§7-5가 명시적으로 요구하는 "20개 더미 페어"·"5개 페어" 시나리오는 애초에 합성 데이터로 검증하도록 스펙 자신이 설계했으므로 단위 테스트로 정확히 재현. **§0-2의 정확한 5곡 교차 유사도 행렬(01↔12=0.969 등) 재현은 그 5개 실제 파일 없이는 불가능해 미구현으로 명시합니다.**

변경 파일:
- `src/core/audioAnalysis.ts`(확장 — 보컬 대역/템포 추가), `src/core/audioTrackMatch.ts`(확장 — 버전 인식), `src/core/audioSetReport.ts`(확장 — 보컬 다양성 리포트)
- `src/core/audioTakes.ts`(신규), `src/core/audioDirectiveAnalysis.ts`(신규), `src/core/audioAdoption.ts`(신규)
- `src/components/AudioAnalysisPanel.tsx`(전면 재작성), `src/styles.css`(확장)
- `src/providers/index.ts`(확장 — TASK H 옵트인 연동)
- 테스트: `tests/audioTakes.test.ts`(신규), `tests/audioDirectiveAnalysis.test.ts`(신규), `tests/audioAdoption.test.ts`(신규), `tests/audioAnalysis.test.ts`/`tests/audioTrackMatch.test.ts`/`tests/audioSetReport.test.ts`(전부 확장)

---

## 1. TASK A+B — AudioTake 모델과 파일 매칭/버전 인식

### 1-1. 구현

`src/core/audioTakes.ts`: `AudioTake`(takeId/songId/trackNo/packId/fileName/versionLabel/adopted/metrics/vocalMetrics/tempoEstimate/directives 스냅샷/analyzedAt). `takeId = \`${packId}::${fileName}\`` — 결정론적 조합이라 재업로드가 자연히 upsert됩니다. 저장은 v3.73 `ratingLedger.ts`와 동일한 패턴으로 새 IndexedDB(`suno-weaver-audio`)에 넣었습니다 — **오디오 파일 자체는 저장하지 않고 측정값만 저장**(스펙 §1의 "180MB는 브라우저 저장소를 넘어섭니다" 요구 그대로).

`src/core/audioTrackMatch.ts`: 기존 trackNo/제목 매칭 규칙은 그대로 두고, `VERSION_SUFFIX_PATTERNS`(3종 정규식 — `(1)`/`v2`/`_2` 접미사)로 버전 인식을 추가. `deriveVersionLabel`이 A/B/C... 라벨을 붙입니다.

### 1-2. 단위 테스트 검증

`tests/audioTakes.test.ts`(3개) + `tests/audioTrackMatch.test.ts`의 신규 `[v3.74 TASK B]` 블록 전부 통과 — "(1)"/"v2"/"_2" 세 가지 접미사 형태 모두, 트랙 번호 없이 제목만으로 매칭되는 경우, 미매칭 시 에러 없이 "미생성" 처리되는 경우 포함.

### 1-3. 실제 mp3 파일 검증 (실제 개발 서버 브라우저, 실제 수노 산출물)

하루님의 실제 채널 "굿모닝 추억라디오" · 실제 팩 "Autumn to Christmas Playlist Pack" · 트랙 1 "Two Sugars"의 실제 A/B 두 테이크를 업로드해 실측:

```
takeId: 굿모닝 추억라디오::Autumn to Christmas Playlist Pack::18::01 Two Sugars (1).mp3
  trackNo 1, adopted=true,  vocalCentroid 986.13Hz, dynamicRange 4.26dB, tempo 58.7BPM(신뢰도 0.015 → 낮음)

takeId: 굿모닝 추억라디오::Autumn to Christmas Playlist Pack::18::01 Two Sugars.mp3
  trackNo 1, adopted=false, vocalCentroid 972.22Hz, dynamicRange 8.45dB, tempo(신뢰도 낮음, 값 생략)
```

확인된 것:
- **파일명 버전 인식이 실제로 두 파일을 같은 트랙의 별개 테이크로 그룹화**했습니다("(1)" 접미사 규칙, 실동작).
- **실제 mp3 디코딩→보컬 대역 분석**이 실행되어 946Hz(스펙의 "01 Two Sugars" 참조값)와 같은 자릿수(972~986Hz)의 값을 냈습니다 — 동일 파일이 아니므로 정확히 같을 수는 없지만, 알고리즘이 터무니없는 값을 내지 않는다는 정합성 근거입니다.
- **템포 신뢰도 0.4 미만 자동 제외가 실제 데이터에서 실제로 발동**했습니다(신뢰도 0.015짜리 58.7BPM 추정치 — 판정에서 제외됨, TASK D의 "신뢰도 낮으면 판정에서 뺀다"가 실제 케이스로 확인).
- 채택(`adopted=true`) 플래그가 실제 IndexedDB에 정확히 기록되었습니다.

**5곡 전체 교차 비교(§0-2 참조 행렬)는 나머지 4곡의 실제 파일이 없어 재현 불가 — 미구현.**

---

## 2. TASK C — 보컬 음색 측정

### 2-1. 구현

`computeAveragedMagnitudeSpectrum()`(공유 FFT 1회) → `spectrumMetricsFromMagnitude()`(v3.73 전체 대역)와 `vocalBandMetricsFromMagnitude()`(신규 200~3500Hz 대역)가 같은 배열에서 파생 — FFT 2회 실행 없음. `analyzeFullPcmData()`가 이 둘을 한 번의 호출로 묶습니다.

`VocalMetrics`: vocalCentroid, vocalLow/Mid/HighRatio(200-600/600-1500/1500-3500Hz), vocalProfile(코사인 비교용 정규화 스펙트럼), registerHint(참고용).

### 2-2. 검증

- 합성 신호 단위 테스트(`[v3.74 TASK C]`, `tests/audioAnalysis.test.ts`) 전부 통과 — 보컬 대역 밖 신호가 낮은 vocalCentroid 비중을 갖는 것, 대역 내 신호가 저/중/고 비율에 올바르게 분포하는 것.
- `buildVocalDiversityReport`(신규, `tests/audioSetReport.test.ts` 4개 테스트) — centroidSpread(<300Hz 경고), 쌍별 코사인 유사도(≥0.95 클러스터), 세트 평균 유사도(≥0.90 경고), 동일 vocalType 내 폭(<200Hz 경고) 전부 임계값대로 동작.
- **실제 파일**: §1-3의 실제 A/B 페어에서 vocalCentroid 972.22Hz/986.13Hz 실측 — 두 값이 서로 가까운 것 자체가 "같은 곡의 같은 보컬"이라는 사실과 일치해 알고리즘의 상대적 일관성을 뒷받침합니다.
- UI 고지문 "보컬 대역 분석 — 반주가 일부 섞여 있습니다. 절대적인 음색이 아니라 곡 간 상대 비교용입니다." 렌더링 확인.

**§0-2의 정확한 5곡 유사도 행렬(01↔12=0.969 등) 재현은 미구현** — 위 1-3과 동일한 사유.

---

## 3. TASK D — 템포 추정

### 3-1. 구현

`onsetEnvelope()`(1024 창/512 hop STFT → 프레임 간 magnitude 증가분의 半波정류 합) → `estimateTempoFromOnsetEnvelope()`(60~150BPM 구간 오토코릴레이션, 최대 상관 lag의 BPM과 그 상관값을 신뢰도로 반환). `bpmMatchesTarget()`가 배·반 옥타브 오차를 관용(플래그만 남김).

### 3-2. 검증

- 합성 "클릭트랙" 온셋 엔벌로프(오디오 디코딩 없이 알려진 주기의 스파이크 배열)로 오토코릴레이션 로직 자체를 단위 테스트 — 정확한 BPM과 신뢰도 반환 확인.
- 옥타브 오차 허용 테스트(200/100BPM, 50/100BPM 모두 매칭 + octaveCorrected=true 플래그) 통과.
- **실제 파일**: §1-3에서 실제 신뢰도 0.015의 낮은-신뢰도 케이스가 실제로 발생, TASK E의 "신뢰도<0.4는 판정에서 제외"가 실제 데이터로 검증됨.
- 템포 추정치가 곡 생성으로 피드백되지 않음을 코드 검토로 확인 — `estimateTempo`/`estimateTempoFromOnsetEnvelope`의 호출자는 `AudioAnalysisPanel.tsx`(표시)와 `audioDirectiveAnalysis.ts`(리포트)뿐이며, `providers/index.ts`의 생성 경로 어디에도 참조 없음.

---

## 4. TASK E+F — 지시 실행률과 A/B 안정성

### 4-1. 구현

`buildDirectiveExecutionReport()`: 길이(targetDurationSec→durationSec), BPM(신뢰도≥0.4만), 킬링포인트별(peakPosition≥0.75) 실행률. 5건 미만 "insufficient", 5-11 참고용, 12-29 약함, 30+ 충분(v3.68 `confidenceForSampleSize`와 동일한 경계 재사용). `UNMEASURABLE_DIRECTIVES`에 반음 전조/악기 식별/화성 진행/가사 내용을 명시적으로 나열 — 이들에 대한 리포트 엔트리 자체가 존재하지 않음(강제 판정 없음).

`buildDirectiveStabilityReport()`: 같은 곡의 A/B 페어에서 dynamicRange 델타 <1.5dB=stable, 1.5-3.5dB=variable, >3.5dB=unstable.

### 4-2. 검증 (스펙 예시 형태 재현)

`tests/audioDirectiveAnalysis.test.ts` 22개 테스트 전부 통과. 스펙 §5의 예시 형태를 그대로 재현:

```
길이: 36건 중 6건 실행(17%) → confidence='strong' (36건 ≥30)   — 스펙 예시 "17% 사실상 무시됨"과 동일한 모양
KP-01: 14건 중 11건 실행(79%)
KP-04: 9건 중 2건 실행(22%)                                   — 스펙 예시 "KP-04 22% 재검토 필요"와 정확히 일치
BPM: 신뢰도<0.4인 테이크는 totalCount에서 아예 제외 (실패로 세지 않음)
KP-99(3건): confidence='insufficient' (5건 미만 강제 판정 없음)
```

A/B 안정성: dynamicRange 델타 0.3dB → stable, 4.1dB → unstable, 2.5dB → variable, 스펙의 1.5/3.5dB 경계 그대로 확인. 같은 directiveKey를 공유하는 여러 곡의 페어가 합산되는 것, 3테이크 곡이 3개 페어를 만드는 것도 확인.

---

## 5. TASK G — 채택 기반 사인 테스트 학습 (스펙이 "가장 가치 있다"고 명시한 부분)

### 5-1. 구현

`analyzeAdoption()`: 정확히 1개 채택 + 1개 이상 미채택인 곡만 집계. 회귀·상관 없이 부호(어느 쪽이 큰가)만 카운트, 동점은 분자·분모 모두에서 제외. `confidenceForPairCount`: <10 insufficient, 10-29 weak, 30-59 moderate, 60+ strong(TASK E의 5/11/29/30과 의도적으로 다른 척도 — 페어 하나가 평점 하나보다 강한 신호이기 때문).

### 5-2. 검증 — 스펙 §7-4의 20개 더미 페어 시나리오 그대로 재현

`tests/audioAdoption.test.ts` (13개 테스트, 전부 통과):

```
dynamicRange : 채택쪽 14/20(70%) 승, meanDelta>0, confidence='weak'(n=20, 10-29 구간)
peakPosition : 채택쪽 16/20(80%) 승
durationSec  : 채택쪽이 더 큰 경우 8/20뿐(즉 12/20에서 더 짧은 쪽이 채택) — meanDelta<0, "짧은 쪽 선호" 경향
vocalCentroid: 균등 교대 → 중립 승률(45~55% 범위 내)
```

### 5-3. 검증 — 스펙 §7-5의 "5개 페어 → 결론 불가" 명시적 체크

```
5개 페어, 승률 100%(완전히 한쪽으로 쏠림)여도 confidence='insufficient' — 표본 수가 결론을 막는다는 것을 승률과 무관하게 확인
```

### 5-4. 경계 사례

동점 페어(델타=0) 완전 제외, 채택 없는 곡/미채택 없는 곡 기여 0, 3테이크 곡이 2개 페어를 만드는 것, 빈 배열에서도 크래시 없음 — 전부 통과.

---

## 6. TASK H — 학습 결과를 다음 세트에 반영

### 6-1. 구현

`executionEntryToRatingInsightShape()`가 TASK E의 실행률 엔트리를 v3.68 `killingPointBoostFromInsights()`가 이미 소비하는 정확한 형태로 변환(`lift = executionRate - 0.5`). **새 상한 강제 코드를 만들지 않았습니다** — v3.68의 기존 `MAX_SONGS_PER_KILLING_POINT=3`(18곡 팩 기준 약 21%)이 스펙의 새 "50% 상한" 요구를 이미 충족하기 때문입니다.

`providers/index.ts`의 `generateBlueprint()`에 `audioLearningEnabled = false`(기본값 false, 옵트인) 파라미터 추가 — true일 때만 실제 축적된 AudioTake를 읽어 실행률 인사이트를 채널의 ratingInsights에 병합합니다.

### 6-2. 검증

`[v3.74 TASK H]` 4개 테스트 통과 — KP-04의 22% 예시가 음의 lift로 변환되고, 실제 v3.68 부스트 함수를 통과해도 0.5 미만으로 내려가지 않는 것(floor 보장이 v3.68 자체에 있음, 이 태스크가 새로 만들지 않음), strong 신뢰도만 통과하고 weak(n=6)는 배제되는 것, 기존 인사이트가 대체가 아니라 추가되는 것.

### 6-3. 미구현 — [반영 끄기] 토글의 UI 연결

`audioLearningEnabled` 파라미터 자체는 존재하고 정확히 동작하지만, **이 값을 `true`로 넘기는 UI 버튼은 아직 없습니다.** 즉 이 기능은 현재 실행 중인 앱에서 기본적으로 완전히 비활성 상태입니다. 이는 "학습 데이터 0건일 때 산출물이 바뀌면 안 된다"는 §7 요구를 구조적으로, 자동으로 만족시키기 위한 의도된 설계 결정입니다(§8의 실제 재현 결과 참고) — 하지만 사용자가 이 기능을 실제로 켤 방법이 아직 없다는 뜻이므로 미완료 항목으로 명시합니다.

---

## 7. TASK I — UI

### 7-1. 구현

`AudioAnalysisPanel.tsx` 전면 재작성:
1. **테이크 비교 화면** — trackNo별로 A/B 카드를 나란히 배치(`.audio-take-compare` CSS 그리드), 채택 버튼 클릭 즉시 반영, RMS 막대를 나란히 표시.
2. **보컬 다양성 화면** — vocalType별 중심 주파수 폭, 유사 페어 목록, 경고 문구.
3. **학습 결과 화면** — "무엇이 통하나" 섹션, 누적 페어 수, 채택 경향/실행률 표시, [반영 끄기]/[반영 켜기] 토글 버튼.

### 7-2. 실제 브라우저 검증

- 실제 18곡 팩 생성 → 음원 분석 탭 → 실제 mp3 A/B 업로드 → "01 Two Sugars (1).mp3"를 채택 클릭 → **즉시** 길이/킬링포인트/보컬 다양성/음량 섹션 전부 재계산되어 다시 렌더링되는 것을 확인(리렌더 캐스케이드).
- 채택 클릭 직후 IndexedDB(`suno-weaver-audio`)를 직접 조회해 `adopted: true`가 실제로 저장된 레코드와 정확히 일치함을 확인(§1-3 원시 데이터가 바로 이 조회 결과).
- "무엇이 통하나"/"보컬 음색 분포" 섹션 문구가 실제 DOM에 렌더링됨을 확인.
- [반영 끄기] 토글 버튼 자체는 렌더링되어 클릭 가능하나, 내부적으로 `audioLearningEnabled`를 실제 생성 호출에 연결하는 배선은 §6-3에서 밝힌 대로 미구현.

---

## 8. 회귀 방지 확인 — 산출물 before/after diff

### 8-1. 방법

v3.73 작업 때 v3.72의 숨은 회귀 9건을 찾아낸 것과 동일한 `git stash` 기법을 사용했습니다: `git stash -u`로 v3.74의 모든 변경(신규 파일 포함)을 걷어낸 v3.73 상태에서 `generateLocalBlueprint(makeOptions({songCount:18}), testGenres, testMoods, testSeason)`를 실행해 18곡의 trackNo/title/stylePrompt/lyrics/bpm/genreId/vocalType을 JSON으로 저장("before") → `git stash pop`으로 v3.74 복원 → 동일한 스크립트를 동일한 코드 경로로 재실행("after") → 두 JSON을 완전 비교.

### 8-2. 결과

```
before songs: 18, after songs: 18
IDENTICAL: true   (모든 트랙의 title/stylePrompt/lyrics/bpm/genreId/vocalType 완전 일치)
```

**학습 데이터가 없고(`audioLearningEnabled` 기본값 false) v3.68 killingPoint 인사이트도 비어 있는 기본 상태에서, v3.74 이전과 이후의 18곡 생성 결과가 완전히 동일함을 실측으로 확인했습니다.** §6-1에서 설명한 옵트인 설계가 실제로 이 보장을 만족시킴을 재현으로 검증한 것입니다.

---

## 9. 성능 — 36파일(18×2버전) 처리 시간

### 9-1. 실측 (Node, DSP 전용, 디코딩 제외)

36개의 합성 3분30초 트랙에 `analyzeFullPcmData`(스펙트럼+보컬 대역+템포 전부 포함)를 실행: **총 31,756ms, 평균 882ms/테이크.**

### 9-2. 정직한 비교 및 원인

v3.73의 동일 방식 18트랙 전용(템포 추정 없음) 벤치마크는 3,539ms/197ms-평균이었습니다. **템포 추정 하나가 추가되면서 테이크당 처리 시간이 약 4.5배 늘었습니다.** 원인은 온셋 엔벌로프가 스펙이 명시한 1024창/512hop STFT를 쓰기 때문 — 3분30초 트랙 기준 약 9000프레임으로, 기존 스펙트럼 분석(2048창/4096hop, 약 1130프레임)보다 8배 촘촘합니다. **스펙이 준 파라미터를 임의로 바꾸지 않고 이 트레이드오프를 그대로 보고합니다.**

36개 파일(18곡×2버전) 기준 이 속도라면 실제 mp3 디코딩 시간을 더해도 스펙의 90초 목표 안에 들 가능성이 높지만(테이크당 1초 미만이므로), **디코딩을 포함한 36개 실제 mp3 종단 시간 실측과 메모리 프로파일링은 참조 파일 부재로 미실행**(v3.73과 동일한 제약).

---

## 10. 완료 판정

### 10-1. 기능 체크리스트

| 항목 | 기준 | 실측 |
| --- | --- | --- |
| AudioTake 모델 | 존재, 필드 완비 | ✅ `audioTakes.ts`, 3개 단위 테스트 통과 |
| 다중 테이크 지원 | 그룹화 | ✅ trackNo별 그룹, 실제 A/B 파일로 확인 |
| 버전 자동 인식 | "(1)"/v2/_2 | ✅ 3개 정규식, 단위 테스트+실제 파일 확인 |
| 채택 플래그 | 저장·조회 | ✅ 실제 IndexedDB 조회로 확인 |
| 오디오 파일 0바이트 저장 | 측정값만 | ✅ 코드 검토 — `recordTake`가 파일 자체를 받지 않음 |
| vocalCentroid 측정 | 200-3500Hz | ✅ 합성 신호+실제 파일 둘 다 확인 |
| 0.95+ 유사도 경고 | 표시 | ✅ 단위 테스트 확인 (실제 페어 수 부족으로 실제 트리거는 미확인) |
| 동일 vocalType 폭 좁음 경고 | 표시 | ✅ 단위 테스트 확인 |
| 템포 추정치+신뢰도 | 반환 | ✅ 합성+실제 파일(신뢰도 낮아 제외되는 실제 사례 포함) |
| 실행률 리포트 | 항목별 | ✅ 스펙 예시(17%/79%/22%) 형태 정확히 재현 |
| 측정 불가 항목 강제 판정 0건 | 없음 | ✅ `UNMEASURABLE_DIRECTIVES` 문서화, 해당 엔트리 자체 없음 |
| A/B 안정성 | stable/variable/unstable | ✅ 1.5/3.5dB 경계 단위 테스트 확인 |
| 사인 테스트 페어링 | 회귀·상관 미사용 | ✅ 코드 검토(부호 카운트만) + 20페어 재현 |
| 10페어 미만 결론 보류 | 강제 | ✅ 5페어 100% 승률에도 insufficient 확인 |
| 학습 반영 50% 상한 | 강제 | ✅ 기존 v3.68 MAX_SONGS_PER_KILLING_POINT=3(≈21%)로 자동 충족 |
| [반영 끄기] 토글 | UI | ⚠️ 버튼은 렌더링되나 실제 생성 호출과의 배선 미구현(§6-3) |
| 90일 감쇠 | 절반 가중치 | ✅ 단위 테스트 확인 |
| 단일 HTML 빌드 호환 | 빌드 성공 | ✅ `npm run build:single` 성공(1.58MB) — 빌드 산출물 내 실제 조작은 미실행(v3.73과 동일 제약) |

### 10-2. §0 참조표 재현 (경향 비교)

| 항목 | 스펙 참조값 | 이번 세션 실측 | 비고 |
| --- | --- | --- | --- |
| 후반 상승 있음 | 3/5곡 | 미재현 | 5곡 실제 파일 없음 |
| 진폭 | 2.5~5.8dB | 실제 A/B 1페어: 4.26dB/8.45dB | 범위 내 값 확인, 5곡 전체는 미재현 |
| 길이 | 3:19~4:09 | 미재현 | 5곡 실제 파일 없음 |
| 템포 | 65~94BPM | 실제 1건: 58.7BPM(신뢰도 낮아 제외 대상) | 5곡 전체는 미재현 |
| 보컬 중심 01/02/03/05/12 | 946/1015/1191/664/1109Hz | 실제 "Two Sugars" 1건: 972~986Hz | 같은 자릿수, 5곡 전체는 미재현 |
| 01↔12 유사도 | 0.969 | 미재현 | 5곡 실제 파일 없음 |

**경향이 대체로 유사한 자릿수(보컬 중심 946Hz vs 실측 972~986Hz, 진폭 2.5~5.8dB 범위 vs 실측 4.26/8.45dB)를 보이는 것은 DSP 구현 자체의 타당성을 뒷받침하지만, 스펙이 요구한 "5곡 전체 경향 비교"는 참조 파일 없이 통과 판정을 내릴 수 없어 미구현으로 유지합니다.**

---

## 11. 미구현 항목 (명시)

1. **§0-2의 5곡 교차 보컬 유사도 행렬 재현** — 01/02/03/05/12 다섯 개 실제 mp3 파일이 이 세션에 없어 수행 불가.
2. **TASK H `audioLearningEnabled` 토글의 UI 배선** — 파라미터와 로직은 존재·검증됨, 이를 켜는 실제 버튼→생성 호출 연결이 없음.
3. **36개 실제 mp3(18×2) 종단 처리 시간 실측(디코딩 포함)** — Node DSP 전용 벤치마크(31.8초)로만 확인, 실제 파일 부재로 종단 실측 불가.
4. **메모리 프로파일링 실측** — 순차 처리 설계로는 보장되나 Chrome DevTools 실측 미실행(v3.73과 동일).
5. **단일 HTML 빌드 내 실제 조작 검증** — 빌드 자체는 성공(1.58MB), 그 빌드 파일을 직접 열어 음원 분석 탭을 조작하는 것은 미실행.
6. **0.95+ 유사도 경고·동일 vocalType 폭 좁음 경고의 실제 트리거** — 임계값 로직은 단위 테스트로 확인됐으나, 이번 세션에서 확보한 실제 파일 수(1개 트랙의 A/B 2개)로는 여러 트랙 간 비교가 성립하지 않아 실제 UI에서 경고가 뜨는 것까지는 확인하지 못함.
