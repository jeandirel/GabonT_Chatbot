"""
Pipeline ReAct / LangGraph Moov Assist.

Flux : retrieve → draft (raisonnement) → critique (contrôle) → reformulate (audio/lecture).
Chaque réponse est validée avant d’être renvoyée à l’usager.
"""

from __future__ import annotations

import re
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.knowledge import answer as knowledge_fallback
from app.knowledge import search
from app.llm_router import generate_text


class AgentState(TypedDict, total=False):
    query: str
    language: str
    knowledge: str
    sources: list[dict]
    draft: str
    critique: str
    approved: bool
    final: str
    spoken: str
    engine: str
    steps: list[str]
    providers_used: list[str]


def _lang(state: AgentState) -> str:
    return "en" if state.get("language") == "en" else "fr"


def node_retrieve(state: AgentState) -> dict[str, Any]:
    lang = _lang(state)
    # Hiérarchie intent → couches FAQ / KB / procédures / tarifs (corpus data/).
    hits = search(state["query"], language=lang, limit=6)
    chunks: list[str] = []
    sources: list[dict] = []
    for doc, score in hits:
        body = doc.content_en if lang == "en" and doc.content_en else doc.content
        meta = []
        if doc.intent:
            meta.append(f"intent={doc.intent}")
        if doc.layer:
            meta.append(f"layer={doc.layer}")
        header = f"### {doc.title}"
        if meta:
            header += f" ({', '.join(meta)})"
        chunks.append(f"{header}\n{body}")
        sources.append(
            {
                "title": doc.title,
                "source_type": doc.source_type,
                "source_url": doc.source_url,
                "score": round(score, 3),
                "layer": doc.layer,
                "intent": doc.intent,
                "category": doc.category,
            }
        )
    steps = list(state.get("steps") or [])
    steps.append("retrieve_hierarchical")
    return {
        "knowledge": "\n\n".join(chunks),
        "sources": sources,
        "steps": steps,
    }


def node_draft(state: AgentState) -> dict[str, Any]:
    lang = _lang(state)
    knowledge = state.get("knowledge") or ""
    if lang == "en":
        system = (
            "You are Moov Assist for Gabon Telecom — Moov Africa. "
            "Use ONLY the knowledge context. If insufficient, say so and suggest dialing 222. "
            "Think step by step (ReAct): observe knowledge, reason, then answer. "
            "Do not invent prices. Keep answer factual."
        )
        user = (
            f"Question: {state['query']}\n\nKnowledge:\n{knowledge or '(empty)'}\n\n"
            "Write a draft answer in English."
        )
    else:
        system = (
            "Tu es Moov Assist pour Gabon Telecom — Moov Africa. "
            "Utilise UNIQUEMENT le contexte fourni. Si insuffisant, dis-le et propose le 222. "
            "Raisonne en ReAct : observe le contexte, réfléchis, puis réponds. "
            "N’invente pas de tarifs. Réponse factuelle."
        )
        user = (
            f"Question : {state['query']}\n\nConnaissance :\n{knowledge or '(vide)'}\n\n"
            "Rédige une réponse brouillon en français."
        )

    providers = list(state.get("providers_used") or [])
    steps = list(state.get("steps") or [])
    result = generate_text(system, user)
    if result:
        providers.append(f"draft:{result.provider}")
        steps.append("draft_llm")
        return {"draft": result.text, "providers_used": providers, "steps": steps, "engine": "langgraph-react"}

    # Fallback FAQ
    text, sources = knowledge_fallback(state["query"], language=lang)
    steps.append("draft_faq")
    return {
        "draft": text,
        "sources": state.get("sources") or sources,
        "providers_used": providers,
        "steps": steps,
        "engine": "langgraph-faq",
    }


def node_critique(state: AgentState) -> dict[str, Any]:
    lang = _lang(state)
    draft = state.get("draft") or ""
    knowledge = state.get("knowledge") or ""
    system = (
        "You are a response controller for Moov Assist. "
        "Approve only if the draft is grounded in knowledge, not inventing facts, "
        "and safe for customers. Reply with exactly two lines:\n"
        "VERDICT: APPROVE or REVISE\n"
        "NOTES: short reason"
        if lang == "en"
        else
        "Tu es le contrôleur de réponses Moov Assist. "
        "N’approuve que si le brouillon est ancré dans la connaissance, sans invention, "
        "et sûr pour le client. Réponds en exactement deux lignes :\n"
        "VERDICT: APPROVE ou REVISE\n"
        "NOTES: raison courte"
    )
    user = f"Knowledge:\n{knowledge[:3500]}\n\nDraft:\n{draft}"
    providers = list(state.get("providers_used") or [])
    steps = list(state.get("steps") or [])
    result = generate_text(system, user)
    if result:
        providers.append(f"critique:{result.provider}")
        steps.append("critique_llm")
        verdict_line = result.text.upper()
        approved = "APPROVE" in verdict_line.split("\n")[0] if verdict_line else True
        # Si pas de connaissance et draft long inventé → revise
        if not knowledge.strip() and len(draft) > 400:
            approved = False
        return {
            "critique": result.text,
            "approved": approved,
            "providers_used": providers,
            "steps": steps,
        }

    # Heuristique locale
    steps.append("critique_heuristic")
    suspicious = bool(re.search(r"(?i)http://|```|as an ai|en tant qu.?ia", draft))
    return {
        "critique": "heuristic",
        "approved": not suspicious,
        "providers_used": providers,
        "steps": steps,
    }


def node_reformulate(state: AgentState) -> dict[str, Any]:
    lang = _lang(state)
    draft = state.get("draft") or ""
    approved = state.get("approved", True)
    knowledge = state.get("knowledge") or ""

    system = (
        "Rewrite the assistant reply for spoken delivery and easy reading. "
        "Rules: 2 to 5 short sentences; no markdown; no bullet lists; no URLs; "
        "natural spoken French/English; warm professional Moov Assist tone; "
        "keep only verified facts from the draft/knowledge."
        if lang == "en"
        else
        "Reformule la réponse pour l’oral et une lecture fluide. "
        "Règles : 2 à 5 phrases courtes ; pas de markdown ; pas de puces ; pas d’URL ; "
        "ton oral naturel, professionnel et chaleureux (Moov Assist) ; "
        "garde uniquement les faits vérifiés du brouillon/contexte."
    )
    extra = ""
    if not approved:
        extra = (
            "\nThe controller asked for a revision: stay strictly within knowledge; "
            "if unsure, invite to dial 222."
            if lang == "en"
            else
            "\nLe contrôleur demande une révision : reste strictement dans le contexte ; "
            "en cas de doute, oriente vers le 222."
        )
    user = (
        f"Draft:\n{draft}\n\nKnowledge excerpt:\n{knowledge[:2500]}\n{extra}\n\n"
        "Return ONLY the final spoken answer."
    )
    providers = list(state.get("providers_used") or [])
    steps = list(state.get("steps") or [])
    result = generate_text(system, user)
    if result and result.text:
        providers.append(f"reformulate:{result.provider}")
        steps.append("reformulate_llm")
        spoken = _sanitize_spoken(result.text)
        return {
            "final": spoken,
            "spoken": spoken,
            "providers_used": providers,
            "steps": steps,
        }

    steps.append("reformulate_local")
    spoken = _sanitize_spoken(draft)
    return {"final": spoken, "spoken": spoken, "steps": steps, "providers_used": providers}


def _sanitize_spoken(text: str) -> str:
    text = re.sub(r"[#*_`>|]+", "", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    # Limiter la longueur pour TTS
    if len(text) > 900:
        text = text[:880].rsplit(" ", 1)[0] + "."
    return text


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("retrieve", node_retrieve)
    g.add_node("draft", node_draft)
    g.add_node("critique", node_critique)
    g.add_node("reformulate", node_reformulate)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "draft")
    g.add_edge("draft", "critique")
    g.add_edge("critique", "reformulate")
    g.add_edge("reformulate", END)
    return g.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


def run_agent(query: str, language: str = "fr") -> dict[str, Any]:
    graph = get_graph()
    initial: AgentState = {
        "query": query,
        "language": language,
        "steps": [],
        "providers_used": [],
        "sources": [],
    }
    out = graph.invoke(initial)
    final = out.get("final") or out.get("spoken") or out.get("draft") or ""
    return {
        "message": final,
        "spoken": out.get("spoken") or final,
        "sources": out.get("sources") or [],
        "engine": out.get("engine") or "langgraph-react",
        "approved": out.get("approved", True),
        "critique": out.get("critique") or "",
        "steps": out.get("steps") or [],
        "providers_used": out.get("providers_used") or [],
    }
