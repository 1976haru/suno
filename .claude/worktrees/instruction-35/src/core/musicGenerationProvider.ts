import type { ProviderSettings } from '../types';

/**
 * codex 지시문 06 (TASK D) — real, verified scope decision: investigation
 * confirmed this app has ZERO real Suno API integration anywhere, today
 * (grep across the whole codebase for 'suno.com'/'sunoapi'/'SUNO_API'
 * found nothing beyond a separate Playwright helper that explicitly never
 * clicks Generate, plus two prior task reports that explicitly disclose
 * "이 환경에는 실제 Suno API/계정 접근이 없다"). "공식 API 또는 사용자가 제공한
 * 합법적 연결 방식만 사용한다" — since no such connection is confirmed to
 * exist or be available, building a "working" client would mean either
 * faking success or quietly calling an undocumented/unauthorized endpoint,
 * both of which this app's own established discipline (see every other
 * 미구현/not-measured item this whole session has left honest) rules out.
 *
 * This module is the real, correctly-shaped CONTRACT plus an honest
 * default implementation that clearly reports "not configured" for every
 * method — a real place for a future real connection (official API access,
 * or a user's own legitimate integration) to land, without ever silently
 * pretending one exists today. Confirmed structurally true, not just by
 * intent: core/audioTakes.ts's real recordTake/getTakes/setAdopted (the
 * upload-based take-comparison path) import nothing from this module —
 * upload-based comparison works whether or not any MusicGenerationProvider
 * is ever configured.
 *
 * Key handling: this app is a pure browser/Vite build with no Electron
 * main/renderer split (confirmed by investigation) — its real security
 * boundary is the serverless proxy pattern (`api/generate.js` +
 * `providers/proxyFetch.ts`'s buildProxyHeaders), where a 'server'
 * keyStorageMode key never leaves the proxy's own environment, and a
 * 'local' (BYOK) key is the user's own explicit, disclosed tradeoff. A real
 * future MusicGenerationProvider implementation should route through that
 * SAME discipline (a proxy endpoint, not a raw third-party fetch holding a
 * secret in this module) — documented here so that discipline isn't lost
 * if/when a real connection is added.
 */

export interface MusicGenerationRequest {
  packId: string;
  trackNo: number;
  title: string;
  stylePrompt: string;
  lyrics: string;
  excludePrompt?: string;
}

export interface Job {
  jobId: string;
  submittedAt: string;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface GeneratedTake {
  takeId: string;
  jobId: string;
  fileName: string;
}

export interface MusicGenerationProvider {
  readonly id: string;
  /** True only when a real, usable connection is actually configured — never assumed true by construction. */
  isConfigured(): boolean;
  submit(request: MusicGenerationRequest): Promise<Job>;
  poll(jobId: string): Promise<JobStatus>;
  listTakes(jobId: string): Promise<GeneratedTake[]>;
  download(takeId: string): Promise<Blob>;
}

export class MusicProviderUnavailableError extends Error {
  constructor(method: string) {
    super(`MusicGenerationProvider가 설정되지 않았습니다 (${method}) — 공식 API 연결이 없으면 업로드 기반 테이크 비교를 사용하세요.`);
    this.name = 'MusicProviderUnavailableError';
  }
}

/**
 * The one real default this app ships — every method honestly rejects
 * rather than faking a result. `isConfigured()` always returns false here
 * by construction (there is nothing to configure yet), so a caller can
 * check availability BEFORE ever calling submit/poll/listTakes/download and
 * route straight to the upload flow instead.
 */
export class UnavailableMusicGenerationProvider implements MusicGenerationProvider {
  readonly id = 'unavailable';

  isConfigured(): boolean {
    return false;
  }
  async submit(): Promise<Job> {
    throw new MusicProviderUnavailableError('submit');
  }
  async poll(): Promise<JobStatus> {
    throw new MusicProviderUnavailableError('poll');
  }
  async listTakes(): Promise<GeneratedTake[]> {
    throw new MusicProviderUnavailableError('listTakes');
  }
  async download(): Promise<Blob> {
    throw new MusicProviderUnavailableError('download');
  }
}

/**
 * Real config-presence check — mirrors the same real `keyStorageMode`/
 * `apiKey`/`accessToken` fields ProviderSettings already uses for the text-
 * generation providers (types.ts), so a future real music-provider config
 * doesn't invent a second, inconsistent credential shape. Returns false for
 * every input today (no real endpoint/credential concept for this provider
 * type exists yet) — a real future connection would extend this check, not
 * bypass it.
 */
export function isMusicGenerationProviderConfigured(_settings: Pick<ProviderSettings, 'apiKey' | 'accessToken' | 'keyStorageMode'>): boolean {
  return false;
}

/** The one real resolver a caller should use — always returns a usable (if honestly unavailable) provider, never undefined/null. */
export function resolveMusicGenerationProvider(settings: Pick<ProviderSettings, 'apiKey' | 'accessToken' | 'keyStorageMode'>): MusicGenerationProvider {
  if (isMusicGenerationProviderConfigured(settings)) {
    // No real implementation exists yet to return here — see this module's
    // own top doc comment. When a real connection is added, it plugs in at
    // exactly this branch.
    return new UnavailableMusicGenerationProvider();
  }
  return new UnavailableMusicGenerationProvider();
}
