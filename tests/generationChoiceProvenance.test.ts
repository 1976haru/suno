/**
 * TASK (provenance) — regression guard for the real, verified gap named in
 * this task's own background: core/userChoices.ts's userChoicesFromOptions
 * used to RECONSTRUCT choices.source[field] = 'user' by inspecting the final
 * GenerationOptions shape after the fact, rather than recording it at the
 * real moment of the click. Two concrete, verified consequences:
 *   1. a user who ONLY clicked genre chips (never touching the separate
 *      selectedGenreFamilyIds control) got choices.source.genreIds left
 *      unset — completely unprotected by assertUserChoicesPreserved.
 *   2. choices.source.vocalTone was NEVER set anywhere in the old function
 *      body (grep-confirmed) despite the field existing on the interface
 *      since v5.7 — the exact v3.77/v4.13 "vocal preset silently ignored"
 *      bug class this whole module exists to catch could never have been
 *      caught for a vocal-tone regression.
 *
 * GenerationOptions.choiceProvenance (types.ts's GenerationChoiceProvenance)
 * is the fix: every real UI handler that changes one of the 13 tracked axes
 * now records its own ChoiceSource on `opts.choiceProvenance` at click time
 * (see each handler's own inline comment in Step1Channel.tsx/Step2Concept.tsx/
 * Step2Plan.tsx/Step3Generate.tsx/App.tsx's applyChannelToOptions), and
 * userChoicesFromOptions reads that map FIRST, falling back to the old
 * after-the-fact heuristics only for a GenerationOptions that arrived
 * without live tracking (an old saved/imported pack, or a hand-built options
 * object in an older test).
 *
 * This file does not mount any React component (this codebase has no
 * @testing-library setup — see tests/userChoicePreservationWiring.test.ts's
 * own convention) — it simulates the exact opts/choiceProvenance patch each
 * real handler produces, the same way every other *Preservation*.test.ts
 * file in this suite already does.
 */
import { describe, expect, it } from 'vitest';
import {
  assertUserChoicesPreserved,
  DEMOTION_TRACKED_PROVENANCE_FIELDS,
  detectProvenanceDowngrades,
  GUARDED_PROVENANCE_FIELDS,
  languageOverrideConfirmMessageKo,
  provenanceForSystemFix,
  shouldConfirmLanguageOverride,
  userChoicesFromOptions,
  type ResolvedChoiceCheck
} from '../src/core/userChoices';
import { buildDefaultNegativeStyle } from '../src/data/negativeStyles';
import type { GenerationChoiceProvenance, GenerationOptions } from '../src/types';
import { channelPresets, makeOptions } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const kidsChannel = channelPresets.find(channel => channel.archetype === 'kr-kids-song')!;

describe('[provenance] recording-point table — click-time provenance drives userChoicesFromOptions', () => {
  it('moneyChordMode: choiceProvenance wins over the legacy moneyChordModeIsExplicitChoice flag', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      moneyChordMode: 'jazzColor',
      moneyChordModeIsExplicitChoice: false, // legacy flag says "not explicit"
      choiceProvenance: { moneyChordMode: 'user' } // live click-time record says otherwise
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.moneyChordMode).toBe('user');
  });

  it('moneyChordMode: falls back to the legacy explicit-choice flag when no live provenance was recorded (old saved pack)', () => {
    const opts = makeOptions({ channel: seniorChannel, moneyChordMode: 'jazzColor', moneyChordModeIsExplicitChoice: true });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.moneyChordMode).toBe('user');
  });

  it('vocalTone: real, verified gap fix — a real click-time "user" record is now actually read (grep-confirmed this never happened before)', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      vocalTone: 'deep resonant male baritone, warm husky close-mic delivery',
      choiceProvenance: { vocalTone: 'user' }
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.vocalTone).toBe(opts.vocalTone);
    expect(choices.source.vocalTone).toBe('user');
  });

  it('vocalTone: with NO choiceProvenance at all (the old, pre-fix world), source stays unset — there was never a legacy heuristic for this field to fall back to', () => {
    const opts = makeOptions({ channel: seniorChannel, vocalTone: 'deep resonant male baritone, warm husky close-mic delivery' });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.vocalTone).toBeUndefined();
  });

  it('genreIds: real, verified gap fix — a genre-chip-only pick (selectedGenreFamilyIds untouched) is now protected', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      genreIds: ['oldpop-doowop-harmony'],
      selectedGenreFamilyIds: undefined, // the user never touched the separate family picker
      choiceProvenance: { genreIds: 'user' }
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.genreIds).toBe('user');
  });

  it('genreIds: the OLD heuristic (selectedGenreFamilyIds required) is preserved as a fallback for options with no live provenance', () => {
    const withFamily = userChoicesFromOptions(makeOptions({ channel: seniorChannel, genreIds: ['oldpop-doowop-harmony'], selectedGenreFamilyIds: ['family-jazz'] }));
    expect(withFamily.source.genreIds).toBe('user');

    const withoutFamily = userChoicesFromOptions(makeOptions({ channel: seniorChannel, genreIds: ['oldpop-doowop-harmony'], selectedGenreFamilyIds: undefined }));
    expect(withoutFamily.source.genreIds).toBeUndefined();
  });

  it('perspective: falls back to the pre-existing "any value present is real" heuristic, but live provenance (e.g. a channel switch) overrides it', () => {
    const legacy = userChoicesFromOptions(makeOptions({ channel: seniorChannel, perspective: 'thirdPerson' }));
    expect(legacy.source.perspective).toBe('user');

    const channelDriven = userChoicesFromOptions(makeOptions({ channel: seniorChannel, perspective: 'thirdPerson', choiceProvenance: { perspective: 'channel' } }));
    expect(channelDriven.source.perspective).toBe('channel');
  });

  it('perspectiveMode/genreBlendMode: explicit-choice-flag fallback preserved, live provenance overrides', () => {
    const legacyPerspectiveMode = userChoicesFromOptions(makeOptions({ channel: seniorChannel, perspectiveMode: 'fixed', perspectiveModeIsExplicitChoice: true }));
    expect(legacyPerspectiveMode.source.perspectiveMode).toBe('user');

    const trackedPerspectiveMode = userChoicesFromOptions(makeOptions({ channel: seniorChannel, perspectiveMode: 'fixed', perspectiveModeIsExplicitChoice: false, choiceProvenance: { perspectiveMode: 'user' } }));
    expect(trackedPerspectiveMode.source.perspectiveMode).toBe('user');

    const legacyGenreBlend = userChoicesFromOptions(makeOptions({ channel: seniorChannel, genreBlendMode: 'lead-only', genreBlendModeIsExplicitChoice: true }));
    expect(legacyGenreBlend.source.genreBlendMode).toBe('user');
  });

  it('breadth/paletteFamilyId: presence-implies-user fallback preserved, live provenance overrides', () => {
    const legacyBreadth = userChoicesFromOptions(makeOptions({ channel: seniorChannel, breadthOverride: 'variety' }));
    expect(legacyBreadth.source.breadth).toBe('user');

    const systemBreadth = userChoicesFromOptions(makeOptions({ channel: seniorChannel, breadthOverride: 'variety', choiceProvenance: { breadth: 'system' } }));
    expect(systemBreadth.source.breadth).toBe('system');

    const legacyPalette = userChoicesFromOptions(makeOptions({ channel: seniorChannel, paletteFamilyOverride: 'family-jazz' }));
    expect(legacyPalette.source.paletteFamilyId).toBe('user');
  });

  it('lyricLanguage/packagingLanguage/seasonId/songCount/kidsAgeTierId: no legacy heuristic ever existed — only live provenance sets these', () => {
    const untracked = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      lyricLanguage: 'korean',
      packagingLanguage: 'korean',
      seasonId: 'spring-open',
      songCount: 24,
      kidsAgeTierId: 'kids-t2'
    }));
    expect(untracked.source.lyricLanguage).toBeUndefined();
    expect(untracked.source.packagingLanguage).toBeUndefined();
    expect(untracked.source.seasonId).toBeUndefined();
    expect(untracked.source.songCount).toBeUndefined();
    expect(untracked.source.kidsAgeTierId).toBeUndefined();

    const tracked = userChoicesFromOptions(makeOptions({
      channel: kidsChannel,
      lyricLanguage: 'korean',
      packagingLanguage: 'korean',
      seasonId: 'spring-open',
      songCount: 24,
      kidsAgeTierId: 'kids-t2',
      choiceProvenance: {
        lyricLanguage: 'user',
        packagingLanguage: 'user',
        seasonId: 'user',
        songCount: 'user',
        kidsAgeTierId: 'channel'
      }
    }));
    expect(tracked.lyricLanguage).toBe('korean');
    expect(tracked.source.lyricLanguage).toBe('user');
    expect(tracked.source.packagingLanguage).toBe('user');
    expect(tracked.source.seasonId).toBe('user');
    expect(tracked.songCount).toBe(24);
    expect(tracked.source.songCount).toBe('user');
    expect(tracked.kidsAgeTierId).toBe('kids-t2');
    // TASK (provenance) — the honest, verified finding: Step1Channel.tsx's
    // kidsAgeTierId picker only ever writes to the channel-editor draft
    // (ChannelProfile), never straight to GenerationOptions — it only
    // reaches opts.kidsAgeTierId via App.tsx's applyChannelToOptions (a
    // channel select/save/create), so 'channel' is the only real provenance
    // this field is ever observed to carry in this app, unlike the other 12
    // tracked axes which all have a real, direct 'user' click path too.
    expect(tracked.source.kidsAgeTierId).toBe('channel');
  });
});

describe('[provenance] "balanced" selections still record as user (explicit task requirement)', () => {
  it('clicking the vocal ChoiceGrid\'s "고르게 배정" (balanced) card records vocalTone provenance as user even though the resulting value equals the channel default', () => {
    // Mirrors Step2Concept.tsx's real BALANCED_VOCAL_CHOICE_ID handler
    // exactly: vocalTone is set to prev.channel.defaultVocal (the same value
    // an untouched field would already hold) but choiceProvenance.vocalTone
    // is unconditionally 'user'.
    const opts = makeOptions({
      channel: seniorChannel,
      vocalTone: seniorChannel.defaultVocal, // == the neutral default value
      choiceProvenance: { vocalTone: 'user' }
    });
    expect(opts.vocalTone).toBe(seniorChannel.defaultVocal); // sanity: value alone is indistinguishable from "never touched"
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.vocalTone).toBe('user');
  });

  it('breadthOverride explicitly set to "balanced" (equal to the neutral default breadth) still records as user', () => {
    const opts = makeOptions({ channel: seniorChannel, breadthOverride: 'balanced', choiceProvenance: { breadth: 'user' } });
    const choices = userChoicesFromOptions(opts);
    expect(choices.breadth).toBe('balanced');
    expect(choices.source.breadth).toBe('user');
  });
});

describe('[provenance] concept-agent application records "concept", never "user"', () => {
  it('handleApplyConceptRecommendation\'s real patch shape marks genreIds/seasonId/vocalTone as concept', () => {
    // Mirrors Step2Concept.tsx's real handleApplyConceptRecommendation setOpts
    // call: vocalTone only gets touched (and marked) when a real vocalPreset
    // was matched.
    const opts = makeOptions({
      channel: seniorChannel,
      genreIds: ['oldpop-doowop-harmony', 'oldpop-jazz-lounge'],
      seasonId: 'autumn-nostalgia',
      vocalTone: 'warm mid-range vocal, gentle and sincere',
      choiceProvenance: { genreIds: 'concept', seasonId: 'concept', vocalTone: 'concept' }
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.genreIds).toBe('concept');
    expect(choices.source.seasonId).toBe('concept');
    expect(choices.source.vocalTone).toBe('concept');
  });

  it('a concept application that did NOT match a vocal preset leaves vocalTone provenance untouched (no vocalTone key at all)', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      genreIds: ['oldpop-doowop-harmony'],
      seasonId: 'autumn-nostalgia',
      choiceProvenance: { genreIds: 'concept', seasonId: 'concept' } // no vocalTone entry — mirrors the real handler's conditional spread
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.vocalTone).toBeUndefined();
  });
});

describe('[provenance] channel switch records "channel" for every field App.tsx\'s applyChannelToOptions resets', () => {
  it('switching channels marks lyricLanguage/genreIds/vocalTone/kidsAgeTierId/packagingLanguage as channel-sourced', () => {
    // Mirrors App.tsx's real applyChannelToOptions patch shape.
    const opts = makeOptions({
      channel: kidsChannel,
      lyricLanguage: kidsChannel.primaryLanguage,
      genreIds: kidsChannel.preferredGenres,
      vocalTone: kidsChannel.defaultVocal,
      kidsAgeTierId: kidsChannel.kidsAgeTierId,
      packagingLanguage: 'korean',
      choiceProvenance: {
        lyricLanguage: 'channel',
        genreIds: 'channel',
        vocalTone: 'channel',
        kidsAgeTierId: 'channel',
        packagingLanguage: 'channel'
      }
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.lyricLanguage).toBe('channel');
    expect(choices.source.genreIds).toBe('channel');
    expect(choices.source.vocalTone).toBe('channel');
    expect(choices.source.kidsAgeTierId).toBe('channel');
    expect(choices.source.packagingLanguage).toBe('channel');
  });

  it('a subsequent explicit user pick on ONE field overwrites only that field\'s provenance, leaving the others channel-sourced (the real merge pattern every setOpts call uses)', () => {
    // Step 1: channel switch (App.tsx's applyChannelToOptions).
    const afterChannelSwitch: Partial<GenerationChoiceProvenance> = {
      lyricLanguage: 'channel',
      genreIds: 'channel',
      vocalTone: 'channel',
      kidsAgeTierId: 'channel',
      packagingLanguage: 'channel'
    };
    // Step 2: the user then explicitly clicks a vocal preset card (Step2Concept.tsx).
    const afterVocalClick = { ...afterChannelSwitch, vocalTone: 'user' as const };

    const opts = makeOptions({
      channel: kidsChannel,
      lyricLanguage: kidsChannel.primaryLanguage,
      genreIds: kidsChannel.preferredGenres,
      vocalTone: 'bright cheerful kids vocal',
      kidsAgeTierId: kidsChannel.kidsAgeTierId,
      packagingLanguage: 'korean',
      choiceProvenance: afterVocalClick
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.vocalTone).toBe('user');
    expect(choices.source.lyricLanguage).toBe('channel');
    expect(choices.source.genreIds).toBe('channel');
    expect(choices.source.kidsAgeTierId).toBe('channel');
  });
});

describe('[provenance] provenanceForSystemFix — design-gate autoFix wiring (Step2Plan.tsx/Step3Generate.tsx\'s shared applyDesignGateAutoFix)', () => {
  it('a fix that only touches diversityAllocations (every real design-gate autoFix today) marks nothing — none of the 13 tracked fields are present', () => {
    const fix: Partial<GenerationOptions> = { diversityAllocations: [{ axis: 'vocalType', mode: 'manual', counts: { male: 6, female: 6, mixed: 6 } }] };
    expect(provenanceForSystemFix(fix)).toEqual({});
  });

  it('a fix that DOES touch a tracked field is marked system, using the correct opts-key mapping for breadth/paletteFamilyId', () => {
    expect(provenanceForSystemFix({ songCount: 20 })).toEqual({ songCount: 'system' });
    expect(provenanceForSystemFix({ breadthOverride: 'variety' })).toEqual({ breadth: 'system' });
    expect(provenanceForSystemFix({ paletteFamilyOverride: 'family-jazz' })).toEqual({ paletteFamilyId: 'system' });
    expect(provenanceForSystemFix({ vocalTone: 'x', genreIds: ['a'] })).toEqual({ vocalTone: 'system', genreIds: 'system' });
  });
});

/**
 * TASK (provenance) — §3's own required proof: a vocal-tone-ignored
 * reproduction close to the historical v3.77/v4.13 bug class ("사용자가
 * 선택한 보컬 톤이 배분에 반영되지 않았습니다"), now correctly caught by
 * assertUserChoicesPreserved because vocalTone provenance is finally
 * recorded — contrasted directly against the OLD behavior (no
 * choiceProvenance at all), which never set choices.source.vocalTone and so
 * could never have flagged the exact same broken resolution.
 */
describe('[provenance] historical bug-class reproduction — vocal-tone-ignored (v3.77/v4.13 class)', () => {
  const brokenResolution: ResolvedChoiceCheck = {
    // The user picked a real vocal preset, but the real per-song allocation
    // (the exact v3.77/v4.13 regression) silently never applied it.
    vocalToneApplied: false
  };

  it('NEW behavior: a real click-time vocalTone=user record makes the guardrail catch the regression', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      vocalTone: 'deep resonant male baritone, warm husky close-mic delivery',
      choiceProvenance: { vocalTone: 'user' }
    });
    const choices = userChoicesFromOptions(opts);
    const result = assertUserChoicesPreserved(choices, brokenResolution, 'v413-repro');
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.includes('보컬 톤'))).toBe(true);
  });

  it('OLD behavior (no choiceProvenance at all — every caller before this task\'s fix): the exact same broken resolution goes completely undetected', () => {
    const oldOpts = makeOptions({
      channel: seniorChannel,
      vocalTone: 'deep resonant male baritone, warm husky close-mic delivery'
      // no choiceProvenance — this is every real GenerationOptions this app
      // ever produced before this task, since vocalTone provenance was never
      // recorded anywhere.
    });
    const oldChoices = userChoicesFromOptions(oldOpts);
    expect(oldChoices.source.vocalTone).toBeUndefined(); // the real, verified gap
    const oldResult = assertUserChoicesPreserved(oldChoices, brokenResolution, 'v413-repro-old');
    expect(oldResult.ok).toBe(true); // silently missed — proves the old logic could not have caught this
    expect(oldResult.violations).toEqual([]);
  });
});

/**
 * TASK (provenance extension) — real, verified gap: moodIds/durationTarget/
 * lyricDepth/hookMode/referenceMood/negativeStyle/avoidWords all have a real,
 * direct click-time control in Step2Concept.tsx (grep-confirmed — chip
 * toggles, ChoiceGrids, or a textarea onChange, same shape as the original 13
 * tracked axes) but GenerationChoiceProvenance never named them, so a
 * silent-drop regression on any of them could never have been recorded, let
 * alone caught. This mirrors the exact
 * lyricLanguage/packagingLanguage/seasonId/songCount/kidsAgeTierId pattern
 * above: no legacy heuristic ever existed for any of these 7, so live
 * choiceProvenance is the ONLY way userChoicesFromOptions ever sets their
 * source.
 */
describe('[provenance extension] moodIds/durationTarget/lyricDepth/hookMode/referenceMood/negativeStyle/avoidWords — real UI recording points', () => {
  it('moodIds: untracked (old-shape) options never set source; a real click-time record (App.tsx\'s toggleArray) does', () => {
    const untracked = userChoicesFromOptions(makeOptions({ channel: seniorChannel, moodIds: ['nostalgic', 'warm'] }));
    expect(untracked.source.moodIds).toBeUndefined();

    const tracked = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      moodIds: ['nostalgic', 'warm'],
      choiceProvenance: { moodIds: 'user' }
    }));
    expect(tracked.moodIds).toEqual(['nostalgic', 'warm']);
    expect(tracked.source.moodIds).toBe('user');
  });

  it('a channel switch (App.tsx\'s applyChannelToOptions) resets moodIds provenance to \'channel\', mirroring vocalTone/genreIds/kidsAgeTierId', () => {
    const choices = userChoicesFromOptions(makeOptions({
      channel: kidsChannel,
      moodIds: kidsChannel.preferredMoods,
      choiceProvenance: { moodIds: 'channel' }
    }));
    expect(choices.source.moodIds).toBe('channel');
  });

  it('durationTarget/lyricDepth: Step2Concept.tsx\'s "곡 길이"/"가사 깊이" ChoiceGrids record user provenance', () => {
    const choices = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      durationTarget: 'under4m',
      lyricDepth: 'poetic',
      choiceProvenance: { durationTarget: 'user', lyricDepth: 'user' }
    }));
    expect(choices.durationTarget).toBe('under4m');
    expect(choices.source.durationTarget).toBe('user');
    expect(choices.lyricDepth).toBe('poetic');
    expect(choices.source.lyricDepth).toBe('user');
  });

  it('hookMode: Step2Concept.tsx\'s "훅 생성 방식" chip pair records user provenance', () => {
    const choices = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      hookMode: 'pool',
      choiceProvenance: { hookMode: 'user' }
    }));
    expect(choices.hookMode).toBe('pool');
    expect(choices.source.hookMode).toBe('user');
  });

  it('referenceMood: Step2Concept.tsx\'s "Reference mood" textarea records user provenance', () => {
    const choices = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      referenceMood: '비 오는 새벽 드라이브, 나른한 여성 보컬',
      choiceProvenance: { referenceMood: 'user' }
    }));
    expect(choices.referenceMood).toBe('비 오는 새벽 드라이브, 나른한 여성 보컬');
    expect(choices.source.referenceMood).toBe('user');
  });

  it('negativeStyle: the preset chip/raw textarea record user; resetNegativeStyle\'s real handler records default instead (restoring the channel default is the opposite of an override)', () => {
    const userChoices = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      negativeStyle: 'wordless humming or la-la filler',
      choiceProvenance: { negativeStyle: 'user' }
    }));
    expect(userChoices.negativeStyle).toBe('wordless humming or la-la filler');
    expect(userChoices.source.negativeStyle).toBe('user');

    const resetChoices = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      negativeStyle: buildDefaultNegativeStyle(seniorChannel),
      choiceProvenance: { negativeStyle: 'default' }
    }));
    expect(resetChoices.source.negativeStyle).toBe('default');
  });

  it('avoidWords: Step2Concept.tsx\'s preset checkboxes/custom-term input record user provenance', () => {
    const choices = userChoicesFromOptions(makeOptions({
      channel: seniorChannel,
      avoidWords: '전쟁, 이별',
      choiceProvenance: { avoidWords: 'user' }
    }));
    expect(choices.avoidWords).toBe('전쟁, 이별');
    expect(choices.source.avoidWords).toBe('user');
  });
});

/**
 * 지시문 30 TASK D-2/TASK A — real repro: App.tsx's applyChannelToOptions
 * unconditionally overwrote lyricLanguage/vocalTone/kidsAgeTierId/
 * packagingLanguage/moodIds provenance to 'channel' on every channel
 * (re)select, silently discarding a same-session 'user' pick with no signal
 * anywhere that a downgrade even happened — the exact gap that let
 * lyricLanguage go unnoticed despite being tracked in
 * PROVENANCE_FIELD_TO_OPTS_KEY since this module's original version.
 */
describe('[provenance] detectProvenanceDowngrades / shouldConfirmLanguageOverride — 지시문 30 TASK D-2 / TASK A', () => {
  it('flags a field only when it was truly user-sourced AND its value is actually about to change', () => {
    const downgrades = detectProvenanceDowngrades({ vocalTone: 'user', moodIds: 'user', kidsAgeTierId: 'channel' }, [
      { field: 'vocalTone', labelKo: '보컬 톤', valueChanged: true },
      { field: 'moodIds', labelKo: '무드', valueChanged: false },
      { field: 'kidsAgeTierId', labelKo: '연령대', valueChanged: true }
    ]);
    expect(downgrades).toEqual([{ field: 'vocalTone', labelKo: '보컬 톤' }]);
  });

  it('a re-assert of the same value is not a downgrade — nothing was actually lost', () => {
    const downgrades = detectProvenanceDowngrades({ vocalTone: 'user' }, [{ field: 'vocalTone', labelKo: '보컬 톤', valueChanged: false }]);
    expect(downgrades).toEqual([]);
  });

  it('shouldConfirmLanguageOverride only fires when provenance is user AND the language genuinely differs from the channel default', () => {
    expect(shouldConfirmLanguageOverride('english', 'user', 'korean')).toBe(true);
    expect(shouldConfirmLanguageOverride('korean', 'user', 'korean')).toBe(false);
    expect(shouldConfirmLanguageOverride('english', 'channel', 'korean')).toBe(false);
    expect(shouldConfirmLanguageOverride('english', undefined, 'korean')).toBe(false);
  });

  it('languageOverrideConfirmMessageKo renders §A-4\'s exact required wording', () => {
    expect(languageOverrideConfirmMessageKo('english', 'korean')).toBe(
      '이 채널의 기본 언어는 한국어입니다. 현재 영어(으)로 설정되어 있습니다. 채널 기본값으로 되돌리시겠습니까?'
    );
  });

  it('GUARDED_PROVENANCE_FIELDS matches exactly the axes computeStructuredViolations checks (moneyChordMode/vocalTone/genreIds/negativeStyle) — lyricLanguage is deliberately absent, it is protected upstream (TASK A) instead', () => {
    expect([...GUARDED_PROVENANCE_FIELDS].sort()).toEqual(['genreIds', 'moneyChordMode', 'negativeStyle', 'vocalTone'].sort());
  });

  it('DEMOTION_TRACKED_PROVENANCE_FIELDS covers every field App.tsx\'s applyChannelToOptions can silently reset — genreIds is deliberately excluded (§하지 말 것)', () => {
    expect([...DEMOTION_TRACKED_PROVENANCE_FIELDS].sort()).toEqual(['kidsAgeTierId', 'lyricLanguage', 'moodIds', 'packagingLanguage', 'vocalTone'].sort());
    expect(DEMOTION_TRACKED_PROVENANCE_FIELDS).not.toContain('genreIds');
  });
});
