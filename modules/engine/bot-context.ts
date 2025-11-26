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

  // --- NEW: CREDIT GATEKEEPER ---
  async checkAndCharge(cost: number, type: 'text' | 'image' = 'text'): Promise<boolean> {
    const isVIP = (this.membershipTier === "Diamond" || this.membershipTier === "Lifetime");
    
    // FIX: Use this.userId (The Person) instead of this.storageKey (The Context)
    const walletKey = this.userId; 

    // 1. Trigger Daily Reset Check
    historyManager.checkDailyReset(walletKey, isVIP);

    // 2. Check Balance
    const balance = historyManager.getBalance(walletKey);
    
    if (balance < cost) {
        await this.reply(`🚫 **Out of Credits!**\nThis action costs ${cost} credits, but you only have ${balance}.\n\nDaily credits reset at 00:00 UTC.\nStandard: 5/day | Diamond: 20/day.`);
        return false;
    }

    // 3. Charge
    historyManager.deductCredits(walletKey, cost);
    
    // NEW: Record Stats
    historyManager.recordUsage(walletKey, cost, type);
    
    return true;
  }

  // --- REFUND HELPER ---
  async refund(amount: number, type: 'text' | 'image') {
    // FIX: Refund the Person, not the Group
    historyManager.refundCredits(this.userId, amount, type);
  }

  // --- CENTRALIZED SENDER ---
  private async sendAndRespond(messageObject: any, successLog: string) {
    const originalToInputArgs = messageObject.toInputArgs.bind(messageObject);
    messageObject.toInputArgs = (ctx: any) => {
        const standardArgs = originalToInputArgs(ctx);
        return { ...standardArgs, auth_token: this.token };
    };

    try {
      await this.client.sendMessage(messageObject);
      console.log(successLog);
      if (!this.res.headersSent) {
        this.res.status(200).json(success(messageObject));
      }
    } catch (e: any) {
      console.error("BLOCKCHAIN ERROR:", e);
      if (!this.res.headersSent) {
        this.res.status(500).send("Failed to save message");
      }
    }
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
    // 1. CHECK CREDITS (Cost: 1)
    if (!(await this.checkAndCharge(1))) return;

    const { contextKey, userPrompt, model, temperature, reasoningEnabled, tools } = options;

    historyManager.addMessage(this.storageKey, contextKey, 'user', `${this.displayName}: ${userPrompt}`);

    const finalSystemPrompt = buildSystemPrompt(
      this.userId, 
      this.storageKey, 
      contextKey, 
      this.displayName, 
      this.membershipTier, 
      this.isGroup,
      options.systemPrompt
    );
    
    const contextMessages: ChatMessage[] = [{ role: 'system', content: finalSystemPrompt }];
    contextMessages.push(...historyManager.getHistory(this.storageKey, contextKey));

    console.log(`\n[AI Request] User: ${this.displayName} (${this.membershipTier}) | Prompt: ${userPrompt.substring(0,50)}...`);

    const response = await completeChat(contextMessages, { 
      model: model || "x-ai/grok-4.1-fast:free",
      temperature: temperature || 0.7,
      reasoningEnabled: reasoningEnabled,
      tools: tools
    });

    let textResponse = "No response.";
    if (typeof response === 'string') {
        textResponse = response;
    } else if (Array.isArray(response)) {
        textResponse = "[Image Generated - Use /imagine to view images]";
    }

    historyManager.addMessage(this.storageKey, contextKey, 'assistant', textResponse);

    const displayMessage = formatDisplayMessage(this.userId, userPrompt, textResponse, this.isGroup);

    await this.reply(displayMessage);
  }

  // --- PUBLIC REPLY METHODS ---

  async reply(text: string) {
    console.log("Saving Text to Blockchain...");
    const message = await this.client.createTextMessage(text);
    await this.sendAndRespond(message, "Text Saved Successfully.");
  }

  async replyWithImage(imageUrl: string, caption?: string) {
    if (!imageUrl) {
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

    await this.sendAndRespond(message, "Image Sent Successfully.");
  }

  async processImage(imageUrl: string): Promise<{ data: Uint8Array, mime: string } | null> {
    try {
      let buffer: Buffer;
      if (imageUrl.startsWith('data:')) {
        const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches) return null;
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      const resizedBuffer = await sharp(buffer)
        .resize(1024, 559, { fit: 'inside', withoutEnlargement: true })
        .toFormat('png')
        .toBuffer();

      return { data: new Uint8Array(resizedBuffer), mime: 'image/png' };
    } catch (e) {
      console.error("Image Processing Error:", e);
      return null;
    }
  }
}