"""STT Whisper (Groq/OpenAI) + TTS Gemini — clés lues depuis le .env."""

from __future__ import annotations

import base64
import logging
import os
import wave
from io import BytesIO

import httpx

logger = logging.getLogger(__name__)


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000, channels: int = 1) -> bytes:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: str = "fr",
) -> tuple[str, str]:
    """Whisper large-v3-turbo via Groq (ou OpenAI en secours)."""
    lang = "en" if language == "en" else "fr"
    groq_key = _env("GROQ_API_KEY")
    openai_key = _env("OPENAI_API_KEY")
    model = _env("GROQ_STT_MODEL", "whisper-large-v3-turbo")

    if groq_key:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        key = groq_key
        engine = "groq_whisper"
    elif openai_key:
        url = "https://api.openai.com/v1/audio/transcriptions"
        key = openai_key
        model = _env("OPENAI_STT_MODEL", "whisper-1")
        engine = "openai_whisper"
    else:
        raise RuntimeError("GROQ_API_KEY ou OPENAI_API_KEY requis pour le STT")

    with httpx.Client(timeout=45.0) as client:
        res = client.post(
            url,
            headers={"Authorization": f"Bearer {key}"},
            files={"file": (filename or "audio.webm", audio_bytes)},
            data={
                "model": model,
                "language": lang,
                "response_format": "json",
                "temperature": "0",
            },
        )
        res.raise_for_status()
        text = (res.json().get("text") or "").strip()
    return text, engine


def synthesize_speech(text: str, language: str = "fr") -> tuple[bytes, str, str]:
    """TTS natif Gemini (audio génératif). Retourne (wav_bytes, mime, engine)."""
    key = _env("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY manquant pour le TTS")

    model = _env("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
    voice = "Aoede" if language != "en" else "Kore"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    prompt = (
        f"Prononce naturellement en français, ton professionnel et chaleureux :\n{text}"
        if language != "en"
        else f"Speak naturally in English, warm professional tone:\n{text}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}},
            },
        },
    }
    with httpx.Client(timeout=60.0) as client:
        res = client.post(url, params={"key": key}, json=payload)
        res.raise_for_status()
        data = res.json()

    parts = (
        ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    )
    inline = None
    for part in parts:
        if "inlineData" in part:
            inline = part["inlineData"]
            break
        if "inline_data" in part:
            inline = part["inline_data"]
            break
    if not inline:
        raise RuntimeError("Gemini TTS: pas d'audio dans la réponse")

    raw = base64.b64decode(inline.get("data") or "")
    mime = inline.get("mimeType") or inline.get("mime_type") or "audio/L16;rate=24000"
    if "wav" in mime or raw[:4] == b"RIFF":
        return raw, "audio/wav", "gemini_native_tts"

    rate = 24000
    if "rate=" in mime:
        try:
            rate = int(mime.split("rate=")[-1].split(";")[0])
        except ValueError:
            rate = 24000
    return _pcm_to_wav(raw, sample_rate=rate), "audio/wav", "gemini_native_tts"


def maybe_tts_b64(text: str, language: str, *, enabled: bool = True) -> dict:
    if not enabled or not text.strip():
        return {"audio_base64": "", "audio_mime": "", "tts_engine": "none"}
    try:
        wav, mime, engine = synthesize_speech(text, language)
        return {
            "audio_base64": base64.b64encode(wav).decode("ascii"),
            "audio_mime": mime,
            "tts_engine": engine,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("TTS indisponible: %s", exc)
        return {"audio_base64": "", "audio_mime": "", "tts_engine": "client_tts_fallback"}
