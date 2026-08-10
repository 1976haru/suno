/**
 * TASK v3.60 (TASK A) — a real bridge-path pack (an external coding agent
 * writing songs-output.json, then imported) sang its own arrangement/
 * production instructions as if they were lyrics: "Spiccato strings
 * flicker over quiet water", "The straight-pop drums move softly", "Now
 * the stop-time opens brighter". The agent was told (correctly) to weave
 * introTextureText/instrumentSet/arrangementDensity/hookDeviceText/
 * moneyChordText verbatim into the *style prompt* — nothing told it those
 * same words could never appear as the grammatical subject of a *lyric*
 * line. This is the shared vocabulary both the bridge instruction (a
 * prohibition list) and the import-time guard (core/lyricVocabularyGuard.ts)
 * draw from, so the two stay in sync by construction instead of by copy.
 *
 * Deliberately narrow and instrument/technique/production-specific, NOT a
 * list of "words that could ever appear in an arrangement description" —
 * ordinary objects a real bridge pack sings about legitimately (radio,
 * record, lamp, letter, coffee) are never included, and words with a
 * common, unrelated lyric meaning (e.g. "voice") are deliberately left out
 * even though a stricter list would catch a few more real leaks, because
 * the false-positive cost (flagging "I hear your voice" as an arrangement
 * leak) is worse than the occasional miss — see this task's own explicit
 * "장면 구체성 후퇴 금지" requirement.
 */
export const ARRANGEMENT_VOCABULARY: string[] = [
  // Instruments / instrument families
  'guitar', 'guitars', 'piano', 'pianos', 'drum', 'drums', 'bass', 'strings', 'string',
  'horn', 'horns', 'brass', 'percussion', 'organ', 'synth', 'synths', 'pad', 'pads',
  'tambourine', 'wurlitzer', 'rhodes', 'mandolin', 'trombone', 'trumpet', 'saxophone',
  'sax', 'cello', 'violin', 'violins', 'clarinet', 'flute', 'harp', 'banjo', 'ukulele',
  'keys', 'keyboard', 'snare', 'cymbal', 'cymbals', 'hi-hat', 'kick', 'toms', 'band',

  // Playing technique / performance-direction terms
  'fingerpicked', 'strummed', 'strum', 'strums', 'spiccato', 'pizzicato', 'comping', 'arpeggio',
  'glissando', 'staccato', 'legato', 'vibrato', 'tremolo', 'rubato',

  // Arrangement / production / mix terms
  'stop-time', 'breakdown', 'key-lift', 'arrangement', 'downbeat', 'backbeat',
  'double-tracked', 'backing vocal', 'backing vocals', 'tape saturation', 'reverb',
  'compression', 'sidechain', 'mixdown', 'mastering', 'crossfade', 'groove'
];

/**
 * Motion/state verbs that, immediately following an arrangement-vocabulary
 * noun, make that noun the line's grammatical subject/agent — i.e. the
 * line describes what the *instrument* is doing, not what a *person* is
 * doing. This is the signal that separates "The strummed guitar keeps
 * walking" (forbidden — the guitar is the actor) from "I hold my father's
 * guitar" (fine — a person is the actor, the instrument is just an object).
 */
export const ARRANGEMENT_SUBJECT_VERBS: string[] = [
  'move', 'moves', 'moved', 'open', 'opens', 'opened', 'climb', 'climbs', 'climbed',
  'enter', 'enters', 'entered', 'fall', 'falls', 'fell', 'answer', 'answers', 'answered',
  'rise', 'rises', 'rose', 'risen', 'walk', 'walks', 'walked', 'hit', 'hits',
  'drop', 'drops', 'dropped', 'keep', 'keeps', 'kept', 'sing', 'sings', 'sang',
  'play', 'plays', 'played', 'sway', 'sways', 'swayed', 'swell', 'swells', 'swelled',
  'pulse', 'pulses', 'pulsed', 'drive', 'drives', 'drove', 'lead', 'leads', 'led',
  'carry', 'carries', 'carried', 'echo', 'echoes', 'echoed', 'fade', 'fades', 'faded',
  'build', 'builds', 'built', 'lift', 'lifts', 'lifted', 'flicker', 'flickers', 'flickered',
  'hum', 'hums', 'hummed', 'shimmer', 'shimmers', 'shimmered', 'linger', 'lingers', 'lingered',
  'pick', 'picks', 'picked', 'start', 'starts', 'started', 'come', 'comes',
  'reply', 'replies', 'replied', 'remain', 'remains', 'remained', 'return', 'returns', 'returned',
  // v4.4 (TASK B) — 'hold' was missing even though a real bridge-imported
  // pack sang it as a leak ("You said, the string will hold it tight",
  // tests/fixtures/historical/bridge-import-sample.json): the string is the thing doing the
  // holding, same agency pattern as the verbs already above.
  'hold', 'holds', 'held'
];
