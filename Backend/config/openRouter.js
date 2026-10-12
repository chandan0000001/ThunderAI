import { OpenRouter } from "@openrouter/sdk";

if (!process.env.OPENROUTER_API_KEY) {
    console.warn("⚠️ [OpenRouter] Warning: OPENROUTER_API_KEY is not set in environment.");
}

const openRouter = new OpenRouter({    
    apiKey: process.env.OPENROUTER_API_KEY || "",
});

export default openRouter;