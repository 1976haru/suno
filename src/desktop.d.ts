export {};

declare global {
  interface DesktopFileRef {
    id: string;
    kind: 'audio' | 'image';
    name: string;
    size: number;
    durationSec: number;
  }

  interface DesktopMediaProgress {
    jobId: string;
    stage: 'probe' | 'encode' | 'done';
    percent: number;
    label: string;
    elapsedSec?: number;
    totalSec?: number;
  }

  interface Window {
    desktopAPI?: {
      isAvailable: true;
      pickAudioFiles(): Promise<DesktopFileRef[]>;
      pickImage(): Promise<DesktopFileRef | null>;
      readImageDataUrl(fileId: string): Promise<string | null>;
      renderPlaylistMp4(input: {
        audioFileIds: string[];
        imageFileId: string;
        outName: string;
        playlist: string;
        titles: string[];
        options: {
          width: 1280 | 1920;
          imageMode: 'contain' | 'cover';
          preset: 'ultrafast' | 'veryfast' | 'medium';
          normalizeAudio: boolean;
        };
      }): Promise<{ jobId: string; outputPath: string; chapters: string }>;
      cancelMediaJob(jobId: string): Promise<boolean>;
      openOutputDir(playlist: string): Promise<string>;
      onMediaProgress(callback: (progress: DesktopMediaProgress) => void): () => void;
    };
  }
}
