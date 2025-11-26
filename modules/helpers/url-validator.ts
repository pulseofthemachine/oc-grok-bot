export async function validateImageUrl(url: string): Promise<{ isValid: boolean; error?: string }> {
  // 1. Check Syntax
  try {
    new URL(url);
  } catch (e) {
    return { isValid: false, error: "Invalid URL format. Please provide a valid http:// or https:// link." };
  }

  // 2. Check Reachability & Content-Type
  try {
    const response = await fetch(url, { method: 'HEAD' }); // Just check headers first
    
    if (!response.ok) {
      return { isValid: false, error: `Image not found. Server returned status ${response.status}` };
    }

    const type = response.headers.get('content-type');
    if (!type || !type.startsWith('image/')) {
      return { isValid: false, error: `URL does not point to an image. Content-Type is '${type}'` };
    }

    return { isValid: true };

  } catch (e: any) {
    return { isValid: false, error: `Could not connect to URL: ${e.message}` };
  }
}