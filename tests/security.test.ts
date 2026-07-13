import { afterEach, describe, expect, it } from 'vitest';
import { __internal as generateInternal } from '../api/generate.js';
import { __internal as batchInternal } from '../api/batch.js';

function fakeReq(origin?: string, headers: Record<string, string> = {}) {
  return { headers: { origin, ...headers } };
}

describe('[C1] resolveCorsOrigin', () => {
  const originalAllowed = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalAllowed === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalAllowed;
  });

  it('ALLOWED_ORIGINS unset (local dev) allows any origin through', () => {
    delete process.env.ALLOWED_ORIGINS;
    const result = generateInternal.resolveCorsOrigin(fakeReq('https://evil.example.com'));
    expect(result.blocked).toBe(false);
    expect(result.origin).toBe('https://evil.example.com');
  });

  it('an origin on the ALLOWED_ORIGINS list is allowed', () => {
    process.env.ALLOWED_ORIGINS = 'https://mychannel.app,https://staging.mychannel.app';
    const result = generateInternal.resolveCorsOrigin(fakeReq('https://mychannel.app'));
    expect(result.blocked).toBe(false);
    expect(result.origin).toBe('https://mychannel.app');
  });

  it('an origin NOT on the ALLOWED_ORIGINS list is blocked', () => {
    process.env.ALLOWED_ORIGINS = 'https://mychannel.app';
    const result = generateInternal.resolveCorsOrigin(fakeReq('https://evil.example.com'));
    expect(result.blocked).toBe(true);
  });

  it('api/batch.js applies the identical policy', () => {
    process.env.ALLOWED_ORIGINS = 'https://mychannel.app';
    expect(batchInternal.resolveCorsOrigin(fakeReq('https://evil.example.com')).blocked).toBe(true);
    expect(batchInternal.resolveCorsOrigin(fakeReq('https://mychannel.app')).blocked).toBe(false);
  });
});

describe('[C2] checkAccessToken', () => {
  const originalToken = process.env.ACCESS_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.ACCESS_TOKEN;
    else process.env.ACCESS_TOKEN = originalToken;
  });

  it('ACCESS_TOKEN unset means every request passes (server-key mode ungated by default)', () => {
    delete process.env.ACCESS_TOKEN;
    expect(generateInternal.checkAccessToken(fakeReq(undefined))).toBe(true);
  });

  it('a mismatched or missing X-Access-Token fails when ACCESS_TOKEN is set', () => {
    process.env.ACCESS_TOKEN = 'secret-token';
    expect(generateInternal.checkAccessToken(fakeReq(undefined))).toBe(false);
    expect(generateInternal.checkAccessToken(fakeReq(undefined, { 'x-access-token': 'wrong' }))).toBe(false);
  });

  it('a matching X-Access-Token passes', () => {
    process.env.ACCESS_TOKEN = 'secret-token';
    expect(generateInternal.checkAccessToken(fakeReq(undefined, { 'x-access-token': 'secret-token' }))).toBe(true);
  });

  it('api/batch.js applies the identical policy', () => {
    process.env.ACCESS_TOKEN = 'secret-token';
    expect(batchInternal.checkAccessToken(fakeReq(undefined, { 'x-access-token': 'secret-token' }))).toBe(true);
    expect(batchInternal.checkAccessToken(fakeReq(undefined))).toBe(false);
  });
});

describe('error responses never leak API key material', () => {
  it('maskKey only ever exposes a short prefix/suffix, never the full key', () => {
    const masked = generateInternal.maskKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890');
    expect(masked).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(masked.length).toBeLessThan(20);
  });
});
