import { Request, Response } from 'express';
import { BotClientFactory, BadRequestError } from '@open-ic/openchat-botclient-ts';
import { success } from './success';
import { historyManager } from './history-manager';
import { completeChat, ChatMessage } from './openrouter-client';

export class BotContext {
  public client: any;
  public userId: string;
  public storageKey: string; // <--- The ID used for the database (Group or User)
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
    
    // 1. Identify User
    this.userId = payload.command?.initiator || "Unknown";
    this.commandName = payload.command?.name;

    // 2. Identify Context (Group vs Direct)
    // The payload structure for groups is: scope.Chat.chat.Group
    const scope = payload.scope;
    const groupContext = scope?.Chat?.chat?.Group;
    const channelContext = scope?.Chat?.chat?.Channel;

    if (groupContext) {
      this.isGroup = true;
      this.storageKey = groupContext; // Use Group ID as DB Key
      console.log(`Context: Group (${this.storageKey})`);
    } else if (channelContext) {
      this.isGroup = true;
      this.storageKey = channelContext;
      console.log(`Context: Channel (${this.storageKey})`);
    } else {
      this.isGroup = false;
      this.storageKey = this.userId; // Use User ID as DB Key
      console.log(`Context: Direct Message (${this.storageKey})`);
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
  }) {
    const { contextKey, userPrompt, systemPrompt, model, temperature } = options;

    // 1. Save User Input to SHARED history
    // We prepend the User ID so the bot knows who is talking in the group
    const contentToSave = this.isGroup 
      ? `[User ${this.userId}]: ${userPrompt}` 
      : userPrompt;

    historyManager.addMessage(this.storageKey, contextKey, 'user', contentToSave);

    // 2. Build Context
    // Load from the SHARED storage key
    const finalSystemPrompt = systemPrompt || historyManager.getSystemPrompt(this.storageKey, contextKey);
    
    const contextMessages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt }
    ];

    const history = historyManager.getHistory(this.storageKey, contextKey);
    contextMessages.push(...history);

    // 3. Call AI
    const response = await completeChat(contextMessages, { 
      model: model || "x-ai/grok-4.1-fast:free",
      temperature: temperature || 0.7
    });

    const finalResponse = response || "No response.";

    // 4. Save & Reply
    historyManager.addMessage(this.storageKey, contextKey, 'assistant', finalResponse);
    await this.reply(finalResponse);
  }

  async reply(text: string) {
    // ... (Your existing reply logic with monkey patch) ...
    console.log("Saving to Blockchain...");
    const message = await this.client.createTextMessage(text);
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
}