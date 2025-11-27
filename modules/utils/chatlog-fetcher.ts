import { BotContext } from '../core/context';

export async function fetchRecentMessages(ctx: BotContext, limit: number = 50): Promise<string | null> {
  try {
    // 1. Get Chat Summary
    const summaryResp = await ctx.client.chatSummary();

    // DEBUG: See what we got
    // console.log("SUMMARY RESP:", summaryResp);

    // FIX: The SDK returns the object directly, or an error object.
    // If it has 'latestEventIndex', it is a success.
    // If it has 'kind: error', it failed.

    if (summaryResp.kind === 'error') { // Check for error explicitly
      console.error("Failed to load chat summary:", summaryResp);
      return null;
    }

    // It's valid! Use the index.
    const startEventIndex = summaryResp.latestEventIndex;

    if (startEventIndex === undefined) {
      console.error("Summary has no event index");
      return null;
    }

    // 2. Fetch Events
    const eventsResp = await ctx.client.chatEvents({
      kind: 'chat_events_page',
      startEventIndex: startEventIndex, // Use the fixed variable
      maxEvents: limit,
      maxMessages: limit,
      ascending: false
    });

    // 3. Filter & Format
    // We only want Text messages.
    const messages = eventsResp.events
      .filter((e: any) => e.event.kind === 'message' && e.event.content.kind === 'text_content')
      .map((e: any) => {
        const sender = e.event.sender;
        const text = e.event.content.text;
        // Exclude bot commands to reduce noise
        if (text.startsWith('/')) return null;
        return `@UserId(${sender}): ${text}`;
      })
      .filter((msg: any) => msg !== null) // Remove nulls
      .reverse(); // Flip so it reads Oldest -> Newest for the AI

    return messages.join('\n');

  } catch (e) {
    console.error("Error fetching logs:", e);
    return null;
  }
}
