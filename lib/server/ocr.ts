import { createHash } from "node:crypto";

export type OcrResult = {
  text: string;
  confidence: number;
  sha256: string;
  fields: { documentNumber?: string; birthDate?: string; expiryDate?: string; surname?: string; givenNames?: string };
};

function first(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
}

function extract(text: string): OcrResult["fields"] {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  return {
    documentNumber: first(normalized, [/(?:N[°O]|NUM[ÉE]RO|DOCUMENT)\s*[:#-]?\s*([A-Z0-9-]{5,20})/i, /\b([A-Z]{1,3}\d{6,12})\b/]),
    birthDate: first(normalized, [/(?:N[ÉE]\s+LE|NAISSANCE|BIRTH)\s*[:#-]?\s*(\d{2}[/.\-]\d{2}[/.\-]\d{4})/i]),
    expiryDate: first(normalized, [/(?:EXPIRE|EXPIRATION|VALIDIT[ÉE])\s*[:#-]?\s*(\d{2}[/.\-]\d{2}[/.\-]\d{4})/i]),
    surname: first(normalized, [/(?:NOM|SURNAME)\s*[:#-]?\s*([A-ZÀ-ÖØ-Ý' -]{2,40})/i]),
    givenNames: first(normalized, [/(?:PR[ÉE]NOMS?|GIVEN NAMES?)\s*[:#-]?\s*([A-ZÀ-ÖØ-Ý' -]{2,50})/i]),
  };
}

export async function recognizeIdentityDocument(bytes: Uint8Array): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["fra", "eng"]);
  try {
    const result = await worker.recognize(Buffer.from(bytes));
    const text = result.data.text.trim();
    return { text, confidence: result.data.confidence, sha256: createHash("sha256").update(bytes).digest("hex"), fields: extract(text) };
  } finally {
    await worker.terminate();
  }
}
