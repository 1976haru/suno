export interface AvoidWordPreset {
  id: string;
  label: string;
  note?: string;
  phrase: string;
  defaultOn: boolean;
}

export const avoidWordPresets: AvoidWordPreset[] = [
  { id: 'real-artists', label: '실존 가수·밴드 이름', note: '저작권 위험', phrase: 'real artist or band names', defaultOn: true },
  { id: 'existing-titles', label: '기존 곡 제목', phrase: 'existing song titles', defaultOn: true },
  { id: 'artist-imitation', label: '특정 가수를 흉내내는 표현', phrase: "imitating a specific singer's voice or style", defaultOn: true },
  { id: 'religious', label: '종교적 표현', phrase: 'religious references', defaultOn: false },
  { id: 'political', label: '정치적 표현', phrase: 'political references', defaultOn: false }
];

export function defaultAvoidWordsString(): string {
  return avoidWordPresets.filter(preset => preset.defaultOn).map(preset => preset.phrase).join(', ');
}

export function parseAvoidWords(value: string): string[] {
  return value.split(/[,;]/).map(part => part.trim()).filter(Boolean);
}

export function joinAvoidWords(list: string[]): string {
  return list.join(', ');
}
