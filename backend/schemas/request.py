from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
	query: str = Field(..., min_length=3, max_length=1000)


class EvaluateRequest(BaseModel):
	query: str = Field(..., min_length=3, max_length=1000)
	baseline_answer: str = Field(..., min_length=1)
	rag_answer: str = Field(..., min_length=1)
	rag_sources: list[str] = Field(default_factory=list)
