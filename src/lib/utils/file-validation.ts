// ================================================================
// TYG POS — File validation with magic byte checking
// Never trust Content-Type header alone — verify file signatures.
// ================================================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png':  [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }],
  'image/heic': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  'image/heif': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
};

function detectMimeFromBuffer(buffer: Uint8Array): string | null {
  for (const [mime, sigs] of Object.entries(MAGIC_BYTES)) {
    for (const sig of sigs) {
      const offset = sig.offset ?? 0;
      const match = sig.bytes.every((byte, i) => buffer[offset + i] === byte);
      if (match) {
        if (mime === 'image/webp') {
          const webp = [0x57, 0x45, 0x42, 0x50];
          if (!webp.every((b, i) => buffer[8 + i] === b)) continue;
        }
        return mime;
      }
    }
  }
  return null;
}

export async function validateImageFile(
  file: File,
  options: { maxSizeMb?: number; allowedTypes?: string[] } = {}
): Promise<FileValidationResult> {
  const { maxSizeMb = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] } = options;

  if (file.size > maxSizeMb * 1024 * 1024) {
    return { valid: false, error: `File too large. Maximum ${maxSizeMb}MB.` };
  }
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type not allowed.` };
  }

  try {
    const buffer = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const detected = detectMimeFromBuffer(buffer);
    if (!detected) return { valid: false, error: 'File content does not match an allowed image format.' };
    if (detected !== file.type && !(detected === 'image/heif' && file.type === 'image/heic')) {
      return { valid: false, error: 'File content does not match the declared type.', detectedType: detected };
    }
    return { valid: true, detectedType: detected };
  } catch {
    return { valid: false, error: 'Could not read file.' };
  }
}
