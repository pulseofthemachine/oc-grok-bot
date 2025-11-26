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
  tools?: any[];
  modalities?: string[];
}

// Flexible interface to catch various API response formats
export interface ImageResponse {
  url?: string;
  image_url?: { url: string };
  b64_json?: string;
  detail?: string;
}

// Return type can now be text OR an image array
export async function completeChat(
  messages: ChatMessage[], 
  options: ChatOptions = {}
): Promise<string | ImageResponse[] | null> {
  
  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  // Default to Gemini Flash if image modality is requested, otherwise Grok
  const model = options.model || (options.modalities ? "google/gemini-3-pro-image-preview" : "x-ai/grok-4.1-fast:free");
  
  // Sanity Check
  const cleanMessages = messages.filter(m => m && m.content);

  const payload: any = {
    model,
    messages: cleanMessages,
    temperature: options.temperature ?? 0.7,
  };

  if (options.reasoningEnabled) payload.reasoning = { enabled: true };
  if (options.tools) payload.tools = options.tools;
  if (options.modalities) payload.modalities = options.modalities;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/pulseofthemachine/oc-grok-bot",
        "X-Title": "OpenChat Grok Bot",
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`OPENROUTER ERROR: ${response.status} - ${err}`);
      throw new Error(`API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    // 1. Check for Native Image Array (OpenRouter Standard)
    if (choice.message.images && choice.message.images.length > 0) {
        console.log("📸 Received Native Image Array");
        return choice.message.images as ImageResponse[];
    }

    // 2. Check for Tool Calls (Some models return images as tool outputs)
    // (Skipping for now to keep it simple, but good to know)

    // 3. Fallback to Text
    return choice.message.content || null;

  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
}