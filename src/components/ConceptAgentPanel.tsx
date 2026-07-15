import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { recommendConceptLocal, recommendConceptViaApi, type ConceptAgentResult, type ConceptRecommendation } from '../core/conceptAgent';
import { addConceptHistory, getConceptHistory } from '../core/library';
import { genreLabelsKo, seasonLabelsKo } from '../data/koreanLabels';
import type { ChannelArchetype, ProviderSettings } from '../types';

interface ConceptAgentPanelProps {
  channelId: string;
  archetype: ChannelArchetype;
  currentGenreId?: string;
  currentMoodId?: string;
  currentSeasonId?: string;
  provider: ProviderSettings;
  onApply: (rec: ConceptRecommendation, inputText: string) => void;
}

/**
 * TASK H8 (v3.10) — "노래도 모르는데 일일이 선택하는 것도 어렵다"는 사용자 요청에서
 * 나온 기능. 클릭형 카드 그리드(v3.7)조차 "어떤 카드가 내가 원하는 것인지" 판단을
 * 요구했는데, 이 패널은 그 판단 자체를 대신 한다 — 자연어 한 줄을 입력하면
 * core/conceptAgent.ts가 장르/무드/시즌 조합 1~2개를 추천하고, 사용자는 고르기만
 * 하면 된다. 선택 사항이며 필수 관문이 아니다 — "아니요, 직접 고를게요"에 해당하는
 * 동작은 그냥 이 패널을 무시하고 아래 카드 그리드를 계속 쓰는 것이다.
 */
export default function ConceptAgentPanel({ channelId, archetype, currentGenreId, currentMoodId, currentSeasonId, provider, onApply }: ConceptAgentPanelProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ConceptAgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [variantOffset, setVariantOffset] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConceptHistory(channelId).then(items => {
      if (!cancelled) setHistory(items);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  async function runRecommend(text: string, offset: number) {
    if (!text.trim()) return;
    setLoading(true);
    setAppliedId(null);
    try {
      const defaults = { genreId: currentGenreId, moodId: currentMoodId, seasonId: currentSeasonId };
      const next = provider.provider === 'local'
        ? recommendConceptLocal(text, archetype, defaults, offset)
        : await recommendConceptViaApi(text, archetype, provider);
      setResult(next);
      const nextHistory = await addConceptHistory(channelId, text);
      setHistory(nextHistory);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    setVariantOffset(0);
    void runRecommend(input, 0);
  }

  function handleHistoryClick(text: string) {
    setInput(text);
    setVariantOffset(0);
    void runRecommend(text, 0);
  }

  function handleShowOther() {
    if (!result) return;
    const nextOffset = variantOffset + 1;
    setVariantOffset(nextOffset);
    void runRecommend(result.input, nextOffset);
  }

  function handleApply(rec: ConceptRecommendation) {
    setAppliedId(rec.id);
    onApply(rec, result?.input || input);
  }

  return (
    <div className="option-block concept-agent-panel">
      <h3>💬 어떤 느낌의 곡을 원하세요?</h3>
      <p className="supporting">"그 겨울이 생각나는 노래", "카페에서 듣던 노래"처럼 편하게 적어보세요. 음악 용어를 몰라도 괜찮아요. (선택 사항)</p>

      {history.length > 0 && (
        <div className="chips">
          {history.map(item => (
            <button type="button" key={item} className="chip" onClick={() => handleHistoryClick(item)}>
              최근: {item}
            </button>
          ))}
        </div>
      )}

      <div className="concept-agent-input-row">
        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder="예: 그 겨울이 생각나는 노래"
          onKeyDown={event => {
            if (event.key === 'Enter') handleSubmit();
          }}
        />
        <button type="button" className="primary" disabled={loading || !input.trim()} onClick={handleSubmit}>
          <Sparkles size={16} />
          {loading ? '추천 중...' : '✨ 추천받기'}
        </button>
      </div>

      {result && (
        <>
          <p className="supporting">이런 느낌은 어때요?</p>
          <div className="concept-recommend-grid">
            {result.recommendations.map(rec => (
              <div key={rec.id} className={appliedId === rec.id ? 'concept-card applied' : 'concept-card'}>
                <p className="concept-card-title">
                  {genreLabelsKo[rec.genreId] || rec.genreId} · {seasonLabelsKo[rec.seasonId] || rec.seasonId}
                </p>
                <p className="supporting">{rec.reasonKo}</p>
                <p className="concept-preview">미리보기 훅: &ldquo;{rec.previewLine}&rdquo;</p>
                <button type="button" className="primary" onClick={() => handleApply(rec)}>
                  {appliedId === rec.id ? '✓ 적용됨' : '이걸로 할게요'}
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={handleShowOther} disabled={loading}>
            다른 추천 보기
          </button>
        </>
      )}
    </div>
  );
}
