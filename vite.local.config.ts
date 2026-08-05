import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "local",
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../local-dist",
    emptyOutDir: true,
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
  },
});
