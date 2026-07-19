import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Sandbox integration tests self-skip when no Intuit sandbox credentials
    // are present in the environment (see test/sandbox.integration.sandbox.test.ts).
    testTimeout: 30_000,
  },
});
