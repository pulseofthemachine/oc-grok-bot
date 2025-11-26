// Encapsulates the logic for sending messages to the IC
export async function sendToOpenChat(client: any, token: string, messageObject: any) {
  const originalToInputArgs = messageObject.toInputArgs.bind(messageObject);
  
  messageObject.toInputArgs = (ctx: any) => {
      const standardArgs = originalToInputArgs(ctx);
      // Inject the auth_token required by the canister
      return { ...standardArgs, auth_token: token };
  };

  await client.sendMessage(messageObject);
  return messageObject;
}