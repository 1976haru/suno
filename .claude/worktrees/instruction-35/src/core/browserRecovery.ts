/**
 * v4.0 (TASK A) — ported from main's browserRecovery.ts (the emergency-
 * browser-freeze fix's repair mode, PR #4 — see docs/v400-report.md). Visiting
 * /?repair=1 explicitly opts into clearing generated local data. This is
 * intentionally URL-gated rather than automatic because IndexedDB
 * corruption/version-upgrade stalls cannot be repaired safely without
 * discarding the affected local stores.
 *
 * `RECOVERABLE_DATABASES` is main's own 6-database list widened to this
 * branch's actual 9 non-settings databases (main predates
 * suno-weaver-audio/-ratings/-vocal-combos — see each module's own DB_NAME).
 * `suno-weaver-settings` (API keys, provider choice) is deliberately
 * excluded, same as main: settings are never generated/cache data, and
 * losing a user's API key on top of an already-broken app would compound
 * the problem this mode exists to fix.
 *
 * codex 지시문 07 (TASK F) — real bug fixed here: this list had gone stale
 * as new stores shipped across 지시문 01-06 (situations/lyric-lines/
 * combo-variations/generation-reservations/prompt-fingerprints/
 * exploration/release-readiness/verified-combos — 8 real, live databases,
 * confirmed via a direct grep of every `const DB_NAME =` in core/*.ts —
 * none were ever added here), so `/?repair=1` silently left 8 of 17 real
 * non-settings databases untouched, defeating the "wipe everything
 * recoverable" contract this mode promises. Every real DB_NAME below is
 * re-verified against its own module, not copied from memory.
 */

// 지시문 18 (TASK A-3) — 저장소 키의 'suno-weaver-' 접두는 제품명 변경(지시문
// 18, Suno Weaver Studio → 하루 스튜디오) 후에도 유지한다. 바꾸면 브라우저가
// 다른 DB로 인식해 팩·이력·평가·커스텀 채널이 전부 사라진다. 마이그레이션이
// 필요하면 별도 지시문에서 백업·복원 경로와 함께 한다 — 이 지시문의 범위가
// 아니다. 이 파일 아래 RECOVERABLE_DATABASES가 그 접두를 쓰는 실제 DB 이름
// 전체 목록이다(core/library.ts·core/ratingLedger.ts 등 다른 모든 DB_NAME/
// STORAGE_KEY 상수도 동일한 원칙 — 여기 한 곳에만 이 설명을 적어 둔다).
const REPAIR_PARAM = 'repair';
const REPAIR_NOTICE_KEY = 'suno-weaver-repair-complete';

/** Exported (지시문 07 TASK F) so a real test can assert this list stays complete against every actual `DB_NAME` in core/*.ts — the exact regression guard the staleness bug this task fixed needed and didn't have. */
export const RECOVERABLE_DATABASES = [
  'suno-weaver-cache',
  'suno-weaver-audio',
  'suno-weaver-batch',
  'suno-weaver-combo-variations',
  'suno-weaver-exploration',
  'suno-weaver-generation-reservations',
  'suno-weaver-hooks',
  'suno-weaver-library',
  'suno-weaver-lyric-lines',
  'suno-weaver-prompt-fingerprints',
  'suno-weaver-ratings',
  'suno-weaver-release-readiness',
  'suno-weaver-situations',
  'suno-weaver-usage',
  'suno-weaver-verified-combos',
  'suno-weaver-videos',
  'suno-weaver-vocal-combos'
];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`${name} 데이터베이스를 삭제하지 못했습니다.`));
    request.onblocked = () => reject(new Error(`${name} 데이터베이스가 다른 탭에서 사용 중입니다. 하루 스튜디오 탭을 모두 닫고 다시 실행하세요.`));
  });
}

export async function runBrowserRecoveryFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get(REPAIR_PARAM) !== '1') return false;

  for (const name of RECOVERABLE_DATABASES) {
    await deleteDatabase(name);
  }

  url.searchParams.delete(REPAIR_PARAM);
  window.history.replaceState(null, '', url.toString());
  window.sessionStorage.setItem(REPAIR_NOTICE_KEY, '1');
  return true;
}

export function consumeRepairNotice(): boolean {
  if (typeof window === 'undefined') return false;
  const completed = window.sessionStorage.getItem(REPAIR_NOTICE_KEY) === '1';
  if (completed) window.sessionStorage.removeItem(REPAIR_NOTICE_KEY);
  return completed;
}
