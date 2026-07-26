const BPM_TEXT_PATTERN = /\b(?:around|about|approx(?:imately)?|circa|near)\s+\d{2,3}\s*bpm\b|\bbpm\s*\d{2,3}\s*(?:-|–|—|~|to)\s*\d{2,3}\b|\b\d{2,3}\s*(?:-|–|—|~|to)\s*\d{2,3}\s*bpm\b|\bbpm\s*\d{2,3}\b|\b\d{2,3}\s*bpm\b|\b(?:medium\s+to\s+upbeat|mid|medium|moderate|slow|fast|upbeat|down)[-\s]?tempo\b/gi;

function cleanAtom(atom: string): string {
  const cleaned = atom
    .replace(BPM_TEXT_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .trim();
  return /^[.]+$/.test(cleaned) ? '' : cleaned;
}

export function stripBpmText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .split(/[;,]/)
    .map(cleanAtom)
    .filter(Boolean)
    .join(', ');
}

export function enforceSingleBpmText(stylePrompt: string, tempo: number): string {
  const stripped = stripBpmText(stylePrompt);
  const bpm = `${tempo} BPM`;
  return stripped ? `${stripped}, ${bpm}` : bpm;
}

export function countBpmTextMentions(text: string): number {
  return text.match(BPM_TEXT_PATTERN)?.length ?? 0;
}
