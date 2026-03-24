from fastapi import APIRouter
from backend.services.evaluator_service import EvaluatorService
from backend.schemas.request import EvaluateRequest
from backend.schemas.response import EvaluateResponse, EvaluationScore

router = APIRouter()

evaluator = EvaluatorService()

@router.post("/evaluate")
def evaluate(payload: EvaluateRequest) -> EvaluateResponse:
    base_score = evaluator.evaluate(payload.query, payload.baseline_answer, sources=[])
    rag_score = evaluator.evaluate(payload.query, payload.rag_answer, sources=payload.rag_sources)

    winner = "rag" if rag_score["confidence"] >= base_score["confidence"] else "baseline"
    summary = (
        "Fine-tuned/RAG pipeline outperformed baseline on external evidence alignment."
        if winner == "rag"
        else "Baseline aligned better than RAG for this question."
    )

    return EvaluateResponse(
        baseline=EvaluationScore(**base_score),
        rag=EvaluationScore(**rag_score),
        winner=winner,
        summary=summary,
    )