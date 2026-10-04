import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import os from "node:os";
// Some restricted containers cannot enumerate network interfaces. Vite only
// uses this list to print LAN addresses; serving HTTP needs no interface list.
try {
  os.networkInterfaces();
} catch (error) {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_SYSTEM_ERROR"
  )
    os.networkInterfaces = () => ({});
  else throw error;
}
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[/](?:react|react-dom|scheduler)[/]/,
              priority: 30,
            },
            {
              name: "canvas",
              test: /node_modules[/](?:@xyflow|d3-)/,
              priority: 20,
            },
            { name: "schema", test: /node_modules[/]zod[/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: ["terminal.local"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
  },
});
