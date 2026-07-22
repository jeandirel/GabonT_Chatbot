"""Rotation multi-provider LLM — lit les clés du .env racine."""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)
_lock = threading.Lock()
_rr = 0


@dataclass
class ProviderSpec:
    name: str
    api_key: str
    model: str
    kind: str  # openai_compat | anthropic | gemini


@dataclass
class LlmResult:
    text: str
    provider: str
    model: str


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def providers() -> list[ProviderSpec]:
    mapping = [
        ("groq", _env("GROQ_API_KEY"), _env("GROQ_MODEL", "llama-3.3-70b-versatile"), "openai_compat"),
        ("cerebras", _env("CEREBRAS_API_KEY"), _env("CEREBRAS_MODEL", "llama-3.3-70b"), "openai_compat"),
        ("mistral", _env("MISTRAL_API_KEY"), _env("MISTRAL_MODEL", "mistral-small-latest"), "openai_compat"),
        ("gemini", _env("GEMINI_API_KEY"), _env("GEMINI_MODEL", "gemini-2.5-flash"), "gemini"),
        ("openrouter", _env("OPENROUTER_API_KEY"), _env("OPENROUTER_MODEL", "google/gemini-2.5-flash"), "openai_compat"),
        ("anthropic", _env("ANTHROPIC_API_KEY"), _env("ANTHROPIC_MODEL", "claude-sonnet-4-5"), "anthropic"),
        ("openai", _env("OPENAI_API_KEY"), _env("OPENAI_MODEL", "gpt-4o-mini"), "openai_compat"),
    ]
    by_name = {
        n: ProviderSpec(n, k, m, kind)
        for n, k, m, kind in mapping
        if k
    }
    order = [p.strip().lower() for p in _env("LLM_ROTATION", "groq,cerebras,mistral,gemini,openrouter,anthropic,openai").split(",") if p.strip()]
    premium = _env("PREMIUM_LLM_PROVIDER").lower()
    if premium and premium in by_name:
        order = [premium] + [p for p in order if p != premium]
    ordered: list[ProviderSpec] = []
    for name in order:
        if name in by_name:
            ordered.append(by_name.pop(name))
    ordered.extend(by_name.values())
    return ordered


def available_providers() -> list[str]:
    return [p.name for p in providers()]


def _openai_base(name: str) -> str:
    return {
        "groq": "https://api.groq.com/openai/v1",
        "cerebras": "https://api.cerebras.ai/v1",
        "mistral": "https://api.mistral.ai/v1",
        "openrouter": "https://openrouter.ai/api/v1",
        "openai": "https://api.openai.com/v1",
    }.get(name, "")


def _call_openai_compat(spec: ProviderSpec, system: str, user: str, timeout: float) -> str:
    url = f"{_openai_base(spec.name)}/chat/completions"
    headers = {"Authorization": f"Bearer {spec.api_key}", "Content-Type": "application/json"}
    if spec.name == "openrouter":
        headers["HTTP-Referer"] = "https://moov-africa.ga"
        headers["X-Title"] = "Moov Assist"
    payload = {
        "model": spec.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.35,
        "max_tokens": 700,
    }
    with httpx.Client(timeout=timeout) as client:
        res = client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        return (res.json()["choices"][0]["message"]["content"] or "").strip()


def _call_anthropic(spec: ProviderSpec, system: str, user: str, timeout: float) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": spec.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": spec.model,
        "max_tokens": 700,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    with httpx.Client(timeout=timeout) as client:
        res = client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        parts = res.json().get("content") or []
        return "\n".join(p.get("text", "") for p in parts if p.get("type") == "text").strip()


def _call_gemini(spec: ProviderSpec, system: str, user: str, timeout: float) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{spec.model}:generateContent"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 700},
    }
    with httpx.Client(timeout=timeout) as client:
        res = client.post(url, params={"key": spec.api_key}, json=payload)
        res.raise_for_status()
        parts = (
            ((res.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
        )
        return "".join(p.get("text", "") for p in parts).strip()


def generate_text(system: str, user: str) -> LlmResult | None:
    timeout = float(_env("LLM_TIMEOUT_SECONDS", "25") or "25")
    specs = providers()
    if not specs:
        return None
    global _rr
    with _lock:
        start = _rr % len(specs)
        _rr += 1
    ordered = specs[start:] + specs[:start]
    last_err: Exception | None = None
    for spec in ordered:
        try:
            if spec.kind == "anthropic":
                text = _call_anthropic(spec, system, user, timeout)
            elif spec.kind == "gemini":
                text = _call_gemini(spec, system, user, timeout)
            else:
                text = _call_openai_compat(spec, system, user, timeout)
            if text:
                return LlmResult(text=text, provider=spec.name, model=spec.model)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning("LLM %s failed: %s", spec.name, exc)
    if last_err:
        logger.error("All LLM providers failed: %s", last_err)
    return None
