const REPAIR_PARAM = 'repair';
const REPAIR_NOTICE_KEY = 'suno-weaver-repair-complete';

// Settings are deliberately preserved so a locally stored API key/provider
// choice is not erased. These databases contain generated/cache/history data
// that can safely be rebuilt or restored from a backup.
const RECOVERABLE_DATABASES = [
  'suno-weaver-library',
  'suno-weaver-hooks',
  'suno-weaver-videos',
  'suno-weaver-cache',
  'suno-weaver-usage',
  'suno-weaver-batch'
];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`${name} 데이터베이스를 삭제하지 못했습니다.`));
    request.onblocked = () => reject(new Error(`${name} 데이터베이스가 다른 탭에서 사용 중입니다. Suno Weaver 탭을 모두 닫고 다시 실행하세요.`));
  });
}

/**
 * Visiting /?repair=1 explicitly opts into clearing generated local data.
 * This is intentionally URL-gated rather than automatic because IndexedDB
 * corruption/version-upgrade stalls cannot be repaired safely without
 * discarding the affected local stores.
 */
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
