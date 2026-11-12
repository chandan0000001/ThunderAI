import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  searchWeb,
  searchOpenRouter,
  analyzeSearchIntent,
  cleanSearchQuery
} from "../services/searchService.js";
import { redisClient, connectRedis } from "../config/redis.js";

describe("Web Search Multi-Provider Engine & OpenRouter Integration", () => {
  before(async () => {
    try {
      await connectRedis();
    } catch {}
  });

  after(async () => {
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
      }
    } catch {}
  });

  test("searchOpenRouter function is exported and defined", () => {
    assert.strictEqual(typeof searchOpenRouter, "function");
  });

  test("cleanSearchQuery sanitizes conversational prompt prefixes", () => {
    const raw = 'can you please search for "Chandan kumar Dalai" tell me';
    const cleaned = cleanSearchQuery(raw);
    assert.strictEqual(cleaned, "Chandan kumar Dalai");
  });

  test("analyzeSearchIntent identifies live entity lookups and questions", () => {
    assert.strictEqual(analyzeSearchIntent("Who is Chandan kumar Dalai").shouldSearch, true);
    assert.strictEqual(analyzeSearchIntent("What is the latest score of today's game").shouldSearch, true);
    assert.strictEqual(analyzeSearchIntent("Write a python function to sort an array").shouldSearch, false);
  });

  test("MultiSearch orchestrator assigns and falls back safely across providers", async () => {
    // Force search on a known query
    const res = await searchWeb("Who is Chandan kumar Dalai", { forceSearch: true });
    assert.ok(res, "Search grounding should return context");
    assert.ok(res.includes("LIVE WEB SEARCH GROUNDING"), "Context includes grounding header");
    assert.ok(res.includes("URL:"), "Context includes source URLs");
  });
});
