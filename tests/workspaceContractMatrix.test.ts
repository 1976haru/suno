/**
 * TASK (workspace contract matrix) — integration test matrix exercising
 * real workspace x generation-path x option combinations, so the next
 * "system default silently overrides an explicit user choice" bug (the
 * repeating class of bug v5.7-v5.10 all fixed — custom channels defaulting
 * to senior-morning regardless of workspace, kids/K-pop vocal presets
 * silently discarded, no genre-id validation against channel archetype)
 * gets caught here instead of discovered by a real user months later.
 *
 * Deliberately kept OUT of test:fast/`npm test` — run separately via
 * `npm run test:matrix` (see package.json). Scale is the reduced ~73-run
 * matrix the task doc specifies, not the full 4,200-combination sweep:
 *   - 필수 (35): 7 workspaces x 5 generation paths, every other axis at
 *     its channel default.
 *   - 중요 (28): 7 workspaces x 4 scenarios (user-chosen money chord +
 *     earworm ON, female-leaning vocal, multi-genre selection, language
 *     switch).
 *   - 경계 (10): bad-genre injection, cross-workspace data, custom channel,
 *     scaffold/first-run entry, corrupted data, large set.
 *
 * Every combination is checked against the doc's 10 contract-violation
 * criteria (see assertFullContract/assertSlotLevelContract below for the
 * SongIdea-level and slot-level implementations respectively):
 *   1. effectiveArchetype actually belongs to the current workspace
 *   2. every genreId used is actually allowed for that archetype
 *   3. an explicit user money-chord choice is actually preserved
 *   4. the vocal song-count split matches what the generation-contract
 *      screen would have promised (buildResolvedGenerationContract)
 *   5. the style prompt's vocal gender descriptor matches vocalType
 *   6. lyric meta-tags that encode gender match vocalType
 *   7. lyric language matches the selected lyricLanguage
 *   8. no cross-workspace vocabulary leakage (senior-oldpop's own
 *      distinctive vocabulary bank words, proxy-checked against every
 *      other workspace's output)
 *   9. no adult-emotion content in kids packs (core/kidsLyricEngine.ts's
 *      kidsLyricSafetyIssues blacklist scan — same mechanism
 *      docs/v58-report.md's own kids-safety audit used)
 *   10. no real artist names in any generated prompt
 *      (core/artistReferenceDecomposer.ts's findArtistReferenceLeaks)
 *
 * On "실시간 API" (realtime): the real realtime generation path
 * (providers/index.ts's generateChunkWithSplitRetry) makes an actual
 * network call to a configured provider and is not locally testable
 * without live credentials. The substitute used here
 * (runRealtimeSubstitute) exercises the exact same choke point every
 * realtime/Batch/bridge response funnels through afterward —
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot, whose own doc
 * comment names it "the one place every generation path (realtime, Batch
 * API, Claude Code bridge import) already reconciles a model/agent's raw
 * output" — fed a locally-built, well-formed synthetic "model response"
 * per preallocated slot. This cannot catch a bug that only lives inside an
 * actual remote model's behavior, but it does cover everything this app's
 * own code is responsible for after a response comes back.
 */
import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { buildResolvedGenerationContract, generationBlockedByContract, userChoicesFromOptions, type UserExplicitChoices } from '../src/core/userChoices';
import { sanitizeGenreIdsForArchetype } from '../src/core/genreSelection';
import { getWorkspace } from '../src/data/workspaces';
import { CORE_GENRE_IDS_BY_ARCHETYPE, KR_KIDS_CORE_GENRE_IDS, KRIDOL_M_CORE_GENRE_IDS, KRIDOL_F_CORE_GENRE_IDS } from '../src/data/genreLibrary';
import { findArtistReferenceLeaks } from '../src/core/artistReferenceDecomposer';
import { kidsLyricSafetyIssues } from '../src/core/kidsLyricEngine';
import { detectVocalGenderPresence, resolveVocalMetaTag, scaleVocalQuota } from '../src/core/vocalPlan';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL } from '../src/core/promptComposer';
import { createDraftChannel } from '../src/utils/channelProfile';
import { presetsForWorkspace, findArchetypeMismatches } from '../src/hooks/useChannelManager';
import { vocalPresets } from '../src/data/vocalPresets';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { ChannelArchetype, ChannelProfile, GenerationOptions, PreassignedSongSlot, SongIdea, WorkspaceId } from '../src/types';
// TASK (matrix gap-closing — bridge-instruction 13-item verification, #3
// audienceProfile / #8 kidsAgeTierId): real functions this session's own
// gap analysis named as the source of truth for those two axes, reused here
// rather than re-derived.
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { kidsAgeTierFor } from '../src/data/kidsAgeTiers';

// ---------------------------------------------------------------------------
// Shared fixtures / helpers
// ---------------------------------------------------------------------------

const WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

/** One real default channel preset per workspace (data/presets.ts's own registered channels). */
const WORKSPACE_CHANNEL_ID: Record<WorkspaceId, string> = {
  'senior-oldpop': 'good-morning-memory-radio',
  'kr-2030': 'after-work-band-pop',
  'jp-2030': 'reiwa-way-home-jpop',
  'kr-kids': 'follow-along-action-song',
  'jp-kids': 'teasobi-hiroba',
  'kr-idol-male': 'stage-night',
  'kr-idol-female': 'daylight-city-kpop'
};

const DEFAULT_SONG_COUNT = 12;

function channelFor(workspaceId: WorkspaceId): ChannelProfile {
  const channel = channelPresets.find(c => c.id === WORKSPACE_CHANNEL_ID[workspaceId]);
  if (!channel) throw new Error(`no fixture channel registered for workspace ${workspaceId}`);
  return channel;
}

function optsFor(workspaceId: WorkspaceId, overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = overrides.channel ?? channelFor(workspaceId);
  const workspace = getWorkspace(workspaceId);
  return makeOptions({
    channel,
    songCount: DEFAULT_SONG_COUNT,
    lyricLanguage: workspace.defaultLyricLanguage,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    vocalTone: channel.defaultVocal,
    ...overrides
  });
}

function genresFor(opts: GenerationOptions) {
  return genrePacks.filter(g => opts.genreIds.includes(g.id));
}
function moodsFor(opts: GenerationOptions) {
  return moodPacks.filter(m => opts.moodIds.includes(m.id));
}

// ---------------------------------------------------------------------------
// Criterion 7 — language script detection
// ---------------------------------------------------------------------------

function scriptCounts(text: string) {
  return {
    hangul: (text.match(/[가-힣]/g) || []).length,
    kana: (text.match(/[぀-ヿ]/g) || []).length,
    han: (text.match(/[一-鿿]/g) || []).length
  };
}

// ---------------------------------------------------------------------------
// Criterion 8 — cross-workspace vocabulary leak proxy. These words come
// verbatim from data/vocabularyBanks.ts's SENIOR_VOCABULARY_BANKS (every
// entry there is fitsWorkspaces: ['senior-oldpop']), so their appearance in
// any other workspace's real output is a leak, not a coincidence.
// ---------------------------------------------------------------------------

const SENIOR_DISTINCTIVE_WORDS = [
  'jukebox', 'transistor radio', 'soda fountain', 'record sleeve',
  'grandchildren', 'garden gate', 'evening paper', 'cardigan'
];

// ---------------------------------------------------------------------------
// Text-level primitives (used directly for slot/instruction-string paths,
// and wrapped for full SongIdea output below).
// ---------------------------------------------------------------------------

interface TextItem { trackNo: number; text: string; }

function assertNoSeniorVocabLeakText(label: string, workspaceId: WorkspaceId, items: TextItem[]) {
  if (workspaceId === 'senior-oldpop') return;
  for (const { trackNo, text } of items) {
    const lower = text.toLowerCase();
    for (const word of SENIOR_DISTINCTIVE_WORDS) {
      expect(lower.includes(word), `${label} criterion 8 (no senior-vocabulary leak "${word}") track ${trackNo}`).toBe(false);
    }
  }
}

function assertKidsSafeText(label: string, workspaceId: WorkspaceId, items: TextItem[]) {
  if (workspaceId !== 'kr-kids' && workspaceId !== 'jp-kids') return;
  for (const { trackNo, text } of items) {
    expect(kidsLyricSafetyIssues(text), `${label} criterion 9 (kids safety) track ${trackNo}`).toEqual([]);
  }
}

function assertNoArtistLeakText(label: string, items: TextItem[]) {
  for (const { trackNo, text } of items) {
    expect(findArtistReferenceLeaks(text), `${label} criterion 10 (artist-name leak) track ${trackNo}`).toEqual([]);
  }
}

// ---------------------------------------------------------------------------
// Criteria 1-4 — contract-level (works for both PreassignedSongSlot[] and
// SongIdea[], since buildResolvedGenerationContract accepts either).
// ---------------------------------------------------------------------------

function assertMoneyChordPreserved(label: string, choices: UserExplicitChoices, slots: readonly { moneyChordId?: string }[]) {
  if (choices.source.moneyChordMode !== 'user' || !choices.moneyChordMode || choices.moneyChordMode === 'custom') return;
  const counts = new Map<string, number>();
  for (const s of slots) if (s.moneyChordId) counts.set(s.moneyChordId, (counts.get(s.moneyChordId) ?? 0) + 1);
  const chosenCount = counts.get(choices.moneyChordMode) ?? 0;
  expect(chosenCount, `${label} criterion 3 (user money-chord choice preserved: "${choices.moneyChordMode}")`).toBeGreaterThan(0);
}

/**
 * TASK (matrix gap-closing, Gap 2) — real gap this session's own audit
 * named: every existing criterion-2 check above only ever validates
 * opts.genreIds (the user's whole-pack SELECTION) against
 * sanitizeGenreIdsForArchetype; nothing in the matrix ever re-checks each
 * REAL per-slot genreId/effectiveGenreIds that generation actually assigned
 * — a bug that corrupts one specific slot's genre (as opposed to the whole
 * selection) would slip through undetected. Reuses the exact same real
 * detection mechanism (sanitizeGenreIdsForArchetype) the pack-level check
 * above already trusts, just applied per-slot instead of pack-wide. Works
 * for both PreassignedSongSlot[] and SongIdea[] (both types declare
 * `effectiveGenreIds: string[]` as a required, always-populated field — see
 * each type's own doc comment in src/types.ts).
 */
function assertSlotLevelGenreValidity(
  label: string,
  slots: readonly { trackNo: number; genreId?: string; effectiveGenreIds?: string[] }[],
  archetype: ChannelArchetype
) {
  for (const slot of slots) {
    if (slot.genreId) {
      expect(slot.genreId, `${label} criterion 2b (slot ${slot.trackNo} genreId non-empty)`).toBeTruthy();
      const check = sanitizeGenreIdsForArchetype([slot.genreId], archetype);
      expect(check.removed, `${label} criterion 2b (slot ${slot.trackNo} genreId "${slot.genreId}" valid for archetype ${archetype})`).toEqual([]);
    }
    for (const id of slot.effectiveGenreIds ?? []) {
      expect(id, `${label} criterion 2c (slot ${slot.trackNo} effectiveGenreIds entries non-empty)`).toBeTruthy();
      const check = sanitizeGenreIdsForArchetype([id], archetype);
      expect(check.removed, `${label} criterion 2c (slot ${slot.trackNo} effectiveGenreIds entry "${id}" valid for archetype ${archetype})`).toEqual([]);
    }
  }
}

function assertContractLevelCriteria(
  label: string,
  workspaceId: WorkspaceId,
  opts: GenerationOptions,
  choices: UserExplicitChoices,
  slots: PreassignedSongSlot[] | SongIdea[],
  /** Boundary/contamination scenarios deliberately inject a foreign genre id and expect sanitizeGenreIdsForArchetype to strip it — pass the exact expected `removed` list there. Defaults to [] (the clean-run expectation every 필수/중요 combination uses). */
  expectedRemovedGenreIds: string[] = []
) {
  const contract = buildResolvedGenerationContract(opts, choices, slots, workspaceId);
  expect(getWorkspace(workspaceId).archetypeIds, `${label} criterion 1 (effective archetype belongs to workspace)`).toContain(contract.archetype.effective);
  const sanitized = sanitizeGenreIdsForArchetype(opts.genreIds, contract.archetype.effective);
  expect(sanitized.removed, `${label} criterion 2 (every selected genreId allowed for archetype)`).toEqual(expectedRemovedGenreIds);
  // TASK (matrix gap-closing, Gap 2) — see assertSlotLevelGenreValidity's own
  // doc comment. Skipped only for the boundary/contamination scenarios that
  // deliberately pass a still-contaminated `slots` array to prove criterion 2
  // catches it at the pack level (expectedRemovedGenreIds non-empty) — those
  // scenarios' OWN assertions already check that the contamination never
  // reaches a real slot (e.g. B1/B2's "no song should ever be assigned the
  // foreign genre id"), so this per-slot pass would be redundant there, not
  // a gap.
  if (!expectedRemovedGenreIds.length) {
    assertSlotLevelGenreValidity(label, slots, contract.archetype.effective);
  }
  assertMoneyChordPreserved(label, choices, slots as readonly { moneyChordId?: string }[]);
  const tally = { male: 0, female: 0, mixed: 0 };
  for (const s of slots as readonly { vocalType?: 'male' | 'female' | 'mixed' }[]) if (s.vocalType) tally[s.vocalType] += 1;
  expect(tally, `${label} criterion 4 (vocal split matches the generation-contract tally)`).toEqual(contract.vocal.effectiveQuota);
  return contract;
}

// ---------------------------------------------------------------------------
// Criteria 5/6 — SongIdea-only (needs real stylePrompt/lyrics text).
// ---------------------------------------------------------------------------

function assertStylePromptGenderMatches(label: string, songs: SongIdea[]) {
  for (const song of songs) {
    if (!song.vocalType) continue;
    const presence = detectVocalGenderPresence(song.stylePrompt);
    if (song.vocalType === 'male') {
      expect(presence.female, `${label} criterion 5 (style prompt vocal gender) track ${song.trackNo} must not claim female`).toBe(false);
    } else if (song.vocalType === 'female') {
      expect(presence.male, `${label} criterion 5 (style prompt vocal gender) track ${song.trackNo} must not claim male`).toBe(false);
    }
    // 'mixed' legitimately may mention both (duet/group) or neither (choir) — no strict single-gender assertion.
  }
}

const MALE_ONLY_TAG = '[male vocal]';
const FEMALE_ONLY_TAG = '[female vocal]';

function assertLyricMetaTagGender(label: string, songs: SongIdea[]) {
  for (const song of songs) {
    if (!song.vocalType) continue;
    const match = /^\[[^\]]+\]/.exec(song.lyrics.trim());
    const tag = match?.[0];
    if (song.vocalType === 'male') {
      expect(tag, `${label} criterion 6 (lyric meta tag gender) track ${song.trackNo}`).toBe(MALE_ONLY_TAG);
    } else if (song.vocalType === 'female') {
      expect(tag, `${label} criterion 6 (lyric meta tag gender) track ${song.trackNo}`).toBe(FEMALE_ONLY_TAG);
    } else if (song.vocalType === 'mixed') {
      expect([MALE_ONLY_TAG, FEMALE_ONLY_TAG], `${label} criterion 6 (lyric meta tag gender) track ${song.trackNo} must not be single-gender-only for a mixed slot`).not.toContain(tag);
    }
  }
}

function assertLyricLanguage(label: string, songs: SongIdea[], lyricLanguage: GenerationOptions['lyricLanguage']) {
  for (const song of songs) {
    const { hangul, kana, han } = scriptCounts(song.lyrics);
    if (lyricLanguage === 'korean') {
      expect(hangul, `${label} criterion 7 (lyric language korean) track ${song.trackNo}`).toBeGreaterThan(0);
    } else if (lyricLanguage === 'japanese') {
      expect(kana + han, `${label} criterion 7 (lyric language japanese) track ${song.trackNo}`).toBeGreaterThan(0);
    } else if (lyricLanguage === 'english') {
      expect(hangul, `${label} criterion 7 (lyric language english, no hangul expected) track ${song.trackNo}`).toBe(0);
      expect(kana, `${label} criterion 7 (lyric language english, no kana expected) track ${song.trackNo}`).toBe(0);
    }
    // 'bilingual': both scripts are legitimately expected — no strict assertion.
  }
}

/** Full 10-criteria check for a real SongIdea[] output (local / individual-regen / realtime-substitute paths). */
function assertFullContract(label: string, workspaceId: WorkspaceId, opts: GenerationOptions, choices: UserExplicitChoices, songs: SongIdea[], expectedRemovedGenreIds: string[] = []) {
  const contract = assertContractLevelCriteria(label, workspaceId, opts, choices, songs, expectedRemovedGenreIds); // 1-4
  assertStylePromptGenderMatches(label, songs);                                                     // 5
  assertLyricMetaTagGender(label, songs);                                                            // 6
  assertLyricLanguage(label, songs, opts.lyricLanguage);                                             // 7
  assertNoSeniorVocabLeakText(label, workspaceId, songs.map(s => ({ trackNo: s.trackNo, text: `${s.title} ${s.hookPhrase} ${s.lyrics}` }))); // 8
  assertKidsSafeText(label, workspaceId, songs.map(s => ({ trackNo: s.trackNo, text: `${s.title}\n${s.hookPhrase}\n${s.lyrics}` })));       // 9
  assertNoArtistLeakText(label, songs.map(s => ({ trackNo: s.trackNo, text: s.stylePrompt })));      // 10
  return contract;
}

/** Reduced check for a PreassignedSongSlot[] output (batch/bridge planning paths — no lyrics text exists yet at this stage, so 6/7 are N/A by construction, and 5/8/9/10 are checked against the slot's own prose fields as the best available proxy for what will be woven into the final stylePrompt/lyrics verbatim.) */
function assertSlotLevelContract(label: string, workspaceId: WorkspaceId, opts: GenerationOptions, choices: UserExplicitChoices, slots: PreassignedSongSlot[]) {
  const contract = assertContractLevelCriteria(label, workspaceId, opts, choices, slots);            // 1-4
  for (const slot of slots) {
    if (!slot.vocalType || !slot.vocalText) continue;
    const presence = detectVocalGenderPresence(slot.vocalText);
    if (slot.vocalType === 'male') {
      expect(presence.female, `${label} criterion 5 (slot vocalText gender) track ${slot.trackNo} must not claim female`).toBe(false);
    } else if (slot.vocalType === 'female') {
      expect(presence.male, `${label} criterion 5 (slot vocalText gender) track ${slot.trackNo} must not claim male`).toBe(false);
    }
  }
  const proxyItems: TextItem[] = slots.map(slot => ({
    trackNo: slot.trackNo,
    text: [slot.title, slot.hookPhrase, slot.vocalText, slot.genreText, slot.moneyChordText, slot.hookDeviceText].filter(Boolean).join(' ')
  }));
  assertNoSeniorVocabLeakText(label, workspaceId, proxyItems);  // 8 (proxy)
  assertKidsSafeText(label, workspaceId, proxyItems);           // 9 (proxy)
  assertNoArtistLeakText(label, proxyItems);                    // 10 (proxy)
  return contract;
}

// ---------------------------------------------------------------------------
// Generation-path runners
// ---------------------------------------------------------------------------

function runLocal(opts: GenerationOptions): SongIdea[] {
  return generateLocalBlueprint(opts, genresFor(opts), moodsFor(opts), testSeason).songs;
}

function runBatchSlots(opts: GenerationOptions): PreassignedSongSlot[] {
  return preallocateSongSlots(opts, genresFor(opts));
}

function runBridgeInstruction(opts: GenerationOptions): { instruction: string; slots: PreassignedSongSlot[] } {
  const slots = runBatchSlots(opts);
  const instruction = buildClaudeCodeInstruction(opts, genresFor(opts), moodsFor(opts), testSeason, undefined, slots);
  return { instruction, slots };
}

/** A locally-built, well-formed synthetic "model response" for one slot — used to exercise reconcileWithPreassignedSlot the same way realtime/Batch/bridge output does. */
function syntheticModelSong(slot: PreassignedSongSlot): SongIdea {
  const stylePrompt = [
    slot.genreText,
    slot.vocalText,
    slot.moneyChordText,
    slot.hookDeviceText,
    ...(slot.instrumentSet ?? []),
    slot.arrangementDensity ? ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[slot.arrangementDensity] : undefined,
    slot.introTextureText,
    `${slot.tempo} BPM`
  ].filter(Boolean).join(', ');
  const tag = resolveVocalMetaTag(slot.vocalType, slot.vocalGender, slot.vocalText) ?? '';
  const lyrics = [tag, '[verse 1]', 'a placeholder verse line', '', '[chorus]', slot.hookPhrase].filter(Boolean).join('\n');
  return {
    trackNo: slot.trackNo,
    title: slot.title,
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: slot.emotionArc,
    hookPhrase: slot.hookPhrase,
    stylePrompt,
    lyrics,
    youtube: { title: slot.title, description: '', tags: [] },
    qualityScore: 0,
    warnings: []
  };
}

/** Individual regeneration: simulates the real per-song "regenerate this track" repair path — a deliberately blank/placeholder model response reconciled against its own real slot. */
function runIndividualRegen(opts: GenerationOptions, trackNo = 2): SongIdea[] {
  const slots = runBatchSlots(opts);
  const slot = slots.find(s => s.trackNo === trackNo) ?? slots[0];
  const badSong: SongIdea = {
    trackNo: slot.trackNo,
    title: '',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: '',
    stylePrompt: 'generic pop mood, some vocal',
    // The verse is a generic placeholder (what reconciliation is meant to
    // repair via stylePrompt/tag enforcement), but the chorus already
    // carries the slot's own real, correctly-localized hookPhrase — lyric
    // BODY language/content is never something reconcileWithPreassignedSlot
    // rewrites (only stylePrompt/tags/hookPhrase-the-field/title are
    // slot-owned), so a synthetic "bad" song still needs real target-
    // language text somewhere in `lyrics` for criterion 7 to be checkable
    // at all here — see this file's own header note on what reconciliation
    // can and can't fix.
    lyrics: `[verse 1]\nplaceholder line\n\n[chorus]\n${slot.hookPhrase}`,
    youtube: { title: '', description: '', tags: [] },
    qualityScore: 0,
    warnings: []
  };
  const fixed = reconcileWithPreassignedSlot(badSong, slot, 'ai-creative', { archetype: opts.channel.archetype, keepHook: false, keepEmotionArc: false });
  return [fixed];
}

/** Realtime-API substitute — see file header for why the real network path isn't exercised directly. */
function runRealtimeSubstitute(opts: GenerationOptions): SongIdea[] {
  const slots = runBatchSlots(opts);
  return slots.map(slot => reconcileWithPreassignedSlot(syntheticModelSong(slot), slot, 'ai-creative', { archetype: opts.channel.archetype, keepHook: true, keepEmotionArc: true }));
}

// ---------------------------------------------------------------------------
// 필수 (35) — 7 workspaces x 5 generation paths, every other axis at default
// ---------------------------------------------------------------------------

describe('[workspace contract matrix] 필수 — 7 workspaces x 5 generation paths', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    describe(`workspace: ${workspaceId}`, () => {
      const opts = optsFor(workspaceId);
      const choices = userChoicesFromOptions(opts);

      it('path: local (generateLocalBlueprint)', () => {
        const songs = runLocal(opts);
        expect(songs.length).toBe(opts.songCount);
        assertFullContract(`${workspaceId}/local`, workspaceId, opts, choices, songs);
      });

      it('path: batch (preallocateSongSlots)', () => {
        const slots = runBatchSlots(opts);
        expect(slots.length).toBe(opts.songCount);
        assertSlotLevelContract(`${workspaceId}/batch`, workspaceId, opts, choices, slots);
      });

      it('path: bridge instruction (buildClaudeCodeInstruction)', () => {
        const { instruction, slots } = runBridgeInstruction(opts);
        expect(instruction.length).toBeGreaterThan(0);
        // 1-4 via the same real slots this instruction was built from.
        assertContractLevelCriteria(`${workspaceId}/bridge`, workspaceId, opts, choices, slots);
        // 10: the agent-facing instruction text itself must never leak an artist name.
        assertNoArtistLeakText(`${workspaceId}/bridge`, [{ trackNo: 0, text: instruction }]);
      });

      it('path: individual regeneration (reconcileWithPreassignedSlot, single track)', () => {
        const songs = runIndividualRegen(opts);
        assertFullContract(`${workspaceId}/individual-regen`, workspaceId, opts, choices, songs);
      });

      it('path: realtime API substitute (reconcileWithPreassignedSlot over every slot)', () => {
        const songs = runRealtimeSubstitute(opts);
        expect(songs.length).toBe(opts.songCount);
        assertFullContract(`${workspaceId}/realtime-substitute`, workspaceId, opts, choices, songs);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 중요 (28) — 7 workspaces x 4 scenarios
// ---------------------------------------------------------------------------

describe('[workspace contract matrix] 중요 — 7 workspaces x 4 scenarios', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    describe(`workspace: ${workspaceId}`, () => {
      it('scenario: user-chosen money chord + earworm ON', () => {
        const opts = optsFor(workspaceId, { moneyChordMode: 'emotional', moneyChordModeIsExplicitChoice: true, earwormMode: true });
        const choices = userChoicesFromOptions(opts);
        expect(choices.source.moneyChordMode, `${workspaceId}/money-chord+earworm choices provenance`).toBe('user');
        const songs = runLocal(opts);
        const contract = assertFullContract(`${workspaceId}/money-chord+earworm`, workspaceId, opts, choices, songs);
        expect(generationBlockedByContract(contract), `${workspaceId}/money-chord+earworm should not be blocked (real user choice honored)`).toBe(false);
      });

      it('scenario: female-leaning vocal', () => {
        const channel = channelFor(workspaceId);
        const femalePreset = (workspaceId === 'kr-kids' || workspaceId === 'jp-kids')
          ? vocalPresets.find(p => p.id === 'kid-girl')!
          : vocalPresets.find(p => p.id === 'soft-female')!;
        const opts = optsFor(workspaceId, { vocalTone: femalePreset.prompt });
        const choices = userChoicesFromOptions(opts);
        const songs = runLocal(opts);
        assertFullContract(`${workspaceId}/female-leaning-vocal`, workspaceId, opts, choices, songs);
        const tally = { male: 0, female: 0, mixed: 0 };
        for (const s of songs) if (s.vocalType) tally[s.vocalType] += 1;
        if (channel.vocalQuotaOverride) {
          // Fixed-quota workspaces (kr-idol-male/female) intentionally ignore vocalTone leaning — see core/userChoices.ts's baseVocalQuota resolution.
          // The override is defined at an 18-song reference scale (see presets.ts's own comments); core/vocalPlan.ts's scaleVocalQuota is the real
          // app logic that proportionally scales it to the actual songCount (12 here) — reused rather than re-derived so this doesn't hardcode a number.
          const expectedQuota = scaleVocalQuota(channel.vocalQuotaOverride, opts.songCount);
          expect(tally, `${workspaceId}/female-leaning-vocal fixed vocalQuotaOverride must stay proportional, not lean toward the picked vocalTone`).toEqual(expectedQuota);
        } else {
          expect(tally.female, `${workspaceId}/female-leaning-vocal female count should lean above male`).toBeGreaterThan(tally.male);
        }
      });

      it('scenario: multi-genre selection', () => {
        const archetype = channelFor(workspaceId).archetype as ChannelArchetype;
        const pool = CORE_GENRE_IDS_BY_ARCHETYPE[archetype] ?? [];
        expect(pool.length, `${workspaceId}/multi-genre core genre pool must exist`).toBeGreaterThanOrEqual(4);
        const genreIds = pool.slice(0, 4);
        const opts = optsFor(workspaceId, { genreIds: [...genreIds] });
        const choices = userChoicesFromOptions(opts);
        const songs = runLocal(opts);
        assertFullContract(`${workspaceId}/multi-genre`, workspaceId, opts, choices, songs);
        const usedGenreIds = new Set(songs.map(s => s.genreId).filter(Boolean));
        expect(usedGenreIds.size, `${workspaceId}/multi-genre expects real genre diversity across the pack`).toBeGreaterThanOrEqual(2);
      });

      it('scenario: language switch', () => {
        const switchTo: Record<WorkspaceId, GenerationOptions['lyricLanguage']> = {
          'senior-oldpop': 'korean',
          'kr-2030': 'english',
          'jp-2030': 'english',
          'kr-kids': 'japanese',
          'jp-kids': 'korean',
          'kr-idol-male': 'english',
          'kr-idol-female': 'english'
        };
        const lyricLanguage = switchTo[workspaceId];
        const opts = optsFor(workspaceId, { lyricLanguage });
        const choices = userChoicesFromOptions(opts);
        const songs = runLocal(opts);
        assertFullContract(`${workspaceId}/language-switch(${lyricLanguage})`, workspaceId, opts, choices, songs);
        expect(opts.lyricLanguage, `${workspaceId}/language-switch actually differs from the workspace default`).not.toBe(getWorkspace(workspaceId).defaultLyricLanguage);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 경계 (10) — bad-genre injection / cross-workspace data / custom channel /
// scaffold-first-run / corrupted data / large set
// ---------------------------------------------------------------------------

describe('[workspace contract matrix] 경계 — 10 boundary scenarios', () => {
  it('B1: bad-genre injection — a foreign kr-kids genre id injected into senior-oldpop', () => {
    const workspaceId: WorkspaceId = 'senior-oldpop';
    const channel = channelFor(workspaceId);
    const foreignId = KR_KIDS_CORE_GENRE_IDS[0];
    const opts = optsFor(workspaceId, { genreIds: [...channel.preferredGenres.slice(0, 2), foreignId] });
    const choices = userChoicesFromOptions(opts);
    const songs = runLocal(opts);
    const sanitized = sanitizeGenreIdsForArchetype(opts.genreIds, 'senior-morning');
    expect(sanitized.removed, 'B1 criterion 2: the foreign genre id must be removed').toEqual([foreignId]);
    expect(songs.every(s => s.genreId !== foreignId), 'B1: no song should ever be assigned the foreign genre id').toBe(true);
    const contract = buildResolvedGenerationContract(opts, choices, songs, workspaceId);
    expect(contract.genreIds.removed, 'B1: contract must report the removal').toEqual([foreignId]);
    expect(generationBlockedByContract(contract), 'B1: an unacknowledged contamination must block generation').toBe(true);
    assertFullContract('B1/senior-oldpop-contaminated', workspaceId, opts, choices, songs, [foreignId]);
  });

  it('B2: bad-genre injection — a foreign kr-idol-male genre id injected into kr-kids', () => {
    const workspaceId: WorkspaceId = 'kr-kids';
    const channel = channelFor(workspaceId);
    const foreignId = KRIDOL_M_CORE_GENRE_IDS[0];
    const opts = optsFor(workspaceId, { genreIds: [...channel.preferredGenres.slice(0, 2), foreignId] });
    const choices = userChoicesFromOptions(opts);
    const songs = runLocal(opts);
    const sanitized = sanitizeGenreIdsForArchetype(opts.genreIds, 'kr-kids-song');
    expect(sanitized.removed, 'B2 criterion 2: the foreign idol genre id must be removed').toEqual([foreignId]);
    expect(songs.every(s => s.genreId !== foreignId), 'B2: no song should ever be assigned the foreign genre id').toBe(true);
    assertFullContract('B2/kr-kids-contaminated', workspaceId, opts, choices, songs, [foreignId]);
  });

  it('B3: cross-workspace data — a jp-2030 channel spliced with kr-idol-male genre/vocal data (simulated bad import/restore)', () => {
    const workspaceId: WorkspaceId = 'jp-2030';
    const jpChannel = channelFor(workspaceId);
    const idolChannel = channelFor('kr-idol-male');
    const contaminatedChannel: ChannelProfile = {
      ...jpChannel,
      preferredGenres: idolChannel.preferredGenres,
      defaultVocal: idolChannel.defaultVocal
    };
    const opts = optsFor(workspaceId, { channel: contaminatedChannel, genreIds: contaminatedChannel.preferredGenres, vocalTone: contaminatedChannel.defaultVocal });
    const sanitized = sanitizeGenreIdsForArchetype(opts.genreIds, 'jp-2030-pop');
    expect(sanitized.removed.length, 'B3: every kr-idol-male genre id is foreign to jp-2030-pop and must be stripped').toBe(idolChannel.preferredGenres.length);
    expect(sanitized.recovered, 'B3: a fully-contaminated selection must recover to jp-2030-pop\'s own default genres').toBe(true);
    const choices = userChoicesFromOptions(opts);
    const songs = runLocal(opts);
    assertFullContract('B3/jp-2030-cross-workspace-import', workspaceId, opts, choices, songs, [...idolChannel.preferredGenres]);
  });

  it('B4: cross-workspace data (negative case) — kr-idol-male genres injected into kr-idol-female must NOT be flagged (they are intentionally shared per K3\'s own design)', () => {
    const maleGenreIds = KRIDOL_M_CORE_GENRE_IDS.slice(0, 3);
    const sanitized = sanitizeGenreIdsForArchetype([...maleGenreIds], 'kr-idol-female');
    expect(sanitized.removed, 'B4: kr-idol-male genres are legitimately shared with kr-idol-female — must not be removed').toEqual([]);
    expect(new Set(sanitized.valid), 'B4').toEqual(new Set(maleGenreIds));
    // Sanity: these are exactly the ids KRIDOL_F_CORE_GENRE_IDS also lists.
    for (const id of maleGenreIds) expect(KRIDOL_F_CORE_GENRE_IDS as readonly string[], `B4: ${id} must also be a real kr-idol-female genre`).toContain(id);
  });

  it('B5: custom channel — createDraftChannel with a real kr-2030 workspace template (the v5.9 fix)', () => {
    const workspaceId: WorkspaceId = 'kr-2030';
    const template = presetsForWorkspace(workspaceId)[0];
    const draft = createDraftChannel('내 커스텀 채널', template);
    expect(getWorkspace(workspaceId).archetypeIds, 'B5: draft must land inside its own workspace').toContain(draft.archetype);
    const opts = optsFor(workspaceId, { channel: draft, genreIds: draft.preferredGenres, vocalTone: draft.defaultVocal });
    const choices = userChoicesFromOptions(opts);
    const songs = runLocal(opts);
    assertFullContract('B5/kr-2030-custom-channel', workspaceId, opts, choices, songs);
  });

  it('B6: custom channel — the pre-v5.9 legacy bug pattern (no template) is caught both at save-time and at generation-contract-time', () => {
    const workspaceId: WorkspaceId = 'kr-kids';
    // The old, template-less call site every pre-v5.9 caller used — still reachable via createDraftChannel's own backward-compatible no-template signature.
    const mismatchedChannel = createDraftChannel('키즈 채널');
    expect(mismatchedChannel.archetype, 'B6: reproduces the exact pre-fix bug — falls back to senior-morning').toBe('senior-morning');
    // Save-time guard (v5.9's own fix) does catch it.
    const flagged = findArchetypeMismatches(workspaceId, [mismatchedChannel]);
    expect(flagged, 'B6: findArchetypeMismatches must flag this channel for kr-kids').toHaveLength(1);
    // Generation-contract-time defense in depth: criterion 1 must ALSO catch it if it ever reached generation ungated.
    const opts = optsFor(workspaceId, { channel: mismatchedChannel, genreIds: mismatchedChannel.preferredGenres, vocalTone: mismatchedChannel.defaultVocal });
    const choices = userChoicesFromOptions(opts);
    const songs = runLocal(opts);
    const contract = buildResolvedGenerationContract(opts, choices, songs, workspaceId);
    expect(getWorkspace(workspaceId).archetypeIds, 'B6 criterion 1: a mismatched channel\'s effective archetype must not belong to kr-kids').not.toContain(contract.archetype.effective);
    expect(contract.workspaceRecovery.mismatched, 'B6: workspaceRecovery must also flag the mismatch (defense in depth alongside criterion 1)').toBe(true);
  });

  it('B7: scaffold/first-run entry — a brand-new channel with no genres picked yet (genreIds: [])', () => {
    const workspaceId: WorkspaceId = 'jp-kids';
    const template = presetsForWorkspace(workspaceId)[0];
    const draft = createDraftChannel('New Playlist Channel', template);
    const opts = optsFor(workspaceId, { channel: draft, genreIds: [] });
    const sanitized = sanitizeGenreIdsForArchetype(opts.genreIds, draft.archetype!);
    expect(sanitized, 'B7: a genuinely empty selection is left alone (nothing to have been contaminated)').toEqual({ valid: [], removed: [], recovered: false });
    expect(() => runLocal(opts), 'B7: generation must not crash on a scaffold/first-run empty genre selection').not.toThrow();
    const songs = runLocal(opts);
    expect(songs.length, 'B7').toBe(opts.songCount);
    const choices = userChoicesFromOptions(opts);
    assertContractLevelCriteria('B7/jp-kids-scaffold', workspaceId, opts, choices, songs); // 1-4 (channel still resolves to a real jp-kids-song archetype even with zero genres picked)
    assertNoArtistLeakText('B7/jp-kids-scaffold', songs.map(s => ({ trackNo: s.trackNo, text: s.stylePrompt })));
    assertKidsSafeText('B7/jp-kids-scaffold', workspaceId, songs.map(s => ({ trackNo: s.trackNo, text: `${s.title}\n${s.hookPhrase}\n${s.lyrics}` })));
  });

  it('B8: corrupted data — malformed GenerationOptions.genreIds (empty strings, duplicates, an unknown id mixed with valid ones)', () => {
    const workspaceId: WorkspaceId = 'kr-2030';
    const channel = channelFor(workspaceId);
    const opts = optsFor(workspaceId, {
      genreIds: ['', channel.preferredGenres[0], channel.preferredGenres[0], 'totally-unknown-genre-id', ''],
      moodIds: [],
      avoidWords: undefined as unknown as string
    });
    expect(() => runLocal(opts), 'B8: generation must not crash on corrupted genreIds').not.toThrow();
    const songs = runLocal(opts);
    expect(songs.length, 'B8').toBe(opts.songCount);
    const sanitized = sanitizeGenreIdsForArchetype(opts.genreIds, 'kr-2030-pop');
    expect(sanitized.removed, 'B8: the empty-string and unknown ids must be dropped, the valid one kept').toContain('totally-unknown-genre-id');
    expect(sanitized.valid, 'B8: the one genuinely valid id must survive').toContain(channel.preferredGenres[0]);
    const choices = userChoicesFromOptions(opts);
    assertFullContract('B8/kr-2030-corrupted-genreIds', workspaceId, opts, choices, songs, ['', 'totally-unknown-genre-id', '']);
  });

  it('B9: corrupted data — a PreassignedSongSlot missing most optional fields reconciled against a real model song', () => {
    const workspaceId: WorkspaceId = 'senior-oldpop';
    const opts = optsFor(workspaceId);
    const bareSlot: PreassignedSongSlot = {
      trackNo: 1,
      title: 'Bare Slot Title',
      hookPhrase: 'Bare Hook',
      songRole: 'cold-open',
      tempo: 96,
      emotionArc: 'hopeful',
      moneyChordText: ''
      // every other optional field intentionally omitted
    };
    const modelSong: SongIdea = {
      trackNo: 1,
      title: 'Model Title',
      seasonMoment: '', listenerSituation: '', emotionArc: '',
      hookPhrase: 'Model Hook',
      stylePrompt: 'warm acoustic pop mood, mature soulful male tenor, 96 BPM',
      lyrics: '[verse 1]\nsome lyrics',
      youtube: { title: 'Model Title', description: '', tags: [] },
      qualityScore: 0,
      warnings: []
    };
    expect(() => reconcileWithPreassignedSlot(modelSong, bareSlot, 'ai-creative', { archetype: opts.channel.archetype }), 'B9: reconciliation must not crash on a slot missing most optional fields').not.toThrow();
    const fixed = reconcileWithPreassignedSlot(modelSong, bareSlot, 'ai-creative', { archetype: opts.channel.archetype });
    expect(fixed.title.length, 'B9: title must still be non-empty').toBeGreaterThan(0);
    expect(fixed.hookPhrase.length, 'B9: hookPhrase must still be non-empty').toBeGreaterThan(0);
    expect(fixed.lyrics.length, 'B9: lyrics must still be non-empty').toBeGreaterThan(0);
    assertNoArtistLeakText('B9/senior-oldpop-bare-slot', [{ trackNo: 1, text: fixed.stylePrompt }]);
  });

  it('B10: large set — songCount 30 for a fixed-vocal-quota workspace (kr-idol-male)', () => {
    const workspaceId: WorkspaceId = 'kr-idol-male';
    const channel = channelFor(workspaceId);
    const opts = optsFor(workspaceId, { songCount: 30 });
    const choices = userChoicesFromOptions(opts);
    const start = performance.now();
    const songs = runLocal(opts);
    const elapsedMs = performance.now() - start;
    expect(songs.length, 'B10').toBe(30);
    expect(elapsedMs, 'B10: a 30-song pack should still generate in well under 20s').toBeLessThan(20_000);
    const tally = { male: 0, female: 0, mixed: 0 };
    for (const s of songs) if (s.vocalType) tally[s.vocalType] += 1;
    // vocalQuotaOverride is a fixed 15/0/3 ratio scaled — real check is proportional, not exact, at 30 songs (2x the channel's own 18-song reference scale).
    expect(channel.vocalQuotaOverride, 'B10: fixture sanity — kr-idol-male must have a fixed vocal quota').toBeTruthy();
    expect(tally.male, 'B10: male-only-quota workspace scaled to 30 songs must stay male-dominant').toBeGreaterThan(tally.female);
    assertFullContract('B10/kr-idol-male-30-songs', workspaceId, opts, choices, songs);
  });
});

// ---------------------------------------------------------------------------
// Bridge instruction — 13-item content verification (Gap 3). The existing
// 필수 bridge-instruction test above only ever checked criteria 1-4 plus an
// artist-leak scan; this checks buildClaudeCodeInstruction's REAL current
// output shape (both the embedded request-payload JSON block and the
// instruction prose) for the 13 items this session's own gap analysis named
// as missing coverage: lyricLanguage, effectiveArchetype, audienceProfile,
// money-chord selection, vocal gender+tone, genreBlendMode, perspectiveMode,
// kidsAgeTierId, forbidden phrases, song count, per-song slot assignment,
// response JSON schema, and trackNo-omission guidance.
//
// genreBlendMode (#6) and perspectiveMode (#7) are deliberately verified
// BEHAVIORALLY rather than by grepping the instruction text for a literal
// "genreBlendMode:"/"perspectiveMode:" label — neither axis's name ever
// reaches the instruction as its own labeled field; both are fully resolved
// upstream (core/genreRotation.ts's genresForTrack, core/lyricDiversityPlan.ts's
// buildPovPlan) into each slot's own genreText/pov BEFORE buildClaudeCodeInstruction
// ever runs, so the real, checkable signal is that changing the axis changes
// what the agent is actually handed, not a missing text label. This is a
// design observation, not a bug — see the report for this task for the full
// note.
// ---------------------------------------------------------------------------

describe('[workspace contract matrix] bridge instruction — 13-item content verification', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId}`, () => {
      const isKids = workspaceId === 'kr-kids' || workspaceId === 'jp-kids';
      const opts = optsFor(workspaceId, {
        moneyChordMode: 'emotional',
        moneyChordModeIsExplicitChoice: true,
        perspectiveMode: 'fixed',
        perspectiveModeIsExplicitChoice: true,
        customConcept: 'a quiet story about letting go',
        ...(isKids ? { kidsAgeTierId: 'kids-t1' as const } : {})
      });
      const slots = runBatchSlots(opts);
      const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.audience);
      const resolvedConstraints = resolveConstraintsFromOptions(opts, audienceProfile, workspaceId);
      const instruction = buildClaudeCodeInstruction(opts, genresFor(opts), moodsFor(opts), testSeason, undefined, slots, false, { resolvedConstraints });

      const jsonMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
      expect(jsonMatch, `${workspaceId}/bridge-13item: request payload JSON block must be present`).toBeTruthy();
       
      const payload = JSON.parse(jsonMatch![1]) as any;

      // 1. lyricLanguage
      expect(payload.lyricLanguage, `${workspaceId}/bridge-13item #1 lyricLanguage`).toBe(opts.lyricLanguage);

      // 2. effectiveArchetype — the real channel archetype actually sent to the agent, and it belongs to this workspace.
      expect(payload.channel.archetype, `${workspaceId}/bridge-13item #2 effectiveArchetype in payload`).toBe(opts.channel.archetype);
      expect(getWorkspace(workspaceId).archetypeIds, `${workspaceId}/bridge-13item #2 effectiveArchetype belongs to workspace`).toContain(payload.channel.archetype);

      // 3. audienceProfile — the real audience id and its generation pack both reach the agent.
      expect(payload.audience, `${workspaceId}/bridge-13item #3 audienceProfile (audience id)`).toBe(opts.audience);
      expect(audienceProfile.id, `${workspaceId}/bridge-13item #3 audienceProfile resolves to a real profile`).toBeTruthy();

      // 4. money-chord selection — the explicit user pick is named in the payload and its verbatim-weave instruction line is present.
      expect(payload.moneyChordMode, `${workspaceId}/bridge-13item #4 moneyChordMode in payload`).toBe('emotional');
      expect(instruction, `${workspaceId}/bridge-13item #4 moneyChordText instruction line present`).toMatch(/moneyChordText/);

      // 5. vocal gender+tone — the resolved tone reaches the payload, and the per-track vocal-composition table/rule is present.
      expect(payload.vocalTone, `${workspaceId}/bridge-13item #5 vocalTone in payload`).toBe(opts.vocalTone || opts.channel.defaultVocal);
      expect(instruction, `${workspaceId}/bridge-13item #5 vocal composition section present`).toContain("This set's vocal composition");

      // 6. genreBlendMode — behavioral check (see this describe block's own header comment): switching modes must change what each slot's genreText/effectiveGenreIds actually carries into the instruction, for a multi-genre selection.
      const blendPool = CORE_GENRE_IDS_BY_ARCHETYPE[opts.channel.archetype as ChannelArchetype] ?? [];
      if (blendPool.length >= 2) {
        const sharedPrimarySlots = runBatchSlots(optsFor(workspaceId, { genreIds: blendPool.slice(0, 2), genreBlendMode: 'shared-primary' }));
        const leadOnlySlots = runBatchSlots(optsFor(workspaceId, { genreIds: blendPool.slice(0, 2), genreBlendMode: 'lead-only' }));
        const differs = sharedPrimarySlots.some((slot, i) => slot.effectiveGenreIds.length !== leadOnlySlots[i]?.effectiveGenreIds.length);
        expect(differs, `${workspaceId}/bridge-13item #6 genreBlendMode changes each slot's resolved genre set`).toBe(true);
      }

      // 7. perspectiveMode — 'fixed' (set above) must give every slot the chosen perspective (100%), not the 'dominant' default's ~60% lean.
      const slotsWithPov = slots.filter(slot => slot.pov);
      expect(slotsWithPov.every(slot => slot.pov === opts.perspective), `${workspaceId}/bridge-13item #7 perspectiveMode 'fixed' gives every slot the chosen perspective`).toBe(true);

      // 8. kidsAgeTierId — kids workspaces only: every slot's tempo stays inside the explicitly requested tier's own range.
      if (isKids) {
        const tier = kidsAgeTierFor('kids-t1');
        for (const slot of slots) {
          expect(slot.tempo, `${workspaceId}/bridge-13item #8 kidsAgeTierId tempo range (track ${slot.trackNo})`).toBeGreaterThanOrEqual(tier.tempoRange[0]);
          expect(slot.tempo, `${workspaceId}/bridge-13item #8 kidsAgeTierId tempo range (track ${slot.trackNo})`).toBeLessThanOrEqual(tier.tempoRange[1]);
        }
      }

      // 9. forbidden phrases — resolvedConstraints.vocabulary.forbidden, when non-empty, must actually render in the [이 세트의 컨셉 제약] section.
      if (resolvedConstraints.vocabulary.forbidden.length) {
        expect(instruction, `${workspaceId}/bridge-13item #9 forbidden phrases rendered`).toContain(resolvedConstraints.vocabulary.forbidden[0]);
      }

      // 10. song count — named in both the output-requirement prose and the payload.
      expect(instruction, `${workspaceId}/bridge-13item #10 song count in output requirement`).toContain(`${opts.songCount} objects total`);
      expect(payload.songCount, `${workspaceId}/bridge-13item #10 song count in payload`).toBe(opts.songCount);

      // 11. per-song slot assignment — every real trackNo's own row appears in the per-track plan table.
      for (const slot of slots) {
        expect(instruction, `${workspaceId}/bridge-13item #11 track ${slot.trackNo} row present in per-track plan table`).toContain(`| ${slot.trackNo} |`);
      }

      // 12. response JSON schema — outputShape.songs[0] names every field a real SongIdea needs, including trackNo.
      const exampleSong = payload.outputShape.songs[0];
      for (const field of ['trackNo', 'title', 'hookPhrase', 'stylePrompt', 'lyrics', 'youtube']) {
        expect(exampleSong, `${workspaceId}/bridge-13item #12 schema field "${field}" present`).toHaveProperty(field);
      }

      // 13. trackNo-omission guidance — the schema's own example literally shows a trackNo value, so an agent following outputShape verbatim cannot omit it without visibly deviating from the shown shape.
      expect(exampleSong.trackNo, `${workspaceId}/bridge-13item #13 trackNo present in schema example`).toBe(1);
    });
  }
});
