// Optional provider adapter. A chat model must not be passed as an embedding model.
export class EmbeddingAdapter {
  constructor({ baseUrl, apiKey, model, dimensions }) {
    Object.assign(this, { baseUrl, apiKey, model, dimensions });
  }
  async embed(texts) {
    if (!this.baseUrl || !this.apiKey || !this.model)
      throw new Error("EMBEDDING_NOT_CONFIGURED");
    const response = await fetch(
      this.baseUrl.replace(/\/$/, "") + "/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          ...(this.dimensions ? { dimensions: this.dimensions } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error("EMBEDDING_PROVIDER_ERROR");
    const result = await response.json();
    if (!Array.isArray(result.data) || result.data.length !== texts.length)
      throw new Error("EMBEDDING_INVALID_RESULT");
    return result.data
      .sort((a, b) => a.index - b.index)
      .map((row) => {
        if (
          !Array.isArray(row.embedding) ||
          !row.embedding.every(Number.isFinite)
        )
          throw new Error("EMBEDDING_INVALID_RESULT");
        return row.embedding;
      });
  }
}
