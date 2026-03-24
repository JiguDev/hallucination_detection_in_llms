from fastapi import APIRouter
from backend.services.baseline_service import BaselineService
from backend.services.rag_service import RAGService
from backend.schemas.request import GenerateRequest
from backend.schemas.response import GenerateResponse

router = APIRouter()

baseline = BaselineService()
rag = RAGService()

@router.post("/generate")
def generate(payload: GenerateRequest) -> GenerateResponse:
    query = payload.query
    base = baseline.generate(query)
    rag_ans, sources, retrieved_context, mode = rag.generate(query)

    return GenerateResponse(
        baseline=base,
        rag=rag_ans,
        sources=sources,
        mode=mode,
        retrieved_context=retrieved_context,
    )