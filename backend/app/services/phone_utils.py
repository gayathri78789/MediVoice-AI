"""Phone number normalization, validation, and masking utilities."""

import re


_WORD_TO_DIGIT = {
    "zero": "0",
    "oh": "0",
    "o": "0",
    "one": "1",
    "two": "2",
    "three": "3",
    "four": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9",
}


def normalize_phone(raw_phone: str) -> str:
    """Normalize a spoken or typed phone number to a canonical digit string.

    Accepts formatted strings like '(555) 234-5678', '+1 555 234 5678',
    or spoken digit words. Validates that the resulting number has 10-15 digits.
    """
    if not raw_phone or not isinstance(raw_phone, str):
        raise ValueError("Phone number is required.")

    # Convert spoken digit words if present
    tokens = re.split(r"[\s,.-]+", raw_phone.strip().lower())
    if tokens and all(t in _WORD_TO_DIGIT or t.isdigit() for t in tokens if t):
        converted = "".join(_WORD_TO_DIGIT.get(t, t) for t in tokens if t)
    else:
        converted = raw_phone

    digits = re.sub(r"\D", "", converted)

    if len(digits) < 10 or len(digits) > 15:
        raise ValueError(
            f"Invalid phone number: expected 10 to 15 digits, got {len(digits)}."
        )

    if len(set(digits)) == 1 and digits[0] == "0":
        raise ValueError("Invalid phone number: cannot be all zeros.")

    return digits


def mask_phone(phone: str) -> str:
    """Return a privacy-masked phone representation showing only the last 4 digits."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) <= 4:
        return "****"
    last4 = digits[-4:]
    if len(digits) == 10:
        return f"(***) ***-{last4}"
    return f"{'*' * (len(digits) - 4)}{last4}"


def format_phone_for_speech(phone: str) -> str:
    """Format digits spaced out so TTS reads the complete number digit-by-digit."""
    digits = re.sub(r"\D", "", phone or "")
    return " ".join(digits)
