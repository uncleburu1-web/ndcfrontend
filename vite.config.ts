/// <reference types="vitest" />
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error plain ESM script without types
import { buildHeaders, headersFile, securityTxt } from "./scripts/security-headers.mjs";

/** Spec 14 §4.9, §4.12: write dist/_headers and dist/.well-known/security.txt from build-time env. */
function securityFiles(mode: string): Plugin {
  let outDir = "dist";
  return {
    name: "ndc-security-files",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), "VITE_") };
      writeFileSync(join(outDir, "_headers"), headersFile(buildHeaders(env)));
      const txt = securityTxt(env);
      if (txt) {
        mkdirSync(join(outDir, ".well-known"), { recursive: true });
        writeFileSync(join(outDir, ".well-known", "security.txt"), txt);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), securityFiles(mode)],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: false,
    css: false,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
}));
