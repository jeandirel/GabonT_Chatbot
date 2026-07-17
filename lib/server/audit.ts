import { createHash } from "node:crypto";
import { db, hasDatabase } from "./db";

export async function audit(action: string, resource: string, outcome: string, options: { resourceId?: string; userId?: string; metadata?: Record<string, unknown> } = {}) {
  if (!hasDatabase()) return;
  const previous = await db().auditEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { hash: true } });
  const canonical = JSON.stringify({ action, resource, outcome, ...options, previousHash: previous?.hash || null, timestamp: new Date().toISOString() });
  const hash = createHash("sha256").update(canonical).digest("hex");
  await db().auditEvent.create({ data: { action, resource, outcome, resourceId: options.resourceId, userId: options.userId, metadata: options.metadata as object | undefined, previousHash: previous?.hash, hash } });
}
