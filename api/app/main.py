"""Moov Assist API — FastAPI (LangGraph ReAct + voice Whisper/TTS)."""

from __future__ import annotations

import base64
import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent_graph import run_agent
from app.knowledge import reload_docs
from app.live_ws import live_voice_session, resolve_voice_mode
from app.llm_router import available_providers
from app.scraper import sync_website
from app.users import DEMO_OTP, lookup_user, normalize_phone
from app.voice import maybe_tts_b64, synthesize_speech, transcribe_audio

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(title="Moov Assist API", version="0.2.0")

origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, dict] = {}

INTRO_FR = (
    "Bonjour, je suis Moov Assist, l'assistant de Gabon Telecom — Moov Africa. "
    "Je peux vous renseigner sur les forfaits, Moov Money, l'assistance et nos offres. "
    "Parlez ou écrivez — le texte reste en option."
)
INTRO_EN = (
    "Hello, I'm Moov Assist for Gabon Telecom — Moov Africa. "
    "I can help with plans, Moov Money, support and offers. Speak or type — text is optional."
)


class ChatIn(BaseModel):
    message: str = ""
    conversationId: str | None = None
    language: str = "fr"
    userId: str | None = None
    includeAudio: bool = True


class OtpIn(BaseModel):
    phone: str
    code: str | None = None


class TtsIn(BaseModel):
    text: str
    language: str = "fr"


class ChatOut(BaseModel):
    message: str
    spoken: str = ""
    conversationId: str
    language: str = "fr"
    sources: list[dict] = Field(default_factory=list)
    engine: str = "langgraph-react"
    approved: bool = True
    steps: list[str] = Field(default_factory=list)
    providers_used: list[str] = Field(default_factory=list)
    audio_base64: str = ""
    audio_mime: str = ""
    tts_engine: str = ""
    mock: bool = False


def _want_audio(flag: bool | None = True) -> bool:
    if flag is False:
        return False
    return (os.getenv("VOICE_TTS_ENABLED", "1") or "1").strip() not in ("0", "false", "False")


@app.get("/health")
@app.get("/api/health")
def health():
    from app.users import PROVISIONAL_USERS

    voice_mode = resolve_voice_mode()
    return {
        "status": "ok",
        "service": "moov-assist-api",
        "stack": "fastapi+langgraph",
        "voice_default": True,
        "voice_mode": voice_mode,
        "live_ws": "/ws/live",
        "stt_model": os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo"),
        "tts_model": os.getenv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts"),
        "live_model": os.getenv(
            "GEMINI_LIVE_MODEL",
            "gemini-2.5-flash-native-audio-preview-12-2025",
        ),
        "llm_providers": available_providers(),
        "provisional_users": [
            {"phone": u["phoneE164"], "name": u["displayName"]}
            for u in PROVISIONAL_USERS.values()
        ],
    }


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket, language: str = "fr"):
    """Conversation audio bidirectionnelle (Gemini Live)."""
    await live_voice_session(websocket, language=language)


@app.post("/api/auth/otp")
def auth_otp(body: OtpIn):
    phone = normalize_phone(body.phone)
    user = lookup_user(phone)
    if not user:
        raise HTTPException(
            status_code=403,
            detail=(
                "Numéro non autorisé sur ce POC. Utilisez +241 06123456 (Jean Direl), "
                "+241 06123457 (Christian BEYEME) ou +241 06123458 (Xavier Ondo)."
            ),
        )

    if body.code:
        if body.code.strip() != DEMO_OTP:
            raise HTTPException(status_code=400, detail="Code invalide (démo : 123456)")
        token = uuid.uuid4().hex
        SESSIONS[token] = user
        return {
            "verified": True,
            "mock": True,
            "accessToken": token,
            "user": {
                "id": user["id"],
                "displayName": user["displayName"],
                "phone": user["phone"],
                "phoneE164": user["phoneE164"],
                "initials": user["initials"],
                "locale": user["locale"],
            },
            "expiresIn": 86400,
        }

    return {
        "challengeId": uuid.uuid4().hex,
        "expiresIn": 300,
        "mock": True,
        "hint": f"Code démo pour {user['displayName']} : {DEMO_OTP}",
        "userPreview": user["displayName"],
    }


@app.get("/api/auth/me")
def auth_me(authorization: str | None = None):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = authorization.split(" ", 1)[1].strip()
    user = SESSIONS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expirée")
    return {"user": user}


@app.post("/api/chat", response_model=ChatOut)
def chat(body: ChatIn):
    text = (body.message or "").strip()
    lang = "en" if body.language == "en" else "fr"
    cid = body.conversationId or uuid.uuid4().hex

    if not text or re.fullmatch(r"(bonjour|salut|bonsoir|hello|hi|hey)\b.*", text.lower()):
        reply = INTRO_EN if lang == "en" else INTRO_FR
        audio = maybe_tts_b64(reply, lang, enabled=_want_audio(body.includeAudio))
        return ChatOut(
            message=reply,
            spoken=reply,
            conversationId=cid,
            language=lang,
            engine="intro",
            **audio,
        )

    result = run_agent(text, language=lang)
    spoken = result.get("spoken") or result.get("message") or ""
    audio = maybe_tts_b64(spoken, lang, enabled=_want_audio(body.includeAudio))
    return ChatOut(
        message=result["message"],
        spoken=spoken,
        conversationId=cid,
        language=lang,
        sources=result.get("sources") or [],
        engine=result.get("engine") or "langgraph-react",
        approved=bool(result.get("approved", True)),
        steps=result.get("steps") or [],
        providers_used=result.get("providers_used") or [],
        **audio,
    )


@app.post("/api/stt")
async def stt(
    file: UploadFile = File(...),
    language: str = Form("fr"),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Audio vide")
    try:
        transcript, engine = transcribe_audio(
            raw,
            filename=file.filename or "audio.webm",
            language=language,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"STT indisponible: {exc}") from exc
    return {"transcript": transcript, "engine": engine, "language": language}


@app.post("/api/tts")
def tts(body: TtsIn):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texte vide")
    lang = "en" if body.language == "en" else "fr"
    try:
        wav, mime, engine = synthesize_speech(text[:900], lang)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"TTS indisponible: {exc}") from exc
    return {
        "audio_base64": base64.b64encode(wav).decode("ascii"),
        "audio_mime": mime,
        "tts_engine": engine,
        "language": lang,
    }


@app.post("/api/voice/turn")
async def voice_turn(
    file: UploadFile = File(...),
    language: str = Form("fr"),
    conversationId: str | None = Form(None),
    includeAudio: bool = Form(True),
):
    """Tour vocal : Whisper → LangGraph (contrôle) → TTS Gemini."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Audio vide")
    lang = "en" if language == "en" else "fr"
    cid = conversationId or uuid.uuid4().hex

    try:
        transcript, stt_engine = transcribe_audio(
            raw,
            filename=file.filename or "audio.webm",
            language=lang,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"STT indisponible: {exc}") from exc

    if not transcript:
        empty = (
            "I didn't catch that. Please speak a bit closer, or type your question."
            if lang == "en"
            else "Je n'ai pas bien saisi. Parlez un peu plus près, ou tapez votre question."
        )
        audio = maybe_tts_b64(empty, lang, enabled=_want_audio(includeAudio))
        return {
            "conversationId": cid,
            "language": lang,
            "transcript": "",
            "message": empty,
            "spoken": empty,
            "engine": "empty_transcript",
            "stt_engine": stt_engine,
            "sources": [],
            "approved": True,
            "steps": ["stt"],
            "providers_used": [],
            **audio,
        }

    result = run_agent(transcript, language=lang)
    spoken = result.get("spoken") or result.get("message") or ""
    audio = maybe_tts_b64(spoken, lang, enabled=_want_audio(includeAudio))
    return {
        "conversationId": cid,
        "language": lang,
        "transcript": transcript,
        "message": result["message"],
        "spoken": spoken,
        "sources": result.get("sources") or [],
        "engine": result.get("engine") or "langgraph-react",
        "approved": bool(result.get("approved", True)),
        "steps": ["stt", *(result.get("steps") or [])],
        "providers_used": result.get("providers_used") or [],
        "stt_engine": stt_engine,
        **audio,
    }


@app.post("/api/knowledge/sync")
def knowledge_sync():
    result = sync_website()
    count = reload_docs()
    return {"ok": True, "docs_loaded": count, **result}


@app.get("/api/knowledge/stats")
def knowledge_stats():
    from app.knowledge import corpus_stats

    return corpus_stats()


@app.on_event("startup")
def _startup_load_scraped():
    reload_docs()


@app.get("/")
def root():
    return {
        "service": "Moov Assist FastAPI",
        "docs": "/docs",
        "pipeline": "Live /ws/live · turn Whisper→LangGraph→TTS",
        "live_ws": "/ws/live",
        "note": "Frontend Next.js séparé (web/). FastAPI = API uniquement.",
    }
