import { Wand2 } from 'lucide-react';
import { generationPacks, genrePacks, moodPacks, seasonPacks } from '../../data/presets';
import { isPlausibleChordProgression, moneyChordPresets } from '../../data/moneyChords';
import { resolveMoneyChordText } from '../../core/promptComposer';
import type { GenerationOptions, GenrePack, MoodPack, SeasonPack, LyricLanguage } from '../../types';

const languageOptions: { value: LyricLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'korean', label: 'Korean' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'bilingual', label: 'Bilingual' }
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
  const selectedGenerationPack = generationPacks.find(pack => pack.id === opts.audience);
  const moneyPreview = resolveMoneyChordText(opts);

  return (
    <section className="panel">
      <p className="step-hint">이 채널의 곡이 어떤 느낌이면 좋을지 정하세요. 장르, 무드, 시즌, 머니코드가 실제 프롬프트에 그대로 반영됩니다.</p>

      <div className="form-grid four">
        <div>
          <label>Project title (프로젝트 제목)</label>
          <input value={opts.projectTitle} onChange={event => setOpts(prev => ({ ...prev, projectTitle: event.target.value }))} />
        </div>
        <div>
          <label>Lyrics language (가사 언어)</label>
          <select value={opts.lyricLanguage} onChange={event => setOpts(prev => ({ ...prev, lyricLanguage: event.target.value as LyricLanguage }))}>
            {languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label>Season pack (시즌)</label>
          <select value={opts.seasonId} onChange={event => setOpts(prev => ({ ...prev, seasonId: event.target.value }))}>
            {seasonPacks.map(season => <option key={season.id} value={season.id}>{season.label}</option>)}
          </select>
        </div>
        <div>
          <label>Length control (곡 길이)</label>
          <select value={opts.durationTarget} onChange={event => setOpts(prev => ({ ...prev, durationTarget: event.target.value as GenerationOptions['durationTarget'] }))}>
            <option value="under3m30">3:10-3:35</option>
            <option value="under4m">Under 4:00</option>
            <option value="playlistShort">2:50-3:20</option>
          </select>
        </div>
        <div>
          <label>Lyric depth (가사 깊이)</label>
          <select value={opts.lyricDepth} onChange={event => setOpts(prev => ({ ...prev, lyricDepth: event.target.value as GenerationOptions['lyricDepth'] }))}>
            <option value="commercial">Commercial</option>
            <option value="simple">Simple</option>
            <option value="literary">Literary</option>
            <option value="poetic">Poetic</option>
          </select>
        </div>
      </div>

      {selectedGenerationPack && <p className="supporting">{selectedGenerationPack.audienceNote}</p>}

      <div className="option-block">
        <h3>Genre packs (장르) *</h3>
        <div className="chips">
          {genrePacks.map(genre => (
            <button
              type="button"
              key={genre.id}
              className={opts.genreIds.includes(genre.id) ? 'chip active' : 'chip'}
              onClick={() => toggleArray('genreIds', genre.id)}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>

      <div className="option-block">
        <h3>Mood packs (무드) *</h3>
        <div className="chips">
          {moodPacks.map(mood => (
            <button
              type="button"
              key={mood.id}
              className={opts.moodIds.includes(mood.id) ? 'chip active' : 'chip'}
              onClick={() => toggleArray('moodIds', mood.id)}
            >
              {mood.label}
            </button>
          ))}
        </div>
      </div>

      <div className="option-block">
        <h3>Money chords (머니코드)</h3>
        <div className="money-chord-grid">
          {Object.values(moneyChordPresets).map(preset => (
            <button
              type="button"
              key={preset.id}
              className={opts.moneyChordMode === preset.id ? 'money-chord-card active' : 'money-chord-card'}
              onClick={() => setOpts(prev => ({ ...prev, moneyChordMode: preset.id as GenerationOptions['moneyChordMode'] }))}
            >
              <b>{preset.labelKo}</b>
              <span className="supporting">{preset.label}</span>
              <span className="supporting">{preset.progressions.join(' / ') || '직접 입력'}</span>
              <p>{preset.description}</p>
              <span className="supporting">어울리는 곡: {preset.bestFor.join(', ')}</span>
            </button>
          ))}
        </div>
        {opts.moneyChordMode === 'custom' && (
          <>
            <input
              value={opts.customMoneyChord}
              onChange={event => setOpts(prev => ({ ...prev, customMoneyChord: event.target.value }))}
              placeholder="예: I-V-vi-IV / vi-IV-I-V / IVmaj7-iii7-vi7"
            />
            {opts.customMoneyChord.trim() && !isPlausibleChordProgression(opts.customMoneyChord) && (
              <p className="supporting">⚠ 로마숫자 코드 표기(I, ii, IV, vii°, maj7 등)를 권장하지만, 이대로도 생성은 진행돼요.</p>
            )}
          </>
        )}
        <p className="supporting">스타일 프롬프트 미리보기: <em>money chord foundation: {moneyPreview}</em></p>
      </div>

      <div className="form-grid two">
        <div>
          <label>Vocal tone (보컬 톤)</label>
          <input value={opts.vocalTone} onChange={event => setOpts(prev => ({ ...prev, vocalTone: event.target.value }))} />
        </div>
        <div>
          <label>Avoid words / risk terms (피할 단어)</label>
          <input value={opts.avoidWords} onChange={event => setOpts(prev => ({ ...prev, avoidWords: event.target.value }))} placeholder="artist names, song titles, risky imitation phrases" />
        </div>
      </div>

      <label>Custom concept (커스텀 컨셉)</label>
      <textarea value={opts.customConcept} onChange={event => setOpts(prev => ({ ...prev, customConcept: event.target.value }))} placeholder="Playlist angle, listener situation, upload theme, or thumbnail direction" />

      <p className="supporting">
        <Wand2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        현재 선택: {selectedGenres.map(g => g.label).join(', ') || '없음'} / {selectedMoods.map(m => m.label).join(', ') || '없음'} / {selectedSeason.label}
      </p>
    </section>
  );
}
