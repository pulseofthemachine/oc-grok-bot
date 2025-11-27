import { Command } from '../core/registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { validateImageUrl } from '../utils/url-validator';
import { completeChat, ImageResponse } from '../adapters/openrouter';
import { BOT_ADMIN_ID } from '../core/config';

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
if (!(await ctx.checkAndCharge(10, 'image'))) return;
    // Cost: 10 Credits
    const COST = 10;
    if (!(await ctx.checkAndCharge(COST, 'image'))) return;

    const url = ctx.getString("image_url");
    const prompt = ctx.getString("prompt");


    // 1. Validate URL
    const validation = await validateImageUrl(url);
    if (!validation.isValid) {
        await ctx.reply(`❌ Error: ${validation.error}`);
        return;
    }

    try {
        //  Prepare Multimodal Payload
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

        // Call AI
        const response = await completeChat(messages, {
            model: "google/gemini-3-pro-image-preview",
            modalities: ["image"], // Ask for an image back!
            temperature: 1
        });

        // Handle Result
        if (Array.isArray(response) && response.length > 0) {
            const imageObj = response[0] as any;
            let finalUrl: string | undefined;

            if (imageObj.url) finalUrl = imageObj.url;
            else if (imageObj.image_url?.url) finalUrl = imageObj.image_url.url;
            else if (imageObj.b64_json) finalUrl = `data:image/png;base64,${imageObj.b64_json}`;

            if (!finalUrl) {
                throw new Error("AI generated an image, but the URL format was unrecognized.");
            }
            
            await ctx.replyWithImage(finalUrl, `Generated: ${prompt}`);
            
        } else if (typeof response === 'string') {
            // --- FIX: Throw Error instead of just replying ---
            // This forces the code into the 'catch' block, which processes the REFUND.
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