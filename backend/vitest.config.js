import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75
      },
      include: ['src/**/*.js'],
      exclude: [
        'src/server.js',
        'src/worker.js',
        'src/db/migrate.js'
      ]
    }
  }
});
