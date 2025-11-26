import { Command } from '../engine/command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';

export const SearchCommand: Command = {
  name: "searchfor",
  description: "Search the live web or X",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text"] }),
  params: [
    {
      name: "query",
      description: "What do you want to search for?",
      required: true,
      param_type: { StringParam: { min_length: 1, max_length: 500, multi_line: false, choices: [] } }
    },
    {
      name: "source",
      description: "Source: 'web' or 'x' (Default: web)",
      required: false,
      param_type: { 
        StringParam: { 
          min_length: 1, 
          max_length: 10, 
          multi_line: false, 
          choices: [
            { name: "The Web", value: "web" },
            { name: "X (Twitter)", value: "x" }
          ] 
        } 
      }
    }
  ],
  execute: async (ctx) => {
    const query = ctx.getString("query");
    let source = "web"; 
    try { source = ctx.getString("source"); } catch(e) {}

    // Grok Tool Definition
    const toolType = source === "x" ? "x_search" : "web_search";
    const tools = [{ type: toolType }];

    await ctx.chatWithAI({
      contextKey: 'default', 
      userPrompt: `Search using ${toolType}: "${query}"`,
      temperature: 0.5, 
      tools: tools
    });
  }
};