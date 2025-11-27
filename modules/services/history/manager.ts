import path from 'path';
import { ChatMessage } from '../../adapters/openrouter';
import { SessionData, ContextData, DeductReceipt, DEFAULT_SYSTEM_PROMPT } from './types';
import { HistoryStore } from './store';

/**
 * Manager for handling history, contexts, and economy across sessions.
 */
export class HistoryManager {
  private sessions = new Map<string, SessionData>();
  private MAX_HISTORY = 100;
  
  // Configurable limits
  public DAILY_LIMIT_STANDARD = 5;
  public DAILY_LIMIT_VIP = 20;

  private store: HistoryStore;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    this.store = new HistoryStore(dataDir, this.DAILY_LIMIT_STANDARD);
  }

  // --- PERSISTENCE ---

  private async saveSession(key: string) {
    const session = this.sessions.get(key);
    if (!session) return;
    await this.store.saveSession(key, session);
  }

  // --- SESSION HELPERS ---

  private async getSession(key: string): Promise<SessionData> {
    if (this.sessions.has(key)) return this.sessions.get(key)!;

    const loadedData = await this.store.loadSession(key);
    if (loadedData) {
      this.sessions.set(key, loadedData);
      return loadedData;
    }

    // New User Default State
    const newSession: SessionData = { 
      contexts: {},
      dailyCredits: this.DAILY_LIMIT_STANDARD,
      purchasedCredits: 0,
      lastDailyReset: Date.now(),
      totalCreditsUsed: 0,
      totalTextMessages: 0,
      totalImagesGenerated: 0
    };
    this.sessions.set(key, newSession);
    return newSession;
  }

  private async getContext(key: string, contextKey: string): Promise<ContextData> {
    const session = await this.getSession(key);
    
    if (!session.contexts[contextKey]) {
      session.contexts[contextKey] = {
        history: [],
        personality: DEFAULT_SYSTEM_PROMPT
      };
    }
    
    return session.contexts[contextKey];
  }

  // --- CREDIT & STATS LOGIC ---

  /**
   * Checks and resets daily credits if a new day has started.
   * @param key The user key.
   * @param isVIP Whether the user is VIP for limit calculation.
   */
  async checkDailyReset(key: string, isVIP: boolean) {
    const session = await this.getSession(key);
    const now = new Date();
    const last = new Date(session.lastDailyReset);
    const targetLimit = isVIP ? this.DAILY_LIMIT_VIP : this.DAILY_LIMIT_STANDARD;

    // 1. Date Changed? Reset fully.
    if (now.getUTCDate() !== last.getUTCDate() || now.getUTCMonth() !== last.getUTCMonth()) {
        console.log(`🔄 Resetting credits for ${key} to ${targetLimit}`);
        session.dailyCredits = targetLimit;
        session.lastDailyReset = now.getTime();
        await this.saveSession(key);
        return;
    }
  }

  /**
   * Gets the current balance of credits (daily + purchased).
   * @param key The user key.
   * @returns The total balance of the user.
   */
  async getBalance(key: string): Promise<number> {
    const session = await this.getSession(key);
    return session.dailyCredits + session.purchasedCredits;
  }

  /**
   * SMART DEDUCT: Returns a receipt of where credits came from
   * @param key The user key.
   * @param amount The amount of credits to deduct.
   * @returns A receipt indicating the source of the deducted credits.
   */
  async deductCredits(key: string, amount: number): Promise<DeductReceipt> {
    const session = await this.getSession(key);
    
    if (await this.getBalance(key) < amount) {
        return { success: false, dailyDeducted: 0, purchasedDeducted: 0 };
    }

    let remainingCost = amount;
    let dailyDeducted = 0;
    let purchasedDeducted = 0;

    // Burn Daily first
    if (session.dailyCredits >= remainingCost) {
        session.dailyCredits -= remainingCost;
        dailyDeducted = remainingCost;
        remainingCost = 0;
    } else {
        dailyDeducted = session.dailyCredits;
        remainingCost -= session.dailyCredits;
        session.dailyCredits = 0;
        // Burn Purchased
        purchasedDeducted = remainingCost;
        session.purchasedCredits -= purchasedDeducted;
    }

    await this.saveSession(key);
    return { success: true, dailyDeducted, purchasedDeducted };
  }

  /**
   * SMART REFUND: Puts credits back exactly where they came from
   * @param key The user key.
   * @param receipt The receipt of the deducted credits.
   * @param type The type of the action ('text' or 'image').
   */
  async refundCredits(key: string, receipt: { daily: number, purchased: number }, type: 'text' | 'image') {
    const session = await this.getSession(key);
    
    session.dailyCredits += receipt.daily;
    session.purchasedCredits += receipt.purchased;
    
    // Fix stats (Decreasing counts because the action failed)
    const amount = receipt.daily + receipt.purchased;
    session.totalCreditsUsed = Math.max(0, session.totalCreditsUsed - amount);
    if (type === 'text') session.totalTextMessages = Math.max(0, session.totalTextMessages - 1);
    if (type === 'image') session.totalImagesGenerated = Math.max(0, session.totalImagesGenerated - 1);

    console.log(`Refunded: Daily=${receipt.daily}, Purchased=${receipt.purchased} to ${key}`);
    await this.saveSession(key);
  }

  // Record Stats
  /**
   * Records the usage of credits for a specific action.
   * @param key The user key.
   * @param cost The cost in credits for the action.
   * @param type The type of the action ('text' or 'image').
   */
  async recordUsage(key: string, cost: number, type: 'text' | 'image') {
    const session = await this.getSession(key);
    session.totalCreditsUsed += cost;
    if (type === 'text') session.totalTextMessages += 1;
    if (type === 'image') session.totalImagesGenerated += 1;
    await this.saveSession(key);
  }

  /**
   * Gets the stats of the user session.
   * @param key The user key.
   * @returns The session data including stats.
   */
  async getStats(key: string): Promise<SessionData> {
    return await this.getSession(key);
  }

  // --- PUBLIC CONTEXT API ---

  /**
   * Gets the message history of a specific context.
   * @param key The user key.
   * @param contextKey The context identifier.
   * @returns The message history of the context.
   */
  async getHistory(key: string, contextKey: string): Promise<ChatMessage[]> {
    return (await this.getContext(key, contextKey)).history;
  }

  /**
   * Adds a message to the context history.
   * @param key The user key.
   * @param contextKey The context identifier.
   * @param role The role of the message sender ('user' | 'assistant' | 'system').
   * @param content The content of the message.
   */
  async addMessage(key: string, contextKey: string, role: 'user' | 'assistant' | 'system', content: string) {
    const ctx = await this.getContext(key, contextKey);
    ctx.history.push({ role, content });
    if (ctx.history.length > this.MAX_HISTORY) ctx.history.shift(); 
    await this.saveSession(key);
  }

  /**
   * Clears the message history of a specific context.
   * @param key The user key.
   * @param contextKey The context identifier.
   */
  async clearHistory(key: string, contextKey: string) {
    const ctx = await this.getContext(key, contextKey);
    ctx.history = []; 
    await this.saveSession(key);
  }

  /**
   * Sets the personality prompt for a specific context.
   * @param key The user key.
   * @param contextKey The context identifier.
   * @param personality The personality prompt text.
   */
  async setPersonality(key: string, contextKey: string, personality: string) {
    const ctx = await this.getContext(key, contextKey);
    ctx.personality = personality || DEFAULT_SYSTEM_PROMPT;
    await this.saveSession(key);
  }

  /**
   * Gets the system prompt (personality) for a specific context.
   * @param key The user key.
   * @param contextKey The context identifier.
   * @returns The personality prompt text.
   */
  async getSystemPrompt(key: string, contextKey: string): Promise<string> {
    return (await this.getContext(key, contextKey)).personality;
  }
}

export const historyManager = new HistoryManager();