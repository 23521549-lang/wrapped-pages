import { defineConfig, devices } from "@playwright/test";
import { e2eUrls } from "./tests/e2e/env";

const { e2eUrl } = e2eUrls();
// Bat bien 2: webServer va moi worker chi thay database e2e.
process.env.DATABASE_URL = e2eUrl;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start -- --port 3100",
    // Moc "ready" cua webServer PHAI la mot trang KHONG cham database.
    // Playwright 1.63 cho webServer "ready" (url tra 2xx/3xx/400-403) TRUOC KHI
    // chay globalSetup, chu khong nguoc lai. Neu moc ready la mot trang can bang
    // accounts (vd "/") thi no se tra 500 mai vi database mqce_e2e chua ton tai/chua
    // migrate luc do - treo het 180s roi timeout, vi globalSetup chi chay SAU khi
    // webServer ready. "/cho" khong cham database (ke ca layout goc), nen van tra 200
    // du da la route dong vi nonce CSP (src/app/layout.tsx).
    url: "http://localhost:3100/cho",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: e2eUrl },
  },
});
