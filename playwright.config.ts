import { defineConfig, devices } from '@playwright/test';

// 브라우저 E2E 테스트. 운영 모드 서버(프론트 포함)를 전용 DB(shlack_e2e)와 포트(3102)로 띄워서 실행한다.
// 실행 전 빌드 필요: npm run e2e:build  (CI 에서는 워크플로가 빌드)
const PORT = Number(process.env.E2E_PORT || 3102);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.test.ts',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1, // 같은 DB 를 쓰므로 순서대로
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 시작할 때마다 E2E 전용 DB 를 새로 만든다
    command: 'npm run e2e:db && node dist/main',
    url: `http://localhost:${PORT}/api/users`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'production',
      PORT: String(PORT),
      DB_NAME: process.env.E2E_DB_NAME || 'shlack_e2e',
    },
  },
});
