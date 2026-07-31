# v3.69 완료 보고 — 독립 실행 수노모드 · 가사 파일 관리 체계

## 0. 요약

| TASK | 상태 |
|---|---|
| A — 독립 실행 수노 진행 모드 (오프라인 HTML) | ✅ 완료, 실제 브라우저 검증 완료 |
| B — 세트 파일명 통일 (`utils/setNaming.ts`) | ✅ 완료 |
| C — 브릿지 출력 `lyrics/<setName>.json` + 덮어쓰기 금지 + 파일명 기반 채널 자동 선택 | ✅ 완료 |
| D — `meta` 블록 + "가사 파일 → 바로 SRT" 진입점 | ✅ 완료 |
| 회귀 검증 (18곡 출력 동일성) | ✅ 완료, 아래 §7 |
| 테스트 | 143 files / 1635 tests, 전부 통과 (기존 1620 + 신규 15) |

미구현 항목(§8)이 있으므로 먼저 훑어보시길 권장합니다.

---

## 1. TASK A — 독립 실행 수노 진행 모드

**파일**: `src/core/standaloneProgressExport.ts` (신규) — `buildStandaloneProgressHtml(songs, meta)`, `standaloneProgressFileName(meta)`.

React를 번들하지 않고 `SunoProgressMode.tsx`의 UI/키보드 로직을 순수 vanilla JS로 재구현(의도적 중복). 진행률/평가는 `localStorage`에 저장(IndexedDB 아님 — 독립 파일은 앱의 DB에 접근할 수 없고 필요도 없음).

### 1-1. 실제 브라우저 검증 (직접 열어서 조작함)

Chrome 확장 도구가 `file://` 직접 네비게이션을 막아, 스크래치 디렉터리에 최소 정적 파일 서버(빌드 스텝 없음, Vite 아님)를 띄워 열었음 — "파일이 생성됐다는 것만으로는 검증이 아니다"라는 지시에 따라 실제 조작으로 확인:

| 항목 | 결과 |
|---|---|
| 파일 크기 (18곡, 실제 데이터) | **25.1 KB** (목표 ≤300KB 대비 여유 충분) |
| 오프라인 (외부 네트워크 0건) | ✅ `read_network_requests`로 확인 — 자기 자신의 HTML GET 1건 + Chrome 확장 자체 리소스 3건만 존재, CDN/폰트/API 호출 0건 |
| 키보드 1/2/3/4 복사 | ✅ 실제 키 입력으로 제목/스타일/가사 복사 확인, 버튼이 체크 표시로 전환됨 (스크린샷 확인) |
| Exclude 필드(4번) 조건부 노출 | ✅ `excludePrompt`가 있는 트랙(3번)에서만 4번째 필드가 나타남을 확인 |
| G/O/B 평가 키 | ✅ "g" 입력 → 트랙 스트립에 "●" 표시, "평가 1/18곡"으로 갱신, 자동으로 다음 곡 이동 |
| localStorage 진행률 저장 | ✅ 페이지 전체 새로고침 후에도 "평가 1/18곡", 마지막 붙여넣기 시각, 트랙 3의 "●" 마크가 모두 유지됨 |
| dev 서버 꺼진 상태에서 동작 | ✅ 앱의 Vite 서버(127.0.0.1:5200)와 무관한 별도 정적 서버로 열었고, 정상 동작 |
| "[평가 내보내기]" 버튼 | ✅ 클릭 시 `20260731_굿모닝추억라디오_비오는날의올드팝_평가.json` 다운로드, 내용이 `ratingLedger.ts`의 `RatingRecord[]` 형식과 정확히 일치함을 확인 (실제 다운로드 파일 열어봄) |

다운로드된 실제 평가 파일 내용(검증 후 삭제):
```json
[
  {
    "songId": "song-3",
    "packId": "test-pack-id",
    "rating": "good",
    "ratedAt": "2026-07-31T12:54:30.260Z",
    "attributes": {
      "genreId": "city-pop",
      "eraTag": "80s",
      "bpm": 99,
      "vocalType": "female",
      "structureTemplate": "T2",
      "moneyChordId": "emotional",
      "channelId": "morning-memory-radio"
    }
  }
]
```

### 1-2. UI 진입점

`Step4Result.tsx`의 "🎧 수노 진행 모드" 버튼 옆에 "[독립 파일로 내보내기]" 버튼 추가 (`handleExportStandaloneProgress`).

---

## 2. TASK B — 세트 파일명 통일

**파일**: `src/utils/setNaming.ts` (신규) — `buildSetName(parts)`, `parseSetName(name)`, `sanitizeLabel(label)`.

### 2-1. buildSetName 실행 예시 (5종, 실제 실행 결과)

| 케이스 | 입력 | 출력 |
|---|---|---|
| 한글 채널 | `굿모닝 추억라디오` / `비 오는 날의 올드팝` | `20260731_굿모닝추억라디오_비오는날의올드팝` |
| 긴 컨셉(20자 초과 절단) | `City Night Drive` / `A very long user-written concept description...` | `20260731_CityNightDrive_Averylonguserwritten` |
| 특수문자 제거 | `lo-fi & chill (vol.2)!` / `Rainy Night's Café Jazz!!` | `20260731_lofichillvol2_RainyNightsCaféJazz` |
| 같은 날 중복 (1st/2nd) | `굿모닝 추억라디오` / `비 오는 날` | `20260731_굿모닝추억라디오_비오는날` → `..._02` |
| 컨셉 누락 | `굿모닝 추억라디오` / `''` | `20260731_굿모닝추억라디오_set` |

### 2-2. parseSetName 라운드트립 검증 (실제 실행)

```
20260731_굿모닝추억라디오_비오는날의올드팝 -> {"date":"2026-07-31","channelLabel":"굿모닝추억라디오","conceptLabel":"비오는날의올드팝"}
20260731_CityNightDrive_lofichillvol2 -> {"date":"2026-07-31","channelLabel":"CityNightDrive","conceptLabel":"lofichillvol2"}
```
(위 date는 로컬 타임존으로 표시 — 실제 Date 객체는 정확히 2026-07-31 00:00 로컬)

`tests/setNaming.test.ts` 13개 테스트로 이 규칙을 고정 (한글, 긴 컨셉, 특수문자, 중복 접미사, 컨셉 누락, 라운드트립, pre-v3.69 이름에 대한 null 반환, 잘못된 달력 날짜 거부 등).

### 2-3. 적용 대상

| 대상 | 이전 | 이후 |
|---|---|---|
| 브릿지 JSON 출력 경로 | `songs-output.json` | `lyrics/<setName>.json` |
| 멀티세트 브릿지 출력 | `songs-output-setNN.json` | `lyrics/<setName>_setNN.json` |
| SRT zip | `<projectTitle>-srt.zip` | `<setName>_srt.zip` |
| 썸네일 워크셋 | `<groupId>-thumbnail-prompts.md` | `<setName>_썸네일.md` |
| 평가 내보내기 (독립 HTML) | (v3.68엔 전체 평가만 있었음) | `<setName>_평가.json` (신규) |
| 독립 수노모드 HTML | (없음) | `<setName>_수노모드.html` (신규) |

---

## 3. TASK C — 브릿지 출력 경로 + 덮어쓰기 금지 + 파일명 기반 채널 자동 선택

### 3-1. 생성된 지시문의 Output requirement 섹션 전문 (실제 실행 결과)

```
Output requirement:
- Write a new file named "lyrics/20260731_굿모닝추억라디오_비오는날의올드팝.json" in the current directory.
- If the "lyrics" folder doesn't exist yet, create it first.
- Never overwrite an existing file. If "lyrics/20260731_굿모닝추억라디오_비오는날의올드팝.json" already exists, append "_02" (then "_03", etc.) before the .json extension and write there instead.
- Its content must be exactly { "songs": [ ... ] } — 3 objects total, ...
- Optional (recommended): also add a top-level "meta" field alongside "songs" — { "meta": { ... }, "songs": [ ... ] } — copying "meta" from the request payload above verbatim. Do not invent or recompute any of its values yourself.
```

마스터 모드(`buildMultiSetClaudeCodeMasterInstruction`)의 "Output requirement for every set:" 섹션에도 동일한 폴더 생성/덮어쓰기 금지/meta 복사 지시 3줄을 추가함.

### 3-2. 파일명·meta 기반 채널 자동 선택

`App.tsx`에 `channelFromBridgeFile(name, rawText)` 추가: 파일의 `meta.channelId` → `meta.channelLabel` → 파일명(`parseSetName`) 순으로 매칭해 채널을 자동 선택하고, 현재 선택된 채널과 다르면 자동 전환한 뒤 그 채널로 임포트. 단일 임포트(`onImportSongsJson`)와 멀티세트 임포트(`onImportMultiSetSongsJson`, 첫 파일 기준) 양쪽에 적용.

**주의 — 실제 코드를 보고 재확인한 사실**: 애초 스펙이 언급한 "채널·시즌을 먼저 선택하지 않으면 조용히 실패"는, 코드를 직접 읽어보니 실제로는 "조용한" 실패가 아니었음 — `bridgeImportUi.ts`의 `runBridgeImportAction`이 이미 사전조건 체크 후 명시적 실패 리포트(`BRIDGE_IMPORT_PRECONDITION_REASON`)를 표시하고 있었음. 드롭존의 `disabled` CSS와 실제 `onDrop` 핸들러가 어긋나 있는 것(드래그는 막히지 않음)은 사실이지만, 결과적으로 실패 시 사용자에게 명확한 메시지가 뜸 — 완전한 침묵은 아니었음. 그럼에도 파일명/메타 기반 자동 선택은 "채널을 매번 수동으로 먼저 골라야 하는" 실질적 마찰을 없애는 유효한 개선이라 예정대로 구현함.

---

## 4. TASK D — meta 블록 + "가사 파일 → 바로 SRT"

### 4-1. meta 블록 최상위 구조 (실제 실행 결과)

```json
{
  "setName": "20260731_굿모닝추억라디오_비오는날의올드팝",
  "generatedAt": "2026-07-31T13:03:42.651Z",
  "channelId": "good-morning-memory-radio",
  "channelLabel": "굿모닝 추억라디오",
  "conceptLabel": "비 오는 날의 올드팝",
  "songCount": 3,
  "lyricLanguage": "english"
}
```
값은 전부 앱이 이미 알고 있는 값이라 에이전트는 "복사만" 하면 되도록 지시문에 명시(직접 계산/추측 금지).

### 4-2. meta 없는 구파일 임포트 테스트 (통과)

`tests/claudeCodeBridge.test.ts` — `'TASK v3.69 (TASK D): imports a pre-v3.69 file with no "meta" block exactly as before (backward compatible)'`: `{ songs: [...] }`만 있는 파일이 이전과 동일하게 임포트됨을 확인 (`report.blueprint` not null, `importedCount === 1`, `blueprint.generatedAt`은 import 시각으로 폴백).

### 4-3. meta 있는 파일 임포트 — generatedAt 반영 테스트 (통과)

같은 파일에서 `meta.generatedAt: '2026-01-15T09:00:00.000Z'`를 주면 `blueprint.generatedAt`이 정확히 그 값으로 설정됨(수입 시각이 아님)을 확인.

### 4-4. "가사 파일 → 바로 SRT" 진입점

`Step3Generate.tsx`에 "가사 파일 → 바로 SRT 만들기" 버튼 추가 → `onImportSongsJsonForSrt` → `App.tsx`의 `onImportSongsJson(file, 'srt')`가 동일한 임포트 파이프라인을 타되 `workspaceFocus`를 `'srt'`로 설정해 결과 화면의 SRT 탭으로 바로 이동(팩 재생성 없음).

---

## 5. 완료 판정표

### 5-1. 기능 체크리스트

| 항목 | 판정 | 근거 |
|---|---|---|
| 독립 HTML 오프라인 동작 | PASS | §1-1, 실제 브라우저 네트워크 요청 0건 |
| 파일 크기 ≤300KB | PASS | 25.1KB (18곡 실 데이터) |
| 키보드 1/2/3/4 SunoProgressMode.tsx와 동일 | PASS | §1-1 실제 키 입력 검증 |
| localStorage 진행률 저장 (재시작 후 유지) | PASS | §1-1 새로고침 후 상태 유지 확인 |
| 앱 재빌드 내성 | PASS | 독립 파일이 별도 정적 서버로 동작, 앱의 Vite 서버와 무관 |
| buildSetName/parseSetName 라운드트립 | PASS | §2-2, 13개 유닛 테스트 |
| Codex 출력 경로 변경 (`lyrics/<setName>.json`) | PASS | §3-1 |
| `_02` 충돌 처리 | PASS | §2-1 4번 예시 + 지시문 텍스트(§3-1)에 명시 |
| SRT zip 이름 변경 | PASS | `SrtExportPanel.tsx` |
| meta 블록 존재 | PASS | §4-1 |
| meta 없는 구파일 호환 임포트 | PASS | §4-2 |
| 파일명/메타 기반 채널 자동 선택 | PASS | §3-2 |
| 파일명 기반 시즌 자동 선택 | **미구현** | §8-1 |
| 가사 파일 → SRT 직행 | PASS | §4-4 |

### 5-2. 회귀 방지 체크리스트 (이전 스펙들의 품질 지표)

| 항목 | 판정 | 근거 |
|---|---|---|
| 동일 concept+seed → stylePrompt/lyrics 바이트 동일 | PASS | §7, 18곡 전수 비교(songId/generatedAt 제외 전부 동일) |
| 프롬프트 길이 350–650 / 서술어 20–35개 등 기존 지표 | PASS (불변) | 관련 로직(promptComposer.ts, quality.ts 등) 일절 미수정 |
| 가사 내 편곡 어휘 유출 없음 | PASS (불변) | lyricEngine.ts/lyricVocabularyGuard.ts 미수정 |
| 개별 SRT 파일명 규칙 (`01_제목_모드.srt`) 불변 | PASS | `srtExport.ts:165` 미수정 확인 |
| `songs` 배열 구조 불변 (meta는 최상위 추가만) | PASS | §4-1, 기존 필드 변경 없음 |
| lyricEngine.ts / lyricVocabularyGuard.ts 미수정 | PASS | git diff에 해당 파일 없음 |

---

## 6. 테스트

- `tests/setNaming.test.ts` — 13 tests (기존)
- `tests/claudeCodeBridge.test.ts` — 44 tests (기존 38 + 신규 6: meta 페이로드 포함, backward-compat, generatedAt 반영, extractBridgeImportMeta)
- `tests/standaloneProgressExport.test.ts` — 9 tests (신규): 파일명 스킴, 오프라인/자기완결성, 300KB 예산, 키보드 단축키 일치, localStorage 사용, `</script>` 이스케이프, 필드 라운드트립, 헤더/평가 내보내기 문구, React 미포함
- 전체: **143 files / 1635 tests, 전부 통과**

```
Test Files  143 passed (143)
     Tests  1635 passed (1635)
```

---

## 7. 회귀 검증 — 18곡 출력 동일성

동일한 옵션/시드로 `generateLocalBlueprint`를 두 번 실행해 18곡 전체를 필드 단위로 비교:

```
top-level (excl. songs/generatedAt) identical: true
track 1~18 diffs: songId   (그 외 필드는 전부 동일 — stylePrompt, lyrics 포함)
```

`songId`는 매 생성마다 새로 발급되는 것이 원래 설계(v3.68)이므로 예상된 차이이며, 그 외 모든 필드(특히 `stylePrompt`, `lyrics`)는 두 실행 간 바이트 단위로 동일함을 확인. `generatedAt`도 신규 메타 필드라 당연히 다름(타임스탬프).

추가로 `grep`으로 `generatedAt`의 모든 소비처를 확인한 결과, 파일명 생성(SrtExportPanel/standaloneProgressExport/Step4Result)과 블루프린트 메타 구성(localGenerator/providers/bridgeInstruction/bridgeImport) 외에는 어디서도 읽지 않음 — 즉 어떤 프롬프트/가사 생성 로직도 이 필드에 의존하지 않음을 코드 레벨에서 확인.

---

## 8. 미구현 (명시적 고지)

1. **파일명/메타 기반 시즌 자동 선택** — `SeasonPack.period`가 자유 텍스트라 달력 날짜로 기계적으로 파싱할 수 없어 신뢰도가 낮다고 판단, 구현하지 않음. 채널 자동 선택만 구현(§3-2).
2. **Batch API 비동기 경로의 `generatedAt`** — grep으로 blueprint identity 구성 지점을 찾은 결과 실시간(realtime) 경로의 `identity.base =` 대입 한 곳만 존재. Batch API의 비동기 잡 경로에 별도의 blueprint-identity 구성 지점이 있는지는 이번 작업 범위에서 별도로 추적하지 않았음 — 있다면 그 경로는 여전히 소비 시점의 "now"로 폴백함(허용 가능한 근사치로 판단).
3. **평가(ratings) JSON 재-임포트 UI** — 독립 HTML의 "[평가 내보내기]" 형식은 `ratingLedger.ts`의 `RatingRecord[]`와 정확히 일치하도록 만들었으나, 앱 쪽에 이 JSON을 다시 읽어들이는 가져오기 UI는 이번 조사에서 확인되지 않았음(기존 `RatingInsightsPanel.tsx`는 내보내기만 지원). 향후 그 기능이 추가되면 그대로 호환될 형식이라는 의미이며, 지금 당장 재-임포트가 가능하다는 뜻은 아님.
