import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { countBpmTextMentions } from '../src/core/bpmDedupe';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { MONEY_CHORD_ADHERENCE_TEXT } from '../src/core/soundSignature';
import { buildExcludePrompt } from '../src/core/promptComposer';
import { introTextures } from '../src/data/introTextures';
import { buildDefaultNegativeStyle, parseNegativeStyleTerms } from '../src/data/negativeStyles';
import { audienceProfileForAgeGroup } from '../src/data/audienceProfiles';
import { KILLING_POINTS } from '../src/data/killingPoints';
import { createInitialOptions } from '../src/utils/generation';
import { buildSongTxt } from '../src/utils/exporters';
import { channelPresets, genrePacks, moodPacks, makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

function channelGenres(channelId: string) {
  const channel = channelPresets.find(item => item.id === channelId)!;
  return genrePacks.filter(genre => channel.preferredGenres.includes(genre.id));
}

function channelMoods(channelId: string) {
  const channel = channelPresets.find(item => item.id === channelId)!;
  return moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
}

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'warm pop, soft vocal',
    lyrics: '[verse 1]\nline one\nline two\n[chorus]\nHold On\nHold On\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

describe('[v3.47 Step 1] intro texture data and stride assignment', () => {
  it('ships 20-28 base instrument-prefixed intro-only texture tags across the required instrument groups, plus 지시문 31 §4-3의 kr-idol 전용 6종(kpop_ prefix, verified:false, 별도 카테고리)', () => {
    // 지시문 31 (§4-3) — kr-idol-male/kr-idol-female introTexture 전용 풀
    // CONTRACT VIOLATION(0개 → 6종)을 고치며 이 배열에 6개가 늘었다(24→30).
    // 원래 20-28 상한은 ag_/eg_/ep_/str_/br_/syn_(악기·기법 기반) 풀 자체의
    // 크기였고, 새로 추가된 kpop_ 접두사 6종은 그 풀과 다른 범주(아키타입
    // 전용, verified:false)라 상한을 그만큼(+6) 넓힌다 — 악기 기반 풀 자체는
    // 안 늘었다(아래 접두사별 존재 확인이 여전히 통과).
    expect(introTextures.length).toBeGreaterThanOrEqual(20);
    expect(introTextures.length).toBeLessThanOrEqual(30);
    for (const texture of introTextures) {
      expect(texture.tag).toMatch(/intro texture/i);
      expect(texture.tag).toMatch(/intro only/i);
    }
    for (const prefix of ['ag_', 'eg_', 'ep_', 'str_', 'br_', 'syn_']) {
      expect(introTextures.some(texture => texture.id.startsWith(prefix))).toBe(true);
    }
  });

  it('uses 10+ intro textures in a 15-song bridge slot pack and never repeats adjacent textures', () => {
    const showa = channelPresets.find(channel => channel.id === 'morning-showa-cafe')!;
    const opts = makeOptions({
      channel: showa,
      genreIds: showa.preferredGenres,
      moodIds: showa.preferredMoods,
      songCount: 15
    });
    const slots = preallocateSongSlots(opts, channelGenres(showa.id));
    const introTexts = slots.map(slot => slot.introTextureText).filter(Boolean);
    expect(new Set(introTexts).size).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < introTexts.length; i++) {
      expect(introTexts[i]).not.toBe(introTexts[i - 1]);
    }
  });
});

describe('[v3.47 Step 1] negative styles stay in Suno Exclude styles', () => {
  it('builds the default from global terms plus channel forbiddenCliches', () => {
    const showa = channelPresets.find(channel => channel.id === 'morning-showa-cafe')!;
    const defaultText = buildDefaultNegativeStyle(showa);
    expect(defaultText).toContain('flat chorus with no lift');
    expect(defaultText).toContain('enka-like melodrama');
  });

  it('carries at least the complete base exclude prompt on every preassigned slot', () => {
    const opts = makeOptions({ songCount: 3, avoidWords: 'no spoken intro' });
    const expected = buildExcludePrompt(opts);
    const slots = preallocateSongSlots(opts, testGenres);
    expect(expected).toContain('no spoken intro');
    expect(expected).toContain('soundalike vocals');
    expect(expected).toContain('flat chorus with no lift');
    // TASK v3.67 (TASK B) — a slot with a killing point may legitimately
    // drop one of the audience profile's relaxableAtPeak exclusions from
    // its own negativeStyleText (only the exact terms that killing point's
    // own `relaxes` names), only for that one song — intentional, not a
    // completeness regression. hardExclusions (and every term outside the
    // audience profile's exclusions, e.g. avoidWords/forbiddenCliches) are
    // never relaxed and must still appear on every slot unconditionally.
    const audienceProfile = audienceProfileForAgeGroup(opts.audience);
    for (const slot of slots) {
      const killingPoint = slot.killingPointText ? KILLING_POINTS.find(kp => kp.descriptor === slot.killingPointText) : undefined;
      const relaxedNow = new Set((killingPoint?.relaxes ?? []).filter(item => audienceProfile.relaxableAtPeak.includes(item)));
      for (const term of parseNegativeStyleTerms(expected)) {
        if (slot.negativeStyleText?.includes(term)) continue;
        expect(relaxedNow.has(term)).toBe(true);
      }
    }
  });

  it('repairs an import that omitted intro and negative fields without mixing negative text into stylePrompt', () => {
    const showa = channelPresets.find(channel => channel.id === 'morning-showa-cafe')!;
    const opts = makeOptions({
      channel: showa,
      genreIds: showa.preferredGenres,
      moodIds: showa.preferredMoods,
      songCount: 1
    });
    const genres = channelGenres(showa.id);
    const moods = channelMoods(showa.id);
    const [slot] = preallocateSongSlots(opts, genres);
    const raw = JSON.stringify({
      songs: [{
        trackNo: 1,
        title: 'Imported',
        hookPhrase: 'Hold On',
        stylePrompt: 'warm cafe pop, flat chorus with no lift, around 100 bpm',
        lyrics: '[verse 1]\nline\n[chorus]\nHold On\nHold On\n[end]',
        seasonMoment: 'x',
        listenerSituation: 'x',
        emotionArc: 'x',
        youtube: { title: 'yt', description: 'desc', tags: ['tag'] }
      }]
    });

    const report = importSongsJson(raw, opts, genres, moods, testSeason, [slot]);
    expect(report.blueprint).not.toBeNull();
    const song = report.blueprint!.songs[0];
    expect(song.stylePrompt).toContain(slot.introTextureText);
    expect(song.stylePrompt).not.toContain('flat chorus with no lift');
    expect(song.excludePrompt).toContain('flat chorus with no lift');
    expect(song.excludePrompt).toContain('enka-like melodrama');
    expect(countBpmTextMentions(song.stylePrompt)).toBe(1);
    expect(song.stylePrompt).toContain(`${slot.tempo} BPM`);
  });
});

describe('[v3.47 Step 1] BPM de-duplication and prompt repair', () => {
  it('removes range, around, and mid-tempo variants before injecting the slot BPM exactly once', () => {
    const opts = makeOptions({ songCount: 1 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const fixed = reconcileWithPreassignedSlot(
      baseSong({ trackNo: slot.trackNo, stylePrompt: 'warm pop, BPM 70-80, around 100 bpm, mid-tempo, soft vocal' }),
      slot,
      'ai-creative',
      { keepHook: true, keepEmotionArc: true }
    );
    expect(countBpmTextMentions(fixed.stylePrompt)).toBe(1);
    expect(fixed.stylePrompt).toContain(`${slot.tempo} BPM`);
    expect(fixed.stylePrompt).not.toMatch(/BPM 70-80|around 100 bpm|mid-tempo/i);
  });

  it('worst-case repaired bridge pack has varied style prompts and audible-effect reinforcement text', () => {
    const opts = makeOptions({ songCount: 15 });
    const slots = preallocateSongSlots(opts, testGenres);
    const songs = slots.map(slot => reconcileWithPreassignedSlot(
      baseSong({
        trackNo: slot.trackNo,
        title: slot.title,
        hookPhrase: slot.hookPhrase,
        stylePrompt: 'plain generic pop'
      }),
      slot,
      'ai-creative',
      { keepHook: true, keepEmotionArc: true }
    ));
    // TASK v3.58 (TASK 5-1) — MONEY_CHORD_ADHERENCE_TEXT ("Keep this
    // progression as the harmonic spine...") is no longer appended at all
    // (a 76-char imperative sentence Suno's Style field doesn't read as an
    // instruction, pure overhead).
    // TASK v4.8 (TASK A, §1-2) — the preset's own audibleEffect reinforcement
    // clause (joined with ' - ') is ALSO no longer attached by default now
    // (another decorative tail cut for prompt-length compression, see
    // batchPreallocation.ts's own moneyChordText doc comment) — every slot's
    // moneyChordText is just the bare compactProgression tag now.
    expect(slots.every(slot => !slot.moneyChordText.includes(MONEY_CHORD_ADHERENCE_TEXT))).toBe(true);
    expect(slots.every(slot => slot.moneyChordText.length > 0)).toBe(true);
    const report = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(report.averageSimilarity).toBeLessThan(0.70);
    expect(report.maxSimilarity).toBeLessThan(1);
  });
});

describe('[v3.47 Step 1] bridge/export/defaults', () => {
  it('bridge instruction and payload expose introTextureText and negativeStyleText with the separation rule', () => {
    const opts = makeOptions({ songCount: 2 });
    const slots = preallocateSongSlots(opts, testGenres);
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, undefined, slots, false);
    expect(instruction).toContain('introTextureText');
    expect(instruction).toContain('negativeStyleText');
    expect(instruction).toContain('do not put it in stylePrompt');
    const payloadMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
    const payload = JSON.parse(payloadMatch![1]);
    expect(payload.preassignedSongs[0].introTextureText).toBe(slots[0].introTextureText);
    expect(payload.preassignedSongs[0].negativeStyleText).toBe(slots[0].negativeStyleText);
  });

  it('exports excludePrompt in a separate Suno Exclude styles txt section', () => {
    const txt = buildSongTxt(baseSong({ excludePrompt: 'flat chorus with no lift' }));
    expect(txt).toContain('===== EXCLUDE (Suno Exclude styles) =====');
    expect(txt).toContain('flat chorus with no lift');
  });

  it('new initial options default to balanced intro uniqueness and channel/global negative styles', () => {
    const channel = channelPresets[0];
    const opts = createInitialOptions(channel);
    expect(opts.introUniqueness).toBe(50);
    expect(opts.negativeStyle).toContain('flat chorus with no lift');
    expect(opts.negativeStyle).toContain(channel.forbiddenCliches[0]);
  });
});
