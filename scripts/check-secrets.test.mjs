import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findSecrets, scanBundle } from "./check-secrets.mjs";

describe("check:secrets (spec 15 §13.2)", () => {
  it("flags secret-looking VITE_ values by name only", () => {
    const fake = "sk_" + "test_" + "abcdefgh12345";
    const out = findSecrets({ VITE_API_BASE_URL: "https://api.example.ng", VITE_PAYSTACK_KEY: fake, VITE_CLOUDINARY_API_SECRET: "x", OTHER: fake });
    expect(out).toEqual(["VITE_PAYSTACK_KEY: looks like a Clerk or Paystack secret key", "VITE_CLOUDINARY_API_SECRET: a VITE_ variable named like a secret"]);
    expect(out.join(" ")).not.toContain(fake);
    expect(findSecrets({ VITE_CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS5uZyQ=", VITE_MEDIA_ORIGIN: "https://res.cloudinary.com" })).toEqual([]);
  });
  it("scans the built bundle", () => {
    const d = mkdtempSync(join(tmpdir(), "ndc-dist-"));
    writeFileSync(join(d, "ok.js"), "console.log('pk_test_abc')");
    expect(scanBundle(d)).toEqual([]);
    writeFileSync(join(d, "bad.js"), "const k='" + "whsec_" + "Y2ktZHVtbXk=AAAA'");
    expect(scanBundle(d)).toHaveLength(1);
  });
});
