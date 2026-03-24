from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer

from .vector_store import VectorStore


class Retriever:
    def __init__(self, docs_path: str = "data/docs"):
        self.docs_path = Path(docs_path)
        self.docs = self._load_docs()
        self.vectorizer = None
        self.doc_matrix = None
        self.vs = None

        if self.docs:
            self.vectorizer = TfidfVectorizer(stop_words="english")
            self.doc_matrix = self.vectorizer.fit_transform(self.docs)
            self.vs = VectorStore(self.doc_matrix)

    def _load_docs(self) -> list[str]:
        docs: list[str] = []
        if not self.docs_path.exists():
            return docs

        for path in sorted(self.docs_path.glob("**/*")):
            if not path.is_file() or path.suffix.lower() not in {".txt", ".md"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            chunks = [c.strip() for c in text.splitlines() if c.strip()]
            docs.extend(chunks)
        return docs

    def retrieve(self, query: str, k: int = 3) -> list[str]:
        if not self.docs or self.vectorizer is None or self.vs is None:
            return []

        query_vec = self.vectorizer.transform([query])
        indices = self.vs.search(query_vec, k=k)
        return [self.docs[i] for i in indices]