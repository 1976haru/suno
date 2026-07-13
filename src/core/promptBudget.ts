export const SUNO_STYLE_LIMIT = 1000;
export const SAFE_TARGET = 900;
export const SUNO_COPY_LIMIT = SAFE_TARGET;

export type PromptTermId =
  | 'genre' | 'vocal' | 'hook' | 'moneyChord' | 'duration' | 'tempo'
  | 'mood' | 'instruments' | 'season' | 'safety'
  | 'songRole' | 'motif' | 'listenerScene' | 'mixNotes';

export const PROMPT_PRIORITY: PromptTermId[] = [
  'genre', 'vocal', 'hook', 'moneyChord', 'duration', 'tempo',
  'mood', 'instruments', 'season', 'safety',
  'songRole', 'motif', 'listenerScene', 'mixNotes'
];

export const ESSENTIAL_TERM_IDS = new Set<PromptTermId>(['genre', 'vocal', 'hook', 'moneyChord', 'duration', 'tempo']);

export const TERM_LABELS_KO: Record<PromptTermId, string> = {
  genre: 'genre',
  vocal: 'vocal',
  hook: 'hook',
  moneyChord: 'chord progression',
  duration: 'duration',
  tempo: 'tempo',
  mood: 'mood',
  instruments: 'instruments',
  season: 'season',
  safety: 'avoid rules',
  songRole: 'song role',
  motif: 'motif',
  listenerScene: 'listener scene',
  mixNotes: 'mix notes'
};

export interface PromptPart {
  id: PromptTermId;
  text: string | undefined | null;
}

export interface StylePromptResult {
  prompt: string;
  length: number;
  withinLimit: boolean;
  droppedTerms: string[];
}

const REPEATED_ADJECTIVES = ['warm', 'nostalgic', 'soft', 'gentle', 'polished', 'intimate'];
const ADJECTIVE_CAP = 2;

function splitAtoms(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/[;,]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeAtomKey(atom: string) {
  return atom
    .toLowerCase()
    .replace(/^avoid:\s*/, 'avoid ')
    .replace(/^avoid\s+/, 'avoid ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capRepeatedAdjectives(atoms: string[], ids: PromptTermId[]): { id: PromptTermId; text: string }[] {
  const counts = new Map<string, number>();
  return atoms
    .map((atom, i) => {
      let text = atom;
      for (const word of REPEATED_ADJECTIVES) {
        const re = new RegExp(`\\b${word}\\b`, 'i');
        if (!re.test(text)) continue;
        const count = (counts.get(word) || 0) + 1;
        counts.set(word, count);
        if (count > ADJECTIVE_CAP) {
          text = text.replace(re, '').replace(/\s{2,}/g, ' ').trim();
        }
      }
      return { id: ids[i], text };
    })
    .filter(entry => Boolean(entry.text));
}

export function dedupeTerms(atoms: string[]): string[] {
  const seen = new Set<string>();
  const exactDeduped = atoms.filter(atom => {
    const key = normalizeAtomKey(atom);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const containmentDeduped = exactDeduped.filter((atom, i) => {
    const lower = normalizeAtomKey(atom);
    return !exactDeduped.some((other, j) => {
      if (i === j) return false;
      const otherLower = normalizeAtomKey(other);
      if (otherLower.length <= lower.length) return false;
      return otherLower.includes(lower);
    });
  });

  const placeholderIds = containmentDeduped.map(() => 'mood' as PromptTermId);
  return capRepeatedAdjectives(containmentDeduped, placeholderIds).map(entry => entry.text);
}

function addDroppedLabel(droppedTerms: string[], id: PromptTermId) {
  const label = TERM_LABELS_KO[id];
  if (!droppedTerms.includes(label)) droppedTerms.push(label);
}

export function composeStylePrompt(
  parts: PromptPart[],
  limit: number = SUNO_COPY_LIMIT,
  safeTarget: number = SUNO_COPY_LIMIT
): StylePromptResult {
  const atomsById = new Map<PromptTermId, string[]>();
  for (const part of parts) {
    const atoms = splitAtoms(part.text);
    if (!atoms.length) continue;
    atomsById.set(part.id, [...(atomsById.get(part.id) || []), ...atoms]);
  }

  const seen = new Set<string>();
  for (const id of PROMPT_PRIORITY) {
    const atoms = atomsById.get(id);
    if (!atoms) continue;
    atomsById.set(id, atoms.filter(atom => {
      const key = normalizeAtomKey(atom);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }

  const nonEssentialIds = PROMPT_PRIORITY.filter(id => !ESSENTIAL_TERM_IDS.has(id));
  const flatAtoms: string[] = [];
  const flatIds: PromptTermId[] = [];
  for (const id of nonEssentialIds) {
    for (const atom of atomsById.get(id) || []) {
      flatAtoms.push(atom);
      flatIds.push(id);
    }
  }
  const keepMask = flatAtoms.map((atom, i) => {
    const lower = normalizeAtomKey(atom);
    return !flatAtoms.some((other, j) => {
      if (i === j) return false;
      const otherLower = normalizeAtomKey(other);
      if (otherLower.length <= lower.length) return false;
      return otherLower.includes(lower);
    });
  });
  const containedFilteredAtoms = flatAtoms.filter((_, i) => keepMask[i]);
  const containedFilteredIds = flatIds.filter((_, i) => keepMask[i]);
  const cappedAtoms = capRepeatedAdjectives(containedFilteredAtoms, containedFilteredIds);
  for (const id of nonEssentialIds) atomsById.set(id, []);
  cappedAtoms.forEach(({ id, text }) => atomsById.get(id)!.push(text));

  const droppedTerms: string[] = [];
  const keptAtoms: string[] = [];
  let currentLength = 0;

  for (const id of PROMPT_PRIORITY) {
    const atoms = atomsById.get(id);
    if (!atoms || !atoms.length) continue;
    const essential = ESSENTIAL_TERM_IDS.has(id);
    for (const atom of atoms) {
      const projected = currentLength + (currentLength ? 2 : 0) + atom.length;
      if (!essential && projected > safeTarget) {
        addDroppedLabel(droppedTerms, id);
        continue;
      }
      keptAtoms.push(atom);
      currentLength = projected;
    }
  }

  const prompt = keptAtoms.join(', ');
  return {
    prompt,
    length: prompt.length,
    withinLimit: prompt.length <= limit,
    droppedTerms
  };
}
