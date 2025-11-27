// Encapsulates the logic for sending messages to the IC
export async function sendToOpenChat(client: unknown, token: string, messageObject: unknown) {
  const msgObj = messageObject as any;
  if (!msgObj.toInputArgs) return;

  const originalToInputArgs = msgObj.toInputArgs.bind(msgObj);
  
  msgObj.toInputArgs = (ctx: unknown) => {
    const standardArgs = originalToInputArgs ? originalToInputArgs(ctx) : {};
    // Inject the auth_token required by the canister
    return { ...standardArgs, auth_token: token };
  };

  await (client as any).sendMessage(msgObj);
  return msgObj;
}