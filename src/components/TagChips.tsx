import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface TagChipsProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export default function TagChips({ label, values, onChange, suggestions, placeholder }: TagChipsProps) {
  const [draft, setDraft] = useState('');

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || values.includes(tag)) return;
    onChange([...values, tag]);
  }

  function removeTag(tag: string) {
    onChange(values.filter(v => v !== tag));
  }

  const remainingSuggestions = (suggestions || []).filter(s => !values.includes(s));

  return (
    <div>
      <label>{label}</label>
      <div className="chips">
        {values.map(tag => (
          <button type="button" key={tag} className="chip active" onClick={() => removeTag(tag)}>
            {tag} <X size={12} />
          </button>
        ))}
      </div>
      <div className="inline" style={{ marginTop: 8 }}>
        <input
          value={draft}
          placeholder={placeholder}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTag(draft);
              setDraft('');
            }
          }}
        />
        <button
          type="button"
          className="icon-button"
          title="추가"
          onClick={() => {
            addTag(draft);
            setDraft('');
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      {remainingSuggestions.length > 0 && (
        <>
          <p className="supporting" style={{ marginTop: 8 }}>추천 (누르면 추가):</p>
          <div className="chips">
            {remainingSuggestions.map(tag => (
              <button type="button" key={tag} className="chip" onClick={() => addTag(tag)}>
                + {tag}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
