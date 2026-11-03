/** Profile setup form — spec §7.6, §12, AC 2. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { onProfileCompleted } from "./events";
import type { Me } from "./session";

const session = vi.hoisted(() => ({ api: vi.fn(), setMe: vi.fn(), adult: true }));
vi.mock("./session", () => ({
  useApi: () => session.api,
  useMe: () => ({ me: { full_name: "Ada Obi", phone_number: "", adult_confirmed: session.adult }, status: "ready", error: null,
    setMe: session.setMe, refresh: vi.fn() }),
}));

import { ProfileForm } from "./ProfileForm";

const base: Me = { id: "1", email: "a@b.c", full_name: "Ada Obi", phone_number: "+2348031234567", profile_complete: true, roles: [], is_system_admin: false };

function fillAndSubmit(phone = "0803 123 4567") {
  fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: phone } });
  fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
}

beforeEach(() => {
  session.api.mockReset();
  session.setMe.mockReset();
  render(<MemoryRouter><ProfileForm submitLabel="Finish setup" busyLabel="Saving…" /></MemoryRouter>);
});
afterEach(cleanup);

describe("ProfileForm", () => {
  it("prefills the name and PATCHes /me with both fields", async () => {
    session.api.mockResolvedValue(base);
    expect((screen.getByLabelText(/Full name/) as HTMLInputElement).value).toBe("Ada Obi");
    fillAndSubmit();
    await waitFor(() => expect(session.api).toHaveBeenCalledOnce());
    expect(session.api).toHaveBeenCalledWith("/me/", { method: "PATCH", body: { full_name: "Ada Obi", phone_number: "0803 123 4567" } });
    await waitFor(() => expect(session.setMe).toHaveBeenCalledWith(base));
  });

  it("emits profile:completed exactly once when the API says just_completed", async () => {
    const seen = vi.fn();
    const off = onProfileCompleted(seen);
    session.api.mockResolvedValueOnce({ ...base, just_completed: true }).mockResolvedValueOnce(base);
    fillAndSubmit();
    await waitFor(() => expect(session.setMe).toHaveBeenCalledTimes(1));
    fillAndSubmit("0909 000 1111");
    await waitFor(() => expect(session.setMe).toHaveBeenCalledTimes(2));
    expect(seen).toHaveBeenCalledOnce();
    off();
  });

  it("shows field errors from the API envelope inline", async () => {
    session.api.mockRejectedValue(
      new ApiError({ status: 400, code: "validation_error", message: "Please correct the highlighted fields.", fields: { phone_number: ["Enter a Nigerian mobile number, like 0803 123 4567."] } })
    );
    fillAndSubmit("12345");
    expect(await screen.findByText("Enter a Nigerian mobile number, like 0803 123 4567.")).toBeTruthy();
    const phone = screen.getByLabelText(/Phone number/);
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(session.setMe).not.toHaveBeenCalled();
  });

  it("shows non-field errors as a banner", async () => {
    session.api.mockRejectedValue(new ApiError({ status: 503, code: "auth_unavailable", message: "Sign-in is temporarily unavailable. Try again shortly." }));
    fillAndSubmit();
    expect(await screen.findByText("Sign-in is temporarily unavailable. Try again shortly.")).toBeTruthy();
  });
});

describe("ProfileForm 18+ (spec 14 §4.3)", () => {
  beforeEach(() => {
    cleanup();
    session.adult = false;
    render(<MemoryRouter><ProfileForm submitLabel="Finish setup" busyLabel="Saving…" /></MemoryRouter>);
  });
  afterEach(() => {
    session.adult = true;
  });

  it("needs the 18+ tick, then sends adult_confirmed", async () => {
    session.api.mockResolvedValue(base);
    fillAndSubmit();
    expect(await screen.findByText("Tick this to confirm you’re 18 or older.")).toBeTruthy();
    expect(session.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/I’m 18 or older/));
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => expect(session.api).toHaveBeenCalledWith("/me/", {
      method: "PATCH", body: { full_name: "Ada Obi", phone_number: "0803 123 4567", adult_confirmed: true },
    }));
  });

  it("explains the age limit and offers deletion to under-18s", () => {
    fireEvent.click(screen.getByRole("button", { name: "I’m under 18" }));
    expect(screen.getByText("NDCConnect is for voters")).toBeTruthy();
    expect(screen.getByRole("link", { name: "delete your account" }).getAttribute("href")).toBe("/account/privacy#delete");
  });
});
