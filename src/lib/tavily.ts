import { tavily } from "@tavily/core";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

export async function tavilySearch(query: string, days: number = 180): Promise<TavilyResult[]> {
  try {
    const cleanQuery = query.replace(/\s+/g, " ").trim();
    const response = await client.search(cleanQuery, {
      maxResults: 8,
      searchDepth: "basic",
      includeAnswer: false,
      topic: "news",
      days,
      includeDomains: [
        // Tier-1 startup news
        "techcrunch.com",
        "forbes.com",
        "axios.com",
        "bloomberg.com",
        "businessinsider.com",
        // Funding announcement aggregators
        "businesswire.com",
        "prnewswire.com",
        "finsmes.com",
        // Healthcare / life sciences (Proofpoint focus)
        "fiercehealthcare.com",
        "fiercebiotech.com",
        "endpts.com",
        "statnews.com",
        "mobihealthnews.com",
        "rockhealth.com",
        // Fintech (Proofpoint focus)
        "finovate.com",
        "americanbanker.com",
        "pymnts.com",
        // General AI/tech
        "venturebeat.com",
        "sifted.eu",
      ],
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
