import type { PlaylistBlueprint, ThumbnailSpec } from '../types';

function thumbnailSpecMarkdown(spec?: ThumbnailSpec) {
  if (!spec) return '';
  return `## Thumbnail Spec

Headline: ${spec.headline.replace('\n', ' / ')}

Subline: ${spec.subline}

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

export function exportMarkdown(blueprint: PlaylistBlueprint, thumbnailSpec?: ThumbnailSpec) {
  return `# ${blueprint.projectTitle}

Channel: ${blueprint.channelName}

Concept: ${blueprint.oneLineConcept}

Sonic Signature: ${blueprint.sonicSignature}

Vocal Signature: ${blueprint.vocalSignature}

${thumbnailSpecMarkdown(thumbnailSpec)}${blueprint.songs.map(song => `## ${song.trackNo}. ${song.title}

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

export function exportJson(blueprint: PlaylistBlueprint, thumbnailSpec?: ThumbnailSpec) {
  return JSON.stringify(thumbnailSpec ? { ...blueprint, thumbnailSpec } : blueprint, null, 2);
}

export function exportCsv(blueprint: PlaylistBlueprint) {
  const rows = [
    [
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
      'lyrics'
    ]
  ];

  for (const song of blueprint.songs) {
    rows.push([
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
      song.lyrics
    ]);
  }

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
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
