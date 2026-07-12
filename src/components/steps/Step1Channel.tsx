import { Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { generationPacks } from '../../data/presets';
import { formatList } from '../../utils/channelProfile';
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

interface Step1ChannelProps {
  editorChannel: ChannelProfile;
  isSelectedCustom: boolean;
  onUpdateField: <K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) => void;
  onUpdateList: (key: 'preferredGenres' | 'preferredMoods' | 'forbiddenCliches' | 'seoKeywords', value: string) => void;
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function Step1Channel({ editorChannel, isSelectedCustom, onUpdateField, onUpdateList, onNew, onSave, onDelete }: Step1ChannelProps) {
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

      <div className="form-grid two">
        <div>
          <label>Preferred genre ids</label>
          <textarea value={formatList(editorChannel.preferredGenres)} onChange={event => onUpdateList('preferredGenres', event.target.value)} />
        </div>
        <div>
          <label>Preferred mood ids</label>
          <textarea value={formatList(editorChannel.preferredMoods)} onChange={event => onUpdateList('preferredMoods', event.target.value)} />
        </div>
        <div>
          <label>Forbidden cliches (금지 클리셰)</label>
          <textarea value={formatList(editorChannel.forbiddenCliches)} onChange={event => onUpdateList('forbiddenCliches', event.target.value)} />
        </div>
        <div>
          <label>SEO keywords</label>
          <textarea value={formatList(editorChannel.seoKeywords)} onChange={event => onUpdateList('seoKeywords', event.target.value)} />
        </div>
      </div>
    </section>
  );
}
