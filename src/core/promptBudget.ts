// v3.66 (TASK B) — this module is the local-preview path only. The real
// production path (Claude Code bridge, claudeCodeBridge.ts) sends plan/
// constraint data to a remote LLM, which writes the stylePrompt itself and
// never calls anything in this file. See docs/v366-report.md.
//
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
export const STYLE_PROMPT_OVER_LIMIT_WARNING = '스타일 프롬프트가 1000자를 초과합니다 - 수동 확인 필요';

/** TASK F1 (v3.7) — selectable in Settings; see SettingsModal.tsx. */
export const SUNO_STYLE_LIMIT_PRESETS = [
  { id: 'v5-standard', label: 'Suno v4.5 / v5 / v5.5 (표준, 1000자)', value: SUNO_STYLE_LIMIT },
  { id: 'v4-legacy', label: 'Suno v4 이하 (레거시, 200자)', value: 200 }
] as const;

// TASK F3 (v3.7) / TASK G1 (v3.10) — multiple 2026 Suno prompt guides
// converge on the same finding: the Style field responds best to roughly
// 15-30 comma-separated descriptor words. This is independent of the
// character budget above — a prompt can be well under 1,000 characters and
// still be too wordy. STYLE_WORD_TARGET_MAX is the real trim threshold
// composeStylePrompt enforces below.
//
// TASK H1 (v3.13) — 30 was never actually reachable: the five ESSENTIAL_TERM_IDS
// alone (genre/vocal/hook/moneyChord/duration) measured 32-40 words across
// every archetype/language/genre combination (avg 36.25), meaning the old
// 30-word target was already blown before a single mood/instrument word was
// added. Since the trim loop below drops entire non-essential categories
// until it's back under target, and instruments/mood are non-essential, this
// silently deleted them 100% of the time regardless of which genre was
// selected — the actual bug behind "every genre sounds the same". Re-measured
// with the genre-differentiation floor this version guarantees (mood: 1 atom,
// instruments: 2 atoms — see GUARANTEED_MINIMUM_TERM_IDS) added on top of that
// 32-40 essential range: 50 leaves every measured combination comfortable
// room. The 1,000-char SUNO_STYLE_LIMIT hard limit is untouched by this —
// this constant only ever governs the soft, best-practice word trim.
//
// TASK v3.58 (TASK 7-2) — 50 was itself measured as too loose once TASK 5-1's
// label/directive-sentence removal and TASK 4's audience constraints were
// both in place: a real 18-song pack averaged ~140 words/prompt (Suno's own
// documented sweet spot is 15-30 comma-separated descriptors — see this
// file's own TASK F3/G1 comment above). Lowered to 35, the tightest value
// that still comfortably fits the same measured 32-40-word essential-atom
// range this constant's own history is built on. GENRE_NARRATIVE_FLOOR_ATOMS
// drops from 5 (the narrative block's own full clause count, so stage 2.5's
// "reduce to floor" was a no-op — 5 of 5 always survived) to 2, so genre
// narrative is actually compressed rather than passed through untouched.
// STYLE_CHAR_TARGET is new: a soft *target* (not SUNO_STYLE_LIMIT's hard
// 1,000-char cap), giving composeStylePrompt's callers a "did we actually
// land in the 350-450 char sweet spot" number to report without changing
// what's enforced.
export const STYLE_WORD_TARGET_MIN = 15;
export const STYLE_WORD_TARGET_MAX = 35;
export const STYLE_CHAR_TARGET = 450;
/** TASK v3.59 (TASK C-8) — exported so core/songPostProcess.ts (TASK v3.60 TASK B-4) can run the same long-clause diagnostic on a bridge song's raw, unstructured stylePrompt instead of re-deriving its own threshold. */
export const ATOM_WORD_CAP = 8;

/**
 * TASK H1 (v3.13) — mood/instruments are the only atoms that actually vary
 * per genre selection (the rest of the style prompt is archetype/channel-
 * level and identical regardless of genre), so they must never hit zero even
 * under a tight word budget. Not promoted to full ESSENTIAL status (that
 * would let them re-blow the budget the way the old 30-word target did) —
 * instead the trim loop below reduces them to a guaranteed-minimum atom count
 * rather than dropping the whole category.
 */
// TASK v4.9 (TASK C) bugfix — 'openingHook' added alongside 'killingPoint':
// without this, the word-count-trim step below (§ "Step 1: fully drop
// non-essential, non-guaranteed-minimum categories") dropped it on nearly
// every song, since it sits one position lower-priority than killingPoint
// in PROMPT_PRIORITY and gets evaluated (and dropped) first in that step's
// reverse-priority loop — tracks 1-3's own MANDATORY opening hook was
// silently missing from every real generated prompt until this was added.
export const GUARANTEED_MINIMUM_TERM_IDS = new Set<PromptTermId>(['genreNarrative', 'concept', 'mood', 'instruments', 'earworm', 'arrangementDensity', 'hookDevice', 'killingPoint', 'openingHook', 'openingLoudness']);
export const GENRE_NARRATIVE_FLOOR_ATOMS = 2;
// TASK v4.7 (팔레트 커버리지 확장) — raised 2 -> 5. The 'concept' atom group can
// now hold up to 3 sources at once (rotatingArtistStyleAtoms, up to 3 atoms;
// rotatingEraPaletteAtoms, up to 4 atoms — mutually exclusive with the
// former; conceptStyleText, up to 2 atoms), all flattened into one array
// BEFORE reduceToFloor runs, in that fixed order. With coverage expanded
// from ~15 to ~70 genres, a real customConcept on a now-covered genre (e.g.
// oldpop-motown-pop-soul, previously uncovered) started losing its own
// concept-mapped text entirely under budget pressure — floor=2 always kept
// only palette atoms, since they're listed first (tests/v352ConceptDiversity
// .test.ts caught this: "morning light" silently vanished). 5 = the worst
// case's max non-concept contribution (palette's own 4-atom ceiling) + 1, so
// at least the first concept atom always survives regardless of how many
// palette atoms preceded it.
export const CONCEPT_FLOOR_ATOMS = 5;
export const MOOD_FLOOR_ATOMS = 1;
export const INSTRUMENTS_FLOOR_ATOMS = 2;
/**
 * v3.15 — earwormMode is a deliberate user opt-in (see types.ts's
 * GenerationOptions.earwormMode); the whole point of the toggle is defeated
 * if its style-prompt atom silently drops to zero every time a channel's own
 * mood/instrument packs are already wordy (measured: that's the common case,
 * not an edge case — see promptComposer.ts's EARWORM_STYLE_ATOMS comment).
 * Same guaranteed-minimum treatment as mood/instruments, at a 1-atom floor.
 */
export const EARWORM_FLOOR_ATOMS = 1;
/**
 * v3.67 (TASK A) — same guaranteed-minimum treatment as earworm above: a
 * peak track's whole point is its one designed killing-point moment, so it
 * must not silently vanish just because that track's other atoms (vocal,
 * genreNarrative, moneyChord, ...) happened to fill the safeTarget budget
 * before 'killingPoint' came up in priority order — real measurement found
 * exactly that on peak-phase tracks (the busiest ones) before this floor
 * was added.
 */
export const KILLING_POINT_FLOOR_ATOMS = 1;
/** TASK v4.9 (TASK C) — always exactly 1 atom per song, same as KILLING_POINT_FLOOR_ATOMS. */
export const OPENING_HOOK_FLOOR_ATOMS = 1;
/** TASK v4.11 (TASK B) — same guaranteed-minimum treatment, tracks 1-3 only (see data/openingHooks.ts's OPENING_LOUDNESS_DESCRIPTORS). */
export const OPENING_LOUDNESS_FLOOR_ATOMS = 1;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export type PromptTermId =
  | 'genre' | 'vocal' | 'hook' | 'moneyChord' | 'duration' | 'tempo'
  | 'mood' | 'instruments' | 'season' | 'safety' | 'earworm'
  | 'songRole' | 'motif' | 'listenerScene' | 'mixNotes' | 'genreNarrative' | 'genreSignature' | 'concept' | 'hookDevice' | 'introTexture' | 'arrangementDensity'
  | 'killingPoint' | 'soundFloor' | 'openingHook' | 'openingLoudness' | 'chorusContrast';

// TASK F2 (v3.7) — reordered to match Suno's own recommended tag order
// (genre -> mood -> instruments -> vocal -> production/detail); Suno weighs
// earlier tags more heavily, and a real measurement found mood/instrument
// words landing dead last in the prompt, behind duration/BPM filler. BPM
// ("tempo") moved to the very end and out of ESSENTIAL_TERM_IDS: multiple
// 2026 Suno guides treat BPM as an approximate guide, not a locked
// instruction, so it's the safest thing to drop first once budget is tight.
//
// v3.15 — 'earworm' (earwormMode's style-prompt atom, see promptComposer.ts's
// EARWORM_STYLE_ATOMS) sits right after 'moneyChord': high enough that it
// survives the word-count trim ahead of season/songRole/motif/listenerScene/
// mixNotes/safety/tempo (a deliberate user opt-in should outlive those before
// it gets dropped), but still non-essential — the toggle's own UI copy is
// explicit that this raises the odds of a familiar result, never guarantees
// one, so losing this atom under a tight budget is an acceptable trade-off.
//
// TASK v3.39 Part H — 'vocal' moved from 3rd (behind 'genre' and 'mood') to
// 2nd, directly after 'genre': real measured output showed a song's vocal
// gender landing 37% of the way into a 531-char prompt, behind the genre and
// mood atom groups (each of which can expand into several comma atoms, not
// just one) — a weak signal even though 'vocal' was always essential/never
// dropped. Suno weighs earlier tags more heavily, so the fix is position, not
// just presence.
//
// TASK v3.48.1 — budget pressure now follows the measured music-side order:
// vocal > arrangement narrative > money chord > intro texture > BPM >
// arrangement density > per-song hook device > additive tags. Instrument
// rotation is kept just before hookDevice because it is a structural
// diversity axis, not disposable visual copy. hookDevice is deliberately
// non-essential so very long custom style text can cut it before the higher
// priority atoms, but it is still protected from the word-count trim in
// normal prompts.
// TASK v3.67 (TASK A) — 'killingPoint' (this track's one designed peak
// moment, see data/killingPoints.ts) sits right after 'hookDevice': high
// enough to reliably survive normal budget pressure — the whole point of
// this task is a real, present peak moment, not one that silently loses
// its only style-prompt atom under a moderately long custom concept — but
// still non-essential, since plenty of tracks (arc peakStrength 'none')
// have no killing point at all and that is by design, not a bug.
// TASK v4.7 (TASK A) — 'soundFloor' (channelSoundFloor.ts's requiredAtoms, 3
// short atoms) is essential (never dropped, see ESSENTIAL_TERM_IDS below),
// so its OWN inclusion never depends on this position. Position only matters
// for compressHardLimitWithGuard's "lowest-priority-essential-first" shortForm
// stage (promptBudget.ts's essentialLowToHigh) — placing it first initially
// pushed 'vocal' down to 2nd-most-protected, and a real generated pack
// measured 'vocal' losing its proximity/ambience clauses (v3.80's own
// flagship-track override) to shortForm once soundFloor's ~95 extra chars
// tipped the total over SUNO_COPY_LIMIT. soundFloor has no shortForm at all
// (it's 3 fixed short atoms, nothing to shrink), so placing it just after
// 'tempo' — instead of first — costs nothing (it was never going anywhere)
// while restoring 'vocal' to its original (pre-v4.7) most-protected slot.
// TASK v4.9 (TASK C) bugfix — 'openingHook' is placed right after
// 'killingPoint': same "one real atom this track needs, not disposable
// copy" status. A real regression: this array (not the Set-shaped
// TERM_LABELS_KO/ESSENTIAL_TERM_IDS, both updated correctly) is what
// composeStylePrompt's own `order` actually iterates over to emit atoms —
// an id missing here never appears in the final joined prompt at all,
// silently, even though it was present in atomsById the whole time. Every
// one of tracks 1-3's mandatory opening hooks was being dropped this way
// until this line was added.
// TASK v4.11 (TASK B) — 'openingLoudness' placed right next to 'openingHook':
// same real regression this array's own openingHook doc comment above
// warns about — an id missing from THIS array never appears in the final
// prompt at all, regardless of atomsById/GUARANTEED_MINIMUM_TERM_IDS/
// GUARANTEED_FLOOR_BY_ID all being set correctly.
// 지시문 36 (TASK C) — 'chorusContrast'는 맨 끝(가장 낮은 우선순위)에 둔다:
// killingPoint(하루가 청취 검증한 축)보다 먼저 예산 압박에 잘려야 하고,
// hookDevice보다도 낮다 — 이 축은 verified:false 추정치 실험이지 채널
// 정체성 필수 요소가 아니다(GUARANTEED_MINIMUM_TERM_IDS에도 넣지 않음).
export const PROMPT_PRIORITY: PromptTermId[] = [
  'vocal', 'genreSignature', 'genreNarrative', 'concept', 'moneyChord', 'introTexture', 'tempo', 'soundFloor', 'arrangementDensity', 'instruments', 'hookDevice', 'killingPoint', 'openingHook', 'openingLoudness',
  'earworm', 'genre', 'hook', 'duration', 'mood', 'season', 'songRole', 'motif', 'listenerScene', 'mixNotes', 'safety', 'chorusContrast'
];

// TASK v4.7 (TASK A, §1-4) — "requiredAtoms... 18곡 전부의 stylePrompt 에
// 포함" — added to ESSENTIAL_TERM_IDS alongside 'vocal' so it's never
// trimmed under budget pressure, the same protection level channel identity
// (vocal) already gets.
export const ESSENTIAL_TERM_IDS = new Set<PromptTermId>(['genre', 'genreSignature', 'vocal', 'hook', 'moneyChord', 'duration', 'introTexture', 'tempo', 'soundFloor']);

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
  earworm: 'earworm hook style',
  songRole: 'song role',
  motif: 'motif',
  listenerScene: 'listener scene',
  mixNotes: 'mix notes',
  genreNarrative: 'genre arrangement narrative',
  genreSignature: 'genre signature',
  concept: 'concept direction',
  hookDevice: 'hook device',
  introTexture: 'intro texture',
  arrangementDensity: 'arrangement density',
  killingPoint: 'killing point',
  soundFloor: 'channel sound floor',
  openingHook: 'opening hook',
  openingLoudness: 'opening loudness',
  chorusContrast: 'chorus arrangement contrast'
};

export interface PromptPart {
  id: PromptTermId;
  text: string | undefined | null;
  /** Optional compressed replacement for an essential atom group under hard character-budget pressure (stage 2 of the full/short/minimal abbreviation ladder). */
  shortForm?: string | undefined | null;
  /** Optional further-compressed replacement, used only once shortForm still doesn't fit (stage 3 of the ladder). See v3.56's redesign of compressHardLimitWithGuard below. */
  minimalForm?: string | undefined | null;
}

export interface StylePromptResult {
  prompt: string;
  length: number;
  withinLimit: boolean;
  droppedTerms: string[];
  /** TASK F3 (v3.7) — comma/whitespace word count of the final prompt; see STYLE_WORD_TARGET_MAX. */
  wordCount: number;
  withinWordTarget: boolean;
  warnings: string[];
}

interface KeptPromptAtom {
  id: PromptTermId;
  text: string;
}

const REPEATED_ADJECTIVES = ['warm', 'nostalgic', 'soft', 'gentle', 'polished', 'intimate'];
const ADJECTIVE_CAP = 2;

export function splitAtoms(text: string | undefined | null): string[] {
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

/** 지시문 74 (TASK C) — 한 프롬프트 안에서 낭비되는 절 하나. `clause`가 `coveredBy`에 이미 담겨 있어 지워도 의미가 줄지 않는다. */
export interface RedundantClauseFinding {
  kind: 'exact' | 'contained';
  /** 지워도 되는 쪽(중복된 절). */
  clause: string;
  /** 그 의미를 이미 담고 있는 쪽. exact면 먼저 나온 같은 절, contained면 이 절을 포함하는 더 긴 절. */
  coveredBy: string;
}

/**
 * 지시문 74 (TASK C §3.3) — 완전 동일 절과 포함 관계 절을 찾는다.
 *
 * dedupeTerms가 이미 이 두 규칙(정확 일치 → 뒤엣것 제거, 포함 → 짧은 쪽
 * 제거)을 쓰고 있지만 그건 **조립 경로 전용**이다. 브릿지 에이전트가 직접
 * 쓴 stylePrompt는 그 파이프라인을 타지 않아 실측에서 그대로 새어 나왔다
 * (§3.2-①: "full arrangement and full playback level from the first bar"와
 * "full arrangement"가 같은 곡에 공존, ChatGPT 하우스 v3의 "off-beat open
 * hats" 2회·"deep rounded bass" ⊂ "deep rounded bass with kick ducking").
 * 판정 규칙을 두 벌 두지 않으려고 정규화(normalizeAtomKey)와 비교 방식을
 * dedupeTerms와 공유한다 — 다른 점은 **제거가 아니라 어느 쌍이 겹치는지를
 * 돌려준다**는 것뿐이다(scoreSong은 경고에 그 쌍을 실어야 한다).
 *
 * 한 단어짜리 절은 제외한다. dedupeTerms에는 이 가드가 없지만(조립 경로는
 * 자기가 만든 원자만 다뤄 한 단어 원자가 나오지 않는다) 사람이 쓴 프롬프트
 * 에서는 "bright" ⊂ "bright synth pluck" 같은 무해한 겹침이 흔해, 감점까지
 * 하는 자리에서는 소음이 된다.
 */
export function findRedundantClauses(clauses: readonly string[]): RedundantClauseFinding[] {
  const findings: RedundantClauseFinding[] = [];
  const keys = clauses.map(normalizeAtomKey);
  const meaningful = (index: number) => keys[index].split(' ').length >= 2;

  const firstIndexByKey = new Map<string, number>();
  const exactlyDuplicated = new Set<number>();
  for (let i = 0; i < clauses.length; i += 1) {
    const first = firstIndexByKey.get(keys[i]);
    if (first === undefined) {
      firstIndexByKey.set(keys[i], i);
      continue;
    }
    exactlyDuplicated.add(i);
    if (!meaningful(i)) continue;
    findings.push({ kind: 'exact', clause: clauses[i], coveredBy: clauses[first] });
  }

  for (let i = 0; i < clauses.length; i += 1) {
    if (exactlyDuplicated.has(i) || !meaningful(i)) continue;
    const covering = clauses.findIndex((_, j) => j !== i
      && !exactlyDuplicated.has(j)
      && keys[j].length > keys[i].length
      && keys[j].includes(keys[i]));
    if (covering >= 0) findings.push({ kind: 'contained', clause: clauses[i], coveredBy: clauses[covering] });
  }

  return findings;
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

function addWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function promptText(atoms: KeptPromptAtom[]): string {
  return atoms.map(atom => atom.text).join(', ');
}

function promptLength(atoms: KeptPromptAtom[]): number {
  return promptText(atoms).length;
}

function shortFormAtomsFor(part: PromptPart, atoms: string[]): string[] {
  const explicitShortForm = splitAtoms(part.shortForm);
  if (explicitShortForm.length) return explicitShortForm.slice(0, 3);
  if (part.id !== 'genreSignature') return [];
  return atoms.slice(0, 3);
}

function minimalFormAtomsFor(part: PromptPart, atoms: string[]): string[] {
  const explicitMinimalForm = splitAtoms(part.minimalForm);
  if (explicitMinimalForm.length) return explicitMinimalForm.slice(0, 2);
  if (part.id !== 'genreSignature') return [];
  return atoms.slice(0, 1);
}

/**
 * v3.56 — a short/minimal form is authored independently of whatever other
 * atoms happen to already be in the prompt (e.g. rotatingGenreText mixes a
 * couple of the same genre's own signatureSound atoms into the 'genre' id),
 * so splicing it in can reintroduce a literal duplicate that the earlier
 * exact-dedupe pass (composeStylePrompt's `seen` set, which only ever saw
 * the pre-substitution atoms) never had a chance to catch. Re-dedupe here,
 * every time a form is substituted, rather than relying on substitutions
 * never colliding.
 */
function replaceTermWithForm(
  atoms: KeptPromptAtom[],
  id: PromptTermId,
  formAtomsById: Map<PromptTermId, string[]>
): KeptPromptAtom[] | null {
  const formAtoms = formAtomsById.get(id);
  if (!formAtoms?.length || !atoms.some(atom => atom.id === id)) return null;
  const replaced = atoms.filter(atom => atom.id !== id);
  const firstIndex = atoms.findIndex(atom => atom.id === id);
  const insertAt = firstIndex < 0 ? replaced.length : replaced.filter((_, index) => index < firstIndex).length;
  const newAtoms = formAtoms.map(text => ({ id, text }));
  const newKeys = new Set(newAtoms.map(atom => normalizeAtomKey(atom.text)));
  const deduped = replaced.filter(atom => !newKeys.has(normalizeAtomKey(atom.text)));
  deduped.splice(Math.min(insertAt, deduped.length), 0, ...newAtoms);
  return promptLength(deduped) < promptLength(atoms) ? deduped : null;
}

/**
 * TASK v3.47 Step 4 / v3.56 — genreNarrative is non-essential (so it's a
 * candidate for stage-1 dropping like any other filler atom), but its
 * verse/pre-chorus/chorus/hook-entry/mix clauses are exactly what makes a
 * lead genre's arrangement audible rather than generic, so a full drop is a
 * worse outcome than abbreviating it down to its floor-count core clauses
 * first. Shared by compressHardLimitWithGuard's stage 1 (hard character
 * budget) and composeStylePrompt's own soft word-budget pass below, so
 * genreNarrative gets this same "abbreviate before delete" treatment at
 * both stages instead of only the word-budget one.
 */
/**
 * TASK v3.58 (TASK 7-4) — GENRE_NARRATIVE_FLOOR_ATOMS dropping from 5 (the
 * narrative block's own full clause count — always a no-op) to 2 means this
 * now actually discards 3 of 5 clauses under budget pressure. The old fixed
 * pattern order (verse -> pre-chorus -> chorus -> hook-entry -> mix) would
 * make every track that hits this floor keep the exact same 2 clauses
 * (verse + pre-chorus) verbatim — a new, narrower version of the same
 * "every song sounds the same" failure TASK 1 fixed for genre rotation.
 * `rotationSeed` (the track's own index/trackNo) rotates which clause
 * category is tried first, so different tracks under budget pressure keep
 * different pairs of clauses.
 */
function reduceGenreNarrativeToFloor(atoms: KeptPromptAtom[], floor: number, rotationSeed = 0): KeptPromptAtom[] {
  const narrativeAtoms = atoms.filter(atom => atom.id === 'genreNarrative');
  if (narrativeAtoms.length <= floor) return atoms;
  const keep = new Set<KeptPromptAtom>();
  const patterns = [
    /\bverse\b/i,
    /\bpre-chorus\b/i,
    /^chorus\b/i,
    /hook entry|downbeat|dropout|one-beat pause|rising sweep|drum pickup|walk-up|stop-and-go|drum mute|filter sweep|riser|vocal gap/i,
    /\bmix\b/i
  ];
  // TASK v3.58 (TASK 7-4) — this loop used to run every pattern
  // unconditionally, never checking `floor`: harmless while floor always
  // equaled narrativeAtoms.length (GENRE_NARRATIVE_FLOOR_ATOMS was 5, the
  // narrative block's own full clause count, so this whole function was a
  // no-op — see this function's own history above), but once floor dropped
  // to 2, a narrative with one clause matching each of the 5 patterns (the
  // common case) kept all 5 anyway, silently defeating the floor entirely.
  const offset = ((rotationSeed % patterns.length) + patterns.length) % patterns.length;
  const rotatedPatterns = [...patterns.slice(offset), ...patterns.slice(0, offset)];
  for (const pattern of rotatedPatterns) {
    if (keep.size >= floor) break;
    const match = narrativeAtoms.find(atom => pattern.test(atom.text.trim()) && !keep.has(atom));
    if (match) keep.add(match);
  }
  for (const atom of narrativeAtoms) {
    if (keep.size >= floor) break;
    keep.add(atom);
  }
  return atoms.filter(atom => atom.id !== 'genreNarrative' || keep.has(atom));
}

function lowestPriorityDroppableIdExcluding(
  atoms: KeptPromptAtom[],
  order: PromptTermId[],
  protectedIds: Set<PromptTermId>
): PromptTermId | null {
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    if (ESSENTIAL_TERM_IDS.has(id) || protectedIds.has(id)) continue;
    if (atoms.some(atom => atom.id === id)) return id;
  }
  return null;
}

function dropNonEssentialLowestFirst(
  atoms: KeptPromptAtom[],
  limit: number,
  order: PromptTermId[],
  droppedTerms: string[],
  protectedIds: Set<PromptTermId>
): KeptPromptAtom[] {
  let finalAtoms = atoms;
  const maxIterations = Math.max(1, finalAtoms.length);
  for (let iteration = 0; iteration < maxIterations && promptLength(finalAtoms) > limit; iteration += 1) {
    const id = lowestPriorityDroppableIdExcluding(finalAtoms, order, protectedIds);
    if (!id) break;
    const next = finalAtoms.filter(atom => atom.id !== id);
    if (promptLength(next) >= promptLength(finalAtoms)) break;
    finalAtoms = next;
    addDroppedLabel(droppedTerms, id);
  }
  return finalAtoms;
}

/**
 * v3.56 — redesigned as explicit, individually-bounded stages instead of one
 * loop that interleaved dropping and short-forming (the v3.55 shape). That
 * interleaving was itself already loop-guarded (maxIterations + a "no
 * progress -> break" escape), but only ever had one compressed replacement
 * available (genreSignature's auto-sliced short form) — once every
 * non-essential atom was gone and that single substitution was spent, a
 * prompt whose essential atoms alone exceeded the limit (a real case: a long
 * genre + long concept + persona combination) had no further path down and
 * relied entirely on the escape guard.
 *
 * Stage 1 (short): replace essential atoms with their authored `shortForm`
 * (or, for genreSignature specifically, an auto-sliced fallback), lowest
 * priority essential first. Tried before any dropping: shrinking a long
 * essential atom (genreSignature's descriptive text is the actual reason a
 * prompt blows the budget in real cases) loses less real content than fully
 * dropping a short non-essential atom like genreNarrative or concept — see
 * TASK v3.47 Step 4's and v3.52's regression tests, both of which expect
 * genreNarrative/concept to survive ordinary budget pressure that a single
 * genreSignature shortening already resolves.
 * Stage 2 (drop filler): still over budget — remove non-essential,
 * non-identity atoms (i.e. everything except GUARANTEED_MINIMUM_TERM_IDS —
 * genreNarrative/concept/mood/instruments/earworm/arrangementDensity/
 * hookDevice), lowest priority first.
 * Stage 2.5 (guaranteed-minimum floor): still over — each
 * GUARANTEED_MINIMUM_TERM_IDS category is genre-differentiation content
 * (see that constant's own comment), not filler, so it's abbreviated to its
 * floor atom count rather than dropped outright, same "shrink before
 * delete" treatment stage 1 gives essential atoms via shortForm. Mirrors the
 * soft word-budget pass's own floor treatment further below, applied here
 * too so a tight *character* budget doesn't zero out earworm/mood/
 * instruments before the word-budget pass ever gets a chance to protect them
 * (they'd already be gone).
 * Stage 3 (minimal): still over — essential atoms -> `minimalForm` (or an
 * even shorter auto-sliced fallback for genreSignature), same lowest-
 * priority-essential-first order as stage 1. Tried before stage 4's full
 * drop for the same reason stage 1 runs before stage 2: shrinking an
 * essential atom further loses less real content than fully deleting a
 * guaranteed-minimum category's last floor atom (e.g. earworm's v3.15
 * single-atom floor).
 * Stage 4 (drop remaining, last resort): still over budget even at minimal
 * essential forms — now everything (including guaranteed-minimum floor
 * remnants) is droppable, same as any other non-essential atom.
 * Stage 5 (escape): handled by the caller — composeStylePrompt surfaces
 * STYLE_PROMPT_OVER_LIMIT_WARNING when the result is still over limit here
 * rather than throwing or looping further. Generation always completes.
 *
 * Every stage is bounded by a finite, input-derived count (the atom list
 * length for the drop stages, the essential-id count for stages 1 and 3), so
 * this function returns in O(atoms + essentialIds) regardless of what the
 * caller's genre/concept/persona combination looks like.
 */
function reduceToFloorCount(atoms: KeptPromptAtom[], id: PromptTermId, floor: number): KeptPromptAtom[] {
  let kept = 0;
  return atoms.filter(atom => {
    if (atom.id !== id) return true;
    kept += 1;
    return kept <= floor;
  });
}

function compressHardLimitWithGuard(
  atoms: KeptPromptAtom[],
  limit: number,
  order: PromptTermId[],
  shortAtomsById: Map<PromptTermId, string[]>,
  minimalAtomsById: Map<PromptTermId, string[]>,
  droppedTerms: string[],
  rotationSeed = 0
): KeptPromptAtom[] {
  let finalAtoms = [...atoms];
  const essentialLowToHigh = [...order].reverse().filter(id => ESSENTIAL_TERM_IDS.has(id));

  // Stage 1: essential atoms -> short form, lowest priority essential first.
  if (promptLength(finalAtoms) > limit) {
    for (const id of essentialLowToHigh) {
      if (promptLength(finalAtoms) <= limit) break;
      const next = replaceTermWithForm(finalAtoms, id, shortAtomsById);
      if (next) finalAtoms = next;
    }
  }

  // Stage 2: drop non-essential filler, lowest priority first — guaranteed-minimum categories excluded (see stage 2.5).
  if (promptLength(finalAtoms) > limit) {
    finalAtoms = dropNonEssentialLowestFirst(finalAtoms, limit, order, droppedTerms, GUARANTEED_MINIMUM_TERM_IDS);
  }

  // Stage 2.5: guaranteed-minimum categories -> floor atom counts, not a full drop.
  if (promptLength(finalAtoms) > limit) {
    const reducedNarrative = reduceGenreNarrativeToFloor(finalAtoms, GENRE_NARRATIVE_FLOOR_ATOMS, rotationSeed);
    if (promptLength(reducedNarrative) < promptLength(finalAtoms)) finalAtoms = reducedNarrative;
  }
  const floorSteps: [PromptTermId, number][] = [
    ['concept', CONCEPT_FLOOR_ATOMS],
    ['earworm', EARWORM_FLOOR_ATOMS],
    ['instruments', INSTRUMENTS_FLOOR_ATOMS],
    ['mood', MOOD_FLOOR_ATOMS]
  ];
  for (const [id, floor] of floorSteps) {
    if (promptLength(finalAtoms) <= limit) break;
    const reduced = reduceToFloorCount(finalAtoms, id, floor);
    if (promptLength(reduced) < promptLength(finalAtoms)) finalAtoms = reduced;
  }

  // Stage 3: still over budget — essential atoms -> minimal form. Tried
  // before the last-resort drop below for the same reason stage 1 runs
  // before stage 2: shrinking an essential atom further loses less real
  // content than fully deleting a guaranteed-minimum category's last
  // remaining floor atom (e.g. earworm's single-atom floor, v3.15).
  if (promptLength(finalAtoms) > limit) {
    for (const id of essentialLowToHigh) {
      if (promptLength(finalAtoms) <= limit) break;
      const next = replaceTermWithForm(finalAtoms, id, minimalAtomsById);
      if (next) finalAtoms = next;
    }
  }

  // Stage 4 (last resort): still over budget even at minimal essential
  // forms — guaranteed-minimum remnants become droppable like anything else.
  if (promptLength(finalAtoms) > limit) {
    finalAtoms = dropNonEssentialLowestFirst(finalAtoms, limit, order, droppedTerms, new Set());
  }

  // Stage 5 (escape): caller adds STYLE_PROMPT_OVER_LIMIT_WARNING if still
  // over limit; never throws, never loops further.
  return finalAtoms;
}

/**
 * TASK F5 (v3.7) regression fix — this used to cut whatever came next once
 * the running length crossed `limit`, with no idea which atoms were
 * essential. That was "safe by accident" only because the old
 * PROMPT_PRIORITY order happened to put every essential id first; reordering
 * PROMPT_PRIORITY to genre -> mood -> vocal -> ... (TASK F2) exposed the
 * latent bug immediately: at a tight limit (e.g. the 200-char legacy
 * preset), genre+mood atoms alone can eat the whole budget, silently
 * guillotining the hook/vocal/money-chord/duration atoms that show up
 * later in iteration order even though they're essential. Essential atoms
 * must never be hard-dropped here — only non-essential ones are candidates,
 * same guarantee the SAFE_TARGET soft-check already makes upstream.
 */
/**
 * v3.56 — a narrow earworm-only exemption at this early stage originally
 * (and the matching one in composeStylePrompt's own safeTarget greedy fill
 * below), NOT the full GUARANTEED_MINIMUM_TERM_IDS set: concept/instruments/
 * genreNarrative sit at higher priority positions and already survive this
 * stage naturally, and giving them the same early exemption over-protects
 * them at very tight budgets (a real regression: TASK v3.55's own test
 * expects 'concept' fully droppable before genreSignature's short form is
 * even needed).
 *
 * v3.58 — 'mood' added: it sits at priority position 14, AFTER earworm(10)
 * (TASK v3.48.1 moved introTexture/tempo/arrangementDensity/instruments/
 * hookDevice ahead of both), so it's just as exposed to being excluded here
 * before compressHardLimitWithGuard's own floor-protection (stage 2.5) ever
 * runs — purely because cumulative length already passed budget by the
 * time its low priority position comes up. This went unnoticed while
 * 'mood' only ever carried a couple of short genre-flavor words, but TASK
 * 4's audience-profile constraints (types.ts's AudienceProfile,
 * data/audienceProfiles.ts) made it long enough to actually get excluded
 * here in practice — measured as 'mood' appearing in promptDroppedTerms for
 * every song in a real senior-channel pack, silently dropping the audience
 * constraints this task exists to guarantee.
 */
const GUARANTEED_FLOOR_BY_ID: Partial<Record<PromptTermId, number>> = {
  earworm: EARWORM_FLOOR_ATOMS,
  killingPoint: KILLING_POINT_FLOOR_ATOMS,
  openingHook: OPENING_HOOK_FLOOR_ATOMS,
  openingLoudness: OPENING_LOUDNESS_FLOOR_ATOMS
};

export function enforceHardLimit(
  atoms: KeptPromptAtom[],
  limit: number = SUNO_STYLE_LIMIT
): { atoms: KeptPromptAtom[]; dropped: KeptPromptAtom[] } {
  const kept: KeptPromptAtom[] = [];
  const dropped: KeptPromptAtom[] = [];
  let currentLength = 0;
  const guaranteedKeptCount = new Map<PromptTermId, number>();

  for (const atom of atoms) {
    const essential = ESSENTIAL_TERM_IDS.has(atom.id);
    const floor = GUARANTEED_FLOOR_BY_ID[atom.id];
    const withinGuaranteedFloor = floor !== undefined && (guaranteedKeptCount.get(atom.id) ?? 0) < floor;
    const projected = currentLength + (currentLength ? 2 : 0) + atom.text.length;
    if (!essential && !withinGuaranteedFloor && projected > limit) {
      dropped.push(atom);
      continue;
    }
    kept.push(atom);
    currentLength = projected;
    if (withinGuaranteedFloor) guaranteedKeptCount.set(atom.id, (guaranteedKeptCount.get(atom.id) ?? 0) + 1);
  }

  return { atoms: kept, dropped };
}

export function composeStylePrompt(
  parts: PromptPart[],
  limit: number = SUNO_COPY_LIMIT,
  safeTarget: number = SUNO_COPY_LIMIT,
  priorityOrder: PromptTermId[] = PROMPT_PRIORITY,
  /** TASK v3.58 (TASK 7-4) — rotates which genreNarrative clauses survive floor-reduction (see reduceGenreNarrativeToFloor); pass the track's own index/trackNo so different tracks under budget pressure don't all keep the same 2 clauses. */
  rotationSeed = 0
): StylePromptResult {
  const order = [...new Set([...priorityOrder, ...PROMPT_PRIORITY])];
  const atomsById = new Map<PromptTermId, string[]>();
  const shortAtomsById = new Map<PromptTermId, string[]>();
  const minimalAtomsById = new Map<PromptTermId, string[]>();
  // TASK v3.59 (TASK C-8) — atom *count* was never the real problem (15
  // essential/guaranteed-minimum categories is a reasonable number); atom
  // *length* is — e.g. "Verse stays in a straight 4/4 pop feel with
  // sustained piano pads and clean strummed acoustic" is one atom at 15
  // words. Purely diagnostic (never drops or rewrites content, never blocks
  // generation): flags any atom over ATOM_WORD_CAP words that has no
  // authored shortForm to fall back to, so the actual fix (shortening that
  // atom's own source text, or authoring a shortForm for it) is visible and
  // attributable instead of silently contributing to prompt bloat.
  const longAtomWarnings: string[] = [];
  for (const part of parts) {
    const atoms = splitAtoms(part.text);
    if (!atoms.length) continue;
    atomsById.set(part.id, [...(atomsById.get(part.id) || []), ...atoms]);
    const shortAtoms = shortFormAtomsFor(part, atoms);
    if (shortAtoms.length) {
      shortAtomsById.set(part.id, [...(shortAtomsById.get(part.id) || []), ...shortAtoms]);
    }
    const minimalAtoms = minimalFormAtomsFor(part, atoms);
    if (minimalAtoms.length) {
      minimalAtomsById.set(part.id, [...(minimalAtomsById.get(part.id) || []), ...minimalAtoms]);
    }
    if (!shortAtoms.length) {
      for (const atom of atoms) {
        const wordCount = countWords(atom);
        if (wordCount > ATOM_WORD_CAP) {
          const preview = atom.length > 40 ? `${atom.slice(0, 40)}...` : atom;
          longAtomWarnings.push(`원자 '${preview}' 가 ${wordCount}단어 (id: ${part.id}) — shortForm 미작성`);
        }
      }
    }
  }

  const seen = new Set<string>();
  for (const id of order) {
    const atoms = atomsById.get(id);
    if (!atoms) continue;
    atomsById.set(id, atoms.filter(atom => {
      const key = normalizeAtomKey(atom);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }
  for (const id of order) {
    const atoms = shortAtomsById.get(id);
    if (!atoms) continue;
    const seenShortAtoms = new Set<string>();
    shortAtomsById.set(id, atoms.filter(atom => {
      const key = normalizeAtomKey(atom);
      if (seenShortAtoms.has(key)) return false;
      seenShortAtoms.add(key);
      return true;
    }).slice(0, 3));
  }
  for (const id of order) {
    const atoms = minimalAtomsById.get(id);
    if (!atoms) continue;
    const seenMinimalAtoms = new Set<string>();
    minimalAtomsById.set(id, atoms.filter(atom => {
      const key = normalizeAtomKey(atom);
      if (seenMinimalAtoms.has(key)) return false;
      seenMinimalAtoms.add(key);
      return true;
    }).slice(0, 2));
  }

  const nonEssentialIds = order.filter(id => !ESSENTIAL_TERM_IDS.has(id));
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
  const warnings: string[] = [...longAtomWarnings];
  const keptAtoms: KeptPromptAtom[] = [];
  let currentLength = 0;
  // v3.56 — GUARANTEED_MINIMUM_TERM_IDS's whole point is that a category
  // (earworm, mood, instruments, ...) never hits zero, but this greedy
  // safeTarget-ordered fill ran before that guarantee existed and can still
  // exclude a category's atoms entirely if cumulative length already passed
  // safeTarget by the time its turn comes up — the actual mechanism this
  // caused: earworm (priority position 10, behind introTexture/tempo/
  // arrangementDensity/instruments/hookDevice per TASK v3.48.1's reordering)
  // never even reached compressHardLimitWithGuard's own floor-protection
  // because it was already gone here. Let each guaranteed-minimum category's
  // first `floor` atoms through regardless of safeTarget, same as essential
  // atoms, so the floor guarantee is real from this first pass onward.
  const guaranteedKeptCount = new Map<PromptTermId, number>();

  for (const id of order) {
    const atoms = atomsById.get(id);
    if (!atoms || !atoms.length) continue;
    const essential = ESSENTIAL_TERM_IDS.has(id);
    const floor = GUARANTEED_FLOOR_BY_ID[id];
    for (const atom of atoms) {
      const projected = currentLength + (currentLength ? 2 : 0) + atom.length;
      const withinGuaranteedFloor = floor !== undefined && (guaranteedKeptCount.get(id) ?? 0) < floor;
      if (!essential && !withinGuaranteedFloor && projected > safeTarget) {
        addDroppedLabel(droppedTerms, id);
        continue;
      }
      keptAtoms.push({ id, text: atom });
      currentLength = projected;
      if (withinGuaranteedFloor) guaranteedKeptCount.set(id, (guaranteedKeptCount.get(id) ?? 0) + 1);
    }
  }

  const hardLimited = enforceHardLimit(keptAtoms, limit);
  for (const dropped of hardLimited.dropped) addDroppedLabel(droppedTerms, dropped.id);

  // TASK F3 (v3.7) — char budget alone doesn't guarantee a Suno-friendly tag
  // count; a prompt can sit comfortably under 1,000 characters and still be
  // 100+ words. Once under the char limit, drop non-essential atoms lowest
  // priority first (reverse PROMPT_PRIORITY order) until the word count is
  // back at or under STYLE_WORD_TARGET_MAX, or nothing non-essential is left.
  //
  // TASK H1 (v3.13) — mood/instruments (GUARANTEED_MINIMUM_TERM_IDS) are
  // exempted from this full-category drop: they're reduced to a floor atom
  // count instead, only after every other non-essential/non-guaranteed
  // category has already been dropped entirely. This is what makes genre
  // selection actually audible — before this, mood/instruments were dropped
  // to zero every time the (unreachable) 30-word target was in effect.
  let finalAtoms = compressHardLimitWithGuard(hardLimited.atoms, limit, order, shortAtomsById, minimalAtomsById, droppedTerms, rotationSeed);
  const wordCountOf = (atoms: KeptPromptAtom[]) => countWords(atoms.map(atom => atom.text).join(', '));

  function reduceToFloor(atoms: KeptPromptAtom[], id: PromptTermId, floor: number): KeptPromptAtom[] {
    let kept = 0;
    return atoms.filter(atom => {
      if (atom.id !== id) return true;
      kept += 1;
      return kept <= floor;
    });
  }

  if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
    // Step 1: fully drop non-essential, non-guaranteed-minimum categories,
    // lowest priority first.
    for (let i = order.length - 1; i >= 0 && wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX; i -= 1) {
      const id = order[i];
      if (ESSENTIAL_TERM_IDS.has(id) || GUARANTEED_MINIMUM_TERM_IDS.has(id)) continue;
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

    // Step 1.5 (v3.47 Step 4): keep the lead-genre narrative's core clauses
    // before trimming older soft-target preference details.
    if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
      finalAtoms = reduceGenreNarrativeToFloor(finalAtoms, GENRE_NARRATIVE_FLOOR_ATOMS, rotationSeed);
    }
    // Keep custom concept influence audible in normal prompts, but only as
    // compact cues under the soft word budget. It remains non-essential
    // for the hard 1,000-character budget.
    if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
      finalAtoms = reduceToFloor(finalAtoms, 'concept', CONCEPT_FLOOR_ATOMS);
    }
    // Step 1.6 (v3.15): still over budget, reduce earworm down to its floor
    // ahead of instruments/mood.
    if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
      finalAtoms = reduceToFloor(finalAtoms, 'earworm', EARWORM_FLOOR_ATOMS);
    }
    // Step 2: still over budget — reduce instruments down to its floor (never to zero).
    if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
      finalAtoms = reduceToFloor(finalAtoms, 'instruments', INSTRUMENTS_FLOOR_ATOMS);
    }
    // Step 3: still over budget — reduce mood down to its floor (never to zero).
    if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
      finalAtoms = reduceToFloor(finalAtoms, 'mood', MOOD_FLOOR_ATOMS);
    }
    // Step 4 — if still over budget here (routine at STYLE_WORD_TARGET_MAX=35,
    // since essential atoms alone measured 32-40 words even before TASK 7-2
    // lowered the target — see this file's own TASK H1 comment above), the
    // remaining excess is inside the essential/guaranteed-minimum atoms
    // themselves. Left as a soft overage rather than truncating essential
    // text — hook/vocal/moneyChord/genre must never be cut, and the real
    // hard limit (SUNO_STYLE_LIMIT, enforced above by enforceHardLimit) is
    // character-based and already protected regardless.
    //
    // TASK v3.58 (TASK 7-3) — this used to pass through with no signal at
    // all: composeStylePrompt's own caller (localGenerator.ts) never saw
    // that the essential/floor atoms alone couldn't fit the target, so a
    // real 18-song pack could carry this overage on every single track with
    // zero warnings anywhere (song.warnings stayed empty — see TASK 6's own
    // auditAlbum, built specifically because qualityScore/warnings weren't
    // catching this class of issue). Surfaced explicitly now instead of
    // staying silent.
    if (wordCountOf(finalAtoms) > STYLE_WORD_TARGET_MAX) {
      addWarning(warnings, `보호 원자만으로 ${wordCountOf(finalAtoms)}단어 (목표 ${STYLE_WORD_TARGET_MAX}) — 원자 자체가 너무 길다`);
    }
  }

  const prompt = finalAtoms.map(atom => atom.text).join(', ');
  const wordCount = countWords(prompt);
  if (prompt.length > limit) {
    addWarning(warnings, limit === SUNO_COPY_LIMIT
      ? STYLE_PROMPT_OVER_LIMIT_WARNING
      : `스타일 프롬프트가 ${limit}자를 초과합니다 - 수동 확인 필요`);
  }
  return {
    prompt,
    length: prompt.length,
    withinLimit: prompt.length <= limit,
    wordCount,
    withinWordTarget: wordCount <= STYLE_WORD_TARGET_MAX,
    droppedTerms,
    warnings
  };
}
