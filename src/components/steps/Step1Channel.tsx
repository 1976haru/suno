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
import { MAX_SELECTED_GENRES } from '../../core/genreSelection';
import { scopedKey } from '../../core/workspaceScope';
import { isKidsArchetype, partitionArchetypeChoicesByWorkspace } from '../../utils/channelArchetype';
import { getWorkspace } from '../../data/workspaces';
import { DEFAULT_KIDS_AGE_TIER_ID, KIDS_AGE_TIERS } from '../../data/kidsAgeTiers';
import TagChips from '../TagChips';
import type { AgeGroup, ChannelArchetype, ChannelProfile, KidsAgeTierId, LyricLanguage, Market, WorkspaceId } from '../../types';

const kidsAgeTierOptions = Object.values(KIDS_AGE_TIERS);

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
    // TASK B1 — kr-2030 workspace's single archetype (genreLibrary's
    // kr2030GenrePacks). Not reachable from the senior-oldpop workspace's
    // own UI flow today (this card only becomes user-visible once B2 flips
    // KR_2030.ready to true), listed here per this task's own §5 edit map.
    id: 'kr-2030-pop',
    label: '한국 2030 감성팝',
    description: '밴드팝·일렉트로팝·R&B·OST발라드·Y2K레트로·어쿠스틱포크를 아우르는 2030 감성 채널',
    vocal: 'confident modern Korean pop lead, emotionally direct delivery, close-mic warmth',
    moods: ['emotional', 'confident', 'nostalgic'],
    market: 'korea',
    audience: 'twenties',
    primaryLanguage: 'korean'
  },
  {
    // TASK C1 — jp-2030 workspace's single archetype (genreLibrary's
    // jp2030GenrePacks). Not reachable from the senior-oldpop workspace's
    // own UI flow today (this card only becomes user-visible once C2 flips
    // JP_2030.ready to true), listed here per this task's own §5 edit map.
    id: 'jp-2030-pop',
    label: '일본 2030 J-POP',
    description: '멜로딕 J-rock·애니송 시네마틱·헤이세이 노스탤지어·댄스보컬·카와이 아이돌·네오시티팝·칠 네오소울을 아우르는 2030 감성 채널',
    vocal: 'emotionally open Japanese lead vocal, wide-range sabi delivery, modern band warmth',
    moods: ['emotional', 'nostalgic', 'dramatic'],
    market: 'japan',
    audience: 'twenties',
    primaryLanguage: 'japanese'
  },
  {
    id: 'kids',
    label: '키즈',
    description: '가족이 함께 듣기 좋은 밝고 안전한 창작 동요 채널',
    // TASK v3.38 Part B1/B6 — matches the full 'little-singalong-radio' preset in data/presets.ts.
    // TASK v3.39 — childlike/youthful tone, no adult-coded wording (see data/presets.ts's defaultVocal rewrite).
    // TASK D2 §6-3 (user decision) — "choir" → boy-and-girl duet, kept in sync with data/presets.ts's defaultVocal.
    vocal: 'bright cheerful boy and girl duet singalong, youthful childlike voices, call-and-response singing',
    moods: ['bright-playful', 'warm', 'fresh-start'],
    market: 'korea',
    audience: 'kids',
    // TASK v3.39 Part G — matches data/presets.ts's little-singalong-radio
    // default (english, not korean); see applyArchetype below for why a
    // user's own language choice now survives re-selecting this card.
    primaryLanguage: 'english'
  },
  {
    // TASK: 4 missing archetype cards — kr-kids-song has shipped real
    // generation since TASK E1 (kr-kids workspace, docs/e1-report.md) but
    // never had its own card here, so a custom channel could never
    // explicitly pick it. label/description/vocal/moods sourced from
    // data/presets.ts's 3 kr-kids-song presets (follow-along-action-song,
    // daily-habit-learning-song, bedtime-lullaby-radio) — vocal matches
    // follow-along-action-song's own defaultVocal, since that's the
    // workspace's first/default preset (presetsForWorkspace('kr-kids')[0]).
    id: 'kr-kids-song',
    label: '한국 동요',
    description: '율동·생활습관 학습·자장가까지 아우르는 밝고 안전한 한국 창작 동요 채널',
    vocal: 'bright cheerful boy and girl duet singalong, youthful childlike voices, call-and-response singing',
    moods: ['bright-playful', 'calm-focus', 'warm'],
    market: 'korea',
    audience: 'kids',
    primaryLanguage: 'korean'
  },
  {
    // TASK: same as kr-kids-song above — jp-kids-song shipped real
    // generation since TASK F1 (jp-kids workspace, docs/f1-report.md).
    // label/description/vocal/moods sourced from data/presets.ts's 3
    // jp-kids-song presets (teasobi-hiroba, minna-de-taiso,
    // oyasumi-mae-no-uta) — vocal matches teasobi-hiroba's own
    // defaultVocal, the workspace's first/default preset.
    id: 'jp-kids-song',
    label: '일본 동요',
    description: '손유희·체조부터 잠들기 전 노래까지 아우르는 일본 창작 동요 채널, 의성어 시스템 포함',
    vocal: "warm nursery-toned Japanese lead, echoing children's-voice response",
    moods: ['bright-playful', 'calm-focus', 'warm'],
    market: 'japan',
    audience: 'kids',
    primaryLanguage: 'japanese'
  },
  {
    // TASK: kr-idol-male shipped real generation since TASK K2 (kr-idol-male
    // workspace, docs/k2-report.md). label/description/vocal/moods sourced
    // from data/presets.ts's 3 kr-idol-male presets (stage-night,
    // drive-kpop-playlist, dawn-confession) — vocal matches stage-night's
    // own defaultVocal, the workspace's first/default preset.
    id: 'kr-idol-male',
    label: '한국 보이그룹',
    description: '퍼포먼스 트랩·신스댄스·미드템포 R&B를 아우르는 한국 보이그룹 아이돌 팝 채널',
    vocal: 'confident male idol lead, rap-sung verse into a stacked unison chorus',
    moods: ['confident', 'energetic', 'bright'],
    market: 'korea',
    audience: 'twenties',
    primaryLanguage: 'korean'
  },
  {
    // TASK: kr-idol-female shipped real generation since TASK K3
    // (kr-idol-female workspace, docs/k3-report.md). label/description/
    // vocal/moods sourced from data/presets.ts's 3 kr-idol-female presets
    // (daylight-city-kpop, nonstop-playlist, songs-for-after-its-over) —
    // vocal matches daylight-city-kpop's own defaultVocal, the workspace's
    // first/default preset.
    id: 'kr-idol-female',
    label: '한국 걸그룹',
    description: '신스댄스·라틴아프로·퍼포먼스 트랩·감성 발라드를 아우르는 한국 걸그룹 아이돌 팝 채널',
    vocal: 'bright forward female idol lead, light rhythmic phrasing, confident delivery',
    moods: ['confident', 'bright', 'energetic'],
    market: 'korea',
    audience: 'twenties',
    primaryLanguage: 'korean'
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
  // TASK: workspace-filtered archetype cards. Optional (falls back to
  // 'senior-oldpop', the workspace every archetypeChoices entry before this
  // task already belonged to) so no existing caller/test that doesn't yet
  // pass it breaks.
  workspaceId?: WorkspaceId;
  // Fable5 1단계 TASK B — editorChannel is only a draft (App.tsx's
  // cm.editorChannel); the channel actually used for generation is
  // cm.selectedChannel, only synced by onSave. Both are surfaced here so
  // the user can see which channel is live and know when a card click
  // hasn't been applied yet, instead of assuming the two stay in sync.
  appliedChannelName?: string;
  channelDirty?: boolean;
}

// TASK v3.38 Part B6 — shown once (persisted in localStorage, not per-session
// state) the first time a user selects the kids channel archetype.
const KIDS_BANNER_DISMISSED_KEY = 'kidsChannelBannerDismissed';

export default function Step1Channel({ editorChannel, isSelectedCustom, onUpdateField, onNew, onSave, onDelete, basicMode = false, workspaceId = 'senior-oldpop', appliedChannelName, channelDirty = false }: Step1ChannelProps) {
  const [genreSearchOpen, setGenreSearchOpen] = useState(false);
  const [genreQuery, setGenreQuery] = useState('');
  const [genreCategoryId, setGenreCategoryId] = useState('all');
  const [songsPerWeek, setSongsPerWeek] = useState(12);
  // TASK: default view only shows this workspace's own archetype cards;
  // "다른 유형 보기" reveals the rest for a custom channel that genuinely
  // wants an off-workspace archetype. Reuses the same archetypeIds source
  // hooks/useChannelManager.ts's presetsForWorkspace/saveEditorProfile
  // already filter/validate against, per this task's own instruction not
  // to invent a new data source.
  const [otherArchetypesOpen, setOtherArchetypesOpen] = useState(false);
  const { inWorkspace: workspaceArchetypeChoices, other: otherArchetypeChoices } = useMemo(
    () => partitionArchetypeChoicesByWorkspace(archetypeChoices, getWorkspace(workspaceId).archetypeIds),
    [workspaceId]
  );
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
    const genreIds = getCoreGenreIdsForArchetype(archetypeId).slice(0, MAX_SELECTED_GENRES);
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
    // v5.13 (TASK: kidsAgeTierId wiring) — mirrors the audience default just
    // above: switching TO a kids archetype seeds a real default tier
    // (data/kidsAgeTiers.ts's own DEFAULT_KIDS_AGE_TIER_ID, 'kids-t2' —
    // matching every other real call site's "ageTier 없을 때" fallback)
    // instead of leaving the field unset; switching AWAY clears it, since a
    // non-kids channel has no meaningful tier.
    onUpdateField('kidsAgeTierId', isKidsArchetype(archetypeId) ? DEFAULT_KIDS_AGE_TIER_ID : undefined);
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

  // Fable5 1단계 TASK B-2 (②④) — a card click only edits the draft
  // (editorChannel); the channel actually used for generation
  // (appliedChannelName, App.tsx's cm.selectedChannel) doesn't change until
  // onSave runs. Surfaced in both basicMode and the detailed editor so a
  // click doesn't read as "already switched."
  const channelApplyStatus = (
    <div className="channel-apply-status">
      {appliedChannelName && (
        <p className="supporting">현재 생성 채널: <strong>{appliedChannelName}</strong></p>
      )}
      {channelDirty && (
        <div className="notice-banner">
          <p>새 채널 설정이 아직 적용되지 않았습니다.</p>
          <button type="button" onClick={onSave}>이 채널로 적용</button>
        </div>
      )}
    </div>
  );

  if (basicMode) {
    return (
      <section className="panel basic-workflow-panel">
        <h2>채널 유형 편집</h2>
        <p className="supporting">채널 유형을 고르세요. 카드를 클릭하면 언어·분위기·보컬 기본값이 편집 중인 채널 초안에 반영됩니다.</p>
        {channelApplyStatus}
        <div className="genre-card-grid">
          {workspaceArchetypeChoices.map(choice => (
            <button key={choice.id} type="button" className={archetype === choice.id ? 'genre-card-choice active' : 'genre-card-choice'} onClick={() => applyArchetype(choice.id)}>
              <b>{choice.label}</b>
              <span>{choice.description}</span>
            </button>
          ))}
        </div>
        {otherArchetypeChoices.length > 0 && (
          <>
            <button type="button" className="genre-search-toggle" onClick={() => setOtherArchetypesOpen(open => !open)}>
              <Search size={16} />
              다른 유형 보기 ({otherArchetypeChoices.length}개)
              {otherArchetypesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {otherArchetypesOpen && (
              <>
                <p className="supporting">다른 워크스페이스의 채널 유형입니다. 이 워크스페이스에는 저장할 수 없어요 — 필요하면 해당 워크스페이스로 이동해서 만드세요.</p>
                <div className="genre-card-grid">
                  {otherArchetypeChoices.map(choice => (
                    <button key={choice.id} type="button" className={archetype === choice.id ? 'genre-card-choice active' : 'genre-card-choice'} onClick={() => applyArchetype(choice.id)}>
                      <b>{choice.label}</b>
                      <span>{choice.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <section className="panel profile-editor">
      <p className="step-hint">먼저 어떤 채널의 곡을 만들지 고르세요. 채널마다 목소리와 분위기가 저장됩니다.</p>
      {channelApplyStatus}

      <div className="panel-header">
        <div className="panel-title">
          <Sparkles size={18} />
          <h2>Channel Profile Editor (채널 프로필) — 편집 중인 초안</h2>
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

      {isKidsArchetype(archetype) && !kidsBannerDismissed && (
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
          {workspaceArchetypeChoices.map(choice => (
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
        {otherArchetypeChoices.length > 0 && (
          <>
            <button type="button" className="genre-search-toggle" onClick={() => setOtherArchetypesOpen(open => !open)}>
              <Search size={16} />
              다른 유형 보기 ({otherArchetypeChoices.length}개)
              {otherArchetypesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {otherArchetypesOpen && (
              <>
                {/* TASK: v5.9's saveEditorProfile already hard-blocks saving a
                    channel whose archetype isn't in this workspace's own
                    archetypeIds (window.alert on Save) — this note fires
                    earlier, at pick time, so the user isn't surprised only
                    after filling out the whole form. */}
                <p className="supporting">다른 워크스페이스의 채널 유형입니다. 이 워크스페이스에는 저장할 수 없어요 — 필요하면 해당 워크스페이스로 이동해서 만드세요.</p>
                <div className="genre-card-grid">
                  {otherArchetypeChoices.map(choice => (
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
              </>
            )}
          </>
        )}
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
            {(isKidsArchetype(archetype) ? languageOptions.filter(option => option.value !== 'bilingual') : languageOptions).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          {/* v3.77 (TASK C) — this field drives more than lyric tone: BPM
              range/tempo bands and word-count targets all key off it (see
              data/audienceProfiles.ts's audienceProfileForAgeGroup). Label
              clarified so it reads as a real generation setting, not just a
              content-pack label — a real custom channel's audience silently
              defaulting away from what its archetype implied was part of
              this task's own diagnosed root cause. */}
          <label>Generation pack / 타겟 연령대 (BPM·가사 톤에 영향)</label>
          <select value={editorChannel.audience} onChange={event => onUpdateField('audience', event.target.value as AgeGroup)}>
            {generationPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.label}</option>)}
          </select>
        </div>
        {isKidsArchetype(archetype) && (
          <div>
            {/* v5.13 (TASK: kidsAgeTierId wiring) — kids-only picker, following
                the same convention as the audience select just above (real
                generation setting, not just a label): drives BPM range, the
                repetition-cycle arc's bundle shape, section structure, and
                hook-repeat count (see data/kidsAgeTiers.ts). Empty option
                keeps the channel unassigned (falls back to
                DEFAULT_KIDS_AGE_TIER_ID wherever a tier is actually needed) —
                not every kids channel needs an explicit pick. */}
            <label>동요 연령대 / Kids age tier (BPM·구조·반복 횟수에 영향)</label>
            <select
              value={editorChannel.kidsAgeTierId || ''}
              onChange={event => onUpdateField('kidsAgeTierId', (event.target.value || undefined) as KidsAgeTierId | undefined)}
            >
              <option value="">미지정 (기본값 T2 적용)</option>
              {kidsAgeTierOptions.map(tier => (
                <option key={tier.id} value={tier.id}>{tier.labelKo}</option>
              ))}
            </select>
          </div>
        )}
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
