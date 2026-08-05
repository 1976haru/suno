import { useState } from 'react';
import { PALETTE_FAMILIES } from '../data/paletteFamilies';
import { moneyChordPresets } from '../data/moneyChords';
import { MONEY_CHORD_EMOTION_KO } from '../data/paletteFamilyMoneyChords';
import { computeMoneyChordComparison } from '../core/moneyChordDisplay';
import type { VerifiedCombo } from '../data/verifiedCombos';
import type { GenerationOptions } from '../types';

/**
 * TASK v4.14 (TASK A) — "컨셉만 입력했을 때 Step2Plan 상단에 계열/템포/머니코드
 * 배분/목소리/대표곡을 한 번에 보여주고, 음악 용어를 모르는 사람도 이해할 수
 * 있게 한 줄 이유를 붙이십시오." Purely presentational: every value here is
 * already resolved by Step2Plan.tsx (resolvedPaletteFamilyId, gateSlots'
 * moneyChordId tally, vocalDistribution.quota, resolveFlagshipCombo) — this
 * component only lays it out and owns the collapse/expand toggle. "직접
 * 조정" never disables anything below; Step2Plan's own 장르/보컬/계열 조정
 * controls stay fully interactive regardless of this panel's state, matching
 * this task's own explicit "추천을 강제해서는 안 됩니다".
 */

export interface MoneyChordBreakdownEntry {
  id: string;
  count: number;
}

export interface ConceptRecommendationPanelProps {
  familyId: string | undefined;
  onChangeFamily: (id: string) => void;
  tempoSummaryKo: string;
  moneyChordBreakdown: MoneyChordBreakdownEntry[];
  /** TASK v5.8 (TASK B) — the raw money-chord fields off GenerationOptions, needed to render "선택 vs 실제 적용" regardless of whether the recommendation panel above has been dismissed. */
  moneyChordMode: GenerationOptions['moneyChordMode'];
  moneyChordModeIsExplicitChoice?: boolean;
  customMoneyChord: string;
  songCount: number;
  vocalSummaryKo: string;
  vocalIsBalanced: boolean;
  flagshipCombo?: VerifiedCombo;
  flagshipGenreLabelKo: string;
}

export default function ConceptRecommendationPanel({
  familyId,
  onChangeFamily,
  tempoSummaryKo,
  moneyChordBreakdown,
  moneyChordMode,
  moneyChordModeIsExplicitChoice,
  customMoneyChord,
  songCount,
  vocalSummaryKo,
  vocalIsBalanced,
  flagshipCombo,
  flagshipGenreLabelKo
}: ConceptRecommendationPanelProps) {
  const [mode, setMode] = useState<'open' | 'accepted' | 'manual'>('open');
  const family = PALETTE_FAMILIES.find(f => f.id === familyId);
  // TASK v5.8 (TASK B) — always computed/rendered regardless of `mode`
  // (open/accepted/manual): unlike the rest of this panel's content (a
  // dismissible, one-time recommendation), "what actually got applied" stays
  // relevant for the whole time this screen is open, including after the
  // user dismisses the recommendation or switches to manual adjustment.
  const moneyChordComparison = computeMoneyChordComparison(
    { moneyChordMode, moneyChordModeIsExplicitChoice, customMoneyChord },
    moneyChordBreakdown,
    songCount
  );

  return (
    <div className="option-block">
      <div className="section-head">
        <div>
          <p className="eyebrow">컨셉 추천</p>
          <h3>이 컨셉에는 이렇게 추천합니다</h3>
        </div>
        {mode !== 'open' && (
          <button type="button" onClick={() => setMode('open')}>추천 다시 보기</button>
        )}
      </div>

      <div className="option-block compact">
        <h4>머니코드 — 선택 vs 실제 적용</h4>
        <p>선택: {moneyChordComparison.chosenLabelKo} · 실제 적용: {moneyChordComparison.appliedSummaryKo}</p>
        {moneyChordComparison.mismatchWarningKo && (
          <p className="error">{moneyChordComparison.mismatchWarningKo}</p>
        )}
      </div>

      {mode === 'accepted' && <p className="supporting">추천대로 진행합니다. 아래 세부 항목은 언제든 조정할 수 있습니다.</p>}
      {mode === 'manual' && <p className="supporting">직접 조정을 선택했습니다. 아래 세부 항목에서 자유롭게 바꿀 수 있습니다.</p>}

      {mode === 'open' && (
        <>
          <div className="option-block compact">
            <h4>계열</h4>
            {family ? (
              <>
                <p>{family.labelKo} — {family.koreanNoteKo}</p>
                <div className="chips">
                  {PALETTE_FAMILIES.map(f => (
                    <button
                      type="button"
                      key={f.id}
                      className={f.id === familyId ? 'chip active' : 'chip'}
                      onClick={() => onChangeFamily(f.id)}
                    >
                      {f.labelKo}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="supporting">이 채널은 계열 추천 대상이 아닙니다 (팔레트 계열이 적용되지 않는 아카이브/장르).</p>
            )}
          </div>

          <div className="option-block compact">
            <h4>템포</h4>
            <p>{tempoSummaryKo}</p>
            <p className="supporting">템포가 세트 전체의 분위기를 정합니다 — 느릴수록 차분하고, 밝을수록 경쾌합니다.</p>
          </div>

          {moneyChordBreakdown.length > 0 && (
            <div className="option-block compact">
              <h4>머니코드 배분</h4>
              <div className="chips">
                {moneyChordBreakdown.map(entry => {
                  const preset = moneyChordPresets[entry.id];
                  return (
                    <span key={entry.id} className="chip active" title={MONEY_CHORD_EMOTION_KO[entry.id] ?? ''}>
                      {preset?.labelKo ?? entry.id} {entry.count}곡
                    </span>
                  );
                })}
              </div>
              {moneyChordBreakdown.map(entry => (
                <p key={entry.id} className="supporting">
                  {moneyChordPresets[entry.id]?.labelKo ?? entry.id}: {MONEY_CHORD_EMOTION_KO[entry.id] ?? '이 세트의 진행 중 하나입니다.'}
                </p>
              ))}
              <p className="supporting">추정 배분입니다 — 채널별로 아직 검증되지 않았습니다.</p>
            </div>
          )}

          <div className="option-block compact">
            <h4>목소리</h4>
            <p>{vocalSummaryKo}</p>
            <p className="supporting">
              {vocalIsBalanced
                ? '기본값은 고르게 배분입니다 — 남성·여성·듀엣이 비슷한 비중으로 섞입니다.'
                : '선택한 쏠림에 맞춰 배분했습니다.'}
            </p>
          </div>

          <div className="option-block compact">
            <h4>⭐ 대표곡</h4>
            {flagshipCombo ? (
              <>
                <p>{flagshipGenreLabelKo} — {flagshipCombo.bpmRange[0]}~{flagshipCombo.bpmRange[1]} BPM</p>
                <p className="supporting">지난 세트에서 좋은 평가를 받은 조합입니다. {flagshipCombo.noteKo}</p>
              </>
            ) : (
              <p className="supporting">이 컨셉·장르 조합에 해당하는 검증된 대표곡 조합이 아직 없습니다.</p>
            )}
          </div>

          <div className="button-row">
            <button type="button" className="primary" onClick={() => setMode('accepted')}>이대로 진행</button>
            <button type="button" onClick={() => setMode('manual')}>직접 조정</button>
          </div>
        </>
      )}
    </div>
  );
}
