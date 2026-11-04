import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { ApiRequest } from "../auth/api";
import { apiGet, apiPost, fill, type GetResponse, type Schema } from "./typed";

describe("typed API helpers", () => {
  it("fills path parameters", () => {
    expect(fill("/candidates/{slug}/posts/{id}/", { slug: "amina bello", id: 3 })).toBe("/candidates/amina%20bello/posts/3/");
  });

  it("types answers from the schema", async () => {
    const api = vi.fn(async () => ({ unread: 3 })) as unknown as ApiRequest;
    const r = await apiGet(api, "/me/notifications/unread-count/");
    expectTypeOf(r).toEqualTypeOf<GetResponse<"/me/notifications/unread-count/">>();
    expectTypeOf(r.unread).toEqualTypeOf<number>();
    expect(r.unread).toBe(3);
    const n = {} as Schema<"Notification">;
    expectTypeOf(n.kind).toEqualTypeOf<Schema<"NotificationKindEnum">>();
  });

  it("posts typed bodies", async () => {
    const api = vi.fn(async () => ({ mode: "server" })) as unknown as ApiRequest;
    const r = await apiPost(api, "/media/upload-signature/", { purpose: "post_image", target_id: "p1" });
    expect(r.mode).toBe("server");
    expect((api as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual(["/media/upload-signature/",
      { method: "POST", body: { purpose: "post_image", target_id: "p1" } }]);
  });
});
