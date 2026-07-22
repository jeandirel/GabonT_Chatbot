"""Proxy WebSocket FastAPI → Gemini Live (conversation audio bidirectionnelle)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.knowledge import Doc, search

logger = logging.getLogger(__name__)

GEMINI_LIVE_WS = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)


def resolve_voice_mode() -> str:
    mode = (os.getenv("VOICE_MODE", "auto") or "auto").strip().lower()
    if mode == "auto":
        return "live" if (os.getenv("GEMINI_API_KEY") or "").strip() else "turn"
    if mode in ("live", "turn"):
        return mode
    return "turn"


def _knowledge_block(hits: list[tuple[Doc, float]], language: str) -> str:
    chunks: list[str] = []
    for doc, _score in hits:
        body = (
            doc.content_en.strip()
            if language == "en" and doc.content_en
            else doc.content.strip()
        )
        meta = []
        if doc.intent:
            meta.append(doc.intent)
        if doc.layer:
            meta.append(doc.layer)
        head = f"### {doc.title}"
        if meta:
            head += f" [{'/'.join(meta)}]"
        chunks.append(f"{head}\n{body}")
    return "\n\n".join(chunks)


def _system_instruction(language: str, knowledge_snippet: str = "") -> str:
    if language == "en":
        base = (
            "You are Moov Assist, the voice customer assistant for Gabon Telecom — Moov Africa (Gabon). "
            "Answer briefly and clearly for spoken delivery (2–5 short sentences). "
            "Use only the knowledge context when provided. If unsure, say so and suggest calling 222 "
            "from a Moov mobile or +241 11 79 22 00. Do not invent prices or offers."
        )
    else:
        base = (
            "Tu es Moov Assist, l'assistant vocal client de Gabon Telecom — Moov Africa (Gabon). "
            "Réponds brièvement et clairement pour une lecture à voix haute (2–5 phrases courtes). "
            "Appuie-toi uniquement sur le contexte de connaissances fourni. "
            "Si tu n'es pas sûr, dis-le et propose le 222 depuis un mobile Moov "
            "ou le +241 11 79 22 00. N'invente pas de tarifs ni d'offres."
        )
    if knowledge_snippet:
        label = "Knowledge context" if language == "en" else "Contexte connaissances"
        return f"{base}\n\n{label}:\n{knowledge_snippet}"
    return base


async def _send(ws: WebSocket, payload: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload, ensure_ascii=False))


async def live_voice_session(websocket: WebSocket, language: str = "fr") -> None:
    """Session Live : PCM client ↔ proxy ↔ Gemini BidiGenerateContent."""
    await websocket.accept()

    key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not key:
        await _send(websocket, {"type": "error", "message": "GEMINI_API_KEY manquant"})
        await websocket.close(code=1011)
        return

    try:
        import websockets
    except ImportError:
        await _send(
            websocket,
            {"type": "error", "message": "Package websockets non installé"},
        )
        await websocket.close(code=1011)
        return

    lang = "en" if language == "en" else "fr"
    model = (
        os.getenv("GEMINI_LIVE_MODEL") or "gemini-2.5-flash-native-audio-preview-12-2025"
    ).strip()
    uri = f"{GEMINI_LIVE_WS}?key={key}"

    start_msg: dict[str, Any] = {}
    try:
        first_raw = await websocket.receive_text()
        try:
            start_msg = json.loads(first_raw)
        except json.JSONDecodeError:
            start_msg = {}
        if start_msg.get("type") == "start":
            lang = "en" if start_msg.get("language") == "en" else "fr"
        elif start_msg.get("type") != "audio":
            start_msg = {}
    except WebSocketDisconnect:
        return

    async def knowledge_for(*queries: str, limit: int = 2) -> str:
        hits: list[tuple[Doc, float]] = []
        seen: set[str] = set()
        for q in queries:
            try:
                batch = await asyncio.to_thread(search, q, lang, limit)
            except Exception:  # noqa: BLE001
                continue
            for doc, score in batch:
                if doc.title in seen:
                    continue
                seen.add(doc.title)
                hits.append((doc, score))
        if not hits:
            return ""
        return _knowledge_block(hits[:8], lang)

    knowledge = ""
    try:
        knowledge = await knowledge_for(
            "assistance forfait moov",
            "moov money",
            "recharge crédit",
            "réseau couverture",
            "contact support",
            limit=2,
        )
    except Exception:  # noqa: BLE001
        knowledge = ""

    system = _system_instruction(lang, knowledge)
    last_rag_query = ""
    rag_lock = asyncio.Lock()
    setup = {
        "setup": {
            "model": f"models/{model}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": "Aoede" if lang != "en" else "Kore",
                        }
                    }
                },
            },
            "systemInstruction": {"parts": [{"text": system}]},
            "inputAudioTranscription": {},
            "outputAudioTranscription": {},
        }
    }

    try:
        async with websockets.connect(uri, max_size=8 * 1024 * 1024) as gemini:
            await gemini.send(json.dumps(setup))
            await _send(
                websocket,
                {
                    "type": "ready",
                    "model": model,
                    "input_rate": 16000,
                    "output_rate": 24000,
                    "format": "pcm16le",
                },
            )

            if start_msg.get("type") == "audio" and start_msg.get("data"):
                await gemini.send(
                    json.dumps(
                        {
                            "realtimeInput": {
                                "audio": {
                                    "mimeType": "audio/pcm;rate=16000",
                                    "data": start_msg["data"],
                                }
                            }
                        }
                    )
                )

            async def client_to_gemini() -> None:
                while True:
                    try:
                        text = await websocket.receive_text()
                    except WebSocketDisconnect:
                        break
                    try:
                        msg = json.loads(text)
                    except json.JSONDecodeError:
                        continue
                    mtype = msg.get("type")
                    if mtype == "audio" and msg.get("data"):
                        # Compteur discret pour diagnostiquer « micro muet » côté client.
                        n = getattr(client_to_gemini, "_audio_n", 0) + 1
                        client_to_gemini._audio_n = n  # type: ignore[attr-defined]
                        if n == 1 or n % 50 == 0:
                            logger.info("Live audio chunks from client: %s", n)
                        await gemini.send(
                            json.dumps(
                                {
                                    "realtimeInput": {
                                        "audio": {
                                            "mimeType": msg.get("mime")
                                            or "audio/pcm;rate=16000",
                                            "data": msg["data"],
                                        }
                                    }
                                }
                            )
                        )
                    elif mtype == "text" and msg.get("text"):
                        user_text = str(msg["text"]).strip()
                        ctx = await knowledge_for(user_text, limit=3) if user_text else ""
                        parts: list[dict[str, str]] = []
                        if ctx:
                            parts.append(
                                {
                                    "text": (
                                        "[Contexte Moov Africa — utiliser si pertinent]\n"
                                        f"{ctx}"
                                    )
                                }
                            )
                        parts.append({"text": user_text})
                        await gemini.send(
                            json.dumps(
                                {
                                    "clientContent": {
                                        "turns": [{"role": "user", "parts": parts}],
                                        "turnComplete": True,
                                    }
                                }
                            )
                        )
                    elif mtype == "end":
                        await gemini.send(
                            json.dumps({"realtimeInput": {"audioStreamEnd": True}})
                        )
                        break

            async def gemini_to_client() -> None:
                nonlocal last_rag_query
                async for raw in gemini:
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    if data.get("setupComplete") is not None or "setupComplete" in data:
                        await _send(websocket, {"type": "setup_complete"})
                        continue

                    sc = data.get("serverContent") or {}
                    if sc.get("interrupted"):
                        await _send(websocket, {"type": "interrupted"})

                    input_tx = sc.get("inputTranscription") or {}
                    if input_tx.get("text"):
                        user_tx = str(input_tx["text"]).strip()
                        await _send(
                            websocket,
                            {"type": "transcript", "role": "user", "text": user_tx},
                        )
                        if len(user_tx) >= 12:

                            async def _inject_rag(q: str) -> None:
                                nonlocal last_rag_query
                                async with rag_lock:
                                    norm = q.lower()[:80]
                                    if norm == last_rag_query:
                                        return
                                    last_rag_query = norm
                                    ctx = await knowledge_for(q, limit=3)
                                    if not ctx:
                                        return
                                    try:
                                        await gemini.send(
                                            json.dumps(
                                                {
                                                    "clientContent": {
                                                        "turns": [
                                                            {
                                                                "role": "user",
                                                                "parts": [
                                                                    {
                                                                        "text": (
                                                                            "[Contexte Moov Africa "
                                                                            "— utiliser si pertinent]\n"
                                                                            f"{ctx}"
                                                                        )
                                                                    }
                                                                ],
                                                            }
                                                        ],
                                                        "turnComplete": False,
                                                    }
                                                }
                                            )
                                        )
                                    except Exception:  # noqa: BLE001
                                        logger.debug(
                                            "Live RAG inject failed", exc_info=True
                                        )

                            asyncio.create_task(_inject_rag(user_tx))

                    output_tx = sc.get("outputTranscription") or {}
                    if output_tx.get("text"):
                        await _send(
                            websocket,
                            {
                                "type": "transcript",
                                "role": "assistant",
                                "text": output_tx["text"],
                            },
                        )

                    model_turn = sc.get("modelTurn") or {}
                    for part in model_turn.get("parts") or []:
                        inline = part.get("inlineData") or part.get("inline_data")
                        if not inline:
                            continue
                        b64 = inline.get("data")
                        if not b64:
                            continue
                        await _send(
                            websocket,
                            {
                                "type": "audio",
                                "data": b64,
                                "mime": inline.get("mimeType")
                                or inline.get("mime_type")
                                or "audio/pcm;rate=24000",
                            },
                        )

                    if sc.get("turnComplete"):
                        await _send(websocket, {"type": "turn_complete"})

                    if data.get("error"):
                        await _send(
                            websocket,
                            {"type": "error", "message": str(data["error"])},
                        )

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_to_gemini()),
                    asyncio.create_task(gemini_to_client()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc:
                    raise exc
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("Gemini Live proxy error")
        try:
            await _send(websocket, {"type": "error", "message": str(exc)})
            await websocket.close(code=1011)
        except Exception:  # noqa: BLE001
            pass
