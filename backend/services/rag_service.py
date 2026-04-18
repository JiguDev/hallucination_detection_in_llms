from transformers import AutoModelForCausalLM, AutoTokenizer
from backend.retrieval.retriever import Retriever
from backend.retrieval.web_retriever import WebRetriever
from backend.core.config import config
from backend.utils.prompts import rag_prompt


class RAGService:
    def __init__(self):
        model_name = config.get("models", {}).get("rag", "Qwen/Qwen1.5-0.5B-Chat")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name)
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

        prompt_messages = rag_prompt(context, query)
        text = self.tokenizer.apply_chat_template(prompt_messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=1024)
        
        out = self.model.generate(
            **inputs, 
            max_new_tokens=400, 
            repetition_penalty=1.1, 
            do_sample=True,
            temperature=0.7,
            top_p=0.9
        )
        
        generated_ids = out[0][inputs['input_ids'].shape[1]:]
        answer = self.tokenizer.decode(generated_ids, skip_special_tokens=True).strip()

        sources = [s.url for s in web_sources]
        retrieved_context = local_docs + web_docs

        if local_docs and web_docs:
            mode = "hybrid"
        elif web_docs:
            mode = "web"
        else:
            mode = "local"

        return answer, sources, retrieved_context, mode