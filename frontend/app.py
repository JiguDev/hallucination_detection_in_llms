import streamlit as st
import requests

API = "http://localhost:8000"

st.set_page_config(layout="wide")

st.title("Hallucination Detection in LLMs")
st.caption("Vanilla vs Fine-tuned + RAG/Web Fact-Checking with an Unknown Evaluator")

query = st.text_input("Enter your question")

if st.button("Submit"):

    if not query.strip():
        st.warning("Please enter a question.")
        st.stop()

    with st.spinner("Generating baseline and RAG answers..."):
        res = requests.post(f"{API}/generate", json={"query": query}, timeout=120).json()

    col1, col2 = st.columns(2)

    # LEFT PANEL
    with col1:
        st.markdown("### Vanilla Pre-trained LLM")
        st.info(res["baseline"])

    # RIGHT PANEL
    with col2:
        st.markdown("### Fine-tuned LLM with Fact-Checking")
        st.success(res["rag"])
        st.write(f"Retrieval Mode: **{res.get('mode', 'unknown')}**")
        st.markdown("**Sources:**")
        if res["sources"]:
            for s in res["sources"]:
                st.write(f"- {s}")
        else:
            st.write("- No external sources returned for this query")

    # EVALUATION
    with st.spinner("Running unknown evaluator with external fact-check evidence..."):
        eval_res = requests.post(
            f"{API}/evaluate",
            json={
                "query": query,
                "baseline_answer": res["baseline"],
                "rag_answer": res["rag"],
                "rag_sources": res.get("sources", []),
            },
            timeout=120,
        ).json()

    st.markdown("---")
    st.markdown("## Unknown Evaluator Model (Fact-Check Evaluation)")

    col3, col4 = st.columns(2)

    with col3:
        st.metric("Baseline Confidence", eval_res["baseline"]["confidence"])
        st.write(f"Verdict: **{eval_res['baseline']['verdict']}**")
        st.write(eval_res["baseline"]["explanation"])

    with col4:
        st.metric("RAG Confidence", eval_res["rag"]["confidence"])
        st.write(f"Verdict: **{eval_res['rag']['verdict']}**")
        st.write(eval_res["rag"]["explanation"])

    st.write(f"Winner: **{eval_res['winner'].upper()}**")
    st.caption(eval_res["summary"])

    with st.expander("Evidence used by evaluator"):
        st.markdown("**Baseline supporting sources**")
        for src in eval_res["baseline"].get("supporting_sources", []):
            st.write(f"- {src}")

        st.markdown("**RAG supporting sources**")
        for src in eval_res["rag"].get("supporting_sources", []):
            st.write(f"- {src}")