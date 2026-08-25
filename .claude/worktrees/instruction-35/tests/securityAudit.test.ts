import { describe, expect, it } from 'vitest';
import {
  checkDependencyAudit, checkApiKeyExposure, checkLocalStorageSecrets,
  checkLogSecretLeaks, checkErrorMessageSecretLeaks, checkUploadedFilePathLeak,
  SNAPSHOT_SECRET_FIELDS
} from '../scripts/securityAudit';
import { toSnapshotProviderInfo } from '../src/core/generationSnapshot';
import { buildExportMeta } from '../src/core/exportMeta';
import type { ProviderSettings } from '../src/types';

/**
 * codex 지시문 07 (TASK E, required by spec) — real coverage of every
 * named security check: dependency audit / API key renderer exposure /
 * localStorage sensitive info / snapshot secret / export secret / logs /
 * error stack / uploaded file path. §6-2 principle (matches
 * scripts/isolationAudit.ts's own convention): reuses the real check
 * functions from scripts/securityAudit.ts rather than re-deriving them.
 */

describe('[codex 지시문 07 TASK E] dependency audit — real CI policy: 0 high/critical', () => {
  it('the real, current dependency tree has 0 high/critical vulnerabilities', () => {
    const { result, summary } = checkDependencyAudit();
    expect(result.status, result.detail).toBe('PASS');
    expect(summary?.high).toBe(0);
    expect(summary?.critical).toBe(0);
  });
});

describe('[codex 지시문 07 TASK E] API key never exposed to the renderer beyond the disclosed BYOK path', () => {
  it('no source file sends a raw apiKey/accessToken without the real keyStorageMode gate', () => {
    const result = checkApiKeyExposure();
    expect(result.status, result.detail).toBe('PASS');
  });
});

describe('[codex 지시문 07 TASK E] localStorage never receives a raw secret unconditionally', () => {
  it('no source file calls localStorage.setItem with a raw apiKey/accessToken', () => {
    const result = checkLocalStorageSecrets();
    expect(result.status, result.detail).toBe('PASS');
  });
});

describe('[codex 지시문 07 TASK E] snapshot secret — reuses the REAL existing runtime guarantee', () => {
  it('toSnapshotProviderInfo strips every real secret field from a live ProviderSettings', () => {
    const settings: ProviderSettings = {
      provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.7,
      apiKey: 'sk-real-secret-value', accessToken: 'real-access-token', proxyEndpoint: 'https://real-proxy.example',
      keyStorageMode: 'local', batchSize: 1
    };
    const snapshotInfo = toSnapshotProviderInfo(settings);
    const serialized = JSON.stringify(snapshotInfo);
    for (const field of SNAPSHOT_SECRET_FIELDS) {
      expect(serialized).not.toContain((settings as unknown as Record<string, string>)[field]);
    }
    expect(snapshotInfo.hasApiKey).toBe(true); // presence is real signal, the raw value itself is never carried
  });
});

describe('[codex 지시문 07 TASK E] export secret — reuses the REAL existing ExportMeta shape', () => {
  it('buildExportMeta never carries any of the real secret field names at all', () => {
    const meta = buildExportMeta('2026-01-01T00:00:00.000Z', 'senior-oldpop');
    const keys = Object.keys(meta);
    for (const field of SNAPSHOT_SECRET_FIELDS) {
      expect(keys).not.toContain(field);
    }
  });
});

describe('[codex 지시문 07 TASK E] logs never interpolate a raw secret', () => {
  it('no source file calls console.log/warn/error/info/debug with a raw apiKey/accessToken', () => {
    const result = checkLogSecretLeaks();
    expect(result.status, result.detail).toBe('PASS');
  });
});

describe('[codex 지시문 07 TASK E] error messages never echo a raw secret', () => {
  it('no thrown Error template literal interpolates a raw apiKey/accessToken', () => {
    const result = checkErrorMessageSecretLeaks();
    expect(result.status, result.detail).toBe('PASS');
  });
});

describe('[codex 지시문 07 TASK E] uploaded file path never leaked', () => {
  it('no source file reads/logs/sends a File\'s local path', () => {
    const result = checkUploadedFilePathLeak();
    expect(result.status, result.detail).toBe('PASS');
  });
});
