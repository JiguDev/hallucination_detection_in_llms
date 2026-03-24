from __future__ import annotations

import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


UNSURE_PATTERNS = [
    "i don't know",
    "not sure",
    "insufficient",
    "cannot verify",
    "unknown",
]


def text_similarity(a: str, b: str) -> float:
    if not a.strip() or not b.strip():
        return 0.0

    vect = TfidfVectorizer(stop_words="english")
    mat = vect.fit_transform([a, b])
    return float(cosine_similarity(mat[0], mat[1])[0][0])


def unsupported_number_ratio(answer: str, evidence: str) -> float:
    nums_answer = set(re.findall(r"\b\d+(?:\.\d+)?\b", answer))
    if not nums_answer:
        return 0.0
    nums_evidence = set(re.findall(r"\b\d+(?:\.\d+)?\b", evidence))
    unsupported = [n for n in nums_answer if n not in nums_evidence]
    return min(1.0, len(unsupported) / max(1, len(nums_answer)))


def has_safe_abstention(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in UNSURE_PATTERNS)