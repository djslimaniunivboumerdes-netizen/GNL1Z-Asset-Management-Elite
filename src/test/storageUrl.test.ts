import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStorageUrlCache,
  publicUrlFor,
  resolveStorageUrl,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/storageUrl";

/** Minimal stand-in for the Supabase storage client. */
function fakeClient(options: { signedUrl?: string | null; error?: string | null } = {}) {
  const createSignedUrl = vi.fn(async (_path: string, _ttl: number) => ({
    data: options.signedUrl === null ? null : { signedUrl: options.signedUrl ?? "https://signed.example/x?token=abc" },
    error: options.error ? { message: options.error } : null,
  }));
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://public.example/${path}` } }));
  return {
    storage: { from: () => ({ createSignedUrl, getPublicUrl }) },
    createSignedUrl,
    getPublicUrl,
  };
}

beforeEach(() => clearStorageUrlCache());

describe("storage URL resolution", () => {
  it("prefers a short-lived signed URL over a public one", async () => {
    const client = fakeClient({ signedUrl: "https://signed.example/photo?token=1" });
    const url = await resolveStorageUrl(client as never, "equipment-photos", "X01-E-501/user/1.webp");
    expect(url).toBe("https://signed.example/photo?token=1");
    expect(client.createSignedUrl).toHaveBeenCalledWith("X01-E-501/user/1.webp", SIGNED_URL_TTL_SECONDS);
  });

  it("asks for a bounded lifetime so a shared link stops working", async () => {
    const client = fakeClient();
    await resolveStorageUrl(client as never, "equipment-photos", "a/b.webp");
    const [, ttl] = client.createSignedUrl.mock.calls[0];
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it("reuses the signed URL until it is about to expire", async () => {
    const client = fakeClient();
    await resolveStorageUrl(client as never, "b", "p.webp");
    await resolveStorageUrl(client as never, "b", "p.webp");
    expect(client.createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the public URL while a bucket is still public", async () => {
    const client = fakeClient({ error: "object not found" });
    const url = await resolveStorageUrl(client as never, "equipment-images", "dcs/a.jpg");
    expect(url).toBe("https://public.example/dcs/a.jpg");
  });

  it("falls back to the public URL when signing throws", async () => {
    const client = {
      storage: {
        from: () => ({
          createSignedUrl: async () => {
            throw new Error("network down");
          },
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://public.example/${p}` } }),
        }),
      },
    };
    await expect(resolveStorageUrl(client as never, "b", "p.webp")).resolves.toBe("https://public.example/p.webp");
  });

  it("returns null rather than a broken URL for an empty path", async () => {
    const client = fakeClient();
    await expect(resolveStorageUrl(client as never, "b", "")).resolves.toBeNull();
    expect(client.createSignedUrl).not.toHaveBeenCalled();
  });

  it("exposes the public URL helper for call sites that explicitly want it", () => {
    const client = fakeClient();
    expect(publicUrlFor(client as never, "b", "p.webp")).toBe("https://public.example/p.webp");
  });
});
