from pydantic import BaseModel, Field


class GenerateResponse(BaseModel):
	baseline: str
	rag: str
	sources: list[str] = Field(default_factory=list)
	mode: str
	retrieved_context: list[str] = Field(default_factory=list)


class EvaluationScore(BaseModel):
	verdict: str
	confidence: float
	explanation: str
	supporting_sources: list[str] = Field(default_factory=list)
	incorrect_info: str = "None"
	improvement_feedback: str = "None"


class EvaluateResponse(BaseModel):
	baseline: EvaluationScore
	rag: EvaluationScore
	winner: str
	summary: str
