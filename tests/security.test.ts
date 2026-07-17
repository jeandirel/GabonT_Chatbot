import { describe, expect, it } from "vitest";
import { rateLimit } from "../lib/server/rate-limit";
import { storePrivateFile } from "../lib/server/storage";

describe("security utilities", () => {
  it("blocks a request bucket after its allowed quota", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 2, 60_000).allowed).toBe(false);
  });

  it("hashes an uploaded document even when development storage is not configured", async () => {
    const stored = await storePrivateFile({ bytes: new TextEncoder().encode("identity-document"), fileName: "identity.png", mimeType: "image/png", namespace: "identity" });
    expect(stored.sha256).toHaveLength(64);
    expect(stored.persisted).toBe(false);
  });
});
