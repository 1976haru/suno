import type { ChannelArchetype } from '../types';

export interface LyricThemeOption {
  id: string;
  labelKo: string;
  labelEn: string;
  suitedArchetypes?: ChannelArchetype[];
}

export const adultLyricThemes: LyricThemeOption[] = [
  { id: 'coffee steam', labelKo: '커피 김', labelEn: 'Coffee steam', suitedArchetypes: ['showa-cafe', 'senior-morning'] },
  { id: 'old radio light', labelKo: '오래된 라디오 불빛', labelEn: 'Old radio light', suitedArchetypes: ['showa-cafe', 'senior-morning'] },
  { id: 'window rain', labelKo: '창가의 비', labelEn: 'Window rain', suitedArchetypes: ['showa-cafe', 'senior-morning', 'lofi-study'] },
  { id: 'folded letter', labelKo: '접힌 편지', labelEn: 'Folded letter', suitedArchetypes: ['senior-morning', 'showa-cafe'] },
  { id: 'street lamp', labelKo: '가로등', labelEn: 'Street lamp', suitedArchetypes: ['showa-cafe', 'lofi-study'] },
  { id: 'wool sweater', labelKo: '울 스웨터', labelEn: 'Wool sweater', suitedArchetypes: ['senior-morning'] },
  { id: 'paper calendar', labelKo: '종이 달력', labelEn: 'Paper calendar', suitedArchetypes: ['senior-morning', 'showa-cafe'] },
  { id: 'warm cafe window', labelKo: '따뜻한 카페 창', labelEn: 'Warm cafe window', suitedArchetypes: ['showa-cafe'] },
  { id: 'candle flame', labelKo: '촛불', labelEn: 'Candle flame', suitedArchetypes: ['senior-morning', 'showa-cafe'] },
  { id: 'faded photograph', labelKo: '빛바랜 사진', labelEn: 'Faded photograph', suitedArchetypes: ['senior-morning', 'showa-cafe'] },
  { id: 'train ticket', labelKo: '기차표', labelEn: 'Train ticket', suitedArchetypes: ['senior-morning', 'showa-cafe'] },
  { id: 'quiet doorway', labelKo: '조용한 문가', labelEn: 'Quiet doorway', suitedArchetypes: ['senior-morning'] },
  { id: 'porcelain cup', labelKo: '도자기 컵', labelEn: 'Porcelain cup', suitedArchetypes: ['showa-cafe', 'senior-morning'] },
  { id: 'evening train', labelKo: '저녁 기차', labelEn: 'Evening train', suitedArchetypes: ['senior-morning', 'showa-cafe'] },
  { id: 'small notebook', labelKo: '작은 수첩', labelEn: 'Small notebook', suitedArchetypes: ['showa-cafe', 'lofi-study'] }
];

export const kidsLyricThemes: LyricThemeOption[] = [
  { id: 'animal', labelKo: '동물 친구', labelEn: 'Animal friends', suitedArchetypes: ['kids'] },
  { id: 'season', labelKo: '계절 놀이', labelEn: 'Season play', suitedArchetypes: ['kids'] },
  { id: 'family', labelKo: '가족', labelEn: 'Family', suitedArchetypes: ['kids'] },
  { id: 'friend', labelKo: '친구', labelEn: 'Friends', suitedArchetypes: ['kids'] },
  { id: 'play', labelKo: '놀이', labelEn: 'Play', suitedArchetypes: ['kids'] },
  { id: 'school', labelKo: '학교', labelEn: 'School', suitedArchetypes: ['kids'] },
  { id: 'counting', labelKo: '숫자 세기', labelEn: 'Counting', suitedArchetypes: ['kids'] },
  { id: 'hangul', labelKo: '글자 놀이', labelEn: 'Letters', suitedArchetypes: ['kids'] }
];

export function lyricThemesForArchetype(archetype: ChannelArchetype | undefined): LyricThemeOption[] {
  if (archetype === 'kids') return kidsLyricThemes;
  const suited = adultLyricThemes.filter(theme => !archetype || theme.suitedArchetypes?.includes(archetype));
  return suited.length >= 6 ? suited : adultLyricThemes;
}

export function getLyricThemeLabel(id: string | undefined, archetype?: ChannelArchetype): string {
  if (!id) return '-';
  return lyricThemesForArchetype(archetype).find(theme => theme.id === id)?.labelEn || id;
}
