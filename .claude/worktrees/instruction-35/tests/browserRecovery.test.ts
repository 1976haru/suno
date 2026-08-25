import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECOVERABLE_DATABASES } from '../src/core/browserRecovery';

/**
 * codex 지시문 07 (TASK F) — real regression guard for the exact bug this
 * task found and fixed: RECOVERABLE_DATABASES had gone stale as new
 * IndexedDB stores shipped, silently leaving `/?repair=1` unable to wipe 8
 * of 17 real databases. Rather than hand-listing the expected set again
 * (which would just be a second copy that can ALSO drift), this scans the
 * real source for every `const DB_NAME = '...'` declaration and asserts
 * every one (except the deliberately-excluded suno-weaver-settings) is
 * really present in RECOVERABLE_DATABASES — so a future new store that
 * forgets to update this list fails CI instead of silently repeating this
 * exact bug.
 */

const coreDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core');

function realDbNamesInCoreDir(): string[] {
  const names: string[] = [];
  for (const fileName of fs.readdirSync(coreDir)) {
    if (!fileName.endsWith('.ts')) continue;
    const content = fs.readFileSync(join(coreDir, fileName), 'utf8');
    const match = content.match(/const DB_NAME = '([^']+)'/);
    if (match) names.push(match[1]);
  }
  return names;
}

describe('[codex 지시문 07 TASK F] RECOVERABLE_DATABASES stays complete against every real DB_NAME', () => {
  it('every real, non-settings DB_NAME in core/*.ts is listed in RECOVERABLE_DATABASES', () => {
    const realNames = realDbNamesInCoreDir();
    expect(realNames.length).toBeGreaterThan(10); // sanity: the scan itself actually found real declarations
    const missing = realNames.filter(name => name !== 'suno-weaver-settings' && !RECOVERABLE_DATABASES.includes(name));
    expect(missing, `RECOVERABLE_DATABASES is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('suno-weaver-settings is deliberately NOT in RECOVERABLE_DATABASES (never wipe API keys/provider choice)', () => {
    expect(RECOVERABLE_DATABASES).not.toContain('suno-weaver-settings');
  });

  it('has no duplicate entries', () => {
    expect(new Set(RECOVERABLE_DATABASES).size).toBe(RECOVERABLE_DATABASES.length);
  });
});
