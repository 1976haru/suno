import { describe, expect, it } from 'vitest';
import { buildSetName, parseSetName, type SetNameParts } from '../src/utils/setNaming';

/** v3.69 (TASK B) — one filename scheme shared by every set-level export. */

function normalize(parts: SetNameParts) {
  return { ...parts, sequence: parts.sequence ?? 1 };
}

describe('[v3.69 TASK B] buildSetName', () => {
  it('Korean channel name', () => {
    const name = buildSetName({ date: new Date(2026, 6, 31), channelLabel: '굿모닝 추억라디오', conceptLabel: '비 오는 날의 올드팝' });
    expect(name).toBe('20260731_굿모닝추억라디오_비오는날의올드팝');
  });

  it('long concept name truncated to 20 characters', () => {
    const longConcept = '아주 길고 긴 컨셉 설명이 이어지고 계속해서 더 길어지는 예시 문장입니다';
    const name = buildSetName({ date: new Date(2026, 6, 31), channelLabel: '올드팝라운지', conceptLabel: longConcept });
    const conceptPart = name.split('_')[2];
    expect(conceptPart.length).toBeLessThanOrEqual(20);
  });

  it('special characters are stripped, not replaced with underscores (so they never collide with the separator)', () => {
    const name = buildSetName({ date: new Date(2026, 6, 31), channelLabel: 'City Night Drive!', conceptLabel: 'lo-fi & chill (vol.2)' });
    expect(name).toBe('20260731_CityNightDrive_lofichillvol2');
  });

  it('same-day duplicate uses a _02 / _03 suffix, first occurrence has none', () => {
    const first = buildSetName({ date: new Date(2026, 6, 31), channelLabel: 'chill', conceptLabel: 'study' });
    const second = buildSetName({ date: new Date(2026, 6, 31), channelLabel: 'chill', conceptLabel: 'study', sequence: 2 });
    const third = buildSetName({ date: new Date(2026, 6, 31), channelLabel: 'chill', conceptLabel: 'study', sequence: 3 });
    expect(first).toBe('20260731_chill_study');
    expect(second).toBe('20260731_chill_study_02');
    expect(third).toBe('20260731_chill_study_03');
  });

  it('missing concept falls back to a generic label rather than an empty segment', () => {
    const name = buildSetName({ date: new Date(2026, 6, 31), channelLabel: '키즈', conceptLabel: '' });
    expect(name).toBe('20260731_키즈_set');
  });
});

describe('[v3.69 TASK B] parseSetName — round trip', () => {
  const cases: SetNameParts[] = [
    { date: new Date(2026, 6, 31), channelLabel: '굿모닝추억라디오', conceptLabel: '비오는날의올드팝' },
    { date: new Date(2026, 0, 1), channelLabel: 'CityNightDrive', conceptLabel: 'lofichillvol2' },
    { date: new Date(2025, 11, 25), channelLabel: 'chill', conceptLabel: 'study', sequence: 2 },
    { date: new Date(2026, 6, 31), channelLabel: '키즈', conceptLabel: 'set' }
  ];

  it.each(cases.map(c => [c] as const))('round-trips %o', (parts) => {
    const built = buildSetName(parts);
    const parsed = parseSetName(built);
    expect(parsed).not.toBeNull();
    expect(normalize(parsed!)).toEqual(normalize(parts));
  });

  it('returns null for a name with no YYYYMMDD prefix (pre-v3.69 files like plain songs-output)', () => {
    expect(parseSetName('songs-output')).toBeNull();
    expect(parseSetName('songs-output-set01')).toBeNull();
  });

  it('returns null for too few segments', () => {
    expect(parseSetName('20260731_onlychannel')).toBeNull();
  });

  it('strips a file extension before parsing', () => {
    const parsed = parseSetName('20260731_chill_study.json');
    expect(parsed?.channelLabel).toBe('chill');
    expect(parsed?.conceptLabel).toBe('study');
  });

  it('rejects an invalid calendar date', () => {
    expect(parseSetName('20261332_chill_study')).toBeNull();
  });
});
