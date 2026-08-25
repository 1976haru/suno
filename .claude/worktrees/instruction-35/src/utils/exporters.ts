import type { ChannelProfile, PlaylistBlueprint, SongIdea, SoundSignature, ThumbnailSpec } from '../types';
import { AI_DISCLOSURE_LINE, buildUploadChecklist, extractContentIdFlags, isMadeForKidsChannel } from '../core/exportCompliance';
import { renderLyricsForDisplay } from '../core/lyricEngine';
import { buildExportMeta } from '../core/exportMeta';

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

function authorshipRecordLines(song: SongIdea): string[] {
  const contribution = song.humanContribution;
  const lines = [
    `AI assisted: ${song.aiAssisted ? 'true' : 'false'}`
  ];
  if (contribution) {
    lines.push(`Human contribution: ${contribution.summary}`);
    lines.push(`Edited line numbers: ${contribution.editedLineNumbers.join(', ') || 'none'}`);
    if (contribution.pronunciationHints) lines.push(`Pronunciation hints: ${contribution.pronunciationHints}`);
    if (contribution.arrangementNotes) lines.push(`Arrangement notes: ${contribution.arrangementNotes}`);
  } else if (song.humanEdits) {
    lines.push(`Human curation note: ${song.humanEdits}`);
  }
  return lines;
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
    // TASK v3.43 Step 3 (Part B2) — song.title already carries the "NN. "
    // display prefix by the time it reaches export (see utils/generation.ts's
    // applySetTitlePrefixesToBlueprint, applied earlier in the pipeline);
    // prepending trackNo again here doubled it to "01. 01. Creative Title".
    // Trust song.title as-is — including when the option was disabled and it
    // has no prefix at all, rather than inventing one this function never
    // controlled.
    song.title,
    // v4.3 (TASK A) — reference-only line, never part of the Suno-input
    // title above (see SongIdea.titleDisplay's own doc comment: a
    // parenthesized title must never be pasted into Suno's title field).
    ...(song.titleLocalized ? [`(Localized: ${song.titleLocalized})`] : []),
    '',
    '===== STYLE (Suno Style 필드) =====',
    song.stylePrompt,
    '',
    '===== LYRICS (Suno Lyrics 필드) =====',
    // TASK v3.70 (TASK D) — copy/display only; song.lyrics itself keeps its
    // exact hookPhrase match for core/quality.ts's checks.
    renderLyricsForDisplay(song.lyrics, song.hookPhrase),
    '',
    '===== EXCLUDE (Suno Exclude styles) =====',
    song.excludePrompt || '',
    '',
    '===== YOUTUBE =====',
    JSON.stringify(song.youtube, null, 2),
    ...(song.aiAssisted || song.humanContribution ? ['', '===== AUTHORSHIP RECORD =====', ...authorshipRecordLines(song)] : []),
    ...(song.humanEdits && !song.humanContribution ? ['', '===== HUMAN CURATION NOTE =====', song.humanEdits] : []),
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

function thumbnailMotionGuideMarkdown(spec: ThumbnailSpec): string {
  const guide = spec.motionGuide ?? {
    kenBurns: {
      direction: 'slow push-in',
      speed: '5-10 second loop source, or 105% zoom over 3 hours for a full playlist background',
      startFrame: 'wide frame with clean text-safe space',
      endFrame: 'slightly closer frame with text-safe space unchanged'
    },
    aiVideoPrompt: 'slow camera push-in, everything else static, seamless loop',
    loopAdvice: '5~10초 루프 클립을 만들어 반복하면 용량 부담 없이 자연스럽습니다. 가장 간단한 방법은 캡컷의 느린 줌(켄 번스)입니다.'
  };
  return `Motion Guide:

- Ken Burns direction: ${guide.kenBurns.direction}
- Ken Burns speed: ${guide.kenBurns.speed}
- Start frame: ${guide.kenBurns.startFrame}
- End frame: ${guide.kenBurns.endFrame}
- AI video prompt: ${guide.aiVideoPrompt}
- Loop advice: ${guide.loopAdvice}`;
}

function thumbnailSpecMarkdown(spec?: ThumbnailSpec) {
  if (!spec) return '';
  const selected = spec.variants.find(variant => variant.id === spec.selected) ?? spec.variants[0];
  const guide = spec.compositionGuide ?? {
    topSubcaption: '감성으로 듣는',
    mainPhrase: selected?.headline.replace('\n', ' ') || 'Playlist',
    subtitle: '감성 플레이리스트',
    bottomBrandLine: 'PLAYLIST',
    textColor: spec.colorScheme.text,
    shadowColor: 'rgba(0,0,0,0.45)',
    playerOverlay: false
  };
  const variantLines = spec.variants
    .map(v => `- ${v.id}안 (${v.angle})${v.id === spec.selected ? ' — 선택됨' : ''}: ${v.headline.replace('\n', ' / ')} / ${v.subline}`)
    .join('\n');
  return `## Thumbnail Spec

${variantLines}

Colors: background ${spec.colorScheme.background}, accent ${spec.colorScheme.accent}, text ${spec.colorScheme.text}

Objects: ${spec.objects.join(', ')}

Composition Guide:

- Top subcaption: ${guide.topSubcaption}
- Main phrase: ${guide.mainPhrase}
- Subtitle: ${guide.subtitle}
- Bottom brand line: ${guide.bottomBrandLine}
- Text color: ${guide.textColor}
- Shadow color: ${guide.shadowColor}
- Player UI overlay: ${guide.playerOverlay ? 'yes' : 'no'}

${thumbnailMotionGuideMarkdown(spec)}

Composition: ${spec.composition}

Forbidden: ${spec.forbidden.join('; ')}

Image Prompt:

\`\`\`text
${spec.imagePrompt}
\`\`\`

Midjourney Prompt:

\`\`\`text
${spec.imagePromptVariants.midjourney}
\`\`\`

Qwen Image Prompt:

\`\`\`text
${spec.imagePromptVariants.qwenImage ?? spec.imagePromptVariants.generic}
\`\`\`

Stable Diffusion Prompt:

\`\`\`text
${spec.imagePromptVariants.stableDiffusion}
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

/**
 * TASK v3.39.1 Part B4/D2 — an explicit pre-upload compliance section: AI
 * disclosure line + Made-for-Kids/COPPA/Suno-licensing checklist
 * (core/exportCompliance.ts), plus any Content ID (copyright/imitation/
 * famous-artist/blocked-token) flags scoreSong already raised, pulled out of
 * each song's mixed warnings list into their own explicit review item so
 * they can't be missed before publishing.
 */
function uploadComplianceMarkdown(blueprint: PlaylistBlueprint, channel?: ChannelProfile): string {
  if (!channel) return '';
  const contentIdFlags = blueprint.songs.flatMap(song => extractContentIdFlags(song).map(flag => `Track ${song.trackNo} (${song.title}): ${flag}`));
  const checklist = buildUploadChecklist(channel, contentIdFlags);
  return `## Upload Checklist

AI disclosure: ${AI_DISCLOSURE_LINE}

Made for Kids: ${isMadeForKidsChannel(channel) ? 'YES' : 'NO'}

${checklist.map(item => `- [ ] ${item}`).join('\n')}

`;
}

export function exportMarkdown(blueprint: PlaylistBlueprint, thumbnailSpec?: ThumbnailSpec, soundSignature?: SoundSignature, personaMode = false, channel?: ChannelProfile) {
  return `# ${blueprint.projectTitle}

Channel: ${blueprint.channelName}

Concept: ${blueprint.oneLineConcept}

Sonic Signature: ${blueprint.sonicSignature}

Vocal Signature: ${blueprint.vocalSignature}

${uploadComplianceMarkdown(blueprint, channel)}${soundSignatureMarkdown(soundSignature, personaMode)}${thumbnailSpecMarkdown(thumbnailSpec)}${blueprint.songs.map(song => `## ${song.trackNo}. ${song.titleDisplay ?? song.title}

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

### Exclude (Suno Exclude styles)

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
${song.aiAssisted || song.humanContribution ? `Authorship record:\n${authorshipRecordLines(song).map(line => `- ${line}`).join('\n')}\n` : ''}
${song.humanEdits && !song.humanContribution ? `Human curation note: ${song.humanEdits}\n` : ''}`).join('\n')}`;
}

export function exportJson(blueprint: PlaylistBlueprint, thumbnailSpec?: ThumbnailSpec, soundSignature?: SoundSignature, personaMode = false, channel?: ChannelProfile) {
  const uploadCompliance = channel
    ? {
      aiDisclosure: AI_DISCLOSURE_LINE,
      madeForKids: isMadeForKidsChannel(channel),
      checklist: buildUploadChecklist(channel, blueprint.songs.flatMap(song => extractContentIdFlags(song).map(flag => `Track ${song.trackNo} (${song.title}): ${flag}`)))
    }
    : undefined;
  // TASK (post-generation operation snapshot, TASK 5) — this pack's own real
  // GenerationSnapshot (when it has one) is the single source for
  // buildExportMeta's 9 new channelId/archetype/lyricLanguage/genreIds/
  // moodIds/moneyChordMode/vocalTone/songCount/preassignedSlotHash fields —
  // see that function's own doc comment. Undefined for a blueprint with no
  // snapshot (an old pack from before this task, or a display-only
  // synthetic blueprint), leaving those fields absent exactly as before.
  const snapshot = blueprint.generationSnapshot;
  const generationContext = snapshot ? { channel: snapshot.channel, options: snapshot.options, slots: snapshot.slots } : undefined;
  return JSON.stringify({
    // v4.0 (TASK C) — see core/exportMeta.ts's own doc comment. Spread
    // first so blueprint.generatedAt (v3.69, this set's own real generation
    // time) wins over buildExportMeta's "now" default for the same key.
    ...buildExportMeta(blueprint.generatedAt, snapshot?.workspaceId, generationContext),
    ...blueprint,
    ...(thumbnailSpec ? { thumbnailSpec } : {}),
    ...(soundSignature ? { soundSignature } : {}),
    personaMode,
    ...(uploadCompliance ? { uploadCompliance } : {})
  }, null, 2);
}

export function exportCsv(blueprint: PlaylistBlueprint, soundSignature?: SoundSignature, personaMode = false) {
  const rows = [
    [
      'personaMode',
      'personaName',
      'soundSignatureShort',
      'trackNo',
      'title',
      'titleLocalized',
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
      'humanEdits',
      'aiAssisted',
      'humanContribution',
      'pronunciationHints',
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
      song.titleLocalized || '',
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
      song.humanEdits || '',
      song.aiAssisted ? 'true' : 'false',
      song.humanContribution?.summary || '',
      song.japanesePronunciationHints || song.humanContribution?.pronunciationHints || '',
      song.stylePrompt,
      song.excludePrompt || '',
      song.lyrics
    ]);
  }

  // v4.0 (TASK C) — leading `#`-comment row (see core/exportMeta.ts's own
  // doc comment), not an extra column: this file has no re-import path
  // anywhere in this app (download-only, see exporters.test.ts), so there's
  // no fixed column-index consumer to break, and a comment row is the
  // simpler read for a human opening this in a spreadsheet.
  const meta = buildExportMeta(blueprint.generatedAt);
  const metaLine = `# appVersion=${meta.appVersion} schemaVersion=${meta.schemaVersion} commitSha=${meta.commitSha} builtAt=${meta.builtAt} workspaceId=${meta.workspaceId} generatedAt=${meta.generatedAt} exportFormatVersion=${meta.exportFormatVersion}`;
  return [metaLine, ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
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
