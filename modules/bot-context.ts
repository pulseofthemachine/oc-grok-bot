import { Request, Response } from 'express';
import { BotClientFactory, BadRequestError } from '@open-ic/openchat-botclient-ts';
import { success } from './success';
import { historyManager } from './history-manager';
import { completeChat, ChatMessage } from './openrouter-client';

// --- THE GLOBAL INSTRUCTION ---
// This is appended to EVERY system prompt (Default, RPG, Custom, etc.)
const USER_ID_INSTRUCTIONS = `
[SYSTEM METADATA]: Users are identified by tags like "@UserId(xxxxx-...)". 
When referring to a specific user/character, use their tag exactly as it appears. 
The interface will render this tag as their real display name.`;

export class BotContext {
  public client: any;
  public userId: string;
  public storageKey: string;
  public isGroup: boolean;
  public token: string;
  public commandName: string;
  private res: Response;

  constructor(req: Request, res: Response, factory: BotClientFactory) {
    // ... (Constructor remains unchanged) ...
    this.res = res;
    const token = req.headers['x-oc-jwt'] as string;

    this.token = token;
    this.client = factory.createClientFromCommandJwt(token);

    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    this.userId = payload.command?.initiator || "Unknown";
    this.commandName = payload.command?.name;

    const scope = payload.scope;
    const groupContext = scope?.Chat?.chat?.Group;
    const channelContext = scope?.Chat?.chat?.Channel;

    if (groupContext) {
      this.isGroup = true;
      this.storageKey = groupContext;
      console.log(`Context: Group (${this.storageKey})`);
    } else if (channelContext) {
      this.isGroup = true;
      this.storageKey = channelContext;
      console.log(`Context: Channel (${this.storageKey})`);
    } else {
      this.isGroup = false;
      this.storageKey = this.userId;
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

    const userTag = `@UserId(${this.userId})`;
    const contentToSave = `${userTag}: ${userPrompt}`;

    historyManager.addMessage(this.storageKey, contextKey, 'user', contentToSave);

    // --- THE FIX ---
    // 1. Get the base personality (Default OR Roleplay OR Custom)
    let baseSystemPrompt = systemPrompt || historyManager.getSystemPrompt(this.storageKey, contextKey);
    
    // 2. Append the invisible instruction
    const finalSystemPrompt = baseSystemPrompt + USER_ID_INSTRUCTIONS;
    
    const contextMessages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt }
    ];

    const history = historyManager.getHistory(this.storageKey, contextKey);
    contextMessages.push(...history);

    const response = await completeChat(contextMessages, { 
      model: model || "x-ai/grok-4.1-fast:free",
      temperature: temperature || 0.7
    });

    const finalResponse = response || "No response.";

    historyManager.addMessage(this.storageKey, contextKey, 'assistant', finalResponse);

    const senderTag = `@UserId(${this.userId})`; 
    let displayMessage = "";

    if (this.isGroup) {
        // Group: Code Block with Name
        displayMessage = "```\n" + `${senderTag}: ${userPrompt}` + "\n```\n" + finalResponse;
    } else {
        // DM: Blockquote
        displayMessage = `> ${userPrompt}\n\n${finalResponse}`;
    }

    await this.reply(displayMessage);
  }

  async reply(text: string) {
    // ... (Reply logic remains unchanged) ...
    console.log("Saving to Blockchain...");
    const message = await this.client.createTextMessage(text);
    const originalToInputArgs = message.toInputArgs.bind(message);
    message.toInputArgs = (ctx: any) => {
        const standardArgs = originalToInputArgs(ctx);
        return { ...standardArgs, auth_token: this.token };
    };

    try {
      await this.client.sendMessage(message);
      console.log("Saved successfully.");
      if (!this.res.headersSent) this.res.status(200).json(success(message));
    } catch (e: any) {
      console.error("BLOCKCHAIN ERROR:", e);
      if (!this.res.headersSent) this.res.status(500).send("Failed to save message");
    }
  }
}