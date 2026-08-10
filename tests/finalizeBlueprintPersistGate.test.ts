import { describe, expect, it } from 'vitest';
import {
  canExportReleasePack,
  canPersistFinalizedPack,
  buildPersistGateInputFromBlueprint,
  finalizeBlueprintForUse,
  type ExportGateInput,
  type PersistGateInput
} from '../src/core/finalizeBlueprint';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildGenerationSnapshot, slotsForOptions } from '../src/core/generationSnapshot';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { workspaceForArchetype } from '../src/data/workspaces/index';
import { savePack, loadPack } from '../src/core/library';
import { makeOptions, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';
import type { PlaylistBlueprint, SongIdea } from '../src/types';

/**
 * 지시문 31 (§3) — "finalizeBlueprintForUse는 검사 결과를 보고만 하고
 * 호출자가 저장 여부를 결정한다"는 결함의 회귀 테스트. canPersistFinalizedPack/
 * canExportReleasePack이 그 판단 자체를 한곳으로 모았는지, 그리고 실제
 * 저장 관문(core/library.ts's savePack)이 그 함수를 실제로 통과하지 않으면
 * 실행되지 않는지 둘 다 확인한다.
 */

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'Title', hookPhrase: 'Hook', stylePrompt: 'style, 90 BPM', excludePrompt: '', lyrics: 'la la la', warnings: [],
    qualityScore: 80,
    ...overrides
  } as SongIdea;
}

function inputFor(_songs: SongIdea[]): PersistGateInput {
  return {
    schemaIssues: [],
    trackNoValidation: { invalid: [], duplicates: [], missing: [], valid: true },
    trackNoValidationSummaryKo: 'ok',
    slotReconciliation: { ok: true, drift: [] },
    workspacePolicyIssues: []
  };
}

describe('지시문 31 §3-2 — canPersistFinalizedPack', () => {
  it('passes for a clean input', () => {
    expect(canPersistFinalizedPack(inputFor([baseSong()])).ok).toBe(true);
  });

  it('blocks on schemaIssues', () => {
    const result = canPersistFinalizedPack({ ...inputFor([]), schemaIssues: ['T1: title이 비어 있습니다.'] });
    expect(result.ok).toBe(false);
    expect(result.blockersKo).toContain('T1: title이 비어 있습니다.');
  });

  it('blocks on invalid trackNoValidation', () => {
    const result = canPersistFinalizedPack({
      ...inputFor([]),
      trackNoValidation: { invalid: [], duplicates: [2], missing: [], valid: false },
      trackNoValidationSummaryKo: 'duplicate trackNo 2'
    });
    expect(result.ok).toBe(false);
    expect(result.blockersKo).toContain('duplicate trackNo 2');
  });

  it('blocks on slot drift', () => {
    const result = canPersistFinalizedPack({ ...inputFor([]), slotReconciliation: { ok: false, drift: ['T3: 계획된 슬롯에 없음'] } });
    expect(result.ok).toBe(false);
    expect(result.blockersKo).toContain('T3: 계획된 슬롯에 없음');
  });

  it('blocks on workspacePolicyIssues', () => {
    const result = canPersistFinalizedPack({ ...inputFor([]), workspacePolicyIssues: ['T1: kr-kids 워크스페이스의 언어 정책(korean)과 실제 가사가 어긋납니다.'] });
    expect(result.ok).toBe(false);
  });

  it('accumulates every blocker, not just the first', () => {
    const result = canPersistFinalizedPack({
      schemaIssues: ['A'],
      trackNoValidation: { invalid: [], duplicates: [], missing: [1], valid: false },
      trackNoValidationSummaryKo: 'B',
      slotReconciliation: { ok: false, drift: ['C'] },
      workspacePolicyIssues: ['D']
    });
    expect(result.blockersKo).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('지시문 31 §3-2 — canExportReleasePack', () => {
  const cleanExport: ExportGateInput = {
    ...inputFor([baseSong()]),
    artifactMeta: { stage: 'scored', scorerVersion: '1', auditSchemaVersion: '1', workspacePolicyVersion: '1' },
    blueprint: { songs: [baseSong({ qualityScore: 80 })] } as PlaylistBlueprint
  };

  it('passes when canPersist passes, stage is not raw-provider, and qualityScore is real', () => {
    expect(canExportReleasePack(cleanExport).ok).toBe(true);
  });

  it('inherits every canPersist blocker', () => {
    const result = canExportReleasePack({ ...cleanExport, schemaIssues: ['T1: lyrics가 비어 있습니다.'] });
    expect(result.ok).toBe(false);
    expect(result.blockersKo).toContain('T1: lyrics가 비어 있습니다.');
  });

  it('blocks when artifactStage is raw-provider (§3-2 명시)', () => {
    const result = canExportReleasePack({ ...cleanExport, artifactMeta: { ...cleanExport.artifactMeta, stage: 'raw-provider' } });
    expect(result.ok).toBe(false);
    expect(result.blockersKo.some(b => b.includes('raw-provider'))).toBe(true);
  });

  it('blocks when qualityScore is 0 across every song (§3-2 명시 — 채점 미실행 신호)', () => {
    const result = canExportReleasePack({
      ...cleanExport,
      blueprint: { songs: [baseSong({ qualityScore: 0 }), baseSong({ trackNo: 2, qualityScore: 0 })] } as PlaylistBlueprint
    });
    expect(result.ok).toBe(false);
    expect(result.blockersKo.some(b => b.includes('qualityScore'))).toBe(true);
  });

  it('does not block when only SOME songs are 0 (a legitimately low-but-real score, not "never scored")', () => {
    const result = canExportReleasePack({
      ...cleanExport,
      blueprint: { songs: [baseSong({ qualityScore: 0 }), baseSong({ trackNo: 2, qualityScore: 55 })] } as PlaylistBlueprint
    });
    expect(result.blockersKo.some(b => b.includes('qualityScore'))).toBe(false);
  });
});

describe('지시문 31 §3-3 — buildPersistGateInputFromBlueprint', () => {
  it('reports schemaIssues/trackNoValidation for a real broken blueprint, and leaves workspacePolicyIssues empty (실측 회귀 — 이유는 이 함수 자기 doc comment)', () => {
    const blueprint: PlaylistBlueprint = { projectTitle: 'T', oneLineConcept: '', songs: [baseSong({ title: '' }), baseSong({ trackNo: 1 })] } as PlaylistBlueprint;
    const input = buildPersistGateInputFromBlueprint(blueprint, 'senior-oldpop');
    expect(input.schemaIssues.length).toBeGreaterThan(0);
    expect(input.trackNoValidation.valid).toBe(false); // duplicate trackNo 1
    expect(input.workspacePolicyIssues).toEqual([]);
    expect(input.slotReconciliation).toEqual({ ok: true, drift: [] });
  });

  it('reports a clean gate input for a well-formed blueprint', () => {
    const blueprint: PlaylistBlueprint = { projectTitle: 'T', oneLineConcept: '', songs: [baseSong()] } as PlaylistBlueprint;
    const input = buildPersistGateInputFromBlueprint(blueprint, 'senior-oldpop');
    expect(canPersistFinalizedPack(input).ok).toBe(true);
  });
});

describe('지시문 31 §3-3 — core/library.ts의 savePack이 실제로 canPersistFinalizedPack을 통과하지 않으면 저장하지 않는다 (자동저장·현재 팩·가져온 팩·멀티세트 저장 공통 관문)', () => {
  it('a well-formed blueprint saves normally', async () => {
    const blueprint: PlaylistBlueprint = {
      projectTitle: 'Test',
      oneLineConcept: '',
      songs: [baseSong()]
    } as PlaylistBlueprint;
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const opts = makeOptions({ channel, songCount: 1 });
    const id = await savePack({ blueprint, options: opts });
    const saved = await loadPack(id);
    expect(saved?.blueprint.songs).toHaveLength(1);
  });

  it('a blueprint with schema-broken songs (empty title) is rejected before it ever reaches IndexedDB', async () => {
    const blueprint: PlaylistBlueprint = {
      projectTitle: 'Test',
      oneLineConcept: '',
      songs: [baseSong({ title: '' })]
    } as PlaylistBlueprint;
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const opts = makeOptions({ channel, songCount: 1 });
    await expect(savePack({ blueprint, options: opts })).rejects.toThrow(/관문을 통과하지 못했습니다/);
  });

  it('a blueprint with a duplicate trackNo is rejected', async () => {
    const blueprint: PlaylistBlueprint = {
      projectTitle: 'Test',
      oneLineConcept: '',
      songs: [baseSong({ trackNo: 1 }), baseSong({ trackNo: 1 })]
    } as PlaylistBlueprint;
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const opts = makeOptions({ channel, songCount: 2 });
    await expect(savePack({ blueprint, options: opts })).rejects.toThrow(/관문을 통과하지 못했습니다/);
  });
});

describe('지시문 31 §3 — 실제 finalizeBlueprintForUse 결과(7개 워크스페이스 실측)가 canPersistFinalizedPack/canExportReleasePack을 정상 통과한다', () => {
  const WORKSPACE_ARCHETYPES = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'kr-kids-song', 'jp-kids-song'] as const;

  it.each(WORKSPACE_ARCHETYPES)('%s — 정상 로컬 생성 결과는 canPersist를 통과한다 (실측: workspacePolicyIssues가 항상 비어 있지는 않을 수 있어 이 케이스로 확인한다)', async archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype)!;
    // 지시문 31 §3 실측: 이 채널 고유의 primaryLanguage를 쓴다 — 임의로
    // 고른 언어는 워크스페이스의 실제 언어 정책(qualityPolicyForWorkspace)과
    // 어긋날 수 있다(실측 확인: senior-oldpop 정책은 english인데 이 테스트가
    // 처음엔 korean을 억지로 넣어 gate가 정확히 그 불일치를 잡아냈다 — gate
    // 버그가 아니라 테스트 fixture 버그였다).
    const opts = makeOptions({ channel, songCount: 6, lyricLanguage: channel.primaryLanguage });
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const slots = slotsForOptions(opts);
    const snapshot = buildGenerationSnapshot({ options: opts, provider: { provider: 'local', model: '', temperature: 0.7, batchSize: 1, keyStorageMode: 'session', apiKey: '' } as never, season: testSeason, slots });
    const workspaceId = workspaceForArchetype(channel.archetype)!.id;
    const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, opts.audience);
    const finalized = await finalizeBlueprintForUse(blueprint, snapshot, {
      conceptLabel: opts.customConcept || opts.projectTitle,
      audienceProfile,
      lyricLanguage: opts.lyricLanguage,
      channel,
      workspaceId
    });
    const persistResult = canPersistFinalizedPack(finalized);
    // 이 실측 테스트의 진짜 목적: 정상 생성 결과가 뭔가로 막히면 그 자체가
    // §3의 gate 설계가 너무 엄격하다는 실측 신호다 — 통과를 요구하되, 막히면
    // 실패 메시지에 원인을 그대로 남겨 바로 보이게 한다.
    expect(persistResult.ok, `blockers: ${persistResult.blockersKo.join(' / ')}`).toBe(true);
    const exportResult = canExportReleasePack(finalized);
    expect(exportResult.ok, `blockers: ${exportResult.blockersKo.join(' / ')}`).toBe(true);
  });
});
