import { Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { generationPacks, genrePacks, moodPacks } from '../../data/presets';
import TagChips from '../TagChips';
import type { AgeGroup, ChannelProfile, LyricLanguage, Market } from '../../types';

const marketOptions: { value: Market; label: string }[] = [
  { value: 'korea', label: 'Korea' },
  { value: 'japan', label: 'Japan' },
  { value: 'global', label: 'Global' },
  { value: 'custom', label: 'Custom' }
];

const languageOptions: { value: LyricLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'korean', label: 'Korean' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'bilingual', label: 'Bilingual' }
];

const SEO_KEYWORD_SUGGESTIONS = ['감성 플레이리스트', '60대 음악', '계절 플레이리스트', '카페 음악', '드라이브 음악'];
const CLICHE_SUGGESTIONS = ['famous artist imitation', 'copied song structure', 'childish lyrics', 'dramatic power ballad shouting'];

interface Step1ChannelProps {
  editorChannel: ChannelProfile;
  isSelectedCustom: boolean;
  onUpdateField: <K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) => void;
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function Step1Channel({ editorChannel, isSelectedCustom, onUpdateField, onNew, onSave, onDelete }: Step1ChannelProps) {
  function toggleId(key: 'preferredGenres' | 'preferredMoods', id: string) {
    const current = editorChannel[key];
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
    onUpdateField(key, next);
  }

  return (
    <section className="panel profile-editor">
      <p className="step-hint">먼저 어떤 채널의 곡을 만들지 고르세요. 채널마다 목소리와 분위기가 저장됩니다.</p>

      <div className="panel-header">
        <div className="panel-title">
          <Sparkles size={18} />
          <h2>Channel Profile Editor (채널 프로필)</h2>
        </div>
        <div className="button-row">
          <button type="button" onClick={onNew}>
            <Plus size={16} />
            New
          </button>
          <button type="button" onClick={onSave}>
            <Save size={16} />
            Save
          </button>
          <button type="button" disabled={!isSelectedCustom} onClick={onDelete}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      <div className="form-grid three">
        <div>
          <label>Name (채널명)</label>
          <input value={editorChannel.name} onChange={event => onUpdateField('name', event.target.value)} />
        </div>
        <div>
          <label>English name</label>
          <input value={editorChannel.englishName || ''} onChange={event => onUpdateField('englishName', event.target.value)} />
        </div>
        <div>
          <label>Market (시장)</label>
          <select value={editorChannel.market} onChange={event => onUpdateField('market', event.target.value as Market)}>
            {marketOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label>Primary language (기본 언어)</label>
          <select value={editorChannel.primaryLanguage} onChange={event => onUpdateField('primaryLanguage', event.target.value as LyricLanguage)}>
            {languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label>Generation pack (타겟 연령대)</label>
          <select value={editorChannel.audience} onChange={event => onUpdateField('audience', event.target.value as AgeGroup)}>
            {generationPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.label}</option>)}
          </select>
        </div>
        <div>
          <label>Default vocal (기본 보컬 톤)</label>
          <input value={editorChannel.defaultVocal} onChange={event => onUpdateField('defaultVocal', event.target.value)} />
        </div>
      </div>

      <div className="form-grid two">
        <div>
          <label>Channel promise (채널 약속)</label>
          <textarea value={editorChannel.promise} onChange={event => onUpdateField('promise', event.target.value)} />
        </div>
        <div>
          <label>Visual identity (시각 아이덴티티)</label>
          <textarea value={editorChannel.visualIdentity} onChange={event => onUpdateField('visualIdentity', event.target.value)} />
        </div>
      </div>

      <div className="option-block">
        <h3>Preferred genres (선호 장르)</h3>
        <div className="chips">
          {genrePacks.map(genre => (
            <button
              type="button"
              key={genre.id}
              className={editorChannel.preferredGenres.includes(genre.id) ? 'chip active' : 'chip'}
              onClick={() => toggleId('preferredGenres', genre.id)}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>

      <div className="option-block">
        <h3>Preferred moods (선호 무드)</h3>
        <div className="chips">
          {moodPacks.map(mood => (
            <button
              type="button"
              key={mood.id}
              className={editorChannel.preferredMoods.includes(mood.id) ? 'chip active' : 'chip'}
              onClick={() => toggleId('preferredMoods', mood.id)}
            >
              {mood.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid two">
        <TagChips
          label="Forbidden cliches (금지 클리셰)"
          values={editorChannel.forbiddenCliches}
          onChange={next => onUpdateField('forbiddenCliches', next)}
          suggestions={CLICHE_SUGGESTIONS}
          placeholder="직접 추가"
        />
        <TagChips
          label="SEO keywords (SEO 키워드)"
          values={editorChannel.seoKeywords}
          onChange={next => onUpdateField('seoKeywords', next)}
          suggestions={SEO_KEYWORD_SUGGESTIONS}
          placeholder="직접 추가"
        />
      </div>
    </section>
  );
}
