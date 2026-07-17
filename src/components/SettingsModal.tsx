import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2, X } from 'lucide-react';
import type { ChannelProfile, ProviderSettings, ProviderType } from '../types';
import { deleteSetting, getSetting, setSetting } from '../core/settingsStore';
import { clearUsage, usageSummary, type UsageSummary } from '../core/usageLedger';
import { cacheStats, clearCache, type CacheStats } from '../core/apiCache';
import { channelCapacityForecast, clearChannelHistory, forgetUsage, listChannelUsage, type ChannelCapacityForecast, type HookUsage } from '../core/hookLedger';
import { SUNO_COPY_LIMIT } from '../core/promptBudget';
import { PERSONA_STYLE_LIMIT } from '../core/soundSignature';
import { API_PRESETS, RECOMMENDATION_BADGE, STAGE_ADVICE } from '../core/apiAdvisor';
import { defaultModelFor, MODEL_REGISTRY } from '../data/modelRegistry';

// TASK F1 (v3.6) — read from the registry instead of a hardcoded list; a
// model id typed into the free-text fallback (see the "직접 입력" input
// below) always works even if it's not in this list yet.
const MODEL_OPTIONS: Record<'anthropic' | 'openai', string[]> = {
  anthropic: MODEL_REGISTRY.anthropic.map(m => m.id),
  openai: MODEL_REGISTRY.openai.map(m => m.id)
};

const DEFAULT_MODEL: Record<'anthropic' | 'openai', string> = {
  anthropic: defaultModelFor('anthropic'),
  openai: defaultModelFor('openai')
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: ProviderSettings;
  onChange: (next: ProviderSettings) => void;
  onExportAll: () => void;
  onImportAll: (file: File) => void;
  onDeleteAll: () => void;
  channel: ChannelProfile;
  channels: ChannelProfile[];
}

type TestResult = { state: 'idle' } | { state: 'testing' } | { state: 'ok' } | { state: 'error'; message: string };

function byokKeyName(provider: ProviderType) {
  return `byok:${provider}`;
}

export default function SettingsModal({ open, onClose, settings, onChange, onExportAll, onImportAll, onDeleteAll, channel, channels }: SettingsModalProps) {
  const [localKey, setLocalKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({ state: 'idle' });
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [inputPrice, setInputPrice] = useState('');
  const [outputPrice, setOutputPrice] = useState('');
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [hookUsage, setHookUsage] = useState<HookUsage[] | null>(null);
  const [capacityForecasts, setCapacityForecasts] = useState<{ channel: ChannelProfile; forecast: ChannelCapacityForecast }[] | null>(null);

  const isRemoteProvider = settings.provider === 'openai' || settings.provider === 'anthropic';

  useEffect(() => {
    if (!isRemoteProvider) return;
    void getSetting<string>(byokKeyName(settings.provider)).then(stored => {
      if (stored) setLocalKey(stored);
    });
  }, [settings.provider, isRemoteProvider]);

  useEffect(() => {
    if (!open) return;
    void usageSummary().then(setUsage);
    void getSetting<string>('pricing:inputPerM').then(value => setInputPrice(value || ''));
    void getSetting<string>('pricing:outputPerM').then(value => setOutputPrice(value || ''));
    void cacheStats().then(setCache);
    void listChannelUsage(channel.id).then(setHookUsage).catch(() => setHookUsage([]));
  }, [open, channel.id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all(
      channels.map(async c => ({ channel: c, forecast: await channelCapacityForecast(c.id, c.primaryLanguage, c.archetype) }))
    ).then(results => {
      if (!cancelled) setCapacityForecasts(results);
    });
    return () => {
      cancelled = true;
    };
  }, [open, channels]);

  if (!open) return null;

  async function updateInputPrice(value: string) {
    setInputPrice(value);
    await setSetting('pricing:inputPerM', value);
  }

  async function updateOutputPrice(value: string) {
    setOutputPrice(value);
    await setSetting('pricing:outputPerM', value);
  }

  async function handleClearUsage() {
    await clearUsage();
    setUsage(await usageSummary());
  }

  async function handleClearCache() {
    await clearCache();
    setCache(await cacheStats());
  }

  async function handleForgetUsage(id: string) {
    await forgetUsage(id);
    setHookUsage(await listChannelUsage(channel.id));
  }

  async function handleClearChannelHistory() {
    if (!window.confirm(`"${channel.name}" 채널의 훅 사용 이력을 모두 지울까요? 지운 훅은 다시 사용 가능해집니다.`)) return;
    await clearChannelHistory(channel.id);
    setHookUsage(await listChannelUsage(channel.id));
  }

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

        <label>💡 단계별 API 추천</label>
        <p className="supporting">
          216곡(18주 x 12곡) 기준 총 출력은 약 0.15M~0.32M 토큰으로, Sonnet 기준 대략 몇 달러 수준입니다. API가 비싸서 피해야 할 이유는 없습니다 —
          단계마다 어디에 API가 가장 도움이 되는지만 참고하세요. (정확한 단가는 계속 바뀌므로 여기서 고정하지 않습니다. 실제 사용량은 위 "API 사용 기록"에서 확인하세요.)
        </p>
        <div className="api-advice-table">
          {Object.values(STAGE_ADVICE).map(advice => (
            <div key={advice.stage} className="api-advice-row">
              <span className="chip">{RECOMMENDATION_BADGE[advice.recommendation].emoji} {advice.labelKo}</span>
              <span><b>{advice.suggestedModelKo}</b> — {advice.reasonKo}</span>
            </div>
          ))}
        </div>

        <label>🎛️ 단계별 모델 프리셋</label>
        <p className="supporting">가사·훅 생성과 평가는 서로 다른 모델을 쓰는 게 유리합니다 (평가는 채점 작업이라 Haiku로 충분). 프리셋을 고르면 두 단계에 자동으로 적용됩니다.</p>
        <div className="chips">
          {Object.values(API_PRESETS).map(preset => {
            const active = settings.stageModels?.lyrics === preset.stageModels.lyrics && settings.stageModels?.evaluation === preset.stageModels.evaluation;
            return (
              <button
                key={preset.id}
                type="button"
                className={active ? 'chip active' : 'chip'}
                title={preset.descriptionKo}
                onClick={() => onChange({ ...settings, stageModels: preset.stageModels })}
              >
                {preset.labelKo}
              </button>
            );
          })}
        </div>
        {settings.stageModels && (
          <p className="supporting">
            현재: 가사·훅 → {settings.stageModels.lyrics === 'local' ? '로컬' : settings.stageModels.lyrics} · 평가 → {settings.stageModels.evaluation === 'local' ? '로컬(평가 비활성)' : settings.stageModels.evaluation}
          </p>
        )}

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

            {settings.keyStorageMode !== 'local' && (
              <>
                <label>접근 토큰 (선택 — 공개 배포 시)</label>
                <input
                  type="password"
                  value={settings.accessToken || ''}
                  onChange={event => onChange({ ...settings, accessToken: event.target.value })}
                  placeholder="배포자가 ACCESS_TOKEN 환경변수를 설정했다면 여기에 입력하세요"
                />
                <p className="supporting">
                  이 앱을 공개 배포하면서 서버 키를 ACCESS_TOKEN으로 보호한 경우에만 필요해요. 로컬에서만 쓴다면 비워두세요.
                </p>
              </>
            )}

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

        {settings.provider === 'anthropic' ? (
          <p className="supporting">이 모델은 온도(창의성) 조절을 지원하지 않습니다.</p>
        ) : (
          <>
            <label>온도 (창의성) {settings.temperature.toFixed(1)}</label>
            <input
              type="range"
              min="0.2"
              max="1.2"
              step="0.1"
              value={settings.temperature}
              onChange={event => onChange({ ...settings, temperature: Number(event.target.value) })}
            />
          </>
        )}

        <label>배치 크기 (곡)</label>
        <input
          type="number"
          min={1}
          max={12}
          value={settings.batchSize || 6}
          onChange={event => onChange({ ...settings, batchSize: Math.min(12, Math.max(1, Number(event.target.value) || 6)) })}
        />
        <p className="supporting">작을수록 안정적, 클수록 빠르지만 한 번에 잘릴 위험이 커져요.</p>

        <label>스타일 프롬프트 길이 상한 (자)</label>
        <div className="chips">
          <button type="button" className={(settings.promptCharLimit || SUNO_COPY_LIMIT) === SUNO_COPY_LIMIT ? 'chip active' : 'chip'} onClick={() => onChange({ ...settings, promptCharLimit: SUNO_COPY_LIMIT })}>
            Suno v4.5/v5/v5.5 표준 {SUNO_COPY_LIMIT}자
          </button>
          <button type="button" className={(settings.promptCharLimit || SUNO_COPY_LIMIT) === PERSONA_STYLE_LIMIT ? 'chip active' : 'chip'} onClick={() => onChange({ ...settings, promptCharLimit: PERSONA_STYLE_LIMIT })}>
            Suno v4 이하 레거시 {PERSONA_STYLE_LIMIT}자
          </button>
        </div>
        <input
          type="number"
          min={PERSONA_STYLE_LIMIT}
          max={SUNO_COPY_LIMIT}
          value={settings.promptCharLimit || SUNO_COPY_LIMIT}
          onChange={event => onChange({ ...settings, promptCharLimit: Math.min(SUNO_COPY_LIMIT, Math.max(PERSONA_STYLE_LIMIT, Number(event.target.value) || SUNO_COPY_LIMIT)) })}
        />
        <p className="supporting">
          기본값 {SUNO_COPY_LIMIT}자는 Suno v4.5 이상(v5, v5.5 포함) 기준입니다. Suno에 붙여넣었을 때 Style 필드가 잘린다면 오래된 v4 이하 계정일 수 있으니 {PERSONA_STYLE_LIMIT}자로 낮추세요. Persona 모드의 곡별 프롬프트도 같은 {PERSONA_STYLE_LIMIT}자 상한을 씁니다.
        </p>

        <label>📊 API 사용 기록</label>
        {usage && (
          <div className="signature-grid">
            <div><b>총 호출</b><span>{usage.totalCalls}회</span></div>
            <div><b>입력 토큰</b><span>{usage.totalInput.toLocaleString()}</span></div>
            <div><b>출력 토큰</b><span>{usage.totalOutput.toLocaleString()}</span></div>
            <div><b>캐시로 절약</b><span>{usage.cacheHits}회 호출</span></div>
            <div>
              <b>프롬프트 캐시 읽기 토큰</b>
              <span>
                {usage.totalCacheReadTokens.toLocaleString()}
                {usage.totalCacheReadTokens === 0 && ' (Claude로 2배치 이상 생성하면 0보다 커야 정상입니다)'}
              </span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <b>용도별</b>
              <span>
                생성 {usage.byPurpose.generate || 0} · 보정 {usage.byPurpose.refine || 0} · 평가 {usage.byPurpose.evaluate || 0}
              </span>
            </div>
            {inputPrice && outputPrice && (
              <div style={{ gridColumn: '1 / -1' }}>
                <b>예상 비용</b>
                <span>
                  {Math.round((usage.totalInput / 1_000_000) * Number(inputPrice) + (usage.totalOutput / 1_000_000) * Number(outputPrice)).toLocaleString()}원
                  (사용자가 입력한 단가 기준 — 실제 청구 금액과 다를 수 있습니다)
                </span>
              </div>
            )}
          </div>
        )}
        <div className="button-row">
          <button type="button" onClick={() => void handleClearUsage()}>기록 초기화</button>
        </div>

        <label>단가 설정 (선택 사항 — 입력하면 예상 금액이 표시됩니다)</label>
        <p className="supporting">모델 가격은 자주 바뀌고 여기서 최신값을 보증하지 않습니다. 정확한 금액은 사용 중인 제공자의 최신 요금표를 확인하세요.</p>
        <div className="form-grid two">
          <div>
            <label>입력 1M 토큰당 (원)</label>
            <input value={inputPrice} onChange={event => void updateInputPrice(event.target.value)} placeholder="예: 4500" />
          </div>
          <div>
            <label>출력 1M 토큰당 (원)</label>
            <input value={outputPrice} onChange={event => void updateOutputPrice(event.target.value)} placeholder="예: 22000" />
          </div>
        </div>

        <label>🗂️ 응답 캐시</label>
        <p className="supporting">
          동일한 조건으로 다시 생성할 때 API를 다시 호출하지 않고 재사용할 수 있도록 결과를 7일간 보관합니다.
          재사용 여부는 매번 직접 선택하며, 자동으로 적용되지 않습니다.
        </p>
        {cache && (
          <p className="supporting">
            {cache.count > 0
              ? `저장된 캐시 ${cache.count}건 (가장 오래된 항목: ${new Date(cache.oldestAt as string).toLocaleDateString()})`
              : '저장된 캐시가 없습니다.'}
          </p>
        )}
        <div className="button-row">
          <button type="button" onClick={() => void handleClearCache()}>캐시 비우기</button>
        </div>

        <label>📊 채널별 훅 풀 상태</label>
        <p className="supporting">
          채널마다 훅 풀은 완전히 독립적으로 관리됩니다 — 한 채널에서 훅을 많이 써도 다른 채널의 훅 풀에는 전혀 영향이 없습니다.
          아래 "주당 예상 페이스"는 이 채널의 실제 팩 생성 이력(생성 날짜 간격)에서 계산한 값이며, 고정된 추정치가 아닙니다.
        </p>
        {capacityForecasts && capacityForecasts.length > 0 ? (
          <div className="hook-capacity-dashboard">
            {capacityForecasts.map(({ channel: c, forecast }) => {
              const barWidth = Math.min(100, forecast.percentUsed);
              return (
                <div key={c.id} className="hook-capacity-row">
                  <div className="hook-capacity-row-title">
                    <b>{c.name}</b>
                    <span className="supporting"> ({c.archetype ?? 'senior-morning'} · {c.primaryLanguage})</span>
                  </div>
                  <div className="hook-capacity-bar-track">
                    <div className="hook-capacity-bar-fill" style={{ width: `${barWidth}%` }} />
                  </div>
                  <p className="supporting">
                    {forecast.percentUsed}% 사용 ({forecast.used} / {forecast.poolSize})
                    {forecast.weeksUntilExhaustion !== null
                      ? ` — 현재 속도라면 약 ${forecast.weeksUntilExhaustion}주 후 소진 예상`
                      : ' — 아직 페이스를 추정할 이력이 부족합니다 (팩 2개 이상 생성 후 표시됩니다)'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="supporting">채널이 없습니다.</p>
        )}

        <label>🎯 훅 이력 관리 — {channel.name}</label>
        <p className="supporting">
          이 채널에서 이미 사용한 훅/제목입니다. 새로 생성할 때 자동으로 제외되어 같은 제목의 영상이 중복 발행되지 않도록 막아줍니다.
          잘못 지운 팩이 있거나 이력을 정리하고 싶다면 개별 삭제하거나 전체를 초기화하세요 (초기화하면 해당 훅들이 다시 사용 가능해집니다).
        </p>
        {hookUsage && hookUsage.length > 0 ? (
          <div className="hook-history-list">
            {hookUsage.map(item => (
              <div key={item.id} className="hook-history-item">
                <span>{item.trackNo}. {item.title}</span>
                <button type="button" className="icon-button" title="이 기록만 삭제" onClick={() => void handleForgetUsage(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="supporting">사용 기록이 없습니다.</p>
        )}
        <div className="button-row">
          <button type="button" onClick={() => void handleClearChannelHistory()}>이 채널 이력 전체 초기화</button>
        </div>

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
