import { Command } from '../core/registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { completeChat } from '../adapters/openrouter';
import { historyManager } from '../services/history/manager';

export const CatchupCommand: Command = {
  name: "catchup",
  description: "Summarize the last 50 messages in this chat",
  permissions: Permissions.encodePermissions({
    chat: ["ReadMessages", "ReadChatSummary"],
    community: [],
    message: ["Text"]
  }),
  params: [],
  execute: async (ctx) => {
    // 1. Check Credits (Cost: 2)
    if (!(await ctx.checkAndCharge(2, 'text'))) return;

    try {
        // 2. Fetch Logs
        const chatLogs = await ctx.fetchRecentMessages(50); // Fetch last 50 messages

        if (!chatLogs || chatLogs.length < 10) {
            await ctx.reply("⚠️ Unable to read history. Either the chat is empty, or I don't have **'Read Messages'** permission.");
            return;
        }

        // 3. Prepare Prompt
        const prompt = `
You are an expert community manager.
Below is a log of the recent conversation in this chat group.
Summarize the key discussions, main topics, specific questions asked, and the general sentiment.

[IMPORTANT INSTRUCTIONS]
1. Users are identified by tags like "@UserId(xxxxx-...)".
2. When you mention a specific user in your summary, **USE THEIR @UserId TAG EXACTLY**.
   - Example: "User @UserId(abc-123) asked about the roadmap."
   - This allows the interface to link to their profile.
3. Be concise. Use bullet points.

--- CHAT LOG START ---
${chatLogs}
--- CHAT LOG END ---
        `.trim();

        // --- DEBUG: SHOW EXACTLY WHAT IS SENT ---
        //console.log("\n┌────────────── CATCHUP PROMPT ──────────────┐");
        //console.log(prompt);
        //console.log("└────────────────────────────────────────────┘\n");
        // ----------------------------------------

        // 4. Call AI
        const response = await completeChat([
            { role: 'user', content: prompt }
        ], {
            model: "x-ai/grok-4.1-fast:free", 
            temperature: 0.5
        });

        const summary = typeof response === 'string' ? response : "Error generating summary.";

        // 5. Save Summary to History
        historyManager.addMessage(ctx.storageKey, 'default', 'system', `[System Summary]: ${summary}`);
        historyManager.addMessage(ctx.storageKey, 'default', 'assistant', summary);

        // 6. Reply
        await ctx.reply(`**📝 Chat Catchup:**\n\n${summary}`);

    } catch (e: any) {
        await ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};