"""RAG hiérarchique Moov Assist — seed JSON + corpus `data/` Moov Money."""

from __future__ import annotations

import csv
import json
import os
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
ROOT = API_DIR.parent
SEED = API_DIR / "knowledge" / "seed_faq.json"
SCRAPED = API_DIR / "knowledge" / "scraped.json"
_DEFAULT_DATA = ROOT / "data" / "moov_money_chatbot_dataset_complete_2026-07-21"
_BUNDLED_DATA = API_DIR / "data" / "moov_money_chatbot_dataset_complete_2026-07-21"
DATA_DIR = Path(
    os.getenv("MOOV_DATA_DIR")
    or (_BUNDLED_DATA if _BUNDLED_DATA.is_dir() else _DEFAULT_DATA)
)

# Priorité des couches pour le contexte (plus haut = préféré à score égal).
LAYER_PRIORITY = {
    "faq": 1.0,
    "knowledge": 0.92,
    "procedure": 0.88,
    "pricing": 0.9,
    "support": 0.85,
    "seed": 0.8,
    "scraped": 0.75,
    "anomaly": 0.55,
}

TARIFF_HINTS = {
    "tarif",
    "tarifs",
    "frais",
    "cout",
    "coût",
    "prix",
    "combien",
    "fee",
    "fees",
    "cost",
    "price",
    "grille",
}
PROCEDURE_HINTS = {
    "comment",
    "how",
    "etape",
    "étape",
    "procedure",
    "procédure",
    "faire",
    "ouvrir",
    "activer",
    "composer",
    "ussd",
    "*555",
    "555",
}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9*\s]", " ", text.lower())


def _tokens(text: str) -> set[str]:
    stop = {
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "en",
        "au", "aux", "pour", "par", "sur", "avec", "dans", "je", "tu", "il",
        "the", "and", "or", "to", "of", "in", "on", "for", "is", "are", "my",
        "quoi", "comment", "quel", "quelle", "est", "mon", "ma", "mes", "ce",
        "cette", "vos", "votre", "une", "pas",
    }
    return {t for t in _normalize(text).split() if len(t) > 2 and t not in stop}


def _split_variants(raw: str) -> list[str]:
    if not raw:
        return []
    return [p.strip() for p in re.split(r"\s*\|\s*", raw) if p.strip()]


@dataclass
class Doc:
    title: str
    content: str
    content_en: str = ""
    tags: str = ""
    source_url: str = ""
    source_type: str = "faq"
    intent: str = ""
    category: str = ""
    layer: str = "seed"
    doc_id: str = ""
    confidence: float = 0.5


@dataclass
class IntentNode:
    name: str
    category: str
    utterances: list[str] = field(default_factory=list)
    response_scope: str = ""
    source_url: str = ""
    tokens: set[str] = field(default_factory=set)


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    # utf-8-sig gère le BOM éventuel des exports.
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def _items_from_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _load_intents(dataset: Path) -> list[IntentNode]:
    rows = _read_csv(dataset / "moov_money_intents_2026-07-21.csv")
    nodes: list[IntentNode] = []
    for row in rows:
        name = (row.get("intent_name") or "").strip()
        if not name:
            continue
        utts = [row.get("example_utterance") or ""]
        utts.extend(_split_variants(row.get("alternative_utterances") or ""))
        utts = [u for u in utts if u]
        blob = " ".join([name, row.get("category") or "", *utts])
        nodes.append(
            IntentNode(
                name=name,
                category=(row.get("category") or "").strip(),
                utterances=utts,
                response_scope=(row.get("response_scope") or "").strip(),
                source_url=(row.get("source_url") or "").strip(),
                tokens=_tokens(blob),
            )
        )
    return nodes


def _load_dataset_docs(dataset: Path) -> list[Doc]:
    docs: list[Doc] = []

    for row in _read_csv(dataset / "moov_money_faq_2026-07-21.csv"):
        q = (row.get("question") or "").strip()
        a = (row.get("answer") or "").strip()
        if not q or not a:
            continue
        variants = row.get("question_variants") or ""
        notice = (row.get("security_notice") or "").strip()
        body = a
        if notice:
            body = f"{a}\n\nSécurité : {notice}"
        tags = ", ".join(
            x
            for x in [
                row.get("intent") or "",
                row.get("category") or "",
                "faq",
                "moov money",
                * _tokens(variants),
            ]
            if x
        )
        docs.append(
            Doc(
                title=q,
                content=body,
                tags=tags,
                source_url=(row.get("source_url") or "").strip(),
                source_type="faq",
                intent=(row.get("intent") or "").strip(),
                category=(row.get("category") or "").strip(),
                layer="faq",
                doc_id=(row.get("faq_id") or "").strip(),
                confidence=float(row.get("confidence_score") or 0.65),
            )
        )

    for row in _read_csv(dataset / "moov_money_chatbot_knowledge_2026-07-21.csv"):
        title = (row.get("title") or row.get("user_question") or "").strip()
        answer = (row.get("chatbot_answer") or "").strip()
        detail = (row.get("detailed_context") or "").strip()
        procedure = (row.get("procedure") or "").strip()
        fees = (row.get("fee_information") or "").strip()
        limits = (row.get("limit_information") or "").strip()
        parts = [p for p in [answer, detail, procedure, fees, limits] if p]
        if not title or not parts:
            continue
        notice = (row.get("security_notice") or "").strip()
        if notice:
            parts.append(f"Sécurité : {notice}")
        ussd = (row.get("ussd_code") or "").strip()
        if ussd:
            parts.append(f"USSD : {ussd}")
        docs.append(
            Doc(
                title=title,
                content="\n".join(parts),
                tags=(row.get("keywords") or row.get("intent") or "").strip(),
                source_url=(row.get("source_url") or "").strip(),
                source_type=(row.get("record_type") or "knowledge").strip(),
                intent=(row.get("intent") or "").strip(),
                category=(row.get("category") or "").strip(),
                layer="knowledge",
                doc_id=(row.get("chunk_id") or "").strip(),
                confidence=float(row.get("confidence_score") or 0.7),
            )
        )

    # Procédures : agrégation par (intent, channel, service).
    proc_groups: dict[tuple[str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in _read_csv(dataset / "moov_money_procedures_2026-07-21.csv"):
        key = (
            (row.get("intent") or "").strip(),
            (row.get("channel") or "").strip(),
            (row.get("service_name") or "").strip(),
        )
        if not key[0] and not key[2]:
            continue
        proc_groups[key].append(row)

    for (intent, channel, service), steps in proc_groups.items():
        steps_sorted = sorted(
            steps,
            key=lambda r: int(r.get("step_number") or 0),
        )
        lines = []
        entry = ""
        url = ""
        notice = ""
        category = ""
        for r in steps_sorted:
            n = r.get("step_number") or "?"
            instr = (r.get("instruction") or "").strip()
            if instr:
                lines.append(f"{n}. {instr}")
            entry = entry or (r.get("entry_point") or "")
            url = url or (r.get("source_url") or "")
            notice = notice or (r.get("security_notice") or "")
            category = category or (r.get("category") or "")
        if not lines:
            continue
        head = f"Parcours {service or intent}"
        if channel:
            head += f" ({channel}"
            if entry:
                head += f" · {entry}"
            head += ")"
        body = "\n".join(lines)
        if notice:
            body += f"\n\nSécurité : {notice}"
        docs.append(
            Doc(
                title=head,
                content=body,
                tags=f"{intent}, {category}, procedure, {channel}, moov money",
                source_url=url.strip(),
                source_type="procedure",
                intent=intent,
                category=category.strip(),
                layer="procedure",
                doc_id=f"PROC:{intent}:{channel}",
                confidence=0.9,
            )
        )

    for row in _read_csv(dataset / "moov_money_pricing_2026-07-21.csv"):
        op = (row.get("operation") or "").strip()
        fee = (row.get("fee_description") or "").strip()
        if not op or not fee:
            continue
        amin = row.get("amount_min_fcfa") or "?"
        amax = row.get("amount_max_fcfa") or "?"
        intent = (row.get("intent") or "").strip()
        body = (
            f"Opération : {op}\n"
            f"Tranche : {amin} – {amax} FCFA\n"
            f"{fee}\n"
            f"Type de frais : {row.get('fee_type') or ''} "
            f"({row.get('fee_value') or ''} {row.get('fee_unit') or ''})."
        )
        docs.append(
            Doc(
                title=f"Tarif — {op} ({amin}-{amax} FCFA)",
                content=body,
                tags=f"{intent}, tarif, frais, pricing, moov money",
                source_url=(row.get("source_url") or "").strip(),
                source_type="pricing",
                intent=intent,
                category="Tarifs",
                layer="pricing",
                doc_id=(row.get("tariff_id") or "").strip(),
                confidence=0.95,
            )
        )

    for row in _read_csv(dataset / "moov_money_support_cases_2026-07-21.csv"):
        scenario = (row.get("user_scenario") or "").strip()
        answer = (row.get("recommended_answer") or "").strip()
        if not scenario or not answer:
            continue
        escalate = (row.get("should_escalate") or "").strip()
        action = (row.get("expected_action") or "").strip()
        body = answer
        if action:
            body += f"\nAction : {action}"
        if escalate.lower() == "yes":
            body += "\nEscalade recommandée si le doute persiste (222 / assistance)."
        docs.append(
            Doc(
                title=f"Support — {scenario[:80]}",
                content=body,
                tags=f"{row.get('intent') or ''}, support, securite, moov money",
                source_url=(row.get("source_url") or "").strip(),
                source_type="support",
                intent=(row.get("intent") or "").strip(),
                category="Support",
                layer="support",
                doc_id=(row.get("case_id") or "").strip(),
                confidence=0.8,
            )
        )

    for row in _read_csv(dataset / "moov_money_anomalies_2026-07-21.csv"):
        subject = (row.get("subject") or "").strip()
        desc = (row.get("description") or "").strip()
        if not subject:
            continue
        body = (
            f"Anomalie documentaire : {desc}\n"
            f"Valeur A : {row.get('value_a')} ({row.get('source_a')})\n"
            f"Valeur B : {row.get('value_b')} ({row.get('source_b')})\n"
            f"Risque : {row.get('business_risk')}\n"
            f"Action : {row.get('recommended_action')}\n"
            "Ne pas affirmer un tarif contradictoire — orienter vers confirmation officielle / 222."
        )
        docs.append(
            Doc(
                title=f"Attention — {subject}",
                content=body,
                tags="anomalie, tarif, validation, moov money",
                source_url=(row.get("source_a") or "").strip(),
                source_type="anomaly",
                intent="",
                category="Anomalies",
                layer="anomaly",
                doc_id=(row.get("anomaly_id") or "").strip(),
                confidence=0.5,
            )
        )

    return docs


def _load_json_docs() -> list[Doc]:
    docs: list[Doc] = []
    for path, layer in ((SEED, "seed"), (SCRAPED, "scraped")):
        for item in _items_from_json(path):
            if not item.get("title") or not item.get("content"):
                continue
            docs.append(
                Doc(
                    title=item["title"],
                    content=item["content"],
                    content_en=item.get("content_en", ""),
                    tags=item.get("tags", ""),
                    source_url=item.get("source_url", ""),
                    source_type=item.get("source_type", layer),
                    intent="",
                    category="",
                    layer=layer,
                    doc_id=item.get("id") or "",
                    confidence=0.7 if layer == "seed" else 0.6,
                )
            )
    return docs


def load_corpus() -> tuple[list[Doc], list[IntentNode]]:
    docs = _load_json_docs()
    intents: list[IntentNode] = []
    if DATA_DIR.is_dir():
        intents = _load_intents(DATA_DIR)
        docs.extend(_load_dataset_docs(DATA_DIR))
    return docs, intents


DOCS: list[Doc]
INTENTS: list[IntentNode]
DOCS, INTENTS = load_corpus()


def reload_docs() -> int:
    """Recharge seed + scraped + corpus data/ en mémoire."""
    global DOCS, INTENTS
    DOCS, INTENTS = load_corpus()
    return len(DOCS)


def corpus_stats() -> dict:
    by_layer: dict[str, int] = {}
    by_type: dict[str, int] = {}
    for d in DOCS:
        by_layer[d.layer] = by_layer.get(d.layer, 0) + 1
        by_type[d.source_type] = by_type.get(d.source_type, 0) + 1
    return {
        "total": len(DOCS),
        "intents": len(INTENTS),
        "by_layer": by_layer,
        "by_type": by_type,
        "data_dir": str(DATA_DIR.relative_to(ROOT)) if DATA_DIR.exists() else "",
        "hierarchical": True,
    }


def _score_overlap(q: set[str], text: str, tags: str = "") -> float:
    if not q:
        return 0.0
    hay_tokens = _tokens(text)
    tag_tokens = _tokens(tags)
    overlap = q & hay_tokens
    if not overlap:
        if _normalize(text) and any(_normalize(t) in _normalize(text) for t in q if len(t) > 4):
            return 0.28
        return 0.0
    score = len(overlap) / max(len(q), 1)
    score += 0.18 * len(overlap & tag_tokens)
    # Bonus phrase quasi exacte
    norm_hay = _normalize(text)
    for t in q:
        if len(t) >= 5 and t in norm_hay:
            score += 0.03
    return score


def route_intents(query: str, limit: int = 3) -> list[tuple[IntentNode, float]]:
    """Niveau 1 — routage d’intention."""
    q = _tokens(query)
    qn = _normalize(query)
    if not q and not qn:
        return []
    scored: list[tuple[IntentNode, float]] = []
    for node in INTENTS:
        score = _score_overlap(q, " ".join(node.utterances) + " " + node.name, node.category)
        # Match intent_name snake_case
        intent_bits = set(node.name.replace("_", " ").split())
        score += 0.25 * len(q & intent_bits)
        for utt in node.utterances:
            un = _normalize(utt)
            if un and (un in qn or qn in un):
                score += 0.45
                break
        if score >= 0.18:
            scored.append((node, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


def _layer_boost(query: str, layer: str) -> float:
    q = _tokens(query) | set(_normalize(query).split())
    # Mots courts utiles (pin) exclus du tokenizer len>2 stop — on les réinjecte.
    qn = _normalize(query)
    if "pin" in qn.split() or "pin" in qn:
        q.add("pin")
    if q & TARIFF_HINTS:
        if layer == "pricing":
            return 0.55
        if layer == "faq":
            return 0.05  # préfère la grille tarifaire structurée
    if q & PROCEDURE_HINTS and layer == "procedure":
        return 0.28
    if layer == "faq":
        return 0.12
    if {"pin", "fraude", "bloque", "bloqué", "vol"} & q or "code pin" in qn:
        if layer == "support":
            return 0.85
        if layer == "faq":
            return -0.15
    return 0.0


def search(query: str, language: str = "fr", limit: int = 3) -> list[tuple[Doc, float]]:
    """
    Retrieval hiérarchique :
      1) intents → 2) filtrage catégorie/intent → 3) ranking documents multi-couches.
    """
    q = _tokens(query)
    if not q:
        return []

    intent_hits = route_intents(query, limit=3)
    top_intents = {n.name for n, _ in intent_hits}
    top_categories = {_normalize(n.category) for n, _ in intent_hits if n.category}
    intent_scores = {n.name: s for n, s in intent_hits}

    scored: list[tuple[Doc, float]] = []
    for doc in DOCS:
        hay = f"{doc.title} {doc.content} {doc.content_en} {doc.tags} {doc.intent} {doc.category}"
        base = _score_overlap(q, hay, doc.tags)
        if base <= 0:
            continue

        score = base
        # Niveau 2 — boost si même intent / catégorie que le routage.
        if doc.intent and doc.intent in top_intents:
            score += 0.4 + 0.15 * intent_scores.get(doc.intent, 0)
        elif doc.category and _normalize(doc.category) in top_categories:
            score += 0.2

        score += _layer_boost(query, doc.layer)
        # Si un montant est cité, privilégier la tranche tarifaire correspondante.
        if doc.layer == "pricing":
            amounts = [int(x) for x in re.findall(r"\d{3,9}", query.replace(" ", ""))]
            # title format: Tarif — … (min-max FCFA)
            m = re.search(r"\((\d+)\s*-\s*(\d+)\s*FCFA\)", doc.title, re.I)
            if m and amounts:
                lo, hi = int(m.group(1)), int(m.group(2))
                if any(lo <= a <= hi for a in amounts):
                    score += 0.5
                else:
                    score -= 0.15
        score *= 0.85 + 0.15 * LAYER_PRIORITY.get(doc.layer, 0.7)
        score *= 0.9 + 0.1 * min(max(doc.confidence, 0.3), 1.0)

        if language == "en" and doc.content_en:
            score += 0.05

        if score >= 0.16:
            scored.append((doc, score))

    # Si aucun doc boosté mais intents trouvés : ramener les meilleurs docs de ces intents.
    if not scored and top_intents:
        for doc in DOCS:
            if doc.intent in top_intents and doc.layer in ("faq", "knowledge", "procedure", "pricing"):
                scored.append((doc, 0.35 + intent_scores.get(doc.intent, 0)))

    scored.sort(key=lambda x: x[1], reverse=True)

    # Diversité : 1 doc / doc_id, max 2 pricing, mélanger les couches.
    out: list[tuple[Doc, float]] = []
    seen_ids: set[str] = set()
    seen_title_prefix: set[str] = set()
    layer_counts: dict[str, int] = {}
    wants_tariff = bool(_tokens(query) & TARIFF_HINTS) or any(
        h in _normalize(query) for h in ("frais", "tarif", "combien", "cout", "coût")
    )
    for doc, score in scored:
        did = doc.doc_id or f"{doc.layer}:{_normalize(doc.title)[:60]}"
        if did in seen_ids:
            continue
        # Évite doublons de titres quasi identiques (FAQ tranches, pages KB).
        prefix = _normalize(doc.title)[:48]
        if prefix in seen_title_prefix:
            continue
        lc = layer_counts.get(doc.layer, 0)
        if doc.layer == "pricing" and lc >= 2:
            continue
        if doc.layer == "faq" and lc >= (1 if wants_tariff else 3):
            continue
        if doc.layer == "knowledge" and lc >= 2:
            continue
        if doc.layer == "anomaly" and lc >= 1:
            continue
        seen_ids.add(did)
        seen_title_prefix.add(prefix)
        layer_counts[doc.layer] = lc + 1
        out.append((doc, score))
        if len(out) >= limit:
            break
    return out


def answer(query: str, language: str = "fr") -> tuple[str, list[dict]]:
    hits = search(query, language=language, limit=4)
    sources = [
        {
            "title": d.title,
            "source_type": d.source_type,
            "source_url": d.source_url,
            "score": round(s, 3),
            "layer": d.layer,
            "intent": d.intent,
            "category": d.category,
        }
        for d, s in hits
    ]
    if not hits:
        if language == "en":
            return (
                "I couldn't find precise information. Please rephrase, or dial 222 "
                "from a Moov mobile, or +241 11 79 22 00.",
                sources,
            )
        return (
            "Je n'ai pas trouvé d'information précise. Reformulez, ou composez le 222 "
            "depuis un mobile Moov, ou +241 11 79 22 00.",
            sources,
        )
    best = hits[0][0]
    text = best.content_en if language == "en" and best.content_en else best.content
    return text.strip(), sources
