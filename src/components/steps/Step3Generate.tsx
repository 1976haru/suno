import { useEffect, useState } from 'react';
import { Coins, Info, Search, Settings2, ShieldAlert, Wand2 } from 'lucide-react';
import { clampSongCount } from '../../utils/generation';
import { estimateCost, type TokenRange } from '../../core/costEstimator';
import { getSetting } from '../../core/settingsStore';
import { buildSystemInstruction, buildUserInstruction } from '../../core/promptComposer';
import DryRunPreviewModal from '../DryRunPreviewModal';
import type { BatchContext, GenerationOptions, GenrePack, MoodPack, ProviderSettings, SeasonPack } from '../../types';

const SONG_COUNT_CHIPS = [1, 5, 10, 12, 20, 30];

function formatRange(range: TokenRange) {
  return `${Math.round(range.low).toLocaleString()} ~ ${Math.round(range.high).toLocaleString()}`;
}

interface Step3GenerateProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  genres: GenrePack[];
  moods: MoodPack[];
  season: SeasonPack;
  provider: ProviderSettings;
  onOpenSettings: () => void;
  isGenerating: boolean;
  genProgress: { done: number; total: number };
  error: string;
  onGenerate: () => void;
  hybridMode: boolean;
  onHybridModeChange: (value: boolean) => void;
}

export default function Step3Generate({ opts, setOpts, genres, moods, season, provider, onOpenSettings, isGenerating, genProgress, error, onGenerate, hybridMode, onHybridModeChange }: Step3GenerateProps) {
  const providerLabel = provider.provider === 'local'
    ? '로컬 템플릿 (무료)'
    : provider.provider === 'anthropic'
      ? `Claude (${provider.model || 'claude-sonnet-4-5'})`
      : `ChatGPT (${provider.model || 'gpt-4.1-mini'})`;

  const [inputPrice, setInputPrice] = useState<number | null>(null);
  const [outputPrice, setOutputPrice] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    void getSetting<string>('pricing:inputPerM').then(value => setInputPrice(value ? Number(value) : null));
    void getSetting<string>('pricing:outputPerM').then(value => setOutputPrice(value ? Number(value) : null));
  }, []);

  const costEstimate = estimateCost(opts.songCount, provider, inputPrice, outputPrice);

  // Representative preview of the first batch — later batches add accumulated
  // usedTitles/usedHooks, called out in the modal's own copy.
  const previewBatch: BatchContext = { trackNoOffset: 0, totalSongCount: opts.songCount, usedTitles: [], usedHooks: [], lockedIdentity: null };
  const previewSystemPrompt = buildSystemInstruction(opts, previewBatch);
  const previewUserPrompt = JSON.stringify(buildUserInstruction(opts, genres, moods, season, previewBatch), null, 2);

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

      {provider.provider === 'local' && (
        <div className="warning">
          <Info size={16} />
          <span>
            ℹ️ 지금은 로컬 템플릿 모드입니다 (무료 · API 불필요). 곡 구조와 스타일 프롬프트는 바로 쓸 수 있지만, 가사는 조합형이라 다소 단조로울 수 있습니다.
            더 자연스러운 가사를 원하시면 ⚙️ 설정에서 Claude 또는 ChatGPT를 연결하세요.
          </span>
          <button type="button" onClick={onOpenSettings}>
            <Settings2 size={14} />
            설정 열기
          </button>
        </div>
      )}

      {provider.provider !== 'local' && (
        <div className="provider-summary">
          <div className="panel-title">
            <Wand2 size={18} />
            <h2>생성 방식</h2>
          </div>
          <div className="chips">
            <button type="button" className={!hybridMode ? 'chip active' : 'chip'} onClick={() => onHybridModeChange(false)}>
              AI로 전체 생성
            </button>
            <button type="button" className={hybridMode ? 'chip active' : 'chip'} onClick={() => onHybridModeChange(true)}>
              하이브리드: 로컬 초안 + 선택 보정 (비용 절약)
            </button>
          </div>
          <p className="supporting">
            {hybridMode
              ? '먼저 무료 로컬 템플릿으로 전체 초안을 만들고, 결과 화면에서 마음에 드는 곡만 골라 AI로 다듬을 수 있어요. 선택하지 않은 곡은 API로 전송되지 않습니다.'
              : `모든 곡을 ${providerLabel}로 바로 생성합니다.`}
          </p>
        </div>
      )}

      {provider.provider !== 'local' && !hybridMode && (
        <div className="provider-summary">
          <div className="panel-title">
            <Coins size={18} />
            <h2>예상 비용 (참고용 · 대략적인 범위)</h2>
          </div>
          <p className="supporting">
            API 호출 약 {costEstimate.apiCalls}회 · 예상 입력 토큰 {formatRange(costEstimate.inputTokens)} · 예상 출력 토큰 {formatRange(costEstimate.outputTokens)}
          </p>
          {costEstimate.costKrw ? (
            <p className="supporting">
              예상 비용: 약 {Math.round(costEstimate.costKrw.low).toLocaleString()}원 ~ {Math.round(costEstimate.costKrw.high).toLocaleString()}원
              (설정에 입력한 단가 기준의 대략적인 범위이며, 실제 청구 금액과 다를 수 있습니다. 정확한 사용량은 생성 후 설정의 "API 사용 기록"에서 확인하세요.)
            </p>
          ) : (
            <p className="supporting">⚙️ 설정에서 토큰 단가를 입력하면 예상 비용 범위도 함께 볼 수 있어요. 실제 사용량은 생성 후 정확히 기록됩니다.</p>
          )}
        </div>
      )}

      {provider.provider !== 'local' && hybridMode && (
        <p className="supporting">
          💡 하이브리드 모드에서는 초안 생성이 무료입니다. 실제 API 비용은 결과 화면에서 다듬을 곡을 선택한 만큼만 발생해요.
        </p>
      )}

      {provider.provider !== 'local' && (
        <div className="button-row">
          <button type="button" onClick={() => setPreviewOpen(true)}>
            <Search size={16} />
            API로 보낼 프롬프트 미리보기 (호출 없음)
          </button>
        </div>
      )}

      <DryRunPreviewModal
        open={previewOpen}
        systemPrompt={previewSystemPrompt}
        userPrompt={previewUserPrompt}
        onClose={() => setPreviewOpen(false)}
      />

      <button type="button" className="primary full-width action-button" disabled={isGenerating} onClick={onGenerate}>
        <Wand2 size={18} />
        {isGenerating
          ? `생성 중... (${genProgress.done}/${genProgress.total})`
          : hybridMode && provider.provider !== 'local'
            ? `${opts.songCount}곡 무료 초안 만들기`
            : `${opts.songCount}곡 생성하기`}
      </button>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
