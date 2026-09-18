import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    testTimeout: 15000,
    fileParallelism: false,
    // Hau het test la ham thuan/server, chay o "node". Rieng flipbook-settle.test.tsx dung ve DOM
    // that (React Testing Library) de bat loi dong bo state cua React ma khong the kiem duoc bang
    // ham thuan, nen can jsdom - tach rieng thanh mot project de khong doi environment cua ca bo.
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
      { extends: true, test: { name: "dom", environment: "jsdom", include: ["tests/unit/**/*.test.tsx"] } },
    ],
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
