import { SIGN_IMAGE_MAX_CHARS } from 'shared';

export const SIGN_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const SIGN_MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Seal & sign images are shrunk to fit inside this box before upload. */
export const SIGN_MAX_WIDTH = 600;
export const SIGN_MAX_HEIGHT = 240;

/** Why a picked file can't be used, or null when it is fine. */
export function validateSignFile(file: { type: string; size: number }): string | null {
  if (!SIGN_ACCEPTED_TYPES.includes(file.type)) return 'Use a PNG, JPEG or WebP image.';
  if (file.size > SIGN_MAX_FILE_BYTES) return 'The image is larger than 5 MB.';
  return null;
}

/** Size that fits inside the box, never enlarging. */
export function fitWithin(width: number, height: number, maxWidth = SIGN_MAX_WIDTH, maxHeight = SIGN_MAX_HEIGHT) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = url;
  });
}

/** Shrinks the picked image and returns it as a PNG data URL (transparent backgrounds are kept). */
export async function fileToSignDataUrl(file: File): Promise<string> {
  const problem = validateSignFile(file);
  if (problem) throw new Error(problem);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    let { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl.length <= SIGN_IMAGE_MAX_CHARS) return dataUrl;
      width = Math.round(width * 0.7);
      height = Math.round(height * 0.7);
    }
    throw new Error('The image is too detailed to store. Try a simpler or smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
