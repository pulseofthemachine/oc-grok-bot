# OpenChat Grok Bot Framework

A high-performance, modular TypeScript bot framework for **OpenChat** on the Internet Computer. Integrated with **OpenRouter (Grok/Llama/etc)** featuring persistent memory, multi-user context isolation, and a plug-and-play command architecture.

## 🚀 Features

*   **🧠 Persistent Memory:** User and group conversations are saved to disk (`data/` folder). Memory survives server restarts.
*   **🎭 Multi-Context Support:** Users can have parallel, isolated conversations (e.g., a standard Chat context AND a separate RPG Roleplay context) that never overlap.
*   **🔌 Auto-Loading Commands:** Simply drop a `.ts` file into `modules/commands/` and the server automatically registers it. No manual routing required.
*   **🛡️ Type-Safe & Modular:** Built with TypeScript. Logic is separated into a `BotContext` abstraction layer, keeping command files incredibly clean.
*   **🤖 AI Agnostic:** Pre-configured for **Grok** (via OpenRouter) but supports any OpenAI-compatible model.
*   **✅ OpenChat Native:** Handles JWT verification, Principal IDs, and patches the SDK to ensure correct persistence on the Blockchain.

---

## 📂 Project Structure

```text
├── main.ts                  # Entry point (Initializes Registry & Server)
├── modules/
│   ├── commands/            # ⚡️ DROP NEW COMMANDS HERE
│   │   ├── ask.ts           # Standard AI Chat
│   │   ├── roleplay.ts      # RPG Context Example
│   │   ├── personality.ts   # System Prompt Manager
│   │   └── clearchat.ts     # Chat history wiper (ask)
│   │   └── clearstory.ts    # Story history wiper (roleplay)
│   │   └── poem.ts          # Write a poem
│   ├── bot-context.ts       # Abstraction Layer (The "Magic" Helper)
│   ├── command-registry.ts  # Command Router
│   ├── config.ts            # Env & Key Loader
│   ├── history-manager.ts   # JSON File Database Engine
│   ├── loader.ts            # Auto-loader for command files
│   ├── openrouter-client.ts # AI API Client
│   └── server-runner.ts     # Express Server & Middleware
├── data/                    # User history JSON files (Auto-generated)
└── .env                     # API Keys
```

---

## 🛠️ Setup & Installation

### 1. Prerequisites
*   Node.js v20+
*   An OpenRouter API Key
*   An OpenChat account (to register the bot)

### 2. Clone & Install
```bash
git clone https://github.com/pulseofthemachine/oc-grok-bot.git
cd oc-grok-bot
npm install
```

### 3. Key Configuration
You need two PEM files in the root directory. **Do not commit these to Git.**

1.  **`private_key.pem`**: Generate this using OpenSSL.
    ```bash
    openssl ecparam -genkey -name secp256k1 -out private_key.pem
    ```
    *You will need the Principal ID of this key to register the bot. Use `dfx identity get-principal` or a helper script to find it.*

2.  **`oc_public.pem`**: Get this from OpenChat.
    *   Go to **OpenChat** -> **Profile** -> **Advanced** -> **Bot Client Data**.
    *   Copy the Public Key and paste it into a file named `oc_public.pem`.

### 4. Environment Variables
Create a `.env` file in the root:
```env
# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# OpenChat Configuration (Found in Bot Client Data)
IC_HOST=https://ic0.app
STORAGE_INDEX_CANISTER=...
```

### 5. Run Locally
Start the server:
```bash
npx tsx main.ts
```
Expose your local server via Ngrok (OpenChat requires HTTPS):
```bash
ngrok http 3000
```
*Register the bot in OpenChat using your Ngrok HTTPS URL.*

---

## 💻 Adding New Commands

Thanks to the modular architecture, adding a new command is trivial.

**1. Create a file:** `modules/commands/joke.ts`
**2. Paste this template:**

```typescript
import { Command } from '../command-registry';
import { Permissions } from '@open-ic/openchat-botclient-ts';

export const JokeCommand: Command = {
  name: "joke", // Triggers on /joke
  description: "Tell a funny joke",
  permissions: Permissions.encodePermissions({ chat: ["CanSendMessages"], community: [], message: ["Text"] }),
  params: [
    {
      name: "topic",
      description: "Topic of the joke",
      required: true,
      param_type: { StringParam: { min_length: 1, max_length: 100, multi_line: false, choices: [] } }
    }
  ],
  execute: async (ctx) => {
    // The One-Liner AI Call
    await ctx.chatWithAI({
      contextKey: 'default', // Uses main chat history
      userPrompt: `Tell a joke about: ${ctx.getString("topic")}`,
      temperature: 0.9 // Higher creativity
    });
  }
};
```
**3. Restart Server.** The bot will automatically load `/joke`.

---

## 🧠 Memory & Persistence

The bot uses a file-based JSON database located in the `data/` directory.
*   **File Format:** `USER_PRINCIPAL_ID.json`
*   **Structure:**
    ```json
    {
      "contexts": {
        "default": { "history": [...], "personality": "..." },
        "roleplay": { "history": [...], "personality": "..." }
      }
    }
    ```
*   **Backups:** To backup your user data, simply download the `data/` folder.