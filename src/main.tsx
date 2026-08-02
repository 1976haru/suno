import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { consumeRepairNotice, runBrowserRecoveryFromUrl } from './core/browserRecovery';
import { CURRENT_SCHEMA_VERSION, ensureSchemaVersion } from './core/schemaVersion';
import './styles.css';

/**
 * v4.0 (TASK A) — repair mode must run BEFORE React ever opens IndexedDB
 * (see core/browserRecovery.ts's own doc comment): if React renders first
 * and a store is corrupted or mid version-upgrade, the app hangs before
 * /?repair=1's own cleanup ever gets a chance to run. Ported from main's
 * bootstrap (PR #4) — this branch previously had no repair path at all.
 */
async function bootstrap() {
  const root = document.getElementById('root');
  if (!root) throw new Error('root element not found');

  try {
    const repaired = await runBrowserRecoveryFromUrl();
    if (repaired) {
      window.location.reload();
      return;
    }
  } catch (error) {
    root.replaceChildren();
    const panel = document.createElement('div');
    panel.style.cssText = 'max-width:760px;margin:80px auto;padding:28px;font-family:system-ui;line-height:1.7;border:1px solid #d9d9d9;border-radius:14px;background:#fff';
    const heading = document.createElement('h1');
    heading.textContent = '복구를 완료하지 못했습니다';
    const message = document.createElement('p');
    message.textContent = error instanceof Error ? error.message : String(error);
    const guide = document.createElement('p');
    guide.textContent = '열려 있는 Suno Weaver 탭과 이전 개발 서버를 모두 종료한 뒤 같은 복구 주소를 다시 여세요.';
    panel.append(heading, message, guide);
    root.append(panel);
    return;
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  if (consumeRepairNotice()) {
    window.setTimeout(() => {
      window.alert('로컬 생성 데이터 복구가 완료되었습니다. 설정과 API 키는 유지되었습니다.');
    }, 100);
  }

  // v4.0 (TASK C-4) — best-effort: a settingsStore read/write failure must
  // never block the app from rendering (same discipline as every other
  // "best-effort" IndexedDB read in this app). Only warns on the one real
  // actionable case (this browser's data is newer than this app build);
  // the common "unset/lower" case silently stamps CURRENT_SCHEMA_VERSION
  // with no user-facing noise.
  try {
    const check = await ensureSchemaVersion();
    if (check.status === 'newer-than-app') {
      window.setTimeout(() => {
        window.alert(`이 브라우저의 데이터는 더 최신 버전의 앱(schemaVersion ${check.storedVersion})에서 만들어졌습니다. 지금 버전(${CURRENT_SCHEMA_VERSION})에서는 일부 데이터가 올바르게 표시되지 않을 수 있습니다. 앱을 업데이트하는 것을 권장합니다.`);
      }, 100);
    }
  } catch {
    // best-effort only
  }
}

void bootstrap();
