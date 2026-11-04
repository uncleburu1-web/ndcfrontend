// Copy the backend's committed OpenAPI snapshot into api/openapi.json (spec 15 §14.3), then run `npm run api:types`.
// The copy is committed so the web app's CI can check types without the backend checked out.
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const from = resolve(process.argv[2] ?? "../ndcbackend/docs/openapi.json");
if (!existsSync(from)) {
  console.error(`No schema at ${from}. Pass the path: npm run api:sync -- <path to ndcbackend>/docs/openapi.json`);
  process.exit(1);
}
copyFileSync(from, resolve("api/openapi.json"));
console.log(`Copied ${from} → api/openapi.json. Now run: npm run api:types`);
