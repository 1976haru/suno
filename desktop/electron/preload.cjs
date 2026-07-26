'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', Object.freeze({
  isAvailable: true,
  pickAudioFiles: () => ipcRenderer.invoke('desktop:pick-audio-files'),
  pickImage: () => ipcRenderer.invoke('desktop:pick-image'),
  readImageDataUrl: (fileId) => ipcRenderer.invoke('desktop:read-image-data-url', fileId),
  renderPlaylistMp4: (input) => ipcRenderer.invoke('desktop:render-playlist-mp4', input),
  cancelMediaJob: (jobId) => ipcRenderer.invoke('desktop:cancel-media-job', jobId),
  openOutputDir: (playlist) => ipcRenderer.invoke('desktop:open-output', playlist),
  onMediaProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:media-progress', listener);
    return () => ipcRenderer.removeListener('desktop:media-progress', listener);
  }
}));
