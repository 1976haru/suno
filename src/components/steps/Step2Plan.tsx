import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { getGenreById, genreLibrary } from '../../data/genreLibrary';
import { getGenreFamilyById } from '../../data/genreFamilies';
import { readRecentGenreIds } from '../../core/recentGenreStore';
import { directSetLocal, type RatingInsightLike, type SetPlan } from '../../core/setDirector';
import { normalizeDiversityAllocations } from '../../core/diversityAllocation';
import { summarizeVocalTraitDistribution } from '../../core/vocalPlan';
import { getRatings } from '../../core/ratingLedger';
import { analyzeRatings } from '../../core/ratingAnalysis';
import { preallocateSongSlots } from '../../core/batchPreallocation';
import type { DesignGateResult } from '../../core/designGate';
import { evaluateDesignGateResponsive } from '../../core/localGenerationClient';
import { resolveConstraintsFromOptions } from '../../core/constraints';
import { audienceProfileForAgeGroup } from '../../data/audienceProfiles';
import { currentWorkspaceId } from '../../core/workspaceScope';
import DesignGatePanel from '../DesignGatePanel';
import type { AxisAllocation, DiversityAxisId, GenerationOptions, PreassignedSongSlot } from '../../types';
import type { SetSegment } from '../../core/setDirector';

interface Step2PlanProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  /** v3.78 (TASK A) — lets App.tsx gate the global "다음" footer button on 관문 1's status, mirroring step2Blocked's own pattern. Undefined is fine (e.g. in isolated tests) — the panel still renders and works, it just has no navigation side effect. */
  onDesignGateStatusChange?: (status: { passed: boolean; acknowledged: boolean }) => void;
}

const AXIS_LABELS: Record<DiversityAxisId, string> = {
  genre: '장르',
  vocalType: '보컬',
  introTexture: '인트로',
  hookDevice: '훅 장치',
  arrangementDensity: '편곡 밀도',
  structureTemplate: '구조',
  lyricTheme: '가사 장면',
  pov: '시점'
};

function countSummary(allocation: AxisAllocation | undefined) {
  if (!allocation) return '-';
  return Object.entries(allocation.counts).map(([id, count]) => `${id} ${count}`).join(' / ');
}

function genreLabel(id: string) {
  return getGenreById(id)?.label || id;
}

function familyLabel(id: string) {
  return getGenreFamilyById(id)?.labelKo || id;
}

/** TASK v3.72 (TASK D) — "저음 바리톤 2 · 중음 4 · 밝은 테너 3" style one-line summary of an axis distribution, sorted by count so the most-used value reads first. */
function axisSummaryLine(distribution: Record<string, number>): string {
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => `${value} ${count}`)
    .join(' · ');
}

/**
 * TASK v3.63 (재작성 TASK C) — preview-only reordering for the "18곡 계획"
 * table. Groups each segment's tracks together (in segment order) instead of
 * the engine's actual interleaved order. This never touches plan.slots or
 * diversityAllocations — generation itself always keeps preallocateSongSlots'
 * interleave (see setDirector.ts's segment-fatigue rationale); this toggle
 * only changes what the confirmation screen previews.
 */
export function reorderSlotsBySegment(slots: PreassignedSongSlot[], segments: SetSegment[]): PreassignedSongSlot[] {
  const used = new Set<number>();
  const grouped: PreassignedSongSlot[] = [];
  for (const segment of segments) {
    const genreIds = new Set(segment.genreIds);
    for (const slot of slots) {
      if (used.has(slot.trackNo)) continue;
      if (slot.genreId && genreIds.has(slot.genreId)) {
        used.add(slot.trackNo);
        grouped.push(slot);
      }
    }
  }
  for (const slot of slots) {
    if (!used.has(slot.trackNo)) grouped.push(slot);
  }
  return grouped.map((slot, index) => ({ ...slot, trackNo: index + 1 }));
}

function applyPlanToOptions(plan: SetPlan, setOpts: Step2PlanProps['setOpts'], ratingInsights: RatingInsightLike[] | undefined) {
  const genreAllocation = plan.allocations.find(allocation => allocation.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : [];
  setOpts(prev => ({
    ...prev,
    genreIds: genreIds.length ? genreIds : prev.genreIds,
    diversityAllocations: normalizeDiversityAllocations(plan.allocations),
    // TASK v3.68 (TASK E) — carries the same "지난 평가 반영" toggle state
    // this screen previewed with into actual generation (see
    // core/batchPreallocation.ts/localGenerator.ts's killingPointBoostFromInsights
    // call sites). undefined when the toggle is off — zero influence.
    ratingInsights
  }));
}

export default function Step2Plan({ opts, setOpts, onDesignGateStatusChange }: Step2PlanProps) {
  const [recentAvoid, setRecentAvoid] = useState<string[]>([]);
  const [editingAxis, setEditingAxis] = useState<DiversityAxisId | null>(null);
  const [draftAllocations, setDraftAllocations] = useState<AxisAllocation[] | null>(null);
  const [segmentPlacement, setSegmentPlacement] = useState<'interleave' | 'blocked'>('interleave');
  const [gateAcknowledged, setGateAcknowledged] = useState(false);
  // TASK v3.68 (TASK E) — "지난 평가 반영" toggle; on by default, but only
  // ever has an effect once real ratings exist (strongInsights stays empty
  // otherwise, and killingPointBoostFromInsights is a no-op on an empty list).
  const [insightsEnabled, setInsightsEnabled] = useState(true);
  const [strongInsights, setStrongInsights] = useState<RatingInsightLike[]>([]);
  const freeText = opts.customConcept.trim() || opts.projectTitle;
  // TASK v3.63 (TASK B) — family ids checked on Step2 (Step2Concept.tsx);
  // directSetLocal uses these to choose the genre axis directly when present.
  const familyIds = opts.selectedGenreFamilyIds ?? [];

  useEffect(() => {
    let cancelled = false;
    getRatings({ channelId: opts.channel.id })
      .then(ratings => {
        if (cancelled) return;
        const insights = analyzeRatings(ratings, { channelId: opts.channel.id }).filter(insight => insight.confidence === 'strong');
        setStrongInsights(insights);
      })
      .catch(() => { if (!cancelled) setStrongInsights([]); });
    return () => { cancelled = true; };
  }, [opts.channel.id]);

  const appliedInsights = insightsEnabled ? strongInsights : undefined;
  const plan = useMemo(
    // v3.77 (TASK A) — passes the user's actual current vocalTone selection
    // so this plan's own 'vocalType' manual allocation (and the "보컬 배분"
    // card's preview below) reflects leaning, instead of a blind even split
    // that would then win over leaning at generation time anyway (see
    // core/setDirector.ts's resolveVocalCounts doc comment for the real gap
    // this closes).
    () => directSetLocal(freeText, opts.channel, opts.songCount, {
      recentGenreIds: [...readRecentGenreIds(opts.channel.id), ...recentAvoid],
      recentHooks: [],
      insights: appliedInsights
    }, familyIds, opts.vocalTone),
    [freeText, opts.channel, opts.songCount, recentAvoid, familyIds, appliedInsights, opts.vocalTone]
  );
  const allocations = draftAllocations ?? plan.allocations;
  const genreAllocation = allocations.find(allocation => allocation.axis === 'genre');
  const structureAllocation = allocations.find(allocation => allocation.axis === 'structureTemplate');
  // TASK v3.72 (TASK D) — reads the pack's actual resolved slots (real
  // vocalType/vocalText per song) rather than only the manual
  // diversityAllocations entry, which stays undefined under the new default
  // auto quota (TASK A) — the old vocal stat-card showed "-" in exactly the
  // case a user most needed to see it working.
  const vocalDistribution = useMemo(() => summarizeVocalTraitDistribution(plan.slots), [plan.slots]);
  const hasVocalAxisBreakdown = Object.keys(vocalDistribution.register).length > 0;
  const editing = editingAxis ? allocations.find(allocation => allocation.axis === editingAxis) : undefined;
  const hasMultipleSegments = plan.segments.length > 1;
  const displaySlots = hasMultipleSegments && segmentPlacement === 'blocked'
    ? reorderSlotsBySegment(plan.slots, plan.segments)
    : plan.slots;

  // v3.78 (TASK A) — 관문 1 (design-time gate). Deliberately recomputed via
  // preallocateSongSlots directly (the same function Step3Generate's own
  // bridgePreassignedSongs calls), NOT plan.slots — directSetLocal's own
  // preview plan doesn't read opts.diversityAllocations at all (it always
  // builds a fresh allocation internally, see setDirector.ts's
  // buildBaseOptions/makeAllocations), so a manual axis edit or an
  // [자동 수정] click here would never be reflected in plan.slots. Calling
  // preallocateSongSlots with THIS screen's live `allocations` (draft-aware)
  // is what makes the gate panel actually reflect a fix immediately, and
  // matches exactly what real generation will use.
  const gateGenreIds = genreAllocation ? Object.keys(genreAllocation.counts) : opts.genreIds;
  const gateGenres = useMemo(
    () => genreLibrary.filter(genre => gateGenreIds.includes(genre.id)),
    [gateGenreIds.join('|')]
  );
  const gateOpts = useMemo(
    () => ({ ...opts, genreIds: gateGenreIds, diversityAllocations: allocations }),
    [opts, gateGenreIds, allocations]
  );
  const gateSlots = useMemo(
    () => preallocateSongSlots(gateOpts, gateGenres, { usedTitles: [], usedHooks: [] }),
    [gateOpts, gateGenres]
  );
  const constraints = useMemo(
    () => resolveConstraintsFromOptions(gateOpts, audienceProfileForAgeGroup(gateOpts.audience), currentWorkspaceId()),
    [gateOpts]
  );
  // v4.0 (TASK A) — evaluateDesignGate now runs inside a Worker (see
  // core/localGenerationClient.ts's evaluateDesignGateResponsive) instead of
  // synchronously inside a useMemo. `designGateResult` starts null while the
  // worker runs; onDesignGateStatusChange deliberately does NOT fire with an
  // optimistic "passed" while loading — App.tsx's own "다음" button gating
  // must never read a stale/premature pass.
  const [designGateResult, setDesignGateResult] = useState<DesignGateResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    evaluateDesignGateResponsive(gateSlots, constraints, gateOpts)
      .then(result => { if (!cancelled) setDesignGateResult(result); })
      .catch(error => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setDesignGateResult({
          passed: false,
          blocking: [{
            id: 'design-gate-worker-error',
            labelKo: '관문 1 실행 오류',
            expected: '정상 실행',
            actual: message,
            fixHintKo: '페이지를 새로고침해 다시 시도하세요. 계속되면 /?repair=1 로 접속해 복구 모드를 사용하세요.'
          }],
          advisory: []
        });
      });
    return () => { cancelled = true; };
  }, [gateSlots, constraints, gateOpts]);

  useEffect(() => {
    if (!designGateResult) return;
    setGateAcknowledged(false);
  }, [designGateResult?.blocking.map(issue => issue.id).join(',')]);

  useEffect(() => {
    if (!designGateResult) return;
    onDesignGateStatusChange?.({ passed: designGateResult.passed, acknowledged: gateAcknowledged });
  }, [designGateResult, gateAcknowledged, onDesignGateStatusChange]);

  function applyDesignGateAutoFix(fix: Partial<GenerationOptions>) {
    setOpts(prev => ({ ...prev, ...fix }));
  }

  function updateCount(axis: DiversityAxisId, id: string, value: number) {
    setDraftAllocations(current => {
      const source = current ?? plan.allocations;
      return source.map(allocation => allocation.axis === axis
        ? {
          ...allocation,
          counts: {
            ...allocation.counts,
            [id]: Math.max(0, Math.min(opts.songCount, Math.round(value) || 0))
          }
        }
        : allocation);
    });
  }

  function applyDraft() {
    const nextPlan = { ...plan, allocations };
    applyPlanToOptions(nextPlan, setOpts, appliedInsights);
    setEditingAxis(null);
  }

  function redesign() {
    const currentGenreIds = Object.keys(genreAllocation?.counts || {});
    setRecentAvoid(prev => [...new Set([...prev, ...currentGenreIds])]);
    setDraftAllocations(null);
  }

  return (
    <section className="panel">
      <div className="option-block">
        <div className="section-head">
          <div>
            <p className="eyebrow">Step 2.5</p>
            <h2>이렇게 해석했습니다</h2>
          </div>
          <div className="button-row">
            <button type="button" onClick={redesign}>
              <RefreshCw size={15} />
              다시 설계
            </button>
            <button type="button" className="primary" onClick={() => applyPlanToOptions({ ...plan, allocations }, setOpts, appliedInsights)}>
              설계 적용
            </button>
          </div>
        </div>
        {plan.appliedInsightsKo.length > 0 && (
          <div className="option-block compact">
            <div className="section-head">
              <h4>지난 평가 반영</h4>
              <button type="button" onClick={() => setInsightsEnabled(false)}>반영 끄기</button>
            </div>
            {plan.appliedInsightsKo.map(line => <p key={line} className="supporting">{line}</p>)}
          </div>
        )}
        {!insightsEnabled && strongInsights.length > 0 && (
          <p className="supporting">
            지난 평가 반영을 껐습니다.
            <button type="button" className="chip" onClick={() => setInsightsEnabled(true)}>다시 켜기</button>
          </p>
        )}
        <p>{plan.interpretation.intentKo}</p>
        <div className="chips">
          {plan.interpretation.familyIds.map(id => <span key={id} className="chip active">{familyLabel(id)}</span>)}
          {plan.interpretation.eraFocus.map(era => <span key={era} className="chip active">{era}</span>)}
          <span className="chip">audience: {plan.interpretation.audienceProfileId}</span>
          <span className="chip">artist refs: {plan.interpretation.artistReferences.length}</span>
        </div>
        {hasMultipleSegments && (
          <div className="chips">
            {plan.segments.map(segment => (
              <span key={segment.label} className="chip active">{segment.label} {segment.songCount}곡</span>
            ))}
          </div>
        )}
        {plan.interpretation.reasoningKo.map(line => <p key={line} className="supporting">{line}</p>)}
        {plan.warnings.map(warning => <p key={warning} className="error">{warning}</p>)}
        {plan.interpretation.unknownTermsKo.length > 0 && (
          <div className="option-block compact">
            <h4>이해하지 못한 표현</h4>
            {plan.interpretation.unknownTermsKo.map(note => <p key={note} className="error">{note}</p>)}
          </div>
        )}
      </div>

      {designGateResult
        ? (
          <DesignGatePanel
            result={designGateResult}
            onAutoFix={applyDesignGateAutoFix}
            acknowledged={gateAcknowledged}
            onAcknowledgedChange={setGateAcknowledged}
          />
        )
        : <div className="option-block compact">관문 1 검사 중...</div>}

      <div className="option-block">
        <div className="section-head">
          <h3>장르 배분</h3>
          <button type="button" onClick={() => setEditingAxis('genre')}>
            <SlidersHorizontal size={15} />
            조정
          </button>
        </div>
        <div className="chips">
          {Object.entries(genreAllocation?.counts || {}).map(([id, count]) => (
            <span key={id} className="chip active">{genreLabel(id)} {count}곡</span>
          ))}
        </div>
        <p className="supporting">왜 이 조합인가: {plan.interpretation.reasoningKo[0]}</p>
      </div>

      <div className="option-block">
        <div className="section-head">
          <h3>보컬 배분</h3>
          <button type="button" onClick={() => setEditingAxis('vocalType')}>
            <SlidersHorizontal size={15} />
            조정
          </button>
        </div>
        <div className="chips">
          <span className="chip active">남성 솔로 {vocalDistribution.quota.male}곡</span>
          <span className="chip active">여성 솔로 {vocalDistribution.quota.female}곡</span>
          <span className="chip active">듀엣 {vocalDistribution.quota.mixed}곡</span>
        </div>
        {hasVocalAxisBreakdown && (
          <>
            <p className="supporting">음역 {axisSummaryLine(vocalDistribution.register)}</p>
            <p className="supporting">창법 {axisSummaryLine(vocalDistribution.delivery)}</p>
            <p className="supporting">질감 {axisSummaryLine(vocalDistribution.timbre)}</p>
          </>
        )}
      </div>

      <div className="option-block">
        <div className="stats-grid">
          <button type="button" className="stat-card" onClick={() => setEditingAxis('structureTemplate')}>
            <b>구조</b>
            <span>{countSummary(structureAllocation)}</span>
          </button>
          {(['introTexture', 'hookDevice', 'arrangementDensity', 'lyricTheme', 'pov'] as DiversityAxisId[]).map(axis => (
            <button key={axis} type="button" className="stat-card" onClick={() => setEditingAxis(axis)}>
              <b>{AXIS_LABELS[axis]}</b>
              <span>{countSummary(allocations.find(allocation => allocation.axis === axis))}</span>
            </button>
          ))}
        </div>
      </div>

      <details className="option-block">
        <summary>18곡 계획 펼치기</summary>
        {hasMultipleSegments && (
          <div className="button-row segment-placement-row">
            <label>
              <input
                type="radio"
                name="segmentPlacement"
                checked={segmentPlacement === 'interleave'}
                onChange={() => setSegmentPlacement('interleave')}
              />
              섞기 (권장)
            </label>
            <label>
              <input
                type="radio"
                name="segmentPlacement"
                checked={segmentPlacement === 'blocked'}
                onChange={() => setSegmentPlacement('blocked')}
              />
              전반부·후반부로 나누기
            </label>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Track</th>
                <th>Genre</th>
                <th>BPM</th>
                <th>Vocal</th>
                <th>Structure</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {displaySlots.map(slot => (
                <tr key={slot.trackNo}>
                  <td>{slot.trackNo}</td>
                  <td>{genreLabel(slot.genreId || '')}</td>
                  <td>{slot.tempo}</td>
                  <td>{slot.vocalType || slot.vocalGender || '-'}</td>
                  <td>{slot.structureTemplate || '-'}</td>
                  <td>{slot.songRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="supporting">최근 장르 {readRecentGenreIds(opts.channel.id).length}개를 참고했고, 최근 훅은 생성 단계의 기존 ledger가 제외합니다.</p>

      {editingAxis && editing && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditingAxis(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
            <div className="section-head">
              <h3>{AXIS_LABELS[editingAxis]} 조정</h3>
              <button type="button" onClick={() => setEditingAxis(null)}>닫기</button>
            </div>
            <div className="allocation-row-list">
              {Object.entries(editing.counts).map(([id, count]) => (
                <div key={id} className="allocation-row">
                  <div className="allocation-label">
                    <b>{editingAxis === 'genre' ? genreLabel(id) : id}</b>
                    <span>{AXIS_LABELS[editingAxis]}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={opts.songCount}
                    value={count}
                    onChange={event => updateCount(editingAxis, id, Number(event.target.value))}
                  />
                </div>
              ))}
            </div>
            {plan.adjustables.find(item => item.axis === editingAxis)?.alternatives.length ? (
              <div className="option-block compact">
                <h4>대안</h4>
                <div className="chips">
                  {plan.adjustables.find(item => item.axis === editingAxis)?.alternatives.map(alt => (
                    <button type="button" key={alt.id} className="chip" onClick={() => updateCount(editingAxis, alt.id, 1)} title={alt.whyKo}>
                      {alt.labelKo}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="button-row">
              <button type="button" onClick={() => setDraftAllocations(null)}>초기화</button>
              <button type="button" className="primary" onClick={applyDraft}>적용</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
