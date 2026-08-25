import { describe, expect, it } from 'vitest';
import {
  classifyTitleHookRelationship,
  checkTitleHookRelationships,
  maxDisconnectedAllowed,
  titleWordCountShape,
  excessSharedAffixWord,
  TITLE_HOOK_RELATIONSHIP_POLICY
} from '../src/core/titleHookRelationship';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { ChannelArchetype, WorkspaceId } from '../src/types';

/**
 * codex 지시문 03 (TASK I) — real gap this closes: no TitleHookRelationship
 * taxonomy existed (only two blunt separate signals — see
 * src/core/titleHookRelationship.ts's own doc comment for how 'exact' and
 * 'disconnected' are defined to MATCH those two existing signals exactly,
 * not diverge from them).
 */
describe('[codex 지시문 03 TASK I] classifyTitleHookRelationship', () => {
  it('exact — case/whitespace-insensitive equality', () => {
    expect(classifyTitleHookRelationship('Stay With Me Tonight', 'stay with me tonight')).toBe('exact');
  });

  it('near — one contains the other verbatim', () => {
    expect(classifyTitleHookRelationship('Stay With Me', 'Stay With Me Tonight')).toBe('near');
  });

  it('near — high word overlap without containment', () => {
    expect(classifyTitleHookRelationship('Hold My Hand Tonight', 'Hold My Hand Forever')).toBe('near');
  });

  it('semantic — shares a real word but under the near threshold', () => {
    expect(classifyTitleHookRelationship('Blue Cup', 'Steam Rises From the Cup Tonight')).toBe('semantic');
  });

  it('disconnected — shares no word at all (matches core/quality.ts\'s own titleHookOverlapWarning trigger exactly)', () => {
    expect(classifyTitleHookRelationship('Blue Cup', 'I Still Believe')).toBe('disconnected');
  });

  it('disconnected for an empty title or hook', () => {
    expect(classifyTitleHookRelationship('', 'Hold My Hand')).toBe('disconnected');
    expect(classifyTitleHookRelationship('Blue Cup', '')).toBe('disconnected');
  });

  it('works for real Korean text via whitespace tokenization (not ASCII-only)', () => {
    expect(classifyTitleHookRelationship('오늘도 좋은 하루', '오늘도 좋은 하루')).toBe('exact');
    expect(classifyTitleHookRelationship('사랑해요', '완전히 다른 문장입니다')).toBe('disconnected');
  });
});

describe('[codex 지시문 03 TASK I] common rules', () => {
  it('maxDisconnectedAllowed scales proportionally (2/18 baseline)', () => {
    expect(maxDisconnectedAllowed(18)).toBe(2);
    expect(maxDisconnectedAllowed(6)).toBeGreaterThanOrEqual(1);
    expect(maxDisconnectedAllowed(0)).toBeGreaterThanOrEqual(1);
  });

  it('titleWordCountShape buckets by word count', () => {
    expect(titleWordCountShape('Blue')).toBe('short');
    expect(titleWordCountShape('Blue Cup Memory')).toBe('mid');
    expect(titleWordCountShape('The Long Road Home Tonight Again')).toBe('long');
  });

  it('excessSharedAffixWord flags a real shared prefix across more than half the pack', () => {
    const finding = excessSharedAffixWord(['Blue Morning', 'Blue Evening', 'Blue Afternoon', 'Red Sky']);
    expect(finding).toBeDefined();
    expect(finding?.word).toBe('blue');
  });

  it('excessSharedAffixWord does not flag a genuinely varied title set', () => {
    expect(excessSharedAffixWord(['Blue Morning', 'Red Evening', 'Green Afternoon', 'Gold Sky'])).toBeUndefined();
  });

  it('every real workspace has a real policy entry', () => {
    const ids: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];
    for (const id of ids) {
      expect(TITLE_HOOK_RELATIONSHIP_POLICY[id]?.leanKo).toBeTruthy();
    }
  });
});

describe('[codex 지시문 03 TASK I] checkTitleHookRelationships', () => {
  it('flags a pack with too many disconnected title-hook pairs', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 1, title: `Title ${i}`, hookPhrase: `Unrelated Hook Phrase ${i * 99}` }));
    const report = checkTitleHookRelationships(songs);
    expect(report.disconnectedOverQuota).toBe(true);
  });

  it('does not flag a pack within the disconnected quota', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 1, title: `Hold On Tonight ${i}`, hookPhrase: `Hold On Tonight ${i}` }));
    const report = checkTitleHookRelationships(songs);
    expect(report.disconnectedOverQuota).toBe(false);
  });

  it('flags a pack where one title shape exceeds 50%', () => {
    const songs = [
      { trackNo: 1, title: 'Blue', hookPhrase: 'Blue' },
      { trackNo: 2, title: 'Red', hookPhrase: 'Red' },
      { trackNo: 3, title: 'Gold', hookPhrase: 'Gold' },
      { trackNo: 4, title: 'The Long Road Home Tonight', hookPhrase: 'The Long Road Home Tonight' }
    ];
    const report = checkTitleHookRelationships(songs);
    expect(report.dominantShapeOverQuota).toBe(true);
    expect(report.dominantShape?.shape).toBe('short');
  });
});

const WORKSPACE_ARCHETYPES: ChannelArchetype[] = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-kids-song', 'jp-kids-song', 'kr-idol-male', 'kr-idol-female'];

describe('[codex 지시문 03 TASK I] real generated packs across all 7 workspaces stay within the disconnected quota', () => {
  it.each(WORKSPACE_ARCHETYPES)('%s: a real 6-song local-generation fixture never exceeds the disconnected title-hook quota', archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel for ${archetype}`).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    const report = checkTitleHookRelationships(blueprint.songs);
    expect(report.disconnectedOverQuota, `${archetype}: ${report.disconnectedCount}/${blueprint.songs.length} disconnected (quota ${maxDisconnectedAllowed(blueprint.songs.length)})`).toBe(false);
  });
});
