/**
 * Spec 15 §13.2: every VITE_ value ends up in the browser, so none may be secret. Fails when a VITE_ variable, or the
 * built bundle in dist/, holds something that looks like a server secret (Clerk/Paystack secret keys, webhook secrets,
 * a Cloudinary API secret or a private key). Prints variable and file names, never the values.
 *
 *   npm run check:secrets            (after npm run build)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SECRET_PATTERNS = [
  [/\bsk_(?:live|test)_[A-Za-z0-9]{8,}/, "a Clerk or Paystack secret key"],
  [/\bwhsec_[A-Za-z0-9+/=]{8,}/, "a webhook signing secret"],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, "a private key"],
  [/CLOUDINARY_API_SECRET|CLERK_SECRET_KEY|PAYSTACK_SECRET_KEY/, "a server secret's name"],
];

export function findSecrets(env = process.env) {
  const out = [];
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith("VITE_")) continue;
    if (/SECRET|PRIVATE|PASSWORD/i.test(k)) out.push(`${k}: a VITE_ variable named like a secret`);
    for (const [re, what] of SECRET_PATTERNS) if (re.test(String(v))) out.push(`${k}: looks like ${what}`);
  }
  return out;
}

export function scanBundle(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|css|json|txt|map)$/.test(name)) {
        const text = readFileSync(p, "utf8");
        for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) out.push(`${p}: contains ${what}`);
      }
    }
  };
  walk(dir);
  return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const problems = [...findSecrets(), ...scanBundle(join(process.cwd(), "dist"))];
  if (problems.length) {
    console.error("Secret-looking values found (never put secrets in VITE_ variables):");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log("No secret-looking VITE_ values or bundle contents.");
}
