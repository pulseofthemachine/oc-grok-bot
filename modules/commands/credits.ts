import { Command } from '../core/registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';
import { historyManager } from '../services/history/manager';

export const CreditsCommand: Command = {
  name: "credits",
  description: "Check your credit balance and usage stats",
  permissions: Permissions.encodePermissions({ chat: [], community: [], message: ["Text"] }),
  params: [], 
  execute: async (ctx) => {
    // Trigger the reset check explicitly before reading stats
    const isVIP = (ctx.membershipTier === "Diamond" || ctx.membershipTier === "Lifetime");
    await historyManager.checkDailyReset(ctx.userId, isVIP);

    // Now get the fresh stats
    const data = await historyManager.getStats(ctx.userId);
    const dailyLimit = isVIP ? historyManager.DAILY_LIMIT_VIP : historyManager.DAILY_LIMIT_STANDARD;
    
    // Calculate Time to Reset (00:00 UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    const diffMs = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const msg = `
💳 **CREDIT BALANCE: ${data.dailyCredits + data.purchasedCredits}**

**Daily Allowance (${ctx.membershipTier})**
• Available: ${data.dailyCredits} / ${dailyLimit}
• Resets in: ${hours}h ${mins}m (00:00 UTC)

**Purchased Credits**
• Balance: ${data.purchasedCredits}
• Status: ⚠️ *FEATURE NOT ACTIVE YET*

📊 **Lifetime Statistics**
• Total Credits Spent: ${data.totalCreditsUsed}
• Messages Sent: ${data.totalTextMessages}
• Images Generated: ${data.totalImagesGenerated}
`.trim();

    await ctx.reply(msg);
  }
};