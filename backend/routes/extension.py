from fastapi import APIRouter
from backend.services.evaluator_service import EvaluatorService
from backend.schemas.extension_schema import ExtensionEvaluateRequest, ExtensionEvaluateResponse

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
