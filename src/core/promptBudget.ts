// TASK F1 (v3.7) — verified against Suno's own v5.5 documentation and
// multiple independent 2026 prompt guides: the Style field is ~1,000
// characters on v4.5/v5/v5.5; ~200 characters only applied to v4 and older.
// Kept configurable (see SUNO_STYLE_LIMIT_PRESETS + SettingsModal) since a
// user on an older account/plan may still be capped at 200, but the default
// intentionally stays at the verified-correct 1,000 rather than degrading
// every v5.5 user's output to a stale v4 number.
export const SUNO_STYLE_LIMIT = 1000;
export const SAFE_TARGET = 900;
export const SUNO_COPY_LIMIT = SUNO_STYLE_LIMIT;

/** TASK F1 (v3.7) — selectable in Settings; see SettingsModal.tsx. */
export const SUNO_STYLE_LIMIT_PRESETS = [
  { id: 'v5-standard', label: 'Suno v4.5 / v5 / v5.5 (표준, 1000자)', value: SUNO_STYLE_LIMIT },
  { id: 'v4-legacy', label: 'Suno v4 이하 (레거시, 200자)', value: 200 }
] as const;

// TASK F3 (v3.7) — multiple 2026 Suno prompt guides converge on the same
// finding: the Style field responds best to roughly 15-30 comma-separated
// descriptor words; beyond ~40 words the model reportedly starts ignoring or
// blending tags rather than following them. This is independent of the
// character budget above — a prompt can be well under 1,000 characters and
// still be too wordy.
export const STYLE_WORD_TARGET_MIN = 15;
export const STYLE_WORD_TARGET_MAX = 30;
export const STYLE_WORD_SOFT_MAX = 40;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export type PromptTermId =
  | 'genre' | 'vocal' | 'hook' | 'moneyChord' | 'duration' | 'tempo'
  | 'mood' | 'instruments' | 'season' | 'safety'
  | 'songRole' | 'motif' | 'listenerScene' | 'mixNotes';

// TASK F2 (v3.7) — reordered to match Suno's own recommended tag order
// (genre -> mood -> instruments -> vocal -> production/detail); Suno weighs
// earlier tags more heavily, and a real measurement found mood/instrument
// words landing dead last in the prompt, behind duration/BPM filler. BPM
// ("tempo") moved to the very end and out of ESSENTIAL_TERM_IDS: multiple
// 2026 Suno guides treat BPM as an approximate guide, not a locked
// instruction, so it's the safest thing to drop first once budget is tight.
export const PROMPT_PRIORITY: PromptTermId[] = [
  'genre', 'mood', 'vocal', 'instruments', 'hook', 'moneyChord', 'duration',
  'season', 'songRole', 'motif', 'listenerScene', 'mixNotes', 'safety', 'tempo'
];

export const ESSENTIAL_TERM_IDS = new Set<PromptTermId>(['genre', 'vocal', 'hook', 'moneyChord', 'duration']);

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
  /** TASK F3 (v3.7) — comma/whitespace word count of the final prompt; see STYLE_WORD_SOFT_MAX. */
  wordCount: number;
  withinWordTarget: boolean;
}

interface KeptPromptAtom {
  id: PromptTermId;
  text: string;
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

export function enforceHardLimit(
  atoms: KeptPromptAtom[],
  limit: number = SUNO_STYLE_LIMIT
): { atoms: KeptPromptAtom[]; dropped: KeptPromptAtom[] } {
  const kept: KeptPromptAtom[] = [];
  const dropped: KeptPromptAtom[] = [];
  let currentLength = 0;

  for (const atom of atoms) {
    const projected = currentLength + (currentLength ? 2 : 0) + atom.text.length;
    if (projected > limit) {
      dropped.push(atom);
      continue;
    }
    kept.push(atom);
    currentLength = projected;
  }

  return { atoms: kept, dropped };
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
  const keptAtoms: KeptPromptAtom[] = [];
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
      keptAtoms.push({ id, text: atom });
      currentLength = projected;
    }
  }

  const hardLimited = enforceHardLimit(keptAtoms, limit);
  for (const dropped of hardLimited.dropped) addDroppedLabel(droppedTerms, dropped.id);

  // TASK F3 (v3.7) — char budget alone doesn't guarantee a Suno-friendly tag
  // count; a prompt can sit comfortably under 1,000 characters and still be
  // 100+ words. Once under the char limit, drop non-essential atoms lowest
  // priority first (reverse PROMPT_PRIORITY order) until the word count is
  // back at or under STYLE_WORD_SOFT_MAX, or nothing non-essential is left.
  let finalAtoms = [...hardLimited.atoms];
  const wordCountOf = (atoms: KeptPromptAtom[]) => countWords(atoms.map(atom => atom.text).join(', '));
  if (wordCountOf(finalAtoms) > STYLE_WORD_SOFT_MAX) {
    for (let i = PROMPT_PRIORITY.length - 1; i >= 0 && wordCountOf(finalAtoms) > STYLE_WORD_SOFT_MAX; i -= 1) {
      const id = PROMPT_PRIORITY[i];
      if (ESSENTIAL_TERM_IDS.has(id)) continue;
      const remaining: KeptPromptAtom[] = [];
      let droppedAny = false;
      for (const atom of finalAtoms) {
        if (atom.id === id) {
          droppedAny = true;
          continue;
        }
        remaining.push(atom);
      }
      if (droppedAny) {
        finalAtoms = remaining;
        addDroppedLabel(droppedTerms, id);
      }
    }
  }

  const prompt = finalAtoms.map(atom => atom.text).join(', ');
  const wordCount = countWords(prompt);
  return {
    prompt,
    length: prompt.length,
    withinLimit: prompt.length <= limit,
    wordCount,
    withinWordTarget: wordCount <= STYLE_WORD_SOFT_MAX,
    droppedTerms
  };
}
