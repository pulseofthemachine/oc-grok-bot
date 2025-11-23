import { Command } from '../command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { historyManager } from '../history-manager';

// Ensure this matches the Principal ID of the user RUNNING the command
const ADMIN_ID = "6vxrs-taaaa-aaaar-a2o3q-cai"; 

export const ClearStoryCommand: Command = {
  name: "clearstory",
  description: "Clear the current roleplay session (Admin Only)",
  permissions: Permissions.encodePermissions({
    chat: [],
    community: [],
    message: ["Text"]
  }),
  params: [],
  execute: async (ctx) => {
    console.log("--- DEBUG CLEAR STORY ---");
    console.log(`Command Runner: ${ctx.userId}`);
    console.log(`Required Admin: ${ADMIN_ID}`);
    console.log(`Context Type:   ${ctx.isGroup ? 'GROUP' : 'DIRECT'}`);
    console.log(`Targeting File: ${ctx.storageKey}.json`);

    // 1. Security Check
    if (ctx.userId !== ADMIN_ID) {
      console.log("❌ ACCESS DENIED: User ID does not match Admin ID.");
      await ctx.reply(`⛔ **Access Denied:** You (${ctx.userId.slice(0,5)}...) are not the bot owner.`);
      return; 
    }

    // 2. Clear History
    // We target the 'roleplay' bucket specifically within the storageKey file
    historyManager.clearHistory(ctx.storageKey, 'roleplay');
    
    console.log(`✅ Cleared 'roleplay' history for ${ctx.storageKey}`);
    
    await ctx.reply("Story memory wiped successfully for this chat context.");
  }
};