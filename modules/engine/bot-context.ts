import { Request, Response } from 'express';
import { BotClientFactory, BadRequestError } from '@open-ic/openchat-botclient-ts';
import { success } from '../helpers/success';
import { historyManager } from './history-manager';
import { completeChat, ChatMessage } from './openrouter-client';
import { buildSystemPrompt } from '../helpers/prompt-builder';
import { formatDisplayMessage } from '../helpers/message-formatter';
import sharp from 'sharp';

export class BotContext {
  public client: any;
  public userId: string;
  
  // User Details
  public username: string = "Unknown";
  public displayName: string = "User";
  public membershipTier: "Standard" | "Diamond" | "Lifetime" = "Standard";

  public storageKey: string;
  public isGroup: boolean;
  public token: string;
  public commandName: string;
  private res: Response;

  constructor(req: Request, res: Response, factory: BotClientFactory) {
    this.res = res;
    const token = req.headers['x-oc-jwt'] as string;

    this.token = token;
    this.client = factory.createClientFromCommandJwt(token);

    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    this.userId = payload.command?.initiator || "Unknown";
    this.commandName = payload.command?.name;

    const chatScope = payload.scope?.Chat?.chat || {};
    const groupID = chatScope.Group || chatScope.Channel;

    if (groupID) {
      this.isGroup = true;
      this.storageKey = groupID;
    } else {
      this.isGroup = false;
      this.storageKey = this.userId;
    }
  }

  // --- ASYNC INIT ---
  async init() {
    try {
        const resp = await this.client.userSummary();
        if (resp.kind === "success") {
            const summary = resp.user;
            this.displayName = summary.displayName || summary.username || "User";
            this.username = summary.username || "Unknown";

            const rawStatus = String(summary.diamondStatus || "").toLowerCase();
            if (rawStatus === "lifetime") this.membershipTier = "Lifetime";
            else if (["active", "diamond"].includes(rawStatus)) this.membershipTier = "Diamond";
            
            console.log(`User: ${this.displayName} | Tier: ${this.membershipTier}`);
        } 
    } catch (e) {
        console.warn(`User summary fetch failed for ${this.userId}`);
    }
  }

  getString(name: string): string {
    const val = this.client.stringArg(name);
    if (!val) throw new Error(`Missing argument: ${name}`);
    return val;
  }

  // --- TEXT CHAT HELPER ---
  async chatWithAI(options: {
    contextKey: string;
    userPrompt: string;
    systemPrompt?: string; 
    model?: string;
    temperature?: number;
    reasoningEnabled?: boolean;
    tools?: any[];
  }) {
    const { contextKey, userPrompt, model, temperature, reasoningEnabled, tools } = options;

    // 1. HISTORY: Save Input
    historyManager.addMessage(this.storageKey, contextKey, 'user', `${this.displayName}: ${userPrompt}`);

    // 2. BUILD PROMPT
    const finalSystemPrompt = buildSystemPrompt(
      this.userId, 
      this.storageKey, 
      contextKey, 
      this.displayName, 
      this.membershipTier, 
      this.isGroup,
      options.systemPrompt
    );
    
    // 3. PREPARE CONTEXT
    const contextMessages: ChatMessage[] = [{ role: 'system', content: finalSystemPrompt }];
    contextMessages.push(...historyManager.getHistory(this.storageKey, contextKey));

    // Debug Log
    console.log(`\n[AI Request] User: ${this.displayName} (${this.membershipTier}) | Prompt: ${userPrompt.substring(0,50)}...`);

    // 4. CALL AI
    const response = await completeChat(contextMessages, { 
      model: model || "x-ai/grok-4.1-fast:free",
      temperature: temperature || 0.7,
      reasoningEnabled: reasoningEnabled,
      tools: tools
    });

    // Handle potential image response (legacy check) or null
    let textResponse = "No response.";
    if (typeof response === 'string') {
        textResponse = response;
    } else if (Array.isArray(response)) {
        textResponse = "[Image Generated - Use /imagine to view images]";
    }

    // 5. HISTORY: Save Output
    historyManager.addMessage(this.storageKey, contextKey, 'assistant', textResponse);

    // 6. UI: Display
    const displayMessage = formatDisplayMessage(this.userId, userPrompt, textResponse, this.isGroup);

    await this.reply(displayMessage);
  }

  // --- TEXT REPLY HELPER ---
  async reply(text: string) {
    const message = await this.client.createTextMessage(text);
    
    // Monkey Patch: Inject auth_token
    const originalToInputArgs = message.toInputArgs.bind(message);
    message.toInputArgs = (ctx: any) => {
        const standardArgs = originalToInputArgs(ctx);
        return { ...standardArgs, auth_token: this.token };
    };

    try {
      await this.client.sendMessage(message);
      if (!this.res.headersSent) this.res.status(200).json(success(message));
    } catch (e: any) {
      console.error("BLOCKCHAIN ERROR:", e);
      if (!this.res.headersSent) this.res.status(500).send("Failed to save message");
    }
  }

  // --- IMAGE PROCESSING HELPER ---
  async processImage(imageUrl: string): Promise<{ data: Uint8Array, mime: string } | null> {
    try {
      let buffer: Buffer;

      // Handle Base64 Data URL
      if (imageUrl.startsWith('data:')) {
        const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches) return null;
        buffer = Buffer.from(matches[2], 'base64');
      } 
      // Handle HTTP URL
      else {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      // Resize with Sharp (Crucial for OpenChat limits)
      const resizedBuffer = await sharp(buffer)
        .resize(1024, 559, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat('png')
        .toBuffer();

      return {
        data: new Uint8Array(resizedBuffer),
        mime: 'image/png'
      };

    } catch (e) {
      console.error("Image Processing Error:", e);
      return null;
    }
  }

  // --- IMAGE REPLY HELPER ---
  async replyWithImage(imageUrl: string, caption?: string) {
    if (!imageUrl) {
        console.error("replyWithImage called with empty URL");
        await this.reply("Error: No image URL provided.");
        return;
    }

    console.log("Processing Image URL:", imageUrl.substring(0, 50) + "...");

    const processed = await this.processImage(imageUrl);
    
    if (!processed) {
        await this.reply("Error: Failed to process the generated image.");
        return;
    }

    const message = await this.client.createImageMessage(
        processed.data, 
        processed.mime, 
        1024, 
        559, 
        caption
    );

    // Monkey Patch
    const originalToInputArgs = message.toInputArgs.bind(message);
    message.toInputArgs = (ctx: any) => {
        return { ...originalToInputArgs(ctx), auth_token: this.token };
    };

    try {
      await this.client.sendMessage(message);
      if (!this.res.headersSent) this.res.status(200).json(success(message));
      console.log("Image Sent Successfully.");
    } catch (e) {
      console.error("Failed to send image:", e);
    }
  }
}