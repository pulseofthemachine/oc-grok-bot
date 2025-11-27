import { Request, Response } from 'express';
import type { BotClientFactory, BotClient } from '@open-ic/openchat-botclient-ts';
import { EconomyManager } from '../services/economy';
import { chatWithAI } from '../services/chat';
import { reply, replyWithImage } from '../utils/reply-helpers';
import { fetchRecentMessages } from '../utils/chatlog-fetcher';

export class BotContext {
  public client: BotClient;
  public userId: string;
  
  public username: string = "Unknown";
  public displayName: string = "User";
  public membershipTier: "Standard" | "Diamond" | "Lifetime" = "Standard";

  public storageKey: string;
  public isGroup: boolean;
  public token: string;
  public commandName: string;
  public res: Response;
  public economy: EconomyManager;

  public lastTransaction: { daily: number, purchased: number } | null = null;

  constructor(req: Request, res: Response, factory: BotClientFactory) {
    this.res = res;
    const token = req.headers['x-oc-jwt'] as string;

    this.token = token;
    this.client = factory.createClientFromCommandJwt(token);

    let base64Payload = token.split('.')[1];
    while (base64Payload.length % 4) {
      base64Payload += '=';
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    } catch (e) {
      throw new Error('Invalid JWT token');
    }
    
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
    this.economy = new EconomyManager(this);
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
    const trimmed = val.trim();
    if (trimmed.length > 2000) throw new Error(`Argument ${name} exceeds maximum length of 2000 characters`);
    return trimmed;
  }

  async checkAndCharge(cost: number, type: 'text' | 'image' = 'text'): Promise<boolean> {
    return this.economy.checkAndCharge(cost, type);
  }

  async refund(type: 'text' | 'image') {
    return this.economy.refund(type);
  }

  async chatWithAI(options: {
    contextKey: string;
    userPrompt: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    reasoningEnabled?: boolean;
    tools?: unknown[];
  }) {
    return chatWithAI(this, options);
  }

  async reply(text: string) {
    return reply(this, text);
  }

  async replyWithImage(imageUrl: string, caption?: string) {
    return replyWithImage(this, imageUrl, caption);
  }

  async fetchRecentMessages(limit: number = 50): Promise<string | null> {
    return fetchRecentMessages(this, limit);
  }
}
