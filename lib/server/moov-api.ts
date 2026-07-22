/** Client HTTP vers l’API FastAPI Moov Assist (séparée du frontend Next.js). */

const DEFAULT_LOCAL = "http://127.0.0.1:8020";
/** Fallback teste / preview tant que les env Vercel ne sont pas configurées. */
export const DEFAULT_DEPLOYED_API = "https://api-production-c0fd.up.railway.app";

export function moovApiBase(): string {
  const fromEnv = (process.env.MOOV_API_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return DEFAULT_DEPLOYED_API;
  return DEFAULT_LOCAL;
}

export type MoovChatResult = {
  message: string;
  spoken?: string;
  conversationId: string;
  language?: string;
  sources?: unknown[];
  engine?: string;
  approved?: boolean;
  steps?: string[];
  providers_used?: string[];
  audio_base64?: string;
  audio_mime?: string;
  tts_engine?: string;
  transcript?: string;
  stt_engine?: string;
};

export async function moovApiChat(input: {
  message: string;
  conversationId?: string;
  language?: string;
  userId?: string;
  includeAudio?: boolean;
}): Promise<MoovChatResult> {
  const res = await fetch(`${moovApiBase()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.error || `API Moov indisponible (${res.status})`);
  }
  return data as MoovChatResult;
}

export async function moovApiVoiceTurn(form: FormData): Promise<MoovChatResult> {
  const res = await fetch(`${moovApiBase()}/api/voice/turn`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : data.error;
    throw new Error(detail || `API voice indisponible (${res.status})`);
  }
  return data as MoovChatResult;
}
