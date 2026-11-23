import { defineConfig } from '@playwright/test';
const testUrl = process.env.TEST_APP_URL || process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith('_test')) throw new Error('Для E2E нужна отдельная PostgreSQL БД с суффиксом _test');
export default defineConfig({
  testDir: './test/e2e', timeout: 90000, expect: { timeout: 30000 }, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3011', headless: true },
  webServer: {
    command: 'node src/server.js', url: 'http://127.0.0.1:3011/login/', reuseExistingServer: false,
    env: { DATABASE_URL: process.env.TEST_APP_URL || process.env.TEST_DATABASE_URL || '',
      MOODLE_LOGIN: 'e2e_student', MOODLE_FULL_NAME: 'Тестовый Студент',
      API_TOKEN: 'e2e-token-only-for-local-ci-tests-123456', PORT: '3011', HOST: '127.0.0.1' },
  },
});
