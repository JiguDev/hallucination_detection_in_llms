def rag_prompt(context, query):
    system_prompt = (
        "You are a highly capable AI assistant that formats answers beautifully like ChatGPT. "
        "Based on the context provided, answer the user's question. "
        "CRITICAL RULES FOR FORMATTING:\n"
        "1) Use markdown headers (e.g. ### What it is).\n"
        "2) Use bullet points heavily.\n"
        "3) IMPORTANT: Insert a highly relevant, unique emoji at the start of EVERY bullet point that perfectly matches the semantic meaning of the sentence. Do not repeat emojis. (e.g., use 🌍 for global spread, 🤒 for symptoms, 🛡️ for prevention, 📅 for dates).\n"
        "4) Organize the answer logically into sections.\n"
        "5) Only use the provided context to answer the question.\n"
        "6) CRITICAL: If the provided context does not contain enough verified information to answer the question, you MUST explicitly say: \"I don't know based on verified evidence.\"\n"
        "7) Cite supporting snippets using [1], [2], ... when relevant."
    )
    
    example_user = "Context:\nApple is a sweet, edible fruit produced by an apple tree (Malus domestica). Apple trees are cultivated worldwide.\n\nQuestion:\nwhat is an apple?"
    example_assistant = (
        "### 🍎 What is an Apple?\n"
        "- 🍏 An apple is a sweet, edible fruit.\n"
        "- 🌳 It is produced by the apple tree (*Malus domestica*).\n"
        "- 🌍 Apple trees are cultivated worldwide."
    )

    example_user_2 = "Context:\nSolar panels convert sunlight into electricity. Wind turbines harness wind energy.\n\nQuestion:\nWhat is the recent news of Iran and US war of 2026?"
    example_assistant_2 = "I don't know based on verified evidence."
    
    user_prompt = f"Context:\n{context}\n\nQuestion:\n{query}"
    
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": example_user},
        {"role": "assistant", "content": example_assistant},
        {"role": "user", "content": example_user_2},
        {"role": "assistant", "content": example_assistant_2},
        {"role": "user", "content": user_prompt}
    ]