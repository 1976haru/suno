import type { ThumbnailVariantId } from '../types';

const DB_NAME = 'suno-weaver-videos';
const DB_VERSION = 1;
const STORE = 'videos';

export interface VideoRecord {
  id: string;
  channelId: string;
  packId: string;
  weekNo: number;
  scheduledAt: string;

  videoTitle: string;
  thumbnailA: string;
  thumbnailB: string;
  thumbnailC: string;
  thumbnailUsed: ThumbnailVariantId | null;
  imagePrompt: string;
  colors: string[];
  seoKeywords: string[];

  /** Everything below this line is never written by this app automatically —
   * YouTube Analytics requires OAuth + channel ownership verification, which
   * this app doesn't have. These are either typed in by hand from YouTube
   * Studio, or filled via CSV import (see parseYoutubeStudioCsv). */
  publishedAt?: string;
  youtubeUrl?: string;
  impressions?: number;
  ctr?: number;
  avgViewDuration?: number;
  views?: number;

  learnings?: string;
  nextAction?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    tx.oncomplete = () => db.close();
  });
}

function randomId() {
  return `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listVideos(channelId: string): Promise<VideoRecord[]> {
  const all = await withStore<VideoRecord[]>('readonly', store => store.getAll());
  return all.filter(v => v.channelId === channelId).sort((a, b) => a.weekNo - b.weekNo);
}

export async function getVideoByPackId(packId: string): Promise<VideoRecord | undefined> {
  const all = await withStore<VideoRecord[]>('readonly', store => store.getAll());
  return all.find(v => v.packId === packId);
}

/** Called when a pack is explicitly saved — creates (or updates, if this pack already has one) a draft video entry. weekNo defaults to 1 past the channel's current highest week. */
export async function upsertVideoForPack(input: {
  channelId: string;
  packId: string;
  videoTitle: string;
  thumbnailA: string;
  thumbnailB: string;
  thumbnailC: string;
  thumbnailUsed: ThumbnailVariantId | null;
  imagePrompt: string;
  colors: string[];
  seoKeywords: string[];
}): Promise<VideoRecord> {
  const existing = await getVideoByPackId(input.packId);
  if (existing) {
    const updated: VideoRecord = {
      ...existing,
      videoTitle: input.videoTitle,
      thumbnailA: input.thumbnailA,
      thumbnailB: input.thumbnailB,
      thumbnailC: input.thumbnailC,
      thumbnailUsed: input.thumbnailUsed,
      imagePrompt: input.imagePrompt,
      colors: input.colors,
      seoKeywords: input.seoKeywords
    };
    await withStore('readwrite', store => store.put(updated));
    return updated;
  }

  const existingForChannel = await listVideos(input.channelId);
  const nextWeekNo = existingForChannel.length ? Math.max(...existingForChannel.map(v => v.weekNo)) + 1 : 1;
  const record: VideoRecord = {
    id: randomId(),
    channelId: input.channelId,
    packId: input.packId,
    weekNo: nextWeekNo,
    scheduledAt: new Date().toISOString(),
    videoTitle: input.videoTitle,
    thumbnailA: input.thumbnailA,
    thumbnailB: input.thumbnailB,
    thumbnailC: input.thumbnailC,
    thumbnailUsed: input.thumbnailUsed,
    imagePrompt: input.imagePrompt,
    colors: input.colors,
    seoKeywords: input.seoKeywords
  };
  await withStore('readwrite', store => store.put(record));
  return record;
}

export async function updateVideo(id: string, patch: Partial<VideoRecord>): Promise<void> {
  const all = await withStore<VideoRecord[]>('readonly', store => store.getAll());
  const existing = all.find(v => v.id === id);
  if (!existing) return;
  await withStore('readwrite', store => store.put({ ...existing, ...patch }));
}

export async function deleteVideo(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}

export async function forgetVideosForPack(packId: string): Promise<void> {
  const all = await withStore<VideoRecord[]>('readonly', store => store.getAll());
  const ids = all.filter(v => v.packId === packId).map(v => v.id);
  for (const id of ids) {
    await withStore('readwrite', store => store.delete(id));
  }
}

// ---------------------------------------------------------------------------
// Rule-based insights — deliberately no LLM call, so this costs nothing and
// never fabricates a trend from too little data.
// ---------------------------------------------------------------------------

export interface VideoInsights {
  variantAverageCtr: Partial<Record<ThumbnailVariantId, number>>;
  bestVariant: ThumbnailVariantId | null;
  topKeywords: string[];
  belowAverageWeeks: number[];
  sampleSize: number;
  insufficientData: boolean;
}

const MIN_SAMPLE_SIZE = 3;

function extractWords(title: string): string[] {
  return title
    .split(/[\s,·・\-]+/)
    .map(word => word.trim())
    .filter(word => word.length >= 2);
}

/** Pure — kept separate from IndexedDB so it's testable without a browser (same pattern as usageLedger/hookLedger). */
export function computeInsights(videos: VideoRecord[]): VideoInsights {
  const withCtr = videos.filter(v => typeof v.ctr === 'number');
  const withDuration = videos.filter(v => typeof v.avgViewDuration === 'number');

  if (withCtr.length < MIN_SAMPLE_SIZE) {
    return {
      variantAverageCtr: {},
      bestVariant: null,
      topKeywords: [],
      belowAverageWeeks: [],
      sampleSize: withCtr.length,
      insufficientData: true
    };
  }

  const byVariant: Partial<Record<ThumbnailVariantId, number[]>> = {};
  for (const video of withCtr) {
    if (!video.thumbnailUsed) continue;
    (byVariant[video.thumbnailUsed] ??= []).push(video.ctr as number);
  }
  const variantAverageCtr: Partial<Record<ThumbnailVariantId, number>> = {};
  for (const [variant, values] of Object.entries(byVariant)) {
    if (values && values.length) {
      variantAverageCtr[variant as ThumbnailVariantId] = values.reduce((sum, v) => sum + v, 0) / values.length;
    }
  }
  const bestVariant = (Object.entries(variantAverageCtr) as [ThumbnailVariantId, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const avgCtr = withCtr.reduce((sum, v) => sum + (v.ctr as number), 0) / withCtr.length;
  const topCtrVideos = [...withCtr].sort((a, b) => (b.ctr as number) - (a.ctr as number)).slice(0, Math.max(1, Math.ceil(withCtr.length / 3)));
  const wordCounts = new Map<string, number>();
  for (const video of topCtrVideos) {
    for (const word of extractWords(video.videoTitle)) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  const topKeywords = [...wordCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const avgDuration = withDuration.length ? withDuration.reduce((sum, v) => sum + (v.avgViewDuration as number), 0) / withDuration.length : 0;
  const belowAverageWeeks = withDuration.filter(v => (v.avgViewDuration as number) < avgDuration * 0.85).map(v => v.weekNo);

  return {
    variantAverageCtr,
    bestVariant,
    topKeywords,
    belowAverageWeeks,
    sampleSize: withCtr.length,
    insufficientData: false
  };
}

export async function channelInsights(channelId: string): Promise<VideoInsights> {
  const videos = await listVideos(channelId);
  return computeInsights(videos);
}

// ---------------------------------------------------------------------------
// CSV import (YouTube Studio export) / CSV export (checklist-compatible)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export interface ParsedCsvRow {
  title: string;
  impressions?: number;
  ctr?: number;
  avgViewDuration?: number;
  views?: number;
  publishedAt?: string;
  youtubeUrl?: string;
}

const HEADER_ALIASES: Record<keyof ParsedCsvRow, string[]> = {
  title: ['video title', 'title', '동영상 제목', '제목'],
  impressions: ['impressions', '노출수'],
  ctr: ['impressions click-through rate (%)', 'click-through rate (%)', 'ctr', '노출 클릭률(%)', '클릭률'],
  avgViewDuration: ['average view duration', '평균 시청 지속 시간'],
  views: ['views', '조회수'],
  publishedAt: ['video publish time', 'publish date', '게시 시간', '게시일'],
  youtubeUrl: ['video url', 'url', 'link', '링크']
};

function findColumnIndex(headers: string[], field: keyof ParsedCsvRow): number {
  const normalized = headers.map(h => h.trim().toLowerCase());
  for (const alias of HEADER_ALIASES[field]) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDurationToSeconds(raw: string): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':').map(Number);
  if (parts.some(Number.isNaN)) return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parsePercent(raw: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw.replace('%', '').trim());
  return Number.isNaN(value) ? undefined : value;
}

/**
 * YouTube Studio's own CSV export (Content > Advanced mode > Export) is the
 * realistic path here — there is no automated API access to this data
 * without OAuth + verified channel ownership, which this app deliberately
 * does not implement. Column names are matched case-insensitively against
 * YouTube Studio's actual English/Korean headers; unrecognized columns are
 * ignored rather than causing a failure, since exports vary by report type.
 */
export function parseYoutubeStudioCsv(csvText: string): ParsedCsvRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const titleIdx = findColumnIndex(headers, 'title');
  if (titleIdx === -1) return [];

  const impressionsIdx = findColumnIndex(headers, 'impressions');
  const ctrIdx = findColumnIndex(headers, 'ctr');
  const durationIdx = findColumnIndex(headers, 'avgViewDuration');
  const viewsIdx = findColumnIndex(headers, 'views');
  const publishedIdx = findColumnIndex(headers, 'publishedAt');
  const urlIdx = findColumnIndex(headers, 'youtubeUrl');

  const rows: ParsedCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const title = cells[titleIdx]?.trim();
    if (!title) continue;
    rows.push({
      title,
      impressions: impressionsIdx !== -1 ? Number(cells[impressionsIdx]) || undefined : undefined,
      ctr: ctrIdx !== -1 ? parsePercent(cells[ctrIdx]) : undefined,
      avgViewDuration: durationIdx !== -1 ? parseDurationToSeconds(cells[durationIdx]) : undefined,
      views: viewsIdx !== -1 ? Number(cells[viewsIdx]) || undefined : undefined,
      publishedAt: publishedIdx !== -1 ? cells[publishedIdx]?.trim() || undefined : undefined,
      youtubeUrl: urlIdx !== -1 ? cells[urlIdx]?.trim() || undefined : undefined
    });
  }
  return rows;
}

/** Applies parsed CSV rows onto existing VideoRecords, matched by title (case-insensitive substring match, since YouTube may append channel name or truncate). Returns how many matched. */
export async function importYoutubeStudioCsv(channelId: string, csvText: string): Promise<{ matched: number; total: number }> {
  const rows = parseYoutubeStudioCsv(csvText);
  const videos = await listVideos(channelId);
  let matched = 0;
  for (const row of rows) {
    const target = videos.find(
      v => v.videoTitle.toLowerCase().includes(row.title.toLowerCase()) || row.title.toLowerCase().includes(v.videoTitle.toLowerCase())
    );
    if (!target) continue;
    matched += 1;
    await updateVideo(target.id, {
      impressions: row.impressions ?? target.impressions,
      ctr: row.ctr ?? target.ctr,
      avgViewDuration: row.avgViewDuration ?? target.avgViewDuration,
      views: row.views ?? target.views,
      publishedAt: row.publishedAt ?? target.publishedAt,
      youtubeUrl: row.youtubeUrl ?? target.youtubeUrl
    });
  }
  return { matched, total: rows.length };
}

/**
 * Exports as CSV (Excel opens CSV natively — no XLSX-writing dependency
 * needed to stay compatible with a spreadsheet workflow). Columns are a
 * reasonable general checklist shape (week/title/dates/thumbnail/metrics/
 * notes); if the user's existing file uses different header names, the
 * columns can be renamed/reordered in Excel without losing data.
 */
export function exportVideosToCsv(videos: VideoRecord[]): string {
  const headers = ['주차', '제목', '예정일', '발행일', '유튜브 URL', '사용 썸네일', 'CTR(%)', '평균 시청 지속(초)', '조회수', '회고', '다음 액션'];
  const rows = videos.map(v => [
    String(v.weekNo),
    v.videoTitle,
    v.scheduledAt.slice(0, 10),
    v.publishedAt || '',
    v.youtubeUrl || '',
    v.thumbnailUsed || '',
    v.ctr != null ? String(v.ctr) : '',
    v.avgViewDuration != null ? String(v.avgViewDuration) : '',
    v.views != null ? String(v.views) : '',
    v.learnings || '',
    v.nextAction || ''
  ]);
  return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}
