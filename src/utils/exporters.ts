import type { PlaylistBlueprint, SongIdea, SoundSignature, ThumbnailSpec } from '../types';

/**
 * TASK G2 (v3.7) — a single .txt per song, laid out so a phone user can open
 * one file and copy each of the three Suno fields (Style / Lyrics / Exclude)
 * without scrolling through a whole 30-song document. See zipExporter.ts for
 * the "TXT (곡별)" bulk download that zips 30 of these together.
 */
export function buildSongTxt(song: SongIdea): string {
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
    JSON.stringify(song.youtube, null, 2)
  ].join('\n');
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

Thumbnail: ${song.youtube?.thumbnailText || song.thumbnailText}

Quality: ${song.qualityScore}/100
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
      song.youtube?.thumbnailText || song.thumbnailText,
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
