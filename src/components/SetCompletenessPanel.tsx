import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, ListMusic, Music2 } from 'lucide-react';
import type { AudienceProfile, GenerationOptions, PlaylistBlueprint, SongIdea } from '../types';
import type { GenerationGateResult } from '../core/generationGate';
import type { FullAuditReport, AuditItem } from '../core/fullAudit';
import { runFullAuditResponsive } from '../core/localGenerationClient';
import { buildSetCompletenessSummary } from '../core/setCompletenessSummary';
import { suggestSetOrder, type TrackAudioSignal } from '../core/setOrderSuggestion';
import { scopedKey, currentWorkspaceId } from '../core/workspaceScope';
import { getTakes } from '../core/audioTakes';
import { getApprovedCombos, effectiveVerifiedCombos } from '../core/verifiedCombos';
import type { VerifiedCombo } from '../data/verifiedCombos';
import { downloadText } from '../utils/exporters';

/**
 * v4.3 (TASK E-3) — "실전 투입 전 마지막 확인용 화면 ... 이 화면 하나로
 * '이 세트를 써도 되는가'를 판단할 수 있어야 합니다" (하루님). Reuses exactly
 * the same audit/regression mechanism PromiseAuditPanel.tsx already has
 * (runFullAuditResponsive + a localStorage baseline, same classify rule) so
 * this card's "audit 회귀" number is never a second, possibly-disagreeing
 * computation of the same thing.
 */

interface SetCompletenessPanelProps {
  blueprint: PlaylistBlueprint;
  opts: GenerationOptions;
  audienceProfile: AudienceProfile;
  generationGateResult: GenerationGateResult | null;
}

interface StoredBaseline {
  savedAt: string;
  conceptLabel: string;
  items: Record<string, boolean>;
}

function baselineStorageKey(channelId: string): string {
  return scopedKey(`audit-baseline:${channelId}`);
}

function loadBaseline(channelId: string): StoredBaseline | undefined {
  try {
    const raw = localStorage.getItem(baselineStorageKey(channelId));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function classify(it: AuditItem, baseline: StoredBaseline | undefined): 'pass' | 'regression' | 'below-target' | 'not-measured' | 'new' {
  if (it.status === 'not-measured') return 'not-measured';
  const prior = baseline?.items[it.id];
  if (prior === undefined) return it.status === 'pass' ? 'pass' : 'new';
  if (prior === true && it.status === 'fail') return 'regression';
  if (prior === false && it.status === 'fail') return 'below-target';
  return 'pass';
}

function StatusBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span className="chip">⬜ {label} 미측정</span>;
  return <span className={ok ? 'chip' : 'chip warning-chip'}>{ok ? '✅' : '❌'} {label}</span>;
}

export default function SetCompletenessPanel({ blueprint, opts, audienceProfile, generationGateResult }: SetCompletenessPanelProps) {
  const conceptLabel = opts.customConcept || opts.projectTitle;
  const [report, setReport] = useState<FullAuditReport | null>(null);
  const [takeCount, setTakeCount] = useState(0);
  // TASK v4.14 (TASK D) — adopted takes' real metrics.spectralCentroid/
  // overallLevel, mapped to the shape suggestSetOrder's second argument
  // expects. Before this task, this panel fetched takes only to count them
  // (takeCount) and never actually handed suggestSetOrder any real audio
  // data, so orderSuggestion.usedRealAudioSignals was always false and the
  // "실측 음원 분석 반영" branch of the UI below was dead in practice.
  const [audioSignals, setAudioSignals] = useState<TrackAudioSignal[]>([]);
  const [candidateCombos, setCandidateCombos] = useState<VerifiedCombo[]>([]);

  useEffect(() => {
    let cancelled = false;
    runFullAuditResponsive(blueprint.songs, { conceptLabel, songCount: blueprint.songs.length, audienceProfile })
      .then(result => { if (!cancelled) setReport(result); })
      .catch(() => { if (!cancelled) setReport(null); });
    return () => { cancelled = true; };
  }, [blueprint.songs, conceptLabel, audienceProfile]);

  const packId = `${blueprint.channelName}::${blueprint.projectTitle}::${blueprint.songs.length}`;
  function refreshAudioTakes() {
    let cancelled = false;
    getTakes({ packId })
      .then(takes => {
        if (cancelled) return;
        setTakeCount(takes.length);
        setAudioSignals(
          takes
            .filter(take => take.adopted)
            .map(take => ({ trackNo: take.trackNo, spectralCentroid: take.metrics.spectralCentroid, overallLevel: take.metrics.overallLevel }))
        );
      })
      .catch(() => { if (!cancelled) { setTakeCount(0); setAudioSignals([]); } });
    return () => { cancelled = true; };
  }
  useEffect(refreshAudioTakes, [blueprint]);

  useEffect(() => {
    let cancelled = false;
    const workspaceId = currentWorkspaceId();
    getApprovedCombos(workspaceId)
      .then(approved => { if (!cancelled) setCandidateCombos(effectiveVerifiedCombos(workspaceId, approved)); })
      .catch(() => { if (!cancelled) setCandidateCombos([]); });
    return () => { cancelled = true; };
  }, []);

  const baseline = useMemo(() => loadBaseline(opts.channel.id), [opts.channel.id]);
  const classified = useMemo(() => report?.items.map(it => ({ item: it, classification: classify(it, baseline) })) ?? [], [report, baseline]);
  const regressionCount = baseline ? classified.filter(c => c.classification === 'regression').length : null;
  const promisePct = report ? Math.round(report.promiseAudit.overallFulfillment * 100) : null;

  const summary = useMemo(() => buildSetCompletenessSummary({
    songs: blueprint.songs,
    setCode: blueprint.meta?.setCode || '(미저장)',
    conceptLabel,
    gate2Passed: generationGateResult?.passed ?? null,
    gate2FailingTrackCount: generationGateResult?.failingTrackNos.length ?? 0,
    auditRegressionCount: regressionCount,
    promiseFulfillmentPct: promisePct,
    lyricLanguage: opts.lyricLanguage,
    audioTakeCount: takeCount,
    candidateVerifiedCombos: candidateCombos
  }), [blueprint, conceptLabel, generationGateResult, regressionCount, promisePct, opts.lyricLanguage, takeCount, candidateCombos]);
  const combosPlaced = summary.verifiedCombosPlaced;

  const orderSuggestion = useMemo(() => suggestSetOrder(blueprint.songs, audioSignals), [blueprint.songs, audioSignals]);

  function exportOrderSuggestion() {
    const lines = [
      `${summary.setCode} — 추천 재생 순서 (${orderSuggestion.usedRealAudioSignals ? '실측 음원 분석 반영' : '실측 음원 분석 없음 — BPM/아크 단계 기반 추정'})`,
      '',
      ...orderSuggestion.entries.map(entry => `${entry.position}. T${entry.trackNo} — ${entry.title} (${entry.noteKo})`)
    ];
    downloadText(`${summary.setCode}_추천순서.txt`, lines.join('\n'));
  }

  return (
    <div className="set-completeness-panel panel">
      <div className="set-completeness-header">
        <ClipboardList size={16} />
        <strong>{summary.setCode}</strong>
        <span className="supporting">{summary.conceptLabel}</span>
      </div>

      <div className="button-row">
        <StatusBadge ok={summary.gate2Passed} label="관문 2 통과" />
        {summary.gate2Passed === false && <span className="supporting">실패 {summary.gate2FailingTrackCount}곡</span>}
        <StatusBadge ok={summary.auditRegressionCount === null ? null : summary.auditRegressionCount === 0} label={summary.auditRegressionCount === null ? 'audit 회귀' : `audit 회귀 ${summary.auditRegressionCount}건`} />
        <StatusBadge ok={summary.promiseFulfillmentPct === null ? null : summary.promiseFulfillmentPct >= 65} label={summary.promiseFulfillmentPct === null ? '약속 이행도' : `약속 이행도 ${summary.promiseFulfillmentPct}%`} />
      </div>

      <div className="set-completeness-grid">
        <div>
          <strong>음악</strong>
          <p className="supporting">
            장르 {summary.music.genreVariety}종 · BPM {summary.music.bpmRange ? `${summary.music.bpmRange[0]}~${summary.music.bpmRange[1]}` : '-'} ·
            {' '}보컬 남{summary.music.vocalCounts.male}/여{summary.music.vocalCounts.female}/듀엣{summary.music.vocalCounts.mixed}
          </p>
        </div>
        <div>
          <strong>가사</strong>
          <p className="supporting">
            상황 {summary.lyrics.situationVariety}종 · 감정 {summary.lyrics.emotionVariety}종 · 평균 {summary.lyrics.avgWordCount}단어
          </p>
        </div>
        <div>
          <strong>제목</strong>
          <p className="supporting">
            패턴 {summary.title.patternVariety}종 · 훅 일치 {summary.title.hookMatchCount}곡 ·
            {' '}이중언어 표시 {summary.title.localizedCount}/{summary.title.totalCount}곡
          </p>
        </div>
        <div>
          <strong>음원</strong>
          <p className="supporting">{summary.audioAnalyzed ? `분석됨 (테이크 ${summary.audioTakeCount}개)` : '미분석 (수노 생성 후 확인)'}</p>
        </div>
      </div>

      {combosPlaced.length > 0 && (
        <p className="supporting">
          검증된 조합 {combosPlaced.reduce((sum, p) => sum + p.trackNos.length, 0)}곡 배치됨
          {' '}({combosPlaced.map(p => `${p.combo.genreId} ${p.combo.bpmRange[0]}~${p.combo.bpmRange[1]} — T${p.trackNos.join(', T')}`).join(' / ')})
        </p>
      )}

      <div className="set-completeness-order">
        <div className="button-row">
          <ListMusic size={14} />
          <strong>추천 재생 순서</strong>
          <span className="supporting">{orderSuggestion.usedRealAudioSignals ? '실측 음원 분석 반영' : '음원 미분석 — BPM/아크 단계 기반 추정'}</span>
          {takeCount > 0 && (
            <button type="button" onClick={refreshAudioTakes} title="음원 분석 탭에서 새로 채택한 테이크가 있으면 반영합니다.">
              순서 다시 계산 (실측 반영)
            </button>
          )}
          {orderSuggestion.changed && <button type="button" onClick={exportOrderSuggestion}>추천 순서 내보내기 (.txt)</button>}
        </div>
        {!orderSuggestion.changed && <p className="supporting">현재 순서가 이미 추천 순서와 같습니다 — 재배치가 필요 없습니다.</p>}
        {orderSuggestion.changed && (
          <ol className="set-completeness-order-list">
            {orderSuggestion.entries.map(entry => (
              <li key={entry.trackNo}>T{entry.trackNo} — {entry.title} <span className="supporting">({entry.noteKo})</span></li>
            ))}
          </ol>
        )}
      </div>

      <p className="supporting"><Music2 size={12} style={{ verticalAlign: 'middle' }} /> 첫 15초 미리듣기 파일은 "음원 분석" 탭에서 실제 mp3를 업로드한 뒤 만들 수 있습니다 (아래 참고).</p>
    </div>
  );
}

export function usableSongsForOrderSuggestion(songs: SongIdea[]): boolean {
  return songs.length >= 4;
}
