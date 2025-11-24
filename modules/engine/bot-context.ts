import { Request, Response } from 'express';
import { BotClientFactory, BadRequestError } from '@open-ic/openchat-botclient-ts';
import { success } from '../helpers/success';
import { historyManager } from './history-manager';
import { completeChat, ChatMessage } from './openrouter-client';
import { buildSystemPrompt } from '../helpers/prompt-builder';
import { formatDisplayMessage } from '../helpers/message-formatter';

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

  async chatWithAI(options: {
    contextKey: string;
    userPrompt: string;
    systemPrompt?: string; 
    model?: string;
    temperature?: number;
    reasoningEnabled?: boolean;
  }) {
    const { contextKey, userPrompt, model, temperature, reasoningEnabled } = options;

    // 1. HISTORY: Save Input
    historyManager.addMessage(this.storageKey, contextKey, 'user', `${this.displayName}: ${userPrompt}`);

    // 2. BUILD PROMPT (Delegated to Helper)
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
      reasoningEnabled: reasoningEnabled
    });

    const finalResponse = response || "No response.";

    // 5. HISTORY: Save Output
    historyManager.addMessage(this.storageKey, contextKey, 'assistant', finalResponse);

    // 6. UI: Display (Delegated to Helper)
    const displayMessage = formatDisplayMessage(this.userId, userPrompt, finalResponse, this.isGroup);

    await this.reply(displayMessage);
  }

  async reply(text: string) {
    const message = await this.client.createTextMessage(text);
    const originalToInputArgs = message.toInputArgs.bind(message);
    message.toInputArgs = (ctx: any) => {
        const standardArgs = originalToInputArgs(ctx);
        return { ...standardArgs, auth_token: this.token };
    };
    try {
      await this.client.sendMessage(message);
      if (!this.res.headersSent) this.res.status(200).json(success(message));
    } catch (e) { console.error(e); }
  }
}