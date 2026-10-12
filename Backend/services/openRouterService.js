import openRouter from "../config/openRouter.js";

export const generateAIResponse = async ({ model, messages }) => {
  const completion = await openRouter.chat.send({
    chatRequest: {
      model,
      messages,
    },
  });


  //here  '?' used for name?.age  here age exitst ho then read karo warna nahii 
  const aiReply = completion.choices[0]?.message?.content;

  if (!aiReply) {
    throw new Error("AI response is empty");
  }

  const promptTokens = completion.usage?.promptTokens || 0;
  const completionTokens = completion.usage?.completionTokens || 0;

  return {
    aiReply,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
};

export const generateAIStreamResponse = async ({ model, messages, onChunk }) => {
  let aiReply = "";
  let usage = null;

  try {
    // 1. Attempt native OpenRouter streaming
    const stream = await openRouter.chat.send({
      chatRequest: {
        model,
        messages,
        stream: true,
      },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        aiReply += delta;
        if (onChunk) {
          await onChunk(delta);
        }
      }
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.promptTokens || 0,
          completionTokens: chunk.usage.completionTokens || 0,
          totalTokens:
            chunk.usage.totalTokens ||
            (chunk.usage.promptTokens || 0) + (chunk.usage.completionTokens || 0),
        };
      }
    }
  } catch (streamError) {
    console.warn(
      "Native OpenRouter stream error, executing fallback stream simulation:",
      streamError?.message
    );

    // 2. Fallback to non-streaming response if model is not natively streaming
    const fallbackResponse = await generateAIResponse({ model, messages });
    aiReply = fallbackResponse.aiReply;
    usage = fallbackResponse.usage;

    // Simulate streaming in chunks for UI continuity
    const chunkSize = 10;
    for (let i = 0; i < aiReply.length; i += chunkSize) {
      const chunk = aiReply.slice(i, i + chunkSize);
      if (onChunk) {
        await onChunk(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  if (!aiReply) {
    throw new Error("AI response is empty");
  }

  if (!usage) {
    const estimatedCompletion = Math.ceil(aiReply.length / 4);
    const estimatedPrompt = Math.ceil(JSON.stringify(messages).length / 4);
    usage = {
      promptTokens: estimatedPrompt,
      completionTokens: estimatedCompletion,
      totalTokens: estimatedPrompt + estimatedCompletion,
    };
  }

  return {
    aiReply,
    usage,
  };
};