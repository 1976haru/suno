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
import { downloadText, copyText } from '../utils/exporters';
import { evaluateReleaseReadiness, type ReleaseReadinessReport } from '../core/releaseReadiness';
import { classifyReleaseReadinessFailures, buildRewriteInstruction } from '../core/rewriteLoop';
import { recentSceneSignatures, recentSituations } from '../core/situationLedger';
import { recentLyricLines } from '../core/lyricLineLedger';
import { recentArrangementRecipes, recentFingerprints } from '../core/promptFingerprintLedger';
import { usedTitles as fetchHistoricalTitles } from '../core/hookLedger';
import { listExplorationHistory } from '../core/explorationLedger';
import { explorationPolicyFor } from '../data/explorationPolicies';

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
  const [releaseReadiness, setReleaseReadiness] = useState<ReleaseReadinessReport | null>(null);
  const [releaseReadinessOpen, setReleaseReadinessOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    runFullAuditResponsive(blueprint.songs, { conceptLabel, songCount: blueprint.songs.length, audienceProfile, vocalQuotaOverride: opts.channel.vocalQuotaOverride })
      .then(result => { if (!cancelled) setReport(result); })
      .catch(() => { if (!cancelled) setReport(null); });
    return () => { cancelled = true; };
  }, [blueprint.songs, conceptLabel, audienceProfile, opts.channel.vocalQuotaOverride]);

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

  // v5.23 (TASK C §3-6) — "발매 가능 (탐색 3곡 포함)": evaluateReleaseReadiness
  // itself is pure (core/releaseReadiness.ts), but its inputs need two
  // IndexedDB reads: the same cross-pack duplicationHistory
  // App.tsx/Step3Generate.tsx already fetch for Gate 1 (recentSituations/
  // recentLyricLines/fetchHistoricalTitles), and this pack's own
  // exploration-slot trackNos. There's no field on PlaylistBlueprint
  // marking which tracks were exploration slots (the plan lives only in
  // Step3Generate.tsx's own state at generation time — see
  // core/explorationLedger.ts's own recordExploration call site), so this
  // looks up the most recent ledger record whose packLabel matches this
  // pack's own projectTitle — a real, best-effort match (title collisions
  // are rare and, worst case, this is an advisory badge, not a safety
  // gate). v5.24 integration fix — was `workspaceId === 'senior-oldpop'`:
  // core/explorationPolicyEngine.ts now records real exploration history
  // for kr-kids/jp-kids/kr-idol-male/kr-idol-female/kr-2030/jp-2030 too
  // (Step3Generate.tsx's own bridgePolicyExplorationPlan), so the exemption
  // fetch uses the same universal explorationPolicyFor(...).enabled gate
  // ExplorationLedgerPanel.tsx's own mount now uses.
  useEffect(() => {
    let cancelled = false;
    const workspaceId = currentWorkspaceId();
    void (async () => {
      try {
        const [situations, lines, historicalTitles, explorationHistory, fingerprints, arrangementRecipes, sceneSignatures] = await Promise.all([
          recentSituations(opts.channel.id, opts.lyricLanguage),
          recentLyricLines(opts.channel.id, opts.lyricLanguage),
          fetchHistoricalTitles(opts.channel.id, opts.lyricLanguage),
          explorationPolicyFor(workspaceId).enabled ? listExplorationHistory(workspaceId) : Promise.resolve([]),
          // codex 지시문 02 (TASK K) — same "pre-fetched by the caller" shape
          // as recentSituations/recentLyricLines just above.
          recentFingerprints(opts.channel.id),
          recentArrangementRecipes(opts.channel.id),
          // codex 지시문 02 (TASK B) — same shape, drives the new advisory
          // scene-similarity item alongside the exact-match one above.
          recentSceneSignatures(opts.channel.id, opts.lyricLanguage)
        ]);
        if (cancelled) return;
        const matchingRecord = explorationHistory.find(record => record.packLabel === blueprint.projectTitle);
        const report = evaluateReleaseReadiness({
          songs: blueprint.songs,
          conceptLabel,
          songCount: blueprint.songs.length,
          audienceProfile,
          lyricLanguage: opts.lyricLanguage,
          archetype: opts.channel.archetype,
          vocalQuotaOverride: opts.channel.vocalQuotaOverride,
          duplicationHistory: {
            recentSituations: situations,
            recentLyricLines: lines,
            historicalTitles,
            recentFingerprints: fingerprints,
            recentArrangementRecipes: arrangementRecipes,
            recentSceneSignatures: sceneSignatures
          },
          explorationTrackNos: matchingRecord?.trackNos
        });
        if (!cancelled) setReleaseReadiness(report);
      } catch {
        if (!cancelled) setReleaseReadiness(null);
      }
    })();
    return () => { cancelled = true; };
  }, [blueprint, conceptLabel, audienceProfile, opts.channel.id, opts.lyricLanguage]);

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

  // codex 지시문 05 (TASK F/H) — measuredCriteria/passedOfMeasured/
  // unmeasuredCount now come straight from core/releaseReadiness.ts's own
  // real ReleaseReadinessReport fields (single source — this panel used to
  // re-derive the same 2-number ratio ad hoc; TASK F moved that
  // computation into the report itself so no other future consumer has to
  // re-derive it a second, possibly-diverging way). measurableFailing is
  // still panel-local (only this panel needs the actual failing-item LIST,
  // not just the count).
  const measurableFailing = releaseReadiness?.failing.filter(item => !item.notImplemented) ?? [];
  const measurableTotal = releaseReadiness?.measuredCriteria ?? 0;
  const measurablePassed = releaseReadiness?.passedOfMeasured ?? 0;
  const unmeasuredCount = releaseReadiness?.unmeasuredCount ?? 0;
  const releaseReadyMeasurable = releaseReadiness ? measurableFailing.length === 0 : null;
  const exemptCount = releaseReadiness?.explorationExemptCount ?? 0;

  // 지시문 08 (TASK C) — core/rewriteLoop.ts existed (v5.22 AXIS 5: real
  // failing-item -> scoped-issue classification + a structured, per-track
  // Korean rewrite instruction) but had zero real importers anywhere — a
  // failed release-readiness check gave the user no app-generated guidance
  // on what to actually fix, only the raw pass/fail list above. Wires the
  // pure classify+build pair in here (this panel already has the real
  // ReleaseReadinessReport in scope); the paste-back verification half
  // (rewriteVerification.ts/rewriteWorkspaceRules.ts — confirming a
  // returned rewrite didn't touch a locked "passed" track) needs a real
  // paste-back UI flow this task didn't build, so those 2 modules stay
  // unwired, honestly reported rather than half-wired.
  const rewriteInstructionText = useMemo(() => {
    if (!releaseReadiness || !measurableFailing.length) return '';
    const issues = classifyReleaseReadinessFailures(releaseReadiness, blueprint.songs);
    return buildRewriteInstruction(issues, blueprint.songs.map(song => song.trackNo));
  }, [releaseReadiness, measurableFailing.length, blueprint.songs]);

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
        <StatusBadge
          ok={releaseReadyMeasurable}
          label={
            releaseReadiness
              ? `측정 기준 ${measurablePassed}/${measurableTotal} 통과 · 감사 범위 ${measurableTotal}/${releaseReadiness.totalCriteria} · 미측정 ${unmeasuredCount}개${exemptCount > 0 ? ` (탐색 ${exemptCount}곡 포함)` : ''}`
              : '발매 준비'
          }
        />
      </div>

      {releaseReadiness && (
        <div className="release-readiness-block">
          <button type="button" className="chip" onClick={() => setReleaseReadinessOpen(open => !open)}>
            {releaseReadinessOpen ? '발매 준비 세부 항목 접기' : `발매 준비 세부 항목 보기${measurableFailing.length ? ` (미통과 ${measurableFailing.length}건)` : ''}`}
          </button>
          {rewriteInstructionText && (
            <button type="button" className="chip" onClick={() => void copyText(rewriteInstructionText)} title="미통과 항목만 대상으로 하는 재작성 지시문을 클립보드에 복사합니다.">
              재작성 지시문 복사
            </button>
          )}
          {exemptCount > 0 && (
            <p className="supporting">
              탐색 슬롯 {exemptCount}곡은 BPM·장르·보컬 배분 기준에서 제외하고 판정했습니다 — 탐색 슬롯은 그 기준을 의도적으로 벗어나도 되는 트랙입니다.
            </p>
          )}
          {releaseReadinessOpen && (
            <ul className="release-readiness-items">
              {releaseReadiness.items.filter(item => item.notImplemented).map(item => (
                <li key={item.id} className="not-implemented">
                  <span>⬜ {item.labelKo}</span>
                  <span className="supporting">미구현 — {item.detail}</span>
                </li>
              ))}
              {measurableFailing.map(item => (
                <li key={item.id} className="fail">
                  <span>❌ {item.labelKo}{item.exempted ? ' (탐색 예외 적용됨)' : ''}</span>
                  <span className="supporting">{item.detail}</span>
                </li>
              ))}
              {releaseReadiness.items.filter(item => item.status === 'pass').map(item => (
                <li key={item.id} className="pass">
                  <span>✅ {item.labelKo}{item.exempted ? ' (탐색 예외 적용됨)' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
