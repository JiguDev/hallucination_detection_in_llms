from transformers import pipeline
from backend.core.config import config

class BaselineService:
    def __init__(self):
        model_name = config.get("models", {}).get("baseline", "distilgpt2")
        self.pipe = pipeline(
            "text-generation",
            model=model_name
        )

    def generate(self, query: str) -> str:
        prompt = (
            "Answer the following question as clearly as possible. "
            "If uncertain, state uncertainty instead of guessing.\n\n"
            f"Question: {query}"
        )
        out = self.pipe(
            prompt, 
            max_new_tokens=180, 
            do_sample=True, 
            top_k=50, 
            top_p=0.95, 
            repetition_penalty=1.2, 
            pad_token_id=self.pipe.tokenizer.eos_token_id
        )[0]
        text = out.get("generated_text", "").strip()
        return text[len(prompt):].strip() if text.startswith(prompt) else text