import { getProviderFromModel, getActiveApiKey } from "./keyManagerService.js";

// Normalize model ID for target provider
const normalizeModelForProvider = (provider, model) => {
  if (provider === "groq") {
    if (model.includes("llama-3.3-70b") || model.includes("llama-3.3")) return "llama-3.3-70b-versatile";
    if (model.includes("deepseek-r1")) return "deepseek-r1-distill-llama-70b";
    if (model.includes("mixtral")) return "mixtral-8x7b-32768";
    return "llama-3.3-70b-versatile";
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
  // OpenRouter models
  if (model === "openrouter/free" || !model) return "google/gemini-2.0-flash-exp:free";
  return model;
};

// Dispatch non-streaming AI response
export const generateAIResponse = async ({ model, messages, userId }) => {
  const provider = getProviderFromModel(model);
  const { apiKey, isUserKey } = await getActiveApiKey(userId, provider);
  const targetModel = normalizeModelForProvider(provider, model);

  if (provider === "claude") {
    return generateClaudeResponse({ apiKey, model: targetModel, messages, isUserKey });
  }

  // OpenAI-compatible providers: OpenRouter, Groq, ChatGPT
  let endpoint = "https://openrouter.ai/api/v1/chat/completions";
  if (provider === "groq") endpoint = "https://api.groq.com/openai/v1/chat/completions";
  else if (provider === "chatgpt") endpoint = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "openrouter"
        ? {
            "HTTP-Referer": "https://thunder-ai.app",
            "X-Title": "Thunder AI Workspace",
          }
        : {}),
    },
    body: JSON.stringify({
      model: targetModel,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${provider.toUpperCase()} API error (${response.status}): ${errorText}`
    );
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
    provider,
    isUserKey,
  };
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
      max_tokens: 4096,
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

// Dispatch streaming AI response
export const generateAIStreamResponse = async ({ model, messages, onChunk, userId }) => {
  const provider = getProviderFromModel(model);
  const { apiKey, isUserKey } = await getActiveApiKey(userId, provider);
  const targetModel = normalizeModelForProvider(provider, model);

  let endpoint = "https://openrouter.ai/api/v1/chat/completions";
  if (provider === "groq") endpoint = "https://api.groq.com/openai/v1/chat/completions";
  else if (provider === "chatgpt") endpoint = "https://api.openai.com/v1/chat/completions";

  let aiReply = "";
  let usage = null;

  try {
    if (provider === "claude") {
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
          max_tokens: 4096,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude stream failed (${response.status}): ${errorText}`);
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
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(provider === "openrouter"
            ? {
                "HTTP-Referer": "https://thunder-ai.app",
                "X-Title": "Thunder AI Workspace",
              }
            : {}),
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `${provider.toUpperCase()} streaming failed (${response.status}): ${errorText}`
        );
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
              // ignore partial json
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Primary streaming failed for ${provider}, executing simulated stream fallback:`, err.message);
    const fallback = await generateAIResponse({ model, messages, userId });
    aiReply = fallback.aiReply;
    usage = fallback.usage;

    const chunkSize = 12;
    for (let i = 0; i < aiReply.length; i += chunkSize) {
      const chunk = aiReply.slice(i, i + chunkSize);
      if (onChunk) await onChunk(chunk);
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  if (!aiReply) {
    throw new Error("AI response was empty after stream generation");
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
    provider,
    isUserKey,
  };
};
