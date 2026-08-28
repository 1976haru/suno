import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['scripts/audit79/**/*.audit.ts'], testTimeout: 600000 }
});
