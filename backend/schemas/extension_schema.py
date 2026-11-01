from pydantic import BaseModel, Field
from backend.schemas.response import EvaluationScore


class ExtensionEvaluateRequest(BaseModel):
    text: str = Field(..., description="The AI response to fact-check")
    prompt: str = Field("", description="Optional: The user's prompt to give context for search")


class ExtensionEvaluateResponse(BaseModel):
    score: EvaluationScore
    summary: str


class ExtensionSummarizeRequest(BaseModel):
    ledger_text: str = Field(..., description="The raw chat history to be summarized.")


class ExtensionSummarizeResponse(BaseModel):
    condensed_prompt: str
