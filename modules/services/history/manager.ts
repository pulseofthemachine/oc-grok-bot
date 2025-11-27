import path from 'path';
import { ChatMessage } from '../../adapters/openrouter';
import { SessionData, ContextData, DeductReceipt, DEFAULT_SYSTEM_PROMPT } from './types';
import { HistoryStore } from './store';

export class HistoryManager {
  private sessions = new Map<string, SessionData>();
  private MAX_HISTORY = 100;
  
  // Configurable limits
  public DAILY_LIMIT_STANDARD = 5;
  public DAILY_LIMIT_VIP = 20;

  private store: HistoryStore;

  constructor() {
    // Fix pathing to ensure it works regardless of CWD
    // From: modules/services/history/manager.ts -> ../../../data
    const dataDir = path.join(__dirname, '../../../data');
    this.store = new HistoryStore(dataDir, this.DAILY_LIMIT_STANDARD);
  }

  // --- PERSISTENCE ---

  private saveSession(key: string) {
    const session = this.sessions.get(key);
    if (!session) return;
    this.store.saveSession(key, session);
  }

  // --- SESSION HELPERS ---

  private getSession(key: string): SessionData {
    if (this.sessions.has(key)) return this.sessions.get(key)!;

    const loadedData = this.store.loadSession(key);
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

  private getContext(key: string, contextKey: string): ContextData {
    const session = this.getSession(key);
    
    if (!session.contexts[contextKey]) {
      session.contexts[contextKey] = {
        history: [],
        personality: DEFAULT_SYSTEM_PROMPT
      };
    }
    
    return session.contexts[contextKey];
  }

  // --- CREDIT & STATS LOGIC ---

  checkDailyReset(key: string, isVIP: boolean) {
    const session = this.getSession(key);
    const now = new Date();
    const last = new Date(session.lastDailyReset);
    const targetLimit = isVIP ? this.DAILY_LIMIT_VIP : this.DAILY_LIMIT_STANDARD;

    // 1. Date Changed? Reset fully.
    if (now.getUTCDate() !== last.getUTCDate() || now.getUTCMonth() !== last.getUTCMonth()) {
        console.log(`🔄 Resetting credits for ${key} to ${targetLimit}`);
        session.dailyCredits = targetLimit;
        session.lastDailyReset = now.getTime();
        this.saveSession(key);
        return;
    }
  }

  getBalance(key: string): number {
    const session = this.getSession(key);
    return session.dailyCredits + session.purchasedCredits;
  }

  // SMART DEDUCT: Returns a receipt of where credits came from
  deductCredits(key: string, amount: number): DeductReceipt {
    const session = this.getSession(key);
    
    if (this.getBalance(key) < amount) {
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

    this.saveSession(key);
    return { success: true, dailyDeducted, purchasedDeducted };
  }

  // SMART REFUND: Puts credits back exactly where they came from
  refundCredits(key: string, receipt: { daily: number, purchased: number }, type: 'text' | 'image') {
    const session = this.getSession(key);
    
    session.dailyCredits += receipt.daily;
    session.purchasedCredits += receipt.purchased;
    
    // Fix stats (Decreasing counts because the action failed)
    const amount = receipt.daily + receipt.purchased;
    session.totalCreditsUsed = Math.max(0, session.totalCreditsUsed - amount);
    if (type === 'text') session.totalTextMessages = Math.max(0, session.totalTextMessages - 1);
    if (type === 'image') session.totalImagesGenerated = Math.max(0, session.totalImagesGenerated - 1);

    console.log(`Refunded: Daily=${receipt.daily}, Purchased=${receipt.purchased} to ${key}`);
    this.saveSession(key);
  }

  // Record Stats
  recordUsage(key: string, cost: number, type: 'text' | 'image') {
    const session = this.getSession(key);
    session.totalCreditsUsed += cost;
    if (type === 'text') session.totalTextMessages += 1;
    if (type === 'image') session.totalImagesGenerated += 1;
    this.saveSession(key);
  }

  getStats(key: string): SessionData {
    return this.getSession(key);
  }

  // --- PUBLIC CONTEXT API ---

  getHistory(key: string, contextKey: string): ChatMessage[] {
    return this.getContext(key, contextKey).history;
  }

  addMessage(key: string, contextKey: string, role: 'user' | 'assistant' | 'system', content: string) {
    const ctx = this.getContext(key, contextKey);
    ctx.history.push({ role, content });
    if (ctx.history.length > this.MAX_HISTORY) ctx.history.shift(); 
    this.saveSession(key);
  }

  clearHistory(key: string, contextKey: string) {
    const ctx = this.getContext(key, contextKey);
    ctx.history = []; 
    this.saveSession(key);
  }

  setPersonality(key: string, contextKey: string, personality: string) {
    const ctx = this.getContext(key, contextKey);
    ctx.personality = personality || DEFAULT_SYSTEM_PROMPT;
    this.saveSession(key);
  }

  getSystemPrompt(key: string, contextKey: string): string {
    return this.getContext(key, contextKey).personality;
  }
}

export const historyManager = new HistoryManager();