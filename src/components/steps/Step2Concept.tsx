import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Wand2 } from 'lucide-react';
import { generationPacks, moodPacks, seasonPacks } from '../../data/presets';
import {
  compactGenreTechnicalLine,
  describeGenreForUserKo,
  genreCategories,
  getGenreById,
  getVisibleGenresForArchetype,
  searchExtendedGenres
} from '../../data/genreLibrary';
import { genreLabelsKo, moodLabelsKo, seasonLabelsKo } from '../../data/koreanLabels';
import { vocalPresets, matchVocalPreset } from '../../data/vocalPresets';
import { DEFAULT_ADULT_VOCAL_QUOTA, DEFAULT_KIDS_VOCAL_QUOTA, leaningAdultVocalQuota, leaningGenderFor, scaleVocalQuota } from '../../core/vocalPlan';
import { povDistribution, resolvePerspectiveMode } from '../../core/lyricDiversityPlan';
import { resolveGenreBlendMode } from '../../core/genreRotation';
import { avoidWordPresets, joinAvoidWords, parseAvoidWords } from '../../data/avoidWordPresets';
import { isKidsArchetype } from '../../utils/channelArchetype';
import { NEGATIVE_STYLE_TOGGLES, buildDefaultNegativeStyle, mergeNegativeStyleText, parseNegativeStyleTerms, withNegativeStyleTerm, withoutNegativeStyleTerm } from '../../data/negativeStyles';
import { isPlausibleChordProgression, moneyChordPresets } from '../../data/moneyChords';
import { genreSanitizationWarningKo, MAX_SECONDARY_GENRES, MAX_SELECTED_GENRES, normalizeGenreSelection, sanitizeGenreIdsForArchetype } from '../../core/genreSelection';
import { replaceAxisAllocation } from '../../core/diversityAllocation';
import { compactMoneyChord } from '../../core/soundSignature';
import { clampToLimit, INPUT_LIMITS } from '../../core/inputLimits';
import { defaultPackagingLanguageForChannel } from '../../core/packagingLanguage';
import { readRecentGenreIds, rememberRecentGenreId } from '../../core/recentGenreStore';
import { buildReferenceMoodStyleClause, referenceMoodSafetyIssues } from '../../core/referenceMood';
import { GENRE_FAMILIES, familiesBlendWell } from '../../data/genreFamilies';
import { channelSoundFloorForArchetype } from '../../data/channelSoundFloor';
import { QUALITY_THRESHOLDS, thresholdsByBasis } from '../../data/qualityThresholds';
import { workspaceForArchetype } from '../../data/workspaces';
import { LISTENING_INTENT_POLICY, DEFAULT_LISTENING_INTENT } from '../../data/listeningIntentPolicy';
import { PERCEIVED_ENERGY_POLICY } from '../../data/perceivedEnergyPolicy';
import { applyListeningIntentToOptions, listeningIntentApplicationStatus } from '../../core/listeningIntent';
import ChoiceGrid from '../ChoiceGrid';
import ConceptAgentPanel from '../ConceptAgentPanel';
import DiversityAllocationPanel from '../DiversityAllocationPanel';
import type { ConceptRecommendation } from '../../core/conceptAgent';
import type { ConceptCompatibilityResult } from '../../core/conceptCompatibility';
import type { GenerationOptions, GenrePack, ListeningIntent, MoodPack, SeasonPack, LyricLanguage, DisplayLanguage, ProviderSettings, WorkspaceId } from '../../types';

/** v4.2 (TASK E) — computed once at module load (QUALITY_THRESHOLDS is static data, not per-render/per-props), reused by the advanced-settings "기준값 검증 상태" summary below. */
const THRESHOLD_BASIS_SUMMARY = thresholdsByBasis();

const LANGUAGE_LABEL_KO: Record<LyricLanguage, string> = { english: '영어', korean: '한국어', japanese: '일본어', bilingual: '영어+한국어 혼합' };

/**
 * 지시문 34 (TASK B) — 채널 기본 가사 언어와 다르게 고를 때 하루가 판단할
 * 근거를 함께 보여준다. 차단은 하지 않는다 — 알리기만 한다(§B-1).
 * "관계 연속성 검사"/"아동 서사 안전성 검사"가 언어별로 갈린다는 서술은
 * 지시문 34 TASK A가 실측으로 확인한 실제 결함(core/quality.ts의
 * relationshipContinuityLanguage/kidsOutcomeLanguage가 이 세트의 실제
 * lyricLanguage와 일치할 때만 돈다 — 그 전에는 정책 언어와 다른 언어를
 * 고르면 조용히 무력화됐다)을 그대로 반영한다 — 지어낸 서술이 아니다.
 */
const LANGUAGE_IMPACT_NOTE_KO: Partial<Record<WorkspaceId, string>> = {
  'senior-oldpop': '60~70년대 올드팝·쇼와 시대의 시대색이 이 채널 기본 언어의 가사에 기반합니다. 다른 언어로는 시대감이 약해질 수 있습니다.',
  'kr-2030': '한국 2030 대상 구체적 장면(휴대폰·북마크·퇴근길 등)의 정서가 다른 언어로는 달라질 수 있습니다. "관계 연속성" 검사(문자를 못 보냈다는데 답장을 받는 등의 모순 감지)는 한국어 세트에서만 적용됩니다 — 다른 언어로 고르면 이 축은 검사되지 않습니다.',
  'jp-2030': '일본 2030 대상 구체적 장면의 정서가 다른 언어로는 달라질 수 있습니다. "관계 연속성" 검사는 일본어 세트에서만 적용됩니다 — 다른 언어로 고르면 이 축은 검사되지 않습니다.',
  'kr-kids': '동요를 한국어가 아닌 언어로 만들면 한국 아이가 따라 부르기 어려울 수 있습니다. 연령대별 어휘 정책과 "아동 서사 안전성" 검사(위험 행동 미교정·공포 결말 등 감지)는 한국어 세트에서만 적용됩니다 — 다른 언어로 고르면 이 축은 검사되지 않습니다.',
  'jp-kids': '동요를 일본어가 아닌 언어로 만들면 일본 아이가 따라 부르기 어려울 수 있습니다. "아동 서사 안전성" 검사는 일본어 세트에서만 적용됩니다 — 다른 언어로 고르면 이 축은 검사되지 않습니다.',
  'kr-idol-male': '한국 아이돌 팬덤 대상 어휘·정서가 다른 언어로는 달라질 수 있습니다.',
  'kr-idol-female': '한국 아이돌 팬덤 대상 어휘·정서가 다른 언어로는 달라질 수 있습니다.'
};

const languageOptions: { value: LyricLanguage; label: string; sub: string }[] = [
  { value: 'english', label: '영어', sub: 'English' },
  { value: 'korean', label: '한국어', sub: 'Korean' },
  { value: 'japanese', label: '일본어', sub: 'Japanese' },
  { value: 'bilingual', label: '영어+한국어 혼합', sub: 'Bilingual' }
];

// TASK D5 (v3.6) — separate from lyricLanguage: a Korean channel commonly
// runs English lyrics but Korean titles/thumbnails, so this needs its own
// control rather than following whatever language the lyrics are in.
const packagingLanguageOptions: { value: DisplayLanguage; label: string; sub: string }[] = [
  { value: 'korean', label: '한국어', sub: 'Korean' },
  { value: 'japanese', label: '일본어', sub: 'Japanese' },
  { value: 'english', label: '영어', sub: 'English' }
];

const CONCEPT_EXAMPLE_CHIPS = ['아침 커피 한 잔', '창밖의 첫눈', '오래된 라디오', '연말 편지', '산책길 낙엽', '크리스마스 이브', '옛 친구 생각'];

// 지시문 23 (TASK B) — §0-1 하루의 판단(60~70년대 음악을 복원하는 채널 →
// 60~70년대의 따뜻한 기억을 오늘 편하게 오래 들을 수 있는 음악으로 만드는
// 채널)을 반영해 기본값은 감성 장시간형. 정통 올드팝형은 §0-2 "되돌릴 길".
const LISTENING_INTENT_CHOICES = (['long-listen-comfort', 'balanced', 'era-authentic'] as const).map(id => {
  const policy = LISTENING_INTENT_POLICY[id];
  return {
    id,
    label: policy.labelKo,
    sublabel: `시대색 ${policy.eraColorStrength}%`,
    description: policy.descriptionKo,
    recommended: id === DEFAULT_LISTENING_INTENT
  };
});

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

/** TASK v6.0 (perspectiveMode) — short label used to interpolate PERSPECTIVE_CHOICES' own long labels into the "적용 방식" picker below (e.g. "18곡 전부 1인칭"). */
const PERSPECTIVE_SHORT_LABEL_KO: Record<GenerationOptions['perspective'], string> = {
  firstPerson: '1인칭',
  secondPerson: '2인칭',
  thirdPerson: '3인칭',
  radioHost: '라디오 DJ'
};

interface Step2ConceptProps {
  opts: GenerationOptions;
  setOpts: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  selectedGenres: GenrePack[];
  selectedMoods: MoodPack[];
  selectedSeason: SeasonPack;
  toggleArray: (key: 'genreIds' | 'moodIds', id: string) => void;
  provider: ProviderSettings;
  basicMode?: boolean;
  expertMode: boolean;
  onToggleExpertMode: () => void;
  /**
   * TASK (genre-archetype sanitization) — optional so any other caller of
   * this component (there aren't any today, but nothing should require
   * wiring this to keep compiling) still works without it; when omitted a
   * concept recommendation's genreAllocation is still sanitized, it just has
   * nowhere to display what got removed.
   */
  onGenreWarning?: (message: string) => void;
  /** 지시문 32 (§1) — App.tsx가 opts.customConcept/projectTitle × opts.channel로 이미 계산해 내려준 결과. */
  conceptCompat?: ConceptCompatibilityResult;
  conceptCompatAcknowledged?: boolean;
  onConceptCompatAcknowledgedChange?: (acknowledged: boolean) => void;
}

function CharCounter({ value, limit }: { value: string; limit: number }) {
  return (
    <p className={`char-counter${value.length > limit ? ' over-limit' : ''}`}>
      {value.length} / {limit}{value.length > limit ? ' — 입력이 너무 길어 저장 시 잘립니다' : ''}
    </p>
  );
}

export default function Step2Concept({
  opts, setOpts, selectedGenres, selectedMoods, selectedSeason, toggleArray, provider, basicMode = false, expertMode, onToggleExpertMode, onGenreWarning,
  conceptCompat, conceptCompatAcknowledged = false, onConceptCompatAcknowledgedChange
}: Step2ConceptProps) {
  // TASK v4.13 bugfix — used to auto-open "직접 입력하기" for ANY vocalTone
  // that isn't a byte-exact preset match, including the plain "no selection"
  // balanced state (vocalTone === channel.defaultVocal) — the single most
  // common state on first load, misread as "custom text" instead of the
  // "고르게 배정" default it actually is. Only auto-opens for a genuinely
  // different, unrecognized saved value now.
  const [vocalCustomOpen, setVocalCustomOpen] = useState(() => Boolean(opts.vocalTone?.trim()) && opts.vocalTone.trim() !== opts.channel.defaultVocal && !matchVocalPreset(opts.vocalTone));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customChordOpen, setCustomChordOpen] = useState(opts.moneyChordMode === 'custom');
  const [avoidCustomDraft, setAvoidCustomDraft] = useState('');
  const [genreQuery, setGenreQuery] = useState('');
  const [genreCategoryId, setGenreCategoryId] = useState('all');
  const [genreSearchOpen, setGenreSearchOpen] = useState(false);
  const [recentGenreIds, setRecentGenreIds] = useState(() => readRecentGenreIds(opts.channel.id));

  const selectedGenerationPack = generationPacks.find(pack => pack.id === opts.audience);
  const moneyPreview = compactMoneyChord(opts);
  const avoidList = parseAvoidWords(opts.avoidWords);
  const negativeStyleText = opts.negativeStyle ?? buildDefaultNegativeStyle(opts.channel);
  const negativeStyleTerms = parseNegativeStyleTerms(negativeStyleText);
  const negativeStyleTermKeys = new Set(negativeStyleTerms.map(term => term.toLowerCase().replace(/\s+/g, ' ').trim()));
  const presetPhrases = new Set(avoidWordPresets.map(preset => preset.phrase));
  const customAvoidTerms = avoidList.filter(term => !presetPhrases.has(term));
  const selectedGenreDetails = selectedGenres.map(genre => getGenreById(genre.id) || genre);
  const referenceMoodValue = opts.referenceMood || '';
  const referenceMoodIssues = referenceMoodSafetyIssues(referenceMoodValue);
  const referenceMoodClause = buildReferenceMoodStyleClause(referenceMoodValue);
  const channelArchetype = opts.channel.archetype || 'senior-morning';
  // TASK v3.39 Part D — kids channels see only the childlike presets; every
  // other channel keeps the plain adult presets, unchanged from before.
  // TASK v3.41 — the pool grew 5->16 (adult) / 3->10 (kids), so a flat
  // unordered grid got a lot longer. Presets tagged suitedArchetypes for
  // this channel float to the top (reusing ChoiceGrid's existing
  // "recommended" badge — no new UI component needed), then a light
  // male/female/duet-mixed grouping keeps the rest visually clustered
  // instead of interleaved.
  const VOCAL_GENDER_SORT_ORDER: Record<string, number> = { male: 0, female: 1, duet: 2, mixed: 3 };
  const relevantVocalPresets = vocalPresets
    .filter(preset => Boolean(preset.forKids) === isKidsArchetype(channelArchetype))
    .slice()
    .sort((a, b) => {
      const aSuited = a.suitedArchetypes?.includes(channelArchetype) ? 0 : 1;
      const bSuited = b.suitedArchetypes?.includes(channelArchetype) ? 0 : 1;
      if (aSuited !== bSuited) return aSuited - bSuited;
      return VOCAL_GENDER_SORT_ORDER[a.gender] - VOCAL_GENDER_SORT_ORDER[b.gender];
    });
  // TASK v4.13 (§5) — 하루님's own "남성 6 여성 6 혼성 6인데 선택은 하나이면
  // 그것도 이상하고" — the balanced default needs its own explicit, always-
  // selectable card (id below), not just "nothing else is picked". Reuses
  // the exact vocalTone value "no selection" already means
  // (channel.defaultVocal — see vocalPlan.ts's leaningGenderFor) rather than
  // adding a new options field.
  const BALANCED_VOCAL_CHOICE_ID = '__balanced__';
  // v5.9 (quota/tone separation) — mirrors core/batchPreallocation.ts's/
  // core/localGenerator.ts's own baseVocalQuota priority exactly: a channel's
  // own fixed vocalQuotaOverride (e.g. a K-pop boy/girl-group channel's real
  // 15/0/3 split) wins over the generic kids/adult default. Before this fix,
  // this preview always showed a plain scaled 6/6/6 split here even for an
  // override channel, whose real generation ignores that default entirely —
  // the "고르게 배정" card lied about what the pack would actually get.
  const hasFixedVocalQuota = Boolean(opts.channel.vocalQuotaOverride);
  const defaultQuotaForChannel = opts.channel.vocalQuotaOverride
    ?? (isKidsArchetype(channelArchetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA);
  const balancedQuotaPreview = scaleVocalQuota(defaultQuotaForChannel, opts.songCount);
  const isBalancedVocalTone = !opts.vocalTone?.trim() || opts.vocalTone.trim() === opts.channel.defaultVocal;
  // TASK v4.13 (§5-2) — "선택 시 실제 계산된 쿼터를 보여주십시오": same
  // leaningGenderFor/leaningAdultVocalQuota real generation itself calls
  // (core/batchPreallocation.ts, core/localGenerator.ts), so the preview
  // never drifts from what the pack actually gets.
  // v5.9 (quota/tone separation) — a kids channel can now lean too (see
  // vocalPlan.ts's own doc comment for why isKidsArchetype no longer
  // blanket-disables this); a channel-fixed quota (vocalQuotaOverride) never
  // leans on ANY archetype — the split itself is the whole point of that
  // channel, a vocal-tone pick only ever changes which TONE plays within it.
  const selectedVocalLeaning = hasFixedVocalQuota || isBalancedVocalTone ? undefined : leaningGenderFor(opts);
  const resolvedVocalQuotaPreview = selectedVocalLeaning
    ? leaningAdultVocalQuota(defaultQuotaForChannel, opts.songCount, selectedVocalLeaning)
    : balancedQuotaPreview;
  // v5.9 (quota/tone separation) — tone-preset recognition (matchVocalPreset,
  // or a detectable gender/duet/mixed phrase via leaningGenderFor) is now its
  // own signal, independent of whether the quota above actually leaned. A
  // fixed-quota channel's `selectedVocalLeaning` is always undefined by
  // design — that must not read as "the tone wasn't recognized" (the exact
  // bug core/batchPreallocation.ts's explicitUnrecognizedVocalTone fix
  // addresses on the generation side; this mirrors it for the preview).
  const isRecognizedVocalTone = isBalancedVocalTone || Boolean(matchVocalPreset(opts.vocalTone)) || Boolean(leaningGenderFor(opts));

  // TASK v6.0 (perspectiveMode) — "적용 방식" picker. Mirrors the vocal-quota
  // preview immediately above: resolvedPerspectiveMode is exactly what
  // core/setDirector.ts's makeAllocations (the manual 'pov' axis a real
  // Step2Plan visit bakes into diversityAllocations) and
  // core/lyricDiversityPlan.ts's own auto/fallback pov path both resolve to
  // for THIS opts object (resolvePerspectiveMode's own kids-varied fallback
  // included), so this preview never drifts from what generation actually
  // does. Song counts shown per option use the same povDistribution split
  // math those two real code paths call, not a re-derived approximation.
  const perspectiveShortLabel = PERSPECTIVE_SHORT_LABEL_KO[opts.perspective] ?? '1인칭';
  const resolvedPerspectiveMode = resolvePerspectiveMode(opts);
  const dominantPovPreview = povDistribution(opts.songCount, opts.perspective, 'dominant');
  const variedPovPreview = povDistribution(opts.songCount, opts.perspective, 'varied');
  const variedPovSummaryKo = Object.entries(variedPovPreview)
    .map(([id, count]) => `${PERSPECTIVE_SHORT_LABEL_KO[id as GenerationOptions['perspective']] ?? id} ${count}곡`)
    .join(' · ');

  // TASK (genreBlendMode) — "적용 방식" picker for the genre chip list below,
  // same shape as the perspectiveMode preview just above: resolvedGenreBlendMode
  // is exactly what core/genreRotation.ts's genresForTrack (the function every
  // real generation call site threads opts.genreBlendMode through) resolves to
  // for THIS opts object, so this never drifts from what generation actually does.
  const resolvedGenreBlendMode = resolveGenreBlendMode(opts);

  // TASK H8 (v3.10) — applying a concept-agent recommendation just fills in
  // the same fields the existing chip grids below already control; it's a
  // shortcut into the existing selection path, never a separate one.
  //
  // TASK v3.58 — previously collapsed to genreIds: normalizeGenreSelection
  // ([rec.genreId]), a single genre. That was the actual root cause behind
  // "apply a concept, get 18 identical-genre songs": with only 1 genre in
  // the pool, no downstream per-track rotation had anything to rotate
  // across (see core/conceptAgent.ts's genreAllocation and
  // core/genreRotation.ts's own fix for the matching bug on the generation
  // side). Now wires the recommendation's full multi-genre allocation into
  // the existing 8-axis diversity-allocation system (core/
  // diversityAllocation.ts) instead of a new mechanism — genreIds gets
  // every allocated genre (for the chip picker/selection UI), and the
  // per-song rotation is pinned to the recommended per-genre song counts via
  // a manual 'genre' axis allocation.
  function handleApplyConceptRecommendation(rec: ConceptRecommendation, inputText: string) {
    const vocalPreset = vocalPresets.find(preset => preset.id === rec.vocalPresetId);
    const excludeAdditions = rec.decomposedReferences?.flatMap(ref => ref.excludeAdditions) ?? [];
    // TASK v3.58 TASK 3 — every field here except matchedSurface is already
    // name-free (see core/artistReferenceDecomposer.ts); woven into the
    // style prompt's 'concept' atom group in core/localGenerator.ts.
    const artistReferenceStyleAtoms = rec.decomposedReferences?.flatMap(ref => [
      ref.eraTag,
      ...ref.instrumentation,
      ...ref.harmonyTraits,
      ...ref.rhythmTraits,
      ...ref.productionTraits,
      ...ref.vocalTraits
    ]) ?? [];
    // TASK (genre-archetype sanitization) — core/conceptAgent.ts's own
    // rule-based ranking already filters against this channel's core genre
    // ids, but a recommendation can also come back with a genreAllocation
    // this app never validated end-to-end (defense in depth per this task's
    // own background: "a bad concept-agent recommendation" is one of the
    // named real contamination paths). Sanitize before it ever reaches
    // opts.genreIds/diversityAllocations.
    const conceptArchetype = opts.channel.archetype || 'senior-morning';
    const { valid: sanitizedAllocationIds, removed: removedAllocationIds } = sanitizeGenreIdsForArchetype(
      rec.genreAllocation.map(slot => slot.genreId),
      conceptArchetype
    );
    const sanitizedAllocation = rec.genreAllocation.filter(slot => sanitizedAllocationIds.includes(slot.genreId));
    // getDefaultGenreIdsForArchetype's own recovery ids never came with a
    // songCount from the concept agent — split the recommendation's original
    // total pack size evenly across them so recovery still leaves a usable,
    // non-empty manual allocation rather than a { songId: 0 } no-op.
    const recoveredTotal = rec.genreAllocation.reduce((sum, slot) => sum + slot.songCount, 0);
    const recoveredAllocation = sanitizedAllocationIds.map(genreId => ({
      genreId,
      songCount: Math.max(1, Math.round(recoveredTotal / sanitizedAllocationIds.length) || 1)
    }));
    const finalAllocation = sanitizedAllocation.length ? sanitizedAllocation : recoveredAllocation;
    if (removedAllocationIds.length) onGenreWarning?.(genreSanitizationWarningKo(removedAllocationIds, conceptArchetype));
    setOpts(prev => ({
      ...prev,
      genreIds: normalizeGenreSelection(finalAllocation.map(slot => slot.genreId)),
      diversityAllocations: replaceAxisAllocation(prev.diversityAllocations, {
        axis: 'genre',
        mode: 'manual',
        counts: Object.fromEntries(finalAllocation.map(slot => [slot.genreId, slot.songCount]))
      }),
      moodIds: rec.moodIds,
      seasonId: rec.seasonId,
      vocalTone: vocalPreset?.prompt || prev.vocalTone,
      customConcept: inputText,
      // TASK v3.58 TASK 3 — a detected artist/band reference never puts the
      // name in the style prompt (see core/artistReferenceDecomposer.ts);
      // instead its "famous artist imitation"/"soundalike vocals"-style
      // phrases are added to the exclude list, same as this app's existing
      // forbidden-cliche handling.
      negativeStyle: excludeAdditions.length
        ? mergeNegativeStyleText(prev.negativeStyle ?? buildDefaultNegativeStyle(prev.channel), ...excludeAdditions)
        : prev.negativeStyle,
      artistReferenceStyleAtoms: artistReferenceStyleAtoms.length ? artistReferenceStyleAtoms : prev.artistReferenceStyleAtoms,
      // TASK (provenance) — applying a concept-agent recommendation is its
      // own ChoiceSource ('concept'), distinct from a direct chip/card click
      // ('user'). Only marks the fields this handler actually changed above:
      // genreIds/seasonId unconditionally (finalAllocation/rec.seasonId are
      // always set by this handler), vocalTone only when a real vocalPreset
      // was matched and applied (prev.vocalTone is left untouched otherwise,
      // so its provenance shouldn't change either).
      choiceProvenance: {
        ...prev.choiceProvenance,
        genreIds: 'concept',
        seasonId: 'concept',
        // TASK (provenance extension) — moodIds is set unconditionally above
        // (rec.moodIds), same as genreIds/seasonId; negativeStyle is only
        // actually changed when excludeAdditions is non-empty (see the
        // conditional negativeStyle field above this object), so its
        // provenance only flips to 'concept' in that same case — otherwise
        // prev.negativeStyle (and its existing provenance) is untouched.
        moodIds: 'concept',
        ...(vocalPreset ? { vocalTone: 'concept' as const } : {}),
        ...(excludeAdditions.length ? { negativeStyle: 'concept' as const } : {})
      }
    }));
    for (const slot of finalAllocation) rememberRecentGenreId(opts.channel.id, slot.genreId);
  }

  // 지시문 23 (TASK B) — "청취 목적" preset 적용. handleApplyConceptRecommendation과
  // 같은 패턴(§B-5): genreIds/diversityAllocations를 이 한 번의 명시적 클릭으로만
  // 채운다 — 이후 사용자가 genreIds나 diversityAllocations를 손으로 다시 고치면
  // 그 수동 선택이 그대로 남는다(diversityAllocations의 manual-always-wins 보장,
  // core/diversityAllocation.ts).
  // 지시문 30 (TASK B-4) — 실제 배분 로직은 core/listeningIntent.ts의
  // applyListeningIntentToOptions로 옮겼다(우선순위 로직 자체는 그대로,
  // §하지 말 것). 이 함수는 이제 그 결과를 setOpts에 반영하고
  // rememberRecentGenreId 같은 컴포넌트 전용 부수효과만 처리한다 — App.tsx의
  // onGenerate도 같은 core 함수를 호출해 "생성 직전 재적용"을 수행한다(지시문
  // 30 TASK B-2의 실제 갭: 클릭 이후 songCount/채널이 바뀌면 배분이 낡은 채로
  // 남았는데, 생성 경로 어디도 다시 확인하지 않았다).
  function handleApplyListeningIntent(intent: ListeningIntent) {
    const policy = LISTENING_INTENT_POLICY[intent];
    const workspaceId = workspaceForArchetype(channelArchetype)?.id ?? 'senior-oldpop';
    const energyPolicy = PERCEIVED_ENERGY_POLICY[workspaceId];
    // 지시문 33 (§2) — 같은 채널·같은 청취 목적을 반복 적용해도 항상 같은
    // 장르로 수렴하지 않도록, 이 채널의 최근 사용 이력을 tie-break에 넘긴다.
    const nextOpts = applyListeningIntentToOptions(opts, intent, policy, energyPolicy, readRecentGenreIds(opts.channel.id));
    if (nextOpts === opts) return;
    setOpts(() => nextOpts);
    if (nextOpts.choiceProvenance?.genreIds === 'user' && nextOpts.genreIds !== opts.genreIds) {
      for (const genreId of nextOpts.genreIds) rememberRecentGenreId(opts.channel.id, genreId);
    }
  }

  // TASK (지시문 30 TASK B-5) — 3단 상태 표시(●적용됨/⚠수정됨, opts.listeningIntent가 없으면 helper 텍스트 자체가 미선택 안내로 대체됨)에 쓰는 실시간 판정.
  const listeningIntentStatus = useMemo(() => {
    if (!opts.listeningIntent) return 'unselected' as const;
    const workspaceId = workspaceForArchetype(channelArchetype)?.id ?? 'senior-oldpop';
    return listeningIntentApplicationStatus(opts, LISTENING_INTENT_POLICY[opts.listeningIntent], PERCEIVED_ENERGY_POLICY[workspaceId]);
  }, [opts, channelArchetype]);

  const visibleGenres = useMemo(
    () => getVisibleGenresForArchetype(channelArchetype, opts.genreIds, recentGenreIds),
    [channelArchetype, opts.genreIds, recentGenreIds]
  );
  const primaryGenreId = opts.genreIds[0] || '';
  const primaryGenre = selectedGenreDetails[0];
  const secondaryGenreIds = opts.genreIds.slice(1);
  const filteredGenres = useMemo(() => {
    return searchExtendedGenres(genreQuery, genreCategoryId, channelArchetype);
  }, [genreCategoryId, genreQuery, channelArchetype]);

  function rememberGenreForChannel(genreId: string) {
    rememberRecentGenreId(opts.channel.id, genreId);
    setRecentGenreIds(readRecentGenreIds(opts.channel.id));
  }

  // TASK v3.63 (TASK B-2) — checking a family box doesn't touch opts.genreIds
  // directly; core/setDirector.ts's directSetLocal reads
  // opts.selectedGenreFamilyIds on the next (Step2.5) screen and turns it
  // into an actual genre allocation there. Individual genre chips below
  // remain a separate, still-fully-available path (spec's own "개별 장르
  // 직접 고르기" — TASK D's "기존 Step2 상세 설정을 삭제하지 마십시오").
  const selectedGenreFamilyIds = opts.selectedGenreFamilyIds ?? [];
  function toggleGenreFamily(familyId: string) {
    setOpts(prev => {
      const current = prev.selectedGenreFamilyIds ?? [];
      const next = current.includes(familyId) ? current.filter(id => id !== familyId) : [...current, familyId];
      return { ...prev, selectedGenreFamilyIds: next };
    });
  }

  function selectPrimaryGenre(id: string) {
    // TASK (provenance) — real, verified gap this closes: this is the most
    // common real genre-picking path (a plain chip click), and the OLD
    // userChoicesFromOptions heuristic never recognized it as 'user'
    // provenance unless the separate GenreFamily checkbox control had also
    // been touched. See core/userChoices.ts's userChoicesFromOptions doc
    // comment for the full gap.
    setOpts(prev => ({
      ...prev,
      genreIds: normalizeGenreSelection([id, ...prev.genreIds.filter(item => item !== id)]),
      choiceProvenance: { ...prev.choiceProvenance, genreIds: 'user' }
    }));
    const genre = getGenreById(id);
    if (genre?.tier === 'extended') rememberGenreForChannel(id);
  }

  function toggleSecondaryGenre(id: string) {
    if (id === primaryGenreId) return;
    // TASK (provenance) — also the real "genre removal" handler: clicking an
    // already-active secondary chip again removes it via this same function
    // (nextSecondary's own includes-then-filter branch above), so a removal
    // click is 'user' provenance too, same as an addition.
    setOpts(prev => {
      const currentPrimary = prev.genreIds[0] || id;
      const currentSecondary = prev.genreIds.slice(1);
      const nextSecondary = currentSecondary.includes(id)
        ? currentSecondary.filter(item => item !== id)
        : currentSecondary.length >= MAX_SECONDARY_GENRES
          ? currentSecondary
          : [...currentSecondary, id];
      return {
        ...prev,
        genreIds: normalizeGenreSelection([currentPrimary, ...nextSecondary]),
        choiceProvenance: { ...prev.choiceProvenance, genreIds: 'user' }
      };
    });
    const genre = getGenreById(id);
    if (genre?.tier === 'extended') rememberGenreForChannel(id);
  }

  function setGenreBlendWeight(id: string, value: number) {
    setOpts(prev => ({
      ...prev,
      genreBlendWeights: {
        ...(prev.genreBlendWeights || {}),
        [id]: Math.max(0, Math.min(100, Math.round(value) || 0))
      }
    }));
  }

  function chooseGenreFromSearch(id: string) {
    if (!primaryGenreId) selectPrimaryGenre(id);
    else toggleSecondaryGenre(id);
  }

  // TASK (provenance extension) — all 3 real avoidWords handlers funnel
  // through this single setOpts shape (only the array they build differs),
  // so 'user' provenance is recorded here rather than duplicated per caller.
  function toggleAvoidPreset(phrase: string) {
    const next = avoidList.includes(phrase) ? avoidList.filter(term => term !== phrase) : [...avoidList, phrase];
    setOpts(prev => ({ ...prev, avoidWords: joinAvoidWords(next), choiceProvenance: { ...prev.choiceProvenance, avoidWords: 'user' } }));
  }

  function addCustomAvoidTerm() {
    const term = avoidCustomDraft.trim();
    if (!term || avoidList.includes(term)) return;
    const next = joinAvoidWords([...avoidList, term]);
    if (next.length > INPUT_LIMITS.avoidWords) return;
    setOpts(prev => ({ ...prev, avoidWords: next, choiceProvenance: { ...prev.choiceProvenance, avoidWords: 'user' } }));
    setAvoidCustomDraft('');
  }

  function removeAvoidTerm(term: string) {
    setOpts(prev => ({ ...prev, avoidWords: joinAvoidWords(avoidList.filter(item => item !== term)), choiceProvenance: { ...prev.choiceProvenance, avoidWords: 'user' } }));
  }

  // TASK (provenance extension) — toggleNegativeStylePreset/the raw textarea
  // onChange (below) both record 'user'; resetNegativeStyle deliberately
  // records 'default' instead — it restores the channel's own default text,
  // the opposite of an explicit override, so treating it as 'user' would
  // wrongly protect a value the user just asked to STOP overriding.
  function toggleNegativeStylePreset(phrase: string) {
    setOpts(prev => {
      const current = prev.negativeStyle ?? buildDefaultNegativeStyle(prev.channel);
      const key = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
      const currentKeys = new Set(parseNegativeStyleTerms(current).map(term => term.toLowerCase().replace(/\s+/g, ' ').trim()));
      const next = currentKeys.has(key)
        ? withoutNegativeStyleTerm(current, phrase)
        : withNegativeStyleTerm(current, phrase);
      return { ...prev, negativeStyle: clampToLimit('negativeStyle', next), choiceProvenance: { ...prev.choiceProvenance, negativeStyle: 'user' } };
    });
  }

  function resetNegativeStyle() {
    setOpts(prev => ({ ...prev, negativeStyle: buildDefaultNegativeStyle(prev.channel), choiceProvenance: { ...prev.choiceProvenance, negativeStyle: 'default' } }));
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
      <div className="ui-mode-banner">
        <div>
          <b>현재 모드: {expertMode ? '자세히' : '간단히'}</b>
          <span>{expertMode ? '컨셉 설계 도구를 모두 표시합니다.' : '핵심 컨셉 입력은 유지하고 추천 도구만 접어둡니다.'}</span>
        </div>
        <button type="button" className="mode-toggle-button" onClick={onToggleExpertMode}>
          {expertMode ? '간단히' : '자세히'}
        </button>
      </div>
      <p className="step-hint">이 채널의 곡이 어떤 느낌이면 좋을지 정하세요. 아무것도 모르셔도 괜찮아요 — 카드를 눌러보고 마음에 드는 걸 고르시면 됩니다.</p>

      {basicMode ? (
        <details className="mode-more-panel">
          <summary>
            <Wand2 size={16} />
            컨셉 에이전트 더보기
          </summary>
          <ConceptAgentPanel
            channelId={opts.channel.id}
            archetype={channelArchetype}
            currentGenreId={opts.genreIds[0]}
            currentMoodId={opts.moodIds[0]}
            currentSeasonId={opts.seasonId}
            songCount={opts.songCount}
            provider={provider}
            onApply={handleApplyConceptRecommendation}
          />
        </details>
      ) : (
        <ConceptAgentPanel
          channelId={opts.channel.id}
          archetype={channelArchetype}
          currentGenreId={opts.genreIds[0]}
          currentMoodId={opts.moodIds[0]}
          currentSeasonId={opts.seasonId}
          songCount={opts.songCount}
          provider={provider}
          onApply={handleApplyConceptRecommendation}
        />
      )}

      <label>Project title (프로젝트 제목)</label>
      <input value={opts.projectTitle} onChange={event => setOpts(prev => ({ ...prev, projectTitle: event.target.value }))} />

      {/* 지시문 32 (§1) — 채널×컨셉 시대 호환성 사전 경고. unsupported는 이유
          + 대안 채널만 보여준다(차단 아님 — 하루가 원하면 그대로 진행 가능).
          cross-style은 재해석 확인 체크박스 없이는 다음(설계안) 단계로 못
          넘어간다(App.tsx의 conceptCompatBlocked). */}
      {conceptCompat && conceptCompat.status === 'unsupported' && (
        <div className="option-block" style={{ borderLeft: '3px solid #c0392b', paddingLeft: 12 }}>
          <p className="error">⚠ 이 채널은 이 컨셉의 시대를 표현하도록 설계되지 않았어요.</p>
          <p className="supporting">{conceptCompat.reasonKo}</p>
          {Boolean(conceptCompat.suggestedChannelIds?.length) && (
            <p className="supporting">대안 채널: {conceptCompat.suggestedChannelIds!.join(', ')}</p>
          )}
          <p className="supporting">그래도 이대로 진행할 수 있어요 — 다만 실제 생성 결과가 이 시대를 채우지 못할 가능성이 높아요.</p>
        </div>
      )}
      {conceptCompat && conceptCompat.status === 'cross-style' && (
        <div className="option-block" style={{ borderLeft: '3px solid #d68910', paddingLeft: 12 }}>
          <p>△ 이 채널의 주력 시대는 아니지만, 재해석으로 선택할 수 있는 컨셉이에요.</p>
          <p className="supporting">{conceptCompat.reasonKo}</p>
          <label className="avoid-word-item">
            <input
              type="checkbox"
              checked={conceptCompatAcknowledged}
              onChange={event => onConceptCompatAcknowledgedChange?.(event.target.checked)}
            />
            이 재해석으로 진행할게요
          </label>
        </div>
      )}

      <div className="option-block">
        <ChoiceGrid
          question="🎧 청취 목적"
          helper={
            opts.listeningIntent
              ? (listeningIntentStatus === 'applied'
                  ? (opts.choiceProvenance?.genreIds === 'user' && opts.genreIds.length > 0
                      ? `● "${LISTENING_INTENT_POLICY[opts.listeningIntent].labelKo}" 적용됨 — 이미 고르신 장르는 그대로 두고, 장르당 곡 수만 다시 배분했어요.`
                      : `● "${LISTENING_INTENT_POLICY[opts.listeningIntent].labelKo}" 적용됨 — 아래 장르 선택에 이미 반영돼 있어요. 직접 장르를 바꾸면 그 선택이 우선해요.`)
                  : `⚠ "${LISTENING_INTENT_POLICY[opts.listeningIntent].labelKo}" 적용 후 곡 수/장르를 직접 수정하셨어요 — 사용자 선택이 우선합니다. 생성 시작 시 필요하면 자동으로 다시 반영돼요.`)
              : '아래에서 고르면 이 채널의 장르 추천이 그 방향으로 바뀌어요. 고르지 않아도 괜찮아요 — 채널 기본값 그대로 진행돼요.'
          }
          choices={LISTENING_INTENT_CHOICES}
          value={opts.listeningIntent ?? ''}
          onChange={value => handleApplyListeningIntent(value as ListeningIntent)}
          columns={3}
        />
      </div>

      <div className="option-block">
        <h3>어떤 계절 분위기로 만들까요?</h3>
        <div className="chips">
          {seasonPacks.map(season => (
            <button
              type="button"
              key={season.id}
              className={opts.seasonId === season.id ? 'chip active' : 'chip'}
              title={season.period}
              onClick={() => setOpts(prev => ({ ...prev, seasonId: season.id, choiceProvenance: { ...prev.choiceProvenance, seasonId: 'user' } }))}
            >
              {seasonLabelsKo[season.id] || season.label}
            </button>
          ))}
        </div>
      </div>

      <div className="option-block">
        <h3>어떤 장르로 만들까요?</h3>
        <p className="supporting">이 채널에 어울리는 장르만 먼저 보여드립니다. 잘 모르겠으면 추천된 것을 그대로 두세요.</p>
        <p className="supporting">Main genre: {primaryGenre?.label || 'none'} / Secondary: {selectedGenreDetails.slice(1).map(g => g.label).join(', ') || 'none'} ({opts.genreIds.length}/{MAX_SELECTED_GENRES})</p>

        <div className="genre-section-card">
          <div className="genre-section-head">
            <h4>주 장르 (1개)</h4>
            <span>곡의 중심이 됩니다</span>
          </div>
          <div className="genre-card-grid">
            {visibleGenres.map(genre => {
              const selected = primaryGenreId === genre.id;
              const recommended = opts.channel.preferredGenres[0] === genre.id;
              return (
                <button
                  type="button"
                  key={genre.id}
                  className={selected ? 'genre-card-choice active' : 'genre-card-choice'}
                  onClick={() => selectPrimaryGenre(genre.id)}
                >
                  <span className="genre-card-title">
                    {genre.label}
                    {recommended && <span className="choice-badge">추천</span>}
                    {genre.tier === 'extended' && <span className="genre-role">최근</span>}
                  </span>
                  <span>{describeGenreForUserKo(genre)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="genre-section-card">
          <div className="genre-section-head">
            <h4>보조 장르 (최대 {MAX_SECONDARY_GENRES}개, 선택 사항)</h4>
            <span>색깔을 더합니다</span>
          </div>
          <div className="chips">
            {visibleGenres.filter(genre => genre.id !== primaryGenreId).map(genre => {
              const selected = secondaryGenreIds.includes(genre.id);
              return (
                <button
                  type="button"
                  key={genre.id}
                  className={selected ? 'chip active' : 'chip'}
                  disabled={!selected && secondaryGenreIds.length >= MAX_SECONDARY_GENRES}
                  onClick={() => toggleSecondaryGenre(genre.id)}
                >
                  {genre.label}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className="genre-search-toggle" onClick={() => setGenreSearchOpen(open => !open)}>
          <Search size={16} />
          다른 장르 더 찾기 ({filteredGenres.length}개)
          {genreSearchOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {genreSearchOpen && (
          <>
            <div className="genre-toolbar">
              <div className="genre-search">
                <Search size={16} />
                <input value={genreQuery} onChange={event => setGenreQuery(event.target.value)} placeholder="Search hidden genres, moods, instruments" />
              </div>
              <select value={genreCategoryId} onChange={event => setGenreCategoryId(event.target.value)}>
                <option value="all">All hidden categories</option>
                {genreCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </div>
            <div className="chips genre-chip-list">
              {filteredGenres.map(({ genre, eligibleForArchetype }) => {
                const selectedIndex = opts.genreIds.indexOf(genre.id);
                const selected = selectedIndex >= 0;
                const role = selected ? (selectedIndex === 0 ? 'Main' : `Sub ${selectedIndex}`) : '';
                const unavailableTitle = '이 채널에서는 사용할 수 없습니다';
                return (
                  <button
                    type="button"
                    key={genre.id}
                    className={selected ? 'chip active' : eligibleForArchetype ? 'chip' : 'chip chip-unavailable'}
                    disabled={!eligibleForArchetype || (!selected && opts.genreIds.length >= MAX_SELECTED_GENRES)}
                    onClick={() => chooseGenreFromSearch(genre.id)}
                    title={!eligibleForArchetype ? unavailableTitle : selected ? role : describeGenreForUserKo(genre)}
                  >
                    {role && <span className="genre-role">{role}</span>}
                    {genre.label}
                    {!eligibleForArchetype && <span className="genre-role genre-unavailable-tag">{unavailableTitle}</span>}
                  </button>
                );
              })}
            </div>
            {filteredGenres.length === 0 && <p className="supporting">No matching hidden genres.</p>}
          </>
        )}

        {selectedGenreDetails.length > 0 && (
          <div className="genre-preview-grid">
            {selectedGenreDetails.map((genre, index) => (
              <div key={genre.id} className="genre-preview-card">
                <div className="genre-preview-head">
                  <span className="genre-role">{index === 0 ? 'Main' : `Sub ${index}`}</span>
                  <h4>{genre.label}</h4>
                  {/* TASK (genreBlendMode) — labels the resolved/first-selected
                      genre inline, same "적용 방식" preview pattern the
                      perspectiveMode picker uses above: only shown while
                      shared-primary (the mode this label describes) is
                      actually in effect, and only once there's a second genre
                      for it to blend into. */}
                  {index === 0 && selectedGenreDetails.length > 1 && resolvedGenreBlendMode === 'shared-primary' && (
                    <span className="supporting">← 공통 중심 장르</span>
                  )}
                  {genre.categoryId && <span className="supporting">{genre.categoryId}</span>}
                </div>
                <p><span>{describeGenreForUserKo(genre)}</span></p>
                <p><span>{compactGenreTechnicalLine(genre)}</span></p>
                <details>
                  <summary>자세히 보기</summary>
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
                </details>
              </div>
            ))}
          </div>
        )}

        {/* TASK (genreBlendMode) — makes the pre-existing v3.58 "first-picked
            genre blends into every song" design visible instead of reading
            as a bug, and offers the lead-only opt-out. Same "적용 방식"
            ChoiceGrid shape/placement convention the perspectiveMode picker
            above uses (question + helper + a labeled preview). Gated to 2+
            genres — with only one genre selected, lead and primary are
            always the same genre and the two modes produce identical output. */}
        {selectedGenreDetails.length > 1 && (
          <div className="option-block compact">
            <p className="supporting">
              지금은 첫 번째로 고른 장르(<b>{selectedGenreDetails[0]?.label}</b>)가 모든 곡에 공통으로 섞여, 세트 전체가 하나의 사운드로 이어져요.
              곡마다 뚜렷하게 다른 장르 느낌을 원한다면 아래에서 바꿀 수 있어요.
            </p>
            <ChoiceGrid
              question="적용 방식"
              helper="선택하지 않으면 공통 중심 장르 섞기가 기본이에요."
              choices={[
                {
                  id: 'shared-primary',
                  label: '첫 장르를 모든 곡에 섞기',
                  sublabel: '통일감',
                  description: `모든 곡에 ${selectedGenreDetails[0]?.label}을(를) 함께 섞어, 세트 전체가 하나의 사운드로 이어져요.`,
                  recommended: true
                },
                {
                  id: 'lead-only',
                  label: '곡마다 한 장르만',
                  sublabel: '뚜렷한 대비',
                  description: '각 곡에 배정된 장르 하나만 사용해요. 장르별 색깔이 뚜렷하게 대비돼요.'
                }
              ]}
              value={resolvedGenreBlendMode}
              onChange={value => setOpts(prev => ({
                ...prev,
                genreBlendMode: value as GenerationOptions['genreBlendMode'],
                genreBlendModeIsExplicitChoice: true,
                choiceProvenance: { ...prev.choiceProvenance, genreBlendMode: 'user' }
              }))}
              columns={2}
            />
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

      {selectedGenreDetails.length > 1 && (
        <div className="option-block">
          <h3>Genre blend</h3>
          <p className="supporting">Optional weights for the selected genres. Empty weights keep the current main/sub blend.</p>
          <div className="allocation-row-list">
            {selectedGenreDetails.map((genre, index) => {
              const value = opts.genreBlendWeights?.[genre.id] ?? (index === 0 ? 70 : 30);
              return (
                <div key={genre.id} className="allocation-row">
                  <div className="allocation-label">
                    <b>{genre.label}</b>
                    <span>{index === 0 ? 'Main genre' : `Sub ${index}`}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={event => setGenreBlendWeight(genre.id, Number(event.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={event => setGenreBlendWeight(genre.id, Number(event.target.value))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="option-block">
        <h3>Reference mood</h3>
        <p className="supporting">Write a vibe in Korean or English. Artist names and soundalike requests are blocked before they enter the style prompt.</p>
        <textarea
          value={referenceMoodValue}
          onChange={event => setOpts(prev => ({
            ...prev,
            referenceMood: clampToLimit('referenceMood', event.target.value),
            choiceProvenance: { ...prev.choiceProvenance, referenceMood: 'user' }
          }))}
          placeholder="비 오는 새벽 드라이브, 나른한 여성 보컬"
          maxLength={INPUT_LIMITS.referenceMood}
          style={{ marginTop: 8 }}
        />
        <CharCounter value={referenceMoodValue} limit={INPUT_LIMITS.referenceMood} />
        {referenceMoodIssues.map(issue => <p key={issue} className="error">{issue}</p>)}
        {!referenceMoodIssues.length && referenceMoodClause && <p className="supporting">{referenceMoodClause}</p>}
      </div>

      {selectedGenerationPack && <p className="supporting">{selectedGenerationPack.audienceNote}</p>}

      {/* TASK v3.39 Part D — a kids channel only ever showed the 5 adult
          voice presets here (no childlike option existed at all), so the
          picker itself read as if the channel had no kids voices. Filtered
          to the childlike presets for 'kids', and to the plain adult
          presets otherwise — matchVocalPreset above still searches the full
          list either way, so a saved pack's vocalTone always resolves. */}
      {/* TASK v4.13 (§5) — "어떤 목소리로 부를까요?" read as if only one voice
          comes out of the whole 18-song pack; 하루님's own correction: this
          picker LEANS the pack's existing male/female/duet quota (see
          vocalPlan.ts's leaningGenderFor), it never replaces it with one
          voice. Retitled, a "선택하지 않으면..." helper line added, and an
          explicit "고르게 배정" card (always first) makes the balanced
          default a real, selectable, visibly-active choice instead of an
          implicit "nothing picked" state. */}
      <ChoiceGrid
        question="어떤 목소리를 중심으로 할까요?"
        helper="선택하지 않으면 남성·여성·듀엣이 고르게 배정됩니다."
        choices={[
          {
            id: BALANCED_VOCAL_CHOICE_ID,
            label: '고르게 배정',
            sublabel: 'Balanced (default)',
            description: `남성 ${balancedQuotaPreview.male}곡 · 여성 ${balancedQuotaPreview.female}곡 · 듀엣 ${balancedQuotaPreview.mixed}곡으로 고르게 배정됩니다.`,
            icon: '🎚'
          },
          ...relevantVocalPresets.map(preset => ({
            id: preset.id,
            label: preset.label,
            sublabel: preset.sublabel,
            description: preset.description,
            icon: '🎙',
            recommended: preset.suitedArchetypes?.includes(channelArchetype)
          }))
        ]}
        value={vocalCustomOpen ? '' : (isBalancedVocalTone ? BALANCED_VOCAL_CHOICE_ID : (matchVocalPreset(opts.vocalTone)?.id ?? ''))}
        onChange={value => {
          if (value === BALANCED_VOCAL_CHOICE_ID) {
            setVocalCustomOpen(false);
            // TASK (provenance) — "고르게 배정" is a real, deliberate click
            // even though the resulting value (channel.defaultVocal) equals
            // what the field would already have defaulted to — still 'user'
            // provenance, per this task's own explicit requirement.
            setOpts(prev => ({ ...prev, vocalTone: prev.channel.defaultVocal, choiceProvenance: { ...prev.choiceProvenance, vocalTone: 'user' } }));
            return;
          }
          const preset = vocalPresets.find(p => p.id === value);
          if (preset) {
            setVocalCustomOpen(false);
            setOpts(prev => ({ ...prev, vocalTone: preset.prompt, choiceProvenance: { ...prev.choiceProvenance, vocalTone: 'user' } }));
          }
        }}
        columns={3}
      />
      {/* TASK v4.13 (§5-2) — "선택 시... 실제 계산된 쿼터를 보여주십시오".
          v5.9 (quota/tone separation) — now shown for every archetype
          (kids included, since a kids channel can lean too) and split into
          the two independent axes the task's own mockup calls for: the
          actual resolved gender/count split (explicitly labeled "채널 고정"
          whenever vocalQuotaOverride makes it non-adjustable), and a
          separate confirmation that the picked TONE is actually being
          applied — these two lines can disagree (e.g. a K-pop channel keeps
          its fixed split while still applying the picked tone's character). */}
      {!isBalancedVocalTone && (
        <div className="supporting" style={{ marginTop: 4 }}>
          <p>선택: {matchVocalPreset(opts.vocalTone)?.label ?? opts.vocalTone}</p>
          <p>
            성별 배정: 남성 {resolvedVocalQuotaPreview.male}곡 · 여성 {resolvedVocalQuotaPreview.female}곡 · 듀엣 {resolvedVocalQuotaPreview.mixed}곡
            {hasFixedVocalQuota ? ' (채널 고정)' : ''}
          </p>
          <p>
            음색: {isRecognizedVocalTone
              ? '선택하신 톤이 실제 가사·스타일 프롬프트에 반영됩니다.'
              : '이 문구에서 알아볼 수 있는 성별/톤을 찾지 못해 채널 기본 보컬로 대체됩니다.'}
          </p>
        </div>
      )}
      <div className="button-row" style={{ marginTop: 8 }}>
        <button type="button" className={vocalCustomOpen ? 'chip active' : 'chip'} onClick={() => setVocalCustomOpen(v => !v)}>
          ✏️ 직접 입력하기
        </button>
      </div>
      {vocalCustomOpen && (
        <>
          <input
            value={opts.vocalTone}
            onChange={event => setOpts(prev => ({ ...prev, vocalTone: clampToLimit('vocalTone', event.target.value), choiceProvenance: { ...prev.choiceProvenance, vocalTone: 'user' } }))}
            placeholder="예: mature soulful male tenor, soft slightly husky"
            maxLength={INPUT_LIMITS.vocalTone}
            style={{ marginTop: 8 }}
          />
          <CharCounter value={opts.vocalTone} limit={INPUT_LIMITS.vocalTone} />
        </>
      )}

      <ChoiceGrid
        question="머니코드 (money chord, 익숙한 팝송 흐름)를 골라주세요"
        helper="머니코드는 사람들이 편안하게 느끼는 코드 진행이에요. 잘 모르겠으면 추천 카드를 고르세요."
        choices={moneyChordChoices}
        value={opts.moneyChordMode === 'custom' ? '' : opts.moneyChordMode}
        // v5.7 (TASK v5.7, TASK A) — moneyChordModeIsExplicitChoice:true marks
        // this as a real user pick (not just whatever the channel defaulted
        // to), so downstream (resolveEarwormMoneyChordMode, moneyChordPlan.ts)
        // never silently redirects it back to 'default'. See types.ts's own
        // doc comment on this field for the earworm-mode interaction this closes.
        onChange={value => setOpts(prev => ({
          ...prev,
          moneyChordMode: value as GenerationOptions['moneyChordMode'],
          moneyChordModeIsExplicitChoice: true,
          choiceProvenance: { ...prev.choiceProvenance, moneyChordMode: 'user' }
        }))}
        columns={3}
      />
      <p className="supporting">스타일 프롬프트 미리보기: <em>{moneyPreview}</em></p>

      <div className="option-block">
        <label className="avoid-word-item">
          <input
            type="checkbox"
            checked={Boolean(opts.earwormMode)}
            onChange={event => setOpts(prev => ({ ...prev, earwormMode: event.target.checked }))}
          />
          🎧 누구나 익숙하게 느끼는 멜로디로 (선택)
        </label>
        <p className="supporting">
          이 모드는 발음하기 쉽고, 짧고, 반복되는 훅을 우선 선택하고 가장 흔한 코드 진행을 사용해요.
          "어디서 들어본 것 같다"는 느낌을 자연스럽게 만들어줘요.
        </p>
        <p className="supporting">
          ⚠️ 다만 이건 확률을 높이는 것이지 보장은 아니에요. Suno의 실제 멜로디는 텍스트로 정밀하게 제어할 수 없어서, 결과는 매번 조금씩 달라질 수 있어요.
        </p>
      </div>

      <div className="option-block">
        <h3>Music Exclude styles (Suno)</h3>
        <p className="supporting">Style Prompt에 섞지 않고 Suno Exclude styles 칸에 따로 붙일 음악용 네거티브입니다.</p>
        <div className="chips">
          {NEGATIVE_STYLE_TOGGLES.map(toggle => {
            const active = negativeStyleTermKeys.has(toggle.phrase.toLowerCase().replace(/\s+/g, ' ').trim());
            return (
              <button
                type="button"
                key={toggle.id}
                className={active ? 'chip active' : 'chip'}
                onClick={() => toggleNegativeStylePreset(toggle.phrase)}
              >
                {toggle.labelKo}
              </button>
            );
          })}
          <button type="button" className="chip" onClick={resetNegativeStyle}>스펙 기본값</button>
        </div>
        <textarea
          value={negativeStyleText}
          onChange={event => setOpts(prev => ({
            ...prev,
            negativeStyle: clampToLimit('negativeStyle', event.target.value),
            choiceProvenance: { ...prev.choiceProvenance, negativeStyle: 'user' }
          }))}
          maxLength={INPUT_LIMITS.negativeStyle}
          style={{ marginTop: 8 }}
        />
        <CharCounter value={negativeStyleText} limit={INPUT_LIMITS.negativeStyle} />
      </div>

      <div className="option-block">
        <h3>Intro texture uniqueness</h3>
        <div className="chips">
          {([0, 50, 100] as const).map(value => (
            <button
              type="button"
              key={value}
              className={(opts.introUniqueness ?? 50) === value ? 'chip active' : 'chip'}
              onClick={() => setOpts(prev => ({ ...prev, introUniqueness: value }))}
            >
              {value}%
            </button>
          ))}
        </div>
        <p className="supporting">50%는 반복 안정감과 첫 5초 차이를 함께 두는 기본값입니다.</p>
      </div>

      {provider.provider !== 'local' && (
        <div className="option-block">
          <h3>제목 생성 방식</h3>
          <div className="chips">
            <button
              type="button"
              className={(opts.titleMode ?? 'ai-creative') === 'ai-creative' ? 'chip active' : 'chip'}
              onClick={() => setOpts(prev => ({ ...prev, titleMode: 'ai-creative' }))}
            >
              AI가 제목 창작 (기본 · 추천)
            </button>
            <button
              type="button"
              className={opts.titleMode === 'local' ? 'chip active' : 'chip'}
              onClick={() => setOpts(prev => ({ ...prev, titleMode: 'local' }))}
            >
              로컬 고정 제목 (오프라인 폴백과 동일)
            </button>
          </div>
          <p className="supporting">
            "AI가 제목 창작"은 훅 문구(가사 반복구)는 그대로 유지한 채, 제목의 문장 구조를 Claude/ChatGPT가 다양하게 지어요.
            "로컬 고정 제목"은 이전 방식대로 훅 문구를 거의 그대로 제목화합니다 — 제목이 다 비슷하게 느껴지면 이 옵션을 꺼두세요.
          </p>
        </div>
      )}

      {provider.provider !== 'local' && (
        <div className="option-block">
          <h3>훅(가사 반복구) 생성 방식</h3>
          <div className="chips">
            <button
              type="button"
              className={(opts.hookMode ?? 'ai-creative') === 'ai-creative' ? 'chip active' : 'chip'}
              onClick={() => setOpts(prev => ({ ...prev, hookMode: 'ai-creative', choiceProvenance: { ...prev.choiceProvenance, hookMode: 'user' } }))}
            >
              AI가 훅 창작 (기본 · 추천)
            </button>
            <button
              type="button"
              className={opts.hookMode === 'pool' ? 'chip active' : 'chip'}
              onClick={() => setOpts(prev => ({ ...prev, hookMode: 'pool', choiceProvenance: { ...prev.choiceProvenance, hookMode: 'user' } }))}
            >
              로컬 훅 뱅크 사용 (풀 소진 가능)
            </button>
          </div>
          <p className="supporting">
            "AI가 훅 창작"은 채널의 훅 이력(최근 500개)만 피해가며 Claude/ChatGPT가 매번 새 훅을 지어요 — 훅 뱅크가 소진될 일이 없어 대량 생성(주 100곡 이상)에 적합합니다.
            "로컬 훅 뱅크 사용"은 이전 방식대로 채널당 약 400개인 조합형 훅 뱅크에서 골라 씁니다 — 소량 생성이거나 완전히 예측 가능한 훅을 원할 때만 선택하세요.
          </p>
        </div>
      )}

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
        <h3>어떤 계열로 만들까요? (복수 선택, 선택 사항)</h3>
        <p className="supporting">비슷한 장르끼리 묶은 패밀리입니다. 아래에서 고르면 다음 화면(설계안)에서 장르 배분에 바로 반영됩니다.</p>
        <div className="chips">
          {GENRE_FAMILIES.map(family => {
            const active = selectedGenreFamilyIds.includes(family.id);
            const blendsWithSelected = selectedGenreFamilyIds.some(id => id !== family.id && familiesBlendWell(id, family.id));
            const warnsAboutBlend = selectedGenreFamilyIds.length > 0 && !active && !blendsWithSelected
              && !selectedGenreFamilyIds.some(id => familiesBlendWell(id, family.id));
            return (
              <button
                type="button"
                key={family.id}
                className={active ? 'chip active' : 'chip'}
                onClick={() => toggleGenreFamily(family.id)}
                title={`${family.descriptionKo} — ${family.commonTraitKo}`}
              >
                {family.labelKo}
                {warnsAboutBlend && ' ⚠'}
              </button>
            );
          })}
        </div>
        {selectedGenreFamilyIds.length > 0 && (
          <p className="supporting">
            선택: {selectedGenreFamilyIds.map(id => GENRE_FAMILIES.find(family => family.id === id)?.labelKo ?? id).join(', ')}
            {' — '}⚠ 표시는 서로 잘 안 어울릴 수 있다는 참고일 뿐, 선택을 막지는 않습니다.
          </p>
        )}
        <p className="supporting">개별 장르를 직접 고르고 싶다면 아래 "장르" 섹션의 칩을 그대로 사용하세요 — 패밀리 선택과 함께 조정할 수 있습니다.</p>
      </div>

      <div className="option-block">
        <h3>어떤 이야기를 담고 싶으세요? (선택 사항 — 비워두셔도 됩니다)</h3>
        {(() => {
          // TASK v4.7 (TASK C) — "하루님이 컨셉으로 무엇을 바꿀 수 있는지
          // 명확해집니다." Only shown for archetypes a ChannelSoundFloor
          // actually covers (data/channelSoundFloor.ts) — every other
          // archetype has no fixed sound floor, so this notice would be
          // misleading there.
          const soundFloor = channelSoundFloorForArchetype(opts.channel.archetype);
          if (!soundFloor) return null;
          return (
            <p className="supporting" style={{ background: 'var(--surface-2, #f5f5f5)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              이 채널은 {soundFloor.labelKo}으로 고정됩니다. 컨셉으로는 장면·감정·계절·템포를 정합니다.
              <br />
              예) "비 오는 날 창가", "젊은 시절 첫사랑", "여름밤 드라이브", "연말 모임"
            </p>
          );
        })()}
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
          onChange={event => setOpts(prev => ({ ...prev, customConcept: clampToLimit('customConcept', event.target.value) }))}
          placeholder="칩을 누르면 여기 채워집니다"
          maxLength={INPUT_LIMITS.customConcept}
          style={{ marginTop: 8 }}
        />
        <CharCounter value={opts.customConcept} limit={INPUT_LIMITS.customConcept} />
      </div>

      <button type="button" className="full-width" onClick={() => setAdvancedOpen(v => !v)}>
        {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        ⚙️ 고급 설정 {advancedOpen ? '접기' : '펼치기'}
      </button>

      {advancedOpen && (
        <div className="advanced-settings">
          <label>Lyrics language (가사 언어)</label>
          {/* 지시문 34 — 가사 언어는 채널 기본값과 독립적으로 선택 가능해야
              한다. 저작권 등록 요건이 언어에 걸려 있고 그 요건이 변할 수
              있다. docs/LANGUAGE_POLICY.md 참조. */}
          <div className="chips">
            {/* TASK v3.38 Part B1 (language follow-up) — the kids channel only supports korean/japanese/english (selectable per set, default korean); bilingual is not offered for it. */}
            {(isKidsArchetype(channelArchetype) ? languageOptions.filter(option => option.value !== 'bilingual') : languageOptions).map(option => (
              <button
                type="button"
                key={option.value}
                className={opts.lyricLanguage === option.value ? 'chip active' : 'chip'}
                onClick={() => setOpts(prev => ({ ...prev, lyricLanguage: option.value, choiceProvenance: { ...prev.choiceProvenance, lyricLanguage: 'user' } }))}
              >
                {option.label} <span className="supporting">({option.sub})</span>
              </button>
            ))}
          </div>
          {/* 지시문 34 (TASK B) — 차단 없이 안내만 한다. 채널의 primaryLanguage(기본값) 자체는 바꾸지 않는다 — 지금 이 세트만 다르게 골랐다는 사실과 그 영향을 알린다. */}
          {opts.lyricLanguage !== opts.channel.primaryLanguage && (
            <p className="supporting" style={{ borderLeft: '3px solid #d68910', paddingLeft: 8 }}>
              ⓘ 이 채널의 기본 가사 언어는 {LANGUAGE_LABEL_KO[opts.channel.primaryLanguage]}입니다. 현재 {LANGUAGE_LABEL_KO[opts.lyricLanguage]}로 설정되어 있습니다.
              제목·설명은 (아래에서 고르지 않는 한) 그대로 유지됩니다.
              {(() => {
                const note = LANGUAGE_IMPACT_NOTE_KO[workspaceForArchetype(channelArchetype)?.id ?? 'senior-oldpop'];
                return note ? ` ${note}` : '';
              })()}
            </p>
          )}

          <label>Title / thumbnail language (제목·썸네일 언어)</label>
          <div className="chips">
            {packagingLanguageOptions.map(option => (
              <button
                type="button"
                key={option.value}
                className={(opts.packagingLanguage ?? defaultPackagingLanguageForChannel(opts.channel)) === option.value ? 'chip active' : 'chip'}
                onClick={() => setOpts(prev => ({ ...prev, packagingLanguage: option.value, choiceProvenance: { ...prev.choiceProvenance, packagingLanguage: 'user' } }))}
              >
                {option.label} <span className="supporting">({option.sub})</span>
              </button>
            ))}
          </div>
          <p className="supporting">가사 언어와 별개로, 제목·썸네일 문구에 쓸 언어예요. 채널 시장에 따라 자동으로 기본값이 정해집니다 (직접 바꿀 수 있어요).</p>

          <ChoiceGrid
            question="곡 길이"
            choices={DURATION_CHOICES}
            value={opts.durationTarget}
            onChange={value => setOpts(prev => ({
              ...prev,
              durationTarget: value as GenerationOptions['durationTarget'],
              choiceProvenance: { ...prev.choiceProvenance, durationTarget: 'user' }
            }))}
            columns={3}
          />

          <ChoiceGrid
            question="가사 깊이"
            choices={DEPTH_CHOICES}
            value={opts.lyricDepth}
            onChange={value => setOpts(prev => ({
              ...prev,
              lyricDepth: value as GenerationOptions['lyricDepth'],
              choiceProvenance: { ...prev.choiceProvenance, lyricDepth: 'user' }
            }))}
            columns={4}
          />

          <ChoiceGrid
            question="가사의 시점"
            choices={PERSPECTIVE_CHOICES}
            value={opts.perspective}
            onChange={value => setOpts(prev => ({ ...prev, perspective: value as GenerationOptions['perspective'], choiceProvenance: { ...prev.choiceProvenance, perspective: 'user' } }))}
            columns={4}
          />

          {/* TASK v6.0 (perspectiveMode) — "이 시점을 얼마나 강하게 적용할지"
              선택. 셋 다 songCount/perspective가 바뀔 때마다 다시 계산되는
              실제 배분 수치를 라벨에 보여줘요 (v5.9 보컬 쿼터 미리보기와 같은
              방식) — 라벨의 숫자와 실제 생성 결과가 어긋나지 않도록. */}
          <ChoiceGrid
            question="적용 방식"
            helper={isKidsArchetype(channelArchetype)
              ? '아이 채널은 선택하지 않으면 자동 분산이 기본이에요 (실제 아이 동요 문장은 시점과 무관하게 주제별로 미리 쓰여 있어, 이 선택은 곡에 붙는 시점 표시에 반영돼요).'
              : '선택하지 않으면 중심 시점이 기본이에요.'}
            choices={[
              {
                id: 'fixed',
                label: `${opts.songCount}곡 전부 ${perspectiveShortLabel}`,
                sublabel: 'Fixed',
                description: `모든 곡을 ${perspectiveShortLabel} 시점 하나로 통일해요.`
              },
              {
                id: 'dominant',
                label: `${perspectiveShortLabel} 중심 (${dominantPovPreview[opts.perspective] ?? 0}곡) · 나머지 다른 시점`,
                sublabel: 'Dominant',
                description: `${perspectiveShortLabel}이 중심이고, 나머지는 다른 시점으로 섞여요.`,
                recommended: !isKidsArchetype(channelArchetype)
              },
              {
                id: 'varied',
                label: '자동 분산',
                sublabel: 'Varied',
                description: `시점을 고르게 섞어요 (${variedPovSummaryKo}).`,
                recommended: isKidsArchetype(channelArchetype)
              }
            ]}
            value={resolvedPerspectiveMode}
            onChange={value => setOpts(prev => ({
              ...prev,
              perspectiveMode: value as GenerationOptions['perspectiveMode'],
              perspectiveModeIsExplicitChoice: true,
              choiceProvenance: { ...prev.choiceProvenance, perspectiveMode: 'user' }
            }))}
            columns={3}
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
                  onChange={event => setOpts(prev => ({
                    ...prev,
                    moneyChordMode: 'custom',
                    moneyChordModeIsExplicitChoice: true,
                    customMoneyChord: clampToLimit('customMoneyChord', event.target.value),
                    choiceProvenance: { ...prev.choiceProvenance, moneyChordMode: 'user' }
                  }))}
                  placeholder="예: I-V-vi-IV / vi-IV-I-V / IVmaj7-iii7-vi7"
                  maxLength={INPUT_LIMITS.customMoneyChord}
                  style={{ marginTop: 8 }}
                />
                <CharCounter value={opts.customMoneyChord} limit={INPUT_LIMITS.customMoneyChord} />
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
              <button type="button" onClick={addCustomAvoidTerm} disabled={joinAvoidWords([...avoidList, avoidCustomDraft.trim()]).length > INPUT_LIMITS.avoidWords}>추가</button>
            </div>
            <CharCounter value={opts.avoidWords} limit={INPUT_LIMITS.avoidWords} />
          </div>

          <DiversityAllocationPanel opts={opts} setOpts={setOpts} genres={selectedGenres} />

          <div className="option-block compact">
            <h4>기준값 검증 상태</h4>
            <p className="supporting">
              품질 기준값 {QUALITY_THRESHOLDS.length}개 · 측정됨(measured) {THRESHOLD_BASIS_SUMMARY.measured.length} · 청취 검증됨(listener-verified) {THRESHOLD_BASIS_SUMMARY['listener-verified'].length} · 검증 대기(estimated) {THRESHOLD_BASIS_SUMMARY.estimated.length}
            </p>
            <p className="supporting">
              ⓘ estimated 기준값은 아직 실제 데이터로 확인되지 않았습니다 — 실제 A/B 채택·청취 평가가 쌓이면 v4.2 데이터 검증 단계에서 하나씩 확인할 예정입니다.
            </p>
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
