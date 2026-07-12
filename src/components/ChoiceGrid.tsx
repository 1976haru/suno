import { useState } from 'react';
import { Check, Info } from 'lucide-react';

export interface Choice {
  id: string;
  label: string;
  sublabel?: string;
  description: string;
  example?: string;
  icon?: string;
  recommended?: boolean;
  /** Extra detail hidden behind a small "자세히" toggle (e.g. the raw chord notation). */
  detail?: string;
}

interface ChoiceGridProps {
  question: string;
  helper?: string;
  choices: Choice[];
  value: string | string[];
  multiple?: boolean;
  onChange: (value: string | string[]) => void;
  columns?: 2 | 3 | 4;
}

function isSelected(value: string | string[], id: string): boolean {
  return Array.isArray(value) ? value.includes(id) : value === id;
}

export default function ChoiceGrid({ question, helper, choices, value, multiple, onChange, columns = 3 }: ChoiceGridProps) {
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  function handleClick(id: string) {
    if (multiple && Array.isArray(value)) {
      const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id];
      onChange(next);
    } else {
      onChange(id);
    }
  }

  return (
    <div className="choice-grid-block">
      <p className="choice-question">{question}</p>
      {helper && <p className="supporting">{helper}</p>}
      <div className={`choice-grid choice-grid-${columns}`}>
        {choices.map(choice => {
          const active = isSelected(value, choice.id);
          return (
            <button
              type="button"
              key={choice.id}
              className={active ? 'choice-card active' : 'choice-card'}
              onClick={() => handleClick(choice.id)}
            >
              <div className="choice-card-head">
                <span className="choice-card-title">
                  {choice.icon && <span className="choice-card-icon">{choice.icon}</span>}
                  {choice.label}
                </span>
                {active && <Check size={16} className="choice-card-check" />}
                {choice.recommended && <span className="choice-badge">추천</span>}
              </div>
              {choice.sublabel && <span className="choice-card-sublabel">{choice.sublabel}</span>}
              <p className="choice-card-description">{choice.description}</p>
              {choice.example && <p className="choice-card-example">예) {choice.example}</p>}
              {choice.detail && (
                <span
                  className="choice-card-detail-toggle"
                  role="button"
                  tabIndex={0}
                  onClick={event => {
                    event.stopPropagation();
                    setOpenDetail(prev => (prev === choice.id ? null : choice.id));
                  }}
                >
                  <Info size={12} /> {openDetail === choice.id ? '접기' : '자세히'}
                </span>
              )}
              {choice.detail && openDetail === choice.id && (
                <span className="choice-card-detail">{choice.detail}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
