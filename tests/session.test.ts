import { beforeEach, describe, expect, it } from "vitest";
import { createConfirmationToken, createSessionToken, verifyConfirmationToken, verifySessionToken } from "../lib/server/session";

describe("session tokens", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters"; });

  it("signs and verifies a customer session", async () => {
    const token = await createSessionToken("customer-123");
    await expect(verifySessionToken(token)).resolves.toBe("customer-123");
  });

  it("binds a strong confirmation to the exact transaction context", async () => {
    const context = { type: "transfer", recipient: "06123456", amount: 2500 };
    const token = await createConfirmationToken("customer-123", context);
    await expect(verifyConfirmationToken(token)).resolves.toEqual({ userId: "customer-123", context });
  });
});
