from pydantic import BaseModel, Field
from backend.schemas.response import EvaluationScore


class ExtensionEvaluateRequest(BaseModel):
    text: str = Field(..., description="The AI response to fact-check")
    prompt: str = Field("", description="Optional: The user's prompt to give context for search")


class ExtensionEvaluateResponse(BaseModel):
    score: EvaluationScore
    summary: str


from typing import Optional, List


class AttachedFile(BaseModel):
    name: str = Field(..., description="File name with extension")
    type: str = Field("application/octet-stream", description="MIME type")
    size: Optional[int] = Field(0, description="File size in bytes")
    preview_or_summary: Optional[str] = Field("", description="Extracted preview, caption, or summary of file content")
    data_url: Optional[str] = Field(None, description="Base64 data URL for reconstructed file upload")
    turn_index: Optional[int] = Field(0, description="Chat turn index where the file was uploaded")
    role: Optional[str] = Field("user", description="Who uploaded or referenced the file")


class ExtensionSummarizeRequest(BaseModel):
    ledger_text: str = Field(..., description="The raw chat history to be summarized.")
    files: List[AttachedFile] = Field(default_factory=list, description="Attached files from the chat session")
    source_platform: Optional[str] = Field("unknown", description="Source platform name (chatgpt, claude, gemini)")


class ExtensionSummarizeResponse(BaseModel):
    condensed_prompt: str
    files_summary: str
    total_turns: int
    files_count: int
