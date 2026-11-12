import { getProviderFromModel, getActiveApiKey, getCandidateKeys } from "./keyManagerService.js";

// Normalize model ID for target provider
const normalizeModelForProvider = (provider, model = "") => {
  if (provider === "groq") {
    if (model.includes("20b")) return "openai/gpt-oss-20b";
    if (model.includes("qwen")) return "qwen/qwen3.8-27b";
    return "openai/gpt-oss-120b";
  }
  if (provider === "claude") {
    if (model.includes("haiku")) return "claude-3-5-haiku-20241022";
    return "claude-3-5-sonnet-20241022";
  }
  if (provider === "chatgpt") {
    if (model.includes("o1")) return "o1-mini";
    if (model.includes("o3")) return "o3-mini";
    if (model.includes("gpt-4o-mini")) return "gpt-4o-mini";
    return "gpt-4o";
  }
  // OpenRouter models: default to configured free model
  if (model === "openrouter/free" || !model || !model.includes("/") || model.includes("gemini")) {
    return process.env.DEFAULT_FREE_MODEL || "nvidia/nemotron-3.5-lightning:free";
  }
  return model;
};

const getOpenRouterReferer = () => process.env.OPENROUTER_REFERER || process.env.APP_PUBLIC_URL || "https://thunder-ai.app";
const getClaudeMaxTokens = () => parseInt(process.env.CLAUDE_MAX_TOKENS || "4096", 10);

// Dispatch non-streaming AI response with multi-key and multi-provider failover
export const generateAIResponse = async ({ model, messages, userId, useThunderEngine = true, webSearch = false }) => {
  const provider = getProviderFromModel(model);
  const candidates = await getCandidateKeys(userId, provider, { useThunderEngine });
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const { apiKey, isUserKey, provider: activeProvider } = candidates[i];
    const targetModel = normalizeModelForProvider(activeProvider, model);

    try {
      if (activeProvider === "claude") {
        return await generateClaudeResponse({ apiKey, model: targetModel, messages, isUserKey });
      }

      // OpenAI-compatible providers: OpenRouter, Groq, ChatGPT
      let endpoint = "https://openrouter.ai/api/v1/chat/completions";
      if (activeProvider === "groq") endpoint = "https://api.groq.com/openai/v1/chat/completions";
      else if (activeProvider === "chatgpt") endpoint = "https://api.openai.com/v1/chat/completions";

      const requestPayload = {
        model: targetModel,
        messages,
        temperature: 0.7,
        ...(webSearch && activeProvider === "openrouter"
          ? {
              tools: [
                {
                  type: "openrouter:web_search",
                  parameters: {
                    max_results: 5,
                    engine: "auto",
                  },
                },
              ],
            }
          : {}),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(activeProvider === "openrouter"
            ? {
                "HTTP-Referer": getOpenRouterReferer(),
                "X-Title": "Thunder AI Workspace",
              }
            : {}),
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(
          `${activeProvider.toUpperCase()} API error (${response.status}): ${errorText}`
        );

        // Failover on auth failure (401), rate limit (429), or server outage (5xx)
        if (response.status === 401 || response.status === 429 || response.status >= 500) {
          console.warn(`[Key Failover] Candidate key ${i + 1}/${candidates.length} (${activeProvider}) failed with HTTP ${response.status}. Retrying next candidate...`);
          lastError = err;
          continue;
        }
        throw err;
      }

      const data = await response.json();
      const aiReply = data.choices?.[0]?.message?.content;
      if (!aiReply) throw new Error("AI response was empty");

      const promptTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4);
      const completionTokens = data.usage?.completion_tokens || Math.ceil(aiReply.length / 4);

      return {
        aiReply,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        provider: activeProvider,
        isUserKey,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[AI Failover] Error with ${activeProvider} key ${i + 1}/${candidates.length}: ${err.message}`);
    }
  }

  if (!useThunderEngine) {
    throw new Error(`Your custom API key for ${provider.toUpperCase()} failed: ${lastError?.message || 'Authentication error'}. Please check your key in Settings or toggle Thunder Engine ON.`);
  }

  throw lastError || new Error(`All candidate AI model providers for ${provider} failed.`);
};

// Anthropic Claude native handler
const generateClaudeResponse = async ({ apiKey, model, messages, isUserKey }) => {
  const systemMessage = messages.find((m) => m.role === "system")?.content || "";
  const conversationMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemMessage,
      messages: conversationMessages,
      max_tokens: getClaudeMaxTokens(),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const aiReply = data.content?.[0]?.text || "";
  const promptTokens = data.usage?.input_tokens || 100;
  const completionTokens = data.usage?.output_tokens || Math.ceil(aiReply.length / 4);

  return {
    aiReply,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
    provider: "claude",
    isUserKey,
  };
};

// Dispatch streaming AI response with multi-key and multi-provider failover
export const generateAIStreamResponse = async ({
  model,
  messages,
  onChunk,
  userId,
  useThunderEngine = true,
  webSearch = false,
}) => {
  const provider = getProviderFromModel(model);
  const candidates = await getCandidateKeys(userId, provider, { useThunderEngine });
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const { apiKey, isUserKey, provider: activeProvider } = candidates[i];
    const targetModel = normalizeModelForProvider(activeProvider, model);
    let aiReply = "";
    let usage = null;

    try {
      if (activeProvider === "claude") {
        // Claude streaming
        const systemMessage = messages.find((m) => m.role === "system")?.content || "";
        const conversationMessages = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: targetModel,
            system: systemMessage,
            messages: conversationMessages,
            max_tokens: getClaudeMaxTokens(),
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`Claude stream failed (${response.status}): ${errorText}`);
          if (response.status === 401 || response.status === 429 || response.status >= 500) {
            console.warn(`[Stream Failover] Claude key ${i + 1}/${candidates.length} failed (${response.status}). Retrying...`);
            lastError = err;
            continue;
          }
          throw err;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  aiReply += parsed.delta.text;
                  if (onChunk) await onChunk(parsed.delta.text);
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      } else {
        // OpenAI / OpenRouter / Groq streaming
        let endpoint = "https://openrouter.ai/api/v1/chat/completions";
        if (activeProvider === "groq") endpoint = "https://api.groq.com/openai/v1/chat/completions";
        else if (activeProvider === "chatgpt") endpoint = "https://api.openai.com/v1/chat/completions";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(activeProvider === "openrouter"
              ? {
                  "HTTP-Referer": getOpenRouterReferer(),
                  "X-Title": "Thunder AI Workspace",
                }
              : {}),
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            stream: true,
            ...(webSearch && activeProvider === "openrouter"
              ? {
                  tools: [
                    {
                      type: "openrouter:web_search",
                      parameters: {
                        max_results: 5,
                        engine: "auto",
                      },
                    },
                  ],
                }
              : {}),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(
            `${activeProvider.toUpperCase()} streaming failed (${response.status}): ${errorText}`
          );

          if (response.status === 401 || response.status === 429 || response.status >= 500) {
            console.warn(`[Stream Failover] ${activeProvider.toUpperCase()} candidate ${i + 1}/${candidates.length} failed (${response.status}). Retrying next candidate...`);
            lastError = err;
            continue;
          }
          throw err;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  aiReply += delta;
                  if (onChunk) await onChunk(delta);
                }
                if (parsed.usage) {
                  usage = {
                    promptTokens: parsed.usage.prompt_tokens || 0,
                    completionTokens: parsed.usage.completion_tokens || 0,
                    totalTokens: parsed.usage.total_tokens || 0,
                  };
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      }

      if (!aiReply) {
        throw new Error(`AI response from ${activeProvider} was empty`);
      }

      if (!usage) {
        const promptTokens = Math.ceil(JSON.stringify(messages).length / 4);
        const completionTokens = Math.ceil(aiReply.length / 4);
        usage = {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        };
      }

      return {
        aiReply,
        usage,
        provider: activeProvider,
        isUserKey,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Stream Failover] Error with ${activeProvider} candidate ${i + 1}/${candidates.length}: ${err.message}`);
      // If we haven't emitted any tokens to the client yet, retry next candidate!
      if (!aiReply) {
        continue;
      }
      // If tokens were already emitted, return what was accumulated
      return {
        aiReply,
        usage: {
          promptTokens: Math.ceil(JSON.stringify(messages).length / 4),
          completionTokens: Math.ceil(aiReply.length / 4),
          totalTokens: Math.ceil(JSON.stringify(messages).length / 4) + Math.ceil(aiReply.length / 4),
        },
        provider: activeProvider,
        isUserKey,
      };
    }
  }

  // Fallback: If streaming failed before any chunks, attempt non-streaming with simulated typing
  try {
    console.warn(`Streaming connections exhausted for ${provider}, attempting simulated stream fallback...`);
    const fallback = await generateAIResponse({ model, messages, userId, useThunderEngine });
    const fullReply = fallback.aiReply;
    const chunkSize = 12;
    for (let i = 0; i < fullReply.length; i += chunkSize) {
      const chunk = fullReply.slice(i, i + chunkSize);
      if (onChunk) await onChunk(chunk);
      await new Promise((r) => setTimeout(r, 20));
    }
    return fallback;
  } catch (fallbackErr) {
    if (!useThunderEngine) {
      throw new Error(`Your custom API key for ${provider.toUpperCase()} failed: ${lastError?.message || fallbackErr.message}. Please check your API key in Settings or toggle Thunder Engine ON.`);
    }
    throw fallbackErr || lastError || new Error(`All available AI model providers in environment failed.`);
  }
};
