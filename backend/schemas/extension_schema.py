from pydantic import BaseModel, Field
from backend.schemas.response import EvaluationScore


class ExtensionEvaluateRequest(BaseModel):
    text: str = Field(..., description="The AI response to fact-check")
    prompt: str = Field("", description="Optional: The user's prompt to give context for search")


class ExtensionEvaluateResponse(BaseModel):
    score: EvaluationScore
    summary: str
