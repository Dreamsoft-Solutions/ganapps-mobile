import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: false },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['pact/**/*.pact.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 30000 },
});
