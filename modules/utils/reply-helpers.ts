import { BotContext } from '../core/context';
import { success } from './success';
import { sendToOpenChat } from '../adapters/openchat';
import { downloadAndResizeImage } from './image-processor';

export async function reply(ctx: BotContext, text: string): Promise<void> {
  console.log("Saving Text to Blockchain...");
  const message = await (ctx.client as any).createTextMessage(text);
  await sendToOpenChat(ctx.client, ctx.token, message);
  ctx.res.status(200).json(success(message as any));
}

export async function replyWithImage(ctx: BotContext, imageUrl: string, caption?: string): Promise<void> {
  if (!imageUrl) {
    // This isn't a fatal error that needs refunding here, the caller handles that
    throw new Error("No image URL provided.");
  }

  console.log("Processing Image URL:", imageUrl.substring(0, 50) + "...");

  const processed = await downloadAndResizeImage(imageUrl);
  
  if (!processed) {
    throw new Error("Failed to download or process image.");
  }

  const message = await (ctx.client as any).createImageMessage(
    processed.data, 
    processed.mime, 
    1408, 
    768
  );

  await sendToOpenChat(ctx.client, ctx.token, message);
  console.log("Image Sent Successfully.");
  ctx.res.status(200).json(success(message as any));
}
