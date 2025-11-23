import * as dotenv from 'dotenv';
import { BotClientFactory } from '@open-ic/openchat-botclient-ts';

dotenv.config();

const identityPrivateKey = process.env.IDENTITY_PRIVATE;
const openChatPublicKey = process.env.OC_PUBLIC;

// Validation check
if (!identityPrivateKey || !openChatPublicKey) {
  console.error("CRITICAL ERROR: Missing IDENTITY_PRIVATE or OC_PUBLIC in .env file.");
  process.exit(1);
}

export const botFactory = new BotClientFactory({
  openchatPublicKey: openChatPublicKey,
  icHost: process.env.IC_HOST!,
  identityPrivateKey: identityPrivateKey,
  openStorageCanisterId: process.env.STORAGE_INDEX_CANISTER!,
});