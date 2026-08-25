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
 * This file feeds real, structurally distinct provider-response fixtures
 * through the REAL import path every actual bridge/Claude-Code-agent
 * response funnels through — core/bridgeImport.ts's importSongsJson (JSON
 * parsing/lenient-extraction, per-song required-field validation,
 * reconcileWithPreassignedSlot, quality scoring) — for each of the 7 real
 * workspaces. Most fixtures are deliberately "wrong" in one specific,
 * realistic way; this checks that this app's own REAL detection mechanisms
 * (already built this session, never a parallel copy) actually catch each
 * one — sanitizeGenreIdsForArchetype, lyricLanguageMismatchWarning,
 * findArtistReferenceLeaks, quality.ts's famousArtistNames/prompt-length
 * checks, importSongsJson's own required-field/parse-failure/count-mismatch
 * reporting, core/tempoComplianceGate.ts's tempo-wording contradiction check.
 *
 * 지시문 32 (§2) — reorganized into 3 subdirectories matching what a fixture
 * actually proves:
 *   - clean/    zero warnings expected, real content (see each fixture's own
 *               provenance note below), tested against the ONE workspace it
 *               was genuinely verified clean for — not shared across all 7.
 *   - warning/  content still fully imports for every track; a real,
 *               non-blocking issue is flagged (or self-healed) and the test
 *               asserts that flag/correction actually fires.
 *   - blocking/ the checker must actively reject something (a malformed
 *               whole response, a structurally invalid track) OR must catch
 *               a genuine content contradiction (normal.json/withPreamble.json,
 *               see their own describe blocks below) — the test asserts the
 *               rejection/detection actually happens, never "zero warnings".
 * `normal.json`/`withPreamble.json` used to be tested for "zero warnings"
 * across all 7 workspaces and failed on all 7 (14 real test-case failures,
 * matrix baseline before this directive) — not a fixture bug. The fixture's
 * own stylePrompt wording (mood adjectives like "gentle"/"unhurried", tuned
 * for senior-oldpop's slower BPM range at authoring time) genuinely
 * contradicts the BPM core/tempoComplianceGate.ts enforces for faster
 * workspaces (kr-2030/kr-kids/jp-kids/kr-idol-*), and jp-2030's own genre
 * ("brushed drum kit" vs "jp2030-heisei-nostalgia") independently contradicts
 * itself; senior-oldpop's own track 5 separately has a real sentence-
 * repetition/syllable-density lyrics defect. All three are real detections
 * this app's checkers are SUPPOSED to make — content was never edited to
 * force a pass; the two describe blocks below now assert the violation IS
 * detected instead of asserting it's absent.
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
import { findArtistReferenceLeaks } from '../src/core/artistReferenceDecomposer';
import { isKidsArchetype } from '../src/utils/channelArchetype';
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

/** Small on purpose (5 tracks, not 12/18) — keeps the warning/+blocking/ fixtures (7 workspaces each) fast; every one of those fixtures' trackNo range is 1..5. clean/ fixtures are separate, single-song, single-workspace (see their own describe block). */
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
 *  - 지시문 19 (TASK B) — core/stylePromptBudget.ts's own per-workspace
 *    word-budget warning ("Track N: stylePrompt is X words (workspace
 *    target...)") is the SAME underlying phenomenon as the first bullet
 *    above (reconcileWithPreassignedSlot's unconditional atom append),
 *    just a newer, differently-worded check added after this list was
 *    first written — never matched the old `/^Style prompt is/` pattern
 *    since it's prefixed with "Track N: ". Re-measured: even a minimal
 *    17-word fixture stylePrompt reconciles past every workspace's budget
 *    from mandatory atoms alone, so no fixture rewrite can satisfy this —
 *    it is exactly as "structurally inherent" as the sibling check above.
 *  - core/idolTitleLint.ts's single-bare-English-word title warning — its
 *    own doc comment already says "never blocks generation", and
 *    core/quality.ts's call site (지시문 15 TASK D-3) already gates it
 *    behind contentChecksPolicy.idolTitleLintApplies as advisory-only for
 *    kr-idol-male/kr-idol-female (the only 2 workspaces it ever fires for,
 *    both verified:false per data/distinctChoicePolicy.ts) — already
 *    exactly the "verified:false -> advisory" pattern 지시문 19 asked for,
 *    done by an earlier merged directive. Only this test's own allowlist
 *    was stale.
 */
const BENIGN_WARNING_PATTERNS = [
  /^Style prompt is \d+ (words|chars)/,
  /titleLocalized/,
  /^Track \d+: style prompt clause ".*" is \d+ words long\.$/,
  /assigned structureTemplate .* doesn't appear in the lyrics/,
  /^Track \d+: stylePrompt is \d+ words \(workspace target/,
  /is a single bare English word — high collision risk with an existing K-pop song title/
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

/**
 * 지시문 32 (§2) — normal.json/withPreamble.json의 실제 실측 위반표
 * (test:matrix 기준선, 지시문 32 작업 시점). 이 fixture는 senior-oldpop
 * 원본 88~100 BPM대에 맞춰 "gentle"/"tender"/"unhurried" 같은 무드 어휘로
 * 쓰였는데, 같은 텍스트를 더 빠른 워크스페이스에 재조합하면
 * core/tempoComplianceGate.ts가 그 어휘와 새로 배정된 실제 BPM의 모순을
 * 정확히 잡아낸다 — fixture 결함이 아니라 검사기가 제대로 작동한 증거다.
 * jp-2030은 다른 축(장르 모순), senior-oldpop 자신은 또 다른 축(문장 반복·
 * 음절 밀도)에서 진짜 결함을 낸다 — 셋 다 실측, 전부 fixture 원문 그대로.
 */
const EXPECTED_VIOLATIONS: Partial<Record<WorkspaceId, { trackNo: number; contains: string }>> = {
  'kr-2030': { trackNo: 3, contains: 'Tempo compliance' },
  'jp-2030': { trackNo: 2, contains: 'contradicts genre' },
  'kr-kids': { trackNo: 1, contains: 'Tempo compliance' },
  'jp-kids': { trackNo: 1, contains: 'Tempo compliance' },
  'kr-idol-male': { trackNo: 2, contains: 'Tempo compliance' },
  'kr-idol-female': { trackNo: 2, contains: 'Tempo compliance' }
};
/** senior-oldpop is the fixture's own native workspace — its real defect is unrelated to tempo (문장 반복 + 음절 밀도, track 5). */
const SENIOR_OLDPOP_EXPECTED = { trackNo: 5, containsAny: ['syllable-density', '문장 반복'] };

function assertNormalJsonViolationDetected(workspaceId: WorkspaceId, fixtureLabel: string, report: ReturnType<typeof runFixture>['report']) {
  expect(report.blueprint, `${workspaceId}/${fixtureLabel}: must still import — the violation is a warning, not a hard rejection`).not.toBeNull();
  if (workspaceId === 'senior-oldpop') {
    const song = report.blueprint!.songs.find(s => s.trackNo === SENIOR_OLDPOP_EXPECTED.trackNo)!;
    const warnings = nonBenignWarnings(song.warnings);
    expect(
      warnings.some(w => SENIOR_OLDPOP_EXPECTED.containsAny.some(needle => w.includes(needle))),
      `${workspaceId}/${fixtureLabel}: track ${SENIOR_OLDPOP_EXPECTED.trackNo} must carry a real lyrics-quality violation (sentence repetition/syllable density) — got: ${JSON.stringify(warnings)}`
    ).toBe(true);
    return;
  }
  const expected = EXPECTED_VIOLATIONS[workspaceId]!;
  const song = report.blueprint!.songs.find(s => s.trackNo === expected.trackNo)!;
  const warnings = nonBenignWarnings(song.warnings);
  expect(
    warnings.some(w => w.includes(expected.contains)),
    `${workspaceId}/${fixtureLabel}: track ${expected.trackNo} must carry a "${expected.contains}" violation — got: ${JSON.stringify(warnings)}`
  ).toBe(true);
}

describe('[provider-response fixtures] normal.json — real content contradictions must be DETECTED (재분류: 지시문 32 §2, blocking/)', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — expected violation is caught, not silently passed`, () => {
      const { report } = runFixture(workspaceId, 'blocking/normal.json');
      assertNormalJsonViolationDetected(workspaceId, 'normal', report);
    });
  }
});

describe('[provider-response fixtures] withPreamble.json — same real content contradictions, wrapped in prose (재분류: 지시문 32 §2, blocking/)', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's parseLeniently (fenced-code-block stripping) AND the content-contradiction checkers`, () => {
      const { report } = runFixture(workspaceId, 'blocking/withPreamble.json');
      assertNormalJsonViolationDetected(workspaceId, 'withPreamble', report);
    });
  }
});

/**
 * 지시문 32 (§2) — clean/ 5개: Haru의 실제 발매 팩(20260809 60년대/20260810
 * 70년대 올드팝 라운지)에서 그대로 뽑은 title/hookPhrase/lyrics(무편집) +
 * 장르 정확·템포 중립 stylePrompt(원본 팩의 stylePrompt는 이미 재조합을
 * 거친 완제품이라 그대로 재사용하면 이중 부착이 일어나 새로 작성). 전부
 * senior-oldpop(oldpop-lounge-main) 대상으로 실측 검증됨 — zero non-benign
 * warnings. kr-2030/kr-kids 팩에서도 동일 방식으로 시도했으나, 이 두
 * 워크스페이스는 채널과 무관하게 곡마다 회전 배정되는 보컬 딜리버리
 * 텍스트 풀(예: "conversational unhurried phrasing")이 opts.vocalTone
 * 선택과 무관하게 자체적으로 "unhurried"/"gentle" 문구를 주입해, BPM>100인
 * 포지션마다 정확히 이 지시문이 고치려는 것과 같은 유형의 모순을 만든다 —
 * 이건 fixture 선택으로 피할 수 있는 문제가 아니라 별도의 실제 결함(보컬
 * 딜리버리 텍스트 풀 자체)이다. 지시문 32의 명시 범위(§1/§3, "새 기능 추가
 * 금지")를 벗어나 이번엔 고치지 않았다 — §5 보고에 발견 사항으로 남긴다.
 */
describe('[provider-response fixtures clean/] senior-oldpop — real released-pack content imports with zero warnings', () => {
  const FIXTURES = ['senior-oldpop-1.json', 'senior-oldpop-2.json', 'senior-oldpop-3.json', 'senior-oldpop-4.json', 'senior-oldpop-5.json'];
  const CLEAN_VOCAL_TONE = 'bright young female voice, clean modern pop delivery, fresh and open tone';
  for (const fixtureName of FIXTURES) {
    it(`clean/${fixtureName} — zero pack-level and zero non-benign per-song warnings`, () => {
      const channel = channelFor('senior-oldpop');
      const opts = makeOptions({
        channel, songCount: 1, lyricLanguage: 'english',
        genreIds: channel.preferredGenres, moodIds: channel.preferredMoods,
        vocalTone: CLEAN_VOCAL_TONE
      });
      const genres = genresFor(opts);
      const moods = moodsFor(opts);
      const slots = preallocateSongSlots(opts, genres);
      const rawText = loadFixture(`clean/${fixtureName}`);
      const report = importSongsJson(rawText, opts, genres, moods, testSeason, slots);
      expect(report.blueprint, `clean/${fixtureName}: must import`).not.toBeNull();
      expect(report.warnings, `clean/${fixtureName}: zero pack-level warnings`).toEqual([]);
      for (const song of report.blueprint!.songs) {
        expect(nonBenignWarnings(song.warnings), `clean/${fixtureName}: track ${song.trackNo} zero non-benign warnings`).toEqual([]);
      }
    });
  }
});

describe('[provider-response fixtures] missingTracks.json — 4 of 5 requested tracks present', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's countMismatchWarning`, () => {
      const { opts, report } = runFixture(workspaceId, 'warning/missingTracks.json');
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
    it(`workspace: ${workspaceId} — UPGRADED (structural trackNo rejection): the whole response is now refused outright (blueprint: null), not gracefully degraded per-track`, () => {
      // TASK (structural trackNo rejection, third-party audit follow-up) —
      // this fixture used to import successfully (the older "FIXED"
      // duplicate-trackNo behavior: both claimants survived, the duplicate
      // degraded to raw/unenforced fields instead of silently sharing slot
      // 3's plan — see core/batchPreallocation.ts's claimSlotsByTrackNo doc
      // comment). A stricter audit found that still too soft: a duplicate
      // trackNo means the WHOLE response can't be trusted, so
      // importSongsJson now calls validateProviderTrackSet
      // (core/importValidation.ts) BEFORE claimSlotsByTrackNo ever runs and
      // refuses to build any blueprint at all. claimSlotsByTrackNo's own
      // per-track fallback still exists and still matters for the narrower
      // case it was always about (see importValidation.ts's own doc
      // comment) — this fixture's blatant duplicate just no longer reaches it.
      const { opts, report } = runFixture(workspaceId, 'blocking/duplicateTrackNo.json');
      expect(report.blueprint, `${workspaceId}/duplicateTrackNo: entire response rejected — no blueprint`).toBeNull();
      expect(report.importedCount, `${workspaceId}/duplicateTrackNo: nothing imported`).toBe(0);
      expect(report.skippedCount, `${workspaceId}/duplicateTrackNo: every raw entry counted as skipped`).toBe(5);
      expect(
        report.skippedReasons.some(reason => reason.includes('trackNo') && reason.includes('중복')),
        `${workspaceId}/duplicateTrackNo: skip reason names the structural trackNo problem`
      ).toBe(true);
      expect(opts.songCount).toBe(5);
    });
  }
});

describe('[provider-response fixtures] invalidTrackNo.json — a trackNo outside the valid 1..songCount range', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — UPGRADED (structural trackNo rejection): the whole response is now refused outright (blueprint: null), not gracefully degraded per-track`, () => {
      // TASK (structural trackNo rejection, third-party audit follow-up) —
      // this fixture used to import successfully, with the out-of-range
      // entry (originally claiming trackNo 42) falling back to
      // reconcileWithPreassignedSlot's no-slot branch (defensive genreId
      // re-sanitization only, no slot-forced tempo/vocal/genre/hook
      // contract — a "DISCOVERED GAP" the older version of this test
      // documented rather than asserted as a failure). A stricter audit
      // found that gap unacceptable: an out-of-range trackNo now hard-blocks
      // the ENTIRE response the same way a duplicate does — see this file's
      // duplicateTrackNo.json describe block above and
      // core/importValidation.ts's own doc comment.
      const { opts, report } = runFixture(workspaceId, 'blocking/invalidTrackNo.json');
      expect(report.blueprint, `${workspaceId}/invalidTrackNo: entire response rejected — no blueprint`).toBeNull();
      expect(report.importedCount, `${workspaceId}/invalidTrackNo: nothing imported`).toBe(0);
      expect(report.skippedCount, `${workspaceId}/invalidTrackNo: every raw entry counted as skipped`).toBe(5);
      expect(
        report.skippedReasons.some(reason => reason.includes('trackNo')),
        `${workspaceId}/invalidTrackNo: skip reason names the structural trackNo problem`
      ).toBe(true);
      expect(opts.songCount).toBe(5);
    });
  }
});

describe('[provider-response fixtures] missingStylePrompt.json — a track missing its stylePrompt field', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: importSongsJson's REQUIRED_SONG_FIELDS check`, () => {
      const { opts, report } = runFixture(workspaceId, 'blocking/missingStylePrompt.json');
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
      const { report } = runFixture(workspaceId, 'blocking/missingLyrics.json');
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
      const { report } = runFixture(workspaceId, 'warning/wrongLanguage.json', { lyricLanguage: 'korean' });
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
  // TASK (vocalPlan gap fix) — core/vocalPlan.ts's ensureVocalMetaTag used to
  // only check "is ANY vocal meta tag already present at the top of the
  // lyrics", never that the tag MATCHES the slot's real vocalType, so an
  // already-wrong tag from the response survived reconciliation completely
  // uncorrected (previously pinned here as a known, documented gap). Fixed:
  // ensureVocalMetaTag now verifies correctness, not just presence, and
  // REPLACES a mismatched tag with the correct one, matching what the
  // style-prompt side (enforceVocalTextInStylePrompt) was already doing.

  // --- male / female: single-gender forced vocalType, uniform across every
  // workspace (kids or not) — batchPreallocation.ts's own vocalGender
  // derivation (`isKidsArchetype(archetype) ? vocalType : (vocalType ===
  // 'mixed' ? 'duet' : vocalType)`) only diverges by archetype for the
  // 'mixed' vocalType, so male/female stay simple here.
  const SINGLE_GENDER_CASES: { forcedVocalType: 'male' | 'female'; expectedTag: string; wrongWord: RegExp }[] = [
    { forcedVocalType: 'male', expectedTag: '[male vocal]', wrongWord: /\bfemale\b/i },
    // The fixture's hardcoded tag IS already "[female vocal]" — forcing
    // vocalType 'female' makes this the no-op/already-correct path (the
    // existing tag matches and must be left byte-for-byte alone), a useful
    // complement to the male case's actual replacement.
    { forcedVocalType: 'female', expectedTag: '[female vocal]', wrongWord: /\bmale\b/i }
  ];
  for (const workspaceId of WORKSPACE_IDS) {
    for (const { forcedVocalType, expectedTag, wrongWord } of SINGLE_GENDER_CASES) {
      it(`workspace: ${workspaceId}, forced vocalType: ${forcedVocalType} — both stylePrompt gender AND the lyric bracket tag are corrected`, () => {
        const vocalQuota =
          forcedVocalType === 'male'
            ? { male: FIXTURE_SONG_COUNT, female: 0, mixed: 0 }
            : { male: 0, female: FIXTURE_SONG_COUNT, mixed: 0 };
        const { report } = runFixture(workspaceId, 'warning/wrongVocalMetaTag.json', { vocalQuota });
        expect(report.blueprint, `${workspaceId}/wrongVocalMetaTag: must still import`).not.toBeNull();
        for (const song of report.blueprint!.songs) {
          expect(song.vocalType, `${workspaceId}/wrongVocalMetaTag: track ${song.trackNo} slot-forced vocalType is ${forcedVocalType}`).toBe(forcedVocalType);
          // Real, working detection/correction: enforceVocalTextInStylePrompt +
          // appendVerbatimIfMissing (batchPreallocation.ts) repair the
          // style-prompt-level gender description to match the real slot.
          expect(
            wrongWord.test(song.stylePrompt),
            `${workspaceId}/wrongVocalMetaTag: track ${song.trackNo} stylePrompt must not still claim the wrong gender after reconciliation`
          ).toBe(false);
          // FIXED: ensureVocalMetaTag (core/vocalPlan.ts) now replaces a
          // mismatched lyric bracket tag with the correct one (or leaves an
          // already-correct one untouched), the same way the style-prompt
          // side already gets corrected.
          expect(
            song.lyrics.trim().startsWith(expectedTag),
            `${workspaceId}/wrongVocalMetaTag: track ${song.trackNo} lyric meta-tag must be ${expectedTag} — got: ${JSON.stringify(song.lyrics.trim().slice(0, 40))}`
          ).toBe(true);
        }
      });
    }
  }

  // --- mixed: the duet-tagging nuance. A forced vocalType 'mixed' resolves
  // to a DIFFERENT vocalGender depending on archetype (batchPreallocation.ts
  // line ~660): kids archetypes keep gender === vocalType === 'mixed'
  // (tags "[mixed vocal]", no per-section retagging — applyDuetSectionVocalTags
  // is a no-op for anything but gender === 'duet'), while every non-kids
  // archetype maps vocalType 'mixed' to gender 'duet' (tags "[duet vocal]",
  // AND triggers applyDuetSectionVocalTags's per-section verse/chorus
  // retagging). This proves ensureVocalMetaTag's correctness-fix and the
  // pre-existing per-section duet mechanism coexist without either fighting
  // or overwriting the other, for both branches.
  for (const workspaceId of WORKSPACE_IDS) {
    const kids = isKidsArchetype(channelFor(workspaceId).archetype);
    const expectedTopTag = kids ? '[mixed vocal]' : '[duet vocal]';
    it(`workspace: ${workspaceId} (${kids ? 'kids' : 'non-kids'}), forced vocalType: mixed — top-level tag corrected to ${expectedTopTag}${kids ? '' : ', per-section duet retagging also applied'}`, () => {
      const { report } = runFixture(workspaceId, 'warning/wrongVocalMetaTag.json', { vocalQuota: { male: 0, female: 0, mixed: FIXTURE_SONG_COUNT } });
      expect(report.blueprint, `${workspaceId}/wrongVocalMetaTag(mixed): must still import`).not.toBeNull();
      for (const song of report.blueprint!.songs) {
        expect(song.vocalType, `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} slot-forced vocalType is mixed`).toBe('mixed');
        const trimmed = song.lyrics.trim();
        expect(
          trimmed.startsWith(expectedTopTag),
          `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} top-level tag must be ${expectedTopTag} — got: ${JSON.stringify(trimmed.slice(0, 40))}`
        ).toBe(true);
        // The fixture's original wrong "[female vocal]" tag must never
        // survive as the top-level tag.
        expect(trimmed.startsWith('[female vocal]'), `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} must not still carry the fixture's original wrong top-level tag`).toBe(false);
        if (kids) {
          // No per-section retagging for a non-duet gender — the plain
          // structure section tags from the fixture survive unchanged.
          expect(song.lyrics, `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} kids-mixed must NOT get duet per-section retagging`).not.toMatch(/\[verse 1: male vocal\]/i);
        } else {
          // Real before/after for the duet nuance: applyDuetSectionVocalTags
          // (unrelated pre-existing mechanism, called before ensureVocalMetaTag
          // at this same call site) still fires and rewrites the per-section
          // tags — proving the top-level fix above didn't disturb it.
          expect(song.lyrics, `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} duet per-section verse 1 retag must still fire`).toMatch(/\[verse 1: male vocal\]/i);
          expect(song.lyrics, `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} duet per-section verse 2 retag must still fire`).toMatch(/\[verse 2: female vocal\]/i);
          expect(song.lyrics, `${workspaceId}/wrongVocalMetaTag(mixed): track ${song.trackNo} duet per-section chorus retag must still fire`).toMatch(/\[chorus: male and female duet\]/i);
        }
      }
    });
  }
});

describe('[provider-response fixtures] artistNameLeak.json — a real/recognizable artist name embedded in a field', () => {
  for (const workspaceId of WORKSPACE_IDS) {
    it(`workspace: ${workspaceId} — detected by: quality.ts's famousArtistNames scan + artistReferenceDecomposer.ts's findArtistReferenceLeaks`, () => {
      const { report } = runFixture(workspaceId, 'warning/artistNameLeak.json');
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
      const { report } = runFixture(workspaceId, 'warning/overLength.json');
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
      const { report } = runFixture(workspaceId, 'blocking/truncatedJson.json');
      expect(report.blueprint, `${workspaceId}/truncatedJson: unparseable input must not produce a blueprint`).toBeNull();
      expect(report.importedCount, `${workspaceId}/truncatedJson: nothing imported`).toBe(0);
      expect(
        report.skippedReasons.some(reason => reason.includes('JSON을 해석하지 못했습니다')),
        `${workspaceId}/truncatedJson: the real parse-failure message must be reported`
      ).toBe(true);
    });
  }
});
