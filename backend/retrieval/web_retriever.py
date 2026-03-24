from __future__ import annotations

from dataclasses import dataclass
import json
from typing import List
from urllib.parse import urlencode
from urllib.request import urlopen


@dataclass
class WebSource:
    title: str
    url: str
    snippet: str


class WebRetriever:
    """Lightweight web evidence fetcher using DuckDuckGo instant answer API."""

    endpoint = "https://api.duckduckgo.com/"

    def search(self, query: str, k: int = 5) -> List[WebSource]:
        params = {
            "q": query,
            "format": "json",
            "no_redirect": 1,
            "no_html": 1,
        }

        try:
            url = f"{self.endpoint}?{urlencode(params)}"
            with urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return []

        results: list[WebSource] = []

        abstract_url = data.get("AbstractURL", "")
        abstract_text = data.get("AbstractText", "")
        heading = data.get("Heading", "")
        if abstract_url and abstract_text:
            results.append(
                WebSource(
                    title=heading or "Web result",
                    url=abstract_url,
                    snippet=abstract_text,
                )
            )

        for topic in data.get("RelatedTopics", []):
            if "Topics" in topic:
                for child in topic.get("Topics", []):
                    text = child.get("Text", "")
                    url = child.get("FirstURL", "")
                    if text and url:
                        title = text.split(" - ")[0][:120]
                        results.append(WebSource(title=title, url=url, snippet=text))
            else:
                text = topic.get("Text", "")
                url = topic.get("FirstURL", "")
                if text and url:
                    title = text.split(" - ")[0][:120]
                    results.append(WebSource(title=title, url=url, snippet=text))

            if len(results) >= k:
                break

        deduped: list[WebSource] = []
        seen_urls: set[str] = set()
        for item in results:
            if item.url in seen_urls:
                continue
            seen_urls.add(item.url)
            deduped.append(item)
            if len(deduped) >= k:
                break

        return deduped
