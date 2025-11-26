import fs from 'fs';
import path from 'path';
import { ChatMessage } from './openrouter-client';

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

// Inner structure for a single context
interface ContextData {
  history: ChatMessage[];
  personality: string;
}

// Root structure for the user/group file
interface SessionData {
  contexts: { [key: string]: ContextData };
  
  // --- ECONOMY ---
  dailyCredits: number;      // Resets daily
  purchasedCredits: number;  // Does not reset
  lastDailyReset: number;    // Timestamp of last reset

  // --- LIFETIME STATS ---
  totalCreditsUsed: number;
  totalTextMessages: number;
  totalImagesGenerated: number;
}

export class HistoryManager {
  private sessions = new Map<string, SessionData>();
  private MAX_HISTORY = 100;
  private DATA_DIR = path.resolve('./data');

  // Configurable limits
  public DAILY_LIMIT_STANDARD = 5;
  public DAILY_LIMIT_VIP = 20;

  constructor() {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR);
    }
  }

  // --- PERSISTENCE ---

  private saveSession(key: string) {
    try {
      const session = this.sessions.get(key);
      if (!session) return;
      const filePath = path.join(this.DATA_DIR, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Failed to save session ${key}:`, error);
    }
  }

  private loadSession(key: string): SessionData | null {
    try {
      const filePath = path.join(this.DATA_DIR, `${key}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        
        // MIGRATION 1: Convert very old files (pre-contexts)
        if (!data.contexts && data.history) {
            return {
                contexts: {
                    'default': { history: data.history, personality: data.personality || DEFAULT_SYSTEM_PROMPT }
                },
                dailyCredits: this.DAILY_LIMIT_STANDARD,
                purchasedCredits: 0,
                lastDailyReset: Date.now(),
                totalCreditsUsed: 0,
                totalTextMessages: 0,
                totalImagesGenerated: 0
            };
        }

        // MIGRATION 2: Add missing fields for Economy & Stats
        if (data.dailyCredits === undefined) {
            data.dailyCredits = this.DAILY_LIMIT_STANDARD;
            data.purchasedCredits = 0;
            data.lastDailyReset = Date.now();
        }
        if (data.totalCreditsUsed === undefined) {
            data.totalCreditsUsed = 0;
            data.totalTextMessages = 0;
            data.totalImagesGenerated = 0;
        }

        return data;
      }
    } catch (error) {
      console.error(`Failed to load session ${key}:`, error);
    }
    return null;
  }

  // --- SESSION HELPERS ---

  private getSession(key: string): SessionData {
    if (this.sessions.has(key)) return this.sessions.get(key)!;

    const loadedData = this.loadSession(key);
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

    // 2. UPGRADE CHECK (Fixed Logic)
    // Only upgrade if they are EXACTLY at the Standard Limit (meaning they haven't spent anything yet, or just got reset)
    // OR if they are between Standard and VIP limit but haven't spent down.
    // Actually, the safest logic is: If they are VIP, and their dailyCredits is EXACTLY 5 (Standard Limit), bump it.
    // If it is 0, 1, 2, 3, 4... they spent it. Don't bump.
    
    if (isVIP && session.dailyCredits === this.DAILY_LIMIT_STANDARD) {
         const bonus = this.DAILY_LIMIT_VIP - this.DAILY_LIMIT_STANDARD;
         session.dailyCredits += bonus;
         console.log(`💎 Applied VIP Bonus for ${key}: +${bonus} credits`);
         this.saveSession(key);
    }
  }

  getBalance(key: string): number {
    const session = this.getSession(key);
    return session.dailyCredits + session.purchasedCredits;
  }

  deductCredits(key: string, amount: number): boolean {
    const session = this.getSession(key);
    
    if ((session.dailyCredits + session.purchasedCredits) < amount) return false;

    let remainingCost = amount;

    // Burn Daily first
    if (session.dailyCredits >= remainingCost) {
        session.dailyCredits -= remainingCost;
        remainingCost = 0;
    } else {
        remainingCost -= session.dailyCredits;
        session.dailyCredits = 0;
        // Burn Purchased
        session.purchasedCredits -= remainingCost;
    }

    this.saveSession(key);
    return true;
  }

  refundCredits(key: string, amount: number, type: 'text' | 'image') {
    const session = this.getSession(key);
    
    // Give back to Daily first (if it was deducted from there)
    // This logic is simple: Just dump it back into Daily up to the limit, rest to Purchased
    // Or simpler: Just dump it all into Daily (it expires anyway) or Purchased (permanent refund).
    // Let's do a smart refund:
    
    // We don't track exactly where it came from, so we'll credit Daily first.
    session.dailyCredits += amount;
    
    // Fix stats
    session.totalCreditsUsed = Math.max(0, session.totalCreditsUsed - amount);
    if (type === 'text') session.totalTextMessages = Math.max(0, session.totalTextMessages - 1);
    if (type === 'image') session.totalImagesGenerated = Math.max(0, session.totalImagesGenerated - 1);

    console.log(`Refunded ${amount} credits to ${key}`);
    this.saveSession(key);
  }

  // NEW: Record Stats
  recordUsage(key: string, cost: number, type: 'text' | 'image') {
    const session = this.getSession(key);
    session.totalCreditsUsed += cost;
    if (type === 'text') session.totalTextMessages += 1;
    if (type === 'image') session.totalImagesGenerated += 1;
    this.saveSession(key);
  }

  // NEW: Expose full session object for the credits command
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