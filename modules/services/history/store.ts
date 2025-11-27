import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';
import { SessionData, DEFAULT_SYSTEM_PROMPT } from './types';

/**
 * Class for handling file-based storage of session data.
 */
export class HistoryStore {
  private DATA_DIR: string;
  private defaultDailyCredits: number;

  constructor(dataDir: string, defaultDailyCredits: number) {
    this.DATA_DIR = dataDir;
    this.defaultDailyCredits = defaultDailyCredits;
    
    if (!fsSync.existsSync(this.DATA_DIR)) {
      fsSync.mkdirSync(this.DATA_DIR, { recursive: true });
    }
  }

  /**
   * Saves a session to a JSON file with locking to prevent race conditions.
   * @param key The session key (e.g., user ID).
   * @param session The session data to save.
   */
  async saveSession(key: string, session: SessionData) {
    const filePath = path.join(this.DATA_DIR, `${key}.json`);
    let release;
    try {
      release = await lockfile.lock(filePath, { retries: { retries: 5, minTimeout: 10 } });
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf8');
    } catch (error) {
      console.error(`Failed to save session ${key}:`, error);
      throw error; // Re-throw to handle upstream
    } finally {
      if (release) await release();
    }
  }

  /**
   * Loads a session from a JSON file with locking and migrations.
   * @param key The session key to load.
   * @returns The loaded session data or null if not found.
   */
  async loadSession(key: string): Promise<SessionData | null> {
    const filePath = path.join(this.DATA_DIR, `${key}.json`);
    let release;
    try {
      if (!(await fs.access(filePath).then(() => true).catch(() => false))) return null;
      release = await lockfile.lock(filePath, { retries: { retries: 5, minTimeout: 10 } });
      const raw = await fs.readFile(filePath, 'utf8');
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
    } catch (error) {
      console.error(`Failed to load session ${key}:`, error);
      return null;
    } finally {
      if (release) await release();
    }
  }
}