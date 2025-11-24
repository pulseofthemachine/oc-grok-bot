import { Command } from '../engine/command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { historyManager } from '../engine/history-manager';

// The specific user allowed to wipe group memories
const ADMIN_ID = "6vxrs-taaaa-aaaar-a2o3q-cai"; 

export const ClearChatCommand: Command = {
  name: "clearhistory",
  description: "Clear conversation history",
  permissions: Permissions.encodePermissions({
    chat: [],
    community: [],
    message: ["Text"]
  }),
  params: [],
  execute: async (ctx) => {
    
    // 1. Security Check for Groups
    // If it's a group, only the Admin can wipe it.
    // If it's a Private Chat (not a group), the user can always wipe their own memory.
    if (ctx.isGroup && ctx.userId !== ADMIN_ID) {
      await ctx.reply("⛔ **Access Denied:** To preserve shared context, only the bot administrator can clear history in Group Chats.");
      return;
    }

    historyManager.clearHistory(ctx.storageKey, 'default');
    
    await ctx.reply("Memory wiped! I have forgotten everything we talked about in this chat context.");
  }
};