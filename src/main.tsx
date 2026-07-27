import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { consumeRepairNotice, runBrowserRecoveryFromUrl } from './core/browserRecovery';
import './styles.css';

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
}

void bootstrap();
