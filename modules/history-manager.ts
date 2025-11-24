import fs from 'fs';
import path from 'path';
import { ChatMessage } from './openrouter-client';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant.`;

// Inner structure for a single context
interface ContextData {
  history: ChatMessage[];
  personality: string;
}

// Root structure for the user/group file
interface SessionData {
  contexts: {
    [key: string]: ContextData;
  }
}

export class HistoryManager {
  // Key = StorageKey (User ID or Group ID)
  private sessions = new Map<string, SessionData>();
  private MAX_HISTORY = 100;
  private DATA_DIR = path.resolve('./data');

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
        
        // Migration support for old files
        if (data.history && Array.isArray(data.history)) {
            return {
                contexts: {
                    'default': { history: data.history, personality: data.personality || DEFAULT_SYSTEM_PROMPT }
                }
            };
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

    const newSession: SessionData = { contexts: {} };
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

  // --- PUBLIC API ---

  // Note: 'key' can be a UserID OR a GroupID
  getHistory(key: string, contextKey: string): ChatMessage[] {
    return this.getContext(key, contextKey).history;
  }

  addMessage(key: string, contextKey: string, role: 'user' | 'assistant' | 'system', content: string) {
    const ctx = this.getContext(key, contextKey);
    
    ctx.history.push({ role, content });

    if (ctx.history.length > this.MAX_HISTORY) {
      ctx.history.shift(); 
    }

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