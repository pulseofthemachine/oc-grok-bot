import { Command } from '../command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { historyManager } from '../history-manager';

const ADMIN_ID = "6vxrs-taaaa-aaaar-a2o3q-cai"; 

export const ClearStoryCommand: Command = {
  name: "clearstory",
  description: "Clear the current roleplay session",
  permissions: Permissions.encodePermissions({
    chat: [],
    community: [],
    message: ["Text"]
  }),
  params: [],
  execute: async (ctx) => {
    console.log("--- DEBUG CLEAR STORY ---");
    console.log(`Runner: ${ctx.userId} | Context: ${ctx.isGroup ? 'GROUP' : 'DIRECT'}`);

    // 1. Security Logic
    // Rule: If it's a Group, only Admin can clear it.
    // Rule: If it's Direct, the user owns it, so they can clear it.
    if (ctx.isGroup && ctx.userId !== ADMIN_ID) {
      console.log("❌ ACCESS DENIED (Group protection)");
      await ctx.reply("⛔ **Access Denied:** Only the bot owner can wipe the shared story in a Group.");
      return; 
    }

    // 2. Clear History
    historyManager.clearHistory(ctx.storageKey, 'roleplay');
    
    console.log(`✅ Cleared 'roleplay' history for ${ctx.storageKey}`);
    await ctx.reply("Story memory wiped successfully for this session.");
  }
};