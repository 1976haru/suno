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
 */

const REPAIR_PARAM = 'repair';
const REPAIR_NOTICE_KEY = 'suno-weaver-repair-complete';

const RECOVERABLE_DATABASES = [
  'suno-weaver-cache',
  'suno-weaver-audio',
  'suno-weaver-batch',
  'suno-weaver-hooks',
  'suno-weaver-library',
  'suno-weaver-ratings',
  'suno-weaver-usage',
  'suno-weaver-vocal-combos',
  'suno-weaver-videos'
];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`${name} 데이터베이스를 삭제하지 못했습니다.`));
    request.onblocked = () => reject(new Error(`${name} 데이터베이스가 다른 탭에서 사용 중입니다. Suno Weaver 탭을 모두 닫고 다시 실행하세요.`));
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
