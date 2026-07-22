"""Collecte légère site Moov Africa Gabon + métadonnées réseaux sociaux."""

from __future__ import annotations

import json
import logging
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "knowledge"
SCRAPED = KNOWLEDGE_DIR / "scraped.json"

DEFAULT_BASE = os.getenv("MOOV_SITE_URL", "https://www.moov-africa.ga").rstrip("/")

DEFAULT_PATHS = [
    "/",
    "/particulier",
    "/Pages/bons-plans-et-promotions.aspx",
    "/particulier/mobile/services/Forfaits_voix/Pages/Heures-liberte.aspx",
]

SOCIAL_HINTS = [
    ("Facebook Moov Africa Gabon", "https://www.facebook.com/MoovAfricaGabonTelecom"),
    ("X / Twitter Moov Africa Gabon", "https://twitter.com/MoovAfricaGabon"),
    ("LinkedIn Moov Africa", "https://www.linkedin.com/company/moov-africa"),
    ("YouTube Moov Africa Gabon", "https://www.youtube.com/@MoovAfricaGabon"),
]


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self._skip:
            self._skip -= 1

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        text = data.strip()
        if text:
            self._chunks.append(text)

    def text(self) -> str:
        return " ".join(self._chunks)


def fetch_page(url: str, timeout: int = 12) -> str | None:
    try:
        req = Request(
            url,
            headers={
                "User-Agent": "MoovAssistBot/0.1 (+poc; contact@moov-assist.local)",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
            },
        )
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310
            charset = resp.headers.get_content_charset() or "utf-8"
            return resp.read().decode(charset, errors="replace")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Fetch error %s: %s", url, exc)
        return None


def extract_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:  # noqa: BLE001
        # Fallback regex si HTML mal formé
        cleaned = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html)
        cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
        return " ".join(cleaned.split())[:4000]
    return " ".join(parser.text().split())[:4000]


def sync_website(paths: list[str] | None = None, base: str | None = None) -> dict:
    base_url = (base or DEFAULT_BASE).rstrip("/")
    paths = paths or DEFAULT_PATHS
    docs: list[dict] = []
    created = 0
    failed = 0

    for path in paths:
        url = base_url + "/" if path == "/" else urljoin(base_url + "/", path.lstrip("/"))
        html = fetch_page(url)
        if not html:
            failed += 1
            continue
        text = extract_text(html)
        if len(text) < 80:
            failed += 1
            continue
        title = f"Page Moov — {path if path != '/' else 'accueil'}"
        docs.append(
            {
                "title": title,
                "content": text,
                "content_en": "",
                "tags": "moov site web gabon telecom",
                "source_url": url,
                "source_type": "website",
            }
        )
        created += 1

    for name, url in SOCIAL_HINTS:
        docs.append(
            {
                "title": name,
                "content": (
                    f"Moov Africa Gabon Telecom est présent sur {name.split()[0]}. "
                    f"Suivez les actualités, promotions et annonces sur {url}. "
                    "Pour une assistance immédiate, composez le 222 depuis un mobile Moov."
                ),
                "content_en": (
                    f"Moov Africa Gabon Telecom is on {name.split()[0]}. "
                    f"Follow news and promotions at {url}. "
                    "For immediate support, dial 222 from a Moov mobile."
                ),
                "tags": "social facebook twitter linkedin youtube actualites",
                "source_url": url,
                "source_type": "social",
            }
        )

    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    SCRAPED.write_text(json.dumps(docs, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "base": base_url,
        "website_pages": created,
        "social": len(SOCIAL_HINTS),
        "failed": failed,
        "total_docs": len(docs),
        "path": str(SCRAPED),
    }
