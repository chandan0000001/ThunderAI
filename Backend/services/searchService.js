import { logTelemetry } from "./streamService.js";

/**
 * Tavily Web Search Service with Adaptive Intent Classification
 * - Method 1: Classifies whether incoming prompt actually needs live web results.
 * - Saves monthly quota by skipping coding, math, text formatting, and offline reasoning tasks.
 * - Extracts and cleans high-signal search keywords before querying Tavily.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/**
 * Analyzes the prompt to determine if live search is warranted.
 */
export const analyzeSearchIntent = (prompt) => {
  const text = (prompt || "").trim();
  if (!text) return { shouldSearch: false, reason: "EMPTY_PROMPT" };

  const lower = text.toLowerCase();

  // 1. Explicit search commands
  if (/\b(search|look up|google|find info|browse the web|web search)\b/i.test(lower)) {
    return { shouldSearch: true, reason: "EXPLICIT_SEARCH_COMMAND" };
  }

  // 2. Questions about people, organizations, places, current identities
  if (/^(who is|who was|who are|tell me about|what company is|where is)\b/i.test(lower)) {
    return { shouldSearch: true, reason: "ENTITY_LOOKUP" };
  }

  // 3. Temporal & recency triggers (events, updates, modern milestones)
  if (/\b(latest|today|yesterday|current|recently|recent|newest|breaking|upcoming|this week|this month|this year|2024|2025|2026)\b/i.test(lower)) {
    return { shouldSearch: true, reason: "TEMPORAL_RECENCY" };
  }

  // 4. Live market, event, and entity data
  if (/\b(weather|stock price|crypto price|exchange rate|election|scores|standings|net worth|founder|ceo|headquarters|release date)\b/i.test(lower)) {
    return { shouldSearch: true, reason: "LIVE_DATA_QUERY" };
  }

  // 5. Strong offline indicators (pure code generation, math, translation, formatting)
  const isCodingTask = /\b(write a (function|class|component|script|code|sql|query|regex)|implement|debug|refactor|fix this error|unit test|solve leetcode|time complexity)\b/i.test(lower);
  const isFormattingTask = /\b(translate to|format as|convert (json|yaml|csv)|check grammar|rephrase|paraphrase|proofread)\b/i.test(lower);
  const isMathTask = /\b(calculate|solve for|evaluate|derivative of|integral of|proof that)\b/i.test(lower);
  const isConversational = /^(hi|hello|hey|how are you|thanks|thank you|who are you|what can you do)[\s.?!]*$/i.test(lower);

  if (isCodingTask || isFormattingTask || isMathTask || isConversational) {
    return { shouldSearch: false, reason: "OFFLINE_COMPUTE_TASK" };
  }

  // 6. Factual "what is / when did / how much" inquiries
  if (/^(what is|what are|when was|when did|how much is)\b/i.test(lower)) {
    return { shouldSearch: true, reason: "FACTUAL_QUESTION" };
  }

  return { shouldSearch: false, reason: "DEFAULT_OFFLINE" };
};

/**
 * Optimizes the search query by removing conversational prefixes and quotes.
 */
export const cleanSearchQuery = (prompt) => {
  let q = (prompt || "").trim();
  // Strip conversational wrappers: "Can you please search for...", "Just search...", "Tell me..."
  q = q.replace(/^(can you\s+)?(please\s+)?(just\s+)?(search|look up|find out|google|check)\s+(for\s+)?(the\s+)?/i, "");
  q = q.replace(/\s+(tell me|please|thanks)[\s.?!]*$/i, "");
  q = q.replace(/^["'\\]+|["'\\]+$/g, "");
  return q.trim() || prompt.trim();
};

/**
 * Executes Tavily search with adaptive intent evaluation.
 * If forceSearch is false and the query does not require live data, search is skipped.
 */
export const searchWeb = async (query, { maxResults = 5, forceSearch = false } = {}) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your_tavily")) {
    console.warn("[TavilySearch] TAVILY_API_KEY is not configured in environment.");
    return null;
  }

  const rawQuery = (query || "").trim();
  if (!rawQuery) return null;

  // Method 1: Evaluate search intent unless user explicitly forced it
  if (!forceSearch) {
    const intent = analyzeSearchIntent(rawQuery);
    if (!intent.shouldSearch) {
      console.log(`[TavilySearch] Skipping search for offline task (${intent.reason}): "${rawQuery.slice(0, 50)}..."`);
      await logTelemetry("web_search_skipped", {
        reason: intent.reason,
        query: rawQuery.slice(0, 100),
      });
      return null;
    }
  }

  const optimalQuery = cleanSearchQuery(rawQuery).slice(0, 400);

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
        query: optimalQuery,
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
    let formattedContext = `[LIVE WEB SEARCH GROUNDING]\nQuery: "${optimalQuery}"\n`;

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
      query: optimalQuery,
      resultsCount: results.length,
      hasDirectAnswer: Boolean(data.answer),
    });

    return formattedContext;
  } catch (err) {
    console.warn("[TavilySearch] Search request failed:", err.message);
    return null;
  }
};
