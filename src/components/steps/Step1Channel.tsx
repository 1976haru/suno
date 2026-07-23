import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import { generationPacks, moodPacks } from '../../data/presets';
import {
  compactGenreTechnicalLine,
  describeGenreForUserKo,
  genreCategories,
  getCoreGenreIdsForArchetype,
  getVisibleGenresForArchetype,
  searchHiddenGenresForArchetype
} from '../../data/genreLibrary';
import { forecastCapacity } from '../../core/capacityPlanner';
import TagChips from '../TagChips';
import type { AgeGroup, ChannelArchetype, ChannelProfile, LyricLanguage, Market } from '../../types';

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

const archetypeChoices: { id: ChannelArchetype; label: string; description: string; vocal: string; moods: string[]; market: Market; audience: AgeGroup }[] = [
  {
    id: 'senior-morning',
    label: '시니어 아침 라디오',
    description: '아침 커피, 추억, 계절감 중심의 따뜻한 채널',
    vocal: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    moods: ['nostalgic', 'warm', 'hopeful'],
    market: 'korea',
    audience: 'seniors'
  },
  {
    id: 'showa-cafe',
    label: '쇼와 찻집',
    description: '차분한 일본 찻집과 절제된 복고 감성',
    vocal: 'mature soft male tenor, restrained emotional tone, warm close-mic delivery',
    moods: ['nostalgic', 'elegant', 'bittersweet'],
    market: 'japan',
    audience: 'seniors'
  },
  {
    id: 'christmas',
    label: '크리스마스',
    description: '겨울과 연말에 맞는 따뜻한 시즌 채널',
    vocal: 'warm clear vocal, soft holiday phrasing, polished but not childish',
    moods: ['christmas', 'warm', 'hopeful'],
    market: 'global',
    audience: 'allAges'
  },
  {
    id: 'lofi-study',
    label: '로파이 공부',
    description: '공부와 작업 배경에 맞는 낮은 집중감',
    vocal: 'optional soft close vocal, low-distraction delivery, calm and steady',
    moods: ['calm-focus', 'rainy-comfort', 'warm'],
    market: 'global',
    audience: 'twenties'
  },
  {
    id: 'kids',
    label: '키즈',
    description: '가족이 함께 듣기 좋은 밝고 안전한 채널',
    vocal: 'bright friendly vocal, clear pronunciation, safe family tone',
    moods: ['fresh-start', 'hopeful', 'warm'],
    market: 'global',
    audience: 'kids'
  }
];

interface Step1ChannelProps {
  editorChannel: ChannelProfile;
  isSelectedCustom: boolean;
  onUpdateField: <K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) => void;
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function Step1Channel({ editorChannel, isSelectedCustom, onUpdateField, onNew, onSave, onDelete }: Step1ChannelProps) {
  const [genreSearchOpen, setGenreSearchOpen] = useState(false);
  const [genreQuery, setGenreQuery] = useState('');
  const [genreCategoryId, setGenreCategoryId] = useState('all');
  const [songsPerWeek, setSongsPerWeek] = useState(12);
  const archetype = editorChannel.archetype || 'senior-morning';
  const capacityForecast = useMemo(
    () => forecastCapacity(archetype, editorChannel.primaryLanguage, songsPerWeek),
    [archetype, editorChannel.primaryLanguage, songsPerWeek]
  );
  const visibleGenres = useMemo(
    () => getVisibleGenresForArchetype(archetype, editorChannel.preferredGenres),
    [archetype, editorChannel.preferredGenres]
  );
  const hiddenGenres = useMemo(() => searchHiddenGenresForArchetype(archetype, genreQuery, genreCategoryId), [archetype, genreCategoryId, genreQuery]);

  function toggleId(key: 'preferredGenres' | 'preferredMoods', id: string) {
    const current = editorChannel[key];
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
    onUpdateField(key, next);
  }

  function applyArchetype(archetypeId: ChannelArchetype) {
    const defaults = archetypeChoices.find(choice => choice.id === archetypeId) || archetypeChoices[0];
    const genreIds = getCoreGenreIdsForArchetype(archetypeId).slice(0, 3);
    onUpdateField('archetype', archetypeId);
    onUpdateField('market', defaults.market);
    onUpdateField('audience', defaults.audience);
    onUpdateField('defaultVocal', defaults.vocal);
    onUpdateField('preferredGenres', genreIds);
    onUpdateField('preferredMoods', defaults.moods);
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

      <div className="option-block">
        <h3>어떤 채널인가요?</h3>
        <div className="genre-card-grid">
          {archetypeChoices.map(choice => (
            <button
              type="button"
              key={choice.id}
              className={archetype === choice.id ? 'genre-card-choice active' : 'genre-card-choice'}
              onClick={() => applyArchetype(choice.id)}
            >
              <span className="genre-card-title">{choice.label}</span>
              <span>{choice.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="option-block capacity-forecast">
        <h3>이 채널, 얼마나 오래 로컬 모드만으로 버틸까요?</h3>
        <div className="form-grid two">
          <div>
            <label>주당 생성 곡 수 (songs/week)</label>
            <input
              type="number"
              min={1}
              max={400}
              value={songsPerWeek}
              onChange={event => setSongsPerWeek(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        </div>
        <p className="supporting">
          {Number.isFinite(capacityForecast.weeksAtCurrentPace)
            ? `이 채널을 주 ${songsPerWeek}곡씩 운영하면 로컬 모드만으로 약 ${capacityForecast.weeksAtCurrentPace}주(${Math.round(capacityForecast.weeksAtCurrentPace / 4.3)}개월) 동안 훅이 겹치지 않습니다. 그 이후엔 풀을 늘리거나 API 연결을 고려하세요.`
            : '주당 곡 수를 입력하면 예상 소진 시점을 계산합니다.'}
        </p>
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
        <p className="supporting">현재 아키타입에 맞는 core 장르만 먼저 보여줍니다. 나머지는 더 찾기에서 추가하세요.</p>
        <div className="genre-card-grid">
          {visibleGenres.map(genre => (
            <button
              type="button"
              key={genre.id}
              className={editorChannel.preferredGenres.includes(genre.id) ? 'genre-card-choice active' : 'genre-card-choice'}
              onClick={() => toggleId('preferredGenres', genre.id)}
            >
              <span className="genre-card-title">{genre.label}</span>
              <span>{describeGenreForUserKo(genre)}</span>
              <small>{compactGenreTechnicalLine(genre)}</small>
            </button>
          ))}
        </div>
        <button type="button" className="genre-search-toggle" onClick={() => setGenreSearchOpen(open => !open)}>
          <Search size={16} />
          더 찾기 ({hiddenGenres.length}개)
          {genreSearchOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {genreSearchOpen && (
          <>
            <div className="genre-toolbar">
              <div className="genre-search">
                <Search size={16} />
                <input value={genreQuery} onChange={event => setGenreQuery(event.target.value)} placeholder="Search hidden genres" />
              </div>
              <select value={genreCategoryId} onChange={event => setGenreCategoryId(event.target.value)}>
                <option value="all">All hidden categories</option>
                {genreCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </div>
            <div className="chips genre-chip-list">
              {hiddenGenres.map(genre => (
                <button
                  type="button"
                  key={genre.id}
                  className={editorChannel.preferredGenres.includes(genre.id) ? 'chip active' : 'chip'}
                  onClick={() => toggleId('preferredGenres', genre.id)}
                  title={describeGenreForUserKo(genre)}
                >
                  {genre.label}
                </button>
              ))}
            </div>
          </>
        )}
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
