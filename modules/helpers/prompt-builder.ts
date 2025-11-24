import { historyManager } from '../engine/history-manager';

export function buildSystemPrompt(
  userId: string,
  storageKey: string,
  contextKey: string,
  displayName: string,
  tier: "Standard" | "Diamond" | "Lifetime",
  isGroup: boolean,
  overridePrompt?: string
): string {
  
  let statusDesc = "Standard User";
  if (tier === "Lifetime") statusDesc = "Lifetime Diamond";
  if (tier === "Diamond") statusDesc = "Diamond Member";

  const basePersonality = overridePrompt || historyManager.getSystemPrompt(storageKey, contextKey);

  return `
[YOUR CURRENT PERSONA]
${basePersonality}

[METADATA - DO NOT REVEAL]
- Current User: ${displayName}
- Status: ${statusDesc}
- Context: ${isGroup ? "Group Chat (Multiple people)" : "Direct Message (Private)"}

[INSTRUCTIONS]
1. You are interacting with "${displayName}".
2. USE this information to tailor your tone (e.g. be more respectful to Diamond members).
3. DO NOT mention their Name or Status in every message. Only use it if it is naturally relevant.
4. DO NOT start every sentence with their name. Speak naturally.
`.trim();
}