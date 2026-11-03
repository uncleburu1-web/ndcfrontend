import { describe, expect, it } from "vitest";
import { buildHeaders, clerkFrontendApi, securityTxt } from "./security-headers.mjs";

const PK = "pk_test_" + Buffer.from("clerk.example.ng$").toString("base64");

describe("security headers (spec 14 §4.9)", () => {
  it("derives Clerk's Frontend API from the publishable key", () => {
    expect(clerkFrontendApi(PK)).toBe("https://clerk.example.ng");
    expect(clerkFrontendApi("not-a-key")).toBe("");
  });
  it("builds a strict CSP with the API and Clerk origins", () => {
    const h = buildHeaders({ VITE_API_BASE_URL: "https://api.example.ng/api/v1", VITE_CLERK_PUBLISHABLE_KEY: PK });
    const csp = h["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://clerk.example.ng");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("connect-src 'self' https://api.example.ng https://clerk.example.ng");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });
  it("writes security.txt with Expires one year out", () => {
    const now = new Date("2026-11-03T00:00:00Z");
    const txt = securityTxt({ VITE_SECURITY_CONTACT: "security@example.ng" }, now);
    expect(txt).toContain("Contact: mailto:security@example.ng");
    expect(txt).toContain("Expires: 2027-11-03T00:00:00Z");
    expect(txt).toContain("Policy: /security");
    expect(txt).toContain("Preferred-Languages: en");
    expect(securityTxt({}, now)).toBeNull();
  });
});
