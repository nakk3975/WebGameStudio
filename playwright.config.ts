import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    actionTimeout: 15_000,
    baseURL: "http://127.0.0.1:4187",
    viewport: { width: 1600, height: 1000 },
    launchOptions: process.env.GHOSTDESK_CHROMIUM_PATH
      ? { executablePath: process.env.GHOSTDESK_CHROMIUM_PATH }
      : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 4187 --strictPort",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_BASE_URL: "", VITE_AUTH_URL: "" },
  },
});
