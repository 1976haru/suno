import type {
  AxisAllocation,
  ChannelProfile,
  DiversityAxisId,
  GenerationOptions,
  GenrePack,
  PreassignedSongSlot
} from '../types';
import { genreLibrary, getCoreGenreIdsForArchetype, getGenreById, totalGenreCount } from '../data/genreLibrary';
import { moodPacks, seasonPacks } from '../data/presets';
import { matchConceptRules } from '../data/conceptKeywords';
import { hookDevices } from '../data/hookDevices';
import { introTexturesForArchetype } from '../data/introTextures';
import { lyricThemesForOptions } from '../data/lyricThemes';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  ARRANGEMENT_DENSITY_IDS,
  VOCAL_TYPE_IDS
} from './diversityAllocation';
import { allocateGenreCounts } from './conceptAgent';
import {
  decomposeArtistReferences,
  isSafeDecomposedReference,
  type DecomposedReference
} from './artistReferenceDecomposer';
import { preallocateSongSlots } from './batchPreallocation';
import { GENRE_FAMILIES, membersPerFamilyForSelection, type GenreFamily } from '../data/genreFamilies';

export interface SetPlan {
  interpretation: {
    intentKo: string;
    eraFocus: string[];
    /** v3.63 (TASK B) — GenreFamily ids actually used to choose the genre axis; empty when the free-text/keyword path was used instead (see chooseGenreIdsFromFamilies). */
    familyIds: string[];
    artistReferences: DecomposedReference[];
    audienceProfileId: string;
    reasoningKo: string[];
  };
  allocations: AxisAllocation[];
  slots: PreassignedSongSlot[];
  adjustables: {
    axis: DiversityAxisId;
    labelKo: string;
    current: { id: string; count: number }[];
    alternatives: { id: string; labelKo: string; whyKo: string }[];
  }[];
  warnings: string[];
}

interface RankedGenre {
  genre: GenrePack;
  score: number;
  reasons: string[];
}

const AXIS_LABEL_KO: Record<DiversityAxisId, string> = {
  genre: '장르',
  vocalType: '보컬',
  introTexture: '인트로 질감 그룹',
  hookDevice: '훅 장치 그룹',
  arrangementDensity: '편곡 밀도',
  structureTemplate: '구조',
  lyricTheme: '가사 장면',
  pov: '시점'
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, terms: string[]) {
  return terms.some(term => text.includes(term));
}

function deriveEraFocus(freeText: string, refs: DecomposedReference[]): string[] {
  const text = normalizeText(freeText);
  const eras = new Set<string>();
  for (const ref of refs) eras.add(ref.eraTag);
  if (/(60s|1960|60년|60년대|비틀|beat)/i.test(text)) eras.add('1960s beat-pop / old-pop');
  if (/(70s|1970|70년|70년대|7080|카펜|carpenter|abba|아바)/i.test(text)) eras.add('1970s soft pop / AM radio');
  if (/(80s|1980|80년|80년대)/i.test(text)) eras.add('1980s adult contemporary');
  if (/(샹송|chanson)/i.test(text)) eras.add('mid-century chanson');
  if (/(재즈|jazz)/i.test(text)) eras.add('classic jazz lounge');
  if (!eras.size && /(올드팝|old pop|oldies|옛날|추억)/i.test(text)) eras.add('1960s-80s old-pop warmth');
  return [...eras];
}

function inferSeasonId(freeText: string, channel: ChannelProfile) {
  const matched = matchConceptRules(freeText);
  const seasonScores = new Map<string, number>();
  for (const rule of matched) {
    for (const [id, score] of Object.entries(rule.seasonWeights || {})) {
      seasonScores.set(id, (seasonScores.get(id) || 0) + score);
    }
  }
  const top = [...seasonScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top && seasonPacks.some(season => season.id === top)) return top;
  if (channel.archetype === 'kids') return 'spring-open';
  return seasonPacks.some(season => season.id === 'spring-open') ? 'spring-open' : seasonPacks[0].id;
}

function inferMoodIds(freeText: string, channel: ChannelProfile) {
  const matched = matchConceptRules(freeText);
  const moodScores = new Map<string, number>();
  for (const rule of matched) {
    for (const [id, score] of Object.entries(rule.moodWeights || {})) {
      moodScores.set(id, (moodScores.get(id) || 0) + score);
    }
  }
  const ranked = [...moodScores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const fallback = channel.preferredMoods.length ? channel.preferredMoods : ['warm', 'nostalgic'];
  return [...new Set([...ranked, ...fallback])].filter(id => moodPacks.some(mood => mood.id === id)).slice(0, 2);
}

function genreMatchesChannel(genre: GenrePack, channel: ChannelProfile) {
  const archetype = channel.archetype || 'senior-morning';
  if (genre.archetypes?.includes(archetype)) return true;
  if (archetype !== 'senior-morning') return false;
  const text = [
    genre.id,
    genre.label,
    genre.categoryId,
    ...(genre.goodFor || []),
    ...(genre.audiences || []),
    ...(genre.moods || [])
  ].join(' ').toLowerCase();
  if (!hasAny(text, ['senior', 'morning', 'coffee', 'warm', 'nostalgic', 'old', 'cafe', 'comfort'])) return false;
  return !hasAny(text, ['trap', 'rap', 'club', 'hard bop', 'bebop', 'big band', 'aggressive']);
}

function scoreGenre(
  genre: GenrePack,
  freeText: string,
  refs: DecomposedReference[],
  eraFocus: string[],
  channel: ChannelProfile,
  history: { recentGenreIds: string[] }
): RankedGenre {
  const text = normalizeText(freeText);
  const haystack = normalizeText([
    genre.id,
    genre.label,
    genre.styleCore,
    genre.signatureSound,
    genre.eraTag,
    genre.categoryId,
    ...(genre.instruments || []),
    ...(genre.goodFor || []),
    ...(genre.audiences || []),
    ...(genre.moods || []),
    ...(genre.aliases || [])
  ].join(' '));
  let score = genre.tier === 'core' ? 2 : 0.75;
  const reasons: string[] = [];

  if (channel.preferredGenres.includes(genre.id)) {
    score += 1.5;
    reasons.push('채널 기본 장르');
  }
  if (history.recentGenreIds.includes(genre.id)) score -= 2;

  for (const rule of matchConceptRules(freeText)) {
    const weight = rule.genreWeights?.[genre.id] || 0;
    if (weight) {
      score += weight * 2;
      reasons.push(`키워드 ${rule.id}`);
    }
  }

  for (const ref of refs) {
    const index = ref.suggestedGenreIds.indexOf(genre.id);
    if (index >= 0) {
      score += 12 - index * 2;
      reasons.push('참조 사운드 분해');
    }
  }

  if (/(비틀|beat)/i.test(text) && (genre.id === 'oldpop-british-beat' || haystack.includes('british beat'))) {
    score += 10;
    reasons.push('1960s 비트팝');
  }
  if (/(카펜|carpenter)/i.test(text) && hasAny(haystack, ['soft rock', 'baroque pop', 'close harmony', 'adult contemporary'])) {
    score += 8;
    reasons.push('따뜻한 1970s 소프트팝');
  }
  if (/(아바|abba)/i.test(text) && hasAny(haystack, ['europop', 'close harmony', 'orchestral easy'])) {
    score += 8;
    reasons.push('밝은 1970s 유럽 팝');
  }
  if (/(샹송|chanson)/i.test(text) && hasAny(haystack, ['chanson', 'french'])) {
    score += 10;
    reasons.push('샹송 키워드');
  }
  if (/(재즈|jazz)/i.test(text) && hasAny(haystack, ['jazz', 'lounge', 'standards'])) {
    score += 7;
    reasons.push('재즈 키워드');
  }
  if (/(올드팝|old pop|oldies|7080|추억)/i.test(text) && genre.id.startsWith('oldpop-')) {
    score += 5;
    reasons.push('올드팝 계열');
  }
  if (/(커피|coffee|아침|morning)/i.test(text) && hasAny(haystack, ['morning', 'coffee', 'warm'])) {
    score += 2.5;
    reasons.push('아침/커피 청취 상황');
  }
  if (eraFocus.some(era => genre.eraTag && normalizeText(era).includes(normalizeText(genre.eraTag).slice(0, 4)))) {
    score += 1.5;
    reasons.push('시대 초점 일치');
  }

  return { genre, score, reasons };
}

function chooseGenreIds(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  refs: DecomposedReference[],
  eraFocus: string[],
  history: { recentGenreIds: string[] }
) {
  const candidates = genreLibrary.filter(genre => genreMatchesChannel(genre, channel));
  const ranked = candidates
    .map(genre => scoreGenre(genre, freeText, refs, eraFocus, channel, history))
    .sort((a, b) => b.score - a.score || a.genre.id.localeCompare(b.genre.id));
  const minimumForCap = clamp(Math.ceil(songCount / 5), 4, 8);
  const targetCount = clamp(Math.max(minimumForCap, ranked.filter(item => item.score >= 5).length >= 5 ? 5 : minimumForCap), 4, 8);
  const selected: string[] = [];
  const add = (id: string | undefined) => {
    if (!id || selected.includes(id)) return;
    const genre = getGenreById(id);
    if (!genre || !genreMatchesChannel(genre, channel)) return;
    selected.push(id);
  };

  for (const ref of refs) for (const id of ref.suggestedGenreIds) add(id);
  for (const item of ranked) {
    add(item.genre.id);
    if (selected.length >= targetCount) break;
  }
  for (const id of getCoreGenreIdsForArchetype(channel.archetype || 'senior-morning')) {
    add(id);
    if (selected.length >= targetCount) break;
  }
  return {
    selectedIds: selected.slice(0, targetCount),
    ranked
  };
}

/**
 * TASK v3.63 (TASK B-3) — a user checking 1+ GenreFamily boxes picks the
 * genre axis directly by musical similarity ("샹송+pop", "abba/카펜터스 계열")
 * instead of relying on free-text keyword scoring. Round-robins across the
 * selected families (rather than dumping one family's full member list
 * first) so a 2+ family pick actually blends, capped at 9 total ids
 * (membersPerFamilyForSelection already targets 4-9 for 1-2 families; the
 * cap here is what keeps 3+ families from exceeding it — see
 * genreFamilies.test.ts's own note on why that arithmetic needs a caller-side cap).
 */
const MAX_FAMILY_GENRE_SELECTION = 9;

function chooseGenreIdsFromFamilies(familyIds: string[], channel: ChannelProfile): { selectedIds: string[]; families: GenreFamily[] } {
  const families = familyIds
    .map(id => GENRE_FAMILIES.find(family => family.id === id))
    .filter((family): family is GenreFamily => Boolean(family));
  if (!families.length) return { selectedIds: [], families: [] };

  const perFamily = membersPerFamilyForSelection(families.length);
  const pools = families.map(family => family.memberGenreIds.filter(id => {
    const genre = getGenreById(id);
    return genre && genreMatchesChannel(genre, channel);
  }).slice(0, perFamily));

  const selected: string[] = [];
  let round = 0;
  while (selected.length < MAX_FAMILY_GENRE_SELECTION) {
    let addedThisRound = false;
    for (const pool of pools) {
      if (selected.length >= MAX_FAMILY_GENRE_SELECTION) break;
      const id = pool[round];
      if (id && !selected.includes(id)) {
        selected.push(id);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round += 1;
  }
  return { selectedIds: selected, families };
}

function countsFromSlots(ids: string[], songCount: number, maxPer?: number) {
  const counts: Record<string, number> = {};
  if (!ids.length || songCount <= 0) return counts;
  let index = 0;
  let guard = 0;
  while (Object.values(counts).reduce((sum, count) => sum + count, 0) < songCount && guard < songCount * ids.length * 2) {
    const id = ids[index % ids.length];
    if (!maxPer || (counts[id] || 0) < maxPer) counts[id] = (counts[id] || 0) + 1;
    index += 1;
    guard += 1;
    if (maxPer && ids.every(item => (counts[item] || 0) >= maxPer)) break;
  }
  return counts;
}

function exactBalancedCounts(ids: readonly string[], songCount: number) {
  const counts: Record<string, number> = {};
  if (!ids.length || songCount <= 0) return counts;
  for (let idx = 0; idx < songCount; idx += 1) {
    const id = ids[idx % ids.length];
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function vocalCounts(songCount: number) {
  return exactBalancedCounts(VOCAL_TYPE_IDS, songCount);
}

function povCounts(songCount: number): Record<string, number> {
  if (songCount <= 2) return { firstPerson: songCount };
  const variantCount = songCount >= 10 ? 3 : 2;
  return {
    firstPerson: songCount - variantCount,
    secondPerson: Math.max(1, variantCount - 1),
    thirdPerson: 1
  };
}

function buildBaseOptions(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  genreIds: string[],
  allocations: AxisAllocation[]
): GenerationOptions {
  return {
    channel,
    projectTitle: freeText.trim() || 'Set Plan',
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds,
    moodIds: inferMoodIds(freeText, channel),
    seasonId: inferSeasonId(freeText, channel),
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: freeText,
    referenceMood: '',
    genreBlendWeights: {},
    customLyricThemeScene: '',
    avoidWords: channel.forbiddenCliches.join(', '),
    negativeStyle: '',
    introUniqueness: 100,
    diversityAllocations: allocations,
    personaMode: false,
    earwormMode: true
  };
}

function makeAllocations(freeText: string, channel: ChannelProfile, songCount: number, genreIds: string[]): AxisAllocation[] {
  const emptyBase = buildBaseOptions(freeText, channel, songCount, genreIds, []);
  const lyricThemes = lyricThemesForOptions(emptyBase).slice(0, songCount);
  const introIds = introTexturesForArchetype(channel.archetype || 'senior-morning').map(texture => texture.id);
  const hookIds = hookDevices.map(device => device.id);
  const structureIds = ADULT_STRUCTURE_TEMPLATE_IDS;
  const genreAllocation = allocateGenreCounts(genreIds, songCount);

  return [
    {
      axis: 'genre',
      mode: 'manual',
      counts: Object.fromEntries(genreAllocation.map(slot => [slot.genreId, slot.songCount]))
    },
    { axis: 'vocalType', mode: 'manual', counts: vocalCounts(songCount) },
    { axis: 'introTexture', mode: 'manual', counts: countsFromSlots(introIds, songCount, 4) },
    { axis: 'hookDevice', mode: 'manual', counts: countsFromSlots(hookIds, songCount, 4) },
    { axis: 'arrangementDensity', mode: 'manual', counts: exactBalancedCounts(ARRANGEMENT_DENSITY_IDS, songCount) },
    { axis: 'structureTemplate', mode: 'manual', counts: exactBalancedCounts(structureIds, songCount) },
    { axis: 'lyricTheme', mode: 'manual', counts: Object.fromEntries(lyricThemes.map(theme => [theme.id, 1])) },
    { axis: 'pov', mode: 'manual', counts: povCounts(songCount) }
  ] satisfies AxisAllocation[];
}

function allocationCurrent(allocation: AxisAllocation) {
  return Object.entries(allocation.counts).map(([id, count]) => ({ id, count }));
}

function makeAdjustables(allocations: AxisAllocation[], ranked: RankedGenre[]): SetPlan['adjustables'] {
  return allocations.map(allocation => {
    const alternatives = allocation.axis === 'genre'
      ? ranked
        .filter(item => !allocation.counts[item.genre.id])
        .slice(0, 6)
        .map(item => ({
          id: item.genre.id,
          labelKo: item.genre.label,
          whyKo: item.reasons.slice(0, 2).join(', ') || `${item.genre.tier || 'extended'} 후보`
        }))
      : [];
    return {
      axis: allocation.axis,
      labelKo: AXIS_LABEL_KO[allocation.axis],
      current: allocationCurrent(allocation),
      alternatives
    };
  });
}

function intentSummaryKo(freeText: string, eraFocus: string[], genreIds: string[], families: GenreFamily[]) {
  const genreLabels = genreIds.map(id => getGenreById(id)?.label || id).slice(0, 4).join(', ');
  const eraText = eraFocus.length ? eraFocus.join(', ') : '채널 기본 올드팝/성인 팝';
  if (families.length) {
    const familyLabels = families.map(family => family.labelKo).join(' + ');
    return `${familyLabels} 패밀리${freeText.trim() ? ` + "${freeText.trim()}"` : ''} 입력을 ${eraText} 중심의 ${genreLabels} 세트로 해석했습니다.`;
  }
  return `"${freeText.trim() || '무지정'}" 입력을 ${eraText} 중심의 ${genreLabels} 세트로 해석했습니다.`;
}

export function directSetLocal(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  history: { recentGenreIds: string[]; recentHooks: string[] },
  /** v3.63 (TASK B) — GenreFamily ids from Step2Concept's family picker. When non-empty, these choose the genre axis directly (see chooseGenreIdsFromFamilies); free text still drives era/mood/season/artist-reference interpretation either way. */
  familyIds: string[] = []
): SetPlan {
  const safeSongCount = clamp(Math.round(songCount) || 18, 1, 80);
  const artistReferences = decomposeArtistReferences(freeText).filter(isSafeDecomposedReference);
  const eraFocus = deriveEraFocus(freeText, artistReferences);
  const { selectedIds: keywordSelectedIds, ranked } = chooseGenreIds(freeText, channel, safeSongCount, artistReferences, eraFocus, history);
  const { selectedIds: familySelectedIds, families } = chooseGenreIdsFromFamilies(familyIds, channel);
  const selectedIds = familySelectedIds.length ? familySelectedIds : keywordSelectedIds;
  const allocations = makeAllocations(freeText, channel, safeSongCount, selectedIds);
  const opts = buildBaseOptions(freeText, channel, safeSongCount, selectedIds, allocations);
  const selectedIdSet = new Set(selectedIds);
  const genres = genreLibrary.filter(genre => selectedIdSet.has(genre.id));
  const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: history.recentHooks });
  const densityAllocation = allocations.find(allocation => allocation.axis === 'arrangementDensity');
  const densityMax = densityAllocation ? Math.max(...Object.values(densityAllocation.counts)) : 0;
  const warnings = [
    ...(selectedIds.length < 4 ? ['장르 후보가 4종 미만입니다. 채널 필터 또는 입력 키워드를 확인하십시오.'] : []),
    ...(densityMax > 5 ? ['arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다.'] : [])
  ];
  return {
    interpretation: {
      intentKo: intentSummaryKo(freeText, eraFocus, selectedIds, families),
      eraFocus,
      familyIds: families.map(family => family.id),
      artistReferences,
      audienceProfileId: channel.archetype || channel.audience,
      reasoningKo: [
        `장르 후보는 core/extended 구분 없이 ${totalGenreCount}종 전체에서 보되, ${channel.archetype || 'senior-morning'} 채널에 맞는 후보로 1차 필터했습니다.`,
        families.length
          ? `선택한 패밀리 ${families.map(family => family.labelKo).join(', ')}에서 ${selectedIds.length}개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.`
          : `${selectedIds.length}개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.`,
        '보컬은 남성/여성/듀엣 축을 균등 배분하고, 구조 템플릿은 5종을 순환시켰습니다.',
        '인트로/훅 장치/밀도는 문구가 아니라 그룹 제약으로 브릿지에 전달합니다.'
      ]
    },
    allocations,
    slots,
    adjustables: makeAdjustables(allocations, ranked),
    warnings
  };
}
