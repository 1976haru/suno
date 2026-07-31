/**
 * TASK v3.64 (TASK E) — real measurement: a real 18-song pack's titles were
 * almost entirely a "[noun][noun]" shape (Firstlight Cup, Folded Frost,
 * Blue Kettle, Dewsteps, Paper Bag Sun, ...). This is a lighter-weight,
 * more semantic classifier than diversityLinter.ts's own titleShape()
 * (word-count + ampersand buckets, used for repeated-shape detection) —
 * a separate function rather than changing that one, since its buckets are
 * already relied on by existing repeatedTitleShapes tests.
 *
 * Not full part-of-speech tagging — a small curated leading-verb word list
 * plus word count, which is enough to tell "Wait by the Window" (verb-led)
 * apart from "Steam Radio" (two bare nouns) without a real NLP dependency.
 */
const TITLE_VERB_LEAD_WORDS = new Set([
  'wait', 'stay', 'hold', 'keep', 'wake', 'catch', 'turn', 'let', 'come', 'go', 'run', 'hear',
  'watch', 'dance', 'sing', 'remember', 'forget', 'believe', 'know', 'feel', 'see', 'find', 'love',
  'need', 'want', 'give', 'take', 'make', 'tell', 'ask', 'call', 'write', 'say', 'walk', 'fly',
  'fall', 'rise', 'shine', 'glow', 'hush', 'sleep', 'dream', 'smile', 'cry', 'laugh', 'breathe',
  'close', 'open', 'chase', 'follow', 'leave', 'return', 'reach'
]);

export type TitleShapeCategory = 'single-word' | 'noun-noun' | 'short-phrase' | 'verb-phrase' | 'long-phrase';

export function classifyTitleShape(title: string | undefined): TitleShapeCategory | '' {
  const trimmed = (title || '').trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  if (TITLE_VERB_LEAD_WORDS.has(firstWord)) return 'verb-phrase';
  if (words.length === 1) return 'single-word';
  if (words.length === 2) return 'noun-noun';
  if (words.length <= 4) return 'short-phrase';
  return 'long-phrase';
}

const MIN_TITLE_SHAPE_VARIETY = 3;

/** Warning-level only, per this task's own spec — never blocks, and never enforces any title/hook relationship. */
export function titleShapeVarietyWarning(titles: readonly (string | undefined)[]): string | undefined {
  const shapes = new Set(titles.map(classifyTitleShape).filter((shape): shape is TitleShapeCategory => Boolean(shape)));
  if (!shapes.size || shapes.size >= MIN_TITLE_SHAPE_VARIETY) return undefined;
  return `이 세트의 제목 형태가 ${shapes.size}종뿐입니다 (${[...shapes].join(', ')}) — 최소 ${MIN_TITLE_SHAPE_VARIETY}종 권장`;
}
