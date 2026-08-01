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
import { scopedKey } from '../../core/workspaceScope';
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

const archetypeChoices: { id: ChannelArchetype; label: string; description: string; vocal: string; moods: string[]; market: Market; audience: AgeGroup; primaryLanguage: LyricLanguage }[] = [
  {
    id: 'senior-morning',
    label: '시니어 아침 라디오',
    description: '아침 커피, 추억, 계절감 중심의 따뜻한 채널',
    vocal: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    moods: ['nostalgic', 'warm', 'hopeful'],
    market: 'korea',
    audience: 'seniors',
    primaryLanguage: 'english'
  },
  {
    // TASK v3.63 (TASK A) — senior-morning's 40-genre exposure (v3.61 TASK B)
    // was never mirrored to any other archetype, so a channel built for
    // "60s-80s Western old-pop" specifically (as opposed to senior-morning's
    // broader "warm senior radio" framing) had no card of its own and no
    // way to reach the oldpop-* family unless it happened to land on
    // senior-morning. See data/genreLibrary/index.ts's OLDPOP_LOUNGE_CORE_GENRE_IDS.
    id: 'oldpop-lounge',
    label: '올드팝 라운지',
    description: '60~80년대 서구 올드팝. 팝·소울·R&B·샹송·재즈를 폭넓게 조합',
    vocal: 'warm mid-range vocal, male or female lead, gentle and sincere, close-mic intimacy',
    moods: ['warm', 'nostalgic', 'elegant'],
    market: 'global',
    audience: 'seniors',
    primaryLanguage: 'english'
  },
  {
    id: 'showa-cafe',
    label: '쇼와 찻집',
    description: '차분한 일본 찻집과 절제된 복고 감성',
    vocal: 'mature soft male tenor, restrained emotional tone, warm close-mic delivery',
    moods: ['nostalgic', 'elegant', 'bittersweet'],
    market: 'japan',
    audience: 'seniors',
    primaryLanguage: 'english'
  },
  {
    id: 'showa-70s',
    label: '昭和セブンティーズ',
    description: '1970年代の日本歌謡・フォーク・ニューミュージック',
    vocal: 'mature Japanese male tenor, intimate close-mic delivery, restrained vibrato, warm analog presence',
    moods: ['nostalgic', 'elegant', 'bittersweet'],
    market: 'japan',
    audience: 'seniors',
    primaryLanguage: 'japanese'
  },
  {
    id: 'j2000s',
    label: 'ミレニアムJ-POP',
    description: '2000年代初頭のJ-POPとR&B影響期サウンド',
    vocal: 'clear Japanese pop vocal, polished emotional delivery, layered chorus harmonies, early-2000s digital presence',
    moods: ['hopeful', 'romantic', 'fresh-start'],
    market: 'japan',
    audience: 'general',
    primaryLanguage: 'japanese'
  },
  {
    id: 'christmas',
    label: '크리스마스',
    description: '겨울과 연말에 맞는 따뜻한 시즌 채널',
    vocal: 'warm clear vocal, soft holiday phrasing, polished but not childish',
    moods: ['christmas', 'warm', 'hopeful'],
    market: 'global',
    audience: 'allAges',
    primaryLanguage: 'english'
  },
  {
    id: 'lofi-study',
    label: '로파이 공부',
    description: '공부와 작업 배경에 맞는 낮은 집중감',
    vocal: 'optional soft close vocal, low-distraction delivery, calm and steady',
    moods: ['calm-focus', 'rainy-comfort', 'warm'],
    market: 'global',
    audience: 'twenties',
    primaryLanguage: 'english'
  },
  {
    id: 'modern-chill',
    label: 'Chill Hours',
    description: 'Alternative R&B, chill rap, and lo-fi hip-hop for modern late-night playlists',
    vocal: 'soft female voice just above a whisper, airy breath tone, slow intimate delivery',
    moods: ['rainy-comfort', 'calm-focus', 'warm'],
    market: 'global',
    audience: 'twenties',
    primaryLanguage: 'english'
  },
  {
    id: 'city-night',
    label: 'City Night Drive',
    description: 'Modern city-pop, future funk, and disco-pop for Korean/English night-drive playlists',
    vocal: 'bright young female voice, clean modern pop delivery, fresh and open tone',
    moods: ['fresh-start', 'romantic', 'rainy-comfort'],
    market: 'korea',
    audience: 'thirtiesForties',
    primaryLanguage: 'english'
  },
  {
    id: 'kids',
    label: '키즈',
    description: '가족이 함께 듣기 좋은 밝고 안전한 창작 동요 채널',
    // TASK v3.38 Part B1/B6 — matches the full 'little-singalong-radio' preset in data/presets.ts.
    // TASK v3.39 — childlike/youthful tone, no adult-coded wording (see data/presets.ts's defaultVocal rewrite).
    vocal: "bright cheerful children's choir singalong, youthful childlike voices, call-and-response group singing",
    moods: ['bright-playful', 'warm', 'fresh-start'],
    market: 'korea',
    audience: 'kids',
    // TASK v3.39 Part G — matches data/presets.ts's little-singalong-radio
    // default (english, not korean); see applyArchetype below for why a
    // user's own language choice now survives re-selecting this card.
    primaryLanguage: 'english'
  }
];

interface Step1ChannelProps {
  editorChannel: ChannelProfile;
  isSelectedCustom: boolean;
  onUpdateField: <K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) => void;
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
  basicMode?: boolean;
}

// TASK v3.38 Part B6 — shown once (persisted in localStorage, not per-session
// state) the first time a user selects the kids channel archetype.
const KIDS_BANNER_DISMISSED_KEY = 'kidsChannelBannerDismissed';

export default function Step1Channel({ editorChannel, isSelectedCustom, onUpdateField, onNew, onSave, onDelete, basicMode = false }: Step1ChannelProps) {
  const [genreSearchOpen, setGenreSearchOpen] = useState(false);
  const [genreQuery, setGenreQuery] = useState('');
  const [genreCategoryId, setGenreCategoryId] = useState('all');
  const [songsPerWeek, setSongsPerWeek] = useState(12);
  const [kidsBannerDismissed, setKidsBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(scopedKey(KIDS_BANNER_DISMISSED_KEY)) === 'true';
    } catch {
      return false;
    }
  });
  const archetype = editorChannel.archetype || 'senior-morning';

  function dismissKidsBanner() {
    setKidsBannerDismissed(true);
    try {
      localStorage.setItem(scopedKey(KIDS_BANNER_DISMISSED_KEY), 'true');
    } catch {
      // localStorage unavailable (private browsing, etc.) — banner just reappears next session, harmless.
    }
  }
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
    // Re-clicking the already-active card is a no-op — nothing to confirm, nothing to change.
    if (archetypeId === archetype) return;
    const defaults = archetypeChoices.find(choice => choice.id === archetypeId) || archetypeChoices[0];
    // TASK v3.39 Part G — previous archetype's own default, looked up before
    // any field is updated below.
    const previousDefaults = archetypeChoices.find(choice => choice.id === archetype);
    const genreIds = getCoreGenreIdsForArchetype(archetypeId).slice(0, 3);
    // TASK v3.63 (TASK A-3) — switching an existing custom channel's
    // archetype used to silently overwrite preferredGenres with the new
    // archetype's default 3 ids. A real user's already-saved custom channel
    // (e.g. an oldpop-lounge channel they'd already hand-picked genres for)
    // would lose that selection with no warning. Only ask when there's
    // something to actually lose — a fresh/never-customized channel just
    // gets the new defaults the same as before.
    const hasExistingGenreChoice = isSelectedCustom && editorChannel.preferredGenres.length > 0;
    const shouldResetGenres = !hasExistingGenreChoice
      || window.confirm('장르 선택을 새 채널 유형의 기본값으로 바꿀까요? 취소하면 지금 고른 장르를 그대로 유지합니다.');
    onUpdateField('archetype', archetypeId);
    onUpdateField('market', defaults.market);
    onUpdateField('audience', defaults.audience);
    onUpdateField('defaultVocal', defaults.vocal);
    if (shouldResetGenres) onUpdateField('preferredGenres', genreIds);
    onUpdateField('preferredMoods', defaults.moods);
    // TASK v3.38 Part B1 — previously never set here, so a quick-template
    // switch to 'kids' left whatever primaryLanguage the channel already
    // had (often 'english' from a prior senior-morning edit); createInitial
    // Options now derives lyricLanguage from primaryLanguage, so this needs
    // to actually change for the kids-song grammar to take effect.
    // TASK v3.39 Part G — real complaint: re-selecting (or re-clicking) an
    // archetype card unconditionally reset primaryLanguage every time, so a
    // user who picked 'japanese' for the kids channel saw it silently
    // flip back to the default on the next template click, making the
    // language select look broken. Only reset when the current value still
    // equals the *previous* archetype's own default — i.e. it was never
    // actually chosen by the user, just inherited from the last template
    // apply — so an explicit user choice is never clobbered.
    const languageWasUntouched = !previousDefaults || editorChannel.primaryLanguage === previousDefaults.primaryLanguage;
    if (languageWasUntouched) {
      onUpdateField('primaryLanguage', defaults.primaryLanguage);
    }
  }

  if (basicMode) {
    return (
      <section className="panel basic-workflow-panel">
        <h2>Choose a channel</h2>
        <p className="supporting">Choose a channel profile. Its language, mood, and vocal defaults will be applied automatically.</p>
        <div className="genre-card-grid">
          {archetypeChoices.map(choice => (
            <button key={choice.id} type="button" className={archetype === choice.id ? 'genre-card-choice active' : 'genre-card-choice'} onClick={() => applyArchetype(choice.id)}>
              <b>{choice.label}</b>
              <span>{choice.description}</span>
            </button>
          ))}
        </div>
      </section>
    );
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

      {archetype === 'kids' && !kidsBannerDismissed && (
        <div className="notice-banner">
          <p>
            {/* TASK v3.38 Part B6 (correction) — exact replacement wording: clarifies the Made-for-Kids requirement is about content, not language, to avoid the earlier phrasing being misread as a language restriction. */}
            <strong>동요 채널 안내</strong> — 유튜브 아동용(Made for Kids) 설정이 필요합니다. 이는 콘텐츠 성격에 따른
            것이며 언어와 무관합니다. 맞춤 광고가 제한되어 CPM이 낮아지고, 댓글·저장 기능이 비활성화됩니다.
          </p>
          <button type="button" onClick={dismissKidsBanner}>확인했어요</button>
        </div>
      )}

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
            {/* TASK v3.38 Part B1 (language follow-up) — the kids channel only supports korean/japanese/english (default korean); bilingual is not offered for it. */}
            {(archetype === 'kids' ? languageOptions.filter(option => option.value !== 'bilingual') : languageOptions).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Generation pack (타겟 연령대)</label>
          <select value={editorChannel.audience} onChange={event => onUpdateField('audience', event.target.value as AgeGroup)}>
            {generationPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.label}</option>)}
          </select>
        </div>
        <div>
          {/* TASK v3.72 (TASK C) — this no longer overwrites every song's vocal
              text (that made an untouched channel produce 18 identical
              voices); it's now this channel's own vocal CHARACTER — the
              starting point Step2Concept's voice picker shows, and a soft
              flavor hint for axis selection when the auto quota is active. */}
          <label>Channel vocal character (이 채널 보컬 성향)</label>
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
