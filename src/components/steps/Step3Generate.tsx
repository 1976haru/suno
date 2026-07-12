import { Settings2, ShieldAlert, Wand2 } from 'lucide-react';
import { clampSongCount } from '../../utils/generation';
import type { GenerationOptions, ProviderSettings } from '../../types';

const SONG_COUNT_CHIPS = [1, 5, 10, 12, 20, 30];

interface Step3GenerateProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  provider: ProviderSettings;
  onOpenSettings: () => void;
  isGenerating: boolean;
  genProgress: { done: number; total: number };
  error: string;
  onGenerate: () => void;
}

export default function Step3Generate({ opts, setOpts, provider, onOpenSettings, isGenerating, genProgress, error, onGenerate }: Step3GenerateProps) {
  const providerLabel = provider.provider === 'local'
    ? '로컬 템플릿 (무료)'
    : provider.provider === 'anthropic'
      ? `Claude (${provider.model || 'claude-sonnet-4-5'})`
      : `ChatGPT (${provider.model || 'gpt-4.1-mini'})`;

  return (
    <section className="panel">
      <p className="step-hint">몇 곡을 만들지 정하고 생성 버튼을 누르세요. 생성 중에도 화면을 벗어나지 않아도 됩니다.</p>

      <label>Songs (곡 수)</label>
      <div className="inline">
        <input
          type="range"
          min={1}
          max={30}
          value={opts.songCount}
          onChange={event => setOpts(prev => ({ ...prev, songCount: clampSongCount(Number(event.target.value)) }))}
        />
        <input
          type="number"
          min={1}
          max={30}
          value={opts.songCount}
          onChange={event => setOpts(prev => ({ ...prev, songCount: clampSongCount(Number(event.target.value)) }))}
        />
      </div>
      <div className="chips">
        {SONG_COUNT_CHIPS.map(count => (
          <button
            type="button"
            key={count}
            className={opts.songCount === count ? 'chip active' : 'chip'}
            onClick={() => setOpts(prev => ({ ...prev, songCount: clampSongCount(count) }))}
          >
            {count === 1 ? '1곡 (테스트)' : `${count}곡`}
          </button>
        ))}
      </div>

      <div className="provider-summary">
        <div className="panel-title">
          <ShieldAlert size={18} />
          <h2>AI Provider (AI 제공자)</h2>
        </div>
        <p className="supporting">
          현재: {providerLabel}
          {provider.provider !== 'local' && (provider.keyStorageMode === 'local' ? ' · 브라우저에 저장된 키 사용' : ' · 서버 환경변수 사용')}
        </p>
        <button type="button" onClick={onOpenSettings}>
          <Settings2 size={16} />
          제공자 / API 키 설정 열기
        </button>
      </div>

      <button type="button" className="primary full-width action-button" disabled={isGenerating} onClick={onGenerate}>
        <Wand2 size={18} />
        {isGenerating ? `생성 중... (${genProgress.done}/${genProgress.total})` : `${opts.songCount}곡 생성하기`}
      </button>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
