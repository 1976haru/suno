import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import type { PlaylistBlueprint, SoundSignature, ThumbnailSpec } from '../types';

export interface DocxExportInput {
  blueprint: PlaylistBlueprint;
  thumbnailSpec?: ThumbnailSpec;
  soundSignature?: SoundSignature;
  personaMode?: boolean;
  generatedAt?: Date;
}

const MONO = 'Consolas';

function textRun(text: string, options: Record<string, unknown> = {}) {
  return new TextRun({ text, ...options });
}

function paragraph(text: string, options: Record<string, unknown> = {}) {
  return new Paragraph({ children: [textRun(text)], spacing: { after: 120 }, ...options });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function codeBox(label: string, text: string, charCount = text.length): (Paragraph | Table)[] {
  const lines = text.split('\n');
  return [
    paragraph(`${label} (${charCount} chars)`, { spacing: { before: 120, after: 60 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: 'F3F4F6' },
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              children: lines.map(line => new Paragraph({
                children: [new TextRun({ text: line || ' ', font: MONO, size: 20 })],
                spacing: { after: 40 }
              }))
            })
          ]
        })
      ]
    })
  ];
}

function thumbnailText(spec?: ThumbnailSpec) {
  if (!spec) return 'No thumbnail spec.';
  const variants = spec.variants.map(variant =>
    `${variant.id} (${variant.angle})${variant.id === spec.selected ? ' [selected]' : ''}: ${variant.headline.replace('\n', ' / ')} / ${variant.subline}`
  );
  return [
    ...variants,
    `Colors: background ${spec.colorScheme.background}, accent ${spec.colorScheme.accent}, text ${spec.colorScheme.text}`,
    `Objects: ${spec.objects.join(', ')}`,
    `Composition: ${spec.composition}`,
    `Generic image prompt: ${spec.imagePromptVariants.generic}`,
    `Midjourney prompt: ${spec.imagePromptVariants.midjourney}`,
    `Stable Diffusion prompt: ${spec.imagePromptVariants.stableDiffusion}`
  ].join('\n');
}

export function buildDocxPlainText({ blueprint, thumbnailSpec, soundSignature, personaMode, generatedAt = new Date() }: DocxExportInput): string {
  const date = generatedAt.toISOString().slice(0, 10);
  const signature = soundSignature?.short || blueprint.sonicSignature;
  const lines = [
    `${blueprint.channelName}  ${blueprint.projectTitle}`,
    `${blueprint.songs.length} songs  ${date}${soundSignature ? `  Persona: ${soundSignature.personaName}` : ''}`,
    '',
    'Sound Signature (for Suno Style field)',
    signature,
    `(${signature.length} chars)`,
    '',
    soundSignature ? `Persona Name\n${soundSignature.personaName}\n` : '',
    personaMode
      ? 'Persona workflow\n1. Generate track 1 with the seed prompt.\n2. If the result is good, use Make Persona in Suno.\n3. Generate tracks 2+ with that Persona selected.\n'
      : '',
    ...blueprint.songs.flatMap(song => [
      `${song.trackNo}. ${song.title}${song.trackNo === 1 ? '  [SEED TRACK]' : ''}`,
      `[Style Prompt] ${song.stylePrompt.length} chars`,
      song.stylePrompt,
      '[Lyrics]',
      song.lyrics,
      '[YouTube]',
      `Title: ${song.youtube?.title || ''}`,
      `Description: ${song.youtube?.description || ''}`,
      `Tags: ${(song.youtube?.tags || []).join(', ')}`,
      ''
    ]),
    'Thumbnail Spec',
    thumbnailText(thumbnailSpec)
  ];
  return lines.filter(line => line !== undefined).join('\n');
}

export function buildDocxDocument(input: DocxExportInput): Document {
  const { blueprint, thumbnailSpec, soundSignature, personaMode, generatedAt = new Date() } = input;
  const date = generatedAt.toISOString().slice(0, 10);
  const signature = soundSignature?.short || blueprint.sonicSignature;
  const children: (Paragraph | Table)[] = [
    heading(`${blueprint.channelName}  ${blueprint.projectTitle}`, HeadingLevel.TITLE),
    paragraph(`${blueprint.songs.length} songs  ${date}${soundSignature ? `  Persona: ${soundSignature.personaName}` : ''}`),
    heading('Sound Signature'),
    ...codeBox('Suno Style field', signature, signature.length)
  ];

  if (soundSignature) {
    children.push(heading('Persona Name'), ...codeBox('Persona name', soundSignature.personaName, soundSignature.personaName.length));
  }

  if (personaMode) {
    children.push(
      heading('Persona Workflow'),
      paragraph('1. Generate track 1 with the seed prompt.'),
      paragraph('2. If the result is good, use Make Persona in Suno.'),
      paragraph('3. Generate tracks 2+ with that Persona selected.')
    );
  }

  for (const song of blueprint.songs) {
    children.push(
      heading(`${song.trackNo}. ${song.title}${song.trackNo === 1 ? '  [SEED TRACK]' : ''}`),
      ...codeBox('Style Prompt', song.stylePrompt, song.stylePrompt.length),
      ...codeBox('Lyrics', song.lyrics, song.lyrics.length),
      paragraph('YouTube', { heading: HeadingLevel.HEADING_3 }),
      paragraph(`Title: ${song.youtube?.title || ''}`),
      paragraph(`Description: ${song.youtube?.description || ''}`),
      paragraph(`Tags: ${(song.youtube?.tags || []).join(', ')}`)
    );
  }

  children.push(heading('Thumbnail Spec'), ...codeBox('Thumbnail A/B/C and image prompts', thumbnailText(thumbnailSpec)));

  return new Document({
    creator: 'Suno Weaver Studio',
    title: blueprint.projectTitle,
    description: blueprint.oneLineConcept,
    sections: [{ properties: {}, children }]
  });
}

export async function exportDocxBlob(input: DocxExportInput): Promise<Blob> {
  return Packer.toBlob(buildDocxDocument(input));
}
