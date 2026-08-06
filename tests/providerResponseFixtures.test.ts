/**
 * TASK (matrix gap-closing, Gap 1) — real, verified weakness in
 * tests/workspaceContractMatrix.test.ts's own "실시간 API" substitute
 * (runRealtimeSubstitute): it only ever feeds ONE locally-built, always-
 * correct synthetic "model response" through reconcileWithPreassignedSlot.
 * That never exercises what happens with a genuinely malformed/adversarial
 * response — broken JSON, missing tracks, wrong language, artist-name leaks,
 * etc — exactly what a real AI provider or a flaky bridge round-trip can
 * actually produce.
 *
 * This file feeds 12 real, structurally distinct provider-response fixtures
 * (tests/fixtures/providerResponses/*.json) through the REAL import path
 * every actual bridge/Claude-Code-agent response funnels through —
 * core/bridgeImport.ts's importSongsJson (JSON parsing/lenient-extraction,
 * per-song required-field validation, reconcileWithPreassignedSlot, quality
 * scoring) — for each of the 7 real workspaces. 11 of the 12 are deliberately
 * "wrong" in one specific, realistic way; this checks that this app's own
 * REAL detection mechanisms (already built this session, never a parallel
 * copy) actually catch each one — sanitizeGenreIdsForArchetype,
 * lyricLanguageMismatchWarning, findArtistReferenceLeaks, quality.ts's
 * famousArtistNames/prompt-length checks, importSongsJson's own required-
 * field/parse-failure/count-mismatch reporting. `normal.json` must import
 * cleanly everywhere with zero false-positive warnings.
 *
 * Deliberately kept out of `npm test`/`test:fast` — wired into the same
 * separate `npm run test:matrix` command as workspaceContractMatrix.test.ts
 * (see vitest.matrix.config.ts's `include`), never the default suite.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSongsJson } from '../src/core/bridgeImport';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { sanitizeGenreIdsForArchetype } from '../src/core/genreSelection';
import { getWorkspace } from '../src/data/workspaces';
import { findArtistReferenceLeaks } from '../src/core/artistReferenceDecomposer';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { ChannelProfile, GenerationOptions, WorkspaceId } from '../src/types';

const WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

/** Mirrors workspaceContractMatrix.test.ts's own WORKSPACE_CHANNEL_ID — kept as its own small local copy rather than a cross-test-file import so this file stays independently runnable/readable. */
const WORKSPACE_CHANNEL_ID: Record<WorkspaceId, string> = {
  'senior-oldpop': 'good-morning-memory-radio',
  'kr-2030': 'after-work-band-pop',
  'jp-2030': 'reiwa-way-home-jpop',
  'kr-kids': 'follow-along-action-song',
  'jp-kids': 'teasobi-hiroba',
  'kr-idol-male': 'stage-night',
  'kr-idol-female': 'daylight-city-kpop'
};

/** Small on purpose (5 tracks, not 12/18) — keeps 12 fixtures x 7 workspaces = 84 real import runs fast; every fixture's trackNo range is 1..5. */
const FIXTURE_SONG_COUNT = 5;
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures', 'providerResponses');

function channelFor(workspaceId: WorkspaceId): ChannelProfile {
  const channel = channelPresets.find(c => c.id === WORKSPACE_CHANNEL_ID[workspaceId]);
  if (!channel) throw new Error(`no fixture channel registered for workspace ${workspaceId}`);
  return channel;
}

/**
 * Fixture content is plain English throughout (see the fixture files'
 * own generation) — lyricLanguage defaults to 'english' here regardless of
 * a given workspace's own real default, so `normal.json` is genuinely clean
 * on every one of the 7 workspaces rather than only the English-default
 * ones. Individual test cases override lyricLanguage/vocalQuota explicitly
 * where the fixture under test specifically needs a controlled mismatch
 * (wrongLanguage.json, wrongVocalMetaTag.json).
 */
function optsFor(workspaceId: WorkspaceId, overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = channelFor(workspaceId);
  return makeOptions({
    channel,
    songCount: FIXTURE_SONG_COUNT,
    lyricLanguage: 'english',
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

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

/**
 * TASK (matrix gap-closing) — two warning categories are structurally
 * inherent to ANY reconciled bridge/import pack, not specific to this
 * fixture's own content, so they don't count as "false positives" for the
 * normal.json/withPreamble.json clean-import checks below:
 *  - the style-prompt word/char soft-target overage (STYLE_WORD_TARGET_MAX
 *    35 / STYLE_CHAR_TARGET 450, quality.ts's scoreSong): reconcileWithPreassignedSlot
 *    unconditionally appends every slot-owned verbatim atom (vocalText,
 *    moneyChordText, genreText, hookDeviceText, introTextureText,
 *    instrumentSet, arrangementDensity text, tempo) onto whatever the
 *    response already wrote — that alone is comfortably past 35 words
 *    regardless of how minimal the response's own stylePrompt is, so this
 *    fires on real, well-formed production packs too, not just a test
 *    fixture (a soft -5/-15 score deduction, never a hard rejection).
 *  - the titleLocalized-fallback notice (bridgeImport.ts's
 *    normalizeImportedSong): fires whenever packagingLanguage isn't English
 *    and the response omits the optional "titleLocalized" field — accurate,
 *    self-healing behavior (the app fills a real localized title in), not a
 *    defect in the response.
 *  - songPostProcess.ts's longStylePromptClauseWarnings ("style prompt
 *    clause ... is N words long") — its own doc comment calls it
 *    "diagnostic only, never rewrites"; a slot's own hookDeviceText/
 *    introTextureText/instrumentSet append can legitimately run past the
 *    per-clause word cap regardless of what the response itself wrote.
 *  - batchPreallocation.ts's structureTemplate-marker warning ("assigned
 *    structureTemplate T_ but its section marker ... doesn't appear in the
 *    lyrics") — a static fixture's own fixed [Verse]/[Chorus]/[Bridge]
 *    section shape can't possibly pre-match every structure template a
 *    dynamic, per-workspace/per-seed slot plan might assign to it.
 */
const BENIGN_WARNING_PATTERNS = [
  /^Style prompt is \d+ (words|chars)/,
  /titleLocalized/,
  /^Track \d+: style prompt clause ".*" is \d+ words long\.$/,
  /assigned structureTemplate .* doesn't appear in the lyrics/
];
function nonBenignWarnings(warnings: string[]): string[] {
  return warnings.filter(w => !BENIGN_WARNING_PATTERNS.some(pattern => pattern.test(w)));
}

function runFixture(workspaceId: WorkspaceId, fixtureName: string, optsOverrides: Partial<GenerationOptions> = {}) {
  const opts = optsFor(workspaceId, optsOverrides);
  const genres = genresFor(opts);
  const moods = moodsFor(opts);
  const slots = preallocateSongSlots(opts, genres);
  const rawText = loadFixture(fixtureName);
  const report = importSongsJson(rawText, opts, genres, moods, testSeason, slots);
  return { opts, genres, moods, slots, report };
}

describe('[provider-response fixtures] normal.json imports cleanly with zero false-positive warnings', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId}`, () => {
      const { opts, report } = runFixture(workspaceId, 'normal.json');
      expect(report.blueprint, `${workspaceId}/normal: blueprint must parse and import`).not.toBeNull();
      expect(report.importedCount, `${workspaceId}/normal: every requested song imported`).toBe(opts.songCount);
      expect(report.skippedCount, `${workspaceId}/normal: nothing skipped`).toBe(0);
      expect(report.warnings, `${workspaceId}/normal: zero pack-level warnings`).toEqual([]);
      for (const song of report.blueprint!.songs) {
        expect(nonBenignWarnings(song.warnings), `${workspaceId}/normal: track ${song.trackNo} zero non-benign per-song warnings`).toEqual([]);
      }
    });
  }
});

describe('[provider-response fixtures] withPreamble.json — correct JSON wrapped in explanatory prose still imports cleanly', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's parseLeniently (fenced-code-block stripping)`, () => {
      const { opts, report } = runFixture(workspaceId, 'withPreamble.json');
      expect(report.blueprint, `${workspaceId}/withPreamble: prose wrapper must not block parsing`).not.toBeNull();
      expect(report.importedCount, `${workspaceId}/withPreamble: every requested song imported`).toBe(opts.songCount);
      expect(report.warnings, `${workspaceId}/withPreamble: zero pack-level warnings`).toEqual([]);
      for (const song of report.blueprint!.songs) {
        expect(nonBenignWarnings(song.warnings), `${workspaceId}/withPreamble: track ${song.trackNo} zero non-benign per-song warnings`).toEqual([]);
      }
    });
  }
});

describe('[provider-response fixtures] missingTracks.json — 4 of 5 requested tracks present', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's countMismatchWarning`, () => {
      const { opts, report } = runFixture(workspaceId, 'missingTracks.json');
      expect(report.blueprint, `${workspaceId}/missingTracks: a partial pack still imports (not a hard failure)`).not.toBeNull();
      expect(report.importedCount, `${workspaceId}/missingTracks: only the 4 delivered tracks import`).toBe(4);
      expect(report.importedCount, `${workspaceId}/missingTracks: real shortfall vs requested`).toBeLessThan(opts.songCount);
      expect(
        report.warnings.some(w => w.includes('요청한 곡 수') && w.includes('실제로 가져온 곡 수')),
        `${workspaceId}/missingTracks: countMismatchWarning must fire`
      ).toBe(true);
    });
  }
});

describe('[provider-response fixtures] duplicateTrackNo.json — two entries claim the same trackNo', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — real behavior verified: reconciliation keys off the CLAIMED trackNo, not the final renumbered position (discovered gap)`, () => {
      const { opts, slots, report } = runFixture(workspaceId, 'duplicateTrackNo.json');
      expect(report.blueprint, `${workspaceId}/duplicateTrackNo: must not crash or hard-fail`).not.toBeNull();
      // Every surviving entry gets sorted then renumbered 1..N by position
      // (importSongsJson), so the pack never comes up short — no
      // countMismatchWarning fires here, unlike missingTracks.json.
      expect(report.importedCount, `${workspaceId}/duplicateTrackNo: total surviving entries still equals the request`).toBe(opts.songCount);

      // DISCOVERED GAP: reconcileWithPreassignedSlot forces genreId/
      // vocalType/tempo from the slot matching the response's own CLAIMED
      // trackNo — resolved BEFORE the sort+renumber pass runs, not from the
      // slot matching where the entry ends up afterward. This fixture's
      // array order is [claim 1, claim 2, claim 3 (original), claim 3
      // (duplicate, carries the dropped track 5's content), claim 4]; sort
      // is a no-op (already ascending) and renumbering assigns final
      // trackNos 1-5 by position. So both entries that claimed trackNo 3
      // get slot 3's fields forced onto them — meaning FINAL tracks 3 AND 4
      // both duplicate slot 3's own genreId/vocalType/tempo instead of each
      // carrying its own distinct slot's plan, while the entry that claimed
      // trackNo 4 (slot 4's real fields) lands at FINAL track 5, and slot
      // 5's own real plan is never used by anyone. The pack still counts
      // out correctly and every individual field is still internally valid
      // (a real genreId, a real tempo) — but the per-track diversity plan
      // silently shifts/duplicates rather than following final position.
      const songs = report.blueprint!.songs;
      const slot3 = slots.find(s => s.trackNo === 3)!;
      const slot4 = slots.find(s => s.trackNo === 4)!;
      expect(songs[2].genreId, `${workspaceId}/duplicateTrackNo: final track 3 carries slot 3's fields (its original claim)`).toBe(slot3.genreId);
      expect(songs[3].genreId, `${workspaceId}/duplicateTrackNo: final track 4 ALSO carries slot 3's fields (the duplicate claim), not slot 4's`).toBe(slot3.genreId);
      expect(songs[4].genreId, `${workspaceId}/duplicateTrackNo: final track 5 carries slot 4's fields (shifted down from the claim-4 entry), not slot 5's`).toBe(slot4.genreId);
      expect(songs[2].stylePrompt, `${workspaceId}/duplicateTrackNo: final track 3 tempo comes from slot 3`).toContain(`${slot3.tempo} BPM`);
      expect(songs[3].stylePrompt, `${workspaceId}/duplicateTrackNo: final track 4 tempo ALSO comes from slot 3, not slot 4`).toContain(`${slot3.tempo} BPM`);
    });
  }
});

describe('[provider-response fixtures] invalidTrackNo.json — a trackNo outside the valid 1..songCount range', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: positional renumbering (count-safe) + reconcileWithPreassignedSlot's no-slot-branch genre sanitization; DISCOVERED GAP noted below`, () => {
      const { opts, slots, report } = runFixture(workspaceId, 'invalidTrackNo.json');
      expect(report.blueprint, `${workspaceId}/invalidTrackNo: must not crash or hard-fail`).not.toBeNull();
      expect(report.importedCount, `${workspaceId}/invalidTrackNo: out-of-range trackNo doesn't shrink the pack — renumbering still lands it in range`).toBe(opts.songCount);

      const songs = report.blueprint!.songs;
      // Tracks 1-4 originally claimed valid trackNos and matched a real slot
      // at parse time — full slot-forced contract still holds for them.
      for (const song of songs.slice(0, 4)) {
        const slot = slots.find(s => s.trackNo === song.trackNo)!;
        expect(song.genreId, `${workspaceId}/invalidTrackNo: track ${song.trackNo} genreId matches its slot`).toBe(slot.genreId);
      }
      // Track 5 (final position) is the entry that originally claimed
      // trackNo 42 — out of range, so slotByTrackNo.get(42) found nothing at
      // reconciliation time. reconcileWithPreassignedSlot's own `!slot`
      // branch is the one real defense that still runs: it re-validates any
      // genreId the response supplied against the workspace's archetype
      // (this fixture deliberately supplies the foreign 'krkids-action' id).
      const archetype = opts.channel.archetype!;
      const expectSanitized = sanitizeGenreIdsForArchetype(['krkids-action'], archetype);
      const finalSong = songs[songs.length - 1];
      if (expectSanitized.removed.length) {
        expect(finalSong.genreId, `${workspaceId}/invalidTrackNo: no-slot branch strips a foreign genreId`).toBeUndefined();
      } else {
        // krkids-action is native to kr-kids/jp-kids themselves.
        expect(finalSong.genreId, `${workspaceId}/invalidTrackNo: native genreId survives the no-slot branch unchanged`).toBe('krkids-action');
      }
      // DISCOVERED GAP (honest finding, not asserted as a failure): unlike
      // duplicateTrackNo above, an out-of-range trackNo gets NO matching
      // slot at all, so every OTHER slot-owned guarantee (tempo enforcement,
      // vocalType, structureTemplate, arc phase) is silently skipped for
      // this one track — it doesn't crash and the pack count stays correct,
      // but that track's planned diversity/tempo contract is simply absent.
    });
  }
});

describe('[provider-response fixtures] missingStylePrompt.json — a track missing its stylePrompt field', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's REQUIRED_SONG_FIELDS check`, () => {
      const { opts, report } = runFixture(workspaceId, 'missingStylePrompt.json');
      expect(report.skippedCount, `${workspaceId}/missingStylePrompt: exactly the one bad track is skipped`).toBe(1);
      expect(
        report.skippedReasons.some(reason => reason.includes('stylePrompt')),
        `${workspaceId}/missingStylePrompt: skip reason must name the missing field`
      ).toBe(true);
      expect(report.importedCount, `${workspaceId}/missingStylePrompt: the other 4 tracks still import`).toBe(4);
      expect(
        report.warnings.some(w => w.includes('요청한 곡 수') && w.includes('실제로 가져온 곡 수')),
        `${workspaceId}/missingStylePrompt: countMismatchWarning also fires`
      ).toBe(true);
      expect(opts.songCount).toBe(5);
    });
  }
});

describe('[provider-response fixtures] missingLyrics.json — a track missing its lyrics field', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's REQUIRED_SONG_FIELDS check`, () => {
      const { report } = runFixture(workspaceId, 'missingLyrics.json');
      expect(report.skippedCount, `${workspaceId}/missingLyrics: exactly the one bad track is skipped`).toBe(1);
      expect(
        report.skippedReasons.some(reason => reason.includes('lyrics')),
        `${workspaceId}/missingLyrics: skip reason must name the missing field`
      ).toBe(true);
      expect(report.importedCount, `${workspaceId}/missingLyrics: the other 4 tracks still import`).toBe(4);
    });
  }
});

describe('[provider-response fixtures] wrongLanguage.json — lyrics body in the wrong language for the pack\'s lyricLanguage', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: lyricLanguageMismatchWarning (core/lyricMetrics.ts, threaded through reconcileWithPreassignedSlot)`, () => {
      // Fixture content is plain English; forcing lyricLanguage to 'korean'
      // here makes every track a genuine, controlled mismatch regardless of
      // which of the 7 workspaces is under test.
      const { report } = runFixture(workspaceId, 'wrongLanguage.json', { lyricLanguage: 'korean' });
      expect(report.blueprint, `${workspaceId}/wrongLanguage: must still import (a warning, not a hard rejection)`).not.toBeNull();
      for (const song of report.blueprint!.songs) {
        expect(
          song.warnings.some(w => w.includes("lyricLanguage is 'korean'")),
          `${workspaceId}/wrongLanguage: track ${song.trackNo} must carry the real language-mismatch warning`
        ).toBe(true);
      }
    });
  }
});

describe("[provider-response fixtures] wrongVocalMetaTag.json — a vocal meta-tag that contradicts the track's assigned vocalType", () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — stylePrompt gender IS corrected; the lyric bracket tag is NOT (discovered gap)`, () => {
      // Force every slot to vocalType 'male' so the fixture's hard-coded
      // "[female vocal]" tag is a deterministic, uniform mismatch on every
      // one of the 7 workspaces regardless of that workspace's own seeded
      // vocal-plan output.
      const { report } = runFixture(workspaceId, 'wrongVocalMetaTag.json', { vocalQuota: { male: FIXTURE_SONG_COUNT, female: 0, mixed: 0 } });
      expect(report.blueprint, `${workspaceId}/wrongVocalMetaTag: must still import`).not.toBeNull();
      for (const song of report.blueprint!.songs) {
        expect(song.vocalType, `${workspaceId}/wrongVocalMetaTag: track ${song.trackNo} slot-forced vocalType is male`).toBe('male');
        // Real, working detection/correction: enforceVocalTextInStylePrompt +
        // appendVerbatimIfMissing (batchPreallocation.ts) DO repair the
        // style-prompt-level gender description to match the real slot.
        expect(
          /\bfemale\b/i.test(song.stylePrompt),
          `${workspaceId}/wrongVocalMetaTag: track ${song.trackNo} stylePrompt must not still claim female after reconciliation`
        ).toBe(false);
        // DISCOVERED GAP: core/vocalPlan.ts's ensureVocalMetaTag only checks
        // "is ANY vocal meta tag already present at the top of the lyrics" —
        // it never checks that the tag MATCHES the slot's real vocalType, so
        // an already-wrong tag from the response survives reconciliation
        // completely uncorrected. Pinned here as real, current behavior
        // (not silently tolerated) rather than hidden by a looser assertion.
        expect(
          song.lyrics.trim().startsWith('[female vocal]'),
          `${workspaceId}/wrongVocalMetaTag: KNOWN GAP — the wrong lyric meta-tag survives reconciliation uncorrected`
        ).toBe(true);
      }
    });
  }
});

describe('[provider-response fixtures] artistNameLeak.json — a real/recognizable artist name embedded in a field', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: quality.ts's famousArtistNames scan + artistReferenceDecomposer.ts's findArtistReferenceLeaks`, () => {
      const { report } = runFixture(workspaceId, 'artistNameLeak.json');
      expect(report.blueprint, `${workspaceId}/artistNameLeak: must still import (a warning, not a hard rejection)`).not.toBeNull();
      const track1 = report.blueprint!.songs.find(s => s.trackNo === 1)!;
      expect(
        track1.warnings.some(w => w.includes('Famous artist reference risk')),
        `${workspaceId}/artistNameLeak: quality.ts's scoreSong must flag the leaked name`
      ).toBe(true);
      expect(
        findArtistReferenceLeaks(track1.stylePrompt).length,
        `${workspaceId}/artistNameLeak: artistReferenceDecomposer.ts's own leak scanner independently confirms it`
      ).toBeGreaterThan(0);
    });
  }
});

describe('[provider-response fixtures] overLength.json — a stylePrompt/lyrics field way past normal budget limits', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected AND auto-corrected by: quality.ts's enforcePromptLengthBudget (SUNO_COPY_LIMIT trim) + over-length lyrics warning`, () => {
      const { report } = runFixture(workspaceId, 'overLength.json');
      expect(report.blueprint, `${workspaceId}/overLength: must still import`).not.toBeNull();
      const track1 = report.blueprint!.songs.find(s => s.trackNo === 1)!;
      expect(
        track1.warnings.some(w => w.includes('trimmed to fit')),
        `${workspaceId}/overLength: stylePrompt-overflow warning must fire`
      ).toBe(true);
      expect(
        track1.warnings.some(w => w.toLowerCase().includes('too long')),
        `${workspaceId}/overLength: lyrics-overflow warning must fire`
      ).toBe(true);
      // Real self-healing: the final stylePrompt actually pasted into Suno
      // is trimmed back under the hard limit, not merely flagged.
      expect(track1.stylePrompt.length, `${workspaceId}/overLength: final stylePrompt is auto-trimmed under Suno's 1000-char limit`).toBeLessThanOrEqual(1000);
    });
  }
});

describe('[provider-response fixtures] truncatedJson.json — genuinely malformed/incomplete JSON (cut off mid-structure)', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — rejected at the PARSE stage, never reaches reconciliation`, () => {
      const { report } = runFixture(workspaceId, 'truncatedJson.json');
      expect(report.blueprint, `${workspaceId}/truncatedJson: unparseable input must not produce a blueprint`).toBeNull();
      expect(report.importedCount, `${workspaceId}/truncatedJson: nothing imported`).toBe(0);
      expect(
        report.skippedReasons.some(reason => reason.includes('JSON을 해석하지 못했습니다')),
        `${workspaceId}/truncatedJson: the real parse-failure message must be reported`
      ).toBe(true);
    });
  }
});
