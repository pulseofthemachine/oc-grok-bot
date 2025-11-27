import { ChatMessage } from '../../adapters/openrouter';

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

// Inner structure for a single context
export interface ContextData {
  history: ChatMessage[];
  personality: string;
}

// Root structure for the user/group file
export interface SessionData {
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

// Receipt to track where credits came from
export interface DeductReceipt {
  success: boolean;
  dailyDeducted: number;
  purchasedDeducted: number;
}