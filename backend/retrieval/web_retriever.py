import requests
import re
import os
from pathlib import Path
from dataclasses import dataclass
from typing import List
from transformers import AutoModelForCausalLM, AutoTokenizer
from backend.core.config import config

@dataclass
class WikiSource:
    title: str
    url: str
    snippet: str

class WebRetriever:
    """Dynamically fetches web evidence and synthesizes it into an LLM Wiki."""

    def __init__(self, model=None, tokenizer=None):
        self.wiki_dir = Path("d:/MTech/hallucination_project/data/wiki")
        self.wiki_dir.mkdir(parents=True, exist_ok=True)
        self.schema_path = Path("d:/MTech/hallucination_project/backend/retrieval/LLM_WIKI_SCHEMA.md")
        
        # Load schema
        self.schema = ""
        if self.schema_path.exists():
            with open(self.schema_path, "r", encoding="utf-8") as f:
                self.schema = f.read()

        # Optional LLM integration for structuring
        self.model = model
        self.tokenizer = tokenizer

    def _lazy_load_llm(self):
        if not self.model or not self.tokenizer:
            print("Lazy loading LLM for Wiki synthesis...")
            model_name = config.get("models", {}).get("rag", "Qwen/Qwen1.5-0.5B-Chat")
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForCausalLM.from_pretrained(model_name)

    def _synthesize_wiki(self, query: str, raw_text: str) -> str:
        self._lazy_load_llm()
        
        messages = [
            {"role": "system", "content": self.schema},
            {"role": "user", "content": f"Please synthesize the following raw scraped text about '{query}' into a structured Wiki page. Raw Text:\n\n{raw_text}"}
        ]
        
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=2048)
        
        out = self.model.generate(
            **inputs, 
            max_new_tokens=600, 
            repetition_penalty=1.1, 
            do_sample=True,
            temperature=0.3,
            top_p=0.9
        )
        
        generated_ids = out[0][inputs['input_ids'].shape[1]:]
        wiki_content = self.tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
        return wiki_content

    def search(self, query: str, k: int = 5) -> List[WikiSource]:
        # 1. Fetch raw data from Wikipedia
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "utf8": "",
            "format": "json",
            "srlimit": k
        }
        headers = {
            "User-Agent": "HallucinationDetectionProject/1.0"
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"WebRetriever (Wikipedia) Error: {e}")
            return []

        # Combine raw snippets
        raw_snippets = []
        for item in data.get("query", {}).get("search", []):
            clean_snippet = re.sub(r'<[^>]+>', '', item.get("snippet", ""))
            raw_snippets.append(f"Title: {item.get('title')}\nSnippet: {clean_snippet}")
            
        combined_raw_text = "\n\n".join(raw_snippets)
        if not combined_raw_text.strip():
            return []

        # 2. Synthesize into LLM Wiki format
        print(f"Synthesizing web results for '{query}' into LLM Wiki...")
        try:
            structured_wiki = self._synthesize_wiki(query, combined_raw_text)
        except Exception as e:
            print(f"Synthesis failed, falling back to raw text. Error: {e}")
            structured_wiki = f"# {query}\n\n{combined_raw_text}"

        # 3. Save to local Wiki repository to compound knowledge
        safe_query = re.sub(r'[^a-zA-Z0-9]', '_', query.lower())
        file_path = self.wiki_dir / f"{safe_query}_wiki.md"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(structured_wiki)

        # 4. Return the structured Wiki content
        return [
            WikiSource(
                title=f"{query} (LLM Wiki)",
                url=f"local://wiki/{file_path.name}",
                snippet=structured_wiki
            )
        ]
