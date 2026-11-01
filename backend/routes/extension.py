from fastapi import APIRouter
from backend.services.evaluator_service import EvaluatorService
from backend.schemas.extension_schema import (
    ExtensionEvaluateRequest, 
    ExtensionEvaluateResponse,
    ExtensionSummarizeRequest,
    ExtensionSummarizeResponse
)

router = APIRouter()

evaluator = EvaluatorService()

@router.post("/extension/evaluate")
def extension_evaluate(payload: ExtensionEvaluateRequest) -> ExtensionEvaluateResponse:
    # Use the prompt as the question to search, otherwise fallback to the first 150 chars of the text
    question = payload.prompt.strip()
    if not question:
        question = payload.text[:150] + "..." if len(payload.text) > 150 else payload.text

    eval_score = evaluator.evaluate(question=question, answer=payload.text, sources=[])

    return ExtensionEvaluateResponse(
        score=eval_score,
        summary=eval_score["explanation"]
    )

@router.post("/extension/summarize")
def extension_summarize(payload: ExtensionSummarizeRequest) -> ExtensionSummarizeResponse:
    """
    Takes a raw chat ledger and returns a dense context prompt to initialize a new chat session.
    For this MVP, we perform a lightweight heuristic condensation.
    """
    raw_text = payload.ledger_text.strip()
    if not raw_text:
        return ExtensionSummarizeResponse(condensed_prompt="")
    
    # Simple summarization mock/heuristic for demonstration
    # In a production version, we would pass this to a small specialized LLM.
    # We grab the first 200 and last 300 characters to capture original intent and latest state.
    
    if len(raw_text) < 500:
        condensed = f"Please continue the following conversation context:\n{raw_text}\n\nWhat is the next step?"
    else:
        start_context = raw_text[:200]
        end_context = raw_text[-300:]
        condensed = (
            f"Please continue the following conversation context.\n"
            f"[Initial Context]: {start_context}...\n"
            f"[...]\n"
            f"[Latest State]: ...{end_context}\n\n"
            f"What is the next step?"
        )
        
    return ExtensionSummarizeResponse(condensed_prompt=condensed)
