import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  testDir: "./tests/live",
  workers: 1,
  retries: 0,
  reporter: "list",
});
