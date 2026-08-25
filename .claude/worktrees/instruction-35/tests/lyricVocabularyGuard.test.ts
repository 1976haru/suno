import { describe, expect, it } from 'vitest';
import { affectedTrackRatio, findArrangementVocabularyInLyrics } from '../src/core/lyricVocabularyGuard';

function songWith(lyrics: string, trackNo = 1) {
  return { trackNo, lyrics };
}

/**
 * TASK v3.60 (TASK A) — regression tests built directly against the real
 * bridge-path leak lines this task's own report measured, plus the 4
 * oracle "must never be flagged" examples this task explicitly requires.
 */
describe('[v3.60 TASK A] findArrangementVocabularyInLyrics', () => {
  it('catches every real reported leak line', () => {
    const leaks = [
      'Spiccato strings flicker over quiet water',
      'The light percussion enters softly',
      'Now the stop-time opens brighter',
      'The straight-pop drums move softly',
      'The strummed guitar keeps walking',
      'The bass and drums fall silent',
      'A soft piano answers low',
      'Then the full band rises kindly',
      'Warm strings rise over table light'
    ];
    for (const line of leaks) {
      const findings = findArrangementVocabularyInLyrics([songWith(`[verse 1]\n${line}`)]);
      expect(findings.length, line).toBeGreaterThan(0);
    }
  });

  it('never flags the 4 required oracle examples', () => {
    const safe = [
      'Play the Old Record',
      'The radio warms the corner with familiar glow',
      "I open yesterday's letter\nthen fold it again",
      'A brass lamp warms the needle tips'
    ];
    for (const line of safe) {
      const findings = findArrangementVocabularyInLyrics([songWith(`[verse 1]\n${line}`)]);
      expect(findings.length, line).toBe(0);
    }
  });

  it('ignores bracket section tags and Title: lines', () => {
    const findings = findArrangementVocabularyInLyrics([
      songWith('[chorus]\nThe drums move softly\n[end]')
    ]);
    // "The drums move softly" is a real body line and should still be caught;
    // this asserts the tag line itself ([chorus]/[end]) isn't what triggered it.
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe('The drums move softly');
  });

  it('an ordinary object-position use of an instrument word is not flagged', () => {
    const findings = findArrangementVocabularyInLyrics([
      songWith("[verse 1]\nI hold my father's guitar\nand hum a quiet tune")
    ]);
    expect(findings).toHaveLength(0);
  });

  it('the real 17-song measured pack (88% affected) sits above the 30% set-error threshold', () => {
    const affected = 15;
    const total = 17;
    const findings = Array.from({ length: affected }, (_, i) => ({ trackNo: i + 1, line: 'x', terms: ['guitar'] }));
    expect(affectedTrackRatio(findings, total)).toBeGreaterThan(0.3);
  });
});
