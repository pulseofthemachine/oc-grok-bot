import express, { Request, Response } from 'express';
import cors from 'cors';
import { botFactory } from './config';
import { BotContext } from './context';
import { CommandRegistry } from './registry';
import { argumentsInvalid, BadRequestError } from '@open-ic/openchat-botclient-ts';
import { NextFunction } from 'express';

export function startBotServer(port: number, registry: CommandRegistry) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (_, res) => res.send("Bot Server Running 🚀"));

  // Dynamically generate JSON from registry
  app.get('/bot_definition', (_, res) => res.json(registry.getDefinition()));

  app.post('/execute_command', async (req: Request, res: Response) => {
    try {
      const ctx = new BotContext(req, res, botFactory);
      
      await ctx.init(); 
      // Route the context to the correct command
      await registry.execute(ctx);

    } catch (error: any) {
      console.error("Error:", error);
      if (error instanceof BadRequestError) res.status(400).send(error.message);
      else if (error.message.includes("Missing argument")) res.status(400).json(argumentsInvalid());
      else if (!res.headersSent) res.status(500).send("Internal Server Error");
    }
  });

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Global Error:", err.stack);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
    next();
  });

  app.listen(port, () => {
    console.log(`🤖 Bot running at http://localhost:${port}`);
  });
}
