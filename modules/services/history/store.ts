import fs from 'fs';
import path from 'path';
import { SessionData, DEFAULT_SYSTEM_PROMPT } from './types';

export class HistoryStore {
  private DATA_DIR: string;
  private defaultDailyCredits: number;

  constructor(dataDir: string, defaultDailyCredits: number) {
    this.DATA_DIR = dataDir;
    this.defaultDailyCredits = defaultDailyCredits;
    
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
    }
  }

  saveSession(key: string, session: SessionData) {
    try {
      const filePath = path.join(this.DATA_DIR, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Failed to save session ${key}:`, error);
    }
  }

  loadSession(key: string): SessionData | null {
    try {
      const filePath = path.join(this.DATA_DIR, `${key}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        
        // MIGRATION 1: Convert very old files (pre-contexts)
        if (!data.contexts && (data as any).history) {
            return {
                contexts: {
                    'default': { 
                        history: (data as any).history, 
                        personality: (data as any).personality || DEFAULT_SYSTEM_PROMPT 
                    }
                },
                dailyCredits: this.defaultDailyCredits,
                purchasedCredits: 0,
                lastDailyReset: Date.now(),
                totalCreditsUsed: 0,
                totalTextMessages: 0,
                totalImagesGenerated: 0
            };
        }

        // MIGRATION 2: Add missing fields for Economy & Stats
        if (data.dailyCredits === undefined) {
            data.dailyCredits = this.defaultDailyCredits;
            data.purchasedCredits = 0;
            data.lastDailyReset = Date.now();
        }
        if (data.totalCreditsUsed === undefined) {
            data.totalCreditsUsed = 0;
            data.totalTextMessages = 0;
            data.totalImagesGenerated = 0;
        }

        return data as SessionData;
      }
    } catch (error) {
      console.error(`Failed to load session ${key}:`, error);
    }
    return null;
  }
}