import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { assertLyricDiversity } from '../src/core/lyricEngine';
import { buildStylePrompt } from '../src/core/promptComposer';
import { moneyChordPresets } from '../src/data/moneyChords';
import { clampSongCount } from '../src/utils/generation';
import { generateBlueprint } from '../src/providers';
import { callGenerateProxy } from '../src/providers/proxyFetch';
import { __internal as apiInternal } from '../api/generate.js';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks, testGenres, testMoods, testSeason } from './fixtures';
import type { ProviderSettings, SongIdea } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

interface ReportRow {
  id: string;
  description: string;
  result: 'PASS' | 'FAIL' | 'MANUAL';
  durationMs: number;
  notes: string;
}

const rows: ReportRow[] = [];

function stressCase(id: string, description: string, fn: () => void | Promise<void>) {
  it(`${id}: ${description}`, async () => {
    const start = performance.now();
    try {
      await fn();
      rows.push({ id, description, result: 'PASS', durationMs: Math.round(performance.now() - start), notes: '' });
    } catch (error) {
      rows.push({
        id,
        description,
        result: 'FAIL',
        durationMs: Math.round(performance.now() - start),
        notes: String(error).slice(0, 300)
      });
      throw error;
    }
  });
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function stubSong(trackNo: number): SongIdea {
  return {
    trackNo,
    title: `Stub Song ${trackNo}`,
    seasonMoment: 'Christmas Cafe',
    listenerSituation: 'morning coffee',
    emotionArc: 'lonely to warm',
    hookPhrase: `Stub Song ${trackNo}, hold on`,
    stylePrompt: 'warm pop, money chord foundation: I-V-vi-IV, no long instrumental break, avoid famous artist imitation',
    lyrics: '[verse 1]\nline\n[chorus]\nline\n[end]',
    thumbnailText: 'Christmas Cafe',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'], thumbnailText: 'th' },
    qualityScore: 0,
    warnings: []
  };
}

// ---------------------------------------------------------------------------
// Local provider (no API cost)
// ---------------------------------------------------------------------------

describe('stress: local provider', () => {
  stressCase('S1', '최소 부하 (1곡)', () => {
    const start = performance.now();
    const bp = generateLocalBlueprint(makeOptions({ songCount: 1 }), testGenres, testMoods, testSeason);
    const elapsed = performance.now() - start;
    expect(bp.songs).toHaveLength(1);
    expect(elapsed).toBeLessThan(50);
  });

  stressCase('S2', '표준 부하 (12곡 x 3언어 x 5장르조합)', () => {
    const languages = ['english', 'korean', 'japanese'] as const;
    const genreCombos = [
      genrePacks.slice(0, 1),
      genrePacks.slice(0, 2),
      genrePacks.slice(2, 4),
      genrePacks.slice(4, 6),
      genrePacks.slice(6, 8)
    ];
    for (const language of languages) {
      for (const combo of genreCombos) {
        const start = performance.now();
        const bp = generateLocalBlueprint(makeOptions({ songCount: 12, lyricLanguage: language }), combo, testMoods, testSeason);
        const elapsed = performance.now() - start;
        expect(bp.songs).toHaveLength(12);
        expect(elapsed).toBeLessThan(500);
      }
    }
  });

  stressCase('S3', '최대 부하 (30곡)', () => {
    const start = performance.now();
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30 }), testGenres, testMoods, testSeason);
    const elapsed = performance.now() - start;
    expect(bp.songs).toHaveLength(30);
    expect(elapsed).toBeLessThan(2000);
    expect(assertLyricDiversity(bp.songs, 0.4)).toEqual([]);
  });

  stressCase('S4', '연속 생성 (30곡 x 50회 반복)', () => {
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 50; i++) {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 30, projectTitle: `Repeat ${i}` }), testGenres, testMoods, testSeason);
      expect(bp.songs).toHaveLength(30);
    }
    const after = process.memoryUsage().heapUsed;
    const deltaMB = (after - before) / (1024 * 1024);
    // Node's GC timing under vitest is not deterministic, so this is a generous
    // soft ceiling rather than a strict leak assertion.
    expect(deltaMB).toBeLessThan(300);
  });

  stressCase('S5', '경계값 (songCount 0, -5, 31, 999, NaN, Infinity, "abc")', () => {
    const cases = [0, -5, 31, 999, NaN, Infinity, Number('abc')];
    for (const value of cases) {
      const clamped = clampSongCount(value);
      expect(clamped).toBeGreaterThanOrEqual(1);
      expect(clamped).toBeLessThanOrEqual(30);
      expect(Number.isFinite(clamped)).toBe(true);
      expect(() => generateLocalBlueprint(makeOptions({ songCount: clamped }), testGenres, testMoods, testSeason)).not.toThrow();
    }
  });

  stressCase('S6', '극단 입력 (채널명 10000자 / 이모지 / 빈 문자열 / <script>)', () => {
    const extremeNames = ['a'.repeat(10000), '😀🎵🌙✨💫', '', '<script>alert(1)</script>'];
    for (const name of extremeNames) {
      const channel = { ...channelPresets[0], name, englishName: name || 'Untitled' };
      expect(() => generateLocalBlueprint(makeOptions({ channel, songCount: 1 }), testGenres, testMoods, testSeason)).not.toThrow();
    }
    // React auto-escapes text content; XSS would require dangerouslySetInnerHTML, which the app never uses.
    const srcFiles = collectSourceFiles(join(repoRoot, 'src'));
    for (const file of srcFiles) {
      expect(fs.readFileSync(file, 'utf8')).not.toContain('dangerouslySetInnerHTML');
    }
  });

  stressCase('S7', '프리셋 전수 (장르 x 무드 x 시즌 x 머니코드, 각 단독 검증)', () => {
    for (const genre of genrePacks) {
      const prompt = buildStylePrompt(makeOptions({ genreIds: [genre.id] }), [genre], testMoods, testSeason);
      expect(prompt).not.toMatch(/undefined|NaN/);
    }
    for (const mood of moodPacks) {
      const prompt = buildStylePrompt(makeOptions({ moodIds: [mood.id] }), testGenres, [mood], testSeason);
      expect(prompt).not.toMatch(/undefined|NaN/);
    }
    for (const season of seasonPacks) {
      const prompt = buildStylePrompt(makeOptions({ seasonId: season.id }), testGenres, testMoods, season);
      expect(prompt).not.toMatch(/undefined|NaN/);
    }
    for (const preset of Object.keys(moneyChordPresets)) {
      const opts = makeOptions({
        moneyChordMode: preset as ReturnType<typeof makeOptions>['moneyChordMode'],
        customMoneyChord: preset === 'custom' ? 'I-V-vi-IV' : ''
      });
      const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
      expect(prompt).not.toMatch(/undefined|NaN/);
    }
  });

  it('S8: 저장소 부하 (30곡 팩 100개 IndexedDB 저장/로드) — 수동 검증', () => {
    // Node has no IndexedDB implementation, and adding fake-indexeddb purely for one
    // stress scenario conflicts with the "minimize dependencies" instruction. The
    // autosave path (src/core/library.ts) was exercised end-to-end with Playwright
    // against the real dev server during TASK2/TASK4 (see docs/MIGRATION.md), which
    // confirmed a generated pack round-trips through IndexedDB correctly. A 100-pack
    // bulk load was not separately measured.
    rows.push({
      id: 'S8',
      description: '저장소 부하 (30곡 팩 100개 IndexedDB 저장/로드)',
      result: 'MANUAL',
      durationMs: 0,
      notes: 'Node에 IndexedDB 없음. Playwright로 단일 팩 자동저장/불러오기는 확인함. 100개 벌크 부하는 별도 측정 안 됨.'
    });
  });
});

// ---------------------------------------------------------------------------
// API provider (mocked — no real network calls)
// ---------------------------------------------------------------------------

describe('stress: API provider (mocked)', () => {
  stressCase('S9', '응답 잘림 (서버 안전 파서 + 클라이언트 에러 노출)', async () => {
    expect(() => apiInternal.safeParseBlueprint('not json at all')).toThrow(/LLM 응답이 잘렸습니다/);

    const recoverable = '{"songs":[{"trackNo":1}]} trailing garbage that should be ignored';
    expect(apiInternal.safeParseBlueprint(recoverable)).toEqual({ songs: [{ trackNo: 1 }] });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'LLM 응답이 잘렸습니다. 곡 수를 줄이거나 배치 크기를 낮추세요.' }), { status: 500 }))
    );
    await expect(callGenerateProxy('/api/generate', {}, {})).rejects.toThrow(/LLM 응답이 잘렸습니다/);
    vi.unstubAllGlobals();
  });

  stressCase('S10', '인증 실패 (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'API 키가 올바르지 않습니다.' }), { status: 401 })));
    await expect(callGenerateProxy('/api/generate', {}, {})).rejects.toThrow('API 키가 올바르지 않습니다.');
    vi.unstubAllGlobals();
  });

  stressCase('S11', '레이트리밋 (429) 지수 백오프 재시도 후 성공', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls < 3) return new Response(JSON.stringify({ error: '요청 한도를 초과했습니다.' }), { status: 429 });
        return new Response(JSON.stringify({ blueprint: { songs: [] } }), { status: 200 });
      })
    );
    const result = await callGenerateProxy('/api/generate', {}, {}, { baseDelayMs: 1 });
    expect(calls).toBe(3);
    expect(result).toHaveProperty('blueprint');
    vi.unstubAllGlobals();
  });

  stressCase('S11b', '레이트리밋 지속 시 최대 3회 재시도 후 안내', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '요청 한도를 초과했습니다.' }), { status: 429 })));
    await expect(callGenerateProxy('/api/generate', {}, {}, { baseDelayMs: 1 })).rejects.toThrow(/한도/);
    vi.unstubAllGlobals();
  });

  stressCase('S12', '타임아웃 설정 확인 (서버 30초 AbortController)', () => {
    const source = fs.readFileSync(join(repoRoot, 'api', 'generate.js'), 'utf8');
    expect(source).toMatch(/REQUEST_TIMEOUT_MS\s*=\s*30_000/);
    expect(source).toMatch(/AbortController/);
  });

  stressCase('S13', '배치 부분 실패 (v3.21: 소단위 병렬 청크 — 성공한 청크는 진행률 콜백에 보존, 실패한 청크만 에러)', async () => {
    // TASK v3.21 — real-time Anthropic generation now runs small (<=3-song)
    // chunks with bounded concurrency instead of one sequential loop over
    // up to 12-song chunks, so success/failure must be decided by *which*
    // trackNo range a request covers (not by a shared call counter, which
    // would race under concurrency and make this test flaky).
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate', batchSize: 3 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        const offset = body.user.trackNoOffset as number;
        const count = body.user.songCount as number;
        if (offset < 12) {
          const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
          const blueprint = {
            projectTitle: 'P',
            channelName: 'C',
            oneLineConcept: 'x',
            sonicSignature: 'x',
            vocalSignature: 'x',
            lyricRules: [],
            harmonyRules: [],
            visualRules: [],
            songs
          };
          return new Response(JSON.stringify({ blueprint }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: '서버 오류입니다. 곡 수를 줄여보세요.' }), { status: 500 });
      })
    );

    const progressSnapshots: number[] = [];
    await expect(
      generateBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason, settings, progress =>
        progressSnapshots.push(progress.songs.length)
      )
    ).rejects.toThrow();

    // tracks 1-12 (4 chunks of 3) succeed; tracks 13-18 (2 chunks) 500 —
    // concurrency means exact interleaving isn't guaranteed, but every
    // successful chunk must still be reflected before the aggregated error.
    expect(Math.max(...progressSnapshots)).toBe(12);
    vi.unstubAllGlobals();
  });

  stressCase('S14', '키 누출 검사 (콘솔 로그 / 에러 메시지)', async () => {
    const filesToCheck = [
      join(repoRoot, 'api', 'generate.js'),
      join(repoRoot, 'src', 'providers', 'anthropic.ts'),
      join(repoRoot, 'src', 'providers', 'openai.ts'),
      join(repoRoot, 'src', 'providers', 'proxyFetch.ts'),
      join(repoRoot, 'src', 'agents', 'evaluator.ts')
    ];
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/console\.(log|warn|error)\([^)]*\b(apiKey|userApiKey|headers|body)\b/i);
    }

    const fakeKey = 'sk-ant-super-secret-test-key-should-not-leak';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'API 키가 올바르지 않습니다.' }), { status: 401 })));
    try {
      await callGenerateProxy('/api/generate', { 'X-User-Api-Key': fakeKey }, {});
    } catch (error) {
      expect(String(error)).not.toContain(fakeKey);
    }
    vi.unstubAllGlobals();
  });
});

afterAll(() => {
  const header = '| 시나리오 | 결과 | 소요시간(ms) | 비고 |\n|---|---|---|---|\n';
  const body = rows
    .map(row => `| ${row.id}: ${row.description} | ${row.result} | ${row.durationMs} | ${row.notes.replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 200) || '-'} |`)
    .join('\n');
  const content = `# 스트레스 테스트 결과 (STRESS_TEST_REPORT)\n\n` +
    `자동 생성됨 — \`npm run test:stress\` 실행 시 \`tests/stress.test.ts\`가 매번 이 파일을 다시 씁니다.\n\n` +
    `생성 시각: ${new Date().toISOString()}\n\n` +
    `${header}${body}\n`;
  fs.writeFileSync(join(repoRoot, 'docs', 'STRESS_TEST_REPORT.md'), content, 'utf8');
});
