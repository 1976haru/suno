import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { composeStylePrompt, ESSENTIAL_TERM_IDS, PROMPT_PRIORITY, TERM_LABELS_KO } from '../src/core/promptBudget';
import { signatureMoneyChordId } from '../src/data/moneyChords';
import { channelPresets, genrePacks, makeOptions } from './fixtures';

const measuredChannelIds = [
  'good-morning-memory-radio',
  'morning-showa-cafe',
  'little-singalong-radio',
  'showa-seventies',
  'millennium-jpop'
];

function channelById(id: string) {
  const channel = channelPresets.find(item => item.id === id);
  if (!channel) throw new Error(`Missing test channel: ${id}`);
  return channel;
}

function genresForChannel(channelId: string) {
  const channel = channelById(channelId);
  return genrePacks.filter(genre => channel.preferredGenres.includes(genre.id));
}

function maxRun(ids: Array<string | undefined>): number {
  let max = 0;
  let current = 0;
  let previous: string | undefined;
  for (const id of ids) {
    if (id && id === previous) {
      current += 1;
    } else {
      current = id ? 1 : 0;
      previous = id;
    }
    max = Math.max(max, current);
  }
  return max;
}

function hookMomentTermKinds(text: string): Set<string> {
  const lower = text.toLowerCase();
  const kinds = new Set<string>();
  const checks: Array<[string, RegExp]> = [
    ['dropout', /\bdrop\s*out\b|\bdropout\b|backing drops|backing cuts/],
    ['stop', /stop-time|stop time|one-beat pause|one beat|band silent/],
    ['octave', /octave|higher echo|jumps up/],
    ['key', /key change|modulat|semitone/],
    ['answer', /answer riff|answers back|call and response|answer-back|answer phrase/],
    ['double', /double-tracked|double tracked|third above|wider harmony/],
    ['halfTime', /half-time|half time/],
    ['fill', /drum fill|rising swell|swell/],
    ['breakdown', /breakdown|bridge strips|strips down/],
    ['tag', /a cappella|outro tag|final repeat/],
    ['clap', /handclap|clap pickup|first beat/]
  ];
  for (const [kind, pattern] of checks) {
    if (pattern.test(lower)) kinds.add(kind);
  }
  return kinds;
}

describe('[v3.48.1] narrative hook devices and opener chord variation', () => {
  it('assigns hook devices on every measured channel with at least 2 hook-moment term kinds', () => {
    for (const channelId of measuredChannelIds) {
      const channel = channelById(channelId);
      const genres = genresForChannel(channelId);
      const opts = makeOptions({
        channel,
        genreIds: channel.preferredGenres,
        moodIds: channel.preferredMoods,
        lyricLanguage: channel.primaryLanguage,
        songCount: 10
      });
      const slots = preallocateSongSlots(opts, genres);
      const hookDeviceSlots = slots.filter(slot => slot.hookDeviceText);
      const termKinds = hookMomentTermKinds(hookDeviceSlots.map(slot => slot.hookDeviceText).join(' '));

      expect(hookDeviceSlots.length, `${channelId}: hookDeviceSlots`).toBeGreaterThan(0);
      expect(new Set(hookDeviceSlots.map(slot => slot.hookDeviceId)).size, `${channelId}: distinct hook devices`).toBeGreaterThanOrEqual(2);
      expect(termKinds.size, `${channelId}: ${hookDeviceSlots.map(slot => slot.hookDeviceText).join(' | ')}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('limits money-chord runs to 2 and keeps the signature only as the first impression', () => {
    for (const channelId of measuredChannelIds) {
      const channel = channelById(channelId);
      const genres = genresForChannel(channelId);
      const opts = makeOptions({
        channel,
        genreIds: channel.preferredGenres,
        moodIds: channel.preferredMoods,
        lyricLanguage: channel.primaryLanguage,
        songCount: 15,
        moneyChordMode: 'default'
      });
      const slots = preallocateSongSlots(opts, genres);
      const moneyChordIds = slots.map(slot => slot.moneyChordId);
      const signature = signatureMoneyChordId(channel.archetype);

      expect(moneyChordIds[0], channelId).toBe(signature);
      expect(maxRun(moneyChordIds), `${channelId}: ${JSON.stringify(moneyChordIds)}`).toBeLessThanOrEqual(2);
      expect(moneyChordIds.slice(0, 3), channelId).not.toEqual([signature, signature, signature]);
    }
  });

  it('pins the prompt truncation priority for long custom style text', () => {
    const order = PROMPT_PRIORITY;
    expect(order.indexOf('vocal')).toBeLessThan(order.indexOf('genreNarrative'));
    expect(order.indexOf('genreNarrative')).toBeLessThan(order.indexOf('moneyChord'));
    expect(order.indexOf('moneyChord')).toBeLessThan(order.indexOf('introTexture'));
    expect(order.indexOf('introTexture')).toBeLessThan(order.indexOf('tempo'));
    expect(order.indexOf('tempo')).toBeLessThan(order.indexOf('arrangementDensity'));
    expect(order.indexOf('arrangementDensity')).toBeLessThan(order.indexOf('hookDevice'));
    expect(ESSENTIAL_TERM_IDS.has('hookDevice')).toBe(false);

    const customStyle = [
      'custom user style',
      'cinematic but restrained playlist identity',
      'polished channel-specific arrangement notes',
      'extra texture guidance for a long prompt stress case',
      'avoid flattening the lead melody into one generic phrase',
      'keep the chorus memorable without copying an existing song',
      'leave enough room for the planned vocal and tempo directives'
    ].join(', ');
    expect(customStyle.length).toBeGreaterThanOrEqual(300);

    const result = composeStylePrompt([
      { id: 'vocal', text: 'clear warm vocal' },
      { id: 'genreNarrative', text: 'Verse begins close, pre-chorus widens the harmony, chorus opens clearly, hook entry uses a breath before the downbeat, mix stays warm and focused' },
      { id: 'moneyChord', text: 'I-V-vi-IV progression, keep this progression present across the whole song' },
      { id: 'introTexture', text: 'electric piano intro texture, INTRO ONLY' },
      { id: 'tempo', text: '96 BPM' },
      { id: 'arrangementDensity', text: 'medium density bed' },
      { id: 'hookDevice', text: 'stop-time chorus accent before the hook' },
      { id: 'mood', text: customStyle }
    ], 420, 330);

    expect(result.length).toBeLessThanOrEqual(420);
    expect(result.prompt).toContain('clear warm vocal');
    expect(result.prompt).toContain('Verse begins close');
    expect(result.prompt).toContain('I-V-vi-IV progression');
    expect(result.prompt).toContain('electric piano intro texture');
    expect(result.prompt).toContain('96 BPM');
    expect(result.prompt).toContain('medium density bed');
    expect(result.prompt).not.toContain('stop-time chorus accent');
    expect(result.prompt).not.toContain('leave enough room for the planned vocal');
    expect(result.droppedTerms).toContain(TERM_LABELS_KO.hookDevice);
    expect(result.droppedTerms).toContain(TERM_LABELS_KO.mood);
    expect(result.droppedTerms).not.toContain(TERM_LABELS_KO.arrangementDensity);
  });
});
