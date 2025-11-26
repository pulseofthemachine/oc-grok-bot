import { Command } from '../engine/command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { validateImageUrl } from '../helpers/url-validator';
import { completeChat, ImageResponse } from '../engine/openrouter-client';
import { BOT_ADMIN_ID } from '../engine/config';

export const EditImageCommand: Command = {
  name: "editimage",
  description: "Edit or Analyze an image from a URL",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text", "Image"] }),
  params: [
    {
      name: "image_url",
      description: "Direct link to the image (http...)",
      required: true,
      param_type: { StringParam: { min_length: 10, max_length: 500, multi_line: false, choices: [] } }
    },
    {
      name: "prompt",
      description: "What should I do with this image?",
      required: true,
      param_type: { StringParam: { min_length: 1, max_length: 1000, multi_line: false, choices: [] } }
    }
  ],
  execute: async (ctx) => {
    const url = ctx.getString("image_url");
    const prompt = ctx.getString("prompt");
    
    // Security check
    if (ctx.userId !== BOT_ADMIN_ID) {
            await ctx.reply("⛔ **Access Denied:** Image generation is currently restricted to the bot administrator to manage API costs.");
            return;
        }

    // 1. Validate URL
    const validation = await validateImageUrl(url);
    if (!validation.isValid) {
        await ctx.reply(`❌ Error: ${validation.error}`);
        return;
    }

    try {
        // 2. Prepare Multimodal Payload
        // We send the image URL + the text prompt to the AI
        const messages: any[] = [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: url } }
                ]
            }
        ];

        // 3. Call AI
        const response = await completeChat(messages, {
            model: "google/gemini-3-pro-image-preview",
            modalities: ["image"], // Ask for an image back!
            temperature: 1
        });

        // 4. Handle Result
        if (Array.isArray(response) && response.length > 0) {
            // Success: Image Returned
            const imageObj = response[0] as any;
            const finalUrl = imageObj.url || imageObj.image_url?.url || (imageObj.b64_json ? `data:image/png;base64,${imageObj.b64_json}` : null);
            
            if (finalUrl) {
                await ctx.replyWithImage(finalUrl, `Edited: ${prompt}`);
            } else {
                throw new Error("AI returned an image object but no URL.");
            }

        } else if (typeof response === 'string') {
            // Fallback: It might describe the image instead of editing it
            await ctx.reply(`📝 Analysis: ${response}`);
        } else {
            await ctx.reply("⚠️ Error: No response from AI.");
        }

    } catch (e: any) {
        await ctx.reply(`❌ Failed: ${e.message}`);
    }
  }
};