import { apiFetch, bearerHeaders } from "./http";
import { db, hasDatabase } from "./db";
import { audit } from "./audit";

export type TicketInput = { customerId: string; category: string; description: string; conversationId?: string; summary?: string };

export async function createTicket(input: TicketInput) {
  const reference = `MV-2026-${Math.floor(10000 + Math.random() * 89999)}`;
  const external = process.env.TICKETING_API_URL ? await apiFetch<{ id?: string; status?: string }>("Ticketing", `${process.env.TICKETING_API_URL}/tickets`, { method: "POST", headers: bearerHeaders(process.env.TICKETING_API_KEY), body: JSON.stringify(input) }) : undefined;
  if (hasDatabase()) {
    const user = await db().user.upsert({ where: { phone: input.customerId }, update: {}, create: { phone: input.customerId } });
    const ticket = await db().ticket.create({ data: { reference, category: input.category, description: input.description, summary: input.summary, conversationId: input.conversationId, externalId: external?.id, userId: user.id } });
    await audit("ticket.create", "ticket", "success", { userId: user.id, resourceId: ticket.id, metadata: { reference, category: input.category } });
  }
  return { id: reference, externalId: external?.id, status: external?.status || "open", createdAt: new Date().toISOString(), persisted: hasDatabase(), mock: !process.env.TICKETING_API_URL };
}

export async function getTicket(ticketId: string, customerId?: string) {
  if (hasDatabase() && customerId) {
    const ticket = await db().ticket.findFirst({ where: { OR: [{ id: ticketId }, { reference: ticketId }], user: { phone: customerId } } });
    if (!ticket) throw new Error("Réclamation introuvable pour ce compte.");
    if (!process.env.TICKETING_API_URL || !ticket.externalId) return { id: ticket.reference, status: ticket.status.toLowerCase(), assignedTeam: "Service client Moov Money", createdAt: ticket.createdAt, updatedAt: ticket.updatedAt };
    ticketId = ticket.externalId;
  }
  if (!process.env.TICKETING_API_URL) return { id: ticketId, status: "in_progress", assignedTeam: "Service client Moov Money", mock: true };
  return apiFetch("Ticketing", `${process.env.TICKETING_API_URL}/tickets/${encodeURIComponent(ticketId)}`, { headers: bearerHeaders(process.env.TICKETING_API_KEY) });
}
