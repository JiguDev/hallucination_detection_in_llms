# Hallucination Detection in LLMs (MTech Project)

This project implements a 3-part chatbot system:

1. Vanilla pre-trained model (baseline)
2. Fine-tuned style model with retrieval + web fact-checking fallback (RAG)
3. Unknown evaluator model that scores both answers using external evidence

## System Design

Top-left panel:

- Baseline LLM answer (no retrieval)

Top-right panel:

- RAG + web-assisted answer
- Shows external source links

Bottom panel:

- Evaluator score and verdict for both models
- Winner selection based on confidence

## Project Structure

- backend/main.py: FastAPI app entrypoint
- backend/routes/generate.py: Answer generation route
- backend/routes/evaluate.py: Fact-check evaluation route
- backend/services/baseline_service.py: Vanilla model generation
- backend/services/rag_service.py: Local retrieval + web fallback generation
- backend/services/evaluator_service.py: External-evidence scoring
- backend/retrieval/retriever.py: Local TF-IDF retrieval from data/docs
- backend/retrieval/web_retriever.py: Web evidence fetch
- frontend/app.py: Streamlit UI

## Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run Backend

```bash
uvicorn backend.main:app --reload --port 8000
```

## Run Frontend

```bash
streamlit run frontend/app.py
```

## Add Local Knowledge Base

Place text files in:

- data/docs/\*.txt
- data/docs/\*.md

The retriever loads each non-empty line as a retrievable unit.

## API Endpoints

POST /generate

Request body:

```json
{
  "query": "Recent developments in renewable energy in India"
}
```

POST /evaluate

Request body:

```json
{
  "query": "Recent developments in renewable energy in India",
  "baseline_answer": "...",
  "rag_answer": "...",
  "rag_sources": ["https://..."]
}
```

## Semester-Wise Implementation Plan

Semester 3 (Build + Validation):

1. Implement baseline, RAG pipeline, and evaluator
2. Build dataset in your focus domain (ECE + AI communications or chosen domain)
3. Create prompt and retrieval experiments
4. Log results in logs/experiments.json

Semester 4 (Research + Thesis):

1. Fine-tune with domain data and synthetic hard negatives
2. Improve evaluator with stronger entailment models
3. Benchmark hallucination rate reduction
4. Thesis writing and final demo

## Notes

- Default model uses distilgpt2 for practical local experimentation.
- For stronger performance, replace model names in configs/config.yaml.
