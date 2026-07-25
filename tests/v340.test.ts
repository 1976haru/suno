import { describe, expect, it } from 'vitest';
import { detectVocalGender, enforceVocalTextInStylePrompt, ensureVocalMetaTag, resolveVocalMetaTag } from '../src/core/vocalPlan';
import { containsBlockedStyleToken, sanitizeSunoStyleText } from '../src/core/sunoSafety';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildPackTracklist, buildPackVideoDescription, buildFfmpegPackVideoScript } from '../src/core/videoExport';
import { AI_DISCLOSURE_LINE, buildUploadChecklist, extractContentIdFlags, isMadeForKidsChannel } from '../src/core/exportCompliance';
import { lintChannelDiversity, type ChannelDiversitySample } from '../src/core/diversityLinter';
import { exportMarkdown, exportJson } from '../src/utils/exporters';
import { defaultPackagingLanguageForChannel } from '../src/core/packagingLanguage';
import { createInitialOptions } from '../src/utils/generation';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { SongIdea } from '../src/types';

const kidsChannel = channelPresets.find(c => c.archetype === 'kids')!;
const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;
const kidsGenres = genrePacks.filter(g => kidsChannel.preferredGenres.includes(g.id));
const kidsMoods = moodPacks.filter(m => kidsChannel.preferredMoods.includes(m.id));
const season = seasonPacks[0];

// TASK v3.40 — regression coverage for the v3.39.1 attack-test findings
// (H1-H5) plus the v3.40 monetization-readiness quality items (C1-C4,
// B1-B4, D1-D2).

describe('[Part H1] gender detection recognizes voice-range/pronoun terms, not just the original word list', () => {
  const femaleAttacks = ['warm alto voice, breathy delivery', 'soprano lead', 'mezzo-soprano tone', 'contralto warmth', 'chanteuse style', 'she sings softly'];
  const maleAttacks = ['deep baritone lead', 'clear tenor voice', 'he sings gently'];

  it.each(femaleAttacks)('detects female from voice-range/pronoun term: %s', text => {
    expect(detectVocalGender(text)).toBe('female');
  });

  it.each(maleAttacks)('detects male from voice-range/pronoun term: %s', text => {
    expect(detectVocalGender(text)).toBe('male');
  });

  it('a male-selected channel no longer ends up with a co-present female voice-range word', () => {
    const stylePrompt = 'showa-modern cafe mood, warm alto voice, breathy delivery, I-V-vi-IV progression';
    const selectedMale = 'mature soft male tenor, restrained emotional tone';
    const { text } = enforceVocalTextInStylePrompt(stylePrompt, selectedMale);
    expect(detectVocalGender(text)).toBe('male');
    expect(/\balto\b/i.test(text)).toBe(false);
  });

  it('does not false-positive on "alto sax" / "alto flute" (instruments, not a vocal descriptor)', () => {
    expect(detectVocalGender('bright alto sax solo, upbeat horns')).toBeNull();
    expect(detectVocalGender('soft alto flute intro')).toBeNull();
  });

  it('still never false-positives "female" as containing "male"', () => {
    expect(detectVocalGender('soft warm female alto, gentle breathy delivery')).toBe('female');
  });
});

describe('[Part H2] mixed/choir slots get corrected too, not skipped entirely', () => {
  it('strips a stray single-gender word from a stylePrompt targeting a kids choir', () => {
    const stylePrompt = "children's pop backing, deep male baritone lead, glockenspiel";
    const choirText = "children's choir of childlike, youthful voices singing together";
    const { text, changed } = enforceVocalTextInStylePrompt(stylePrompt, choirText);
    expect(changed).toBe(true);
    expect(detectVocalGender(text)).toBeNull();
    expect(text).toContain(choirText);
  });

  it('is still a no-op when there is no stray gender word to strip', () => {
    const stylePrompt = "children's pop backing, glockenspiel, upbeat";
    const choirText = "children's choir of childlike, youthful voices singing together";
    const { changed } = enforceVocalTextInStylePrompt(stylePrompt, choirText);
    expect(changed).toBe(false);
  });
});

describe('[Part H3] blocked-token matching survives whitespace/punctuation evasion', () => {
  it('detects a token split by a single space', () => {
    expect(containsBlockedStyleToken('some text with wa yo inside')).toBe(true);
  });

  it('detects a token split by punctuation', () => {
    expect(containsBlockedStyleToken('some text with wa-yo inside')).toBe(true);
  });

  it('still rejects a real word that merely contains the letters across a word break', () => {
    expect(containsBlockedStyleToken('the way older students left')).toBe(false);
  });

  it('still never matches a substring inside one longer word', () => {
    expect(containsBlockedStyleToken('waywayoward')).toBe(false);
  });

  it('sanitizeSunoStyleText also removes the spaced-evasion form', () => {
    const cleaned = sanitizeSunoStyleText('warm pop, wa yo, I-V-vi-IV progression');
    expect(containsBlockedStyleToken(cleaned)).toBe(false);
  });
});

describe('[Part H4/H5] local generation path gets the same lyric meta tag + quality scoring as every other path', () => {
  it('every locally generated song has a vocal meta tag at the top of its lyrics', () => {
    const opts = makeOptions({ channel: showaCafe, songCount: 3, seasonId: season.id });
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of bp.songs) {
      expect(/^\[(male vocal|female vocal|children'?s choir)\]/i.test(song.lyrics)).toBe(true);
    }
  });

  it('local generation runs scoreSongs (qualityScore is no longer always 0)', () => {
    const opts = makeOptions({ channel: showaCafe, songCount: 3, seasonId: season.id });
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of bp.songs) {
      expect(song.qualityScore).toBeGreaterThan(0);
    }
  });

  it('kids-channel local songs get [male vocal]/[female vocal]/["children\'s choir"] matching their vocalType', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'english', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, kidsGenres, kidsMoods, season);
    for (const song of bp.songs) {
      const expectedTag = resolveVocalMetaTag(song.vocalType, undefined);
      expect(song.lyrics.startsWith(expectedTag!)).toBe(true);
    }
  });
});

describe('[Part C1] kids titles never draw from the adult image-pair word pool', () => {
  const adultWords = ['Frost', 'Ember', 'Static', 'Velvet', 'Hollow', 'Glow', 'Echo', 'Dust'];

  it('0 adult words appear in 15 kids-channel titles', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'english', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, kidsGenres, kidsMoods, season);
    for (const song of bp.songs) {
      for (const word of adultWords) {
        expect(song.title.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });
});

describe('[Part C2] pack video description has a timestamped tracklist and no internal phrasing', () => {
  it('buildPackTracklist produces increasing 00:00-style timestamps', () => {
    const songs = [{ trackNo: 1, title: 'A' }, { trackNo: 2, title: 'B' }, { trackNo: 3, title: 'C' }];
    const tracks = buildPackTracklist(songs, 'under3m30');
    expect(tracks[0].timestamp).toBe('00:00');
    expect(tracks[1].startSeconds).toBeGreaterThan(tracks[0].startSeconds);
    expect(tracks.every(t => /^\d{1,2}:\d{2}(:\d{2})?$/.test(t.timestamp))).toBe(true);
  });

  it('buildPackVideoDescription includes every track timestamp and the AI disclosure line', () => {
    const opts = makeOptions({ channel: showaCafe, songCount: 3, seasonId: season.id });
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    const description = buildPackVideoDescription(bp, opts);
    expect(description).toContain('00:00');
    expect(description).toContain(AI_DISCLOSURE_LINE);
    for (const song of bp.songs) expect(description).toContain(song.title);
  });

  it('per-song YouTube descriptions no longer contain the internal dev-facing phrase', () => {
    const opts = makeOptions({ channel: showaCafe, songCount: 3, seasonId: season.id });
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of bp.songs) {
      expect(song.youtube.description).not.toContain('generated as original material');
      expect(song.youtube.description).toContain(AI_DISCLOSURE_LINE);
    }
  });

  it('buildFfmpegPackVideoScript never relies on one single static image for the whole video', () => {
    const opts = makeOptions({ channel: showaCafe, songCount: 3, seasonId: season.id });
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    const script = buildFfmpegPackVideoScript(bp, opts);
    expect((script.match(/zoompan/g) || []).length).toBe(3);
    expect((script.match(/images\/0[1-3]\.png/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('[Part C3/C4] kids channel packaging/season defaults are internally consistent', () => {
  it('an english-primaryLanguage kids channel defaults to english packaging, not market-derived korean', () => {
    expect(kidsChannel.primaryLanguage).toBe('english');
    expect(kidsChannel.market).toBe('korea');
    expect(defaultPackagingLanguageForChannel(kidsChannel)).toBe('english');
  });

  it('a non-kids channel is unaffected and still follows market', () => {
    expect(defaultPackagingLanguageForChannel(showaCafe)).toBe('japanese');
  });

  it('createInitialOptions no longer defaults the kids channel to the "christmas" season (adult "Cafe" label leak)', () => {
    const opts = createInitialOptions(kidsChannel);
    expect(opts.seasonId).not.toBe('christmas');
    expect(opts.packagingLanguage).toBe('english');
  });

  it('a non-kids channel keeps the christmas default (unchanged behavior)', () => {
    const opts = createInitialOptions(showaCafe);
    expect(opts.seasonId).toBe('christmas');
  });
});

describe('[Part B4] AI disclosure / Made-for-Kids flags and upload checklist', () => {
  it('isMadeForKidsChannel is true only for the kids archetype', () => {
    expect(isMadeForKidsChannel(kidsChannel)).toBe(true);
    expect(isMadeForKidsChannel(showaCafe)).toBe(false);
  });

  it('buildUploadChecklist always leads with the Made-for-Kids/COPPA item', () => {
    const checklist = buildUploadChecklist(kidsChannel);
    expect(checklist[0]).toMatch(/Made for Kids.*YES/i);
    const adultChecklist = buildUploadChecklist(showaCafe);
    expect(adultChecklist[0]).toMatch(/Made for Kids.*NO/i);
  });

  it('exportMarkdown includes the upload checklist and AI disclosure when a channel is provided', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 2, lyricLanguage: 'english', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, kidsGenres, kidsMoods, season);
    const md = exportMarkdown(bp, undefined, undefined, false, kidsChannel);
    expect(md).toContain('Upload Checklist');
    expect(md).toContain(AI_DISCLOSURE_LINE);
    expect(md).toContain('Made for Kids: YES');
  });

  it('exportJson includes an uploadCompliance block when a channel is provided', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 2, lyricLanguage: 'english', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, kidsGenres, kidsMoods, season);
    const parsed = JSON.parse(exportJson(bp, undefined, undefined, false, kidsChannel));
    expect(parsed.uploadCompliance.madeForKids).toBe(true);
    expect(parsed.uploadCompliance.aiDisclosure).toBe(AI_DISCLOSURE_LINE);
  });

  it('exportMarkdown/exportJson omit the compliance block when no channel is passed (backward compatible)', () => {
    const opts = makeOptions({ channel: showaCafe, songCount: 1, seasonId: season.id });
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    expect(exportMarkdown(bp)).not.toContain('Upload Checklist');
    expect(JSON.parse(exportJson(bp)).uploadCompliance).toBeUndefined();
  });
});

describe('[Part D2] Content ID flags are extracted from song warnings', () => {
  function song(warnings: string[]): Pick<SongIdea, 'warnings'> {
    return { warnings };
  }

  it('pulls out copyright/famous-artist/imitation warnings specifically', () => {
    const flags = extractContentIdFlags(song([
      'Copyright risk: remove existing-song, cover, melody, or lyric references.',
      'Missing prompt term: chorus',
      'Famous artist reference risk: remove direct artist names.'
    ]));
    expect(flags).toHaveLength(2);
  });

  it('returns an empty list when there is nothing to flag', () => {
    expect(extractContentIdFlags(song(['Missing prompt term: chorus']))).toHaveLength(0);
  });
});

describe('[Part B2] channel-level diversity linter warns on real template repetition', () => {
  function sample(overrides: Partial<ChannelDiversitySample>): ChannelDiversitySample {
    return { packId: 'p', songTitles: ['One Two', 'Three Four'], oneLineConcept: 'concept', ...overrides };
  }

  it('does not warn below the minimum pack-count threshold', () => {
    const samples = [sample({ thumbnailBackground: '#111' }), sample({ thumbnailBackground: '#111' })];
    const report = lintChannelDiversity(samples);
    expect(report.passed).toBe(true);
    expect(report.warnings).toHaveLength(0);
  });

  it('warns when the same thumbnail background repeats across most of a large-enough sample', () => {
    const samples = Array.from({ length: 5 }, () => sample({ thumbnailBackground: '#111111' }));
    const report = lintChannelDiversity(samples);
    expect(report.passed).toBe(false);
    expect(report.findings.some(f => f.category === 'thumbnailColor')).toBe(true);
  });

  it('does not warn when thumbnail backgrounds actually vary', () => {
    const colors = ['#111', '#222', '#333', '#444', '#555'];
    const samples = colors.map(c => sample({ thumbnailBackground: c }));
    const report = lintChannelDiversity(samples);
    expect(report.findings.some(f => f.category === 'thumbnailColor')).toBe(false);
  });

  it('warns when the pack concept line is identical across most packs (unedited channel.promise default)', () => {
    const samples = Array.from({ length: 6 }, () => sample({ oneLineConcept: 'same concept every time' }));
    const report = lintChannelDiversity(samples);
    expect(report.findings.some(f => f.category === 'concept')).toBe(true);
  });
});
