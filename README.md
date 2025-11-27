# OpenChat Grok Bot Framework

A high-performance, modular TypeScript bot framework for **OpenChat** on the Internet Computer. Integrated with **OpenRouter (Grok/Llama/etc)** featuring persistent memory, multi-user context isolation, and a plug-and-play command architecture.

## 🚀 Features

*   **🧠 Persistent Memory:** Conversations are saved to disk (`data/` folder), ensuring memory survives server restarts.
*   **🎭 Multi-Context Support:** Enables parallel, isolated conversation contexts (e.g., a standard chat and a separate roleplay session) for each user or group.
*   **🔌 Plug-and-Play Commands:** Automatically loads all command modules from the `modules/commands/` directory on startup.
*   **🛡️ Type-Safe & Modular:** Built with TypeScript, featuring a clean separation of concerns that makes the codebase easy to maintain and extend.
*   **🤖 AI Agnostic:** Pre-configured for Grok via OpenRouter but supports any OpenAI-compatible model.
*   **✅ OpenChat Native:** Handles JWT verification and Principal ID extraction for seamless integration with the OpenChat platform.

---

## 🏛️ Architectural Overview

The bot operates on a simple yet powerful design pattern:

1.  **Initialization:** On startup, the server dynamically loads all command files from `modules/commands/` into a `CommandRegistry`. This registry is responsible for mapping command names to their corresponding execution logic.
2.  **Request Handling:** Incoming HTTP requests are handled by an Express server. Each request is wrapped in a `BotContext` object, which encapsulates all the information and functionality related to the current request (e.g., user details, command arguments, and helper methods for replying).
3.  **Command Dispatch:** The `BotContext` is passed to the `CommandRegistry`, which identifies the appropriate command based on the request and executes it.
4.  **Service Layer:** Commands utilize a suite of services for core functionalities like interacting with the AI (`chat.ts`), managing user credits (`economy.ts`), and handling data persistence (`history/manager.ts`).

This architecture keeps the command files lightweight and focused on their specific tasks, while the `BotContext` and service layers provide all the necessary tools for complex operations.

---

## 📂 Project Structure

```text
├── main.ts                     # Application entry point
├── tsconfig.json               # TypeScript configuration
├── modules/
│   ├── commands/               # --- Command modules (add new commands here)
│   ├── core/                   # --- Core server and bot components
│   │   ├── context.ts          # BotContext class (request-level state)
│   │   ├── registry.ts         # CommandRegistry for command loading
│   │   ├── server.ts           # Express.js server setup
│   │   └── config.ts           # Bot client configuration
│   ├── services/               # --- Business logic
│   │   ├── chat.ts             # AI chat interaction service
│   │   ├── economy.ts          # Credit management service
│   │   └── history/            # --- Data persistence
│   │       ├── manager.ts      # High-level history management
│   │       ├── store.ts        # File-based data storage
│   │       └── types.ts        # Data structures for session history
│   ├── adapters/               # --- External service integrations
│   │   ├── openchat.ts         # OpenChat SDK wrapper
│   │   └── openrouter.ts       # OpenRouter API client
│   ├── utils/                  # --- Utility functions
│   └── loader.ts               # Command auto-loader
├── data/                       # --- User data (auto-generated)
└── .env                        # Environment variables
```

---

## 🛠️ Setup & Installation

### 1. Prerequisites
*   Node.js v20+
*   An OpenRouter API Key
*   Run OpenChat locally or have an OpenChat account (to register and interact with the bot)

### 2. Clone & Install
```bash
git clone https://github.com/pulseofthemachine/oc-grok-bot.git
cd oc-grok-bot
npm install
```

### 3. Environment Variables
Create a `.env` file in the root and fill it in using .env.example as a template:
```env
# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# OpenChat Configuration (Found in Bot Client Data)
IC_HOST=https://ic0.app
STORAGE_INDEX_CANISTER=...
```

### 4. Run Locally
To start the server for local development, run:
```bash
npx tsx main.ts
```
Since OpenChat requires an HTTPS endpoint for bots, you will need to expose your local server using a tool like Ngrok:
```bash
ngrok http 3000
```
*You can then register your bot in OpenChat using the provided Ngrok HTTPS URL.*

---

## 💻 Adding New Commands

Thanks to the modular architecture, adding a new command is trivial.

- **1. Create a file:** `modules/commands/joke.ts`
- **2. Use an existing command as a template** (e.g. poem.ts)
- **3. Restart the server.** Your new `/joke` command is now live!

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