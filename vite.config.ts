/// <reference types="vitest" />
import { execSync } from "node:child_process";
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
      // Checked by scripts/check-dist.mjs before every `wrangler deploy`: which commit this is, and whether it can sign in.
      writeFileSync(join(outDir, "build-info.json"), JSON.stringify({ commit: commit(), built_at: new Date().toISOString(),
        clerk_key: Boolean(env.VITE_CLERK_PUBLISHABLE_KEY), api_base: Boolean(env.VITE_API_BASE_URL) }));
      const txt = securityTxt(env);
      if (txt) {
        mkdirSync(join(outDir, ".well-known"), { recursive: true });
        writeFileSync(join(outDir, ".well-known", "security.txt"), txt);
      }
    },
  };
}

/** Spec 20 §15: the build's commit for Settings → About (Cloudflare Pages sets CF_PAGES_COMMIT_SHA; locally, git). */
function commit(): string {
  const env = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GIT_COMMIT || "";
  if (env) return env.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

/** A production build without the Clerk key would ship the "Sign-in isn't configured" page: fail the build instead. */
function requireClerkKey(mode: string): Plugin {
  return {
    name: "ndc-require-clerk-key",
    apply: "build",
    configResolved() {
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), "VITE_") };
      if (mode === "production" && !env.VITE_CLERK_PUBLISHABLE_KEY) {
        throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set for this build. Add it (and VITE_API_BASE_URL) as build variables.");
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), securityFiles(mode), requireClerkKey(mode)],
  define: {
    __APP_COMMIT__: JSON.stringify(commit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: false,
    css: false,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
}));
