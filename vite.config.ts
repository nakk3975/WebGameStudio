import { defineConfig } from "vite";
export default defineConfig({
  root: "apps/ghostdesk",
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 1000000 },
  server: { host: "0.0.0.0", port: 4173, allowedHosts: ["terminal.local"] },
});
