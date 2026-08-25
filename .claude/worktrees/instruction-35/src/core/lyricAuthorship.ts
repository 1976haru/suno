import type { HumanContributionRecord, SongIdea } from '../types';

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function comparableLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function buildHumanContributionRecord(
  aiDraftLyrics: string,
  editedLyrics: string,
  extras: Pick<HumanContributionRecord, 'pronunciationHints' | 'arrangementNotes'> = {}
): HumanContributionRecord {
  const originalLines = splitLines(aiDraftLyrics);
  const editedLines = splitLines(editedLyrics);
  const totalLineCount = Math.max(originalLines.length, editedLines.length);
  const editedLineNumbers: number[] = [];

  for (let index = 0; index < totalLineCount; index += 1) {
    if (comparableLine(originalLines[index] || '') !== comparableLine(editedLines[index] || '')) {
      editedLineNumbers.push(index + 1);
    }
  }

  const editedLineCount = editedLineNumbers.length;
  const editedLineRatio = totalLineCount ? editedLineCount / totalLineCount : 0;
  const summary = `User rewrote ${editedLineCount}/${totalLineCount} lyric lines (${percent(editedLineRatio)}). AI-assisted draft retained for comparison; no legal registration decision is made.`;

  return {
    aiDraftLyrics,
    editedLyrics,
    totalLineCount,
    editedLineCount,
    editedLineRatio,
    editedLineNumbers,
    summary,
    ...(extras.pronunciationHints ? { pronunciationHints: extras.pronunciationHints } : {}),
    ...(extras.arrangementNotes ? { arrangementNotes: extras.arrangementNotes } : {}),
    updatedAt: new Date().toISOString()
  };
}

export function applyLyricWorkspaceEdit(song: SongIdea, editedLyrics: string): SongIdea {
  const aiDraftLyrics = song.aiDraftLyrics ?? song.lyrics;
  const contribution = buildHumanContributionRecord(aiDraftLyrics, editedLyrics, {
    pronunciationHints: song.japanesePronunciationHints || song.humanContribution?.pronunciationHints,
    arrangementNotes: song.humanContribution?.arrangementNotes
  });
  return {
    ...song,
    lyrics: editedLyrics,
    aiDraftLyrics,
    aiAssisted: true,
    humanContribution: contribution,
    humanEdits: contribution.summary
  };
}

export function applyPronunciationHints(song: SongIdea, pronunciationHints: string): SongIdea {
  const aiDraftLyrics = song.aiDraftLyrics ?? song.lyrics;
  const contribution = buildHumanContributionRecord(aiDraftLyrics, song.lyrics, {
    pronunciationHints,
    arrangementNotes: song.humanContribution?.arrangementNotes
  });
  return {
    ...song,
    aiDraftLyrics,
    japanesePronunciationHints: pronunciationHints,
    aiAssisted: true,
    humanContribution: contribution,
    humanEdits: contribution.summary
  };
}

function rewriteLineDraft(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || /^\[.+\]$/.test(trimmed)) return line;
  if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(trimmed)) {
    return trimmed.replace(/[。！？!?]*$/, '、もう少しだけ。');
  }
  return trimmed.replace(/[.!?]*$/, ', just a little longer.');
}

export function regenerateSingleLyricLine(song: SongIdea, zeroBasedLineIndex: number): SongIdea {
  const lines = splitLines(song.lyrics);
  if (zeroBasedLineIndex < 0 || zeroBasedLineIndex >= lines.length) return song;
  const nextLine = rewriteLineDraft(lines[zeroBasedLineIndex]);
  if (nextLine === lines[zeroBasedLineIndex]) return song;
  lines[zeroBasedLineIndex] = nextLine;
  return applyLyricWorkspaceEdit(song, lines.join('\n'));
}
