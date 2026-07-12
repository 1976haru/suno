import type { PlaylistBlueprint } from '../types';

export function exportMarkdown(blueprint: PlaylistBlueprint) {
  return `# ${blueprint.projectTitle}\n\nChannel: ${blueprint.channelName}\n\nConcept: ${blueprint.oneLineConcept}\n\nSonic Signature: ${blueprint.sonicSignature}\n\nVocal Signature: ${blueprint.vocalSignature}\n\n${blueprint.songs.map(song => `## ${song.trackNo}. ${song.title}\n\n### Style Prompt\n\n\`\`\`text\n${song.stylePrompt}\n\`\`\`\n\n### Lyrics\n\n\`\`\`text\n${song.lyrics}\n\`\`\`\n\nQuality: ${song.qualityScore}/100\nWarnings: ${song.warnings.join('; ') || 'None'}\n`).join('\n')}`;
}

export function exportJson(blueprint: PlaylistBlueprint) {
  return JSON.stringify(blueprint, null, 2);
}

export function exportCsv(blueprint: PlaylistBlueprint) {
  const rows = [
    ['trackNo', 'title', 'seasonMoment', 'listenerSituation', 'emotionArc', 'hookPhrase', 'thumbnailText', 'qualityScore', 'stylePrompt', 'lyrics']
  ];
  for (const song of blueprint.songs) {
    rows.push([
      String(song.trackNo), song.title, song.seasonMoment, song.listenerSituation, song.emotionArc, song.hookPhrase,
      song.thumbnailText, String(song.qualityScore), song.stylePrompt, song.lyrics
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
