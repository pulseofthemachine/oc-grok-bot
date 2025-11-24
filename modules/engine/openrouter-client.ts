import * as dotenv from 'dotenv';
dotenv.config();

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  reasoningEnabled?: boolean;
}

export async function completeChat(
  messages: ChatMessage[], 
  options: ChatOptions = {}
): Promise<string | null> {
  
  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const model = options.model || "x-ai/grok-4.1-fast:free";
  const temperature = options.temperature ?? 0.7;
  const reasoningEnabled = options.reasoningEnabled ?? true;

  // SANITY CHECK: Filter out any corrupted messages
  // This fixes the 400 Error if history contained null/undefined
  const cleanMessages = messages.filter(m => m && m.content && typeof m.content === 'string');

  const payload: any = {
    model,
    messages: cleanMessages,
    temperature,
  };

  if (reasoningEnabled) {
    payload["reasoning"] = { enabled: true };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/your-repo",
        "X-Title": "OpenChat Bot",
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // --- THE DEBUG FIX ---
      // We read the error text from OpenRouter to see WHY it failed
      const errorBody = await response.text();
      console.error("--------------------------------");
      console.error(`OPENROUTER API ERROR: ${response.status}`);
      console.error(`PAYLOAD SENT:`, JSON.stringify(payload).substring(0, 500) + "...");
      console.error(`RESPONSE BODY:`, errorBody);
      console.error("--------------------------------");
      throw new Error(`API Error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || null;

  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
}