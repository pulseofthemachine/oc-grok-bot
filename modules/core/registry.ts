import { BotContext } from './context';

// Interface for what a Command looks like
export interface Command {
  name: string;
  description: string;
  permissions: unknown;
  params: unknown[];
  execute: (ctx: BotContext) => Promise<void>;
  
  // New Optional Field
  supportsDirectMessage?: boolean; 
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  // Add a command to the list
  register(cmd: Command) {
    this.commands.set(cmd.name, cmd);
  }

  // 1. Generate the JSON for OpenChat automatically
  getDefinition() {
    return {
      description: "An AI assistant powered by OpenRouter",
      commands: Array.from(this.commands.values()).map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        permissions: cmd.permissions,
        params: cmd.params,
        default_role: "Participant",
        direct_messages: cmd.supportsDirectMessage || false 
      }))
    };
  }

  // 2. Find and Run the correct command
  async execute(ctx: BotContext) {
    const cmd = this.commands.get(ctx.commandName);
    
    if (!cmd) {
      console.error(`Unknown command: ${ctx.commandName}`);
      throw new Error(`Unknown command: ${ctx.commandName}`);
    }

    console.log(`Executing command: ${cmd.name}`);
    await cmd.execute(ctx);
  }
}
