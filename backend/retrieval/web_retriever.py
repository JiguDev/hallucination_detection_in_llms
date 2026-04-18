from dataclasses import dataclass
from ddgs import DDGS
from typing import List

@dataclass
class WebSource:
    title: str
    url: str
    snippet: str

class WebRetriever:
    """Web evidence fetcher using duckduckgo_search library."""

    def search(self, query: str, k: int = 5) -> List[WebSource]:
        try:
            results = list(DDGS().text(query, max_results=k))
        except Exception as e:
            print(f"WebRetriever Error: {e}")
            return []

        sources: List[WebSource] = []
        for r in results:
            sources.append(
                WebSource(
                    title=r.get("title", "Web result"),
                    url=r.get("href", ""),
                    snippet=r.get("body", "")
                )
            )
        return sources
