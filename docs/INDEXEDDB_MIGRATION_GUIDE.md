# IndexedDB 마이그레이션 가이드

이 문서는 `core/workspaceMigration.ts`가 실제로 수행하는 IndexedDB 마이그레이션의 범위, 안전 계약, 그리고 실패 시 대응 방법을 정리합니다. (지시문 07 TASK F)

## 대상 저장소 (17개, 앱 시작 시 1회 자동 실행)

`runWorkspaceMigrationOnce()`가 병렬로 처리하는 실제 Pattern-A(IndexedDB) 저장소:

| 저장소 | DB_NAME | 마이그레이션 함수 |
|---|---|---|
| 팩 라이브러리 | `suno-weaver-library` | `migrateLibraryWorkspaceTags` |
| 훅 이력 | `suno-weaver-hooks` | `migrateHookLedgerWorkspaceTags` |
| 상황(situation)/장면 시그니처 | `suno-weaver-situations` | `migrateSituationLedgerWorkspaceTags` |
| 가사 문장 이력 | `suno-weaver-lyric-lines` | `migrateLyricLineLedgerWorkspaceTags` |
| 평가(rating) | `suno-weaver-ratings` | `migrateRatingLedgerWorkspaceTags` |
| 영상 이력 | `suno-weaver-videos` | `migrateVideoLedgerWorkspaceTags` |
| 사용량 | `suno-weaver-usage` | `migrateUsageLedgerWorkspaceTags` |
| 배치 작업 | `suno-weaver-batch` | `migrateBatchJobsWorkspaceTags` |
| 오디오 테이크 | `suno-weaver-audio` | `migrateAudioTakesWorkspaceTags` |
| 발매 준비 이력 | `suno-weaver-release-readiness` | `migrateReleaseReadinessArchiveWorkspaceTags` (지시문 07에서 신규 추가) |

**마이그레이션이 필요 없는 저장소** (`workspaceId`가 생성 시점부터 항상 필수 필드였음 — 되짚어 채울 미태그 레코드가 구조적으로 존재할 수 없음, 실제 소스 코드로 확인됨):
- `suno-weaver-combo-variations` (콤보 변주 이력)
- `suno-weaver-generation-reservations` (생성 예약)

**전용 저장소가 없는 개념**: "모티프(motif)"는 별도 IndexedDB가 없습니다 — `data/motifFamilies.ts`의 쿨다운 로직은 situation ledger의 `SceneSignature`/`frameId` 레코드에서 파생되므로, 위 situation ledger 마이그레이션이 이미 커버합니다.

## 안전 계약 (모든 마이그레이션 공통)

1. **Additive(추가적)**: 기존 레코드를 절대 삭제하지 않습니다. `workspaceId` 필드가 없는 레코드에만 `put()`으로 채워 넣습니다.
2. **Idempotent(멱등)**: 여러 번 실행해도 결과가 같습니다 — 이미 태그된 레코드는 건드리지 않습니다.
3. **부분 실패 격리**: 저장소 하나의 마이그레이션이 실패해도 나머지 저장소, 그리고 앱 전체는 절대 멈추지 않습니다 (`migrateStore()`의 개별 try/catch).
4. **1회 실행 보장**: `localStorage`의 `suno-weaver-workspace-migration-v1-done` 플래그로 가드됩니다 — 이후 앱 재시작마다 즉시 no-op.

## 진행률 표시 (지시문 07에서 신규 추가)

```ts
await runWorkspaceMigrationOnce((done, total) => {
  // done/total: 실제 저장소 수 + 실제 legacy localStorage 키 수 (하드코딩 아님)
});
```

## 백업

`exportPreMigrationBackup()`이 마이그레이션 실행 **전** 팩 라이브러리 전체를 JSON Blob으로 내보냅니다 — 이 앱이 실제로 데이터 손실을 막아야 한다고 명시한 유일한 저장소(§4 자체 문서)에 대한 백업입니다. 그 외 저장소(평가/훅/오디오 테이크 등)는 additive-only 계약 자체가 손실을 구조적으로 막으므로 별도 사전 백업 없이도 안전합니다.

전체 백업이 필요하면 `core/workspaceTransfer.ts`의 워크스페이스 내보내기 기능(설정 → 데이터 관리)을 마이그레이션 실행 전에 사용하세요.

## 복구(Repair) 모드 — `/?repair=1`

`core/browserRecovery.ts`의 `runBrowserRecoveryFromUrl()`은 IndexedDB 손상/버전 업그레이드 정지처럼 **더 이상 안전하게 복구할 수 없는** 상황을 위한 최후 수단입니다. `RECOVERABLE_DATABASES`에 나열된 17개 데이터베이스(설정 DB `suno-weaver-settings`는 API 키를 담고 있어 의도적으로 제외)를 **전부 삭제**합니다.

**지시문 07에서 발견/수정한 실제 버그**: 이 목록이 오래되어(stale) 최근 추가된 8개 실제 DB(situations/lyric-lines/combo-variations/generation-reservations/prompt-fingerprints/exploration/release-readiness/verified-combos)가 빠져 있었습니다 — `/?repair=1`을 실행해도 이 8개는 삭제되지 않아 "전부 초기화" 계약이 깨져 있었습니다. `tests/browserRecovery.test.ts`가 실제 소스의 모든 `DB_NAME` 선언을 스캔해 이 목록과 대조하는 회귀 테스트를 추가했습니다 — 앞으로 새 저장소가 추가되고 이 목록 갱신을 잊으면 CI가 실패합니다.

**사용법**: 브라우저 주소창에서 `?repair=1`을 붙여 접속 → 확인 없이 즉시 17개 DB 삭제 → URL에서 파라미터 제거 → 다음 로드 시 "복구 완료" 알림 표시. **API 키/제공자 설정은 보존됩니다.**

## 실패 시 대응

- 마이그레이션 자체가 실패해도 앱은 멈추지 않고, `runWorkspaceMigrationOnce()`의 반환값(`WorkspaceMigrationReport.stores[].error`)에 실패 사유가 담깁니다 — UI는 이를 조용히 무시하지 말고 사용자에게 경고해야 합니다 (현재 호출부는 콘솔 로그만 남기는 수준 — 실제 UI 알림 배선은 향후 과제).
- 데이터가 실제로 깨져 앱이 뜨지 않는 극단적 상황에서만 `/?repair=1`을 사용하세요 — 이는 되돌릴 수 없습니다.
