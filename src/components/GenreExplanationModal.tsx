import { useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ChannelProfile, GenrePack } from '../types';
import { explainGenre } from '../core/genreExplainer';
import { MUSIC_GLOSSARY, type GlossaryTerm } from '../data/musicGlossary';

/**
 * 지시문 25 (TASK A-5 / D-4) — 장르 칩의 ⓘ 진입점이 여는 설명 카드.
 * 선택 여부와 무관하게 열 수 있다(§A-5 "선택하지 않고도 설명을 볼 수 있어야
 * 한다") — 이 모달은 onClose만 있고 onSelect 같은 선택 액션이 없다.
 *
 * 용어 밑줄(§D-4)은 MUSIC_GLOSSARY의 termKo가 부분 문자열로 등장하는
 * 자리에만 긋는다 — 사전에 없는 용어는 밑줄을 그리지 않는다.
 */

const SORTED_GLOSSARY = [...MUSIC_GLOSSARY].sort((a, b) => b.termKo.length - a.termKo.length);

function renderWithGlossary(text: string, onPick: (term: GlossaryTerm) => void, keyPrefix: string): ReactNode[] {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let remaining = text;
  let cursor = 0;
  while (remaining.length) {
    let matched: { term: GlossaryTerm; index: number } | null = null;
    for (const term of SORTED_GLOSSARY) {
      const idx = remaining.indexOf(term.termKo);
      if (idx >= 0 && (!matched || idx < matched.index)) {
        matched = { term, index: idx };
      }
    }
    if (!matched) {
      nodes.push(<span key={`${keyPrefix}-${cursor}`}>{remaining}</span>);
      break;
    }
    if (matched.index > 0) {
      nodes.push(<span key={`${keyPrefix}-${cursor}`}>{remaining.slice(0, matched.index)}</span>);
      cursor += matched.index;
    }
    nodes.push(
      <button
        type="button"
        key={`${keyPrefix}-${cursor}-term`}
        className="glossary-term"
        onClick={() => onPick(matched!.term)}
      >
        {matched.term.termKo}
      </button>
    );
    cursor += matched.term.termKo.length;
    remaining = remaining.slice(matched.index + matched.term.termKo.length);
  }
  return nodes;
}

interface GenreExplanationModalProps {
  genre: GenrePack;
  channel: ChannelProfile;
  onClose: () => void;
}

export default function GenreExplanationModal({ genre, channel, onClose }: GenreExplanationModalProps) {
  const explanation = useMemo(() => explainGenre(genre, channel), [genre, channel]);
  const [activeTerm, setActiveTerm] = useState<GlossaryTerm | null>(null);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel genre-explanation-panel">
        <div className="panel-header">
          <h2>
            🎵 {explanation.labelKo}
            <span className="supporting" style={{ marginLeft: 8, fontWeight: 400 }}>{explanation.labelEn}</span>
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <p>{renderWithGlossary(explanation.summaryKo, setActiveTerm, 'summary')}</p>

        <div className="genre-explanation-facts">
          {explanation.facts.instrumentsKo.length > 0 && (
            <div>
              <b>악기</b>
              <span>{explanation.facts.instrumentsKo.map((item, i) => (
                <span key={item}>
                  {i > 0 && ' · '}
                  {renderWithGlossary(item, setActiveTerm, `inst-${i}`)}
                </span>
              ))}</span>
            </div>
          )}
          <div><b>템포</b><span>{explanation.facts.tempoKo}</span></div>
          {explanation.facts.rhythmKo && (
            <div><b>리듬</b><span>{renderWithGlossary(explanation.facts.rhythmKo, setActiveTerm, 'rhythm')}</span></div>
          )}
          <div><b>분위기</b><span>{explanation.facts.moodKo}</span></div>
          <div><b>시대</b><span>{explanation.facts.eraKo}</span></div>
          {explanation.facts.vocalKo && <div><b>보컬</b><span>{explanation.facts.vocalKo}</span></div>}
        </div>

        <p className="genre-explanation-energy">⚡ 체감 에너지 {explanation.perceivedEnergy}단계</p>

        {activeTerm && (
          <div className="glossary-popover">
            <div className="glossary-popover-head">
              <b>{activeTerm.termKo}</b>
              <button type="button" className="icon-button" onClick={() => setActiveTerm(null)} aria-label="용어 설명 닫기">
                <X size={14} />
              </button>
            </div>
            <p>{activeTerm.explanationKo}</p>
            {activeTerm.relatedKo && <p className="supporting">{activeTerm.relatedKo}</p>}
          </div>
        )}

        <div className="button-row">
          <button type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
