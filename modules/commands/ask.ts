import { Command } from '../core/registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';

export const AskCommand: Command = {
  name: "askgrok",
  description: "Chat with Grok",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text"] }),
  supportsDirectMessage: true,
  params: [
    {
      name: "prompt",
      description: "Question",
      required: true,
      param_type: { StringParam: { min_length: 1, max_length: 10000, multi_line: true, choices: [] } }
    }
  ],
  execute: async (ctx) => {
    // ONE LINER!
    await ctx.chatWithAI({
      contextKey: 'default',
      userPrompt: ctx.getString("prompt"),
      temperature: 1.0,
      reasoningEnabled: true
    });
  }
};