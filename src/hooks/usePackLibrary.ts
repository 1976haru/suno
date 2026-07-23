import { useEffect, useState } from 'react';
import { AUTOSAVE_ID, buildDefaultPackName, deleteAllPacks, deletePack, exportAllPacks, importPacks, listPacks, loadPack, renamePack, savePack } from '../core/library';
import { clearAllSettings } from '../core/settingsStore';
import { forgetPack, recordPackHooks } from '../core/hookLedger';
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
      // TASK B3 (v3.4): a saved pack is the operational unit of "one video" —
      // draft a video-dashboard entry from it so it shows up in the weekly
      // roadmap table without extra manual entry.
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
    await importPacks(file);
    await refresh();
  }

  async function deleteAll() {
    if (!window.confirm('저장된 모든 팩과 로컬 API 키를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    await deleteAllPacks();
    await clearAllSettings();
    await refresh();
  }

  return { savedPacks, refresh, saveCurrentPack, saveGeneratedSet, loadPackById, remove, rename, exportAll, importAll, deleteAll };
}
