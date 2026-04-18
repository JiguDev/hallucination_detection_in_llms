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
        import json
        from pathlib import Path
        
        sources = sources or []
        evidence_items = self.web.search(question, k=5)
        evidence_text = " ".join(i.snippet for i in evidence_items)
        evidence_urls = [i.url for i in evidence_items]

        similarity = text_similarity(answer, evidence_text)
        source_score = min(1.0, len([s for s in sources if s.startswith("http")]) / 3.0)
        unsupported_ratio = unsupported_number_ratio(answer, evidence_text)
        abstained = has_safe_abstention(answer)

        # Punish strongly if unsupported claims are high
        confidence = 0.62 * similarity + 0.23 * source_score + 0.15 * (1.0 - unsupported_ratio)
        if unsupported_ratio > 0.2:
            confidence -= 0.3 * unsupported_ratio
            
        if abstained:
            confidence = max(confidence, 0.66)

        confidence = max(0.0, min(1.0, confidence))

        incorrect_info = "None"
        improvement_feedback = "None"

        if abstained:
            verdict = "Safe Abstention"
            explanation = "Model avoided unsupported claims due to limited verified evidence."
        elif confidence >= 0.72:
            verdict = "High Accuracy"
            explanation = "Answer aligns well with externally retrieved evidence."
        elif confidence >= 0.50:
            verdict = "Needs Verification"
            explanation = "Partially supported; some claims need manual fact-checking."
            incorrect_info = "Some details in the generated response lack clear backing from the retrieved web sources."
            improvement_feedback = "Ensure the fine-tuned model filters out unverified details and only extracts strictly from the provided web knowledge base."
        else:
            verdict = "Likely Hallucination"
            explanation = "Low alignment with external evidence and weak support for claims."
            incorrect_info = "Generated output contains unsupported factual claims, random repetitions, or blabbering not found in web knowledge."
            improvement_feedback = "Improve the fine-tuned model's grounding capability by heavily indexing verified web snippets. Train the model to prioritize factual extraction over generic sequence continuation."

        top_sources = sources[:3] if sources else evidence_urls[:3]

        result = {
            "verdict": verdict,
            "confidence": round(float(confidence), 3),
            "explanation": explanation,
            "supporting_sources": top_sources,
            "incorrect_info": incorrect_info,
            "improvement_feedback": improvement_feedback
        }
        
        # Save all the details like ratings, what was incorrect, how to improve
        log_dir = Path("data")
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / "eval_logs.jsonl"
        with open(log_file, "a", encoding="utf-8") as f:
            log_entry = {
                "question": question,
                "answer": answer,
                "evaluation": result
            }
            f.write(json.dumps(log_entry) + "\n")

        return result