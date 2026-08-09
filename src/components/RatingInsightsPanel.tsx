import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { exportRatingsToJson, getRatings, type RatingRecord } from '../core/ratingLedger';
import { analyzeRatings, type AttributeInsight, type ConfidenceTier } from '../core/ratingAnalysis';
import { listPacks } from '../core/library';
import { computeAgentComparisonStats, MIN_SETS_FOR_AGENT_COMPARISON, type AgentComparisonStat } from '../core/agentComparison';
import { downloadText } from '../utils/exporters';
import type { ChannelProfile, PackGeneratedBy, SavedPackMeta } from '../types';

const GENERATED_BY_LABEL_KO: Record<PackGeneratedBy, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'fable-5': 'Fable 5',
  'api-direct': 'API 직접 호출',
  local: '로컬 생성',
  other: '기타'
};

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
  // 지시문 18 (TASK C-3) — 현재 워크스페이스의 팩 메타(blueprint 제외,
  // listPacks가 이미 가벼운 조회로 제공 — 매 팩을 전부 로드하지 않는다).
  const [packs, setPacks] = useState<SavedPackMeta[]>([]);

  async function refresh() {
    const [allRatings, allPacks] = await Promise.all([getRatings(), listPacks()]);
    setRatings(allRatings);
    setPacks(allPacks);
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
  // 지시문 18 (TASK C-3) — 생성 에이전트별 실측. 채널 스코프가 아니라 항상
  // 이 워크스페이스 전체로 집계한다(에이전트 비교는 채널 단위로 쪼갤
  // 만큼 표본이 넉넉하지 않다 — 표본 부족 가드가 정확히 이 이유다).
  const agentStats = useMemo(() => computeAgentComparisonStats(packs, ratings), [packs, ratings]);

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

      {/*
        지시문 18 (TASK C-3) — "생성 에이전트별 실측". 수치만 보여준다 — 어느
        쪽이 낫다고 이 화면이 결론내지 않는다(§C-3 "자동 판정 금지"). 세트
        MIN_SETS_FOR_AGENT_COMPARISON개 미만인 에이전트는 수치 대신
        "표본 부족"만 보인다.
      */}
      {agentStats.length > 0 && (
        <div className="option-block">
          <h3>생성 에이전트별 실측</h3>
          <div className="allocation-row-list">
            {agentStats.map(stat => (
              <div key={stat.generatedBy} className={stat.sampleSufficient ? 'allocation-row' : 'allocation-row insight-insufficient'} style={stat.sampleSufficient ? undefined : { opacity: 0.5 }}>
                <div className="allocation-label">
                  <b>{GENERATED_BY_LABEL_KO[stat.generatedBy]}</b>
                  <span>
                    세트 {stat.setCount}개 · {stat.songCount}곡
                    {stat.sampleSufficient
                      ? ` · qualityScore 평균 ${stat.avgQualityScore}${stat.ratedSongCount > 0 ? ` · 좋음 ${stat.goodPct}% · 별로 ${stat.badPct}% (n=${stat.ratedSongCount})` : ' · 채점된 곡 없음'}`
                      : ` · 표본 부족(${MIN_SETS_FOR_AGENT_COMPARISON}세트 미만 — 비교로 쓰지 마세요)`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
