def rag_prompt(context, query):
    return f"""You are a factual assistant for hallucination-resistant QA.

Rules:
1) Use only the provided context.
2) If context is insufficient or conflicting, say: I don't know based on verified evidence.
3) Keep response concise and avoid unsupported claims.
4) Cite supporting snippets using [1], [2], ... when relevant.

Context:
{context}

Question:
{query}

Answer:
"""