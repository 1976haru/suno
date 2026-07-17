import type { PlaylistBlueprint, SongIdea, SoundSignature, ThumbnailSpec } from '../types';

/** TASK I5 (v3.11, PART D-2) — tracks 1-3 (cold-open + flagship) are the shorts-clip priority candidates, per the brief's "1~3번 곡이 제일 중요하다". */
export function isShortsClipCandidate(song: Pick<SongIdea, 'trackNo'>): boolean {
  return song.trackNo <= 3;
}

/**
 * TASK I5 (v3.11) — pulls the first [chorus] section's text out of a
 * generated lyrics block, for a ready-to-use shorts caption draft. Sections
 * are blank-line separated (see lyricEngine.ts's composeLyrics), so
 * splitting on a blank line and matching the tag line is enough; no audio
 * editing happens here or anywhere else in this app.
 */
export function extractChorusText(lyrics: string): string {
  const blocks = lyrics.split(/\n\s*\n/);
  const chorusBlock = blocks.find(block => block.trim().startsWith('[chorus]'));
  if (!chorusBlock) return '';
  return chorusBlock
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * TASK G2 (v3.7) — a single .txt per song, laid out so a phone user can open
 * one file and copy each of the three Suno fields (Style / Lyrics / Exclude)
 * without scrolling through a whole 30-song document. See zipExporter.ts for
 * the "TXT (곡별)" bulk download that zips 30 of these together.
 */
export function buildSongTxt(song: SongIdea): string {
  const chorus = extractChorusText(song.lyrics);
  return [
    `${song.trackNo.toString().padStart(2, '0')}. ${song.title}`,
    '',
    '===== STYLE (Suno Style 필드) =====',
    song.stylePrompt,
    '',
    '===== LYRICS (Suno Lyrics 필드) =====',
    song.lyrics,
    '',
    '===== EXCLUDE (Advanced Options -> Exclude Styles) =====',
    song.excludePrompt || '',
    '',
    '===== YOUTUBE =====',
    JSON.stringify(song.youtube, null, 2),
    ...(isShortsClipCandidate(song) && chorus
      ? [
        '',
        '===== 🎬 쇼츠 클립 우선 후보 =====',
        '이 곡의 후렴을 15~20초로 잘라 쇼츠로 올려보세요. 아래는 후렴 구간 캡션 초안입니다.',
        '',
        chorus
      ]
      : [])
  ].join('\n');
}

/** TASK v3.23 — the API no longer generates this (user makes thumbnails externally); shown only for old saved packs/songs that still have it, omitted entirely otherwise rather than printing an empty "Thumbnail:" line. */
function songThumbnailMarkdown(song: SongIdea): string {
  const text = song.youtube?.thumbnailText || song.thumbnailText;
  return text ? `Thumbnail: ${text}\n\n` : '';
}

function thumbnailSpecMarkdown(spec?: ThumbnailSpec) {
  if (!spec) return '';
  const variantLines = spec.variants
    .map(v => `- ${v.id}안 (${v.angle})${v.id === spec.selected ? ' — 선택됨' : ''}: ${v.headline.replace('\n', ' / ')} / ${v.subline}`)
    .join('\n');
  return `## Thumbnail Spec

${variantLines}

Colors: background ${spec.colorScheme.background}, accent ${spec.colorScheme.accent}, text ${spec.colorScheme.text}

Objects: ${spec.objects.join(', ')}

Composition: ${spec.composition}

Forbidden: ${spec.forbidden.join('; ')}

Image Prompt:

\`\`\`text
${spec.imagePrompt}
\`\`\`

`;
}

function soundSignatureMarkdown(soundSignature?: SoundSignature, personaMode = false) {
  if (!soundSignature) return '';
  return `Persona Mode: ${personaMode ? 'on' : 'off'}

Persona Name: ${soundSignature.personaName}

Sound Signature Short (${soundSignature.shortLength} chars):

\`\`\`text
${soundSignature.short}
\`\`\`

Sound Signature Full (${soundSignature.fullLength} chars):

\`\`\`text
${soundSignature.full}
\`\`\`

`;
}

export function exportMarkdown(blueprint: PlaylistBlueprint, thumbnailSpec?: ThumbnailSpec, soundSignature?: SoundSignature, personaMode = false) {
  return `# ${blueprint.projectTitle}

Channel: ${blueprint.channelName}

Concept: ${blueprint.oneLineConcept}

Sonic Signature: ${blueprint.sonicSignature}

Vocal Signature: ${blueprint.vocalSignature}

${soundSignatureMarkdown(soundSignature, personaMode)}${thumbnailSpecMarkdown(thumbnailSpec)}${blueprint.songs.map(song => `## ${song.trackNo}. ${song.title}

Situation: ${song.listenerSituation}

Emotion Arc: ${song.emotionArc}

### Style Prompt

\`\`\`text
${song.stylePrompt}
\`\`\`

### Lyrics

\`\`\`text
${song.lyrics}
\`\`\`

### Exclude (Advanced Options)

\`\`\`text
${song.excludePrompt || ''}
\`\`\`

### YouTube

Title: ${song.youtube?.title || ''}

Description:

\`\`\`text
${song.youtube?.description || ''}
\`\`\`

Tags: ${(song.youtube?.tags || []).join(', ')}

${songThumbnailMarkdown(song)}Quality: ${song.qualityScore}/100
Warnings: ${song.warnings.join('; ') || 'None'}
`).join('\n')}`;
}

export function exportJson(blueprint: PlaylistBlueprint, thumbnailSpec?: ThumbnailSpec, soundSignature?: SoundSignature, personaMode = false) {
  return JSON.stringify({ ...blueprint, ...(thumbnailSpec ? { thumbnailSpec } : {}), ...(soundSignature ? { soundSignature } : {}), personaMode }, null, 2);
}

export function exportCsv(blueprint: PlaylistBlueprint, soundSignature?: SoundSignature, personaMode = false) {
  const rows = [
    [
      'personaMode',
      'personaName',
      'soundSignatureShort',
      'trackNo',
      'title',
      'seasonMoment',
      'listenerSituation',
      'emotionArc',
      'hookPhrase',
      'youtubeTitle',
      'youtubeDescription',
      'youtubeTags',
      'thumbnailText',
      'qualityScore',
      'warnings',
      'stylePrompt',
      'excludePrompt',
      'lyrics'
    ]
  ];

  for (const song of blueprint.songs) {
    rows.push([
      personaMode ? 'true' : 'false',
      soundSignature?.personaName || '',
      soundSignature?.short || '',
      String(song.trackNo),
      song.title,
      song.seasonMoment,
      song.listenerSituation,
      song.emotionArc,
      song.hookPhrase,
      song.youtube?.title || '',
      song.youtube?.description || '',
      (song.youtube?.tags || []).join(', '),
      song.youtube?.thumbnailText || song.thumbnailText || '',
      String(song.qualityScore),
      song.warnings.join('; '),
      song.stylePrompt,
      song.excludePrompt || '',
      song.lyrics
    ]);
  }

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
