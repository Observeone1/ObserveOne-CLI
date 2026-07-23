import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**/*', 'src/types/**/*'],
      // Ratchet for the unit-tested surface only. `src/commands/**` and
      // `src/index.ts` need a live backend and are e2e territory (PR #82
      // excluded them from Sonar's coverage scope), so a whole-project
      // threshold would be meaningless here. These floors sit just under the
      // measured values — raise them when coverage rises, never lower them.
      thresholds: {
        'src/services/**': { lines: 98, branches: 96, functions: 98, statements: 98 },
        'src/utils/**': { lines: 98, branches: 96, functions: 97, statements: 98 },
      },
    },
  },
});
