import { Command } from '../core/registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { completeChat, ChatMessage } from '../adapters/openrouter';

export const PoemCommand: Command = {
  name: "poem",
  description: "Write a random poem",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text"] }),
  params: [], // No params needed!
  execute: async (ctx) => {
    
    const history: ChatMessage[] = [
      { role: 'system', content: 'You are a poetic assistant.' },
      { role: 'user', content: "Write a short, creative poem about technology." }
    ];

    // We can use a higher temperature for creativity
    const response = await completeChat(history, { 
        model: "x-ai/grok-4.1-fast:free",
        temperature: 1.2 
    });
    
    if (typeof response === 'string') {
        await ctx.reply(response);
    } else {
        await ctx.reply("Roses are red, servers are down (and I got an unexpected image response...)");
    }
  }
};
