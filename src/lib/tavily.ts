import { tavily } from "@tavily/core";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  try {
    const response = await client.search(query, {
      maxResults: 8,
      searchDepth: "basic",
      includeAnswer: false,
    });
    return response.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }));
  } catch (err) {
    console.error("[tavily] Search failed:", err);
    throw new Error(
      `Tavily search failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
