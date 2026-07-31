import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { exportRatingsToJson, getRatings, type RatingRecord } from '../core/ratingLedger';
import { analyzeRatings, type AttributeInsight, type ConfidenceTier } from '../core/ratingAnalysis';
import { downloadText } from '../utils/exporters';
import type { ChannelProfile } from '../types';

interface RatingInsightsPanelProps {
  channel: ChannelProfile;
  channels: ChannelProfile[];
  onClose: () => void;
}

const MIN_TOTAL_FOR_CONFIDENCE = 100;

const ATTRIBUTE_LABELS_KO: Record<string, string> = {
  killingPointId: '킬링포인트',
  genreId: '장르',
  eraTag: '시대',
  arcPhase: '아크 구간',
  bpm: '템포',
  vocalType: '보컬',
  structureTemplate: '가사 구조',
  earwormVariantId: '멜로디 디자인',
  segmentLabel: '참조 세그먼트',
  lyricFrameId: '가사 장면',
  moneyChordId: '코드 진행',
  'genreId+vocalType': '장르 × 보컬',
  'killingPointId+arcPhase': '킬링포인트 × 아크 구간'
};

const CONFIDENCE_LABELS_KO: Record<ConfidenceTier, string> = {
  insufficient: '표본 부족',
  weak: '참고용',
  moderate: '약하게 반영',
  strong: '반영됨'
};

function groupByAttribute(insights: AttributeInsight[]): Map<string, AttributeInsight[]> {
  const groups = new Map<string, AttributeInsight[]>();
  for (const insight of insights) {
    const list = groups.get(insight.attribute) ?? [];
    list.push(insight);
    groups.set(insight.attribute, list);
  }
  for (const list of groups.values()) list.sort((a, b) => b.sampleSize - a.sampleSize);
  return groups;
}

/**
 * TASK v3.68 (TASK F) — "무엇이 잘 먹히나" 화면. Mirrors VideoDashboard.tsx's
 * own overlay/refresh/export shape (same component family, same "load once,
 * refresh on demand" pattern) rather than inventing a new screen convention.
 */
export default function RatingInsightsPanel({ channel, channels, onClose }: RatingInsightsPanelProps) {
  const [scopeChannelId, setScopeChannelId] = useState<string | 'all'>(channel.id);
  const [ratings, setRatings] = useState<RatingRecord[]>([]);

  async function refresh() {
    const all = await getRatings();
    setRatings(all);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const scopedRatings = scopeChannelId === 'all' ? ratings : ratings.filter(record => record.attributes.channelId === scopeChannelId);
  const insights = useMemo(
    () => analyzeRatings(scopedRatings, scopeChannelId === 'all' ? {} : { channelId: scopeChannelId }),
    [scopedRatings, scopeChannelId]
  );
  const grouped = useMemo(() => groupByAttribute(insights), [insights]);
  const totalCount = scopedRatings.length;

  function handleExport() {
    downloadText('suno-rating-data.json', exportRatingsToJson(ratings), 'application/json;charset=utf-8');
  }

  return (
    <section className="panel rating-insights-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Listening Feedback</p>
          <h2>🎧 무엇이 잘 먹히나 — 누적 평가 {totalCount}곡</h2>
        </div>
        <div className="button-row">
          <button type="button" onClick={handleExport} title="평가 데이터 전체를 JSON으로 내보내기 — 브라우저 저장소가 날아가면 학습이 전부 사라집니다">
            <Download size={16} />
            평가 데이터 내보내기
          </button>
          <button type="button" className="icon-button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="chips">
        <button type="button" className={scopeChannelId === 'all' ? 'chip active' : 'chip'} onClick={() => setScopeChannelId('all')}>
          전체 채널
        </button>
        {channels.map(item => (
          <button key={item.id} type="button" className={scopeChannelId === item.id ? 'chip active' : 'chip'} onClick={() => setScopeChannelId(item.id)}>
            {item.name}
          </button>
        ))}
      </div>

      {totalCount < MIN_TOTAL_FOR_CONFIDENCE && (
        <p className="warning">
          ⚠️ 아직 데이터가 부족합니다 (누적 {totalCount}곡, 권장 {MIN_TOTAL_FOR_CONFIDENCE}곡 이상). 표본이 적은 항목은 아래에 회색으로 표시됩니다 — 다음 세트 설계에 반영하지 마세요.
        </p>
      )}

      {totalCount === 0 && (
        <p className="step-hint">아직 평가한 곡이 없어요. 🎧 수노 진행 모드 또는 곡 카드에서 👍/🤷/👎로 평가해보세요.</p>
      )}

      {[...grouped.entries()].map(([attribute, attributeInsights]) => (
        <div key={attribute} className="option-block">
          <h3>{ATTRIBUTE_LABELS_KO[attribute] ?? attribute}</h3>
          <div className="allocation-row-list">
            {attributeInsights.map(insight => {
              const total = insight.good + insight.ok + insight.bad;
              const goodPct = total > 0 ? Math.round((insight.good / total) * 100) : 0;
              const insufficient = insight.confidence === 'insufficient';
              return (
                <div key={insight.value} className={insufficient ? 'allocation-row insight-insufficient' : 'allocation-row'} style={insufficient ? { opacity: 0.5 } : undefined}>
                  <div className="allocation-label">
                    <b>{insight.labelKo}</b>
                    <span>{CONFIDENCE_LABELS_KO[insight.confidence]} · n={insight.sampleSize}</span>
                  </div>
                  <span className={insufficient ? undefined : 'chip active'}>
                    {insufficient ? '표본 부족' : `좋음 ${goodPct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
