import { runDiagnostic, DiagnosticKind } from "./diagnostics";
import { retrieveKnowledge } from "./knowledge";
import { getBalance, getTransactions } from "./moov-money";
import { createTicket, getTicket } from "./ticketing";

export type AssistantAction = {
  type: "navigate" | "suggest";
  label: string;
  href?: string;
  message?: string;
};

export type AssistantSource = { title: string; url: string };

export type AssistantResponse = {
  message: string;
  conversationId: string;
  intent: string;
  sources?: AssistantSource[];
  actions?: AssistantAction[];
  demo?: boolean;
};

const transferFees = [
  [100, 1000, 10], [1001, 5000, 50], [5001, 10000, 100], [10001, 20000, 150],
  [20001, 30000, 200], [30001, 40000, 250], [40001, 50000, 300], [50001, 60000, 350],
  [60001, 70000, 400], [70001, 80000, 450], [80001, 90000, 500], [90001, 100000, 550],
  [100001, 150000, 600], [150001, 160000, 650], [160001, 250000, 700], [250001, 300000, 750],
  [300001, 350000, 800], [350001, 400000, 850], [400001, 450000, 900], [450001, 500000, 1000],
] as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}

function formatMoney(value: number, currency = "FCFA") {
  return `${Math.round(value).toLocaleString("fr-FR")} ${currency === "XAF" ? "FCFA" : currency}`;
}

function parseAmount(message: string) {
  const normalized = normalize(message).replace(/(fcfa|xaf|francs?|f\b)/g, " ");
  const compact = normalized.match(/(\d+(?:[.,]\d+)?)\s*(k|m|million|millions|mille)\b/);
  if (compact) {
    const value = Number(compact[1].replace(",", "."));
    const multiplier = compact[2] === "k" || compact[2] === "mille" ? 1000 : 1_000_000;
    return Math.round(value * multiplier);
  }
  const matches = [...normalized.matchAll(/\b\d[\d\s.]*\b/g)]
    .map((match) => Number(match[0].replace(/[\s.]/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 100);
  return matches[0];
}

function transferFee(amount: number) {
  return transferFees.find(([minimum, maximum]) => amount >= minimum && amount <= maximum)?.[2];
}

function bestExcerpt(content: string, query: string) {
  const queryTokens = normalize(query).split(" ").filter((token) => token.length > 2);
  const sentences = content.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 25);
  const ranked = sentences
    .map((sentence) => ({ sentence, score: queryTokens.reduce((sum, token) => sum + (normalize(sentence).includes(token) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.sentence.trim());
  const excerpt = ranked.join(" ") || content.slice(0, 700);
  return excerpt.length > 900 ? `${excerpt.slice(0, 897)}…` : excerpt;
}

function sourceList(records: Awaited<ReturnType<typeof retrieveKnowledge>>) {
  return records.map((record) => ({ title: record.title, url: record.url })).filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index).slice(0, 3);
}

function demoCustomer(customerId?: string) {
  if (customerId) return { id: customerId, demo: false };
  const demoEnabled = process.env.MOOV_ASSIST_DEMO_MODE !== "false";
  return { id: demoEnabled ? "demo-user" : undefined, demo: demoEnabled };
}

async function answerKnowledge(message: string, conversationId: string): Promise<AssistantResponse> {
  const records = await retrieveKnowledge(message, 3);
  if (!records.length) {
    return {
      message: "Je n’ai pas trouvé une information suffisamment fiable dans la documentation Moov Money. Je peux vous orienter vers un conseiller ou créer une réclamation sans vous demander votre code PIN.",
      conversationId,
      intent: "fallback",
      actions: [
        { type: "navigate", label: "Ouvrir l’assistance", href: "/support" },
        { type: "suggest", label: "Créer une réclamation", message: "Créer une réclamation pour ma demande" },
      ],
    };
  }
  return {
    message: bestExcerpt(records[0].content, message),
    conversationId,
    intent: "knowledge_search",
    sources: sourceList(records),
    actions: [{ type: "navigate", label: "Voir l’assistance", href: "/support" }],
  };
}

export async function autonomousChat(
  message: string,
  userId: string,
  conversationId?: string,
  customerId?: string,
): Promise<AssistantResponse> {
  const conversation = conversationId || `moov-${crypto.randomUUID()}`;
  const text = normalize(message);
  const customer = demoCustomer(customerId);

  if (/^(bonjour|bonsoir|salut|hello|hey)\b/.test(text)) {
    return {
      message: "Bonjour 👋 Je suis Moov Assist. Je peux répondre sur les services Moov Money, calculer les frais, consulter votre solde et votre historique de démonstration, diagnostiquer un problème, suivre une réclamation ou préparer une opération sécurisée.",
      conversationId: conversation,
      intent: "greeting",
      actions: [
        { type: "suggest", label: "Consulter mon solde", message: "Quel est mon solde ?" },
        { type: "suggest", label: "Calculer des frais", message: "Combien coûte un retrait de 50 000 FCFA ?" },
      ],
      demo: customer.demo,
    };
  }

  if (/\b(solde|argent disponible|combien ai je)\b/.test(text) && !/uba|plafond|maximum/.test(text)) {
    if (!customer.id) return { message: "Connectez-vous pour consulter votre solde.", conversationId: conversation, intent: "balance_auth", actions: [{ type: "navigate", label: "Se connecter", href: "/auth" }] };
    const balance = await getBalance(customer.id) as { available?: number; currency?: string; updatedAt?: string; mock?: boolean };
    return {
      message: `Votre solde ${balance.mock || customer.demo ? "de démonstration " : ""}est de **${formatMoney(Number(balance.available || 0), balance.currency)}**.${balance.updatedAt ? ` Mise à jour : ${new Date(balance.updatedAt).toLocaleString("fr-FR")}.` : ""}`,
      conversationId: conversation,
      intent: "get_balance",
      actions: [{ type: "navigate", label: "Voir les paiements", href: "/payments" }],
      demo: Boolean(balance.mock || customer.demo),
    };
  }

  if (/\b(historique|dernieres operations|transactions recentes|mes transactions|mes operations)\b/.test(text)) {
    if (!customer.id) return { message: "Connectez-vous pour consulter vos opérations.", conversationId: conversation, intent: "history_auth", actions: [{ type: "navigate", label: "Se connecter", href: "/auth" }] };
    const data = await getTransactions(customer.id) as { items?: { label?: string; recipient?: string; amount?: number; createdAt?: string; status?: string }[]; mock?: boolean };
    const items = (data.items || []).slice(0, 5);
    const lines = items.length
      ? items.map((item, index) => `${index + 1}. ${item.label || item.recipient || "Opération"} — ${formatMoney(Number(item.amount || 0))}${item.status ? ` — ${item.status}` : ""}`).join("\n")
      : "Aucune opération récente n’est disponible.";
    return { message: `Voici vos dernières opérations ${data.mock || customer.demo ? "de démonstration" : ""} :\n${lines}`, conversationId: conversation, intent: "get_transactions", actions: [{ type: "navigate", label: "Ouvrir l’historique", href: "/payments" }], demo: Boolean(data.mock || customer.demo) };
  }

  const ticketReference = message.match(/MV-\d{4}-\d{4,6}/i)?.[0];
  if (ticketReference || /\b(suivre|statut|avancement)\b.*\b(reclamation|ticket|dossier)\b/.test(text)) {
    if (!ticketReference) return { message: "Indiquez le numéro de réclamation, par exemple **MV-2026-12345**.", conversationId: conversation, intent: "ticket_reference_required" };
    if (!customer.id) return { message: "Connectez-vous pour suivre cette réclamation.", conversationId: conversation, intent: "ticket_auth", actions: [{ type: "navigate", label: "Se connecter", href: "/auth" }] };
    try {
      const ticket = await getTicket(ticketReference, customer.id) as { id?: string; status?: string; assignedTeam?: string; mock?: boolean };
      return { message: `La réclamation **${ticket.id || ticketReference}** est actuellement **${ticket.status || "en traitement"}**. Équipe : ${ticket.assignedTeam || "Service client Moov Money"}.`, conversationId: conversation, intent: "get_ticket", actions: [{ type: "navigate", label: "Voir mes réclamations", href: "/support" }], demo: Boolean(ticket.mock || customer.demo) };
    } catch (error) {
      return { message: error instanceof Error ? error.message : "Réclamation introuvable.", conversationId: conversation, intent: "ticket_not_found", actions: [{ type: "navigate", label: "Ouvrir l’assistance", href: "/support" }] };
    }
  }

  if (/\b(cree|creer|ouvre|ouvrir|depose|deposer)\b.*\b(reclamation|ticket|plainte)\b/.test(text)) {
    if (!customer.id) return { message: "Connectez-vous pour créer une réclamation sécurisée.", conversationId: conversation, intent: "create_ticket_auth", actions: [{ type: "navigate", label: "Se connecter", href: "/auth" }] };
    const category = /transfert/.test(text) ? "Transfert" : /pin/.test(text) ? "PIN" : /solde/.test(text) ? "Solde" : /sim/.test(text) ? "SIM" : "Assistance";
    const ticket = await createTicket({ customerId: customer.id, category, description: message, conversationId: conversation, summary: `Réclamation ${category} créée par Moov Assist` });
    return { message: `Votre réclamation a été créée sous la référence **${ticket.id}**. Statut : **${ticket.status}**. Conservez cette référence pour le suivi.`, conversationId: conversation, intent: "create_ticket", actions: [{ type: "navigate", label: "Suivre la réclamation", href: "/support" }], demo: Boolean(ticket.mock || customer.demo) };
  }

  let diagnostic: DiagnosticKind | undefined;
  if (/pin.*(bloque|oublie|perdu)|reinitialis.*pin/.test(text)) diagnostic = "PIN_LOCKED";
  else if (/(sim|puce).*(probleme|perdu|perdue|vole|volee|inactive)|telephone.*vole/.test(text)) diagnostic = "SIM_ISSUE";
  else if (/transfert.*(attente|bloque|pending|traitement|pas arrive)/.test(text)) diagnostic = "TRANSFER_PENDING";
  else if (/solde.*(incorrect|faux|difference|pas.*jour)/.test(text)) diagnostic = "BALANCE_MISMATCH";
  if (diagnostic) {
    if (!customer.id) return { message: "Connectez-vous pour lancer le diagnostic sécurisé.", conversationId: conversation, intent: "diagnostic_auth", actions: [{ type: "navigate", label: "Se connecter", href: "/auth" }] };
    const result = await runDiagnostic(customer.id, diagnostic) as { recommendation?: string; requiresAgent?: boolean; mock?: boolean };
    return {
      message: `${result.recommendation || "Le diagnostic a été exécuté."}${result.requiresAgent ? " Une intervention humaine est recommandée." : ""}`,
      conversationId: conversation,
      intent: `diagnostic_${diagnostic.toLowerCase()}`,
      actions: result.requiresAgent ? [{ type: "navigate", label: "Contacter un conseiller", href: "/support" }] : [{ type: "suggest", label: "Vérifier mon historique", message: "Montre-moi mes dernières transactions" }],
      demo: Boolean(result.mock || customer.demo),
    };
  }

  const amount = parseAmount(message);
  if (amount && /\b(frais|cout|coute|tarif|commission)\b/.test(text)) {
    if (/retrait|retirer/.test(text)) {
      if (amount > 500_000) return { message: "Le retrait maximal public est de 500 000 FCFA par opération. Pour un montant supérieur, fractionnez uniquement selon les règles officielles ou contactez Moov Money.", conversationId: conversation, intent: "withdrawal_limit" };
      const fee = amount <= 160_000 ? amount * 0.03 : 5_000;
      return { message: `Pour un retrait de **${formatMoney(amount)}**, les frais indicatifs issus de la grille publique sont de **${formatMoney(fee)}**. Le montant total débité serait **${formatMoney(amount + fee)}**.`, conversationId: conversation, intent: "withdrawal_fee", sources: [{ title: "Grille tarifaire client", url: "https://moovmoney.ga/grille-tarifaire-client/" }] };
    }
    if (/transfert|envoyer|marchand|paiement/.test(text)) {
      const fee = transferFee(amount);
      return fee !== undefined
        ? { message: `Pour une opération de **${formatMoney(amount)}**, le barème public indique **${formatMoney(fee)}** de frais. Vérifiez toujours le récapitulatif affiché avant confirmation.`, conversationId: conversation, intent: "transfer_fee", sources: [{ title: "Grille tarifaire client", url: "https://moovmoney.ga/grille-tarifaire-client/" }] }
        : { message: "La grille publique structurée disponible dans le prototype détaille les tranches jusqu’à 500 000 FCFA. Pour ce montant, je vous recommande de vérifier le tarif affiché dans l’application avant validation.", conversationId: conversation, intent: "fee_out_of_range" };
    }
  }

  if (/\b(envoie|envoyer|transfere|transferer)\b.*\b(argent|fcfa|xaf|f\b|\d)/.test(text)) {
    const details = amount ? ` de **${formatMoney(amount)}**` : "";
    return {
      message: `Je peux préparer le transfert${details}, mais je ne l’exécute jamais directement depuis un message libre. Ouvrez le parcours sécurisé, vérifiez le bénéficiaire et le montant, puis confirmez avec votre passkey ou biométrie. Ne communiquez jamais votre PIN dans le chat.`,
      conversationId: conversation,
      intent: "prepare_transfer",
      actions: [{ type: "navigate", label: "Préparer le transfert", href: "/payments" }],
    };
  }

  if (/\b(recharge|credit|airtime)\b/.test(text) && !/frais|cout|coute|tarif/.test(text)) {
    return { message: `Je peux préparer ${amount ? `une recharge de **${formatMoney(amount)}**` : "une recharge"} pour votre numéro ou celui d’un proche. La validation finale se fait dans le parcours sécurisé.`, conversationId: conversation, intent: "prepare_airtime", actions: [{ type: "navigate", label: "Acheter du crédit", href: "/payments" }] };
  }

  if (/\b(paie|payer|regle|regler)\b.*\b(seeg|edan|canal|satcon|fibre|adsl|facture|campus france)\b/.test(text)) {
    return { message: `Je peux préparer ${amount ? `un paiement de **${formatMoney(amount)}**` : "le paiement"}. Vous devrez choisir le fournisseur, saisir la référence, vérifier le récapitulatif et confirmer avec la biométrie ou une passkey.`, conversationId: conversation, intent: "prepare_bill", actions: [{ type: "navigate", label: "Payer une facture", href: "/payments" }] };
  }

  if (/\b(conseiller|humain|agent|support|contact)\b/.test(text)) {
    return { message: "Vous pouvez ouvrir l’espace Assistance pour lancer un diagnostic, créer une réclamation ou suivre un ticket. Le site public affiche également le +241 11 79 22 00 et contact@moovmoney.ga. Ne transmettez jamais votre PIN.", conversationId: conversation, intent: "human_support", actions: [{ type: "navigate", label: "Ouvrir l’assistance", href: "/support" }], sources: [{ title: "Contact Moov Money", url: "https://moovmoney.ga/contact/" }] };
  }

  return answerKnowledge(message, conversation);
}
