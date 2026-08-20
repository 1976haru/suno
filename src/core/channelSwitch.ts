import type { ChannelProfile, GenerationOptions, LyricLanguage } from '../types';
import { normalizeGenreSelection, sanitizeGenreIdsForArchetype } from './genreSelection';
import { defaultPackagingLanguageForChannel } from './packagingLanguage';
import { detectProvenanceDowngrades } from './userChoices';
import { GENRE_FAMILIES } from '../data/genreFamilies';
import { getGenreById, isGenreEligibleForArchetype } from '../data/genreLibrary';
import { allocationForAxis, replaceAxisAllocation } from './diversityAllocation';

export interface ChannelSwitchResult {
  opts: GenerationOptions;
  /** 사용자에게 보여줄 변경 내역 — 조용히 남기지도, 조용히 지우지도 않는다. */
  changesKo: string[];
}

const LANGUAGE_LABEL_KO: Record<LyricLanguage, string> = {
  korean: '한국어',
  english: '영어',
  japanese: '일본어',
  bilingual: '영어+한국어 혼합'
};

/**
 * Fable5 1단계 TASK E — 채널 전환 원자화. App.tsx의 applyChannelToOptions가
 * 이미 처리하던 lyricLanguage/genreIds/moodIds/vocalTone/kidsAgeTierId/
 * packagingLanguage/choiceProvenance 리셋을 그대로 가져오되(동작 변화 없음),
 * 이전에는 손대지 않던 diversityAllocations의 genre 축 manual counts ·
 * selectedGenreFamilyIds · genreBlendWeights를 새 채널 기준으로 정리하고,
 * genreIds 자체도 provenance가 'user'면 새 채널에서 여전히 쓸 수 있는 만큼
 * 유지한다(기존에는 항상 채널 기본값으로 리셋됐다 — E-2가 요구하는 "유지"
 * 정책으로 바뀐 지점).
 *
 * listeningIntent는 값을 지우지 않는다 — core/listeningIntent.ts의
 * applyListeningIntentIfPending이 생성 직전 새 채널의 장르 풀 기준으로 이미
 * 다시 계산하도록 설계돼 있다(지시문 30). 여기서는 그 재계산이 조용히
 * 일어나지 않도록 changesKo에 미리 알릴 뿐, 재계산 로직 자체는 건드리지
 * 않는다.
 *
 * lyricLanguage의 유지/리셋 여부(keepUserLanguage)는 호출자가 결정해
 * 넘긴다 — window.confirm은 부수효과라 순수 함수 안에서 부르지 않는다
 * (App.tsx가 지금도 그렇게 하고 있던 방식 그대로).
 */
export function reconcileOptionsForChannelSwitch(
  previousOpts: GenerationOptions,
  newChannel: ChannelProfile,
  keepUserLanguage: boolean
): ChannelSwitchResult {
  const archetype = newChannel.archetype || 'senior-morning';
  const changesKo: string[] = [];

  const genreIdsAreUserPicked = previousOpts.choiceProvenance?.genreIds === 'user';
  const genreSource = genreIdsAreUserPicked ? previousOpts.genreIds : newChannel.preferredGenres;
  const { valid: sanitizedGenreIds, removed: removedGenreIds } = sanitizeGenreIdsForArchetype(genreSource, archetype);
  const nextGenreIds = normalizeGenreSelection(sanitizedGenreIds);
  // removedGenreIds.length === genreSource.length only when every id was
  // foreign and sanitizeGenreIdsForArchetype recovered to the archetype's
  // own default set (see that function's own doc comment) — that's a full
  // reset, not a partial keep, so provenance goes back to 'channel'.
  const genreIdsKept = genreIdsAreUserPicked && sanitizedGenreIds.length > 0 && removedGenreIds.length < genreSource.length;
  if (genreIdsAreUserPicked && removedGenreIds.length) {
    changesKo.push(`이전 선택 중 장르 ${removedGenreIds.length}개는 이 채널에서 사용할 수 없어 제외했습니다 · ${removedGenreIds.join(' · ')}`);
  }

  const genreAllocation = allocationForAxis(previousOpts.diversityAllocations, 'genre');
  let nextDiversityAllocations = previousOpts.diversityAllocations;
  if (genreAllocation?.mode === 'manual') {
    const validGenreIdSet = new Set(nextGenreIds);
    const filteredCounts = Object.fromEntries(Object.entries(genreAllocation.counts).filter(([id]) => validGenreIdSet.has(id)));
    const droppedCount = Object.keys(genreAllocation.counts).length - Object.keys(filteredCounts).length;
    if (droppedCount > 0) {
      changesKo.push(`직접 지정한 장르별 곡수 배분 중 ${droppedCount}개 항목이 새 채널에 없는 장르라 제거되었습니다.`);
    }
    nextDiversityAllocations = Object.keys(filteredCounts).length
      ? replaceAxisAllocation(previousOpts.diversityAllocations, { axis: 'genre', mode: 'manual', counts: filteredCounts })
      : replaceAxisAllocation(previousOpts.diversityAllocations, undefined);
  }

  const previousFamilyIds = previousOpts.selectedGenreFamilyIds;
  let nextFamilyIds = previousFamilyIds;
  if (previousFamilyIds?.length) {
    nextFamilyIds = previousFamilyIds.filter(familyId => {
      const family = GENRE_FAMILIES.find(f => f.id === familyId);
      return family?.memberGenreIds.some(id => {
        const genre = getGenreById(id);
        return genre && isGenreEligibleForArchetype(genre, archetype);
      });
    });
    if (nextFamilyIds.length < previousFamilyIds.length) {
      changesKo.push(`선택했던 장르 계열 중 ${previousFamilyIds.length - nextFamilyIds.length}개는 이 채널에서 쓸 수 있는 장르가 없어 제외했습니다.`);
    }
  }

  const previousBlendWeights = previousOpts.genreBlendWeights;
  let nextBlendWeights = previousBlendWeights;
  if (previousBlendWeights) {
    const validGenreIdSet = new Set(nextGenreIds);
    const filtered = Object.fromEntries(Object.entries(previousBlendWeights).filter(([id]) => validGenreIdSet.has(id)));
    nextBlendWeights = Object.keys(filtered).length ? filtered : undefined;
  }

  if (previousOpts.listeningIntent) {
    changesKo.push('청취 목적 배분은 생성 시점에 새 채널의 장르 풀 기준으로 다시 계산됩니다.');
  }

  const nextPackagingLanguage = defaultPackagingLanguageForChannel(newChannel);
  const nextLyricLanguage = keepUserLanguage ? previousOpts.lyricLanguage : newChannel.primaryLanguage;
  if (keepUserLanguage) {
    changesKo.push(`언어 설정(${LANGUAGE_LABEL_KO[nextLyricLanguage]})은 유지했습니다. 이 채널의 기본은 ${LANGUAGE_LABEL_KO[newChannel.primaryLanguage]}입니다.`);
  }

  const arraysDiffer = (a: readonly string[], b: readonly string[]) => a.length !== b.length || [...a].sort().join('') !== [...b].sort().join('');
  const otherDowngrades = detectProvenanceDowngrades(previousOpts.choiceProvenance, [
    { field: 'vocalTone', labelKo: '보컬 톤', valueChanged: previousOpts.vocalTone !== newChannel.defaultVocal },
    { field: 'kidsAgeTierId', labelKo: '연령대', valueChanged: previousOpts.kidsAgeTierId !== newChannel.kidsAgeTierId },
    { field: 'packagingLanguage', labelKo: '제목/썸네일 언어', valueChanged: previousOpts.packagingLanguage !== nextPackagingLanguage },
    { field: 'moodIds', labelKo: '무드', valueChanged: arraysDiffer(previousOpts.moodIds, newChannel.preferredMoods) }
  ]);
  if (otherDowngrades.length) {
    changesKo.push(`채널 변경으로 직접 선택하신 ${otherDowngrades.map(d => d.labelKo).join(', ')} 설정이 채널 기본값으로 되돌아갔습니다.`);
  }

  const opts: GenerationOptions = {
    ...previousOpts,
    channel: newChannel,
    market: newChannel.market,
    audience: newChannel.audience,
    lyricLanguage: nextLyricLanguage,
    genreIds: nextGenreIds,
    moodIds: newChannel.preferredMoods,
    vocalTone: newChannel.defaultVocal,
    kidsAgeTierId: newChannel.kidsAgeTierId,
    packagingLanguage: nextPackagingLanguage,
    diversityAllocations: nextDiversityAllocations,
    selectedGenreFamilyIds: nextFamilyIds,
    genreBlendWeights: nextBlendWeights,
    choiceProvenance: {
      ...previousOpts.choiceProvenance,
      lyricLanguage: keepUserLanguage ? 'user' : 'channel',
      genreIds: genreIdsKept ? 'user' : 'channel',
      vocalTone: 'channel',
      kidsAgeTierId: 'channel',
      packagingLanguage: 'channel',
      moodIds: 'channel'
    }
  };

  return { opts, changesKo };
}
