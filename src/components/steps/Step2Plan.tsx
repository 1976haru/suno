import { useMemo, useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { getGenreById } from '../../data/genreLibrary';
import { getGenreFamilyById } from '../../data/genreFamilies';
import { readRecentGenreIds } from '../../core/recentGenreStore';
import { directSetLocal, type SetPlan } from '../../core/setDirector';
import { normalizeDiversityAllocations } from '../../core/diversityAllocation';
import type { AxisAllocation, DiversityAxisId, GenerationOptions } from '../../types';

interface Step2PlanProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
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

function applyPlanToOptions(plan: SetPlan, setOpts: Step2PlanProps['setOpts']) {
  const genreAllocation = plan.allocations.find(allocation => allocation.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : [];
  setOpts(prev => ({
    ...prev,
    genreIds: genreIds.length ? genreIds : prev.genreIds,
    diversityAllocations: normalizeDiversityAllocations(plan.allocations)
  }));
}

export default function Step2Plan({ opts, setOpts }: Step2PlanProps) {
  const [recentAvoid, setRecentAvoid] = useState<string[]>([]);
  const [editingAxis, setEditingAxis] = useState<DiversityAxisId | null>(null);
  const [draftAllocations, setDraftAllocations] = useState<AxisAllocation[] | null>(null);
  const freeText = opts.customConcept.trim() || opts.projectTitle;
  // TASK v3.63 (TASK B) — family ids checked on Step2 (Step2Concept.tsx);
  // directSetLocal uses these to choose the genre axis directly when present.
  const familyIds = opts.selectedGenreFamilyIds ?? [];
  const plan = useMemo(
    () => directSetLocal(freeText, opts.channel, opts.songCount, {
      recentGenreIds: [...readRecentGenreIds(opts.channel.id), ...recentAvoid],
      recentHooks: []
    }, familyIds),
    [freeText, opts.channel, opts.songCount, recentAvoid, familyIds]
  );
  const allocations = draftAllocations ?? plan.allocations;
  const genreAllocation = allocations.find(allocation => allocation.axis === 'genre');
  const vocalAllocation = allocations.find(allocation => allocation.axis === 'vocalType');
  const structureAllocation = allocations.find(allocation => allocation.axis === 'structureTemplate');
  const editing = editingAxis ? allocations.find(allocation => allocation.axis === editingAxis) : undefined;

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
    applyPlanToOptions(nextPlan, setOpts);
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
            <button type="button" className="primary" onClick={() => applyPlanToOptions({ ...plan, allocations }, setOpts)}>
              설계 적용
            </button>
          </div>
        </div>
        <p>{plan.interpretation.intentKo}</p>
        <div className="chips">
          {plan.interpretation.familyIds.map(id => <span key={id} className="chip active">{familyLabel(id)}</span>)}
          {plan.interpretation.eraFocus.map(era => <span key={era} className="chip active">{era}</span>)}
          <span className="chip">audience: {plan.interpretation.audienceProfileId}</span>
          <span className="chip">artist refs: {plan.interpretation.artistReferences.length}</span>
        </div>
        {plan.interpretation.reasoningKo.map(line => <p key={line} className="supporting">{line}</p>)}
        {plan.warnings.map(warning => <p key={warning} className="error">{warning}</p>)}
      </div>

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
        <div className="stats-grid">
          <button type="button" className="stat-card" onClick={() => setEditingAxis('vocalType')}>
            <b>보컬</b>
            <span>{countSummary(vocalAllocation)}</span>
          </button>
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
              {plan.slots.map(slot => (
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
