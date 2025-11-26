import { Command } from '../engine/command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { completeChat, ImageResponse } from '../engine/openrouter-client';
import { BOT_ADMIN_ID } from '../engine/config'; 

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
    const prompt = ctx.getString("prompt");

    if (ctx.userId !== BOT_ADMIN_ID) {
        await ctx.reply("⛔ **Access Denied:** Image generation is currently restricted to the bot administrator to manage API costs.");
        return;
    }

    try {
        // 1. Call OpenRouter with Image Modality
        const response = await completeChat([
            { role: 'user', content: prompt }
        ], {
            model: "google/gemini-3-pro-image-preview", // Supports text-to-image
            modalities: ["image"],
            temperature: 1
        });

        // 2. Handle Response
        if (Array.isArray(response) && response.length > 0) {
            const imageObj = response[0] as any;

            let finalUrl: string | undefined;

            // Try all known formats
            if (imageObj.url) finalUrl = imageObj.url;
            else if (imageObj.image_url?.url) finalUrl = imageObj.image_url.url;
            else if (imageObj.b64_json) finalUrl = `data:image/png;base64,${imageObj.b64_json}`;

            if (!finalUrl) {
                throw new Error("AI generated an image, but the URL format was unrecognized.");
            }
            
            await ctx.replyWithImage(finalUrl, `Generated: ${prompt}`);
        }
    } catch (e: any) {
        await ctx.reply(`Generation Failed: ${e.message}`);
    }
  }
};