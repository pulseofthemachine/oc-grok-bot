import fs from 'fs';
import path from 'path';
import { CommandRegistry, Command } from './core/registry';

export async function loadCommands(registry: CommandRegistry) {
  const commandsDir = path.join(__dirname, 'commands');
  
  if (!fs.existsSync(commandsDir)) {
    console.error(`Commands directory not found: ${commandsDir}`);
    return;
  }

  const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of files) {
    try {
      // Dynamic Import
      const modulePath = path.join(commandsDir, file);
      const module = await import(modulePath);
      
      // Type-safe lookup for Command export
      const commandCandidates = Object.values(module) as unknown[];
      const commandObj = commandCandidates.find((exp): exp is Command => 
        exp != null &&
        typeof exp === 'object' &&
        'name' in exp &&
        typeof (exp as any).name === 'string' &&
        'execute' in exp &&
        typeof (exp as any).execute === 'function'
      );

      if (commandObj) {
        registry.register(commandObj);
        console.log(`✅ Loaded command: /${commandObj.name}`);
      }
    } catch (err) {
      console.error(`❌ Failed to load command ${file}:`, err);
    }
  }
}
