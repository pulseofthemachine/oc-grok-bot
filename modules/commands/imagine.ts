import { Command } from '../core/registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { completeChat, ImageResponse } from '../adapters/openrouter';

export const ImagineCommand: Command = {
  name: "imagine",
  description: "Generate an image using AI",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text", "Image"] }),
  params: [
    {
      name: "prompt",
      description: "Describe the image you want to see",
      required: true,
      param_type: { StringParam: { min_length: 1, max_length: 1000, multi_line: false, choices: [] } }
    }
  ],
  execute: async (ctx) => {
    // Cost: 10 Credits
    if (!(await ctx.checkAndCharge(10, 'image'))) return;

    const prompt = ctx.getString("prompt");

    try {
        // 1. Call OpenRouter with Image Modality
        const response = await completeChat([
            { role: 'user', content: prompt }
        ], {
            model: "google/gemini-2.5-flash-image", // Supports text-to-image
            modalities: ["image"],
            temperature: 1
        });

        // 2. Handle Response
        if (Array.isArray(response) && response.length > 0) {
            const imageObj = response[0] as Record<string, unknown>;
            let finalUrl: string | undefined;

            if (typeof imageObj.url === 'string') finalUrl = imageObj.url;
            else if (imageObj.image_url && typeof (imageObj.image_url as any).url === 'string') {
              finalUrl = (imageObj.image_url as any).url;
            } else if (typeof imageObj.b64_json === 'string') {
              finalUrl = `data:image/png;base64,${imageObj.b64_json}`;
            }

            if (!finalUrl) {
                throw new Error("AI generated an image, but the URL format was unrecognized.");
            }
            
            await ctx.replyWithImage(finalUrl, `Generated: ${prompt}`);
            
        } else if (typeof response === 'string') {
            throw new Error(`AI Refusal: ${response}`);
        } else {
            throw new Error("No image returned from provider.");
        }

    } catch (e: any) {
        console.error("Imagine Error:", e);
        
        // Refund runs here
        await ctx.refund('image');
        await ctx.reply(`❌ Generation Failed (Credits Refunded): ${e.message}`);
    }
  }
};