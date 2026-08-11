import { describe, expect, it } from 'vitest';
import { VERIFIED_SETTING_CONTRACTS, inScope } from '../src/core/verifiedSettingContract';
import type { ChannelProfile } from '../src/types';

/**
 * 지시문 12 (TASK C) — VerifiedSettingContract 레지스트리의 드리프트 방지 +
 * 실제 측정된 결함(oldpoplounge)의 재현 테스트.
 */

describe('[지시문 12 TASK C] VERIFIED_SETTING_CONTRACTS registers at least 9 settings, none throwing', () => {
  it('has at least 9 registered settings', () => {
    expect(VERIFIED_SETTING_CONTRACTS.length).toBeGreaterThanOrEqual(9);
  });

  const CHANNEL: ChannelProfile = {
    id: 'test-channel',
    name: 'Test Channel',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: 'test',
    visualIdentity: 'test',
    defaultVocal: 'mature soulful male tenor',
    preferredGenres: ['oldpop-soft-rock-am'],
    preferredMoods: ['nostalgic'],
    forbiddenCliches: [],
    seoKeywords: [],
    archetype: 'senior-morning'
  };

  it.each(VERIFIED_SETTING_CONTRACTS.map(c => [c.settingId, c] as const))('%s check() does not throw and returns a well-shaped result', (_id, contract) => {
    if (!inScope(CHANNEL, contract)) return;
    const result = contract.check(CHANNEL);
    expect(['applied', 'lost', 'n/a']).toContain(result.status);
    expect(typeof result.observed).toBe('string');
    expect(typeof result.expected).toBe('string');
  });
});

describe('[지시문 12 TASK C] 실측 재현 — oldpoplounge 유형 커스텀 채널 (archetype: oldpop-lounge, audience 필드가 시니어가 아닌 경우)', () => {
  const OLDPOP_LOUNGE_CUSTOM: ChannelProfile = {
    id: 'oldpoplounge',
    name: '올드팝 라운지',
    market: 'korea',
    primaryLanguage: 'english',
    // 실측 버그의 핵심 — 커스텀 채널 생성 시 audience가 시니어로 설정되지
    // 않은 경우를 재현한다.
    audience: 'general',
    promise: 'test',
    visualIdentity: 'test',
    defaultVocal: 'mature soulful male tenor',
    preferredGenres: ['oldpop-soft-rock-am'],
    preferredMoods: ['nostalgic'],
    forbiddenCliches: [],
    seoKeywords: [],
    archetype: 'oldpop-lounge'
  };

  it('tempo-ceiling is applied (100) despite audience:"general" — TASK C-1 fix', () => {
    const contract = VERIFIED_SETTING_CONTRACTS.find(c => c.settingId === 'tempo-ceiling')!;
    expect(inScope(OLDPOP_LOUNGE_CUSTOM, contract)).toBe(true);
    const result = contract.check(OLDPOP_LOUNGE_CUSTOM);
    expect(result.status).toBe('applied');
  });

  it('title-localized survives a packagingLanguage=english override — TASK C-2 fix', () => {
    const contract = VERIFIED_SETTING_CONTRACTS.find(c => c.settingId === 'title-localized')!;
    expect(inScope(OLDPOP_LOUNGE_CUSTOM, contract)).toBe(true);
    const result = contract.check(OLDPOP_LOUNGE_CUSTOM);
    expect(result.status).toBe('applied');
  });
});

describe('Fable5 2단계 §5 — channel-sound-floor의 required/optional/N-A 재정의', () => {
  const channelFor = (archetype: ChannelProfile['archetype']): ChannelProfile => ({
    id: `test-${archetype}`,
    name: 'Test Channel',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'general',
    promise: 'test',
    visualIdentity: 'test',
    defaultVocal: 'test vocal',
    preferredGenres: [],
    preferredMoods: [],
    forbiddenCliches: [],
    seoKeywords: [],
    archetype
  });

  it('senior-morning (floor 실제 있음) — applied', () => {
    const contract = VERIFIED_SETTING_CONTRACTS.find(c => c.settingId === 'channel-sound-floor')!;
    expect(contract.check(channelFor('senior-morning')).status).toBe('applied');
  });

  it('modern-chill (floor 없음, 워크스페이스 자체엔 floor 있음 — 의도적 제외) — n/a, not lost', () => {
    const contract = VERIFIED_SETTING_CONTRACTS.find(c => c.settingId === 'channel-sound-floor')!;
    const result = contract.check(channelFor('modern-chill'));
    expect(result.status).toBe('n/a');
    expect(result.reasonKo).toBeTruthy();
  });

  it('kids (floor 없음, 같은 이유) — n/a', () => {
    const contract = VERIFIED_SETTING_CONTRACTS.find(c => c.settingId === 'channel-sound-floor')!;
    expect(contract.check(channelFor('kids')).status).toBe('n/a');
  });
});
