export class IntegrationError extends Error {
  constructor(public service: string, public status: number, message: string, public requestId?: string) {
    super(message);
  }
}

export async function apiFetch<T>(service: string, url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `${service} indisponible`;
      throw new IntegrationError(service, response.status, message, requestId);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new IntegrationError(service, 504, `Délai dépassé pour ${service}`);
    throw new IntegrationError(service, 502, `Connexion impossible à ${service}`);
  } finally {
    clearTimeout(timer);
  }
}

export function bearerHeaders(token?: string) {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
