"""Comptes provisoires Gabon — POC."""

from __future__ import annotations

# Clés = numéro national (0XXXXXXXX) sans indicatif
PROVISIONAL_USERS: dict[str, dict] = {
    "06123456": {
        "id": "user-jean-direl",
        "displayName": "Jean Direl",
        "phone": "06123456",
        "phoneE164": "+24106123456",
        "locale": "fr",
        "initials": "JD",
    },
    "06123457": {
        "id": "user-christian-beyeme",
        "displayName": "Christian BEYEME",
        "phone": "06123457",
        "phoneE164": "+24106123457",
        "locale": "fr",
        "initials": "CB",
    },
    "06123458": {
        "id": "user-xavier-ondo",
        "displayName": "Xavier Ondo",
        "phone": "06123458",
        "phoneE164": "+24106123458",
        "locale": "fr",
        "initials": "XO",
    },
}

DEMO_OTP = "123456"


def normalize_phone(raw: str) -> str:
    digits = "".join(c for c in (raw or "") if c.isdigit())
    if digits.startswith("241") and len(digits) >= 11:
        digits = digits[3:]
    if len(digits) == 8 and digits[0] in "1234567":
        digits = "0" + digits
    return digits


def lookup_user(phone: str) -> dict | None:
    return PROVISIONAL_USERS.get(normalize_phone(phone))
