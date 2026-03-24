from transformers import pipeline
from backend.retrieval.retriever import Retriever
from backend.retrieval.web_retriever import WebRetriever
from backend.core.config import config
from backend.utils.prompts import rag_prompt


class RAGService:
    def __init__(self):
        model_name = config.get("models", {}).get("rag", "distilgpt2")
        self.generator = pipeline(
            "text-generation",
            model=model_name
        )
        self.retriever = Retriever()
        self.web = WebRetriever()
        self.local_k = int(config.get("retrieval", {}).get("local_k", 3))
        self.web_k = int(config.get("retrieval", {}).get("web_k", 4))

    def _build_context(self, local_docs: list[str], web_docs: list[str]) -> str:
        blocks = []
        for idx, doc in enumerate(local_docs + web_docs, start=1):
            blocks.append(f"[{idx}] {doc}")
        return "\n".join(blocks)

    def generate(self, query: str):
        local_docs = self.retriever.retrieve(query, k=self.local_k)
        web_sources = self.web.search(query, k=self.web_k)
        web_docs = [s.snippet for s in web_sources]

        context = self._build_context(local_docs, web_docs)

        if not context.strip():
            return (
                "I don't know based on verified evidence.",
                [],
                [],
                "none",
            )

        prompt = rag_prompt(context, query)
        out = self.generator(prompt, max_new_tokens=220, do_sample=False)[0]
        text = out.get("generated_text", "").strip()
        answer = text[len(prompt):].strip() if text.startswith(prompt) else text

        sources = [s.url for s in web_sources]
        retrieved_context = local_docs + web_docs

        if local_docs and web_docs:
            mode = "hybrid"
        elif web_docs:
            mode = "web"
        else:
            mode = "local"

        return answer, sources, retrieved_context, mode