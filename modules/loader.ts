import fs from 'fs';
import path from 'path';
import { CommandRegistry } from './command-registry';

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
      
      // Look for the export (Default or Named)
      // Expectation: export const CommandName = { ... }
      const commandObj = Object.values(module)[0] as any;

      if (commandObj && commandObj.name && commandObj.execute) {
        registry.register(commandObj);
        console.log(`✅ Loaded command: /${commandObj.name}`);
      }
    } catch (err) {
      console.error(`❌ Failed to load command ${file}:`, err);
    }
  }
}