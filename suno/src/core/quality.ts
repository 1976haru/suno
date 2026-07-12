import type { SongIdea } from '../types';

const requiredPromptTerms = ['money chord', 'I-V-vi-IV', 'no long instrumental break'];
const requiredLyricTags = ['[verse', '[chorus', '[end]'];

export function scoreSong(song: SongIdea): SongIdea {
  const warnings: string[] = [];
  let score = 100;
  const prompt = song.stylePrompt.toLowerCase();
  const lyrics = song.lyrics.toLowerCase();

  for (const term of requiredPromptTerms) {
    if (!prompt.includes(term.toLowerCase())) {
      warnings.push(`Missing prompt term: ${term}`);
      score -= 8;
    }
  }

  for (const tag of requiredLyricTags) {
    if (!lyrics.includes(tag)) {
      warnings.push(`Missing lyric tag: ${tag}`);
      score -= 10;
    }
  }

  const wordCount = song.lyrics.split(/\s+/).filter(Boolean).length;
  if (wordCount > 260) {
    warnings.push('Lyrics may be too long for under-4-minute generation.');
    score -= 12;
  }
  if (wordCount < 90) {
    warnings.push('Lyrics may be too short for a complete pop song.');
    score -= 5;
  }

  const riskyNames = ['beatles', 'queen', 'adele', 'taylor swift', 'bts', 'iu', 'utada', 'yumi matsutoya'];
  if (riskyNames.some(name => prompt.includes(name) || lyrics.includes(name))) {
    warnings.push('Possible famous artist/reference risk. Remove direct artist references.');
    score -= 20;
  }

  return { ...song, qualityScore: Math.max(0, score), warnings };
}

export function scoreSongs(songs: SongIdea[]) {
  return songs.map(scoreSong);
}
