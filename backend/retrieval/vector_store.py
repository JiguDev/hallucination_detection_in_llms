from sklearn.metrics.pairwise import cosine_similarity


class VectorStore:
    def __init__(self, doc_matrix):
        self.doc_matrix = doc_matrix

    def search(self, query_embedding, k: int = 3) -> list[int]:
        scores = cosine_similarity(query_embedding, self.doc_matrix)[0]
        ranked = scores.argsort()[::-1]
        top_k = ranked[: max(1, min(k, len(ranked)))]
        return [int(i) for i in top_k]