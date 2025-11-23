import { Command } from '../command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { historyManager } from '../history-manager';

export const PersonalityCommand: Command = {
  name: "personality",
  description: "Set the bot's vibe (Applies to entire group)",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text"] }),
  params: [
    {
      name: "description",
      description: "Describe the personality",
      required: false,
      param_type: { StringParam: { min_length: 0, max_length: 1000, multi_line: true, choices: [] } }
    }
  ],
  execute: async (ctx) => {
    let desc = "";
    try { desc = ctx.getString("description"); } catch (e) { desc = ""; }
    const CONTEXT_KEY = 'default';

    // FIX: Use ctx.storageKey instead of ctx.userId
    // This ensures the setting applies to the GROUP JSON file
    
    if (!desc || desc.trim() === "") {
      historyManager.setPersonality(ctx.storageKey, CONTEXT_KEY, ""); 
      var msg = "Personality reset for this chat.";
      historyManager.addMessage(ctx.storageKey, CONTEXT_KEY, 'assistant', msg);
      await ctx.reply(msg);
    } else {
      historyManager.setPersonality(ctx.storageKey, CONTEXT_KEY, desc);
      
      // Inject Log so context is preserved
      historyManager.addMessage(ctx.storageKey, CONTEXT_KEY, 'user', `[Command by ${ctx.userId}]: Set personality to "${desc}"`);
      var msg = `Understood. I am changing my behavior for this chat to: "${desc}"`;
      historyManager.addMessage(ctx.storageKey, CONTEXT_KEY, 'assistant', msg);
      await ctx.reply(msg);
    }
  }
};