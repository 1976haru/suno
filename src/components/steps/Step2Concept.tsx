import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Wand2 } from 'lucide-react';
import { generationPacks, genrePacks, moodPacks, seasonPacks } from '../../data/presets';
import { genreCategories, getGenreById } from '../../data/genreLibrary';
import { genreLabelsKo, moodLabelsKo, seasonLabelsKo } from '../../data/koreanLabels';
import { vocalPresets, matchVocalPreset } from '../../data/vocalPresets';
import { avoidWordPresets, joinAvoidWords, parseAvoidWords } from '../../data/avoidWordPresets';
import { isPlausibleChordProgression, moneyChordPresets } from '../../data/moneyChords';
import { MAX_SELECTED_GENRES } from '../../core/genreSelection';
import { resolveMoneyChordText } from '../../core/promptComposer';
import ChoiceGrid from '../ChoiceGrid';
import type { GenerationOptions, GenrePack, MoodPack, SeasonPack, LyricLanguage } from '../../types';

const languageOptions: { value: LyricLanguage; label: string; sub: string }[] = [
  { value: 'english', label: '영어', sub: 'English' },
  { value: 'korean', label: '한국어', sub: 'Korean' },
  { value: 'japanese', label: '일본어', sub: 'Japanese' },
  { value: 'bilingual', label: '영어+한국어 혼합', sub: 'Bilingual' }
];

const CONCEPT_EXAMPLE_CHIPS = ['아침 커피 한 잔', '창밖의 첫눈', '오래된 라디오', '연말 편지', '산책길 낙엽', '크리스마스 이브', '옛 친구 생각'];

const DURATION_CHOICES = [
  { id: 'under3m30', label: '표준 (권장)', sublabel: '3:10 - 3:35', description: '가장 무난한 표준 길이예요. 처음이라면 이걸 고르세요.', recommended: true },
  { id: 'under4m', label: '조금 여유있게', sublabel: '4:00 이내', description: '이야기를 조금 더 담고 싶을 때 좋아요.' },
  { id: 'playlistShort', label: '짧게', sublabel: '2:50 - 3:20', description: '플레이리스트에 여러 곡을 빠르게 채울 때 좋아요.' }
];

const DEPTH_CHOICES = [
  { id: 'commercial', label: '가벼운 상업용', sublabel: 'Commercial', description: '누구나 쉽게 따라 부를 수 있는 편안한 가사예요.', example: '"창가에 앉아 커피를 마셔요"', recommended: true },
  { id: 'simple', label: '아주 단순하게', sublabel: 'Simple', description: '짧고 쉬운 문장 위주예요.' },
  { id: 'literary', label: '문학적으로', sublabel: 'Literary', description: '조금 더 섬세하고 시적인 표현을 써요.' },
  { id: 'poetic', label: '시적으로 깊게', sublabel: 'Poetic', description: '은유가 많고 여운이 깊은 가사예요.' }
];

const PERSPECTIVE_CHOICES = [
  { id: 'firstPerson', label: '나의 이야기 (1인칭)', sublabel: 'First person', description: '"나는 ~해요"처럼 화자 본인의 시선이에요.', recommended: true },
  { id: 'secondPerson', label: '당신에게 (2인칭)', sublabel: 'Second person', description: '"당신은 ~해요"처럼 듣는 사람에게 말을 거는 느낌이에요.' },
  { id: 'thirdPerson', label: '그 사람 이야기 (3인칭)', sublabel: 'Third person', description: '제3자의 이야기를 들려주는 느낌이에요.' },
  { id: 'radioHost', label: '라디오 DJ처럼', sublabel: 'Radio host', description: '라디오 진행자가 청취자에게 말하는 느낌이에요.' }
];

interface Step2ConceptProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  selectedGenres: GenrePack[];
  selectedMoods: MoodPack[];
  selectedSeason: SeasonPack;
  toggleArray: (key: 'genreIds' | 'moodIds', id: string) => void;
}

export default function Step2Concept({ opts, setOpts, selectedGenres, selectedMoods, selectedSeason, toggleArray }: Step2ConceptProps) {
  const [vocalCustomOpen, setVocalCustomOpen] = useState(() => !matchVocalPreset(opts.vocalTone));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customChordOpen, setCustomChordOpen] = useState(opts.moneyChordMode === 'custom');
  const [avoidCustomDraft, setAvoidCustomDraft] = useState('');
  const [genreQuery, setGenreQuery] = useState('');
  const [genreCategoryId, setGenreCategoryId] = useState('all');

  const selectedGenerationPack = generationPacks.find(pack => pack.id === opts.audience);
  const moneyPreview = resolveMoneyChordText(opts);
  const avoidList = parseAvoidWords(opts.avoidWords);
  const presetPhrases = new Set(avoidWordPresets.map(preset => preset.phrase));
  const customAvoidTerms = avoidList.filter(term => !presetPhrases.has(term));
  const selectedGenreDetails = selectedGenres.map(genre => getGenreById(genre.id) || genre);
  const filteredGenres = useMemo(() => {
    const query = genreQuery.trim().toLowerCase();
    return genrePacks.filter(genre => {
      const detail = getGenreById(genre.id) || genre;
      const categoryMatches = genreCategoryId === 'all' || detail.categoryId === genreCategoryId;
      if (!categoryMatches) return false;
      if (!query) return true;
      const haystack = [
        detail.label,
        detail.styleCore,
        detail.shortPrompt,
        detail.productionGuidance,
        ...(detail.aliases || []),
        ...(detail.instruments || []),
        ...(detail.moods || [])
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [genreCategoryId, genreQuery]);

  function toggleAvoidPreset(phrase: string) {
    const next = avoidList.includes(phrase) ? avoidList.filter(term => term !== phrase) : [...avoidList, phrase];
    setOpts(prev => ({ ...prev, avoidWords: joinAvoidWords(next) }));
  }

  function addCustomAvoidTerm() {
    const term = avoidCustomDraft.trim();
    if (!term || avoidList.includes(term)) return;
    setOpts(prev => ({ ...prev, avoidWords: joinAvoidWords([...avoidList, term]) }));
    setAvoidCustomDraft('');
  }

  function removeAvoidTerm(term: string) {
    setOpts(prev => ({ ...prev, avoidWords: joinAvoidWords(avoidList.filter(item => item !== term)) }));
  }

  const moneyChordChoices = Object.values(moneyChordPresets)
    .filter(preset => preset.id !== 'custom')
    .map(preset => ({
      id: preset.id,
      label: preset.labelKo,
      sublabel: preset.label,
      description: preset.description,
      example: `어울리는 곡: ${preset.bestFor.join(', ')}`,
      icon: '🎵',
      recommended: preset.id === 'default',
      detail: preset.progressions.length ? `코드: ${preset.progressions.join(' / ')}` : undefined
    }));

  return (
    <section className="panel">
      <p className="step-hint">이 채널의 곡이 어떤 느낌이면 좋을지 정하세요. 아무것도 모르셔도 괜찮아요 — 카드를 눌러보고 마음에 드는 걸 고르시면 됩니다.</p>

      <label>Project title (프로젝트 제목)</label>
      <input value={opts.projectTitle} onChange={event => setOpts(prev => ({ ...prev, projectTitle: event.target.value }))} />

      <div className="option-block">
        <h3>어떤 계절 분위기로 만들까요?</h3>
        <div className="chips">
          {seasonPacks.map(season => (
            <button
              type="button"
              key={season.id}
              className={opts.seasonId === season.id ? 'chip active' : 'chip'}
              title={season.period}
              onClick={() => setOpts(prev => ({ ...prev, seasonId: season.id }))}
            >
              {seasonLabelsKo[season.id] || season.label}
            </button>
          ))}
        </div>
      </div>

      <div className="option-block">
        <h3>어떤 장르를 만들까요? (여러 개 선택 가능) *</h3>
        <div className="genre-toolbar">
          <div className="genre-search">
            <Search size={16} />
            <input value={genreQuery} onChange={event => setGenreQuery(event.target.value)} placeholder="Search genres, instruments, moods" />
          </div>
          <select value={genreCategoryId} onChange={event => setGenreCategoryId(event.target.value)}>
            <option value="all">All categories</option>
            {genreCategories.map(category => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </div>
        <p className="supporting">Main genre: {selectedGenreDetails[0]?.label || 'none'} / Secondary: {selectedGenreDetails.slice(1).map(g => g.label).join(', ') || 'none'} ({opts.genreIds.length}/{MAX_SELECTED_GENRES})</p>
        <div className="chips genre-chip-list">
          {filteredGenres.map(genre => {
            const selectedIndex = opts.genreIds.indexOf(genre.id);
            const selected = selectedIndex >= 0;
            const role = selected ? (selectedIndex === 0 ? 'Main' : `Sub ${selectedIndex}`) : '';
            return (
              <button
                type="button"
                key={genre.id}
                className={selected ? 'chip active' : 'chip'}
                disabled={!selected && opts.genreIds.length >= MAX_SELECTED_GENRES}
                onClick={() => toggleArray('genreIds', genre.id)}
                title={selected ? role : undefined}
              >
                {role && <span className="genre-role">{role}</span>}
                {genreLabelsKo[genre.id] || genre.label}
              </button>
            );
          })}
        </div>
        {filteredGenres.length === 0 && <p className="supporting">No matching genres.</p>}
        {selectedGenreDetails.length > 0 && (
          <div className="genre-preview-grid">
            {selectedGenreDetails.map((genre, index) => (
              <div key={genre.id} className="genre-preview-card">
                <div className="genre-preview-head">
                  <span className="genre-role">{index === 0 ? 'Main' : `Sub ${index}`}</span>
                  <h4>{genre.label}</h4>
                  {genre.categoryId && <span className="supporting">{genre.categoryId}</span>}
                </div>
                <p><b>Suno short prompt</b><span>{genre.shortPrompt || genre.styleCore}</span></p>
                {genre.productionGuidance && <p><b>Detailed production</b><span>{genre.productionGuidance}</span></p>}
                <div className="genre-detail-list">
                  <span><b>Rhythm</b>{genre.rhythm?.join(', ') || '-'}</span>
                  <span><b>Instruments</b>{genre.instruments.join(', ')}</span>
                  <span><b>Vocal</b>{genre.vocal?.join(', ') || '-'}</span>
                  <span><b>Production</b>{genre.production?.join(', ') || '-'}</span>
                  <span><b>Harmony</b>{genre.harmony?.join(', ') || '-'}</span>
                  <span><b>Tempo</b>{(genre.tempo || genre.tempoRange).join('-')} BPM</span>
                  <span><b>Moods</b>{genre.moods?.join(', ') || '-'}</span>
                  <span><b>Audience</b>{genre.audiences?.join(', ') || genre.goodFor.join(', ')}</span>
                  <span><b>Avoid</b>{genre.avoidTraits?.join(', ') || '-'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="option-block">
        <h3>어떤 분위기로 만들까요? (여러 개 선택 가능) *</h3>
        <div className="chips">
          {moodPacks.map(mood => (
            <button
              type="button"
              key={mood.id}
              className={opts.moodIds.includes(mood.id) ? 'chip active' : 'chip'}
              onClick={() => toggleArray('moodIds', mood.id)}
            >
              {moodLabelsKo[mood.id] || mood.label}
            </button>
          ))}
        </div>
      </div>

      {selectedGenerationPack && <p className="supporting">{selectedGenerationPack.audienceNote}</p>}

      <ChoiceGrid
        question="어떤 목소리로 부를까요?"
        choices={vocalPresets.map(preset => ({ id: preset.id, label: preset.label, sublabel: preset.sublabel, description: preset.description, icon: '🎙' }))}
        value={vocalCustomOpen ? '' : (matchVocalPreset(opts.vocalTone)?.id ?? '')}
        onChange={value => {
          const preset = vocalPresets.find(p => p.id === value);
          if (preset) {
            setVocalCustomOpen(false);
            setOpts(prev => ({ ...prev, vocalTone: preset.prompt }));
          }
        }}
        columns={3}
      />
      <div className="button-row" style={{ marginTop: 8 }}>
        <button type="button" className={vocalCustomOpen ? 'chip active' : 'chip'} onClick={() => setVocalCustomOpen(v => !v)}>
          ✏️ 직접 입력하기
        </button>
      </div>
      {vocalCustomOpen && (
        <input
          value={opts.vocalTone}
          onChange={event => setOpts(prev => ({ ...prev, vocalTone: event.target.value }))}
          placeholder="예: mature soulful male tenor, soft slightly husky"
          style={{ marginTop: 8 }}
        />
      )}

      <ChoiceGrid
        question="머니코드 (money chord, 익숙한 팝송 흐름)를 골라주세요"
        helper="머니코드는 사람들이 편안하게 느끼는 코드 진행이에요. 잘 모르겠으면 추천 카드를 고르세요."
        choices={moneyChordChoices}
        value={opts.moneyChordMode === 'custom' ? '' : opts.moneyChordMode}
        onChange={value => setOpts(prev => ({ ...prev, moneyChordMode: value as GenerationOptions['moneyChordMode'] }))}
        columns={3}
      />
      <p className="supporting">스타일 프롬프트 미리보기: <em>money chord foundation: {moneyPreview}</em></p>

      <div className="option-block">
        <h3>가사에서 피할 것들 (기본값 권장)</h3>
        <div className="avoid-word-list">
          {avoidWordPresets.map(preset => (
            <label key={preset.id} className="avoid-word-item">
              <input type="checkbox" checked={avoidList.includes(preset.phrase)} onChange={() => toggleAvoidPreset(preset.phrase)} />
              {preset.label}
              {preset.note && <span className="supporting"> — {preset.note}</span>}
            </label>
          ))}
        </div>
        {customAvoidTerms.length > 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            {customAvoidTerms.map(term => (
              <button type="button" key={term} className="chip active" onClick={() => removeAvoidTerm(term)}>
                {term} ×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="option-block">
        <h3>어떤 이야기를 담고 싶으세요? (선택 사항 — 비워두셔도 됩니다)</h3>
        <p className="supporting">자주 쓰는 주제:</p>
        <div className="chips">
          {CONCEPT_EXAMPLE_CHIPS.map(chip => (
            <button
              type="button"
              key={chip}
              className="chip"
              onClick={() => setOpts(prev => ({ ...prev, customConcept: prev.customConcept ? `${prev.customConcept}, ${chip}` : chip }))}
            >
              {chip}
            </button>
          ))}
        </div>
        <textarea
          value={opts.customConcept}
          onChange={event => setOpts(prev => ({ ...prev, customConcept: event.target.value }))}
          placeholder="칩을 누르면 여기 채워집니다"
          style={{ marginTop: 8 }}
        />
      </div>

      <button type="button" className="full-width" onClick={() => setAdvancedOpen(v => !v)}>
        {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        ⚙️ 고급 설정 {advancedOpen ? '접기' : '펼치기'}
      </button>

      {advancedOpen && (
        <div className="advanced-settings">
          <label>Lyrics language (가사 언어)</label>
          <div className="chips">
            {languageOptions.map(option => (
              <button
                type="button"
                key={option.value}
                className={opts.lyricLanguage === option.value ? 'chip active' : 'chip'}
                onClick={() => setOpts(prev => ({ ...prev, lyricLanguage: option.value }))}
              >
                {option.label} <span className="supporting">({option.sub})</span>
              </button>
            ))}
          </div>

          <ChoiceGrid
            question="곡 길이"
            choices={DURATION_CHOICES}
            value={opts.durationTarget}
            onChange={value => setOpts(prev => ({ ...prev, durationTarget: value as GenerationOptions['durationTarget'] }))}
            columns={3}
          />

          <ChoiceGrid
            question="가사 깊이"
            choices={DEPTH_CHOICES}
            value={opts.lyricDepth}
            onChange={value => setOpts(prev => ({ ...prev, lyricDepth: value as GenerationOptions['lyricDepth'] }))}
            columns={4}
          />

          <ChoiceGrid
            question="가사의 시점"
            choices={PERSPECTIVE_CHOICES}
            value={opts.perspective}
            onChange={value => setOpts(prev => ({ ...prev, perspective: value as GenerationOptions['perspective'] }))}
            columns={4}
          />

          <div className="option-block">
            <h3>머니코드 직접 입력 (로마숫자 코드 표기를 아는 경우만)</h3>
            <button type="button" className={customChordOpen ? 'chip active' : 'chip'} onClick={() => setCustomChordOpen(v => !v)}>
              ✏️ 코드 진행 직접 입력하기
            </button>
            {customChordOpen && (
              <>
                <input
                  value={opts.customMoneyChord}
                  onChange={event => setOpts(prev => ({ ...prev, moneyChordMode: 'custom', customMoneyChord: event.target.value }))}
                  placeholder="예: I-V-vi-IV / vi-IV-I-V / IVmaj7-iii7-vi7"
                  style={{ marginTop: 8 }}
                />
                {opts.customMoneyChord.trim() && !isPlausibleChordProgression(opts.customMoneyChord) && (
                  <p className="supporting">⚠ 로마숫자 코드 표기(I, ii, IV, vii°, maj7 등)를 권장하지만, 이대로도 생성은 진행돼요.</p>
                )}
              </>
            )}
          </div>

          <div className="option-block">
            <h3>피할 단어 직접 추가</h3>
            <div className="inline">
              <input
                value={avoidCustomDraft}
                onChange={event => setAvoidCustomDraft(event.target.value)}
                placeholder="직접 추가할 단어나 표현"
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomAvoidTerm();
                  }
                }}
              />
              <button type="button" onClick={addCustomAvoidTerm}>추가</button>
            </div>
          </div>
        </div>
      )}

      <p className="supporting">
        <Wand2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        현재 선택: {selectedGenres.map(g => genreLabelsKo[g.id] || g.label).join(', ') || '없음'} / {selectedMoods.map(m => moodLabelsKo[m.id] || m.label).join(', ') || '없음'} / {seasonLabelsKo[selectedSeason.id] || selectedSeason.label}
      </p>
    </section>
  );
}
