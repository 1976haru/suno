'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell, session } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const {
  MAX_AUDIO_FILES,
  MAX_RENDER_SECONDS,
  assertAudioExtension,
  assertImageExtension,
  buildChapterText,
  buildFilterGraph,
  createJobId,
  isJobId,
  parseProgressLine,
  sanitizeName,
  validateRenderSpec
} = require('./mediaCore.cjs');

const AUDIO_FILE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const IMAGE_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
const PROBE_TIMEOUT_MS = 30_000;
const JOB_TIMEOUT_MS = 13 * 60 * 60 * 1000;
const STALE_JOB_AGE_MS = 24 * 60 * 60 * 1000;
const approvedFiles = new Map();
const activeJobs = new Map();
let mainWindow = null;

function executablePath(value) {
  if (!value) return null;
  return String(value).replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

const ffmpegPath = executablePath(ffmpegStatic);
const ffprobePath = executablePath(ffprobeStatic && ffprobeStatic.path);

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function desktopRoot() {
  return path.resolve(__dirname, '..');
}

function appRoot() {
  return path.resolve(desktopRoot(), '..');
}

function tempRoot() {
  const root = process.platform === 'win32'
    ? 'C:\\hotaimusic-v2-tmp'
    : path.join(os.tmpdir(), 'hotaimusic-v2-tmp');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function outputDir(playlist) {
  const root = path.join(app.getPath('downloads'), 'HotAIMusic');
  const dir = path.join(root, sanitizeName(playlist || 'Playlist', 'Playlist', 100));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupPath(target) {
  try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
}

function sweepStaleJobs() {
  const root = tempRoot();
  const now = Date.now();
  for (const name of fs.readdirSync(root)) {
    if (!isJobId(name)) continue;
    const target = path.join(root, name);
    try {
      const stat = fs.statSync(target);
      if (now - stat.mtimeMs > STALE_JOB_AGE_MS) cleanupPath(target);
    } catch {}
  }
}

function makeApprovedFile(filePath, kind, durationSec = 0) {
  const stat = fs.statSync(filePath);
  const id = crypto.randomBytes(18).toString('base64url');
  const record = {
    id,
    kind,
    path: filePath,
    name: path.basename(filePath),
    size: stat.size,
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    approvedAt: Date.now()
  };
  approvedFiles.set(id, record);
  return { id, kind, name: record.name, size: record.size, durationSec: record.durationSec };
}

function resolveApprovedFile(id, expectedKind) {
  const record = approvedFiles.get(String(id || ''));
  if (!record || record.kind !== expectedKind) throw new Error('선택한 파일 권한이 만료되었습니다. 파일을 다시 선택하세요.');
  if (!fs.existsSync(record.path)) throw new Error(`파일을 찾을 수 없습니다: ${record.name}`);
  return record;
}

function terminateProcess(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); } catch {}
  } else {
    try { child.kill('SIGKILL'); } catch {}
  }
}

function spawnWithTimeout(command, args, timeoutMs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      terminateProcess(child);
      reject(new Error('작업 제한 시간을 초과했습니다.'));
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${path.basename(command)} 종료 코드 ${code}`));
    });
  });
}

async function probeAudio(filePath) {
  if (!ffprobePath) throw new Error('ffprobe 실행 파일을 찾을 수 없습니다.');
  const { stdout } = await spawnWithTimeout(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'json',
    filePath
  ], PROBE_TIMEOUT_MS);
  const parsed = JSON.parse(stdout || '{}');
  const duration = Number(parsed?.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`오디오 길이를 확인할 수 없습니다: ${path.basename(filePath)}`);
  return duration;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_START_URL;
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file:');
    if (!allowed) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(appRoot(), 'dist', 'index.html'));
}

function installCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const policy = app.isPackaged
      ? "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
      : "default-src 'self' http://127.0.0.1:*; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*";
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } });
  });
}

app.whenReady().then(() => {
  sweepStaleJobs();
  installCsp();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  for (const job of activeJobs.values()) terminateProcess(job.child);
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('desktop:pick-audio-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `오디오 파일 선택 (최대 ${MAX_AUDIO_FILES}곡)`,
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] }]
  });
  if (result.canceled) return [];
  const selected = result.filePaths.slice(0, MAX_AUDIO_FILES).sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'ko', { numeric: true }));
  const output = [];
  for (const filePath of selected) {
    assertAudioExtension(filePath);
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > AUDIO_FILE_LIMIT_BYTES) throw new Error(`오디오 파일 크기가 허용 범위를 벗어났습니다: ${path.basename(filePath)}`);
    const durationSec = await probeAudio(filePath);
    output.push(makeApprovedFile(filePath, 'audio', durationSec));
  }
  return output;
});

ipcMain.handle('desktop:pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '배경 이미지 선택',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  assertImageExtension(filePath);
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > IMAGE_FILE_LIMIT_BYTES) throw new Error('이미지 파일 크기가 허용 범위를 벗어났습니다.');
  return makeApprovedFile(filePath, 'image');
});

ipcMain.handle('desktop:read-image-data-url', async (_event, fileId) => {
  const record = resolveApprovedFile(fileId, 'image');
  const ext = path.extname(record.path).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(record.path).toString('base64')}`;
});

ipcMain.handle('desktop:render-playlist-mp4', async (_event, rawInput) => {
  if (activeJobs.size > 0) throw new Error('이미 영상 작업이 진행 중입니다. 완료하거나 취소한 뒤 다시 시도하세요.');
  if (!ffmpegPath) throw new Error('ffmpeg 실행 파일을 찾을 수 없습니다.');
  const input = validateRenderSpec(rawInput);
  const audioRecords = input.audioFileIds.map((id) => resolveApprovedFile(id, 'audio'));
  const imageRecord = resolveApprovedFile(input.imageFileId, 'image');
  const totalDuration = audioRecords.reduce((sum, record) => sum + record.durationSec, 0);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0 || totalDuration > MAX_RENDER_SECONDS) {
    throw new Error('전체 오디오 길이가 허용 범위를 벗어났습니다.');
  }

  const jobId = createJobId();
  const workDir = path.join(tempRoot(), jobId);
  fs.mkdirSync(workDir, { recursive: true });
  const imageExt = path.extname(imageRecord.path).toLowerCase();
  const stagedImage = path.join(workDir, `background${imageExt}`);
  fs.copyFileSync(imageRecord.path, stagedImage);
  const stagedAudio = audioRecords.map((record, index) => {
    const ext = path.extname(record.path).toLowerCase();
    const target = path.join(workDir, `audio_${String(index + 1).padStart(3, '0')}${ext}`);
    fs.copyFileSync(record.path, target);
    return target;
  });

  const output = path.join(workDir, 'output.mp4');
  const finalDir = outputDir(input.playlist);
  const finalPath = path.join(finalDir, `${input.outName}.mp4`);
  const args = ['-hide_banner', '-y', '-loop', '1', '-framerate', '2', '-t', String(Math.ceil(totalDuration)), '-i', stagedImage];
  for (const audioPath of stagedAudio) args.push('-i', audioPath);
  args.push(
    '-filter_complex', buildFilterGraph(stagedAudio.length, input.options),
    '-map', '[v]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', input.options.preset, '-tune', 'stillimage',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest',
    '-progress', 'pipe:2', '-nostats', output
  );

  send('desktop:media-progress', { jobId, stage: 'encode', percent: 0, label: `${stagedAudio.length}곡 인코딩 시작` });
  const child = spawn(ffmpegPath, args, { windowsHide: true });
  const job = { child, workDir, startedAt: Date.now(), canceled: false };
  activeJobs.set(jobId, job);

  return await new Promise((resolve, reject) => {
    let stderrTail = '';
    let buffer = '';
    const timer = setTimeout(() => {
      job.canceled = true;
      terminateProcess(child);
    }, JOB_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderrTail = (stderrTail + text).slice(-12_000);
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const elapsed = parseProgressLine(line);
        if (elapsed == null) continue;
        const percent = Math.max(0, Math.min(99, Math.round((elapsed / totalDuration) * 100)));
        send('desktop:media-progress', { jobId, stage: 'encode', percent, elapsedSec: elapsed, totalSec: totalDuration, label: '플레이리스트 영상 인코딩 중' });
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      activeJobs.delete(jobId);
      cleanupPath(workDir);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      activeJobs.delete(jobId);
      try {
        if (job.canceled) throw new Error('영상 만들기가 취소되었습니다.');
        if (code !== 0 || !fs.existsSync(output)) throw new Error(stderrTail.trim() || `ffmpeg 종료 코드 ${code}`);
        try { fs.renameSync(output, finalPath); }
        catch { fs.copyFileSync(output, finalPath); fs.unlinkSync(output); }
        const chapters = buildChapterText(rawInput.titles || audioRecords.map((record) => record.name), audioRecords.map((record) => record.durationSec));
        fs.writeFileSync(path.join(finalDir, `${input.outName}_chapters.txt`), chapters, 'utf8');
        send('desktop:media-progress', { jobId, stage: 'done', percent: 100, label: '완료' });
        resolve({ jobId, outputPath: finalPath, chapters });
      } catch (error) {
        reject(error);
      } finally {
        cleanupPath(workDir);
      }
    });
  });
});

ipcMain.handle('desktop:cancel-media-job', async (_event, jobId) => {
  const job = activeJobs.get(String(jobId || ''));
  if (!job) return false;
  job.canceled = true;
  terminateProcess(job.child);
  return true;
});

ipcMain.handle('desktop:open-output', async (_event, playlist) => {
  const dir = outputDir(playlist);
  const error = await shell.openPath(dir);
  if (error) throw new Error(error);
  return dir;
});
