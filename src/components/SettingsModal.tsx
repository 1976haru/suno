import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2, X } from 'lucide-react';
import type { ProviderSettings, ProviderType } from '../types';
import { deleteSetting, getSetting, setSetting } from '../core/settingsStore';

const MODEL_OPTIONS: Record<'anthropic' | 'openai', string[]> = {
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini']
};

const DEFAULT_MODEL: Record<'anthropic' | 'openai', string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4.1-mini'
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: ProviderSettings;
  onChange: (next: ProviderSettings) => void;
  onExportAll: () => void;
  onImportAll: (file: File) => void;
  onDeleteAll: () => void;
}

type TestResult = { state: 'idle' } | { state: 'testing' } | { state: 'ok' } | { state: 'error'; message: string };

function byokKeyName(provider: ProviderType) {
  return `byok:${provider}`;
}

export default function SettingsModal({ open, onClose, settings, onChange, onExportAll, onImportAll, onDeleteAll }: SettingsModalProps) {
  const [localKey, setLocalKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({ state: 'idle' });

  const isRemoteProvider = settings.provider === 'openai' || settings.provider === 'anthropic';

  useEffect(() => {
    if (!isRemoteProvider) return;
    void getSetting<string>(byokKeyName(settings.provider)).then(stored => {
      if (stored) setLocalKey(stored);
    });
  }, [settings.provider, isRemoteProvider]);

  if (!open) return null;

  async function updateKeyStorageMode(mode: 'server' | 'local') {
    if (mode === 'server') {
      onChange({ ...settings, keyStorageMode: mode, apiKey: undefined });
    } else {
      const stored = await getSetting<string>(byokKeyName(settings.provider));
      onChange({ ...settings, keyStorageMode: mode, apiKey: stored || '' });
    }
  }

  async function saveLocalKey(value: string) {
    setLocalKey(value);
    await setSetting(byokKeyName(settings.provider), value);
    onChange({ ...settings, apiKey: value });
  }

  async function clearLocalKey() {
    await deleteSetting(byokKeyName(settings.provider));
    setLocalKey('');
    onChange({ ...settings, apiKey: '' });
  }

  async function testConnection() {
    setTestResult({ state: 'testing' });
    try {
      const response = await fetch(settings.proxyEndpoint || '/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.keyStorageMode === 'local' && settings.apiKey ? { 'X-User-Api-Key': settings.apiKey } : {})
        },
        body: JSON.stringify({ testMode: true, provider: settings.provider, model: settings.model })
      });
      if (response.ok) {
        setTestResult({ state: 'ok' });
        return;
      }
      const data = await response.json().catch(() => ({}));
      const message = data.error || (
        response.status === 401 ? 'API 키가 올바르지 않습니다.'
          : response.status === 429 ? '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
            : '서버 오류입니다. 곡 수를 줄여보세요.'
      );
      setTestResult({ state: 'error', message });
    } catch {
      setTestResult({ state: 'error', message: '연결할 수 없습니다. 네트워크 상태를 확인하세요.' });
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="panel-header">
          <h2>⚙️ 설정</h2>
          <button type="button" className="icon-button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <label>AI 제공자</label>
        <div className="chips">
          <button type="button" className={settings.provider === 'local' ? 'chip active' : 'chip'} onClick={() => onChange({ ...settings, provider: 'local' })}>
            로컬 템플릿 (무료, API 불필요)
          </button>
          <button type="button" className={settings.provider === 'anthropic' ? 'chip active' : 'chip'} onClick={() => onChange({ ...settings, provider: 'anthropic', model: settings.model || DEFAULT_MODEL.anthropic })}>
            Claude (Anthropic)
          </button>
          <button type="button" className={settings.provider === 'openai' ? 'chip active' : 'chip'} onClick={() => onChange({ ...settings, provider: 'openai', model: settings.model || DEFAULT_MODEL.openai })}>
            ChatGPT (OpenAI)
          </button>
        </div>

        {isRemoteProvider && (
          <>
            <label>모델</label>
            <input
              list="model-options"
              value={settings.model || ''}
              onChange={event => onChange({ ...settings, model: event.target.value })}
              placeholder={DEFAULT_MODEL[settings.provider as 'anthropic' | 'openai']}
            />
            <datalist id="model-options">
              {MODEL_OPTIONS[settings.provider as 'anthropic' | 'openai'].map(model => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <p className="supporting">모델 이름은 계속 바뀌므로, 목록에 없으면 직접 입력해도 됩니다.</p>

            <label>키 관리 방식</label>
            <div className="chips">
              <button
                type="button"
                className={settings.keyStorageMode !== 'local' ? 'chip active' : 'chip'}
                onClick={() => void updateKeyStorageMode('server')}
              >
                서버 환경변수 사용 (권장 · 배포용)
              </button>
              <button
                type="button"
                className={settings.keyStorageMode === 'local' ? 'chip active' : 'chip'}
                onClick={() => void updateKeyStorageMode('local')}
              >
                이 브라우저에 저장 (로컬 전용)
              </button>
            </div>

            {settings.keyStorageMode === 'local' && (
              <>
                <label>API 키</label>
                <div className="inline">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={localKey}
                    onChange={event => void saveLocalKey(event.target.value)}
                    placeholder={settings.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                  />
                  <button type="button" className="icon-button" title={showKey ? '숨기기' : '표시'} onClick={() => setShowKey(v => !v)}>
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className="icon-button" title="삭제" onClick={() => void clearLocalKey()}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="error">⚠️ 키가 이 브라우저에 저장됩니다. 공용 PC에서는 사용하지 마세요.</p>
              </>
            )}

            <div className="button-row">
              <button type="button" onClick={() => void testConnection()} disabled={testResult.state === 'testing'}>
                {testResult.state === 'testing' ? '연결 테스트 중...' : '연결 테스트'}
              </button>
              {testResult.state === 'ok' && <span className="supporting">✅ 정상</span>}
              {testResult.state === 'error' && <span className="error">❌ {testResult.message}</span>}
            </div>
          </>
        )}

        <label>온도 (창의성) {settings.temperature.toFixed(1)}</label>
        <input
          type="range"
          min="0.2"
          max="1.2"
          step="0.1"
          value={settings.temperature}
          onChange={event => onChange({ ...settings, temperature: Number(event.target.value) })}
        />

        <label>배치 크기 (곡)</label>
        <input
          type="number"
          min={1}
          max={12}
          value={settings.batchSize || 6}
          onChange={event => onChange({ ...settings, batchSize: Math.min(12, Math.max(1, Number(event.target.value) || 6)) })}
        />
        <p className="supporting">작을수록 안정적, 클수록 빠르지만 한 번에 잘릴 위험이 커져요.</p>

        <label>데이터</label>
        <div className="button-row">
          <button type="button" onClick={onExportAll}>전체 백업 내보내기</button>
          <label className="import-button">
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) onImportAll(file);
                event.target.value = '';
              }}
            />
            백업 불러오기
          </label>
          <button type="button" onClick={onDeleteAll}>모든 데이터 삭제</button>
        </div>
      </div>
    </div>
  );
}
