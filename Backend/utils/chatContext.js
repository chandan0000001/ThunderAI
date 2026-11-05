const THUNDER_SYSTEM_PROMPT = `You are Thunder AI, a high-throughput multimodal intelligence core designed for software engineering, deep mathematical reasoning, and full-stack architecture.
Answer questions clearly, rigorously, and accurately.
When providing code, provide production-ready, clean, well-typed, and modular code with no unnecessary placeholders.
Provide structured, concise explanations with markdown formatting.`;

export const buildMessagesForAI = ({ chat, oldMessages, currentMessage }) => {
  const messages = [
    {
      role: "system",
      content: THUNDER_SYSTEM_PROMPT,
    },
  ];

  if (chat.summary && chat.summary.trim() !== "") {
    messages.push({
      role: "system",
      content: `Previous conversation summary:\n${chat.summary}`,
    });
  }

  for (const msg of oldMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  messages.push({
    role: "user",
    content: currentMessage,
  });

  return messages;
};