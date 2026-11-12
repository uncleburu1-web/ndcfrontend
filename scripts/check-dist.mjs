#!/usr/bin/env node
/**
 * Runs before every `wrangler deploy` (wrangler.jsonc "build.command"). It never builds: it refuses to deploy a dist/
 * that is missing, left over from an earlier commit (Cloudflare restores a build cache), or built without the Clerk
 * key or API address, so a broken "Sign-in isn't configured" site can't go live. Fix: set the dashboard build command
 * to `npm run build` with the VITE_* build variables.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const fail = (msg) => {
  console.error(`✗ Not deploying: ${msg}`);
  console.error("  Set the Cloudflare build command to `npm run build` and the build variables VITE_CLERK_PUBLISHABLE_KEY and VITE_API_BASE_URL.");
  process.exit(1);
};
if (!existsSync("dist/index.html")) fail("dist/ wasn't built in this run.");
if (!existsSync("dist/build-info.json")) fail("dist/ has no build-info.json (an old or foreign build).");
const info = JSON.parse(readFileSync("dist/build-info.json", "utf8"));
let head = process.env.WORKERS_CI_COMMIT_SHA || "";
if (!head) {
  try {
    head = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    head = "";
  }
}
if (head && info.commit && !head.startsWith(info.commit)) fail(`dist/ is from commit ${info.commit}, not ${head.slice(0, 7)} (a cached build).`);
if (!info.clerk_key) fail("dist/ was built without VITE_CLERK_PUBLISHABLE_KEY.");
if (!info.api_base) fail("dist/ was built without VITE_API_BASE_URL.");
console.log(`✓ dist/ is commit ${info.commit}, built ${info.built_at}, with the Clerk key and API address.`);
