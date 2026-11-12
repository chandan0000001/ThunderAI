import { logTelemetry } from "./streamService.js";

/**
 * Tavily Web Search Service
 * Fetches real-time web grounding results and formats them for LLM synthesis.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export const searchWeb = async (query, maxResults = 5) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your_tavily")) {
    console.warn("[TavilySearch] TAVILY_API_KEY is not configured in environment.");
    return null;
  }

  const cleanQuery = (query || "").trim().slice(0, 400);
  if (!cleanQuery) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey.trim(),
        query: cleanQuery,
        search_depth: "basic",
        max_results: Math.min(maxResults, 5),
        include_answer: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[TavilySearch] API error (${response.status}):`, errText);
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0 && !data.answer) {
      return null;
    }

    // Format results into clean grounding context with markdown source links
    let formattedContext = `[LIVE WEB SEARCH GROUNDING]\nQuery: "${cleanQuery}"\n`;

    if (data.answer) {
      formattedContext += `Quick Overview: ${data.answer}\n\n`;
    }

    formattedContext += `Sources & Citations:\n`;
    results.forEach((r, idx) => {
      const title = r.title || "Web Source";
      const url = r.url || "";
      const content = (r.content || "").replace(/\s+/g, " ").slice(0, 500);
      formattedContext += `[${idx + 1}] "${title}"\nURL: ${url}\nSummary: ${content}\n\n`;
    });

    formattedContext += `Instruction: Answer the user clearly based on the live web search findings above. Explicitly cite your claims using markdown links in the format [Source 1](URL), [Source 2](URL), or [Source Title](URL). Always include the exact URLs provided above.`;

    // Log telemetry to Redis Stream
    await logTelemetry("web_search_performed", {
      query: cleanQuery,
      resultsCount: results.length,
      hasDirectAnswer: Boolean(data.answer),
    });

    return formattedContext;
  } catch (err) {
    console.warn("[TavilySearch] Search request failed:", err.message);
    return null;
  }
};
