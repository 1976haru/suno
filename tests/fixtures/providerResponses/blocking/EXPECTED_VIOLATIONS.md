# blocking/ — 각 fixture가 검출해야 하는 위반

지시문 32 (§2). 실제 값은 `tests/providerResponseFixtures.test.ts`가 기계적으로 단언한다(이 파일은 그 단언을 사람이 한눈에 보도록 요약한 것 — 값의 출처는 항상 테스트 코드다).

| fixture | expectedViolations | 검출 방식 |
|---|---|---|
| `duplicateTrackNo.json` | `whole-response-rejected` (trackNo 중복) | `report.blueprint === null`, `skippedReasons`에 "trackNo"+"중복" |
| `invalidTrackNo.json` | `whole-response-rejected` (trackNo 범위 밖) | `report.blueprint === null`, `skippedReasons`에 "trackNo" |
| `truncatedJson.json` | `parse-failure` | `report.blueprint === null`, `skippedReasons`에 "JSON을 해석하지 못했습니다" |
| `missingStylePrompt.json` | `required-field-missing:stylePrompt` (해당 트랙만) | 1곡 skip, `skippedReasons`에 "stylePrompt", 나머지 4곡은 정상 import |
| `missingLyrics.json` | `required-field-missing:lyrics` (해당 트랙만) | 1곡 skip, `skippedReasons`에 "lyrics" |
| `normal.json` | `tempo-mood-contradiction`(kr-2030/kr-kids/jp-kids/kr-idol-male/kr-idol-female) · `genre-contradiction`(jp-2030, "brushed drum kit" vs jp2030-heisei-nostalgia) · `lyrics-quality`(senior-oldpop, 문장 반복+음절 밀도, T5) | 워크스페이스별 정확한 trackNo·문구는 `EXPECTED_VIOLATIONS`/`SENIOR_OLDPOP_EXPECTED`(테스트 파일) 참고 |
| `withPreamble.json` | normal.json과 동일(같은 JSON, prose로 감싼 것뿐) | 동일 |

**주의**: `normal.json`/`withPreamble.json`은 워크스페이스마다 검출되는 위반의 종류·트랙 번호가 다르다 — 이 fixture 하나가 7개 워크스페이스 각각에 대해 서로 다른 진짜 모순을 실측 노출한다(지시문 32 §2-2가 예로 든 정확한 패턴들과 일치). 내용은 무편집.
