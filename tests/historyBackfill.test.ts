import { describe, expect, it } from 'vitest';
import { computeWorkspaceHistoryDiagnostic, formatWorkspaceHistoryDiagnostic, planBackfillSource } from '../src/core/historyBackfill';
import { channelPresets } from './fixtures';
import type { SituationUsage } from '../src/core/situationLedger';

/**
 * 지시문 14 (TASK D) — planBackfillSource/computeWorkspaceHistoryDiagnostic
 * are the pure halves of historyBackfill.ts (structural parsing/validation,
 * and the diagnostic math), split out from the IndexedDB-writing
 * backfillHistoryFromPacks/diagnoseWorkspaceHistory the same way every other
 * ledger in this codebase already is (see tests/lyricLineLedger.test.ts's
 * own doc comment: "the rest is IndexedDB CRUD, untestable in this
 * project's Node vitest environment"). Only the pure halves are exercised
 * here for the same reason.
 */

const goodMorningChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;

function rawSong(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    trackNo: 1,
    title: 'Wait by the Window',
    hookPhrase: 'Wait by the window for me',
    stylePrompt: 'warm soft-rock, mid tempo',
    lyrics: '[verse]\nSitting with morning coffee before the day begins',
    listenerSituation: 'Sitting with morning coffee before the day begins, watching first light move across the table.',
    lyricTheme: 'senior-morning-coffee-first-light',
    lyricThemeText: 'morning coffee, first light',
    ...overrides
  };
}

function packJson(songCount: number, overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    meta: {
      setName: '20260807_굿모닝추억라디오_60년대올드팝명곡',
      generatedAt: '2026-08-06T22:26:56.483Z',
      channelId: goodMorningChannel.id,
      channelLabel: '굿모닝 추억라디오',
      conceptLabel: '60년대 올드팝 명곡',
      songCount,
      lyricLanguage: 'english',
      ...overrides
    },
    songs: Array.from({ length: songCount }, (_, i) => rawSong({ trackNo: i + 1, title: `Song ${i + 1}`, hookPhrase: `Hook ${i + 1}` }))
  };
}

describe('[지시문 14 TASK D] planBackfillSource — structural parsing', () => {
  it('resolves workspaceId via meta.channelId -> archetype -> workspace when no explicit workspaceId is given', () => {
    const result = planBackfillSource({ fileName: 'a.json', json: packJson(2) });
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.workspaceId).toBe('senior-oldpop'); // good-morning-memory-radio's own archetype (senior-morning) resolves here
    expect(result.channelId).toBe(goodMorningChannel.id);
    expect(result.language).toBe('english');
    expect(result.songs).toHaveLength(2);
  });

  it('derives packId from meta.setName@generatedAt when meta.packId is absent', () => {
    const result = planBackfillSource({ fileName: 'a.json', json: packJson(1) });
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.packId).toBe('20260807_굿모닝추억라디오_60년대올드팝명곡@2026-08-06T22:26:56.483Z');
  });

  it('falls back to the file name (minus extension) when meta has neither packId nor setName+generatedAt', () => {
    const json = { songs: [rawSong()] };
    const result = planBackfillSource({ fileName: 'legacy-pack.json', json, channelId: goodMorningChannel.id, language: 'english' });
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.packId).toBe('legacy-pack');
  });

  it('an explicit source.workspaceId overrides automatic channelId resolution', () => {
    const result = planBackfillSource({ fileName: 'a.json', json: packJson(1), workspaceId: 'kr-2030' });
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.workspaceId).toBe('kr-2030');
  });

  it('rejects a file with no "songs" array', () => {
    const result = planBackfillSource({ fileName: 'broken.json', json: { meta: {} } });
    expect(result.status).toBe('invalid');
  });

  it('rejects a file with no resolvable channelId', () => {
    const json = { meta: { lyricLanguage: 'english' }, songs: [rawSong()] };
    const result = planBackfillSource({ fileName: 'no-channel.json', json });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reasonKo).toContain('channelId');
  });

  it('rejects a file with no resolvable lyricLanguage', () => {
    const json = { meta: { channelId: goodMorningChannel.id }, songs: [rawSong()] };
    const result = planBackfillSource({ fileName: 'no-lang.json', json });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reasonKo).toContain('lyricLanguage');
  });

  it('rejects the whole file on a duplicate trackNo (never a partial import)', () => {
    const json = packJson(2);
    (json as { songs: Record<string, unknown>[] }).songs[1].trackNo = 1;
    const result = planBackfillSource({ fileName: 'dup.json', json });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reasonKo).toContain('trackNo');
  });

  it('rejects the whole file when any song is missing a required field', () => {
    const json = packJson(2);
    delete (json as { songs: Record<string, unknown>[] }).songs[1].stylePrompt;
    const result = planBackfillSource({ fileName: 'missing-field.json', json });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reasonKo).toContain('stylePrompt');
  });

  it('accepts a bare songs array with no meta wrapper, given explicit channelId/language', () => {
    const result = planBackfillSource({ fileName: 'bare.json', json: [rawSong()], channelId: goodMorningChannel.id, language: 'english' });
    expect(result.status).toBe('parsed');
  });
});

describe('[지시문 14 TASK D-5] computeWorkspaceHistoryDiagnostic — pure diagnostic math', () => {
  function makeRecord(overrides: Partial<SituationUsage>): SituationUsage {
    return {
      id: `senior-oldpop::${overrides.packId ?? 'pack'}:${overrides.trackNo ?? 1}`,
      situation: 'a scene',
      channelId: goodMorningChannel.id,
      language: 'english',
      usedAt: new Date().toISOString(),
      packId: 'pack',
      trackNo: 1,
      workspaceId: 'senior-oldpop',
      ...overrides
    };
  }

  it('counts distinct sets and scenes correctly', () => {
    const records = [
      makeRecord({ packId: 'p1', trackNo: 1, situation: 'scene A', usedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecord({ packId: 'p1', trackNo: 2, situation: 'scene B', usedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecord({ packId: 'p2', trackNo: 1, situation: 'scene A', usedAt: '2026-01-02T00:00:00.000Z' }) // same situation text as p1/track1 — not unique
    ];
    const diag = computeWorkspaceHistoryDiagnostic('senior-oldpop', records, () => 'senior-morning', 'english');
    expect(diag.setCount).toBe(2);
    expect(diag.sceneCount).toBe(3);
    expect(diag.uniqueSceneCount).toBe(2);
  });

  it('warns when the remaining theme pool after the avoid window is below songCountPerSet', () => {
    // senior-morning has a real, large theme pool (128 per §1-3 of the
    // directive) — using every one of them up as "used" in the most recent
    // set is the only way to genuinely drive remainingAfterAvoidWindow low
    // enough to trigger the warning without hand-maintaining a real count.
    const records: SituationUsage[] = Array.from({ length: 200 }, (_, i) => makeRecord({
      packId: 'p1',
      trackNo: i + 1,
      lyricTheme: `theme-${i}`,
      usedAt: '2026-01-01T00:00:00.000Z'
    }));
    const diag = computeWorkspaceHistoryDiagnostic('senior-oldpop', records, () => 'senior-morning', 'english', 18, 5);
    const coverage = diag.archetypeCoverage.find(c => c.archetype === 'senior-morning')!;
    expect(coverage.remainingAfterAvoidWindow).toBeLessThan(18);
    expect(coverage.warningKo).toContain('테마 풀 확장 필요');
  });

  it('does not warn when the used history is small relative to the candidate pool', () => {
    const records = [makeRecord({ packId: 'p1', trackNo: 1, lyricTheme: 'theme-0' })];
    const diag = computeWorkspaceHistoryDiagnostic('senior-oldpop', records, () => 'senior-morning', 'english', 18, 5);
    const coverage = diag.archetypeCoverage.find(c => c.archetype === 'senior-morning')!;
    expect(coverage.warningKo).toBeUndefined();
  });

  it('skips archetype coverage entirely when the channel resolver cannot place any record', () => {
    const records = [makeRecord({ packId: 'p1', trackNo: 1 })];
    const diag = computeWorkspaceHistoryDiagnostic('senior-oldpop', records, () => undefined, 'english');
    expect(diag.archetypeCoverage).toEqual([]);
    // set/scene counts are still real — this is a resolution gap, not a data gap.
    expect(diag.setCount).toBe(1);
  });

  it('formatWorkspaceHistoryDiagnostic renders the directive\'s own example shape', () => {
    const records = [makeRecord({ packId: 'p1', trackNo: 1, lyricTheme: 'theme-0' })];
    const diag = computeWorkspaceHistoryDiagnostic('senior-oldpop', records, () => 'senior-morning', 'english');
    const text = formatWorkspaceHistoryDiagnostic(diag);
    expect(text).toContain('senior-oldpop 이력');
    expect(text).toContain('세트 1개');
    expect(text).toContain('[senior-morning]');
  });
});
