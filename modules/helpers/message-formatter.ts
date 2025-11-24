export function formatDisplayMessage(
  userId: string, 
  userPrompt: string, 
  aiResponse: string, 
  isGroup: boolean
): string {
  
  const senderTag = `@UserId(${userId})`;

  if (isGroup) {
    // Group: Code Block with Name Tag
    return "```\n" + `${senderTag}: ${userPrompt}` + "\n```\n" + aiResponse;
  } else {
    // DM: Standard Blockquote
    return `${aiResponse}`;
  }
}