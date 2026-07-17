import { apiFetch, bearerHeaders } from "./http";

export type TicketInput = { customerId: string; category: string; description: string; conversationId?: string; summary?: string };

export async function createTicket(input: TicketInput) {
  if (!process.env.TICKETING_API_URL) return { id: `MV-2026-${Math.floor(10000 + Math.random() * 89999)}`, status: "open", createdAt: new Date().toISOString(), mock: true };
  return apiFetch("Ticketing", `${process.env.TICKETING_API_URL}/tickets`, { method: "POST", headers: bearerHeaders(process.env.TICKETING_API_KEY), body: JSON.stringify(input) });
}

export async function getTicket(ticketId: string) {
  if (!process.env.TICKETING_API_URL) return { id: ticketId, status: "in_progress", assignedTeam: "Service client Moov Money", mock: true };
  return apiFetch("Ticketing", `${process.env.TICKETING_API_URL}/tickets/${encodeURIComponent(ticketId)}`, { headers: bearerHeaders(process.env.TICKETING_API_KEY) });
}
