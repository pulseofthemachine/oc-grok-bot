import crypto from 'crypto';
if (!global.crypto) {
  // @ts-ignore
  global.crypto = crypto;
}

import { startBotServer } from './modules/engine/server-runner';
import { CommandRegistry } from './modules/engine/command-registry';
import { loadCommands } from './modules/loader';

(async () => {
  // 1. Setup Registry
  const registry = new CommandRegistry();

  // 2. Auto-load all commands from modules/commands folder
  await loadCommands(registry);

  // 3. Start Server
  startBotServer(3000, registry);
})();