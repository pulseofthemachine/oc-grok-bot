import { BotContext } from '../core/context';

export async function fetchRecentMessages(ctx: BotContext, limit: number = 50): Promise<string | null> {
  try {
    const summaryResp = await (ctx.client as any).chatSummary();

    if ((summaryResp as any).kind === 'error') {
      console.error("Failed to load chat summary:", summaryResp);
      return null;
    }

    const startEventIndex = (summaryResp as any).latestEventIndex;

    if (startEventIndex === undefined) {
      console.error("Summary has no event index");
      return null;
    }

    const eventsResp = await (ctx.client as any).chatEvents({
      kind: 'chat_events_page',
      startEventIndex,
      maxEvents: limit,
      maxMessages: limit,
      ascending: false
    });

    if ((eventsResp as any).kind === 'error') {
      console.error("Failed to load chat events:", eventsResp);
      return null;
    }

    const events = (eventsResp as any).events || [];
    const messages = events
      .map((e: unknown) => {
        const event = e as any;
        if (event.event?.kind !== 'message' || event.event.content?.kind !== 'text_content') return null;
        const sender = event.event.sender;
        const text = event.event.content.text || '';
        if (text.startsWith('/')) return null;
        return `@UserId(${sender}): ${text}`;
      })
      .filter((msg: unknown): msg is string => typeof msg === 'string')
      .reverse();

    return messages.join('\n');

  } catch (e) {
    console.error("Error fetching logs:", e);
    return null;
  }
}
