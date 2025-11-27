import { BotContext } from '../core/context';
import { success } from './success';
import { downloadAndResizeImage } from './image-processor';
import { sendToOpenChat } from '../adapters/openchat';

export async function reply(ctx: BotContext, text: string) {
  console.log("Saving Text to Blockchain...");
  const message = await ctx.client.createTextMessage(text);
  await sendToOpenChat(ctx.client, ctx.token, message);
  (ctx as any).res.status(200).json(success(message));
}

export async function replyWithImage(ctx: BotContext, imageUrl: string, caption?: string) {
  if (!imageUrl) {
    // This isn't a fatal error that needs refunding here, the caller handles that
    throw new Error("No image URL provided.");
  }

  console.log("Processing Image URL:", imageUrl.substring(0, 50) + "...");

  const processed = await downloadAndResizeImage(imageUrl);

  if (!processed) {
    throw new Error("Failed to download or process image.");
  }

  const message = await ctx.client.createImageMessage(
    processed.data,
    processed.mime,
    1024,
    559,
    caption
  );

  await sendToOpenChat(ctx.client, ctx.token, message);
  console.log("Image Sent Successfully.");
  (ctx as any).res.status(200).json(success(message));
}
