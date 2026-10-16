import { defineConfig, devices } from '@playwright/test'

// Runs against a production build with the MSW mock of the real API.
// Chromium flags: WebGPU through SwiftShader (the Rust compositor runs on it),
// autoplay for the AudioWorklet mixer, and a fake microphone for voiceover.
const CHROMIUM_ARGS = [
  '--enable-unsafe-webgpu',
  '--use-angle=swiftshader',
  '--use-webgpu-adapter=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
]

const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    acceptDownloads: true,
    permissions: ['microphone'],
    launchOptions: { args: CHROMIUM_ARGS, executablePath },
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: /screenshots\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: executablePath ? undefined : 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: executablePath ? undefined : 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run build:mocks && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
