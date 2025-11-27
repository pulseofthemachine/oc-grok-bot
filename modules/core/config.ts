import * as dotenv from 'dotenv';
import { BotClientFactory } from '@open-ic/openchat-botclient-ts';

dotenv.config();

const requiredEnv = [
  'OPENROUTER_API_KEY',
  'IC_HOST',
  'STORAGE_INDEX_CANISTER',
  'IDENTITY_PRIVATE',
  'OC_PUBLIC'
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`CRITICAL ERROR: Missing required env var: ${key}`);
    process.exit(1);
  }
}

const identityPrivateKey = process.env.IDENTITY_PRIVATE!;
const openChatPublicKey = process.env.OC_PUBLIC!;

// Validation check (legacy)
export const botFactory = new BotClientFactory({
  openchatPublicKey: openChatPublicKey,
  icHost: process.env.IC_HOST!,
  identityPrivateKey: identityPrivateKey,
  openStorageCanisterId: process.env.STORAGE_INDEX_CANISTER!,
});

export const BOT_ADMIN_ID = process.env.BOT_ADMIN_ID || "";

if (!BOT_ADMIN_ID) {
  console.warn("⚠️ WARNING: BOT_ADMIN_ID is not set in .env. Admin commands will not work.");
}