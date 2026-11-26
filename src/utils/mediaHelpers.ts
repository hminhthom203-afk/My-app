export const MAX_LOCAL_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB
const CHUNK_RAW_BYTES = 600000; // Multiple of 3 -> 800,000 base64 chars per Firestore doc (< 1 MiB)

export function extractGoogleDriveId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Already normalized local proxy URL
  if (trimmed.startsWith('/api/drive-media')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const id = parsed.searchParams.get('id');
      return id && /^[a-zA-Z0-9_-]{10,120}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.includes('drive.google.com') && !host.includes('drive.usercontent.google.com')) {
    return null;
  }

  // Pattern 1: /file/d/<ID>/... or /d/<ID>/...
  const pathMatch = url.pathname.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,120})/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  // Pattern 2: ?id=<ID>
  const idParam = url.searchParams.get('id');
  if (idParam && /^[a-zA-Z0-9_-]{10,120}$/.test(idParam)) {
    return idParam;
  }

  return null;
}

export function normalizeMediaUrl(rawUrl: string, kind: 'image' | 'audio'): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    return `/api/drive-media?id=${encodeURIComponent(driveId)}&kind=${kind}`;
  }
  return trimmed;
}

export function inferAudioMimeType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) {
    return file.type.slice(0, 80);
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return 'audio/mpeg';
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, Math.min(i + step, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function readAndChunkAudioFile(
  file: File
): Promise<{ base64Chunks: string[]; mimeType: string; fileName: string; sizeBytes: number }> {
  if (file.size <= 0) {
    throw new Error('Tệp âm thanh rỗng hoặc không hợp lệ.');
  }
  if (file.size > MAX_LOCAL_AUDIO_BYTES) {
    throw new Error(
      'Tệp nhạc tải trực tiếp tối đa 50 MB. Với tệp nặng hơn, bạn có thể tải lên Google Drive rồi dán link vào ô bên dưới.'
    );
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const base64Chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += CHUNK_RAW_BYTES) {
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK_RAW_BYTES, bytes.length));
    base64Chunks.push(uint8ToBase64(slice));
  }

  if (base64Chunks.length > 200) {
    throw new Error('Tệp nhạc vượt quá giới hạn lưu trữ. Vui lòng dùng link Google Drive hoặc file nhỏ hơn 50 MB.');
  }

  return {
    base64Chunks,
    mimeType: inferAudioMimeType(file),
    fileName: file.name,
    sizeBytes: file.size,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh này.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function loadImageSource(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.src = objectUrl;
  try {
    if (typeof img.decode === 'function') {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Không thể giải mã tệp ảnh này.'));
      });
    }
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

export async function compressImageFile(file: File): Promise<string> {
  const directTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (file.size > 0 && file.size <= 135000 && directTypes.includes(file.type)) {
    const directUrl = await readFileAsDataUrl(file);
    if (directUrl.length > 0 && directUrl.length <= 190000) {
      return directUrl;
    }
  }

  const { source, width: origW, height: origH, cleanup } = await loadImageSource(file).catch(
    () => {
      throw new Error(
        'Định dạng ảnh không được trình duyệt hỗ trợ. Hãy thử JPG, PNG hoặc WebP.'
      );
    }
  );

  try {
    const attempts: Array<[number, number]> = [
      [480, 0.86],
      [420, 0.78],
      [340, 0.7],
      [260, 0.6],
    ];

    for (const [maxDim, quality] of attempts) {
      let width = origW;
      let height = origH;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Không thể xử lý ảnh trên trình duyệt này.');
      }

      // Fill warm rose-ivory backdrop so transparent PNG/WebP never turns pitch black in JPEG
      ctx.fillStyle = '#FFF0F5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

      const webpUrl = canvas.toDataURL('image/webp', quality);
      if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= 190000) {
        return webpUrl;
      }

      const jpegUrl = canvas.toDataURL('image/jpeg', quality);
      if (jpegUrl.length <= 190000) {
        return jpegUrl;
      }
    }

    throw new Error(
      'Ảnh quá lớn để lưu trực tiếp. Vui lòng chọn ảnh nhẹ hơn hoặc dùng link Google Drive.'
    );
  } finally {
    cleanup();
  }
}

export function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').trim();
}
