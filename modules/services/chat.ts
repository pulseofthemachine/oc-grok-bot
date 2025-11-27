import { BotContext } from '../core/context';
import { historyManager } from '../services/history/manager';
import { completeChat, ChatMessage } from '../adapters/openrouter';
import { buildSystemPrompt } from '../utils/prompt-builder';
import { formatDisplayMessage } from '../utils/message-formatter';

export async function chatWithAI(
  ctx: BotContext,
  options: {
    contextKey: string;
    userPrompt: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    reasoningEnabled?: boolean;
    tools?: any[];
  }
) {
  // 1. Charge Credits (Text = 1)
  if (!(await ctx.checkAndCharge(1, 'text'))) return;

  try {
    const { contextKey, userPrompt, model, temperature, reasoningEnabled, tools } = options;

    historyManager.addMessage(ctx.storageKey, contextKey, 'user', `${ctx.displayName}: ${userPrompt}`);

    const finalSystemPrompt = buildSystemPrompt(
      ctx.userId,
      ctx.storageKey,
      contextKey,
      ctx.displayName,
      ctx.membershipTier,
      ctx.isGroup,
      options.systemPrompt
    );

    const contextMessages: ChatMessage[] = [{ role: 'system', content: finalSystemPrompt }];
    contextMessages.push(...historyManager.getHistory(ctx.storageKey, contextKey));

    console.log(`
[AI Request] User: ${ctx.displayName} (${ctx.membershipTier}) | Prompt: ${userPrompt.substring(0, 50)}...`);

    const response = await completeChat(contextMessages, {
      model: model || "x-ai/grok-4.1-fast:free",
      temperature: temperature || 0.7,
      reasoningEnabled: reasoningEnabled,
      tools: tools
    });

    let textResponse = "No response.";
    if (typeof response === 'string') {
      textResponse = response;
    } else if (Array.isArray(response)) {
      textResponse = "[Image Generated - Use /imagine to view images]";
    }

    historyManager.addMessage(ctx.storageKey, contextKey, 'assistant', textResponse);

    const displayMessage = formatDisplayMessage(ctx.userId, userPrompt, textResponse, ctx.isGroup);

    await ctx.reply(displayMessage);

  } catch (error) {
    // Refund on error
    console.error("Chat Error:", error);
    await ctx.refund('text');
    await ctx.reply("⚠️ An error occurred. Credits have been refunded.");
  }
}