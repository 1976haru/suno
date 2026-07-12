import { useEffect, useState } from 'react';
import { buildDefaultPackName, deleteAllPacks, deletePack, exportAllPacks, importPacks, listPacks, loadPack, renamePack, savePack } from '../core/library';
import { clearAllSettings } from '../core/settingsStore';
import type { GenerationOptions, PlaylistBlueprint, SavedPack, SavedPackMeta } from '../types';

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

  async function saveCurrentPack(blueprint: PlaylistBlueprint | null, options: GenerationOptions) {
    if (!blueprint) return;
    const defaultName = buildDefaultPackName(blueprint, options);
    const name = window.prompt('저장할 이름을 입력하세요', defaultName);
    if (!name) return;
    await savePack({ blueprint, options, name });
    await refresh();
  }

  async function loadPackById(id: string) {
    const pack = await loadPack(id);
    if (pack) onRestore(pack);
  }

  async function remove(id: string) {
    await deletePack(id);
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

  return { savedPacks, refresh, saveCurrentPack, loadPackById, remove, rename, exportAll, importAll, deleteAll };
}
