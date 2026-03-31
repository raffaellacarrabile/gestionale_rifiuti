import { GoogleGenAI } from "@google/genai";

/**
 * Converts a PNG data URL to a basic .ico format blob.
 * This creates a single-image ICO file containing the PNG data.
 */
function pngToIco(pngDataUrl: string): Blob {
  const base64 = pngDataUrl.split(',')[1];
  const binary = atob(base64);
  const pngBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    pngBytes[i] = binary.charCodeAt(i);
  }

  const icoHeader = new Uint8Array(6);
  icoHeader[2] = 1; // Type: Icon
  icoHeader[4] = 1; // Count: 1

  const icoDirectory = new Uint8Array(16);
  icoDirectory[0] = 0; // Width (0 means 256)
  icoDirectory[1] = 0; // Height (0 means 256)
  icoDirectory[4] = 1; // Planes
  icoDirectory[6] = 32; // Bit count
  
  // Size of PNG data (4 bytes, little endian)
  const size = pngBytes.length;
  icoDirectory[8] = size & 0xff;
  icoDirectory[9] = (size >> 8) & 0xff;
  icoDirectory[10] = (size >> 16) & 0xff;
  icoDirectory[11] = (size >> 24) & 0xff;

  // Offset to PNG data (4 bytes, little endian)
  // Header (6) + Directory (16) = 22
  icoDirectory[12] = 22;
  icoDirectory[13] = 0;
  icoDirectory[14] = 0;
  icoDirectory[15] = 0;

  return new Blob([icoHeader, icoDirectory, pngBytes], { type: 'image/x-icon' });
}

export async function generateIcon() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: "A modern, professional app icon for a waste management system. The icon should feature a stylized emerald green leaf integrated with a clean, minimalist trash bin or recycling symbol. Flat vector design, professional, high contrast, vibrant emerald green and deep slate gray colors. Square composition, centered, white background.",
        },
      ],
    },
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const pngDataUrl = `data:image/png;base64,${part.inlineData.data}`;
      const icoBlob = pngToIco(pngDataUrl);
      return {
        png: pngDataUrl,
        ico: URL.createObjectURL(icoBlob)
      };
    }
  }
  return null;
}
