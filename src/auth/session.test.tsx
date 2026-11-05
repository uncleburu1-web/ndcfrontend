/** The session's API client must keep one identity (effects depend on it). */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
import { SessionProvider, useApi } from "./session";

const seen = new Set<unknown>();
function Probe() {
  const api = useApi();
  const navigate = useNavigate();
  useEffect(() => {
    seen.add(api);
  });
  return <button onClick={() => navigate(Math.random() > 2 ? "/x" : `/page-${seen.size}-${Date.now()}`)}>go</button>;
}

afterEach(cleanup);

it("useApi() is stable across re-renders and route changes", () => {
  const { rerender } = render(
    <MemoryRouter initialEntries={["/"]}>
      <SessionProvider><Routes><Route path="*" element={<Probe />} /></Routes></SessionProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: "go" }));
  fireEvent.click(screen.getByRole("button", { name: "go" }));
  rerender(
    <MemoryRouter initialEntries={["/"]}>
      <SessionProvider><Routes><Route path="*" element={<Probe />} /></Routes></SessionProvider>
    </MemoryRouter>
  );
  expect(seen.size).toBe(1);
});
