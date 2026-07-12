import type { ChannelProfile, SongIdea } from '../types';

const requiredPromptTerms = ['money chord', 'no long instrumental break'];
const requiredLyricTags = ['[verse', '[chorus', '[end]'];

const imitationPatterns = [
  /\bin the style of\b/i,
  /\bsounds like\b/i,
  /\bsoundalike\b/i,
  /\bas sung by\b/i,
  /\bvoice like\b/i,
  /\bsimilar to\b/i,
  /\bclone of\b/i,
  /\bcopy of\b/i,
  /처럼 부르는/,
  /목소리처럼/,
  /스타일로/,
  /특정 가수/,
  /가수.*모방/,
  /っぽく/,
  /風に/,
  /歌声.*似せ/
];

const copyrightPatterns = [
  /\bcover of\b/i,
  /\brewrite of\b/i,
  /\bmelody from\b/i,
  /\blyrics from\b/i,
  /\bsame melody\b/i,
  /\bsample of\b/i,
  /\binterpolation of\b/i,
  /\bplagiar/i,
  /저작권/,
  /표절/,
  /원곡/,
  /커버곡/,
  /기존곡/,
  /カバー/,
  /原曲/
];

const famousArtistNames = [
  'adele',
  'beatles',
  'beyonce',
  'bts',
  'bruno mars',
  'carpenters',
  'celine dion',
  'ed sheeran',
  'frank sinatra',
  'iu',
  'queen',
  'taylor swift',
  'the weekend',
  'utada',
  'yumi matsutoya',
  'ado',
  'yoasobi',
  'cho yong-pil',
  'na hoon-a',
  'lim young-woong',
  '아이유',
  '방탄소년단',
  '임영웅',
  '조용필',
  '나훈아',
  '松任谷由実',
  '宇多田ヒカル'
];

function collectSongText(song: SongIdea) {
  return [
    song.title,
    song.hookPhrase,
    song.stylePrompt,
    song.lyrics,
    song.thumbnailText,
    song.youtube?.title,
    song.youtube?.description,
    song.youtube?.tags?.join(' ')
  ].filter(Boolean).join('\n');
}

function pushUnique(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

export function scoreSong(song: SongIdea, channel?: ChannelProfile): SongIdea {
  const warnings: string[] = [...(song.warnings || [])];
  let score = 100;
  const text = collectSongText(song);
  const textLower = text.toLowerCase();
  const prompt = song.stylePrompt.toLowerCase();
  const lyrics = song.lyrics.toLowerCase();

  for (const term of requiredPromptTerms) {
    if (!prompt.includes(term.toLowerCase())) {
      pushUnique(warnings, `Missing prompt term: ${term}`);
      score -= 8;
    }
  }

  for (const tag of requiredLyricTags) {
    if (!lyrics.includes(tag)) {
      pushUnique(warnings, `Missing lyric tag: ${tag}`);
      score -= 10;
    }
  }

  const wordCount = song.lyrics.split(/\s+/).filter(Boolean).length;
  if (wordCount > 280) {
    pushUnique(warnings, 'Lyrics may be too long for controlled Suno generation.');
    score -= 12;
  }
  if (wordCount < 80) {
    pushUnique(warnings, 'Lyrics may be too short for a complete pop song.');
    score -= 5;
  }

  if (imitationPatterns.some(pattern => pattern.test(text))) {
    pushUnique(warnings, 'Artist imitation risk: remove singer/style-copy wording.');
    score -= 22;
  }

  if (copyrightPatterns.some(pattern => pattern.test(text))) {
    pushUnique(warnings, 'Copyright risk: remove existing-song, cover, melody, or lyric references.');
    score -= 22;
  }

  if (famousArtistNames.some(name => textLower.includes(name.toLowerCase()))) {
    pushUnique(warnings, 'Famous artist reference risk: remove direct artist names.');
    score -= 20;
  }

  for (const cliche of channel?.forbiddenCliches || []) {
    if (cliche && textLower.includes(cliche.toLowerCase())) {
      pushUnique(warnings, `Channel forbidden cliche detected: ${cliche}`);
      score -= 8;
    }
  }

  if (!song.youtube?.title || !song.youtube?.description || !song.youtube?.tags?.length) {
    pushUnique(warnings, 'YouTube metadata is incomplete.');
    score -= 8;
  }

  return { ...song, qualityScore: Math.max(0, score), warnings };
}

export function scoreSongs(songs: SongIdea[], channel?: ChannelProfile) {
  return songs.map(song => scoreSong(song, channel));
}
