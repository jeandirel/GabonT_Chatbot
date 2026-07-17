import { apiFetch, bearerHeaders } from "./http";
import { createTicket, getTicket } from "./ticketing";
import { getBalance, getTransactions } from "./moov-money";

type Part = { type: string; text?: string; toolCallId?: string; toolName?: string; input?: Record<string, unknown> };
type ChatbaseResponse = { data: { id: string; parts: Part[]; metadata: { conversationId: string; finishReason: string; userId?: string } } };

const base = "https://www.chatbase.co/api/v2";
const allowedActions = new Set(["getBalance", "getTransactions", "createSupportTicket", "getSupportTicket"]);

async function executeAction(toolName: string, input: Record<string, unknown>, customerId: string) {
  if (!allowedActions.has(toolName)) return { success: false, error: "Action non autorisée" };
  if (toolName === "getBalance") return getBalance(customerId);
  if (toolName === "getTransactions") return getTransactions(customerId);
  if (toolName === "getSupportTicket") return getTicket(String(input.ticketId || ""));
  return createTicket({ customerId, category: String(input.category || "Assistance"), description: String(input.description || "Demande créée depuis Moov Assist"), conversationId: String(input.conversationId || "") });
}

async function requestChat(body: Record<string, unknown>) {
  return apiFetch<ChatbaseResponse>("Chatbase", `${base}/agents/${process.env.CHATBASE_AGENT_ID}/chat`, { method: "POST", headers: bearerHeaders(process.env.CHATBASE_API_KEY), body: JSON.stringify({ ...body, stream: false }) }, 20000);
}

export async function chat(message: string, userId: string, conversationId?: string) {
  if (!process.env.CHATBASE_API_KEY || !process.env.CHATBASE_AGENT_ID) {
    return { message: "Mode démonstration actif. Ajoutez CHATBASE_API_KEY et CHATBASE_AGENT_ID pour utiliser la documentation Moov Assist chargée dans Chatbase.", conversationId: conversationId || `demo-${crypto.randomUUID()}`, mock: true };
  }
  let response = await requestChat({ message, userId, ...(conversationId ? { conversationId } : {}) });
  const calls = response.data.parts.filter(part => part.type === "tool-call" && part.toolCallId && part.toolName);
  for (const call of calls) {
    const output = await executeAction(call.toolName!, call.input || {}, userId);
    await apiFetch("Chatbase", `${base}/agents/${process.env.CHATBASE_AGENT_ID}/conversations/${response.data.metadata.conversationId}/tool-result`, { method: "POST", headers: bearerHeaders(process.env.CHATBASE_API_KEY), body: JSON.stringify({ toolCallId: call.toolCallId, output }) });
  }
  if (calls.length) response = await requestChat({ conversationId: response.data.metadata.conversationId });
  const text = response.data.parts.filter(part => part.type === "text").map(part => part.text).filter(Boolean).join("\n");
  return { message: text || "Je n’ai pas pu générer une réponse fiable. Souhaitez-vous parler à un conseiller ?", conversationId: response.data.metadata.conversationId, messageId: response.data.id };
}
