from backend.retrieval.web_retriever import WebRetriever
from backend.utils.confidence import (
    has_safe_abstention,
    text_similarity,
    unsupported_number_ratio,
)


class EvaluatorService:
    def __init__(self):
        self.web = WebRetriever()

    def evaluate(self, question: str, answer: str, sources: list[str] | None = None):
        sources = sources or []
        evidence_items = self.web.search(question, k=5)
        evidence_text = " ".join(i.snippet for i in evidence_items)
        evidence_urls = [i.url for i in evidence_items]

        similarity = text_similarity(answer, evidence_text)
        source_score = min(1.0, len([s for s in sources if s.startswith("http")]) / 3.0)
        unsupported_ratio = unsupported_number_ratio(answer, evidence_text)
        abstained = has_safe_abstention(answer)

        confidence = 0.62 * similarity + 0.23 * source_score + 0.15 * (1.0 - unsupported_ratio)
        if abstained:
            confidence = max(confidence, 0.66)

        confidence = max(0.0, min(1.0, confidence))

        if abstained:
            verdict = "Safe Abstention"
            explanation = "Model avoided unsupported claims due to limited verified evidence."
        elif confidence >= 0.72:
            verdict = "High Accuracy"
            explanation = "Answer aligns well with externally retrieved evidence."
        elif confidence >= 0.50:
            verdict = "Needs Verification"
            explanation = "Partially supported; some claims need manual fact-checking."
        else:
            verdict = "Likely Hallucination"
            explanation = "Low alignment with external evidence and weak support for claims."

        top_sources = sources[:3] if sources else evidence_urls[:3]

        return {
            "verdict": verdict,
            "confidence": round(float(confidence), 3),
            "explanation": explanation,
            "supporting_sources": top_sources,
        }