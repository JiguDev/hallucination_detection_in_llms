import re
from typing import List
from fastapi import APIRouter
from backend.services.evaluator_service import EvaluatorService
from backend.schemas.extension_schema import (
    ExtensionEvaluateRequest, 
    ExtensionEvaluateResponse,
    ExtensionSummarizeRequest,
    ExtensionSummarizeResponse,
    AttachedFile
)

router = APIRouter()

evaluator = EvaluatorService()

@router.post("/extension/evaluate")
def extension_evaluate(payload: ExtensionEvaluateRequest) -> ExtensionEvaluateResponse:
    question = payload.prompt.strip()
    if not question:
        question = payload.text[:150] + "..." if len(payload.text) > 150 else payload.text

    eval_score = evaluator.evaluate(question=question, answer=payload.text, sources=[])

    return ExtensionEvaluateResponse(
        score=eval_score,
        summary=eval_score["explanation"]
    )


def _parse_chat_turns(raw_text: str):
    """Splits raw ledger into structured turns with role and content."""
    pattern = r'(?m)^(User|AI|Ai|Assistant|System):\s*'
    parts = re.split(pattern, raw_text, flags=re.IGNORECASE)
    
    turns = []
    # If starts with prefix, parts[0] is before first match (empty or header)
    i = 1
    while i < len(parts):
        role = parts[i].strip()
        content = parts[i+1].strip() if i + 1 < len(parts) else ""
        if content:
            turns.append({"role": role, "content": content})
        i += 2
        
    if not turns and raw_text.strip():
        # Fallback if no explicit User/AI prefix was detected
        paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        for idx, para in enumerate(paragraphs):
            role = "User" if idx % 2 == 0 else "AI"
            turns.append({"role": role, "content": para})
            
    return turns


def _build_files_manifest(files: List[AttachedFile]) -> str:
    """Builds a chronological description of all attached/uploaded files."""
    if not files:
        return "None"
        
    manifest_lines = []
    for idx, f in enumerate(files, start=1):
        line = f"  {idx}. **{f.name}** ({f.type or 'document'})"
        if f.turn_index:
            line += f" [Attached at Turn {f.turn_index}]"
        if f.preview_or_summary:
            line += f": {f.preview_or_summary}"
        manifest_lines.append(line)
        
    return "\n".join(manifest_lines)


MIME_MAP = {
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'csv': 'text/csv',
    'txt': 'text/plain',
    'json': 'application/json',
    'py': 'text/x-python',
    'js': 'text/javascript',
    'md': 'text/markdown',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'ipynb': 'application/x-ipynb+json'
}

def extract_clean_filenames(text: str) -> list[str]:
    exts = r'(?:pdf|zip|tar|gz|pptx|ppt|docx|doc|xlsx|xls|csv|txt|json|py|js|md|png|jpe?g|webp|ipynb)'
    line_pattern = re.compile(rf'(?m)^\s*([a-zA-Z0-9_\-\(\)\[\] ]+\.{exts})\s*$', re.IGNORECASE)
    word_pattern = re.compile(rf'\b([a-zA-Z0-9_\-\(\)\[\]]+\.{exts})\b', re.IGNORECASE)
    quoted_pattern = re.compile(rf'["`\'«]([a-zA-Z0-9_\-\(\)\[\] ]+\.{exts})["`\'»]', re.IGNORECASE)

    raw_candidates = set(line_pattern.findall(text) + word_pattern.findall(text) + quoted_pattern.findall(text))
    stop_words = {'because', 'upload', 'uploaded', 'download', 'submit', 'reviewed', 'checks', 'remain', 'recalculated', 'results', 'table', 'draft', 'page', 'with', 'the', 'and', 'also', 'that', 'this'}

    clean_results = []
    for c in sorted(raw_candidates, key=len, reverse=True):
        name = c.strip().rstrip('.!,;:')
        if not (4 <= len(name) <= 60 and '\n' not in name):
            continue
        words = name.lower().split()
        if len(words) > 1 and words[0] in stop_words:
            continue
        if any(name in other and len(name) < len(other) for other in clean_results):
            continue
        clean_results.append(name)
        
    return clean_results

@router.post("/extension/summarize")
def extension_summarize(payload: ExtensionSummarizeRequest) -> ExtensionSummarizeResponse:
    """
    Creates a comprehensive, high-fidelity context packet for seamless cross-platform continuation.
    Captures all requirements, code blocks, technical decisions, and uploaded files in chronological order.
    """
    raw_text = payload.ledger_text.strip()
    files = list(payload.files or [])
    platform = payload.source_platform or "previous platform"
    
    # If no files were explicitly passed, scan the ledger text for genuine file attachments
    if not files and raw_text:
        detected_names = extract_clean_filenames(raw_text)
        for clean_m in detected_names:
            ext = clean_m.split('.')[-1].lower()
            if ext in MIME_MAP:
                files.append(AttachedFile(
                    name=clean_m,
                    type=MIME_MAP[ext],
                    preview_or_summary=f"Attachment referenced in chat ({clean_m})",
                    turn_index=len(files) + 1,
                    role="user"
                ))
    
    if not raw_text and not files:
        return ExtensionSummarizeResponse(
            condensed_prompt="",
            files_summary="No files or chat text provided.",
            total_turns=0,
            files_count=0
        )

    turns = _parse_chat_turns(raw_text)
    files_manifest = _build_files_manifest(files)

    # Build chronological timeline preserving all code, decisions, and instructions
    turn_summaries = []
    last_turn_content = ""
    for idx, t in enumerate(turns, start=1):
        role = t["role"]
        content = t["content"]
        last_turn_content = content
        
        # Check if any files were attached in this turn
        attached_in_turn = [f.name for f in files if getattr(f, "turn_index", None) == idx]
        attach_tag = f" [Attached: {', '.join(attached_in_turn)}]" if attached_in_turn else ""
        
        turn_summaries.append(f"Turn {idx} ({role}{attach_tag}):\n{content}")

    detailed_conversation_log = "\n\n".join(turn_summaries)

    # Create dense structured continuation directive for destination AI
    condensed_prompt = (
        f"[SYSTEM DIRECTIVE: CROSS-PLATFORM CONVERSATION CONTINUATION]\n"
        f"You are seamlessly picking up an ongoing in-depth conversation migrated from {platform}.\n"
        f"All prior background, user requirements, technical solutions, code artifacts, and attached files have been preserved below.\n"
        f"DO NOT restart or re-introduce the topic. Continue directly from where the conversation left off.\n\n"
        f"--- UPLOADED FILES & MEDIA MANIFEST ---\n"
        f"The user previously uploaded the following files in this session, which are re-attached to this prompt in the same order:\n"
        f"{files_manifest}\n\n"
        f"--- COMPLETE CONVERSATION HISTORY & WORKING STATE ---\n"
        f"{detailed_conversation_log}\n\n"
        f"--- CONTINUATION TASK ---\n"
        f"Based on the full context and any re-attached files above, continue this conversation naturally, addressing the most recent state or request:\n"
        f"\"{last_turn_content[:300]}...\""
    )

    return ExtensionSummarizeResponse(
        condensed_prompt=condensed_prompt,
        files_summary=files_manifest,
        total_turns=len(turns),
        files_count=len(files)
    )
