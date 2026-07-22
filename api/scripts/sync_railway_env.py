#!/usr/bin/env python3
"""Charge les clés LLM depuis le .env monorepo et les pousse vers Railway (sans les afficher)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

KEYS = [
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "CEREBRAS_API_KEY",
    "CEREBRAS_MODEL",
    "MISTRAL_API_KEY",
    "MISTRAL_MODEL",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "OPENROUTER_API_KEY",
    "OPENROUTER_MODEL",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "LLM_ROTATION",
    "PREMIUM_LLM_PROVIDER",
    "LLM_TIMEOUT_SECONDS",
    "VOICE_MODE",
    "GROQ_STT_MODEL",
    "GEMINI_TTS_MODEL",
    "GEMINI_LIVE_MODEL",
    "VOICE_TTS_ENABLED",
]


def load_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def main() -> int:
    api_dir = Path(__file__).resolve().parents[1]
    root = api_dir.parent
    env: dict[str, str] = {}
    env.update(load_dotenv(root / ".env"))
    env.update(load_dotenv(api_dir / ".env"))

    cors = os.environ.get("CORS_ORIGINS") or env.get("CORS_ORIGINS") or ""
    pairs: list[str] = []
    for key in KEYS:
        val = env.get(key, "").strip()
        if val:
            pairs.append(f"{key}={val}")
    if cors:
        pairs.append(f"CORS_ORIGINS={cors}")

    if not pairs:
        print("Aucune variable à synchroniser (vérifiez le .env monorepo).", file=sys.stderr)
        return 1

    cmd = ["railway", "variables", "set", *pairs, "--skip-deploys"]
    result = subprocess.run(cmd, cwd=api_dir)
    print(f"Synchronisé {len(pairs)} variable(s) Railway (valeurs non affichées).")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
