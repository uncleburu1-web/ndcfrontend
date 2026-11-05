/** Guard: spec 17 left "Communities" in the main nav twice. Every nav item appears once. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/react", async () => (await import("../../test/clerkMock")).clerkMockModule);

import { NAV } from "./AppLayout";

describe("main nav", () => {
  it("lists each label and link once", () => {
    expect(new Set(NAV.map((n) => n.label)).size).toBe(NAV.length);
    expect(new Set(NAV.map((n) => n.href)).size).toBe(NAV.length);
  });
});
