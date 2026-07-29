'use strict';

const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');

const MAX_AUDIO_FILES = 100;
const MAX_RENDER_SECONDS = 12 * 60 * 60;
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const WIN_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

function sanitizeName(input, fallback = 'track', maxLen = 80) {
  const safeMax = Number.isFinite(maxLen) ? Math.max(1, Math.min(180, Math.floor(maxLen))) : 80;
  let value = String(input ?? '').normalize('NFC');
  value = value.replace(/[<>:"/\\|?*]/g, '_');
  value = value.replace(/[\u0000-\u001f\u007f]/g, '');
  value = value.replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '');
  value = Array.from(value).slice(0, safeMax).join('').replace(/[\s.]+$/g, '');
  if (!value) value = fallback;
  const stem = value.split('.')[0].toUpperCase();
  if (WIN_RESERVED.has(stem)) value += '_';
  return value;
}

function formatTimestamp(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function parseProgressLine(line) {
  const text = String(line || '').trim();
  const microseconds = /^out_time_ms=(\d+)$/.exec(text);
  if (microseconds) return Number(microseconds[1]) / 1_000_000;
  const timestamp = /^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(text);
  if (timestamp) return Number(timestamp[1]) * 3600 + Number(timestamp[2]) * 60 + Number(timestamp[3]);
  const legacy = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  if (legacy) return Number(legacy[1]) * 3600 + Number(legacy[2]) * 60 + Number(legacy[3]);
  return null;
}

function assertSupportedExtension(filePath, allowed, label) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (!allowed.has(ext)) throw new Error(`${label} 형식을 지원하지 않습니다: ${ext || '(확장자 없음)'}`);
  return ext;
}

function assertAudioExtension(filePath) {
  return assertSupportedExtension(filePath, ALLOWED_AUDIO_EXTENSIONS, '오디오');
}

function assertImageExtension(filePath) {
  return assertSupportedExtension(filePath, ALLOWED_IMAGE_EXTENSIONS, '이미지');
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(hostname) {
  const lower = hostname.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb');
}

function validateRemoteAudioUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    throw new Error('유효하지 않은 다운로드 URL입니다.');
  }
  if (url.protocol !== 'https:') throw new Error('오디오 다운로드는 HTTPS만 허용합니다.');
  if (url.username || url.password) throw new Error('사용자 정보가 포함된 URL은 허용하지 않습니다.');
  if (url.port && url.port !== '443') throw new Error('HTTPS 기본 포트 외의 URL은 허용하지 않습니다.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('로컬 주소는 다운로드할 수 없습니다.');
  }
  const ipType = net.isIP(host);
  if ((ipType === 4 && isPrivateIpv4(host)) || (ipType === 6 && isPrivateIpv6(host))) {
    throw new Error('사설 네트워크 주소는 다운로드할 수 없습니다.');
  }
  return url;
}

function validateRenderSpec(input) {
  if (!input || typeof input !== 'object') throw new Error('렌더링 요청이 올바르지 않습니다.');
  const audioFileIds = Array.isArray(input.audioFileIds) ? input.audioFileIds.map(String) : [];
  if (audioFileIds.length < 1) throw new Error('오디오 파일을 한 개 이상 선택하세요.');
  if (audioFileIds.length > MAX_AUDIO_FILES) throw new Error(`한 번에 최대 ${MAX_AUDIO_FILES}곡까지 렌더링할 수 있습니다.`);
  if (new Set(audioFileIds).size !== audioFileIds.length) throw new Error('같은 오디오 파일이 중복 선택되었습니다.');
  const imageFileId = String(input.imageFileId || '');
  if (!imageFileId) throw new Error('배경 이미지를 선택하세요.');

  const options = input.options && typeof input.options === 'object' ? input.options : {};
  const width = Number(options.width) === 1280 ? 1280 : 1920;
  const height = width === 1280 ? 720 : 1080;
  const imageMode = options.imageMode === 'cover' ? 'cover' : 'contain';
  const preset = ['ultrafast', 'veryfast', 'medium'].includes(options.preset) ? options.preset : 'veryfast';
  const normalizeAudio = options.normalizeAudio === true;

  return {
    audioFileIds,
    imageFileId,
    outName: sanitizeName(input.outName || 'playlist', 'playlist', 100),
    playlist: sanitizeName(input.playlist || input.outName || 'Playlist', 'Playlist', 100),
    options: { width, height, imageMode, preset, normalizeAudio }
  };
}

function buildFilterGraph(audioCount, options = {}) {
  const count = Number(audioCount);
  if (!Number.isInteger(count) || count < 1 || count > MAX_AUDIO_FILES) throw new Error('오디오 개수가 허용 범위를 벗어났습니다.');
  const width = options.width === 1280 ? 1280 : 1920;
  const height = width === 1280 ? 720 : 1080;
  const imageMode = options.imageMode === 'cover' ? 'cover' : 'contain';

  const videoFilter = imageMode === 'cover'
    ? `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=2,format=yuv420p[v]`
    : `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=2,format=yuv420p[v]`;

  const normalized = [];
  const labels = [];
  for (let index = 0; index < count; index += 1) {
    const label = `a${index}`;
    const normalize = options.normalizeAudio ? ',loudnorm=I=-14:LRA=11:TP=-1.5' : '';
    normalized.push(`[${index + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=N/SR/TB${normalize}[${label}]`);
    labels.push(`[${label}]`);
  }
  const concat = `${labels.join('')}concat=n=${count}:v=0:a=1[aout]`;
  return [videoFilter, ...normalized, concat].join(';');
}

function createJobId() {
  return crypto.randomBytes(16).toString('hex');
}

function isJobId(value) {
  return /^[a-f0-9]{32}$/.test(String(value || ''));
}

function buildChapterText(titles, durations) {
  const safeTitles = Array.isArray(titles) ? titles : [];
  const safeDurations = Array.isArray(durations) ? durations : [];
  const lines = [];
  let cursor = 0;
  const count = Math.min(safeTitles.length, safeDurations.length);
  for (let index = 0; index < count; index += 1) {
    lines.push(`${formatTimestamp(cursor)} ${String(safeTitles[index] || `Track ${index + 1}`).trim()}`);
    const duration = Number(safeDurations[index]);
    if (Number.isFinite(duration) && duration > 0) cursor += duration;
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

module.exports = {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_AUDIO_FILES,
  MAX_RENDER_SECONDS,
  sanitizeName,
  formatTimestamp,
  parseProgressLine,
  assertAudioExtension,
  assertImageExtension,
  validateRemoteAudioUrl,
  validateRenderSpec,
  buildFilterGraph,
  createJobId,
  isJobId,
  buildChapterText
};
