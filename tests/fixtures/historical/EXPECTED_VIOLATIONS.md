# historical/ — 각 파일이 검출해야 하는 known-bad 위반

지시문 33 (§4). 지시문 32 §2의 `blocking/` fixture와 같은 구조 — 값의 출처는 항상 `tests/historicalFixtures.test.ts`. 이 파일들은 하루의 실제 20260807 발매 팩(60s/70s)과 브릿지 임포트 실측 샘플이며 **무편집**이다. 여기서 검출되는 위반은 "검사기가 알려진 결함을 여전히 잡아내는가"를 확인하는 것이지, "현재 생성기가 이 결함을 만든다"는 뜻이 아니다 — 현재 생성기 검증은 하루가 새로 뽑는 세트로만 한다(§4-3, 별도 표).

| fixture | expectedViolations | 검출 방식 |
|---|---|---|
| `20260807-60s.json` | `dual-gender-vocal-declaration`(다수 트랙) · `composition-instruction-leak`(T11) · `era-drift`(다른 시대 단독, T5·T6·T8·T10·T12·T13·T14·T16·T17·T18) | `song.warnings`에 "Prompt spec violation (vocal)"/"composition/performance instruction leaked", `runFullAudit`의 `era_prompt_other_pure` 항목 status |
| `20260807-70s.json` | `dual-gender-vocal-declaration`(다수 트랙) · `composition-instruction-leak`(T11) · `era-drift`(T6·T10·T14·T18) | 동일 |
| `bridge-import-sample.json` | `tempo-mood-contradiction`("gentle" vs BPM>100, 다수 트랙) · `dual-gender-vocal-declaration`(T13·T16·T17·T18) | `song.warnings`에 "Tempo compliance: 템포 서술과 BPM 모순" |

**주의**: `distinctChoice gate`(곡별 다른 시도 이행률) 항목은 이 3개 파일 모두 "이행률 미측정"으로만 뜬다 — `--pack` shadow-slot 재구성이 `distinctChoiceRuleId`를 복원하지 않는 구조적 한계이지, 검사기가 못 잡는 결함이 아니다. `expectedViolations`에서 제외했다(정직하게 "재현 불가"로 남김, 억지로 검출된 것처럼 넣지 않는다).
