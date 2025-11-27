import { BotContext } from '../core/context';
import { historyManager } from './history/manager';

export class EconomyManager {
  private ctx: BotContext;

  constructor(context: BotContext) {
    this.ctx = context;
  }

  async checkAndCharge(cost: number, type: 'text' | 'image' = 'text'): Promise<boolean> {
    const isVIP = (this.ctx.membershipTier === "Diamond" || this.ctx.membershipTier === "Lifetime");
    
    // FIX: Ensure we use the User ID (Wallet), not the Group ID (Storage)
    const walletKey = this.ctx.userId; 

    console.log(`[Debug Charge] User: '${walletKey}' | Cost: ${cost}`);

    // 1. Reset
    await historyManager.checkDailyReset(walletKey, isVIP);

    // 2. Check Balance
    const balance = await historyManager.getBalance(walletKey);
    console.log(`[Debug Charge] Balance: ${balance}`);
    
    if (balance < cost) {
        await this.ctx.reply(`🚫 **Out of Credits!**\nCost: ${cost} | Balance: ${balance}`);
        return false;
    }

    // 3. Charge
    const receipt = await historyManager.deductCredits(walletKey, cost);
    console.log(`[Debug Charge] Receipt:`, receipt);
    
    if (!receipt.success) {
        await this.ctx.reply("Transaction failed (Deduct Error).");
        return false;
    }

    // Store receipt for potential refund
    (this.ctx as any).lastTransaction = { 
        daily: receipt.dailyDeducted, 
        purchased: receipt.purchasedDeducted 
    };

    historyManager.recordUsage(this.ctx.userId, cost, type);
    return true;
  }

  async refund(type: 'text' | 'image') {
    const lastTransaction = (this.ctx as any).lastTransaction;
    if (lastTransaction) {
        await historyManager.refundCredits(this.ctx.userId, lastTransaction, type);
        (this.ctx as any).lastTransaction = null; 
    } else {
        console.error("Cannot refund: No transaction record found.");
    }
  }
}