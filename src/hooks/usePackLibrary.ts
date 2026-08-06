import { useEffect, useState } from 'react';
import { AUTOSAVE_ID, buildDefaultPackName, deleteAllPacks, deletePack, exportAllPacks, listPacks, loadPack, renamePack, savePack } from '../core/library';
import { importPacksResponsive } from '../core/backupImportClient';
import { clearAllSettings } from '../core/settingsStore';
import { clearAllHookHistory, forgetPack, recordPackHooks } from '../core/hookLedger';
import { clearAllSituationHistory, forgetPack as forgetSituationsPack, recordPackSituations } from '../core/situationLedger';
import { clearAllLyricLineHistory, forgetPack as forgetLyricLinesPack, recordPackLyricLines } from '../core/lyricLineLedger';
import { forgetVideosForPack, upsertVideoForPack } from '../core/videoLedger';
import type { GenerationOptions, PlaylistBlueprint, SavedPack, SavedPackMeta, SoundSignature, ThumbnailSpec } from '../types';

export function usePackLibrary(onRestore: (pack: SavedPack) => void) {
  const [savedPacks, setSavedPacks] = useState<SavedPackMeta[]>([]);

  async function refresh() {
    try {
      setSavedPacks(await listPacks());
    } catch {
      // IndexedDB unavailable (private browsing, etc.) — saved-pack list just stays empty.
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveCurrentPack(blueprint: PlaylistBlueprint | null, options: GenerationOptions, thumbnailSpec?: ThumbnailSpec | null, soundSignature?: SoundSignature) {
    if (!blueprint) return;
    const defaultName = buildDefaultPackName(blueprint, options);
    const name = window.prompt('저장할 이름을 입력하세요', defaultName);
    if (!name) return;
    const id = await savePack({ blueprint, options, name, thumbnailSpec: thumbnailSpec ?? undefined, soundSignature, personaMode: options.personaMode ?? false });
    try {
      // Promote: the hooks were already tracked under the ephemeral autosave
      // slot at generation time — re-record them under this pack's real,
      // permanent id and drop the autosave copy so exhaustionStats never
      // double-counts the same songs under two ids.
      await recordPackHooks(id, options.channel.id, blueprint, options.lyricLanguage);
      await forgetPack(AUTOSAVE_ID);
    } catch {
      // Hook ledger tracking is best-effort; a save should still succeed even if this fails.
    }
    try {
      // v5.22 (AXIS 1) — same promote-from-autosave shape as recordPackHooks
      // just above: situations/lyric lines were already tracked under the
      // ephemeral autosave slot at generation time (see App.tsx's own
      // recordPackHooks-adjacent call), re-recorded here under this pack's
      // real, permanent id.
      await recordPackSituations(id, options.channel.id, blueprint, options.lyricLanguage);
      await recordPackLyricLines(id, options.channel.id, blueprint, options.lyricLanguage);
      await forgetSituationsPack(AUTOSAVE_ID);
      await forgetLyricLinesPack(AUTOSAVE_ID);
    } catch {
      // Same best-effort convention as the hook ledger above.
    }
    try {
      // A saved pack is the operational unit of one video — draft a dashboard
      // entry from it so it appears in the weekly roadmap automatically.
      await upsertVideoForPack({
        channelId: options.channel.id,
        packId: id,
        videoTitle: blueprint.projectTitle,
        thumbnailA: thumbnailSpec?.variants.find(v => v.id === 'A')?.headline.replace('\n', ' ') || '',
        thumbnailB: thumbnailSpec?.variants.find(v => v.id === 'B')?.headline.replace('\n', ' ') || '',
        thumbnailC: thumbnailSpec?.variants.find(v => v.id === 'C')?.headline.replace('\n', ' ') || '',
        thumbnailUsed: thumbnailSpec?.selected ?? null,
        imagePrompt: thumbnailSpec?.imagePrompt || '',
        colors: thumbnailSpec ? [thumbnailSpec.colorScheme.background, thumbnailSpec.colorScheme.accent, thumbnailSpec.colorScheme.text] : [],
        seoKeywords: options.channel.seoKeywords || []
      });
    } catch {
      // Video ledger tracking is best-effort; a save should still succeed even if this fails.
    }
    await refresh();
  }

  /**
   * TASK v3.33 — multi-set generation saves each set as its own SavedPack
   * automatically (no window.prompt per set — the user already named the
   * whole run once, and each set gets "{name} Set 0N"). Mirrors
   * saveCurrentPack's hookLedger/videoLedger side effects, minus the
   * AUTOSAVE_ID promotion step: multi-set sets are never written to the
   * ephemeral autosave slot in the first place, so there's nothing to
   * promote/forget.
   */
  async function saveGeneratedSet(
    blueprint: PlaylistBlueprint,
    options: GenerationOptions,
    name: string,
    setMeta: { setGroupId: string; setIndex: number; setTotal: number }
  ) {
    const id = await savePack({ blueprint, options, name, personaMode: options.personaMode ?? false, ...setMeta });
    try {
      await recordPackHooks(id, options.channel.id, blueprint, options.lyricLanguage);
    } catch {
      // Hook ledger tracking is best-effort; a save should still succeed even if this fails.
    }
    try {
      // v5.22 (AXIS 1) — same "record everything real" shape as
      // recordPackHooks just above; multi-set sets need this most, since
      // cross-set scene/line duplication is exactly what this ledger exists
      // to catch (see situationLedger.ts/lyricLineLedger.ts's own doc comments).
      await recordPackSituations(id, options.channel.id, blueprint, options.lyricLanguage);
      await recordPackLyricLines(id, options.channel.id, blueprint, options.lyricLanguage);
    } catch {
      // Same best-effort convention as the hook ledger above.
    }
    try {
      await upsertVideoForPack({
        channelId: options.channel.id,
        packId: id,
        videoTitle: blueprint.projectTitle,
        thumbnailA: '',
        thumbnailB: '',
        thumbnailC: '',
        thumbnailUsed: null,
        imagePrompt: '',
        colors: [],
        seoKeywords: options.channel.seoKeywords || []
      });
    } catch {
      // Video ledger tracking is best-effort; a save should still succeed even if this fails.
    }
    await refresh();
    return id;
  }

  /**
   * TASK v3.62 (TASK 4) — a real channel measured 8/16 hooks (50%) repeated
   * from a previous set. Root cause: a single-set bridge import
   * (App.tsx's onImportSongsJson) only ever went through
   * handleGenerationSuccess, which records hooks under the ephemeral
   * AUTOSAVE_ID slot — recordPackHooks forgets that same id's OWN previous
   * contents before writing, so the very next generation (autosave or
   * otherwise) wipes it. Unless a user explicitly clicked "save to library"
   * (saveCurrentPack, which promotes AUTOSAVE_ID to a real id), a bridge
   * import's hooks never survived past that session — so the next day's
   * bridge instruction's avoidHooks list never saw them.
   * buildMultiSetClaudeCodeMasterInstruction/onImportMultiSetSongsJson
   * already avoided this (saveGeneratedSet always uses a real id); this is
   * the same fix for the single-set bridge import path, auto-saving under
   * a generated name (no window.prompt — a daily-cadence workflow can't
   * stop for one) so hook history persists without requiring a manual save.
   */
  async function saveImportedPack(blueprint: PlaylistBlueprint, options: GenerationOptions, thumbnailSpec?: ThumbnailSpec | null, soundSignature?: SoundSignature) {
    const name = buildDefaultPackName(blueprint, options);
    const id = await savePack({ blueprint, options, name, thumbnailSpec: thumbnailSpec ?? undefined, soundSignature, personaMode: options.personaMode ?? false });
    try {
      await recordPackHooks(id, options.channel.id, blueprint, options.lyricLanguage);
      await forgetPack(AUTOSAVE_ID);
    } catch {
      // Hook ledger tracking is best-effort; a save should still succeed even if this fails.
    }
    try {
      // v5.22 (AXIS 1) — same rationale as saveImportedPack's own recordPackHooks
      // just above: a bridge import's scenes/lines must survive past this
      // session the same way its hooks now do, or the next day's bridge
      // instruction's recent-scene/recent-line avoid-lists would never see them.
      await recordPackSituations(id, options.channel.id, blueprint, options.lyricLanguage);
      await recordPackLyricLines(id, options.channel.id, blueprint, options.lyricLanguage);
      await forgetSituationsPack(AUTOSAVE_ID);
      await forgetLyricLinesPack(AUTOSAVE_ID);
    } catch {
      // Same best-effort convention as the hook ledger above.
    }
    await refresh();
    return id;
  }

  async function loadPackById(id: string) {
    const pack = await loadPack(id);
    if (pack) onRestore(pack);
  }

  async function remove(id: string) {
    await deletePack(id);
    try {
      await forgetPack(id);
    } catch {
      // Hook ledger tracking is best-effort; deletion should still succeed even if this fails.
    }
    try {
      // v5.22 (AXIS 1) — same "free it back into the pool" rule as the hook
      // ledger just above: a deleted pack's scenes/lines must not keep
      // permanently blocking future generations from reusing them.
      await forgetSituationsPack(id);
      await forgetLyricLinesPack(id);
    } catch {
      // Same best-effort convention as the hook ledger above.
    }
    try {
      await forgetVideosForPack(id);
    } catch {
      // Video ledger tracking is best-effort; deletion should still succeed even if this fails.
    }
    await refresh();
  }

  async function rename(id: string, currentName: string) {
    const name = window.prompt('새 이름을 입력하세요', currentName);
    if (!name) return;
    await renamePack(id, name);
    await refresh();
  }

  async function exportAll() {
    const blob = await exportAllPacks();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suno-weaver-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importAll(file: File) {
    await importPacksResponsive(file);
    await refresh();
  }

  async function deleteAll() {
    if (!window.confirm('저장된 모든 팩, 훅 이력, 로컬 API 키를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    await deleteAllPacks();
    await clearAllHookHistory();
    // v5.22 (AXIS 1) — same "전체 삭제" scope as clearAllHookHistory just above.
    await clearAllSituationHistory();
    await clearAllLyricLineHistory();
    await clearAllSettings();
    await refresh();
  }

  return { savedPacks, refresh, saveCurrentPack, saveGeneratedSet, saveImportedPack, loadPackById, remove, rename, exportAll, importAll, deleteAll };
}
