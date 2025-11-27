import { Response } from 'express';

export interface UserSummary {
  kind: 'success';
  user: {
    displayName?: string;
    username?: string;
    diamondStatus?: string;
  };
}

export interface ChatSummary {
  kind?: 'error';
  latestEventIndex?: number;
}

export interface ChatEventArgs {
  kind: 'chat_events_page';
  startEventIndex: number;
  maxEvents: number;
  maxMessages: number;
  ascending: boolean;
}

export interface ChatEventsResponse {
  events: Array<{
    event: {
      kind: string;
      sender: string;
      content: {
        kind: string;
        text?: string;
      };
    };
  }>;
}

export interface BotClient {
  userSummary(): Promise<UserSummary>;
  stringArg(name: string): string;
  chatSummary(): Promise<ChatSummary>;
  chatEvents(args: ChatEventArgs): Promise<ChatEventsResponse>;
  createTextMessage(text: string): Promise<unknown>; // Message
  createImageMessage(data: Uint8Array, mime: string, width: number, height: number, caption?: string): Promise<unknown>; // Message
  sendMessage(message: unknown): Promise<void>;
}

export interface BotContext {
  client: BotClient;
  userId: string;
  username: string;
  displayName: string;
  membershipTier: 'Standard' | 'Diamond' | 'Lifetime';
  storageKey: string;
  isGroup: boolean;
  token: string;
  commandName: string;
  res: Response;
  economy: any; // EconomyManager
  lastTransaction: { daily: number; purchased: number } | null;
  init(): Promise<void>;
  getString(name: string): string;
  checkAndCharge(cost: number, type?: 'text' | 'image'): Promise<boolean>;
  refund(type: 'text' | 'image'): Promise<void>;
  chatWithAI(options: {
    contextKey: string;
    userPrompt: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    reasoningEnabled?: boolean;
    tools?: unknown[];
  }): Promise<void>;
  reply(text: string): Promise<void>;
  replyWithImage(imageUrl: string, caption?: string): Promise<void>;
  fetchRecentMessages(limit?: number): Promise<string | null>;
}
