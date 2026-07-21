import { createHash } from "node:crypto";
import { db, hasDatabase } from "./db";
import { KnowledgeRecord, knowledgeSeed, officialPages } from "./knowledge-seed";

const globalKnowledge = globalThis as unknown as {
  moovKnowledgeCache?: KnowledgeRecord[];
  moovKnowledgeLastSync?: string;
};

const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "et", "est", "il", "je", "la", "le", "les", "leur", "lui", "ma", "mais", "me", "mes", "mon", "ne", "nos", "notre", "nous", "on", "ou", "par", "pas", "pour", "qu", "que", "qui", "sa", "se", "ses", "son", "sur", "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre", "vous", "comment", "combien", "faire", "peux", "puis", "veux",
]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+* ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cleanHtml(html: string) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<body[\s\S]*?<\/body>/i)?.[0] || html;
  return decodeHtml(
    main
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000);
}

function titleFromHtml(html: string, url: string) {
  const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return raw ? decodeHtml(raw).replace(/\s+/g, " ").trim() : new URL(url).pathname.replaceAll("-", " ");
}

function categoryFromUrl(url: string) {
  const path = new URL(url).pathname;
  if (path.includes("tarif")) return "Tarifs";
  if (path.includes("bank") || path.includes("uba") || path.includes("visa")) return "Banking";
  if (path.includes("marchand")) return "Marchand";
  if (path.includes("revendeur")) return "Revendeur";
  if (path.includes("international") || path.includes("gimac") || path.includes("remittence")) return "International";
  if (path.includes("contact")) return "Support";
  return "Services";
}

async function crawlPage(url: string): Promise<KnowledgeRecord> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MoovAssistKnowledgeAgent/1.0 (+https://github.com/jeandirel/GabonT_Chatbot)" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const content = cleanHtml(html);
    if (content.length < 80) throw new Error("Contenu exploitable insuffisant");
    return {
      id: createHash("sha256").update(url).digest("hex").slice(0, 24),
      title: titleFromHtml(html, url),
      category: categoryFromUrl(url),
      content,
      url,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function scoreRecord(query: string, record: KnowledgeRecord) {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return 0;
  const title = normalize(record.title);
  const category = normalize(record.category);
  const body = normalize(record.content);
  const keywordText = normalize((record.keywords || []).join(" "));
  let score = 0;
  for (const token of queryTokens) {
    if (title.includes(token)) score += 8;
    if (category.includes(token)) score += 5;
    if (keywordText.includes(token)) score += 6;
    const occurrences = body.split(token).length - 1;
    score += Math.min(occurrences, 5);
  }
  const phrase = normalize(query);
  if (phrase.length > 5 && body.includes(phrase)) score += 14;
  return score;
}

async function persistedKnowledge() {
  if (!hasDatabase()) return [] as KnowledgeRecord[];
  try {
    const rows = await db().knowledgeDocument.findMany({ orderBy: { fetchedAt: "desc" }, take: 250 });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      content: row.content,
      url: row.url,
      fetchedAt: row.fetchedAt.toISOString(),
    }));
  } catch {
    return [] as KnowledgeRecord[];
  }
}

export async function retrieveKnowledge(query: string, limit = 4) {
  const persisted = await persistedKnowledge();
  const dynamic = persisted.length ? persisted : globalKnowledge.moovKnowledgeCache || [];
  const unique = new Map<string, KnowledgeRecord>();
  for (const record of [...knowledgeSeed, ...dynamic]) unique.set(record.url + record.id, record);
  return [...unique.values()]
    .map((record) => ({ record, score: scoreRecord(query, record) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({ ...item.record, score: item.score }));
}

export async function syncOfficialKnowledge() {
  const startedAt = new Date();
  let runId: string | undefined;
  if (hasDatabase()) {
    try {
      const run = await db().knowledgeSyncRun.create({ data: { status: "RUNNING" } });
      runId = run.id;
    } catch {
      // La migration peut ne pas encore avoir été appliquée. Le cache mémoire reste utilisable.
    }
  }

  const settled = await Promise.allSettled(officialPages.map((url) => crawlPage(url)));
  const documents = settled
    .filter((result): result is PromiseFulfilledResult<KnowledgeRecord> => result.status === "fulfilled")
    .map((result) => result.value);
  const errors = settled
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));

  globalKnowledge.moovKnowledgeCache = documents;
  globalKnowledge.moovKnowledgeLastSync = new Date().toISOString();

  let updated = 0;
  if (hasDatabase()) {
    for (const document of documents) {
      try {
        const contentHash = createHash("sha256").update(document.content).digest("hex");
        await db().knowledgeDocument.upsert({
          where: { url: document.url },
          update: { title: document.title, category: document.category, content: document.content, contentHash, fetchedAt: new Date(document.fetchedAt || Date.now()) },
          create: { id: document.id, url: document.url, title: document.title, category: document.category, content: document.content, contentHash, fetchedAt: new Date(document.fetchedAt || Date.now()) },
        });
        updated += 1;
      } catch {
        // Le moteur continue avec le cache mémoire et le corpus embarqué.
      }
    }
    if (runId) {
      try {
        await db().knowledgeSyncRun.update({
          where: { id: runId },
          data: {
            status: documents.length ? "COMPLETED" : "FAILED",
            pagesFound: documents.length,
            pagesUpdated: updated,
            error: errors.length ? errors.slice(0, 10).join(" | ") : null,
            finishedAt: new Date(),
          },
        });
      } catch {
        // Sans effet sur le fonctionnement conversationnel.
      }
    }
  }

  return {
    status: documents.length ? "completed" : "failed",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    pagesRequested: officialPages.length,
    pagesFetched: documents.length,
    pagesPersisted: updated,
    errors: errors.slice(0, 10),
    storage: updated ? "postgresql" : "memory",
  };
}

export async function knowledgeStatus() {
  const persisted = await persistedKnowledge();
  return {
    seedDocuments: knowledgeSeed.length,
    liveDocuments: persisted.length || globalKnowledge.moovKnowledgeCache?.length || 0,
    lastSyncAt: persisted[0]?.fetchedAt || globalKnowledge.moovKnowledgeLastSync || null,
    storage: persisted.length ? "postgresql" : globalKnowledge.moovKnowledgeCache?.length ? "memory" : "embedded-seed",
  };
}
