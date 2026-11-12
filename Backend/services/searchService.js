import { logTelemetry } from "./streamService.js";
import { redisClient } from "../config/redis.js";
import { getActiveApiKey } from "./keyManagerService.js";

/**
 * Multi-Provider Web Search & Grounding Engine
 * Supports:
 * 1. Tavily AI Search (https://api.tavily.com)
 * 2. Serper Google Search (https://google.serper.dev)
 * 3. OpenRouter Web Search Server Tool (openrouter:web_search)
 * 4. DuckDuckGo Search (https://lite.duckduckgo.com)
 * 5. Wikipedia REST API (https://en.wikipedia.org)
 *
 * Equipped with Adaptive Intent Classification, Redis Round-Robin Multi-User Load Balancing,
 * and automatic multi-engine failover.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const SERPER_ENDPOINT = "https://google.serper.dev/search";

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

  // 6. Factual inquiries
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
  q = q.replace(/^(can you\s+)?(please\s+)?(just\s+)?(search|look up|find out|google|check)\s+(for\s+)?(the\s+)?/i, "");
  q = q.replace(/\s+(tell me|please|thanks)[\s.?!]*$/i, "");
  q = q.replace(/^["'\\]+|["'\\]+$/g, "");
  return q.trim() || prompt.trim();
};

/**
 * Provider 1: Tavily Search API
 */
const searchTavily = async (query, maxResults = 5) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.includes("your_tavily")) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey.trim(),
        query,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const results = (data.results || []).map((r) => ({
      title: r.title || "Web Source",
      url: r.url || "",
      content: (r.content || "").replace(/\s+/g, " ").slice(0, 500),
    }));

    if (results.length === 0 && !data.answer) return null;
    return { provider: "tavily", answer: data.answer || null, results };
  } catch (err) {
    console.warn("[Tavily] Search note:", err.message);
    return null;
  }
};

/**
 * Provider 2: Serper Google Search API
 */
const searchSerper = async (query, maxResults = 5) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || apiKey.includes("your_serper")) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(SERPER_ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const organic = data.organic || [];

    const results = organic.slice(0, maxResults).map((r) => ({
      title: r.title || "Google Search Result",
      url: r.link || "",
      content: (r.snippet || "").replace(/\s+/g, " ").slice(0, 500),
    }));

    const answer = data.knowledgeGraph?.description || data.answerBox?.snippet || null;
    if (results.length === 0 && !answer) return null;

    return { provider: "serper", answer, results };
  } catch (err) {
    console.warn("[Serper] Search note:", err.message);
    return null;
  }
};

/**
 * Provider 3: Wikipedia REST API
 */
const searchWikipedia = async (query, maxResults = 3) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=${maxResults}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "ThunderAI/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const items = data.query?.search || [];
    if (items.length === 0) return null;

    const results = items.map((item) => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, "_"))}`,
      content: (item.snippet || "").replace(/<[^>]+>/g, "").trim().slice(0, 500),
    }));

    return { provider: "wikipedia", answer: null, results };
  } catch (err) {
    console.warn("[Wikipedia] Search note:", err.message);
    return null;
  }
};

/**
 * Provider 4: DuckDuckGo Lite Scraper
 */
const searchDuckDuckGo = async (query, maxResults = 5) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const form = new URLSearchParams();
    form.append("q", query);

    const response = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const html = await response.text();

    const linkMatches = [...html.matchAll(/<a[^>]+href=[\x27"]([^\x27"]*)[\x27"][^>]*class=[\x27"]result-link[\x27"][^>]*>([\s\S]*?)<\/a>/gi)];
    const snippetMatches = [...html.matchAll(/<td[^>]+class=[\x27"]result-snippet[\x27"][^>]*>([\s\S]*?)<\/td>/gi)];

    const results = [];
    for (let i = 0; i < Math.min(linkMatches.length, maxResults); i++) {
      let url = linkMatches[i][1];
      if (url.includes("uddg=")) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) {
          try {
            url = decodeURIComponent(match[1]);
          } catch {}
        }
      }
      const title = linkMatches[i][2].replace(/<[^>]+>/g, "").trim();
      const content = snippetMatches[i] ? snippetMatches[i][1].replace(/<[^>]+>/g, "").trim() : title;
      results.push({ title, url, content });
    }

    if (results.length === 0) return null;
    return { provider: "duckduckgo", answer: null, results };
  } catch (err) {
    console.warn("[DuckDuckGo] Search note:", err.message);
    return null;
  }
};

/**
 * Provider 5: OpenRouter Web Search Server Tool (openrouter:web_search)
 * Executes live search queries through OpenRouter's integrated web search server tool.
 */
export const searchOpenRouter = async (query, maxResults = 5, userId = null) => {
  let apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (userId) {
    try {
      const userKey = await getActiveApiKey(userId, "openrouter", { useThunderEngine: true });
      if (userKey) apiKey = userKey;
    } catch {}
  }

  if (!apiKey || apiKey.includes("your_openrouter")) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const model = process.env.OPENROUTER_SEARCH_MODEL || "google/gemini-2.0-flash-exp:free";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://thunder.ai",
        "X-Title": "Thunder AI Web Search Grounding",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `Search the web for up-to-date facts on: "${query}". Provide direct findings, source names, and exact URLs formatted as markdown links [Source Title](URL).`,
          },
        ],
        tools: [
          {
            type: "openrouter:web_search",
            parameters: {
              max_results: maxResults,
              engine: "auto",
            },
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const message = data.choices?.[0]?.message;
    if (!message) return null;

    const content = message.content || "";

    const results = [];
    const linkMatches = [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)];
    for (const match of linkMatches.slice(0, maxResults)) {
      results.push({
        title: match[1].trim(),
        url: match[2].trim(),
        content: content.slice(0, 300),
      });
    }

    // Inspect server tool annotations if returned in message payload
    if (Array.isArray(message.annotations)) {
      for (const ann of message.annotations) {
        if (ann.url && !results.some((r) => r.url === ann.url)) {
          results.push({
            title: ann.title || "OpenRouter Web Source",
            url: ann.url,
            content: ann.text || content.slice(0, 300),
          });
        }
      }
    }

    if (results.length === 0 && content) {
      results.push({
        title: "OpenRouter Web Intelligence",
        url: "https://openrouter.ai",
        content: content.slice(0, 500),
      });
    }

    return {
      provider: "openrouter",
      answer: content.slice(0, 400),
      results,
    };
  } catch (err) {
    console.warn("[OpenRouter Web Search] Search note:", err.message);
    return null;
  }
};

/**
 * Determines active candidate providers based on environment configuration and query intent.
 */
const getCandidateProviders = async (query, userId = null) => {
  const pool = [];

  // Provider 1: Tavily AI Search (active if API key is present)
  if (process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes("your_tavily")) {
    pool.push("tavily");
  }

  // Provider 2: Serper Google Search (active if API key is present)
  if (process.env.SERPER_API_KEY && !process.env.SERPER_API_KEY.includes("your_serper")) {
    pool.push("serper");
  }

  // Provider 3: OpenRouter Web Search Server Tool (active if system or user BYOK key is present)
  let hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.includes("your_openrouter"));
  if (!hasOpenRouter && userId) {
    try {
      const userKey = await getActiveApiKey(userId, "openrouter", { useThunderEngine: false });
      if (userKey) hasOpenRouter = true;
    } catch {}
  }
  if (hasOpenRouter) {
    pool.push("openrouter");
  }

  // Provider 4: DuckDuckGo Organic Scraper (free, zero-config, always active)
  pool.push("duckduckgo");

  // Provider 5: Wikipedia REST API (free encyclopedic search, active for conceptual/historical queries)
  const isWikiTopic = /\b(what is|who was|history of|define|definition of|concept of|origin of|biography|wikipedia)\b/i.test(query);
  if (isWikiTopic) {
    pool.push("wikipedia");
  }

  return pool.length > 0 ? pool : ["duckduckgo"];
};

/**
 * Dispatches query execution to a named search provider.
 */
const executeProviderSearch = async (provider, query, maxResults, userId = null) => {
  switch (provider) {
    case "tavily":
      return await searchTavily(query, maxResults);
    case "serper":
      return await searchSerper(query, maxResults);
    case "openrouter":
      return await searchOpenRouter(query, maxResults, userId);
    case "duckduckgo":
      return await searchDuckDuckGo(query, maxResults);
    case "wikipedia":
      return await searchWikipedia(query, Math.min(maxResults, 3));
    default:
      return null;
  }
};

/**
 * Master Search Orchestrator with Redis-Backed Multi-User Load Balancing & Automatic Failover
 */
export const searchWeb = async (query, { maxResults = 5, forceSearch = false, userId = null } = {}) => {
  const rawQuery = (query || "").trim();
  if (!rawQuery) return null;

  if (!forceSearch) {
    const intent = analyzeSearchIntent(rawQuery);
    if (!intent.shouldSearch) {
      console.log(`[MultiSearch] Skipping search for offline task (${intent.reason}): "${rawQuery.slice(0, 50)}..."`);
      await logTelemetry("web_search_skipped", {
        reason: intent.reason,
        query: rawQuery.slice(0, 100),
      });
      return null;
    }
  }

  const optimalQuery = cleanSearchQuery(rawQuery).slice(0, 400);

  // 1. Build candidate search provider pool
  const candidatePool = await getCandidateProviders(optimalQuery, userId);

  // 2. Redis-backed Atomic Load Balancing across queries and users
  let assignedIndex = 0;
  try {
    if (redisClient && redisClient.isOpen) {
      const rrCounter = await redisClient.incr("search:provider:rr_counter");
      assignedIndex = Number(rrCounter) % candidatePool.length;
    } else {
      assignedIndex = Math.floor(Math.random() * candidatePool.length);
    }
  } catch {
    assignedIndex = Math.floor(Math.random() * candidatePool.length);
  }

  const assignedProvider = candidatePool[assignedIndex] || candidatePool[0];

  // 3. Construct prioritized execution order: Assigned provider first, then remaining candidates as failovers
  const executionOrder = [
    assignedProvider,
    ...candidatePool.filter((p) => p !== assignedProvider),
  ];
  // Ensure Wikipedia is in failover chain if not already present
  if (!executionOrder.includes("wikipedia")) {
    executionOrder.push("wikipedia");
  }

  console.log(`[MultiSearch] Redis load-balancer assigned "${assignedProvider}" (Pool: ${candidatePool.join(", ")}) for: "${optimalQuery.slice(0, 45)}..."`);

  // 4. Execute search with automatic cascading failover
  let searchData = null;
  for (const provider of executionOrder) {
    try {
      searchData = await executeProviderSearch(provider, optimalQuery, maxResults, userId);
      if (searchData && searchData.results && searchData.results.length > 0) {
        if (provider !== assignedProvider) {
          console.log(`[MultiSearch] Assigned provider "${assignedProvider}" exhausted or failed; successfully cascaded to "${provider}"`);
        }
        break;
      }
    } catch (err) {
      console.warn(`[MultiSearch] Provider "${provider}" execution error:`, err.message);
    }
  }

  if (!searchData || !searchData.results?.length) {
    return null;
  }

  const { provider, answer, results } = searchData;

  // Track provider usage metrics in Redis
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.hIncrBy("search:stats:assigned", assignedProvider, 1);
      await redisClient.hIncrBy("search:stats:succeeded", provider, 1);
    }
  } catch {}

  // Format results into clean grounding context with markdown source links
  let formattedContext = `[LIVE WEB SEARCH GROUNDING - Source: ${provider.toUpperCase()}]\nQuery: "${optimalQuery}"\n`;

  if (answer) {
    formattedContext += `Quick Overview: ${answer}\n\n`;
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
    assignedProvider,
    successProvider: provider,
    query: optimalQuery,
    resultsCount: results.length,
    hasDirectAnswer: Boolean(answer),
    userId: userId || "anonymous",
  });

  return formattedContext;
};
