import { describe, expect, it } from 'vitest';
import { DESIGN_GATE_ITEM_IDS } from '../src/core/auditItemIds';
import { GATE_DATA_CONTRACTS } from '../src/core/gateDataContract';
import type { ChannelProfile, GenerationOptions } from '../src/types';

/**
 * 지시문 12 (TASK B) — "requires 가 없는 관문은 등록을 거부한다"는 재발 방지
 * 규칙의 실제 강제 장치. tests/auditItemIds.test.ts의 드리프트 테스트 패턴을
 * 그대로 따른다: 새 관문 id가 designGate.ts에 추가되고 이 레지스트리에
 * requires가 등록되지 않으면 이 테스트가 즉시 실패한다.
 */

describe('[지시문 12 TASK B] every DESIGN_GATE_ITEM_IDS id has a registered GateDataContract', () => {
  it('GATE_DATA_CONTRACTS covers every design-gate id with no drift', () => {
    for (const id of Object.values(DESIGN_GATE_ITEM_IDS)) {
      expect(GATE_DATA_CONTRACTS[id], `gate id "${id}" is missing a GateDataContract.requires registration`).toBeDefined();
      expect(GATE_DATA_CONTRACTS[id].gateId).toBe(id);
    }
  });

  it('GATE_DATA_CONTRACTS has no stray keys that are not a real design-gate id', () => {
    const realIds = new Set(Object.values(DESIGN_GATE_ITEM_IDS) as string[]);
    for (const key of Object.keys(GATE_DATA_CONTRACTS)) {
      expect(realIds.has(key), `GATE_DATA_CONTRACTS has a stray key "${key}" not in DESIGN_GATE_ITEM_IDS`).toBe(true);
    }
  });
});

const CHANNEL: ChannelProfile = {
  id: 'test-channel',
  name: 'Test Channel',
  market: 'custom',
  primaryLanguage: 'english',
  audience: 'seniors',
  promise: 'test',
  visualIdentity: 'test',
  defaultVocal: 'mature soulful male tenor',
  preferredGenres: ['oldpop-soft-rock-am', 'oldpop-adult-contemporary-80s', 'oldpop-europop-glow', 'oldpop-british-beat', 'oldpop-close-harmony-duo'],
  preferredMoods: ['nostalgic'],
  forbiddenCliches: [],
  seoKeywords: [],
  archetype: 'senior-morning'
};

function baseOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return {
    channel: CHANNEL,
    projectTitle: 'test',
    songCount: 18,
    lyricLanguage: 'english',
    market: 'custom',
    audience: 'seniors',
    genreIds: CHANNEL.preferredGenres,
    moodIds: ['nostalgic'],
    seasonId: 'spring',
    vocalTone: CHANNEL.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    personaMode: false,
    ...overrides
  };
}

describe('[지시문 12 TASK B] every requires() returns a well-shaped GateDataContractResult without throwing', () => {
  it.each(Object.entries(GATE_DATA_CONTRACTS))('%s', (_id, contract) => {
    const result = contract.requires(CHANNEL, baseOpts());
    expect(typeof result.satisfiable).toBe('boolean');
    expect(typeof result.reasonKo).toBe('string');
    expect(typeof result.observed).toBe('string');
    expect(typeof result.needed).toBe('string');
  });
});

describe('[지시문 12 TASK B] real measured case — senior-morning "60년대" concept with a 1970s-heavy genre pool', () => {
  it('era-primary-share reports unsatisfiable when the channel has no 1950s-60s genres at all', () => {
    const channel: ChannelProfile = {
      ...CHANNEL,
      preferredGenres: ['oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-piano-ballad-70s']
    };
    const opts = baseOpts({ channel, genreIds: channel.preferredGenres, customConcept: '60년대 올드팝' });
    const result = GATE_DATA_CONTRACTS[DESIGN_GATE_ITEM_IDS.eraPrimaryShare].requires(channel, opts);
    expect(result.satisfiable).toBe(false);
  });

  it('era-primary-share reports satisfiable once enough 1950s-60s genres are in the pool', () => {
    const channel: ChannelProfile = {
      ...CHANNEL,
      preferredGenres: ['oldpop-doowop-harmony', 'oldpop-brill-building', 'oldpop-british-beat']
    };
    const opts = baseOpts({ channel, genreIds: channel.preferredGenres, customConcept: '60년대 올드팝' });
    const result = GATE_DATA_CONTRACTS[DESIGN_GATE_ITEM_IDS.eraPrimaryShare].requires(channel, opts);
    expect(result.satisfiable).toBe(true);
  });
});
