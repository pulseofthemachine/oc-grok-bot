import sharp from 'sharp';

export interface ProcessedImage {
  data: Uint8Array;
  mime: string;
}

export async function downloadAndResizeImage(imageUrl: string): Promise<ProcessedImage | null> {
  try {
    let buffer: Buffer;

    // 1. Get Buffer (Base64 or HTTP)
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
      if (!matches) return null;
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // 2. Resize with Sharp
    const resizedBuffer = await sharp(buffer)
      .resize(1408, 768, { 
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat('png')
      .toBuffer();

    return {
      data: new Uint8Array(resizedBuffer),
      mime: 'image/png'
    };

  } catch (e) {
    console.error("Image Processing Error:", e);
    return null;
  }
}